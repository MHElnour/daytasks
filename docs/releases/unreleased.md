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

## Changed

- **Existing detail notes are tidied up automatically.** On first load after this
  update, any detail note made before 0.7.1 is normalized once: its file is
  renamed to the clean title-only name (`Buy milk.md`, dropping the `-<id>`
  suffix, when that name is free) and the redundant `title` property is removed.
  Your note body and links are preserved.
- Detail-note sync now tracks only the tasks that actually have a note instead of
  scanning every task on each change (faster on large vaults).

**Full Changelog**: <https://github.com/MHElnour/daytasks/compare/0.7.1...0.7.2>
