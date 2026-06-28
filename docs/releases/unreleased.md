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

- **The daily-note task widget no longer triggers a ResizeObserver feedback loop
  in Live Preview.** Its bottom spacing was recalculated *and* rewritten on every
  editor frame; that rewrite resized the note and fed CodeMirror's own resize
  observer, which looped back into another recalculation — flooding the developer
  console with *"ResizeObserver loop completed with undelivered notifications"*
  warnings and forcing a layout reflow on every keystroke and scroll. The spacing
  is now rewritten only when it actually changes, so the loop is gone and editing
  near the widget is lighter.
