const Card = require('../models/Card');

// Tire une carte au hasard dans une liste, sans tenir compte du poids de spawn
// (ici on veut juste varier parmi les communes, pas reproduire les proba de spawn)
function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Génère le contenu d'un booster pour une extension donnée : `size` cartes,
// dont un "hit" garanti (Rare ou Légendaire) comme dans un vrai pack, sauf si
// l'extension n'a pas assez de cartes rares/légendaires (on complète avec ce qu'il y a).
async function generateBoosterCards(setId, size = 5) {
  const allCards = await Card.find({ setId }).lean();
  if (allCards.length === 0) return [];

  const communes = allCards.filter((c) => c.rarity === 'Commune');
  const hits = allCards.filter((c) => c.rarity === 'Rare' || c.rarity === 'Légendaire');

  const pulled = [];

  // Le "hit" garanti : 85% Rare / 15% Légendaire parmi les cartes disponibles,
  // façon vraie distribution de pack (les légendaires restent l'exception)
  if (hits.length > 0) {
    const legendaires = hits.filter((c) => c.rarity === 'Légendaire');
    const rares = hits.filter((c) => c.rarity === 'Rare');
    const useLegendary = legendaires.length > 0 && Math.random() < 0.15;
    pulled.push(useLegendary ? pickRandom(legendaires) : pickRandom(rares.length > 0 ? rares : legendaires));
  }

  const fillerPool = communes.length > 0 ? communes : allCards;
  while (pulled.length < size && fillerPool.length > 0) {
    pulled.push(pickRandom(fillerPool));
  }

  return pulled;
}

module.exports = { generateBoosterCards };
