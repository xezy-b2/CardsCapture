const User = require('../models/User');
const UserCard = require('../models/UserCard');
const Card = require('../models/Card');
const { generateBoosterCards } = require('./booster');

const STARTER_SET_ID = process.env.STARTER_SET_ID || 'base1';
const STARTER_BOOSTER_SIZE = Number(process.env.STARTER_BOOSTER_SIZE || 5);
const BOOSTER_SIZE = Number(process.env.BOOSTER_SIZE || 5);
const SET_COMPLETION_BONUS = Number(process.env.SET_COMPLETION_BONUS || 200);

// ---------- Prix des boosters, basé sur la rareté moyenne de l'extension ----------
//
// Logique : chaque rareté a un "poids" de valeur. On calcule le poids moyen de
// toutes les cartes d'une extension, puis on le convertit en prix. Une
// extension pleine de Communes coûtera le prix plancher ; une extension avec
// beaucoup de Rares/Légendaires coûtera nettement plus cher, de façon
// proportionnelle (pas juste "cher parce que récente").
const RARITY_WEIGHT = { Commune: 1, Rare: 3, Légendaire: 9 };
const PRICE_PER_WEIGHT_UNIT = Number(process.env.PRICE_PER_WEIGHT_UNIT || 65); // coins par point de poids moyen
const MIN_BOOSTER_COST = Number(process.env.MIN_BOOSTER_COST || 60); // plancher, même pour une extension 100% Commune
const PRICE_STEP = 5; // arrondi au multiple de 5 le plus proche, pour un prix "propre"

// Conserve BOOSTER_COST comme prix de référence/fallback (ex: si une extension
// n'a aucune carte en base, ou pour un affichage générique avant sélection).
const BOOSTER_COST = Number(process.env.BOOSTER_COST || 100);

function computePriceFromAvgWeight(avgWeight) {
  const raw = avgWeight * PRICE_PER_WEIGHT_UNIT;
  const rounded = Math.round(raw / PRICE_STEP) * PRICE_STEP;
  return Math.max(MIN_BOOSTER_COST, rounded);
}

// Calcule le prix d'une extension précise (une seule requête, cas /open).
async function getSetPrice(setId) {
  const cards = await Card.find({ setId }).select('rarity').lean();
  if (cards.length === 0) return BOOSTER_COST;

  const totalWeight = cards.reduce((sum, c) => sum + (RARITY_WEIGHT[c.rarity] ?? RARITY_WEIGHT.Commune), 0);
  const avgWeight = totalWeight / cards.length;
  return computePriceFromAvgWeight(avgWeight);
}

// Calcule le prix de TOUTES les extensions en une seule agrégation Mongo
// (utilisé par /api/booster/sets pour afficher le prix de chaque extension
// dans le sélecteur, sans faire une requête par extension).
async function getSetPricesMap() {
  const rows = await Card.aggregate([
    {
      $group: {
        _id: '$setId',
        avgWeight: {
          $avg: {
            $switch: {
              branches: [
                { case: { $eq: ['$rarity', 'Légendaire'] }, then: RARITY_WEIGHT['Légendaire'] },
                { case: { $eq: ['$rarity', 'Rare'] }, then: RARITY_WEIGHT['Rare'] }
              ],
              default: RARITY_WEIGHT['Commune']
            }
          }
        }
      }
    }
  ]);

  const map = {};
  for (const row of rows) {
    map[row._id] = computePriceFromAvgWeight(row.avgWeight);
  }
  return map;
}

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
    { $setOnInsert: { userId }, $set: { hasStarted: true, username } },
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

  const cost = await getSetPrice(setId);

  if ((user.coins || 0) < cost) {
    throw new BoosterError(`Il te faut ${cost} coins pour ouvrir un booster de cette extension (tu en as ${user.coins || 0}).`);
  }

  // Débit atomique : évite qu'un double-clic (ou bot + site en même temps) ne fasse
  // ouvrir 2 boosters pour le prix d'un
  const debited = await User.findOneAndUpdate(
    { userId, coins: { $gte: cost } },
    { $inc: { coins: -cost }, $set: { username } },
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
  return { pulled, setId, completionBonusApplied, coinsRemaining: finalUser.coins, coinsSpent: cost };
}

module.exports = {
  claimStarterBooster,
  openBooster,
  BoosterError,
  BOOSTER_COST,
  SET_COMPLETION_BONUS,
  getSetPrice,
  getSetPricesMap
};
