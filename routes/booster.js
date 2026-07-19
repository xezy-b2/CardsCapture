const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/requireAuth');
const Card = require('../src/models/Card');
const User = require('../src/models/User');
const { claimStarterBooster, openBooster, BoosterError, BOOSTER_COST } = require('../src/services/boosterEconomy');

// Liste des extensions groupées par série (triées chronologiquement), pour le sélecteur
router.get('/sets', async (req, res) => {
  try {
    const sets = await Card.aggregate([
      {
        $group: {
          _id: '$setId',
          setName: { $first: '$setName' },
          serieName: { $first: '$serieName' },
          setReleaseDate: { $first: '$setReleaseDate' }
        }
      }
    ]);

    const serieMap = new Map();
    for (const s of sets) {
      if (!serieMap.has(s.serieName)) serieMap.set(s.serieName, []);
      serieMap.get(s.serieName).push(s);
    }

    const series = Array.from(serieMap.entries())
      .map(([serieName, setsInSerie]) => {
        setsInSerie.sort((a, b) => new Date(a.setReleaseDate || 0) - new Date(b.setReleaseDate || 0));
        const earliest = setsInSerie.reduce((min, s) => {
          const d = new Date(s.setReleaseDate || 0);
          return d < min ? d : min;
        }, new Date());
        return {
          serieName,
          sets: setsInSerie.map((s) => ({ setId: s._id, setName: s.setName })),
          earliest
        };
      })
      .sort((a, b) => a.earliest - b.earliest)
      .map(({ serieName, sets: setsInSerie }) => ({ serieName, sets: setsInSerie }));

    res.json({ series, boosterCost: BOOSTER_COST });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Statut du joueur pour l'écran booster (coins, a déjà réclamé le starter ou non)
router.get('/status', requireAuth, async (req, res) => {
  const user = await User.findOne({ userId: req.session.user.id }).lean();
  res.json({
    coins: user?.coins || 0,
    hasStarted: user?.hasStarted || false,
    boosterCost: BOOSTER_COST
  });
});

router.post('/start', requireAuth, async (req, res) => {
  try {
    const { pulled, setId } = await claimStarterBooster(req.session.user.id, req.session.user.username);
    res.json({ cards: pulled, setId });
  } catch (err) {
    if (err instanceof BoosterError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/open', requireAuth, async (req, res) => {
  try {
    const result = await openBooster(req.session.user.id, req.session.user.username, req.body.setId);
    res.json({
      cards: result.pulled,
      setId: result.setId,
      completionBonusApplied: result.completionBonusApplied,
      coinsRemaining: result.coinsRemaining
    });
  } catch (err) {
    if (err instanceof BoosterError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
