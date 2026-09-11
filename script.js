const DIFFICULTES = {
    facile:    { label: "Facile (1-20)",    max: 20,  cote: 2, essaisMax: 6 },
    moyen:     { label: "Moyen (1-50)",     max: 50,  cote: 4, essaisMax: 7 },
    difficile: { label: "Difficile (1-100)", max: 100, cote: 8, essaisMax: 8 },
};

const SOLDE_INITIAL = 100;
const STORAGE_SOLDE = "nm_solde";
const STORAGE_HISTORIQUE = "nm_historique";

const soldeStocke = localStorage.getItem(STORAGE_SOLDE);
let solde = soldeStocke === null ? SOLDE_INITIAL : Number(soldeStocke);
if (!Number.isFinite(solde) || solde < 0) solde = SOLDE_INITIAL;

let historique = [];
try {
    historique = JSON.parse(localStorage.getItem(STORAGE_HISTORIQUE)) || [];
} catch {
    historique = [];
}

let partieEnCours = null; // { nombreMystere, difficulte, mise, essais, essaisRestants }

const soldeEl = document.getElementById("solde");
const difficulteSelect = document.getElementById("difficulte");
const miseInput = document.getElementById("mise");
const cotePreview = document.getElementById("cotePreview");
const nouvellePartieBtn = document.getElementById("nouvellePartieBtn");
const guessInput = document.getElementById("userGuess");
const guessBtn = document.getElementById("guessBtn");
const message = document.getElementById("message");
const essaisRestantsEl = document.getElementById("essaisRestants");
const historyDiv = document.getElementById("history");
const resetBtn = document.getElementById("resetBtn");

function sauvegarder() {
    localStorage.setItem(STORAGE_SOLDE, String(solde));
    localStorage.setItem(STORAGE_HISTORIQUE, JSON.stringify(historique.slice(-10)));
}

function majSolde() {
    soldeEl.textContent = `💰 Solde : ${solde} points`;
}

function majApercuCote() {
    const diff = DIFFICULTES[difficulteSelect.value];
    const mise = Number(miseInput.value) || 0;
    cotePreview.textContent = `Cote x${diff.cote} · ${diff.essaisMax} essais · gain potentiel : ${mise * diff.cote} points`;
}

function majHistorique() {
    if (historique.length === 0) {
        historyDiv.textContent = "Aucune partie jouée pour l'instant.";
        return;
    }
    historyDiv.innerHTML = historique
        .slice()
        .reverse()
        .map((h) => {
            const signe = h.gain >= 0 ? "+" : "";
            const couleur = h.gain >= 0 ? "green" : "red";
            return `<div style="color:${couleur}">${h.resultat} · mise ${h.mise} (${h.difficulte}) · ${signe}${h.gain} pts</div>`;
        })
        .join("");
}

function terminerPartie(gagne, gain) {
    const diff = partieEnCours.difficulte;
    solde += gain;
    historique.push({
        resultat: gagne ? "🎉 Gagné" : "💥 Perdu",
        mise: partieEnCours.mise,
        difficulte: diff.label,
        gain,
    });
    sauvegarder();
    majSolde();
    majHistorique();

    guessInput.disabled = true;
    guessBtn.disabled = true;
    nouvellePartieBtn.disabled = false;
    partieEnCours = null;
}

nouvellePartieBtn.addEventListener("click", () => {
    const diff = DIFFICULTES[difficulteSelect.value];
    const mise = Number(miseInput.value);

    if (!Number.isInteger(mise) || mise <= 0) {
        message.style.color = "orange";
        message.textContent = "⚠️ Entre une mise valide !";
        return;
    }
    if (mise > solde) {
        message.style.color = "orange";
        message.textContent = "⚠️ Mise supérieure à ton solde !";
        return;
    }

    solde -= mise;
    sauvegarder();
    majSolde();

    partieEnCours = {
        nombreMystere: Math.floor(Math.random() * diff.max) + 1,
        difficulte: diff,
        mise,
        essaisRestants: diff.essaisMax,
    };

    message.style.color = "black";
    message.textContent = `Devine un nombre entre 1 et ${diff.max} !`;
    essaisRestantsEl.textContent = `Essais restants : ${partieEnCours.essaisRestants}`;

    guessInput.value = "";
    guessInput.disabled = false;
    guessBtn.disabled = false;
    nouvellePartieBtn.disabled = true;
    guessInput.focus();
});

guessBtn.addEventListener("click", () => {
    if (!partieEnCours) return;

    const valeur = Number(guessInput.value);
    if (!valeur) {
        message.style.color = "orange";
        message.textContent = "⚠️ Entre un nombre valide !";
        return;
    }

    if (valeur === partieEnCours.nombreMystere) {
        const gain = partieEnCours.mise * partieEnCours.difficulte.cote;
        message.style.color = "green";
        message.textContent = `🎉 Bravo ! Le nombre était ${partieEnCours.nombreMystere}. Tu gagnes ${gain} points !`;
        essaisRestantsEl.textContent = "";
        terminerPartie(true, gain);
        return;
    }

    partieEnCours.essaisRestants -= 1;

    if (partieEnCours.essaisRestants <= 0) {
        message.style.color = "red";
        message.textContent = `💥 Perdu ! Le nombre était ${partieEnCours.nombreMystere}.`;
        essaisRestantsEl.textContent = "";
        terminerPartie(false, -partieEnCours.mise);
        return;
    }

    if (valeur < partieEnCours.nombreMystere) {
        message.style.color = "blue";
        message.textContent = "📉 C'est plus grand !";
    } else {
        message.style.color = "red";
        message.textContent = "📈 C'est plus petit !";
    }
    essaisRestantsEl.textContent = `Essais restants : ${partieEnCours.essaisRestants}`;

    guessInput.value = "";
    guessInput.focus();
});

resetBtn.addEventListener("click", () => {
    solde = SOLDE_INITIAL;
    historique = [];
    sauvegarder();
    majSolde();
    majHistorique();
    message.style.color = "black";
    message.textContent = "Solde réinitialisé.";
});

difficulteSelect.addEventListener("change", majApercuCote);
miseInput.addEventListener("input", majApercuCote);

majSolde();
majApercuCote();
majHistorique();
