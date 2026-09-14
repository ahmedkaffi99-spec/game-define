const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth");
const gameRoutes = require("./routes/game");
const leaderboardRoutes = require("./routes/leaderboard");

if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET manquant dans l'environnement.");
}
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL manquant dans l'environnement.");
}

const app = express();

const cspDirectives = {
    ...helmet.contentSecurityPolicy.getDefaultDirectives(),
    "script-src": ["'self'"],
};
if (process.env.COOKIE_SECURE !== "true") {
    // Tant qu'il n'y a pas de HTTPS devant l'appli, cette directive force le
    // navigateur à essayer de convertir les appels fetch() vers https://,
    // qui échouent silencieusement (rien n'écoute en HTTPS sur ce port).
    // helmet réinjecte les directives par défaut si on se contente de la
    // supprimer (useDefaults: true) : il faut la mettre explicitement à
    // null pour vraiment la désactiver.
    cspDirectives["upgrade-insecure-requests"] = null;
}

app.use(
    helmet({
        contentSecurityPolicy: { directives: cspDirectives },
    })
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/leaderboard", leaderboardRoutes);

app.use(express.static(path.join(__dirname, "..", "..", "public")));

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ erreur: "Erreur serveur." });
});

module.exports = app;
