---
id: optimization-security-assessment-2026-06-28
title: Optimization, Security & Maintainability Assessment 2026-06-28
type: audit
status: open
severity: high
opened: 2026-06-28
closed:
area: [core, obsidian, detail-notes, daily-notes, settings, ui, util, styles, api, docs, tests]
passes: 1
eyes: [claude-opus-4.8]
tests: { before: 370, after: 370 }
issues:
  open: [DATA-1, DATA-2, DATA-3, DATA-4, DATA-5, LIFE-1, LIFE-2, LIFE-3, LIFE-4,
    LIFE-5, A11Y-1, A11Y-2, A11Y-3, CSS-1, CSS-2, CSS-3, UX-1, MNT-1, DEAD-1,
    DEAD-2, DEAD-3, DEAD-4, DOC-1, DRY-7, DRY-8, DRY-9, TEST-1, TEST-2, TEST-3,
    TEST-4, TEST-5, TEST-6, TEST-7]
  carried: [SEC-4]
  closed: []
  partial: []
  wontfix: []
  deferred: []
resolution: >
  Assessment-only follow-up to code-audit-2026-06-25. Single Opus pass, six
  parallel evidence-gathering agents, top findings hand-verified against source.
  0 critical, 4 high, 13 medium, 17 low (+ SEC-4 carried). No code changed; build
  green (npm run check). Implementation tracked in
  docs/plans/optimization-security-roadmap.md.
---

# Optimization, Security & Maintainability Assessment 2026-06-28

Assessment-only audit of DayTasks at `0.8.0`, following the resolved two-pass
[code-audit-2026-06-25](code-audit-2026-06-25.md). That audit closed 35 findings
across `src/` (~3.4k LOC); this pass targets the **newer detail-notes code**
(0.7.0/0.8.0), the dimensions the prior audit deferred (popout, accessibility,
CSS theming, API scope), and fresh data-safety review of vault edit flows. No code
was modified.

`severity`: critical=data loss/exploit · high=crash / silent-wrong / keyboard
lockout · medium=degraded · low=polish. `confidence`: high=quoted code proves it ·
medium=strong evidence, one assumption · low=plausible, needs a runtime check.

## Executive summary

The codebase is in good shape — the prior audit's hardening holds (per-field
decode, dependency-cycle pruning, `processFrontMatter`, `FileManager.renameFile`,
contained private-API casts, `safeCssColor`, keyboard-operable chips). The
installed `eslint-plugin-obsidianmd@0.3.0` reports **zero violations**. This pass
found **no critical issues and no live security exploit**: `src/api/*` is still
empty stubs, so the deferred SEC-1 (API hardening) remains correctly parked, and
SEC-4 (daily-note line escaping) is still unreachable.

The real risk concentrates in three places:

1. **Detail-note vault edit flows** (the newest code) carry the highest
   data-safety exposure: a free-form folder path reaches `vault.create` /
   `createFolder` / `renameFile` with **no `normalizePath()` and no `..`
   stripping** (DATA-1); the create-collision fallback can throw and strand a task
   without its note (DATA-2); and `sync()` rewrites managed frontmatter at a stored
   path **without confirming the note still belongs to the task** (DATA-3). The
   one-shot migration that drives all of this (`migrateDetailNotes`, the riskiest
   logic in the repo) is asserted only in docstrings and **has no test** (TEST-1).

2. **Accessibility regressions** left the keyboard story half-finished: the entire
   Task List filter bar has **no focus-visible styling** (A11Y-1) and the
   chips made keyboard-operable by the prior audit's BAD-10 fix got operability
   but **no focus indicator** (A11Y-2) — both are keyboard-usability failures
   under any theme that suppresses the UA outline.

3. **Popout/lifecycle correctness** the linter cannot catch: Live Preview and
   reading-mode widgets build and measure DOM against the *active* window's
   document, not the *editor's own* document (LIFE-1); and `onunload` leaves a
   pending reading-refresh timer and two debounced saves un-flushed (LIFE-2).

Plus accumulated dead code (the daily-note slice, `src/api/*`, a now-duplicated
create-task command), CSS theme-bypass tints, and consolidation opportunities in
date and coercion helpers. None block release; all are small, verifiable tasks.

**Counts:** 0 critical · 4 high · 13 medium · 17 low (+1 carried). 34 new findings.

| Severity | IDs |
|----------|-----|
| High | DATA-1, A11Y-1, A11Y-2, TEST-1 |
| Medium | DATA-2, DATA-3, DATA-4, LIFE-1, LIFE-2, A11Y-3, CSS-1, DRY-7, DRY-8, TEST-2, TEST-3, TEST-4, TEST-5 |
| Low | SEC-4 (carried), DATA-5, LIFE-3, LIFE-4, LIFE-5, MNT-1, CSS-2, CSS-3, UX-1, DEAD-1, DEAD-2, DEAD-3, DEAD-4, DOC-1, DRY-9, TEST-6, TEST-7 |

---

## Findings (ordered by severity)

### High

#### DATA-1 — Detail-note folder path reaches the vault with no `normalizePath()` and no `..` stripping

- **severity:** high · **confidence:** high · **type:** security (path handling / data-safety)
- **affected:**
  - [src/detail-notes/folderTemplate.ts:27-31](../src/detail-notes/folderTemplate.ts#L27-L31) — `.split("/").map(trim).filter(len>0).join("/")` keeps `.` and `..` segments; verified `resolveFolderTemplate("../Outside", iso)` → `"../Outside"`.
  - [src/main.ts:75-108](../src/main.ts#L75-L108) — `VaultPort` wiring calls `this.app.vault.create(path, …)`, `createFolder(path)`, `fileManager.renameFile(file, to)` on the raw path.
  - [src/main.ts:506-508](../src/main.ts#L506-L508) — `detailNotesFolderFor` returns the template result verbatim.
  - [src/settings/settingsTab.ts](../src/settings/settingsTab.ts) — `detailNotesFolder` is stored with only `.trim()`.
  - `grep -rn "normalizePath" src` → **0 matches** (the Obsidian-recommended path normalizer is used nowhere).
- **why it matters:** `detailNotesFolder` is free-form user text. The filename is sanitized (`sanitizeFileBase`, detailNoteService.ts:51-53) but the **folder is not**. A value like `../Outside` or one with backslashes / leading-dot segments is concatenated with the filename and handed to vault write APIs. `isDesktopOnly:true` means a real filesystem honors `..` traversal, so a note can be written outside the intended tree. Obsidian requires `normalizePath()` on any user-derived vault path.
- **recommended fix:** Wrap every path in the `VaultPort` Obsidian wiring with Obsidian's `normalizePath()` before `create`/`createFolder`/`renameFile`, **and** drop `.`/`..` in `resolveFolderTemplate`'s existing segment filter (`seg !== "." && seg !== ".."`). Two small, layered guards.
- **verification plan:** Add `folderTemplate` tests: `resolveFolderTemplate("../x", iso)` and `"a/../../b"` must contain no `..`. Smoke: set `detailNotesFolder` to `../escape`, create a detail note, confirm it lands inside the vault. `npm test tests/detail-notes/folderTemplate.test.ts`.

#### A11Y-1 — Task List filter bar has zero focus-visible styling (keyboard users see no focus)

- **severity:** high · **confidence:** high · **type:** UX (accessibility)
- **affected:**
  - [styles/task-list-view.css](../styles/task-list-view.css) — `grep -n focus` → **0 matches** in the whole file.
  - Controls built in [src/obsidian/taskListRenderer.ts](../src/obsidian/taskListRenderer.ts): `__search` input (:161), `__facet-chip` (:71), `__facet-btn` (:100), `__facet-opt` (:132), `__facet-search` (:119), `__sortdir` (:199), `__clear` (:204), `__groupby`/`__sortby`/`__date` selects (:170,188,193), `__group-toggle` (:240).
- **why it matters:** These are native focusable `<button>`/`<input>`/`<select>`, but the plugin overrides their backgrounds/borders and provides no focus indicator. Many themes suppress the UA default outline, leaving keyboard users with **no visible focus across the entire filter bar** — the primary interaction surface of the Task List view. Focus styles were added for cards (`task-card.css`) but this view was missed.
- **recommended fix:** Add a focus-visible block mirroring the card pattern: `.daytasks-tasklist__facet-chip:focus-visible, …, .daytasks-tasklist__search:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: 2px; }`. Reuses the existing accent-outline idiom (`modal.css:96`, `task-card.css:669-674`).
- **verification plan:** `npm run build-css`; open the Task List view with a theme that hides UA outlines; Tab through every control and confirm a visible ring. No unit test (CSS-only) — covered by the manual smoke checklist.

#### A11Y-2 — Keyboard-activatable project/tag chips have no focus-visible style (BAD-10 left half-done)

- **severity:** high · **confidence:** high · **type:** UX (accessibility)
- **affected:**
  - [src/obsidian/widgetRenderer.ts:67-81](../src/obsidian/widgetRenderer.ts#L67-L81) — `makeActivatable` sets `role="button"`, `tabIndex=0`, Enter/Space handlers on project chips (:369) and tag chips (:382).
  - [styles/task-card.css](../styles/task-card.css) — `:hover` exists for `.task-card__project`/`.task-card__tag`; `grep` for their `:focus`/`:focus-visible` → **0 matches**.
- **why it matters:** The prior audit's BAD-10 made these chips reachable and activatable by keyboard, but without a focus ring a keyboard user cannot tell which chip is focused — the operability fix is visually incomplete. Only the mouse (`:hover`) state is styled.
- **recommended fix:** `.daytasks-plugin .task-card__project:focus-visible, .daytasks-plugin .task-card__tag:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: 2px; }`.
- **verification plan:** `npm run build-css`; Tab into a card with project/tag chips, confirm a visible ring, Enter activates. Manual smoke.

#### TEST-1 — `migrateDetailNotes` orchestration (partial-failure / flag-and-persist ordering) is untested

- **severity:** high (risk of the untested behavior) · **confidence:** high · **type:** test-coverage
- **affected:** [src/main.ts:810-830](../src/main.ts#L810-L830) — the one-time migration loop; `DetailNoteService.migrate` (the pure part) is covered (detailNoteService.test.ts:352-428) but the orchestration is not.
- **why it matters:** This is the riskiest untested logic in the repo and it runs on **every** `onLayoutReady` until `detailNotesMigrated` is set (main.ts:148-151). Its invariants — "link persisted immediately after each rename", "flag set only on a fully-clean pass", "a failed note is retried next load (idempotent)" — are asserted only in the docstring. A regression that sets the flag despite a thrown error, or persists the new path before the rename succeeds, would silently strand notes with no test to catch it.
- **recommended fix:** Extract the loop body into an injectable orchestrator (it already depends only on `service.allTasks()`, `detailNotes.migrate`, `updateDetailNoteLink`, `persistTasks`) and test: (1) renamed → link updated + flag set; (2) one task throws → flag NOT set, others still processed; (3) re-run after partial failure migrates only the previously-failed note; (4) already-migrated → zero calls.
- **verification plan:** New `tests/main/migrateDetailNotes.test.ts` driving a fake service whose `migrate` throws on a chosen id; assert flag state and `persistTasks` call counts. `npm test`.

### Medium

#### DATA-2 — Detail-note create-collision fallback is not `exists()`-guarded → `vault.create` can throw and strand the task

- **severity:** medium · **confidence:** high · **type:** security (data-safety)
- **affected:**
  - [src/detail-notes/detailNoteService.ts:89-94](../src/detail-notes/detailNoteService.ts#L89-L94) — the path is `preferred` when free, else the fallback `dir + base + "-" + task.id + ".md"`; `port.create(path, "")` is then called with **no** `exists()` check on that fallback.
  - [src/main.ts:87-89](../src/main.ts#L87-L89) — `create: async (path) => { await this.app.vault.create(path, …); }` — real `Vault.create` **throws** `"File already exists."` on an occupied path.
  - Masked by the test fake — see TEST-2.
- **why it matters:** If `<base>-<id>.md` already exists (a leftover from a prior failed run, or interaction with the legacy migration name), `vault.create` rejects. The reject is caught only by the generic handler at main.ts:495-498/519-522, leaving the user with a **created task but no note** and a vague Notice. The happy path is fine; the collision path is unhandled.
- **recommended fix:** Guard the fallback too (or loop a numeric suffix until `!exists()`), so a pre-existing fallback name disambiguates instead of throwing. Keep `vault.create` (correct API).
- **verification plan:** TEST-2 (pre-occupy both names, assert a fresh path, no throw).

#### DATA-3 — `sync()` / `migrate()` rewrite frontmatter at the stored path without confirming the note still belongs to the task

- **severity:** medium · **confidence:** medium · **type:** security (data-safety)
- **affected:**
  - [src/detail-notes/detailNoteService.ts:119-153](../src/detail-notes/detailNoteService.ts#L119-L153) — `sync` reads frontmatter at `task.detailNotePath` and writes managed keys back with no identity check.
  - [src/main.ts:213-220](../src/main.ts#L213-L220) — `detailNoteTask` already establishes the correct convention (`frontmatter.taskId === task.id`); `sync`/`migrate` don't reuse it. `taskId` is a managed key ([detailNoteFrontmatter.ts:17](../src/detail-notes/detailNoteFrontmatter.ts#L17)).
- **why it matters:** `detailNotePath` is trusted stored state. If the user replaced the file at that path with a different note, `sync` overwrites that unrelated note's managed frontmatter (status/scheduled/tags/…) and `migrate` could strip its `title`. Non-managed keys are preserved (good), but clobbering managed keys on a now-unrelated note is a silent wrong-write. (The reverse case — Obsidian renaming the note — is handled by FileManager link updates, but the plugin's stored string is not auto-updated.)
- **recommended fix:** In `sync` (and `migrate`), after `readFrontmatter`, bail when `current.taskId` is present and `!== task.id`. Cheap guard reusing the existing identity convention; does not weaken the diff-guard.
- **verification plan:** `sync` test where the note at `path` has `taskId: "other"`; assert `writeFrontmatter` is not called. `npm test tests/detail-notes/detailNoteService.test.ts`.

#### DATA-4 — `decodePluginData` silently drops malformed/legacy tasks; the next `save()` erases them with no warning

- **severity:** medium · **confidence:** high · **type:** security (data-safety / UX)
- **affected:**
  - [src/obsidian/pluginDataAdapter.ts:201-203](../src/obsidian/pluginDataAdapter.ts#L201-L203) — `Array.isArray(raw.tasks) ? raw.tasks.filter(isValidTask).map(normalizeStoredTask) : []`.
  - [src/obsidian/pluginDataAdapter.ts:18-31](../src/obsidian/pluginDataAdapter.ts#L18-L31) — `isValidTask` requires `Array.isArray(value.timeEntries)`; a legacy/hand-edited task missing it is dropped entirely.
  - [src/main.ts:178-186](../src/main.ts#L178-L186) — `loadPluginData` Notices only on a total parse throw, not on partial filtering.
- **why it matters:** Per-field decoding is otherwise excellent, but a task with one missing required field is silently discarded on load; the next `persistTasks` serializes only the survivors → the dropped task is **permanently erased from `data.json` with no warning**. For a tasks plugin, silent loss of a task is a data-integrity concern. (Conditional on already-malformed/legacy data, hence medium not high.)
- **recommended fix:** Have `decodePluginData` report the count of dropped entries; in `loadPluginData` emit a `Notice` / `console.warn` when `raw.tasks.length > decoded.tasks.length` so a save doesn't quietly finalize the loss. Do **not** loosen `isValidTask`.
- **verification plan:** Unit-test `decodePluginData({ tasks: [validTask, { id: "x" }] })` → 1 task + a signalled drop count. `npm test`.

#### LIFE-1 — Live Preview & reading-mode widgets build/measure DOM against the active window, not the editor's own document

- **severity:** medium · **confidence:** high · **type:** maintainability (popout correctness)
- **affected:**
  - [src/obsidian/livePreview.ts:80](../src/obsidian/livePreview.ts#L80) — `const wrapper = activeDocument.createElement("div");`
  - [src/obsidian/livePreview.ts:102](../src/obsidian/livePreview.ts#L102) — `window.requestAnimationFrame(() => { … applyBottomOffset … })`.
  - [src/main.ts:322](../src/main.ts#L322) — reading-mode injector: `const host = activeDocument.createElement("div");`.
- **why it matters:** A CM6 ViewPlugin (and a reading-mode `MarkdownView`) own their own document, which in a **popout window or detached split** differs from `activeDocument`/`window` (these track the *focused* leaf). Creating the node in document A and inserting it into document B's `.cm-sizer`, then scheduling the offset rAF on the wrong window's frame clock, is fragile and mis-measures the bottom-gap trim in popouts. The `eslint-plugin-obsidianmd` allow-lists `activeDocument` and *requires* `window.*` timers, so this is **lint-clean yet still wrong** — `widgetInsertion.ts:57` already shows the correct pattern (`widget.ownerDocument.defaultView ?? window`).
- **recommended fix:** Derive document/window from the editor: `view.dom.ownerDocument` in livePreview, `view.containerEl.ownerDocument` in the reading injector, and `(ownerDoc.defaultView ?? window).requestAnimationFrame(...)`. Prefer `createDiv`/`createEl` on the resolved parent (see MNT-1).
- **verification plan:** Open a daily note in a popped-out window with the widget on; confirm it renders there and the bottom trim is correct; repeat in a vertical split. `npm run build:test` + `obsidian … dev:errors`.

#### LIFE-2 — `onunload` leaves a pending reading-refresh timer and two debounced saves un-flushed

- **severity:** medium · **confidence:** high · **type:** maintainability (data-safety)
- **affected:**
  - [src/main.ts:154-156](../src/main.ts#L154-L156) — `onunload()` only calls `destroyReorder()`.
  - [src/main.ts:57-58](../src/main.ts#L57-L58) — `saveTaskListState` (debounce 400 ms) and `syncDetailNotes` (debounce 800 ms).
  - [src/main.ts:277-285](../src/main.ts#L277-L285) — `readingRefreshTimer` is a bare `window.setTimeout`, never cleared on unload.
- **why it matters:** On plugin disable/reload, a pending `readingRefreshTimer` can fire ~100 ms later into a **torn-down plugin** (`refreshReadingViews` on dead state). A debounced Task-List-state save or detail-note frontmatter sync in flight is **dropped** — the user's last view-state tweak (filters, expanded rows) and a pending managed-frontmatter write are lost on a quick reload.
- **recommended fix:** In `onunload`: `if (this.readingRefreshTimer !== null) window.clearTimeout(this.readingRefreshTimer);` and flush the debounced fns (add a `.flush()` to the `debounce` util, or call `void this.saveSettings()` / `void this.runDetailNoteSync()` directly). The `debounce` util is already unit-tested, so adding `flush` is cheap.
- **verification plan:** Unit-test a `debounce(fn).flush()` runs the pending call immediately and cancels the timer. Smoke: change a filter, immediately disable the plugin, re-enable, confirm state persisted. `npm test tests/util/debounce.test.ts`.

#### A11Y-3 — Group-toggle button is icon-only with no `aria-label`

- **severity:** medium · **confidence:** high · **type:** UX (accessibility)
- **affected:** [src/obsidian/taskListRenderer.ts:240-245](../src/obsidian/taskListRenderer.ts#L240-L245) — `const toggle = el("button", "daytasks-tasklist__group-toggle");` sets only `aria-expanded` + a chevron icon span; no accessible name.
- **why it matters:** Icon-only buttons must carry an accessible name. A screen reader announces "button, collapsed" with no purpose. Every other icon-only control in `widgetRenderer.ts` sets `aria-label`; this one was missed.
- **recommended fix:** `toggle.setAttribute("aria-label", group.collapsed ? \`Expand ${group.label}\` : \`Collapse ${group.label}\`);` matching `renderCollapseControl` (widgetRenderer.ts:200).
- **verification plan:** Inspect the rendered button / run axe over the Task List view; confirm an accessible name. Could add a `taskListRenderer.test.ts` assertion on the attribute.

#### CSS-1 — Hardcoded warm-hex tints blended into every panel/border bypass dark/high-contrast themes

- **severity:** medium · **confidence:** medium · **type:** maintainability (theming)
- **affected:**
  - [styles/variables.css:28](../styles/variables.css#L28) — `--daytasks-panel-bg: color-mix(in srgb, var(--background-primary) 96%, #f0dfc7 4%);`
  - [styles/variables.css:31](../styles/variables.css#L31) — `--daytasks-soft-border: color-mix(in srgb, var(--background-modifier-border) 82%, #d2ad7c 18%);`
- **why it matters:** Obsidian rule 34 prefers theme variables over hardcoded colors. These warm-paper tints are blended into every panel/row/border surface, so under dark or high-contrast themes the plugin injects a fixed beige bias the theme cannot override — a subtle theme-bypass across most surfaces.
- **recommended fix:** Replace the raw hex with a theme token (e.g. `var(--color-yellow)`) or expose a single documented, overridable `--daytasks-accent-tint` instead of inlining the hex.
- **verification plan:** `npm run build-css`; switch light/dark/high-contrast; confirm panels follow the theme.

#### DRY-7 — `YYYY-MM-DD` assembly duplicated between `time.ts` and `localIso.ts`

- **severity:** medium · **confidence:** high · **type:** maintainability
- **affected:** [src/util/time.ts:9-12](../src/util/time.ts#L9-L12) and [src/util/localIso.ts:9-11](../src/util/localIso.ts#L9-L11) — both do the identical `getFullYear()/getMonth()+1/getDate()` + `padStart(2)` dance.
- **why it matters:** Two places to fix any date-edge bug (month padding, locale). `todayDate()` re-implements the prefix `localIso` already produces and also holds the one extra `new Date()` impurity.
- **recommended fix:** Add `localDate(date: Date): string` in `localIso.ts`; have `localIso` reuse it for its date portion and `todayDate()` become `localDate(new Date())`. See [refactor-consolidation-map.md](../docs/plans/refactor-consolidation-map.md).
- **verification plan:** Extend `localIso.test.ts` + `time.test.ts`: `localDate(d) === localIso(d).slice(0,10)` across TZ-sensitive dates. `npm test`.

#### DRY-8 — Two divergent coercion toolkits (`settings.ts` vs `pluginDataAdapter.ts`) with a dedupe-vs-not trap

- **severity:** medium · **confidence:** high · **type:** maintainability
- **affected:** [src/settings/settings.ts:78-95](../src/settings/settings.ts#L78-L95) (`asString`/`asBoolean`/`asNumber`/`asStringArray`) vs [src/obsidian/pluginDataAdapter.ts:37-59](../src/obsidian/pluginDataAdapter.ts#L37-L59) (`asString`/`asFiniteNumber`/`asStringArray`). Same names, **different semantics**: settings' `asString(value, fallback)` vs adapter's `asString(value): string|undefined`; adapter's `asStringArray` **dedupes**, settings' does not.
- **why it matters:** Two coercion vocabularies for one job invite copy-paste drift; the dedupe divergence is a latent bug magnet (a dev reusing the "wrong" one silently changes behavior).
- **recommended fix:** Extract `src/util/coerce.ts` with explicitly named variants (`asStringOr`, `asOptionalString`, `asFiniteNumberOr`, `asUniqueStringArray`, `asStringArrayOr`); migrate both files so the dedupe contract is explicit per call site. See [refactor-consolidation-map.md](../docs/plans/refactor-consolidation-map.md).
- **verification plan:** New `tests/util/coerce.test.ts`; `settings.test.ts` + `pluginDataAdapter.test.ts` stay green unchanged. `npm test`.

#### TEST-2 — Create-collision fallback untested, and `FakeVaultPort.create` doesn't model Obsidian's throw-on-exists

- **severity:** medium · **confidence:** high · **type:** test-coverage
- **affected:** [tests/detail-notes/detailNoteService.test.ts:34-37](../tests/detail-notes/detailNoteService.test.ts#L34-L37) (`create` blindly `set`s → silent overwrite) and :167-173 (only the single-collision case). The fake is more permissive than real `vault.create` (which throws), so DATA-2's gap is invisible in green tests.
- **why it matters:** The suite green-lights overwrite semantics the real API rejects. Aligning the fake is the single highest-leverage change — it surfaces both DATA-2 and validates DATA-1.
- **recommended fix:** Make `FakeVaultPort.create` throw when `files.has(path)`; add a test pre-occupying both `<title>.md` and `<title>-<id>.md`, asserting `create` resolves to a fresh path and never throws.
- **verification plan:** Patch fake → the missing case turns red → add the guard (DATA-2) → green. `npm test tests/detail-notes/detailNoteService.test.ts`.

#### TEST-3 — `parseDailyTaskLine` has no rejection / adversarial-input coverage

- **severity:** medium · **confidence:** high · **type:** test-coverage
- **affected:** [src/daily-notes/dailyNoteParser.ts:13-24](../src/daily-notes/dailyNoteParser.ts#L13-L24) — only happy-path round-trips are exercised (dailyNoteFormatter.test.ts). No non-matching lines, no titles containing `<!--`.
- **why it matters:** Cheap insurance before this slice is ever wired (see DEAD-2 / SEC-4). A title with an embedded `<!-- … -->`, `[X]` casing, indentation, or multiple comments could mis-parse id/title. Note: the chain is currently dead, so this is a *future-proofing* gap, not a live bug.
- **recommended fix:** `tests/daily-notes/dailyNoteParser.test.ts`: non-checkbox → null; missing id comment → null; `[X]` → completed; title with embedded `<!-- not-an-id -->`; trailing whitespace; leading indentation.
- **verification plan:** `npm test tests/daily-notes/dailyNoteParser.test.ts`.

#### TEST-4 — Settings status-config repair branches under-tested

- **severity:** medium · **confidence:** medium · **type:** test-coverage
- **affected:** [src/settings/settings.ts:120-145](../src/settings/settings.ts#L120-L145) (`asStatuses` runs `StatusManager(...).validate().valid`) and :188-193 (`defaultStatus` fallback to `statuses[0].value`).
- **why it matters:** Corrupt/legacy settings hit this on every load. The branch where stored statuses pass `isStatusConfig` but fail semantic validation (dup values, bad `nextStatus`) silently falls back to defaults — a user with a slightly-broken custom config loses all customization with no test asserting the boundary.
- **recommended fix:** Add cases: (1) duplicate `value` → defaults; (2) zero completed statuses → defaults; (3) `defaultStatus` and `open` both absent → `statuses[0].value`; (4) valid custom statuses survive unchanged.
- **verification plan:** `npm test tests/settings/settings.test.ts`.

#### TEST-5 — `loadPluginData` throwing-port recovery is untested

- **severity:** medium · **confidence:** high · **type:** test-coverage
- **affected:** [tests/obsidian/pluginDataAdapter.test.ts:231-260](../tests/obsidian/pluginDataAdapter.test.ts#L231-L260) tests shapes but never a `loadData()` that rejects; the recovery lives in [src/main.ts:178-186](../src/main.ts#L178-L186) (Notice + defaults) and has no test.
- **why it matters:** "Started with defaults" is a user-facing data-safety guarantee for a corrupt `data.json` / IO error — currently unverified.
- **recommended fix:** `DayTasksDataStore` test with a port whose `loadData` rejects; assert `load()` propagates so `main` catches. Optionally extract `loadPluginData`'s fallback to test the shape directly.
- **verification plan:** `npm test`.

### Low

#### SEC-4 (carried) — Daily-note formatter interpolates raw `task.title`/`id` into markdown

- **severity:** low today (would be high if wired) · **confidence:** high · **type:** security
- **affected:** [src/daily-notes/dailyNoteFormatter.ts:15](../src/daily-notes/dailyNoteFormatter.ts#L15) — `` return `- [${checkbox}] ${task.title} <!-- ${task.id} -->`; `` (no escaping). `upsertDailyTaskLine` matches sections by the raw `<!-- ${id} -->` comment (dailyNoteDocument.ts:42).
- **why it matters:** A title with `\n` or `<!-- … -->` could break the round-trip or collide with the id marker. **Mitigating fact:** the whole daily-note write chain is unreachable at 0.8.0 (see DEAD-2) — the live path injects a DOM widget, not `## Tasks` lines. So this stays the prior audit's deferred item, carried forward, not re-opened.
- **recommended fix:** Keep deferred; when activating the slice, strip newlines + `<!--`/`-->` from the title before interpolation and gate behind a test (TEST-3).
- **verification plan:** Covered by TEST-3 once the slice is wired.

#### DATA-5 — Stored `sortOrder` and optional strings are type-coerced but not format-validated

- **severity:** low · **confidence:** medium · **type:** maintainability
- **affected:** [src/obsidian/pluginDataAdapter.ts:126-141](../src/obsidian/pluginDataAdapter.ts#L126-L141) — `sortOrder` is in `optionalStrings`; any string is accepted verbatim.
- **why it matters:** A corrupt non-numeric `sortOrder` survives decode and can perturb ordering. Self-authored data, so low.
- **recommended fix:** If numeric-string, validate format (or store as number via `asFiniteNumber`); otherwise document it as opaque.
- **verification plan:** Decode test with `sortOrder: "abc"`; assert chosen policy.

#### LIFE-3 — SortableJS handles on a Live-Preview list linger until the next reattach/unload

- **severity:** low · **confidence:** medium · **type:** maintainability
- **affected:** [src/main.ts:386-413](../src/main.ts#L386-L413) (`attachDrag` prunes by `isConnected`; `destroyReorder` runs on refresh/unload); [src/obsidian/livePreview.ts](../src/obsidian/livePreview.ts) `destroy()` removes the widget DOM but doesn't notify the host.
- **why it matters:** Closing a widget-bearing editor leaf **without a data change** fires no `refreshViews`, so the corresponding `Sortable` (+ its mousedown/touchstart listeners) lingers on a detached `.cm-sizer` until the next unrelated reattach. Bounded (cleaned at next data change or unload), not a permanent leak.
- **recommended fix:** Have the Live Preview widget's `destroy()`/`remove()` call a host hook that drops reorder handles whose `listEl` is inside the removed widget; or move SortableJS attachment into the ViewPlugin so its `destroy()` owns teardown.
- **verification plan:** Drag-reorder on a daily note, close the leaf without editing, heap-snapshot for a retained `Sortable` + listeners on the detached sizer.

#### LIFE-4 — Modal focus `window.setTimeout(…, 0)` is untracked and fires after teardown

- **severity:** low · **confidence:** medium · **type:** maintainability
- **affected:** [src/obsidian/taskCreationModal.ts:185](../src/obsidian/taskCreationModal.ts#L185) — `window.setTimeout(() => titleInput.focus(), 0);` (no handle).
- **why it matters:** If the modal closes (Esc) within the tick, the callback runs `focus()` on a detached input. Harmless in practice but an untracked timer firing after `onClose`'s `contentEl.empty()`.
- **recommended fix:** Store the handle and `window.clearTimeout` it in `onClose`.
- **verification plan:** Open the create modal, immediately Esc; confirm no error and (with a breakpoint) the timer is cleared.

#### LIFE-5 — `TaskListView` has no `onClose()` (hygiene only)

- **severity:** low · **confidence:** high · **type:** maintainability
- **affected:** [src/obsidian/taskListLeaf.ts:53](../src/obsidian/taskListLeaf.ts#L53) — `onOpen` exists, no `onClose`. (Verified: `attachDrag` is never called for this view, so it owns no timers/Sortable — not a leak.)
- **why it matters:** Best practice is an `onClose` that empties `contentEl`. Purely cosmetic; no functional bug.
- **recommended fix:** `async onClose() { this.contentEl.empty(); }`.
- **verification plan:** Open/close/reopen the leaf; confirm fresh state.

#### MNT-1 — `activeDocument.createElement` instead of Obsidian `createEl`/`createDiv` helpers (rule 35)

- **severity:** low · **confidence:** high · **type:** maintainability
- **affected:** [src/obsidian/livePreview.ts:80](../src/obsidian/livePreview.ts#L80), [src/obsidian/widgetRenderer.ts:38](../src/obsidian/widgetRenderer.ts#L38), [src/obsidian/taskListRenderer.ts:39](../src/obsidian/taskListRenderer.ts#L39), [src/main.ts:322](../src/main.ts#L322). (Lint stays silent because two sites pass a *variable* tag the autofix can't rewrite, and the recommended config has `prefer-create-el` relaxed.)
- **why it matters:** Bypasses Obsidian's DOM helpers and re-introduces the document-drift of LIFE-1. Same root cause; fixing LIFE-1 should fix this.
- **recommended fix:** Thread the owner document/parent through and use `parent.createEl(tag, { cls, text })` / `ownerDoc.createEl(...)`.
- **verification plan:** Temporarily set `obsidianmd/prefer-create-el: error`; confirm the sites light up, then that `createEl` versions render identically (renderer unit tests cover DOM shape).

#### CSS-2 — Raw hex fallbacks (`#ff0000`/`#00aa00`/`#b26a00`) on success/error/estimate colors

- **severity:** low · **confidence:** high · **type:** maintainability (theming)
- **affected:** [styles/variables.css:26-27](../styles/variables.css#L26-L27) and [styles/task-card.css:233](../styles/task-card.css#L233).
- **why it matters:** Only a *fallback* after the theme var, but the harsh non-theme hex surfaces if a theme omits `--color-red/green`. Minor rule-34 nit.
- **recommended fix:** Use guaranteed semantic vars as fallbacks: `var(--color-green, var(--text-success))`, `var(--text-error)`.
- **verification plan:** `npm run build-css`; confirm under a theme that defines only `--text-error/success`.

#### CSS-3 — Three `!important` declarations on relation chips

- **severity:** low · **confidence:** high · **type:** maintainability (theming)
- **affected:** [styles/task-card.css:489-491](../styles/task-card.css#L489-L491) — `border/background/box-shadow: none !important;` (the only 3 `!important` in `styles/`).
- **why it matters:** Rule 34a discourages `!important`; here it defensively strips theme `button` styling. Works, but brittle and flagged by the community reviewer.
- **recommended fix:** Raise specificity (`.daytasks-plugin .task-card .task-card__rel-chip { … }`) instead of `!important`.
- **verification plan:** Remove `!important`, raise specificity; confirm rel chips stay flat under a theme that styles `button` (e.g. Minimal).

#### UX-1 — Settings heading "API (inactive)" mixes casing and surfaces out-of-scope API

- **severity:** low · **confidence:** medium · **type:** UX (settings)
- **affected:** [src/settings/settingsTab.ts:193](../src/settings/settingsTab.ts#L193) — `.setName("API (inactive)").setHeading();`. (Positive: the tab uses `.setHeading()` throughout, sentence case elsewhere, no redundant "General"/plugin-name heading.)
- **why it matters:** The "(inactive)" parenthetical is non-standard for a heading (rules 11/17), and it advertises the deferred API surface (see DEAD-1) in the UI.
- **recommended fix:** Drop the heading entirely while the API is out of scope, or rename to `API` and move "reserved" into the per-setting `.setDesc` (already present at :197).
- **verification plan:** Open settings; confirm consistent sentence-case headings.

#### DEAD-1 — `src/api/*` are empty `export {}` stubs that contradict the documented scope boundary

- **severity:** low · **confidence:** high · **type:** maintainability
- **affected:** [src/api/apiServer.ts:3](../src/api/apiServer.ts#L3), [apiAuth.ts:3](../src/api/apiAuth.ts#L3), [taskRoutes.ts:3](../src/api/taskRoutes.ts#L3), [timeRoutes.ts:3](../src/api/timeRoutes.ts#L3), [types.ts:1](../src/api/types.ts#L1). `grep -rn "api/" src tests` → 0 importers; `grep -c apiServer main.js` → 0 (not bundled).
- **why it matters:** `AGENTS.md:5-7,117` defers API scope until the Obsidian plugin is complete. The stubs carry no logic (so **no** live security surface — SEC-1 stays correctly deferred), but they are the seed of premature/insecure expansion and add typecheck noise.
- **recommended fix:** Delete `src/api/` (and its architecture.md line) until a milestone activates API work — OR keep as an explicit roadmap marker. Zero-risk either way; do not harden empty files.
- **verification plan:** `git rm -r src/api && npm run check` stays green; `grep -rn "api/" src tests` confirms no broken importers.

#### DEAD-2 — Daily-note slice is dead code (155 LOC, 9 dead/test-only exports, 12 tests on unreachable code)

- **severity:** low · **confidence:** high · **type:** maintainability
- **affected:** `src/daily-notes/dailyNoteDocument.ts` (53 LOC), `dailyNoteFormatter.ts` (16), `dailyNoteParser.ts` (24), `dailyNoteService.ts` (4), `src/commands/openTodayCommand.ts` (3, `export {}`). Live daily-note code is only `dailyNoteDate.ts` (`dailyNotePathForDate`, `resolveDailyNoteDate`, imported main.ts:13). Tests: dailyNoteDocument.test.ts (3), dailyNoteFormatter.test.ts (2) exercise unreachable functions.
- **why it matters:** Prior audit's BAD-9 ("unwired roadmap scaffold, keep") remains valid, but the dead surface inflates the green-suite signal and carries SEC-4. Decide per milestone: keep as scaffold or delete with its tests.
- **recommended fix:** Either delete the slice + its tests, or formally re-affirm BAD-9 in `architecture.md` (see DOC-1). If deleting, `npm test` count drops by ~5–12 with no live-path regression.
- **verification plan:** `grep -rn "upsertDailyTaskLine\|formatDailyTaskLine\|parseDailyTaskLine\|DailyNotePort" src` → only self + tests; after deletion `npm run check` green.

#### DEAD-3 — `createTaskCommand.ts` is test-only AND superseded by a divergent inline implementation

- **severity:** low · **confidence:** high · **type:** maintainability
- **affected:** [src/commands/createTaskCommand.ts:20](../src/commands/createTaskCommand.ts#L20) (`createTaskForActiveNote`, only imported by its test) vs the live duplicate [src/main.ts:451-462](../src/main.ts#L451-L462) (`runCreateTaskCommand`). Both implement "resolve active daily-note date → notify if not a daily note → create".
- **why it matters:** Two copies of one flow drift independently; 7 passing tests give false confidence that the *shipped* command path is covered when they test an unreachable function.
- **recommended fix:** Either delete `createTaskCommand.ts` + its test (smallest), or refactor `runCreateTaskCommand` to call `createTaskForActiveNote` and retarget the tests at the live path.
- **verification plan:** After deletion `grep -rn createTaskForActiveNote src` → 0; `npm run check` + `npm run build` green.

#### DEAD-4 — `formatRelativeDate` is exported and tested but has no `src` caller

- **severity:** low · **confidence:** high · **type:** maintainability (test-coverage)
- **affected:** [src/util/relativeDate.ts:27-38](../src/util/relativeDate.ts#L27-L38) — only the test references it; `formatMonthDay`/`isOverdue` from the same file are used.
- **why it matters:** Test coverage on dead code is false confidence and maintenance surface.
- **recommended fix:** Remove `formatRelativeDate` + its test, or wire it where intended.
- **verification plan:** Delete → `npm run check` green.

#### DOC-1 — `architecture.md` "Stubs And Deferred Areas" is stale and misleading

- **severity:** low · **confidence:** high · **type:** maintainability (docs)
- **affected:** [docs/development/architecture.md:91-100](../docs/development/architecture.md#L91-L100) — lists `src/detail-notes/detailNoteService.ts` as a stub, but it shipped and is wired in 0.7.0 (main.ts:11,48,109). It omits the genuinely-dead daily-note slice + `createTaskCommand.ts`.
- **why it matters:** Future cleanup may delete a live dependency (`detailNoteService`) or skip auditing it, and under-counts the real dead code.
- **recommended fix:** Remove `detailNoteService.ts` from the stub list; add the daily-note doc/formatter/parser/service modules + `createTaskCommand.ts` (or mark them BAD-9 dead pending deletion).
- **verification plan:** Doc-only; cross-check each listed "stub" with `grep -rn "<module>" src/main.ts` → 0 live importers.

#### DRY-9 — Folder trailing-slash normalization duplicated in `dailyNoteDate.ts`

- **severity:** low · **confidence:** high · **type:** maintainability
- **affected:** [src/daily-notes/dailyNoteDate.ts:18](../src/daily-notes/dailyNoteDate.ts#L18) and :31 both do `folder.replace(/\/+$/, "")`; `folderTemplate.ts:27-31` does a richer segment normalize. Two notions of "normalize a folder".
- **why it matters:** Minor divergence (`"a//b/"` normalizes differently across subsystems).
- **recommended fix:** Extract `stripTrailingSlashes(folder)` in `util/notePath.ts`; use at both sites. Do **not** force daily-notes onto the heavier `folderTemplate` normalizer without confirming intent.
- **verification plan:** Add to `notePath.test.ts`; `dailyNoteDate.test.ts` stays green.

#### TEST-6 — `withBlockedStatus` is untested

- **severity:** low · **confidence:** high · **type:** test-coverage
- **affected:** `src/core/status.ts` — `withBlockedStatus` guarantees the reserved blocked status is always present and replaces colliders; no direct test.
- **why it matters:** It is invoked on every `rebuildServices` (main.ts:160); a regression silently drops or duplicates the reserved status.
- **recommended fix:** 2-case test: collision-replace, append-when-absent.
- **verification plan:** `npm test tests/core/`.

#### TEST-7 — Shared task fixture duplicated across test files

- **severity:** low · **confidence:** high · **type:** test-coverage (maintainability)
- **affected:** `baseTask`/`validTask` literals redefined in detailNoteService.test.ts:71-82, pluginDataAdapter.test.ts:10-21, dailyNoteFormatter.test.ts:5-16, each slightly different.
- **why it matters:** Fixture drift multiplies edits when `DayTask` shape changes and creates inconsistent cross-module assumptions.
- **recommended fix:** `tests/fixtures/task.ts` exporting `makeTask(overrides?: Partial<DayTask>): DayTask`; migrate the call sites.
- **verification plan:** `npm test` stays green after refactor.

---

## Verified clean (do not re-investigate)

- **Linter:** `eslint-plugin-obsidianmd@0.3.0` reports zero violations across `src/`.
- **Frontmatter writes** use `processFrontMatter` (correct); managed-vs-unmanaged keys preserve user keys (detailNoteService.ts:97-103,143-153).
- **File moves** use `FileManager.renameFile` (link-preserving), not raw `Vault.rename`.
- **Migration ordering** is safe: link persisted immediately per rename, flag set only on a fully-clean pass, idempotent retry — and the clean-name collision *is* guarded by `exists(cleanPath)` before each sequential awaited rename (detailNoteService.ts:188), so two-tasks-same-name does **not** clobber. Residual risk is test coverage (TEST-1), not correctness.
- **Decoder** (`pluginDataAdapter.ts`): per-field coercion, tag/context/project dedupe, self-parent prune, dependency cycle/unknown-edge pruning — addresses prior BAD-1/SEC-2/P2-2.
- **`getAbstractFileByPath` + `instanceof`** guards everywhere; no `getFiles().find` anti-pattern; no `fetch()`; no `innerHTML`/`insertAdjacentHTML`; no `:has()` in CSS; no `detachLeavesOfType` in `onunload`; no stored view refs.
- **Build/release scripts** use `execFileSync(cmd, args[])` (no shell interpolation), strict semver validation, clean-tree + tag-at-HEAD guards. esbuild externals correct.
- **Private-API casts** (`globalSearch.ts:40` internalPlugins, `main.ts:842` `cm.dispatch`) are contained and feature-detected.
- **`safeCssColor`** (SEC-3) gates every theme color via `CSS.supports`; **BAD-10** chips are `role=button`+`tabindex`+Enter/Space operable (the gap is only their focus *style*, A11Y-2).
- **Touch targets** <44px exist (20–26px) but acceptable given `isDesktopOnly:true`.

## Methodology

Single Claude Opus 4.8 pass. Six parallel evidence-gathering agents partitioned by
cluster (data-safety/storage · daily-note slice/reachability · lifecycle/popout ·
a11y/CSS/settings · API-scope/build · tests/duplication). Every high/medium finding
was re-read and hand-verified against source by the lead before inclusion; one agent
over-claim (migrate clean-name clobber) was caught and downgraded to TEST-1. No code
was modified. `npm run check` green at assessment time.
