// content.js — Клиентский автосборщик и виджет для AnimeOn

(function () {
  'use strict';

  if (window.__AON_PUMPKIN_HUNTER_LOADED__) return;
  window.__AON_PUMPKIN_HUNTER_LOADED__ = true;

  // Конфигурация по умолчанию
  let settings = {
    alwaysCollect: true,      // Всегда собирать тыквы непрерывно
    autoCollectOnPage: true,  // Автоклик при просмотре страницы
    hourlyAutoScan: true,     // Автосбор каждый час
    soundEnabled: true,       // Звук
    showHud: true,            // Виджет на сайте
    scanLimit: 100,           // Лимит страниц за быстрый проход
    requestDelayMs: 180,      // Задержка между проверками
    stats: {
      totalCollected: 0,
      balance: 0,
      caughtThisHour: 0,
      hourlyCap: null,
      caughtToday: 0,
      dailyCap: 60,
      lastHourKey: null,
      lastDayKey: null
    },
    currentHourPumpkins: [],  // Найденные тыквы текущего часа
    history: []
  };

  // Состояние умного сканирования текущего часа
  let hourScanState = {
    hourKey: new Date().toISOString().slice(0, 13),
    consecutiveZeroScans: 0,  // Количество проверок подряд с 0 найденных тыкв
    deepScanDone: false,      // Выполнялся ли глубокий сбор в этом часе
    hourCompleted: false      // Все тыквы часа собраны, отдых до смены часа!
  };

  let isScanning = false;
  let shouldStopScan = false;
  let hudExpanded = false;
  let processedPumpkins = new Set();
  let audioCtx = null;

  // Инициализация хранилища
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(null, (data) => {
      if (data) {
        settings = { ...settings, ...data };
        if (data.hourScanState && data.hourScanState.hourKey === hourScanState.hourKey) {
          hourScanState = { ...hourScanState, ...data.hourScanState };
        }
        updateHudStats();
        renderCurrentHourLocations();
        checkAndStartAutoHarvest();
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        for (let key in changes) {
          settings[key] = changes[key].newValue;
        }
        if (changes.hourScanState?.newValue) {
          hourScanState = changes.hourScanState.newValue;
        }
        updateHudStats();
        renderCurrentHourLocations();
      }
    });
  }

  function saveHourScanState() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ hourScanState });
    }
  }

  // --- Форматирование читаемого названия из пути ---
  function getCleanTitle(path) {
    if (typeof formatTitleFromPath === 'function') {
      return formatTitleFromPath(path);
    }
    if (!path || path === '/') return 'Главная страница';
    if (path === '/catalog') return 'Каталог аниме';
    if (path === '/schedule') return 'Расписание';
    if (path === '/leaderboard') return 'Таблица лидеров';
    if (path === '/news') return 'Новости';
    if (path === '/together') return 'Совместный просмотр';
    if (path.startsWith('/catalog/genre/')) {
      const g = path.replace('/catalog/genre/', '').replace(/\/$/, '');
      return `Жанр: ${g.charAt(0).toUpperCase() + g.slice(1)}`;
    }
    if (path.startsWith('/anime/')) {
      return path.replace('/anime/', '').replace(/-\d+$/, '').replaceAll('-', ' ');
    }
    return path;
  }

  // --- Звуковой сигнал сбора ---
  function playCollectSound() {
    if (!settings.soundEnabled) return;
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        audioCtx = new AudioContextClass();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1318.51, now);
      osc.frequency.exponentialRampToValueAtTime(1975.53, now + 0.12);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {}
  }

  // --- Всплывающее уведомление ---
  let toastTimer = null;
  function showToast(text, subtext = '') {
    let toast = document.getElementById('aon-pk-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'aon-pk-toast';
      toast.className = 'aon-pk-toast';
      toast.innerHTML = `<span class="aon-pk-toast-icon">🎃</span><span id="aon-pk-toast-msg"></span>`;
      document.body.appendChild(toast);
    }

    const msgEl = document.getElementById('aon-pk-toast-msg');
    msgEl.innerHTML = `<span>${text}</span> ${subtext ? `<span style="color:#f97316;margin-left:6px">${subtext}</span>` : ''}`;

    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3800);
  }

  // --- 1. АВТОСБОР НА СТРАНИЦЕ (ТОЛЬКО НАСТОЯЩИЕ ТЫКВЫ ИВЕНТА .pk-root) ---
  const EXCLUDED_PAGE_PREFIXES = ['/event/pumpkins', '/tv', '/settings', '/premium', '/login', '/register', '/api/', '/media/'];

  function initDomWatcher() {
    let debounceTimer = null;

    async function checkCurrentPageForPumpkin() {
      if (!settings.autoCollectOnPage) return;

      const currentPath = window.location.pathname || '/';
      // Исключаем страницы, на которых тыквы не спавнятся (там только статические баннеры/стикеры/магазин)
      if (EXCLUDED_PAGE_PREFIXES.some(p => currentPath === p || currentPath.startsWith(p + '/'))) {
        return;
      }

      // Настоящая тыква ивента рендерится ИСКЛЮЧИТЕЛЬНО внутри .pk-root (компонент PumpkinOverlay)
      const rootEl = document.querySelector('.pk-root');
      if (!rootEl) return;

      const pumpkinBtn = rootEl.querySelector('button.pk-btn') || rootEl.querySelector('button');
      if (!pumpkinBtn || pumpkinBtn.dataset.aonCollected) return;

      pumpkinBtn.dataset.aonCollected = 'processing';
      console.log('[Pumpkin Hunter] Обнаружена настоящая тыква ивента (.pk-root), собираем!');

      // 1. Пытаемся собрать через прямой API
      let claimed = false;
      try {
        const curState = await checkPumpkinOnPath(currentPath);
        if (curState && curState.pumpkin && !curState.pumpkin.claimed) {
          const claimRes = await claimPumpkinViaApi(currentPath, curState.pumpkin.id, curState.claim_min_ms);
          if (claimRes.success) {
            claimed = true;
            pumpkinBtn.dataset.aonCollected = 'done';
            const title = getCleanTitle(currentPath);
            playCollectSound();
            showToast(`Собрана тыква на: ${title}!`, `+${claimRes.amount}`);
            addHudLog(`✅ Собрано на ${title}!`, 'success');
            await syncWithServer();
            return;
          }
        }
      } catch (e) {}

      // 2. Если API не ответил, выполняем точный клик с координатами
      if (!claimed && pumpkinBtn.isConnected) {
        try {
          const rect = pumpkinBtn.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const eventOpts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: window };
          pumpkinBtn.dispatchEvent(new PointerEvent('pointerdown', eventOpts));
          pumpkinBtn.dispatchEvent(new MouseEvent('mousedown', eventOpts));
          pumpkinBtn.dispatchEvent(new PointerEvent('pointerup', eventOpts));
          pumpkinBtn.dispatchEvent(new MouseEvent('mouseup', eventOpts));
          pumpkinBtn.click();
        } catch (e) {
          pumpkinBtn.click();
        }
        pumpkinBtn.dataset.aonCollected = 'done';

        // Синхронизируем статистику с сервером через 1.5 секунды после клика
        setTimeout(syncWithServer, 1500);
      }
    }

    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkCurrentPageForPumpkin, 200);
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(checkCurrentPageForPumpkin, 600);
  }

  // --- 2. РЕГИСТРАЦИЯ ЛОКАЦИИ ТЫКВЫ ЭТОГО ЧАСА ---
  function registerCollectedPumpkin(item) {
    const hourKey = new Date().toISOString().slice(0, 13);
    let list = settings.currentHourPumpkins || [];

    if (settings.stats.lastHourKey && settings.stats.lastHourKey !== hourKey) {
      list = [];
    }

    const exists = list.some(p => p.path === item.path || (item.pumpkin_id && p.id === item.pumpkin_id));
    if (!exists) {
      list.unshift({
        id: item.pumpkin_id || String(Date.now()),
        path: item.path,
        url: 'https://animeon.cc' + item.path,
        title: item.title || getCleanTitle(item.path),
        amount: item.amount || 1,
        foundAt: Date.now()
      });
      settings.currentHourPumpkins = list;
    }

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        action: 'PUMPKIN_COLLECTED',
        data: {
          pumpkin_id: item.pumpkin_id,
          path: item.path,
          title: item.title || getCleanTitle(item.path),
          amount: item.amount || 1,
          balance: item.balance
        }
      }).catch(() => {});
    }

    renderCurrentHourLocations();
    updateHudStats();
  }

  // --- ПОЛНАЯ СИНХРОНИЗАЦИЯ С СЕРВЕРОМ (Официальные данные с https://animeon.cc/event/pumpkins) ---
  async function syncWithServer() {
    try {
      // 1. Основное состояние: сколько собрано сегодня, лимит дня, лимит часа
      const stateResp = await fetch('/api/event/pumpkins/state?path=/', { credentials: 'include' });
      if (stateResp.ok) {
        const stateData = await stateResp.json();
        if (typeof stateData.caught_today === 'number') settings.stats.caughtToday = stateData.caught_today;
        if (typeof stateData.daily_cap === 'number') settings.stats.dailyCap = stateData.daily_cap;
        if (typeof stateData.caught_hour === 'number') settings.stats.caughtThisHour = stateData.caught_hour;
        if (typeof stateData.hourly_cap === 'number') settings.stats.hourlyCap = stateData.hourly_cap;
      }

      // 2. Реальный баланс тыкв в магазине
      const shopResp = await fetch('/api/event/pumpkins/shop', { credentials: 'include' });
      if (shopResp.ok) {
        const shopData = await shopResp.json();
        if (typeof shopData.balance === 'number') {
          settings.stats.balance = shopData.balance;
        }
      }

      // 3. Реальная история собранных тыкв пользователя
      const histResp = await fetch('/api/event/pumpkins/history', { credentials: 'include' });
      if (histResp.ok) {
        const histData = await histResp.json();
        if (Array.isArray(histData.catches)) {
          const currentHourStart = new Date().setMinutes(0, 0, 0);
          const currentHourCatches = histData.catches.filter(c => {
            const t = typeof c.created_at === 'string' ? Date.parse(c.created_at) : (c.created_at * 1000 || c.at || 0);
            return t >= currentHourStart;
          });
          settings.currentHourPumpkins = currentHourCatches.map(c => ({
            id: c.id || String(c.at),
            path: c.path || '/',
            url: 'https://animeon.cc' + (c.path || '/'),
            title: getCleanTitle(c.path || '/'),
            amount: c.amount || 1,
            foundAt: typeof c.created_at === 'string' ? Date.parse(c.created_at) : (c.created_at * 1000 || c.at || Date.now())
          }));
        }
      }

      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ stats: settings.stats, currentHourPumpkins: settings.currentHourPumpkins });
      }

      renderCurrentHourLocations();
      updateHudStats();
    } catch (e) {}
  }

  // --- 3. УМНЫЙ СКАНЕР И ЦИКЛ СБОРА ---
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function claimPumpkinViaApi(path, pumpkinId, claimMinMs = 600) {
    try {
      await fetch('/api/event/pumpkins/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: path, pumpkin_id: pumpkinId })
      });

      const waitTime = Math.max(750, (claimMinMs || 600) + 150);
      await sleep(waitTime);

      const claimResp = await fetch('/api/event/pumpkins/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: path, pumpkin_id: pumpkinId })
      });

      if (claimResp.ok) {
        const res = await claimResp.json();
        return { success: true, amount: res.amount || 1, balance: res.balance };
      } else {
        const err = await claimResp.json().catch(() => ({}));
        return { success: false, code: err.code || err.error || String(claimResp.status) };
      }
    } catch (e) {
      return { success: false, code: 'network_error', message: e.message };
    }
  }

  function decodePumpkinFx(fx) {
    if (typeof fx !== 'string' || !fx) return null;
    try {
      const b64 = fx.replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64 + '='.repeat((4 - b64.length % 4) % 4);
      const bin = atob(pad);
      if (bin.length < 5) return null;
      const raw = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);

      let a = ((raw[0] << 24) | (raw[1] << 16) | (raw[2] << 8) | raw[3]) ^ 0x5a17c3e9;
      if ((a >>>= 0) === 0) a = 1;

      let str = '';
      for (let i = 4; i < raw.length; i++) {
        a ^= (a << 13) >>> 0; a >>>= 0;
        a ^= a >>> 17;
        a ^= (a << 5) >>> 0; a >>>= 0;
        const n = raw[i] ^ (a & 0xFF);
        if (n === 0) break;
        str += String.fromCharCode(n);
      }

      if (!str || str[0] !== '1') return null;
      const parts = str.split('|');
      if (parts.length !== 7) return null;
      const parseNum = (v, d = 0) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : d;
      };
      return {
        id: parts[1],
        x_pct: parseNum(parts[2], 50),
        y_pct: parseNum(parts[3], 50),
        variant: Math.abs(Math.trunc(parseNum(parts[4], 0))) % 4,
        claimed: parts[5] === '1',
        expires_at: parseNum(parts[6], 0)
      };
    } catch (e) {
      return null;
    }
  }

  async function checkPumpkinOnPath(path) {
    try {
      const resp = await fetch(`/api/event/pumpkins/state?path=${encodeURIComponent(path)}`, {
        method: 'GET',
        credentials: 'include'
      });
      if (!resp.ok) return null;
      const data = await resp.json();

      // Расшифровываем тыкву из fx, если поле pumpkin равно null (anti-bot защита AnimeOn)
      if (!data.pumpkin && data.fx) {
        data.pumpkin = decodePumpkinFx(data.fx);
      }

      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          action: 'UPDATE_SERVER_STATE',
          state: data
        }).catch(() => {});
      }

      if (typeof data.daily_cap === 'number') settings.stats.dailyCap = data.daily_cap;
      if (typeof data.hourly_cap === 'number') settings.stats.hourlyCap = data.hourly_cap;
      if (typeof data.caught_today === 'number') settings.stats.caughtToday = data.caught_today;
      if (typeof data.caught_hour === 'number') settings.stats.caughtThisHour = data.caught_hour;

      return data;
    } catch (e) {
      return null;
    }
  }

  async function fetchSitemapPaths() {
    try {
      const resp = await fetch('/sitemap.xml');
      if (!resp.ok) return [];
      const text = await resp.text();
      const matches = text.match(/<loc>https:\/\/animeon\.cc(\/anime\/[^<]+)<\/loc>/g) || [];
      return matches.map((m) => m.replace(/<\/?loc>/g, '').replace('https://animeon.cc', ''));
    } catch (e) {
      return [];
    }
  }

  /**
   * Запуск сбора тыкв:
   * mode: 'quick' | 'deep' | 'manual'
   */
  async function runPumpkinHunter(mode = 'quick', isAuto = false) {
    // Если сбор уже идет — пропускаем
    if (isScanning) return;

    // 1. Проверяем, завершен ли сбор в этом часе
    if (hourScanState.hourCompleted) {
      if (isAuto) {
        console.log('[Pumpkin Hunter] Все тыквы этого часа уже собраны. Отдых до смены часа.');
        return;
      }
      // Если запуск принудительный (клик пользователя) — разрешаем
      hourScanState.hourCompleted = false;
      saveHourScanState();
    }

    // 2. Если уже собрано 10 (или лимит часа достигнут), не запускаем автосбор
    const hourlyCap = settings.stats?.hourlyCap || 10;
    const caughtThisHour = settings.stats?.caughtThisHour || 0;
    const currentListCount = (settings.currentHourPumpkins || []).length;
    if (isAuto && hourlyCap > 0 && (caughtThisHour >= hourlyCap || currentListCount >= hourlyCap)) {
      hourScanState.hourCompleted = true;
      saveHourScanState();
      updateHudStats();
      addHudLog(`😴 Все тыквы часа собраны (${Math.max(caughtThisHour, currentListCount)}/${hourlyCap}). Отдых до смены часа.`);
      return;
    }

    // 3. Проверяем дневной лимит (60)
    const dailyCap = settings.stats?.dailyCap || 60;
    const caughtToday = settings.stats?.caughtToday || 0;
    if (isAuto && dailyCap > 0 && caughtToday >= dailyCap) {
      hourScanState.hourCompleted = true;
      saveHourScanState();
      updateHudStats();
      addHudLog(`😴 Дневной лимит (${caughtToday}/${dailyCap}) исчерпан! Отдых до завтра.`);
      return;
    }

    isScanning = true;
    shouldStopScan = false;

    updateHudScanState(true, mode === 'deep' ? 'Глубокий сбор по карте сайта...' : 'Быстрый сбор...');

    let targetPaths = [];
    if (typeof DEFAULT_TARGET_PATHS !== 'undefined' && Array.isArray(DEFAULT_TARGET_PATHS)) {
      targetPaths = [...DEFAULT_TARGET_PATHS];
    } else {
      targetPaths = ['/', '/catalog', '/schedule', '/collections', '/leaderboard', '/news'];
    }

    if (mode === 'deep') {
      updateHudScanState(true, 'Загрузка свежей карты сайта (sitemap.xml)...');
      const sitemapPaths = await fetchSitemapPaths();
      if (sitemapPaths.length > 0) {
        // Перемешиваем страницы sitemap для широкого охвата
        const shuffled = sitemapPaths.sort(() => 0.5 - Math.random());
        targetPaths = Array.from(new Set([...targetPaths, ...shuffled]));
      }
    }

    const maxPages = mode === 'deep' ? Math.min(200, targetPaths.length) : Math.min(settings.scanLimit || 80, targetPaths.length);
    const pagesToScan = targetPaths.slice(0, maxPages);

    let foundCount = 0;
    let checkedCount = 0;
    let hitHourlyCap = false;

    addHudLog(`Запуск ${mode === 'deep' ? 'глубокого' : 'быстрого'} сбора (${maxPages} стр)...`);

    for (let i = 0; i < pagesToScan.length; i++) {
      if (shouldStopScan) {
        addHudLog('Сбор остановлен пользователем');
        break;
      }

      const path = pagesToScan[i];
      const title = getCleanTitle(path);
      checkedCount++;
      const progress = Math.round((checkedCount / maxPages) * 100);
      updateHudProgress(progress, `[${checkedCount}/${maxPages}] ${title.slice(0, 24)}...`);

      const state = await checkPumpkinOnPath(path);
      if (state) {
        // Проверяем, не сообщил ли сервер о закрытии лимитов
        if (state.hourly_cap > 0 && typeof state.caught_hour === 'number' && state.caught_hour >= state.hourly_cap) {
          hitHourlyCap = true;
          addHudLog(`🎉 Лимит часа достигнут (${state.caught_hour}/${state.hourly_cap})!`);
          break; // Немедленно выходим из цикла, остальные страницы не проверяем!
        }

        if (state.daily_cap > 0 && typeof state.caught_today === 'number' && state.caught_today >= state.daily_cap) {
          addHudLog(`🎉 Дневной лимит достигнут (${state.caught_today}/${state.daily_cap})!`);
          hourScanState.hourCompleted = true;
          saveHourScanState();
          break;
        }

        if (state.pumpkin && !state.pumpkin.claimed) {
          const pId = state.pumpkin.id;
          if (!processedPumpkins.has(pId)) {
            processedPumpkins.add(pId);
            addHudLog(`🎃 Найдена тыква: ${title}`);

            const claimRes = await claimPumpkinViaApi(path, pId, state.claim_min_ms);
            if (claimRes.success) {
              foundCount++;
              playCollectSound();
              showToast(`Собрана тыква на: ${title}!`, `+${claimRes.amount}`);
              addHudLog(`✅ Собрано на ${title}!`, 'success');

              registerCollectedPumpkin({
                pumpkin_id: pId,
                path: path,
                title: title,
                amount: claimRes.amount,
                balance: claimRes.balance
              });

              settings.stats.balance = claimRes.balance;
              settings.stats.totalCollected = (settings.stats.totalCollected || 0) + claimRes.amount;
              updateHudStats();

              const nowCaughtHour = (settings.stats.caughtThisHour || 0) + claimRes.amount;
              settings.stats.caughtThisHour = nowCaughtHour;
              if (settings.stats.hourlyCap > 0 && nowCaughtHour >= settings.stats.hourlyCap) {
                hitHourlyCap = true;
                break;
              }
            } else {
              addHudLog(`⚠️ ${claimRes.code || 'Ошибка'}`);
              if (claimRes.code === 'pumpkin_hourly_cap') {
                hitHourlyCap = true;
                showToast('Лимит тыкв на этот час исчерпан!');
                addHudLog('Лимит часа достигнут. Сбор в этом часе завершен.');
                break;
              }
              if (claimRes.code === 'pumpkin_daily_cap') {
                showToast('Дневной лимит тыкв (60) исчерпан!');
                addHudLog('Достигнут дневной лимит сбора тыкв.');
                hourScanState.hourCompleted = true;
                saveHourScanState();
                break;
              }
              if (claimRes.code === 'rate_limited') {
                await sleep(8000);
              }
            }
          }
        }
      }

      await sleep(settings.requestDelayMs || 180);
    }

    isScanning = false;
    updateHudScanState(false, foundCount > 0 ? `Собрано: +${foundCount} тыкв` : 'Проверка завершена');
    addHudLog(`🏁 Итог: собрано +${foundCount} тыкв`);

    // --- УМНАЯ ЛОГИКА ЗАВЕРШЕНИЯ ЧАСА (по запросу пользователя) ---
    // «если уже все тыквы собраны и после 2х проверок не получено ниодной сделать глубокий сбор и больше не делать до конца часа»

    // А. Лимит часа исчерпан
    const hCap = settings.stats.hourlyCap || 10;
    const currentPumpkinsCount = (settings.currentHourPumpkins || []).length;
    if (hitHourlyCap || (hCap > 0 && currentPumpkinsCount >= hCap)) {
      hourScanState.hourCompleted = true;
      saveHourScanState();
      updateHudStats();
      addHudLog(`😴 Все тыквы часа собраны (${currentPumpkinsCount}/${hCap}). Отдых до смены часа.`);
      showToast('Все тыквы часа собраны! Отдых до смены часа.');
      return;
    }

    // Б. Финальный глубокий сбор завершен — после него БОЛЬШЕ НЕ ДЕЛАТЬ проверок до конца часа
    if (mode === 'deep' || hourScanState.deepScanDone) {
      hourScanState.deepScanDone = true;
      hourScanState.hourCompleted = true;
      saveHourScanState();
      updateHudStats();
      addHudLog(`😴 Финальный глубокий сбор завершен (+${foundCount} тыкв). Отдых до смены часа.`);
      showToast('Глубокий сбор завершен! Отдых до смены часа.');
      return;
    }

    // В. Обычная проверка
    if (foundCount > 0) {
      // Нашли тыквы — сбрасываем счетчик нулевых проверок
      hourScanState.consecutiveZeroScans = 0;
      saveHourScanState();
    } else {
      // 0 тыкв найдено в этой проверке
      hourScanState.consecutiveZeroScans++;
      saveHourScanState();
      addHudLog(`🔍 Проверок без тыкв: ${hourScanState.consecutiveZeroScans}/2`);

      // Если 2 проверки подряд ничего не дали:
      if (hourScanState.consecutiveZeroScans >= 2) {
        // Делаем финальный глубокий сбор и затем отдыхаем до конца часа!
        hourScanState.deepScanDone = true;
        saveHourScanState();
        addHudLog('🌐 2 проверки без тыкв! Запуск контрольного глубокого сбора (sitemap)...');
        showToast('2 проверки без тыкв! Запуск глубокого сбора...');
        setTimeout(() => {
          runPumpkinHunter('deep', false);
        }, 1500);
      }
    }
  }

  function stopHunter() {
    shouldStopScan = true;
    updateHudScanState(false, 'Остановка...');
  }

  // Непрерывный автосбор при открытой вкладке
  function checkAndStartAutoHarvest() {
    if (!settings.alwaysCollect) return;

    // Первоначальный сбор через 2.5 сек при загрузке
    setTimeout(() => {
      if (settings.alwaysCollect && !isScanning && !hourScanState.hourCompleted) {
        console.log('[Pumpkin Hunter] Плановый старт автосбора...');
        runPumpkinHunter('quick', true);
      }
    }, 2500);

    // Периодический опрос каждые 5 минут
    setInterval(() => {
      if (settings.alwaysCollect && !isScanning && !hourScanState.hourCompleted) {
        console.log('[Pumpkin Hunter] Периодическая проверка (каждые 5 мин)...');
        runPumpkinHunter('quick', true);
      }
    }, 5 * 60 * 1000);
  }

  // --- 4. ОТОБРАЖЕНИЕ ВИДЖЕТА И ЛОКАЦИЙ ---
  function renderCurrentHourLocations() {
    const listEl = document.getElementById('aon-pk-locations-list');
    const countEl = document.getElementById('aon-pk-locations-count');
    const pumpkins = settings.currentHourPumpkins || [];

    if (countEl) countEl.textContent = pumpkins.length;
    if (!listEl) return;

    if (pumpkins.length === 0) {
      listEl.innerHTML = `<div class="aon-pk-empty-loc">В этом часе тыквы пока не найдены.<br><span style="opacity:0.7">Они появятся здесь сразу при сборе!</span></div>`;
      return;
    }

    listEl.innerHTML = pumpkins.map(p => {
      const timeStr = new Date(p.foundAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return `
        <a href="${p.url}" target="_blank" class="aon-pk-loc-link" title="Перейти на страницу: ${p.path}">
          <div class="aon-pk-loc-main">
            <span class="aon-pk-loc-icon">🎃</span>
            <span class="aon-pk-loc-title">${p.title}</span>
          </div>
          <div class="aon-pk-loc-meta">
            <span class="aon-pk-loc-time">${timeStr}</span>
            <span class="aon-pk-loc-badge">+${p.amount}</span>
          </div>
        </a>
      `;
    }).join('');
  }

  function createHudWidget() {
    if (document.getElementById('aon-pk-widget-root')) return;

    const root = document.createElement('div');
    root.id = 'aon-pk-widget-root';

    root.innerHTML = `
      <!-- Свернутый бейдж -->
      <div id="aon-pk-badge" class="aon-pk-badge-btn" style="${settings.showHud ? '' : 'display:none;'}">
        <span class="aon-pk-badge-icon">🎃</span>
        <span class="aon-pk-badge-text">Тыквы</span>
        <span id="aon-pk-badge-val" class="aon-pk-badge-count">0</span>
      </div>

      <!-- Развернутая карточка -->
      <div id="aon-pk-card" class="aon-pk-card" style="display: none;">
        <div class="aon-pk-header">
          <div class="aon-pk-title-wrap">
            <span class="aon-pk-pulse" id="aon-pk-pulse"></span>
            <span class="aon-pk-title">AnimeOn Pumpkin Hunter 🎃</span>
          </div>
          <button id="aon-pk-minimize-btn" class="aon-pk-close-btn" title="Свернуть">✕</button>
        </div>

        <!-- Показатели -->
        <div class="aon-pk-stats">
          <div class="aon-pk-stat-box">
            <div id="aon-pk-stat-balance" class="aon-pk-stat-val">0</div>
            <div class="aon-pk-stat-lbl">Баланс тыкв</div>
          </div>
          <div class="aon-pk-stat-box">
            <div id="aon-pk-stat-today" class="aon-pk-stat-val">0 / 60</div>
            <div class="aon-pk-stat-lbl">Сегодня (лимит 60)</div>
          </div>
        </div>

        <div class="aon-pk-timer-row">
          <span>Смена часа (сброс локаций):</span>
          <span id="aon-pk-timer" class="aon-pk-timer-val">--:--</span>
        </div>

        <!-- Статус готовности часа -->
        <div id="aon-pk-hour-status" class="aon-pk-hour-status" style="display:none;">
          😴 Все тыквы часа собраны! Отдых до смены часа.
        </div>

        <!-- Блок: Где были найдены тыквы в этом часе -->
        <div class="aon-pk-locations-wrap">
          <div class="aon-pk-locations-header">
            <span>📍 Тыквы этого часа (<span id="aon-pk-locations-count">0</span>)</span>
            <span style="font-size:10px;color:#a1a1aa;">хранятся до смены часа</span>
          </div>
          <div id="aon-pk-locations-list" class="aon-pk-locations-list"></div>
        </div>

        <div class="aon-pk-progress-wrap" id="aon-pk-progress-wrap" style="display: none;">
          <div class="aon-pk-progress-bar">
            <div id="aon-pk-progress-fill" class="aon-pk-progress-fill"></div>
          </div>
          <div id="aon-pk-progress-status" class="aon-pk-progress-status">Подготовка...</div>
        </div>

        <div class="aon-pk-actions">
          <button id="aon-pk-quick-btn" class="aon-pk-btn aon-pk-btn-primary">
            <span>⚡</span> Собрать тыквы сейчас
          </button>
          <button id="aon-pk-deep-btn" class="aon-pk-btn aon-pk-btn-secondary">
            <span>🌐</span> Глубокий сбор (Карта сайта)
          </button>
          <button id="aon-pk-cards-btn" class="aon-pk-btn aon-pk-btn-cards">
            <span>🎴</span> Автооткрытие карточек
          </button>
          <button id="aon-pk-stop-btn" class="aon-pk-btn aon-pk-btn-danger" style="display: none;">
            <span>⏹</span> Остановить сбор
          </button>
        </div>

        <div class="aon-pk-toggles">
          <div class="aon-pk-toggle-row" id="aon-pk-toggle-always">
            <span class="aon-pk-toggle-label"><span>🔥</span> Всегда собирать автоматически</span>
            <div class="aon-pk-switch ${settings.alwaysCollect ? 'active' : ''}">
              <div class="aon-pk-switch-thumb"></div>
            </div>
          </div>
          <div class="aon-pk-toggle-row" id="aon-pk-toggle-autoclick">
            <span class="aon-pk-toggle-label"><span>🎯</span> Автоклик на открытой странице</span>
            <div class="aon-pk-switch ${settings.autoCollectOnPage ? 'active' : ''}">
              <div class="aon-pk-switch-thumb"></div>
            </div>
          </div>
          <div class="aon-pk-toggle-row" id="aon-pk-toggle-sound">
            <span class="aon-pk-toggle-label"><span>🔔</span> Звуковой эффект</span>
            <div class="aon-pk-switch ${settings.soundEnabled ? 'active' : ''}">
              <div class="aon-pk-switch-thumb"></div>
            </div>
          </div>
        </div>

        <div class="aon-pk-log-wrap">
          <div class="aon-pk-log-header">Журнал событий</div>
          <div id="aon-pk-log-list" class="aon-pk-log-list">
            <div class="aon-pk-log-item">Автосбор активен</div>
          </div>
        </div>

        <a href="/event/pumpkins" class="aon-pk-shop-link">
          🛒 Открыть магазин ивента
        </a>
      </div>
    `;

    document.body.appendChild(root);

    const badge = document.getElementById('aon-pk-badge');
    const card = document.getElementById('aon-pk-card');
    const minBtn = document.getElementById('aon-pk-minimize-btn');

    badge.onclick = () => {
      badge.style.display = 'none';
      card.style.display = 'flex';
      hudExpanded = true;
      syncWithServer();
      renderCurrentHourLocations();
    };

    minBtn.onclick = () => {
      card.style.display = 'none';
      badge.style.display = 'flex';
      hudExpanded = false;
    };

    document.getElementById('aon-pk-quick-btn').onclick = () => runPumpkinHunter('quick', false);
    document.getElementById('aon-pk-deep-btn').onclick = () => runPumpkinHunter('deep', false);
    document.getElementById('aon-pk-stop-btn').onclick = () => stopHunter();

    const cardsBtn = document.getElementById('aon-pk-cards-btn');
    if (cardsBtn) {
      cardsBtn.onclick = () => {
        if (window.location.pathname.startsWith('/cards')) {
          if (window.AnimeOnCards && window.AnimeOnCards.toggleWidget) {
            window.AnimeOnCards.toggleWidget();
          }
        } else {
          window.location.href = 'https://animeon.cc/cards';
        }
      };
    }

    setupToggle('aon-pk-toggle-always', 'alwaysCollect');
    setupToggle('aon-pk-toggle-autoclick', 'autoCollectOnPage');
    setupToggle('aon-pk-toggle-sound', 'soundEnabled');

    updateHudStats();
    renderCurrentHourLocations();
    startCountdownTimer();
  }

  function setupToggle(elId, settingKey) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.onclick = () => {
      settings[settingKey] = !settings[settingKey];
      const sw = el.querySelector('.aon-pk-switch');
      if (settings[settingKey]) sw.classList.add('active');
      else sw.classList.remove('active');

      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ [settingKey]: settings[settingKey] });
      }
    };
  }

  function updateHudStats() {
    const badgeVal = document.getElementById('aon-pk-badge-val');
    const balVal = document.getElementById('aon-pk-stat-balance');
    const todayVal = document.getElementById('aon-pk-stat-today');
    const hourStatus = document.getElementById('aon-pk-hour-status');
    const pulse = document.getElementById('aon-pk-pulse');

    const bal = settings.stats?.balance || 0;
    const caughtToday = settings.stats?.caughtToday || 0;
    const dailyCap = settings.stats?.dailyCap ?? 60;

    if (badgeVal) badgeVal.textContent = bal;
    if (balVal) balVal.textContent = bal;
    if (todayVal) {
      todayVal.textContent = dailyCap > 0 ? `${caughtToday} / ${dailyCap}` : `${caughtToday} (без лимита)`;
    }

    if (hourStatus) {
      hourStatus.style.display = hourScanState.hourCompleted ? 'block' : 'none';
    }

    if (pulse && !isScanning) {
      if (hourScanState.hourCompleted) {
        pulse.classList.add('sleeping');
      } else {
        pulse.classList.remove('sleeping');
      }
    }

    const badge = document.getElementById('aon-pk-badge');
    if (badge && !hudExpanded) {
      badge.style.display = settings.showHud ? 'flex' : 'none';
    }
  }

  function updateHudScanState(scanning, statusText = '') {
    const pulse = document.getElementById('aon-pk-pulse');
    const progWrap = document.getElementById('aon-pk-progress-wrap');
    const quickBtn = document.getElementById('aon-pk-quick-btn');
    const deepBtn = document.getElementById('aon-pk-deep-btn');
    const stopBtn = document.getElementById('aon-pk-stop-btn');
    const progStatus = document.getElementById('aon-pk-progress-status');

    if (pulse) {
      if (scanning) {
        pulse.classList.add('scanning');
        pulse.classList.remove('sleeping');
      } else {
        pulse.classList.remove('scanning');
        if (hourScanState.hourCompleted) pulse.classList.add('sleeping');
      }
    }

    if (progWrap) progWrap.style.display = scanning ? 'block' : 'none';
    if (quickBtn) quickBtn.style.display = scanning ? 'none' : 'flex';
    if (deepBtn) deepBtn.style.display = scanning ? 'none' : 'flex';
    if (stopBtn) stopBtn.style.display = scanning ? 'flex' : 'none';
    if (progStatus && statusText) progStatus.textContent = statusText;
  }

  function updateHudProgress(pct, text) {
    const fill = document.getElementById('aon-pk-progress-fill');
    const progStatus = document.getElementById('aon-pk-progress-status');
    if (fill) fill.style.width = `${pct}%`;
    if (progStatus && text) progStatus.textContent = text;
  }

  function addHudLog(msg, type = '') {
    const list = document.getElementById('aon-pk-log-list');
    if (!list) return;

    const item = document.createElement('div');
    item.className = `aon-pk-log-item ${type}`;
    const timeStr = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    item.innerHTML = `<span>${msg}</span><span style="opacity:0.6;font-size:9px">${timeStr}</span>`;

    list.insertBefore(item, list.firstChild);
    while (list.children.length > 25) {
      list.removeChild(list.lastChild);
    }
  }

  function startCountdownTimer() {
    let lastKnownHour = new Date().getHours();

    setInterval(() => {
      const timerEl = document.getElementById('aon-pk-timer');
      const now = new Date();
      const currentHour = now.getHours();

      // Проверка наступления нового часа
      if (currentHour !== lastKnownHour) {
        lastKnownHour = currentHour;
        console.log('[Pumpkin Hunter] Наступил новый час! Сброс статуса и локаций тыкв.');

        // СБРОС НА НОВЫЙ ЧАС
        hourScanState = {
          hourKey: new Date().toISOString().slice(0, 13),
          consecutiveZeroScans: 0,
          deepScanDone: false,
          hourCompleted: false
        };
        saveHourScanState();

        settings.currentHourPumpkins = [];
        renderCurrentHourLocations();
        updateHudStats();

        if (settings.alwaysCollect) {
          addHudLog('⏰ Наступил новый час! Запуск автосбора свежих тыкв...');
          runPumpkinHunter('quick', true);
        }
      }

      if (!timerEl) return;
      const nextHour = Math.ceil((now.getTime() + 1000) / 3600000) * 3600000;
      const diffSec = Math.max(0, Math.floor((nextHour - now.getTime()) / 1000));

      const mins = Math.floor(diffSec / 60);
      const secs = diffSec % 60;
      timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 1000);
  }

  // Слушатель фоновых сообщений
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === 'START_AUTO_SCAN' || msg.action === 'START_HOURLY_SCAN') {
        if (!hourScanState.hourCompleted) {
          showToast('🎃 Автосбор свежих тыкв...');
          runPumpkinHunter('quick', true);
          sendResponse({ started: true });
        } else {
          sendResponse({ started: false, reason: 'hour_completed' });
        }
      }
      if (msg.action === 'TRIGGER_SCAN') {
        runPumpkinHunter(msg.mode || 'quick', false);
        sendResponse({ started: true });
      }
    });
  }

  // Запуск
  initDomWatcher();
  createHudWidget();
  syncWithServer();
  setInterval(syncWithServer, 60000);

  console.log('[AnimeOn Pumpkin Hunter] Непрерывный умный автосборщик запущен');
})();
