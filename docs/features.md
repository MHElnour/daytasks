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

## Inline Capture

The `Capture task from line` command turns a note line into a scheduled DayTasks
task. Run it on the line under the cursor, or on a multi-line selection where the
lines after the first become the task description.

The line is parsed for tokens anywhere in the text:

- `#tag` adds a tag;
- `@context` adds a context;
- `+project` or `+[[wikilink]]` links a project note;
- `!priority` sets the priority, for example `!high`;
- an estimate: `45m`, `2h`, `1h30m`, or a bare number read as minutes.

Priority is marker-only. A bare word such as "high" in "high level plan" stays in
the title; only the `!` form sets a priority.

Dates use colon markers or a bare date phrase:

- `due:`, `by:`, or `deadline:` set the due date (a deadline only);
- `scheduled:` sets the scheduled date;
- a bare date phrase, such as "tomorrow", is read as the scheduled date.

The scheduled date is the day the task sits on: an explicit `scheduled:` (or bare
date), otherwise the note's daily date if the note is a daily note, otherwise
today. A `due:` date is a deadline and never moves the scheduled day — so
`due:friday` with no `scheduled:` lands the task on today (or the note's day) with
Friday as its deadline.

After capture, the line is replaced with the task title followed by the new task
id, and the task records the note it was captured from. The command is gated by
the **Enable inline task capture** setting.

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
