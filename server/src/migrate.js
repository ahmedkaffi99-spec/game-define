const fs = require("fs");
const path = require("path");
const pool = require("./db");

async function migrer() {
    const dossier = path.join(__dirname, "..", "migrations");
    const fichiers = fs.readdirSync(dossier).filter((f) => f.endsWith(".sql")).sort();
    for (const fichier of fichiers) {
        const sql = fs.readFileSync(path.join(dossier, fichier), "utf8");
        await pool.query(sql);
        console.log(`Migration ${fichier} appliquée avec succès.`);
    }
}

migrer()
    .catch((err) => {
        console.error("Échec de la migration :", err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
