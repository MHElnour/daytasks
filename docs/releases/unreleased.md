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

- **Detail note filenames are now just the task title** (e.g. `Buy milk.md`
  instead of `Buy milk-TSK-abc123.md`). If two tasks share a title, the second
  falls back to a `-<id>` suffix. The redundant `title` property was removed from
  the managed frontmatter — the note's filename is its title.

## Fixed

- The **Create detail note** toggle in the task **edit** dialog now works: turning
  it on and saving creates the note (previously it only worked when creating a new
  task; existing tasks could already use the ⋮ menu).

**Full Changelog**: <https://github.com/MHElnour/daytasks/compare/0.7.0...0.7.1>
