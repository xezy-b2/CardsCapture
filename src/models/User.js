const mongoose = require('mongoose');

// Profil du joueur : stats globales + économie de coins (boosters).
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true }, // Discord ID
  username: { type: String, required: true },
  totalCaptures: { type: Number, default: 0 },
  victoires: { type: Number, default: 0 },
  defaites: { type: Number, default: 0 },
  deck: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Card' }], // max 3

  coins: { type: Number, default: 0 },
  hasStarted: { type: Boolean, default: false }, // a déjà réclamé son booster de départ (/start)
  lastCoinEarnedAt: { type: Date }, // pour le cooldown anti-spam des coins de chat
  lastDailyClaimAt: { type: Date }, // pour le cooldown du /daily
  completedSets: [{ type: String }], // setId des extensions déjà complétées à 100% (bonus one-shot)

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
