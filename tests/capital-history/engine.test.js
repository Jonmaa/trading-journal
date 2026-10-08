// Iteración 1 — motor de capital por fecha. Ejecuta: node tests/capital-history/engine.test.js
const fs = require('fs');
const path = require('path');
const { launch, openApp, snapshot, firstDiff, assert, finish, APP_URL, BASELINE_URL } = require('./lib');
const ds = require('./fixtures/dataset');

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const arrNear = (a, b, eps = 1e-6) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => near(v, b[i], eps));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const PERIODS = ['today', 'week', 'month', 'year', 'all'];

(async () => {
  const browser = await launch();
  const open = (opts = {}, url) => openApp(browser, url || APP_URL(), { trades: ds.trades, initialCapital: ds.INITIAL_CAPITAL, ...opts });
  const eq = (page, expr) => page.evaluate(expr);
  const pts = (page, p, m) => page.evaluate(([p, m]) => { const b = buildEquityPoints(p, m); return b ? b.points : null; }, [p, m]);
  const cur = (page) => page.evaluate(() => currentCapital());

  // ── Datos de referencia ────────────────────────────────────────────────
  const pBase = await open({}, BASELINE_URL);
  const snapBaseline = await snapshot(pBase);
  const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'golden-8f58390.json'), 'utf8'));
  const pNone = await open({});
  const S0 = await snapshot(pNone);

  // AC-UC05-1: sin eventos, idéntico a la versión 8f58390 (y a la foto guardada)
  {
    const d1 = firstDiff(S0, snapBaseline);
    const d2 = firstDiff(S0, golden);
    assert('AC-UC05-1', d1 === null && d2 === null, { vsBaseline: d1, vsGolden: d2 });
    // sanidad: la foto tiene contenido real
    assert('AC-UC05-1.snapshot-no-vacío', S0.history.length > 100 && Object.keys(S0.curves).length === 10 && Object.keys(S0.calendar).length === 6, {
      h: S0.history.length, c: Object.keys(S0.curves).length, k: Object.keys(S0.calendar).length });
  }

  // AC-UC05-2 (apoyo): cargar la app no modifica ni crea claves
  {
    const ls = await pNone.evaluate(() => ({
      cap: localStorage.getItem('tradelog_initial_cap'),
      trades: localStorage.getItem('tradelog_trades'),
      events: localStorage.getItem('tradelog_capital_events')
    }));
    assert('AC-UC05-2', ls.cap === '5000' && ls.trades === JSON.stringify(ds.trades) && ls.events === null, { cap: ls.cap, tradesEqual: ls.trades === JSON.stringify(ds.trades), events: ls.events });
  }

  // AC-UC05-5: almacenamiento de eventos corrupto == sin eventos
  {
    const cases = [['{{{', true], ['{"a":1}', true], [JSON.stringify([{ date: '2026-10-08', capital: 6000, adjustment: 660, rebase: true }]), false]];
    let ok = true; const detail = [];
    for (const [raw, expectConsoleError] of cases) {
      const p = await open({ events: raw });
      const s = await snapshot(p);
      const n = await eq(p, 'capitalEvents.length');
      const diff = firstDiff(s, S0);
      const consoleHit = p.__consoleErrors.some(m => m.includes('Error leyendo cambios de capital'));
      if (diff !== null || n !== 0 || p.__errors.length || (expectConsoleError && !consoleHit)) { ok = false; detail.push({ raw, diff, n, errs: p.__errors, consoleHit }); }
      await p.context().close();
    }
    assert('AC-UC05-5', ok, detail);
  }

  // ── Con eventos ────────────────────────────────────────────────────────
  const pRebase = await open({ events: [ds.EV_REBASE] });
  const S1 = await snapshot(pRebase);

  // AC-UC03-1: lo anterior a la fecha del evento es idéntico
  {
    const problems = [];
    for (const k of ['2026-08-usd', '2026-08-r', '2026-09-usd', '2026-09-r']) {
      const d = firstDiff(S0.calendar[k], S1.calendar[k]);
      if (d) problems.push('calendar ' + k + ' ' + d);
    }
    // % anual y % del mes (octubre, todos sus trades son anteriores a la fecha del evento)
    for (const id of ['stat-ytd-pct', 'stat-ytd-sub', 'stat-month-pct', 'stat-month-sub']) {
      if (S0.stats.usd[id] !== S1.stats.usd[id]) problems.push('stats usd ' + id);
    }
    for (const m of ['usd', 'r']) {
      const rows = (s) => s.stats[m].monthly.filter(r => r.startsWith('Ago 2026') || r.startsWith('Sep 2026'));
      if (JSON.stringify(rows(S0)) !== JSON.stringify(rows(S1)) || rows(S0).length !== 2) problems.push('monthly ' + m);
    }
    for (const m of ['usd', 'r']) {
      for (const p of PERIODS) {
        const a = await pts(pNone, p, m), b = await pts(pRebase, p, m);
        if (p === 'all' && m === 'usd') {
          const n = ds.trades.filter(t => t.pnl !== '' && (t.closeDate || t.date) < '2026-10-08').length;
          if (!same(b.slice(0, n + 1), a.slice(0, n + 1))) problems.push(`curve all/usd first ${n + 1}`);
        } else if (m === 'usd' && p === 'today') {
          // hoy: el escalón del ajuste es un punto nuevo al final; los anteriores son los de sin evento
          if (!same(b.slice(0, a.length), a) || b.length !== a.length + 1) problems.push('curve today/usd prior points');
        } else if (m === 'usd') {
          if (!same(b.slice(0, -1), a.slice(0, -1))) problems.push(`curve ${p}/usd prior points`);
        } else if (!arrNear(b, a, 1e-9)) problems.push(`curve ${p}/r`);
      }
    }
    assert('AC-UC03-1', problems.length === 0, problems);
  }

  // AC-UC02-3: un trade anterior al cambio conserva su 1R antiguo
  {
    const cal = S1.calendar['2026-08-r'].grid;
    const v = await pRebase.evaluate(() => ({ oneR: oneRForDate('2026-08-10'), r: calcFixedRForTrade(trades.find(t => t.id === 1001)) }));
    assert('AC-UC02-3', cal.includes('+2,00R') && v.oneR === 50 && v.r === 2, { hasCell: cal.includes('+2,00R'), v });
  }

  // AC-UC02-4: un mes anterior al cambio conserva su %
  {
    const row0 = S0.stats.usd.monthly.find(r => r.startsWith('Ago 2026'));
    const row1 = S1.stats.usd.monthly.find(r => r.startsWith('Ago 2026'));
    assert('AC-UC02-4', row0 === row1 && row1.includes('+3,00%'), { row0, row1 });
  }

  // AC-UC02-5: un evento sin recalculo no cambia ni base ni 1R
  {
    const p = await open({ events: [ds.EV_ADJ_ONLY] });
    const v = await p.evaluate(() => ['2026-08-10', '2026-10-08', '2026-12-31'].map(d => [baseCapitalForDate(d), oneRForDate(d)]));
    assert('AC-UC02-5', v.every(([b, r]) => b === 5000 && r === 50), v);
    await p.context().close();
  }

  // AC-UC02-8: dos eventos el mismo día -> ajustes suman; base del último con recalculo
  {
    const p = await open({ events: [ds.EV_REBASE, ds.EV_REBASE_2] });
    const v = await p.evaluate(() => ({ base: baseCapitalForDate('2026-10-08'), oneR: oneRForDate('2026-10-08'), cur: currentCapital() }));
    assert('AC-UC02-8', v.base === 6500 && near(v.oneR, 65) && near(v.cur, 5340 + 660 + 500, 0.005), v);
    await p.context().close();
  }

  // AC-UC01-6: un ajuste sin recalculo deja idénticos calendario, historial, % y R
  {
    const p = await open({ events: [ds.EV_ADJ_ONLY] });
    const S = await snapshot(p);
    const strip = (s) => { const c = JSON.parse(JSON.stringify(s)); delete c.curves; ['usd', 'r'].forEach(m => delete c.stats[m]['stat-current-cap']); return c; };
    const d = firstDiff(strip(S), strip(S0));
    assert('AC-UC01-6', d === null, d);
    await p.context().close();
  }

  // AC-UC03-2: escalón igual al ajuste en la curva; trades posteriores se suman encima
  {
    const all = await pts(pRebase, 'all', 'usd');
    const expected = [5000, 5100, 5150, 5120, 5240, 5300, 5380, 5340, 6000];
    const month = await pts(pRebase, 'month', 'usd');
    const monthNone = await pts(pNone, 'month', 'usd');
    // Evento anterior a varios trades: los trades posteriores se suman encima del escalón
    const pLater = await open({ events: [{ id: 1, date: '2026-09-29', capital: 5340, adjustment: 100, rebase: false }] });
    const later = await pts(pLater, 'all', 'usd');
    await pLater.context().close();
    assert('AC-UC03-2',
      arrNear(all, expected) && near(all[all.length - 1] - all[all.length - 2], 660)
      && near(month[month.length - 1], 6000) && same(month.slice(0, -1), monthNone.slice(0, -1))
      // evento del 29/09: escalón de +100 tras 5240 y los trades posteriores (+60, +80, -40) encima
      && arrNear(later, [5000, 5100, 5150, 5120, 5240, 5340, 5400, 5480, 5440]),
      { all, month, monthNone, later });
  }

  // AC-UC03-3: capital actual exacto con 0, 1 y 3 eventos
  {
    const pThree = await open({ events: [ds.EV_PAST, ds.EV_NEG, ds.EV_REBASE] });
    const c0 = await cur(pNone), c1 = await cur(pRebase), c3 = await cur(pThree);
    assert('AC-UC03-3', near(c0, 5340, 0.005) && near(c1, 6000, 0.005) && near(c3, 5340 + 200 - 150 + 660, 0.005), { c0, c1, c3 });
    await pThree.context().close();
  }

  // AC-UC03-4: las curvas y totales en R no incluyen ajustes
  {
    const problems = [];
    for (const p of PERIODS) {
      const a = await pts(pNone, p, 'r'), b = await pts(pRebase, p, 'r');
      if (!arrNear(a, b, 1e-9)) problems.push('r curve ' + p);
    }
    const today = await pRebase.evaluate(() => {
      const closed = computedTrades.filter(t => t.pnl !== '' && t.pnl !== null);
      return buildTodaySeries(closed).points;
    });
    const hasAdjPoint = today.some(p => p.isAdjustment);
    const rToday = await pRebase.evaluate(() => buildEquityPoints('today', 'r'));
    // Un trade cerrado hoy + evento hoy: la curva en R de hoy no tiene escalón
    const pTodayTrade = await open({
      trades: [...ds.trades, { id: 2001, date: '2026-10-08', symbol: 'EURUSD', direction: 'LONG', setup: '', pnl: '70', entry: '', stop: '', exit: '', notes: '', closeDate: '2026-10-08', hasImage: false }],
      events: [ds.EV_ADJ_ONLY]
    });
    const rT = await pTodayTrade.evaluate(() => buildEquityPoints('today', 'r').points);
    const uT = await pTodayTrade.evaluate(() => buildEquityPoints('today', 'usd').points);
    await pTodayTrade.context().close();
    if (!hasAdjPoint) problems.push('la serie de hoy en $ debería tener el punto isAdjustment');
    if (rToday.points.length !== 2) problems.push('today/r con evento sin trades hoy: longitud ' + rToday.points.length);
    if (!(rT.length === 2 && near(rT[1], 1.4))) problems.push('today/r con trade de +70 y 1R=50: ' + JSON.stringify(rT));
    if (!(uT.length === 3 && near(uT[1] - uT[0], 70) && near(uT[2] - uT[1], 660))) problems.push('today/usd: ' + JSON.stringify(uT));
    // totales en R de estadísticas y calendario iguales con y sin evento
    const noCur = (o) => { const c = { ...o }; delete c['stat-current-cap']; return c; };
    if (!same(noCur(S0.stats.r), noCur(S1.stats.r))) problems.push('stats en R distintas');
    if (S0.calendar['2026-10-r'].total !== S1.calendar['2026-10-r'].total) problems.push('total del calendario en R distinto');
    assert('AC-UC03-4', problems.length === 0, problems);
  }

  // AC-UC03-5: las cinco curvas en $ reflejan el ajuste
  {
    const lasts = [];
    for (const p of PERIODS) { const a = await pts(pRebase, p, 'usd'); lasts.push(a[a.length - 1]); }
    // Un ajuste anterior al inicio de la ventana (EV_PAST, 01/09) desplaza toda la curva de hoy/semana/mes;
    // en la del año aparece como un escalón y el resto de puntos se desplaza.
    const pPast = await open({ events: [ds.EV_PAST] });
    const shifts = {};
    for (const p of ['today', 'week', 'month']) {
      const a = await pts(pNone, p, 'usd'), b = await pts(pPast, p, 'usd');
      shifts[p] = a.length === b.length && a.every((v, i) => near(b[i] - v, 200));
    }
    const ya = await pts(pNone, 'year', 'usd'), yb = await pts(pPast, 'year', 'usd');
    shifts.year = ya.length === yb.length && near(yb[0], ya[0]) && near(yb[yb.length - 1] - ya[ya.length - 1], 200)
      && yb.some((v, i) => i > 0 && near((v - yb[i - 1]) - (ya[i] - ya[i - 1]), 200));
    await pPast.context().close();
    assert('AC-UC03-5', lasts.every(v => near(v, 6000)) && Object.values(shifts).every(Boolean), { lasts, shifts });
  }

  // AC-UC03-6: el ajuste es un importe fijo; editar un trade antiguo no lo toca
  {
    const before = await cur(pRebase);
    await pRebase.evaluate(() => openEditModal(1001));
    await pRebase.fill('#f-pnl', '130');
    await pRebase.evaluate(() => saveTrade());
    await pRebase.waitForTimeout(300);
    const v = await pRebase.evaluate(() => ({
      adj: capitalEvents[0].adjustment,
      stored: JSON.parse(localStorage.getItem('tradelog_capital_events'))[0].adjustment,
      cur: currentCapital()
    }));
    assert('AC-UC03-6', before !== undefined && near(before, 6000, 0.005) && v.adj === 660 && v.stored === 660 && near(v.cur, 6030, 0.005), { before, v });
  }

  await browser.close();
  finish();
})().catch((e) => { console.error('ERROR en engine.test.js', e); process.exit(2); });
