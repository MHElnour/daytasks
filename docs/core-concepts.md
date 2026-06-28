# Core Concepts

DayTasks is intentionally smaller than TaskNotes. It is built for people who
plan from Obsidian daily notes and want structured task cards without turning
every task into its own note.

## Day-First Workflow

Daily notes are the primary workspace. A note named with a `YYYY-MM-DD` prefix
can show the DayTasks widget at the bottom of the note in Live Preview and
reading mode. The widget shows tasks scheduled for that date.

The daily note itself is not the task database. DayTasks does not write a
managed `## Tasks` section into note bodies. The active workflow is:

```text
plugin task store -> task index -> daily-note widget -> task cards
```

That separation keeps note text safe. The user owns the note body; DayTasks owns
the plugin data it persists through Obsidian.

## Store-First Tasks

The canonical task record lives in Obsidian plugin storage. Each task has a
stable `TSK-xxxxxxxx` id so cards, subtasks, dependencies, detail notes, and
future integrations can point at the same object.

A task stores:

- title;
- status and optional priority;
- scheduled date and optional due date;
- optional description and estimate;
- tags, contexts, and project note links;
- optional parent task and dependency links;
- optional detail-note path;
- timestamps and a manual sort key.

Arrays are normalized to empty arrays rather than left undefined.

## Cards And Relationships

The same task-card model powers the daily widget and the Task List view. Cards
can be collapsed, reordered within their group, and opened for editing.

Subtasks use `parentId`. A parent card can show nested children and completion
progress. Dependencies use `blockedBy`: when a task is blocked by another task,
DayTasks can show both the blockers and the tasks it is blocking.

## Detail Notes

A detail note is optional workspace for a task. It is a real Markdown note whose
frontmatter is managed by DayTasks and whose body belongs to the user.

Managed frontmatter includes task identity and task metadata such as status,
priority, scheduled date, due date, contexts, projects, estimate, parent id,
task id, timestamps, and tags. DayTasks preserves non-managed frontmatter keys
and never writes managed task content into the note body.

Detail-note folders can use date templates such as `{{year}}`, `{{month}}`,
`{{day}}`, and `{{date}}`, resolved from the task's scheduled date.

## Project Links

Projects are Obsidian note paths attached to tasks. DayTasks displays project
labels from the linked note basename and can open existing project notes. It
does not create a separate project database.

## Scope Boundaries

DayTasks is private and English-only right now. Do not add i18n, browser
extension, sync, or API scope until the Obsidian plugin experience is complete
and the roadmap explicitly activates that work.
