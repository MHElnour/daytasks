---
id: blocked-status
title: Blocked status + dependency locking (Slice C addendum)
type: design
status: open
opened: 2026-06-26
closed:
area:
  - core
  - obsidian
  - ui
---

# Blocked status + dependency locking (Slice C addendum) Design

Date: 2026-06-26

Addendum to the dependencies slice ([dependencies.md](dependencies.md)). Turns the
derived "blocked" emphasis into a real, plugin-managed **blocked status** with a
status lock and an automatic release cascade. Ships folded into **0.4.0** on
`feat/dependencies` (the base dependencies work is implemented but unmerged). All
decisions below are **locked** (resolved with the user).

## Core model shift

A live `blockedBy` edge now always points at an **incomplete** blocker: completing
a blocker auto-removes the edge (see the release cascade). Therefore:

- **"blocked" ⇔ a task has ≥1 `blockedBy` edge.**
- Completed tasks never participate in a live edge on either side (they can't be
  picked as a blocker and can't be given dependencies), so a completed card never
  renders a relation box.

## Locked decisions

1. **Reserved system status.** `blocked` is a built-in, plugin-managed status —
   not user-editable, never the default, excluded from the click-cycle and from
   any toggle target. The plugin sets it and clears it automatically.
2. **Release target.** When a task's **last** blocker clears (the blocker is
   completed, deleted, or manually removed), the task is released to
   **in-progress**. Each non-last blocker that clears only removes its own edge;
   the task stays blocked while any blocker remains.
3. **Done tasks are inert for dependencies.** A task whose status is completed
   cannot be a blocker (excluded from the picker entirely) and cannot be given
   dependencies (both editor sections are disabled/greyed for a completed task).
4. **Status lock.** While a task is blocked, its status cannot change — the
   checkbox toggle and the status pill are inert and show a notice. Editing other
   fields and adding/removing dependencies stays allowed (removing a blocker is how
   you unblock).
5. **Chip display.** Relation chips show the **task id only** (drop the `· title`),
   and chip text must not inherit the completed-card line-through.

## Status model — `src/core/status.ts`, `statusManager.ts`

- Add a reserved status constant (e.g. `RESERVED_BLOCKED_STATUS`):
  `{ id: "blocked", value: "blocked", label: "Blocked", color: "#d9534f",
  icon: "ban", isCompleted: false, order: 10, excludeFromCycle: true }`.
  (`order: 10` sorts it after the user statuses; position is cosmetic since it is
  excluded from the cycle.) Export the value as a constant
  (e.g. `BLOCKED_STATUS_VALUE = "blocked"`).
- The reserved status is **injected** into the active status set used to build the
  `StatusManager` (so `getStatusConfig("blocked")` resolves and the pill renders),
  but is **not** added to the user-editable settings status list and is never the
  configured default. Settings validation/merge must not surface or allow editing
  it; a user-defined status colliding on the `blocked` value is overridden by the
  reserved one.
- `StatusManager` gains `isBlockedStatus(value): boolean`. `excludeFromCycle`
  already keeps it out of `getNextStatus`; `getCompletionToggleTarget` already
  never returns it (not completed, not default). No blocked task should reach those
  paths anyway — the lock guards first.
- Release-target resolution is a pure helper: prefer the status whose value is
  `in-progress`; if a custom status set lacks it, fall back to the configured
  default status. (Single-user plugin shipping the defaults; keep it simple but
  not crash-prone on custom sets.)

## Service cascade — `src/core/dayTaskService.ts` (pure-helper backed, unit-tested)

- `addDependency(taskId, blockerId)`: existing existence + cycle guards, **plus**
  reject when either task is completed (throw a clear error). On success, set the
  dependent's status → `blocked` (persist + reindex as today).
- **Completion cascade.** In the existing status-change path (where completion
  transitions are detected, ~`dayTaskService.ts:277`), when a task transitions to
  a completed status: for each dependent returned by `byBlocker(id)`, drop `id`
  from the dependent's `blockedBy`; if the dependent now has **zero** blockers,
  release it (status → in-progress); otherwise leave it `blocked`. Reuse the
  empty→absent field discipline (no `[]`).
- `removeDependency` and `deleteTask`: apply the same "last edge gone → release to
  in-progress" rule, so a task is never stuck `blocked` with no blocker. (deleteTask
  already strips inbound edges; extend it to release any dependent left with zero
  blockers.)
- Decision logic lives in pure `src/core/dependencies.ts` helpers with their own
  tests, e.g.:
  - `releaseStatusFor(remainingBlockerCount, blockedValue, inProgressValue): string | null`
    — returns the new status when a task should be released, else null.
  - the candidate filter already there gains a completed-exclusion.

## Status lock — pure predicate + `main.ts`

- Pure `isStatusLocked(task, statusManager): boolean` → true when the task's status
  is the reserved blocked status. Unit-tested.
- The checkbox-toggle handler and the status-pill handler in `main.ts` check it
  first: if locked, `new Notice("DayTasks: this task is blocked by another task.")`
  and return without changing status. No other handler changes.

## Picker + editor — `src/obsidian/taskPicker.ts`, `taskCreationModal.ts`

- `dependencyCandidates(taskId, all, blockersOf, isCompleted)` (signature extended)
  also excludes tasks where `isCompleted(status)` is true. Done tasks never appear
  in the picker/search.
- In `taskCreationModal`, when the task being edited is **completed**, render both
  dependency sections disabled/greyed with a hint
  ("Completed tasks can't have dependencies"), the same way create-mode shows its
  "save first" hint. The reserved-status case (a blocked task) keeps both sections
  fully editable.

## View model + renderer + CSS

- View model: `blocked` is derived from the status being the reserved blocked
  status (equivalently, `blockedBy.length > 0`). The card already renders the
  status pill, which now shows "Blocked".
- Renderer (`widgetRenderer.ts`): relation chip label becomes the **task id only**.
  The blocked emphasis keys off the blocked status / `card.blocked`.
- CSS (`styles/task-card.css`): chip text must not inherit the completed-card
  line-through (`text-decoration: none` on the chip, except the `is-done` chip
  styling which is now effectively unreachable but harmless). Add the reserved
  blocked status color through an Obsidian variable; no hardcoded colors in CSS,
  no `!important`.

## Accessibility

- The blocked status is conveyed by label + icon (not color alone).
- The lock notice is a real Obsidian `Notice`; the checkbox/pill remain real
  buttons (just inert while blocked) with their existing `aria-label`s.

## Tests (pure)

- status: reserved status injected and resolvable; `isBlockedStatus`; release-target
  resolution prefers in-progress, falls back to default.
- service: `addDependency` rejects when either task completed, and sets the
  dependent to blocked; completing a blocker removes the edge and releases the
  dependent only when it was the last blocker; partial completion (one of several
  blockers) keeps the dependent blocked; `removeDependency`/`deleteTask` release on
  last edge.
- candidates: completed tasks excluded.
- lock: `isStatusLocked` true for a blocked task, false otherwise.

Glue (modal greying, picker, `main.ts` lock + cascade wiring, chip label): verified
via `npm run build:test` + the Obsidian CLI.

## Migration / backward compatibility

- Saved data without the blocked status loads unchanged. On load, the decoder
  already prunes invalid/cyclic edges; additionally, a task that still carries live
  blockers should read as blocked, and a stored `blocked` status with no remaining
  blockers should be normalized on load (decode pass: if `status === blocked` and
  `blockedBy` is empty → release to in-progress; if a task has blockers but isn't
  blocked → set blocked). This keeps stored status consistent with the edge set
  after any out-of-band edits.

## Out of scope (unchanged from the dependencies slice)

- Dependency graph visualization.
- Hiding or re-sorting blocked tasks (status + lock + emphasis only).
- Any subtask parent-cycle work (already display-safe).
