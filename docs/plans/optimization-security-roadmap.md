# Optimization & Security Roadmap

Start-to-finish execution plan for the findings in
[issue-analysis/optimization-security-assessment-2026-06-28.md](../../issue-analysis/optimization-security-assessment-2026-06-28.md).
Companion: [refactor-consolidation-map.md](refactor-consolidation-map.md) (DRY tasks)
and [security-review-checklist.md](security-review-checklist.md) (release gate).

Sequencing principle: lock a baseline → fix data-safety first → correctness/perf →
consolidate → remove dead code → backfill tests → final verification. Each task is
small and independently shippable. The pre-commit gate is `npm run check` (typecheck
and Vitest); CSS-only and Obsidian-glue changes also need `npm run build:test` plus
the Obsidian CLI smoke checks in [docs/development/testing.md](../development/testing.md).

Risk legend: **R-low** mechanical/pure · **R-med** touches edit flows or shared code ·
**R-high** touches storage/migration or active-file writes (treat as data-loss class
per AGENTS.md). Branch per phase; never commit to `main` directly.

---

## Phase 0 — Baseline verification

Establish a known-good starting point before any change.

### P0.1 — Capture green baseline  ✅ DONE (check/build/lint green, 370 tests; lint:md has pre-existing docs/private/* errors only)

- **objective:** Prove the tree is clean and tests pass before touching anything.
- **files:** none (read-only).
- **dependencies:** none.
- **risk:** R-low.
- **expected tests:** `npm run check` (370 tests), `npm run build`, `npm run lint`, `npm run lint:md`.
- **acceptance:** all four commands exit 0; record the test count (370) and a `git status` clean snapshot.

### P0.2 — Confirm the assessment's reproduction facts  ✅ DONE (normalizePath=0, focus in task-list-view.css=0, DATA-1/DATA-4 confirmed)

- **objective:** Re-verify the load-bearing claims so fixes target real behavior.
- **files:** read `src/detail-notes/folderTemplate.ts`, `src/detail-notes/detailNoteService.ts`, `src/obsidian/pluginDataAdapter.ts`, `styles/task-list-view.css`.
- **dependencies:** P0.1.
- **risk:** R-low.
- **expected tests:** `grep -rn "normalizePath" src` → 0; `grep -n focus styles/task-list-view.css` → 0.
- **acceptance:** DATA-1, DATA-4, A11Y-1 reproduce exactly as written; if any diverges, re-scope before Phase 1.

---

## Phase 1 — Security / data-safety fixes

Highest priority. All touch user data; write tests first (TDD) where logic allows.

### P1.1 — Test fidelity: make `FakeVaultPort.create` throw on existing path (TEST-2)  ✅ DONE (faithful fake + RED collision test confirmed)

- **objective:** Align the test fake with Obsidian's throw-on-exists so collision bugs become visible. Do this FIRST — it red-lights P1.2.
- **files:** `tests/detail-notes/detailNoteService.test.ts`.
- **dependencies:** P0.
- **risk:** R-low.
- **expected tests:** add a case pre-occupying both `<title>.md` and `<title>-<id>.md`; expect it to fail (proving DATA-2).
- **acceptance:** the new collision test is red against current `create`; existing tests still green.

### P1.2 — Guard the create-collision fallback (DATA-2)  ✅ DONE (numeric-suffix loop; 29/29 green, check 371)

- **objective:** Ensure `create` never calls `port.create` on an existing path; disambiguate the fallback.
- **files:** `src/detail-notes/detailNoteService.ts` (lines ~89-94).
- **dependencies:** P1.1.
- **risk:** R-med (detail-note creation flow).
- **expected tests:** P1.1's collision test turns green; add a numeric-suffix-loop test if that strategy is chosen.
- **acceptance:** creating two same-title tasks (one with the fallback name pre-taken) yields distinct paths, no throw; `npm test tests/detail-notes/detailNoteService.test.ts` green.

### P1.3 — Normalize & sanitize detail-note folder paths (DATA-1)  ✅ DONE (folderTemplate strips ./..; main.ts wraps vault paths in normalizePath; check 372, build green. ✅ verified in Obsidian: `../../../DayTasks/{{year}}/{{month}}` → `DayTasks/{{year}}/{{month}}`, stayed in vault)

- **objective:** Strip `.`/`..` segments and apply Obsidian `normalizePath()` before any vault write.
- **files:** `src/detail-notes/folderTemplate.ts` (segment filter), `src/main.ts` (`VaultPort` wiring: wrap `create`/`createFolder`/`renameFile` paths with `normalizePath`).
- **dependencies:** P0.
- **risk:** R-high (path → vault write).
- **expected tests:** `folderTemplate.test.ts` — `resolveFolderTemplate("../x", iso)` and `"a/../../b"` contain no `..`; keep all existing template tests green.
- **acceptance:** unit tests pass; smoke — set `detailNotesFolder` to `../escape`, create a note, confirm it stays inside the vault (`obsidian … dev:errors` clean).

### P1.4 — Identity-check before frontmatter writes in `sync`/`migrate` (DATA-3)  ✅ DONE (taskId guard in sync + migrate; check 374)

- **objective:** Bail when the note at the stored path has a `taskId` that isn't this task's, so a repointed/replaced note is never clobbered.
- **files:** `src/detail-notes/detailNoteService.ts` (`sync` ~119-153, `migrate` ~168-191).
- **dependencies:** P0.
- **risk:** R-high (frontmatter overwrite).
- **expected tests:** `detailNoteService.test.ts` — note at `path` has `taskId:"other"` → `writeFrontmatter` not called (call count 0); same-id still syncs.
- **acceptance:** new tests green; existing sync/migrate tests unchanged.

### P1.5 — Surface task-drop on decode (DATA-4)  ✅ DONE (decode returns droppedTasks; main.ts Notice+warn; check 376, build green)

- **objective:** Never silently erase a task; warn before a save finalizes the loss.
- **files:** `src/obsidian/pluginDataAdapter.ts` (`decodePluginData` returns/reports a dropped count), `src/main.ts` (`loadPluginData` emits a Notice/`console.warn` when `raw.tasks.length > decoded.tasks.length`).
- **dependencies:** P0.
- **risk:** R-high (storage load path).
- **expected tests:** `pluginDataAdapter.test.ts` — `decodePluginData({tasks:[valid,{id:"x"}]})` → 1 task + dropped count 1; round-trip of valid data unchanged.
- **acceptance:** tests green; manual — load a `data.json` with one malformed task, confirm the Notice and that the valid tasks survive.

### P1.6 — Validate or document `sortOrder` (DATA-5)  ✅ DONE (decision: opaque key; documented in task.ts + verbatim-keep test; check 377)

- **objective:** Decide opaque-vs-validated for `sortOrder` and the optional strings; implement the chosen policy.
- **files:** `src/obsidian/pluginDataAdapter.ts` (~126-141).
- **dependencies:** P1.5.
- **risk:** R-low.
- **expected tests:** decode test with `sortOrder:"abc"` asserting the policy.
- **acceptance:** test green; behavior documented in the function's doc comment.

> SEC-4 stays deferred (the daily-note write chain is unreachable; see Phase 4 / TEST-3). No Phase 1 action — re-open only if the slice is wired.

---

## Phase 2 — Performance / lifecycle-correctness fixes

No hot-loop perf regressions were found (prior audit already fixed those). This phase
is popout correctness + lifecycle cleanup.

### P2.1 — Flush/clear timers and debounced saves on unload (LIFE-2)  ✅ DONE (onunload clears readingRefreshTimer, cancels debounces, best-effort persist; debounce flush/cancel already existed+tested; check 377. ⏸ disable/reload smoke manual)

- **objective:** No timer fires into a torn-down plugin; no pending save/sync is dropped on reload.
- **files:** `src/main.ts` (`onunload`), `src/util/debounce.ts` (add `.flush()` + `.cancel()`).
- **dependencies:** P0.
- **risk:** R-med (touches the shared debounce util used by saves).
- **expected tests:** `tests/util/debounce.test.ts` — `flush()` runs the pending call immediately and clears the timer; `cancel()` drops it.
- **acceptance:** unit tests green; smoke — change a filter, immediately disable then re-enable the plugin, confirm state persisted and no console error.

### P2.2 — Use the editor's own document/window for widget DOM (LIFE-1 + MNT-1)  ✅ DONE (LIFE-1: livePreview wrapper+rAF and reading host now use container.ownerDocument; check 377, build green. MNT-1 el() factories DEFERRED-low — children auto-adopt on append, cross-module refactor not worth the risk. ⏸ popout smoke manual)

- **objective:** Create and measure widget DOM against `view.dom.ownerDocument` / `view.containerEl.ownerDocument`, not the active window — popout/split correctness; switch to `createEl`/`createDiv` helpers.
- **files:** `src/obsidian/livePreview.ts` (~80, ~102), `src/main.ts` (reading injector ~322), optionally `src/obsidian/widgetRenderer.ts`/`taskListRenderer.ts` `el()` factories (thread owner doc).
- **dependencies:** P0.
- **risk:** R-med (rendering path; verify in a popout).
- **expected tests:** existing renderer unit tests stay green (DOM shape unchanged); add an assertion that the resolved owner document drives creation if cheaply mockable.
- **acceptance:** open a daily note in a popped-out window + a vertical split — widget renders in the correct window and the bottom-gap trim is right; `obsidian … dev:errors` clean.

### P2.3 — Tear down SortableJS when a Live-Preview widget is removed (LIFE-3)  ✅ DONE (host.detachDragFor hook called from ViewPlugin remove(); main.ts destroys handles by containment; check 377, build green. ⏸ heap-snapshot leak smoke manual)

- **objective:** Drop reorder handles promptly when the widget's editor leaf closes without a data change.
- **files:** `src/obsidian/livePreview.ts` (`destroy()`/`remove()` calls a host hook), `src/main.ts` (`attachDrag`/`destroyReorder` accept a per-widget prune).
- **dependencies:** P2.2.
- **risk:** R-med.
- **expected tests:** `tests/obsidian/dragReorder.test.ts` — destroy path; existing reorder tests green.
- **acceptance:** drag-reorder, close the leaf without editing, heap-snapshot shows no retained `Sortable`/listeners on a detached sizer.

### P2.4 — Track the modal focus timer (LIFE-4)  ✅ DONE (focusTimer handle tracked + cleared in onClose; check 377, build green. ⏸ Esc-on-open smoke manual)

- **objective:** Clear the `setTimeout(focus,0)` in `onClose`.
- **files:** `src/obsidian/taskCreationModal.ts` (~185, `onClose`).
- **dependencies:** P0.
- **risk:** R-low.
- **expected tests:** none (Obsidian-coupled); manual.
- **acceptance:** open the create modal, immediately Esc — no error; timer cleared.

### P2.5 — Add `TaskListView.onClose()` (LIFE-5)  ✅ DONE (onClose empties contentEl; check 377, build green)

- **objective:** Empty `contentEl` on close (hygiene).
- **files:** `src/obsidian/taskListLeaf.ts`.
- **dependencies:** P0.
- **risk:** R-low.
- **expected tests:** none (glue); manual open/close/reopen.
- **acceptance:** reopening the view shows fresh state, no duplicated DOM.

---

## Phase 3 — Consolidation / reusability cleanup

Drive from [refactor-consolidation-map.md](refactor-consolidation-map.md). Pure utils,
TDD, no behavior change.

### P3.1 — Extract `localDate(date)` date formatter (DRY-7)  ✅ DONE (localDate in localIso.ts; localIso + todayDate reuse it; check 380)

- **objective:** Single `YYYY-MM-DD` assembler; `localIso` and `todayDate` reuse it.
- **files:** `src/util/localIso.ts`, `src/util/time.ts`.
- **dependencies:** Phase 1 (avoid churn during data-safety work).
- **risk:** R-low (pure).
- **expected tests:** extend `localIso.test.ts` + `time.test.ts` — `localDate(d) === localIso(d).slice(0,10)` across TZ-sensitive dates.
- **acceptance:** `npm run check` green; no call-site behavior change.

### P3.2 — Extract `src/util/coerce.ts` shared coercion vocabulary (DRY-8)  ✅ DONE (named variants incl. asStringArrayOr vs asUniqueStringArray; settings+adapter migrated, their tests unchanged-green; check 391, eslint 0, build green)

- **objective:** Replace the two divergent coercion toolkits with explicitly-named functions; preserve each call site's dedupe contract.
- **files:** new `src/util/coerce.ts`; migrate `src/settings/settings.ts` (78-95) and `src/obsidian/pluginDataAdapter.ts` (37-59).
- **dependencies:** P3.1; do AFTER Phase 1 since it touches the decoder.
- **risk:** R-med (two well-tested files; dedupe divergence is the trap).
- **expected tests:** new `tests/util/coerce.test.ts`; `settings.test.ts` + `pluginDataAdapter.test.ts` pass **unchanged**.
- **acceptance:** behavior identical (dedup vs non-dedup preserved per call site); `npm run check` green.

### P3.3 — Extract `stripTrailingSlashes` (DRY-9)  ✅ DONE (in notePath.ts; both dailyNoteDate sites reuse it; check 382)

- **objective:** One trailing-slash folder normalizer used by both `dailyNoteDate` sites.
- **files:** `src/util/notePath.ts`, `src/daily-notes/dailyNoteDate.ts` (18, 31).
- **dependencies:** P3.1.
- **risk:** R-low.
- **expected tests:** add to `notePath.test.ts`; `dailyNoteDate.test.ts` green.
- **acceptance:** `npm run check` green; do not change daily-note vs folderTemplate intent.

---

## Phase 4 — Dead-code removal

Each is a delete-and-verify. Decide keep-as-scaffold vs delete per milestone; default to
deletion unless a near-term milestone needs it. Update docs in the same commit.

### P4.1 — Resolve `src/api/*` (DEAD-1)  ✅ DONE (decision: delete; 5 stubs removed; check 391, build green; architecture.md updated in P4.5)

- **objective:** Delete the empty API stubs (or formally re-mark them as roadmap).
- **files:** `src/api/*`, `docs/development/architecture.md` (stub list).
- **dependencies:** Phases 1-3 stable.
- **risk:** R-low (no importers, not bundled).
- **expected tests:** `npm run check` green; `grep -rn "api/" src tests` → 0.
- **acceptance:** typecheck + tests + build green; SEC-1 noted as N/A-while-deleted.

### P4.2 — Resolve the daily-note slice (DEAD-2 + SEC-4)  ✅ DONE (decision: delete; removed 5 modules + 2 tests; SEC-4 eliminated with the formatter; dailyNoteDate kept; check 386, build green, eslint 0)

- **objective:** Delete `dailyNoteDocument/Formatter/Parser/Service.ts` + `openTodayCommand.ts` and their tests — OR keep and re-affirm BAD-9 + add SEC-4 escaping guard + TEST-3 first.
- **files:** `src/daily-notes/dailyNote{Document,Formatter,Parser,Service}.ts`, `src/commands/openTodayCommand.ts`, matching `tests/daily-notes/*`, `docs/development/architecture.md`.
- **dependencies:** P4.1; decision required (see Open Decisions).
- **risk:** R-med (confirm `dailyNoteDate.ts` live exports are untouched).
- **expected tests:** after deletion `npm run check` green, count drops ~5-12; `grep` confirms no live importer of the deleted symbols.
- **acceptance:** live daily-note widget still renders (`build:test` smoke); no broken imports.

### P4.3 — Remove the duplicated create-task command (DEAD-3)  ✅ DONE (deleted createTaskCommand.ts + test; inline runCreateTaskCommand kept; check 379, build green)

- **objective:** Delete `createTaskCommand.ts` + its test (keep the inline `runCreateTaskCommand`), or unify on the module.
- **files:** `src/commands/createTaskCommand.ts`, `tests/commands/createTaskCommand.test.ts`.
- **dependencies:** P4.2.
- **risk:** R-low.
- **expected tests:** after deletion `grep -rn createTaskForActiveNote src` → 0; `npm run check` + `npm run build` green.
- **acceptance:** the create-task command still works in Obsidian (`build:test` smoke).

### P4.4 — Remove `formatRelativeDate` (DEAD-4)  ✅ DONE (removed formatRelativeDate + toUtcDays + tests; formatMonthDay/isOverdue kept; check 377, build green, eslint 0)

- **objective:** Delete the unused export + its test (or wire it).
- **files:** `src/util/relativeDate.ts`, `tests/util/relativeDate.test.ts`.
- **dependencies:** none.
- **risk:** R-low.
- **expected tests:** `npm run check` green.
- **acceptance:** `formatMonthDay`/`isOverdue` untouched and still tested.

### P4.5 — Refresh architecture docs (DOC-1)  ✅ DONE (stub list now only vaultAdapter; notes the 2026-06-28 deletions; detailNoteService no longer listed)

- **objective:** Make `architecture.md` "Stubs And Deferred Areas" accurate.
- **files:** `docs/development/architecture.md` (91-100).
- **dependencies:** P4.1-P4.4 (reflect whatever was deleted/kept).
- **risk:** R-low.
- **expected tests:** `npm run lint:md`.
- **acceptance:** every listed stub has 0 live importers; `detailNoteService` removed from the list.

---

## Phase 5 — Tests and regression coverage

Accessibility + the remaining test gaps. Several were enabling steps in earlier phases;
this phase closes the rest.

### P5.1 — Migration orchestration tests (TEST-1)  ✅ DONE (extracted runDetailNoteMigration; 4 cases incl. partial-failure + idempotent retry; main.ts wired; check 381, build green, eslint 0)

- **objective:** Cover `migrateDetailNotes` partial-failure + flag/persist ordering.
- **files:** extract orchestrator from `src/main.ts` (810-830) into a testable unit; `tests/main/migrateDetailNotes.test.ts`.
- **dependencies:** P1.4 (sync/migrate identity guard).
- **risk:** R-med (refactor of a storage path).
- **expected tests:** the four cases in TEST-1 (renamed→flag set; throw→flag not set, others processed; re-run idempotency; already-migrated→no-op).
- **acceptance:** new file green; existing detail-note tests unchanged; `npm run check` green.

### P5.2 — Task List filter-bar focus styles (A11Y-1)  ✅ DONE (focus-visible accent outline on all 11 filter/group controls in task-list-view.css; build-css clean. ⏸ keyboard-tab smoke manual)

- **objective:** Visible focus on every filter-bar control.
- **files:** `styles/task-list-view.css` (regenerate `styles.css` via `npm run build-css`).
- **dependencies:** none.
- **risk:** R-low (CSS only).
- **expected tests:** none unit; manual keyboard-tab smoke.
- **acceptance:** Tab through the filter bar under a theme that hides UA outlines — visible ring on each control.

### P5.3 — Chip focus styles (A11Y-2)  ✅ DONE (focus-visible on project/tag chips in task-card.css; build-css clean. ⏸ keyboard-tab smoke manual)

- **objective:** Visible focus on keyboard-operable project/tag chips.
- **files:** `styles/task-card.css`.
- **dependencies:** none.
- **risk:** R-low.
- **expected tests:** manual.
- **acceptance:** Tab into a card chip — visible ring; Enter activates.

### P5.4 — Group-toggle aria-label (A11Y-3)

- **objective:** Accessible name on the icon-only group toggle.
- **files:** `src/obsidian/taskListRenderer.ts` (240-245).
- **dependencies:** none.
- **risk:** R-low.
- **expected tests:** `taskListRenderer.test.ts` asserts the `aria-label` attribute on the toggle.
- **acceptance:** unit test green; axe over the Task List view shows the toggle named.

### P5.5 — Theming cleanup (CSS-1, CSS-2, CSS-3)

- **objective:** Remove hardcoded hex bias and `!important`.
- **files:** `styles/variables.css` (26-31), `styles/task-card.css` (233, 489-491).
- **dependencies:** P5.2-P5.3 (batch CSS rebuild).
- **risk:** R-low.
- **expected tests:** manual theme switch (light/dark/high-contrast/Minimal).
- **acceptance:** panels follow the theme; rel chips stay flat without `!important`; `grep -rn "!important" styles` → 0.

### P5.6 — Settings heading cleanup (UX-1)

- **objective:** Drop/rename "API (inactive)" heading.
- **files:** `src/settings/settingsTab.ts` (193).
- **dependencies:** P4.1 (API decision).
- **risk:** R-low.
- **expected tests:** manual settings open.
- **acceptance:** consistent sentence-case headings, no out-of-scope API advertised.

### P5.7 — Remaining test gaps (TEST-3, TEST-4, TEST-5, TEST-6, TEST-7)

- **objective:** Backfill parser-rejection (if slice kept), settings-repair branches, load-error recovery, `withBlockedStatus`, shared fixture.
- **files:** `tests/daily-notes/dailyNoteParser.test.ts` (only if P4.2 keeps the slice), `tests/settings/settings.test.ts`, `tests/obsidian/pluginDataAdapter.test.ts`, `tests/core/` (status), `tests/fixtures/task.ts`.
- **dependencies:** P4.2 (skip TEST-3 if the parser is deleted), P3.x (fixture refactor after consolidation).
- **risk:** R-low.
- **expected tests:** the cases listed in each TEST-* finding.
- **acceptance:** `npm run check` green with a higher, meaningful test count; no fixture drift.

---

## Phase 6 — Final build / test / manual verification

### P6.1 — Full automated gate

- **objective:** Everything passes from a clean tree.
- **commands:** `npm run check`, `npm run build`, `npm run lint`, `npm run lint:md`, `npm run test:coverage`.
- **dependencies:** Phases 1-5.
- **risk:** R-low.
- **acceptance:** all exit 0; test count ≥ baseline + the new tests; coverage on pure modules not regressed.

### P6.2 — Obsidian manual smoke

- **objective:** Verify edit flows + popout in the real app.
- **commands:** `npm run build:test`; the manual script in [docs/development/testing.md](../development/testing.md); plus popout-window widget render, keyboard-only filter-bar walkthrough, detail-note create/sync/open, and a `detailNotesFolder` traversal attempt.
- **dependencies:** P6.1.
- **risk:** R-med (manual coverage of edit flows).
- **acceptance:** `obsidian … dev:errors` clean; data preserved across disable/reload; widget correct in popout; keyboard focus visible throughout.

### P6.3 — Security-checklist sign-off

- **objective:** Walk [security-review-checklist.md](security-review-checklist.md) end-to-end.
- **dependencies:** P6.2.
- **risk:** R-low.
- **acceptance:** every checklist item ticked or explicitly N/A with a reason; assessment file's `status` flipped to `resolved` with a fix log.

---

## Open decisions (need a human call before the affected phase)

1. **DEAD-2 (P4.2):** delete the daily-note slice, or keep it as scaffold + harden SEC-4? Deletion removes 155 LOC + SEC-4 risk; keeping needs the escaping guard + TEST-3.
2. **DEAD-1 (P4.1):** delete `src/api/*`, or keep as a roadmap marker? Both zero-risk.
3. **DATA-5 (P1.6):** is `sortOrder` numeric (validate) or opaque (document)?

## Suggested PR slicing

- **PR 1 (data-safety):** P1.1-P1.6 — one branch, the release-critical set.
- **PR 2 (lifecycle/popout):** P2.1-P2.5.
- **PR 3 (consolidation):** P3.1-P3.3.
- **PR 4 (dead code + docs):** P4.1-P4.5 (gated on the open decisions).
- **PR 5 (a11y/CSS/tests):** P5.1-P5.7.
- Phase 6 runs on each PR (gate) and once more before any release.
