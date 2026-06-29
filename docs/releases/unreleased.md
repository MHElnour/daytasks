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

- Task List view, group by project: a task that belongs to more than one project
  now appears under each of its projects instead of only the first. When a project
  filter is active, a task is only shown under the filtered project(s), so
  filtering one project never surfaces a co-project group. The distinct task total
  is unchanged; per-group counts can sum higher, as expected.
