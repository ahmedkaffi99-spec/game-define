// 1. On définit le nombre secret (par exemple, 7)
const nombreSecret = 7;

// 2. On crée une fonction pour vérifier ta proposition
function devinerNombre(proposition) {
    if (proposition === nombreSecret) {
        return "🎉 Bravo ! Tu as trouvé le nombre mystère !";
    } else if (proposition < nombreSecret) {
        return "📉 C'est plus grand !";
    } else {
        return "📈 C'est plus petit !";
    }
}
