---
id: dependencies
title: Blocked by / Blocking (Relationships Slice C)
type: design
status: draft
opened: 2026-06-25
closed:
area:
  - core
  - obsidian
  - ui
---

# Blocked by / Blocking (Relationships Slice C) Design — DRAFT

Date: 2026-06-25

> **DRAFT — not yet approved.** Written as groundwork the evening Slice B (0.3.0)
> shipped, so the next session can confirm the open decisions in a short
> brainstorm, finalize this spec, then go straight to the plan + build. The three
> "Open decisions" below carry my recommendation but are **not locked** until the
> brainstorm confirms them.

Third and final slice of the relationships work (after subtasks). Adds task
**dependencies**: a task can be *blocked by* other tasks, and the inverse
*blocking* view is derived. Builds on the cycle-safety groundwork from Slice B.

## Goal

- A task can declare it is **blocked by** one or more other tasks (`blockedBy`).
- The **blocking** direction (which tasks this one blocks) is shown, derived from
  the inverse — no second stored edge.
- Adding a dependency can never create a cycle (A blocked by B is rejected if B is
  already, transitively, blocked by A).
- A card shows a **blocked** indicator when it has an *unmet* blocker (a blocker
  that is not completed).
- The editor's existing disabled **Blocked by** / **Blocking** placeholder rows
  (`taskCreationModal.ts:256-257`) become real.

## Open decisions (confirm in tomorrow's brainstorm)

1. **Store both edges or derive?** — *Proposed: store only `blockedBy?: string[]`;
   derive "blocking" via an index (`byBlocker`).* Mirrors how parent/child works
   (store `parentId`, derive children via `byParent`). Storing both risks the two
   lists drifting out of sync. (Alternative: store both for O(1) inverse lookup —
   rejected unless a perf need appears.)
2. **Task-picker UX** — *Proposed: a fuzzy `SuggestModal` over the task list
   (match title + id), mirroring `projectPicker.ts`, excluding self and any
   candidate that would create a cycle.* (Alternative: a flat list / inline
   autocomplete.)
3. **Blocked display** — *Proposed: a badge/indicator only (a "blocked" pill or
   icon, tooltip listing the unmet blockers).* Defer hiding or re-sorting blocked
   tasks (YAGNI; the current open-then-completed sort stays). (Alternative: also
   sink/hide blocked tasks — more work, changes the view model.)

## Data model

Add to `DayTask` (and `CreateDayTaskInput` / `UpdateDayTaskInput`):

- `blockedBy?: string[]` — ids of tasks this task waits on. Absent/empty = not
  blocked.

No stored `blocking` field — it is the inverse of `blockedBy`, resolved through
the index.

## Core — cycle check (new pure module `src/core/dependencies.ts`, unit-tested)

Dependencies form a directed graph (multiple edges per node), unlike the
single-parent chain `isDescendant` walks — so this needs a proper reachability
check, but reuses the same visited-set discipline.

- `hasPath(fromId: string, toId: string, blockersOf: (id: string) => string[]): boolean`
  — true when `toId` is reachable from `fromId` by following `blockedBy` edges
  (DFS/BFS with a visited set; terminates on cycles).
- `wouldCreateCycle(taskId: string, blockerId: string, blockersOf: (id) => string[]): boolean`
  — true when adding "`taskId` blocked by `blockerId`" would close a cycle, i.e.
  `blockerId === taskId` or `taskId` is already reachable from `blockerId`.

## Index

Add `byBlocker(id: string): DayTask[]` to `MemoryTaskIndex` — the tasks that list
`id` in their `blockedBy` (the inverse = "blocking"). Indexed off the `blockedBy`
array exactly like `byParent` indexes off `parentId` (array variant).

## Decoder — `pluginDataAdapter.ts`

`blockedBy` validation needs the full task set, so it runs as a **second pass**
after every task is decoded (per-task `normalizeStoredTask` can't cross-reference):

- Drop self-references (`id` in its own `blockedBy`).
- Drop unknown ids (not present in the decoded set).
- Break cycles (drop the edge that would close one) — this is the transitive
  prune **deferred from Slice B**, applied here to both dependency edges and the
  parent chain.

## Service — `dayTaskService.ts`

- `addDependency(taskId, blockerId)` — validates both exist and
  `!wouldCreateCycle(...)`, then appends `blockerId` to the task's `blockedBy`
  (deduped); throws on a cycle.
- `removeDependency(taskId, blockerId)` — removes the edge.
- `deleteTask` — also strip the deleted id from every task's `blockedBy` (mirror
  the existing child-orphaning cleanup).

## View model + renderer

- `TaskCardViewModel` gains `blocked: boolean` (and maybe `blockerCount`), computed
  from `blockedBy` + the completion state of each blocker (resolved via the index).
  `blocked` is true when at least one blocker is **not** completed.
- The renderer adds a "blocked" badge/icon (Lucide, e.g. `ban`/`lock`) when
  `card.blocked`, with an accessible label.

## Editor — `taskCreationModal.ts`

Replace the two `buildPlaceholder(...)` rows:

- **Blocked by** — edit mode: list current blockers (title + status dot + remove),
  plus an "Add task" button opening the task picker (excludes self + cycle
  candidates). Create mode: the existing disabled "save first" hint.
- **Blocking** — read-only derived list of tasks this one blocks (from `byBlocker`).

New injected callbacks (wired in `main.ts`), mirroring the subtask ones:
`getBlockers`, `getBlocking`, `onAddDependency`, `onRemoveDependency`, a task
lookup for the picker.

## Tests (pure)

- `dependencies.test.ts`: `hasPath` (direct, transitive, none, cyclic terminates);
  `wouldCreateCycle` (self, direct back-edge, transitive back-edge, safe add).
- decoder: drops self/unknown blockers; breaks a cyclic chain.
- service: `addDependency` rejects a cycle, dedupes; `removeDependency`;
  `deleteTask` strips inbound edges.
- view model: `blocked` true only when an *unmet* blocker exists; false when all
  blockers complete or none.

## Provisional task outline (becomes the plan after spec approval)

1. Core `dependencies.ts` — `hasPath` + `wouldCreateCycle` (pure, TDD).
2. Model — add `blockedBy` to `DayTask` + create/update inputs.
3. Index — `byBlocker` inverse lookup.
4. Decoder — second-pass `blockedBy` validation (self/unknown/cycle prune).
5. Service — `addDependency` / `removeDependency` + delete cleanup.
6. View model — `blocked` state.
7. Renderer — blocked badge.
8. Editor — wire Blocked by (picker add/remove) + Blocking (derived list).
9. `main.ts` wiring.
10. CSS.
11. Release note → 0.4.0 (feature ⇒ minor).

## Seeds already in place (don't rebuild)

- `isDescendant` + the visited-set forest in `src/core/subtasks.ts` — the
  cycle-safety pattern to mirror for the dependency graph.
- The disabled **Blocked by** / **Blocking** placeholder rows in
  `taskCreationModal.ts` (`buildPlaceholder`), ready to wire.
- The project picker (`src/obsidian/projectPicker.ts`, `MarkdownPathSuggestModal`
  in `modals.ts`) — pattern to mirror for the task picker.
- The subtasks slice's modal/section, `main.ts` callback wiring, and the
  `data-icon` post-pass — reuse the shapes.

## Out of scope

- Hiding or re-sorting blocked tasks (badge only for v1).
- A dependency graph view / visualization.
- Cross-day dependency surfacing beyond the badge.
