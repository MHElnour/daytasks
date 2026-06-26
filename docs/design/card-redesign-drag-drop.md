---
id: card-redesign-drag-drop
title: Card Redesign + Drag-to-Reorder
type: design
status: closed
opened: 2026-06-27
closed: 2026-06-27
area:
  - core
  - obsidian
  - ui
---

# Card Redesign + Drag-to-Reorder Design

Date: 2026-06-27 — shipped in **0.5.0**.

Rebuilds the daily-note task card to match a reference layout and adds
drag-to-reorder for sibling tasks. Drops the "completed tasks sink to bottom"
sort in favour of a user-controlled order. All styling uses Obsidian theme
tokens (no hardcoded palette), so the card adapts to the user's theme.

## Locked decisions

1. **Manual order via `sortOrder`.** `DayTask.sortOrder` (already stored in
   `data.json`, previously unused) becomes the order key.
   `DayTaskService.reorderSiblings(parentId, orderedIds)` assigns a zero-padded
   `sortOrder` to each sibling through the index-consistent `saveAndIndex` path.
   `buildTaskForest` sorts by `sortOrder` then `createdAt`; completion no longer
   affects order.
2. **Drag is siblings-only (SortableJS).** Top-level cards reorder among
   themselves; subtasks reorder within their parent. Groups are not shared, so
   items cannot cross lists. Order persists to `data.json` and survives reload.
3. **Collapse / expand.** Every card has a chevron that toggles a slim collapsed
   row (title ≤30… · id · due) and the full expanded card. Default by depth:
   top-level expanded, subtasks collapsed. State is held in a host-owned set so
   it survives re-render.
4. **Per-card actions menu (⋮).** Edit and Delete (Obsidian `Menu`).
5. **Expanded card layout.** Bordered 4-column metadata grid
   (Priority · Due · Created · Estimate; 2-col fallback on narrow panes via a
   container query); description shown in full; a divider; then labeled
   Projects / Contexts / Tags rows; Blocked by / Blocking rows; a boxed Subtasks
   section (disclosure · "Subtasks" · progress bar · `done/total` · % pill).
   Property rows are single-line and scroll horizontally on overflow; their
   labels share a fixed-width column so chips align. Chips are plain text with a
   box on hover; contexts are plain non-interactive labels; relation ids are
   plain monospace (no box).

## Architecture

- **Pure layers** stay free of Obsidian APIs and are unit-tested:
  - `src/core/subtasks.ts` — `bySortOrder` comparator.
  - `src/core/dayTaskService.ts` — `reorderSiblings`.
  - `src/ui/taskCard.ts` / `todayView.ts` — view-model gains `collapsed`,
    `createdLabel`; `collapsedIds` threaded through.
  - `src/obsidian/widgetRenderer.ts` — pure DOM: collapsed vs expanded render,
    metadata grid, chip rows, divider, subtasks box, rail controls; a
    nearest-card guard on the card click so a subtask click never opens its
    parent.
  - `src/obsidian/dragReorder.ts` — `siblingOrder` (pure, tested) +
    `attachReorder` (SortableJS wrapper).
- **Host** (`src/main.ts`) owns ephemeral collapse state, attaches drag after
  render, persists reorders (`reorderSiblings` → `persistTasks` → re-render),
  builds the kebab `Menu`, and manages Sortable lifecycle (`destroyReorder` on
  refresh/unload + detached-handle prune).
- **Styling**: `styles/task-card.css` (theme tokens only).

## Out of scope

- Reparenting / un-nesting via drag (siblings only).
- Cross-day moves via drag.
- A confirmation on the kebab Delete (one-click for now).
