const mongoose = require('mongoose');

// Historique des boosters ouverts par chaque joueur, affiché sur la page profil.
// On duplique nameFr/rarity/imageUrl au moment de l'ouverture (plutôt que de
// juste stocker des refs vers Card) pour que l'historique reste correct même
// si une carte est plus tard modifiée ou supprimée du catalogue.
const boosterOpeningSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // Discord ID
  setId: { type: String },
  isStarter: { type: Boolean, default: false },
  cards: [
    {
      cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card' },
      nameFr: String,
      rarity: String,
      imageUrl: String
    }
  ],
  openedAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('BoosterOpening', boosterOpeningSchema);
