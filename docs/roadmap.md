# Roadmap

DayTasks is focused on becoming a complete Obsidian daily-note task plugin. API
and browser-extension work are intentionally deferred.

## Current Position (0.2.0)

Shipped:

- Core: generated `TSK-xxxxxxxx` ids; plugin-store persistence with a validating
  decoder; in-memory index by id, date, status, parent, tag, context, and
  project; configurable status and priority model.
- Daily notes: detection with strict calendar-date validation; Live Preview and
  reading-mode widget injection.
- Tasks: create, edit, delete; completion and status cycling; scheduled/due
  dates, tags, contexts, projects, estimate, description; status summary footer.
- Cards: Lucide icons for status, priority, scheduled, due, and estimate
  (priority now shown on cards).
- Editor: compact two-box modal with an icon toolbar (status and priority
  menus, inline date and estimate inputs); multiple project links; a due date
  cannot precede the scheduled date; reserved placeholders for subtasks and
  dependencies.
- Engineering: two-pass code audit closed (35 findings); 175 unit tests; a local
  two-step release flow; markdownlint.

## Active: relationships

The editor already has the placeholders laid out for these.

- Subtasks (parent/child): link and add subtasks, nested display, progress
  count. The model already carries `parentId` and orphans children on delete.
- Blocked by / blocking: a dependency model with cycle prevention, plus the UI.

## Next Milestone: Obsidian Completion

- Detail notes: create a markdown detail note on request, write the task id,
  store `detailNotePath`, and open it from the task UI. The "Create detail note"
  toggle is a stub until this lands.
- Status settings editor: edit, add, and remove statuses (label, value, color,
  completed flag, order). `StatusManager.validate()` already guards saves; the
  editing UI is missing.
- Remove dishonest UI: hide or implement controls that point at stubs (the
  detail-note toggle and the inactive API settings).

## Later

- Manual ordering with `sortOrder`.
- Time tracking inside Obsidian.
- Pomodoro inside Obsidian.
- Local API.
- Browser extension.

Do not start API or browser-extension work until the Obsidian workflow is fully
functional and tested.
