# DayTasks Architecture

DayTasks is a small Obsidian plugin built around a store-first model.

Daily notes are the user workspace. The plugin data store is canonical.
DayTasks does not write a `## Tasks` section into daily notes for the active
workflow; it injects an inline widget at the bottom of daily notes and renders
stored tasks for that date.

## Design Goals

- Keep the Obsidian experience useful before adding external surfaces.
- Keep domain logic testable without Obsidian.
- Keep Obsidian APIs behind small adapters.
- Keep task IDs stable and generated as `TSK-xxxxxxxx`.
- Avoid fake UI: visible controls should either work or stay hidden.

## Main Flow

```text
Obsidian plugin lifecycle
  -> load settings and persisted tasks
  -> rebuild MemoryTaskStore and MemoryTaskIndex
  -> detect daily-note date
  -> build DailyTasksWidgetModel
  -> render note widget
```

Task mutations follow the same shape:

```text
modal/card action
  -> DayTaskService
  -> TaskStore save/delete
  -> TaskIndex upsert/remove
  -> plugin saveData
  -> widget refresh
```

Detail-note mutations add one more boundary:

```text
task action
  -> DetailNoteService
  -> VaultPort
  -> Obsidian vault / FileManager APIs
  -> task.detailNotePath update
  -> plugin saveData
```

## Module Boundaries

### `src/core/`

Owns task data and domain rules:

- `task.ts` - task model and shared input/update types.
- `taskFactory.ts` - creation normalization and defaults.
- `dayTaskService.ts` - create, update, delete, status changes, indexing.
- `taskIndex.ts` - in-memory lookup by ID/date/status/parent/tag/context/project.
- `subtasks.ts` - parent/child forest and progress helpers.
- `dependencies.ts` - dependency graph checks and blocked-status reconciliation.
- `statusManager.ts` - configurable status behavior.

Core modules should not call Obsidian APIs or touch DOM.

### `src/obsidian/`

Owns Obsidian-specific integration:

- plugin data load/save adapter;
- Live Preview widget extension;
- reading-mode widget injection;
- project picker and project-link opening;
- global search integration;
- modal wiring.

Keep casts to private Obsidian surfaces contained in adapter modules.

Obsidian-facing modules should use the editor/view owner document for DOM work
so widgets behave correctly in split panes and popped-out windows.

### `src/ui/`

Owns view-model assembly for renderers:

- `taskCard.ts` turns a `DayTask` into card display data.
- `todayView.ts` builds the daily widget model and status summary.
- `dailyTasksWidgetController.ts` maps dates/paths to widget models.
- `taskListModel.ts` builds the all-tasks view model.
- `subtaskWidget.ts` builds the detail-note subtasks widget.

UI modules should not persist data.

### `src/detail-notes/`

Owns optional Markdown detail notes:

- `detailNoteService.ts` creates, syncs, and migrates notes through a narrow
  `VaultPort`.
- `detailNoteFrontmatter.ts` builds the managed frontmatter contract.
- `folderTemplate.ts` resolves date-based folder templates safely.
- `migrateDetailNotes.ts` coordinates the one-time legacy-note migration.

Detail-note code should preserve note bodies and non-managed frontmatter keys.

### `src/settings/`

Owns defaults, merge/validation, and the settings tab.

Settings are currently English-only and private-project scoped. There is no i18n
system in DayTasks.

### `styles/`

Source CSS lives here and is concatenated into `styles.css` by
`npm run build-css`.

Edit source files under `styles/`, not only the generated `styles.css`.

### Stubs And Deferred Areas

One module remains a roadmap placeholder:

- `src/obsidian/vaultAdapter.ts` - an `export {}` stub for a future vault file
  adapter.

Treat it as deferred unless a milestone explicitly activates it. API and
browser-extension work are not part of the current Obsidian-completion goal.

The former `src/api/*` stubs, the unwired daily-note write slice
(`dailyNoteDocument`/`Formatter`/`Parser`/`Service`), `openTodayCommand`, and the
duplicate `createTaskCommand` were removed in the 2026-06-28 cleanup.
`src/detail-notes/detailNoteService.ts` shipped in 0.7.0 and is no longer a stub.

Do not add scaffold modules unless the current milestone is ready to wire and
test them. If a placeholder remains after a milestone, either document why or
delete it.

## Data Model Summary

Each task has:

- generated `id`;
- `title`;
- configurable `status`;
- `scheduledDate`;
- optional `dueDate`, `priority`, `estimateMinutes`, `description`;
- optional `parentId` and `detailNotePath`;
- arrays for `tags`, `contexts`, `projects`, and `timeEntries`;
- timestamps for `createdAt`, `updatedAt`, and optional `completedAt`.

Arrays should be normalized to empty arrays, not `undefined`.

## Consolidation Rules

Prefer a shared helper only when it removes real duplication or prevents a
known class of bug. Current examples:

- `parseLabelList` owns comma-list parsing for settings and modals.
- `noteBasename` and path helpers live in `src/util/notePath.ts`.
- `localDate` and `localIso` own local date formatting.
- `src/util/coerce.ts` owns named coercion helpers; use the deduping and
  non-deduping array helpers intentionally.
- `safeCssColor` validates theme/user colors before they reach CSS properties.

Avoid abstractions that only hide one call site or change behavior silently.
