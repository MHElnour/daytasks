# Troubleshooting

Use this page when DayTasks behaves unexpectedly in Obsidian.

## The Daily-Note Widget Is Missing

Check:

- the note filename starts with a valid `YYYY-MM-DD` date;
- the note is inside the configured daily-note folder, or the folder setting is
  empty;
- **Show daily note widget** is enabled;
- the plugin is enabled after the latest build or install.

If the Obsidian CLI is available:

```bash
obsidian vault=daytask-vault plugin:reload id=daytasks
obsidian vault=daytask-vault dev:errors
obsidian vault=daytask-vault eval code="app.plugins.plugins.daytasks ? 'daytasks-loaded' : 'missing'"
```

## A Task Cannot Be Created From The Command

The `Create task for current daily note` command only works when the active file
is a recognized daily note. Open a note named like `2026-06-25.md`, then run the
command again.

## Detail Note Creation Fails

Check the **Detail notes folder** setting. DayTasks creates missing folders, but
the path still needs to be a valid vault path after template expansion.

If a detail note path already exists, DayTasks chooses the next available name.
If creation still fails, run `dev:errors` and check for a vault permission or
filesystem error.

## Stored Tasks Were Skipped On Load

DayTasks shows a notice if stored task entries cannot be decoded. This usually
means `data.json` was edited manually or came from an older broken state.

Before making more changes, back up the vault and the plugin data file. Then
inspect the warning count and compare against the latest backup.

## Task List Filters Look Wrong

The Task List view persists filter, group, sort, collapsed-group, and expanded
card state. Clear the filters in the view first. If the state still looks wrong,
disable and re-enable the plugin after running a fresh build.

## Build Or Install Fails

Run the normal local gate:

```bash
npm run check
npm run build
npm run build:test
```

If `build:test` succeeds, reload the plugin in Obsidian and run the CLI error
check above.
