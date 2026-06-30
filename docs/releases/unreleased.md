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

- **The daily-note task widget no longer overlaps the note text after an external
  change.** When a note that was open in Live Preview changed on disk — a git
  pull, an external sync, or any edit from outside the editor — the widget could
  be left sitting on top of the note text until you closed and reopened the note.
  It now re-measures and repositions itself when the editor re-renders, so it
  stays below your content.
