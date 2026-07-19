const mongoose = require('mongoose');

// Un défi de combat entre deux dresseurs. Se résout dès l'acceptation :
// on compare le total des stats des decks (3 cartes chacun) avec une petite
// part d'aléatoire, et on enregistre le résultat.
const battleSchema = new mongoose.Schema({
  challengerId: { type: String, required: true },
  opponentId: { type: String, required: true },
  status: {
    type: String,
    enum: ['en_attente', 'terminee', 'refusee'],
    default: 'en_attente'
  },
  result: {
    winnerId: { type: String },
    challengerScore: { type: Number },
    opponentScore: { type: Number },
    challengerDeck: [{ nameFr: String, imageUrl: String }],
    opponentDeck: [{ nameFr: String, imageUrl: String }]
  },
  createdAt: { type: Date, default: Date.now, expires: 86400 }
});

module.exports = mongoose.model('Battle', battleSchema);
