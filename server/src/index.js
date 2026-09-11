require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth");
const gameRoutes = require("./routes/game");
const leaderboardRoutes = require("./routes/leaderboard");

if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET manquant dans l'environnement. Arrêt.");
    process.exit(1);
}
if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL manquant dans l'environnement. Arrêt.");
    process.exit(1);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur Nombre Mystère à l'écoute sur le port ${PORT}`);
});
