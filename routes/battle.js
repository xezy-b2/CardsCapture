const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/requireAuth');
const User = require('../src/models/User');
const Battle = require('../src/models/Battle');

// Extrait la valeur numérique d'une chaîne de dégâts type "30", "30+", "120×2"
function parseDamage(damage) {
  if (!damage) return 0;
  const match = String(damage).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

const RARITY_MULTIPLIER = { Commune: 1, Rare: 1.3, Légendaire: 1.6 };

// Une carte Pokémon vaut HP + meilleure attaque, pondéré par sa rareté.
// Une carte Dresseur/Énergie (sans HP/attaques) a une valeur de base modeste.
function cardPower(card) {
  const bestAttackDamage = (card.attacks || []).reduce((max, a) => Math.max(max, parseDamage(a.damage)), 0);
  const base = (card.hp || 0) + bestAttackDamage || 20;
  return Math.round(base * (RARITY_MULTIPLIER[card.rarity] || 1));
}

function computeScore(deck) {
  const total = deck.reduce((sum, c) => sum + cardPower(c), 0);
  const luckFactor = 0.9 + Math.random() * 0.2; // ±10% d'aléatoire
  return Math.round(total * luckFactor);
}

router.get('/incoming', requireAuth, async (req, res) => {
  try {
    const battles = await Battle.find({ opponentId: req.session.user.id, status: 'en_attente' }).lean();
    res.json({ battles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/outgoing', requireAuth, async (req, res) => {
  try {
    const battles = await Battle.find({ challengerId: req.session.user.id, status: 'en_attente' }).lean();
    res.json({ battles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const battles = await Battle.find({
      status: 'terminee',
      $or: [{ challengerId: userId }, { opponentId: userId }]
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ battles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/challenge', requireAuth, async (req, res) => {
  try {
    const { opponentUserId } = req.body;
    const challengerId = req.session.user.id;

    if (!opponentUserId || opponentUserId === challengerId) {
      return res.status(400).json({ error: 'Adversaire invalide.' });
    }

    const [challenger, opponent] = await Promise.all([
      User.findOne({ userId: challengerId }),
      User.findOne({ userId: opponentUserId })
    ]);

    if (!challenger || !challenger.deck || challenger.deck.length !== 3) {
      return res.status(400).json({ error: 'Tu dois avoir un deck complet de 3 cartes avant de défier quelqu\'un.' });
    }
    if (!opponent || !opponent.deck || opponent.deck.length !== 3) {
      return res.status(400).json({ error: "Cet adversaire n'a pas encore de deck complet de 3 cartes." });
    }

    const battle = await Battle.create({ challengerId, opponentId: opponentUserId });
    res.json({ battle });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/decline', requireAuth, async (req, res) => {
  try {
    const battle = await Battle.findById(req.params.id);
    if (!battle) return res.status(404).json({ error: 'Défi introuvable.' });
    if (battle.opponentId !== req.session.user.id) return res.status(403).json({ error: "Ce défi ne t'est pas destiné." });
    if (battle.status !== 'en_attente') return res.status(400).json({ error: 'Ce défi a déjà été traité.' });

    battle.status = 'refusee';
    await battle.save();
    res.json({ battle });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/accept', requireAuth, async (req, res) => {
  try {
    const battle = await Battle.findById(req.params.id);
    if (!battle) return res.status(404).json({ error: 'Défi introuvable.' });
    if (battle.opponentId !== req.session.user.id) return res.status(403).json({ error: "Ce défi ne t'est pas destiné." });
    if (battle.status !== 'en_attente') return res.status(400).json({ error: 'Ce défi a déjà été traité.' });

    const [challenger, opponent] = await Promise.all([
      User.findOne({ userId: battle.challengerId }).populate('deck'),
      User.findOne({ userId: battle.opponentId }).populate('deck')
    ]);

    if (!challenger?.deck || challenger.deck.length !== 3 || !opponent?.deck || opponent.deck.length !== 3) {
      return res.status(400).json({ error: "Un des deux decks n'est plus complet (3 cartes requises)." });
    }

    const challengerScore = computeScore(challenger.deck);
    const opponentScore = computeScore(opponent.deck);
    const winnerId = challengerScore >= opponentScore ? battle.challengerId : battle.opponentId;
    const loserId = winnerId === battle.challengerId ? battle.opponentId : battle.challengerId;

    await Promise.all([
      User.findOneAndUpdate({ userId: winnerId }, { $inc: { victoires: 1 } }),
      User.findOneAndUpdate({ userId: loserId }, { $inc: { defaites: 1 } })
    ]);

    battle.status = 'terminee';
    battle.result = {
      winnerId,
      challengerScore,
      opponentScore,
      challengerDeck: challenger.deck.map((c) => ({ nameFr: c.nameFr, imageUrl: c.imageUrl })),
      opponentDeck: opponent.deck.map((c) => ({ nameFr: c.nameFr, imageUrl: c.imageUrl }))
    };
    await battle.save();

    res.json({ battle });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
