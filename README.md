# PokeBot — Site web

Ce repo contient **uniquement le site** (collection, boosters, échanges, deck,
combats). Le **bot Discord** (spawn de cartes, `/profil`, gain de coins en
chattant) est un projet à part, hébergé séparément, mais connecté à la **même
base MongoDB** — les deux se partagent les données des joueurs en temps réel.

## Structure

```
index.html, css/, js/     → le front, servis tels quels par server.js
server.js                 → serveur Express (API + sert le front)
routes/                   → routes API (auth, collection, échanges, deck, combats, boosters)
middleware/                → vérification de session
src/models/, src/services/ → modèles Mongoose et logique métier partagés
scripts/                  → maintenance de la base de cartes (import/vérif/nettoyage)
```

## Installation locale

```bash
npm install
cp .env.example .env
```

Remplis `.env` avec :
- `MONGODB_URI` : **la même base** que celle utilisée par le bot Discord
- `CLIENT_ID` / `DISCORD_CLIENT_SECRET` : ton application Discord (portail développeur)
- `DISCORD_REDIRECT_URI` : `http://localhost:3000/auth/callback` en local
- `SESSION_SECRET` : une chaîne aléatoire

```bash
npm start
```

Puis ouvre http://localhost:3000.

## Importer les cartes (si la base est vide)

```bash
npm run import-cards   # interroge TCGdex, potentiellement long sans filtre SERIES/SETS
npm run check-cards    # vérifie le contenu de la base
```

## Déployer sur Render (via GitHub)

1. Pousse ce repo sur GitHub (`git init && git add . && git commit -m "init" && git push`)
2. Sur [render.com](https://dashboard.render.com) : "New" → "Blueprint" → sélectionne ce repo
   (Render lit `render.yaml` automatiquement)
3. Renseigne les variables marquées à part dans l'onglet Environment :
   `MONGODB_URI`, `CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`
4. Une fois déployé, ajoute l'URL Render (`https://<ton-service>.onrender.com/auth/callback`)
   dans les Redirects OAuth2 du portail développeur Discord (en plus de celle en local)
5. Sur MongoDB Atlas → Network Access → autorise `0.0.0.0/0` (Render n'a pas d'IP fixe
   sur le plan gratuit)

⚠️ Le plan Free de Render met le service en veille après 15 min d'inactivité
(30-60s pour redémarrer au visiteur suivant). Passe sur un plan payant si tu veux
éviter ça.

## Important : cohérence avec le bot

Les variables `BOOSTER_COST`, `BOOSTER_SIZE`, `STARTER_SET_ID`, etc. doivent avoir
**les mêmes valeurs** que sur l'hébergeur du bot Discord, sinon le coût affiché ou
le contenu des boosters pourrait différer selon qu'on passe par le site ou par
Discord.
