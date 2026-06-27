# Task List View — filterable, grouped task panel

**Date:** 2026-06-27
**Branch:** `feat/task-list-view`
**Status:** Approved design — ready for implementation plan

## Goal

Add a dedicated view that shows **all** DayTasks tasks across days (not just one
daily note), with filtering, switchable grouping, and sorting. It opens as a main
editor tab via a ribbon icon and a command, and reuses the existing task-card UI.

## Why a custom view (not Obsidian Bases)

Obsidian Bases queries vault **notes** by their frontmatter properties. DayTasks
stores tasks as records in `data.json` (mirrored to daily-note checkbox lines),
not as one-note-per-task, so Bases cannot query them. A custom `ItemView` that
reads from `DayTaskService` is the idiomatic fit and reuses the data model and
card renderer already in place.

## Scope

In:

- A main-tab `ItemView` (`TaskListView`) launched by a ribbon icon + command.
- Filter bar: status (multi), date preset, tag / context / project (multi),
  free-text search.
- Switchable grouping (Status default · Scheduled date · Project) into
  collapsible sections.
- Sorting (Scheduled · Due · Priority · Created · Title; default Scheduled asc).
- Reuse of the shipped card UI: each task is a collapsed card, expandable.
- Live updates when tasks change; filter/sort/group state persisted in settings.

Out (non-goals for v1):

- Drag-to-reorder inside this view (order is sort-driven).
- Saved / named filter presets.
- Parent/child nesting inside this view (the list is flat; the daily widget
  keeps its nesting).
- Per-group sort overrides; calendar / kanban layouts.

## Background — reused building blocks

- `DayTaskService`: `allTasks()`, plus `getTasksForDate/Tag/Context/Project`,
  `getChildren`, `byBlocker`, and the mutators (`setStatus`, `cycleStatus`,
  `setPriority`, `updateTask`, `deleteTask`).
- `MemoryTaskIndex`: `all/byId/byDate/byParent/byTag/byContext/byProject/byBlocker`.
- `StatusManager` + `PriorityConfig[]`: status/priority values, labels, colours,
  completed/blocked checks.
- `src/ui/taskCard.ts` `createTaskCardViewModel(...)` — builds a card view-model.
- `src/obsidian/widgetRenderer.ts` — `renderTaskCard`, `WidgetRenderOptions`,
  `WidgetRenderHandlers` (currently `renderTaskCard` is module-internal; this
  work exports it for reuse).
- `main.ts` host already wires card handlers (`onCycleStatus`, `onCyclePriority`,
  `onEditTask`, `onOpenProject`, `onSelectTag`, `onToggleSubtasks`,
  `onOpenTask`, `onToggleCollapsed`, `onOpenMenu`) and a `version()` change
  signal used by the daily widget.

## Design

### A. State

```ts
export interface TaskListState {
	statuses: string[];        // empty = all
	datePreset: "all" | "today" | "overdue" | "next7";
	tags: string[];            // empty = all
	contexts: string[];        // empty = all
	projects: string[];        // empty = all (project note path)
	search: string;            // matches title + description, case-insensitive
	groupBy: "status" | "scheduled" | "project";
	sortBy: "scheduled" | "due" | "priority" | "created" | "title";
	sortDir: "asc" | "desc";
}
```

A `DEFAULT_TASK_LIST_STATE` constant: all filters empty, `datePreset: "all"`,
`groupBy: "status"`, `sortBy: "scheduled"`, `sortDir: "asc"`. The state is stored
in `DayTasksSettings.taskListState` and saved on every change so it survives a
reload.

### B. Pure filter / group / sort — `src/core/taskFilter.ts`

- `filterTasks(tasks, state, referenceDate, isCompleted): DayTask[]`
  - status: keep if `state.statuses` empty or includes `task.status`.
  - datePreset against `task.scheduledDate` (and `dueDate` for overdue):
    `all` → keep; `today` → scheduled == referenceDate; `overdue` →
    `isOverdue(dueDate, referenceDate, isCompleted(status))`; `next7` →
    scheduled in `[referenceDate, referenceDate+6]`.
  - tags/contexts/projects: keep if the corresponding filter array is empty or
    intersects the task's tags/contexts/project-paths.
  - search: empty, or case-insensitive substring in title or description.
- `sortTasks(tasks, sortBy, dir, priorities): DayTask[]` — stable compare; missing
  values sort last; priority uses the configured order in `priorities`.
- `groupTasks(tasks, groupBy, statusManager): { key, label, tasks }[]`
  - status: one group per status value present, ordered by `getStatusesByOrder`.
  - scheduled: group by `scheduledDate`, ordered ascending; label via
    `formatMonthDay` (today/overdue surfaced by the sort, not special-cased).
  - project: one group per distinct project path (label = basename); tasks with
    no project go to an "(No project)" group last.

These are pure and unit-tested; they take `referenceDate`/`isCompleted`/
`statusManager`/`priorities` as arguments (no globals).

### C. View model — `src/ui/taskListModel.ts`

`createTaskListModel(tasks, statusManager, referenceDate, priorities, state, expandedCardIds, collapsedGroupKeys): TaskListModel` where

```ts
interface TaskListGroup { key: string; label: string; count: number; cards: TaskCardViewModel[]; collapsed: boolean; }
interface TaskListModel { groups: TaskListGroup[]; total: number; empty: boolean; state: TaskListState; }
```

It runs `filterTasks` → `sortTasks` → `groupTasks`, then maps each task to a
`createTaskCardViewModel(...)` with **`children: []`** (flat list — no nesting)
and `collapsed: !expandedCardIds.has(task.id)` (collapsed by default,
expandable). A group's `collapsed` is `collapsedGroupKeys.has(group.key)`. The
view owns both sets: `expandedCardIds` (cards the user opened) and
`collapsedGroupKeys` (sections the user collapsed).

### D. Renderer — `src/obsidian/taskListRenderer.ts` (pure DOM)

`renderTaskListView(parent, model, options, handlers, listHandlers): HTMLElement`:

- **Filter bar** (`.daytasks-tasklist__filterbar`): status multiselect chips,
  date-preset segmented control, tag/context/project multiselect dropdowns, a
  search input, a Group-by select, a Sort select + direction toggle, and a
  Clear-filters button. Each control calls a `listHandlers` callback
  (`onSetStatuses`, `onSetDatePreset`, `onSetTags`, …, `onSetGroupBy`,
  `onSetSort`, `onClear`).
- **Groups**: for each group a header (`.daytasks-tasklist__group-head`: collapse
  chevron · label · count) and a card list. Each card via the reused
  `renderTaskCard(card, options, handlers)`. Group header chevron calls
  `onToggleGroup(key)`.
- **Empty state** when `model.empty`.

Pure DOM (no `obsidian` import); icons are `data-icon` placeholders filled by the
host, same pattern as the widget.

### E. Host `ItemView` — `src/obsidian/taskListLeaf.ts`

`class TaskListView extends ItemView` (`VIEW_TYPE_TASK_LIST = "daytasks-task-list"`):

- `getViewType`/`getDisplayText`/`getIcon` ("list-checks").
- Holds `collapsedIds`, `expandedIds` (card collapse) and `collapsedGroupKeys`.
- `render()`: build model from `service.allTasks()` + persisted state, call
  `renderTaskListView` with the **same card handlers** the daily widget uses
  (delegated from the plugin) plus `listHandlers` that mutate state, persist it,
  and re-render.
- `applyIcons` reuses the plugin's `setIcon` post-pass.
- Subscribes to the plugin change signal so edits/creates/completes re-render.

### F. Plugin wiring — `main.ts`

- `registerView(VIEW_TYPE_TASK_LIST, leaf => new TaskListView(leaf, host))`.
- `addRibbonIcon("list-checks", "DayTasks: task list", () => openTaskList())`.
- `addCommand({ id: "open-task-list", name: "Open task list", callback })`.
- `openTaskList()` reveals an existing leaf or opens a new main-tab leaf of the
  view type (`getLeaf(true).setViewState({ type: VIEW_TYPE_TASK_LIST })`).
- Extend `DayTasksSettings` with `taskListState: TaskListState` (defaulted via
  `mergeSettings`); the view reads/writes it through host methods.
- Register the view in the existing refresh path so `refreshViews()` re-renders
  open task-list leaves too.

## Files

- Create: `src/core/taskFilter.ts`, `src/ui/taskListModel.ts`,
  `src/obsidian/taskListRenderer.ts`, `src/obsidian/taskListLeaf.ts`.
- Modify: `src/obsidian/widgetRenderer.ts` (export `renderTaskCard`),
  `src/settings/settings.ts` (add `taskListState` + default/merge), `src/main.ts`
  (registerView, ribbon, command, open + refresh wiring), `styles/` (new
  `styles/task-list-view.css`, added to `build-css.mjs` include list).
- Tests: `tests/core/taskFilter.test.ts`, `tests/ui/taskListModel.test.ts`,
  `tests/obsidian/taskListRenderer.test.ts`.

## Testing

- Unit (vitest, pure): every filter dimension + combinations; date presets
  against a fixed reference date; each sort key + direction; each group-by incl.
  the no-project bucket; `taskListModel` group counts + flat (no-nesting) cards +
  collapsed defaults; renderer DOM (filter-bar controls present and wired, one
  card per task, group headers with counts, empty state).
- Manual (in-vault): open via ribbon + command; apply each filter; switch
  group-by and sort; edit/complete a task and see the list update live; confirm
  filter/sort/group persist across reload.

## Risks

- `renderTaskCard` reuse: exporting it must not change the daily widget's output
  (same call, same options/handlers). Covered by the existing widget tests.
- Live refresh: the view must unsubscribe / be cleaned up on close to avoid
  leaks (Obsidian disposes the leaf; the host clears its reference).
- Large vaults: `allTasks()` + in-memory filter is fine for the expected scale;
  no virtualization in v1 (noted as a future concern if needed).
