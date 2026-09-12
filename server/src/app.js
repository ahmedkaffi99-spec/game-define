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

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "script-src": ["'self'"],
            },
        },
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
