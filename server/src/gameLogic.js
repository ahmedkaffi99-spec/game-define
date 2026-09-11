const crypto = require("crypto");

const DIFFICULTES = {
    facile: { label: "Facile (1-20)", max: 20, essaisMax: 6, coteMax: 3, coteMin: 1.5 },
    moyen: { label: "Moyen (1-50)", max: 50, essaisMax: 7, coteMax: 5, coteMin: 2 },
    difficile: { label: "Difficile (1-100)", max: 100, essaisMax: 8, coteMax: 10, coteMin: 3 },
};

const SOLDE_INITIAL = 100;
const MISE_MAX_RATIO = 0.5;
const COUT_INDICE_RATIO = 0.2;
const SEUIL_ALERTE_PERTES = 3;

function tirerNombre(max) {
    return crypto.randomInt(1, max + 1);
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
    tirerNombre,
    miseMax,
    coutIndice,
    calculerGain,
};
