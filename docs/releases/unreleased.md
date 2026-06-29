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
  `!priority`, a time estimate (`45m`, `2h`, `1h30m`, or a bare number of minutes),
  and a date — `scheduled:`/`due:`/`by:`/`deadline:` markers or a bare date phrase.
  The captured line is replaced with the task title followed by the new task id,
  and the task records the note it came from. New setting: **Inline capture › Enable inline task
  capture** (on by default). Multi-line selections use the lines after the first as
  the task description.
