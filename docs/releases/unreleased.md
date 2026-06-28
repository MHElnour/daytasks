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

- **Better theme support.** The warm surface tint is now a single overridable CSS
  variable, and the success/error/estimate colors fall back to Obsidian theme
  variables instead of fixed hex — so DayTasks tracks dark and high-contrast
  themes more faithfully.
- **Settings:** the reserved API section heading is now simply *API*.

## Fixed

- **Collapsed task cards keep the due date visible.** When a task has a detail
  note (a fifth control on the row), the card now reserves room for every control
  so the due date is no longer clipped. The task id and due date use a smaller,
  consistent size, and the id now picks up the theme's accent color.
- **Visible keyboard focus.** The Task List filter controls and the project/tag
  chips show a focus outline when you tab to them, and the group collapse/expand
  button has an accessible name for screen readers.
- **Creating a detail note no longer fails when both candidate filenames are
  taken.** If `<title>.md` and the `<title>-<id>.md` fallback both already exist,
  DayTasks now picks the next free name instead of erroring and leaving the task
  without its note.
- **Editing or syncing a task no longer overwrites an unrelated note.** If a
  task's detail-note link points at a file that now belongs to a different task
  (moved or replaced), DayTasks leaves that note's properties untouched.
- **The daily-note task widget now works in popped-out windows and split
  panes.** It is built against the note's own window, so it renders and sizes
  correctly even when that note isn't the focused one.
- **Task List view filters and layout survive a quick disable/reload.** Pending
  view-state is saved when the plugin unloads instead of being dropped, and
  scheduled refreshes no longer run after the plugin is gone.

## Security

- **Detail-note folders stay inside your vault.** A *Detail notes folder* setting
  containing `..` (for example `../Outside`) can no longer write notes outside the
  vault — paths are normalized and traversal segments are dropped.
- **Unreadable tasks are no longer silently discarded.** If stored data contains
  task entries DayTasks can't read, it now shows a notice with how many were
  skipped, so a later save doesn't quietly erase them. Back up your data before
  making changes if you see this.
