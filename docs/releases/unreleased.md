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

- **Task List view** — a new view that shows **all** your tasks across days in
  one place, not just the current daily note. Open it from the ribbon icon
  ("DayTasks: task list") or the "Open task list" command.
  - **Filter** by status, by date (Today / Overdue / Next 7 days), by tag /
    context / project, and by a free-text search over title + description.
  - Tags, Contexts and Projects are **searchable dropdowns**, so they stay
    usable even with hundreds of values.
  - **Group** the list by Status, Scheduled date, or Project (collapsible
    sections with counts), and **sort** by scheduled / due / priority / created /
    title in either direction.
  - Tasks use the same cards as the daily view (collapsed rows that expand), with
    due dates and ids aligned in tidy columns.
  - Your filter, group, and sort choices are remembered between sessions, and the
    list updates live as you create, edit, or complete tasks.

**Full Changelog**: <https://github.com/MHElnour/daytasks/compare/0.5.0...0.6.0>
