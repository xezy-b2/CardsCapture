const User = require('../models/User');
const UserCard = require('../models/UserCard');
const Card = require('../models/Card');
const { generateBoosterCards } = require('./booster');

const STARTER_SET_ID = process.env.STARTER_SET_ID || 'base1';
const STARTER_BOOSTER_SIZE = Number(process.env.STARTER_BOOSTER_SIZE || 5);
const BOOSTER_COST = Number(process.env.BOOSTER_COST || 100);
const BOOSTER_SIZE = Number(process.env.BOOSTER_SIZE || 5);
const SET_COMPLETION_BONUS = Number(process.env.SET_COMPLETION_BONUS || 200);

// Erreur "attendue" (coins insuffisants, déjà réclamé...) à distinguer d'un bug serveur
class BoosterError extends Error {}

async function addCardsToUser(userId, cards) {
  for (const card of cards) {
    await UserCard.findOneAndUpdate(
      { userId, cardId: card._id },
      { $inc: { quantity: 1 }, $push: { obtainedAt: new Date() } },
      { upsert: true }
    );
  }
  await User.findOneAndUpdate({ userId }, { $inc: { totalCaptures: cards.length } });
}

async function claimStarterBooster(userId, username) {
  const existing = await User.findOne({ userId });
  if (existing?.hasStarted) {
    throw new BoosterError('Tu as déjà réclamé ton booster de départ !');
  }

  let setId = STARTER_SET_ID;
  const cardCount = await Card.countDocuments({ setId });
  if (cardCount === 0) {
    const anyCard = await Card.findOne({});
    if (!anyCard) throw new BoosterError('Aucune carte en base pour le moment.');
    setId = anyCard.setId;
  }

  const pulled = await generateBoosterCards(setId, STARTER_BOOSTER_SIZE);

  await User.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, username }, $set: { hasStarted: true, username } },
    { upsert: true }
  );
  await addCardsToUser(userId, pulled);

  return { pulled, setId };
}

async function openBooster(userId, username, requestedSetId) {
  let setId = requestedSetId;
  if (!setId || setId === 'random') {
    const allSetIds = await Card.distinct('setId');
    if (allSetIds.length === 0) throw new BoosterError('Aucune extension en base pour le moment.');
    setId = allSetIds[Math.floor(Math.random() * allSetIds.length)];
  }

  const setExists = await Card.exists({ setId });
  if (!setExists) throw new BoosterError("Cette extension n'existe pas ou n'est pas en base.");

  const user = await User.findOne({ userId });
  if (!user || !user.hasStarted) {
    throw new BoosterError('Réclame ton booster de départ avant (/start sur Discord, ou le bouton sur le site).');
  }
  if ((user.coins || 0) < BOOSTER_COST) {
    throw new BoosterError(`Il te faut ${BOOSTER_COST} coins pour ouvrir un booster (tu en as ${user.coins || 0}).`);
  }

  // Débit atomique : évite qu'un double-clic (ou bot + site en même temps) ne fasse
  // ouvrir 2 boosters pour le prix d'un
  const debited = await User.findOneAndUpdate(
    { userId, coins: { $gte: BOOSTER_COST } },
    { $inc: { coins: -BOOSTER_COST }, $set: { username } },
    { new: true }
  );
  if (!debited) throw new BoosterError("Coins insuffisants (quelqu'un a été plus rapide ?).");

  const pulled = await generateBoosterCards(setId, BOOSTER_SIZE);
  await addCardsToUser(userId, pulled);

  // Bonus de complétion d'extension (une seule fois par extension)
  let completionBonusApplied = false;
  if (!user.completedSets?.includes(setId)) {
    const setCardIds = (await Card.find({ setId }).select('_id')).map((c) => c._id);
    const totalInSet = setCardIds.length;
    const ownedInSet = await UserCard.countDocuments({ userId, cardId: { $in: setCardIds } });

    if (totalInSet > 0 && ownedInSet >= totalInSet) {
      await User.findOneAndUpdate(
        { userId },
        { $addToSet: { completedSets: setId }, $inc: { coins: SET_COMPLETION_BONUS } }
      );
      completionBonusApplied = true;
    }
  }

  const finalUser = await User.findOne({ userId });
  return { pulled, setId, completionBonusApplied, coinsRemaining: finalUser.coins };
}

module.exports = { claimStarterBooster, openBooster, BoosterError, BOOSTER_COST, SET_COMPLETION_BONUS };
