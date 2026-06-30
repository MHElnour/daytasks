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
  change.** Pulling, syncing, or pasting into a note open in Live Preview could
  briefly leave the widget sitting on top of your last lines for a second or two
  before it settled into place. The widget is now drawn as a native editor block
  that flows directly below your text, so it can't drift out of position — the
  overlap is gone, with no flicker while the layout settles.
