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

## Fixed

- Inline capture button: it now appears only on Markdown checkbox/task lines
  (`- [ ]`, `* [x]`, `1. [ ]`, blockquotes ok), not on every line the cursor lands
  on. Plain prose lines no longer show the button (the command still captures any
  line).
