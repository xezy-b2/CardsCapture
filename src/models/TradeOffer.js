const mongoose = require('mongoose');

// Une proposition d'échange : fromUser donne offeredCard contre requestedCard de toUser.
// Les deux cartes doivent être des doubles (quantity >= 2 côté qui les possède déjà,
// ou >=1 après l'échange il en restera au moins 1) au moment de l'acceptation.
const tradeOfferSchema = new mongoose.Schema({
  fromUserId: { type: String, required: true },
  toUserId: { type: String, required: true },
  offeredCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
  requestedCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
  status: {
    type: String,
    enum: ['en_attente', 'acceptee', 'refusee', 'annulee'],
    default: 'en_attente'
  },
  messageId: { type: String },
  channelId: { type: String },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // expire après 24h si sans réponse
});

module.exports = mongoose.model('TradeOffer', tradeOfferSchema);
