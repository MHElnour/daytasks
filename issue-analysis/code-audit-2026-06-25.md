---
id: code-audit-2026-06-25
title: Code Audit 2026-06-25
type: audit
status: partial
severity: medium
opened: 2026-06-25
closed:
area: [core, obsidian, settings, ui, util, daily-notes]
passes: 2
eyes: [claude-opus-4.8, codex]
tests: { before: 142, after: 171 }
issues:
  closed: [OPT-1, OPT-2, OPT-3, OPT-4, OPT-5, OPT-6, SEC-2, SEC-3, SEC-5, SEC-6,
    DRY-1, DRY-2, DRY-3, DRY-4, DRY-5, DRY-6, BAD-1, BAD-2, BAD-3, BAD-4, BAD-5,
    BAD-6, BAD-7, BAD-8, BAD-10, P2-1, P2-2, P2-3, P2-8, P2-9, P2-11, P2-12,
    P2-13, dead-TaskStatus]
  open: []
  partial: [P2-10]
  wontfix: [SEC-7, BAD-11]
  deferred: [SEC-1, SEC-4, BAD-9]
resolution: >
  Two-pass Claude+Codex audit. 34 findings fixed, 2 won't-fix, 3 roadmap-deferred,
  0 open + 1 partial (test coverage of Obsidian glue). Build green; 142 -> 171 tests.
---

# Code Audit 2026-06-25

Two-pass review of DayTasks (`src/`, ~3.4k LOC). Pass 1: Claude + Codex four-axis
sweep (Optimization · Security · DRY · Bad patterns), 30 findings. Pass 2: deeper
Claude + Codex re-pass — verified the fixes, swept dead code, found fresh bugs.
All fixes landed test-first. `npm run check` green.

`severity`: critical=data loss/exploit · high=crash/silent wrong · medium=degraded · low=polish.
Pass-2 aliases re-scope a pass-1 item: P2-4=OPT-3, P2-5=SEC-3, P2-6=SEC-5, P2-7=SEC-6.

## Open · partial (actionable)

All defect findings are fixed. One ongoing item remains:

| ID | Sev | Area | Issue | Next |
|----|-----|------|-------|------|
| P2-10 | low | testing | `partial` — pure-logic fixes pinned; `main.ts`/settings-tab glue still uncovered. | Keep adding pure-helper tests; verify glue via `build:test` + Obsidian CLI. |

## Won't-fix · deferred (by design)

| ID | Disp | Reason |
|----|------|--------|
| SEC-7 | wontfix | `Math.random` task ids: 62^8 space; `save()` is an intentional upsert. |
| BAD-11 | wontfix | `statusIcon` is intentional plumbing (4 tests); `widgetPosition` a harmless placeholder. |
| SEC-1 | deferred | API token/port hardening — API server is a stub; revisit when it ships. |
| SEC-4 | deferred | Daily-note line escaping — module unwired; revisit on note-body sync. |
| BAD-9 | deferred | Implemented-but-unwired roadmap scaffold (see Dead code). Delete per milestone. |

## Findings by axis (fixed)

### Optimization
| ID | Sev | Issue → fix | Commit |
|----|-----|-------------|--------|
| OPT-1 | med | Per-keystroke settings save rebuilt services + persisted all tasks → debounce 400 ms, flush on hide. | `77235a9` |
| OPT-2 | med | `refreshViews` dispatched an empty CM txn into every leaf → nudge only daily-note editors. | `7fc6c6c` |
| OPT-3 | med | `applyBottomOffset` re-measured all `.cm-line` every ViewUpdate (incl. cursor) → gate on `docChanged\|\|geometryChanged` + rAF. | `1496be0` |
| OPT-4 | low | Multiple passes over tasks for counts → reuse `cards`. | `dad2a87` |
| OPT-5 | low | Path picker rescanned the vault per keystroke → cache for modal lifetime. | `bdaff16` |
| OPT-6 | low | `getStatusesByOrder` re-sorted each call → precompute in ctor. | `dad2a87` |

### Security
| ID | Sev | Issue → fix | Commit |
|----|-----|-------------|--------|
| SEC-2 | low | Stored optional fields trusted after partial validation → per-field decoder. | `0d78b6b` |
| SEC-3 | low | Status colors written raw into CSS vars → gate via `CSS.supports` + fallback. | `c2994ff` |
| SEC-5 | low | Persisted tag interpolated into `tag:#${tag}` search → sanitize to tag chars. | `3d1cc01` |
| SEC-6 | low | Free-form project path opened unchecked → require a resolved markdown note. | `3d1cc01` |

### Consolidation / DRY
| ID | Sev | Issue → fix | Commit |
|----|-----|-------------|--------|
| DRY-1 | med | Two divergent token splitters → shared `parseLabelList`. | `a9f1b10` |
| DRY-2 | med | Completion-timestamp logic duplicated → `applyCompletion`. | `a9f1b10` |
| DRY-3 | low | Unused `util/clone.ts` → deleted. | `dad2a87` |
| DRY-4 | low | `isRecord` + md-regex → hoisted to shared utils. | `dad2a87` |
| DRY-5 | low | Duplicated project-picker wiring → `addMarkdownPathPicker`. | `a9f1b10` |
| DRY-6 | low | Controller re-derived the daily-note date folder-blind → pass resolved date in. | `f0607fd` |

### Bad patterns
| ID | Sev | Issue → fix | Commit |
|----|-----|-------------|--------|
| BAD-1 | med | Blanket `as unknown as DayTask` cast → full per-field decoder. | `0d78b6b` |
| BAD-2 | med | `withDefaultTag` kept dups → index double-listed → Set-based dedupe. | `8f26ae9` |
| BAD-3 | med | `StatusManager.validate()` never run at merge → wire it, fall back. | `d439c65` |
| BAD-4 | med | Settings saves swallowed rejections → guarded `saveSettingsWithNotice`. | `82e084a` |
| BAD-5 | med | `internalPlugins` reached via unsafe cast → contain in typed adapter. | `8730da3` |
| BAD-6 | med | Daily-note completion hardcoded `=== "done"` → drive by `isCompletedStatus`. | `01da302` |
| BAD-7 | low | `openProject` fire-and-forgot `openLinkText` → add `.catch`. | `dad2a87` |
| BAD-8 | low | `updateTask` reused `CreateDayTaskInput` → `UpdateDayTaskInput` (full-replace). | `ff26811` |
| BAD-10 | low | Chips not keyboard-operable → `makeActivatable` (role/tabindex/Enter-Space). | `f6b9567` |

### Pass-2 fresh
| ID | Sev | Issue → fix | Commit |
|----|-----|-------------|--------|
| P2-11 | high | Multi-project edit dropped all but the first link → `applyPrimaryProjectEdit` preserves the rest. | `3b93c6b` |
| P2-2 | med | Decode/load path didn't dedupe tags/contexts/projects → double-index → dedupe on decode. | `8ace5dc` |
| P2-1 | low | Cleared "Default priority" reverted to "normal" → persist "" + factory truthy-guard. | `52a8ccb` |
| P2-3 | low | `updateTask` deduped only tags → reuse factory `mergeUnique*` for contexts/projects. | `bcdd300` |
| P2-8 | low | Reading refresh scanned every markdown leaf → skip non-preview leaves first. | `2065632` |
| P2-9 | low | `tsconfig` lacked unused-symbol checks → enabled `noUnusedLocals/Parameters`; tsc clean. | `d0863dd` |
| P2-12 | low | `2026-13-45.md` accepted as a daily note ("undefined 45") → shared `parseCalendarDate` (leap-aware range check) in detection + formatting. | `afd3092` |
| P2-13 | low | `cm.dispatch` called via a private cast with no feature detection → guard `typeof cm.dispatch === "function"`. | `3817e91` |

## Dead code · reachability

Swept all 98 `src/` exports. The one genuinely dead symbol, `TaskStatus`, was
**deleted** (`8b04939`). Everything else is reachable, an `export {}` stub
(`api/*`, `detailNoteService`, `vaultAdapter`, `openTodayCommand` — keep), or **unwired
roadmap scaffold** (BAD-9 — keep): `createTaskForActiveNote`, `formatRelativeDate`,
`getCompletionToggleTarget`, `isTaskId`, `TASK_ID_INLINE_SOURCE`, the daily-note slice
(`dailyNoteParser`/`Document`/`Formatter`/`Service`), `ApiEnvelope`. No HTML-injection
surface (no `innerHTML`/`insertAdjacentHTML`). Type-safety clean (strict; casts contained).

## Claude × Codex reconciliation

Both eyes, independently: all prior fixes verified; `TaskStatus` the sole dead symbol;
identical re-scope of every open item. Codex-only catches (verified, adopted): P2-11
(data loss), P2-12 (calendar dates), P2-13 (`cm.dispatch`). Claude-only: P2-1, P2-3, P2-8,
P2-9. No disagreement — complementary coverage. Codex raw output in git run log
`task-mqthmanu-3h1gwd`.

## Fix log (commit → IDs)

`8f26ae9` BAD-2 · `77235a9` OPT-1 · `d439c65` BAD-3 · `0d78b6b` BAD-1/SEC-2 ·
`01da302` BAD-6 · `a9f1b10` DRY-1/2/5 · `dad2a87` OPT-4/6,DRY-3/4,BAD-7 · `8730da3` BAD-5 ·
`82e084a` BAD-4 · `ff26811` BAD-8 · `f6b9567` BAD-10 · `bdaff16` OPT-5 · `7fc6c6c` OPT-2 ·
`3b93c6b` P2-11 · `8ace5dc` P2-2 · `1496be0` OPT-3 · `52a8ccb` P2-1 · `c2994ff` SEC-3 ·
`3d1cc01` SEC-5/6 · `bcdd300` P2-3 · `f0607fd` DRY-6 · `2065632` P2-8 · `d0863dd` P2-9 ·
`afd3092` P2-12 · `3817e91` P2-13 · `8b04939` dead-TaskStatus.
