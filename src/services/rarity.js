// Les vraies cartes ont des dizaines de raretés officielles différentes
// (Common, Rare Holo, Rare Holo GX, Rare Secret, Illustration Rare...).
// On les simplifie en 3 tiers pour piloter le spawn et la difficulté de capture.

const SPAWN_WEIGHTS = { Commune: 100, Rare: 15, Légendaire: 2 };
const CAPTURE_CHANCE = { Commune: 0.7, Rare: 0.4, Légendaire: 0.15 };

const COMMUNE_SET = new Set(['Common', 'Uncommon']);

const LEGENDAIRE_SET = new Set([
  'Rare Secret',
  'Rare Rainbow',
  'Hyper Rare',
  'Ultra Rare',
  'Illustration Rare',
  'Special Illustration Rare',
  'Amazing Rare',
  'Radiant Rare',
  'LEGEND',
  'Shiny Ultra Rare',
  'Rare Shiny GX',
  'Rare Holo LV.X',
  'Gold Secret Rare',
  'Rare Rainbow Alt'
]);

// Tout ce qui n'est ni "Commune" ni "Légendaire" (Rare, Rare Holo, GX, EX, V,
// VMAX, VSTAR, Promo, etc.) tombe dans le tier intermédiaire "Rare".
function computeRarity(officialRarity) {
  if (!officialRarity) return 'Commune';
  if (COMMUNE_SET.has(officialRarity)) return 'Commune';
  if (LEGENDAIRE_SET.has(officialRarity)) return 'Légendaire';
  return 'Rare';
}

function getSpawnWeight(rarity) {
  return SPAWN_WEIGHTS[rarity];
}

function getCaptureChance(rarity) {
  return CAPTURE_CHANCE[rarity];
}

module.exports = { computeRarity, getSpawnWeight, getCaptureChance };
