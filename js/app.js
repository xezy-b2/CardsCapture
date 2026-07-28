const state = {
  currentUser: null,
  trainersById: new Map(),
  series: [],
  activeSerie: null,
  collectionFilters: { search: '', ownership: 'all', rarity: 'all' },
  deckDraft: [null, null, null], // ids en cours d'édition avant sauvegarde
  activeDeckSlot: null
};

const el = {
  authArea: document.getElementById('authArea'),
  mainTabs: document.getElementById('mainTabs'),
  discordIdInput: document.getElementById('discordIdInput'),
  loadBtn: document.getElementById('loadBtn'),
  profileCard: document.getElementById('profileCard'),
  statCaptures: document.getElementById('statCaptures'),
  statDistinct: document.getElementById('statDistinct'),
  statWins: document.getElementById('statWins'),
  statLosses: document.getElementById('statLosses'),
  statWinrate: document.getElementById('statWinrate'),
  genTabs: document.getElementById('genTabs'),
  screen: document.getElementById('screen'),
  lensImage: document.getElementById('lensImage'),
  collectionSearch: document.getElementById('collectionSearch'),
  ownershipFilter: document.getElementById('ownershipFilter'),
  rarityFilter: document.getElementById('rarityFilter'),

  tradeTargetSelect: document.getElementById('tradeTargetSelect'),
  tradeOfferedSelect: document.getElementById('tradeOfferedSelect'),
  tradeRequestedSearch: document.getElementById('tradeRequestedSearch'),
  tradeRequestedSelect: document.getElementById('tradeRequestedSelect'),
  tradeSubmitBtn: document.getElementById('tradeSubmitBtn'),
  tradeFormError: document.getElementById('tradeFormError'),
  tradesIncoming: document.getElementById('tradesIncoming'),
  tradesOutgoing: document.getElementById('tradesOutgoing'),

  deckSlots: document.getElementById('deckSlots'),
  deckSaveBtn: document.getElementById('deckSaveBtn'),
  deckError: document.getElementById('deckError'),
  deckPicker: document.getElementById('deckPicker'),
  deckPickerSearch: document.getElementById('deckPickerSearch'),
  deckPickerList: document.getElementById('deckPickerList'),
  deckPickerClose: document.getElementById('deckPickerClose'),
  deckPickerRarity: document.getElementById('deckPickerRarity'),
  deckPickerHpMin: document.getElementById('deckPickerHpMin'),
  deckPickerHpMax: document.getElementById('deckPickerHpMax'),

  battleTargetSelect: document.getElementById('battleTargetSelect'),
  battleChallengeBtn: document.getElementById('battleChallengeBtn'),
  battleFormError: document.getElementById('battleFormError'),
  battleIncoming: document.getElementById('battleIncoming'),
  battleOutgoing: document.getElementById('battleOutgoing'),
  battleHistory: document.getElementById('battleHistory'),

  boosterCoins: document.getElementById('boosterCoins'),
  boosterStartBlock: document.getElementById('boosterStartBlock'),
  boosterStartBtn: document.getElementById('boosterStartBtn'),
  boosterCostHint: document.getElementById('boosterCostHint'),
  boosterSetSelect: document.getElementById('boosterSetSelect'),
  boosterOpenBtn: document.getElementById('boosterOpenBtn'),
  boosterFormError: document.getElementById('boosterFormError'),
  boosterResultPanel: document.getElementById('boosterResultPanel'),
  boosterResultCards: document.getElementById('boosterResultCards'),
  boosterResultCoinsSpent: document.getElementById('boosterResultCoinsSpent'),
  boosterCompletionMessage: document.getElementById('boosterCompletionMessage'),

  boosterOpenOverlay: document.getElementById('boosterOpenOverlay'),
  boosterStage: document.getElementById('boosterStage'),
  boosterPack: document.getElementById('boosterPack'),
  boosterStageHint: document.getElementById('boosterStageHint'),
  boosterReveal: document.getElementById('boosterReveal'),
  boosterRevealStack: document.getElementById('boosterRevealStack'),
  boosterRevealCounter: document.getElementById('boosterRevealCounter'),
  boosterSkipBtn: document.getElementById('boosterSkipBtn'),
  boosterContinueBtn: document.getElementById('boosterContinueBtn'),

  profileAvatar: document.getElementById('profileAvatar'),
  profileUsername: document.getElementById('profileUsername'),
  profileCoins: document.getElementById('profileCoins'),
  dailyClaimHint: document.getElementById('dailyClaimHint'),
  dailyClaimBtn: document.getElementById('dailyClaimBtn'),
  dailyClaimAmount: document.getElementById('dailyClaimAmount'),
  dailyClaimError: document.getElementById('dailyClaimError'),
  profileStatCaptures: document.getElementById('profileStatCaptures'),
  profileStatWins: document.getElementById('profileStatWins'),
  profileStatLosses: document.getElementById('profileStatLosses'),
  profileStatWinrate: document.getElementById('profileStatWinrate'),
  boosterHistoryList: document.getElementById('boosterHistoryList'),
  questsList: document.getElementById('questsList')
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
  return data;
}

function trainerName(id) {
  if (state.currentUser && id === state.currentUser.id) return `${state.currentUser.username} (toi)`;
  return state.trainersById.get(id) || id;
}

const AUTH_ERROR_MESSAGES = {
  connexion_annulee: 'Connexion annulée.',
  connexion_echouee: 'La connexion avec Discord a échoué, réessaie.',
  discord_rate_limit: 'Discord limite temporairement les connexions (trop de tentatives). Réessaie dans une minute.'
};

function showAuthErrorIfAny() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('erreur');
  if (!code) return;

  const banner = document.createElement('div');
  banner.className = 'auth-error-banner';
  banner.textContent = AUTH_ERROR_MESSAGES[code] || 'Une erreur est survenue.';
  document.body.prepend(banner);

  // Nettoie l'URL pour ne pas garder ?erreur= si on recharge la page
  window.history.replaceState({}, '', window.location.pathname);
}

/* ===================== INIT / AUTH ===================== */

async function init() {
  showAuthErrorIfAny();

  const { user } = await api('/auth/me');
  state.currentUser = user;
  renderAuthArea();

  const { trainers } = await api('/api/trainers');
  state.trainersById = new Map(trainers.map((t) => [t.userId, t.username]));

  if (user) {
    el.discordIdInput.value = user.id;
    loadCollection(user.id);
  }

  setupNav();
}

function renderAuthArea() {
  el.authArea.innerHTML = '';
  if (state.currentUser) {
    const wrap = document.createElement('div');
    wrap.className = 'auth-area__user';
    wrap.innerHTML = `
      <img class="auth-area__avatar" src="${state.currentUser.avatarUrl}" alt="" />
      <span>${state.currentUser.username}</span>
    `;
    const logoutBtn = document.createElement('a');
    logoutBtn.href = '/auth/logout';
    logoutBtn.className = 'btn-logout';
    logoutBtn.textContent = 'Déconnexion';
    el.authArea.appendChild(wrap);
    el.authArea.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement('a');
    loginBtn.href = '/auth/login';
    loginBtn.className = 'btn-discord';
    loginBtn.textContent = 'Se connecter avec Discord';
    el.authArea.appendChild(loginBtn);
  }
}

function setupNav() {
  el.mainTabs.querySelectorAll('.main-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.mainTabs.querySelectorAll('.main-tab').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      document.querySelectorAll('.app-section').forEach((s) => (s.hidden = true));
      const section = document.getElementById(`section-${btn.dataset.section}`);
      section.hidden = false;

      if (btn.dataset.section === 'boosters') loadBoostersSection();
      if (btn.dataset.section === 'trades') loadTradesSection();
      if (btn.dataset.section === 'deck') loadDeckSection();
      if (btn.dataset.section === 'battle') loadBattleSection();
      if (btn.dataset.section === 'profile') loadProfileSection();
    });
  });
}

/* ===================== COLLECTION ===================== */

el.loadBtn.addEventListener('click', () => {
  const id = el.discordIdInput.value.trim();
  if (id) loadCollection(id);
});
el.discordIdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') el.loadBtn.click();
});

async function loadCollection(discordId) {
  el.screen.innerHTML = '<p class="screen__loading">Chargement...</p>';
  el.genTabs.hidden = true;
  el.profileCard.hidden = true;

  try {
    const [profile, collection] = await Promise.all([
      api(`/api/profile/${discordId}`),
      api(`/api/collection/${discordId}`)
    ]);

    renderProfile(profile);
    state.series = collection.series;
    renderSerieTabs();
    state.activeSerie = state.series[0]?.serieName ?? null;
    renderScreen();
  } catch (err) {
    el.screen.innerHTML = `<p class="screen__empty">${err.message}</p>`;
  }
}

function renderProfile(profile) {
  el.profileCard.hidden = false;
  el.statCaptures.textContent = profile.totalCaptures ?? 0;
  el.statDistinct.textContent = profile.distinctCards ?? 0;
  el.statWins.textContent = profile.victoires ?? 0;
  el.statLosses.textContent = profile.defaites ?? 0;
  const total = (profile.victoires ?? 0) + (profile.defaites ?? 0);
  el.statWinrate.textContent = total > 0 ? `${((profile.victoires / total) * 100).toFixed(0)}%` : '—';
}

function renderSerieTabs() {
  el.genTabs.innerHTML = '';
  el.genTabs.hidden = state.series.length === 0;
  for (const { serieName } of state.series) {
    const btn = document.createElement('button');
    btn.className = 'gen-tab';
    btn.textContent = serieName;
    btn.dataset.serie = serieName;
    btn.addEventListener('click', () => {
      state.activeSerie = serieName;
      renderScreen();
    });
    el.genTabs.appendChild(btn);
  }
}

el.collectionSearch.addEventListener('input', (e) => {
  state.collectionFilters.search = e.target.value;
  renderScreen();
});
el.ownershipFilter.addEventListener('change', (e) => {
  state.collectionFilters.ownership = e.target.value;
  renderScreen();
});
el.rarityFilter.addEventListener('change', (e) => {
  state.collectionFilters.rarity = e.target.value;
  renderScreen();
});

function matchesFilters(card) {
  const { search, ownership, rarity } = state.collectionFilters;
  if (ownership === 'owned' && !card.owned) return false;
  if (ownership === 'missing' && card.owned) return false;
  if (rarity !== 'all' && card.rarity !== rarity) return false;
  if (search.trim()) {
    if (!card.owned) return false; // on ne recherche pas parmi les noms cachés (???)
    if (!card.nameFr.toLowerCase().includes(search.trim().toLowerCase())) return false;
  }
  return true;
}

function renderScreen() {
  document.querySelectorAll('.gen-tab').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.serie === state.activeSerie);
  });

  const { search, ownership, rarity } = state.collectionFilters;
  const isFiltering = search.trim().length > 0 || ownership !== 'all' || rarity !== 'all';
  el.screen.innerHTML = '';

  // Dès qu'un filtre est actif (recherche, capturées/manquantes, rareté), on
  // balaie toute la collection au lieu de se limiter à l'onglet de série actif.
  const seriesToRender = isFiltering ? state.series : state.series.filter((s) => s.serieName === state.activeSerie);

  if (seriesToRender.length === 0) {
    el.screen.innerHTML = '<p class="screen__empty">Aucune carte à afficher.</p>';
    return;
  }

  let anyCardShown = false;

  for (const serieData of seriesToRender) {
    for (const set of serieData.sets) {
      const visibleCards = set.cards.filter(matchesFilters);
      if (visibleCards.length === 0) continue;

      anyCardShown = true;
      const ownedCount = set.cards.filter((c) => c.owned).length;

      const heading = document.createElement('div');
      heading.className = 'gen-heading';
      heading.innerHTML = `${isFiltering ? `${serieData.serieName} — ` : ''}${set.setName} <span class="gen-heading__count">${ownedCount}/${set.cards.length} capturées</span>`;

      const grid = document.createElement('div');
      grid.className = 'card-grid';
      for (const card of visibleCards) grid.appendChild(buildCardTile(card));

      el.screen.appendChild(heading);
      el.screen.appendChild(grid);
    }
  }

  if (!anyCardShown) {
    el.screen.innerHTML = '<p class="screen__empty">Aucune carte ne correspond à ces filtres.</p>';
  }
}

function buildCardTile(card) {
  const tile = document.createElement('div');
  tile.className = 'card-tile' + (card.owned ? '' : ' is-locked');
  tile.dataset.rarity = card.rarity;
  tile.tabIndex = 0;
  const imageHtml = card.imageUrl
    ? `<img class="card-tile__image" src="${card.imageUrl}" alt="${card.owned ? card.nameFr : 'Carte non capturée'}" loading="lazy" />`
    : `<div class="card-tile__image card-tile__image--none">🃏</div>`;
  tile.innerHTML = `
    <div class="card-tile__dex">№${card.localId}</div>
    ${imageHtml}
    <div class="card-tile__name">${card.owned ? card.nameFr : ''}</div>
    ${card.owned && card.quantity > 1 ? `<div class="card-tile__quantity">×${card.quantity}</div>` : ''}
  `;
  const showInLens = () => { if (card.owned && card.imageUrl) el.lensImage.src = card.imageUrl; };
  tile.addEventListener('mouseenter', showInLens);
  tile.addEventListener('focus', showInLens);
  tile.addEventListener('click', () => openCardDetail(card));
  tile.addEventListener('keydown', (e) => { if (e.key === 'Enter') openCardDetail(card); });
  return tile;
}

/* ===================== FICHE DÉTAILLÉE D'UNE CARTE ===================== */

let cardDetailModal = null;

function ensureCardDetailModal() {
  if (cardDetailModal) return cardDetailModal;

  const overlay = document.createElement('div');
  overlay.className = 'card-detail-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="card-detail" role="dialog" aria-modal="true">
      <button class="card-detail__close" aria-label="Fermer">×</button>
      <div class="card-detail__body"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => { overlay.hidden = true; };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.card-detail__close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  cardDetailModal = overlay;
  return overlay;
}

function openCardDetail(card) {
  const modal = ensureCardDetailModal();
  const body = modal.querySelector('.card-detail__body');

  if (!card.owned) {
    const lockedImageHtml = card.imageUrl
      ? `<img class="card-detail__image card-detail__image--locked" src="${card.imageUrl}" alt="Carte non capturée" />`
      : `<div class="card-detail__image card-detail__image--none">🃏</div>`;
    body.innerHTML = `
      <div class="card-detail__dex">№${card.localId}</div>
      ${lockedImageHtml}
      <p class="card-detail__unknown">??? — Pas encore capturée</p>
      <span class="rarity-badge" data-rarity="${card.rarity}">${card.officialRarity || card.rarity}</span>
    `;
  } else {
    const attacksHtml = (card.attacks || [])
      .map(
        (a) => `
          <div class="attack-row">
            <div class="attack-row__head">
              <span class="attack-row__name">${a.name}</span>
              ${a.damage ? `<span class="attack-row__damage">${a.damage}</span>` : ''}
            </div>
            ${a.effect ? `<p class="attack-row__effect">${a.effect}</p>` : ''}
          </div>
        `
      )
      .join('');

    const ownedImageHtml = card.imageUrl
      ? `<img class="card-detail__image" src="${card.imageUrl}" alt="${card.nameFr}" />`
      : `<div class="card-detail__image card-detail__image--none">🃏</div>`;

    body.innerHTML = `
      <div class="card-detail__dex">№${card.localId}</div>
      ${ownedImageHtml}
      <h3 class="card-detail__name">${card.nameFr}</h3>
      <div class="card-detail__badges">
        <span class="rarity-badge" data-rarity="${card.rarity}">${card.officialRarity}</span>
        ${card.category && card.category !== 'Pokémon' ? `<span class="type-badge">${card.category}</span>` : ''}
        ${(card.types || []).map((t) => `<span class="type-badge">${t}</span>`).join('')}
        ${card.quantity > 1 ? `<span class="quantity-badge">×${card.quantity} en collection</span>` : ''}
      </div>
      ${card.hp ? `<p class="card-detail__hp">PV : <strong>${card.hp}</strong>${card.stage ? ` · ${card.stage}` : ''}</p>` : ''}
      ${attacksHtml ? `<div class="card-detail__attacks">${attacksHtml}</div>` : ''}
      ${card.illustrator ? `<p class="card-detail__illustrator">Illustré par ${card.illustrator}</p>` : ''}
    `;
  }

  modal.hidden = false;
}

/* ===================== BOOSTERS ===================== */

let boosterSetsLoaded = false;

async function loadBoostersSection() {
  if (!state.currentUser) {
    document.getElementById('section-boosters').innerHTML = '<p class="screen__empty" style="padding:24px">Connecte-toi avec Discord pour ouvrir des boosters.</p>';
    return;
  }

  const status = await api('/api/booster/status');
  el.boosterCoins.textContent = status.coins;
  el.boosterStartBlock.hidden = status.hasStarted;

  if (!boosterSetsLoaded) {
    await populateBoosterSetSelect();
    boosterSetsLoaded = true;
  }
  el.boosterSetSelect.dispatchEvent(new Event('change'));

  el.boosterStartBtn.onclick = async () => {
    el.boosterFormError.hidden = true;
    try {
      const { cards } = await api('/api/booster/start', { method: 'POST' });
      playBoosterOpening(cards, false);
      await loadBoostersSection();
    } catch (err) {
      el.boosterFormError.textContent = err.message;
      el.boosterFormError.hidden = false;
    }
  };

  el.boosterOpenBtn.onclick = async () => {
    el.boosterFormError.hidden = true;
    try {
      const { cards, completionBonusApplied, coinsRemaining, coinsSpent } = await api('/api/booster/open', {
        method: 'POST',
        body: JSON.stringify({ setId: el.boosterSetSelect.value })
      });
      el.boosterCoins.textContent = coinsRemaining;
      playBoosterOpening(cards, completionBonusApplied, coinsSpent);
    } catch (err) {
      el.boosterFormError.textContent = err.message;
      el.boosterFormError.hidden = false;
    }
  };
}

/* ---------- Animation d'ouverture de booster ---------- */

const boosterAnim = {
  skip: false,
  finalCards: [],
  finalCompletionBonusApplied: false
};

// Petite aide pour afficher/masquer un élément de façon fiable :
// on pose à la fois l'attribut `hidden` ET le style inline, pour ne
// jamais dépendre d'une seule règle CSS qui pourrait être en conflit.
function setVisible(element, visible, displayValue = 'flex') {
  element.hidden = !visible;
  element.style.display = visible ? displayValue : 'none';
}

// Sécurité : on force la fermeture de l'overlay au chargement du script,
// indépendamment de ce que dit le CSS (au cas où un ancien fichier serait
// encore en cache côté navigateur).
setVisible(el.boosterOpenOverlay, false);
setVisible(el.boosterStage, false);
setVisible(el.boosterReveal, false);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Lance la séquence complète : paquet fermé -> déchirure au clic -> reveal
// des cartes une par une (le "hit" rare/légendaire est révélé en dernier,
// pour le suspense), puis bouton "Continuer" qui affiche le récap habituel.
function playBoosterOpening(cards, completionBonusApplied, coinsSpent) {
  boosterAnim.finalCards = cards;
  boosterAnim.finalCompletionBonusApplied = completionBonusApplied;
  boosterAnim.finalCoinsSpent = coinsSpent;
  boosterAnim.skip = false;

  document.body.classList.add('no-scroll');
  setVisible(el.boosterOpenOverlay, true, 'flex');
  setVisible(el.boosterStage, true, 'flex');
  setVisible(el.boosterReveal, false);
  el.boosterRevealStack.innerHTML = '';
  el.boosterRevealCounter.textContent = '';
  el.boosterSkipBtn.hidden = true;
  el.boosterContinueBtn.hidden = true;
  el.boosterPack.classList.remove('is-tearing');
  el.boosterStageHint.textContent = "Touche le booster pour l'ouvrir";

  const revealOrder = [...cards].reverse();

  const onPackClick = async () => {
    el.boosterPack.removeEventListener('click', onPackClick);
    el.boosterStageHint.textContent = '';
    el.boosterPack.classList.add('is-tearing');

    await sleep(650);

    setVisible(el.boosterStage, false);
    setVisible(el.boosterReveal, true, 'flex');
    el.boosterSkipBtn.hidden = false;
    el.boosterSkipBtn.onclick = () => {
      boosterAnim.skip = true;
    };

    await revealBoosterCards(revealOrder);

    el.boosterSkipBtn.hidden = true;
    el.boosterContinueBtn.hidden = false;
  };

  el.boosterPack.addEventListener('click', onPackClick);
}

async function revealBoosterCards(revealOrder) {
  const total = revealOrder.length;

  for (let i = 0; i < total; i++) {
    const card = revealOrder[i];
    el.boosterRevealCounter.textContent = `Carte ${i + 1} / ${total}`;

    const cardEl = document.createElement('div');
    cardEl.className = 'reveal-card';
    cardEl.innerHTML = `
      <div class="reveal-card__inner">
        <div class="reveal-card__face reveal-card__face--back">
          <div class="reveal-card__back-logo">PokéDex</div>
        </div>
        <div class="reveal-card__face reveal-card__face--front" data-rarity="${card.rarity}">
          ${card.imageUrl ? `<img src="${card.imageUrl}" alt="${card.nameFr}" />` : '<div class="card-tile__image--none">🃏</div>'}
          <div class="reveal-card__name">${card.nameFr}</div>
          <div class="reveal-card__rarity">${card.officialRarity}</div>
        </div>
      </div>
    `;
    el.boosterRevealStack.innerHTML = '';
    el.boosterRevealStack.appendChild(cardEl);

    await sleep(boosterAnim.skip ? 0 : 100);
    cardEl.classList.add('is-in');
    await sleep(boosterAnim.skip ? 0 : 380);

    cardEl.classList.add('is-flipped');

    const frontFace = cardEl.querySelector('.reveal-card__face--front');
    if (card.rarity === 'Légendaire') {
      cardEl.classList.add('reveal-card--legendary');
      el.boosterOpenOverlay.classList.add('is-shaking');
      spawnSparkles(frontFace);
      setTimeout(() => el.boosterOpenOverlay.classList.remove('is-shaking'), 500);
    } else if (card.rarity === 'Rare') {
      cardEl.classList.add('reveal-card--glow');
    }

    await sleep(boosterAnim.skip ? 60 : 950);

    if (i < total - 1) {
      cardEl.classList.add('is-out');
      await sleep(boosterAnim.skip ? 0 : 320);
    }
  }
}

function spawnSparkles(container) {
  for (let i = 0; i < 14; i++) {
    const spark = document.createElement('span');
    spark.className = 'reveal-sparkle';
    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 70;
    spark.style.setProperty('--tx', `${(Math.cos(angle) * distance).toFixed(0)}px`);
    spark.style.setProperty('--ty', `${(Math.sin(angle) * distance).toFixed(0)}px`);
    spark.style.left = '50%';
    spark.style.top = '50%';
    spark.style.animationDelay = `${Math.random() * 0.15}s`;
    container.appendChild(spark);
    spark.addEventListener('animationend', () => spark.remove());
  }
}

el.boosterContinueBtn.onclick = () => {
  setVisible(el.boosterOpenOverlay, false);
  document.body.classList.remove('no-scroll');
  renderBoosterResult(boosterAnim.finalCards, boosterAnim.finalCompletionBonusApplied, boosterAnim.finalCoinsSpent);
};

let boosterSetPrices = {}; // setId -> price, rempli par populateBoosterSetSelect()

async function populateBoosterSetSelect() {
  const { series } = await api('/api/booster/sets');

  for (const { serieName, sets } of series) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = serieName;
    for (const s of sets) {
      boosterSetPrices[s.setId] = s.price;
      const opt = document.createElement('option');
      opt.value = s.setId;
      opt.textContent = `${s.setName} — ${s.price} coins`;
      optgroup.appendChild(opt);
    }
    el.boosterSetSelect.appendChild(optgroup);
  }

  el.boosterSetSelect.onchange = () => {
    const price = boosterSetPrices[el.boosterSetSelect.value];
    el.boosterCostHint.textContent = price
      ? `Coût : ${price} coins`
      : 'Coût : varie selon l\'extension tirée';
  };
}

function renderBoosterResult(cards, completionBonusApplied, coinsSpent) {
  el.boosterResultPanel.hidden = false;
  el.boosterResultCards.innerHTML = cards
    .map(
      (c) => `
        <div class="booster-result-card" data-rarity="${c.rarity}">
          ${c.imageUrl ? `<img src="${c.imageUrl}" alt="${c.nameFr}" />` : '<div class="card-tile__image--none">🃏</div>'}
          <div class="booster-result-card__name">${c.nameFr}</div>
          <div class="booster-result-card__rarity">${c.officialRarity}</div>
        </div>
      `
    )
    .join('');

  if (coinsSpent) {
    el.boosterResultCoinsSpent.hidden = false;
    el.boosterResultCoinsSpent.textContent = `Booster payé ${coinsSpent} coins.`;
  } else {
    el.boosterResultCoinsSpent.hidden = true;
  }

  el.boosterCompletionMessage.hidden = !completionBonusApplied;
  el.boosterResultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ===================== ÉCHANGES ===================== */

async function loadTradesSection() {
  if (!state.currentUser) {
    document.getElementById('section-trades').innerHTML = '<p class="screen__empty" style="padding:24px">Connecte-toi avec Discord pour gérer tes échanges.</p>';
    return;
  }

  el.tradeTargetSelect.innerHTML = '';
  for (const [id, username] of state.trainersById) {
    if (id === state.currentUser.id) continue;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = username;
    el.tradeTargetSelect.appendChild(opt);
  }

  const { duplicates } = await api('/api/trades/my-duplicates');
  el.tradeOfferedSelect.innerHTML = duplicates
    .map((c) => `<option value="${c.cardId}">${c.nameFr} (×${c.quantity})</option>`)
    .join('') || '<option value="">Aucun double disponible</option>';

  await refreshRequestedCardOptions('');
  el.tradeRequestedSearch.oninput = (e) => refreshRequestedCardOptions(e.target.value);

  el.tradeSubmitBtn.onclick = async () => {
    el.tradeFormError.hidden = true;
    try {
      await api('/api/trades', {
        method: 'POST',
        body: JSON.stringify({
          toUserId: el.tradeTargetSelect.value,
          offeredCardId: el.tradeOfferedSelect.value,
          requestedCardId: el.tradeRequestedSelect.value
        })
      });
      await loadTradesSection();
    } catch (err) {
      el.tradeFormError.textContent = err.message;
      el.tradeFormError.hidden = false;
    }
  };

  await renderTradeLists();
}

async function refreshRequestedCardOptions(search) {
  const { cards } = await api(`/api/cards?search=${encodeURIComponent(search)}`);
  el.tradeRequestedSelect.innerHTML = cards
    .map((c) => `<option value="${c._id}">${c.nameFr} (${c.setName}, ${c.officialRarity})</option>`)
    .join('');
}

async function renderTradeLists() {
  const [{ trades: incoming }, { trades: outgoing }] = await Promise.all([
    api('/api/trades/incoming'),
    api('/api/trades/outgoing')
  ]);

  el.tradesIncoming.innerHTML = incoming.length
    ? incoming.map((t) => `
      <div class="list-item">
        <img class="list-item__thumb" src="${t.offeredCardId.imageUrl}" alt="" />
        <div class="list-item__text"><strong>${trainerName(t.fromUserId)}</strong> te propose <strong>${t.offeredCardId.nameFr}</strong> contre ta carte <strong>${t.requestedCardId.nameFr}</strong></div>
        <div class="list-item__actions">
          <button class="btn-accept" data-action="accept" data-id="${t._id}">Accepter</button>
          <button class="btn-decline" data-action="decline" data-id="${t._id}">Refuser</button>
        </div>
      </div>
    `).join('')
    : '<p class="list__empty">Aucun échange reçu.</p>';

  el.tradesOutgoing.innerHTML = outgoing.length
    ? outgoing.map((t) => `
      <div class="list-item">
        <img class="list-item__thumb" src="${t.offeredCardId.imageUrl}" alt="" />
        <div class="list-item__text">Tu proposes <strong>${t.offeredCardId.nameFr}</strong> à <strong>${trainerName(t.toUserId)}</strong> contre <strong>${t.requestedCardId.nameFr}</strong></div>
        <div class="list-item__actions">
          <button class="btn-cancel" data-action="cancel" data-id="${t._id}">Annuler</button>
        </div>
      </div>
    `).join('')
    : '<p class="list__empty">Aucun échange envoyé.</p>';

  el.tradesIncoming.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => handleTradeAction(btn.dataset.action, btn.dataset.id));
  });
  el.tradesOutgoing.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => handleTradeAction(btn.dataset.action, btn.dataset.id));
  });
}

async function handleTradeAction(action, id) {
  try {
    await api(`/api/trades/${id}/${action}`, { method: 'POST' });
    await loadTradesSection();
  } catch (err) {
    alert(err.message);
  }
}

/* ===================== DECK ===================== */

async function loadDeckSection() {
  if (!state.currentUser) {
    document.getElementById('section-deck').innerHTML = '<p class="screen__empty" style="padding:24px">Connecte-toi avec Discord pour gérer ton deck.</p>';
    return;
  }

  const { deck } = await api('/api/deck');
  state.deckDraft = [0, 1, 2].map((i) => {
    const c = deck[i];
    if (!c) return null;
    // c vient d'un populate('deck') : c._id est l'ObjectId Mongo à utiliser,
    // PAS c.cardId (qui est le champ "cardId" du modèle Card = l'id TCGdex,
    // un tout autre identifiant qui portait malheureusement le même nom).
    return { cardId: c._id, nameFr: c.nameFr, localId: c.localId, rarity: c.rarity, imageUrl: c.imageUrl };
  });
  renderDeckSlots();

  el.deckSaveBtn.onclick = async () => {
    el.deckError.hidden = true;
    const cardIds = state.deckDraft.filter(Boolean).map((c) => c.cardId);
    try {
      await api('/api/deck', { method: 'POST', body: JSON.stringify({ cardIds }) });
      await loadDeckSection();
    } catch (err) {
      el.deckError.textContent = err.message;
      el.deckError.hidden = false;
    }
  };

  el.deckPickerClose.onclick = () => { el.deckPicker.hidden = true; };
}

function renderDeckSlots() {
  el.deckSlots.querySelectorAll('.deck-slot').forEach((slotEl, index) => {
    const card = state.deckDraft[index];
    if (card) {
      slotEl.classList.add('is-filled');
      slotEl.innerHTML = `<img src="${card.imageUrl}" alt="" /><span class="deck-slot__name">${card.nameFr}</span>`;
    } else {
      slotEl.classList.remove('is-filled');
      slotEl.innerHTML = '<span class="deck-slot__empty">+ Ajouter</span>';
    }
    slotEl.onclick = () => openDeckPicker(index);
  });
}

let deckPickerCards = [];

async function openDeckPicker(slotIndex) {
  state.activeDeckSlot = slotIndex;
  el.deckPicker.hidden = false;

  el.deckPickerSearch.value = '';
  el.deckPickerRarity.value = 'all';
  el.deckPickerHpMin.value = '';
  el.deckPickerHpMax.value = '';

  const { cards } = await api('/api/deck/owned-cards');
  deckPickerCards = cards;
  applyDeckPickerFilters();

  const rerender = () => applyDeckPickerFilters();
  el.deckPickerSearch.oninput = rerender;
  el.deckPickerRarity.onchange = rerender;
  el.deckPickerHpMin.oninput = rerender;
  el.deckPickerHpMax.oninput = rerender;
}

function applyDeckPickerFilters() {
  const term = el.deckPickerSearch.value.toLowerCase();
  const rarity = el.deckPickerRarity.value;
  const hpMin = el.deckPickerHpMin.value === '' ? null : Number(el.deckPickerHpMin.value);
  const hpMax = el.deckPickerHpMax.value === '' ? null : Number(el.deckPickerHpMax.value);

  const filtered = deckPickerCards.filter((c) => {
    if (!c.nameFr.toLowerCase().includes(term)) return false;
    if (rarity !== 'all' && c.rarity !== rarity) return false;
    // Les cartes Dresseur/Énergie n'ont pas de PV : on les exclut dès qu'un
    // filtre PV est actif (sinon "PV min: 50" resterait ambigu pour elles).
    if (hpMin !== null && !(c.hp >= hpMin)) return false;
    if (hpMax !== null && !(c.hp <= hpMax)) return false;
    return true;
  });

  renderDeckPickerList(filtered);
}

function renderDeckPickerList(filtered) {
  el.deckPickerList.innerHTML = filtered.map((c, i) => `
    <div class="card-tile" data-rarity="${c.rarity}" data-index="${i}">
      <button type="button" class="card-tile__zoom" data-index="${i}" aria-label="Zoomer sur ${c.nameFr}">🔍</button>
      <div class="card-tile__dex">№${c.localId}</div>
      <img class="card-tile__image" src="${c.imageUrl}" alt="${c.nameFr}" />
      <div class="card-tile__name">${c.nameFr}</div>
      ${c.hp ? `<div class="card-tile__hp">PV ${c.hp}</div>` : ''}
      ${c.quantity > 1 ? `<div class="card-tile__quantity">×${c.quantity}</div>` : ''}
    </div>
  `).join('') || '<p class="list__empty">Aucune carte trouvée.</p>';

  // Zoom : ouvre le détail sans toucher au deck (stopPropagation empêche le
  // clic de "remonter" jusqu'au gestionnaire de la tuile qui ajoute la carte).
  el.deckPickerList.querySelectorAll('.card-tile__zoom').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = filtered[Number(btn.dataset.index)];
      openCardDetail({ ...card, owned: true });
    });
  });

  el.deckPickerList.querySelectorAll('.card-tile').forEach((tile) => {
    tile.addEventListener('click', () => {
      const card = filtered[Number(tile.dataset.index)];
      state.deckDraft[state.activeDeckSlot] = card;
      renderDeckSlots();
      el.deckPicker.hidden = true;
    });
  });
}

/* ===================== COMBATS ===================== */

async function loadBattleSection() {
  if (!state.currentUser) {
    document.getElementById('section-battle').innerHTML = '<p class="screen__empty" style="padding:24px">Connecte-toi avec Discord pour combattre.</p>';
    return;
  }

  el.battleTargetSelect.innerHTML = '';
  for (const [id, username] of state.trainersById) {
    if (id === state.currentUser.id) continue;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = username;
    el.battleTargetSelect.appendChild(opt);
  }

  el.battleChallengeBtn.onclick = async () => {
    el.battleFormError.hidden = true;
    try {
      await api('/api/battle/challenge', {
        method: 'POST',
        body: JSON.stringify({ opponentUserId: el.battleTargetSelect.value })
      });
      await renderBattleLists();
    } catch (err) {
      el.battleFormError.textContent = err.message;
      el.battleFormError.hidden = false;
    }
  };

  await renderBattleLists();
}

async function renderBattleLists() {
  const [{ battles: incoming }, { battles: outgoing }, { battles: history }] = await Promise.all([
    api('/api/battle/incoming'),
    api('/api/battle/outgoing'),
    api('/api/battle/history')
  ]);

  el.battleIncoming.innerHTML = incoming.length
    ? incoming.map((b) => `
      <div class="list-item">
        <div class="list-item__text"><strong>${trainerName(b.challengerId)}</strong> te défie en combat !</div>
        <div class="list-item__actions">
          <button class="btn-accept" data-action="accept" data-id="${b._id}">Accepter</button>
          <button class="btn-decline" data-action="decline" data-id="${b._id}">Refuser</button>
        </div>
      </div>
    `).join('')
    : '<p class="list__empty">Aucun défi reçu.</p>';

  el.battleOutgoing.innerHTML = outgoing.length
    ? outgoing.map((b) => `<div class="list-item"><div class="list-item__text">Défi envoyé à <strong>${trainerName(b.opponentId)}</strong>, en attente de réponse...</div></div>`).join('')
    : '<p class="list__empty">Aucun défi envoyé.</p>';

  el.battleHistory.innerHTML = history.length
    ? history.map((b) => {
        const won = b.result.winnerId === state.currentUser.id;
        const opponentId = b.challengerId === state.currentUser.id ? b.opponentId : b.challengerId;
        return `<div class="list-item">
          <div class="list-item__text">
            ${won ? '🏆 Victoire' : '💀 Défaite'} contre <strong>${trainerName(opponentId)}</strong>
            (${b.result.challengerScore} vs ${b.result.opponentScore})
          </div>
        </div>`;
      }).join('')
    : '<p class="list__empty">Aucun combat pour l\'instant.</p>';

  [el.battleIncoming].forEach((container) => {
    container.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api(`/api/battle/${btn.dataset.id}/${btn.dataset.action}`, { method: 'POST' });
          await renderBattleLists();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  });
}

/* ===================== PROFIL ===================== */

// Formatte un temps restant en "Xh Ymin" pour le prochain claim quotidien.
function formatRemaining(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

async function loadProfileSection() {
  if (!state.currentUser) {
    document.getElementById('section-profile').innerHTML = '<p class="screen__empty" style="padding:24px">Connecte-toi avec Discord pour voir ton profil.</p>';
    return;
  }

  el.profileAvatar.src = state.currentUser.avatarUrl || '';
  el.profileUsername.textContent = state.currentUser.username;

  await Promise.all([refreshProfileSummary(), renderBoosterHistory(), renderQuests()]);

  el.dailyClaimBtn.onclick = async () => {
    el.dailyClaimError.hidden = true;
    el.dailyClaimBtn.disabled = true;
    try {
      const { coins } = await api('/api/profile/daily-claim', { method: 'POST' });
      el.profileCoins.textContent = coins;
      await refreshProfileSummary();
    } catch (err) {
      el.dailyClaimError.textContent = err.message;
      el.dailyClaimError.hidden = false;
      el.dailyClaimBtn.disabled = false;
    }
  };
}

async function refreshProfileSummary() {
  const profile = await api('/api/profile');

  el.profileCoins.textContent = profile.coins ?? 0;
  el.profileStatCaptures.textContent = profile.totalCaptures ?? 0;
  el.profileStatWins.textContent = profile.victoires ?? 0;
  el.profileStatLosses.textContent = profile.defaites ?? 0;
  el.profileStatWinrate.textContent = profile.winrate == null ? '—' : `${profile.winrate}%`;

  el.dailyClaimAmount.textContent = profile.dailyCoinsAmount ?? 50;

  if (profile.canClaimDaily) {
    el.dailyClaimBtn.disabled = false;
    el.dailyClaimHint.textContent = 'Ton bonus du jour est disponible !';
  } else if (profile.nextClaimInMs) {
    el.dailyClaimBtn.disabled = true;
    el.dailyClaimHint.textContent = `Prochain bonus dans ${formatRemaining(profile.nextClaimInMs)}.`;
  } else {
    el.dailyClaimBtn.disabled = true;
    el.dailyClaimHint.textContent = "Impossible de récupérer ton statut pour l'instant.";
  }
}

async function renderBoosterHistory() {
  const data = await api('/api/profile/booster-history');
  const history = Array.isArray(data.history) ? data.history : [];

  el.boosterHistoryList.innerHTML = history.length
    ? history.map((opening) => {
        const date = new Date(opening.openedAt).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        const thumbs = opening.cards
          .map((c) => (c.imageUrl ? `<img src="${c.imageUrl}" alt="${c.nameFr}" title="${c.nameFr}" />` : ''))
          .join('');
        return `
          <div class="list-item">
            <div class="booster-history-item__thumbs">${thumbs}</div>
            <div class="booster-history-item__meta">
              <span class="list-item__text">${opening.isStarter ? 'Booster de départ' : `Booster ${opening.setId || ''}`}</span>
              <span class="booster-history-item__date">${date}</span>
            </div>
          </div>
        `;
      }).join('')
    : '<p class="list__empty">Aucun booster ouvert pour l\'instant.</p>';
}

async function renderQuests() {
  const data = await api('/api/quests');
  const quests = Array.isArray(data.quests) ? data.quests : [];

  el.questsList.innerHTML = quests
    .map((q) => {
      const pct = Math.round((q.progress / q.target) * 100);
      let buttonHtml;
      if (q.claimed) {
        buttonHtml = `<button class="btn-secondary quest-item__claim-btn" disabled>Réclamée ✓</button>`;
      } else if (q.completed) {
        buttonHtml = `<button class="btn-primary quest-item__claim-btn" data-quest-id="${q.id}">Réclamer</button>`;
      } else {
        buttonHtml = `<button class="btn-secondary quest-item__claim-btn" disabled>En cours</button>`;
      }

      return `
        <div class="quest-item ${q.claimed ? 'is-claimed' : ''}">
          <div class="quest-item__top">
            <span class="quest-item__label">${q.label}</span>
            <span class="quest-item__reward">+${q.reward} coins</span>
          </div>
          <div class="quest-item__bar"><div class="quest-item__bar-fill" style="width:${pct}%"></div></div>
          <div class="quest-item__bottom">
            <span class="quest-item__progress-text">${q.progress} / ${q.target}</span>
            ${buttonHtml}
          </div>
        </div>
      `;
    })
    .join('');

  el.questsList.querySelectorAll('button[data-quest-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const { coins } = await api(`/api/quests/${btn.dataset.questId}/claim`, { method: 'POST' });
        el.profileCoins.textContent = coins;
        await renderQuests();
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
      }
    });
  });
}

init();
