# DayTasks Architecture

DayTasks is a small Obsidian task plugin built around a store-first model.
The plugin data store is the source of truth; daily notes are the place where
tasks are created and reviewed through an injected widget.

## Core Shape

```text
TaskStore
  -> TaskIndex
  -> DailyNoteWidget
  -> TaskCards
  -> Local HTTP API
```

## Boundaries

- `core/` owns task data, IDs, persistence contracts, and in-memory indexes.
- `obsidian/` wraps Obsidian-specific file and plugin-data APIs.
- `daily-notes/` understands daily-note dates and keeps optional markdown-line helpers.
- `detail-notes/` creates or opens optional full markdown notes for a task.
- `ui/` turns tasks into card and daily-widget view models.
- `commands/` connects Obsidian commands to services.
- `api/` exposes the same task operations to localhost clients such as a browser extension.
- `settings/` owns user-configurable plugin options.

## Source of Truth

The task store is canonical. Daily notes should not be the only database, and
v0 does not need to write a `## Tasks` section into the note body. Instead, the
plugin detects the active daily note date, queries the task index, and renders a
bottom-of-note widget from stored tasks.

Example widget model:

```text
Daily note: Daily/2026-06-24.md
Widget date: 2026-06-24
Cards:
  - Buy milk
    id: TSK-8cA562sd
    tags: errand, home
    projects: Projects/Home.md
```

## First Milestone

The first working version should create a task, assign a stable `TSK-xxxxxxxx`
ID, save it to plugin data, index it by date, tags, and project links, and show
the day's tasks as cards in an injected daily-note widget.
