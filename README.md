# DayTasks

A lightweight, day-first task manager for your Obsidian daily notes.

![DayTasks daily-note widget](https://raw.githubusercontent.com/MHElnour/daytasks/main/docs/assets/daily-note-widget.png)

DayTasks is for people who plan from daily notes and want more structure than
plain Markdown checkboxes. It renders task cards inside your daily notes, keeps
the canonical task data in local Obsidian plugin storage, and gives you a Task
List view for reviewing work across days.

Your daily note stays yours: DayTasks does not write a managed `## Tasks`
section into the note body. When a task needs more context, you can create an
optional Markdown detail note; DayTasks manages the task frontmatter and leaves
the note body to you.

```text
plugin task store -> task index -> daily-note widget -> task cards
```

## Install

DayTasks is available from Obsidian Community Plugins.

1. Open `Settings -> Community plugins` in Obsidian.
2. Select `Browse` and search for `DayTasks`.
3. Install DayTasks, then enable it.

Requirements:

- Obsidian `1.8.0` or newer.
- Desktop Obsidian. DayTasks is currently marked `isDesktopOnly`.
- English UI.

To install manually from GitHub, download `manifest.json`, `main.js`, and
`styles.css` from the [latest release](https://github.com/MHElnour/daytasks/releases/latest),
then copy them into:

```text
<vault>/.obsidian/plugins/daytasks/
```

## Quick Start

1. Open a daily note whose filename starts with `YYYY-MM-DD`, such as
   `2026-06-25.md`.
2. Create a task from the widget at the bottom of the daily note, or run
   `Create task for current daily note` from the command palette.
3. Use the task card to complete, edit, reorder, collapse, cycle status,
   cycle priority, or create a detail note.
4. Open the Task List view from the ribbon icon or the `Open task list`
   command to review tasks across days.
5. Configure defaults in `Settings -> Community plugins -> DayTasks`.

## Features

- **Daily-note widget** for Live Preview, reading mode, split panes, and
  popped-out windows.
- **Task cards** with status, priority, scheduled date, due date, tags,
  contexts, project links, estimates, descriptions, and manual ordering.
- **Task List view** for all tasks across days, with filtering, grouping,
  sorting, text search, and persisted view state.
- **Subtasks** as real task records, not checklist text, with nested cards and
  parent progress.
- **Dependencies** with blocked-status behavior and cycle prevention.
- **Optional detail notes** with managed task frontmatter and user-owned
  Markdown bodies.
- **Configurable defaults** for status, priority, tags, project link, detail
  note behavior, and detail note folders.
- **Theme-aware and accessible UI** using Obsidian theme variables, keyboard
  focus states, and named icon controls.

## Screenshots

**Task List view** shows every task across days in one place, filterable by
status, date, tag, context, project, and search text.

![Task List view](https://raw.githubusercontent.com/MHElnour/daytasks/main/docs/assets/task-list-view.png)

**Create and edit tasks** from one dialog with scheduling, priority, due date,
estimate, tags, contexts, project links, subtasks, dependencies, and detail
note options.

![Edit task dialog](https://raw.githubusercontent.com/MHElnour/daytasks/main/docs/assets/edit-modal.png)

**Commands** let you open the Task List or create a task for the current daily
note straight from the command palette.

![DayTasks commands in the command palette](https://raw.githubusercontent.com/MHElnour/daytasks/main/docs/assets/commands.png)

**Detail notes** give a task a normal Markdown note. DayTasks manages the task
frontmatter and injects an interactive subtasks widget; the note body remains
yours.

![Detail note managed frontmatter](https://raw.githubusercontent.com/MHElnour/daytasks/main/docs/assets/detail-note-properties.png)

![Detail note injected subtasks widget](https://raw.githubusercontent.com/MHElnour/daytasks/main/docs/assets/detail-note.png)

**Settings** control daily-note detection, card metadata, task defaults, and
detail-note behavior.

![DayTasks settings](https://raw.githubusercontent.com/MHElnour/daytasks/main/docs/assets/settings.png)

## Data And Privacy

DayTasks is local-first. It stores task records through Obsidian plugin storage
and writes optional detail notes inside your vault when you ask it to create
them.

DayTasks does not send task data to a server, does not implement sync, and does
not write managed task lists into daily-note bodies. Optional detail notes are
normal Markdown files; DayTasks manages task frontmatter and preserves the note
body plus non-managed frontmatter keys.

See [Core concepts](docs/core-concepts.md) and [Privacy](docs/privacy.md) for
details.

## Current Scope

DayTasks is intentionally focused on the desktop Obsidian daily-note workflow.
Sync, mobile, and multilingual work are not part of the current release scope; a
local API and a browser extension are out of scope.

## Documentation

- [Documentation index](docs/index.md)
- [Core concepts](docs/core-concepts.md)
- [Features](docs/features.md)
- [Settings](docs/settings.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Privacy](docs/privacy.md)
- [Roadmap](docs/roadmap.md)

Development docs:

- [Architecture](docs/development/architecture.md)
- [Testing](docs/development/testing.md)
- [Security and data safety](docs/development/security-and-data-safety.md)
- [Release process](docs/development/release-process.md)

## Support

- **Bug or feature request?**
  [Open an issue](https://github.com/MHElnour/daytasks/issues/new/choose).
- **Question, idea, or setup discussion?**
  [Start a discussion](https://github.com/MHElnour/daytasks/discussions).

When reporting a bug, include your DayTasks version, Obsidian version, steps to
reproduce, and any console errors. Open the developer console with
`Ctrl`/`Cmd`+`Shift`+`I`, reproduce the issue, and copy any DayTasks errors.

## Development

Install dependencies, then run the local gate:

```bash
npm install
npm run check
```

Useful commands:

```bash
npm run check
npm run lint
npm run lint:md
npm run build
npm run build:test
```

To install the built plugin into a vault:

```bash
npm run install-plugin -- /path/to/Vault
```

## Release

Releases are bumped and tagged locally, then GitHub Actions builds, attests, and
publishes the release assets.

```bash
npm run release -- patch   # bump, check, build, roll notes, commit, tag
npm run release:publish    # push the tag -> CI builds, attests, publishes
```

See [Release process](docs/development/release-process.md) for details.

## License

[MIT](LICENSE)
