---
id: modal-layout-redesign
title: Task Modal Layout Redesign (UI Slice A.5)
type: design
status: open
opened: 2026-06-25
closed:
area:
  - obsidian
  - ui
---

# Task Modal Layout Redesign (UI Slice A.5) Design

Date: 2026-06-25

Compact, grouped redesign of the create/edit task modal. Replaces the vertical
`Setting`-row list with two bordered boxes and an icon toolbar, and lays out
(disabled) placeholder sections for the relationship features that ship later.

This is **layout only**. Subtasks (Slice B) and blocked-by / blocking (Slice C)
are wired in a later session — here they are inert placeholders. The data model,
view models, and the persisted `CreateDayTaskInput` contract are unchanged.

Builds on Slice A (`card-icons-multi-project`), on the same branch
(`feat/modal-card-ui-slice-a`).

## Goals

- Cut the modal's vertical sprawl: status / priority / dates / estimate become a
  compact icon toolbar instead of full-width labeled rows.
- Group fields into two visual boxes (the task; its metadata).
- Show where subtasks / blocked-by / blocking will go, disabled until built.
- Create and edit use the identical layout; edit keeps Delete.

## Non-goals

- Any subtask / dependency behavior (Slice B / C).
- A custom date-picker popover (Obsidian has none; dates stay inline inputs).
- Model or contract changes.

## Layout

```text
┌─ New DayTasks task ─────────────────────────────── ✕ ┐
│ ┌── box: task ───────────────────────────────────┐  │
│ │ [⊙ Open] [⚑ Normal] [📅 25/06] [⏰ —] [⏱ 30m]  │  │  toolbar
│ │ [ Title… ]                                      │  │
│ │ [ Description…                               ]  │  │
│ └─────────────────────────────────────────────────┘  │
│ ┌── box: metadata ───────────────────────────────┐  │
│ │ #[ tags… ]            @[ contexts… ]            │  │  2-up
│ │ ▣ Projects  [Home.md ×] [Welcome.md ×] [+ Add] │  │
│ │ ◻ Create detail note                           │  │
│ └─────────────────────────────────────────────────┘  │
│ ⋔ Subtasks      [+ Add subtask] (soon)                │  placeholders
│ ⛔ Blocked by    [+ Add task]    (soon)                │  (disabled)
│ ⇥ Blocking      [+ Add task]    (soon)                │
│ (untitled) · open · 2026-06-25                        │  preview
│                                       [ Create ]      │
└────────────────────────────────────────────────────┘
```

Edit mode is identical with values prefilled, the button labeled **Save**, and a
**Delete** button beside it that arms to "Confirm delete" on first click (existing
behavior).

## Controls

All in `src/obsidian/taskCreationModal.ts` (`onOpen` rebuilt with Obsidian DOM
helpers — `createDiv`/`createEl`/`createSpan` + `setIcon`).

| Control | Form | Interaction |
|---------|------|-------------|
| Status | chip button (icon + label) | opens an Obsidian `Menu` of statuses (icon + label) — reuses the Slice A picker |
| Priority | chip button (icon + label) | opens an Obsidian `Menu` of priorities (icon + label) **plus a "None" item** — replaces the native dropdown |
| Scheduled / Due | icon + native `<input type="date">` | inline; value `YYYY-MM-DD` |
| Estimate | icon + small `<input type="text">` | inline; parsed by `parseEstimateMinutes` on submit (unchanged) |
| Title | full-width `<input type="text">` | focused on open |
| Description | `<textarea>` | char counter, `MAX_DESCRIPTION_LENGTH` cap (unchanged) |
| Tags / Contexts | `<input type="text">` with `#` / `@` icon prefix, side by side | `parseLabelList` on submit (unchanged) |
| Projects | label + "Add project" + removable rows | from Slice A (`MarkdownPathSuggestModal` + `mergeUniqueProjects`) |
| Detail note | toggle | unchanged flag |

Status and priority share one helper (`buildMenuChip`) — a button whose content is
`setIcon(span)` + a label, refreshed on pick, opening a `Menu`.

## Placeholders

Three rows below the boxes: an icon, a label (Subtasks / Blocked by / Blocking),
a **disabled** add button, and a muted "Coming soon" hint. `aria-disabled`, not
focusable. No state, no submit effect. They reserve the layout for Slice B / C.

## Accessibility

- Status/priority chips: real `<button>`, `aria-haspopup="menu"`, `aria-label`;
  `Menu` gives keyboard nav.
- Date/estimate/title/description/tags/contexts: native inputs (accessible).
- Placeholder buttons: `disabled` + `aria-disabled="true"`.
- `:focus-visible` via Obsidian CSS variables.
- Sentence-case UI text.

## CSS

Expand `styles/modal.css`: `.daytasks-modal-box` (border, `--background-secondary`,
`--radius-m`, padding), `.daytasks-toolbar` (flex wrap, gap), chip buttons,
`.daytasks-field-2up` (grid/flex two columns), input + icon-prefix alignment,
placeholder-row muted style. Obsidian CSS variables only; no `!important`; scoped
to the plugin's modal classes.

## Testing

No new unit tests — this is layout glue in an Obsidian-runtime modal that cannot
load in vitest (P2-10 strategy). Verified with `npm run build:test` + the Obsidian
CLI smoke checks: open create and edit, change status/priority via menus, set
dates/estimate, add/remove projects, confirm the preview + Create/Save/Delete, and
`dev:errors` clean. Submit still produces the same `CreateDayTaskInput`, so the
existing service/decoder tests continue to cover persistence.

## Files

- `src/obsidian/taskCreationModal.ts` — rebuild `onOpen` (boxes, toolbar, priority
  picker, placeholders); `submit`/`updatePreview` unchanged in contract.
- `styles/modal.css` — box/toolbar/2-up/placeholder styles.

## Risks

- The modal grows in DOM complexity; keep helpers (`buildMenuChip`, the projects
  renderer) small and single-purpose.
- Native date inputs vary by platform width; the toolbar must wrap gracefully
  (flex-wrap) so it never overflows the modal.
