const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/requireAuth');
const Card = require('../src/models/Card');
const UserCard = require('../src/models/UserCard');
const TradeOffer = require('../src/models/TradeOffer');

// Mes cartes en double, proposables à l'échange
router.get('/my-duplicates', requireAuth, async (req, res) => {
  const owned = await UserCard.find({ userId: req.session.user.id, quantity: { $gte: 2 } }).populate('cardId').lean();
  res.json({
    duplicates: owned
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
});

router.get('/incoming', requireAuth, async (req, res) => {
  const trades = await TradeOffer.find({ toUserId: req.session.user.id, status: 'en_attente' })
    .populate('offeredCardId requestedCardId')
    .lean();
  res.json({ trades });
});

router.get('/outgoing', requireAuth, async (req, res) => {
  const trades = await TradeOffer.find({ fromUserId: req.session.user.id, status: 'en_attente' })
    .populate('offeredCardId requestedCardId')
    .lean();
  res.json({ trades });
});

router.post('/', requireAuth, async (req, res) => {
  const { toUserId, offeredCardId, requestedCardId } = req.body;
  const fromUserId = req.session.user.id;

  if (!toUserId || !offeredCardId || !requestedCardId) {
    return res.status(400).json({ error: 'Champs manquants.' });
  }
  if (toUserId === fromUserId) {
    return res.status(400).json({ error: 'Impossible d\'échanger avec toi-même.' });
  }

  const [offeredCard, requestedCard, ownedOffered] = await Promise.all([
    Card.findById(offeredCardId),
    Card.findById(requestedCardId),
    UserCard.findOne({ userId: fromUserId, cardId: offeredCardId })
  ]);

  if (!offeredCard || !requestedCard) return res.status(404).json({ error: 'Carte introuvable.' });
  if (!ownedOffered || ownedOffered.quantity < 2) {
    return res.status(400).json({ error: `Tu dois posséder ${offeredCard.nameFr} en double pour l'échanger.` });
  }

  const trade = await TradeOffer.create({ fromUserId, toUserId, offeredCardId, requestedCardId });
  res.json({ trade });
});

router.post('/:id/accept', requireAuth, async (req, res) => {
  const trade = await TradeOffer.findById(req.params.id).populate('offeredCardId requestedCardId');
  if (!trade) return res.status(404).json({ error: 'Échange introuvable.' });
  if (trade.toUserId !== req.session.user.id) return res.status(403).json({ error: "Cet échange ne t'est pas destiné." });
  if (trade.status !== 'en_attente') return res.status(400).json({ error: 'Cet échange a déjà été traité.' });

  const [fromOwned, toOwned] = await Promise.all([
    UserCard.findOne({ userId: trade.fromUserId, cardId: trade.offeredCardId._id }),
    UserCard.findOne({ userId: trade.toUserId, cardId: trade.requestedCardId._id })
  ]);

  if (!fromOwned || fromOwned.quantity < 1) {
    return res.status(400).json({ error: `L'autre dresseur ne possède plus assez de ${trade.offeredCardId.nameFr}.` });
  }
  if (!toOwned || toOwned.quantity < 1) {
    return res.status(400).json({ error: `Tu ne possèdes plus assez de ${trade.requestedCardId.nameFr}.` });
  }

  await Promise.all([
    UserCard.findOneAndUpdate({ userId: trade.fromUserId, cardId: trade.offeredCardId._id }, { $inc: { quantity: -1 } }),
    UserCard.findOneAndUpdate(
      { userId: trade.toUserId, cardId: trade.offeredCardId._id },
      { $inc: { quantity: 1 }, $push: { obtainedAt: new Date() } },
      { upsert: true }
    ),
    UserCard.findOneAndUpdate({ userId: trade.toUserId, cardId: trade.requestedCardId._id }, { $inc: { quantity: -1 } }),
    UserCard.findOneAndUpdate(
      { userId: trade.fromUserId, cardId: trade.requestedCardId._id },
      { $inc: { quantity: 1 }, $push: { obtainedAt: new Date() } },
      { upsert: true }
    )
  ]);
  await UserCard.deleteMany({ quantity: { $lte: 0 } });

  trade.status = 'acceptee';
  await trade.save();
  res.json({ trade });
});

router.post('/:id/decline', requireAuth, async (req, res) => {
  const trade = await TradeOffer.findById(req.params.id);
  if (!trade) return res.status(404).json({ error: 'Échange introuvable.' });
  if (trade.toUserId !== req.session.user.id) return res.status(403).json({ error: "Cet échange ne t'est pas destiné." });
  if (trade.status !== 'en_attente') return res.status(400).json({ error: 'Cet échange a déjà été traité.' });

  trade.status = 'refusee';
  await trade.save();
  res.json({ trade });
});

router.post('/:id/cancel', requireAuth, async (req, res) => {
  const trade = await TradeOffer.findById(req.params.id);
  if (!trade) return res.status(404).json({ error: 'Échange introuvable.' });
  if (trade.fromUserId !== req.session.user.id) return res.status(403).json({ error: "Ce n'est pas ta proposition." });
  if (trade.status !== 'en_attente') return res.status(400).json({ error: 'Cet échange a déjà été traité.' });

  trade.status = 'annulee';
  await trade.save();
  res.json({ trade });
});

module.exports = router;
