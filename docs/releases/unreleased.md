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

## Fixed

- Hardened the blocked-status release: a task is auto-returned to in-progress only
  when it was actually blocked, so a manually-set status is never overwritten when
  its last blocker completes.

**Full Changelog**: <https://github.com/MHElnour/daytasks/compare/0.4.0...0.4.1>
