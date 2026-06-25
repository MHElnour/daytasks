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

- Subtasks: a task can now own child subtasks. Add and unlink them from the task
  editor; parent cards show a progress bar and a chevron to reveal nested
  subtasks in the daily-note widget.
- Card layout: status and priority are now compact icon controls fixed to the
  card's top-right (status shows its label on hover, click to advance; the
  priority flag cycles on click). Subtask progress and the expand chevron sit at
  the bottom-right. The title row holds only the title (capped at 100 characters)
  and the task id stays on one line.
