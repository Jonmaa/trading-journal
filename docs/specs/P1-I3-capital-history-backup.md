# Phase 1 — Iteration 3: Historial de cambios, borrado y backup

**Proves:** El usuario ve la lista de sus cambios de capital, puede borrar uno y las cifras vuelven exactamente a las de antes de crearlo; los backups guardan y restauran los cambios; y la versión anterior de la app sigue funcionando con los mismos datos.

**Satisfies:** AC-UC04-1, AC-UC04-2, AC-UC04-3, AC-UC04-4, AC-UC04-5, AC-UC04-6, AC-UC04-7, AC-UC05-3, AC-UC05-4, AC-UC05-7

**Generic design:** La lista, el borrado y el backup solo leen y escriben la lista `capitalEvents` del motor de la iteración 1; ninguno conoce los cálculos de R, % o curvas, que siguen saliendo de las funciones por fecha.

**Persona responsibilities:**
- Paula (Engineer) escribe los pasos [AUTHOR] (HTML, CSS, JS y tests).
- Claude Code ejecuta los pasos [EXECUTE] en el repo del usuario.
- Nora (Test Manager) owns the verification checklist and the acceptance criteria it cites

---

## Prerequisites
- Las iteraciones 1 y 2 están construidas y verificadas: `node tests/capital-history/engine.test.js` (15 líneas `PASS`) y `node tests/capital-history/dialog.test.js` terminan con código 0. Existen `capitalEvents`, `sanitizeCapitalEvents()`, `saveCapitalEventsToStorage()`, `currentCapital()`, `previewCapitalUpdate()`, el modal `#capitalUpdateModal` y `tests/capital-history/lib.js` con `openApp`, `snapshot`, `watchDialogs`, `blockStorageKey`, `readLS`.
- Existe `tests/capital-history/fixtures/journal.8f58390.html` (versión anterior de la app, de la iteración 1) y `fixtures/golden-8f58390.json`.
- Node 18+ y Playwright con Chromium (`PW_CHROMIUM` si no está en la ruta por defecto).
- Contexto de `journal.html` que se usa aquí (ya existe): `refreshApp()` (la llaman `applyLanguage()`, `toggleHideBalance()` y todos los guardados), `masked(text)` (devuelve `***` con "ocultar balance"), `fmt(n)`, `formatDate(d)` (`dd/mm/yy` en ES, `mm/dd/yy` en EN), `i18n(key, vars)` con marcadores `{nombre}` (si falta una clave en EN, cae al ES: por eso el test comprueba las dos claves a mano), `I18N.es` / `I18N.en`, `exportData()` (construye `payload` con `app`, `exportedAt`, `initialCapital`, `trades`), `importData(event)` (pide `confirm`, sustituye `trades` e `initialCapital`, y si falla el guardado restaura los valores previos), el botón de borrar de la tabla (`class="row-action-btn danger"` con un icono de papelera en SVG), y las reglas CSS `.row-action-btn`, `--bg-secondary`, `--border`, `--mono`.
- Aislamiento entre tenants: no aplica (app local de un solo usuario, sin endpoints ni servidor).

## Steps

### Step 1 — Comprobar el punto de partida [EXECUTE]
```bash
cd ~/Documents/VSCODE/tradingjournal
git status --short
node -e "const fs=require('fs');const c=fs.readFileSync('journal.html','utf8');const m=c.match(/<script>([\s\S]*)<\/script>/);new Function(m[1]);console.log('JS SYNTAX OK')"
node tests/capital-history/engine.test.js
node tests/capital-history/dialog.test.js
ls tests/capital-history/fixtures
```
Esperado: sin cambios sin commitear en `journal.html`; `JS SYNTAX OK`; ambos tests con código 0; `fixtures` contiene `dataset.js`, `journal.8f58390.html` y `golden-8f58390.json`. Si algo falla, **para**: la iteración anterior no está lista.

### Step 2 — HTML, CSS y textos de la lista [AUTHOR]
En `journal.html`:

**a) Sección de historial dentro del diálogo.** En `#capitalUpdateModal`, justo después de `<div class="capital-update-note" id="capital-update-note"></div>` y antes de cerrar `modal-body`, añade:
```html
      <div class="capital-history">
        <div class="capital-history-title" id="capital-history-title">Cambios de capital</div>
        <div class="capital-history-list" id="capital-history-list"></div>
      </div>
```

**b) CSS.** Debajo de las reglas `.capital-update-*` de la iteración 2 añade:
```css
  .capital-history { margin-top: 1.25rem; border-top: 1px solid var(--border); padding-top: 1rem; }
  .capital-history-title { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px; }
  .capital-history-list { display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto; }
  .capital-history-empty { font-size: 12px; color: var(--text-muted); }
  .capital-event-row { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; padding: 8px 10px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; font-size: 12px; }
  .capital-event-main { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }
  .capital-event-date { font-family: var(--mono); color: var(--text-secondary); }
  .capital-event-capital { color: var(--text-primary); font-weight: 600; }
  .capital-event-sub { grid-column: 1; display: flex; flex-wrap: wrap; gap: 2px 12px; font-family: var(--mono); font-size: 11.5px; color: var(--text-secondary); }
  .capital-event-adjustment.positive { color: var(--green); }
  .capital-event-adjustment.negative { color: var(--red); }
  .capital-event-row .row-action-btn { grid-row: 1 / span 2; grid-column: 2; align-self: center; }
```
Una fila son dos líneas: fecha y capital indicado, y debajo el ajuste (verde si es positivo, rojo si es negativo, sin color si es 0) y el 1R; el botón de borrar queda a la derecha. Así cada fila cabe en los ≈ 314 px útiles del diálogo a 390 px de pantalla. La lista tiene su propio desplazamiento vertical (`max-height: 220px`) para que el diálogo no crezca sin límite.

**c) Textos.** Añade a los diccionarios `I18N`:

| Clave | ES | EN |
|---|---|---|
| `capital_history_title` | `Cambios de capital` | `Capital changes` |
| `capital_history_empty` | `Todavía no has registrado ningún cambio de capital.` | `No capital changes recorded yet.` |
| `capital_event_capital` | `Capital {amount}` | `Capital {amount}` |
| `capital_event_adjustment` | `Ajuste {amount}` | `Adjustment {amount}` |
| `capital_event_oner` | `1R {amount}` | `1R {amount}` |
| `capital_event_oner_none` | `1R —` | `1R —` |
| `capital_event_delete_hint` | `Borrar este cambio de capital` | `Delete this capital change` |
| `capital_event_delete_confirm` | `¿Borrar el cambio de capital del {date} (capital {capital}, ajuste {adjustment})? Las cifras volverán a ser las que había sin él. Tus trades no se modifican.` | `Delete the capital change of {date} (capital {capital}, adjustment {adjustment})? Figures will go back to what they were without it. Your trades are not modified.` |

(Las claves `capital_event_capital`, `capital_event_oner` y `capital_event_oner_none` son iguales en los dos idiomas a propósito: llevan solo un número o un símbolo.)

### Step 3 — Dibujar la lista y borrar un evento [AUTHOR]
En `journal.html`, justo debajo de `guardarActualizacionCapital()` (iteración 2), añade:

```js
// Copia exacta del icono de papelera del botón de borrar de la tabla de operaciones.
const CAPITAL_EVENT_TRASH_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';

// Importes de la lista y de la confirmación: pasan siempre por masked() (modo "ocultar balance").
function eventMoney(n) { return masked(`$${fmt(n)}`); }
function eventSignedMoney(n) { return masked((n > 0 ? '+' : n < 0 ? '-' : '') + `$${fmt(Math.abs(n))}`); }

function renderCapitalEventsList() {
  const el = document.getElementById('capital-history-list');
  if (!el) return;
  if (!capitalEvents.length) {
    el.innerHTML = `<div class="capital-history-empty">${i18n('capital_history_empty')}</div>`;
    return;
  }
  // capitalEvents va ordenado por fecha y luego id, de más antiguo a más reciente: se muestra al revés.
  el.innerHTML = [...capitalEvents].reverse().map(ev => {
    const cls = ev.adjustment > 0 ? ' positive' : (ev.adjustment < 0 ? ' negative' : '');
    const oneR = ev.rebase
      ? i18n('capital_event_oner', { amount: eventMoney(ev.capital * 0.01) })
      : i18n('capital_event_oner_none');
    return `<div class="capital-event-row" data-event-id="${ev.id}">
      <div class="capital-event-main">
        <span class="capital-event-date">${formatDate(ev.date)}</span>
        <span class="capital-event-capital">${i18n('capital_event_capital', { amount: eventMoney(ev.capital) })}</span>
      </div>
      <button class="row-action-btn danger" onclick="deleteCapitalEvent(${ev.id})" title="${i18n('capital_event_delete_hint')}">${CAPITAL_EVENT_TRASH_SVG}</button>
      <div class="capital-event-sub">
        <span class="capital-event-adjustment${cls}">${i18n('capital_event_adjustment', { amount: eventSignedMoney(ev.adjustment) })}</span>
        <span class="capital-event-oner">${oneR}</span>
      </div>
    </div>`;
  }).join('');
}

function deleteCapitalEvent(id) {
  const ev = capitalEvents.find(e => e.id === id);
  if (!ev) return;
  if (!confirm(i18n('capital_event_delete_confirm', {
    date: formatDate(ev.date), capital: eventMoney(ev.capital), adjustment: eventSignedMoney(ev.adjustment)
  }))) return;                                                  // Cancelar: no cambia nada
  const previous = capitalEvents;
  capitalEvents = previous.filter(e => e.id !== id);
  if (!saveCapitalEventsToStorage()) { capitalEvents = previous; return; }
  refreshApp();                                                // vuelve a calcular todo y redibuja la lista
  if (document.getElementById('capitalUpdateModal').classList.contains('open')) previewCapitalUpdate();
}
```
Qué no debe pasar: ni `renderCapitalEventsList()` ni `deleteCapitalEvent()` tocan `trades`, `tradelog_trades` ni `tradelog_initial_cap` (no llames a `saveTradesToStorage()` ni a `saveCapitalToStorage()` desde ellas). Todas las cifras de $ salen por `masked()`. Los ids que van en el `onclick` son números (los garantiza `sanitizeCapitalEvents()`).

Conexiones:
- Al final de `refreshApp()` añade la llamada `renderCapitalEventsList();` (siempre, no solo con una pestaña activa; la lista vive dentro del diálogo y es barata).
- En `applyLanguage()`, junto a las líneas de la iteración 2, añade: `document.getElementById('capital-history-title').textContent = i18n('capital_history_title');` (la lista en sí se redibuja porque `applyLanguage()` termina llamando a `refreshApp()`).

### Step 4 — Exportar e importar los cambios de capital [AUTHOR]
**`exportData()`:** en el objeto `payload`, justo después de `initialCapital: initialCapital,` añade
```js
    capitalEvents: capitalEvents.map(ev => ({ ...ev })),
```
(no cambies nada más: `trades`, `exportedAt` y el nombre del fichero siguen igual).

**`importData(event)`**, dentro de `reader.onload`:
- Justo debajo de `const previousCapital = initialCapital;` añade `const previousCapitalEvents = capitalEvents;`.
- Justo debajo del bloque `if (typeof payload.initialCapital === 'number' && payload.initialCapital > 0) { ... }` añade:
```js
    // Un backup antiguo no trae cambios de capital: la lista queda vacía. Si trae algo raro, se sanea igual que al arrancar.
    capitalEvents = Array.isArray(payload.capitalEvents) ? sanitizeCapitalEvents(payload.capitalEvents) : [];
```
- Sustituye
```js
    const okCapital = saveCapitalToStorage(initialCapital);
    if (!okTrades || !okCapital) {
      trades = previousTrades;
      initialCapital = previousCapital;
```
por
```js
    const okCapital = saveCapitalToStorage(initialCapital);
    const okEvents = saveCapitalEventsToStorage();
    if (!okTrades || !okCapital || !okEvents) {
      trades = previousTrades;
      initialCapital = previousCapital;
      capitalEvents = previousCapitalEvents;
```
(el resto de la función queda igual). El mensaje de confirmación ya dice que la importación sustituye el historial actual; no lo cambies.

### Step 5 — Tests de historial, backup y textos [AUTHOR]
**a) `tests/capital-history/lib.js`** — añade `downloadExport(page)`: llama a `exportData()` en la página esperando `page.waitForEvent('download')`, guarda el fichero en un directorio temporal del test y devuelve `{ path, json }` (con `JSON.parse` del contenido); y `importFile(page, path)`: `page.setInputFiles('input[type="file"][accept="application/json"]', path)` y espera 700 ms a que termine `reader.onload` (los `confirm`/`alert` los registra y acepta el `watchDialogs` que el test haya puesto antes); y `writeTempJSON(obj)`: escribe un objeto como fichero JSON temporal para importarlo. Añade también a `openApp` la opción `rawStorage` (objeto clave → cadena que se siembra tal cual en `localStorage`, en lugar de `trades`/`events`/`initialCapital`), sin cambiar el comportamiento por defecto.

**b) `tests/capital-history/history.test.js`** (usa `lib.js` y `dataset.js`; "hoy" = 2026-10-08; los textos esperados se calculan en la página con `fmt()`, `formatDate()` e `i18n()`):
- **AC-UC04-1:** siembra `[EV_PAST, EV_NEG, EV_REBASE]` (ids 4, 5, 1). Las filas `.capital-event-row` salen en este orden: 2026-10-08, 2026-09-20, 2026-09-01. Fila 1: `.capital-event-date` = `formatDate('2026-10-08')`, `.capital-event-capital` = `i18n('capital_event_capital',{amount:'$'+fmt(6000)})`, `.capital-event-adjustment` = `i18n('capital_event_adjustment',{amount:'+$'+fmt(660)})`, `.capital-event-oner` = `i18n('capital_event_oner',{amount:'$'+fmt(60)})`. Fila 2: capital `$`+`fmt(5000)`, ajuste `-$`+`fmt(150)`, 1R `$`+`fmt(50)`. Fila 3: capital `$`+`fmt(5200)`, ajuste `+$`+`fmt(200)`, `.capital-event-oner` = `i18n('capital_event_oner_none')` (contiene "—"). Dos eventos del mismo día (`EV_REBASE` id 1 y `EV_REBASE_2` id 3): sale primero el de id 3. Las clases de color: `positive` en +660, `negative` en −150.
- **AC-UC04-2:** sin eventos, `#capital-history-list` contiene `.capital-history-empty` con `i18n('capital_history_empty')` y ninguna `.capital-event-row`; tras guardar un evento por el diálogo el mensaje desaparece y hay 1 fila; tras borrarlo (confirmación aceptada) vuelve el mensaje.
- **AC-UC04-3:** (i) siembra `[EV_PAST, EV_REBASE]`, abre el diálogo, borra `EV_REBASE` con `watchDialogs(page)` aceptando: el `confirm` se mostró una vez y su texto es `i18n('capital_event_delete_confirm', {...})` con la fecha `08/10/26`; `capitalEvents` queda con 1 evento; `readLS('tradelog_capital_events')` también. `snapshot()` de esa página es idéntico (`JSON.stringify`) al `snapshot()` de otra app sembrada **solo** con `[EV_PAST]`. (ii) borra también `EV_PAST`: `snapshot()` idéntico al de una app sin eventos y `currentCapital() === 5340`. (iii) borrar un evento con otros dos en medio (`EV_PAST`, `EV_NEG`, `EV_REBASE` → borrar `EV_NEG`) deja `snapshot()` idéntico al de `[EV_PAST, EV_REBASE]`. (iv) un evento con recálculo anterior a varios trades (`{id:11, date:'2026-09-01', capital:8000, adjustment:2660, rebase:true}`): con él las cifras de la pestaña Rendimiento difieren de las de una app sin eventos (el caso tiene valor); justo después de borrarlo, **sin cambiar de pestaña**, `#stat-current-cap`, `#stat-ytd-pct`, `#stat-ytd-sub`, `#stat-month-pct` y `#stat-month-sub` ya muestran lo mismo que una app sin eventos (el borrado vuelve a calcular y pintar la pantalla por sí solo, no solo al leerla `snapshot()`), y `snapshot()` es idéntico al de una app sin eventos.
- **AC-UC04-4:** con `watchDialogs(page, { accept:false })`, pulsar borrar → se muestra el `confirm`, y después `capitalEvents`, `readLS('tradelog_capital_events')` y `snapshot()` son iguales que antes de pulsar; la fila sigue en la lista.
- **AC-UC04-5:** con `[EV_PAST, EV_REBASE]` y `toggleHideBalance()` activado: `.capital-event-capital`, `.capital-event-adjustment` y `.capital-event-oner` de las filas con 1R son exactamente el texto de cada clave con `{amount:'***'}` (por ejemplo `i18n('capital_event_capital',{amount:'***'})`), sin ningún dígito de importe; la fecha sigue visible; la fila sin recalculo conserva `1R —`; el texto del `confirm` de borrado lleva `***` en capital y ajuste. Al desactivar el modo, los importes reales vuelven.
- **AC-UC04-7:** siembra el conjunto fijo; guarda `S0 = localStorage.getItem('tradelog_trades')` (cadena cruda). Guardar un evento por el diálogo (`6000`, con recalculo): `S1 === S0`. Borrarlo: `S2 === S0`. Además `tradelog_initial_cap` es el mismo en los tres momentos y `guardarActualizacionCapital.toString()` y `deleteCapitalEvent.toString()` no contienen `saveTradesToStorage` ni `tradelog_trades`.
- **AC-UC05-3:** (i) app con el conjunto fijo y `[EV_PAST, EV_REBASE]`: `downloadExport` → `json.capitalEvents` es igual (`deepEqual`) a los dos eventos con exactamente los campos `id`, `date`, `capital`, `adjustment`, `rebase`; `json.initialCapital === 5000`; `json.trades.length === 8`. (ii) importar ese fichero en una app limpia (sin eventos): `capitalEvents` iguales, `readLS('tradelog_capital_events')` igual y `snapshot()` idéntico al de la app original. (iii) copia del JSON **sin** el campo `capitalEvents` (backup antiguo) importada en una app que SÍ tiene eventos: la importación funciona (`import_done`), `capitalEvents.length === 0`, la lista muestra el mensaje de vacío y `snapshot()` es idéntico al de una app sin eventos. (iv) copia con `capitalEvents: "x"` y con `capitalEvents: [{"date":"2026-10-08"}]`: la importación funciona y deja la lista vacía. (v) con `blockStorageKey(page,'tradelog_capital_events')`, importar el fichero de (i): sale un `alert` con `i18n('storage_full_capital_events')` y `capitalEvents` vuelve a los eventos que había antes de importar.
- **AC-UC05-4:** abre la app nueva, guarda un evento por el diálogo (`6000`, con recalculo) y vuelca todo `localStorage` (`tradelog_trades`, `tradelog_initial_cap`, `tradelog_lang`, `tradelog_capital_events`). Abre `fixtures/journal.8f58390.html` con exactamente esas claves sembradas (`openApp(browser, BASELINE_URL, { rawStorage })`) y comprueba: cero `pageerror` y cero mensajes `console.error`; `snapshot()` es idéntico al de `fixtures/golden-8f58390.json`; y tras cargar, `localStorage.getItem('tradelog_capital_events')` sigue siendo la misma cadena (la versión antigua no la toca).
- **AC-UC05-7:** `NEW_KEYS` = todas las claves nuevas de la fase: `storage_full_capital_events` (iteración 1); `update_capital_title`, `update_capital_label`, `update_capital_hint`, `update_capital_adjust`, `update_capital_no_adjust`, `update_capital_rebase`, `update_capital_oner_change`, `update_capital_oner_keep`, `update_capital_note`, `capital_initial_warning` (iteración 2); `capital_history_title`, `capital_history_empty`, `capital_event_capital`, `capital_event_adjustment`, `capital_event_oner`, `capital_event_oner_none`, `capital_event_delete_hint`, `capital_event_delete_confirm` (iteración 3). Para cada clave: existe y no está vacía en `I18N.es` **y** en `I18N.en`; tiene el mismo conjunto de marcadores `{...}` en ambos; y el texto ES es distinto del EN salvo en la lista permitida (`capital_event_capital`, `capital_event_oner`, `capital_event_oner_none`). En la interfaz, en ES y tras `applyLanguage('en')` (y de vuelta): el `textContent` de `#capitalUpdateTitle`, `#lbl-capital-update-input`, `#lbl-capital-rebase`, `#capital-update-note`, `#btn-capital-update-cancel`, `#btn-capital-update-save`, `#capital-initial-note`, `#capital-history-title` y los atributos `title` de `#stat-card-current-cap` y del botón de borrar de una fila son iguales al `i18n(...)` del idioma activo; con el diálogo abierto y datos escritos, `#capital-update-adjust`, `#capital-update-oner`, la lista y el texto del `confirm` de borrado también cambian de idioma.

Pruebas negativas (id `NEG3`): (1) borrar con Cancelar no cambia nada (`AC-UC04-4`); (2) borrar un id que no existe (`deleteCapitalEvent(999999)`) no hace nada ni muestra `confirm`; (3) importar un JSON cuyo `capitalEvents` trae un evento con `capital: -5` o con fecha `"2026-13-99x"` descarta ese evento y conserva los válidos; (4) ni exportar ni importar modifican `tradelog_initial_cap` más allá de lo que ya hacía antes.

Pruebas de visual y UX (id `VIS3`): `.capital-event-adjustment.positive` tiene color `rgb(87, 185, 138)` y `.negative` `rgb(199, 84, 80)`; con el viewport a 390×844 y 5 eventos sembrados, abrir el diálogo no añade ancho a la página (`document.documentElement.scrollWidth` con el diálogo abierto ≤ el de la misma pestaña con el diálogo cerrado; la página ya es más ancha que 390 px antes de esta fase y no es responsive, como se recogió en la iteración 2), el `getBoundingClientRect()` de cada `.capital-event-row` queda dentro de `[0, 390]` y el botón de borrar de cada fila es visible y queda dentro de su fila; con 12 eventos `#capital-history-list` tiene `scrollHeight > clientHeight` y `clientHeight <= 220`.

**c) `tests/capital-history/texts-dump.js`** (no hace comprobaciones; es el material para el juicio humano): con "hoy" = 2026-10-08 y `[EV_PAST, EV_NEG, EV_REBASE]` sembrados, escribe en `tests/capital-history/shots/`: `texts-es.txt` y `texts-en.txt` (una línea `clave: texto` por cada clave de `NEW_KEYS`, más el texto real de la lista y del `confirm` de borrado en ese idioma, con los importes reales), y las capturas `history-1280.png`, `history-390.png` (diálogo abierto con la lista) y `history-hidden-1280.png` (con "ocultar balance" activado).

### Step 6 — Sintaxis y todos los tests [EXECUTE]
```bash
cd ~/Documents/VSCODE/tradingjournal
node -e "const fs=require('fs');const c=fs.readFileSync('journal.html','utf8');const m=c.match(/<script>([\s\S]*)<\/script>/);new Function(m[1]);console.log('JS SYNTAX OK')"
node tests/capital-history/engine.test.js
node tests/capital-history/dialog.test.js
node tests/capital-history/history.test.js
```
Esperado: `JS SYNTAX OK`; `engine.test.js` (15 líneas `PASS`) y `dialog.test.js` siguen en verde; `history.test.js` imprime una línea `PASS` por cada criterio ejecutable de **Satisfies** (`AC-UC04-1`, `-2`, `-3`, `-4`, `-5`, `-7`, `AC-UC05-3`, `AC-UC05-4`, `AC-UC05-7`) y por `NEG3` y `VIS3`, y ninguna `FAIL`; código de salida 0 en los tres.

### Step 7 — Generar el material para el juicio humano y comprobar el alcance [EXECUTE]
```bash
cd ~/Documents/VSCODE/tradingjournal
node tests/capital-history/texts-dump.js
git status --short
git diff --stat 8f58390 -- journal.html
```
Esperado: se listan `texts-es.txt`, `texts-en.txt`, `history-1280.png`, `history-390.png` y `history-hidden-1280.png`; `git status --short` solo muestra `journal.html`, `tests/capital-history/` y `docs/`; el `git diff --stat` solo toca `journal.html`.

---

## Verification (Nora)
- [ ] `AC-UC04-1` (executable) — `node tests/capital-history/history.test.js` imprime `PASS AC-UC04-1`: con tres eventos la lista sale en el orden 08/10/26, 20/09/26, 01/09/26, con capital `$6000,00`, ajuste `+$660,00`, 1R `$60,00`; capital `$5000,00`, ajuste `-$150,00`, 1R `$50,00`; capital `$5200,00`, ajuste `+$200,00`, 1R `—`.
- [ ] `AC-UC04-2` (executable) — `PASS AC-UC04-2`: sin eventos aparece "Todavía no has registrado ningún cambio de capital."; desaparece al crear uno y vuelve al borrarlo.
- [ ] `AC-UC04-3` (executable) — `PASS AC-UC04-3`: tras borrar (con confirmación) el evento más reciente, el de en medio y el último que quedaba, `snapshot()` es idéntico al de una app que nunca tuvo ese evento (historial, estadísticas en $ y R, calendario y los 10 trazados de curva).
- [ ] `AC-UC04-4` (executable) — `PASS AC-UC04-4`: con `confirm` rechazado, la lista, `localStorage` y `snapshot()` quedan idénticos.
- [ ] `AC-UC04-5` (executable) — `PASS AC-UC04-5`: con "ocultar balance", capital, ajuste y 1R de la lista y del texto de confirmación salen como `***`; se ve la fecha; sin el modo, salen los importes.
- [ ] `AC-UC04-6` (human) — Abre `tests/capital-history/shots/texts-es.txt` y `texts-en.txt` y las capturas `history-1280.png`, `history-390.png`. Marca sí/no en cada punto, una vez en español y otra en inglés: (1) todos los textos nuevos del diálogo, de la lista y del aviso están en el idioma elegido, sin ninguna palabra del otro; (2) los importes y las fechas usan el formato del idioma (ES: `6000,00` y `08/10/26`; EN: `6,000.00` y `10/08/26`); (3) cada texto se entiende sin leer el código (dice qué pasa y no usa claves ni nombres internos); (4) los textos de la confirmación de borrado dicen qué se borra y que los trades no se modifican. Aprobado solo si los cuatro puntos son "sí" en los dos idiomas.
- [ ] `AC-UC04-7` (executable) — `PASS AC-UC04-7`: `tradelog_trades` es la misma cadena (byte a byte) antes de guardar, tras guardar y tras borrar el evento; `tradelog_initial_cap` no cambia; el código de guardar y borrar no llama a `saveTradesToStorage`.
- [ ] `AC-UC05-3` (executable) — `PASS AC-UC05-3`: el JSON exportado trae `capitalEvents` con los 5 campos; importarlo restaura los eventos y `snapshot()` idéntico; un backup sin ese campo se importa y deja la lista vacía; con el almacenamiento bloqueado la importación avisa y conserva los eventos previos.
- [ ] `AC-UC05-4` (executable) — `PASS AC-UC05-4`: la versión `8f58390` abierta con el almacenamiento que contiene `tradelog_capital_events` carga sin `pageerror` ni `console.error`, su `snapshot()` es idéntico al de `golden-8f58390.json` y la clave de eventos queda intacta.
- [ ] `AC-UC05-7` (executable) — `PASS AC-UC05-7`: las 19 claves nuevas existen en ES y EN con los mismos marcadores, y todos los textos del diálogo, la lista, los avisos y los tooltips cambian al alternar ES/EN.
- [ ] Cross-tenant: no aplica (app local de un solo usuario, sin servidor ni endpoints).
- [ ] Negative test — `NEG3`: Cancelar el borrado no cambia nada; borrar un id inexistente no hace nada; importar eventos inválidos (capital negativo, fecha mal formada, sin `id`, campo que no es lista) los descarta sin romper la app; el backup antiguo no rompe la importación.
- [ ] UX — lista vacía con mensaje (`AC-UC04-2`).
- [ ] UX — borrar pide confirmación que nombra la fecha, el capital y el ajuste (`AC-UC04-3`).
- [ ] UX — Cancelar no cambia nada (`AC-UC04-4`).
- [ ] Visual — los importes de la lista salen enmascarados con "ocultar balance" (`AC-UC04-5`; captura `history-hidden-1280.png`).
- [ ] Visual — ajuste positivo `rgb(87, 185, 138)` y negativo `rgb(199, 84, 80)`; a 390 px cada fila queda dentro de la pantalla y el botón de borrar es visible; con 12 eventos la lista tiene su propio desplazamiento y no pasa de 220 px de alto (`VIS3`).
- [ ] Las iteraciones 1 y 2 siguen intactas: `engine.test.js` (15 líneas `PASS`) y `dialog.test.js` siguen en verde, y `git diff --stat 8f58390 -- journal.html` solo toca `journal.html`.
