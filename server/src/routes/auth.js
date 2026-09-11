const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const { SOLDE_INITIAL } = require("../gameLogic");

const router = express.Router();

const limiteAuth = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erreur: "Trop de tentatives, réessaie plus tard." },
});

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;

function emettreCookie(res, userId) {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000,
    });
}

router.post("/register", limiteAuth, async (req, res) => {
    const { username, password } = req.body || {};

    if (typeof username !== "string" || !USERNAME_RE.test(username)) {
        return res.status(400).json({ erreur: "Nom d'utilisateur invalide (3 à 20 caractères alphanumériques, - ou _)." });
    }
    if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ erreur: "Le mot de passe doit contenir au moins 6 caractères." });
    }

    const existant = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    if (existant.rows.length > 0) {
        return res.status(409).json({ erreur: "Ce nom d'utilisateur est déjà pris." });
    }

    const hash = await bcrypt.hash(password, 10);
    const resultat = await pool.query(
        "INSERT INTO users (username, password_hash, solde, meilleur_solde) VALUES ($1, $2, $3, $3) RETURNING id",
        [username, hash, SOLDE_INITIAL]
    );

    emettreCookie(res, resultat.rows[0].id);
    res.status(201).json({ username });
});

router.post("/login", limiteAuth, async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string") {
        return res.status(400).json({ erreur: "Identifiants invalides." });
    }

    const resultat = await pool.query("SELECT id, password_hash FROM users WHERE username = $1", [username]);
    if (resultat.rows.length === 0) {
        return res.status(401).json({ erreur: "Nom d'utilisateur ou mot de passe incorrect." });
    }

    const utilisateur = resultat.rows[0];
    const valide = await bcrypt.compare(password, utilisateur.password_hash);
    if (!valide) {
        return res.status(401).json({ erreur: "Nom d'utilisateur ou mot de passe incorrect." });
    }

    emettreCookie(res, utilisateur.id);
    res.json({ username });
});

router.post("/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
    const resultat = await pool.query(
        `SELECT username, solde, meilleur_solde, meilleure_serie, serie_actuelle, pertes_consecutives
         FROM users WHERE id = $1`,
        [req.userId]
    );
    if (resultat.rows.length === 0) {
        return res.status(404).json({ erreur: "Utilisateur introuvable." });
    }

    const historique = await pool.query(
        `SELECT resultat, difficulte, mise, gain, created_at
         FROM historique WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [req.userId]
    );

    res.json({ ...resultat.rows[0], historique: historique.rows });
});

module.exports = router;
