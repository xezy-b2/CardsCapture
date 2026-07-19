require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const Card = require('../src/models/Card');

// Supprime tout ce qui ne correspond pas à notre schéma (rarity valide + cardId présent).
// Utile si la base contenait déjà des données d'un autre projet (ex: un vrai import
// de cartes Pokémon TCG avec des raretés du genre "Rare Holo GX").
async function run() {
  await connectDB();

  const before = await Card.countDocuments();

  const result = await mongoose.connection.collection('cards').deleteMany({
    $or: [
      { rarity: { $nin: ['Commune', 'Rare', 'Légendaire'] } },
      { cardId: { $exists: false } },
      { cardId: null }
    ]
  });

  const after = await Card.countDocuments();

  console.log(`📦 Avant nettoyage : ${before} cartes`);
  console.log(`🗑️  Supprimées : ${result.deletedCount} carte(s) qui ne venaient pas de notre import`);
  console.log(`📦 Après nettoyage : ${after} cartes`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
