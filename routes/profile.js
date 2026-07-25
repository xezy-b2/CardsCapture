const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/requireAuth');
const User = require('../src/models/User');
const BoosterOpening = require('../src/models/BoosterOpening');

const DAILY_COINS = 50;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h

// Résumé du profil : coins, stats, éligibilité au bonus quotidien.
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.session.user.id }).lean();
    if (!user) return res.status(404).json({ error: 'Profil introuvable.' });

    const now = Date.now();
    const lastClaimAt = user.lastDailyClaimAt ? new Date(user.lastDailyClaimAt).getTime() : 0;
    const msSinceClaim = now - lastClaimAt;
    const canClaimDaily = msSinceClaim >= DAILY_COOLDOWN_MS;
    const nextClaimInMs = canClaimDaily ? 0 : DAILY_COOLDOWN_MS - msSinceClaim;

    const totalGames = (user.victoires || 0) + (user.defaites || 0);
    const winrate = totalGames > 0 ? Math.round((user.victoires / totalGames) * 100) : null;

    res.json({
      userId: user.userId,
      username: user.username,
      coins: user.coins || 0,
      totalCaptures: user.totalCaptures || 0,
      victoires: user.victoires || 0,
      defaites: user.defaites || 0,
      winrate,
      dailyCoinsAmount: DAILY_COINS,
      canClaimDaily,
      nextClaimInMs
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Historique des boosters ouverts (les plus récents en premier)
router.get('/booster-history', requireAuth, async (req, res) => {
  try {
    const history = await BoosterOpening.find({ userId: req.session.user.id })
      .sort({ openedAt: -1 })
      .limit(20)
      .lean();
    res.json({ history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Réclame le bonus de coins quotidien (une fois toutes les 24h, vérifié ici
// côté serveur pour ne pas dépendre de la fiabilité du client).
router.post('/daily-claim', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.session.user.id });
    if (!user) return res.status(404).json({ error: 'Profil introuvable.' });

    const now = Date.now();
    const lastClaimAt = user.lastDailyClaimAt ? user.lastDailyClaimAt.getTime() : 0;
    const msSinceClaim = now - lastClaimAt;

    if (msSinceClaim < DAILY_COOLDOWN_MS) {
      return res.status(400).json({
        error: 'Tu as déjà réclamé ton bonus quotidien, reviens plus tard.',
        nextClaimInMs: DAILY_COOLDOWN_MS - msSinceClaim
      });
    }

    user.coins = (user.coins || 0) + DAILY_COINS;
    user.lastDailyClaimAt = new Date(now);
    await user.save();

    res.json({ coins: user.coins, claimed: DAILY_COINS, nextClaimInMs: DAILY_COOLDOWN_MS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
