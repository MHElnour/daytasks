# DayTasks

A lightweight day-first task plugin for Obsidian.

The design is store-first:

```text
plugin task store
  -> task index
  -> daily note projection
  -> task cards
  -> localhost API
```

Daily notes are the main workspace, but stable `TSK-xxxxxxxx` task IDs and the
plugin task store remain the source of truth.

See `docs/architecture.md` and `docs/milestones.md` for the initial direction.
