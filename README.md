# DayTasks

A lightweight day-first task plugin for Obsidian.

DayTasks is a personal, scoped task plugin. It keeps tasks in Obsidian plugin
storage and renders them inside daily notes through an injected bottom-of-note
widget. Daily notes are the workspace; the plugin store is the source of truth.

```text
plugin task store -> task index -> daily-note widget -> task cards
```

Stable `TSK-xxxxxxxx` IDs let task cards, optional detail notes, project links,
and future integrations point at the same task without turning every task into a
markdown note.

## Current Scope

The current product goal is a fully functioning Obsidian plugin:

- create, edit, complete, delete, and reschedule day-first tasks;
- show tasks in daily notes with status, due date, tags, contexts, projects, and
  estimates;
- keep task data normalized in plugin storage;
- make manual Obsidian testing easy.

API and browser-extension work are intentionally out of scope until the
Obsidian experience is solid.

## Documentation

- Start with [docs/index.md](docs/index.md).
- Architecture lives in [docs/development/architecture.md](docs/development/architecture.md).
- Testing workflow lives in [docs/development/testing.md](docs/development/testing.md).
- Work tracking and audit follow-ups live in [issue-analysis/README.md](issue-analysis/README.md).

## Development

```bash
npm run check
npm run build
npm run build:test
```

To install the built plugin into a vault:

```bash
npm run install-plugin -- /path/to/Vault
```
