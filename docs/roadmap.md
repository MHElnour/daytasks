# Roadmap

DayTasks is currently focused on becoming a complete Obsidian daily-note task
plugin. API and browser-extension work are intentionally deferred.

## Current Position

Implemented:

- generated `TSK-xxxxxxxx` task IDs;
- plugin-store persistence;
- in-memory task index by ID, date, status, parent, tag, context, and project;
- daily-note detection;
- Live Preview and reading-mode widget injection;
- task creation/edit modal;
- task delete;
- completion checkbox and status cycling;
- configurable status model in core;
- task metadata on cards: due date, tags, contexts, projects, estimate,
  description, status summary.

## Next Milestone: Obsidian Completion

Goal: remove dishonest UI and finish the features already visible in Obsidian.

- Hide or implement any UI that currently points to a stub.
- Finish optional detail notes:
  - create markdown detail note when requested;
  - write task ID in frontmatter;
  - store `detailNotePath`;
  - open existing detail note from the task UI.
- Finish status settings:
  - edit status label, value, color, completed flag, and order;
  - validate settings before save;
  - keep custom statuses working in cards, modal, footer, and completion logic.
- Improve creation/edit ergonomics:
  - preserve multiple projects;
  - keep scheduled date vs due date clear;
  - keep tags, contexts, project, estimate, and description reliable.

## Later

- Manual ordering with `sortOrder`.
- Time tracking inside Obsidian.
- Pomodoro inside Obsidian.
- Local API.
- Browser extension.

Do not start API or browser-extension work until the Obsidian workflow is fully
functional and tested.
