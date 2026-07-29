const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/requireAuth');
const User = require('../src/models/User');
const BoosterOpening = require('../src/models/BoosterOpening');

// Définition statique des quêtes. `metric` détermine comment la progression
// est calculée (voir getProgress ci-dessous). Pour ajouter une quête, il
// suffit d'ajouter une entrée ici : pas besoin de collection Mongo dédiée.
const QUEST_DEFS = [
  { id: 'capture_10', label: 'Capturer 10 cartes', metric: 'totalCaptures', target: 10, reward: 50 },
  { id: 'capture_50', label: 'Capturer 50 cartes', metric: 'totalCaptures', target: 50, reward: 150 },
  { id: 'win_5', label: 'Gagner 5 combats', metric: 'victoires', target: 5, reward: 100 },
  { id: 'booster_3', label: 'Ouvrir 3 boosters', metric: 'boosterCount', target: 3, reward: 75 }
];

async function getMetrics(userId, user) {
  const boosterCount = await BoosterOpening.countDocuments({ userId });
  return {
    totalCaptures: user.totalCaptures || 0,
    victoires: user.victoires || 0,
    boosterCount
  };
}

function buildQuestsPayload(user, metrics) {
  const claimed = user.claimedQuests || [];
  return QUEST_DEFS.map((def) => {
    const rawProgress = metrics[def.metric] || 0;
    const progress = Math.min(rawProgress, def.target);
    const completed = rawProgress >= def.target;
    return {
      id: def.id,
      label: def.label,
      progress,
      target: def.target,
      reward: def.reward,
      completed,
      claimed: claimed.includes(def.id)
    };
  });
}

// Liste des quêtes avec la progression actuelle du joueur.
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = await User.findOne({ userId }).lean();
    if (!user) return res.status(404).json({ error: 'Profil introuvable.' });

    const metrics = await getMetrics(userId, user);
    const quests = buildQuestsPayload(user, metrics);

    res.json({ quests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Réclame la récompense d'une quête complétée (vérifié côté serveur pour ne
// pas dépendre du client : on recalcule la progression avant de payer).
router.post('/:id/claim', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const questId = req.params.id;
    const def = QUEST_DEFS.find((q) => q.id === questId);
    if (!def) return res.status(404).json({ error: 'Quête introuvable.' });

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ error: 'Profil introuvable.' });

    if ((user.claimedQuests || []).includes(questId)) {
      return res.status(400).json({ error: 'Cette quête a déjà été réclamée.' });
    }

    const metrics = await getMetrics(userId, user);
    const rawProgress = metrics[def.metric] || 0;
    if (rawProgress < def.target) {
      return res.status(400).json({ error: 'Cette quête n\'est pas encore terminée.' });
    }

    user.coins = (user.coins || 0) + def.reward;
    user.claimedQuests = [...(user.claimedQuests || []), questId];
    await user.save();

    res.json({ coins: user.coins, claimed: def.reward });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
