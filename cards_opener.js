// cards_opener.js — Модуль быстрого автооткрытия карточек и бустеров на AnimeOn
(function() {
  'use strict';

  // Редкости карточек
  const TIER_NAMES = {
    1: 'Обычная',
    2: 'Необычная',
    3: 'Редкая',
    4: 'Эпическая',
    5: 'Легендарная',
    6: 'Мифическая',
    7: 'Призрачная',
    8: 'Абсолютная',
    9: 'Реликвия'
  };

  const TIER_COLORS = {
    1: '#a39a96',
    2: '#e9dcc6',
    3: '#6fd99a',
    4: '#6aa8ff',
    5: '#c79bff',
    6: '#f2b24a',
    7: '#cfe6ff',
    8: '#e6e1ff',
    9: '#ff4d6d'
  };

  const KNOWN_PACK_NAMES = {
    'daily': 'Бустер дня (Бесплатный)',
    'premium_weekly': 'Бустер недели',
    'halloween': 'Хэллоуин: Ночь масок',
    'event': 'Ночь масок',
    'season': 'Сезон I',
    'season-1': 'Сезон I',
    'premium': 'Премиум бустер',
    'universe-magicheskaya-bitva': 'Магическая битва',
    'universe-klinok': 'Клинок рассекающий демонов'
  };

  function genRequestId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // --- Web Audio API для звуков дропа ---
  let audioCtx = null;
  function playCardDropSound(tier = 1) {
    if (!state.settings.soundEnabled) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      // Частота зависит от тира
      const freqs = {
        1: [440, 554],
        2: [523, 659],
        3: [587, 740],
        4: [659, 830, 988],
        5: [784, 988, 1175], // Легендарная
        6: [880, 1109, 1318, 1760], // Мифическая
        7: [988, 1244, 1480, 1975],
        8: [1046, 1318, 1568, 2093],
        9: [1175, 1480, 1760, 2349] // Реликвия
      };

      const chord = freqs[tier] || [523, 659];
      osc.type = tier >= 5 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(chord[0], now);

      for (let i = 1; i < chord.length; i++) {
        osc.frequency.setValueAtTime(chord[i], now + i * 0.08);
      }

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (tier >= 5 ? 0.7 : 0.35));

      osc.start(now);
      osc.stop(now + (tier >= 5 ? 0.75 : 0.4));
    } catch (e) {}
  }

  // --- Состояние Автооткрывателя ---
  const state = {
    me: null,
    daily: null,
    catalog: null,
    isOpening: false,
    shouldStop: false,
    storedPacks: [],
    recentCards: [],
    stats: {
      openedPacks: 0,
      totalCards: 0,
      rares: 0,
      legendaries: 0,
      mythics: 0,
      relics: 0,
      newCards: 0
    },
    settings: {
      delayMs: 250,
      soundEnabled: true,
      autoSkipSiteAnim: true,
      autoClaimDaily: true
    }
  };

  // --- API Запросы AnimeOn ---
  async function apiGetMe() {
    try {
      const res = await fetch('/api/cards/me', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function apiGetDaily() {
    try {
      const res = await fetch('/api/cards/daily', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function apiGetCatalog() {
    try {
      const res = await fetch('/api/cards/catalog', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function apiClaimBooster(kind = 'daily') {
    try {
      const res = await fetch('/api/cards/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ kind: kind, request_id: genRequestId() })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.error || String(res.status) };
      }
      return { success: true, data: await res.json() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async function apiOpenPack(packId, count = 1, isStored = true) {
    try {
      const body = {
        pack_id: packId,
        count: count,
        request_id: genRequestId()
      };
      if (isStored) {
        body.source = 'stored';
      }

      const res = await fetch('/api/cards/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.error || err.code || String(res.status) };
      }
      return { success: true, data: await res.json() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // --- Автопропуск анимации сайта (Site Animation Auto-Skip) ---
  function setupSiteAnimationSkipper() {
    const observer = new MutationObserver(() => {
      if (!state.settings.autoSkipSiteAnim) return;

      // Ищем кнопку "Пропустить" / "Открыть всё" / "Далее" в нативных модалках вскрытия
      const buttons = document.querySelectorAll('button, [role="button"]');
      for (const btn of buttons) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        if (txt === 'пропустить' || txt === 'пропустить всё' || txt === 'открыть всё' || txt === 'skip') {
          if (!btn.disabled && btn.offsetParent !== null) {
            btn.click();
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // --- Инициализация и создание UI виджета ---
  function createCardsWidget() {
    if (document.getElementById('aon-cards-widget')) return;

    // Плавающая кнопка вызова
    const triggerBtn = document.createElement('div');
    triggerBtn.id = 'aon-cards-trigger-btn';
    triggerBtn.innerHTML = `
      <span>🎴 Быстрое открытие</span>
      <span class="aon-cards-badge-pill" id="aon-cards-total-packs-pill">0 паков</span>
    `;
    triggerBtn.onclick = () => {
      const w = document.getElementById('aon-cards-widget');
      if (w) {
        w.classList.toggle('hidden');
        if (!w.classList.contains('hidden')) {
          refreshCardsData();
        }
      }
    };
    document.body.appendChild(triggerBtn);

    // Основное окно виджета
    const widget = document.createElement('div');
    widget.id = 'aon-cards-widget';
    // На странице /cards открыто по умолчанию, на остальных скрыто до клика
    const isCardsPage = window.location.pathname.startsWith('/cards');
    if (!isCardsPage) {
      widget.classList.add('hidden');
    }

    widget.innerHTML = `
      <div class="aon-cards-header" id="aon-cards-drag-header">
        <div class="aon-cards-title-wrap">
          <span class="aon-cards-title-icon">🎴</span>
          <span class="aon-cards-title">
            Автооткрытие карт
            <span class="aon-cards-tag">⚡ Fast Mode</span>
          </span>
        </div>
        <div class="aon-cards-header-actions">
          <button class="aon-cards-btn-icon" id="aon-cards-refresh-btn" title="Обновить данные">⟳</button>
          <button class="aon-cards-btn-icon" id="aon-cards-min-btn" title="Свернуть">_</button>
          <button class="aon-cards-btn-icon" id="aon-cards-close-btn" title="Закрыть">✕</button>
        </div>
      </div>

      <div class="aon-cards-balances">
        <div class="aon-cards-bal-card">
          <span class="aon-cards-bal-label">🪙 Animon</span>
          <span class="aon-cards-bal-val animon" id="aon-cards-val-animon">...</span>
        </div>
        <div class="aon-cards-bal-card">
          <span class="aon-cards-bal-label">💎 Dust</span>
          <span class="aon-cards-bal-val dust" id="aon-cards-val-dust">...</span>
        </div>
        <div class="aon-cards-bal-card">
          <span class="aon-cards-bal-label">📦 Паков</span>
          <span class="aon-cards-bal-val cards" id="aon-cards-val-packs">0</span>
        </div>
      </div>

      <div class="aon-cards-body">
        <!-- Блок ежедневного бесплатного бустера -->
        <div class="aon-cards-daily-box" id="aon-cards-daily-box">
          <div class="aon-cards-daily-info">
            <span class="aon-cards-daily-title">🎁 Бустер дня</span>
            <span class="aon-cards-daily-desc" id="aon-cards-daily-desc">Проверка доступности...</span>
          </div>
          <button class="aon-cards-daily-btn" id="aon-cards-daily-btn">Забрать бустер</button>
        </div>

        <!-- Инвентарь сохраненных паков -->
        <div class="aon-cards-section-title">
          <span>Сохраненные паки (Инвентарь)</span>
          <span id="aon-cards-inv-summary">0 шт.</span>
        </div>
        <div class="aon-cards-inv-list" id="aon-cards-inv-list">
          <div class="aon-cards-empty">Загрузка инвентаря паков...</div>
        </div>

        <!-- Главные действия -->
        <div class="aon-cards-main-action">
          <button class="aon-cards-btn-open-all" id="aon-cards-btn-open-all">
            <span>⚡ Открыть ВСЕ сохраненные паки</span>
          </button>
          <button class="aon-cards-btn-stop" id="aon-cards-btn-stop">■ Стоп</button>
        </div>

        <!-- Прогресс открытия -->
        <div class="aon-cards-progress-wrap" id="aon-cards-progress-wrap">
          <div class="aon-cards-progress-bar">
            <div class="aon-cards-progress-fill" id="aon-cards-progress-fill"></div>
          </div>
          <div class="aon-cards-progress-text">
            <span id="aon-cards-progress-label">Открытие паков...</span>
            <span id="aon-cards-progress-count">0 / 0</span>
          </div>
        </div>

        <!-- Опции -->
        <div class="aon-cards-options">
          <label class="aon-cards-opt-item">
            <input type="checkbox" id="aon-cards-opt-anim" checked>
            <span>Автопропуск анимаций сайта</span>
          </label>
          <label class="aon-cards-opt-item">
            <input type="checkbox" id="aon-cards-opt-sound" checked>
            <span>Звук карт</span>
          </label>
          <div class="aon-cards-opt-item">
            <span>Скорость:</span>
            <select class="aon-cards-speed-select" id="aon-cards-speed-select">
              <option value="120">⚡ Турбо (120 мс)</option>
              <option value="250" selected>🚀 Быстро (250 мс)</option>
              <option value="600">⏱ Обычная (600 мс)</option>
            </select>
          </div>
        </div>

        <!-- Сводка статистики -->
        <div class="aon-cards-section-title">
          <span>Выпавшие карточки</span>
          <span id="aon-cards-stats-summary">0 карт (0 редких)</span>
        </div>

        <!-- Сетка выпавших карточек (Live Feed) -->
        <div class="aon-cards-drop-feed">
          <div class="aon-cards-feed-grid" id="aon-cards-feed-grid">
            <div class="aon-cards-empty" id="aon-cards-feed-empty">Здесь появятся открытые карты</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    // События кнопок
    setupWidgetEvents(widget, triggerBtn);
  }

  function setupWidgetEvents(widget, triggerBtn) {
    const minBtn = document.getElementById('aon-cards-min-btn');
    const closeBtn = document.getElementById('aon-cards-close-btn');
    const refreshBtn = document.getElementById('aon-cards-refresh-btn');
    const dailyBtn = document.getElementById('aon-cards-daily-btn');
    const openAllBtn = document.getElementById('aon-cards-btn-open-all');
    const stopBtn = document.getElementById('aon-cards-btn-stop');

    const optAnim = document.getElementById('aon-cards-opt-anim');
    const optSound = document.getElementById('aon-cards-opt-sound');
    const speedSelect = document.getElementById('aon-cards-speed-select');

    if (minBtn) {
      minBtn.onclick = () => widget.classList.toggle('minimized');
    }
    if (closeBtn) {
      closeBtn.onclick = () => {
        widget.classList.add('hidden');
        if (triggerBtn) triggerBtn.classList.remove('hidden');
      };
    }
    if (refreshBtn) {
      refreshBtn.onclick = () => refreshCardsData();
    }

    if (optAnim) {
      optAnim.onchange = (e) => state.settings.autoSkipSiteAnim = e.target.checked;
    }
    if (optSound) {
      optSound.onchange = (e) => state.settings.soundEnabled = e.target.checked;
    }
    if (speedSelect) {
      speedSelect.onchange = (e) => state.settings.delayMs = Number(e.target.value) || 250;
    }

    // Забрать ежедневный бустер
    if (dailyBtn) {
      dailyBtn.onclick = async () => {
        dailyBtn.disabled = true;
        dailyBtn.textContent = 'Получение...';
        const res = await apiClaimBooster('daily');
        if (res.success) {
          showNotification('🎁 Бустер дня успешно получен!');
          playCardDropSound(4);
          await refreshCardsData();
        } else {
          showNotification(`⚠️ ${res.error || 'Ошибка получения бустера'}`);
          dailyBtn.disabled = false;
          dailyBtn.textContent = 'Попробовать снова';
        }
      };
    }

    // Открыть ВСЕ сохраненные паки
    if (openAllBtn) {
      openAllBtn.onclick = () => startOpenAllStoredPacks();
    }

    // Остановить
    if (stopBtn) {
      stopBtn.onclick = () => {
        state.shouldStop = true;
        stopBtn.textContent = 'Остановка...';
      };
    }

    // Перетаскивание шапки виджета
    const dragHeader = document.getElementById('aon-cards-drag-header');
    if (dragHeader) {
      let isDragging = false;
      let startX, startY, initLeft, initTop;

      dragHeader.onmousedown = (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = widget.getBoundingClientRect();
        initLeft = rect.left;
        initTop = rect.top;
        widget.style.right = 'auto';
        widget.style.bottom = 'auto';
        widget.style.left = `${initLeft}px`;
        widget.style.top = `${initTop}px`;
      };

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        widget.style.left = `${Math.max(10, Math.min(window.innerWidth - widget.offsetWidth - 10, initLeft + dx))}px`;
        widget.style.top = `${Math.max(10, Math.min(window.innerHeight - widget.offsetHeight - 10, initTop + dy))}px`;
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
      });
    }
  }

  // --- Обновление данных карточек ---
  async function refreshCardsData() {
    const refreshBtn = document.getElementById('aon-cards-refresh-btn');
    if (refreshBtn) refreshBtn.style.transform = 'rotate(180deg)';

    const [meData, dailyData, catalogData] = await Promise.all([
      apiGetMe(),
      apiGetDaily(),
      apiGetCatalog()
    ]);

    state.me = meData;
    state.daily = dailyData;
    state.catalog = catalogData;

    renderBalances();
    renderDailyStatus();
    renderInventory();

    if (refreshBtn) {
      setTimeout(() => { refreshBtn.style.transform = 'none'; }, 300);
    }
  }

  function renderBalances() {
    const valAnimon = document.getElementById('aon-cards-val-animon');
    const valDust = document.getElementById('aon-cards-val-dust');
    const valPacks = document.getElementById('aon-cards-val-packs');
    const triggerPill = document.getElementById('aon-cards-total-packs-pill');

    const bal = state.me?.balance ?? 0;
    const dust = state.me?.dust ?? 0;

    let totalPacks = 0;
    const inv = state.me?.inventory || [];
    for (const item of inv) {
      if (item && item.count > 0) totalPacks += item.count;
    }

    if (valAnimon) valAnimon.textContent = bal.toLocaleString('ru-RU');
    if (valDust) valDust.textContent = dust.toLocaleString('ru-RU');
    if (valPacks) valPacks.textContent = totalPacks;
    if (triggerPill) triggerPill.textContent = `${totalPacks} паков`;
  }

  function renderDailyStatus() {
    const dailyBtn = document.getElementById('aon-cards-daily-btn');
    const dailyDesc = document.getElementById('aon-cards-daily-desc');
    const daily = state.daily;

    if (!daily || !daily.enabled) {
      if (dailyDesc) dailyDesc.textContent = 'Недоступен';
      if (dailyBtn) {
        dailyBtn.disabled = true;
        dailyBtn.textContent = 'Недоступен';
      }
      return;
    }

    if (daily.available) {
      if (dailyDesc) dailyDesc.textContent = 'Доступен бесплатный бустер дня!';
      if (dailyBtn) {
        dailyBtn.disabled = false;
        dailyBtn.textContent = '🎁 Забрать бустер';
      }
    } else if (daily.claimed) {
      if (dailyDesc) dailyDesc.textContent = 'Бустер дня уже забран сегодня';
      if (dailyBtn) {
        dailyBtn.disabled = true;
        dailyBtn.textContent = 'Забран';
      }
    } else {
      if (dailyDesc) dailyDesc.textContent = 'Бустер пока недоступен';
      if (dailyBtn) {
        dailyBtn.disabled = true;
        dailyBtn.textContent = 'Ожидание';
      }
    }
  }

  function getPackTitle(packId) {
    if (KNOWN_PACK_NAMES[packId]) return KNOWN_PACK_NAMES[packId];
    if (state.catalog?.packs) {
      const p = state.catalog.packs.find(x => x.id === packId);
      if (p && p.name) return p.name;
    }
    return `Пак: ${packId}`;
  }

  function renderInventory() {
    const listEl = document.getElementById('aon-cards-inv-list');
    const summaryEl = document.getElementById('aon-cards-inv-summary');
    const openAllBtn = document.getElementById('aon-cards-btn-open-all');

    const inv = state.me?.inventory || [];
    const validItems = inv.filter(x => x && x.count > 0);
    state.storedPacks = validItems;

    let total = 0;
    validItems.forEach(x => total += x.count);
    if (summaryEl) summaryEl.textContent = `${total} шт.`;

    if (openAllBtn) {
      openAllBtn.disabled = total === 0 || state.isOpening;
      openAllBtn.innerHTML = `<span>⚡ Открыть ВСЕ сохраненные паки (${total} шт.)</span>`;
    }

    if (!listEl) return;

    if (validItems.length === 0) {
      listEl.innerHTML = `<div class="aon-cards-empty">Нет сохраненных паков в инвентаре.<br><span style="opacity:0.7">Забирайте ежедневные бустеры или покупайте паки!</span></div>`;
      return;
    }

    listEl.innerHTML = validItems.map(item => {
      const pid = item.pack_id || item.id || item.packId;
      const title = getPackTitle(pid);
      return `
        <div class="aon-cards-inv-item">
          <div class="aon-cards-inv-meta">
            <span class="aon-cards-inv-name">📦 ${title}</span>
            <span class="aon-cards-inv-count">${item.count} шт.</span>
          </div>
          <div class="aon-cards-inv-actions">
            <button class="aon-cards-btn-small" onclick="window.AnimeOnCards.openSingle('${pid}', 1)">1 шт.</button>
            ${item.count >= 5 ? `<button class="aon-cards-btn-small" onclick="window.AnimeOnCards.openSingle('${pid}', 5)">5 шт.</button>` : ''}
            <button class="aon-cards-btn-small" onclick="window.AnimeOnCards.openSingle('${pid}', ${item.count})">Все</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- Автоматическое открытие паков ---
  async function startOpenAllStoredPacks() {
    if (state.isOpening) return;
    state.isOpening = true;
    state.shouldStop = false;

    toggleOpeningUi(true);

    let totalPacksToOpen = 0;
    state.storedPacks.forEach(x => totalPacksToOpen += x.count);
    let openedCount = 0;

    for (const item of [...state.storedPacks]) {
      if (state.shouldStop) break;

      const pid = item.pack_id || item.id || item.packId;
      let remaining = item.count;

      while (remaining > 0 && !state.shouldStop) {
        const batch = Math.min(1, remaining); // Открываем по 1 для плавности и стабильности
        updateProgress(openedCount, totalPacksToOpen, `Открытие: ${getPackTitle(pid)}...`);

        const res = await apiOpenPack(pid, batch, true);
        if (res.success) {
          openedCount += batch;
          remaining -= batch;
          handlePackDrop(res.data);
          updateProgress(openedCount, totalPacksToOpen, `Открыто: ${openedCount} / ${totalPacksToOpen}`);
        } else {
          showNotification(`⚠️ Ошибка открытия ${pid}: ${res.error}`);
          if (res.error === 'too_many_requests') {
            await sleep(5000);
          } else {
            break;
          }
        }

        await sleep(state.settings.delayMs);
      }
    }

    state.isOpening = false;
    toggleOpeningUi(false);
    await refreshCardsData();
    showNotification(`🏁 Открытие завершено! Открыто паков: ${openedCount}`);
  }

  async function openSpecificPack(packId, countToOpen) {
    if (state.isOpening) return;
    state.isOpening = true;
    state.shouldStop = false;

    toggleOpeningUi(true);

    let remaining = countToOpen;
    let opened = 0;

    while (remaining > 0 && !state.shouldStop) {
      updateProgress(opened, countToOpen, `Открытие: ${getPackTitle(packId)}...`);
      const res = await apiOpenPack(packId, 1, true);
      if (res.success) {
        opened++;
        remaining--;
        handlePackDrop(res.data);
        updateProgress(opened, countToOpen, `Открыто: ${opened} / ${countToOpen}`);
      } else {
        showNotification(`⚠️ Ошибка: ${res.error}`);
        break;
      }
      await sleep(state.settings.delayMs);
    }

    state.isOpening = false;
    toggleOpeningUi(false);
    await refreshCardsData();
  }

  function handlePackDrop(data) {
    if (!data) return;

    if (typeof data.balance === 'number' && state.me) state.me.balance = data.balance;
    if (typeof data.dust === 'number' && state.me) state.me.dust = data.dust;
    renderBalances();

    state.stats.openedPacks++;

    const packs = data.packs || [];
    for (const p of packs) {
      const cards = p.cards || [];
      for (const card of cards) {
        state.stats.totalCards++;
        const tier = Number(card.tier) || 1;

        if (tier >= 3) state.stats.rares++;
        if (tier === 5) state.stats.legendaries++;
        if (tier === 6) state.stats.mythics++;
        if (tier >= 7) state.stats.relics++;
        if (card.is_new) state.stats.newCards++;

        // Проигрываем звук дропа
        playCardDropSound(tier);

        // Добавляем карту в сетку выпавших
        appendCardToFeed(card);
      }
    }

    updateStatsSummary();
  }

  function appendCardToFeed(card) {
    const grid = document.getElementById('aon-cards-feed-grid');
    const emptyMsg = document.getElementById('aon-cards-feed-empty');
    if (emptyMsg) emptyMsg.remove();

    if (!grid) return;

    const tier = Number(card.tier) || 1;
    const tierName = TIER_NAMES[tier] || `Tier ${tier}`;
    const name = card.name || card.title || 'Карточка';
    const imgUrl = card.image || card.cover || card.preview || '';

    const cardEl = document.createElement('div');
    cardEl.className = `aon-cards-card-item tier-${tier}`;
    cardEl.title = `${name} (${tierName})`;

    cardEl.innerHTML = `
      ${card.is_new ? '<span class="aon-cards-new-badge">NEW</span>' : ''}
      <img src="${imgUrl}" class="aon-cards-card-thumb" onerror="this.src='/cards/packs/daily-v4.webp'" alt="${name}">
      <span class="aon-cards-card-name">${name}</span>
      <span class="aon-cards-card-tier tier-${tier}">${tierName}</span>
    `;

    grid.prepend(cardEl);

    // Ограничиваем количество видимых карточек в сетке до 60
    while (grid.children.length > 60) {
      grid.lastElementChild.remove();
    }
  }

  function updateStatsSummary() {
    const summary = document.getElementById('aon-cards-stats-summary');
    if (summary) {
      summary.textContent = `${state.stats.totalCards} карт (${state.stats.rares} редких, ${state.stats.legendaries + state.stats.mythics + state.stats.relics} топ)`;
    }
  }

  function toggleOpeningUi(opening) {
    const openAllBtn = document.getElementById('aon-cards-btn-open-all');
    const stopBtn = document.getElementById('aon-cards-btn-stop');
    const progWrap = document.getElementById('aon-cards-progress-wrap');

    if (openAllBtn) openAllBtn.style.display = opening ? 'none' : 'flex';
    if (stopBtn) {
      stopBtn.style.display = opening ? 'block' : 'none';
      stopBtn.textContent = '■ Остановить';
    }
    if (progWrap) progWrap.style.display = opening ? 'flex' : 'none';
  }

  function updateProgress(current, total, label) {
    const fill = document.getElementById('aon-cards-progress-fill');
    const labelEl = document.getElementById('aon-cards-progress-label');
    const countEl = document.getElementById('aon-cards-progress-count');

    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    if (fill) fill.style.width = `${pct}%`;
    if (labelEl && label) labelEl.textContent = label;
    if (countEl) countEl.textContent = `${current} / ${total}`;
  }

  function showNotification(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 16, 22, 0.95);
      border: 1px solid #a855f7;
      color: #fff;
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      z-index: 10000000;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(168, 85, 247, 0.4);
      animation: fadeInOut 3s forwards;
      pointer-events: none;
      user-select: none;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // Экспорт в глобальное пространство
  window.AnimeOnCards = {
    init: () => {
      createCardsWidget();
      refreshCardsData();
      setupSiteAnimationSkipper();
    },
    openAll: startOpenAllStoredPacks,
    openSingle: openSpecificPack,
    claimDaily: apiClaimBooster,
    refresh: refreshCardsData,
    toggleWidget: () => {
      const w = document.getElementById('aon-cards-widget');
      if (w) w.classList.toggle('hidden');
    }
  };

  // Автостарт при готовности страницы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.AnimeOnCards.init);
  } else {
    window.AnimeOnCards.init();
  }
})();
