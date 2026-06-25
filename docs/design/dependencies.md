---
id: dependencies
title: Blocked by / Blocking (Relationships Slice C)
type: design
status: open
opened: 2026-06-25
closed:
area:
  - core
  - obsidian
  - ui
---

# Blocked by / Blocking (Relationships Slice C) Design

Date: 2026-06-25

Third and final slice of the relationships work (after subtasks). Adds task
**dependencies**: a task can be *blocked by* other tasks, and *blocking* is the
inverse of the same single stored edge. Builds on the cycle-safety groundwork from
Slice B. All design decisions below are **locked** (resolved with the user).

## Goal

- A task can declare it is **blocked by** one or more other tasks, referenced by
  task id (`blockedBy: string[]` of `TSK-…` ids).
- **Blocking** (which tasks this one blocks) is the inverse of `blockedBy`, edited
  from the same UI — adding a "blocking" entry writes the *other* task's
  `blockedBy`, so there is only ever one stored edge and the inverse can't drift.
- Adding a dependency can never create a cycle.
- The card shows dedicated **Blocked by** and **Blocking** boxes (each only when
  present), with an emphasized state when a blocker is unmet (not completed).
- Clicking a referenced task opens that task's **scheduled daily note**.
- The editor's disabled **Blocked by** / **Blocking** placeholder rows
  (`taskCreationModal.ts:256-257`) become real, both editable.

## Locked decisions

1. **Single stored edge.** Store only `blockedBy: string[]` (task ids). "Blocking"
   is derived via a `byBlocker` index. Editing either direction writes the one
   `blockedBy` edge on the correct task, so the inverse is always consistent.
2. **Task picker.** A fuzzy `SuggestModal` over the plugin's **own tasks**
   (`DayTask` data from the store/index — tasks are self-contained, NOT vault
   `.md` files), searched and shown by **title + day** (`scheduledDate`). Mirrors
   the `FuzzySuggestModal` shape of `MarkdownPathSuggestModal`, but over tasks.
   Candidates exclude self and any task that would close a cycle.
3. **Card display.** Two bordered boxes in the card body, **below the tags and
   above the subtask progress row**: a **Blocked by** box, then a **Blocking** box,
   each rendered only when it has entries. Each lists its referenced tasks as
   clickable chips (`TSK-… · title`). An unmet blocker emphasizes the Blocked-by
   box (a "blocked" state).
4. **Click-through.** Clicking a referenced task chip opens that task's scheduled
   daily note (resolved from its `scheduledDate`), like the existing project-link
   open.

## Data model

Add to `DayTask` (and `CreateDayTaskInput` / `UpdateDayTaskInput`):

- `blockedBy?: string[]` — ids of tasks this task waits on. Absent/empty = not
  blocked.

No stored `blocking` field — it is the inverse, resolved through the index.

## Core — cycle check (new pure module `src/core/dependencies.ts`, unit-tested)

Dependencies form a directed graph (multiple edges per node), unlike the
single-parent chain `isDescendant` walks — so this needs a reachability check,
reusing the same visited-set discipline.

- `hasPath(fromId, toId, blockersOf: (id) => string[]): boolean` — true when
  `toId` is reachable from `fromId` by following `blockedBy` edges (DFS/BFS with a
  visited set; terminates on cycles).
- `wouldCreateCycle(taskId, blockerId, blockersOf): boolean` — true when adding
  "`taskId` blocked by `blockerId`" would close a cycle: `blockerId === taskId`, or
  `taskId` is already reachable from `blockerId`.

## Index

Add `byBlocker(id: string): DayTask[]` to `MemoryTaskIndex` — the tasks that list
`id` in their `blockedBy` (the inverse = "blocking"). Indexed off the `blockedBy`
array, exactly like `byParent` but as an array (one task indexes under each id in
its `blockedBy`).

## Decoder — `pluginDataAdapter.ts`

`blockedBy` validation needs the full task set, so it runs as a **second pass**
after every task is decoded (per-task `normalizeStoredTask` can't cross-reference):

- Coerce `blockedBy` to a deduped string array (drop non-strings).
- Drop self-references (`id` in its own `blockedBy`).
- Drop unknown ids (not present in the decoded set).
- Break cycles: drop the edge that would close one (the transitive prune that was
  deferred from Slice B, now applied to dependency edges).

Scope note: the *subtask parent* chain is out of scope here — its display is
already cycle-safe via `buildTaskForest`. This slice's decoder work is only about
`blockedBy`.

## Service — `dayTaskService.ts`

- `addDependency(taskId, blockerId)` — validates both exist and
  `!wouldCreateCycle(...)`, then appends `blockerId` to `taskId.blockedBy`
  (deduped); throws on a cycle.
- `removeDependency(taskId, blockerId)` — removes the edge.
- Editing from the **Blocking** side of task A just calls these with swapped args:
  "A blocks B" ⇒ `addDependency(B, A)` (writes B's `blockedBy`).
- `deleteTask` — also strip the deleted id from every task's `blockedBy` (mirror
  the existing child-orphaning cleanup; use `byBlocker` to find inbound edges).

## View model + renderer

- `TaskCardViewModel` gains:
  - `blockedBy: TaskRef[]` and `blocking: TaskRef[]`, where
    `TaskRef = { id; title; scheduledDate; completed }`, resolved via an injected
    task lookup (ids → refs). `blocking` comes from `byBlocker`.
  - `blocked: boolean` — true when at least one `blockedBy` ref is **not**
    completed (drives the emphasized state).
- The renderer draws the two boxes (below tags, above the subtask footer), each
  only when non-empty: a label ("Blocked by" / "Blocking") and the refs as
  clickable chips. A chip click calls `handlers.onOpenTask(id)`; the box carries a
  "blocked" modifier class when `card.blocked`. Pure DOM; any icons use the
  `data-icon` post-pass.

## main.ts wiring

- `onOpenTask(taskId)` → look up the task, open its `scheduledDate` daily note
  (resolve the daily-note path from the date + `dailyNoteFolder`, `openLinkText`).
- Modal callbacks (mirror the subtask wiring): `getBlockedBy(taskId)`,
  `getBlocking(taskId)`, `onAddDependency(taskId, blockerId)`,
  `onRemoveDependency(taskId, blockerId)`, and a task list/lookup for the picker.
  The Blocking section calls `onAddDependency(otherId, taskId)`.
- Thread the id→ref lookup and `byBlocker` into the widget-model builder.

## Editor — `taskCreationModal.ts`

Replace the two `buildPlaceholder(...)` rows; both are real in edit mode (create
mode keeps the "save first" hint):

- **Blocked by** — list current blockers (chip + status dot + remove); "Add task"
  opens the fuzzy task picker (excludes self + cycle candidates) →
  `onAddDependency(thisTask, picked)`.
- **Blocking** — list tasks this one blocks (from `getBlocking`); "Add task" picks
  a task this one should block → `onAddDependency(picked, thisTask)`. Remove calls
  `onRemoveDependency(picked, thisTask)`.

## Accessibility

- Chips are real buttons / activatable elements with `aria-label`s (open daily
  note), keyboard operable, `:focus-visible`.
- The "blocked" emphasis is not color-only (icon/label too).
- Sentence-case labels ("Blocked by", "Blocking", "Add task").

## Tests (pure)

- `dependencies.test.ts`: `hasPath` (direct, transitive, none, cyclic terminates);
  `wouldCreateCycle` (self, direct back-edge, transitive back-edge, safe add).
- decoder: coerces/dedupes `blockedBy`; drops self + unknown ids; breaks a cyclic
  chain.
- service: `addDependency` rejects a cycle + dedupes; `removeDependency`;
  blocking-side add writes the other task; `deleteTask` strips inbound edges.
- view model: `blocked` true only when an unmet blocker exists; `blocking` resolved
  from `byBlocker`; refs carry title + scheduledDate.

Glue (modal, picker, `main.ts`, click-through): `build:test` + Obsidian CLI.

## Provisional task outline (becomes the plan after approval)

1. Core `dependencies.ts` — `hasPath` + `wouldCreateCycle` (pure, TDD).
2. Model — add `blockedBy` to `DayTask` + create/update inputs.
3. Index — `byBlocker` inverse lookup.
4. Decoder — second-pass `blockedBy` validation (coerce, self/unknown drop, cycle
   break).
5. Service — `addDependency` / `removeDependency` + delete cleanup.
6. View model — `blockedBy` / `blocking` refs + `blocked` state.
7. Renderer — Blocked-by / Blocking boxes + chip click → `onOpenTask`.
8. Editor — wire both sections to the fuzzy task picker.
9. `main.ts` — `onOpenTask` (open daily note) + modal callbacks + threading.
10. CSS — boxed sections + blocked emphasis.
11. Release note → 0.4.0 (feature ⇒ minor).

## Seeds already in place (don't rebuild)

- `isDescendant` + the visited-set forest in `src/core/subtasks.ts` — the
  cycle-safety pattern to mirror for the dependency graph.
- The disabled **Blocked by** / **Blocking** placeholder rows in
  `taskCreationModal.ts`, ready to wire.
- The project picker (`src/obsidian/projectPicker.ts`,
  `MarkdownPathSuggestModal` in `modals.ts`) — pattern to mirror for the task
  picker.
- The subtasks modal section, `main.ts` callback wiring, the `data-icon`
  post-pass, and `openLinkText` (used by the project-link open) — reuse the shapes.

## Out of scope

- Hiding or re-sorting blocked tasks (boxes + emphasis only for v1).
- A dependency graph visualization.
- Any subtask parent-cycle work (already display-safe from Slice B).
