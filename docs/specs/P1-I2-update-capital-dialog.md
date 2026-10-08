# Phase 1 — Iteration 2: Diálogo "Actualizar capital"

**Proves:** El usuario puede pulsar "Capital Actual", escribir su capital real de hoy y, si quiere, recalcular el 1R como el 1 % de ese capital desde hoy, y la app guarda el evento con la fecha local sin tocar ningún trade.

**Satisfies:** AC-UC01-1, AC-UC01-2, AC-UC01-3, AC-UC01-4, AC-UC01-5, AC-UC01-7, AC-UC01-8, AC-UC01-9, AC-UC01-10, AC-UC02-1, AC-UC02-2, AC-UC02-6, AC-UC02-7, AC-UC05-6

**Generic design:** El diálogo solo recoge un capital y una casilla y llama al motor de la iteración 1 (`currentCapital()`, `capitalEvents`, `saveCapitalEventsToStorage()`); no calcula nada por su cuenta, así que cualquier otra pantalla podría crear eventos igual.

**Persona responsibilities:**
- Paula (Engineer) escribe los pasos [AUTHOR] (HTML, CSS, JS y tests).
- Claude Code ejecuta los pasos [EXECUTE] en el repo del usuario.
- Nora (Test Manager) owns the verification checklist and the acceptance criteria it cites

---

## Prerequisites
- La iteración 1 está construida y verificada: `node tests/capital-history/engine.test.js` termina con código 0 y una línea `PASS` por cada uno de sus 14 criterios. Existen `capitalEvents`, `currentCapital()`, `sanitizeCapitalEvents()`, `saveCapitalEventsToStorage()`, `oneRValue()` (ya basado en la fecha de hoy) y la clave de texto `storage_full_capital_events`.
- Existen `tests/capital-history/lib.js` y `tests/capital-history/fixtures/dataset.js` (iteración 1). Este paso **amplía** `lib.js` sin cambiar el comportamiento por defecto de nada de lo que ya hace.
- Node 18+ y Playwright con Chromium (`PW_CHROMIUM` si no está en la ruta por defecto).
- Contexto de `journal.html` que se usa aquí (ya existe): la tarjeta `#stat-card-initial-cap` (`stat-card stat-card--editable`, `onclick="configurarCapital()"`); la tarjeta de "Capital Actual" es hoy un `stat-card` sin clic (`#label-current-cap`, `#stat-current-cap`); el modal `#capitalModal` (clases `modal-overlay` / `modal modal-sm` / `modal-header` / `modal-body` / `form-group full` / `modal-footer`, botones `btn btn-ghost` y `btn btn-primary`); `closeCapitalModal()`, `closeCapitalModalIfOverlay(e)`, `guardarCapital()`; `parseSpanishOrPlainNumber(s)`; `fmt(n)` (2 decimales, `es-ES`/`en-US` según el idioma); `i18n(key, vars)` con marcadores `{nombre}`; `applyLanguage()`; `toDateStr(date)` (fecha **local**); `refreshApp()`. `.btn:disabled { opacity: 0.4 }` ya existe.
- Aislamiento entre tenants: no aplica (app local de un solo usuario, sin endpoints ni servidor).

## Steps

### Step 1 — Comprobar el punto de partida [EXECUTE]
```bash
cd ~/Documents/VSCODE/tradingjournal
git status --short
node -e "const fs=require('fs');const c=fs.readFileSync('journal.html','utf8');const m=c.match(/<script>([\s\S]*)<\/script>/);new Function(m[1]);console.log('JS SYNTAX OK')"
node tests/capital-history/engine.test.js
```
Esperado: `git status --short` sin cambios sin commitear en `journal.html`; `JS SYNTAX OK`; 14 líneas `PASS AC-UC..` y código de salida 0. Si algo falla, **para**: la iteración 1 no está lista.

### Step 2 — HTML y CSS del diálogo, la tarjeta y el aviso [AUTHOR]
En `journal.html`:

**a) Tarjeta "Capital Actual" pulsable.** Sustituye
```html
        <div class="stat-card">
          <div class="stat-label" id="label-current-cap">Capital Actual</div>
```
por
```html
        <div class="stat-card stat-card--editable" id="stat-card-current-cap" onclick="abrirActualizarCapital()" title="Haz clic para actualizar">
          <div class="stat-label" id="label-current-cap">Capital Actual</div>
```
(no cambies nada más de la tarjeta; `.stat-card--editable` ya da `cursor: pointer` y `background: var(--bg-hover)` al pasar el ratón, igual que la tarjeta de capital inicial).

**b) Aviso en el modal de capital inicial.** Dentro de `#capitalModal`, justo después del `</div>` que cierra el `form-group full` del campo `f-capital` y antes de cerrar `modal-body`, añade:
```html
      <div class="capital-update-note" id="capital-initial-note"></div>
```

**c) Modal nuevo.** Justo después del `</div>` que cierra `#capitalModal` y antes de `<script>`, añade:
```html
<!-- ─── MODAL DE ACTUALIZAR CAPITAL ─── -->
<div class="modal-overlay" id="capitalUpdateModal" onclick="closeCapitalUpdateModalIfOverlay(event)">
  <div class="modal modal-sm">
    <div class="modal-header">
      <h3 style="font-size:15px;" id="capitalUpdateTitle">Actualizar capital</h3>
      <button class="action-btn" onclick="closeCapitalUpdateModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group full">
        <label class="form-label" id="lbl-capital-update-input" for="f-capital-update">Mi capital hoy</label>
        <input type="text" inputmode="decimal" class="form-input" id="f-capital-update" autocomplete="off" oninput="previewCapitalUpdate()" onkeydown="if(event.key==='Enter'){event.preventDefault();guardarActualizacionCapital();}">
        <div class="capital-update-line" id="capital-update-adjust"></div>
      </div>
      <div class="form-group full" style="margin-top:1rem;">
        <label class="capital-rebase-row" for="f-capital-rebase">
          <input type="checkbox" id="f-capital-rebase" onchange="previewCapitalUpdate()">
          <span id="lbl-capital-rebase">Recalcular 1R desde hoy</span>
        </label>
        <div class="capital-update-line" id="capital-update-oner"></div>
      </div>
      <div class="capital-update-note" id="capital-update-note"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="btn-capital-update-cancel" onclick="closeCapitalUpdateModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-capital-update-save" onclick="guardarActualizacionCapital()">Guardar</button>
    </div>
  </div>
</div>
```
Reglas de contenido del modal: **un único campo de texto** (`f-capital-update`) y **una única casilla** (`f-capital-rebase`). No añadas ningún campo de fecha ni ningún campo para escribir el 1R (un evento se fecha siempre con hoy y el 1R es siempre el 1 % del capital escrito).

**d) CSS.** Justo debajo de la regla `.modal.modal-sm { width: 480px; }` añade:
```css
  .capital-update-line { font-size: 12px; color: var(--text-secondary); line-height: 1.5; min-height: 18px; }
  .capital-update-line.positive { color: var(--green); }
  .capital-update-line.negative { color: var(--red); }
  .capital-update-note { font-size: 11.5px; color: var(--text-muted); line-height: 1.5; margin-top: 1rem; }
  .capital-rebase-row { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: var(--text-primary); cursor: pointer; }
  .capital-rebase-row input[type="checkbox"] { margin-top: 2px; accent-color: var(--gold); cursor: pointer; }
```
Valores que no se pueden cambiar (vienen de las comprobaciones visuales de PHASEX): ajuste positivo = `var(--green)` (`rgb(87, 185, 138)`), negativo = `var(--red)` (`rgb(199, 84, 80)`), Guardar desactivado = opacidad `0.4` (regla `.btn:disabled` existente, no la dupliques), el modal usa `modal modal-sm` (480 px con `max-width: 95vw`, de modo que a 390 px de pantalla mide ≈ 370 px y no desborda).

### Step 3 — Funciones y textos (ES/EN) [AUTHOR]
En `journal.html`, justo debajo de `closeCapitalModalIfOverlay` / `guardarCapital`, añade:

```js
// ─── Actualizar capital (cambio de capital con fecha de hoy) ───
function capitalUpdateInputValue() {
  return parseSpanishOrPlainNumber(document.getElementById('f-capital-update').value);
}

function abrirActualizarCapital() {
  const inp = document.getElementById('f-capital-update');
  // Texto plano con a lo sumo 2 decimales: parseSpanishOrPlainNumber lo lee de vuelta sin ambigüedad.
  inp.value = String(Math.round(currentCapital() * 100) / 100);
  document.getElementById('f-capital-rebase').checked = false;   // siempre desmarcada al abrir
  previewCapitalUpdate();
  document.getElementById('capitalUpdateModal').classList.add('open');
  setTimeout(() => { inp.focus(); inp.select(); }, 0);
}

function closeCapitalUpdateModal() {
  const modal = document.getElementById('capitalUpdateModal');
  modal.classList.remove('open');
  // Sin foco dentro del modal cerrado: un Enter posterior ya no puede guardar otra vez.
  if (document.activeElement && modal.contains(document.activeElement)) document.activeElement.blur();
}
function closeCapitalUpdateModalIfOverlay(e) { if (e.target.id === 'capitalUpdateModal') closeCapitalUpdateModal(); }

function previewCapitalUpdate() {
  const typed = capitalUpdateInputValue();
  const valid = Number.isFinite(typed) && typed > 0;
  const rebase = document.getElementById('f-capital-rebase').checked;
  const adjEl = document.getElementById('capital-update-adjust');
  const oneREl = document.getElementById('capital-update-oner');
  const money = (n) => `$${fmt(n)}`;     // sin enmascarar: es el propio número del usuario, como en el modal de capital inicial

  adjEl.className = 'capital-update-line';
  let hasAdjustment = false;
  if (valid) {
    const adj = typed - currentCapital();
    if (Math.abs(adj) < 0.005) {
      adjEl.textContent = i18n('update_capital_no_adjust');
    } else {
      hasAdjustment = true;
      adjEl.textContent = i18n('update_capital_adjust', { amount: (adj > 0 ? '+' : '-') + money(Math.abs(adj)) });
      adjEl.classList.add(adj > 0 ? 'positive' : 'negative');
    }
  } else {
    adjEl.textContent = '';
  }

  const oneRNow = oneRValue();
  if (rebase) {
    oneREl.textContent = valid
      ? i18n('update_capital_oner_change', { from: money(oneRNow), to: money(typed * 0.01), capital: money(typed) })
      : '';
  } else {
    oneREl.textContent = i18n('update_capital_oner_keep', { amount: money(oneRNow) });
  }
  // Guardar solo se desactiva cuando el número es válido y no hay nada que registrar.
  // Con un número no válido queda activo para que Guardar pueda mostrar el aviso de número no válido.
  document.getElementById('btn-capital-update-save').disabled = valid && !hasAdjustment && !rebase;
}

function guardarActualizacionCapital() {
  if (!document.getElementById('capitalUpdateModal').classList.contains('open')) return;   // modal cerrado: nada que guardar
  const typed = capitalUpdateInputValue();
  if (!Number.isFinite(typed) || !(typed > 0)) { alert(i18n('capital_invalid')); return; }
  const rebase = document.getElementById('f-capital-rebase').checked;
  // El ajuste se calcula con el capital actual SIN redondear y se guarda tal cual (importe fijo).
  let adjustment = typed - currentCapital();
  if (Math.abs(adjustment) < 0.005) adjustment = 0;
  if (adjustment === 0 && !rebase) return;                       // nada que registrar (Guardar ya está desactivado)

  const lastId = capitalEvents.reduce((m, ev) => Math.max(m, ev.id), 0);
  const ev = {
    id: Math.max(Date.now(), lastId + 1),                        // estrictamente creciente: "gana el último" del mismo día
    date: toDateStr(new Date()),                                 // SIEMPRE hoy y SIEMPRE fecha local; nunca la fecha en UTC
    capital: typed,
    adjustment,
    rebase
  };
  const previous = capitalEvents;
  capitalEvents = sanitizeCapitalEvents([...previous, ev]);
  if (!saveCapitalEventsToStorage()) { capitalEvents = previous; return; }   // el aviso ya lo muestra saveCapitalEventsToStorage()
  closeCapitalUpdateModal();
  refreshApp();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('capitalUpdateModal').classList.contains('open')) closeCapitalUpdateModal();
});
```
Qué no debe pasar: no escribas nunca `tradelog_trades` ni `tradelog_initial_cap` desde estas funciones; no loguees ni importes ni el contenido del campo (el único `console.error` es el de `saveCapitalEventsToStorage()`, que ya solo registra el error).

En `configurarCapital()` no cambies nada (el aviso se rellena desde `applyLanguage()`).

**Textos.** Añade a los diccionarios `I18N` (junto a `edit_capital_hint`):

| Clave | ES | EN |
|---|---|---|
| `update_capital_title` | `Actualizar capital` | `Update capital` |
| `update_capital_label` | `Mi capital hoy` | `My capital today` |
| `update_capital_hint` | `Haz clic para actualizar` | `Click to update` |
| `update_capital_adjust` | `Ajuste: {amount} (no cuenta como beneficio ni pérdida)` | `Adjustment: {amount} (not counted as profit or loss)` |
| `update_capital_no_adjust` | `Sin ajuste: es tu capital actual.` | `No adjustment: this is your current capital.` |
| `update_capital_rebase` | `Recalcular 1R desde hoy` | `Recalculate 1R from today` |
| `update_capital_oner_change` | `1R: {from} → {to} (1 % de {capital})` | `1R: {from} → {to} (1% of {capital})` |
| `update_capital_oner_keep` | `1R se mantiene en {amount}` | `1R stays at {amount}` |
| `update_capital_note` | `Se aplica desde hoy. Los trades anteriores conservan su capital y su 1R.` | `Applies from today. Earlier trades keep their capital and 1R.` |
| `capital_initial_warning` | `Esto corrige el capital de partida y recalcula todo el historial (curva, R y %). Para un cambio de moneda o de capital más adelante, usa «{card}».` | `This corrects your starting capital and recalculates your whole history (curve, R and %). For a currency change or later capital changes, use “{card}”.` |

En `applyLanguage()`, junto a las líneas de `capitalModal`, añade:
```js
  document.getElementById('stat-card-current-cap').title = i18n('update_capital_hint');
  document.getElementById('capitalUpdateTitle').textContent = i18n('update_capital_title');
  document.getElementById('lbl-capital-update-input').textContent = i18n('update_capital_label');
  document.getElementById('lbl-capital-rebase').textContent = i18n('update_capital_rebase');
  document.getElementById('capital-update-note').textContent = i18n('update_capital_note');
  document.getElementById('btn-capital-update-cancel').textContent = i18n('cancel');
  document.getElementById('btn-capital-update-save').textContent = i18n('save');
  document.getElementById('capital-initial-note').textContent = i18n('capital_initial_warning', { card: i18n('current_capital') });
  if (document.getElementById('capitalUpdateModal').classList.contains('open')) previewCapitalUpdate();
```
(`{card}` se rellena con el rótulo vigente de la tarjeta, "Capital Actual" / "Current Capital", para que el aviso nombre exactamente lo que el usuario ve.)

### Step 4 — Ampliar la librería de pruebas y escribir `dialog.test.js` [AUTHOR]
**a) `tests/capital-history/lib.js`** — añade sin cambiar los valores por defecto:
- `openApp(..., { now, timezoneId })`: `now` (cadena ISO con desplazamiento; por defecto el mismo `2026-10-08T12:00:00` de antes) y `timezoneId` (por defecto ninguno) se pasan a `browser.newContext({ timezoneId })` y a `page.clock.install({ time: new Date(now) })`.
- `watchDialogs(page, { accept = true } = {})` → devuelve `{ messages: [], types: [] }`; registra cada `alert`/`confirm` (`dialog.type()`, `dialog.message()`) y lo acepta o lo descarta según `accept`.
- `blockStorageKey(page, key)` → `page.evaluate` que envuelve `Storage.prototype.setItem` para que lance `new DOMException('quota', 'QuotaExceededError')` cuando el primer argumento sea `key`.
- `readLS(page, key)` → `JSON.parse` de `localStorage.getItem(key)` (o `null`).

**b) `tests/capital-history/dialog.test.js`** (usa `lib.js`, `dataset.js`; datos fijos de la iteración 1: capital 5000, capital actual 5340; "hoy" = 2026-10-08). Los textos esperados se **calculan en la página** con `fmt()` y `i18n()` (no los escribas a mano: `es-ES` no agrupa los miles de 4 cifras y no hay que depender de eso). Un `assert(<AC-ID>, ...)` por criterio:
- **AC-UC01-1:** sin eventos, `click('#stat-card-current-cap')` → `#capitalUpdateModal` tiene la clase `open` y `#f-capital-update` vale `"5340"`. Con `EV_PAST` sembrado vale `"5540"` (5000 + 200 + 340).
- **AC-UC01-2:** escribir `6000` → `#capital-update-adjust` es `i18n('update_capital_adjust', {amount:'+$'+fmt(660)})` y contiene "no cuenta como beneficio"; escribir `5000` → lleva `-$` + `fmt(340)`; la clase es `positive` en el primer caso y `negative` en el segundo.
- **AC-UC01-3:** escribir `6000`, `#btn-capital-update-save` clic → `capitalEvents` tiene 1 evento `{date:'2026-10-08', capital:6000, adjustment:660, rebase:false}`; `readLS('tradelog_capital_events')` igual; `currentCapital()` difiere de 6000 en menos de 0,005; `#stat-current-cap` es `$`+`fmt(6000)`; el modal ya no tiene `open`. Repite con `6000,55` (→ `$`+`fmt(6000.55)`) y con `5000` (ajuste −340), y una vez más pulsando **Enter** en el campo en lugar del botón Guardar: mismo resultado (el Enter guarda).
- **AC-UC01-4:** con `watchDialogs`, para cada valor de `['', ' ', 'abc', '0', '-100', 'Infinity']`: abrir, escribir, pulsar Guardar → hay un `alert` con `i18n('capital_invalid')`, `capitalEvents.length === 0` y la clave `tradelog_capital_events` no existe.
- **AC-UC01-5:** abrir el diálogo (valor = capital actual, casilla desmarcada) → `#btn-capital-update-save` está `disabled`; pulsar Enter en el campo no crea evento; marcar la casilla → deja de estar `disabled`; desmarcar → vuelve a `disabled`; escribir `5340,00` (mismo valor con otro formato) → sigue `disabled`.
- **AC-UC01-7:** (i) `openApp` con `timezoneId:'Europe/Madrid'`, `now:'2026-10-08T00:30:00+02:00'`; comprobar la precondición `new Date().toISOString().slice(0,10) === '2026-10-07'` y `toDateStr(new Date()) === '2026-10-08'`; guardar un evento → `capitalEvents[0].date === '2026-10-08'` (y en `localStorage`). (ii) lo mismo con `timezoneId:'America/Los_Angeles'`, `now:'2026-10-08T20:00:00-07:00'` (fecha UTC = 2026-10-09; el evento sale `2026-10-08`).
- **AC-UC01-8:** `configurarCapital()` → `#capital-initial-note` es `i18n('capital_initial_warning', {card:i18n('current_capital')})`; en ES contiene "corrige el capital de partida", "recalcula todo el historial" y "Capital Actual"; tras `applyLanguage('en')` contiene "Current Capital".
- **AC-UC01-10:** `#capitalUpdateModal input` son exactamente dos (`type="text"` con id `f-capital-update` y `type="checkbox"` con id `f-capital-rebase`); ninguno es de tipo `date`/`datetime-local`/`month`/`time`, y ningún `id`, `name` ni texto de `label` del modal contiene "fecha" o "date"; `guardarActualizacionCapital.toString()` contiene `toDateStr(new Date())` y no contiene `toISOString`.
- **AC-UC02-1:** al abrir, `#f-capital-rebase.checked === false`; desmarcada → `#capital-update-oner` es `i18n('update_capital_oner_keep',{amount:'$'+fmt(50)})`; escribir `7000` y marcar → `i18n('update_capital_oner_change',{from:'$'+fmt(50), to:'$'+fmt(70), capital:'$'+fmt(7000)})`; marcar, guardar y reabrir → la casilla vuelve a estar desmarcada.
- **AC-UC02-2:** conjunto = trades de la fecha efectiva anterior a 2026-10-01 (capital actual 5240). Abrir, escribir `7000`, marcar, guardar. Añadir a `tradelog_trades` un trade `{id, date:'2026-10-08', closeDate:'2026-10-08', symbol:'EURUSD', direction:'LONG', setup:'', pnl:'70', ...}` y recargar. Comprobar: `calcFixedRForTrade(t)` = 1 (± 1e-9); con `calendarMode='r'`, mes 2026-10, `renderCalendar()` → la celda del día 8 contiene `+1,00R`; en `$`, `#monthlyTableBody` (octubre, único trade del mes) coincide con `/\+1[.,]00\s?%/`.
- **AC-UC02-7:** tras guardar `7000` con recalculo, `#mode-btn-r.title` y `#cal-mode-btn-r.title` son `i18n('one_r_hint',{amount:'$'+fmt(70)})`; antes de guardar eran `$`+`fmt(50)`; tras guardar `6000` **sin** recalculo siguen en `$`+`fmt(50)`.
- **AC-UC05-6:** `blockStorageKey(page,'tradelog_capital_events')`, abrir, escribir `6000`, Guardar → `watchDialogs` registra un `alert` con `i18n('storage_full_capital_events')`; `capitalEvents.length === 0`; `readLS('tradelog_capital_events') === null`; `#stat-current-cap` sigue igual que antes; el modal sigue abierto.

Pruebas negativas (id propio `NEG`): (1) Escape, Cancelar y clic en el overlay cierran el modal y no crean evento ni la clave `tradelog_capital_events`; (2) abrir el diálogo y cerrarlo no modifica `tradelog_trades` ni `tradelog_initial_cap` (comparar cadenas antes/después); (3) Escape con el modal cerrado no hace nada; (4) tras guardar con Enter, pulsar Enter dos veces más con el modal ya cerrado no crea más eventos (queda 1).

Pruebas de visual y UX (id `VIS`, cada una con su `assert`):
- `getComputedStyle('#stat-card-current-cap').cursor === 'pointer'` y, con `page.hover`, su `backgroundColor` es igual al de `#stat-card-initial-cap` con hover (`rgb(38, 38, 38)`).
- Ajuste positivo: color `rgb(87, 185, 138)`; negativo: `rgb(199, 84, 80)`.
- Guardar desactivado: `opacity === '0.4'`.
- Viewport 390×844 con la pestaña Rendimiento activa: el diálogo abierto no aumenta el ancho de la página (`document.documentElement.scrollWidth` igual que con el diálogo cerrado; la app no es responsive y la propia pestaña ya mide más de 390 px), `#capitalUpdateModal .modal` no desborda por dentro (`scrollWidth <= clientWidth`) y su `getBoundingClientRect()` cumple `left >= 0` y `right <= 390`.
- Apoyo a `AC-UC01-9`: con el campo sin foco, los estilos calculados de `font-family`, `font-size` y `color` (título, etiqueta, campo, botones) y los fondos del campo y de Guardar del diálogo son iguales a los de `#capitalModal`. El hover de las tarjetas se mide tras esperar 500 ms (el fondo se anima).

### Step 5 — Script de capturas para el juicio humano [AUTHOR]
Crea `tests/capital-history/screenshots.js` (usa `lib.js`): con el conjunto fijo y "hoy" = 2026-10-08, guarda en `tests/capital-history/shots/` las capturas PNG `dialog-1280.png` (viewport 1280×800), `dialog-390.png` (390×844) y `initial-modal-1280.png` / `initial-modal-390.png` (el modal de capital inicial con su aviso), todas con el diálogo abierto, el valor `6000` escrito y la casilla marcada (salvo las del modal inicial). Imprime la lista de ficheros escritos. No hace ninguna comprobación; es solo el material que mira una persona.

### Step 6 — Sintaxis y pruebas [EXECUTE]
```bash
cd ~/Documents/VSCODE/tradingjournal
node -e "const fs=require('fs');const c=fs.readFileSync('journal.html','utf8');const m=c.match(/<script>([\s\S]*)<\/script>/);new Function(m[1]);console.log('JS SYNTAX OK')"
node tests/capital-history/engine.test.js
node tests/capital-history/dialog.test.js
```
Esperado: `JS SYNTAX OK`; `engine.test.js` sigue con sus 14 líneas `PASS` (nada de la iteración 1 se ha roto); `dialog.test.js` imprime una línea `PASS` por cada criterio de **Satisfies** que sea ejecutable (`AC-UC01-1`, `-2`, `-3`, `-4`, `-5`, `-7`, `-8`, `-10`, `AC-UC02-1`, `-2`, `-7`, `AC-UC05-6`) y por `NEG` y `VIS`, y ninguna `FAIL`; código de salida 0 en ambos.

### Step 7 — Generar las capturas [EXECUTE]
```bash
cd ~/Documents/VSCODE/tradingjournal
node tests/capital-history/screenshots.js
git status --short
```
Esperado: se listan las cuatro capturas de `tests/capital-history/shots/`; `git status --short` solo muestra `journal.html` y `tests/capital-history/`.

---

## Verification (Nora)
- [ ] `AC-UC01-1` (executable) — `node tests/capital-history/dialog.test.js` imprime `PASS AC-UC01-1`: el campo abre con `5340` (sin eventos) y `5540` (con `EV_PAST`).
- [ ] `AC-UC01-2` (executable) — `PASS AC-UC01-2`: escribir `6000` muestra el ajuste `+$660,00` con "no cuenta como beneficio ni pérdida"; `5000` muestra `-$340,00`.
- [ ] `AC-UC01-3` (executable) — `PASS AC-UC01-3`: tras guardar `6000`, hay un evento con fecha `2026-10-08`, ajuste 660 y `#stat-current-cap` muestra exactamente `$6000,00`; con `6000,55` muestra `$6000,55`.
- [ ] `AC-UC01-4` (executable) — `PASS AC-UC01-4`: con `''`, `' '`, `'abc'`, `'0'`, `'-100'` e `'Infinity'` sale el aviso de número no válido y no existe la clave `tradelog_capital_events`.
- [ ] `AC-UC01-5` (executable) — `PASS AC-UC01-5`: Guardar está desactivado con el capital igual al actual y la casilla desmarcada (también con `5340,00`), y se activa al marcar la casilla.
- [ ] `AC-UC01-7` (executable) — `PASS AC-UC01-7`: con el reloj a las 00:30 de Europe/Madrid (UTC = 2026-10-07) y a las 20:00 de Los Ángeles (UTC = 2026-10-09), el evento queda con `2026-10-08`.
- [ ] `AC-UC01-8` (executable) — `PASS AC-UC01-8`: el modal de capital inicial muestra el aviso, que nombra "Capital Actual" (y "Current Capital" en inglés).
- [ ] `AC-UC01-9` (human) — Abre `tests/capital-history/shots/dialog-1280.png`, `dialog-390.png`, `initial-modal-1280.png` e `initial-modal-390.png` junto a un modal existente (`#capitalModal` sin el aviso) y marca sí/no en cada punto: (1) el diálogo usa los mismos tipos de letra y colores de título, etiqueta, campo y botones que el modal de capital inicial; (2) a 390 px no hay texto cortado ni barra de desplazamiento horizontal y los dos botones se ven completos; (3) el ajuste se lee en verde si es positivo y en rojo si es negativo; (4) ningún texto se solapa con otro. Aprobado solo si los cuatro puntos son "sí" en ambos anchos. Apoyo automático: `VIS` (estilos calculados iguales a los de `#capitalModal`).
- [ ] `AC-UC01-10` (inspection) — `PASS AC-UC01-10` y, a mano: en `journal.html`, `#capitalUpdateModal` contiene solo `f-capital-update` (texto) y `f-capital-rebase` (casilla); `grep -n "toISOString" journal.html` no devuelve ninguna línea dentro de `guardarActualizacionCapital`.
- [ ] `AC-UC02-1` (executable) — `PASS AC-UC02-1`: casilla desmarcada al abrir y tras reabrir; marcada con 7000 muestra "1R: $50,00 → $70,00 (1 % de $7000,00)"; desmarcada, "1R se mantiene en $50,00".
- [ ] `AC-UC02-2` (executable) — `PASS AC-UC02-2`: con recalculo a 7000, un trade de +$70 cerrado hoy da `+1,00R` en el calendario en R y `+1,00 %` en la tabla mensual de octubre.
- [ ] `AC-UC02-6` (inspection) — `#capitalUpdateModal` no tiene ningún campo para escribir el 1R, y los eventos guardados solo tienen `id`, `date`, `capital`, `adjustment`, `rebase` (el 1R siempre se deriva como 0,01 × capital); `git diff` no añade ninguna clave de almacenamiento para un 1R.
- [ ] `AC-UC02-7` (executable) — `PASS AC-UC02-7`: tras recalcular a 7000, los botones de modo R de Rendimiento y de Calendario muestran "1R = 1% del capital = $70,00"; con un evento sin recalculo siguen en $50,00.
- [ ] `AC-UC05-6` (executable) — `PASS AC-UC05-6`: con el almacenamiento bloqueado para `tradelog_capital_events` sale un `alert` con el texto de `storage_full_capital_events`, no queda evento en memoria ni en `localStorage` y "Capital Actual" no cambia.
- [ ] Cross-tenant: no aplica (app local de un solo usuario, sin servidor ni endpoints).
- [ ] Negative test — `NEG`: Escape, Cancelar y el clic en el overlay no crean evento ni la clave; abrir y cerrar el diálogo no modifica `tradelog_trades` ni `tradelog_initial_cap`; con número no válido no se guarda nada (`AC-UC01-4`); sin nada que registrar no se guarda nada (`AC-UC01-5`).
- [ ] UX — la tarjeta "Capital Actual" abre el diálogo con el capital calculado (`AC-UC01-1`).
- [ ] UX — la línea de ajuste cambia al escribir (`AC-UC01-2`).
- [ ] UX — la casilla de 1R está desmarcada al abrir (`AC-UC02-1`).
- [ ] UX — Guardar está desactivado cuando no hay nada que registrar (`AC-UC01-5`).
- [ ] UX — Enter guarda (variante con Enter de `AC-UC01-3`; con nada que registrar no guarda, `AC-UC01-5`) y Escape cierra sin guardar (`NEG`).
- [ ] UX — el modal de capital inicial muestra el aviso (`AC-UC01-8`).
- [ ] Visual — la tarjeta "Capital Actual" muestra cursor de mano y fondo `rgb(38, 38, 38)` al pasar el ratón, igual que la inicial (`VIS`).
- [ ] Visual — ajuste positivo `rgb(87, 185, 138)`, negativo `rgb(199, 84, 80)` (`VIS`).
- [ ] Visual — Guardar desactivado con opacidad `0.4` (`VIS`).
- [ ] Visual — a 390 px de ancho el diálogo no desborda: no añade ancho a la página y el modal queda dentro de `[0, 390]` (`VIS`; juicio humano en `AC-UC01-9`).
- [ ] La iteración 1 sigue intacta: `node tests/capital-history/engine.test.js` sigue con sus 14 `PASS`, y `git diff --stat` solo muestra `journal.html` y `tests/capital-history/`.
