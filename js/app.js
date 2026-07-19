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
  boosterCompletionMessage: document.getElementById('boosterCompletionMessage')
};

const API_BASE = 'https://cardscapture.onrender.com';

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // envoie le cookie de session Discord au backend
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
    logoutBtn.href = `${API_BASE}/auth/logout`;
    logoutBtn.className = 'btn-logout';
    logoutBtn.textContent = 'Déconnexion';
    el.authArea.appendChild(wrap);
    el.authArea.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement('a');
    loginBtn.href = `${API_BASE}/auth/login`;
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

    body.innerHTML = `
      <div class="card-detail__dex">№${card.localId}</div>
      <img class="card-detail__image" src="${card.imageUrl}" alt="${card.nameFr}" />
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
  el.boosterCostHint.textContent = `Coût : ${status.boosterCost} coins`;

  if (!boosterSetsLoaded) {
    await populateBoosterSetSelect();
    boosterSetsLoaded = true;
  }

  el.boosterStartBtn.onclick = async () => {
    el.boosterFormError.hidden = true;
    try {
      const { cards } = await api('/api/booster/start', { method: 'POST' });
      renderBoosterResult(cards, false);
      await loadBoostersSection();
    } catch (err) {
      el.boosterFormError.textContent = err.message;
      el.boosterFormError.hidden = false;
    }
  };

  el.boosterOpenBtn.onclick = async () => {
    el.boosterFormError.hidden = true;
    try {
      const { cards, completionBonusApplied, coinsRemaining } = await api('/api/booster/open', {
        method: 'POST',
        body: JSON.stringify({ setId: el.boosterSetSelect.value })
      });
      renderBoosterResult(cards, completionBonusApplied);
      el.boosterCoins.textContent = coinsRemaining;
    } catch (err) {
      el.boosterFormError.textContent = err.message;
      el.boosterFormError.hidden = false;
    }
  };
}

async function populateBoosterSetSelect() {
  const { series } = await api('/api/booster/sets');

  for (const { serieName, sets } of series) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = serieName;
    for (const s of sets) {
      const opt = document.createElement('option');
      opt.value = s.setId;
      opt.textContent = s.setName;
      optgroup.appendChild(opt);
    }
    el.boosterSetSelect.appendChild(optgroup);
  }
}

function renderBoosterResult(cards, completionBonusApplied) {
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
  state.deckDraft = [deck[0] || null, deck[1] || null, deck[2] || null];
  renderDeckSlots();

  el.deckSaveBtn.onclick = async () => {
    el.deckError.hidden = true;
    const cardIds = state.deckDraft.filter(Boolean).map((c) => c.cardId || c._id || c);
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

async function openDeckPicker(slotIndex) {
  state.activeDeckSlot = slotIndex;
  el.deckPicker.hidden = false;
  const { cards } = await api('/api/deck/owned-cards');
  renderDeckPickerList(cards, '');
  el.deckPickerSearch.value = '';
  el.deckPickerSearch.oninput = (e) => {
    const term = e.target.value.toLowerCase();
    renderDeckPickerList(cards, term);
  };
}

function renderDeckPickerList(cards, term) {
  const filtered = cards.filter((c) => c.nameFr.toLowerCase().includes(term));
  el.deckPickerList.innerHTML = filtered.map((c) => `
    <div class="card-tile" data-rarity="${c.rarity}" data-card='${JSON.stringify(c)}'>
      <div class="card-tile__dex">№${c.localId}</div>
      <img class="card-tile__image" src="${c.imageUrl}" alt="${c.nameFr}" />
      <div class="card-tile__name">${c.nameFr}</div>
      ${c.quantity > 1 ? `<div class="card-tile__quantity">×${c.quantity}</div>` : ''}
    </div>
  `).join('') || '<p class="list__empty">Aucune carte trouvée.</p>';

  el.deckPickerList.querySelectorAll('.card-tile').forEach((tile) => {
    tile.addEventListener('click', () => {
      const card = JSON.parse(tile.dataset.card);
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

init();
