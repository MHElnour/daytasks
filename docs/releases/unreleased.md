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
- **Inline capture button.** With inline capture enabled, a small button appears
  at the end of the current line in editor / Live Preview mode; click it to capture
  that line as a task — no command palette needed. The button is hidden on blank
  lines and on lines already captured. New setting: **Inline capture › Show capture
  button** (on by default).

## Fixed

- Inline capture: a `due:` date is now treated as a deadline only and no longer
  sets the day a captured task is scheduled. A task with a `due:` date but no
  `scheduled:` marker lands on today (or the note's daily date) instead of jumping
  to the due date.
- Inline capture: estimates now require a unit (`45m`, `2h`, `1h30m`). A bare
  number is kept in the title instead of being read as minutes, so "Buy 2 apples"
  no longer becomes a 2-minute task.
- Inline capture: running the command on a line that is already captured (one
  ending in a task id) no longer creates a duplicate task — it reports that the
  line is already captured and does nothing.
- Inline capture: the line is marked only after re-checking it is unchanged once
  the task is saved, so a concurrent edit during the save can no longer overwrite
  the wrong line; a stale capture button that lingers after the feature is turned
  off no longer captures.

## Removed

- Removed the reserved local API settings (Enable local API, API port) from the
  settings tab and the stored settings. They were schema-only and never shipped a
  working API. A local HTTP API and a browser extension are out of scope for
  DayTasks. Existing stored API values are dropped harmlessly on the next save;
  tasks are unaffected.
