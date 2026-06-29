# Design: Inline capture button

Status: approved (brainstorm 2026-06-29). Branch: `feature/inline-capture`.

## Overview

Inline task capture v1 (shipped on this branch) requires running the **Capture
task from line** command for every line — palette or hotkey, per line. That
friction buries an otherwise strong feature. This adds a one-click affordance: a
small **`file-text` button at the end of the active (cursor) line** in Live
Preview / editor mode. Clicking it captures that line via the exact same logic as
the command, then replaces the line with the `` title `TSK-id` `` marker.

It is additive and adopts TaskNotes' proven mechanism (CM6 `ViewPlugin` +
`Decoration.widget` at `line.to`), narrowed to DayTasks' lean, day-first style:
the button appears only where the user is working, not on every line.

## Goals

- Trigger capture for a line with a single click, no command palette.
- Show the button only on the **cursor line**, and only when it is worth showing
  (non-empty, not already captured).
- Reuse the existing capture pipeline — no new parsing or task-creation logic.
- Keep parsing/predicate logic pure and unit-tested; keep the CM6/Obsidian layer
  thin and smoke-verified.

## Non-goals

- No reading-mode button (you cannot edit there) — Live Preview / editor only.
- No gutter/left-margin lane (reserves a column on every line).
- No button on non-cursor lines (the v1 mechanism scanned every checkbox line;
  DayTasks shows it only on the active line to stay quiet).
- No selection / multi-line capture via the button — that stays a command-only
  power feature (`runCaptureTaskCommand` already turns extra selected lines into
  the task description).
- No new capture/parse behavior — the button calls the existing path verbatim.

## Decisions (resolved in brainstorm)

1. **Trigger:** the **active (cursor) line only**, when non-empty and not already
   captured. Lowest clutter; fits DayTasks' any-line capture (not just
   checkboxes).
2. **Placement:** an **inline widget at the end of the line** (`Decoration.widget`,
   `side: 1`, at `line.to`). Appears only on the cursor line; nothing is reserved
   elsewhere. (Not a gutter.)
3. **Icon:** Lucide **`file-text`** — the detail-note glyph, reused at the user's
   request. Tooltip "Capture task from line", faint by default, full opacity on
   hover. (`file-plus` was offered as a "+"-variant to distinguish capture from
   open-detail; the user chose `file-text`.)
4. **Setting:** a new **`showCaptureButton`** toggle (default on), gated *also* by
   the existing `enableInlineCapture`. The command keeps working independently of
   the button.

## Architecture

### New pure module: `src/core/captureButton.ts`

Pure, no Obsidian imports → unit-tested in isolation.

```ts
/** True when a line already carries a capture marker (a backticked TSK id). */
export function hasCaptureMarker(line: string): boolean;

/** True when the active line is worth showing a capture button on: it has
 *  non-whitespace content and is not already captured. */
export function shouldShowCaptureButton(line: string): boolean;
```

- `hasCaptureMarker` matches a backticked task id, e.g. `` `TSK-8cA562sd` `` —
  regex on `` `TSK-<id>` `` (the marker `formatCapturedLine` writes). It must not
  use regex lookbehind (iOS).
- `shouldShowCaptureButton(line)` = `line.trim().length > 0 && !hasCaptureMarker(line)`.

### New CM6 extension: `src/obsidian/captureButton.ts`

A `ViewPlugin` that maintains a decoration set, mirroring the structure of the
existing `dailyTasksLivePreviewExtension` (settings read through a narrow host
interface, not a plugin ref).

```ts
export interface CaptureButtonHost {
  isEnabled(): boolean;          // enableInlineCapture && showCaptureButton
  capture(line: number): void;   // run capture for a 0-based line number
}

export function captureButtonExtension(host: CaptureButtonHost): Extension;
```

- **Decorations:** on each relevant update, read the main cursor head
  (`view.state.selection.main.head`), resolve its line
  (`view.state.doc.lineAt(head)`), and — when `host.isEnabled()` and
  `shouldShowCaptureButton(line.text)` — add a single `Decoration.widget({ widget,
  side: 1 })` at `line.to`. Otherwise `Decoration.none`.
- **Widget (`WidgetType`):** `toDOM` builds a `<button class="daytasks-capture-button">`
  with a `setIcon(span, "file-text")` child, `setTooltip(button, "Capture task
  from line")`, and an `aria-label`. A `pointerdown` listener (with `mousedown`
  fallback) calls `host.capture(lineNumber)` and `event.preventDefault()` so the
  click does not move the cursor/blur first. The widget stores its 0-based line
  number; `eq` compares line numbers so unchanged lines are not re-rendered.
- **Update triggers:** rebuild when `update.selectionSet || update.docChanged ||
  update.viewportChanged`. Work is a single line lookup — cheap. When
  `host.isEnabled()` is false the plugin yields `Decoration.none`.

The path of the editor backing the view is available via `editorInfoField`
(as in `livePreview.ts`) if needed, but capture resolution lives in `main.ts`
(below), so the CM layer only needs the line number.

### Capture wiring (`main.ts`)

- `runCaptureTaskCommand` gains an optional `line?: number`. When provided, it
  reads and replaces just that one line (`editor.getLine(line)` /
  `editor.setLine(line, marker)`), ignoring any selection; when omitted it keeps
  today's cursor-line/selection behavior. All parsing, scheduling, `sourceNote`,
  and marker logic is unchanged and shared.
- Register the extension in `onload`:

  ```ts
  this.registerEditorExtension(
    captureButtonExtension({
      isEnabled: () => this.settings.enableInlineCapture && this.settings.showCaptureButton,
      capture: (line) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view?.file) void this.runCaptureTaskCommand(view.editor, view.file.path, line);
      },
    })
  );
  ```

  The button only renders on the focused editor's cursor line, so the active
  `MarkdownView` is the correct editor to capture from.

### Settings

- `src/settings/settings.ts`: add `showCaptureButton: boolean` to
  `DayTasksSettings`, default `true` in `DEFAULT_SETTINGS`, decode via
  `asBooleanOr` in `mergeSettings`.
- `src/settings/settingsTab.ts`: a "Show capture button" toggle under the existing
  "Inline capture" heading (sentence case), using `saveSettingsWithNotice`.
- The ViewPlugin reads `host.isEnabled()` on every `update`, so toggling the
  setting takes effect on the next editor interaction in a given pane (a cursor
  move or edit re-evaluates and shows/hides the button) — effectively immediate in
  use, and guaranteed after a reload. We do not force a no-op dispatch into every
  open editor for this (the existing widget nudge only targets daily/detail
  panes); the cursor-move re-evaluation is sufficient and avoids touching
  unrelated editors.

### Styling

- New `styles/capture-button.css` partial, added to the `FILES` list in
  `build-css.mjs`; built into `styles.css` via `npm run build-css`.
- `.daytasks-capture-button`: inline-flex, small (~15px), `margin-left` gap,
  `opacity` ~0.6 → 1 on hover, transparent background → `var(--interactive-accent)`
  / `var(--text-on-accent)` on hover, `:focus-visible` outline. Obsidian CSS
  variables only; no hardcoded colors; scoped to the plugin class.

## Testing

- `tests/core/captureButton.test.ts`: `hasCaptureMarker` (marker present/absent,
  backtick boundaries) and `shouldShowCaptureButton` (empty/whitespace → false,
  plain line → true, already-captured line → false).
- `tests/settings/settings.test.ts`: `showCaptureButton` defaults to true and
  coerces a non-boolean.
- The CM6 widget, click handler, and the `runCaptureTaskCommand` `line?` path are
  Obsidian glue → **smoke-verified** (manual checklist): button shows only on the
  cursor line; hidden on blank lines and on already-captured (`TSK-id`) lines;
  click captures that line and replaces it with the marker; cursor move relocates
  the button; toggling **Show capture button** off hides it without a reload;
  toggling **Enable inline task capture** off hides it and the command.

## Files touched

- New: `src/core/captureButton.ts`, `tests/core/captureButton.test.ts`,
  `src/obsidian/captureButton.ts`, `styles/capture-button.css`.
- Edit: `src/main.ts` (register extension; `runCaptureTaskCommand` gains `line?`),
  `src/settings/settings.ts` + `src/settings/settingsTab.ts` (+
  `tests/settings/settings.test.ts`), `build-css.mjs` (add the partial),
  `docs/features.md`, `docs/settings.md`, `docs/releases/unreleased.md`.

## Risks / tradeoffs

- **Discoverability vs. clutter:** cursor-line-only is the quiet choice; a
  first-time user may not notice the button. Acceptable — the command + docs cover
  discovery, and quietness matches the anti-overwhelm identity.
- **Icon overload:** `file-text` also means "detail note" in DayTasks. Accepted at
  the user's request; tooltip disambiguates.
- **Cursor-driven rebuild:** decorations rebuild on `selectionSet`. The work is a
  single `doc.lineAt` + predicate, so cost is negligible; no debounce needed.
