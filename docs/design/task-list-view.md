---
id: task-list-view
title: Task List View
type: design
status: closed
opened: 2026-06-27
closed: 2026-06-27
area:
  - core
  - ui
  - obsidian
---

# Task List View Design

Date: 2026-06-27 — shipped in **0.6.0**.

A dedicated view that shows **all** DayTasks tasks across days (not just one daily
note), with filtering, switchable grouping, and sorting. Opens as a main editor
tab via a ribbon icon and an "Open task list" command. Reuses the existing
task-card renderer. All styling via Obsidian theme tokens.

## Why a custom view (not Obsidian Bases)

Bases queries vault notes by their frontmatter. DayTasks stores tasks as records
in `data.json` (mirrored to daily-note checkbox lines), not one-note-per-task, so
Bases cannot query them. A custom `ItemView` reading from `DayTaskService` is the
idiomatic fit and reuses the data model and card UI.

## Locked decisions

1. **Layering.** Pure, Obsidian-free, unit-tested logic:
   - `src/core/taskListState.ts` — `TaskListState` + default.
   - `src/core/taskFilter.ts` — `filterTasks` / `sortTasks` / `groupTasks`.
   - `src/ui/taskListModel.ts` — `createTaskListModel` (filter → sort → group →
     flat cards built with `children: []`, collapsed by default).
   - `src/obsidian/taskListRenderer.ts` — `renderTaskListView` (filter bar +
     collapsible groups), reusing `renderTaskCard` (exported from the widget
     renderer).
   The Obsidian host (`src/obsidian/taskListLeaf.ts`, `src/main.ts`) owns the
   `ItemView`, ephemeral UI state, and persistence.
2. **Filters.** Status (inline chips) · date preset (all / today / overdue /
   next 7 days) · tag / context / project · free-text search (title + description).
3. **Facet UI that scales.** Tags / Contexts / Projects are **dropdown buttons**
   with a searchable checklist popover (not inline chips), so hundreds of values
   stay usable. The view re-renders fully on each change but preserves the open
   popover, input focus/caret, and list scroll; a click-outside backdrop closes
   the popover.
4. **Grouping** (switchable): Status (default) / Scheduled date / Project, into
   collapsible sections with counts. **Sorting**: scheduled / due / priority /
   created / title, with a direction toggle. Default scheduled ascending.
5. **Flat list.** Every task is its own row (parents and subtasks side by side);
   no nesting in this view. The daily widget keeps its nesting.
6. **No drag-reorder** here (order is sort-driven); the card's drag handle is
   hidden in this view.
7. **Persistence.** Filter/sort/group state is stored in
   `settings.taskListState` (validated on load) and saved debounced.
8. **Rows.** Collapsed cards reused from the card UI; due date and task id are
   laid out in fixed right-hand columns so they align across rows.

## Architecture

- Data flow: a control change → host updates state (in-memory sync + debounced
  save) → `render()` → `createTaskListModel` → `renderTaskListView`. Live updates
  come from the plugin's existing `refreshViews()` re-rendering open list leaves.
- Host reads `statusManager`/`priorities`/`allTasks` live (getters/closures) so a
  settings change is reflected.

## Out of scope (v1)

- Drag-reorder in this view; saved/named filter presets; calendar/kanban layouts;
  parent/child nesting in the list.
