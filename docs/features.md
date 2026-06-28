# Features

DayTasks focuses on daily-note planning, review, and task cleanup inside
Obsidian.

## Daily-Note Widget

The widget appears at the bottom of recognized daily notes when enabled. It
shows the tasks scheduled for that date, including subtasks nested under their
parents.

From the widget you can:

- create a task for the current daily note;
- complete a task;
- cycle status and priority from the card;
- expand or collapse cards;
- reorder tasks within their group;
- open, edit, or delete a task;
- open project links;
- create or open a task's detail note.

The widget works in Live Preview, reading mode, split panes, and popped-out
windows.

## Task Creation And Editing

The task modal supports:

- title;
- status;
- priority;
- scheduled date;
- due date;
- estimate;
- tags;
- contexts;
- project links;
- description;
- optional detail-note creation.

A due date cannot be before the scheduled date. Descriptions and titles are
trimmed and clamped before storage.

## Task List View

The Task List view shows tasks across all days. Open it from the ribbon icon or
the `Open task list` command.

The view supports:

- filtering by status;
- date presets: all, today, overdue, next 7 days;
- filtering by tags, contexts, and projects;
- text search across title and description;
- grouping by status, scheduled date, or project;
- sorting by scheduled date, due date, priority, created date, or title;
- persisted filter, group, sort, collapsed-group, and expanded-card state.

The list uses the same cards as the daily widget.

## Subtasks

A task can own child subtasks. Subtasks can be added and unlinked from the edit
modal. Parent cards show a progress indicator based on direct child completion.

Subtasks are task records, not checklist text. They can have their own metadata,
status, priority, detail note, and relationships.

## Dependencies And Blocked Status

Tasks can be blocked by other tasks. DayTasks prevents dependency cycles and
keeps the blocked state synchronized when blockers are added, completed,
removed, or deleted.

Completed tasks cannot become blockers or receive new dependencies. Dependency
chips show the related task id and can be opened from the UI.

## Detail Notes

Detail notes give a task a real Markdown note for longer context. DayTasks
manages the note's task frontmatter and preserves the body.

You can create a detail note when creating a task, create one later from a card,
or open an existing one from the card rail or menu. Opening a detail note also
shows an injected subtasks widget for that task.

## Theme And Accessibility

DayTasks uses Obsidian theme variables for its surfaces, borders, focus rings,
and semantic colors. Interactive controls are keyboard reachable and icon-only
buttons carry accessible names.
