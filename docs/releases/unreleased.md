# DayTasks - Unreleased

<!--
Use this file for user-facing changes only.

Sections:
- Added
- Changed
- Fixed
- Removed
- Security

DayTasks is English-only right now; no i18n release workflow is required.
-->

## Added

- **Inline task capture.** Run the **Capture task from line** command on any note
  line (or a multi-line selection) to turn it into a scheduled DayTasks task. The
  line is parsed for `#tags`, `@contexts`, `+project` (or `+[[wikilink]]`),
  `!priority`, a time estimate (`45m`, `2h`, or `1h30m`),
  and a date. A `scheduled:` marker or a bare date phrase sets the day the task
  sits on; `due:`/`by:`/`deadline:` set a deadline only. With no `scheduled:` date,
  the task lands on the note's daily date if it is a daily note, otherwise today.
  The captured line is replaced with the task title followed by the new task id,
  and the task records the note it came from. New setting: **Inline capture › Enable inline task
  capture** (on by default). Multi-line selections use the lines after the first as
  the task description.

## Fixed

- Inline capture: a `due:` date is now treated as a deadline only and no longer
  sets the day a captured task is scheduled. A task with a `due:` date but no
  `scheduled:` marker lands on today (or the note's daily date) instead of jumping
  to the due date.
- Inline capture: estimates now require a unit (`45m`, `2h`, `1h30m`). A bare
  number is kept in the title instead of being read as minutes, so "Buy 2 apples"
  no longer becomes a 2-minute task.
