// Librería común de las pruebas de la Fase 1 (historial de capital).
// CommonJS. Requiere Node 18+ y Playwright con un Chromium disponible.
//   PW_CHROMIUM=/ruta/al/chrome  -> executablePath explícito (opcional)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');

function APP_URL(file) {
  return 'file://' + path.resolve(file || process.env.JOURNAL_FILE || path.join(ROOT, 'journal.html'));
}
const BASELINE_URL = APP_URL(path.join(__dirname, 'fixtures', 'journal.8f58390.html'));

// "Hoy" fijo de los tests (hora local del contexto). El tiempo sigue avanzando.
const DEFAULT_NOW = '2026-10-08T12:00:00';

async function launch() {
  const opts = {};
  if (process.env.PW_CHROMIUM) opts.executablePath = process.env.PW_CHROMIUM;
  return chromium.launch(opts);
}

// Abre la app con datos sembrados en localStorage y devuelve la página.
//   trades, initialCapital, lang, events (array -> JSON, o string tal cual)
//   now, timezoneId, viewport  -> contexto del navegador
//   rawStorage                  -> { clave: cadena } sembrado tal cual (sustituye a lo anterior)
async function openApp(browser, url, opts = {}) {
  const {
    trades = [], initialCapital = 5000, lang = 'es', events,
    now = DEFAULT_NOW, timezoneId, viewport, rawStorage
  } = opts;
  const ctxOpts = {};
  if (timezoneId) ctxOpts.timezoneId = timezoneId;
  if (viewport) ctxOpts.viewport = viewport;
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  page.__errors = [];
  page.__consoleErrors = [];
  page.on('pageerror', (err) => page.__errors.push(String(err && err.message || err)));
  page.on('console', (msg) => { if (msg.type() === 'error') page.__consoleErrors.push(msg.text()); });
  await page.clock.install({ time: new Date(now) });
  await page.goto(url);

  const seed = rawStorage || (() => {
    const s = {
      tradelog_trades: JSON.stringify(trades),
      tradelog_initial_cap: String(initialCapital),
      tradelog_lang: lang
    };
    if (events !== undefined) s.tradelog_capital_events = typeof events === 'string' ? events : JSON.stringify(events);
    return s;
  })();
  await page.evaluate((entries) => {
    localStorage.clear();
    Object.keys(entries).forEach(k => localStorage.setItem(k, entries[k]));
  }, seed);
  await page.reload();
  await page.waitForFunction(() => document.getElementById('tradeTableBody') && document.getElementById('tradeTableBody').children.length > 0);
  await page.waitForTimeout(250);
  return page;
}

// Captura "foto" de todas las cifras de la app. Funciona contra cualquier versión
// (las curvas se capturan interceptando las llamadas al canvas, no leyendo variables).
async function snapshot(page) {
  return page.evaluate(() => {
    const r3 = (n) => Math.round(n * 1000) / 1000;
    const txt = (id) => document.getElementById(id).innerText;
    const out = { history: txt('tradeTableBody'), stats: {}, calendar: {}, curves: {} };

    const saved = {
      statsMode, chartPeriod, calendarMode, currentYear, currentMonth,
      tab: (document.querySelector('.tab-content.active') || {}).id
    };

    // Estadísticas ($ y R)
    switchTab('stats');
    ['usd', 'r'].forEach(m => {
      setStatsMode(m);
      updateStats();
      const o = {};
      ['stat-initial-cap', 'stat-current-cap', 'stat-ytd-pct', 'stat-ytd-sub', 'stat-month-pct', 'stat-month-sub']
        .forEach(id => { o[id] = txt(id); });
      o.monthly = [...document.querySelectorAll('#monthlyTableBody tr')].map(tr => tr.innerText);
      out.stats[m] = o;
    });

    // Calendario ago/sep/oct 2026, $ y R
    [['2026-08', 7], ['2026-09', 8], ['2026-10', 9]].forEach(([key, mi]) => {
      ['usd', 'r'].forEach(m => {
        currentYear = 2026; currentMonth = mi; calendarMode = m;
        renderCalendar();
        out.calendar[`${key}-${m}`] = { grid: txt('calendarGrid'), total: txt('label-calendar-title-value') };
      });
    });

    // Curvas: se interceptan moveTo/lineTo/fillText del canvas durante renderChart()
    const proto = CanvasRenderingContext2D.prototype;
    const orig = { moveTo: proto.moveTo, lineTo: proto.lineTo, fillText: proto.fillText };
    let log = [];
    proto.moveTo = function (x, y) { log.push(['m', r3(x), r3(y)]); return orig.moveTo.apply(this, arguments); };
    proto.lineTo = function (x, y) { log.push(['l', r3(x), r3(y)]); return orig.lineTo.apply(this, arguments); };
    proto.fillText = function (t, x, y) { log.push(['t', String(t), r3(x), r3(y)]); return orig.fillText.apply(this, arguments); };
    try {
      ['today', 'week', 'month', 'year', 'all'].forEach(p => {
        ['usd', 'r'].forEach(m => {
          statsMode = m; chartPeriod = p;
          log = [];
          renderChart();
          out.curves[`${p}-${m}`] = { calls: log, title: txt('chart-title'), legend: txt('chart-legend-text') };
        });
      });
    } finally {
      proto.moveTo = orig.moveTo; proto.lineTo = orig.lineTo; proto.fillText = orig.fillText;
    }

    // Restaurar el estado de pantalla
    statsMode = saved.statsMode; chartPeriod = saved.chartPeriod; calendarMode = saved.calendarMode;
    currentYear = saved.currentYear; currentMonth = saved.currentMonth;
    updateStats(); renderChart(); renderCalendar();
    if (saved.tab) switchTab(saved.tab.replace('tab-', ''));
    return out;
  });
}

// Comparación estricta de dos snapshots (devuelve la primera diferencia o null)
function firstDiff(a, b, p = '') {
  if (a === b) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return `${p}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const d = firstDiff(a[k], b[k], `${p}/${k}`);
    if (d) return d;
  }
  return null;
}

// Registra cada alert/confirm de la página y lo acepta (o lo descarta con accept:false).
function watchDialogs(page, { accept = true } = {}) {
  const rec = { messages: [], types: [] };
  page.on('dialog', async (d) => {
    rec.messages.push(d.message()); rec.types.push(d.type());
    if (accept) await d.accept(); else await d.dismiss();
  });
  return rec;
}

// Hace que localStorage.setItem(key, ...) falle como si el almacenamiento estuviera lleno.
async function blockStorageKey(page, key) {
  await page.evaluate((k) => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (kk) {
      if (kk === k) throw new DOMException('quota', 'QuotaExceededError');
      return orig.apply(this, arguments);
    };
  }, key);
}

// JSON.parse de localStorage[key] (o null si no existe)
async function readLS(page, key) {
  return page.evaluate((k) => { const v = localStorage.getItem(k); return v === null ? null : JSON.parse(v); }, key);
}

const results = { pass: 0, fail: 0 };
function assert(id, cond, detail) {
  if (cond) { results.pass++; console.log(`PASS ${id}`); }
  else { results.fail++; console.log(`FAIL ${id}${detail !== undefined ? ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); }
}
function finish() {
  console.log(`\n=== ${results.pass} PASS, ${results.fail} FAIL ===`);
  process.exit(results.fail > 0 ? 1 : 0);
}

module.exports = {
  ROOT, APP_URL, BASELINE_URL, DEFAULT_NOW, launch, openApp, snapshot, firstDiff, assert, finish, results, watchDialogs, blockStorageKey, readLS
};
