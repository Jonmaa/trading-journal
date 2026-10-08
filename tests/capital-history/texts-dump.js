// Material para el juicio humano de AC-UC04-6 (no comprueba nada).
// Ejecuta: node tests/capital-history/texts-dump.js
// Escribe en tests/capital-history/shots/: texts-es.txt, texts-en.txt, history-1280.png, history-390.png, history-hidden-1280.png
const fs = require('fs');
const path = require('path');
const { launch, openApp, APP_URL, watchDialogs } = require('./lib');
const ds = require('./fixtures/dataset');

const OUT = path.join(__dirname, 'shots');
const NEW_KEYS = [
  'storage_full_capital_events',
  'update_capital_title', 'update_capital_label', 'update_capital_hint', 'update_capital_adjust', 'update_capital_no_adjust',
  'update_capital_rebase', 'update_capital_oner_change', 'update_capital_oner_keep', 'update_capital_note', 'capital_initial_warning',
  'capital_history_title', 'capital_history_empty', 'capital_event_capital', 'capital_event_adjustment', 'capital_event_oner',
  'capital_event_oner_none', 'capital_event_delete_hint', 'capital_event_delete_confirm'
];
const EVENTS = [ds.EV_PAST, ds.EV_NEG, ds.EV_REBASE];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const written = [];
  const open = (opts) => openApp(browser, APP_URL(), { trades: ds.trades, initialCapital: ds.INITIAL_CAPITAL, events: EVENTS, ...opts });

  // Textos en cada idioma: las claves nuevas tal cual, y lo que el usuario ve de verdad (con importes reales)
  for (const lng of ['es', 'en']) {
    const p = await open({ lang: lng });
    const d = watchDialogs(p, { accept: false });
    await p.evaluate(() => switchTab('stats'));
    await p.click('#stat-card-current-cap');
    await p.fill('#f-capital-update', '7000');
    await p.check('#f-capital-rebase');
    const shown = await p.evaluate(() => ({
      title: document.getElementById('capitalUpdateTitle').textContent,
      label: document.getElementById('lbl-capital-update-input').textContent,
      adjust: document.getElementById('capital-update-adjust').textContent,
      oner: document.getElementById('capital-update-oner').textContent,
      note: document.getElementById('capital-update-note').textContent,
      historyTitle: document.getElementById('capital-history-title').textContent,
      rows: [...document.querySelectorAll('.capital-event-row')].map(r => r.querySelector('.capital-event-date').textContent + ' | '
        + r.querySelector('.capital-event-capital').textContent + ' | ' + r.querySelector('.capital-event-adjustment').textContent + ' | '
        + r.querySelector('.capital-event-oner').textContent),
      deleteHint: document.querySelector('.capital-event-row .row-action-btn').title
    }));
    await p.click(`.capital-event-row[data-event-id="${ds.EV_REBASE.id}"] .row-action-btn`);
    await p.waitForTimeout(200);
    await p.evaluate(() => document.getElementById('capitalUpdateModal').classList.remove('open'));
    await p.click('#stat-card-initial-cap');
    const initialNote = await p.evaluate(() => document.getElementById('capital-initial-note').textContent);
    const cardHint = await p.evaluate(() => document.getElementById('stat-card-current-cap').title);
    const keys = await p.evaluate((ks) => ks.map(k => k + ': ' + I18N[lang][k]), NEW_KEYS);

    const lines = [];
    lines.push(`# Textos nuevos de la Fase 1 — idioma: ${lng}  ("hoy" = 08/10/2026)`);
    lines.push('', '## Claves nuevas (con sus marcadores {…})', ...keys);
    lines.push('', '## Lo que ve el usuario (diálogo "Actualizar capital" con 7000 escrito y 1R recalculado)',
      `Título: ${shown.title}`, `Etiqueta: ${shown.label}`, `Línea de ajuste: ${shown.adjust}`, `Línea de 1R: ${shown.oner}`,
      `Aviso: ${shown.note}`, `Tooltip de la tarjeta Capital Actual: ${cardHint}`,
      '', `## Lista "${shown.historyTitle}" (más reciente primero; fecha | capital | ajuste | 1R)`, ...shown.rows,
      `Tooltip del botón de borrar: ${shown.deleteHint}`,
      '', '## Confirmación al pulsar borrar en la fila del 08/10', d.messages[0] || '(no se mostró)',
      '', '## Aviso en el modal de capital inicial', initialNote);
    const f = path.join(OUT, `texts-${lng}.txt`);
    fs.writeFileSync(f, lines.join('\n') + '\n', 'utf8');
    written.push(f);
    await p.context().close();
  }

  // Capturas
  for (const [name, w, h, hidden] of [['history-1280', 1280, 800, false], ['history-390', 390, 844, false], ['history-hidden-1280', 1280, 800, true]]) {
    const p = await open({ viewport: { width: w, height: h } });
    if (hidden) await p.evaluate(() => toggleHideBalance());
    await p.evaluate(() => switchTab('stats'));
    await p.click('#stat-card-current-cap');
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    // Que se vea la lista: el cuerpo del diálogo se desplaza hasta el final
    await p.evaluate(() => { const b = document.querySelector('#capitalUpdateModal .modal-body'); if (b) b.scrollTop = b.scrollHeight; });
    await p.waitForTimeout(400);
    const f = path.join(OUT, `${name}.png`);
    await p.screenshot({ path: f });
    written.push(f);
    await p.context().close();
  }
  await browser.close();
  written.forEach(f => console.log(f));
})().catch((e) => { console.error(e); process.exit(2); });
