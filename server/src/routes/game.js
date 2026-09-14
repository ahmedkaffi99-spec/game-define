const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const {
    DIFFICULTES,
    SEUIL_ALERTE_PERTES,
    genererServerSeed,
    hacherSeed,
    tirerNombreDepuisSeed,
    miseMax,
    coutIndice,
    calculerGain,
} = require("../gameLogic");

const router = express.Router();
router.use(requireAuth);

function vueRound(round) {
    if (!round) return null;
    const diff = DIFFICULTES[round.difficulte];
    return {
        roundId: round.id,
        difficulte: round.difficulte,
        mise: round.mise,
        essaisMax: round.essais_max,
        essaisRestants: diff.essaisMax - round.essais_utilises,
        indiceUtilise: round.indice_utilise,
        hashServeur: hacherSeed(round.server_seed),
    };
}

async function chargerUtilisateur(client, userId) {
    const { rows } = await client.query("SELECT * FROM users WHERE id = $1 FOR UPDATE", [userId]);
    return rows[0];
}

router.get("/state", async (req, res) => {
    const enCours = await pool.query(
        "SELECT * FROM rounds WHERE user_id = $1 AND statut = 'en_cours' ORDER BY id DESC LIMIT 1",
        [req.userId]
    );
    const enAttenteDouble = await pool.query(
        "SELECT * FROM rounds WHERE user_id = $1 AND statut = 'gagne' AND gain_en_attente IS NOT NULL ORDER BY id DESC LIMIT 1",
        [req.userId]
    );

    res.json({
        activeRound: vueRound(enCours.rows[0]),
        pendingDouble: enAttenteDouble.rows[0]
            ? { roundId: enAttenteDouble.rows[0].id, montant: enAttenteDouble.rows[0].gain_en_attente }
            : null,
    });
});

router.post("/start", async (req, res) => {
    const { difficulte, mise } = req.body || {};
    const diff = DIFFICULTES[difficulte];

    if (!diff) {
        return res.status(400).json({ erreur: "Difficulté invalide." });
    }
    if (!Number.isInteger(mise) || mise <= 0) {
        return res.status(400).json({ erreur: "Mise invalide." });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const enCours = await client.query(
            "SELECT id FROM rounds WHERE user_id = $1 AND statut = 'en_cours' LIMIT 1",
            [req.userId]
        );
        if (enCours.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({ erreur: "Une partie est déjà en cours." });
        }

        const enAttenteDouble = await client.query(
            "SELECT id FROM rounds WHERE user_id = $1 AND statut = 'gagne' AND gain_en_attente IS NOT NULL LIMIT 1",
            [req.userId]
        );
        if (enAttenteDouble.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({ erreur: "Résous d'abord l'offre \"doubler ou rien\" en cours." });
        }

        const utilisateur = await chargerUtilisateur(client, req.userId);
        if (mise > utilisateur.solde) {
            await client.query("ROLLBACK");
            return res.status(400).json({ erreur: "Mise supérieure à ton solde." });
        }
        const max = miseMax(utilisateur.solde);
        if (mise > max) {
            await client.query("ROLLBACK");
            return res.status(400).json({ erreur: `Mise limitée à ${max} points (50% du solde).` });
        }

        const serverSeed = genererServerSeed();
        const nombreMystere = tirerNombreDepuisSeed(serverSeed, diff.max);
        const nouveauSolde = utilisateur.solde - mise;

        await client.query("UPDATE users SET solde = $1 WHERE id = $2", [nouveauSolde, req.userId]);
        const round = await client.query(
            `INSERT INTO rounds (user_id, difficulte, nombre_mystere, mise, essais_max, server_seed)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [req.userId, difficulte, nombreMystere, mise, diff.essaisMax, serverSeed]
        );

        await client.query("COMMIT");
        res.status(201).json({ ...vueRound(round.rows[0]), solde: nouveauSolde });
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
});

router.post("/guess", async (req, res) => {
    const { roundId, valeur } = req.body || {};
    if (!Number.isInteger(roundId) || !Number.isInteger(valeur)) {
        return res.status(400).json({ erreur: "Requête invalide." });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const roundRes = await client.query(
            "SELECT * FROM rounds WHERE id = $1 AND user_id = $2 FOR UPDATE",
            [roundId, req.userId]
        );
        const round = roundRes.rows[0];
        if (!round || round.statut !== "en_cours") {
            await client.query("ROLLBACK");
            return res.status(404).json({ erreur: "Aucune partie en cours avec cet identifiant." });
        }

        const diff = DIFFICULTES[round.difficulte];
        const essaisUtilises = round.essais_utilises + 1;
        const utilisateur = await chargerUtilisateur(client, req.userId);

        if (valeur === round.nombre_mystere) {
            const gain = calculerGain(round.mise, diff, essaisUtilises);
            const nouveauSolde = utilisateur.solde + gain;
            const meilleurSolde = Math.max(utilisateur.meilleur_solde, nouveauSolde);
            const serieActuelle = utilisateur.serie_actuelle + 1;
            const meilleureSerie = Math.max(utilisateur.meilleure_serie, serieActuelle);

            await client.query(
                `UPDATE users SET solde = $1, meilleur_solde = $2, serie_actuelle = $3,
                 meilleure_serie = $4, pertes_consecutives = 0 WHERE id = $5`,
                [nouveauSolde, meilleurSolde, serieActuelle, meilleureSerie, req.userId]
            );
            await client.query(
                `UPDATE rounds SET essais_utilises = $1, statut = 'gagne', gain_en_attente = $2 WHERE id = $3`,
                [essaisUtilises, gain, roundId]
            );
            await client.query(
                `INSERT INTO historique (user_id, resultat, difficulte, mise, gain) VALUES ($1, 'Gagné', $2, $3, $4)`,
                [req.userId, diff.label, round.mise, gain]
            );

            await client.query("COMMIT");
            return res.json({
                resultat: "gagne",
                nombreMystere: round.nombre_mystere,
                serverSeed: round.server_seed,
                gain,
                solde: nouveauSolde,
                pertesConsecutives: 0,
            });
        }

        const essaisRestants = diff.essaisMax - essaisUtilises;

        if (essaisRestants <= 0) {
            const serieActuelle = 0;
            const pertesConsecutives = utilisateur.pertes_consecutives + 1;

            await client.query(
                `UPDATE users SET serie_actuelle = $1, pertes_consecutives = $2 WHERE id = $3`,
                [serieActuelle, pertesConsecutives, req.userId]
            );
            await client.query(
                `UPDATE rounds SET essais_utilises = $1, statut = 'perdu' WHERE id = $2`,
                [essaisUtilises, roundId]
            );
            await client.query(
                `INSERT INTO historique (user_id, resultat, difficulte, mise, gain) VALUES ($1, 'Perdu', $2, $3, $4)`,
                [req.userId, diff.label, round.mise, -round.mise]
            );

            await client.query("COMMIT");
            return res.json({
                resultat: "perdu",
                nombreMystere: round.nombre_mystere,
                serverSeed: round.server_seed,
                solde: utilisateur.solde,
                pertesConsecutives,
                alerte: pertesConsecutives >= SEUIL_ALERTE_PERTES,
            });
        }

        await client.query("UPDATE rounds SET essais_utilises = $1 WHERE id = $2", [essaisUtilises, roundId]);
        await client.query("COMMIT");

        res.json({
            resultat: valeur < round.nombre_mystere ? "plus_grand" : "plus_petit",
            essaisRestants,
        });
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
});

router.post("/indice", async (req, res) => {
    const { roundId } = req.body || {};
    if (!Number.isInteger(roundId)) {
        return res.status(400).json({ erreur: "Requête invalide." });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const roundRes = await client.query(
            "SELECT * FROM rounds WHERE id = $1 AND user_id = $2 FOR UPDATE",
            [roundId, req.userId]
        );
        const round = roundRes.rows[0];
        if (!round || round.statut !== "en_cours") {
            await client.query("ROLLBACK");
            return res.status(404).json({ erreur: "Aucune partie en cours avec cet identifiant." });
        }
        if (round.indice_utilise) {
            await client.query("ROLLBACK");
            return res.status(409).json({ erreur: "Indice déjà utilisé pour cette partie." });
        }

        const cout = coutIndice(round.mise);
        const utilisateur = await chargerUtilisateur(client, req.userId);
        if (cout > utilisateur.solde) {
            await client.query("ROLLBACK");
            return res.status(400).json({ erreur: "Solde insuffisant pour acheter un indice." });
        }

        const nouveauSolde = utilisateur.solde - cout;
        await client.query("UPDATE users SET solde = $1 WHERE id = $2", [nouveauSolde, req.userId]);
        await client.query("UPDATE rounds SET indice_utilise = true WHERE id = $1", [roundId]);
        await client.query("COMMIT");

        const parite = round.nombre_mystere % 2 === 0 ? "pair" : "impair";
        res.json({ parite, cout, solde: nouveauSolde });
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
});

router.post("/double", async (req, res) => {
    const { roundId, accepter } = req.body || {};
    if (!Number.isInteger(roundId) || typeof accepter !== "boolean") {
        return res.status(400).json({ erreur: "Requête invalide." });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const roundRes = await client.query(
            "SELECT * FROM rounds WHERE id = $1 AND user_id = $2 FOR UPDATE",
            [roundId, req.userId]
        );
        const round = roundRes.rows[0];
        if (!round || round.statut !== "gagne" || round.gain_en_attente === null) {
            await client.query("ROLLBACK");
            return res.status(404).json({ erreur: "Aucune offre \"doubler ou rien\" en attente." });
        }

        const utilisateur = await chargerUtilisateur(client, req.userId);
        const montant = round.gain_en_attente;

        if (!accepter) {
            await client.query("UPDATE rounds SET gain_en_attente = NULL WHERE id = $1", [roundId]);
            await client.query("COMMIT");
            return res.json({ resultat: "encaisse", solde: utilisateur.solde });
        }

        const gagne = Math.random() < 0.5;
        const nouveauSolde = gagne ? utilisateur.solde + montant : utilisateur.solde - montant;
        const meilleurSolde = Math.max(utilisateur.meilleur_solde, nouveauSolde);

        await client.query("UPDATE users SET solde = $1, meilleur_solde = $2 WHERE id = $3", [
            nouveauSolde,
            meilleurSolde,
            req.userId,
        ]);
        await client.query("UPDATE rounds SET gain_en_attente = NULL WHERE id = $1", [roundId]);
        await client.query("COMMIT");

        res.json({ resultat: gagne ? "double_gagne" : "double_perdu", montant, solde: nouveauSolde });
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
});

router.post("/reset", async (req, res) => {
    const { SOLDE_INITIAL } = require("../gameLogic");
    await pool.query(
        `UPDATE users SET solde = $1, meilleur_solde = $1, meilleure_serie = 0,
         serie_actuelle = 0, pertes_consecutives = 0 WHERE id = $2`,
        [SOLDE_INITIAL, req.userId]
    );
    res.json({ solde: SOLDE_INITIAL });
});

module.exports = router;
