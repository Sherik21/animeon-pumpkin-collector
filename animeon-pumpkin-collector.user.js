// ==UserScript==
// @name         AnimeOn Hunter & Cards — Тыквы & Карточки 🎃🎴
// @namespace    https://animeon.cc/
// @version      1.3.0
// @description  Умный непрерывный сбор тыкв и быстрое автооткрытие карточек на AnimeOn.
// @author       Sherik21
// @match        https://animeon.cc/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  if (window.__AON_PUMPKIN_USERSCRIPT_LOADED__) return;
  window.__AON_PUMPKIN_USERSCRIPT_LOADED__ = true;

  const SEED_PATHS = [
    "/", "/catalog", "/schedule", "/collections", "/news", "/together", "/leaderboard",
    "/catalog/genre/ekshen", "/catalog/genre/komediya", "/catalog/genre/fentezi",
    "/catalog/genre/priklyucheniya", "/catalog/genre/fantastika", "/catalog/genre/drama",
    "/catalog/genre/romantika", "/catalog/genre/sverhestestvennoe", "/catalog/genre/tayna",
    "/catalog/genre/povsednevnost", "/catalog/genre/sport", "/catalog/genre/triller",
    "/catalog/genre/uzhasy", "/catalog/genre/syonen", "/catalog/genre/syodze",
    "/anime/van-pis-21", "/anime/naruto-20", "/anime/ataka-titanov-16498",
    "/anime/magicheskaya-bitva-40748", "/anime/klinok-rassekayuschiy-demonov-38000",
    "/anime/chelovek-benzopila-reze-57555", "/anime/tetrad-smerti-1535",
    "/anime/provozhayuschaya-v-posledniy-put-friren-52991",
    "/anime/reinkarnaciya-bezrabotnogo-istoriya-o-priklyucheniyah-v-drugom-mire-3-59193",
    "/anime/o-moem-pererozhdenii-v-sliz-4-59970", "/anime/vrata-shteyna-9253",
    "/anime/stalnoy-alhimik-bratstvo-5114", "/anime/tokiyskiy-gul-22319",
    "/anime/re-zero-zhizn-s-nulya-v-alternativnom-mire-31240",
    "/anime/mastera-mecha-onlayn-11757", "/anime/ohotnik-h-ohotnik-2011-11061",
    "/anime/bezdomnyy-bog-20507", "/anime/vanpanchmen-30276",
    "/anime/monolog-farmacevta-3-61987", "/anime/rebenok-idola-3-60058",
    "/anime/adskiy-ray-2-55825", "/anime/chernyy-klever-2-61967",
    "/anime/11-glaz-13419", "/anime/7-semyan-38735",
    "/anime/12-let-bienie-malenkogo-serdca-2-33419",
    "/anime/doktor-stoun-nauchnoe-buduschee-chast-3-62568",
    "/anime/boevoy-kontinent-2-neprevzoydennyy-klan-tan-51836",
    "/anime/bezuprechnyy-mir-47405", "/anime/raskolotaya-bitvoy-sineva-nebes-5-51039",
    "/anime/puteshestvie-k-bessmertiyu-5-63240", "/anime/protivostoyanie-svyatogo-55809",
    "/anime/povelitel-besstrashnogo-duha-41409", "/anime/okutyvaya-nebesa-51289",
    "/anime/skazanie-o-pastuhe-bogov-59953", "/anime/praktikuya-ci-sto-tysyach-let-54437"
  ];

  function getCleanTitle(path) {
    if (!path || path === '/') return 'Главная страница';
    if (path === '/catalog') return 'Каталог аниме';
    if (path === '/schedule') return 'Расписание';
    if (path === '/leaderboard') return 'Таблица лидеров';
    if (path === '/news') return 'Новости';
    if (path.startsWith('/catalog/genre/')) {
      const g = path.replace('/catalog/genre/', '').replace(/\/$/, '');
      return `Жанр: ${g.charAt(0).toUpperCase() + g.slice(1)}`;
    }
    if (path.startsWith('/anime/')) {
      const slug = path.replace('/anime/', '').replace(/-\d+$/, '').replace(/-[a-zA-Z0-9]{5,}$/, '');
      const subs = [
        ['sch', 'щ'], ['sh', 'ш'], ['ch', 'ч'], ['zh', 'ж'],
        ['ts', 'ц'], ['yu', 'ю'], ['ya', 'я'], ['yo', 'ё'],
        ['ye', 'е'], ['kh', 'х'], ['iy', 'ий'], ['yy', 'ый'],
        ['ey', 'ей'], ['oy', 'ой'], ['ay', 'ай'], ['uy', 'уй'],
        ['a', 'а'], ['b', 'б'], ['v', 'в'], ['g', 'г'], ['d', 'д'],
        ['e', 'е'], ['z', 'з'], ['i', 'и'], ['y', 'ы'], ['k', 'к'],
        ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'],
        ['r', 'р'], ['s', 'с'], ['t', 'т'], ['u', 'у'], ['f', 'ф'],
        ['h', 'х'], ['c', 'к']
      ];
      return slug.split('-').map(w => {
        let r = w.toLowerCase();
        for (const [en, ru] of subs) r = r.replaceAll(en, ru);
        return r.charAt(0).toUpperCase() + r.slice(1);
      }).join(' ');
    }
    return path;
  }

  const CSS = `
    #aon-pk-widget-root {
      position: fixed; bottom: 24px; right: 24px; z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #f4f4f5; user-select: none; font-size: 13px; line-height: 1.4;
    }
    .aon-pk-badge-btn {
      display: flex; align-items: center; gap: 8px;
      background: rgba(18, 18, 26, 0.94); border: 1px solid rgba(249, 115, 22, 0.45);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(249, 115, 22, 0.2);
      backdrop-filter: blur(12px); padding: 8px 14px; border-radius: 9999px;
      cursor: pointer; transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); color: #fff;
    }
    .aon-pk-badge-btn:hover {
      transform: translateY(-2px) scale(1.04); border-color: rgba(249, 115, 22, 0.85);
      box-shadow: 0 10px 36px rgba(0, 0, 0, 0.7), 0 0 24px rgba(249, 115, 22, 0.4);
    }
    .aon-pk-badge-icon { font-size: 18px; line-height: 1; }
    .aon-pk-badge-text { font-weight: 700; font-size: 13px; }
    .aon-pk-badge-count {
      background: #f97316; color: #000; font-weight: 800; padding: 2px 7px;
      border-radius: 12px; font-size: 11px;
    }
    .aon-pk-card {
      width: 340px; background: rgba(18, 18, 26, 0.96); border: 1px solid rgba(249, 115, 22, 0.4);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8), 0 0 28px rgba(249, 115, 22, 0.15);
      backdrop-filter: blur(16px); border-radius: 16px; overflow: hidden;
      display: flex; flex-direction: column; animation: aon-pk-pop 0.25s cubic-bezier(0.34, 1.35, 0.64, 1) both;
    }
    @keyframes aon-pk-pop {
      from { opacity: 0; transform: translateY(12px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .aon-pk-header {
      padding: 12px 14px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(168, 85, 247, 0.1));
      border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; align-items: center; justify-content: space-between;
    }
    .aon-pk-title-wrap { display: flex; align-items: center; gap: 8px; }
    .aon-pk-title { font-size: 13px; font-weight: 800; color: #ffedd5; }
    .aon-pk-pulse { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e; }
    .aon-pk-pulse.scanning { background: #f97316; box-shadow: 0 0 10px #f97316; animation: aon-pk-blink 1s infinite alternate; }
    .aon-pk-pulse.sleeping { background: #a855f7; box-shadow: 0 0 8px #a855f7; animation: none; }
    @keyframes aon-pk-blink { from { opacity: 0.4; } to { opacity: 1; } }
    .aon-pk-close-btn { background: none; border: none; color: #a1a1aa; cursor: pointer; padding: 4px; font-size: 16px; }
    .aon-pk-close-btn:hover { color: #fff; }
    .aon-pk-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px 14px 6px; }
    .aon-pk-stat-box { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 10px; padding: 8px 10px; text-align: center; }
    .aon-pk-stat-val { font-size: 17px; font-weight: 800; color: #f97316; }
    .aon-pk-stat-lbl { font-size: 10px; color: #a1a1aa; text-transform: uppercase; font-weight: 600; margin-top: 2px; }
    .aon-pk-timer-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 14px; font-size: 11px; color: #a1a1aa; }
    .aon-pk-timer-val { color: #cbd5e1; font-weight: 700; }
    .aon-pk-hour-status {
      margin: 4px 14px; padding: 7px 10px; border-radius: 8px; background: rgba(168, 85, 247, 0.12);
      border: 1px solid rgba(168, 85, 247, 0.35); color: #d8b4fe; font-size: 11px; font-weight: 700; text-align: center;
    }
    
    .aon-pk-locations-wrap {
      margin: 6px 14px 8px; background: rgba(249, 115, 22, 0.04);
      border: 1px solid rgba(249, 115, 22, 0.2); border-radius: 10px; overflow: hidden;
    }
    .aon-pk-locations-header {
      padding: 7px 10px; background: rgba(249, 115, 22, 0.08); font-weight: 700;
      font-size: 11px; color: #fed7aa; display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid rgba(249, 115, 22, 0.12);
    }
    .aon-pk-locations-list {
      max-height: 120px; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px;
    }
    .aon-pk-loc-link {
      display: flex; align-items: center; justify-content: space-between; padding: 6px 8px;
      background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 6px; color: #e4e4e7; text-decoration: none; font-size: 11px; transition: all 0.15s;
    }
    .aon-pk-loc-link:hover {
      background: rgba(249, 115, 22, 0.14); border-color: rgba(249, 115, 22, 0.4); color: #fff; transform: translateX(2px);
    }
    .aon-pk-loc-title {
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; color: #f4f4f5; max-width: 175px;
    }
    .aon-pk-loc-badge {
      background: rgba(249, 115, 22, 0.25); color: #fb923c; font-size: 10px; font-weight: 800; padding: 1px 5px; border-radius: 4px;
    }
    .aon-pk-empty-loc { padding: 12px 8px; text-align: center; font-size: 11px; color: #71717a; }

    .aon-pk-progress-wrap { padding: 4px 14px 8px; }
    .aon-pk-progress-bar { height: 6px; background: rgba(255, 255, 255, 0.08); border-radius: 9999px; overflow: hidden; }
    .aon-pk-progress-fill { height: 100%; background: linear-gradient(90deg, #f97316, #fb923c); width: 0%; transition: width 0.2s ease; }
    .aon-pk-progress-status { font-size: 11px; color: #fb923c; margin-top: 4px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .aon-pk-actions { display: flex; flex-direction: column; gap: 6px; padding: 6px 14px; }
    .aon-pk-btn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 12px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; border: none; }
    .aon-pk-btn-primary { background: linear-gradient(135deg, #f97316, #ea580c); color: #fff; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35); }
    .aon-pk-btn-primary:hover { background: linear-gradient(135deg, #fb923c, #f97316); transform: translateY(-1px); }
    .aon-pk-btn-secondary { background: rgba(255, 255, 255, 0.06); color: #e4e4e7; border: 1px solid rgba(255, 255, 255, 0.1); }
    .aon-pk-btn-secondary:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
    .aon-pk-btn-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .aon-pk-toggles { padding: 8px 14px; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid rgba(255, 255, 255, 0.06); border-bottom: 1px solid rgba(255, 255, 255, 0.06); margin-top: 4px; }
    .aon-pk-toggle-row { display: flex; align-items: center; justify-content: space-between; font-size: 12px; cursor: pointer; }
    .aon-pk-toggle-label { color: #d4d4d8; display: flex; align-items: center; gap: 6px; }
    .aon-pk-switch { position: relative; width: 34px; height: 18px; background: rgba(255, 255, 255, 0.15); border-radius: 9999px; transition: background 0.2s; }
    .aon-pk-switch.active { background: #f97316; }
    .aon-pk-switch-thumb { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; background: #fff; border-radius: 50%; transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .aon-pk-switch.active .aon-pk-switch-thumb { transform: translateX(16px); }
    .aon-pk-log-wrap { padding: 8px 14px 12px; max-height: 90px; overflow-y: auto; font-size: 11px; }
    .aon-pk-log-header { font-weight: 700; color: #71717a; text-transform: uppercase; font-size: 10px; margin-bottom: 4px; }
    .aon-pk-log-list { display: flex; flex-direction: column; gap: 4px; }
    .aon-pk-log-item { color: #a1a1aa; padding: 3px 6px; border-radius: 4px; background: rgba(255, 255, 255, 0.02); display: flex; justify-content: space-between; }
    .aon-pk-log-item.success { color: #4ade80; background: rgba(34, 197, 94, 0.08); }
    .aon-pk-shop-link { display: block; text-align: center; padding: 8px; color: #fb923c; text-decoration: none; font-weight: 700; font-size: 11px; background: rgba(249, 115, 22, 0.06); border-top: 1px solid rgba(249, 115, 22, 0.15); }
    .aon-pk-toast {
      position: fixed; top: 32px; left: 50%; transform: translateX(-50%) translateY(-20px);
      background: rgba(18, 18, 26, 0.96); border: 1px solid rgba(249, 115, 22, 0.6);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7), 0 0 20px rgba(249, 115, 22, 0.3);
      backdrop-filter: blur(12px); color: #fff; padding: 10px 20px; border-radius: 9999px;
      font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 10px;
      z-index: 1000000; opacity: 0; pointer-events: none; transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .aon-pk-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = CSS + `
/* cards.css — Стили для быстрого автооткрытия карточек на AnimeOn */
/* cards.css — Стили для быстрого автооткрытия карточек на AnimeOn */

#aon-cards-widget {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 440px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 48px);
  background: rgba(15, 16, 22, 0.96);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(168, 85, 247, 0.3);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(168, 85, 247, 0.2);
  color: #f4f4f5;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  z-index: 9999999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
  user-select: none;
}

#aon-cards-widget.minimized {
  max-height: 48px;
  overflow: hidden;
}

#aon-cards-widget.hidden {
  display: none !important;
}

/* Шапка виджета */
.aon-cards-header {
  padding: 12px 16px;
  background: linear-gradient(90deg, rgba(168, 85, 247, 0.18) 0%, rgba(249, 115, 22, 0.12) 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: grab;
}

.aon-cards-header:active {
  cursor: grabbing;
}

.aon-cards-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.aon-cards-title-icon {
  font-size: 20px;
  filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.8));
}

.aon-cards-title {
  font-weight: 800;
  font-size: 14px;
  letter-spacing: 0.2px;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 6px;
}

.aon-cards-tag {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(168, 85, 247, 0.25);
  color: #d8b4fe;
  border: 1px solid rgba(168, 85, 247, 0.4);
}

.aon-cards-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.aon-cards-btn-icon {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a1a1aa;
  border-radius: 8px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 13px;
}

.aon-cards-btn-icon:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

/* Балансы */
.aon-cards-balances {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.25);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.aon-cards-bal-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
}

.aon-cards-bal-label {
  font-size: 10px;
  color: #a1a1aa;
  text-transform: uppercase;
  font-weight: 600;
}

.aon-cards-bal-val {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  margin-top: 2px;
}

.aon-cards-bal-val.animon { color: #f59e0b; }
.aon-cards-bal-val.dust { color: #06b6d4; }
.aon-cards-bal-val.cards { color: #a855f7; }

/* Тело виджета со скроллом */
.aon-cards-body {
  padding: 14px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 480px;
}

/* Блок ежедневного бустера */
.aon-cards-daily-box {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(16, 185, 129, 0.05) 100%);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.aon-cards-daily-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.aon-cards-daily-title {
  font-weight: 700;
  font-size: 12px;
  color: #4ade80;
  display: flex;
  align-items: center;
  gap: 5px;
}

.aon-cards-daily-desc {
  font-size: 11px;
  color: #a1a1aa;
}

.aon-cards-daily-btn {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  border: none;
  color: #fff;
  font-weight: 700;
  font-size: 11px;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.3);
}

.aon-cards-daily-btn:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.aon-cards-daily-btn:disabled {
  background: rgba(255, 255, 255, 0.1);
  color: #71717a;
  box-shadow: none;
  cursor: default;
  transform: none;
}

/* Инвентарь сохраненных паков */
.aon-cards-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.aon-cards-inv-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.aon-cards-inv-item {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  transition: background 0.15s ease;
}

.aon-cards-inv-item:hover {
  background: rgba(255, 255, 255, 0.07);
}

.aon-cards-inv-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.aon-cards-inv-name {
  font-weight: 600;
  color: #f1f5f9;
  font-size: 12px;
}

.aon-cards-inv-count {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.35);
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
}

.aon-cards-inv-actions {
  display: flex;
  gap: 5px;
}

.aon-cards-btn-small {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #e2e8f0;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.aon-cards-btn-small:hover {
  background: rgba(168, 85, 247, 0.3);
  border-color: rgba(168, 85, 247, 0.5);
  color: #fff;
}

.aon-cards-empty {
  text-align: center;
  padding: 16px;
  color: #71717a;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
  border: 1px dashed rgba(255, 255, 255, 0.06);
}

/* Главная кнопка открытия */
.aon-cards-main-action {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.aon-cards-btn-open-all {
  flex: 1;
  background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%);
  border: none;
  color: #fff;
  font-weight: 800;
  font-size: 13px;
  padding: 10px 16px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 15px rgba(168, 85, 247, 0.35);
  transition: all 0.2s ease;
}

.aon-cards-btn-open-all:hover {
  filter: brightness(1.15);
  box-shadow: 0 4px 20px rgba(168, 85, 247, 0.5);
  transform: translateY(-1px);
}

.aon-cards-btn-open-all:disabled {
  background: rgba(255, 255, 255, 0.1);
  color: #71717a;
  box-shadow: none;
  cursor: default;
  transform: none;
}

.aon-cards-btn-stop {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #f87171;
  font-weight: 700;
  font-size: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: none;
}

.aon-cards-btn-stop:hover {
  background: rgba(239, 68, 68, 0.35);
  color: #fff;
}

/* Настройки и опции */
.aon-cards-options {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
}

.aon-cards-opt-item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #cbd5e1;
}

.aon-cards-opt-item input[type="checkbox"] {
  accent-color: #a855f7;
  cursor: pointer;
}

.aon-cards-speed-select {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 6px;
  cursor: pointer;
  outline: none;
}

/* Прогресс открытия */
.aon-cards-progress-wrap {
  display: none;
  flex-direction: column;
  gap: 4px;
}

.aon-cards-progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
}

.aon-cards-progress-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #a855f7 0%, #f97316 100%);
  border-radius: 999px;
  transition: width 0.2s ease;
}

.aon-cards-progress-text {
  font-size: 11px;
  color: #a1a1aa;
  display: flex;
  justify-content: space-between;
}

/* Выпавшие карты (Live Feed) */
.aon-cards-drop-feed {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.aon-cards-feed-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
  padding: 4px;
}

.aon-cards-card-item {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  animation: cardDropIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes cardDropIn {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.aon-cards-card-item:hover {
  transform: translateY(-2px) scale(1.03);
  z-index: 2;
}

.aon-cards-card-thumb {
  width: 100%;
  aspect-ratio: 2/3;
  object-fit: cover;
  border-radius: 5px;
  background: #18181b;
}

.aon-cards-card-name {
  font-size: 10px;
  font-weight: 600;
  color: #f1f5f9;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.aon-cards-card-tier {
  font-size: 8px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 1px 4px;
  border-radius: 4px;
  margin-top: 2px;
}

/* Цвета редкостей карт */
.tier-1 { border-color: #a39a96; color: #d4d4d8; }
.tier-2 { border-color: #e9dcc6; color: #f5f5f4; box-shadow: 0 0 6px rgba(233, 220, 198, 0.2); }
.tier-3 { border-color: #6fd99a; color: #4ade80; box-shadow: 0 0 8px rgba(111, 217, 154, 0.25); }
.tier-4 { border-color: #6aa8ff; color: #60a5fa; box-shadow: 0 0 10px rgba(106, 168, 255, 0.35); }
.tier-5 { border-color: #c79bff; color: #c084fc; box-shadow: 0 0 14px rgba(199, 155, 255, 0.5); }
.tier-6 { border-color: #f2b24a; color: #fbbf24; box-shadow: 0 0 16px rgba(242, 178, 74, 0.6); }
.tier-7 { border-color: #cfe6ff; color: #93c5fd; box-shadow: 0 0 18px rgba(207, 230, 255, 0.7); }
.tier-8 { border-color: #e6e1ff; color: #a78bfa; box-shadow: 0 0 20px rgba(230, 225, 255, 0.8); }
.tier-9 { border-color: #ff4d6d; color: #f43f5e; box-shadow: 0 0 24px rgba(255, 77, 109, 0.9); }

.aon-cards-new-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background: #f97316;
  color: #fff;
  font-size: 8px;
  font-weight: 800;
  padding: 1px 3px;
  border-radius: 3px;
}

/* Кнопка быстрого вызова на сайте (перетаскиваемая, скрываемая, сворачиваемая) */
#aon-cards-trigger-btn {
  position: fixed;
  bottom: 80px;
  right: 16px;
  background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 800;
  cursor: grab;
  box-shadow: 0 8px 24px rgba(168, 85, 247, 0.5);
  z-index: 9999998;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
  touch-action: none;
  transition: box-shadow 0.2s ease;
}

#aon-cards-trigger-btn:active {
  cursor: grabbing;
}

#aon-cards-trigger-btn:hover {
  box-shadow: 0 10px 30px rgba(168, 85, 247, 0.7);
}

#aon-cards-trigger-btn.hidden {
  display: none !important;
}

/* Внутренний блок кнопки */
.aon-cards-trigger-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

/* Кнопки управления (свернуть / скрыть) */
.aon-cards-trigger-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 2px;
  padding-left: 6px;
  border-left: 1px solid rgba(255, 255, 255, 0.3);
}

.aon-cards-trigger-btn-action {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #fff;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease;
}

.aon-cards-trigger-btn-action:hover,
.aon-cards-trigger-btn-action:active {
  background: rgba(255, 255, 255, 0.45);
}

/* Свернутый режим — компактная круглая иконка */
#aon-cards-trigger-btn.collapsed {
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 50%;
  justify-content: center;
  align-items: center;
}

#aon-cards-trigger-btn.collapsed .aon-cards-trigger-label,
#aon-cards-trigger-btn.collapsed .aon-cards-trigger-controls {
  display: none !important;
}

#aon-cards-trigger-btn.collapsed .aon-cards-trigger-inner {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

#aon-cards-trigger-btn.collapsed .aon-cards-trigger-icon {
  font-size: 20px;
}

#aon-cards-trigger-btn.collapsed .aon-cards-badge-pill {
  position: absolute;
  top: -4px;
  right: -4px;
  font-size: 10px;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 999px;
  min-width: 16px;
  text-align: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.aon-cards-badge-pill {
  background: #fff;
  color: #a855f7;
  font-size: 10px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 999px;
}

/* Мобильная адаптация */
@media (max-width: 640px) {
  #aon-cards-widget {
    width: calc(100vw - 16px);
    max-width: 420px;
    right: 8px;
    bottom: 8px;
    max-height: 82vh;
  }
}
`;
  document.head.appendChild(styleEl);

  function loadOpt(k, def) {
    try {
      const v = localStorage.getItem('aon_pk_' + k);
      return v !== null ? JSON.parse(v) : def;
    } catch { return def; }
  }
  function saveOpt(k, v) {
    try { localStorage.setItem('aon_pk_' + k, JSON.stringify(v)); } catch {}
  }

  const hourKey = new Date().toISOString().slice(0, 13);
  let hourScanState = loadOpt('hourScanState', {
    hourKey: hourKey,
    consecutiveZeroScans: 0,
    deepScanDone: false,
    hourCompleted: false
  });

  if (hourScanState.hourKey !== hourKey) {
    hourScanState = { hourKey, consecutiveZeroScans: 0, deepScanDone: false, hourCompleted: false };
    saveOpt('hourScanState', hourScanState);
  }

  const state = {
    alwaysCollect: loadOpt('alwaysCollect', true),
    autoCollect: loadOpt('autoCollect', true),
    sound: loadOpt('sound', true),
    balance: loadOpt('balance', 0),
    caughtToday: loadOpt('caughtToday', 0),
    dailyCap: loadOpt('dailyCap', 60),
    lastHourKey: loadOpt('lastHourKey', null),
    currentHourPumpkins: loadOpt('currentHourPumpkins', []),
    isScanning: false,
    shouldStop: false,
    processed: new Set()
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  let audioCtx = null;
  function playSound() {
    if (!state.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
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
    } catch {}
  }

  let toastTimer = null;
  function showToast(text, sub = '') {
    let toast = document.getElementById('aon-pk-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'aon-pk-toast';
      toast.className = 'aon-pk-toast';
      toast.innerHTML = `<span style="font-size:20px">🎃</span><span id="aon-pk-toast-msg"></span>`;
      document.body.appendChild(toast);
    }
    document.getElementById('aon-pk-toast-msg').innerHTML = `<span>${text}</span> ${sub ? `<span style="color:#f97316;margin-left:6px">${sub}</span>` : ''}`;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3800);
  }

  function registerPumpkin(path, pumpkinId, amount = 1) {
    const curHour = new Date().toISOString().slice(0, 13);
    if (state.lastHourKey !== curHour) {
      state.lastHourKey = curHour;
      state.currentHourPumpkins = [];
      saveOpt('lastHourKey', curHour);
    }

    const title = getCleanTitle(path);
    const exists = state.currentHourPumpkins.some(p => p.path === path || (pumpkinId && p.id === pumpkinId));
    if (!exists) {
      state.currentHourPumpkins.unshift({
        id: pumpkinId || String(Date.now()),
        path: path,
        url: 'https://animeon.cc' + path,
        title: title,
        amount: amount,
        foundAt: Date.now()
      });
      saveOpt('currentHourPumpkins', state.currentHourPumpkins);
    }

    // caughtToday обновляется только с сервера в syncWithServer()

    renderLocations();
    updateHud();
  }

    const EXCLUDED_PAGE_PREFIXES = ['/event/pumpkins', '/tv', '/settings', '/premium', '/login', '/register', '/api/', '/media/'];

  async function syncWithServer() {
    try {
      // 1. Проверяем реальное состояние лимитов (как на https://animeon.cc/event/pumpkins)
      const stateResp = await fetch('/api/event/pumpkins/state?path=/', { credentials: 'include' });
      if (stateResp.ok) {
        const stateData = await stateResp.json();
        if (typeof stateData.caught_today === 'number') state.caughtToday = stateData.caught_today;
        if (typeof stateData.daily_cap === 'number') state.dailyCap = stateData.daily_cap;
        if (typeof stateData.caught_hour === 'number') state.caughtThisHour = stateData.caught_hour;
        if (typeof stateData.hourly_cap === 'number') state.hourlyCap = stateData.hourly_cap;
        saveOpt('caughtToday', state.caughtToday);
      }

      // 2. Реальный баланс тыкв из магазина
      const shopResp = await fetch('/api/event/pumpkins/shop', { credentials: 'include' });
      if (shopResp.ok) {
        const shopData = await shopResp.json();
        if (typeof shopData.balance === 'number') {
          state.balance = shopData.balance;
          saveOpt('balance', state.balance);
        }
      }

      // 3. Реальная история сбора с сервера
      const histResp = await fetch('/api/event/pumpkins/history', { credentials: 'include' });
      if (histResp.ok) {
        const histData = await histResp.json();
        if (Array.isArray(histData.catches)) {
          const currentHourStart = new Date().setMinutes(0, 0, 0);
          const currentHourCatches = histData.catches.filter(c => {
            const t = typeof c.created_at === 'string' ? Date.parse(c.created_at) : (c.created_at * 1000 || c.at || 0);
            return t >= currentHourStart;
          });
          state.currentHourPumpkins = currentHourCatches.map(c => ({
            id: c.id || String(c.at),
            path: c.path || '/',
            url: 'https://animeon.cc' + (c.path || '/'),
            title: getCleanTitle(c.path || '/'),
            amount: c.amount || 1,
            foundAt: typeof c.created_at === 'string' ? Date.parse(c.created_at) : (c.created_at * 1000 || c.at || Date.now())
          }));
          saveOpt('currentHourPumpkins', state.currentHourPumpkins);
        }
      }

      renderLocations();
      updateHud();
    } catch (e) {}
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

    function initDomWatcher() {
    let debounceTimer = null;

    async function checkCurrentPageForPumpkin() {
      if (!state.autoCollect) return;

      const currentPath = window.location.pathname || '/';
      // Исключаем страницы без спавна тыкв (там только статические иконки/баннеры)
      if (EXCLUDED_PAGE_PREFIXES.some(p => currentPath === p || currentPath.startsWith(p + '/'))) {
        return;
      }

      // Настоящая тыква события спавнится ИСКЛЮЧИТЕЛЬНО внутри .pk-root (компонент PumpkinOverlay)
      const rootEl = document.querySelector('.pk-root');
      if (!rootEl) return;

      const pumpkinBtn = rootEl.querySelector('button.pk-btn') || rootEl.querySelector('button');
      if (!pumpkinBtn || pumpkinBtn.dataset.aonCollected) return;

      pumpkinBtn.dataset.aonCollected = 'processing';
      console.log('[Pumpkin Hunter] Обнаружена настоящая тыква ивента (.pk-root), собираем!');

      let claimed = false;
      try {
        const curResp = await fetch(`/api/event/pumpkins/state?path=${encodeURIComponent(currentPath)}`, { credentials: 'include' });
        if (curResp.ok) {
          const curData = await curResp.json();
          if (!curData.pumpkin && curData.fx) curData.pumpkin = decodePumpkinFx(curData.fx);
          if (curData.pumpkin && !curData.pumpkin.claimed) {
            const claimRes = await claimViaApi(currentPath, curData.pumpkin.id, curData.claim_min_ms);
            if (!claimRes.error) {
              claimed = true;
              pumpkinBtn.dataset.aonCollected = 'done';
              const title = getCleanTitle(currentPath);
              playSound();
              showToast(`Собрана тыква на: ${title}!`, `+${claimRes.amount || 1}`);
              addLog(`✅ Собрано на ${title}!`, 'success');
              await syncWithServer();
              return;
            }
          }
        }
      } catch (err) {}

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

  async function claimViaApi(path, pId, minMs = 600) {
    try {
      await fetch('/api/event/pumpkins/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path, pumpkin_id: pId })
      });
      await sleep(Math.max(750, (minMs || 600) + 150));
      const res = await fetch('/api/event/pumpkins/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path, pumpkin_id: pId })
      });
      if (res.ok) {
        return await res.json();
      } else {
        const err = await res.json().catch(() => ({}));
        return { error: err.code || err.error || 'failed' };
      }
    } catch (e) {
      return { error: e.message };
    }
  }

  async function runHunter(mode = 'quick', isAuto = false) {
    if (state.isScanning) return;

    if (hourScanState.hourCompleted) {
      if (isAuto) {
        console.log('[Userscript] Час уже закрыт, отдых до смены часа.');
        return;
      }
      hourScanState.hourCompleted = false;
      saveOpt('hourScanState', hourScanState);
    }

    // Если в этом часе уже собрано 10 тыкв (или лимит)
    const currentListCount = (state.currentHourPumpkins || []).length;
    if (isAuto && currentListCount >= 10) {
      hourScanState.hourCompleted = true;
      saveOpt('hourScanState', hourScanState);
      updateHud();
      addLog(`😴 Все тыквы этого часа уже собраны (${currentListCount}/10). Отдых до смены часа.`);
      return;
    }

    state.isScanning = true;
    state.shouldStop = false;

    updateScanUi(true, mode === 'deep' ? 'Глубокий сбор...' : 'Быстрый сбор...');
    let paths = [...SEED_PATHS];

    if (mode === 'deep') {
      try {
        const sitemapResp = await fetch('/sitemap.xml');
        if (sitemapResp.ok) {
          const text = await sitemapResp.text();
          const matches = text.match(/<loc>https:\/\/animeon\.cc(\/anime\/[^<]+)<\/loc>/g) || [];
          const sitePaths = matches.map(m => m.replace(/<\/?loc>/g, '').replace('https://animeon.cc', ''));
          paths = Array.from(new Set([...paths, ...sitePaths]));
        }
      } catch {}
    }

    const limit = mode === 'deep' ? Math.min(200, paths.length) : Math.min(80, paths.length);
    const toScan = paths.slice(0, limit);
    let collectedCount = 0;
    let hitHourlyCap = false;

    addLog(`Запуск ${mode === 'deep' ? 'глубокого' : 'быстрого'} сбора (${limit} стр)...`);

    for (let i = 0; i < toScan.length; i++) {
      if (state.shouldStop) {
        addLog('Сбор приостановлен');
        break;
      }
      const p = toScan[i];
      const title = getCleanTitle(p);
      updateProgress(Math.round(((i + 1) / limit) * 100), `[${i + 1}/${limit}] ${title.slice(0, 22)}...`);

      try {
        const r = await fetch(`/api/event/pumpkins/state?path=${encodeURIComponent(p)}`, { credentials: 'include' });
        if (r.ok) {
          const j = await r.json();
          if (!j.pumpkin && j.fx) j.pumpkin = decodePumpkinFx(j.fx);
          if (typeof j.daily_cap === 'number') state.dailyCap = j.daily_cap;
          if (typeof j.caught_today === 'number') state.caughtToday = j.caught_today;

          if (j.hourly_cap > 0 && typeof j.caught_hour === 'number' && j.caught_hour >= j.hourly_cap) {
            hitHourlyCap = true;
            addLog(`🎉 Лимит часа достигнут (${j.caught_hour}/${j.hourly_cap})!`);
            break;
          }

          if (j.daily_cap > 0 && typeof j.caught_today === 'number' && j.caught_today >= j.daily_cap) {
            addLog(`🎉 Дневной лимит достигнут (${j.caught_today}/${j.daily_cap})!`);
            hourScanState.hourCompleted = true;
            saveOpt('hourScanState', hourScanState);
            break;
          }

          if (j.pumpkin && !j.pumpkin.claimed) {
            const pid = j.pumpkin.id;
            if (!state.processed.has(pid)) {
              state.processed.add(pid);
              addLog(`🎃 Найдена тыква: ${title}`);
              const claimRes = await claimViaApi(p, pid, j.claim_min_ms);
              if (!claimRes.error) {
                collectedCount++;
                state.balance = claimRes.balance || (state.balance + 1);
                saveOpt('balance', state.balance);

                registerPumpkin(p, pid, claimRes.amount || 1);
                playSound();
                showToast(`Поймана тыква: ${title}!`, `+${claimRes.amount || 1}`);
                addLog(`✅ Собрано на ${title}!`, 'success');
                updateHud();
              } else {
                addLog(`⚠️ ${claimRes.error}`);
                if (claimRes.error === 'pumpkin_hourly_cap') {
                  hitHourlyCap = true;
                  showToast('Лимит часа достигнут!');
                  break;
                }
                if (claimRes.error === 'pumpkin_daily_cap') {
                  showToast('Дневной лимит (60) достигнут!');
                  hourScanState.hourCompleted = true;
                  saveOpt('hourScanState', hourScanState);
                  break;
                }
              }
            }
          }
        }
      } catch {}

      await sleep(180);
    }

    state.isScanning = false;
    updateScanUi(false, collectedCount > 0 ? `Собрано: +${collectedCount} тыкв` : 'Проверка завершена');
    addLog(`🏁 Итог проверки: найдено +${collectedCount} тыкв`);

    // --- УМНАЯ ЛОГИКА ЗАВЕРШЕНИЯ ЧАСА ---
    // А. Лимит часа исчерпан
    const currentPumpkinsCount = (state.currentHourPumpkins || []).length;
    if (hitHourlyCap || currentPumpkinsCount >= 10) {
      hourScanState.hourCompleted = true;
      saveOpt('hourScanState', hourScanState);
      updateHud();
      addLog(`😴 Все тыквы часа собраны (${currentPumpkinsCount}/10). Отдых до смены часа.`);
      showToast('Все тыквы часа собраны! Отдых до смены часа.');
      return;
    }

    // Б. Финальный глубокий сбор завершен — после него БОЛЬШЕ НЕ СКАНИРОВАТЬ до конца часа
    if (mode === 'deep' || hourScanState.deepScanDone) {
      hourScanState.deepScanDone = true;
      hourScanState.hourCompleted = true;
      saveOpt('hourScanState', hourScanState);
      updateHud();
      addLog(`😴 Финальный глубокий сбор завершен (+${collectedCount} тыкв). Отдых до смены часа.`);
      showToast('Глубокий сбор завершен! Отдых до смены часа.');
      return;
    }

    // В. Обычная проверка
    if (collectedCount > 0) {
      hourScanState.consecutiveZeroScans = 0;
      saveOpt('hourScanState', hourScanState);
    } else {
      hourScanState.consecutiveZeroScans++;
      saveOpt('hourScanState', hourScanState);
      addLog(`🔍 Проверок без тыкв: ${hourScanState.consecutiveZeroScans}/2`);

      if (hourScanState.consecutiveZeroScans >= 2) {
        hourScanState.deepScanDone = true;
        saveOpt('hourScanState', hourScanState);
        addLog('🌐 2 проверки без тыкв! Запуск контрольного глубокого сбора (sitemap)...');
        showToast('2 проверки без тыкв! Запуск глубокого сбора...');
        setTimeout(() => runHunter('deep', false), 1500);
      }
    }
  }

  function renderLocations() {
    const listEl = document.getElementById('aon-pk-loc-list');
    const cntEl = document.getElementById('aon-pk-loc-cnt');
    const items = state.currentHourPumpkins || [];

    if (cntEl) cntEl.textContent = items.length;
    if (!listEl) return;

    if (items.length === 0) {
      listEl.innerHTML = `<div class="aon-pk-empty-loc">В этом часе тыквы пока не найдены.<br>Они появятся здесь сразу при сборе!</div>`;
      return;
    }

    listEl.innerHTML = items.map(p => {
      const timeStr = new Date(p.foundAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return `
        <a href="${p.url}" target="_blank" class="aon-pk-loc-link" title="Открыть страницу: ${p.path}">
          <span class="aon-pk-loc-title">🎃 ${p.title}</span>
          <span class="aon-pk-loc-badge">+${p.amount} · ${timeStr}</span>
        </a>
      `;
    }).join('');
  }

  function createWidget() {
    const root = document.createElement('div');
    root.id = 'aon-pk-widget-root';
    root.innerHTML = `
      <div id="aon-pk-badge" class="aon-pk-badge-btn">
        <span class="aon-pk-badge-icon">🎃</span>
        <span class="aon-pk-badge-text">Тыквы</span>
        <span id="aon-pk-badge-val" class="aon-pk-badge-count">${state.balance}</span>
      </div>
      <div id="aon-pk-card" class="aon-pk-card" style="display:none;">
        <div class="aon-pk-header">
          <div class="aon-pk-title-wrap">
            <span class="aon-pk-pulse" id="aon-pk-pulse"></span>
            <span class="aon-pk-title">AnimeOn Pumpkin Hunter 🎃</span>
          </div>
          <button id="aon-pk-close" class="aon-pk-close-btn">✕</button>
        </div>
        <div class="aon-pk-stats">
          <div class="aon-pk-stat-box">
            <div id="aon-pk-bal" class="aon-pk-stat-val">${state.balance}</div>
            <div class="aon-pk-stat-lbl">Баланс тыкв</div>
          </div>
          <div class="aon-pk-stat-box">
            <div id="aon-pk-today" class="aon-pk-stat-val">${state.caughtToday} / ${state.dailyCap || 60}</div>
            <div class="aon-pk-stat-lbl">Сегодня (лимит 60)</div>
          </div>
        </div>
        <div class="aon-pk-timer-row">
          <span>Смена часа (сброс локаций):</span>
          <span id="aon-pk-timer" class="aon-pk-timer-val">--:--</span>
        </div>
        
        <div id="aon-pk-status-bar" class="aon-pk-hour-status" style="display:none;">
          😴 Все тыквы часа собраны! Отдых до смены часа.
        </div>

        <div class="aon-pk-locations-wrap">
          <div class="aon-pk-locations-header">
            <span>📍 Локации тыкв этого часа (<span id="aon-pk-loc-cnt">0</span>)</span>
            <span style="font-size:10px;opacity:0.7">до смены часа</span>
          </div>
          <div id="aon-pk-loc-list" class="aon-pk-locations-list"></div>
        </div>

        <div class="aon-pk-progress-wrap" id="aon-pk-prog-box" style="display:none;">
          <div class="aon-pk-progress-bar"><div id="aon-pk-prog-fill" class="aon-pk-progress-fill"></div></div>
          <div id="aon-pk-prog-txt" class="aon-pk-progress-status">Подготовка...</div>
        </div>
        <div class="aon-pk-actions">
          <button id="aon-pk-btn-quick" class="aon-pk-btn aon-pk-btn-primary">⚡ Собрать тыквы сейчас</button>
          <button id="aon-pk-btn-deep" class="aon-pk-btn aon-pk-btn-secondary">🌐 Глубокий сбор (Карта сайта)</button>
          <button id="aon-pk-btn-cards" class="aon-pk-btn aon-pk-btn-cards">🎴 Автооткрытие карт</button>
          <button id="aon-pk-btn-stop" class="aon-pk-btn aon-pk-btn-danger" style="display:none;">⏹ Остановить сбор</button>
        </div>
        <div class="aon-pk-toggles">
          <div class="aon-pk-toggle-row" id="tog-always">
            <span class="aon-pk-toggle-label">🔥 Всегда собирать автоматически</span>
            <div class="aon-pk-switch ${state.alwaysCollect ? 'active' : ''}"><div class="aon-pk-switch-thumb"></div></div>
          </div>
          <div class="aon-pk-toggle-row" id="tog-auto">
            <span class="aon-pk-toggle-label">🎯 Автоклик на открытой странице</span>
            <div class="aon-pk-switch ${state.autoCollect ? 'active' : ''}"><div class="aon-pk-switch-thumb"></div></div>
          </div>
          <div class="aon-pk-toggle-row" id="tog-sound">
            <span class="aon-pk-toggle-label">🔔 Звуковой эффект</span>
            <div class="aon-pk-switch ${state.sound ? 'active' : ''}"><div class="aon-pk-switch-thumb"></div></div>
          </div>
        </div>
        <div class="aon-pk-log-wrap">
          <div class="aon-pk-log-header">Журнал событий</div>
          <div id="aon-pk-log-list" class="aon-pk-log-list"><div class="aon-pk-log-item">Автосбор активен</div></div>
        </div>
        <a href="/event/pumpkins" class="aon-pk-shop-link">🛒 Магазин ивента</a>
      </div>
    `;
    document.body.appendChild(root);

    const b = document.getElementById('aon-pk-badge');
    const c = document.getElementById('aon-pk-card');
    b.onclick = () => { b.style.display = 'none'; c.style.display = 'flex'; syncWithServer(); renderLocations(); };
    document.getElementById('aon-pk-close').onclick = () => { c.style.display = 'none'; b.style.display = 'flex'; };

    document.getElementById('aon-pk-btn-quick').onclick = () => runHunter('quick', false);
    document.getElementById('aon-pk-btn-deep').onclick = () => runHunter('deep', false);
    const cBtn = document.getElementById('aon-pk-btn-cards');
    if (cBtn) {
      cBtn.onclick = () => {
        if (window.location.pathname.startsWith('/cards')) {
          if (window.AnimeOnCards && window.AnimeOnCards.toggleWidget) window.AnimeOnCards.toggleWidget();
        } else {
          window.location.href = 'https://animeon.cc/cards';
        }
      };
    }
    document.getElementById('aon-pk-btn-stop').onclick = () => { state.shouldStop = true; };

    bindTog('tog-always', 'alwaysCollect');
    bindTog('tog-auto', 'autoCollect');
    bindTog('tog-sound', 'sound');

    // Таймер часа и автосброс
    let lastHour = new Date().getHours();
    setInterval(() => {
      const now = new Date();
      if (now.getHours() !== lastHour) {
        lastHour = now.getHours();
        state.currentHourPumpkins = [];
        saveOpt('currentHourPumpkins', []);

        hourScanState = {
          hourKey: new Date().toISOString().slice(0, 13),
          consecutiveZeroScans: 0,
          deepScanDone: false,
          hourCompleted: false
        };
        saveOpt('hourScanState', hourScanState);

        renderLocations();
        updateHud();
        if (state.alwaysCollect) runHunter('quick', true);
      }

      const el = document.getElementById('aon-pk-timer');
      if (!el) return;
      const nextHour = Math.ceil((now.getTime() + 1000) / 3600000) * 3600000;
      const diffSec = Math.max(0, Math.floor((nextHour - now.getTime()) / 1000));
      const m = Math.floor(diffSec / 60);
      const s = diffSec % 60;
      el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, 1000);

    renderLocations();
  }

  function bindTog(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    el.onclick = () => {
      state[key] = !state[key];
      saveOpt(key, state[key]);
      el.querySelector('.aon-pk-switch').classList.toggle('active', state[key]);
    };
  }

  function updateHud() {
    const bVal = document.getElementById('aon-pk-badge-val');
    const bal = document.getElementById('aon-pk-bal');
    const tod = document.getElementById('aon-pk-today');
    const bar = document.getElementById('aon-pk-status-bar');
    const pulse = document.getElementById('aon-pk-pulse');

    if (bVal) bVal.textContent = state.balance;
    if (bal) bal.textContent = state.balance;
    if (tod) tod.textContent = `${state.caughtToday} / ${state.dailyCap || 60}`;

    if (bar) bar.style.display = hourScanState.hourCompleted ? 'block' : 'none';
    if (pulse && !state.isScanning) {
      if (hourScanState.hourCompleted) pulse.classList.add('sleeping');
      else pulse.classList.remove('sleeping');
    }
  }

  function updateScanUi(scanning, msg) {
    const p = document.getElementById('aon-pk-pulse');
    const box = document.getElementById('aon-pk-prog-box');
    const q = document.getElementById('aon-pk-btn-quick');
    const d = document.getElementById('aon-pk-btn-deep');
    const s = document.getElementById('aon-pk-btn-stop');
    const txt = document.getElementById('aon-pk-prog-txt');
    if (p) {
      if (scanning) { p.classList.add('scanning'); p.classList.remove('sleeping'); }
      else { p.classList.remove('scanning'); if (hourScanState.hourCompleted) p.classList.add('sleeping'); }
    }
    if (box) box.style.display = scanning ? 'block' : 'none';
    if (q) q.style.display = scanning ? 'none' : 'flex';
    if (d) d.style.display = scanning ? 'none' : 'flex';
    if (s) s.style.display = scanning ? 'flex' : 'none';
    if (txt && msg) txt.textContent = msg;
  }

  function updateProgress(pct, msg) {
    const f = document.getElementById('aon-pk-prog-fill');
    const txt = document.getElementById('aon-pk-prog-txt');
    if (f) f.style.width = `${pct}%`;
    if (txt && msg) txt.textContent = msg;
  }

  function addLog(msg, type = '') {
    const l = document.getElementById('aon-pk-log-list');
    if (!l) return;
    const it = document.createElement('div');
    it.className = `aon-pk-log-item ${type}`;
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    it.innerHTML = `<span>${msg}</span><span style="opacity:0.6;font-size:9px">${time}</span>`;
    l.insertBefore(it, l.firstChild);
    while (l.children.length > 25) l.removeChild(l.lastChild);
  }

  // Запуск
  initDomWatcher();
  createWidget();
  syncWithServer();

  setTimeout(() => {
    if (state.alwaysCollect && !hourScanState.hourCompleted) runHunter('quick', true);
  }, 2500);

  setInterval(() => {
    if (state.alwaysCollect && !state.isScanning && !hourScanState.hourCompleted) runHunter('quick', true);
  }, 5 * 60 * 1000);

  console.log('[AnimeOn Hunter & Cards v1.3] Активен');

  // === МОДУЛЬ АВТООТКРЫТИЯ КАРТОЧЕК ===
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

  // --- Универсальное перетаскивание (Mouse + Touch) ---
  function makeDraggable(el, handle = el, storageKey = null, onClickCallback = null) {
    if (!el || !handle) return;
    let isDragging = false;
    let startX = 0, startY = 0;
    let initLeft = 0, initTop = 0;
    let hasMoved = false;

    // Восстанавливаем сохраненную позицию
    if (storageKey) {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
          const maxL = Math.max(10, window.innerWidth - (el.offsetWidth || 140) - 10);
          const maxT = Math.max(10, window.innerHeight - (el.offsetHeight || 44) - 10);
          const left = Math.min(Math.max(8, saved.left), maxL);
          const top = Math.min(Math.max(8, saved.top), maxT);
          el.style.left = left + 'px';
          el.style.top = top + 'px';
          el.style.right = 'auto';
          el.style.bottom = 'auto';
        }
      } catch (e) {}
    }

    function onPointerDown(e) {
      // Игнорируем клики по кнопкам управления внутри плашки
      if (e.target.closest('button, .aon-cards-trigger-btn-action, .aon-cards-btn-icon')) return;

      const pointer = e.touches ? e.touches[0] : e;
      startX = pointer.clientX;
      startY = pointer.clientY;

      const rect = el.getBoundingClientRect();
      initLeft = rect.left;
      initTop = rect.top;
      hasMoved = false;
      isDragging = true;

      el.style.transition = 'none';

      window.addEventListener('mousemove', onPointerMove, { passive: false });
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('touchend', onPointerUp);
      window.addEventListener('touchcancel', onPointerUp);
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      const pointer = e.touches ? e.touches[0] : e;
      const dx = pointer.clientX - startX;
      const dy = pointer.clientY - startY;

      if (!hasMoved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        hasMoved = true;
      }

      if (hasMoved) {
        if (e.cancelable) e.preventDefault(); // Предотвращаем скролл страницы на телефоне!

        const w = el.offsetWidth || 140;
        const h = el.offsetHeight || 44;
        const maxLeft = Math.max(8, window.innerWidth - w - 8);
        const maxTop = Math.max(8, window.innerHeight - h - 8);

        const newLeft = Math.max(8, Math.min(maxLeft, initLeft + dx));
        const newTop = Math.max(8, Math.min(maxTop, initTop + dy));

        el.style.right = 'auto';
        el.style.bottom = 'auto';
        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';
      }
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      el.style.transition = '';

      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      window.removeEventListener('touchcancel', onPointerUp);

      if (hasMoved) {
        if (storageKey) {
          try {
            const rect = el.getBoundingClientRect();
            localStorage.setItem(storageKey, JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
          } catch (err) {}
        }
      } else {
        if (typeof onClickCallback === 'function') {
          onClickCallback(e);
        }
      }
    }

    handle.addEventListener('mousedown', onPointerDown);
    handle.addEventListener('touchstart', onPointerDown, { passive: true });
  }

  // --- Инициализация и создание UI виджета ---
  function createCardsWidget() {
    if (document.getElementById('aon-cards-widget')) return;

    // Плавающая кнопка вызова (перетаскиваемая, сворачиваемая, скрываемая)
    const triggerBtn = document.createElement('div');
    triggerBtn.id = 'aon-cards-trigger-btn';
    triggerBtn.innerHTML = `
      <div class="aon-cards-trigger-inner" id="aon-cards-trigger-inner">
        <span class="aon-cards-trigger-icon">🎴</span>
        <span class="aon-cards-trigger-label">Быстрое открытие</span>
        <span class="aon-cards-badge-pill" id="aon-cards-total-packs-pill">0 паков</span>
      </div>
      <div class="aon-cards-trigger-controls">
        <button id="aon-cards-trigger-min-btn" class="aon-cards-trigger-btn-action" title="Свернуть в мини-кнопку">−</button>
        <button id="aon-cards-trigger-close-btn" class="aon-cards-trigger-btn-action" title="Скрыть кнопку">✕</button>
      </div>
    `;

    try {
      if (localStorage.getItem('aon_cards_trigger_collapsed') === 'true') {
        triggerBtn.classList.add('collapsed');
      }
      if (sessionStorage.getItem('aon_cards_trigger_hidden') === 'true') {
        triggerBtn.classList.add('hidden');
      }
    } catch (e) {}

    function onTriggerClick(e) {
      if (triggerBtn.classList.contains('collapsed')) {
        // Если была свернута в кружок — разворачиваем
        triggerBtn.classList.remove('collapsed');
        try { localStorage.setItem('aon_cards_trigger_collapsed', 'false'); } catch (err) {}
        const pill = document.getElementById('aon-cards-total-packs-pill');
        if (pill) {
          const packs = pill.getAttribute('data-packs') || '0';
          pill.textContent = `${packs} паков`;
        }
        return;
      }

      const w = document.getElementById('aon-cards-widget');
      if (w) {
        w.classList.toggle('hidden');
        if (!w.classList.contains('hidden')) {
          refreshCardsData();
        }
      }
    }

    makeDraggable(triggerBtn, triggerBtn, 'aon_cards_trigger_pos', onTriggerClick);
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

    // Кнопки сворачивания и скрытия плавающей плашки
    const minTriggerBtn = document.getElementById('aon-cards-trigger-min-btn');
    const closeTriggerBtn = document.getElementById('aon-cards-trigger-close-btn');

    if (minTriggerBtn && triggerBtn) {
      minTriggerBtn.onclick = (e) => {
        e.stopPropagation();
        triggerBtn.classList.toggle('collapsed');
        const isCol = triggerBtn.classList.contains('collapsed');
        try { localStorage.setItem('aon_cards_trigger_collapsed', isCol ? 'true' : 'false'); } catch (err) {}
        const pill = document.getElementById('aon-cards-total-packs-pill');
        if (pill) {
          const packs = pill.getAttribute('data-packs') || '0';
          pill.textContent = isCol ? packs : `${packs} паков`;
        }
      };
    }

    if (closeTriggerBtn && triggerBtn) {
      closeTriggerBtn.onclick = (e) => {
        e.stopPropagation();
        triggerBtn.classList.add('hidden');
        try { sessionStorage.setItem('aon_cards_trigger_hidden', 'true'); } catch (err) {}
        showCardsToast('Кнопка скрыта. Вы можете снова открыть карты через меню тыкв!');
      };
    }

    // Перетаскивание шапки виджета (поддержка Mouse и Touch на смартфонах)
    const dragHeader = document.getElementById('aon-cards-drag-header');
    if (dragHeader) {
      makeDraggable(widget, dragHeader, 'aon_cards_widget_pos');
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
    if (triggerPill) {
      triggerPill.setAttribute('data-packs', totalPacks);
      const trig = document.getElementById('aon-cards-trigger-btn');
      const isCol = trig && trig.classList.contains('collapsed');
      triggerPill.textContent = isCol ? `${totalPacks}` : `${totalPacks} паков`;
    }
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
      const trig = document.getElementById('aon-cards-trigger-btn');
      if (trig) {
        trig.classList.remove('hidden');
        try { sessionStorage.removeItem('aon_cards_trigger_hidden'); } catch (e) {}
      }
      if (w) {
        w.classList.toggle('hidden');
        if (!w.classList.contains('hidden')) {
          refreshCardsData();
        }
      }
    },
    showTrigger: () => {
      const trig = document.getElementById('aon-cards-trigger-btn');
      if (trig) {
        trig.classList.remove('hidden');
        try { sessionStorage.removeItem('aon_cards_trigger_hidden'); } catch (e) {}
      }
    }
  };

  // Автостарт при готовности страницы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.AnimeOnCards.init);
  } else {
    window.AnimeOnCards.init();
  }
})();

})();