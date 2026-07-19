const mongoose = require('mongoose');

// Un exemplaire (ou plusieurs, via "quantity") d'une carte possédée par un joueur.
// C'est cette collection qui alimentera le site (rangement par génération/pokedex)
// et le système d'échange de doubles.
const userCardSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // Discord ID
  cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true, index: true },
  quantity: { type: Number, default: 1 },
  obtainedAt: [{ type: Date, default: Date.now }] // une date par exemplaire capturé
});

userCardSchema.index({ userId: 1, cardId: 1 }, { unique: true });

module.exports = mongoose.model('UserCard', userCardSchema);
