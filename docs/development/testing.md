# Testing And Debugging

Use this workflow after code changes.

## Baseline Checks

```bash
npm run typecheck
npm run test
npm run build
```

Or the combined local check:

```bash
npm run check
```

`npm run build` regenerates `styles.css`, typechecks, and builds `main.js`.
Coverage (v8):

```bash
npm run test:coverage
```

Tests run on Vitest with `environment: happy-dom` set globally in
`vitest.config.ts`, so DOM tests need no per-file annotation. Obsidian-coupled
files (`main.ts`, `settingsTab.ts`, `taskCreationModal.ts`, `livePreview.ts`,
`modals.ts`) can't load in the runner, so coverage shows 0% there — verify them
via `npm run build:test` + the Obsidian CLI instead.

## Install Into Obsidian

Install into the bundled local test vault:

```bash
npm run build:test
```

Install into a specific vault:

```bash
npm run build
npm run install-plugin -- /path/to/Vault
```

The plugin lands in:

```text
<vault>/.obsidian/plugins/daytasks/
```

## Obsidian CLI Smoke Checks

If the Obsidian desktop CLI is available and Obsidian is running:

```bash
obsidian vault=daytask-vault plugin:reload id=daytasks
obsidian vault=daytask-vault dev:errors
obsidian vault=daytask-vault eval code="app.plugins.plugins.daytasks ? 'daytasks-loaded' : 'missing'"
```

Useful manual inspection commands:

```bash
obsidian vault=daytask-vault dev:console
obsidian vault=daytask-vault dev:screenshot path=daytasks-screenshot.png
obsidian vault=daytask-vault eval code="app.vault.getFiles().map(f => f.path).filter(p => p.includes('2026')).slice(0, 10)"
```

If the CLI is not installed, run the build/install commands and reload the plugin
from Obsidian's Community Plugins UI.

## Manual Obsidian Test Script

1. Open a daily note named like `2026-06-25.md`.
2. Confirm the DayTasks widget appears at the bottom.
3. Click `+ New Task`.
4. Create a task with title, due date, tags, context, project, estimate, and
   description.
5. Confirm the card appears with the expected metadata.
6. Click the checkbox and confirm completion state changes.
7. Click the status pill and confirm status cycles.
8. Click the card, edit fields, save, and confirm the widget updates.
9. Delete a temporary task from the edit modal.
10. Run `obsidian vault=daytask-vault dev:errors` if the CLI is available.

## Focused Test Areas

- `tests/core/` - task model, service, factory, store, index, status manager.
- `tests/obsidian/` - data adapter, widget renderer, safe Obsidian adapters.
- `tests/ui/` - card and daily-widget view models.
- `tests/settings/` - settings merge and validation.
- `tests/util/` - parsing, date, CSS color, debounce, estimate helpers.

Prefer adding focused tests around pure logic before touching Obsidian glue.

`main.ts` and `settings/settingsTab.ts` import the Obsidian runtime and cannot
load in vitest, so they are intentionally not unit-tested. Their decision logic is
extracted into the pure, tested helpers above; what remains is API orchestration,
verified with `npm run build:test` and the Obsidian CLI smoke checks above.
