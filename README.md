# DayTasks

A lightweight day-first task plugin for Obsidian.

The design is store-first:

```text
plugin task store
  -> task index
  -> daily note widget
  -> task cards with tags and projects
  -> localhost API
```

Daily notes are the main workspace, but the plugin task store remains the
source of truth. Stable `TSK-xxxxxxxx` IDs let task cards, optional detail
notes, project links, and the API all point at the same task.

See `docs/architecture.md` and `docs/milestones.md` for the initial direction.
