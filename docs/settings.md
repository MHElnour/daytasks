# Settings

Open `Settings -> Community plugins -> DayTasks` to configure the plugin.

## Daily Notes

**Daily note folder** limits widget rendering to notes inside one folder. Leave
it empty to allow any folder.

**Daily note date format** is display-oriented. Daily-note detection currently
uses the `YYYY-MM-DD` filename prefix.

## Widget

**Show daily note widget** controls whether the widget is rendered in daily
notes. When it is off, tasks remain stored and available through other views.

**Show task IDs**, **Show tags**, **Show contexts**, and **Show projects**
control which metadata appears on cards.

## Task Defaults

**Default status** sets the status used for new tasks.

**Default priority** sets the priority used for new tasks. The blank option
means no default priority.

**Default tags** is a comma-separated list applied to tasks created by DayTasks
commands. DayTasks also ensures the `daytask` tag is present.

**Default project** links new tasks to one project note. Use the picker to
search for a Markdown note in the vault.

## Inline Capture

**Enable inline task capture** is on by default. It gates the `Capture task from
line` command, which turns a note line into a scheduled task. When it is off, the
command does nothing.

**Show capture button** shows a one-click capture button at the end of the current
line in the editor. It requires **Enable inline task capture** and is on by
default.

## Detail Notes

**Detail notes folder** controls where new detail notes are created. It supports
date templates from the task's scheduled date:

- `{{year}}`
- `{{month}}`
- `{{day}}`
- `{{date}}`

For example, `Tasks/{{year}}/{{month}}` creates June 2026 task notes under
`Tasks/2026/06/`.

DayTasks normalizes the folder path and drops traversal segments, so a setting
such as `../Outside` cannot write outside the vault.

**Create detail note by default** turns on the create-detail-note toggle by
default in the task modal.
