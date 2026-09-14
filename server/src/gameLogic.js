const crypto = require("crypto");

// Les essais sont volontairement calibrés en dessous de log2(max) : même
// avec une recherche dichotomique optimale, la victoire n'est jamais
// garantie, ce qui assure une marge maison réelle sur les cotes (voir
// calculerGain). Sans ça, l'indice "plus grand/plus petit" donné à chaque
// essai permettrait de gagner à coup sûr.
const DIFFICULTES = {
    facile: { label: "Facile (1-40)", max: 40, essaisMax: 4, coteMax: 3, coteMin: 1.75 },
    moyen: { label: "Moyen (1-100)", max: 100, essaisMax: 5, coteMax: 4, coteMin: 2 },
    difficile: { label: "Difficile (1-200)", max: 200, essaisMax: 5, coteMax: 8, coteMin: 4 },
};

const SOLDE_INITIAL = 100;
const MISE_MAX_RATIO = 0.5;
const COUT_INDICE_RATIO = 0.2;
const SEUIL_ALERTE_PERTES = 3;

function genererServerSeed() {
    return crypto.randomBytes(32).toString("hex");
}

function hacherSeed(seed) {
    return crypto.createHash("sha256").update(seed).digest("hex");
}

// Dérive le nombre secret d'un seed via HMAC-SHA256 plutôt qu'un tirage
// aléatoire direct : le joueur peut, une fois le seed révélé en fin de
// partie, recalculer indépendamment le même nombre et vérifier qu'il
// correspond au hash affiché avant la partie (équité vérifiable).
function tirerNombreDepuisSeed(seed, max) {
    const hmac = crypto.createHmac("sha256", seed).update("nombre-mystere").digest("hex");
    const valeur = parseInt(hmac.slice(0, 8), 16);
    return (valeur % max) + 1;
}

function miseMax(solde) {
    return Math.max(1, Math.floor(solde * MISE_MAX_RATIO));
}

function coutIndice(mise) {
    return Math.max(1, Math.round(mise * COUT_INDICE_RATIO));
}

function calculerGain(mise, diff, essaisUtilises) {
    const pas = (diff.coteMax - diff.coteMin) / Math.max(1, diff.essaisMax - 1);
    const multiplicateur = diff.coteMax - (essaisUtilises - 1) * pas;
    return Math.max(1, Math.round(mise * multiplicateur));
}

module.exports = {
    DIFFICULTES,
    SOLDE_INITIAL,
    MISE_MAX_RATIO,
    COUT_INDICE_RATIO,
    SEUIL_ALERTE_PERTES,
    genererServerSeed,
    hacherSeed,
    tirerNombreDepuisSeed,
    miseMax,
    coutIndice,
    calculerGain,
};
