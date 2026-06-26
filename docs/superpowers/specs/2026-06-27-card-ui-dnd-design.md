# Card UI redesign + drag-and-drop reorder

**Date:** 2026-06-27
**Branch:** `feat/card-ui-dnd`
**Status:** Approved design — ready for implementation plan

## Goal

Rebuild the DayTasks daily widget to match a reference card layout, replace the
"completed sinks to bottom" sort with a user-controlled order, and let users
drag tasks to reorder them.

## Scope

In:

- Match the reference image's **layout and structure** using Obsidian theme
  tokens (CSS variables). No hardcoded palette — adapts to the user's theme.
- Collapse/expand model for every task card.
- Compact subtask rows that expand into full cards.
- A boxed metadata grid (Priority · Due · Created · Estimate).
- Separate labeled Projects / Contexts / Tags rows.
- Description truncation with a "Read more" toggle.
- Drag-to-reorder for **siblings only** (top-level cards; subtasks within one
  parent), persisted via the existing `sortOrder` field.
- Drop the completed-last sort.

Out (non-goals):

- Reparenting / un-nesting via drag (drag a card onto another to nest). Siblings
  only.
- A dark-mode-specific or hardcoded color scheme.
- Touch-gesture polish beyond what the drag library provides out of the box.
- Cross-day moves via drag.

## Background — current state

- `src/obsidian/widgetRenderer.ts` builds the widget DOM (pure, no Obsidian
  APIs, unit-tested in `tests/obsidian/widgetRenderer.test.ts`). It already
  renders an inert `.task-card__handle` element.
- `src/core/subtasks.ts` `buildTaskForest` sorts roots and children with a
  `completedLast` comparator — this is the "done sort" to drop.
- `DayTask` (`src/core/task.ts`) already has `sortOrder?: string` and
  `createdAt`. `sortOrder` is persisted (`pluginDataAdapter.ts`) and accepted by
  `taskFactory.ts`, but is **never read** for sorting or display today.
  `createdAt` is not shown in the UI.
- Tasks are stored canonically in `data.json` via `TaskStore`
  (`list/get/save/delete`) and mirrored to daily notes as checkbox lines.
- `DayTaskService` has create/update/delete/createSubtask/unlinkSubtask/
  setStatus/cycleStatus/setPriority/addDependency/removeDependency. There is
  **no reorder method** yet.

## Design

### A. Order persistence — reuse `sortOrder`

- New service method:
  `reorderSiblings(parentId: string | null, orderedIds: string[]): Promise<void>`.
  - For each id in `orderedIds`, assign a zero-padded `sortOrder`
    (`"0000"`, `"0010"`, `"0020"`, … step 10) and `store.save` the task.
  - Step-10 gaps keep future single-item inserts cheap without a full reindex,
    though the simple implementation reindexes the whole sibling set on each drop
    (small N per day).
  - `parentId === null` ⇒ top-level siblings for the day; otherwise the children
    of that parent.
- The comparator in `buildTaskForest` changes from `completedLast` to
  `bySortOrder`, defined to avoid mixing key formats:
  1. Tasks **with** `sortOrder` sort first, ordered by `sortOrder` (lexicographic
     over the zero-padded strings).
  2. Tasks **without** `sortOrder` sort after, ordered by `createdAt`.

  (After the first drag in a sibling group, `reorderSiblings` assigns `sortOrder`
  to every sibling, so the mixed state is transient.) Completed tasks keep their
  position — that is "drop the done sort."

### B. Drag-and-drop — SortableJS

- Add dependencies: `sortablejs` and `@types/sortablejs`.
- Drag wiring lives in a **new `src/obsidian/dragReorder.ts`**, attached by the
  Obsidian host **after** `renderDailyTasksWidget` runs — the pure renderer and
  its tests stay free of Sortable.
- Instances:
  - One on `ul.daytasks-cards` (top-level).
  - One per `ul.task-card__subtasks` (each parent's children).
  - Options: `handle: '.task-card__handle'`,
    `draggable: '.daytasks-note-widget__card'`, `animation` on.
  - Sortable groups are **not shared**, so items cannot be dragged between a
    parent's subtasks and the top-level list (enforces siblings-only).
- `onEnd` reads the new DOM order of sibling `data-task-id`s, calls
  `reorderSiblings`, then triggers a re-render.

### C. Collapse / expand model

- View-model (`TaskCardViewModel`) gains `collapsed: boolean`.
- The host owns a `collapsedIds: Set<string>` (mirror of the existing
  `expandedIds` pattern) so collapse state survives re-render. Defaults:
  top-level cards **expanded**, subtasks **collapsed**.
- Chevron control on the rail toggles collapsed ↔ expanded (calls a new
  `onToggleCollapsed(taskId)` handler).
- The ⋮ kebab opens an **actions menu** (Obsidian `Menu`): Edit, Add subtask,
  Delete. (These map to existing service methods; the menu is built in the host,
  the renderer just exposes an `onOpenMenu(taskId, anchorEl)` handler.)

### D. Render structure

Collapsed card = one slim row:

`[handle] [status check] [title ≤30 chars + …] [Task ID] [due chip] [chevron] [⋮]`

Expanded card:

1. **Title row**: title + `Task ID: …`; right rail = flag (priority) · status
   check · chevron; ⋮ kebab.
2. **Metadata box** — bordered 4-column grid, each column a label + icon + value:
   `Priority`, `Due`, `Created`, `Estimate`. `Created` is `formatMonthDay(createdAt)`.
   Columns with no value still render their slot for grid alignment (show `—`).
3. **Description** + **Read more** toggle. Truncate at ~140 chars; toggle expands
   in place (host state, same `Set` pattern, e.g. `descExpandedIds`).
4. **Projects** row (label + project chips), **Contexts** row, **Tags** row —
   each only when non-empty and enabled in options.
5. **Subtasks** section — bordered box: header (chevron · "Subtasks" · progress
   bar · `done/total` · `%` pill), then compact subtask rows (each a collapsed
   card, expandable via its own chevron).

Header: icon · `DAYTASKS` · `N tasks` pill · New Task button · date.
Footer: `N tasks total` · `N Done` pill.

### E. View-model additions

- `TaskCardViewModel`: `collapsed: boolean`, `createdLabel: string`.
- `createDailyTasksWidgetModel` / `getWidgetForDate` thread `collapsedIds`
  (and `descExpandedIds`) the same way `expandedIds` is threaded today.

## Files touched

- `src/core/subtasks.ts` — comparator `completedLast` → `bySortOrder`.
- `src/core/dayTaskService.ts` — add `reorderSiblings`.
- `src/ui/taskCard.ts` — `collapsed`, `createdLabel` on the view-model.
- `src/ui/todayView.ts` — thread `collapsedIds` / `descExpandedIds`.
- `src/ui/dailyTasksWidgetController.ts` — pass new sets through.
- `src/obsidian/widgetRenderer.ts` — collapsed vs expanded render, metadata grid,
  labeled chip rows, Read more, subtasks box, kebab/chevron hooks.
- `src/obsidian/dragReorder.ts` — **new**, SortableJS wiring.
- Host (Live Preview + reading-mode widget renderer) — own `collapsedIds` /
  `descExpandedIds`, attach drag, handle reorder/collapse/menu callbacks,
  re-render.
- `styles/task-card.css`, `styles/widget.css` — new layout.
- `package.json` — `sortablejs`, `@types/sortablejs`.

## Testing (TDD)

Unit (vitest, pure):

- `bySortOrder` comparator: orders by `sortOrder`, falls back to `createdAt`,
  completed tasks keep position.
- `reorderSiblings`: assigns correct zero-padded order, persists each sibling,
  scopes by `parentId`.
- Renderer: collapsed row DOM vs expanded card DOM; metadata grid renders four
  slots incl. `Created`; Read more truncation + toggle hook; labeled
  Projects/Contexts/Tags rows; subtasks box header.

Manual (in-vault, `npm run build:test`):

- Drag a top-level card → order persists across reload.
- Drag a subtask within its parent → persists; cannot drag across lists.
- Collapse/expand cards and subtasks; kebab menu actions.

## Risks

- SortableJS + Obsidian re-render: must `destroy()` instances before re-render to
  avoid leaks / double-binding. The host owns lifecycle.
- `data.json` write on every drop — debounced/awaited; N per day is small.
- Read more / collapse state is ephemeral (in-memory Set), reset on full reload.
  Acceptable for v1.
