---
id: card-icons-multi-project
title: Card Icons And Multi-Project (UI Slice A)
type: design
status: open
opened: 2026-06-25
closed:
area:
  - obsidian
  - ui
---

# Card Icons And Multi-Project (UI Slice A) Design

Date: 2026-06-25

First slice of a task-UI refresh. Two user-facing changes: Lucide icons on the
daily-note task card, and editing/displaying **multiple** project links in the
task modal. The data model already supports both — this slice is UI plus a small
view-model addition.

Later slices (separate specs): subtasks / parent-child (B), blocked-by / blocking
(C), and a custom icon dropdown for priority (deferred from here).

## Goals

- Card metadata (scheduled, due, estimate, priority) shows a Lucide icon instead
  of a text label prefix; priority is shown on the card for the first time.
- The task modal adds, removes, and displays multiple project links (not just the
  first), via the existing vault picker.
- The modal selects status through an icon picker (status icon + label).

## Non-goals (out of scope)

- Status icon on the card status pill — the pill stays dot + label (works today).
- Custom icon dropdown for priority / dates in the modal — keep native controls
  with a leading label icon (the "(ii)" rebuild is a later, self-contained slice).
- Project reordering / a "primary" project distinction — all linked projects are
  equal. (YAGNI; revisit if needed.)
- Subtasks and dependencies (slices B and C).

## Data model

No change. `DayTask.projects: ProjectLink[]`, `StatusConfig.icon`, and
`PriorityConfig.icon` already exist. `PriorityConfig` defaults have no `icon`; the
card falls back to a generic icon when unset.

## Card (display)

`src/ui/taskCard.ts` (view model) and `src/obsidian/widgetRenderer.ts` (DOM).

### View model additions (`TaskCardViewModel`)

Add, resolved from `PriorityConfig` via `StatusManager`/settings:

- `priorityLabel?: string` — the priority's `label` (e.g. "Normal").
- `priorityColor?: string` — `safeCssColor(config.color, "var(--text-muted)")`.
- `priorityIcon?: string` — `config.icon ?? "flag"`.

Priority fields are only set when the task has a priority. `createTaskCardViewModel`
needs the priorities config, which nothing threads to the card today. Add a
`priorities: PriorityConfig[]` parameter and thread it:
`main` (has `settings`) → `DailyTasksWidgetController` deps (new `priorities`) →
`createDailyTasksWidgetModel(date, tasks, statusManager, referenceDate, priorities)`
→ `createTaskCardViewModel(task, statusManager, referenceDate, priorities)`. The
card looks up the task's priority by `value` to resolve label/color/icon. No new
manager class (YAGNI).

### Renderer changes

`renderMetadata` gains an icon per item. Each icon is an **empty placeholder
span** the renderer cannot fill (Obsidian-only API), so it stamps an attribute:

```html
<span class="task-card__meta-icon" data-icon="calendar" aria-hidden="true"></span>
```

Icon names (Lucide, bundled in Obsidian):

| Field | Icon | Tint |
|-------|------|------|
| Scheduled | `calendar` | — |
| Due | `calendar-clock` | `is-overdue` keeps its color |
| Estimate | `clock` | — |
| Priority (new) | `priorityIcon` | `priorityColor` via `--chip-color` |

The `Due:` / `Scheduled:` / `Est:` text prefixes are removed (the icon replaces
them); the value text stays. Priority renders as `[icon] Normal`.

All projects render: `renderMetadata` loops `card.projects` (it already holds the
full array) rather than implicitly using the first.

The renderer stays pure DOM (`document.createElement` via the local `el()`
helper) so it remains unit-testable without the Obsidian runtime — a deliberate
deviation from Obsidian rule 35 (`createEl`), justified by the test strategy.

### Icon application (Obsidian layer)

`setIcon` only exists at runtime. After `renderDailyTasksWidget` returns, the
Obsidian caller fills placeholders once:

```ts
container.querySelectorAll<HTMLElement>("[data-icon]").forEach((el) => {
  const name = el.getAttribute("data-icon");
  if (name) setIcon(el, name);
});
```

This runs in `main.ts` `renderWidgetInto`, which both Reading mode and Live
Preview already route through, so there is a single application point. `setIcon`
is imported from `obsidian`.

## Modal

`src/obsidian/taskCreationModal.ts`. The modal is Obsidian-coupled (not unit
tested — verified via `build:test` + CLI per the audit's P2-10 strategy).

### Status picker

Replace the native status `<select>` with a button that shows the current
status's icon + label and opens an Obsidian `Menu`:

- Button: `aria-haspopup="menu"`, `aria-label` "Status: {label}", shows
  `setIcon(iconSpan, statusIcon)` + label text; updates on change.
- `Menu`: one `addItem` per `settings.statuses`, each `.setIcon(status.icon)` +
  `.setTitle(status.label)`; on click sets `this.status` + refreshes button +
  preview. `Menu` provides keyboard navigation natively.

### Multiple projects

`this.projectPath: string` becomes `this.projects: ProjectLink[]`.

- On open in edit mode: `this.projects = initial.projects.map((p) => ({ ...p }))`
  (all of them). This supersedes the `applyPrimaryProjectEdit` single-field
  workaround; that helper/usage is removed from the modal (its tests can go too,
  or stay as core coverage — implementation decides).
- A "Projects" section renders one row per linked project: the note basename (or
  path) + a remove button (`aria-label` "Remove project").
- "Add project" button opens `MarkdownPathSuggestModal` (the existing picker); on
  choose, `this.projects = mergeUniqueProjects(this.projects, [{ path }])`
  (existing, tested helper) and the section re-renders. Repeatable.
- Submit: `input.projects = this.projects.length ? [...this.projects] : undefined`.
- Preview line lists each `+path`.

### Label icons

Status/Priority/Scheduled/Due settings get a small leading Lucide icon
(`setIcon` into a span prepended to the setting's `nameEl`). Decorative; the label
text remains.

## Accessibility (mandatory)

- Status picker button: `aria-haspopup`, `aria-label`; reachable + operable by
  keyboard (the `Menu` handles arrows/Enter/Escape).
- Project rows: remove button is a real `<button>` with `aria-label`.
- Card meta-icons are decorative (`aria-hidden="true"`) — the value text and
  existing chip activation carry meaning.
- Focus indicators via `:focus-visible` + Obsidian CSS variables; interactive
  targets ≥ 44×44px.
- UI text in sentence case ("Add project", "Remove project").

## CSS

`styles/task-card.css` (and `styles/widget.css` if needed): a `.task-card__meta`
layout that aligns `.task-card__meta-icon` + value inline; a `.task-card__priority`
chip tinted via `--chip-color`. Modal project rows + status-picker button styles.
Obsidian CSS variables only; no `!important`; scoped to plugin containers. The
`build-css.mjs` step concatenates `styles/` into `styles.css`.

## Testing

Unit (vitest, pure modules):

- `tests/ui/taskCard.test.ts`: priority fields populated when a priority is set;
  absent otherwise; `priorityColor` falls back for an invalid color.
- `tests/obsidian/widgetRenderer.test.ts`: meta items carry the right `data-icon`;
  priority renders icon + label; `is-overdue` preserved; multiple project chips
  render (one per `projects` entry).

Glue (not unit tested): status picker, project add/remove, label icons, the
`setIcon` post-pass — verified with `npm run build:test` + the Obsidian CLI smoke
checks in `docs/development/testing.md`. `mergeUniqueProjects` is already tested.

## Files touched

- `src/ui/taskCard.ts` — priority view-model fields.
- `src/ui/dailyTasksWidgetController.ts` / `todayView.ts` — pass priorities config
  to the card view model (whichever already threads settings).
- `src/obsidian/widgetRenderer.ts` — meta icons (`data-icon`), priority, loop
  projects.
- `src/main.ts` — `setIcon` post-pass in `renderWidgetInto`.
- `src/obsidian/taskCreationModal.ts` — status picker, multi-project section,
  label icons.
- `styles/task-card.css` (+ maybe `styles/widget.css`).
- Tests above.

## Risks

- The `data-icon` post-pass must run after every (re)render in both Reading and
  Live Preview; `renderWidgetInto` is the shared seam, so coverage is one place.
- Removing the modal's `applyPrimaryProjectEdit` usage must not regress the
  multi-project save path — the new modal owns the full list directly, so the
  full-replacement `updateTask` receives every link.
