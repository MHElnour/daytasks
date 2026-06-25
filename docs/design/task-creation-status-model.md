---
id: task-creation-status-model
title: Task Creation And Status Model
type: design
status: partial
opened: 2026-06-25
closed:
area:
  - core
  - settings
  - ui
---

# Task Creation And Status Model Design

Date: 2026-06-25
Repo: DayTasks
Status: Partially implemented

## Goal

Design the full DayTasks task creation model and status manager before adding a
rich creation modal, widget add button, detail-note creation, or deeper card
actions.

The goal is not to copy all of TaskNotes. The goal is to copy the useful shape:
one shared task creation contract, one normalized task data model, and one
status manager used everywhere status behavior matters.

## User Story

As a user, I can create a day-first task from the command palette or the daily
note widget. The task can include title, scheduled date, due date, status,
priority, tags, contexts, linked projects, estimate, parent task, and optional
detail note. The same task object is stored, indexed, shown in the daily widget,
and updated by status actions.

## Current DayTasks Model

DayTasks already has the backbone:

- `id`
- `title`
- `status`
- `scheduledDate`
- `dueDate`
- `parentId`
- `detailNotePath`
- `tags`
- `contexts`
- `projects`
- `timeEntries`
- `createdAt`
- `updatedAt`

This is enough for a first visible widget, but not enough for strong task
creation.

## Missing Pieces

Add the following fields to support a TaskNotes-like creation flow without
bringing over TaskNotes' full complexity:

- `priority`
- `completedAt`
- `archivedAt`
- `estimateMinutes`
- `description`
- `sortOrder`
- configurable status definitions

`description` is stored in plugin data. If the user creates a detail note, the
detail note can mirror or expand it later, but the task record remains the
source of truth.

`sortOrder` is optional and can be empty on creation. It exists so day widgets
can later support stable manual ordering without reshaping the task model.

## Target Data Model

```ts
export interface DayTask {
  id: string;
  title: string;
  status: string;
  priority?: string;

  scheduledDate: string;
  dueDate?: string;
  completedAt?: string;
  archivedAt?: string;

  parentId?: string;
  detailNotePath?: string;

  tags: string[];
  contexts: string[];
  projects: ProjectLink[];

  estimateMinutes?: number;
  description?: string;
  sortOrder?: string;

  timeEntries: TimeEntry[];

  createdAt: string;
  updatedAt: string;
}
```

Important model rule: arrays should default to `[]`, not `undefined`, once this
model is adopted. That keeps widget rendering, persistence, and any later
integration work predictable.

## Date Semantics

DayTasks is day-first, so every task should have `scheduledDate`.

`scheduledDate` means: show this task on this daily note / day list.

`dueDate` means: deadline.

Creation from a daily note should default `scheduledDate` to the active daily
note date. Creation from the daily widget should use the widget's date.

## Creation Input Contract

All task creation entrypoints should call the same service method with the same
input type.

```ts
export interface CreateDayTaskInput {
  title: string;
  scheduledDate: string;
  dueDate?: string;
  status?: string;
  priority?: string;

  parentId?: string;
  detailNote?: boolean;
  detailNotePath?: string;

  tags?: string[];
  contexts?: string[];
  projects?: ProjectLink[];

  estimateMinutes?: number;
  description?: string;
  sortOrder?: string;
}
```

Consumers:

- command palette creation
- daily widget add button
- optional detail-note creation

The factory/service decides defaults. Callers should not duplicate defaulting
logic.

## Creation Defaults

Add settings:

```ts
interface DayTasksSettings {
  defaultStatus: string;
  defaultPriority?: string;
  defaultTags: string[];
  defaultProjectPath: string;
  createDetailNoteByDefault: boolean;
  detailNotesFolder: string;
  statuses: StatusConfig[];
  priorities: PriorityConfig[];
}
```

Creation defaults:

- `status`: `input.status ?? settings.defaultStatus`
- `priority`: `input.priority ?? settings.defaultPriority`
- `scheduledDate`: required by service, usually supplied by active daily note
- `tags`: merge settings default tags with input tags, preserving order and
  removing duplicates
- `projects`: include settings default project when present, then input projects
- `timeEntries`: `[]`
- `createdAt` and `updatedAt`: current timestamp
- `completedAt`: set only when the starting status is a completed status
- `archivedAt`: unset on creation

## Status Config

Make `status` a string, not a closed union like `"open" | "done"`.

```ts
export interface StatusConfig {
  id: string;
  value: string;
  label: string;
  color: string;
  icon?: string;
  isCompleted: boolean;
  order: number;
  excludeFromCycle?: boolean;
  nextStatus?: string;
}
```

Default statuses:

```ts
[
  {
    id: "open",
    value: "open",
    label: "Open",
    color: "#808080",
    icon: "circle",
    isCompleted: false,
    order: 0
  },
  {
    id: "in-progress",
    value: "in-progress",
    label: "In progress",
    color: "#0066cc",
    icon: "loader",
    isCompleted: false,
    order: 1
  },
  {
    id: "done",
    value: "done",
    label: "Done",
    color: "#00aa00",
    icon: "check-circle",
    isCompleted: true,
    order: 2
  }
]
```

Do not add TaskNotes' auto-archive fields yet. DayTasks can add auto-archive
later if needed, but it does not belong in the first status manager.

## Status Manager

Add a small `StatusManager` service.

Responsibilities:

- normalize unknown status values
- return the next cycle status
- return a status config by value
- check whether a status counts as completed
- return statuses sorted by `order`
- validate settings

Required methods:

```ts
class StatusManager {
  constructor(statuses: StatusConfig[], defaultStatus: string);

  getStatusConfig(value: string): StatusConfig | undefined;
  getAllStatuses(): StatusConfig[];
  getStatusesByOrder(): StatusConfig[];
  getNextStatus(current: string): string;
  isCompletedStatus(value: string): boolean;
  normalizeStatusValue(value: unknown): string;
  validate(): { valid: boolean; errors: string[] };
}
```

Cycle behavior:

- sort statuses by `order`
- skip statuses with `excludeFromCycle`
- if current status has `nextStatus`, use that when valid
- otherwise move to the next cycleable status
- if current status is unknown, fall back to `defaultStatus`

Completion behavior:

- when a task changes from non-completed to completed, set `completedAt`
- when a task changes from completed to non-completed, clear `completedAt`
- the daily widget should treat `isCompletedStatus(task.status)` as the checked
  state

## Priority Config

Priority can be lighter than status, but the shape should be configurable from
the start.

```ts
export interface PriorityConfig {
  id: string;
  value: string;
  label: string;
  color: string;
  icon?: string;
  weight: number;
}
```

Default priorities:

- `none`
- `low`
- `normal`
- `high`

Priority does not need its own manager in the first implementation. A helper for
lookup/sorting is enough.

## Creation UI Shape

The user-facing creation flow should feel like TaskNotes, but smaller.

Primary text input:

```text
Buy milk tomorrow #errand +Home @phone ~30m
```

Fields shown in the modal:

- title
- status
- scheduled date
- due date
- priority
- projects
- tags
- contexts
- estimate
- description
- create detail note toggle

The first version may skip full natural-language parsing, but the data contract
must support parsed values. NLP can be added later without changing the storage
model.

Suggested parsing direction:

- `#tag` -> tags
- `+Project` -> project selector/search result
- `@context` -> contexts
- `~30m`, `~2h` -> estimate minutes
- date phrase -> scheduled date by default
- explicit due phrase -> due date

DayTasks should keep TaskNotes' useful idea of a preview: what the text input
will create should be visible before saving.

## Detail Notes

Detail notes are optional. A task can exist without a note.

Creation behavior:

- if `detailNote` is false, store only the task record
- if `detailNote` is true, create a markdown note under `detailNotesFolder`
- write `detailNotePath` into the task record
- detail note frontmatter should include the task `id`

The plugin data task remains canonical. The detail note is extra workspace for
long notes, links, and attachments.

## Deferred Integration Note

External creation surfaces are not part of the current milestone. The useful
rule to preserve now is simpler: command creation, widget creation, and optional
detail-note creation all go through `DayTaskService.createTask`.

If DayTasks later grows an external surface, it should reuse this same creation
input instead of inventing a parallel model.

## Indexing Impact

The index should support:

- by scheduled date
- by due date
- by tag
- by context
- by project
- by status
- by parent ID

`byStatus` is needed once statuses become configurable and the widget gets
filters.

When a task is updated, indexes must remove stale entries before adding new
entries. Existing incremental index behavior should be preserved.

## Widget Impact

The widget should stop treating checked state as `status === "done"`.

Instead:

```ts
checked = statusManager.isCompletedStatus(task.status)
```

Status dot rendering should use:

- status color
- optional status icon
- next-status tooltip/action

The widget add button should open the same creation modal and prefill
`scheduledDate` from the daily note.

## Settings UI

Settings should include:

- default status select
- status list editor
- default priority select
- priority list editor

Status editor fields:

- label
- value
- color
- icon
- completed toggle
- order
- optional next status
- optional exclude from cycle

Validation rules:

- at least two statuses
- exactly or at least one completed status; DayTasks should require at least one
- status values are unique
- status IDs are unique
- default status exists
- `nextStatus`, when present, points to an existing status and does not point to
  itself

The first implementation can use a simple settings editor rather than a polished
drag/drop card editor.

## TaskNotes Reference Map

When implementing, inspect these TaskNotes files first:

- `src/types.ts`
  - `TaskInfo` shows TaskNotes' mature task shape.
  - `StatusConfig` and `PriorityConfig` show configurable status/priority
    fields.

- `src/settings/defaults.ts`
  - `DEFAULT_STATUSES` and `DEFAULT_PRIORITIES` show default config values.

- `src/services/StatusManager.ts`
  - Best reference for status cycling, completed status checks, and validation.
  - Copy the behavior conceptually, but trim auto-archive and skipped-occurrence
    behavior for DayTasks.

- `src/types/settings.ts`
  - Shows where TaskNotes stores `defaultTaskStatus`, `customStatuses`, and
    `customPriorities`.

- `src/modals/taskCreationData.ts`
  - Shows how TaskNotes converts modal state into one normalized creation data
    object.

- `src/services/task-service/TaskCreationService.ts`
  - Shows how TaskNotes centralizes task creation after multiple entrypoints
    have produced input data.

- `src/modals/TaskCreationModal.ts`
  - Useful for the creation modal flow and NLP preview, but do not copy the full
    UI yet.

- `src/modals/taskCreationSuggest.ts`
  - Useful when adding inline suggestions for tags, projects, contexts, and
    statuses.

- `src/services/NaturalLanguageParser.ts`
  - Useful when DayTasks adds NLP parsing. This should be later than the core
    model/status manager.

- `src/ui/taskCardActions.ts`
  - Shows task-card status cycling through `StatusManager`.

- `src/ui/taskCardPrimaryIndicators.ts`
  - Shows status dot coloring/icon behavior.

- `src/settings/tabs/taskProperties/statusPropertyCard.ts`
  - Shows the full TaskNotes status settings editor. DayTasks should implement a
    simpler version first.

## Implementation Order

Recommended order:

1. Add `StatusConfig`, `PriorityConfig`, expanded `DayTask`, and expanded
   `CreateDayTaskInput`.
2. Add default statuses/priorities and settings migration.
3. Add `StatusManager` with tests.
4. Update task factory/service to use status/defaults and completion side
   effects.
5. Update task index to include status, due date, context, and parent indexes.
6. Update widget view models to use `StatusManager`.
7. Add a task creation modal that writes `CreateDayTaskInput`.
8. Wire command palette and widget add button to the modal.
9. Add detail-note creation.

## Testing Requirements

Unit tests:

- status manager validates default statuses
- status manager cycles in order
- `nextStatus` overrides order when valid
- completed status sets `completedAt`
- reverting to open clears `completedAt`
- task creation merges default tags/projects with input
- task creation accepts custom status strings from settings
- widget checked state uses `StatusManager`
- index updates status/date/tag/project/context/parent entries

Integration-ish tests:

- command creation uses the shared creation service
- widget add-button creation uses the shared creation service

## Non-Goals

Do not include these in the first implementation:

- recurrence
- reminders
- dependency graph
- full TaskNotes user-fields system
- auto-archive
- ICS/calendar sync
- complex NLP
- full drag/drop status settings editor

These can be added later if DayTasks actually needs them.

## Acceptance Criteria

- DayTasks stores tasks with the expanded model.
- Status is configurable and not restricted to `"open" | "done"`.
- All task creation entrypoints call one shared creation path.
- The widget uses the status manager to decide checked/completed state.
- Default status and custom statuses are editable from settings.
- The creation input remains small enough for later integrations to reuse
  without a parallel model.
