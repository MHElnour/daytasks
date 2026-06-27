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

## Added

- **Detail notes** — give any task a real markdown note that stays linked to it.
  - Turn on **Create detail note** in the task modal to make one when you create a
    task, or use the **⋮ menu → Create detail note** on any existing task. The note
    opens in a new tab.
  - Open an existing note again from the new **file-text icon** on the card rail
    (shown on collapsed cards, expanded cards, and in the Task List view) or the
    **⋮ menu → Open detail note**.
  - The note's **frontmatter is managed for you** — title, status, priority,
    dates, contexts, projects, estimate, tags, and ids stay in sync with the task
    automatically. The rest of the note body is yours and is never touched.
  - Opening a detail note shows an interactive **Subtasks** panel: the task's
    subtasks render as the same cards you use elsewhere, and cycling a subtask's
    status updates the real task (and every open view) instantly.
  - If you delete a detail note's file, opening it again clears the stale link so
    the card reverts to offering **Create detail note**.

## Changed

- The **Detail notes folder** and **Create detail note by default** settings are
  now active (previously reserved). The folder (default `DayTasks/Tasks`) is where
  new detail notes are created.

**Full Changelog**: <https://github.com/MHElnour/daytasks/compare/0.6.0...0.7.0>
