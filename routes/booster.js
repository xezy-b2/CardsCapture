const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/requireAuth');
const Card = require('../src/models/Card');
const User = require('../src/models/User');
const BoosterOpening = require('../src/models/BoosterOpening');
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

// Empêche un souci de logging d'historique de casser l'ouverture du booster
// elle-même : le joueur a déjà reçu ses cartes, on ne veut pas faire échouer
// la requête pour un problème purement cosmétique (l'onglet Profil).
async function logBoosterOpening(userId, setId, pulled, isStarter) {
  try {
    await BoosterOpening.create({
      userId,
      setId,
      isStarter,
      cards: pulled.map((c) => ({
        cardId: c._id,
        nameFr: c.nameFr,
        rarity: c.rarity,
        imageUrl: c.imageUrl
      }))
    });
  } catch (err) {
    console.error("Erreur lors de l'enregistrement de l'historique du booster :", err);
  }
}

router.post('/start', requireAuth, async (req, res) => {
  try {
    const { pulled, setId } = await claimStarterBooster(req.session.user.id, req.session.user.username);
    await logBoosterOpening(req.session.user.id, setId, pulled, true);
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
    await logBoosterOpening(req.session.user.id, result.setId, result.pulled, false);
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
