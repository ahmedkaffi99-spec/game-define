const fs = require("fs");
const path = require("path");
const pool = require("./db");

async function migrer() {
    const sql = fs.readFileSync(path.join(__dirname, "..", "migrations", "001_init.sql"), "utf8");
    await pool.query(sql);
    console.log("Migration appliquée avec succès.");
}

migrer()
    .catch((err) => {
        console.error("Échec de la migration :", err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
