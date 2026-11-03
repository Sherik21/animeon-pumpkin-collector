// popup.js — Логика всплывающего окна расширения

document.addEventListener('DOMContentLoaded', async () => {
  const statBalance = document.getElementById('stat-balance');
  const statToday = document.getElementById('stat-today');
  const timerVal = document.getElementById('timer-val');
  const statusPill = document.getElementById('status-pill');

  const locationsList = document.getElementById('locations-list');
  const locationsCount = document.getElementById('locations-count');

  const swAlways = document.getElementById('sw-always');
  const swAutoclick = document.getElementById('sw-autoclick');
  const swSound = document.getElementById('sw-sound');
  const swHud = document.getElementById('sw-hud');

  const btnQuick = document.getElementById('btn-quick-scan');
  const btnDeep = document.getElementById('btn-deep-scan');
  const btnCards = document.getElementById('btn-open-cards');
  const btnShop = document.getElementById('btn-open-shop');
  const btnClearStats = document.getElementById('btn-clear-stats');

  // Загружаем данные
  const data = await chrome.storage.local.get(null);
  renderData(data);

  // Следим за изменениями в реальном времени
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      chrome.storage.local.get(null, (fresh) => {
        renderData(fresh);
      });
    }
  });

  function renderData(settings) {
    if (!settings) return;

    // Статистика
    const bal = settings.stats?.balance || 0;
    const caughtToday = settings.stats?.caughtToday || 0;
    const dailyCap = settings.stats?.dailyCap ?? 60;

    if (statBalance) statBalance.textContent = bal;
    if (statToday) {
      statToday.textContent = dailyCap > 0 ? `${caughtToday} / ${dailyCap}` : `${caughtToday} (без лимита)`;
    }

    // Свитчи
    updateSwitch(swAlways, settings.alwaysCollect !== false);
    updateSwitch(swAutoclick, settings.autoCollectOnPage !== false);
    updateSwitch(swSound, settings.soundEnabled !== false);
    updateSwitch(swHud, settings.showHud !== false);

    // Статус активности бота
    if (statusPill) {
      if (settings.hourScanState?.hourCompleted) {
        statusPill.textContent = '😴 Отдых';
        statusPill.className = 'status-pill resting';
        statusPill.title = 'Все тыквы этого часа собраны. Отдых до смены часа.';
      } else if (settings.stats?.caughtToday >= (settings.stats?.dailyCap || 60)) {
        statusPill.textContent = 'Лимит дня';
        statusPill.className = 'status-pill finished';
        statusPill.title = 'Дневной лимит 60 тыкв достигнут!';
      } else {
        statusPill.textContent = 'Активен';
        statusPill.className = 'status-pill ready';
        statusPill.title = 'Автосбор тыкв работает';
      }
    }

    // Список локаций тыкв этого часа
    renderLocations(settings.currentHourPumpkins || []);
  }

  function updateSwitch(el, isActive) {
    if (!el) return;
    if (isActive) el.classList.add('active');
    else el.classList.remove('active');
  }

  function renderLocations(pumpkins) {
    if (locationsCount) locationsCount.textContent = pumpkins.length;
    if (!locationsList) return;

    if (!pumpkins || pumpkins.length === 0) {
      locationsList.innerHTML = '<div class="locations-empty">В этом часе тыквы пока не найдены.<br>Они появятся здесь сразу при сборе!</div>';
      return;
    }

    locationsList.innerHTML = pumpkins.map(item => {
      const timeStr = new Date(item.foundAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      const title = item.title || (typeof formatTitleFromPath === 'function' ? formatTitleFromPath(item.path) : item.path);
      return `
        <a href="${item.url || ('https://animeon.cc' + item.path)}" target="_blank" class="loc-item" title="Открыть страницу аниме">
          <span class="loc-title">🎃 ${title}</span>
          <div class="loc-meta">
            <span class="loc-time">${timeStr}</span>
            <span class="loc-chip">+${item.amount || 1}</span>
          </div>
        </a>
      `;
    }).join('');
  }

  // Привязка кликов по настройкам
  setupToggleClick('toggle-always', 'alwaysCollect', swAlways);
  setupToggleClick('toggle-autoclick', 'autoCollectOnPage', swAutoclick);
  setupToggleClick('toggle-sound', 'soundEnabled', swSound);
  setupToggleClick('toggle-hud', 'showHud', swHud);

  function setupToggleClick(containerId, key, switchEl) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.onclick = async () => {
      const current = await chrome.storage.local.get([key]);
      const newVal = !current[key];
      await chrome.storage.local.set({ [key]: newVal });
      updateSwitch(switchEl, newVal);
    };
  }

  // Таймер часа
  function updateTimer() {
    const now = Date.now();
    const nextHour = Math.ceil((now + 1000) / 3600000) * 3600000;
    const diffSec = Math.max(0, Math.floor((nextHour - now) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    if (timerVal) {
      timerVal.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  }
  updateTimer();
  setInterval(updateTimer, 1000);

  // Действия
  btnQuick.onclick = () => triggerScanOnAnimeon('quick');
  btnDeep.onclick = () => triggerScanOnAnimeon('deep');

  btnCards.onclick = async () => {
    const tabs = await chrome.tabs.query({ url: '*://animeon.cc/*' });
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { url: 'https://animeon.cc/cards', active: true });
    } else {
      chrome.tabs.create({ url: 'https://animeon.cc/cards' });
    }
    window.close();
  };

  btnShop.onclick = () => {
    chrome.tabs.create({ url: 'https://animeon.cc/event/pumpkins' });
  };

  btnClearStats.onclick = () => {
    if (confirm('Сбросить счетчик тыкв и историю локаций?')) {
      chrome.runtime.sendMessage({ action: 'RESET_STATS' });
    }
  };

  async function triggerScanOnAnimeon(mode) {
    statusPill.textContent = 'Поиск...';
    statusPill.className = 'status-pill scanning';

    const tabs = await chrome.tabs.query({ url: '*://animeon.cc/*' });
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'TRIGGER_SCAN', mode: mode }, (response) => {
        if (chrome.runtime.lastError || !response) {
          chrome.tabs.update(tabs[0].id, { active: true });
        }
      });
      setTimeout(() => {
        window.close();
      }, 500);
    } else {
      chrome.tabs.create({ url: 'https://animeon.cc/' });
      window.close();
    }
  }
});
