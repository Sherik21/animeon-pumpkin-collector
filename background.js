// background.js — Service Worker для AnimeOn Pumpkin Hunter

const DEFAULT_SETTINGS = {
  alwaysCollect: true,       // Непрерывный автосбор (каждый час + периодически)
  autoCollectOnPage: true,   // Автосбор при открытой вкладке (DOM клик)
  hourlyAutoScan: true,      // Автосбор в начале часа
  soundEnabled: true,        // Звуковое уведомление
  showHud: true,             // Показывать виджет на страницах animeon.cc
  scanLimit: 100,            // Количество страниц для фонового поиска
  requestDelayMs: 180,       // Задержка между запросами
  stats: {
    totalCollected: 0,
    balance: 0,
    caughtThisHour: 0,
    hourlyCap: null,
    caughtToday: 0,
    dailyCap: 60,            // Лимит в день (если задан сервером)
    lastHourKey: null,
    lastDayKey: null
  },
  hourScanState: {
    hourKey: null,
    consecutiveZeroScans: 0,
    deepScanDone: false,
    hourCompleted: false
  },
  currentHourPumpkins: [],   // Тыквы, найденные в ТЕКУЩЕМ часе (сбрасываются каждый час)
  history: []
};

function getHourKey() {
  return new Date().toISOString().slice(0, 13); // "2026-10-31T23"
}

function getDayKey() {
  return new Date().toISOString().slice(0, 10); // "2026-10-31"
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(null);
  const merged = { ...DEFAULT_SETTINGS, ...existing };
  await chrome.storage.local.set(merged);

  setupAlarms();
  updateBadge(merged.stats?.balance || 0);
  console.log('[AnimeOn Pumpkin Hunter] Фоновый сервис инициализирован');
});

function setupAlarms() {
  chrome.alarms.clearAll(() => {
    const now = Date.now();
    const nextHour = Math.ceil(now / 3600000) * 3600000 + 15000;
    const delayMinutes = Math.max(1, (nextHour - now) / 60000);

    // 1. Будильник в начале каждого часа
    chrome.alarms.create('hourly-pumpkin-hunter', {
      delayInMinutes: delayMinutes,
      periodInMinutes: 60
    });

    // 2. Будильник периодической проверки (каждые 5 минут)
    chrome.alarms.create('periodic-pumpkin-check', {
      delayInMinutes: 5,
      periodInMinutes: 5
    });

    console.log(`[AnimeOn Pumpkin Hunter] Будильники установлены: следующий час через ${delayMinutes.toFixed(1)} мин`);
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const data = await chrome.storage.local.get(['alwaysCollect', 'hourlyAutoScan', 'stats', 'hourScanState', 'currentHourPumpkins']);
  const hourKey = getHourKey();
  const dayKey = getDayKey();

  const stats = data.stats || {};
  let hourScanState = data.hourScanState || {};
  let currentHourPumpkins = data.currentHourPumpkins || [];

  if (stats.lastDayKey !== dayKey) {
    stats.lastDayKey = dayKey;
    stats.caughtToday = 0;
  }

  // При смене часа: сбрасываем статус часа и локации
  if (stats.lastHourKey !== hourKey) {
    stats.lastHourKey = hourKey;
    stats.caughtThisHour = 0;
    currentHourPumpkins = [];
    hourScanState = {
      hourKey: hourKey,
      consecutiveZeroScans: 0,
      deepScanDone: false,
      hourCompleted: false
    };
    await chrome.storage.local.set({ stats, hourScanState, currentHourPumpkins });
  }

  if (alarm.name === 'hourly-pumpkin-hunter') {
    if (!data.alwaysCollect && !data.hourlyAutoScan) return;
    triggerScanInTabs('hourly');
  }

  if (alarm.name === 'periodic-pumpkin-check') {
    if (!data.alwaysCollect) return;
    // Если час уже закрыт — не сканируем!
    if (hourScanState.hourCompleted) {
      console.log('[Background] Час завершен, периодический сбор пропущен до следующего часа.');
      return;
    }
    triggerScanInTabs('periodic');
  }
});

async function triggerScanInTabs(reason) {
  try {
    const tabs = await chrome.tabs.query({ url: '*://animeon.cc/*' });
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'START_AUTO_SCAN',
        reason: reason === 'hourly' ? 'Начался новый час! Автосбор свежих тыкв...' : 'Периодический автосбор...'
      }).catch(() => {});
    }
  } catch (e) {}
}

function updateBadge(balance) {
  if (typeof balance === 'number' && balance > 0) {
    chrome.action.setBadgeText({ text: String(balance) });
    chrome.action.setBadgeBackgroundColor({ color: '#f97316' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'PUMPKIN_COLLECTED') {
    handlePumpkinCollected(message.data);
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'UPDATE_SERVER_STATE') {
    handleServerStateUpdate(message.state);
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'UPDATE_BALANCE') {
    if (typeof message.balance === 'number') {
      updateBadge(message.balance);
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'RESET_STATS') {
    chrome.storage.local.set({
      stats: {
        totalCollected: 0,
        balance: 0,
        caughtThisHour: 0,
        hourlyCap: null,
        caughtToday: 0,
        dailyCap: 60,
        lastHourKey: getHourKey(),
        lastDayKey: getDayKey()
      },
      hourScanState: {
        hourKey: getHourKey(),
        consecutiveZeroScans: 0,
        deepScanDone: false,
        hourCompleted: false
      },
      currentHourPumpkins: [],
      history: []
    }, () => {
      updateBadge(0);
      sendResponse({ ok: true });
    });
    return true;
  }
});

async function handleServerStateUpdate(serverState) {
  if (!serverState) return;
  const data = await chrome.storage.local.get(['stats', 'hourScanState']);
  const stats = data.stats || {};
  let hourScanState = data.hourScanState || {};

  if (typeof serverState.balance === 'number') stats.balance = serverState.balance;
  if (typeof serverState.caught_hour === 'number') stats.caughtThisHour = serverState.caught_hour;
  if (typeof serverState.hourly_cap === 'number') stats.hourlyCap = serverState.hourly_cap;
  if (typeof serverState.caught_today === 'number') stats.caughtToday = serverState.caught_today;
  if (typeof serverState.daily_cap === 'number') stats.dailyCap = serverState.daily_cap;

  // Если сервер вернул, что лимит часа или дня исчерпан
  if (stats.hourlyCap > 0 && stats.caughtThisHour >= stats.hourlyCap) {
    hourScanState.hourCompleted = true;
  }
  if (stats.dailyCap > 0 && stats.caughtToday >= stats.dailyCap) {
    hourScanState.hourCompleted = true;
  }

  await chrome.storage.local.set({ stats, hourScanState });
  updateBadge(stats.balance);
}

async function handlePumpkinCollected(item) {
  const data = await chrome.storage.local.get(['stats', 'currentHourPumpkins', 'history']);
  const stats = data.stats || {
    totalCollected: 0,
    balance: 0,
    caughtThisHour: 0,
    caughtToday: 0,
    lastHourKey: null,
    lastDayKey: null
  };
  let currentHourPumpkins = data.currentHourPumpkins || [];
  const history = data.history || [];

  const hourKey = getHourKey();
  const dayKey = getDayKey();

  if (stats.lastDayKey !== dayKey) {
    stats.lastDayKey = dayKey;
    stats.caughtToday = 0;
  }

  if (stats.lastHourKey !== hourKey) {
    stats.lastHourKey = hourKey;
    stats.caughtThisHour = 0;
    currentHourPumpkins = [];
  }

  const amount = item.amount || 1;
  stats.totalCollected = (stats.totalCollected || 0) + amount;
  stats.caughtThisHour = (stats.caughtThisHour || 0) + amount;
  stats.caughtToday = (stats.caughtToday || 0) + amount;

  if (typeof item.balance === 'number') {
    stats.balance = item.balance;
  } else {
    stats.balance = (stats.balance || 0) + amount;
  }

  const exists = currentHourPumpkins.some(p => p.id === item.pumpkin_id || p.path === item.path);
  if (!exists) {
    currentHourPumpkins.unshift({
      id: item.pumpkin_id || String(Date.now()),
      path: item.path || '/',
      url: 'https://animeon.cc' + (item.path || '/'),
      title: item.title || item.path || 'Страница',
      amount: amount,
      foundAt: Date.now()
    });
  }

  history.unshift({
    id: item.pumpkin_id || String(Date.now()),
    path: item.path || '/',
    title: item.title || item.path || 'Страница',
    amount: amount,
    time: Date.now()
  });

  if (history.length > 60) history.pop();

  await chrome.storage.local.set({ stats, currentHourPumpkins, history });
  updateBadge(stats.balance);
}
