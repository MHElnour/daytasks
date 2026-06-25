# Code Audit — 2026-06-25 · Pass 2 (deep second pass)

Second-pass review of the DayTasks plugin, run **after** the first two-eye audit
(`docs/code-audit-2026-06-25.md`) landed 20 fixes. Goal: verify those fixes
adversarially, sweep for **dead / unreachable code** (primary deliverable), and
surface what the first pass missed.

- **Eye 1 (this report):** Claude (Opus 4.8) — full re-read + reachability sweep.
- **Eye 2:** Codex (independent parallel pass) — verbatim output + reconciliation below.

**Baseline (verified green before review):**
`npm run build` → tsc clean, esbuild `main.js 38.7kb`. `npx vitest run` → **27 files,
147 tests passing**. No red. (Build/test re-run at review start.)

**Verdict up front:** The 20 fixes are real and correct — every one does what its
fix-log claims, with no regression and no orphaned helper/import. The codebase is
healthy. New findings are a single genuinely-dead type, a roadmap-unwired cluster
larger than BAD-9 documented, and a handful of low-severity latent gaps (tag/priority
normalization on the *load* path, the OPT-3 hot path, SEC-3 scope). Severity ceiling:
**medium**. Zero critical/high.

Severity scale: **critical** = data loss / exploit · **high** = crash / silent wrong
result · **medium** = degraded behavior or perf · **low** = polish / latent / quality.

---

## A. Verification of the 20 landed fixes

Each fix was re-read against its fix-log claim and grepped for regressions/orphans.
`file:line` cites the *current* source.

| ID | Claim | Verified | Evidence | Regression? | Orphan? |
|----|-------|----------|----------|-------------|---------|
| BAD-2 | `withDefaultTag` dedupes; no double index entry | ✅ | `task.ts:11-21` (Set-based dedupe); `dayTaskService.ts:94` update uses it; factory `taskFactory.ts:76` via `mergeUniqueStrings`+`withDefaultTag`; index `syncMap` keys via `Set` `taskIndex.ts:175` | none on live path | none — but see **NEW-2** (load path bypasses it) |
| OPT-1 | 400 ms debounce on text settings; immediate for discrete; flush on hide | ✅ | `settingsTab.ts:18-21,24-26`; text fields call `persistDebounced()` (49-52,141-143,152-155,172-175,200-206); toggles/dropdowns `await saveSettingsWithNotice()` | none | none |
| BAD-3 | `StatusManager.validate()` runs at settings merge | ✅ | `settings.ts:119-123` `asStatuses` gates on `new StatusManager(valid, valid[0].value).validate().valid`; falls back to defaults | none | none |
| BAD-1 | per-field decoder replaces blanket cast | ✅ | `pluginDataAdapter.ts:97-134` `normalizeStoredTask`; wired into `decodePluginData:142-143` → `DayTasksDataStore.load:164-167` | none | none |
| SEC-2 | optional scalar fields validated/coerced; `timeEntries` validated | ✅ | `asFiniteNumber:39-41`, `asProjects:49-66`, `asTimeEntries:68-89`, optional-string loop `111-126` | none | none |
| BAD-6 | daily-note completion driven by flag not `=== "done"` | ✅ | `dailyNoteFormatter.ts:13-16` takes `completed: boolean`; `dailyNoteDocument.ts:23` passes it. Module still unwired (roadmap). | none | none |
| DRY-1 | shared `parseLabelList` replaces two splitters | ✅ | `util/parseLabelList.ts`; used `settingsTab.ts:141`, `taskCreationModal.ts:230,233,249,250`. Old `parseList`/`parseTags` gone (grep: 0 hits) | none | none |
| DRY-2 | `applyCompletion` de-dupes completedAt logic | ✅ | `dayTaskService.ts:162-176`; called from `updateTask:102` and `setStatus:140` | none | none |
| DRY-5 | `addMarkdownPathPicker` removes duplicated picker wiring | ✅ | `obsidian/projectPicker.ts`; used `settingsTab.ts:158`, `taskCreationModal.ts:152` | none | none |
| OPT-4 | overdue count reuses `cards` | ✅ | `todayView.ts:41` `cards.filter(c=>c.overdue)`; `doneCount` from `cards` too (40) | none | none |
| OPT-6 | `StatusManager` precomputes ordered list | ✅ | `statusManager.ts:14,20` `orderedStatuses` set once in ctor; `getStatusesByOrder:27-29` returns a copy | none | none |
| DRY-3 | unused `util/clone.ts` deleted | ✅ | `clone.ts` absent (grep: file gone, 0 refs to `cloneStrings`/`cloneProjects`) | none | none |
| DRY-4 | `isRecord` + md-regex hoisted | ✅ | `util/isRecord.ts` used by `settings.ts:10`, `pluginDataAdapter.ts:3`; `util/notePath.ts:1` `MARKDOWN_EXTENSION_PATTERN` used by `fuzzyPath.ts` | none | `asStringArray` intentionally left duplicated (divergent signatures) — documented |
| BAD-7 | `openProject` catches `openLinkText` rejection | ✅ | `main.ts:298-302` `.catch()` | none | none |
| BAD-5 | private `internalPlugins` cast contained + feature-detected | ✅ | `obsidian/globalSearch.ts:26-34` single cast, typed interfaces, returns `false` when unavailable; `main.ts:304-308` falls back to Notice | none | none |
| BAD-4 | guarded `saveSettingsWithNotice()` | ✅ | `settingsTab.ts:29-36` try/catch + Notice; every save routes through it | none | none |
| BAD-8 | `UpdateDayTaskInput` enforces full-replacement | ✅ | `task.ts:102-113` (every editable field required, optionals `\| undefined`); `dayTaskService.ts:76` signature; `main.ts:278-289` maps modal input. Non-editable fields (`parentId`, `detailNotePath`, `sortOrder`, `timeEntries`, `createdAt`) preserved via `...task` spread `dayTaskService.ts:88` — correct, not wiped | none | none |
| BAD-10 | chips keyboard-operable via `makeActivatable` | ✅ | `widgetRenderer.ts:57-71` adds `role=button`, `tabIndex=0`, click + Enter/Space; applied to projects `106`, tags `132` | none | none |
| OPT-5 | path picker caches items for modal lifetime | ✅ | `modals.ts:9,19-29` `cachedItems` guards rescans | none | none |
| OPT-2 | refresh nudges only daily-note CM editors | ✅ | `main.ts:335-348` `nudgeDailyNoteEditors` gates on `resolveDailyNoteDate` before `cm.dispatch({})` | none — but reading-mode refresh still iterates all leaves (**NEW-8**, minor) | none |

**All 20 verified.** No fix introduced an unused symbol or broke another path.

---

## B. Dead / unreachable code sweep (primary deliverable)

Method: extracted every `export` in `src/` (98 symbols), grepped each for references
*outside* its defining file and inside `tests/`, then resolved **same-file** internal
use by reading each module (the cross-file grep alone undercounts symbols used only by
their own module's other exports — e.g. `decodePluginData` is used by
`DayTasksDataStore.load` in the same file, so it is reachable, not dead).

### Reachability classification

| Category | Meaning |
|----------|---------|
| **(a) reachable** | on a path from `main.ts` default export / registered command / ViewPlugin / settings tab |
| **(a-int)** | reachable, but the `export` is only consumed inside its own module (or by tests) — exporting is optional, not a defect |
| **(b) test-only** | referenced only by `tests/` |
| **(c) stub** | `export {}` roadmap placeholder — **keep, not a defect** |
| **(d) unwired** | implemented + tested but no live call site reaches it (roadmap scaffold) |
| **(e) DEAD** | zero references anywhere outside its declaration — **delete candidate** |

### Genuinely dead (delete candidate)

| Symbol | File | Evidence |
|--------|------|----------|
| `TaskStatus` (type) | `core/task.ts:2` | `grep -rn '\bTaskStatus\b' src tests` → **0 hits** outside the declaration. `DayTask.status` and `CreateDayTaskInput.status` are typed `string`, not `TaskStatus`. A leftover alias, not roadmap scaffold, not tested. **Safe to delete.** |

That is the **only** genuinely-dead symbol. Everything else is reachable, a documented
stub, or roadmap-unwired.

### Unwired but implemented (roadmap scaffold — keep or delete per roadmap, **not** defects)

This cluster is **larger than BAD-9 enumerated.** BAD-9 listed only `clone.ts`
(deleted), `formatRelativeDate`, `getCompletionToggleTarget`, `createTaskForActiveNote`.
The full unwired set:

| Symbol / module | File | Evidence | In BAD-9? |
|-----------------|------|----------|-----------|
| `formatRelativeDate` | `util/relativeDate.ts:27` | test-only; `taskCard` uses `formatMonthDay`+`isOverdue`, not this | yes |
| `getCompletionToggleTarget` (method) | `core/statusManager.ts:84` | no src call site (only def + tests); live path uses `cycleStatus` | yes |
| `createTaskForActiveNote` + `CreateTaskCommandDeps` | `commands/createTaskCommand.ts:20,5` | module imported by **0** src files; `main.ts` uses its own `runCreateTaskCommand`→`TaskCreationModal` flow | yes |
| `isTaskId` | `core/taskIds.ts:15` | no src call site (only tests) | **no — new** |
| `TASK_ID_INLINE_SOURCE` | `core/taskIds.ts:11` | consumed only by `dailyNoteParser.ts:13`, itself unwired | **no — new** |
| `parseDailyTaskLine` / `ParsedDailyTaskLine` | `daily-notes/dailyNoteParser.ts` | module imported by 0 src files | **no — new** |
| `upsertDailyTaskLine` | `daily-notes/dailyNoteDocument.ts:17` | module imported by 0 src files | **no — new** |
| `formatDailyTaskLine` / `DailyTaskLine` | `daily-notes/dailyNoteFormatter.ts` | consumed only by `dailyNoteDocument` (unwired) | **no — new** |
| `DailyNotePort` | `daily-notes/dailyNoteService.ts:1` | zero refs anywhere | **no — new** |
| `ApiEnvelope` | `api/types.ts:1` | zero refs anywhere (API slice) | **no — new** |

These are the **daily-note-sync slice** and the **alternate create-command + API
type** — coherent future milestones, safe to keep as documented scaffold. Recommend
folding the new rows into BAD-9's inventory so the roadmap debt is tracked in one place.

### Intentional stubs (`export {}`) — keep, **not** defects

`api/apiAuth.ts`, `api/apiServer.ts`, `api/taskRoutes.ts`, `api/timeRoutes.ts`,
`detail-notes/detailNoteService.ts`, `obsidian/vaultAdapter.ts`,
`commands/openTodayCommand.ts`. All confirmed `export {}`.

### Reachable (representative — full set verified)

All entry-point imports of `main.ts` resolve (DayTaskService, StatusManager,
MemoryTaskIndex/Store, resolveDailyNoteDate, openGlobalSearch,
dailyTasksLivePreviewExtension, DayTasksDataStore, TaskCreationModal,
insertWidgetAtBottom, todayDate, renderDailyTasksWidget, DEFAULT_SETTINGS,
DayTasksSettingTab, DailyTasksWidgetController). Their transitive deps (taskFactory,
taskCard, todayView, widgetInsertion, chipColor, estimate, fuzzyPath, notePath,
parseLabelList, debounce, isRecord, time, status, projectPicker, modals) are all
reachable.

**(a-int)** exports — reachable but only used inside their own module or by tests, so
the `export` keyword is optional (no action needed, listed for completeness):
`DayTaskServiceSettings`, `DayTaskServiceDependencies`, `StatusValidationResult`,
`TaskFactoryDefaults`, `TaskFactoryDependencies`, `TASK_ID_PREFIX`,
`TASK_ID_RANDOM_LENGTH`, `TASK_ID_SOURCE`, `isWithinDailyNoteFolder`,
`WIDGET_MARGIN_TOP_VAR`, `WIDGET_ROOT_CLASSES`, `LivePreviewWidgetHost`,
`TaskCreationModalOptions`, `WidgetPosition`, `StatusSummaryEntry`,
`TaskCardProjectViewModel`, `DailyTasksWidgetControllerDependencies`,
`DailyTasksWidgetService`, `DebouncedFunction`, `WidgetRenderHandlers`,
`DEFAULT_TASK_TAG`, `chipHue`, `PluginDataPort`, `findBottomAnchor`,
`insertAfterElement`, `decodePluginData`, `encodePluginData`.

---

## C. Fresh findings (missed by the first pass)

> Reconciled against Codex below. IDs `P2-n`. All cite verified `file:line`.

### Correctness / data-integrity

**P2-1 · `low` · Cleared "Default priority" silently reverts to "normal" on reload.**
`settingsTab.ts:127-130` lets the user pick "—" → `settings.defaultPriority = value || undefined`.
Undefined is dropped from `data.json` on save. On reload, `settings.ts:181-184`
`asString(s.defaultPriority, DEFAULT_SETTINGS.defaultPriority ?? DEFAULT_PRIORITY_VALUE)`
restores `"normal"`. So "no default priority" cannot persist across a restart — it
silently flips back to Normal.
*Fix:* represent "none" explicitly (store `""` and treat empty as no-default in the
factory/merge), or change the merge fallback so a missing key stays empty.

**P2-2 · `low`–`medium` · Load/decode path bypasses tag normalization (residual of BAD-2).**
`normalizeStoredTask` (`pluginDataAdapter.ts:97-106`) builds `tags`/`contexts`/`projects`
via `asStringArray`/`asProjects` with **no dedupe and no `withDefaultTag`**. BAD-2 fixed
the create/update entry points but not the persistence-load one. A `data.json` written
by a pre-BAD-2 build (whose `withDefaultTag` "preserves duplicates when daytask already
present") loads tasks with duplicate tags, which `MemoryTaskIndex.rebuild` →
`addToSecondaryMaps` (`taskIndex.ts:103-105`) then double-lists in `byTagMap`. Impact is
latent today (the widget queries `byDate`, not `byTag`; `byTag/byContext/byProject` have
no live caller), so **low**, but it is a real normalization hole and the default
`daytask` tag is not guaranteed on load.
*Fix:* run `withDefaultTag`/a `mergeUnique` over tags, and dedupe contexts/projects, in
`normalizeStoredTask`.

**P2-3 · `low` · `updateTask` dedupes only tags, not contexts/projects.**
`dayTaskService.ts:94` deduplicates tags via `withDefaultTag`, but
`contexts: input.contexts ? [...input.contexts] : []` (95) and
`projects: input.projects ? input.projects.map(...) : []` (96) copy verbatim. The
factory dedupes all three (`taskFactory.ts:76-78` `mergeUniqueStrings`/`mergeUniqueProjects`),
so create and update diverge. Live UI is safe (`parseLabelList` dedupes contexts at
`taskCreationModal.ts:250`; project is a single value), but any non-UI caller passing
duplicate contexts/projects would double-index.
*Fix:* dedupe contexts/projects in `updateTask` with the same helpers the factory uses.

### Performance

**P2-4 · `medium` · OPT-3 confirmed + widened: offset re-measure runs on *every*
`ViewUpdate`, including cursor moves.** `livePreview.ts:46-48` calls `sync()` on every
`update()`; when the widget is already attached and the key is unchanged it still runs
`applyBottomOffset(container, this.widget)` synchronously (`64-67`). `applyBottomOffset`
(`widgetInsertion.ts:90-122`) measures every `.cm-line` via `renderedBottom`, which does
`element.querySelectorAll("*")` per line (`widgetInsertion.ts:77`). A `ViewUpdate` fires
on selection-only changes too, so simply moving the caret in a long daily note triggers
a full descendant-walk re-measure.
*Fix:* gate the inline re-measure on `update.docChanged || update.geometryChanged`,
batch it in `requestAnimationFrame` (as `scheduleOffsetRefresh` already does for the
initial draw), and measure only the last content line instead of all lines.

**P2-8 · `low` · `refreshReadingViews` still touches every markdown leaf.** OPT-2
narrowed the CM nudge, but `main.ts:155-161` loops **all** markdown leaves and calls
`injectReadingView`, which unconditionally runs
`querySelectorAll('.daytasks-widget-host').forEach(remove)` (`166-168`) on each leaf
before early-returning for non-preview/non-daily notes. Cheap, but not coalesced and
not leaf-targeted.
*Fix:* skip non-preview / non-daily leaves before the DOM query.

### Security (hardening — all low, all on not-yet-exploitable paths)

**P2-5 · `low` · SEC-3 re-scoped: only status/priority *config* colors are unsafe; chips
are safe.** `chipColor` (`util/chipColor.ts:15`) returns a computed `hsl(...)` — not
attacker-controlled. The arbitrary-string risk is solely `StatusConfig.color` /
`PriorityConfig.color`, written raw into CSS custom properties at
`widgetRenderer.ts:176` (`--daytasks-status-color`) and `:215` (legend dot). A crafted
persisted color like `url("http://x/track")` would be substituted wherever CSS consumes
the var, enabling a CSS-driven network fetch. Requires control of the persisted status
config, so **low**.
*Fix:* validate with `CSS.supports("color", value)` at merge/render, fall back to
`var(--text-muted)`. (Tighter scope than the original SEC-3 note, which implicated chips.)

**P2-6 · `low` · SEC-5 confirmed.** `main.ts:305` `openGlobalSearch(app, ` + "`tag:#${tag}`" + `)`.
`tag` flows from `card.tags` → persisted task tags. `parseLabelList` strips spaces from
UI-entered tags, but `normalizeStoredTask` does not re-split stored tags, so a
hand-edited / legacy `data.json` tag containing whitespace or search operators alters
the query syntax. Low.
*Fix:* quote/escape the tag, or use a structured tag filter.

**P2-7 · `low` · SEC-6 confirmed.** `main.ts:298-302` passes a free-form `path` to
`openLinkText` with no check it resolves to a vault markdown `TFile`. `openLinkText` is
Obsidian-sandboxed (no FS escape), so impact is "opens/creates an unexpected note", not
traversal. Low.
*Fix:* resolve against `metadataCache.getFirstLinkpathDest` / require picker-backed paths.

### Type-safety

Clean. `tsconfig` `strict: true`. The only `as unknown` casts are the two intentionally
contained private-API accesses (`globalSearch.ts:27` — BAD-5; `main.ts:345` editor CM
access) and one guarded `stored as Record<string, unknown>` (`settings.ts:154`, behind a
`typeof === "object"` check). No `any`, no `@ts-ignore`, no unsafe non-null. **No finding.**

### Tooling

**P2-9 · `low` · `tsconfig` lacks `noUnusedLocals`/`noUnusedParameters`.**
`tsconfig.json` has only `strict: true`. Enabling these would catch unused
locals/imports automatically (it would not flag unused *exports* like `TaskStatus` —
tsc never does — but raises the floor).
*Fix:* add `"noUnusedLocals": true, "noUnusedParameters": true`.

### Test gaps

**P2-10 · `low` · Untested behaviors likely to regress.**
- No `defaultPriority` merge test (`tests/settings/settings.test.ts` — grep: 0 hits) → P2-1 went uncaught.
- No duplicate-tag decode test (`tests/obsidian/pluginDataAdapter.test.ts` covers
  missing→`[]` at line 171, but not dup-collapse) → P2-2 uncaught.
- No `updateTask` context/project dedupe test → P2-3 uncaught.
- `main.ts` orchestration (refresh, inject, nudge), `settingsTab.ts` UI glue: untested
  (expected for Obsidian-coupled code; flagged for completeness).
*Fix:* add the three pure-logic tests; they are cheap and pin P2-1/2/3.

### Minor (sub-low, noted not filed)

`parseEstimateMinutes` has no upper bound (`estimate.ts:10-33`): `"9999h"` stores
599940 minutes. Cosmetic.

---

## D. Re-examination of the 5 open items

| ID | Still applies? | Re-scope | Concrete fix |
|----|----------------|----------|--------------|
| **OPT-3** | **Yes** | Widened — see **P2-4**. Hot path is *every* `ViewUpdate` incl. selection changes, not just typing; `renderedBottom` walks all descendants of all `.cm-line`s. | Gate on `docChanged\|\|geometryChanged`; rAF-batch; measure last line only. |
| **SEC-3** | **Yes, narrowed** — see **P2-5**. Chips are HSL-safe; only `StatusConfig`/`PriorityConfig` `.color` are arbitrary. | Tighten to config colors. | `CSS.supports("color", v)` guard at merge + render; fallback `var(--text-muted)`. |
| **SEC-5** | **Yes** — **P2-6**. Real vector is *stored* tags (decode path doesn't re-split), not UI tags. | Same. | Quote/escape tag in the query. |
| **SEC-6** | **Yes** — **P2-7**. Impact bounded by `openLinkText` sandbox (no FS traversal). | Down to low. | Validate path → `TFile` markdown before open. |
| **DRY-6** | **Yes** | Confirmed: `dailyTasksWidgetController.ts:24` `getDailyNoteDateFromPath(notePath)` re-derives the date **folder-unaware**, duplicating `main.ts:127` `resolveDailyNoteDate`. No live bug (main gates folder upstream at `renderWidgetInto:127`), but the controller would mis-handle a daily-named note outside the folder if ever called directly. | Pass the already-resolved `date` into `getWidgetForNotePath`, or inject one folder-aware resolver. |

No new reason to disturb the **Won't-fix** (SEC-7, BAD-11) or **Roadmap-deferred**
(SEC-1, SEC-4, BAD-9) items. SEC-4's latent title-escaping hole is confirmed still
present (`dailyNoteFormatter.ts:15` interpolates `task.title` raw into the
`- [ ] … <!-- id -->` line) but the module remains unwired — leave as deferred.

---

## E. Reconciliation with Codex (second eye)

Codex ran the same four-scope pass independently (read-only, no build/test mutation).
Its full output is preserved verbatim in Appendix G. Reconciliation:

### Agreements (both eyes, reached independently)

1. **All 20 fixes verified** — no regression, no orphan. Codex marked **OPT-4 "Partial"**
   (the overdue-reuse claim is done, but `todayView.ts:43-50` still filters `tasks` once
   per status) — consistent with my note that residual passes remain. No conflict.
2. **`TaskStatus` (`core/task.ts:2`) is the only genuinely-dead symbol** — both passes
   independently grepped `src`+`tests` and found 0 references outside the declaration.
   Both name it the sole delete candidate. **High-confidence.**
3. **The unwired cluster is keep-not-defect.** Same membership
   (`createTaskForActiveNote`, the daily-notes parser/document/formatter/service slice,
   `formatRelativeDate`, `TASK_ID_INLINE_SOURCE`, `ApiEnvelope`, `isTaskId`). *Labeling
   differs* — I tag them **(d) unwired**, Codex tags them **(c) roadmap** — but the
   conclusion (roadmap scaffold, larger than BAD-9 enumerated, safe to keep) is identical.
4. **All 5 open items still apply, with identical re-scoping:** OPT-3 (steady-state
   synchronous re-measure), SEC-3 (status/priority colors only — chips are safe),
   SEC-5 (persisted tags are the real vector), SEC-6 (free-form paths), DRY-6
   (folder-blind controller). Our independent re-scopes match line-for-line.
5. **Load-path dedup gap** — my **P2-2** = Codex **NEW-2**. Both medium. Agreed.
6. **No HTML-injection surface** — both confirm zero `innerHTML`/`insertAdjacentHTML`.

### Codex-only — my verdict (verified, not rubber-stamped)

| Codex ID | Finding | My verdict |
|----------|---------|-----------|
| **NEW-1** (`critical`) | **Multi-project edit silently drops project links.** A task created with a configured *default project* **plus** a different typed project stores **two** `ProjectLink`s (`taskFactory.ts:78` `mergeUniqueProjects(defaults.projects, input.projects)`). The edit modal loads only `initial.projects[0]` (`taskCreationModal.ts:60`), submits at most one (`:268-270`), and `updateTask` replaces the array wholesale (`dayTaskService.ts:96`) — so on any later edit the user's chosen project is lost. | **VERIFIED REAL.** I reproduced the 2-project create path. Adopted as **P2-11**. I rate **high** rather than critical: silent data loss, but the trigger needs a non-empty `defaultProjectPath`. Codex's strongest catch — I missed it. |
| **NEW-3** (`low`) | **Invalid calendar dates accepted.** `dailyNoteDate.ts:3` matches `\d{4}-\d{2}-\d{2}` with no range check; `2026-13-45.md` is detected as a daily note and `formatMonthDay` renders `MONTHS[12]` → **"undefined 45"**; `toUtcDays` lets `Date.UTC` normalize the overflow. | **VERIFIED REAL** (reproduced "undefined 45"). Adopted as **P2-12**, low. I missed it. |
| **NEW-4** (`low`) | **`cm.dispatch` not feature-detected.** `main.ts:345-346` casts through `unknown` to `{editor.cm: EditorView}` and calls `cm?.dispatch({})`; optional chaining guards `cm` but not that `dispatch` is callable. | **VERIFIED (defensive).** Adopted as **P2-13**, low. Throw is theoretical (a real `EditorView` always has `dispatch`), but the unguarded private-shape cast is the same surface I flagged under type-safety. Worth the feature-detect. |

No Codex finding rejected — all three confirmed against source.

### Claude-only — Codex did not raise

| My ID | Finding | Note |
|-------|---------|------|
| **P2-1** (`low`) | "Default priority = —/none" silently reverts to "normal" on reload (`settings.ts:181-184`). | Real, verified. Codex missed it (no `defaultPriority` analysis). Cheap, high-signal fix. |
| **P2-3** (`low`) | `updateTask` dedupes only tags, not contexts/projects — diverges from the factory. | Real. Partially overlaps Codex NEW-2's "defensively dedupe inside `TaskIndex`"; mine is the *service-layer consistency* angle. |
| **P2-8** (`low`) | `refreshReadingViews` still iterates every markdown leaf (`main.ts:155-168`). | Real residual after OPT-2. Codex's NEW-4 touches the same method group from a different angle. |
| **P2-9** (`low`) | `tsconfig` lacks `noUnusedLocals`/`noUnusedParameters`. | Tooling hardening. |

No material disagreement anywhere — the two passes are complementary. Codex went deeper
on the **edit/create data-flow** (NEW-1) and **date validation** (NEW-3); I went deeper on
**settings persistence** (P2-1) and **tooling/test gaps**. Both nailed the same dead symbol,
the same fix verifications, and the same open-item re-scopes.

---

## F. Prioritized top 10 (this pass)

| # | ID | Sev | One-liner | Fix locus |
|---|----|-----|-----------|-----------|
| 1 | **P2-11** (Codex NEW-1) | **high** | Editing a multi-project task silently drops the user's project link. | `taskCreationModal.ts:60,268-270` + `dayTaskService.ts:96` — edit all projects, or preserve untouched links. **Add a 2-project edit test.** |
| 2 | **P2-4 / OPT-3** | medium | Live Preview re-measures all `.cm-line` descendants on *every* `ViewUpdate` (incl. cursor moves). | `livePreview.ts:64-67` — gate on `docChanged\|\|geometryChanged`, rAF-batch, measure last line only. |
| 3 | **P2-2 (Codex NEW-2)** | medium | Load/decode path doesn't dedupe or default-tag stored tags/contexts/projects → double-index. | `pluginDataAdapter.ts:97-106` — run `withDefaultTag`/`mergeUnique` on decode (or dedupe keys in `taskIndex.ts:94-112`). |
| 4 | **P2-1** | low | Cleared "Default priority" reverts to "normal" after restart. | `settings.ts:181-184` + `settingsTab.ts:127-130` — represent "none" explicitly. **Add merge test.** |
| 5 | **P2-5 / SEC-3** | low | Status/priority config colors written raw into CSS vars (chips are safe). | `widgetRenderer.ts:176,215` — `CSS.supports("color", v)` guard at merge + render. |
| 6 | **P2-6 / SEC-5** | low | Persisted tag interpolated into `tag:#${tag}` search query. | `main.ts:305` — quote/escape the tag. |
| 7 | **P2-7 / SEC-6** | low | Free-form project path passed to `openLinkText` unchecked. | `main.ts:298-302` — require a `TFile` `.md` before open/save. |
| 8 | **P2-12 (Codex NEW-3)** | low | `2026-13-45.md` detected as a daily note → "undefined 45". | `dailyNoteDate.ts:3` + `relativeDate.ts` — shared strict calendar-validating parser. |
| 9 | **DRY-6** | low | Controller re-derives the daily-note date folder-blind. | `dailyTasksWidgetController.ts:24` — pass the resolved `date` in. |
| 10 | **P2-3 + P2-13 + P2-9 + P2-10** | low | Cleanup cluster: update-path dedup consistency; `cm.dispatch` feature-detect; `noUnusedLocals`; **delete dead `TaskStatus`**; add the 3 pin-tests. | per finding above. |

**Quick wins** (≤ a few lines, no behavior risk): delete `TaskStatus` (`task.ts:2`);
add `noUnusedLocals`/`noUnusedParameters` to `tsconfig.json`; fold the new unwired rows
into BAD-9's inventory.

---

## H. Fix log (pass-2 fixes landed)

Top-5 sweep landed on `chore/code-audit-2026-06-25`, each test-first (repo TDD
convention). Build green, **158 tests** passing after the sweep (was 147).

| Date | ID | Commit | Note |
|------|----|--------|------|
| 2026-06-25 | P2-11 | `3b93c6b` | New pure `applyPrimaryProjectEdit(primaryPath, existing)` preserves a task's non-primary project links on edit (edited primary replaces the first, rest kept, deduped by path); modal routes its single project field through it. TDD: 4 cases in `tests/core/task.test.ts`. |
| 2026-06-25 | P2-2 | `8ace5dc` | `normalizeStoredTask` decode helpers now dedupe — `asStringArray` returns unique strings, `asProjects` dedupes by path — closing the load-path double-index gap BAD-2 left. Default tag intentionally **not** force-injected (preserves "missing arrays → []" contract). TDD: duplicate-collapse case in `tests/obsidian/pluginDataAdapter.test.ts`. |
| 2026-06-25 | OPT-3 | `1496be0` | `livePreview` `sync()` takes a `measureOffset` flag; `update()` passes `docChanged \|\| geometryChanged`, so selection-only updates skip the re-measure and the rest route through the existing rAF helper instead of running synchronously per `ViewUpdate`. Build-verified (CM glue). |
| 2026-06-25 | P2-1 | `52a8ccb` | Cleared "Default priority" now persists as `""` (round-trips) instead of `undefined` (dropped → silently restored to "normal"); factory truthy-guards priority so the `""` sentinel never lands an empty priority on a task. TDD: factory empty-priority case + `mergeSettings` round-trip pin. |
| 2026-06-25 | SEC-3 | `c2994ff` | New pure `safeCssColor(value, fallback)` gates status colors through `CSS.supports("color", …)` before they reach `--daytasks-status-color`, with a safe fallback; passes through when `CSS.supports` is absent. Applied at the task-card pill + legend-dot boundaries. TDD: 4 cases in `tests/util/cssColor.test.ts`. |
| 2026-06-25 | SEC-5 | `3d1cc01` | New pure `buildTagSearchQuery(tag)` reduces a persisted tag to valid tag characters before `tag:#<safe>`, blocking search-operator injection; `main.searchTag` routes through it. TDD: `tests/obsidian/globalSearch.test.ts`. |
| 2026-06-25 | SEC-6 | `3d1cc01` | New pure `resolvesToMarkdownNote(metadataCache, path)` resolves a project link as `openLinkText` would and requires a markdown destination; `main.openProject` shows a Notice and skips otherwise. TDD: `tests/obsidian/vaultNote.test.ts`. |

After this second batch the suite is at **164 tests**.

**Remaining from the top-10:** P2-12 invalid calendar dates (#8), DRY-6 (#9), and the #10
cleanup cluster (delete dead `TaskStatus`, `noUnusedLocals`, P2-3 update-path dedup
consistency, P2-13 `cm.dispatch` feature-detect, P2-8/P2-9, pin-tests). Of the pass-1 open
items, **only DRY-6 remains** — OPT-3, SEC-3, SEC-5, SEC-6 are all resolved.

---

## G. Appendix — Codex output (verbatim)

> Captured from the Codex rescue run (`task-mqthmanu-3h1gwd`, read-only). Reproduced
> unedited for traceability; reconciled in §E.

Codex confirmed all 20 fixes (OPT-4 "Partial" on residual per-status filtering), produced
a full per-symbol reachability table naming **`TaskStatus` as the sole delete candidate
(E)** and the daily-note/command/API cluster as roadmap (C), raised four fresh findings
**NEW-1** (critical — multi-project edit data loss), **NEW-2** (medium — load-path dedup,
= P2-2), **NEW-3** (low — invalid calendar dates), **NEW-4** (low — `cm.dispatch` feature
detection), confirmed no HTML-injection surface, and re-scoped all five open items
(OPT-3, SEC-3, SEC-5, SEC-6, DRY-6) identically to §D. Full table and per-finding evidence
are in the run log at
`~/.claude/plugins/data/codex-openai-codex/state/daytasks-3a0fd8ce422b8dc2/jobs/task-mqthmanu-3h1gwd.log`.
