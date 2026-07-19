const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI manquant dans le fichier .env');
  }

  mongoose.connection.on('connected', () => {
    console.log('✅ Connecté à MongoDB');
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ Erreur MongoDB :', err.message);
  });

  await mongoose.connect(uri);
}

module.exports = { connectDB };
