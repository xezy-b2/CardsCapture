const mongoose = require('mongoose');

// Une "Card" = une vraie carte du jeu de cartes à collectionner Pokémon (pas un
// exemplaire possédé par un joueur, voir UserCard.js pour ça). Remplie via
// scripts/importCards.js depuis l'API TCGdex (données en français).
const cardSchema = new mongoose.Schema({
  cardId: { type: String, required: true, unique: true, index: true }, // id TCGdex, ex: "swsh3-136"
  localId: { type: String, required: true }, // numéro dans l'extension, ex: "136"
  nameFr: { type: String, required: true, index: true },
  category: { type: String, default: 'Pokémon' }, // ex: "Pokémon", "Dresseur", "Énergie" (pas d'enum strict, au cas où l'API ajoute des variantes)
  hp: { type: Number }, // uniquement pour les cartes Pokémon
  types: [{ type: String }], // ex: ["Feu", "Vol"], vide pour Dresseur/Énergie

  officialRarity: { type: String, required: true }, // rareté réelle de la carte, ex: "Rare Holo GX"
  rarity: {
    type: String,
    enum: ['Commune', 'Rare', 'Légendaire'],
    required: true,
    index: true
  }, // notre tier simplifié, utilisé pour le spawn
  spawnWeight: { type: Number, required: true },

  imageUrl: { type: String }, // certaines cartes (promos anciennes...) n'en ont pas dans l'API

  setId: { type: String, required: true, index: true },
  setName: { type: String, required: true },
  serieName: { type: String, required: true, index: true },
  setReleaseDate: { type: Date },

  illustrator: { type: String },
  stage: { type: String }, // Basique / Stade 1 / Stade 2
  attacks: [
    {
      name: String,
      cost: [String],
      damage: String,
      effect: String
    }
  ]
});

module.exports = mongoose.model('Card', cardSchema);
