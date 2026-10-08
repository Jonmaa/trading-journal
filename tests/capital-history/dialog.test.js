// Iteración 2 — diálogo "Actualizar capital". Ejecuta: node tests/capital-history/dialog.test.js
const { launch, openApp, assert, finish, APP_URL, watchDialogs, blockStorageKey, readLS } = require('./lib');
const ds = require('./fixtures/dataset');

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

(async () => {
  const browser = await launch();
  const open = (opts = {}) => openApp(browser, APP_URL(), { trades: ds.trades, initialCapital: ds.INITIAL_CAPITAL, ...opts });
  const fmtIn = (page, n) => page.evaluate((n) => fmt(n), n);
  const t = (page, key, vars) => page.evaluate(([k, v]) => i18n(k, v), [key, vars]);
  const text = (page, sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
  const isOpen = (page) => page.evaluate(() => document.getElementById('capitalUpdateModal').classList.contains('open'));
  const val = (page, sel) => page.evaluate((s) => document.querySelector(s).value, sel);
  const css = (page, sel, prop) => page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s))[p], [sel, prop]);
  // Pestaña Rendimiento activa y diálogo abierto con la tarjeta, como lo haría el usuario
  const openDialog = async (page) => {
    await page.evaluate(() => switchTab('stats'));
    await page.click('#stat-card-current-cap');
    await page.waitForFunction(() => document.getElementById('capitalUpdateModal').classList.contains('open'));
  };
  const events = (page) => page.evaluate(() => capitalEvents);
  const cur = (page) => page.evaluate(() => currentCapital());

  // ── AC-UC01-1 ──────────────────────────────────────────────────────────
  {
    const p = await open();
    await openDialog(p);
    const v0 = await val(p, '#f-capital-update');
    const o0 = await isOpen(p);
    const p2 = await open({ events: [ds.EV_PAST] });
    await openDialog(p2);
    const v1 = await val(p2, '#f-capital-update');
    assert('AC-UC01-1', o0 && v0 === '5340' && v1 === '5540', { o0, v0, v1 });
    await p.context().close(); await p2.context().close();
  }

  // ── AC-UC01-2 ──────────────────────────────────────────────────────────
  {
    const p = await open();
    await openDialog(p);
    await p.fill('#f-capital-update', '6000');
    const a1 = await text(p, '#capital-update-adjust');
    const c1 = await p.evaluate(() => document.getElementById('capital-update-adjust').className);
    const e1 = await t(p, 'update_capital_adjust', { amount: '+$' + await fmtIn(p, 660) });
    await p.fill('#f-capital-update', '5000');
    const a2 = await text(p, '#capital-update-adjust');
    const c2 = await p.evaluate(() => document.getElementById('capital-update-adjust').className);
    const e2 = await t(p, 'update_capital_adjust', { amount: '-$' + await fmtIn(p, 340) });
    assert('AC-UC01-2', a1 === e1 && a1.includes('no cuenta como beneficio') && c1.includes('positive')
      && a2 === e2 && c2.includes('negative'), { a1, e1, c1, a2, e2, c2 });
    await p.context().close();
  }

  // ── AC-UC01-3 (botón, con céntimos, con ajuste negativo y con Enter) ───
  {
    const cases = [
      { v: '6000', expected: 6000, adj: 660, how: 'click' },
      { v: '6000,55', expected: 6000.55, adj: 660.55, how: 'click' },
      { v: '5000', expected: 5000, adj: -340, how: 'click' },
      { v: '6000', expected: 6000, adj: 660, how: 'enter' }
    ];
    const problems = [];
    for (const c of cases) {
      const p = await open();
      await openDialog(p);
      await p.fill('#f-capital-update', c.v);
      if (c.how === 'enter') await p.press('#f-capital-update', 'Enter'); else await p.click('#btn-capital-update-save');
      await p.waitForTimeout(150);
      const evs = await events(p);
      const ls = await readLS(p, 'tradelog_capital_events');
      const shown = await text(p, '#stat-current-cap');
      const want = '$' + await fmtIn(p, c.expected);
      const e = evs[0] || {};
      const ok = evs.length === 1 && e.date === '2026-10-08' && near(e.capital, c.expected) && near(e.adjustment, c.adj, 1e-9) && e.rebase === false
        && Number.isFinite(e.id) && JSON.stringify(ls) === JSON.stringify(evs)
        && near(await cur(p), c.expected, 0.005) && shown === want && !(await isOpen(p));
      if (!ok) problems.push({ c, evs, ls, shown, want, open: await isOpen(p) });
      await p.context().close();
    }
    assert('AC-UC01-3', problems.length === 0, problems);
  }

  // ── AC-UC01-4 ──────────────────────────────────────────────────────────
  {
    const p = await open();
    const d = watchDialogs(p);
    await openDialog(p);
    const problems = [];
    for (const v of ['', ' ', 'abc', '0', '-100', 'Infinity']) {
      const before = d.messages.length;
      await p.fill('#f-capital-update', v);
      await p.click('#btn-capital-update-save');
      await p.waitForTimeout(100);
      const expected = await t(p, 'capital_invalid');
      const n = (await events(p)).length;
      const ls = await p.evaluate(() => localStorage.getItem('tradelog_capital_events'));
      if (d.messages.length !== before + 1 || d.messages[d.messages.length - 1] !== expected || n !== 0 || ls !== null || d.types[d.types.length - 1] !== 'alert') {
        problems.push({ v, msgs: d.messages.slice(before), n, ls });
      }
    }
    assert('AC-UC01-4', problems.length === 0, problems);
    await p.context().close();
  }

  // ── AC-UC01-5 ──────────────────────────────────────────────────────────
  {
    const p = await open();
    await openDialog(p);
    const dis = () => p.evaluate(() => document.getElementById('btn-capital-update-save').disabled);
    const d0 = await dis();
    await p.press('#f-capital-update', 'Enter');
    await p.waitForTimeout(100);
    const n1 = (await events(p)).length;
    await p.fill('#f-capital-update', '5340,00');
    const d1 = await dis();
    await p.check('#f-capital-rebase');
    const d2 = await dis();
    await p.uncheck('#f-capital-rebase');
    const d3 = await dis();
    await p.fill('#f-capital-update', '5341');
    const d4 = await dis();
    assert('AC-UC01-5', d0 === true && n1 === 0 && d1 === true && d2 === false && d3 === true && d4 === false, { d0, n1, d1, d2, d3, d4 });
    await p.context().close();
  }

  // ── AC-UC01-7 ──────────────────────────────────────────────────────────
  {
    const scenarios = [
      { timezoneId: 'Europe/Madrid', now: '2026-10-08T00:30:00+02:00', utcDate: '2026-10-07' },
      { timezoneId: 'America/Los_Angeles', now: '2026-10-08T20:00:00-07:00', utcDate: '2026-10-09' }
    ];
    const problems = [];
    for (const sc of scenarios) {
      const p = await open({ timezoneId: sc.timezoneId, now: sc.now });
      const pre = await p.evaluate(() => ({ utc: new Date().toISOString().slice(0, 10), local: toDateStr(new Date()) }));
      await openDialog(p);
      await p.fill('#f-capital-update', '6000');
      await p.click('#btn-capital-update-save');
      await p.waitForTimeout(150);
      const evs = await events(p);
      const ls = await readLS(p, 'tradelog_capital_events');
      if (pre.utc !== sc.utcDate || pre.local !== '2026-10-08' || evs.length !== 1 || evs[0].date !== '2026-10-08' || ls[0].date !== '2026-10-08') {
        problems.push({ sc, pre, evs });
      }
      await p.context().close();
    }
    assert('AC-UC01-7', problems.length === 0, problems);
  }

  // ── AC-UC01-8 ──────────────────────────────────────────────────────────
  {
    const p = await open();
    await p.evaluate(() => switchTab('stats'));
    await p.evaluate(() => configurarCapital());
    const es = await text(p, '#capital-initial-note');
    const expectedEs = await t(p, 'capital_initial_warning', { card: await t(p, 'current_capital') });
    await p.evaluate(() => applyLanguage('en'));
    const en = await text(p, '#capital-initial-note');
    assert('AC-UC01-8', es === expectedEs && es.includes('corrige el capital de partida') && es.includes('recalcula todo el historial') && es.includes('Capital Actual')
      && en.includes('Current Capital') && en.includes('starting capital'), { es, en });
    await p.context().close();
  }

  // ── AC-UC01-10 (y apoyo de AC-UC02-6) ──────────────────────────────────
  {
    const p = await open();
    const info = await p.evaluate(() => {
      const modal = document.getElementById('capitalUpdateModal');
      const inputs = [...modal.querySelectorAll('input')].map(i => ({ type: i.type, id: i.id }));
      const labels = [...modal.querySelectorAll('label')].map(l => l.textContent);
      const names = [...modal.querySelectorAll('*')].map(e => `${e.id} ${e.getAttribute('name') || ''}`);
      return { inputs, labels, names, src: guardarActualizacionCapital.toString() };
    });
    const dateLike = [...info.names, ...info.labels].filter(s => /\bdate\b|fecha/i.test(s));
    const badTypes = info.inputs.filter(i => ['date', 'datetime-local', 'month', 'time', 'week'].includes(i.type));
    assert('AC-UC01-10', info.inputs.length === 2
      && info.inputs.some(i => i.id === 'f-capital-update' && i.type === 'text')
      && info.inputs.some(i => i.id === 'f-capital-rebase' && i.type === 'checkbox')
      && dateLike.length === 0 && badTypes.length === 0
      && info.src.includes('toDateStr(new Date())') && !info.src.includes('toISOString'), { info, dateLike, badTypes });
    await p.context().close();
  }

  // ── AC-UC02-1 ──────────────────────────────────────────────────────────
  {
    const p = await open();
    await openDialog(p);
    const checked0 = await p.evaluate(() => document.getElementById('f-capital-rebase').checked);
    const keep = await text(p, '#capital-update-oner');
    const keepExp = await t(p, 'update_capital_oner_keep', { amount: '$' + await fmtIn(p, 50) });
    await p.fill('#f-capital-update', '7000');
    await p.check('#f-capital-rebase');
    const chg = await text(p, '#capital-update-oner');
    const chgExp = await t(p, 'update_capital_oner_change', { from: '$' + await fmtIn(p, 50), to: '$' + await fmtIn(p, 70), capital: '$' + await fmtIn(p, 7000) });
    await p.click('#btn-capital-update-save');
    await p.waitForTimeout(150);
    await openDialog(p);
    const checked1 = await p.evaluate(() => document.getElementById('f-capital-rebase').checked);
    assert('AC-UC02-1', checked0 === false && keep === keepExp && chg === chgExp && chg.includes('1 % de') && checked1 === false, { checked0, keep, keepExp, chg, chgExp, checked1 });
    await p.context().close();
  }

  // ── AC-UC02-2 ──────────────────────────────────────────────────────────
  {
    const before = ds.trades.filter(x => (x.closeDate || x.date) < '2026-10-01' && x.pnl !== '');
    const p = await open({ trades: before });
    await openDialog(p);
    await p.fill('#f-capital-update', '7000');
    await p.check('#f-capital-rebase');
    await p.click('#btn-capital-update-save');
    await p.waitForTimeout(150);
    const ev = (await events(p))[0];
    const newTrade = { id: 2002, date: '2026-10-08', symbol: 'EURUSD', direction: 'LONG', setup: '', pnl: '70', entry: '', stop: '', exit: '', notes: '', closeDate: '2026-10-08', hasImage: false };
    await p.evaluate((nt) => { localStorage.setItem('tradelog_trades', JSON.stringify([...JSON.parse(localStorage.getItem('tradelog_trades')), nt])); }, newTrade);
    await p.reload();
    await p.waitForFunction(() => document.getElementById('tradeTableBody').children.length > 0);
    await p.waitForTimeout(250);
    const r = await p.evaluate(() => {
      const nt = trades.find(x => x.id === 2002);
      switchTab('calendar');
      currentYear = 2026; currentMonth = 9; setCalendarMode('r');
      const cal = document.getElementById('calendarGrid').innerText;
      switchTab('stats'); setStatsMode('usd');
      const monthly = [...document.querySelectorAll('#monthlyTableBody tr')].map(tr => tr.innerText);
      return { r: calcFixedRForTrade(nt), pct: pctReturn([nt]), cal, monthly };
    });
    const octRow = r.monthly.find(x => x.startsWith('Oct 2026')) || '';
    assert('AC-UC02-2', ev && ev.rebase === true && ev.capital === 7000 && near(r.r, 1, 1e-9) && near(r.pct, 1, 1e-9)
      && r.cal.includes('+1,00R') && /\+1[.,]00\s?%/.test(octRow), { ev, r: r.r, pct: r.pct, calHas: r.cal.includes('+1,00R'), octRow });
    await p.context().close();
  }

  // ── AC-UC02-7 ──────────────────────────────────────────────────────────
  {
    const p = await open();
    const hint = async (amount) => t(p, 'one_r_hint', { amount: '$' + await fmtIn(p, amount) });
    const titles = () => p.evaluate(() => {
      switchTab('calendar'); const c = document.getElementById('cal-mode-btn-r').title;
      switchTab('stats'); const s = document.getElementById('mode-btn-r').title;
      return { c, s };
    });
    const t0 = await titles();
    await openDialog(p);
    await p.fill('#f-capital-update', '7000');
    await p.check('#f-capital-rebase');
    await p.click('#btn-capital-update-save');
    await p.waitForTimeout(150);
    const t1 = await titles();
    const p2 = await open();
    await openDialog(p2);
    await p2.fill('#f-capital-update', '6000');
    await p2.click('#btn-capital-update-save');
    await p2.waitForTimeout(150);
    const t2 = await p2.evaluate(() => {
      switchTab('calendar'); const c = document.getElementById('cal-mode-btn-r').title;
      switchTab('stats'); const s = document.getElementById('mode-btn-r').title;
      return { c, s };
    });
    const h50 = await hint(50), h70 = await hint(70);
    assert('AC-UC02-7', t0.c === h50 && t0.s === h50 && t1.c === h70 && t1.s === h70 && t2.c === h50 && t2.s === h50, { t0, t1, t2, h50, h70 });
    await p.context().close(); await p2.context().close();
  }

  // ── AC-UC05-6 ──────────────────────────────────────────────────────────
  {
    const p = await open();
    const d = watchDialogs(p);
    await openDialog(p);
    const capBefore = await text(p, '#stat-current-cap');
    await blockStorageKey(p, 'tradelog_capital_events');
    await p.fill('#f-capital-update', '6000');
    await p.click('#btn-capital-update-save');
    await p.waitForTimeout(150);
    const expected = await t(p, 'storage_full_capital_events');
    const evs = await events(p);
    const ls = await p.evaluate(() => localStorage.getItem('tradelog_capital_events'));
    const capAfter = await text(p, '#stat-current-cap');
    assert('AC-UC05-6', d.messages.length === 1 && d.messages[0] === expected && d.types[0] === 'alert' && evs.length === 0 && ls === null
      && capBefore === capAfter && (await isOpen(p)), { msgs: d.messages, evs, ls, capBefore, capAfter, open: await isOpen(p) });
    await p.context().close();
  }

  // ── NEG: Escape, Cancelar y overlay no guardan; abrir y cerrar no toca los datos ───
  {
    const p = await open();
    const d = watchDialogs(p);
    const snap0 = await p.evaluate(() => ({ trades: localStorage.getItem('tradelog_trades'), cap: localStorage.getItem('tradelog_initial_cap') }));
    const problems = [];
    // Escape
    await openDialog(p); await p.fill('#f-capital-update', '6000'); await p.keyboard.press('Escape');
    if (await isOpen(p)) problems.push('Escape no cierra');
    // Cancelar
    await openDialog(p); await p.fill('#f-capital-update', '6000'); await p.click('#btn-capital-update-cancel');
    if (await isOpen(p)) problems.push('Cancelar no cierra');
    // Clic en el overlay
    await openDialog(p); await p.fill('#f-capital-update', '6000'); await p.mouse.click(5, 5);
    if (await isOpen(p)) problems.push('overlay no cierra');
    // Escape con el modal cerrado: no pasa nada
    await p.keyboard.press('Escape');
    // Enter repetido tras guardar con el modal ya cerrado: solo se crea un evento
    await openDialog(p); await p.fill('#f-capital-update', '6000'); await p.check('#f-capital-rebase');
    await p.press('#f-capital-update', 'Enter');
    await p.waitForTimeout(150);
    await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
    await p.waitForTimeout(150);
    const nAfterRepeat = (await events(p)).length;
    if (nAfterRepeat !== 1) problems.push('Enter repetido crea ' + nAfterRepeat + ' eventos');
    await p.evaluate(() => { capitalEvents = []; localStorage.removeItem('tradelog_capital_events'); refreshApp(); });
    const n = (await events(p)).length;
    const ls = await p.evaluate(() => localStorage.getItem('tradelog_capital_events'));
    const snap1 = await p.evaluate(() => ({ trades: localStorage.getItem('tradelog_trades'), cap: localStorage.getItem('tradelog_initial_cap') }));
    assert('NEG', problems.length === 0 && n === 0 && ls === null && snap0.trades === snap1.trades && snap0.cap === snap1.cap
      && d.messages.length === 0 && p.__errors.length === 0, { problems, n, ls, msgs: d.messages, errs: p.__errors });
    await p.context().close();
  }

  // ── VIS: comprobaciones visuales ───────────────────────────────────────
  {
    const p = await open();
    await p.evaluate(() => switchTab('stats'));
    const problems = [];
    const cursor = await css(p, '#stat-card-current-cap', 'cursor');
    await p.hover('#stat-card-current-cap');
    await p.waitForTimeout(500);   // la tarjeta anima el fondo (transition)
    const bgCur = await css(p, '#stat-card-current-cap', 'backgroundColor');
    await p.hover('#stat-card-initial-cap');
    await p.waitForTimeout(500);
    const bgIni = await css(p, '#stat-card-initial-cap', 'backgroundColor');
    if (cursor !== 'pointer' || bgCur !== bgIni || bgCur !== 'rgb(38, 38, 38)') problems.push({ cursor, bgCur, bgIni });
    await p.click('#stat-card-current-cap');
    const opacityDisabled = await css(p, '#btn-capital-update-save', 'opacity');
    if (opacityDisabled !== '0.4') problems.push({ opacityDisabled });
    await p.fill('#f-capital-update', '6000');
    const colPos = await css(p, '#capital-update-adjust', 'color');
    await p.fill('#f-capital-update', '5000');
    const colNeg = await css(p, '#capital-update-adjust', 'color');
    if (colPos !== 'rgb(87, 185, 138)' || colNeg !== 'rgb(199, 84, 80)') problems.push({ colPos, colNeg });
    // Apoyo de AC-UC01-9: mismos estilos que el modal de capital inicial (sin foco en el campo, que cambia el borde)
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    const pairs = [['#capitalUpdateTitle', '#capitalModalTitle', ['fontFamily', 'color', 'fontSize']],
      ['#lbl-capital-update-input', '#lbl-capital-input', ['fontFamily', 'color', 'fontSize']],
      ['#f-capital-update', '#f-capital', ['fontFamily', 'color', 'fontSize', 'backgroundColor', 'borderColor']],
      ['#btn-capital-update-save', '#btn-capital-save', ['fontFamily', 'color', 'backgroundColor']],
      ['#btn-capital-update-cancel', '#btn-capital-cancel', ['fontFamily', 'color']]];
    for (const [a, b, props] of pairs) for (const pr of props) {
      const va = await css(p, a, pr), vb = await css(p, b, pr);
      if (va !== vb) problems.push({ a, b, pr, va, vb });
    }
    await p.context().close();

    // 390 px de ancho
    const pm = await open({ viewport: { width: 390, height: 844 } });
    // La página en sí ya es más ancha que 390 px (no es responsive); el diálogo no debe añadir desbordamiento.
    await pm.evaluate(() => switchTab('stats'));
    const pageWidthWithoutDialog = await pm.evaluate(() => document.documentElement.scrollWidth);
    await openDialog(pm);
    await pm.fill('#f-capital-update', '6000');
    await pm.check('#f-capital-rebase');
    const geo = await pm.evaluate(() => {
      const r = document.querySelector('#capitalUpdateModal .modal').getBoundingClientRect();
      return { scrollWidth: document.documentElement.scrollWidth, left: r.left, right: r.right, bodyOverflow: document.querySelector('#capitalUpdateModal .modal').scrollWidth <= document.querySelector('#capitalUpdateModal .modal').clientWidth };
    });
    if (geo.scrollWidth > pageWidthWithoutDialog || geo.left < 0 || geo.right > 390 || !geo.bodyOverflow) problems.push({ geo, pageWidthWithoutDialog });
    await pm.context().close();
    assert('VIS', problems.length === 0, problems);
  }

  await browser.close();
  finish();
})().catch((e) => { console.error('ERROR en dialog.test.js', e); process.exit(2); });
