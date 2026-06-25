---
id: subtasks
title: Subtasks / Parent-Child (Relationships Slice B)
type: design
status: open
opened: 2026-06-25
closed:
area:
  - core
  - obsidian
  - ui
---

# Subtasks / Parent-Child (Relationships Slice B) Design

Date: 2026-06-25

Second slice of the relationships work (after the modal/card UI refresh). A task
can own child subtasks through the existing `DayTask.parentId`. This slice wires
the three layers: a pure subtasks core module, service methods, nested widget
display with a progress count, and the editor section that replaces the disabled
"Subtasks" placeholder.

The data model already carries `parentId`; `MemoryTaskIndex.byParent` already
indexes children; `DayTaskService.deleteTask` already orphans children. No model
change is required.

Slice C (blocked-by / blocking) is a separate spec and builds on the cycle helper
introduced here.

## Locked decisions

Resolved with the user before design:

1. **Display** — children render nested under the parent card in the daily-note
   widget, behind a collapsible chevron (`>`) that is **collapsed by default**;
   clicking it reveals the subtasks. The parent card always shows a **progress
   bar** with `done/total` text (e.g. `2/9`).
2. **Auto-complete** — no roll-up. Parent status stays independent; the progress
   count communicates child state. No cascade mutations.
3. **Create mode** — subtasks can only be added after the parent's first save (a
   child needs `parentId = parent.id`, which exists only once saved).
4. **Depth** — arbitrary. Subtasks can have their own subtasks. This makes
   recursive display, recursive progress, and a cycle-safety guard mandatory.

## Progress semantics

Each card shows progress over its **direct** children only, applied recursively so
every node is self-describing. The count covers **all** direct children resolved
from the index — including children scheduled on a different day than the parent —
not only the children visible in today's widget.

It renders as an **always-visible progress bar** (a fill proportional to
`done/total`) with the `done/total` text beside it (e.g. `2/9`). The bar shows on
any task with at least one direct child, whether or not its subtasks are expanded.

## Goals

- A task can gain, list, and unlink child subtasks from the editor (edit mode).
- The daily-note widget nests same-day children under their parent behind a
  collapsible chevron (collapsed by default) and shows an always-visible
  direct-children progress bar.
- Expand/collapse state survives the widget's frequent full re-renders.
- Display is robust against corrupt/cyclic stored `parentId` (no infinite loop).

## Non-goals (out of scope)

- Auto-completion roll-up in either direction (locked decision 2).
- An arbitrary "move task under another" reparent picker. `isDescendant` ships in
  core ready for that, but no reparent UI is built here (YAGNI).
- Child drag / manual reorder among siblings (`sortOrder` is a later milestone).
- Full transitive parent-cycle pruning in the decoder — deferred to Slice C,
  where the graph-cycle utility lands. Display is protected in the meantime by the
  cycle-safe forest builder (see Decoder).
- Blocked-by / blocking dependencies (Slice C).

## Core — `src/core/subtasks.ts` (new, pure, unit-tested)

A single pure module so the decision logic is testable without the Obsidian
runtime. No dependency on `StatusManager` (predicates are injected).

- `computeChildProgress(children: DayTask[], isCompleted: (status: string) => boolean): { done: number; total: number }`
  Counts direct children. `total = children.length`; `done =` children whose
  status satisfies `isCompleted`.

- `isDescendant(candidateId: string, ancestorId: string, parentOf: (id: string) => string | undefined): boolean`
  True when `candidateId` is `ancestorId` itself or any transitive descendant of
  it — i.e. walking `parentOf` up from `candidateId` reaches `ancestorId`. Uses a
  visited set so a corrupt cyclic chain terminates instead of looping. This is the
  reparent-safety primitive and the seed for Slice C's cycle check.

- `buildTaskForest(tasks: DayTask[], isCompleted: (status: string) => boolean): TaskNode[]`
  Groups a flat list (one day's tasks) into a tree.
  - `TaskNode = { task: DayTask; children: TaskNode[] }`.
  - **Root rule:** a task is a root iff it has no `parentId`, or its `parentId` is
    not present in `tasks`. So a child whose parent is scheduled on another day
    still appears (as a root) rather than vanishing.
  - **Cycle-safe:** a visited set guarantees each task is placed at most once and
    recursion cannot loop on corrupt data. (A fully cyclic pair may render once or
    not nest as expected; it never hangs. Slice C's decoder removes such cycles.)
  - **Ordering:** completed tasks sink to the bottom within each sibling group
    (the same rule `createDailyTasksWidgetModel` applies today), recursively.

## Service — `src/core/dayTaskService.ts`

- `getChildren(parentId: string): DayTask[]` → `index.byParent(parentId)`.
- `createSubtask(parentId: string, input: CreateDayTaskInput): Promise<DayTask>`
  Verifies the parent exists (throws otherwise), then delegates to `createTask`
  with `parentId` set. A freshly generated id cannot equal an existing parent's,
  so no self-parent is possible on creation.
- `unlinkSubtask(childId: string): Promise<DayTask>`
  Clears the child's `parentId` (orphans it), mirroring `deleteTask`'s orphan
  semantics. Returns the updated child.

`deleteTask` already orphans children — unchanged. No general `reparent` method in
this slice (no UI needs it); the `isDescendant` guard is available for when one is
added.

## View model + renderer

### View model (`src/ui/taskCard.ts`, `src/ui/todayView.ts`)

- `TaskCardViewModel` gains:
  - `children: TaskCardViewModel[]` — nested **same-day** child view models (empty
    for leaves and for parents whose children are all scheduled on other days).
  - `childProgress?: { done: number; total: number }` — present when the task has
    at least one direct child (any day, via the index); drives the progress bar.
  - `expanded: boolean` — whether this node's subtasks are revealed; resolved from
    an injected `expandedIds` set, default `false` (collapsed).
  The progress bar shows whenever `childProgress` is set; the chevron shows only
  when `children` is non-empty (there is something same-day to reveal).
- `createDailyTasksWidgetModel(date, tasks, statusManager, referenceDate, priorities, getChildren, expandedIds)`
  gains an injected `getChildren: (id: string) => DayTask[]` (the index lookup) and
  `expandedIds: ReadonlySet<string>`. It builds the forest from the day's `tasks`
  for nesting, computes `childProgress` per node from `getChildren(task.id)` so
  off-day children count, and stamps `expanded` from `expandedIds`. The
  completed-sink sort moves into `buildTaskForest`; top-level ordering stays
  consistent.
- `createTaskCardViewModel` gains the same `getChildren` (or receives precomputed
  children) so each node resolves its own progress and nested view models.

### Renderer (`src/obsidian/widgetRenderer.ts`)

- A **progress bar** renders in the title row when `card.childProgress` is set: a
  `<progress class="task-card__progress" max=total value=done>` plus a visible
  `done/total` label and an `aria-label`. A leaf has none.
- When `card.children` is non-empty, the title row also gains a **disclosure
  button** (`task-card__disclosure`, a real `<button>` with
  `data-icon="chevron-right"` for the `setIcon` post-pass,
  `aria-expanded` = `card.expanded`, `aria-controls` = the nested list id). It
  calls `handlers.onToggleSubtasks(card.id)` and stops propagation so it never
  triggers the card-edit click.
- The nested `<ul class="task-card__subtasks">` (id `subtasks-{card.id}`) renders
  whenever `card.children` is non-empty, each child via a recursive
  `renderTaskCard`; it carries a `hidden` attribute when `!card.expanded` (CSS can
  animate the reveal and `aria-controls` stays valid). The chevron rotates via a
  class tied to `expanded`.
- Renderer stays pure DOM (the `el()` helper), consistent with Slice A. The
  chevron uses the `data-icon` placeholder pattern, filled by `main.ts`'s
  `setIcon` post-pass.

## Modal — `src/obsidian/taskCreationModal.ts`

Replace the `buildPlaceholder(..., "list-tree", "Subtasks", "Add subtask")` row
with a real `buildSubtasks` section.

- **Edit mode:** list each child as a row — title text, a status dot, and an
  unlink button (`×`, `aria-label` "Unlink subtask {title}"). Below the list, an
  inline "Add subtask" text input: on submit (Enter / button) it creates a child
  via the injected callback, inheriting the parent's `scheduledDate` and the
  default status; the section re-renders. The child is fully editable later by
  clicking its own card.
- **Create mode:** render the row but disabled, with the hint "Save the task first
  to add subtasks" (no parent id yet) — same affordance the placeholder had.
- `×` is **unlink** (clears `parentId`), never delete — avoids accidental data
  loss. Deleting a child happens from the child's own editor.

New injected options on `TaskCreationModalOptions`:

- `getChildren?: (parentId: string) => DayTask[]`
- `onAddSubtask?: (parentId: string, title: string) => Promise<void>`
- `onUnlinkSubtask?: (childId: string) => Promise<void>`

These are optional so create-mode and tests that don't supply them still work.

## main.ts wiring

- Supply the three modal callbacks from the live `DayTaskService`
  (`getChildren`, `createSubtask`, `unlinkSubtask`), refreshing the widget after
  each subtask mutation.
- Thread `getChildren` (the index lookup) into the widget-model builder via the
  `DailyTasksWidgetController` dependencies.
- Hold an `expandedIds: Set<string>` for subtask disclosure state, owned by the
  plugin (outside the pure render) so it survives the widget's frequent full
  re-renders. Default empty (all collapsed). Add an `onToggleSubtasks(taskId)`
  handler that flips membership in the set and re-renders. Pass the set into the
  widget-model builder.
- The existing `setIcon` `data-icon` post-pass in `renderWidgetInto` fills the new
  chevron icon; the progress bar is a native `<progress>` element (no icon).

## Decoder — `src/obsidian/pluginDataAdapter.ts`

Cheap guard now: in `normalizeStoredTask`, drop a self-parent (`parentId === id`).
Full transitive parent-cycle pruning is deferred to Slice C (the graph util lands
there); until then, `buildTaskForest`'s visited set guarantees display never
loops on a cyclic chain. Note this in the slice's risks.

## Accessibility (mandatory)

- Unlink button: real `<button>` with an `aria-label`; reachable + operable by
  keyboard; `:focus-visible` via Obsidian CSS variables.
- "Add subtask" input: labeled (`aria-label`); Enter submits.
- Disclosure chevron: real `<button>`, `aria-expanded` reflecting state,
  `aria-controls` pointing at the nested `<ul>`'s id; keyboard operable.
- Progress bar: native `<progress>` (exposes value/max to assistive tech) plus an
  `aria-label` (e.g. "2 of 9 subtasks done") since the bare `2/9` is terse.
- Nested `<ul>` uses semantic list nesting.
- Card meta icons stay decorative (`aria-hidden`), per Slice A.
- Sentence-case UI text ("Add subtask", "Unlink subtask").

## CSS — `styles/`

- `styles/task-card.css` (and/or `styles/widget.css`): `.task-card__subtasks`
  nested-list indentation and a connector/indent that reads as hierarchy; the
  `.task-card__disclosure` chevron with a rotation transition between
  collapsed/expanded; a styled `.task-card__progress` bar (fill + track) tinted
  with Obsidian variables.
- `styles/modal.css`: the subtasks section — child rows, unlink button, inline
  add-subtask input.
- Obsidian CSS variables only; no `!important`; scoped to plugin classes.
  `build-css.mjs` concatenates `styles/` into `styles.css`.

## Testing

Unit (vitest, pure modules):

- `tests/core/subtasks.test.ts`:
  - `computeChildProgress`: counts done/total via the injected predicate; empty
    children → `{ done: 0, total: 0 }`.
  - `isDescendant`: direct child, transitive descendant, self, unrelated, and a
    cyclic chain (terminates, no hang).
  - `buildTaskForest`: nests children under parents; an off-day parent (parent not
    in the set) leaves the child as a root; completed children sink within a
    sibling group; a cyclic input terminates.
- `tests/ui/taskCard.test.ts`: a leaf defaults to `children: []`,
  `expanded: false`, and no `childProgress`; passing a nesting option threads
  `children`, `childProgress`, and `expanded` onto the model.
- `tests/ui/dailyTasksWidget.test.ts`: same-day children nest under the parent and
  are absent from the top level; the parent's `childProgress` counts an off-day
  child too (via the injected `getChildren`); `expanded` reflects the `expandedIds`
  set; a cyclic-parent input renders every task exactly once (no hang).
- `tests/obsidian/widgetRenderer.test.ts`: a parent with same-day children renders
  the disclosure button (`aria-expanded`) and the `<progress>` bar (value/max +
  aria-label); the nested `<ul>` carries `hidden` when collapsed and not when
  expanded; clicking the chevron calls `onToggleSubtasks`; a leaf has none of
  these.
- `tests/core/dayTaskService.test.ts`: `createSubtask` sets `parentId` and rejects
  a missing parent; `unlinkSubtask` clears `parentId`; `deleteTask` still orphans.
- `tests/obsidian/pluginDataAdapter.test.ts`: a stored self-parent is dropped.

Glue (not unit-tested — Obsidian runtime, P2-10 strategy): the modal subtasks
section, the modal callbacks, and the `main.ts` wiring — verified with
`npm run build:test` + the Obsidian CLI smoke checks in
`docs/development/testing.md` (create a parent, add two subtasks, confirm the
progress bar reads `0/2`, click the chevron to reveal the nested cards, complete
one child and confirm the bar updates to `1/2`, collapse/expand survives a status
cycle re-render, unlink one, `dev:errors` clean).

## Files touched

- `src/core/subtasks.ts` — new pure module.
- `src/core/dayTaskService.ts` — `getChildren`, `createSubtask`, `unlinkSubtask`.
- `src/ui/taskCard.ts` — `children` + `childProgress` view-model fields.
- `src/ui/todayView.ts` — forest + progress in `createDailyTasksWidgetModel`.
- `src/ui/dailyTasksWidgetController.ts` — thread `getChildren`.
- `src/obsidian/widgetRenderer.ts` — nested list + progress badge.
- `src/obsidian/taskCreationModal.ts` — real subtasks section + callbacks.
- `src/obsidian/pluginDataAdapter.ts` — drop self-parent.
- `src/main.ts` — wire callbacks + `getChildren`.
- `styles/task-card.css`, `styles/modal.css` (+ maybe `styles/widget.css`).
- Tests above.

## Risks

- **Cyclic stored data:** the decoder does not yet prune transitive parent cycles
  (deferred to C). The forest builder's visited set is the guarantee that display
  never hangs; a cyclic pair may simply render flat. Acceptable until C.
- **Off-day children:** a child scheduled on a different day than the parent is
  not nested in the parent's daily widget (it isn't in that day's set) but still
  counts toward the parent's progress. Intended — keep the two paths distinct
  (`buildTaskForest` over the day's set; progress over `getChildren`).
- **Re-render after subtask mutation:** the modal callbacks mutate tasks while the
  modal is open; `main.ts` must refresh the widget so counts/nesting stay correct
  without requiring the modal to close.
- **Immediate child creation:** "Add subtask" writes a child before the parent
  edit is saved. The child is its own task, so cancelling the parent edit leaves
  the child persisted — intended and low-risk.
