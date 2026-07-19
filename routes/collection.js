const express = require('express');
const router = express.Router();
const Card = require('../src/models/Card');
const UserCard = require('../src/models/UserCard');
const User = require('../src/models/User');

// Tri "naturel" par numéro dans l'extension (ex: "9" avant "10", même si ce
// sont des chaînes, et gère aussi les localId non purement numériques comme "TG01")
function naturalCompare(a, b) {
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);
  if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
  return String(a).localeCompare(String(b));
}

router.get('/collection/:discordId', async (req, res) => {
  try {
    const { discordId } = req.params;

    const [allCards, owned] = await Promise.all([
      Card.find({}).lean(),
      UserCard.find({ userId: discordId }).lean()
    ]);

    const ownedMap = new Map(owned.map((o) => [o.cardId.toString(), o.quantity]));
    const serieMap = new Map(); // serieName -> Map(setId -> { setInfo, cards[] })
    let totalOwnedDistinct = 0;

    for (const card of allCards) {
      const quantity = ownedMap.get(card._id.toString()) || 0;
      if (quantity > 0) totalOwnedDistinct += 1;

      if (!serieMap.has(card.serieName)) serieMap.set(card.serieName, new Map());
      const setsInSerie = serieMap.get(card.serieName);

      if (!setsInSerie.has(card.setId)) {
        setsInSerie.set(card.setId, {
          setId: card.setId,
          setName: card.setName,
          setReleaseDate: card.setReleaseDate,
          cards: []
        });
      }

      setsInSerie.get(card.setId).cards.push({
        cardId: card._id,
        localId: card.localId,
        nameFr: card.nameFr,
        category: card.category,
        hp: card.hp,
        types: card.types,
        officialRarity: card.officialRarity,
        rarity: card.rarity,
        imageUrl: card.imageUrl,
        illustrator: card.illustrator,
        stage: card.stage,
        attacks: card.attacks,
        owned: quantity > 0,
        quantity
      });
    }

    // Construit la liste des séries, triées par date de sortie la plus ancienne
    // de leurs extensions (ordre chronologique = ordre des générations de jeu)
    const series = Array.from(serieMap.entries()).map(([serieName, setsMap]) => {
      const sets = Array.from(setsMap.values())
        .map((set) => ({ ...set, cards: set.cards.sort((a, b) => naturalCompare(a.localId, b.localId)) }))
        .sort((a, b) => new Date(a.setReleaseDate || 0) - new Date(b.setReleaseDate || 0));

      const earliestDate = sets.reduce((min, s) => {
        const d = new Date(s.setReleaseDate || 0);
        return d < min ? d : min;
      }, new Date());

      return { serieName, sets, earliestDate };
    });

    series.sort((a, b) => a.earliestDate - b.earliestDate);
    const orderedSeries = series.map(({ serieName, sets }) => ({ serieName, sets }));

    res.json({ discordId, totalCards: allCards.length, totalOwnedDistinct, series: orderedSeries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/profile/:discordId', async (req, res) => {
  try {
    const { discordId } = req.params;
    const user = await User.findOne({ userId: discordId }).lean();

    if (!user) {
      return res.json({ discordId, found: false, totalCaptures: 0, victoires: 0, defaites: 0, distinctCards: 0, coins: 0, hasStarted: false });
    }

    const distinctCards = await UserCard.countDocuments({ userId: discordId });

    res.json({
      discordId,
      found: true,
      username: user.username,
      totalCaptures: user.totalCaptures,
      distinctCards,
      victoires: user.victoires,
      defaites: user.defaites,
      coins: user.coins || 0,
      hasStarted: user.hasStarted || false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Liste des dresseurs connus (pour les sélecteurs d'échange/combat)
router.get('/trainers', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const filter = search ? { username: { $regex: search, $options: 'i' } } : {};
    const trainers = await User.find(filter).select('userId username').limit(50).lean();
    res.json({ trainers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Toutes les cartes du jeu (pour choisir la carte demandée dans un échange)
router.get('/cards', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const filter = search ? { nameFr: { $regex: search, $options: 'i' } } : {};
    const cards = await Card.find(filter).select('nameFr localId officialRarity rarity imageUrl setName').limit(30).lean();
    res.json({ cards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
