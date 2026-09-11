const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
    const resultat = await pool.query(
        `SELECT username, meilleur_solde, meilleure_serie
         FROM users ORDER BY meilleur_solde DESC, meilleure_serie DESC LIMIT 20`
    );
    res.json(resultat.rows);
});

module.exports = router;
