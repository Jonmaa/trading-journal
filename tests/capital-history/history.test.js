// Iteración 3 — historial de cambios, borrado y backup. Ejecuta: node tests/capital-history/history.test.js
const nodeAssert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  launch, openApp, snapshot, firstDiff, assert, finish, APP_URL, BASELINE_URL,
  watchDialogs, blockStorageKey, readLS, downloadExport, writeTempJSON, importFile
} = require('./lib');
const ds = require('./fixtures/dataset');

const deepEq = (a, b) => { try { nodeAssert.deepStrictEqual(a, b); return true; } catch (e) { return false; } };

(async () => {
  const browser = await launch();
  const open = (opts = {}) => openApp(browser, APP_URL(), { trades: ds.trades, initialCapital: ds.INITIAL_CAPITAL, ...opts });
  const t = (page, key, vars) => page.evaluate(([k, v]) => i18n(k, v), [key, vars]);
  const fmtIn = (page, n) => page.evaluate((n) => fmt(n), n);
  const isOpen = (page) => page.evaluate(() => document.getElementById('capitalUpdateModal').classList.contains('open'));
  const events = (page) => page.evaluate(() => capitalEvents);
  const cur = (page) => page.evaluate(() => currentCapital());
  const lsRaw = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);

  // Abre el diálogo como lo haría el usuario (si ya está abierto no hace nada)
  const openDialog = async (page) => {
    if (await isOpen(page)) return;
    await page.evaluate(() => switchTab('stats'));
    await page.click('#stat-card-current-cap');
    await page.waitForFunction(() => document.getElementById('capitalUpdateModal').classList.contains('open'));
  };
  // Guarda un cambio de capital por el diálogo
  const saveViaDialog = async (page, value, rebase) => {
    await openDialog(page);
    await page.fill('#f-capital-update', value);
    if (rebase) await page.check('#f-capital-rebase'); else await page.uncheck('#f-capital-rebase');
    await page.click('#btn-capital-update-save');
    await page.waitForTimeout(150);
  };
  // Pulsa el botón de borrar de la fila de un evento (el confirm lo gestiona watchDialogs)
  const clickDelete = async (page, id) => {
    await openDialog(page);
    await page.click(`.capital-event-row[data-event-id="${id}"] .row-action-btn`, { timeout: 4000 });
    await page.waitForTimeout(200);
  };
  // "Foto" con la misma pestaña y el diálogo cerrado, para poder comparar entre páginas
  const snap = async (page) => {
    await page.evaluate(() => { closeCapitalUpdateModal(); switchTab('journal'); });
    return snapshot(page);
  };
  const sameSnap = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const rows = (page) => page.evaluate(() => [...document.querySelectorAll('#capital-history-list .capital-event-row')].map(r => ({
    id: Number(r.dataset.eventId),
    date: r.querySelector('.capital-event-date').textContent,
    capital: r.querySelector('.capital-event-capital').textContent,
    adjustment: r.querySelector('.capital-event-adjustment').textContent,
    adjClass: r.querySelector('.capital-event-adjustment').className,
    oner: r.querySelector('.capital-event-oner').textContent,
    hint: r.querySelector('.row-action-btn').title,
    btnVisible: (() => { const b = r.querySelector('.row-action-btn').getBoundingClientRect(); return b.width > 0 && b.height > 0; })()
  })));
  const emptyMsg = (page) => page.evaluate(() => { const e = document.querySelector('#capital-history-list .capital-history-empty'); return e ? e.textContent : null; });
  // Textos esperados de una fila, calculados en la página con fmt(), formatDate() e i18n()
  const expectedRow = (page, ev, hidden = false) => page.evaluate(([ev, hidden]) => {
    const m = (s) => hidden ? '***' : s;
    const signed = (n) => m((n > 0 ? '+' : n < 0 ? '-' : '') + '$' + fmt(Math.abs(n)));
    return {
      date: formatDate(ev.date),
      capital: i18n('capital_event_capital', { amount: m('$' + fmt(ev.capital)) }),
      adjustment: i18n('capital_event_adjustment', { amount: signed(ev.adjustment) }),
      oner: ev.rebase ? i18n('capital_event_oner', { amount: m('$' + fmt(ev.capital * 0.01)) }) : i18n('capital_event_oner_none')
    };
  }, [ev, hidden]);
  const expectedConfirm = (page, ev, hidden = false) => page.evaluate(([ev, hidden]) => {
    const m = (s) => hidden ? '***' : s;
    return i18n('capital_event_delete_confirm', {
      date: formatDate(ev.date),
      capital: m('$' + fmt(ev.capital)),
      adjustment: m((ev.adjustment > 0 ? '+' : ev.adjustment < 0 ? '-' : '') + '$' + fmt(Math.abs(ev.adjustment)))
    });
  }, [ev, hidden]);

  // Si un bloque lanza una excepción (p. ej. un botón que no aparece), cuenta como FAIL de ese criterio
  const guard = async (id, fn) => {
    try { await fn(); } catch (e) { assert(id, false, 'excepción: ' + String((e && e.message) || e).split('\n')[0].slice(0, 200)); }
  };

  // Referencias: app sin eventos y apps con conjuntos de eventos
  const pNone = await open();
  const SNAP_NONE = await snap(pNone);

  // ── AC-UC04-1 ──────────────────────────────────────────────────────────
  await guard('AC-UC04-1', async () => {
    const problems = [];
    const p = await open({ events: [ds.EV_PAST, ds.EV_NEG, ds.EV_REBASE] });
    const r = await rows(p);
    if (!deepEq(r.map(x => x.id), [1, 5, 4])) problems.push({ order: r.map(x => x.id) });
    const wanted = [ds.EV_REBASE, ds.EV_NEG, ds.EV_PAST];
    for (let i = 0; i < wanted.length; i++) {
      const e = await expectedRow(p, wanted[i]);
      const x = r[i] || {};
      if (x.date !== e.date || x.capital !== e.capital || x.adjustment !== e.adjustment || x.oner !== e.oner) problems.push({ i, got: x, want: e });
    }
    // Literales en español (no dependen del código): importes sin separador de miles en es-ES
    const L = r[0] || {};
    if (L.date !== '08/10/26' || !L.capital.includes('$6000,00') || !L.adjustment.includes('+$660,00') || !L.oner.includes('$60,00')) problems.push({ literal1: L });
    const L2 = r[1] || {};
    if (!L2.capital.includes('$5000,00') || !L2.adjustment.includes('-$150,00') || !L2.oner.includes('$50,00')) problems.push({ literal2: L2 });
    const L3 = r[2] || {};
    if (!L3.capital.includes('$5200,00') || !L3.adjustment.includes('+$200,00') || !L3.oner.includes('—')) problems.push({ literal3: L3 });
    // Colores por signo
    if (!(r[0] && r[0].adjClass.includes('positive')) || !(r[1] && r[1].adjClass.includes('negative'))) problems.push({ classes: r.map(x => x.adjClass) });
    await p.context().close();

    // Mismo día: sale primero el más reciente (id mayor)
    const p2 = await open({ events: [ds.EV_REBASE, ds.EV_REBASE_2] });
    const r2 = await rows(p2);
    if (!deepEq(r2.map(x => x.id), [3, 1])) problems.push({ sameDay: r2.map(x => x.id) });
    await p2.context().close();
    assert('AC-UC04-1', problems.length === 0, problems);
  });

  // ── AC-UC04-2 ──────────────────────────────────────────────────────────
  await guard('AC-UC04-2', async () => {
    const problems = [];
    const p = await open();
    const want = await t(p, 'capital_history_empty');
    if ((await emptyMsg(p)) !== want || want !== 'Todavía no has registrado ningún cambio de capital.' || (await rows(p)).length !== 0) problems.push({ step: 'inicio', msg: await emptyMsg(p) });
    await saveViaDialog(p, '6000', true);
    if ((await emptyMsg(p)) !== null || (await rows(p)).length !== 1) problems.push({ step: 'tras guardar', msg: await emptyMsg(p), rows: (await rows(p)).length });
    const d = watchDialogs(p);
    const id = (await events(p))[0].id;
    await clickDelete(p, id);
    if ((await emptyMsg(p)) !== want || (await rows(p)).length !== 0 || d.types.join() !== 'confirm') problems.push({ step: 'tras borrar', msg: await emptyMsg(p), types: d.types });
    await p.context().close();
    assert('AC-UC04-2', problems.length === 0, problems);
  });

  // ── AC-UC04-3 ──────────────────────────────────────────────────────────
  await guard('AC-UC04-3', async () => {
    const problems = [];
    // (i) borrar el más reciente
    const pi = await open({ events: [ds.EV_PAST, ds.EV_REBASE] });
    const di = watchDialogs(pi);
    await clickDelete(pi, ds.EV_REBASE.id);
    const wantConfirm = await expectedConfirm(pi, ds.EV_REBASE);
    if (di.messages.length !== 1 || di.types[0] !== 'confirm' || di.messages[0] !== wantConfirm
      || !di.messages[0].includes('08/10/26') || !di.messages[0].includes('$6000,00') || !di.messages[0].includes('+$660,00')) problems.push({ i: 'confirm', msgs: di.messages, wantConfirm });
    const evs = await events(pi);
    const ls = await readLS(pi, 'tradelog_capital_events');
    if (evs.length !== 1 || evs[0].id !== ds.EV_PAST.id || !deepEq(ls, evs)) problems.push({ i: 'estado', evs, ls });
    const refPast = await open({ events: [ds.EV_PAST] });
    const sI = await snap(pi);
    if (!sameSnap(sI, await snap(refPast))) problems.push({ i: 'snapshot', diff: firstDiff(sI, await snap(refPast)) });
    // (ii) borrar también el último que queda
    await clickDelete(pi, ds.EV_PAST.id);
    const sII = await snap(pi);
    if (!sameSnap(sII, SNAP_NONE) || (await cur(pi)) !== 5340 || (await events(pi)).length !== 0) problems.push({ ii: firstDiff(sII, SNAP_NONE), cur: await cur(pi) });
    await pi.context().close(); await refPast.context().close();

    // (iii) borrar el de en medio
    const p3 = await open({ events: [ds.EV_PAST, ds.EV_NEG, ds.EV_REBASE] });
    watchDialogs(p3);
    await clickDelete(p3, ds.EV_NEG.id);
    const ref3 = await open({ events: [ds.EV_PAST, ds.EV_REBASE] });
    const s3 = await snap(p3), r3 = await snap(ref3);
    if (!sameSnap(s3, r3)) problems.push({ iii: firstDiff(s3, r3) });
    await p3.context().close(); await ref3.context().close();

    // (iv) un cambio con recalculo de 1R anterior a varios trades: borrarlo devuelve R, % y el historial a los de antes
    const EV_EARLY = { id: 11, date: '2026-09-01', capital: 8000, adjustment: 2660, rebase: true };
    const p4 = await open({ events: [EV_EARLY] });
    watchDialogs(p4);
    const with4 = await snap(p4);
    if (sameSnap(with4, SNAP_NONE)) problems.push({ iv: 'el evento de prueba no cambia nada (prueba sin valor)' });
    // Lo que se ve en la pestaña Rendimiento justo después de borrar (sin cambiar de pestaña ni recalcular a mano)
    const live = (pg) => pg.evaluate(() => ['stat-current-cap', 'stat-ytd-pct', 'stat-ytd-sub', 'stat-month-pct', 'stat-month-sub'].map(id => document.getElementById(id).innerText));
    await pNone.evaluate(() => { closeCapitalUpdateModal(); switchTab('stats'); });
    const liveNone = await live(pNone);
    await p4.evaluate(() => switchTab('stats'));
    const liveWith = await live(p4);
    if (deepEq(liveWith, liveNone)) problems.push({ iv: 'las cifras en pantalla no cambian con el evento (prueba sin valor)', liveWith });
    await clickDelete(p4, EV_EARLY.id);
    const liveAfter = await live(p4);
    if (!deepEq(liveAfter, liveNone)) problems.push({ iv: 'tras borrar, la pestaña no se actualiza sola', liveAfter, liveNone });
    const s4 = await snap(p4);
    if (!sameSnap(s4, SNAP_NONE)) problems.push({ iv: firstDiff(s4, SNAP_NONE) });
    await p4.context().close();
    assert('AC-UC04-3', problems.length === 0, problems);
  });

  // ── AC-UC04-4 ──────────────────────────────────────────────────────────
  let cancelResult = null;
  await guard('AC-UC04-4', async () => {
    const problems = [];
    const p = await open({ events: [ds.EV_PAST, ds.EV_REBASE] });
    const d = watchDialogs(p, { accept: false });
    const before = { evs: JSON.stringify(await events(p)), ls: await lsRaw(p, 'tradelog_capital_events'), snap: await snap(p), rows: await rows(p) };
    await clickDelete(p, ds.EV_REBASE.id);
    const after = { evs: JSON.stringify(await events(p)), ls: await lsRaw(p, 'tradelog_capital_events'), snap: await snap(p), rows: await rows(p) };
    if (d.messages.length !== 1 || d.types[0] !== 'confirm') problems.push({ dialogs: d.types });
    if (before.evs !== after.evs || before.ls !== after.ls || !sameSnap(before.snap, after.snap) || !deepEq(before.rows, after.rows) || after.rows.length !== 2) problems.push({ before, after });
    cancelResult = problems.length === 0;
    await p.context().close();
    assert('AC-UC04-4', problems.length === 0, problems);
  });

  // ── AC-UC04-5 ──────────────────────────────────────────────────────────
  await guard('AC-UC04-5', async () => {
    const problems = [];
    const p = await open({ events: [ds.EV_PAST, ds.EV_REBASE] });
    await p.evaluate(() => toggleHideBalance());
    const hidden = await rows(p);
    const wanted = [ds.EV_REBASE, ds.EV_PAST];
    for (let i = 0; i < wanted.length; i++) {
      const e = await expectedRow(p, wanted[i], true);
      const x = hidden[i] || {};
      const noDigits = (s) => !/\d/.test(s.replace('1R', ''));
      if (x.capital !== e.capital || x.adjustment !== e.adjustment || x.oner !== e.oner || x.date !== e.date
        || !noDigits(x.capital) || !noDigits(x.adjustment) || !noDigits(x.oner)) problems.push({ i, got: x, want: e });
    }
    if (hidden[0].capital !== (await t(p, 'capital_event_capital', { amount: '***' })) || hidden[0].adjustment !== (await t(p, 'capital_event_adjustment', { amount: '***' }))
      || hidden[0].oner !== (await t(p, 'capital_event_oner', { amount: '***' })) || !hidden[1].oner.includes('—') || !/\d/.test(hidden[0].date)) problems.push({ literal: hidden });
    // El texto de la confirmación también va enmascarado
    const d = watchDialogs(p, { accept: false });
    await clickDelete(p, ds.EV_REBASE.id);
    const wantConfirm = await expectedConfirm(p, ds.EV_REBASE, true);
    if (d.messages.length !== 1 || d.messages[0] !== wantConfirm || /6000|660/.test(d.messages[0]) || (d.messages[0].match(/\*\*\*/g) || []).length !== 2) problems.push({ confirm: d.messages, wantConfirm });
    // Al desactivar el modo vuelven los importes reales
    await p.evaluate(() => { closeCapitalUpdateModal(); toggleHideBalance(); });
    const shown = await rows(p);
    for (let i = 0; i < wanted.length; i++) {
      const e = await expectedRow(p, wanted[i], false);
      const x = shown[i] || {};
      if (x.capital !== e.capital || x.adjustment !== e.adjustment || x.oner !== e.oner || !x.capital.includes('$')) problems.push({ visible: i, got: x, want: e });
    }
    await p.context().close();
    assert('AC-UC04-5', problems.length === 0, problems);
  });

  // ── AC-UC04-7 ──────────────────────────────────────────────────────────
  await guard('AC-UC04-7', async () => {
    const problems = [];
    const p = await open();
    watchDialogs(p);
    const S0 = await lsRaw(p, 'tradelog_trades');
    const C0 = await lsRaw(p, 'tradelog_initial_cap');
    await saveViaDialog(p, '6000', true);
    const S1 = await lsRaw(p, 'tradelog_trades');
    const C1 = await lsRaw(p, 'tradelog_initial_cap');
    const id = (await events(p))[0].id;
    await clickDelete(p, id);
    const S2 = await lsRaw(p, 'tradelog_trades');
    const C2 = await lsRaw(p, 'tradelog_initial_cap');
    if (!S0 || S1 !== S0 || S2 !== S0 || C0 !== C1 || C1 !== C2 || (await events(p)).length !== 0) problems.push({ same: [S1 === S0, S2 === S0], caps: [C0, C1, C2] });
    const src = await p.evaluate(() => ({
      save: guardarActualizacionCapital.toString(), del: deleteCapitalEvent.toString(), list: renderCapitalEventsList.toString()
    }));
    for (const [name, s] of Object.entries(src)) {
      if (/saveTradesToStorage|tradelog_trades|saveCapitalToStorage|tradelog_initial_cap/.test(s)) problems.push({ source: name });
    }
    await p.context().close();
    assert('AC-UC04-7', problems.length === 0, problems);
  });

  // ── AC-UC05-3 ──────────────────────────────────────────────────────────
  let exportedFile = null;
  await guard('AC-UC05-3', async () => {
    const problems = [];
    // (i) exportar
    const pA = await open({ events: [ds.EV_PAST, ds.EV_REBASE] });
    const exp = await downloadExport(pA);
    exportedFile = exp;
    const wantEvents = [ds.EV_PAST, ds.EV_REBASE];
    if (!deepEq(exp.json.capitalEvents, wantEvents) || exp.json.capitalEvents.some(e => Object.keys(e).sort().join() !== 'adjustment,capital,date,id,rebase')
      || exp.json.initialCapital !== 5000 || exp.json.trades.length !== 8) problems.push({ i: exp.json.capitalEvents, cap: exp.json.initialCapital, n: exp.json.trades.length });
    const SNAP_A = await snap(pA);

    // (ii) importar en una app limpia (sin eventos, con otros datos)
    const pB = await open({ trades: [ds.trades[0]], initialCapital: 4000 });
    const dB = watchDialogs(pB);
    await importFile(pB, exp.path);
    const evB = await events(pB);
    const lsB = await readLS(pB, 'tradelog_capital_events');
    const importedOk = dB.types.join() === 'confirm,alert' && dB.messages[1] === await t(pB, 'import_done');
    if (!importedOk || !deepEq(evB, wantEvents) || !deepEq(lsB, wantEvents)) problems.push({ ii: 'estado', msgs: dB.messages, evB, lsB });
    const SNAP_B = await snap(pB);
    if (!sameSnap(SNAP_A, SNAP_B)) problems.push({ ii: 'snapshot', diff: firstDiff(SNAP_A, SNAP_B) });

    // (iii) backup antiguo (sin capitalEvents) importado en una app que SÍ tiene eventos
    const old = { ...exp.json }; delete old.capitalEvents;
    const oldFile = writeTempJSON(old);
    const pC = await open({ events: [ds.EV_NEG, ds.EV_REBASE] });
    const dC = watchDialogs(pC);
    await importFile(pC, oldFile);
    const okC = dC.messages[dC.messages.length - 1] === await t(pC, 'import_done');
    const emptyC = await emptyMsg(pC);
    const lsC = await readLS(pC, 'tradelog_capital_events');
    if (!okC || (await events(pC)).length !== 0 || emptyC !== await t(pC, 'capital_history_empty') || (lsC !== null && lsC.length !== 0)) problems.push({ iii: 'estado', msgs: dC.messages, evs: await events(pC), emptyC, lsC });
    const SNAP_C = await snap(pC);
    if (!sameSnap(SNAP_C, SNAP_NONE)) problems.push({ iii: 'snapshot', diff: firstDiff(SNAP_C, SNAP_NONE) });

    // (iv) campo que no es lista / evento incompleto
    for (const bad of ['x', [{ date: '2026-10-08' }]]) {
      const f = writeTempJSON({ ...exp.json, capitalEvents: bad });
      const pD = await open({ events: [ds.EV_NEG] });
      const dD = watchDialogs(pD);
      await importFile(pD, f);
      const ok = dD.messages[dD.messages.length - 1] === await t(pD, 'import_done');
      if (!ok || (await events(pD)).length !== 0 || (await pD.evaluate(() => document.querySelectorAll('.capital-event-row').length)) !== 0 || pD.__errors.length) {
        problems.push({ iv: JSON.stringify(bad), msgs: dD.messages, evs: await events(pD), errs: pD.__errors });
      }
      await pD.context().close();
    }

    // (v) almacenamiento bloqueado al importar
    const pE = await open({ events: [ds.EV_NEG] });
    const dE = watchDialogs(pE);
    await blockStorageKey(pE, 'tradelog_capital_events');
    await importFile(pE, exp.path);
    const full = await t(pE, 'storage_full_capital_events');
    const evE = await events(pE);
    if (!dE.messages.includes(full) || dE.messages.includes(await t(pE, 'import_done')) || !deepEq(evE, [ds.EV_NEG])) problems.push({ v: dE.messages, evE });
    for (const pg of [pA, pB, pC, pE]) await pg.context().close();
    assert('AC-UC05-3', problems.length === 0, problems);
  });

  // ── AC-UC05-4 ──────────────────────────────────────────────────────────
  await guard('AC-UC05-4', async () => {
    const problems = [];
    const pNew = await open();
    watchDialogs(pNew);
    await saveViaDialog(pNew, '6000', true);
    const dump = await pNew.evaluate(() => {
      const o = {};
      ['tradelog_trades', 'tradelog_initial_cap', 'tradelog_lang', 'tradelog_capital_events'].forEach(k => { const v = localStorage.getItem(k); if (v !== null) o[k] = v; });
      return o;
    });
    if (Object.keys(dump).length !== 4) problems.push({ dumpKeys: Object.keys(dump) });
    await pNew.context().close();

    const pOld = await openApp(browser, BASELINE_URL, { rawStorage: dump });
    const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'golden-8f58390.json'), 'utf8'));
    const sOld = await snapshot(pOld);
    const diff = firstDiff(sOld, golden);
    const consoleErrors = pOld.__consoleErrors.filter(m => !/Failed to load resource/.test(m));
    const after = await lsRaw(pOld, 'tradelog_capital_events');
    if (pOld.__errors.length || consoleErrors.length || diff !== null || after !== dump.tradelog_capital_events) problems.push({ pageerrors: pOld.__errors, consoleErrors, diff, same: after === dump.tradelog_capital_events });
    await pOld.context().close();
    assert('AC-UC05-4', problems.length === 0, problems);
  });

  // ── AC-UC05-7 ──────────────────────────────────────────────────────────
  await guard('AC-UC05-7', async () => {
    const problems = [];
    const NEW_KEYS = [
      'storage_full_capital_events',
      'update_capital_title', 'update_capital_label', 'update_capital_hint', 'update_capital_adjust', 'update_capital_no_adjust',
      'update_capital_rebase', 'update_capital_oner_change', 'update_capital_oner_keep', 'update_capital_note', 'capital_initial_warning',
      'capital_history_title', 'capital_history_empty', 'capital_event_capital', 'capital_event_adjustment', 'capital_event_oner',
      'capital_event_oner_none', 'capital_event_delete_hint', 'capital_event_delete_confirm'
    ];
    const SAME_ALLOWED = ['capital_event_capital', 'capital_event_oner', 'capital_event_oner_none'];
    const p = await open({ events: [ds.EV_PAST, ds.EV_REBASE] });
    if (NEW_KEYS.length !== 19) problems.push({ count: NEW_KEYS.length });
    const dict = await p.evaluate((keys) => keys.map(k => ({ k, es: I18N.es[k], en: I18N.en[k] })), NEW_KEYS);
    const holders = (s) => (String(s).match(/\{[^}]+\}/g) || []).sort().join(',');
    for (const { k, es, en } of dict) {
      if (typeof es !== 'string' || !es.trim() || typeof en !== 'string' || !en.trim()) { problems.push({ key: k, missing: { es, en } }); continue; }
      if (holders(es) !== holders(en)) problems.push({ key: k, placeholders: [holders(es), holders(en)] });
      if (es === en && !SAME_ALLOWED.includes(k)) problems.push({ key: k, sameText: es });
    }

    // La interfaz cambia de idioma (ES -> EN -> ES), con el diálogo abierto y datos escritos
    const watch = watchDialogs(p, { accept: false });
    await openDialog(p);
    await p.fill('#f-capital-update', '6000');
    await p.check('#f-capital-rebase');
    const probeUI = () => p.evaluate(() => {
      const txt = (id) => document.getElementById(id).textContent;
      const fm = (n) => '$' + fmt(n);
      const typed = 6000, adj = typed - currentCapital();
      return {
        lang,
        pairs: [
          [txt('capitalUpdateTitle'), i18n('update_capital_title')],
          [txt('lbl-capital-update-input'), i18n('update_capital_label')],
          [txt('lbl-capital-rebase'), i18n('update_capital_rebase')],
          [txt('capital-update-note'), i18n('update_capital_note')],
          [txt('btn-capital-update-cancel'), i18n('cancel')],
          [txt('btn-capital-update-save'), i18n('save')],
          [txt('capital-initial-note'), i18n('capital_initial_warning', { card: i18n('current_capital') })],
          [txt('capital-history-title'), i18n('capital_history_title')],
          [document.getElementById('stat-card-current-cap').title, i18n('update_capital_hint')],
          [document.querySelector('.capital-event-row .row-action-btn').title, i18n('capital_event_delete_hint')],
          [txt('capital-update-adjust'), i18n('update_capital_adjust', { amount: (adj > 0 ? '+' : '-') + fm(Math.abs(adj)) })],
          [txt('capital-update-oner'), i18n('update_capital_oner_change', { from: fm(oneRValue()), to: fm(typed * 0.01), capital: fm(typed) })],
          [document.querySelector('.capital-event-row .capital-event-capital').textContent, i18n('capital_event_capital', { amount: fm(6000) })],
          [document.querySelector('.capital-event-row .capital-event-adjustment').textContent, i18n('capital_event_adjustment', { amount: '+' + fm(660) })]
        ],
        title: document.getElementById('capitalUpdateTitle').textContent,
        listText: document.getElementById('capital-history-list').textContent
      };
    });
    const seen = {};
    for (const lng of ['es', 'en', 'es']) {
      await p.evaluate((l) => applyLanguage(l), lng);
      const u = await probeUI();
      u.pairs.forEach(([got, want], i) => { if (got !== want || !got.trim()) problems.push({ lng, i, got, want }); });
      // El texto de confirmación de borrado en el idioma activo
      const before = watch.messages.length;
      await p.click('.capital-event-row[data-event-id="1"] .row-action-btn', { timeout: 3000 });
      await p.waitForTimeout(150);
      const wantConfirm = await expectedConfirm(p, ds.EV_REBASE);
      if (watch.messages.length !== before + 1 || watch.messages[before] !== wantConfirm) problems.push({ lng, confirm: watch.messages.slice(before), wantConfirm });
      seen[lng] = { title: u.title, list: u.listText, confirm: watch.messages[before] };
    }
    if (seen.es.title === seen.en.title || seen.es.list === seen.en.list || seen.es.confirm === seen.en.confirm) problems.push({ notSwitching: seen });
    if (!/Actualizar capital/.test(seen.es.title) || !/Update capital/.test(seen.en.title)) problems.push({ titles: seen });
    await p.context().close();
    assert('AC-UC05-7', problems.length === 0, problems);
  });

  // ── NEG3 ───────────────────────────────────────────────────────────────
  await guard('NEG3', async () => {
    const problems = [];
    // (1) Cancelar no cambia nada (ya comprobado en AC-UC04-4)
    if (cancelResult !== true) problems.push({ n1: 'AC-UC04-4 no pasó' });
    // (2) borrar un id que no existe
    {
      const p = await open({ events: [ds.EV_PAST, ds.EV_REBASE] });
      const d = watchDialogs(p);
      const before = { evs: JSON.stringify(await events(p)), ls: await lsRaw(p, 'tradelog_capital_events'), snap: await snap(p) };
      await p.evaluate(() => deleteCapitalEvent(999999));
      const after = { evs: JSON.stringify(await events(p)), ls: await lsRaw(p, 'tradelog_capital_events'), snap: await snap(p) };
      if (d.messages.length !== 0 || before.evs !== after.evs || before.ls !== after.ls || !sameSnap(before.snap, after.snap) || p.__errors.length) problems.push({ n2: d.messages, errs: p.__errors });
      await p.context().close();
    }
    // (3) importar eventos inválidos mezclados con válidos
    {
      const bad = [
        ds.EV_PAST,
        { id: 6, date: '2026-10-01', capital: -5, adjustment: 1, rebase: true },
        { id: 7, date: '2026-13-99x', capital: 5000, adjustment: 0, rebase: false },
        { date: '2026-10-02', capital: 5000, adjustment: 0, rebase: false },
        ds.EV_REBASE
      ];
      const f = writeTempJSON({ ...exportedFile.json, capitalEvents: bad });
      const p = await open();
      const d = watchDialogs(p);
      await importFile(p, f);
      const ids = (await events(p)).map(e => e.id);
      if (!deepEq(ids, [4, 1]) || d.messages[d.messages.length - 1] !== await t(p, 'import_done') || p.__errors.length) problems.push({ n3: ids, msgs: d.messages, errs: p.__errors });
      await p.context().close();
    }
    // (4) ni exportar ni importar tocan tradelog_initial_cap más allá de lo que ya hacía
    {
      const p = await open({ initialCapital: 5000, events: [ds.EV_PAST] });
      const d = watchDialogs(p);
      const c0 = await lsRaw(p, 'tradelog_initial_cap');
      await downloadExport(p);
      const c1 = await lsRaw(p, 'tradelog_initial_cap');
      const noCap = { ...exportedFile.json }; delete noCap.initialCapital;
      await importFile(p, writeTempJSON(noCap));
      const c2 = await lsRaw(p, 'tradelog_initial_cap');
      await importFile(p, writeTempJSON({ ...exportedFile.json, initialCapital: 7777 }));
      const c3 = await lsRaw(p, 'tradelog_initial_cap');
      if (c0 !== '5000' || c1 !== '5000' || c2 !== '5000' || c3 !== '7777') problems.push({ n4: [c0, c1, c2, c3], msgs: d.messages });
      await p.context().close();
    }
    assert('NEG3', problems.length === 0, problems);
  });

  // ── VIS3 ───────────────────────────────────────────────────────────────
  await guard('VIS3', async () => {
    const problems = [];
    const five = [
      ds.EV_PAST, ds.EV_NEG, ds.EV_REBASE,
      { id: 8, date: '2026-09-10', capital: 5100, adjustment: 0, rebase: true },
      { id: 9, date: '2026-09-15', capital: 5300, adjustment: 100, rebase: false }
    ];
    // Colores del ajuste
    {
      const p = await open({ events: five, viewport: { width: 1280, height: 800 } });
      await openDialog(p);
      const colors = await p.evaluate(() => ({
        pos: getComputedStyle(document.querySelector('.capital-event-adjustment.positive')).color,
        neg: getComputedStyle(document.querySelector('.capital-event-adjustment.negative')).color,
        zero: (() => { const e = [...document.querySelectorAll('.capital-event-adjustment')].find(x => !x.classList.contains('positive') && !x.classList.contains('negative')); return e ? getComputedStyle(e).color : null; })(),
        secondary: getComputedStyle(document.querySelector('.capital-event-sub')).color
      }));
      if (colors.pos !== 'rgb(87, 185, 138)' || colors.neg !== 'rgb(199, 84, 80)' || colors.zero !== colors.secondary) problems.push({ colors });
      await p.context().close();
    }
    // 390 px, 5 eventos
    {
      const p = await open({ events: five, viewport: { width: 390, height: 844 } });
      await p.evaluate(() => switchTab('stats'));
      const widthWithout = await p.evaluate(() => document.documentElement.scrollWidth);
      await openDialog(p);
      const geo = await p.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        rows: [...document.querySelectorAll('.capital-event-row')].map(r => { const b = r.getBoundingClientRect(); const x = r.querySelector('.row-action-btn').getBoundingClientRect(); return { left: b.left, right: b.right, btnW: x.width, btnH: x.height, btnRight: x.right }; })
      }));
      if (geo.scrollWidth > widthWithout) problems.push({ widthWithout, scrollWidth: geo.scrollWidth });
      if (geo.rows.length !== 5 || geo.rows.some(r => r.left < 0 || r.right > 390 || r.btnW <= 0 || r.btnH <= 0 || r.btnRight > r.right + 0.5)) problems.push({ geo });
      await p.context().close();
    }
    // 12 eventos: la lista tiene su propio desplazamiento
    {
      const many = [];
      for (let i = 0; i < 12; i++) many.push({ id: 100 + i, date: `2026-09-${String(i + 1).padStart(2, '0')}`, capital: 5000 + i * 10, adjustment: 10, rebase: i % 2 === 0 });
      const p = await open({ events: many, viewport: { width: 1280, height: 800 } });
      await openDialog(p);
      const m = await p.evaluate(() => { const l = document.getElementById('capital-history-list'); return { sh: l.scrollHeight, ch: l.clientHeight, ov: getComputedStyle(l).overflowY, n: l.querySelectorAll('.capital-event-row').length }; });
      if (m.n !== 12 || !(m.sh > m.ch) || m.ch > 220 || m.ov !== 'auto' && m.ov !== 'scroll') problems.push({ m });
      await p.context().close();
    }
    assert('VIS3', problems.length === 0, problems);
  });

  // Sin errores de página en ninguna de las apps de referencia
  if (pNone.__errors.length) assert('NOERR', false, pNone.__errors);
  await pNone.context().close();
  await browser.close();
  finish();
})().catch((e) => { console.error('ERROR en history.test.js', e); process.exit(2); });
