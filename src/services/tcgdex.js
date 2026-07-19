const BASE_URL = 'https://api.tcgdex.net/v2/fr';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erreur TCGdex (${res.status}) sur ${url}`);
  return res.json();
}

// Liste de toutes les extensions (sets), en résumé
async function getAllSets() {
  return fetchJson(`${BASE_URL}/sets`);
}

// Détail d'une extension : contient la liste des cartes en résumé (id, localId, nom, image)
async function getSetDetail(setId) {
  return fetchJson(`${BASE_URL}/sets/${setId}`);
}

// Détail complet d'une carte : rareté, HP, types, attaques, illustrateur...
async function getCardDetail(cardId) {
  return fetchJson(`${BASE_URL}/cards/${cardId}`);
}

// TCGdex retourne un chemin d'image sans extension ; il faut préciser qualité + format.
function buildImageUrl(image) {
  if (!image) return null;
  return `${image}/high.png`;
}

module.exports = { getAllSets, getSetDetail, getCardDetail, buildImageUrl };
