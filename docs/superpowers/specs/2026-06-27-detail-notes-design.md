# Detail notes for tasks — design spec (private, pre-approved)

Private working note in `docs/private/` (git-excluded). Approved design; ready to
execute on a fresh branch. Companion: `detail-notes-plan.md` (tasks),
`detail-notes-kickoff.md` (how to run it).

Date: 2026-06-27. Target release: **0.7.0** (minor). Branch: `feat/detail-notes`.

## Goal

Activate per-task **detail notes**: a real markdown note linked to a task, with
plugin-managed YAML frontmatter that stays in sync with the task, and the task's
**subtasks shown as an injected, interactive widget** (the same machinery as the
daily-note widget, scoped to that task). Add a rail control + kebab actions to
create/open the note, consistent across collapsed/expanded cards and the Task
List view.

Today detail notes are **stubbed**: `DayTask.detailNotePath` + the settings
(`detailNotesFolder`, `createDetailNoteByDefault`) + a modal "Create detail note"
toggle exist, but the toggle sets a dead `CreateDayTaskInput.detailNote` boolean
that nothing reads, `src/detail-notes/detailNoteService.ts` is an empty stub, and
no file is ever created. This feature makes it real.

## The note file

Path: `<detailNotesFolder>/<sanitized-title>-<taskId>.md` (folder from settings,
default `DayTasks/Tasks`; create the folder if missing; sanitize the title to a
safe filename; `taskId` guarantees uniqueness).

The file has exactly two zones:

- **Managed** (plugin owns): the YAML **frontmatter** only.
- **User** (never touched): the entire body below the frontmatter.

There is **no managed body markdown** — the subtasks are not written into the
file; they are shown via an injected live widget (below). So sync only ever
touches frontmatter, and the user's body is always preserved.

### Frontmatter (managed keys)

Emitted in this order; keys marked `?` only when the task has a value:

```yaml
title: <task.title>
status: <task.status>
priority: <task.priority>?        # omit if unset
scheduled: <task.scheduledDate>
due: <task.dueDate>?
contexts: [<task.contexts…>]?     # omit if empty
projects: ["[[<basename>]]"…]?    # wikilinks, omit if empty
estimate: <task.estimateMinutes>? # minutes, omit if unset
parentId: <task.parentId>?        # omit if no parent
taskId: <task.id>
taskCreated: <task.createdAt>
dateCreated: <note creation, local-offset ISO ms>
dateModified: <note last managed-write, local-offset ISO ms>
tags:
  - <task.tags…>                  # includes the default "daytask"
```

`taskId` is the canonical link from note → task (used for injection detection and
sync). `MANAGED_FM_KEYS` is the fixed list of keys the plugin sets/overwrites;
any other frontmatter keys the user adds are preserved untouched.

`dateCreated`/`dateModified` are the **note's own** timestamps (distinct from the
task's `createdAt`/`updatedAt`), formatted with the local UTC offset and
milliseconds, e.g. `2026-06-27T18:18:47.717+03:00`.

## Sync model (one-way: task → note frontmatter)

- After any task change, a **debounced** pass re-syncs every task that has a
  `detailNotePath`: it recomputes the managed frontmatter and, **only if any
  managed value changed**, writes it via Obsidian's
  `app.fileManager.processFrontMatter(file, fm => …)` — setting the managed keys,
  bumping `dateModified`, and leaving non-managed keys and the body intact
  (diff-guarded: no write when nothing changed, so no spurious `dateModified`
  churn).
- If the file is missing (user deleted it), sync skips it.
- Sync is one-way. The subtasks' interactivity (mark done) happens through the
  injected widget → the real task, not by editing the note text.

## Injected subtask widget

The daily-note widget is already an injected live view: a CodeMirror Live-Preview
extension (`dailyTasksLivePreviewExtension`) + a reading-mode injector
(`injectReadingView`), both routing through the plugin's `renderWidgetInto`,
which today renders only for daily notes.

Extend that single render path to also handle **detail notes**:

1. **Detection**: for the note being rendered, read its frontmatter `taskId`
   (`app.metadataCache.getFileCache(file)?.frontmatter?.taskId`). If a task with
   that id exists in the index, it's a detail note.
2. **Render**: inject a widget showing **that task's subtasks** (its child
   forest) as the same interactive cards, reusing `renderTaskCard` and the
   existing card handlers (status cycle / priority / edit / open / collapse /
   menu). A small header ("Subtasks") instead of the daily header. Built from a
   new `createSubtaskWidgetModel(parentTask, getChildren, …)` that reuses the
   existing card view-model + forest logic, scoped to the parent's descendants.
3. Clicking a subtask's status cycles it → updates the real task → re-render +
   the debounced frontmatter sync runs. Fully interactive, always in sync.

A daily note renders the daily widget; a detail note renders the subtask widget;
all other notes render nothing — decided in `renderWidgetInto`.

## Creation & open

- **On task create**: the modal's "Create detail note" toggle now actually:
  create the note (frontmatter + empty body), set `task.detailNotePath`
  (new `DayTaskService.setDetailNotePath`), open it in a new main tab.
- **For an existing task without one**: ⋮ kebab → **"Create detail note"**.
- **Open**: rail control + kebab "Open detail note" → `openLinkText(detailNotePath,
  "", false)` (reveal/new tab). If the file is missing → notice + clear
  `detailNotePath` (card reverts to "Create detail note").

## Card UI (consistent everywhere)

- **Rail 5th control**: when `card.hasDetailNote`, a `file-text` icon button
  appears in `renderRailTop` **immediately before the ⋮ menu**; click →
  `onOpenDetailNote(taskId)`. Because the rail is shared, it shows on **both
  collapsed and expanded** cards and in the **Task List view** automatically.
- **⋮ kebab** (built once in the host's `openTaskMenu`, used by daily widget +
  list view): `Edit` · `Delete` · then **"Open detail note"** (has one) or
  **"Create detail note"** (none). Same method → consistent across views.

`TaskCardViewModel` gains `hasDetailNote: boolean` (`task.detailNotePath != null`).

## Settings

Un-reserve the two existing settings (drop the "reserved" copy):
`detailNotesFolder` (folder for new detail notes) and `createDetailNoteByDefault`
(modal toggle default). **No template setting** (explicitly out).

## Architecture / files

- Create: `src/detail-notes/detailNoteFrontmatter.ts` (pure: build managed FM +
  `MANAGED_FM_KEYS`), `src/ui/subtaskWidget.ts` (pure: `createSubtaskWidgetModel`).
- Implement: `src/detail-notes/detailNoteService.ts` (VaultPort + create + sync).
- Modify: `src/core/task.ts` (no change to fields), `src/core/dayTaskService.ts`
  (`setDetailNotePath`), `src/ui/taskCard.ts` (`hasDetailNote`),
  `src/obsidian/widgetRenderer.ts` (detail-note rail control + handler +
  subtask-widget render or reuse), `src/obsidian/livePreview.ts` /
  reading-injection + `src/main.ts` (vault port, service wiring, create/open,
  kebab, debounced sync, detail-note detection in `renderWidgetInto`),
  `src/settings/settings.ts` + `settingsTab.ts` (un-reserve).

## Testing

- Pure unit tests: frontmatter builder (every field incl. omit-when-empty,
  wikilink projects, parentId, tags, the two note timestamps); `MANAGED_FM_KEYS`;
  `DetailNoteService.create`/`sync` over a fake VaultPort (folder ensure, filename
  sanitize, frontmatter set, diff-guard no-write, preserve non-managed keys,
  missing-file skip); `createSubtaskWidgetModel` (children → cards, nesting);
  `setDetailNotePath`; renderer detail-note control (present when hasDetailNote,
  before the menu, calls handler; absent otherwise).
- Manual (in-vault, obsidian CLI): toggle-on create → note opens with
  frontmatter; kebab Create/Open; edit task (status/tags/subtask) → note
  frontmatter re-syncs (dateModified bumps, body preserved); open a detail note →
  injected interactive Subtasks widget; click a subtask done → task + note update;
  delete the file → graceful; collapsed + expanded + Task List view all show the
  rail control + menu items.

## Non-goals (v1)

Template-based creation; two-way text sync (editing the note's markdown to change
the task); detail notes for the task itself rendered in the body; per-note
frontmatter customization beyond the managed keys.
