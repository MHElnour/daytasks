---
id: detail-notes
title: Detail Notes
type: design
status: closed
opened: 2026-06-27
closed: 2026-06-27
area:
  - core
  - ui
  - detail-notes
  - obsidian
---

# Detail Notes Design

Date: 2026-06-27 — shipped in **0.7.0**.

Per-task **detail notes**: a real markdown note linked to a task, with
plugin-managed YAML frontmatter that stays in sync with the task, and the task's
**subtasks shown as an injected, interactive widget** (the same machinery as the
daily-note widget, scoped to that task). Create/open via a rail control + kebab
actions, consistent across collapsed cards, expanded cards, and the Task List
view.

Before 0.7.0 these were stubbed: `DayTask.detailNotePath`, the two settings, and a
modal toggle existed, but the toggle set a dead boolean and no file was ever
created. This feature makes it real.

## The note file

Path: `<detailNotesFolder>/<sanitized-title>-<taskId>.md` (folder from settings,
default `DayTasks/Tasks`; the folder is created if missing; the title is sanitized
to a safe filename; `taskId` guarantees uniqueness).

Two zones, strictly separated:

- **Managed** (plugin owns): the YAML **frontmatter** only.
- **User** (never touched): the entire body below the frontmatter.

There is **no managed body markdown** — subtasks are not written into the file;
they are shown via an injected live widget. So sync only ever touches frontmatter,
and the user's body is always preserved.

### Managed frontmatter

Emitted in a fixed key order, optional keys omitted when empty:
`title, status, priority?, scheduled, due?, contexts?, projects?, estimate?,
parentId?, taskId, taskCreated, dateCreated, dateModified, tags`. `projects` are
emitted as `["[[basename]]"]` wikilinks. `taskId` is the canonical note→task link
(used for injection detection and sync). `MANAGED_FM_KEYS` is the fixed list the
plugin sets/overwrites; any other keys the user adds are preserved.

`dateCreated`/`dateModified` are the note's own timestamps (distinct from the
task's `createdAt`/`updatedAt`), formatted with the local UTC offset and
milliseconds, e.g. `2026-06-27T18:18:47.717+03:00` (`localIso`).

## Sync model (one-way: task → note frontmatter)

After any task change, a **debounced** pass re-syncs every task that has a
`detailNotePath`: it recomputes the managed frontmatter and, **only if a managed
value changed**, writes it via `app.fileManager.processFrontMatter` — setting the
managed keys, bumping `dateModified`, preserving `dateCreated`, non-managed keys,
and the body. The pass is **diff-guarded** (`dateModified` is excluded from the
change comparison), so unchanged notes are never rewritten and there is no
timestamp churn or write-loop. A missing file is skipped. Sync is one-way;
subtask interactivity flows through the injected widget to the real task, not by
editing the note text.

## Injected subtask widget

The daily-note widget is already an injected live view (a CodeMirror Live-Preview
extension + a reading-mode injector, both routing through `renderWidgetInto`). That
single render path was extended: `renderWidgetInto` keeps the daily-note branch
first, then detects a **detail note** by reading the rendered note's frontmatter
`taskId` and resolving it to an indexed task. For a detail note it renders a
**Subtasks** widget — the task's child forest as the same interactive cards
(`createSubtaskWidgetModel` reuses `createDailyTasksWidgetModel`/`buildTaskForest`,
seeded with the parent's descendants so direct children become roots). The
reading-mode gate and the Live-Preview re-render nudge were generalized from
daily-only to **widget-bearing (daily OR detail)**, so detail-note widgets stay
interactive and in sync in both modes.

## Card UI (consistent everywhere)

- **Rail control:** when a card `hasDetailNote`, a `file-text` button appears in
  the shared rail immediately before the ⋮ menu → opens the note. Because the rail
  is shared, it shows on collapsed cards, expanded cards, and the Task List view
  automatically.
- **⋮ kebab** (shared by daily widget + list view): `Edit · Delete · Open detail
  note` (has one) or `Create detail note` (none).

## Architecture / files

- Pure (Obsidian-free, unit-tested): `src/util/localIso.ts`,
  `src/detail-notes/detailNoteFrontmatter.ts` (`buildManagedFrontmatter` +
  `MANAGED_FM_KEYS`), `src/ui/subtaskWidget.ts` (`createSubtaskWidgetModel`, with a
  cycle-safe descendant walk).
- Service over a narrow port: `src/detail-notes/detailNoteService.ts`
  (`VaultPort` + `DetailNoteService.create`/`sync`; all YAML serialization is
  delegated to the port so the service stays Obsidian-free and the create/sync
  paths are symmetric).
- Host glue: `src/core/dayTaskService.ts` (`setDetailNotePath`),
  `src/ui/taskCard.ts` (`hasDetailNote`), `src/obsidian/widgetRenderer.ts` (rail
  control + handler), `src/main.ts` (VaultPort impl, create/open/missing-file,
  kebab, detail-note detection in `renderWidgetInto`, debounced sync), and the
  `settings` un-reserve. Rail-button CSS mirrors the kebab control.

## Non-goals (v1)

Template-based creation; two-way text sync (editing the note's markdown to change
the task); rendering the task itself in the note body; per-note frontmatter
customization beyond the managed keys.
