# Nombre Mystère

Jeu de devinette avec mécanique de paris fictifs (monnaie virtuelle, cotes, indices, double ou rien), comptes utilisateurs et classement partagé. Architecture complète : frontend statique, backend Node.js/Express, base de données PostgreSQL.

⚠️ Jeu 100% fictif — aucune monnaie réelle, aucun paiement, à but ludique uniquement.

## Architecture

```
public/          Frontend statique (HTML/CSS/JS), servi par le backend
server/          API backend (Node.js + Express)
  src/
    index.js         Point d'entrée du serveur
    db.js             Connexion PostgreSQL
    migrate.js        Applique le schéma SQL
    gameLogic.js       Règles du jeu (cotes, mise max, tirage) — source de vérité serveur
    middleware/auth.js Vérification du cookie de session (JWT)
    routes/auth.js     Inscription / connexion / déconnexion / profil
    routes/game.js     Démarrage de partie, essais, indice, double ou rien
    routes/leaderboard.js  Classement des joueurs
  migrations/001_init.sql  Schéma de la base
docker-compose.yml  Orchestration PostgreSQL + backend
```

Le nombre secret, le calcul des gains et toutes les règles du jeu vivent **uniquement côté serveur** : le frontend ne fait qu'afficher les résultats renvoyés par l'API, impossible de tricher en modifiant le JavaScript du navigateur.

## Fonctionnalités

- Comptes utilisateurs (inscription/connexion par mot de passe, hashé avec bcrypt)
- Solde en points virtuels, persistant en base de données
- 3 niveaux de difficulté avec cotes dynamiques (le gain diminue selon le nombre d'essais utilisés)
- Indice payant (parité du nombre secret)
- Double ou rien après une victoire
- Mise plafonnée à 50 % du solde, alerte après 3 pertes d'affilée
- Historique des parties, record personnel, meilleure série
- Classement public des meilleurs joueurs
- Animation et son (générés, aucun fichier externe) sur victoire/défaite

## Déploiement sur ton propre serveur (Docker)

Prérequis : un serveur (VPS, machine locale, etc.) avec **Docker** et **Docker Compose** installés.

1. Cloner le dépôt sur le serveur :
   ```bash
   git clone <url-du-depot>
   cd game-define
   ```

2. Créer le fichier d'environnement à partir du modèle :
   ```bash
   cp .env.example .env
   ```
   Puis éditer `.env` et renseigner de vraies valeurs pour `POSTGRES_PASSWORD` et `JWT_SECRET` (par exemple `openssl rand -hex 32` pour générer une valeur aléatoire). **Ne jamais utiliser les valeurs par défaut en production.**

3. Lancer l'application :
   ```bash
   docker compose up -d --build
   ```
   Cela démarre deux conteneurs :
   - `db` : PostgreSQL, avec les données persistées dans un volume Docker
   - `app` : le serveur Node.js (applique automatiquement le schéma de base de données au démarrage, puis sert l'API et le frontend)

4. Le jeu est accessible sur `http://<adresse-du-serveur>:3000` (ou le port choisi via `APP_PORT` dans `.env`).

5. Pour exposer le site en HTTPS sur un vrai nom de domaine, place un reverse proxy devant (Caddy ou Nginx + Certbot, par exemple), qui redirige vers `http://localhost:3000`.

### Mise à jour

```bash
git pull
docker compose up -d --build
```

Le schéma de base de données est ré-appliqué automatiquement à chaque démarrage (`CREATE TABLE IF NOT EXISTS`, sans danger pour les données existantes).

### Sauvegarde de la base de données

```bash
docker compose exec db pg_dump -U nombremystere nombremystere > backup.sql
```

## Développement local (sans Docker)

Prérequis : Node.js 18+, PostgreSQL.

```bash
# Créer la base et l'utilisateur PostgreSQL localement, puis :
cd server
npm install
DATABASE_URL="postgres://user:password@localhost:5432/nombremystere" JWT_SECRET="dev_secret" npm run migrate
DATABASE_URL="postgres://user:password@localhost:5432/nombremystere" JWT_SECRET="dev_secret" npm start
```

Le serveur écoute par défaut sur le port 3000 (configurable via `PORT`).
