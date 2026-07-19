require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const Card = require('../src/models/Card');
const { getAllSets, getSetDetail, getCardDetail, buildImageUrl } = require('../src/services/tcgdex');
const { computeRarity, getSpawnWeight } = require('../src/services/rarity');

// Filtres optionnels (sinon on importe TOUTES les extensions, ce qui peut
// représenter plusieurs dizaines de milliers de cartes et prendre des heures).
const SERIE_FILTER = (process.env.SERIES || '').split(',').map((s) => s.trim()).filter(Boolean);
const SET_FILTER = (process.env.SETS || '').split(',').map((s) => s.trim()).filter(Boolean);
const CONCURRENCY = Number(process.env.IMPORT_CONCURRENCY || 8);

// Exécute `items` via `worker` avec au plus `limit` tâches en parallèle
async function runWithConcurrency(items, limit, worker) {
  const results = [];
  let index = 0;

  async function next() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}

async function importSet(setBrief) {
  console.log(`\n📥 Extension : ${setBrief.name} (${setBrief.id})...`);

  const setDetail = await getSetDetail(setBrief.id);
  const serieName = setDetail.serie?.name || 'Inconnue';
  const setReleaseDate = setDetail.releaseDate ? new Date(setDetail.releaseDate) : null;
  const cardBriefs = setDetail.cards || [];

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  await runWithConcurrency(cardBriefs, CONCURRENCY, async (brief) => {
    const exists = await Card.findOne({ cardId: brief.id });
    if (exists) {
      skipped += 1;
      return;
    }

    try {
      const detail = await getCardDetail(brief.id);
      const officialRarity = detail.rarity || 'Common';
      const rarity = computeRarity(officialRarity);

      await Card.create({
        cardId: detail.id,
        localId: detail.localId,
        nameFr: detail.name,
        category: detail.category || 'Pokémon',
        hp: detail.hp,
        types: detail.types || [],
        officialRarity,
        rarity,
        spawnWeight: getSpawnWeight(rarity),
        imageUrl: buildImageUrl(detail.image),
        setId: setBrief.id,
        setName: setDetail.name,
        serieName,
        setReleaseDate,
        illustrator: detail.illustrator,
        stage: detail.stage,
        attacks: (detail.attacks || []).map((a) => ({
          name: a.name,
          cost: a.cost || [],
          damage: a.damage,
          effect: a.effect
        }))
      });

      imported += 1;
    } catch (err) {
      failed += 1;
      console.error(`  ❌ Erreur sur la carte ${brief.id} (${brief.name}) :`, err.message);
    }
  });

  console.log(`  ✅ ${imported} importée(s), ⏭️ ${skipped} déjà en base, ❌ ${failed} échec(s)`);
}

async function run() {
  await connectDB();

  let sets = await getAllSets();

  if (SET_FILTER.length > 0) {
    sets = sets.filter((s) => SET_FILTER.includes(s.id));
  }
  if (SERIE_FILTER.length > 0) {
    // Le résumé de /sets ne contient pas toujours la série : on la vérifiera
    // après coup, mais on peut déjà filtrer par nom d'extension si fourni.
    console.log(`ℹ️  Filtre de série demandé : ${SERIE_FILTER.join(', ')} (vérifié extension par extension)`);
  }

  console.log(`📦 ${sets.length} extension(s) à traiter (concurrence : ${CONCURRENCY})`);

  for (const setBrief of sets) {
    if (SERIE_FILTER.length > 0) {
      const setDetail = await getSetDetail(setBrief.id);
      const serieName = setDetail.serie?.name || '';
      if (!SERIE_FILTER.some((s) => serieName.toLowerCase().includes(s.toLowerCase()))) continue;
    }

    await importSet(setBrief).catch((err) => console.error(`❌ Erreur sur l'extension ${setBrief.id} :`, err.message));
  }

  console.log('\n🎉 Import terminé.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
