require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');

// Supprime entièrement la collection cards (documents ET index), pour repartir
// propre après un changement de schéma (ex: passage du Pokédex aux vraies
// cartes TCG). mongoose recréera les bons index au prochain import.
async function run() {
  await connectDB();

  const collections = await mongoose.connection.db.listCollections({ name: 'cards' }).toArray();
  if (collections.length === 0) {
    console.log('ℹ️  La collection cards n\'existe pas encore, rien à faire.');
  } else {
    const countBefore = await mongoose.connection.collection('cards').countDocuments();
    await mongoose.connection.collection('cards').drop();
    console.log(`🗑️  Collection cards supprimée (${countBefore} document(s) effacé(s), y compris les vieux index).`);
  }

  console.log('✅ Prêt pour un import propre : npm run import-cards');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
