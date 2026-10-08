# Verification Report — P1-I2-update-capital-dialog.md
Date: 2026-10-08
Verified by: Nora (Test Manager)

**Verdict: DONE.** 13 of 14 criteria in scope PASS (11 executable, 2 inspection). 1 is MANUAL (`AC-UC01-9`, human judgement, deferred and not blocking). 0 FAIL, 0 STUCK. 3 checks ran that cite no acceptance criterion (UNTRACED, they do not count toward the pass). No fix was needed, so there was no handback to Paula.

## What was verified, and where
- App under test: `journal.html`, git blob `1695e063ce6e30b5dc5c5050c8ab97cb58520e94` (plain SHA-1 `1ea3e0789411702d7a0245f50f04c911d645e290`, 121887 bytes), branch `master`, HEAD `248850c` (iteration 1, verified), uncommitted.
- The Mac has no Chromium. Executable criteria ran in the cloud container (Node 22.22.2, Playwright with `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, clock fixed at 2026-10-08 12:00 local). Before running, `journal.html` and every file under `tests/capital-history/` (except the four PNGs) were hashed on both sides with the same method and are byte-identical (`dialog.test.js` 21c08404, `engine.test.js` 6e62a8ba, `lib.js` 74196eee, `screenshots.js` b4391678, `dataset.js` 59e93282). The four PNGs differ in bytes between the two sides (separate encodes) but a pixel comparison shows them identical; the Mac copies are the ones a person judges.
- Nora re-ran everything from scratch and did not rely on the build's earlier output: JS syntax gate `JS SYNTAX OK`; `engine.test.js` 15 PASS / 0 FAIL, exit 0 (21 s); `dialog.test.js` 14 PASS / 0 FAIL, exit 0 (43 s). The 14 lines are 12 acceptance-criterion assertions + `NEG` + `VIS`.
- The `journal.html` diff against `248850c` was read in full. Every HTML, CSS, JS and I18N item in Steps 2 and 3 of the spec is present and nothing else was added. The modal has exactly two inputs.

## Acceptance criteria
| AC ID | Criterion (short; full text in REQUIREMENTS.md) | Type | Result | Observed | Fix applied |
|-------|-------------------------------------------------|------|--------|----------|-------------|
| AC-UC01-1 | Clicking "Capital Actual" opens the dialog prefilled with the computed current capital | executable | PASS | Click on `#stat-card-current-cap` opens the modal; field `"5340"` with no events, `"5540"` with `EV_PAST`. Also by probe: `"5190"` with a -150 event; with 40 random datasets with cent P&L (and 0-2 prior events) the prefill is within 0.005 of the computed capital. Focus and full selection on open. | none |
| AC-UC01-2 | Typing a different capital shows the adjustment, "not profit" | executable | PASS | `6000` shows exactly `Ajuste: +$660,00 (no cuenta como beneficio ni pérdida)` (class `positive`); `5000` shows `Ajuste: -$340,00 ...` (class `negative`). The text was written from the spec by hand, not from `i18n()`. | none |
| AC-UC01-3 | Save creates a dated event; Capital Actual becomes exactly the typed value, to the cent | executable | PASS | Button, `6000,55`, `5000` (adjustment -340) and Enter all give 1 event `{date:'2026-10-08', capital, adjustment, rebase:false}`, equal in `localStorage`; card shows `$6000,00` / `$6000,55`; modal closed. Independent fuzz: 40 random cases (P&L with cents, initial capital with cents, 0-2 prior events, typed with `,` or `.`, with or without the box): `currentCapital()` within 0.005 of the typed value, card text equals Intl `es-ES` of the typed value, number of events created as expected. After reload the capital and 1R persist (`$6543,21`, 1R 65.4321). | none |
| AC-UC01-4 | Empty, non-numeric, zero or negative: invalid-number alert, nothing saved | executable | PASS | `''`, `' '`, `'abc'`, `'0'`, `'-100'` each raise one `alert` with the `capital_invalid` text, 0 events, key `tradelog_capital_events` absent, modal stays open. Extra probes: `'0,00'`, `'NaN'`, `'abc5000'`, `'$6000'`, `'€6000'` behave the same. See observation O1 for text with a numeric prefix. | none |
| AC-UC01-5 | Same capital + box unchecked: Save disabled | executable | PASS | On open Save is `disabled` and Enter creates no event; `5340,00` keeps it disabled; ticking the box enables it, unticking disables it, `5341` enables it. By probe: with a -150 event and typed value equal to current, the box enables Save and the saved event has adjustment exactly `0` (`Object.is(0)`), `rebase:true`, 1R becomes 51.90. | none |
| AC-UC01-7 | Clock 00:30 Europe/Madrid (UTC = previous day): local date, not UTC | executable | PASS | Precondition observed: UTC date `2026-10-07`, `toDateStr(new Date())` `2026-10-08`; event saved `2026-10-08` in memory and in `localStorage`. Los Angeles 20:00 (UTC `2026-10-09`): event `2026-10-08`. A mutant using `toISOString().slice(0,10)` fails this criterion. | none |
| AC-UC01-8 | The initial-capital modal warns it corrects the starting capital and recalculates history, and points to "Capital Actual" | executable | PASS | `#capital-initial-note` is exactly `Esto corrige el capital de partida y recalcula todo el historial (curva, R y %). Para un cambio de moneda o de capital más adelante, usa «Capital Actual».`; in EN `... use “Current Capital”.` Regression: the initial-capital modal still saves `6000` to `tradelog_initial_cap` and creates no event. | none |
| AC-UC01-9 | Dialog looks coherent with existing modals at 1280 and 390 px | human | MANUAL | See "Deferred". | n/a |
| AC-UC01-10 | No date field: events are always dated today (local) | inspection | PASS | `#capitalUpdateModal` holds exactly two inputs: `f-capital-update` (text) and `f-capital-rebase` (checkbox); no `date`/`datetime-local`/`month`/`time` type, no id/name/label containing "fecha" or "date". `guardarActualizacionCapital` (journal.html lines 1706-1728) uses `toDateStr(new Date())` and contains no `toISOString`; the only `toISOString` lines in the file are 1198 (`exportedAt` in export) and 2392 (a comment). A mutant that adds a date input fails this criterion. | none |
| AC-UC02-1 | Box unchecked on open; checked shows "1R: $A → $B (1 % de $C)", unchecked "1R se mantiene en $A" | executable | PASS | Unchecked on open and after saving and reopening. Unchecked: `1R se mantiene en $50,00`. With `7000` + box: exactly `1R: $50,00 → $70,00 (1 % de $7000,00)` (literal, written by hand). EN: `1R: $50.00 → $70.00 (1% of $7,000.00)`. | none |
| AC-UC02-2 | Rebase at 7,000, then a +$70 trade closed today shows +1,00R and +1,00 % | executable | PASS | After saving 7000 with the box, adding a +70 trade closed 2026-10-08 and reloading: `calcFixedRForTrade` = 1, `pctReturn` = 1, October calendar in R shows `+1,00R`, October monthly row matches `+1,00 %`. A mutant that never stores the rebase flag fails. | none |
| AC-UC02-6 | No field to type the 1R; it is always 1 % of the event capital | inspection | PASS | No 1R input in the modal (two inputs only, see AC-UC01-10). Saved events have exactly the keys `adjustment, capital, date, id, rebase` (observed at runtime). The lines added by this iteration contain no `localStorage`, `setItem`, `getItem`, `removeItem` or `tradelog_` reference, so no storage key for 1R was added. 1R is `oneRForDate()` = 0.01 x base. | none |
| AC-UC02-7 | The R-mode button tooltip shows today's 1R | executable | PASS | Before: `$50,00` on both the Rendimiento and Calendario R buttons; after a 7000 rebase: `$70,00` on both; after a 6000 save without the box: still `$50,00`. By probe, a rebase with no capital change to 5190 gives `$51,90`. | none |
| AC-UC05-6 | Full storage: same alert style as the rest of the app; event not kept in memory or on screen | executable | PASS | With `setItem` for `tradelog_capital_events` throwing `QuotaExceededError`: exactly one `alert` with the `storage_full_capital_events` text; `capitalEvents.length` 0; key absent; Capital Actual unchanged; modal still open. A mutant without the rollback fails this criterion. | none |

## Independent evidence (beyond the build's own tests)
The build's tests and the code share an author, so Nora added checks that reuse none of their assertions. All ran against the unchanged `journal.html`. The probe scripts live in the scratchpad and are not added to the repo.

1. **Independent probe, 39 checks, 0 failed.** Expected values come from the spec text and from Node `Intl`, not from `i18n()` or `fmt()`. It covers: literal ES and EN strings for every new text (title, label, adjustment, 1R lines, note, buttons, card tooltip, initial-modal note); live re-translation with the dialog open and no unreplaced `{...}` placeholders; the 40-case cent fuzz above; storage writes during a save (only `set:tradelog_capital_events`; `tradelog_trades` and `tradelog_initial_cap` byte-equal afterwards); event shape and persistence after reload; strictly increasing ids with `Date.now()` frozen and with an existing id near 9e15; same-day 7000 (rebase) then 8000 (no rebase) giving capital 8000, base 7000, 1R 70, adjustments 200 + 1460 + 1000; focus and selection on open; regression of the initial-capital modal; 0 page errors. (Two probe mistakes of mine, a wrong expected sum and reading the stats card before the lazy-rendered stats tab was active, were corrected and the probe re-run; neither was an app defect.)
2. **Mutation check on `dialog.test.js`: 21 of 23 mutants killed.** Each mutant is a single-line break of a scratch copy of `journal.html` (never the repo file). The unmutated control gave 14 PASS under the same parallel load.

| Mutant | Break | Failing assertion(s) |
|---|---|---|
| D1 | event date taken in UTC | AC-UC01-7, AC-UC01-10 |
| D2 | rebase box not reset on open | AC-UC02-1 |
| D3 | Save-disabled logic ignores the box | AC-UC01-5 |
| D4 | failed save not rolled back | AC-UC05-6 |
| D5 | Escape handler removed | NEG (suite crashes, never passes) |
| D6 | adjustment rounded to whole units | AC-UC01-3 |
| D7 | rebase flag never stored | AC-UC02-2, AC-UC02-7 |
| D8 | green and red swapped | AC-UC01-2, VIS |
| D9 | modal stays open after save | AC-UC01-3 (then crash) |
| D10 | initial-modal note not filled | AC-UC01-8 |
| D11 | date input added to the dialog | AC-UC01-10, AC-UC01-3 |
| D12 | Enter does not save | AC-UC01-3 |
| D13 | prefill uses the initial capital | AC-UC01-1 (then crash) |
| D14 | zero and negative accepted | AC-UC01-4 (crash, never passes) |
| D16 | current-capital card not editable | VIS |
| D19 | click inside the dialog closes it | crash at AC-UC01-4 |
| D22 | wrong factor in the 1R preview | AC-UC02-1 |
| D23 | stores current capital instead of the typed value | AC-UC01-3, AC-UC02-2, AC-UC02-7 |
| D24 | adjustment sign inverted | AC-UC01-3 |
| D25 | dialog wider than a 390 px screen | VIS (crash in the 390 px part) |
| D26 | note text no-wrap, overflows the modal | VIS (`bodyOverflow:false`) |

   Two mutants survived. **D15** (no-wrap on the adjustment line) is ineffective: the line already fits on one line at 390 px, so nothing overflows; the stronger D25 and D26 are killed. **D17** (Save also rewrites `tradelog_trades`) is not caught by `dialog.test.js`; the criterion that owns that constraint (CR-06, `AC-UC04-7`) belongs to iteration 3, and Nora's probe catches it through the storage-write spy (`set:tradelog_trades` appears). A tests-only note, not a failure.

## Deferred — needs manual verification
**`AC-UC01-9` (human).** The dialog looks coherent with the existing modals at 1280 px and 390 px: no overflow, same fonts and colours. A person must judge it; Nora does not mark it PASS.

How to check by hand: open `tests/capital-history/shots/dialog-1280.png`, `dialog-390.png`, `initial-modal-1280.png` and `initial-modal-390.png` and answer yes or no to each point at both widths: (1) the dialog uses the same fonts and colours for title, label, field and buttons as the initial-capital modal; (2) at 390 px nothing is cut off, there is no horizontal scrollbar and both buttons are fully visible; (3) the adjustment reads green when positive and red when negative; (4) no text overlaps another. Approved only if all four are yes at both widths. For a live check, open the app, go to Rendimiento, click "Capital Actual", and type a value above and then below the current capital.

What Nora saw (observation, not a verdict): both pairs look coherent; the 390 px dialog is 370 px wide, inside the screen, with both buttons visible and no clipped text. Things the reviewer should know:
- The supplied shots show only the green (positive) case. The red case is not in the shots. It was confirmed by computed style (`rgb(199, 84, 80)`, test `VIS`) and by an uncommitted capture Nora looked at (`-$340,00`, red, no overlap at 390 px).
- In the `initial-modal-*.png` shots the field is still focused (gold border, selected text), while the dialog's field is unfocused, so the two are not strictly like for like. The automatic support check `VIS` compares computed styles with focus removed on both and found them equal (font family, size, colour, field and button backgrounds).
- At 390 px the page itself is 788 px wide in the Rendimiento tab. Nora measured the baseline `8f58390` at 788 px as well, and the new version at 788 px with the dialog closed and open, so the dialog adds no overflow. The app is not responsive; that is outside this iteration.

## Stuck — needs developer attention
None. No criterion failed, so no fix was applied.

## Untraced checks
These cite no acceptance-criterion ID. All ran and passed; they do not count toward the pass.
- `NEG` (Escape, Cancel and overlay click close the modal and create no event or key; open and close leave `tradelog_trades` and `tradelog_initial_cap` unchanged; Escape with the modal closed does nothing; 0 page errors). Its invalid-input and nothing-to-register parts are covered under `AC-UC01-4` and `AC-UC01-5` above.
- `VIS` (card cursor `pointer` and hover background `rgb(38, 38, 38)` equal to the initial card; positive `rgb(87, 185, 138)`, negative `rgb(199, 84, 80)`; disabled Save opacity `0.4`; at 390 px the page width is unchanged, the modal has no inner overflow and sits inside `[0, 390]`; computed styles equal to `#capitalModal`).
- Checklist item "La iteración 1 sigue intacta": `engine.test.js` gives 15 PASS (14 criteria + 1 guard assertion). `git diff --stat` lists `journal.html`, `tests/capital-history/engine.test.js` (+4 lines) and `tests/capital-history/lib.js` (+27/-1); everything else is untracked under `tests/capital-history/` and `docs/`. The `engine.test.js` change only adds a comparison of the annual and monthly % in the iteration 1 snapshot test, closing note 1 of the iteration 1 report; no assertion was removed or weakened. `lib.js` changes are additions only.

## Observations for the requirement and test owners (none blocks this iteration)
- **O1 (judgement call on `AC-UC01-4`).** The field is read by the existing `parseSpanishOrPlainNumber`, which ends in `parseFloat`, the same as the initial-capital modal. Text that starts with a number is accepted as that number: `5000abc` saves 5000, `6000 USD` saves 6000, `1e3` saves 1000, `6 000` (a space) saves **6**, and `6000,555` (three decimals) saves **6000555**. The adjustment line shows the effect before Save, and the criterion lists only empty, non-numeric, zero and negative, so Nora judged it met. If partly numeric text should be rejected, the criterion needs to say so, and the parser needs a stricter check for this dialog.
- **O2.** `Infinity` closes the dialog with no message and no event, and writes `tradelog_capital_events` as `[]` (the sanitizer drops the non-finite event, but the save still reports success). No data is damaged.
- **O3.** Repeating Enter with "Recalcular 1R desde hoy" ticked creates duplicate events: three Enter presses gave three events (adjustments 1660, 0, 0, all `rebase:true`). After saving, the closed dialog's field keeps focus and the box stays ticked until the dialog is reopened. Without the box the second Enter does nothing. Figures are unaffected (same base), but the iteration 3 list would show the duplicates (they can be deleted there).
- **O4.** The dialog always shows real, unmasked amounts, even with "ocultar balance" on. This is stated in the spec ("sin enmascarar", as in the initial-capital modal). It was read from the code, not tested.
- **O5.** All console errors seen in these runs are `net::ERR_TUNNEL_CONNECTION_FAILED` (the sandbox blocks external fonts); there were 0 page errors.
- **O6.** `dialog.test.js` stops at the first exception, so a crash hides the later assertions. Not an issue while it is green.

## Outcome: DONE
DONE: every criterion in scope passed or is MANUAL; none is STUCK. No coverage gap: all 14 AC IDs in **Satisfies** have a verification item and resolve in `REQUIREMENTS.md`, and every constraint in the PHASEX register (CR-01 to CR-08) has at least one AC ID. Solo mode: no `build-state.md` was written.
