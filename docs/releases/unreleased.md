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

## Changed

- Task List view: the filter toolbar is now two tidy rows with icons — search and
  status pills on top; date, group, sort, tags, contexts, projects, and clear
  below. Status pills show their status icon and color. Same filtering behavior.
- Task List view: each group is now a bordered container with a group icon
  (calendar / status / folder by group-by), a count badge, and a collapse arrow.

## Fixed

- Inline capture: dates are now recognized only from colon markers
  (`scheduled:`, `due:`/`by:`/`deadline:`). The parser no longer scans the line
  for a bare date, so ordinary prose date words ("Discuss the March numbers",
  "Email report by friday") stay in the task title and are no longer mistaken for
  a date or stripped out. Use `scheduled:friday` to schedule from the line.
