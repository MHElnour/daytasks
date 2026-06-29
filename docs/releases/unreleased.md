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

- Inline capture: dates are now recognized only from colon markers
  (`scheduled:`, `due:`/`by:`/`deadline:`). The parser no longer scans the line
  for a bare date, so ordinary prose date words ("Discuss the March numbers",
  "Email report by friday") stay in the task title and are no longer mistaken for
  a date or stripped out. Use `scheduled:friday` to schedule from the line.
