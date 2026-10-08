// Material para el juicio humano de AC-UC01-9 (no comprueba nada).
// Ejecuta: node tests/capital-history/screenshots.js  -> tests/capital-history/shots/*.png
const fs = require('fs');
const path = require('path');
const { launch, openApp, APP_URL } = require('./lib');
const ds = require('./fixtures/dataset');

const OUT = path.join(__dirname, 'shots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const written = [];
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    // Diálogo "Actualizar capital" con 6000 escrito y la casilla marcada
    let p = await openApp(browser, APP_URL(), { trades: ds.trades, initialCapital: ds.INITIAL_CAPITAL, viewport: { width: w, height: h } });
    await p.evaluate(() => switchTab('stats'));
    await p.click('#stat-card-current-cap');
    await p.fill('#f-capital-update', '6000');
    await p.check('#f-capital-rebase');
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.waitForTimeout(300);
    const f1 = path.join(OUT, `dialog-${w}.png`);
    await p.screenshot({ path: f1 }); written.push(f1);
    await p.context().close();

    // Modal de capital inicial con su aviso
    p = await openApp(browser, APP_URL(), { trades: ds.trades, initialCapital: ds.INITIAL_CAPITAL, viewport: { width: w, height: h } });
    await p.evaluate(() => switchTab('stats'));
    await p.click('#stat-card-initial-cap');
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.waitForTimeout(300);
    const f2 = path.join(OUT, `initial-modal-${w}.png`);
    await p.screenshot({ path: f2 }); written.push(f2);
    await p.context().close();
  }
  await browser.close();
  written.forEach(f => console.log(f));
})().catch((e) => { console.error(e); process.exit(2); });
