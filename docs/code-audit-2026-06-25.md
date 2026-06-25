# Code Audit — 2026-06-25

Two-eye review of the DayTasks plugin (`src/`, ~3,000 LOC) across four axes:
**Optimization · Security · Consolidation/DRY · Bad patterns.**

- **Eye 1:** Claude (Opus 4.8) — full-codebase read.
- **Eye 2:** Codex (parallel, independent pass).

Baseline: plugin works as expected in dev. Several files are **intentional stubs**
for future milestones (`src/api/*`, `src/detail-notes/detailNoteService.ts`,
`src/obsidian/vaultAdapter.ts`, `src/commands/openTodayCommand.ts` = `export {}`).
Stubs are **not** counted as defects.

**Net:** ~30 distinct findings, **0 critical**, ~9 medium. No contradictions between
the two reviews — complementary coverage. Codebase is healthy; findings are polish
plus a few latent bugs in not-yet-wired slices.

Severity: **MED** = fix soon / latent bug · **LOW** = polish / future-gated.
Source: `B` = both eyes · `CX` = Codex only · `MX` = Claude only.

---

## Status legend

`☐ Open` · `☑ Fixed` · `▷ Deferred (roadmap)` · `✗ Won't fix (by design)`

---

## 1. Optimization

| ID | Sev | Src | Location | Issue | Fix | Status |
|----|-----|-----|----------|-------|-----|--------|
| OPT-1 | MED | CX | `settings/settingsTab.ts` (all `onChange`); `main.ts:306` | Every keystroke in a text setting awaits `saveSettings()` → rebuilds services + persists **all tasks** + `refreshViews()`. | Debounce, or save on blur/Enter; split settings-persist from task-persist. | ☑ Fixed |
| OPT-2 | MED | B | `main.ts:312-325` | `refreshViews()` rebuilds all reading widgets and dispatches an empty CM transaction to **every** leaf per change. | Coalesce; target only daily-note / affected leaves. | ☐ Open |
| OPT-3 | MED | B | `obsidian/livePreview.ts:46-67`; `obsidian/widgetInsertion.ts:75-83,98-107` | `applyBottomOffset` runs on every `ViewUpdate`; `renderedBottom` does `querySelectorAll("*")` per visible line. | Gate on geometry change; batch with `requestAnimationFrame`; measure only the last content block. | ☐ Open |
| OPT-4 | LOW | B | `ui/todayView.ts:41-57` | Multiple passes over `tasks` for done / overdue / per-status counts; `overdue` already on cards. | Single pass; reuse `cards.filter(c => c.overdue)`. | ☐ Open |
| OPT-5 | LOW | CX | `obsidian/modals.ts:15-21` | Path picker scans + sorts the whole vault on every `getItems()`. | Cache for modal lifetime, or maintain a path index via file events. | ☐ Open |
| OPT-6 | LOW | MX | `core/statusManager.ts:22` | `getStatusesByOrder()` re-sorts a fresh copy each call; called several times per render. | Memoize per status-config identity. | ☐ Open |

## 2. Security

No `innerHTML` / `insertAdjacentHTML` anywhere — all DOM via `createElement` +
`textContent`. Widget rendering is injection-safe. Findings below are hardening,
mostly future-gated to the (stubbed) API + daily-note-sync slices.

| ID | Sev | Src | Location | Issue | Fix | Status |
|----|-----|-----|----------|-------|-----|--------|
| SEC-1 | MED | B | `settings/settings.ts:34-36,64-66`; `settingsTab.ts:185-191` | `apiToken` persisted plaintext; `apiPort` via `Number()` with no 1–65535 clamp (accepts negative/decimal/huge). API server is a stub today. | When API ships: bind `127.0.0.1`, constant-time token compare, high-entropy token, validate port range. | ▷ Deferred (roadmap) |
| SEC-2 | LOW | MX | `obsidian/pluginDataAdapter.ts:45-53` | Stored-task scalar fields (`estimateMinutes`, `dueDate`, `priority`) trusted after partial `isValidTask`; force-cast `as unknown as DayTask`. | Validate/coerce each optional field (see BAD-1). | ☑ Fixed |
| SEC-3 | LOW | CX | `settings/settings.ts:92-100`; `widgetRenderer.ts:161,200` | Status colors accepted as arbitrary strings, written into CSS custom properties. | Validate with `CSS.supports("color", value)` before save/render; fallback color. | ☐ Open |
| SEC-4 | LOW | CX | `daily-notes/dailyNoteFormatter.ts`; `dailyNoteDocument.ts:22` | Task titles serialized into `<!-- id -->` task lines without escaping `-->`, `<!--`, or newlines → broken round-trip. | Normalize title to single line; escape/reject comment + newline delimiters. (Module unwired.) | ▷ Deferred (roadmap) |
| SEC-5 | LOW | CX | `main.ts:296`; `taskCreationModal.ts:17-21`; `pluginDataAdapter.ts:38-41` | Tags interpolated directly into the global-search query (`tag:#${tag}`); crafted persisted tags could alter search syntax. | Escape/quote tag value or use a structured tag-filter API. | ☐ Open |
| SEC-6 | LOW | CX | `taskCreationModal.ts:152-154,277-279`; `main.ts:284-285` | Free-form project paths stored and passed to `openLinkText()` without confirming they are vault markdown files. | Validate against `TFile` markdown entries or require picker-backed paths. | ☐ Open |
| SEC-7 | LOW | B | `core/taskIds.ts:19`; `core/taskStore.ts:32-34` | IDs from `Math.random` (non-crypto); `save()` overwrites by id with no collision check. | Keep `Math.random` (62⁸ space ok); add a cheap collision retry in `save()`. | ☐ Open |

## 3. Consolidation / DRY

| ID | Sev | Src | Location | Issue | Fix | Status |
|----|-----|-----|----------|-------|-----|--------|
| DRY-1 | MED | B | `taskCreationModal.ts:17-22`; `settingsTab.ts:5-10` | Two divergent token splitters (`parseList` strips `#@+`, splits `[,\s]+`; `parseTags` comma-only). | Extract shared `parseLabelList()` (explicit prefix/delimiter/dedupe). | ☐ Open |
| DRY-2 | MED | B | `dayTaskService.ts:99-103,143-147` | Completion-timestamp side-effect (`isCompleted && !wasCompleted → completedAt`) duplicated in `updateTask` + `setStatus`. | Extract `applyCompletion(task, was, is, ts)`. | ☐ Open |
| DRY-3 | LOW | B | `util/clone.ts`; `taskStore.ts:10-17`; `taskFactory.ts:26-52`; `dayTaskService.ts:91-93`; `pluginDataAdapter.ts:38-53` | Clone/normalize logic scattered; `util/clone.ts` (`cloneStrings`/`cloneProjects`) **unused**. | Consolidate clone/dedupe helpers; use consistently or delete `clone.ts`. | ☐ Open |
| DRY-4 | LOW | MX | `settings/settings.ts:69-90`; `pluginDataAdapter.ts:15-42` | `isRecord` + `asStringArray` duplicated; `MARKDOWN_EXTENSION_PATTERN` in both `util/fuzzyPath.ts:3` and `util/notePath.ts:1`. | Hoist to shared `util/`. | ☐ Open |
| DRY-5 | LOW | CX | `taskCreationModal.ts:148-169`; `settingsTab.ts:128-151` | Project-note picker wiring (`TextComponent` + `MarkdownPathSuggestModal`) duplicated. | Extract a `bindProjectPicker(text, onPick)` helper. | ☐ Open |
| DRY-6 | LOW | CX | `main.ts:126-130`; `ui/dailyTasksWidgetController.ts:23-31` | Daily-note date detection done twice; controller re-derives via `getDailyNoteDateFromPath` **ignoring** the configured folder. | Pass the resolved date in, or inject one folder-aware resolver. | ☐ Open |

## 4. Bad patterns / dead code

| ID | Sev | Src | Location | Issue | Fix | Status |
|----|-----|-----|----------|-------|-----|--------|
| BAD-1 | MED | B | `pluginDataAdapter.ts:19-31,45-53` | Minimal validation + `(task as unknown as DayTask)` lets malformed optional fields / `timeEntries` reach service + render. | Full decoder validating every optional field and each `timeEntries` item. | ☑ Fixed |
| BAD-2 | MED | CX | `core/task.ts:10-15`; `dayTaskService.ts:91-93`; `taskIndex.ts:103-111` | `withDefaultTag` preserves duplicates when `daytask` already present; **`updateTask` does not dedupe input tags** → index lists task twice. Create path is safe (factory dedupes). | Make `withDefaultTag` always return a unique list; normalize tags/contexts before index. | ☑ Fixed |
| BAD-3 | MED | CX | `settings/settings.ts:115-123`; `statusManager.ts:87-128` | `StatusManager.validate()` exists but is never called during merge/save — duplicate values/ids or bad `nextStatus` persist. | Run `validate()` in settings merge; fall back / surface errors. | ☑ Fixed |
| BAD-4 | MED | CX | `settingsTab.ts` (async `onChange`); `main.ts:306-309` | Settings handlers await persistence with no local catch → save failures unhandled, in-memory state already mutated. | Centralize via guarded `saveSettingsWithNotice()`. | ☐ Open |
| BAD-5 | MED | B | `main.ts:288-296` | `searchTag()` reaches `app.internalPlugins` through an unsafe `unknown` cast, no feature detection. | Isolate behind a typed adapter with feature detection / public API. | ☐ Open |
| BAD-6 | MED | MX | `daily-notes/dailyNoteFormatter.ts` | Hardcoded `task.status === "done"` ignores the configurable `isCompleted` model — breaks if statuses are renamed/reconfigured. (Module unwired.) | Use `statusManager.isCompletedStatus(status)`. | ▷ Deferred (roadmap) |
| BAD-7 | LOW | CX | `main.ts:284-285` | `openProject()` fire-and-forgets `openLinkText()` (no `.catch`). | Attach `.catch()` + failure notice. | ☐ Open |
| BAD-8 | LOW | CX | `dayTaskService.ts:70-95` | `updateTask` reuses `CreateDayTaskInput`; full-replacement vs partial-update semantics easy to confuse. | Dedicated `UpdateDayTaskInput`, or document/enforce full-replacement. | ☐ Open |
| BAD-9 | LOW | MX | `util/clone.ts`; `util/relativeDate.ts:27` (`formatRelativeDate`); `statusManager.ts:79` (`getCompletionToggleTarget`); `commands/createTaskCommand.ts` (`createTaskForActiveNote`) | Implemented-but-unwired modules (tested, not stubs) carry maintenance weight; `createTaskForActiveNote` is a second task-create path `main.ts` doesn't use. | Per item: keep as documented roadmap scaffold, or delete. | ▷ Deferred (roadmap) |
| BAD-10 | LOW | MX | `obsidian/widgetRenderer.ts:43,113` | Tag/project chips are `<a>` without `href` → not keyboard-focusable. | Use `<button>` or add `role`/`tabindex`. | ☐ Open |
| BAD-11 | LOW | MX | `ui/taskCard.ts:46`; `settings/settings.ts:171` | Dead fields: `statusIcon` plumbed into the view model but never rendered; `widgetPosition` always coerced to `"bottom"`. | Render the icon or drop the field; collapse `widgetPosition` until multi-position exists. | ☐ Open |

---

## Recommended fix order

Live-path, high-value first:

1. **BAD-2** — tag dedupe in `updateTask` + `withDefaultTag` (latent index corruption, live path)
2. **OPT-1** — debounce settings saves (per-keystroke full persist)
3. **BAD-3** — wire `StatusManager.validate()` into settings merge
4. **BAD-1 / SEC-2** — full task decoder (drop the force-cast)
5. **OPT-3** — narrow + rAF-batch the Live Preview offset scan
6. **BAD-6** — `isCompletedStatus` instead of `=== "done"`
7. **BAD-4** — guarded settings-save wrapper
8. **DRY-1 / DRY-2 / DRY-5** — shared `parseLabelList`, completion helper, picker-binder
9. **SEC-1 / SEC-4** — gate API token+port and formatter escaping to their milestones
10. **BAD-9 / DRY-3** — decide keep-vs-delete on the unwired cluster

---

## Fix log

Record each fix here as it lands (ID · commit · note).

| Date | ID(s) | Commit | Note |
|------|-------|--------|------|
| 2026-06-25 | BAD-2 | 8f26ae9 | `withDefaultTag` now dedupes; fixes duplicate tags surviving edits + double index entries. TDD: `tests/core/task.test.ts` + a deduplication case in `dayTaskService.test.ts`. |
| 2026-06-25 | OPT-1 | 77235a9 | Text settings persist via a 400ms `debounce` (new `util/debounce.ts`, TDD `tests/util/debounce.test.ts`); discrete controls stay immediate; pending save flushed on `hide()`. |
| 2026-06-25 | BAD-3 | d439c65 | `asStatuses` now runs `StatusManager.validate()`; configs with duplicate values/ids or bad `nextStatus` fall back to defaults instead of persisting. TDD: two fallback cases in `tests/settings/settings.test.ts`. |
| 2026-06-25 | BAD-1, SEC-2 | _this commit_ | Replaced the `as unknown as DayTask` blanket cast with a per-field decoder (`normalizeStoredTask`): optional strings/`estimateMinutes` coerced or dropped, `timeEntries` + project links validated. TDD: 4 cases in `tests/obsidian/pluginDataAdapter.test.ts`. |
