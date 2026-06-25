# DayTasks - Unreleased

<!--
Use this file for user-facing changes only.

Sections:
- Added
- Changed
- Fixed
- Removed
- Security

DayTasks is private and English-only right now; no i18n release workflow is
required.
-->

## Added

- Task dependencies: a task can be blocked by other tasks (and the inverse
  "blocking" view is shown). Edit either side in the task editor via a fuzzy task
  picker; cycles are prevented. Cards show Blocked by / Blocking boxes, mark a task
  blocked while a blocker is open, and a chip opens that task's daily note.
