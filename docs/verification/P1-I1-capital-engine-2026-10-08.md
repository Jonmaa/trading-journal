# Verification Report — P1-I1-capital-engine.md
Date: 2026-10-08
Verified by: Nora (Test Manager)

**Verdict: DONE.** 14 of 14 criteria in scope PASS. 0 FAIL, 0 MANUAL, 0 STUCK, 1 UNTRACED check (ran, observed, does not count toward the pass).

## What was verified, and where
- App under test: `journal.html`, git blob `a4c4785676f2d458f70d66b8a642dfd88bd7b1e3` (plain SHA-1 `0800d940263e58899f998e422246d674d1ad19e4`, 113169 bytes), branch `master`, HEAD `8f58390`, uncommitted.
- Baseline: `tests/capital-history/fixtures/journal.8f58390.html` is byte-identical to `git show 8f58390:journal.html` (SHA-1 `32fa0950abd293333e979de1b1df11f7420cfa09`).
- The Mac has no Chromium. The executable criteria ran in the cloud container (Node 22.22.2, Playwright with `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, clock fixed at 2026-10-08 12:00 local). Before running, `journal.html` and all five files under `tests/capital-history/` were hashed on both sides and are identical.
- JS syntax gate: `JS SYNTAX OK`.
- Nora re-ran from scratch (did not rely on the build's earlier output): `node tests/capital-history/engine.test.js` gave 15 PASS / 0 FAIL, exit 0, 16.2 s. The 15th line is `AC-UC05-1.snapshot-no-vacio`, a guard assertion on AC-UC05-1.

## Acceptance criteria
| AC ID | Criterion (short; full text in REQUIREMENTS.md) | Result | Observed | Fix applied |
|-------|-------------------------------------------------|--------|----------|-------------|
| AC-UC05-1 | Without events, all figures equal those of `8f58390` | PASS | `snapshot()` of the new version without events (history, stats in $ and R, calendar Aug/Sep/Oct x $/R = 6 views, 10 curve traces of moveTo/lineTo/fillText) is identical to a live run of `8f58390` and to `golden-8f58390.json` (first difference: null for both). Snapshot is non-trivial: history > 100 chars, 10 curves, 6 calendar views. | none |
| AC-UC05-2 | `tradelog_initial_cap` not renamed or rewritten; events in the new key; loading modifies nothing (inspection) | PASS | `git diff 8f58390 -- journal.html`: the only added storage lines are the `CAPITAL_EVENTS_KEY = 'tradelog_capital_events'` constant, one `getItem` on that key, and one `setItem` on that key inside `saveCapitalEventsToStorage()`, which has no callers yet. No storage line removed. `setItem`/`removeItem` count 4 -> 5. At runtime, in 7 event configurations after load, `tradelog_trades` and `tradelog_initial_cap` are byte-equal to the seed and `tradelog_capital_events` is absent (no events) or equal to the seed. | none |
| AC-UC05-5 | Corrupt event storage == no events, error only in console (negative) | PASS | `'{{{'` and `'{"a":1}'`: app starts, `capitalEvents.length` 0, snapshot identical to no-events, 0 page errors, console shows "Error leyendo cambios de capital". Event without `id`: discarded, 0 events, identical snapshot. Extended probe, 16 corrupt variants (null, number, string, `[]`, junk array, id null / empty, bad date format / type, capital 0 / negative / text, adjustment text): all gave 0 events, identical snapshot, 0 page errors, raw storage left untouched. A valid event next to an invalid one is kept. | none |
| AC-UC01-6 | An adjustment without 1R recalculation leaves calendar, %, R identical | PASS | With `EV_ADJ_ONLY`, history, stats ($ and R) and calendar are identical to no-events except `#stat-current-cap`, which differs as intended. | none |
| AC-UC02-3 | A trade closed before the change keeps +2,00R at the old 1R of $50 | PASS | With `EV_REBASE`: the 2026-08-10 calendar cell in R mode shows `+2,00R`; `oneRForDate('2026-08-10')` = 50; `calcFixedRForTrade` of the trade = 2. | none |
| AC-UC02-4 | A month with only pre-change trades shows the same % | PASS | August row is `Ago 2026 / +$150,00 / +3,00%` with and without `EV_REBASE`. | none |
| AC-UC02-5 | A non-rebase event changes neither 1R nor % base for any date | PASS | With `EV_ADJ_ONLY`: base 5000 and 1R 50 on 2026-08-10, 2026-10-08 and 2026-12-31. | none |
| AC-UC02-8 | Two same-day events: adjustments add, base/1R from the last rebase | PASS | With `EV_REBASE` + `EV_REBASE_2`: base 6500, 1R 65, `currentCapital()` 6500 (5340+660+500, tolerance 0.005). Also with two same-day rebase events stored in reverse id order (ids 7 then 3): base follows id order (8000). | none |
| AC-UC03-1 | Adding a rebase event dated today leaves everything earlier identical | PASS | Aug and Sep calendar ($ and R) and Aug and Sep monthly rows ($ and R) identical with/without `EV_REBASE`. Week/month/year $ curves: all points but the last identical. All/$: first n+1 points identical. R curves identical. Today/$: previous points identical plus one new point. | none |
| AC-UC03-2 | Curve unchanged before the event; step equal to the adjustment after that day's closed trades; later trades stack on top | PASS | `all`/$ with `EV_REBASE` = `[5000,5100,5150,5120,5240,5300,5380,5340,6000]`, last step 660. `month` ends at 6000 with earlier points unchanged. Event +100 on 2026-09-29 gives `[5000,5100,5150,5120,5240,5340,5400,5480,5440]`. | none |
| AC-UC03-3 | Current capital = initial + adjustments + closed P&L, to the cent, with 0/1/3 events | PASS | 0 events 5340; `EV_REBASE` 6000; `EV_PAST`+`EV_NEG`+`EV_REBASE` 5340+200-150+660 = 6050, all within 0.005. Independent oracle: matches in 7 configurations, including a -2500 adjustment. | none |
| AC-UC03-4 | R curves and totals include no adjustment (negative) | PASS | Observed directly: `EV_ADJ_ONLY` (660) plus a +70 trade closed today gives R curve today `[0, 1.4]`, $ curve today `[5340, 5410, 6070]`. R curves week/month/year/all have no step above 2R (660 at 1R=50 would be 13.2R). R-mode YTD `+8,20 R`. | none |
| AC-UC03-5 | Today/Week/Month/Year/All curves reflect the adjustment on its date | PASS | With `EV_REBASE` all five $ curves end at 6000. With `EV_PAST` (09-01): today/week/month shift by exactly +200 at every point; year ends +200, with exactly one extra +200 step, at the weekly bucket 2026-08-27..2026-09-02 (observed directly). Oracle: in 7 configurations all five $ curves end at the current capital. | none |
| AC-UC03-6 | Editing an old trade's P&L does not change the stored adjustment | PASS | With `EV_REBASE`, trade 2026-08-10 edited 100 -> 130 via `openEditModal` / `#f-pnl` / `saveTrade()`: `capitalEvents[0].adjustment` = 660 in memory and in `localStorage`; `currentCapital()` 6000 -> 6030. | none |

## Independent evidence (beyond the build's own tests)
The build's tests and the code share an author, so Nora added checks that do not reuse their assertions. All ran against the unchanged `journal.html`. The probe scripts are not added to the repo.

1. **Oracle, 294 checks, 0 failed.** Expected values computed in plain Node from the PHASEX rules (base(D), 1R = 1% of base, % = pnl/base per trade date, capital = initial + adjustments + P&L) and compared with the running app for seven event sets: none; rebase today; rebase mid-history (09-29, which changes real October trades: 1R becomes 60, October R = 1.67, YTD % = 6.47); three events including a negative adjustment; a halving rebase with -2500; two same-day rebases stored in reverse id order; a rebase with adjustment 0 plus an adjustment-only event. Compared: per-trade R and 1R, monthly $/%/R/average R, YTD and month % and R, calendar R totals, current capital, step multiset of the `all` curve, ends of the five $ curves and four R curves.
2. **Mutation check, 7 of 7 mutants killed.** Seven single-line breaks of a scratch copy of `journal.html` (never the repo file); each makes `engine.test.js` fail on the AC it targets:

| Mutant | Break | Failing ACs in the suite |
|---|---|---|
| M1 | base ignores event date (retroactive rebase) | AC-UC03-1, AC-UC02-3, AC-UC02-4, AC-UC03-4 |
| M2 | adjustment point leaks into the R curve | AC-UC03-1, AC-UC03-4 |
| M3 | corrupt event without id is kept | AC-UC05-5 |
| M4 | current capital ignores adjustments | AC-UC02-8, AC-UC03-3, AC-UC03-6 |
| M5 | `adjustmentsBefore` uses `<=` (double count today) | AC-UC03-1, AC-UC03-5 |
| M6 | trade R ignores the trade's date | AC-UC03-1, AC-UC02-3, AC-UC03-4 |
| M7 | % uses today's base | AC-UC03-1, AC-UC02-4 |

   The oracle also fails on M1, M4, M5, M6 and M7. It does not catch M2 or M3 (it only checks the ends of the today-R curve and never seeds corrupt storage), so those two negatives were observed directly (AC-UC03-4 and AC-UC05-5 rows above).

## Deferred — needs manual verification
None. The 14 criteria in scope are all executable or inspection; none is typed human.

## Stuck — needs developer attention
None. No criterion failed, so no handback to Paula was needed and no fix was applied.

## Untraced checks
- Checklist item "Ninguna iteración posterior ha modificado este conjunto: `git diff --stat` solo muestra `journal.html` y `tests/capital-history/`" cites no AC ID. Ran and observed: `git diff --stat` lists only `journal.html` (165 insertions, 39 deletions); `git status` shows untracked files only under `docs/` (phase requirements, plan, specs) and `tests/capital-history/`. Consistent with the item; recorded as UNTRACED and not counted toward the pass.
- `AC-UC05-1.snapshot-no-vacio` in `engine.test.js` is a guard on AC-UC05-1, not a separate criterion.

## Notes for the requirements and test owners (none blocks this iteration)
1. `engine.test.js` does not compare the annual and monthly % (`#stat-ytd-pct`, `#stat-month-pct` in $) with and without the event, although AC-UC03-1 as written lists them. Nora's oracle checked both for seven event sets and they are correct; adding the comparison to the suite would close the gap.
2. `docs/PHASEX.md` lists `tests/capital-history/snapshot.js` as a new file. It does not exist, because the spec places `snapshot()` in `lib.js`. Documentation drift only.
3. The sanitizer drops an individually invalid event silently (no console message). This matches the spec's AC-UC05-5 test, which expects a console error only for unparseable or non-array storage.

## Outcome: DONE
DONE: every criterion in scope passed, none is STUCK, no coverage gap (every AC ID in Satisfies has a verification item and resolves in REQUIREMENTS.md; every constraint in the PHASEX register, CR-01 to CR-08, has at least one AC ID).
