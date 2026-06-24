# DayTasks Architecture

DayTasks is a small Obsidian task plugin built around a store-first model.
The plugin data store is the source of truth; daily notes are a readable,
editable projection of the task data.

## Core Shape

```text
TaskStore
  -> TaskIndex
  -> DailyNoteSync
  -> Task cards
  -> Local HTTP API
```

## Boundaries

- `core/` owns task data, IDs, persistence contracts, and in-memory indexes.
- `obsidian/` wraps Obsidian-specific file and plugin-data APIs.
- `daily-notes/` formats, parses, and syncs task lines in daily notes.
- `detail-notes/` creates or opens optional full markdown notes for a task.
- `ui/` renders task cards and views from core task objects.
- `commands/` connects Obsidian commands to services.
- `api/` exposes the same task operations to localhost clients such as a browser extension.
- `settings/` owns user-configurable plugin options.

## Source of Truth

The task store is canonical. Daily notes should not be the only database.
Each rendered daily-note line includes the stable task ID so it can be synced
back to the stored task definition.

Example daily-note projection:

```markdown
## Tasks

- [ ] Buy milk <!-- TSK-8cA562sd -->
- [x] Send proposal <!-- TSK-GJM4c42e -->
```

## First Milestone

The first working version should create a task, assign a stable `TSK-xxxxxxxx`
ID, save it to plugin data, append it to today's daily note, and show today's
tasks as cards.
