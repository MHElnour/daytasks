---
id: visible-obsidian-slice
title: Visible Obsidian Slice
type: design
status: implemented
opened: 2026-06-25
closed:
area:
  - obsidian
  - ui
  - core
---

# Visible Obsidian Slice Design

Date: 2026-06-25
Repo: DayTasks
Status: Implemented baseline

## Goal

Build the first visible DayTasks experience inside Obsidian.

The user should be able to install the local plugin, reload Obsidian, open a
daily note, run a command that creates a task for that day, and see a DayTasks
widget rendered at the bottom of the note.

This is not the full product yet. It is the first proof that our core model is
visible, persistent, and interactive inside Obsidian.

## User Story

As a user, I open today's daily note and create a task from DayTasks. The task is
stored by the plugin, not written into the note body as markdown. At the bottom
of the daily note, I see a DayTasks widget with task cards for that date. Each
card shows the task title, generated task ID, tags, project link, and status.
When I click the checkbox, the task status toggles and the card updates.

## Scope

This slice includes:

- Real Obsidian plugin entrypoint.
- Plugin data loading and saving.
- Basic settings tab.
- Command to create a test task for the active daily note.
- Daily-note date detection from the active file path.
- Bottom-of-note rendered DayTasks widget.
- Task cards rendered from the plugin store.
- Checkbox toggle for task status.
- A local build flow that copies the plugin into an Obsidian vault for testing.

This slice does not include:

- Full task creation modal.
- NLP parsing.
- External API or browser-extension support.
- Time tracking.
- Pomodoro.
- Drag/drop sorting.
- Recurring tasks.
- Live Preview editor decorations if they are too costly for v0.

## Recommended Rendering Approach

Start with a Markdown post-processor / rendered-reading-mode style integration
if it gives the quickest reliable visible result.

The first target is "can see it in Obsidian." If Live Preview requires a more
complex CodeMirror extension, defer that until after the simple visible path is
working.

The widget should appear at the bottom of daily notes only. Non-daily notes
should not show the widget.

## Daily Note Detection

The active note is considered a daily note when its filename begins with
`YYYY-MM-DD`.

Examples:

- `2026-06-25.md` -> `2026-06-25`
- `Daily/2026-06-25.md` -> `2026-06-25`
- `Daily/2026-06-25 Thursday.md` -> `2026-06-25`
- `Projects/Home.md` -> not a daily note

The existing `getDailyNoteDateFromPath` helper remains the source of truth for
this.

## Settings

The settings tab should start small.

### Daily Notes

- `dailyNoteFolder`
  - Default: empty string.
  - Meaning: any folder is accepted unless configured.
  - If configured, only notes in that folder are treated as DayTasks daily notes.

- `dailyNoteDateFormat`
  - Default: `YYYY-MM-DD`.
  - For v0, this can be display/config only while detection still supports the
    current `YYYY-MM-DD` filename prefix.

### Widget

- `showDailyNoteWidget`
  - Default: `true`.
  - When false, DayTasks still stores tasks but does not render the note widget.

- `widgetPosition`
  - Default: `bottom`.
  - For v0, only `bottom` needs to be supported. The setting exists so the data
    model does not need to change later.

- `showTaskIds`
  - Default: `true`.
  - Shows `TSK-xxxxxxxx` on cards.

- `showTags`
  - Default: `true`.
  - Shows task tags on cards.

- `showProjects`
  - Default: `true`.
  - Shows project links on cards.

### Task Defaults

- `defaultTags`
  - Default: empty array.
  - Applied to tasks created by DayTasks commands.

- `defaultProjectPath`
  - Default: empty string.
  - If set, new tasks created by the simple command link to this project.

- `detailNotesFolder`
  - Default: `DayTasks/Tasks`.
  - Reserved for optional full task notes in the next milestone.

- `createDetailNoteByDefault`
  - Default: `false`.
  - Reserved for the detail-note milestone.

## Data Flow

```text
Obsidian loads DayTasks plugin
  -> plugin loads settings
  -> plugin loads task store from plugin data
  -> plugin rebuilds TaskIndex

User opens daily note
  -> plugin reads active file path
  -> getDailyNoteDateFromPath(path)
  -> DailyTasksWidgetController asks service for tasks on that date
  -> createDailyTasksWidgetModel(date, tasks)
  -> Obsidian renderer turns model into DOM

User runs "DayTasks: Create test task for current daily note"
  -> active file path resolves to a date
  -> DayTaskService.createTask(...)
  -> TaskStore saves task
  -> TaskIndex upserts task
  -> plugin persists tasks with saveData
  -> widget refreshes

User toggles card checkbox
  -> DayTaskService.toggleStatus(taskId)
  -> TaskStore saves updated task
  -> TaskIndex upserts without changing same-date order
  -> plugin persists tasks with saveData
  -> widget refreshes
```

## Persistence Shape

Use Obsidian plugin data through `loadData` and `saveData`.

Suggested stored shape:

```ts
interface DayTasksPluginData {
  settings: DayTasksSettings;
  tasks: DayTask[];
}
```

The in-memory store/index should be rebuilt from persisted tasks on plugin load.
Every create/toggle operation should save the current task list back to plugin
data.

## Obsidian Components

### Plugin Entrypoint

`src/main.ts` becomes a real Obsidian plugin class.

Responsibilities:

- Load settings and persisted tasks.
- Create `MemoryTaskStore`, `MemoryTaskIndex`, and `DayTaskService`.
- Register settings tab.
- Register commands.
- Register note/widget rendering integration.
- Save task changes.

### Plugin Data Adapter

`src/obsidian/pluginDataAdapter.ts` should wrap Obsidian `loadData` and
`saveData`.

Responsibilities:

- Read stored settings/tasks.
- Merge stored settings with defaults.
- Save settings/tasks.
- Avoid leaking Obsidian APIs into core modules.

### Daily Widget Renderer

Add an Obsidian-specific renderer that accepts a `DailyTasksWidgetModel` and
renders DOM.

Responsibilities:

- Render empty state.
- Render cards.
- Render checkbox.
- Render task ID, tags, and projects based on settings.
- Call a supplied `onToggleTask(taskId)` handler.

Core `ui/` view models should stay Obsidian-independent. Obsidian DOM rendering
can live under `src/obsidian/` or a clearly named `src/ui/obsidian...` module.

### Command: Create Test Task

Register command:

`DayTasks: Create test task for current daily note`

Behavior:

- If active file is not a daily note, show a notice.
- If active file is a daily note, create a task with:
  - title: `Test task`
  - scheduledDate: active note date
  - tags: settings `defaultTags`
  - project: settings `defaultProjectPath` if present
- Save and refresh widget.

This command is intentionally simple. A proper task creation modal comes later.

## UI Requirements

The first widget should be quiet and functional.

Widget:

- Appears below note content.
- Header: `DayTasks`.
- Shows date in small text.
- Shows empty state when no tasks exist.
- Shows one card per task.

Card:

- Checkbox on the left.
- Title as primary text.
- Generated ID visible when `showTaskIds` is true.
- Tags shown as small chips when `showTags` is true.
- Project link shown when `showProjects` is true.
- Done tasks should look completed.

The widget should not write any task markdown into the note body.

## Error Handling

- If plugin data is missing, start with defaults and an empty task list.
- If plugin data is malformed, fall back safely and show an Obsidian notice.
- If command runs outside a daily note, show an Obsidian notice.
- If task creation fails, show an Obsidian notice and leave existing data intact.
- If widget rendering fails, avoid breaking the note view; log the error and
  show a small failure message inside the widget area.

## Testing Plan

Unit tests:

- Settings defaults and merge behavior.
- Plugin data adapter serialization shape using a fake plugin data port.
- Active note path -> widget model behavior.
- Renderer creates expected DOM for empty and non-empty models.
- Toggle handler is called with the correct task ID.
- Command refuses non-daily notes.
- Command creates a task for a daily note date.

Manual Obsidian test:

1. Build plugin.
2. Copy plugin files into a local test vault.
3. Reload plugin in Obsidian.
4. Open `2026-06-25.md`.
5. Run `DayTasks: Create test task for current daily note`.
6. Confirm the widget appears at the bottom.
7. Confirm card shows title, ID, tags, and project if configured.
8. Toggle checkbox.
9. Reload Obsidian.
10. Confirm task persists and status remains correct.

## Acceptance Criteria

- DayTasks loads in Obsidian without console errors.
- Settings tab appears.
- Daily note widget appears only on daily notes.
- Command creates a task for the active daily note.
- Task is stored in plugin data, not written as markdown into the note.
- Widget renders stored task cards.
- Checkbox toggles status and persists after reload.
- Existing unit tests pass.
- TypeScript typecheck passes.

## Open Decisions Before Implementation

1. Should the first visible widget target Reading mode only, or should we spend
   the extra time to make Live Preview work immediately?

   Recommendation: Reading mode or simplest reliable rendered view first.

2. Should the first create command ask for a title, or always create `Test task`?

   Recommendation: start with `Test task` so we verify the full plugin loop
   before building a modal.

3. Should default project be a plain path text setting in v0?

   Recommendation: yes. Fancy project picker later.

## Review Notes

This spec intentionally avoids external integration work. The plugin should
first prove that the Obsidian-visible task loop works end to end.
