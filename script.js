const DIFFICULTES = {
    facile:    { label: "Facile (1-20)",     max: 20,  essaisMax: 6, coteMax: 3,  coteMin: 1.5 },
    moyen:     { label: "Moyen (1-50)",      max: 50,  essaisMax: 7, coteMax: 5,  coteMin: 2 },
    difficile: { label: "Difficile (1-100)", max: 100, essaisMax: 8, coteMax: 10, coteMin: 3 },
};

const SOLDE_INITIAL = 100;
const MISE_MAX_RATIO = 0.5; // une mise ne peut pas dépasser 50% du solde
const COUT_INDICE_RATIO = 0.2; // l'indice coûte 20% de la mise
const SEUIL_ALERTE_PERTES = 3;
const JOUEURS = { j1: "Joueur 1", j2: "Joueur 2" };
const STORAGE_JOUEUR_ACTIF = "nm_joueur_actif";

function clePlayer(id) {
    return `nm_player_${id}`;
}

function etatParDefaut() {
    return {
        solde: SOLDE_INITIAL,
        historique: [],
        meilleurSolde: SOLDE_INITIAL,
        meilleureSerie: 0,
        serieActuelle: 0,
        pertesConsecutives: 0,
    };
}

function chargerEtat(id) {
    try {
        const brut = localStorage.getItem(clePlayer(id));
        if (!brut) return etatParDefaut();
        const parsed = JSON.parse(brut);
        return { ...etatParDefaut(), ...parsed };
    } catch {
        return etatParDefaut();
    }
}

let joueurActif = localStorage.getItem(STORAGE_JOUEUR_ACTIF) || "j1";
if (!(joueurActif in JOUEURS)) joueurActif = "j1";

let etat = chargerEtat(joueurActif);
let partieEnCours = null; // { nombreMystere, difficulte, mise, essaisUtilises, indiceUtilise }
let offreDouble = null; // { montant } quand une offre "doubler ou rien" est active

const joueurSelect = document.getElementById("joueur");
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

function sauvegarder() {
    localStorage.setItem(clePlayer(joueurActif), JSON.stringify({
        ...etat,
        historique: etat.historique.slice(-10),
    }));
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
    const carte = document.querySelector(".card");
    carte.classList.remove("anim-gain", "anim-perte");
    void carte.offsetWidth; // relance l'animation CSS
    carte.classList.add(classe);
}

function majSolde() {
    soldeEl.textContent = `💰 Solde : ${etat.solde} points`;
}

function majStats() {
    statsEl.textContent = `🏆 Record : ${etat.meilleurSolde} pts · Meilleure série : ${etat.meilleureSerie}`;
}

function majAlerte() {
    if (etat.pertesConsecutives >= SEUIL_ALERTE_PERTES) {
        alerteEl.textContent = "⚠️ Plusieurs pertes d'affilée — pense à faire une pause. C'est un jeu fictif, jouons prudemment !";
    } else {
        alerteEl.textContent = "";
    }
}

function miseMax() {
    return Math.max(1, Math.floor(etat.solde * MISE_MAX_RATIO));
}

function majApercuCote() {
    const diff = DIFFICULTES[difficulteSelect.value];
    const mise = Number(miseInput.value) || 0;
    const max = miseMax();
    cotePreview.textContent = `Cote x${diff.coteMin} à x${diff.coteMax} selon rapidité · ${diff.essaisMax} essais · mise max : ${max} pts`;
}

function majHistorique() {
    if (etat.historique.length === 0) {
        historyDiv.textContent = "Aucune partie jouée pour l'instant.";
        return;
    }
    historyDiv.innerHTML = etat.historique
        .slice()
        .reverse()
        .map((h) => {
            const signe = h.gain >= 0 ? "+" : "";
            const couleur = h.gain >= 0 ? "green" : "red";
            return `<div style="color:${couleur}">${h.resultat} · mise ${h.mise} (${h.difficulte}) · ${signe}${h.gain} pts</div>`;
        })
        .join("");
}

function majTout() {
    majSolde();
    majStats();
    majAlerte();
    majApercuCote();
    majHistorique();
}

function calculerGain(mise, diff, essaisUtilises) {
    const pas = (diff.coteMax - diff.coteMin) / Math.max(1, diff.essaisMax - 1);
    const multiplicateur = diff.coteMax - (essaisUtilises - 1) * pas;
    return Math.max(1, Math.round(mise * multiplicateur));
}

function terminerPartie(gagne, gain, difficulteLabel, mise) {
    etat.solde += gain;
    etat.meilleurSolde = Math.max(etat.meilleurSolde, etat.solde);

    if (gagne) {
        etat.serieActuelle += 1;
        etat.meilleureSerie = Math.max(etat.meilleureSerie, etat.serieActuelle);
        etat.pertesConsecutives = 0;
    } else {
        etat.serieActuelle = 0;
        etat.pertesConsecutives += 1;
    }

    etat.historique.push({
        resultat: gagne ? "🎉 Gagné" : "💥 Perdu",
        mise,
        difficulte: difficulteLabel,
        gain,
    });

    sauvegarder();
    majTout();
    animerCarte(gagne ? "anim-gain" : "anim-perte");
    jouerSon(gagne ? 660 : 180);

    guessInput.disabled = true;
    guessBtn.disabled = true;
    indiceBtn.disabled = true;
    indiceBtn.hidden = true;
    indiceTexte.textContent = "";
    partieEnCours = null;

    if (gagne) {
        offreDouble = { montant: gain };
        doubleDiv.hidden = false;
        nouvellePartieBtn.disabled = true;
    } else {
        nouvellePartieBtn.disabled = false;
        joueurSelect.disabled = false;
    }
}

function demarrerPartie() {
    const diff = DIFFICULTES[difficulteSelect.value];
    const mise = Number(miseInput.value);

    if (!Number.isInteger(mise) || mise <= 0) {
        message.style.color = "orange";
        message.textContent = "⚠️ Entre une mise valide !";
        return;
    }
    if (mise > etat.solde) {
        message.style.color = "orange";
        message.textContent = "⚠️ Mise supérieure à ton solde !";
        return;
    }
    if (mise > miseMax()) {
        message.style.color = "orange";
        message.textContent = `⚠️ Mise limitée à ${miseMax()} points (50% du solde) !`;
        return;
    }

    etat.solde -= mise;
    sauvegarder();
    majSolde();

    partieEnCours = {
        nombreMystere: Math.floor(Math.random() * diff.max) + 1,
        difficulte: diff,
        mise,
        essaisUtilises: 0,
        indiceUtilise: false,
    };

    message.style.color = "black";
    message.textContent = `Devine un nombre entre 1 et ${diff.max} !`;
    essaisRestantsEl.textContent = `Essais restants : ${diff.essaisMax}`;

    guessInput.value = "";
    guessInput.disabled = false;
    guessBtn.disabled = false;
    indiceBtn.disabled = false;
    indiceBtn.hidden = false;
    indiceTexte.textContent = "";
    nouvellePartieBtn.disabled = true;
    joueurSelect.disabled = true;
    guessInput.focus();
}

nouvellePartieBtn.addEventListener("click", demarrerPartie);

guessBtn.addEventListener("click", () => {
    if (!partieEnCours) return;

    const valeur = Number(guessInput.value);
    if (!valeur) {
        message.style.color = "orange";
        message.textContent = "⚠️ Entre un nombre valide !";
        return;
    }

    partieEnCours.essaisUtilises += 1;
    const diff = partieEnCours.difficulte;

    if (valeur === partieEnCours.nombreMystere) {
        const gain = calculerGain(partieEnCours.mise, diff, partieEnCours.essaisUtilises);
        message.style.color = "green";
        message.textContent = `🎉 Bravo ! Le nombre était ${partieEnCours.nombreMystere}. Tu gagnes ${gain} points !`;
        essaisRestantsEl.textContent = "";
        terminerPartie(true, gain, diff.label, partieEnCours.mise);
        return;
    }

    const essaisRestants = diff.essaisMax - partieEnCours.essaisUtilises;

    if (essaisRestants <= 0) {
        message.style.color = "red";
        message.textContent = `💥 Perdu ! Le nombre était ${partieEnCours.nombreMystere}.`;
        essaisRestantsEl.textContent = "";
        terminerPartie(false, -partieEnCours.mise, diff.label, partieEnCours.mise);
        return;
    }

    if (valeur < partieEnCours.nombreMystere) {
        message.style.color = "blue";
        message.textContent = "📉 C'est plus grand !";
    } else {
        message.style.color = "red";
        message.textContent = "📈 C'est plus petit !";
    }
    essaisRestantsEl.textContent = `Essais restants : ${essaisRestants}`;

    guessInput.value = "";
    guessInput.focus();
});

indiceBtn.addEventListener("click", () => {
    if (!partieEnCours || partieEnCours.indiceUtilise) return;

    const cout = Math.max(1, Math.round(partieEnCours.mise * COUT_INDICE_RATIO));
    if (cout > etat.solde) {
        indiceTexte.textContent = "⚠️ Solde insuffisant pour acheter un indice.";
        return;
    }

    etat.solde -= cout;
    partieEnCours.indiceUtilise = true;
    sauvegarder();
    majSolde();

    const parite = partieEnCours.nombreMystere % 2 === 0 ? "pair" : "impair";
    indiceTexte.textContent = `💡 Indice (-${cout} pts) : le nombre est ${parite}.`;
    indiceBtn.disabled = true;
});

doublerBtn.addEventListener("click", () => {
    if (!offreDouble) return;
    const montant = offreDouble.montant;
    const gagne = Math.random() < 0.5;

    if (gagne) {
        etat.solde += montant;
        message.style.color = "green";
        message.textContent = `🎲 Doublé ! +${montant} points supplémentaires !`;
        jouerSon(880);
    } else {
        etat.solde -= montant;
        message.style.color = "red";
        message.textContent = `🎲 Perdu ! -${montant} points.`;
        jouerSon(140);
    }

    etat.meilleurSolde = Math.max(etat.meilleurSolde, etat.solde);
    sauvegarder();
    majTout();

    offreDouble = null;
    doubleDiv.hidden = true;
    nouvellePartieBtn.disabled = false;
    joueurSelect.disabled = false;
});

encaisserBtn.addEventListener("click", () => {
    offreDouble = null;
    doubleDiv.hidden = true;
    nouvellePartieBtn.disabled = false;
    joueurSelect.disabled = false;
    message.textContent += " (encaissé)";
});

resetBtn.addEventListener("click", () => {
    etat = etatParDefaut();
    sauvegarder();
    majTout();
    message.style.color = "black";
    message.textContent = "Solde réinitialisé.";
});

joueurSelect.addEventListener("change", () => {
    joueurActif = joueurSelect.value;
    localStorage.setItem(STORAGE_JOUEUR_ACTIF, joueurActif);
    etat = chargerEtat(joueurActif);
    partieEnCours = null;
    offreDouble = null;
    doubleDiv.hidden = true;

    guessInput.value = "";
    guessInput.disabled = true;
    guessBtn.disabled = true;
    indiceBtn.disabled = true;
    indiceBtn.hidden = true;
    indiceTexte.textContent = "";
    essaisRestantsEl.textContent = "";
    nouvellePartieBtn.disabled = false;
    message.textContent = "";

    majTout();
});

difficulteSelect.addEventListener("change", majApercuCote);
miseInput.addEventListener("input", majApercuCote);

joueurSelect.value = joueurActif;
majTout();
