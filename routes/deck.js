const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/requireAuth');
const User = require('../src/models/User');
const UserCard = require('../src/models/UserCard');

router.get('/owned-cards', requireAuth, async (req, res) => {
  try {
    const owned = await UserCard.find({ userId: req.session.user.id, quantity: { $gte: 1 } }).populate('cardId').lean();
    res.json({
      cards: owned
        .filter((o) => o.cardId)
        .map((o) => ({
          cardId: o.cardId._id,
          nameFr: o.cardId.nameFr,
          localId: o.cardId.localId,
          rarity: o.cardId.rarity,
          imageUrl: o.cardId.imageUrl,
          quantity: o.quantity
        }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.session.user.id }).populate('deck').lean();
    res.json({ deck: user?.deck || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { cardIds } = req.body;
    const userId = req.session.user.id;

    if (!Array.isArray(cardIds) || cardIds.length === 0 || cardIds.length > 3) {
      return res.status(400).json({ error: 'Le deck doit contenir entre 1 et 3 cartes.' });
    }

    const uniqueIds = new Set(cardIds);
    if (uniqueIds.size !== cardIds.length) {
      return res.status(400).json({ error: 'Le deck ne peut pas contenir la même carte deux fois.' });
    }

    const owned = await UserCard.find({ userId, cardId: { $in: cardIds }, quantity: { $gte: 1 } });
    if (owned.length !== cardIds.length) {
      return res.status(400).json({ error: "Tu ne possèdes pas toutes ces cartes." });
    }

    await User.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, username: req.session.user.username }, $set: { deck: cardIds } },
      { upsert: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
