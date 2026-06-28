# Refactor & Consolidation Map

Repeated patterns in `src/` and the minimal set of utilities that should exist to
remove them. Derived from
[issue-analysis/optimization-security-assessment-2026-06-28.md](../../issue-analysis/optimization-security-assessment-2026-06-28.md)
(findings DRY-7/8/9) and the prior [code-audit-2026-06-25](../../issue-analysis/code-audit-2026-06-25.md).

Ground rule (per AGENTS.md): consolidate **only** when it removes real duplication or
risk. Do not invent abstractions. The prior audit already extracted the obvious ones —
this map lists what genuinely remains, plus an explicit "do NOT consolidate" list so a
future pass doesn't churn already-shared code.

---

## Already consolidated (verified still single-source — do not re-extract)

| Utility | Single source | Confirmed call sites |
|---------|---------------|----------------------|
| `parseLabelList` | `src/util/parseLabelList.ts` | `settingsTab.ts:144`, `taskCreationModal.ts:555,558,578,579` — no rogue comma-splitters |
| `isRecord` | `src/util/isRecord.ts` | `settings.ts` (3×), `pluginDataAdapter.ts` (4×) — only inline `typeof==="object"` is inside `isRecord` itself |
| `noteBasename` / `MARKDOWN_EXTENSION_PATTERN` | `src/util/notePath.ts` | 8 files (taskCard, taskFilter, fuzzyPath, modals, taskListLeaf, taskCreationModal, detailNoteFrontmatter, dailyNoteDate) |
| `applyCompletion` | `src/core/dayTaskService.ts:346` | private, called 2× internally |
| `renderTaskCard` | `src/obsidian/widgetRenderer.ts:408` | `taskListRenderer.ts:254` + `widgetRenderer.ts:547` both delegate — **no** duplicate card builder (earlier hypothesis disproved) |
| `resolvesToMarkdownNote` / `addMarkdownPathPicker` | `main.ts:675` / `settingsTab.ts:161` | single definition each, used |
| `parseCalendarDate` | `src/util/calendarDate.ts` | daily-note detection + formatting (DRY-6/P2-12) |

---

## Proposed utilities (real remaining duplication)

### 1. `localDate(date: Date): string` — single `YYYY-MM-DD` assembler (DRY-7)

- **name:** `localDate` (in `src/util/localIso.ts`, alongside the existing `localIso`).
- **purpose:** Produce the local `YYYY-MM-DD` prefix from a `Date`, in one place. `localIso` reuses it for its date portion; `todayDate()` becomes `localDate(new Date())`, which also centralizes the lone `new Date()` impurity.
- **current duplicate call sites:**
  - `src/util/time.ts:9-12` — `getFullYear()/getMonth()+1/getDate()` + `padStart(2)`.
  - `src/util/localIso.ts:9-11` — the identical block.
- **migration order:** **1st** (smallest, fully pure, isolated).
- **risks:** R-low. Both functions already have tests; the only subtlety is keeping `localIso`'s time portion untouched.
- **tests needed:** extend `tests/util/localIso.test.ts` + `tests/util/time.test.ts` — assert `localDate(d) === localIso(d).slice(0,10)` across DST/TZ-sensitive dates and month-padding edges (`2026-01-05`).

### 2. `src/util/coerce.ts` — one coercion vocabulary (DRY-8)

- **name:** `coerce` module exporting `asStringOr(value, fallback)`, `asOptionalString(value)`, `asFiniteNumberOr(value, fallback)`, `asUniqueStringArray(value)`, `asStringArrayOr(value, fallback)`.
- **purpose:** Replace two same-named-but-different coercion toolkits. The danger today is silent semantic divergence: `settings.asStringArray` does **not** dedupe; `pluginDataAdapter.asStringArray` **does**. Explicit names make the dedupe contract visible per call site.
- **current duplicate call sites:**
  - `src/settings/settings.ts:78-95` — `asString(value, fallback)`, `asBoolean`, `asNumber`, `asStringArray` (no dedupe).
  - `src/obsidian/pluginDataAdapter.ts:37-59` — `asString(value): string|undefined`, `asFiniteNumber`, `asStringArray` (dedupes).
- **migration order:** **3rd** (after Phase 1 data-safety; touches the decoder and settings merge — both well-tested, change with care).
- **risks:** R-med. Must preserve each call site's exact behavior — map `settings`'s non-dedup array to `asStringArrayOr`, the adapter's to `asUniqueStringArray`; map the two `asString` overloads to `asStringOr` vs `asOptionalString`. A wrong mapping silently changes indexing/merge behavior.
- **tests needed:** new `tests/util/coerce.test.ts` (per-function, incl. dedupe vs non-dedupe, fallback paths, non-string/NaN inputs). Regression: `tests/settings/settings.test.ts` + `tests/obsidian/pluginDataAdapter.test.ts` must pass **unchanged**.

### 3. `stripTrailingSlashes(folder: string): string` — folder trailing-slash normalize (DRY-9)

- **name:** `stripTrailingSlashes` (in `src/util/notePath.ts`).
- **purpose:** One notion of "trim trailing slashes from a folder", shared by the two daily-note sites. Keep it distinct from `folderTemplate`'s heavier per-segment normalizer (different intent — do not merge those).
- **current duplicate call sites:**
  - `src/daily-notes/dailyNoteDate.ts:18` — `folder.replace(/\/+$/, "")`.
  - `src/daily-notes/dailyNoteDate.ts:31` — same.
- **migration order:** **2nd** (tiny, low-risk, no behavior change).
- **risks:** R-low. Do **not** retrofit daily-notes onto `resolveFolderTemplate`'s segment normalizer without confirming the daily-note folder is meant to allow interior `//`.
- **tests needed:** add cases to `tests/util/notePath.test.ts` (`"a/"`, `"a//"`, `"a"`, `""`); `tests/daily-notes/dailyNoteDate.test.ts` stays green.

---

## Cross-cutting: align the test fake with Obsidian (not a util, but a consolidation of test truth)

`FakeVaultPort` (`tests/detail-notes/detailNoteService.test.ts:34-57`) diverges from real
Obsidian: `create` silently overwrites (real `Vault.create` throws on exists),
`writeFrontmatter` no-ops on a missing file. This is why DATA-2 slips past green tests.
Fixing the fake to throw-on-exists is the single highest-leverage test change and it
gates the DATA-2 fix. If a second test file ever needs a vault fake, promote it to
`tests/fixtures/vaultPort.ts` (alongside the proposed `tests/fixtures/task.ts` from
TEST-7) rather than copying it.

---

## Explicitly DO NOT consolidate

| Candidate | Why not |
|-----------|---------|
| `renderTaskCard` across the two renderers | Already a single shared function; the renderers only differ in their `el()` host wiring. |
| `folderTemplate` segment-normalize vs daily-note trailing-slash | Different intent (full segment tidy vs trailing-only). Only the trailing-slash form is a true dup (DRY-9). |
| `isRecord` / `parseLabelList` / `noteBasename` | Single-source already; no remaining inline copies. |
| The two `asStringArray` into one dedup-always helper | Would silently change `settings`' non-dedup behavior. The fix is *named* variants (DRY-8), not a single merged function. |

---

## Migration sequence summary

1. `localDate` (DRY-7) — pure, isolated, do first.
2. `stripTrailingSlashes` (DRY-9) — tiny, low-risk.
3. `coerce.ts` (DRY-8) — after Phase 1 data-safety; preserve per-site dedupe contract.
4. Test-fake alignment + `tests/fixtures/task.ts` (TEST-2/TEST-7) — alongside the data-safety and test phases.

All four are behavior-preserving; each lands test-first with `npm run check` green
before and after.
