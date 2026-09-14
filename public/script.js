window.addEventListener("error", (e) => {
    const div = document.createElement("div");
    div.style.cssText =
        "position:fixed;top:0;left:0;right:0;background:#c00;color:#fff;padding:10px;font-family:monospace;font-size:12px;z-index:99999;white-space:pre-wrap;";
    div.textContent = `Erreur JS : ${e.message} (${e.filename}:${e.lineno})`;
    document.body.prepend(div);
});
window.addEventListener("unhandledrejection", (e) => {
    const div = document.createElement("div");
    div.style.cssText =
        "position:fixed;top:0;left:0;right:0;background:#c00;color:#fff;padding:10px;font-family:monospace;font-size:12px;z-index:99999;white-space:pre-wrap;";
    div.textContent = `Erreur async : ${e.reason && e.reason.message ? e.reason.message : e.reason}`;
    document.body.prepend(div);
});

const DIFFICULTES = {
    facile: { label: "Facile (1-20)", max: 20, essaisMax: 6, coteMax: 3, coteMin: 1.5 },
    moyen: { label: "Moyen (1-50)", max: 50, essaisMax: 7, coteMax: 5, coteMin: 2 },
    difficile: { label: "Difficile (1-100)", max: 100, essaisMax: 8, coteMax: 10, coteMin: 3 },
};
const MISE_MAX_RATIO = 0.5;

let activeRound = null; // { roundId, difficulte, mise, essaisMax, essaisRestants, indiceUtilise }
let soldeActuel = 0;

const authCard = document.getElementById("authCard");
const gameCard = document.getElementById("gameCard");
const leaderboardCard = document.getElementById("leaderboardCard");
const authUsername = document.getElementById("authUsername");
const authPassword = document.getElementById("authPassword");
const authError = document.getElementById("authError");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authToggle = document.getElementById("authToggle");
const usernameDisplay = document.getElementById("usernameDisplay");
const logoutBtn = document.getElementById("logoutBtn");

const soldeEl = document.getElementById("solde");
const statsEl = document.getElementById("stats");
const alerteEl = document.getElementById("alerte");
const difficulteSelect = document.getElementById("difficulte");
const miseInput = document.getElementById("mise");
const cotePreview = document.getElementById("cotePreview");
const nouvellePartieBtn = document.getElementById("nouvellePartieBtn");
const guessInput = document.getElementById("userGuess");
const guessBtn = document.getElementById("guessBtn");
const indiceBtn = document.getElementById("indiceBtn");
const indiceTexte = document.getElementById("indiceTexte");
const message = document.getElementById("message");
const essaisRestantsEl = document.getElementById("essaisRestants");
const doubleDiv = document.getElementById("doubleOuRien");
const doublerBtn = document.getElementById("doublerBtn");
const encaisserBtn = document.getElementById("encaisserBtn");
const historyDiv = document.getElementById("history");
const resetBtn = document.getElementById("resetBtn");
const leaderboardBody = document.getElementById("leaderboardBody");

let modeInscription = false;

async function appel(url, options = {}) {
    const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    let data = {};
    try {
        data = await res.json();
    } catch {
        data = {};
    }
    if (!res.ok) {
        throw new Error(data.erreur || "Une erreur est survenue.");
    }
    return data;
}

function jouerSon(frequence) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = frequence;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch {
        // audio non disponible, on ignore silencieusement
    }
}

function animerCarte(classe) {
    gameCard.classList.remove("anim-gain", "anim-perte");
    void gameCard.offsetWidth;
    gameCard.classList.add(classe);
}

function miseMax(solde) {
    return Math.max(1, Math.floor(solde * MISE_MAX_RATIO));
}

function majApercuCote() {
    const diff = DIFFICULTES[difficulteSelect.value];
    cotePreview.textContent = `Cote x${diff.coteMin} à x${diff.coteMax} selon rapidité · ${diff.essaisMax} essais · mise max : ${miseMax(soldeActuel)} pts`;
}

function afficherHistorique(historique) {
    if (!historique || historique.length === 0) {
        historyDiv.textContent = "Aucune partie jouée pour l'instant.";
        return;
    }
    historyDiv.innerHTML = historique
        .map((h) => {
            const signe = h.gain >= 0 ? "+" : "";
            const couleur = h.gain >= 0 ? "green" : "red";
            return `<div style="color:${couleur}">${h.resultat === "Gagné" ? "🎉" : "💥"} ${h.resultat} · mise ${h.mise} (${h.difficulte}) · ${signe}${h.gain} pts</div>`;
        })
        .join("");
}

async function chargerClassement() {
    try {
        const classement = await appel("/api/leaderboard");
        leaderboardCard.hidden = classement.length === 0;
        leaderboardBody.innerHTML = classement
            .map(
                (j, i) =>
                    `<tr><td>${i + 1}</td><td>${j.username}</td><td>${j.meilleur_solde}</td><td>${j.meilleure_serie}</td></tr>`
            )
            .join("");
    } catch {
        // classement non bloquant
    }
}

async function chargerProfil() {
    const profil = await appel("/api/auth/me");
    soldeActuel = profil.solde;
    usernameDisplay.textContent = `👤 ${profil.username}`;
    soldeEl.textContent = `💰 Solde : ${profil.solde} points`;
    statsEl.textContent = `🏆 Record : ${profil.meilleur_solde} pts · Meilleure série : ${profil.meilleure_serie}`;
    alerteEl.textContent =
        profil.pertes_consecutives >= 3
            ? "⚠️ Plusieurs pertes d'affilée — pense à faire une pause. C'est un jeu fictif, jouons prudemment !"
            : "";
    afficherHistorique(profil.historique);
    majApercuCote();
}

async function chargerEtatPartie() {
    const etat = await appel("/api/game/state");

    if (etat.activeRound) {
        activeRound = etat.activeRound;
        const diff = DIFFICULTES[activeRound.difficulte];
        difficulteSelect.value = activeRound.difficulte;
        miseInput.value = activeRound.mise;
        message.style.color = "black";
        message.textContent = `Devine un nombre entre 1 et ${diff.max} !`;
        essaisRestantsEl.textContent = `Essais restants : ${activeRound.essaisRestants}`;
        guessInput.disabled = false;
        guessBtn.disabled = false;
        indiceBtn.hidden = activeRound.indiceUtilise;
        indiceBtn.disabled = activeRound.indiceUtilise;
        nouvellePartieBtn.disabled = true;
        difficulteSelect.disabled = true;
        miseInput.disabled = true;
    } else if (etat.pendingDouble) {
        activeRound = { roundId: etat.pendingDouble.roundId };
        doubleDiv.hidden = false;
        nouvellePartieBtn.disabled = true;
    }
}

async function afficherJeu() {
    authCard.hidden = true;
    gameCard.hidden = false;
    await chargerProfil();
    await chargerEtatPartie();
    await chargerClassement();
}

function afficherAuth() {
    gameCard.hidden = true;
    authCard.hidden = false;
    authPassword.value = "";
}

authToggle.addEventListener("click", () => {
    modeInscription = !modeInscription;
    authSubmitBtn.textContent = modeInscription ? "Créer le compte" : "Se connecter";
    authToggle.textContent = modeInscription ? "Déjà un compte ? Se connecter" : "Pas de compte ? Créer un compte";
    authError.textContent = "";
});

authSubmitBtn.addEventListener("click", async () => {
    const username = authUsername.value.trim();
    const password = authPassword.value;
    authError.textContent = "";

    try {
        await appel(`/api/auth/${modeInscription ? "register" : "login"}`, {
            method: "POST",
            body: JSON.stringify({ username, password }),
        });
        await afficherJeu();
    } catch (err) {
        authError.textContent = err.message;
    }
});

logoutBtn.addEventListener("click", async () => {
    await appel("/api/auth/logout", { method: "POST" });
    afficherAuth();
});

nouvellePartieBtn.addEventListener("click", async () => {
    const mise = Number(miseInput.value);
    message.textContent = "";
    try {
        const round = await appel("/api/game/start", {
            method: "POST",
            body: JSON.stringify({ difficulte: difficulteSelect.value, mise }),
        });
        soldeActuel = round.solde;
        activeRound = round;

        soldeEl.textContent = `💰 Solde : ${round.solde} points`;
        message.style.color = "black";
        message.textContent = `Devine un nombre entre 1 et ${DIFFICULTES[round.difficulte].max} !`;
        essaisRestantsEl.textContent = `Essais restants : ${round.essaisRestants}`;

        guessInput.value = "";
        guessInput.disabled = false;
        guessBtn.disabled = false;
        indiceBtn.disabled = false;
        indiceBtn.hidden = false;
        indiceTexte.textContent = "";
        nouvellePartieBtn.disabled = true;
        difficulteSelect.disabled = true;
        miseInput.disabled = true;
        guessInput.focus();
    } catch (err) {
        message.style.color = "orange";
        message.textContent = `⚠️ ${err.message}`;
    }
});

guessBtn.addEventListener("click", async () => {
    if (!activeRound) return;
    const valeur = Number(guessInput.value);
    if (!valeur) {
        message.style.color = "orange";
        message.textContent = "⚠️ Entre un nombre valide !";
        return;
    }

    try {
        const resultat = await appel("/api/game/guess", {
            method: "POST",
            body: JSON.stringify({ roundId: activeRound.roundId, valeur }),
        });

        if (resultat.resultat === "gagne") {
            message.style.color = "green";
            message.textContent = `🎉 Bravo ! Le nombre était ${resultat.nombreMystere}. Tu gagnes ${resultat.gain} points !`;
            essaisRestantsEl.textContent = "";
            soldeActuel = resultat.solde;
            animerCarte("anim-gain");
            jouerSon(660);
            await chargerProfil();
            await chargerClassement();

            guessInput.disabled = true;
            guessBtn.disabled = true;
            indiceBtn.disabled = true;
            indiceBtn.hidden = true;
            indiceTexte.textContent = "";
            doubleDiv.hidden = false;
            nouvellePartieBtn.disabled = true;
            return;
        }

        if (resultat.resultat === "perdu") {
            message.style.color = "red";
            message.textContent = `💥 Perdu ! Le nombre était ${resultat.nombreMystere}.`;
            essaisRestantsEl.textContent = "";
            animerCarte("anim-perte");
            jouerSon(180);
            await chargerProfil();
            await chargerClassement();

            guessInput.disabled = true;
            guessBtn.disabled = true;
            indiceBtn.disabled = true;
            indiceBtn.hidden = true;
            indiceTexte.textContent = "";
            nouvellePartieBtn.disabled = false;
            difficulteSelect.disabled = false;
            miseInput.disabled = false;
            activeRound = null;
            return;
        }

        message.style.color = resultat.resultat === "plus_grand" ? "blue" : "red";
        message.textContent = resultat.resultat === "plus_grand" ? "📉 C'est plus grand !" : "📈 C'est plus petit !";
        essaisRestantsEl.textContent = `Essais restants : ${resultat.essaisRestants}`;
        guessInput.value = "";
        guessInput.focus();
    } catch (err) {
        message.style.color = "orange";
        message.textContent = `⚠️ ${err.message}`;
    }
});

indiceBtn.addEventListener("click", async () => {
    if (!activeRound) return;
    try {
        const resultat = await appel("/api/game/indice", {
            method: "POST",
            body: JSON.stringify({ roundId: activeRound.roundId }),
        });
        soldeActuel = resultat.solde;
        soldeEl.textContent = `💰 Solde : ${resultat.solde} points`;
        indiceTexte.textContent = `💡 Indice (-${resultat.cout} pts) : le nombre est ${resultat.parite}.`;
        indiceBtn.disabled = true;
    } catch (err) {
        indiceTexte.textContent = `⚠️ ${err.message}`;
    }
});

async function resoudreDouble(accepter) {
    if (!activeRound) return;
    try {
        const resultat = await appel("/api/game/double", {
            method: "POST",
            body: JSON.stringify({ roundId: activeRound.roundId, accepter }),
        });

        if (resultat.resultat === "double_gagne") {
            message.style.color = "green";
            message.textContent = `🎲 Doublé ! +${resultat.montant} points supplémentaires !`;
            jouerSon(880);
        } else if (resultat.resultat === "double_perdu") {
            message.style.color = "red";
            message.textContent = `🎲 Perdu ! -${resultat.montant} points.`;
            jouerSon(140);
        } else {
            message.textContent += " (encaissé)";
        }

        doubleDiv.hidden = true;
        nouvellePartieBtn.disabled = false;
        difficulteSelect.disabled = false;
        miseInput.disabled = false;
        activeRound = null;
        await chargerProfil();
        await chargerClassement();
    } catch (err) {
        message.style.color = "orange";
        message.textContent = `⚠️ ${err.message}`;
    }
}

doublerBtn.addEventListener("click", () => resoudreDouble(true));
encaisserBtn.addEventListener("click", () => resoudreDouble(false));

resetBtn.addEventListener("click", async () => {
    await appel("/api/game/reset", { method: "POST" });
    message.style.color = "black";
    message.textContent = "Solde réinitialisé.";
    await chargerProfil();
    await chargerClassement();
});

difficulteSelect.addEventListener("change", majApercuCote);

(async function initialiser() {
    try {
        await afficherJeu();
    } catch {
        afficherAuth();
    }
})();
