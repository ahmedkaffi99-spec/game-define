CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(20) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    solde INTEGER NOT NULL DEFAULT 100,
    meilleur_solde INTEGER NOT NULL DEFAULT 100,
    meilleure_serie INTEGER NOT NULL DEFAULT 0,
    serie_actuelle INTEGER NOT NULL DEFAULT 0,
    pertes_consecutives INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rounds (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    difficulte VARCHAR(16) NOT NULL,
    nombre_mystere INTEGER NOT NULL,
    mise INTEGER NOT NULL,
    essais_max INTEGER NOT NULL,
    essais_utilises INTEGER NOT NULL DEFAULT 0,
    indice_utilise BOOLEAN NOT NULL DEFAULT false,
    statut VARCHAR(16) NOT NULL DEFAULT 'en_cours',
    gain_en_attente INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS historique (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resultat VARCHAR(16) NOT NULL,
    difficulte VARCHAR(32) NOT NULL,
    mise INTEGER NOT NULL,
    gain INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historique_user ON historique(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rounds_user_statut ON rounds(user_id, statut);
CREATE INDEX IF NOT EXISTS idx_users_meilleur_solde ON users(meilleur_solde DESC);
