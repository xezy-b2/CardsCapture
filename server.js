require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const { connectDB } = require('./src/config/db');

const authRoutes = require('./routes/auth');
const collectionRoutes = require('./routes/collection');
const tradeRoutes = require('./routes/trades');
const deckRoutes = require('./routes/deck');
const battleRoutes = require('./routes/battle');
const boosterRoutes = require('./routes/booster');

const app = express();
const PORT = process.env.PORT || process.env.WEB_PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Nécessaire derrière le proxy de Render (ou tout hébergeur qui termine le TLS
// en amont) pour que req.secure soit correctement détecté et que le cookie
// "secure" ci-dessous fonctionne.
if (isProduction) app.set('trust proxy', 1);

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-moi',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI, collectionName: 'sessions' }),
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
      secure: isProduction // cookie envoyé seulement en HTTPS en production
    }
  })
);

// On sert explicitement index.html + css/ + js/, jamais tout __dirname :
// server.js, routes/, src/ et node_modules restent inaccessibles en HTTP.
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.use('/auth', authRoutes);
app.use('/api', collectionRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/deck', deckRoutes);
app.use('/api/battle', battleRoutes);
app.use('/api/booster', boosterRoutes);

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🌐 Site PokeBot disponible sur http://localhost:${PORT}`);
  });
}

start();
