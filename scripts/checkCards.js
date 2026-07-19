require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const Card = require('../src/models/Card');

async function run() {
  await connectDB();

  const total = await Card.countDocuments();
  console.log(`\n📦 Total de cartes en base : ${total}`);

  if (total === 0) {
    console.log('❌ Aucune carte trouvée. Lance : npm run import-cards');
  } else {
    const byRarity = await Card.aggregate([
      { $group: { _id: '$rarity', count: { $sum: 1 }, poidsTotal: { $sum: '$spawnWeight' } } }
    ]);
    console.log('\nRépartition par rareté :');
    console.table(byRarity);

    const badWeights = await Card.find({
      $or: [{ spawnWeight: { $exists: false } }, { spawnWeight: { $lte: 0 } }]
    }).select('nameFr cardId spawnWeight officialRarity');

    if (badWeights.length > 0) {
      console.log(`\n⚠️  ${badWeights.length} carte(s) avec un poids invalide :`);
      console.table(badWeights.map((c) => ({ nom: c.nameFr, cardId: c.cardId, rareteOfficielle: c.officialRarity, poids: c.spawnWeight })));
    } else {
      console.log('\n✅ Tous les poids de spawn sont valides.');
    }

    // Aperçu de 5 cartes tirées au hasard pour vérifier la diversité
    console.log('\n🎲 5 tirages de test :');
    const cards = await Card.find({});
    const totalWeight = cards.reduce((sum, c) => sum + (c.spawnWeight || 0), 0);
    for (let i = 0; i < 5; i++) {
      let roll = Math.random() * totalWeight;
      for (const card of cards) {
        roll -= card.spawnWeight || 0;
        if (roll <= 0) {
          console.log(`  - ${card.nameFr} (${card.rarity})`);
          break;
        }
      }
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
