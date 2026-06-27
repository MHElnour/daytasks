# Detail notes — Implementation Plan (private, pre-approved)

> Execute via superpowers:subagent-driven-development. Steps use `- [ ]`. Spec: `docs/private/detail-notes-spec.md`.

**Goal:** Activate per-task detail notes — a markdown note with plugin-managed,
synced YAML frontmatter and the task's subtasks shown as an injected interactive
widget; create/open via a rail control + kebab, consistent across collapsed,
expanded, and the Task List view.

**Architecture:** Pure builders (frontmatter, subtask widget model) + a
`DetailNoteService` over a narrow `VaultPort` are Obsidian-free + unit-tested; the
host (`main.ts`) provides the vault port, wires create/open/sync, and extends the
existing `renderWidgetInto` injection path to render a subtask widget for detail
notes.

**Tech Stack:** TypeScript, Obsidian (`processFrontMatter`, vault, metadataCache,
ItemView/CM injection), vitest, esbuild, build-css.

## Global Constraints

- Pure layers (`src/core/*`, `src/ui/*`, `src/detail-notes/detailNoteFrontmatter.ts`) MUST NOT import from `obsidian`. Obsidian-only code lives in `src/detail-notes/detailNoteService.ts`'s port impl (the impl lives in `main.ts`), `src/obsidian/*` host glue, and `main.ts`.
- TDD: failing test → run → minimal impl → green → commit.
- `npm run check` (typecheck + tests) AND `npm run lint` green before each commit touching `src/` (lint is NOT in `check` — run it separately).
- Reuse, don't duplicate: the subtask widget reuses `createTaskCardViewModel`/`renderTaskCard`/`buildTaskForest`; the daily-note formatter (`formatDailyTaskLine`) is the reference for any checkbox formatting.
- Detail notes are FRONTMATTER-managed only; the note body is user-owned (never written by the plugin). Subtasks are shown via injection, not written to the file.
- Commit footer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Branch: `feat/detail-notes`. View/marker constants: frontmatter link key `taskId`; managed keys fixed in `MANAGED_FM_KEYS`.

---

### Task 1: Managed frontmatter builder (pure)

**Files:** Create `src/detail-notes/detailNoteFrontmatter.ts`, `src/util/localIso.ts`; Test `tests/detail-notes/detailNoteFrontmatter.test.ts`, `tests/util/localIso.test.ts`.

**Produces:**
- `localIso(date: Date): string` — ISO with ms + local UTC offset, e.g. `2026-06-27T18:18:47.717+03:00`.
- `MANAGED_FM_KEYS: readonly string[]` — the keys the plugin owns.
- `buildManagedFrontmatter(task: DayTask, dateCreated: string, dateModified: string): Record<string, unknown>` — the managed key/values, omitting empty optionals; `projects` → `["[[basename]]"]`.

- [ ] **Step 1 — failing tests** (`detailNoteFrontmatter.test.ts`): a fully-populated task yields keys in order `title,status,priority,scheduled,due,contexts,projects,estimate,parentId,taskId,taskCreated,dateCreated,dateModified,tags`; a minimal task omits `priority,due,contexts,projects,estimate,parentId`; `projects:[{path:"Projects/Welcome.md"}]` → `["[[Welcome]]"]`; `tags` includes `daytask`. `localIso.test.ts`: format matches `/^\d{4}-\d2-\d2T\d2:\d2:\d2\.\d3[+-]\d2:\d2$/` for a fixed `new Date(...)`.
- [ ] **Step 2 — run, expect fail** (`npx vitest run tests/detail-notes/detailNoteFrontmatter.test.ts`).
- [ ] **Step 3 — implement.** `localIso`: compute offset from `date.getTimezoneOffset()`, pad, build string (no Date.now globals — take a Date arg). `buildManagedFrontmatter`: assemble object; use `noteBasename` (`src/util/notePath.ts`) for project links; only add optional keys when present. `MANAGED_FM_KEYS` = the full key list.
- [ ] **Step 4 — run green.** `npm run check`.
- [ ] **Step 5 — commit** `feat(detail-notes): managed frontmatter builder + localIso`.

---

### Task 2: DetailNoteService (VaultPort + create + sync)

**Files:** Implement `src/detail-notes/detailNoteService.ts`; Test `tests/detail-notes/detailNoteService.test.ts`.

**Consumes:** `buildManagedFrontmatter`, `MANAGED_FM_KEYS`, `localIso` (Task 1).
**Produces:**
- `interface VaultPort { exists(path): boolean; ensureFolder(path): Promise<void>; create(path, content): Promise<void>; readFrontmatter(path): Record<string, unknown> | null; writeFrontmatter(path, mutate: (fm: Record<string, unknown>) => void): Promise<void>; }`
- `class DetailNoteService { constructor(port, now: () => Date) ; async create(task, folder): Promise<string> /* returns path */ ; async sync(task): Promise<void> }`
- `detailNoteFileName(task): string` and `sanitizeFileBase(title): string` (exported, pure, tested).

- [ ] **Step 1 — failing tests** with a `FakeVaultPort` (in-memory map of path→{frontmatter, body}). Assert: `create` ensures the folder, writes a file at `<folder>/<sanitized>-<id>.md` whose frontmatter equals `buildManagedFrontmatter(task, now, now)` and whose body is empty; returns the path. `sync` on an existing note updates managed keys + bumps `dateModified`, **preserves a non-managed key** the fake has (e.g. `myField: 1`), and **does not write** (port.writeFrontmatter not called / dateModified unchanged) when nothing managed changed (diff-guard). `sync` on a missing file is a no-op. `sanitizeFileBase` strips `\\/:*?"<>|` and trims.
- [ ] **Step 2 — run, expect fail.**
- [ ] **Step 3 — implement.** `create`: ensureFolder(dirname), build frontmatter (dateCreated=dateModified=localIso(now())), serialize a minimal file (`---\n<yaml>\n---\n`) and `port.create`. `sync`: if `!port.exists` return; read current fm; compute the managed values (keep existing `dateCreated`; new `dateModified`); compare managed keys (excluding dateModified) against current — if identical, return without writing; else `port.writeFrontmatter(path, fm => { set each managed key; set dateModified })`. Use `MANAGED_FM_KEYS` to know which keys to overwrite/clear.
- [ ] **Step 4 — green.** `npm run check`.
- [ ] **Step 5 — commit** `feat(detail-notes): DetailNoteService create + diff-guarded sync`.

---

### Task 3: `DayTaskService.setDetailNotePath`

**Files:** Modify `src/core/dayTaskService.ts`; Test the service test file.

**Produces:** `async setDetailNotePath(id: string, path: string | undefined): Promise<DayTask>` — sets/clears `detailNotePath`, stamps `updatedAt`, persists via the same `saveAndIndex` path the other mutators use.

- [ ] **Step 1 — failing test**: create a task, `setDetailNotePath(id, "X.md")` → `getTask(id).detailNotePath === "X.md"`; `setDetailNotePath(id, undefined)` clears it.
- [ ] **Step 2 — fail.** **Step 3 — implement** mirroring `setPriority` (load, spread, set, `updatedAt = this.now()`, `saveAndIndex`). **Step 4 — green** `npm run check`. **Step 5 — commit** `feat(service): setDetailNotePath`.

---

### Task 4: View-model `hasDetailNote` + renderer rail control

**Files:** Modify `src/ui/taskCard.ts`, `src/obsidian/widgetRenderer.ts`; Test `tests/ui/taskCard.test.ts`, `tests/obsidian/widgetRenderer.test.ts`.

**Produces:** `TaskCardViewModel.hasDetailNote: boolean`; `WidgetRenderHandlers.onOpenDetailNote?(taskId)`; a `.task-card__detail-note` button (icon `file-text`) appended in `renderRailTop` **before** the menu control, only when `card.hasDetailNote`.

- [ ] **Step 1 — failing tests.** taskCard: `hasDetailNote` true when `task.detailNotePath` set, false otherwise (note: this is a NEW required field → update the full-object `.toEqual` fixture + the renderer `filledModel`/`leafCard` fixtures with `hasDetailNote: false`). widgetRenderer: a card with `hasDetailNote:true` renders `.task-card__rail-top .task-card__detail-note`, and clicking it calls `onOpenDetailNote` with the id; a card with `hasDetailNote:false` has no `.task-card__detail-note`; the detail control is a previous sibling of `.task-card__menu`.
- [ ] **Step 2 — fail.**
- [ ] **Step 3 — implement.** taskCard: add `hasDetailNote: boolean;` to the interface and `hasDetailNote: task.detailNotePath !== undefined,` to the return. widgetRenderer: add `onOpenDetailNote?` to `WidgetRenderHandlers`; add `renderDetailNoteControl(card, handlers)` (button `.task-card__detail-note`, span icon `data-icon="file-text"`, `stop(event)` + `onOpenDetailNote?.(card.id)`); in `renderRailTop`, append it **before** `renderMenuControl` when `card.hasDetailNote`.
- [ ] **Step 4 — green** `npm run check`. **Step 5 — commit** `feat(detail-notes): hasDetailNote view-model + rail control`.

---

### Task 5: Subtask widget model (pure)

**Files:** Create `src/ui/subtaskWidget.ts`; Test `tests/ui/subtaskWidget.test.ts`.

**Consumes:** `createDailyTasksWidgetModel`-style building blocks (`buildTaskForest`, `createTaskCardViewModel`) — reuse `createDailyTasksWidgetModel` if it fits, else a thin wrapper.
**Produces:** `createSubtaskWidgetModel(parent: DayTask, statusManager, referenceDate, priorities, getChildren, expandedIds, collapsedIds, getById, getBlocking): DailyTasksWidgetModel` — a widget model whose `cards` are the parent's child forest (built from `getChildren(parent.id)` as the seed task set), `title` = "Subtasks", counts over the descendants.

- [ ] **Step 1 — failing test**: a parent with two children (one done) → model `cards.length === 2`, `title === "Subtasks"`, `doneCount === 1`; deeper nesting respected via `getChildren`.
- [ ] **Step 2 — fail.** **Step 3 — implement**: gather the parent's children via `getChildren(parent.id)`, feed them to `createDailyTasksWidgetModel(referenceDate, children, …, getChildren, …)` (children become roots since their parent isn't in the seed set), override `title` to "Subtasks". Confirm the existing model builder accepts this; otherwise replicate its `toCard` loop scoped to the children. **Step 4 — green** `npm run check`. **Step 5 — commit** `feat(detail-notes): subtask widget model`.

---

### Task 6: Host — create/open detail notes + kebab + settings un-reserve

**Files:** Modify `src/main.ts`, `src/settings/settings.ts`, `src/settings/settingsTab.ts`, `src/obsidian/taskCreationModal.ts` (if needed). Manual-tested.

**Consumes:** `DetailNoteService`, `VaultPort`, `setDetailNotePath`, `onOpenDetailNote`.

- [ ] **Step 1 — vault port impl + service.** In `main.ts` build a `VaultPort` over Obsidian: `exists` via `vault.getAbstractFileByPath`; `ensureFolder` via `vault.createFolder` (ignore "already exists"); `create` via `vault.create`; `readFrontmatter` via `metadataCache.getFileCache(file)?.frontmatter ?? null`; `writeFrontmatter` via `app.fileManager.processFrontMatter(file, mutate)`. Instantiate `this.detailNotes = new DetailNoteService(port, () => new Date())`.
- [ ] **Step 2 — create flow.** On task create when `input.detailNote` is true: after `service.createTask`, `const path = await this.detailNotes.create(task, this.settings.detailNotesFolder)`, `await this.service.setDetailNotePath(task.id, path)`, `await this.persistTasks()`, open it (`openLinkText(path,"",true)`), `refreshViews()`. Add a private `createDetailNote(taskId)` for the kebab path (resolve task, same steps; no-op if it already has one).
- [ ] **Step 3 — open + missing-file.** `openDetailNote(taskId)`: resolve `detailNotePath`; if the file doesn't exist → `Notice` + `setDetailNotePath(id, undefined)` + persist + refresh; else `openLinkText(path, "", true)`. Wire `onOpenDetailNote: (id) => this.openDetailNote(id)` into BOTH the daily-widget handlers and `taskListCardHandlers`.
- [ ] **Step 4 — kebab.** In `openTaskMenu`, after Edit/Delete add: if the task has `detailNotePath` → "Open detail note" (`openDetailNote`); else → "Create detail note" (`createDetailNote`). (This menu is shared by daily + list views → consistent.)
- [ ] **Step 5 — settings.** In `settingsTab.ts` drop the "Reserved…" descriptions for `detailNotesFolder` ("Folder where new detail notes are created") and `createDetailNoteByDefault` ("Turn on the create-detail-note toggle by default in the task modal"). No template setting.
- [ ] **Step 6 — verify.** `npm run check` + `npm run lint` green. Commit `feat(detail-notes): create/open + kebab + settings`.

---

### Task 7: Host — inject the subtask widget + debounced frontmatter sync

**Files:** Modify `src/main.ts` (`renderWidgetInto` + sync hook), and the LP/reading injectors only if the gate needs widening. Manual-tested.

- [ ] **Step 1 — detection in `renderWidgetInto(container, notePath)`.** Keep the daily-note branch first. Else: resolve the `TFile` for `notePath`, read `metadataCache.getFileCache(file)?.frontmatter?.taskId`; if a task with that id exists in the index, render the subtask widget: `const model = createSubtaskWidgetModel(task, this.statusManager, todayDate(), this.settings.priorities, id => this.service.getChildren(id), this.expandedIds, this.collapsedIds, id => this.service.getById(id) ?? undefined, id => this.service.byBlocker(id))`; `renderDailyTasksWidget(container, model, this.widgetOptions(), <the daily card handlers incl. onOpenDetailNote>)`; `applyIcons`; return true. Return false otherwise. (The LP extension + `injectReadingView` already call `renderWidgetInto` for the open note, so widening this method covers both paths — confirm no daily-note-only guard remains upstream that blocks detail notes.)
- [ ] **Step 2 — debounced sync.** Add `private readonly syncDetailNotes = debounce(() => void this.runDetailNoteSync(), 800)`. `runDetailNoteSync()`: for each `task` in `service.allTasks()` with a `detailNotePath`, `await this.detailNotes.sync(task)` (the service is diff-guarded, so unchanged notes aren't written). Call `this.syncDetailNotes()` at the end of `refreshViews()` (every task mutation already routes through `refreshViews`).
- [ ] **Step 3 — verify.** `npm run check` + `npm run lint` green. Commit `feat(detail-notes): inject subtask widget + debounced sync`.

---

### Task 8: Build + manual verification

- [ ] `npm run check && npm run lint` green; `npm run build:test`; reload (`obsidian command id=app:reload`).
- [ ] Verify with the `obsidian` CLI (dev:screenshot / dev:cdp / app:reload):
  - Create a task with the modal toggle on → a detail note opens with the managed frontmatter (all expected keys; omit-when-empty correct).
  - Kebab on a task with no note → "Create detail note" makes + opens one; rail `file-text` icon now shows (collapsed + expanded + Task List view); kebab now shows "Open detail note".
  - Open a detail note → an injected **Subtasks** widget renders the task's subtasks as interactive cards; cycling a subtask's status updates the real task and the daily/list views.
  - Edit the parent task (status/tags/add subtask) → the note's frontmatter re-syncs, `dateModified` bumps, the user's body text is preserved; no write when nothing changed.
  - Delete the note file → opening shows a notice and the card reverts to "Create detail note".
- [ ] Fix anything surfaced; final commit.

---

## Self-Review

- Spec coverage: managed frontmatter (T1) · service create/sync diff-guard + preserve body/keys (T2) · setDetailNotePath (T3) · hasDetailNote + rail control (T4) · subtask model (T5) · create/open/kebab/settings (T6) · injection + debounced sync (T7) · verify (T8). ✓
- Open items for the implementer: confirm `createDailyTasksWidgetModel` is reusable for T5 (else replicate the scoped loop); confirm `renderWidgetInto` is the only gate (no upstream daily-only check blocks detail notes in LP/reading); `processFrontMatter` is async — await it.
- Type consistency: `VaultPort`/`DetailNoteService` (T2) consumed in T6/T7; `hasDetailNote` (T4) consumed by the renderer; `onOpenDetailNote` (T4) wired in T6; `createSubtaskWidgetModel` (T5) consumed in T7; `setDetailNotePath` (T3) used in T6.
