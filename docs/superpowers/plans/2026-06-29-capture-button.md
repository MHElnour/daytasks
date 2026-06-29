# Inline Capture Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click `file-text` button at the end of the active (cursor) line in Live Preview / editor mode that captures that line into a scheduled DayTasks task, removing the per-line command-palette friction.

**Architecture:** A pure, tested predicate (`src/core/captureButton.ts`) decides when a line should show the button. A CodeMirror 6 `ViewPlugin` (`src/obsidian/captureButton.ts`) renders a single `Decoration.widget` at the cursor line's end; its click reuses the existing `runCaptureTaskCommand` (extended with an optional explicit line number). A new `showCaptureButton` setting (gated also by `enableInlineCapture`) toggles it. No new parsing or task-creation logic.

**Tech Stack:** TypeScript, Obsidian plugin API, CodeMirror 6 (`@codemirror/view`/`@codemirror/state`), Vitest, esbuild, the `styles/` + `build-css.mjs` CSS pipeline.

## Global Constraints

- **Pure core, no Obsidian imports:** `src/core/captureButton.ts` must NOT import from `obsidian` or `@codemirror/*`. It is unit-tested in isolation. CM6/Obsidian glue lives in `src/obsidian/captureButton.ts` and `src/main.ts`.
- **Reuse, don't reinvent:** the marker regex reuses `TASK_ID_INLINE_SOURCE` from `src/core/taskIds.ts`; the click reuses `runCaptureTaskCommand` (no new capture/parse logic).
- **No regex lookbehind** (iOS < 16.4 incompatibility).
- **Obsidian rules:** UI text sentence case; CSS uses Obsidian CSS variables, is scoped to the plugin class, no `!important`; include a `:focus-visible` style. No new command is added (so no hotkey concerns).
- **Green per commit:** each task ends with its tests green (`npx vitest run <file>`) and `npm run typecheck` clean (tsc covers all of `src/`); the full `npm run check` + `npm run lint` + `npm run build` run at Task 4 and Final verification. `noUnusedLocals`/`noUnusedParameters` are on — never commit an unused import or parameter.
- **Repo uses TAB indentation** in source/test files. Match it (code blocks below use spaces for readability — write tabs).
- **Commit trailer:** end every commit message with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Branch:** all work on `feature/inline-capture` (already checked out).

---

## File Structure

- **New** `src/core/captureButton.ts` — pure predicate: `hasCaptureMarker`, `shouldShowCaptureButton`.
- **New** `tests/core/captureButton.test.ts`.
- **New** `src/obsidian/captureButton.ts` — CM6 `ViewPlugin` + widget: `CaptureButtonHost`, `captureButtonExtension`.
- **New** `styles/capture-button.css` — button styling (added to `build-css.mjs`).
- **Edit** `src/settings/settings.ts` + `src/settings/settingsTab.ts` — `showCaptureButton` flag + toggle.
- **Edit** `src/main.ts` — `runCaptureTaskCommand` gains `line?`; register `captureButtonExtension`.
- **Edit** `build-css.mjs` — add the new CSS partial.
- **Edit** `docs/features.md`, `docs/settings.md`, `docs/releases/unreleased.md`.

---

## Task 1: Pure predicate module

**Files:**

- Create: `src/core/captureButton.ts`
- Test: `tests/core/captureButton.test.ts`

**Interfaces:**

- Consumes: `TASK_ID_INLINE_SOURCE` from `src/core/taskIds.ts` (the regex source `TSK-[A-Za-z0-9]+`).
- Produces:
  - `function hasCaptureMarker(line: string): boolean` — true when the line contains a backticked task id (the marker `formatCapturedLine` writes, e.g. `` `TSK-8cA562sd` ``).
  - `function shouldShowCaptureButton(line: string): boolean` — true when the line has non-whitespace content and is not already captured.

- [ ] **Step 1: Write the failing test**

Create `tests/core/captureButton.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hasCaptureMarker, shouldShowCaptureButton } from "../../src/core/captureButton";

describe("hasCaptureMarker", () => {
    it("detects a backticked task id", () => {
        expect(hasCaptureMarker("Email the board  `TSK-8cA562sd`")).toBe(true);
    });

    it("is false when there is no marker", () => {
        expect(hasCaptureMarker("Email the board")).toBe(false);
    });

    it("is false for a bare task id without backticks", () => {
        expect(hasCaptureMarker("see TSK-8cA562sd later")).toBe(false);
    });
});

describe("shouldShowCaptureButton", () => {
    it("is true for a non-empty, uncaptured line", () => {
        expect(shouldShowCaptureButton("Buy milk")).toBe(true);
    });

    it("is false for an empty or whitespace-only line", () => {
        expect(shouldShowCaptureButton("")).toBe(false);
        expect(shouldShowCaptureButton("   ")).toBe(false);
    });

    it("is false for an already-captured line", () => {
        expect(shouldShowCaptureButton("Buy milk  `TSK-8cA562sd`")).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/captureButton.test.ts`
Expected: FAIL — cannot find module `../../src/core/captureButton`.

- [ ] **Step 3: Create the module**

Create `src/core/captureButton.ts`:

```ts
import { TASK_ID_INLINE_SOURCE } from "./taskIds";

// Matches the marker formatCapturedLine writes: a backticked task id, e.g.
// `TSK-8cA562sd`. Reuses the canonical id source so the two never drift.
const CAPTURE_MARKER_RE = new RegExp("`" + TASK_ID_INLINE_SOURCE + "`");

/** True when a line already carries a capture marker (a backticked TSK id). */
export function hasCaptureMarker(line: string): boolean {
    return CAPTURE_MARKER_RE.test(line);
}

/**
 * True when the active line is worth showing a capture button on: it has
 * non-whitespace content and is not already captured.
 */
export function shouldShowCaptureButton(line: string): boolean {
    return line.trim().length > 0 && !hasCaptureMarker(line);
}
```

- [ ] **Step 4: Run test + typecheck to verify it passes**

Run: `npx vitest run tests/core/captureButton.test.ts && npm run typecheck`
Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/captureButton.ts tests/core/captureButton.test.ts
git commit -m "feat(core): add capture-button predicate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Settings — `showCaptureButton` flag + toggle

**Files:**

- Modify: `src/settings/settings.ts` (interface ~line 33, defaults ~line 71, mergeSettings ~line 200)
- Modify: `src/settings/settingsTab.ts` (after the "Enable inline task capture" toggle, before the "Task defaults" heading)
- Test: `tests/settings/settings.test.ts`

**Interfaces:**

- Produces: `DayTasksSettings.showCaptureButton: boolean` (default `true`); decoded via `asBooleanOr`.

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe("mergeSettings", ...)` block in `tests/settings/settings.test.ts`:

```ts
    it("defaults showCaptureButton to true and coerces a non-boolean", () => {
        expect(mergeSettings({}).showCaptureButton).toBe(true);
        expect(mergeSettings({ showCaptureButton: false }).showCaptureButton).toBe(false);
        expect(mergeSettings({ showCaptureButton: "nope" }).showCaptureButton).toBe(true);
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/settings/settings.test.ts`
Expected: FAIL — `showCaptureButton` is `undefined`.

- [ ] **Step 3: Add the field to the interface**

In `src/settings/settings.ts`, add to `DayTasksSettings` immediately after `enableInlineCapture: boolean;`:

```ts
    enableInlineCapture: boolean;
    showCaptureButton: boolean;
```

- [ ] **Step 4: Add the default**

In `DEFAULT_SETTINGS`, immediately after `enableInlineCapture: true,`:

```ts
    enableInlineCapture: true,
    showCaptureButton: true,
```

- [ ] **Step 5: Decode it in `mergeSettings`**

In the returned object of `mergeSettings`, immediately after the `enableInlineCapture: asBooleanOr(...)` block:

```ts
        enableInlineCapture: asBooleanOr(
            s.enableInlineCapture,
            DEFAULT_SETTINGS.enableInlineCapture
        ),
        showCaptureButton: asBooleanOr(
            s.showCaptureButton,
            DEFAULT_SETTINGS.showCaptureButton
        ),
```

- [ ] **Step 6: Add the settings-tab toggle**

In `src/settings/settingsTab.ts`, immediately after the "Enable inline task capture" `new Setting(...)` block (the one whose `onChange` sets `settings.enableInlineCapture`) and before `new Setting(containerEl).setName("Task defaults").setHeading();`:

```ts
        new Setting(containerEl)
            .setName("Show capture button")
            .setDesc(
                "Show a button at the end of the current line to capture it as a task."
            )
            .addToggle((toggle) =>
                toggle.setValue(settings.showCaptureButton).onChange(async (value) => {
                    settings.showCaptureButton = value;
                    await this.saveSettingsWithNotice();
                })
            );
```

- [ ] **Step 7: Run test + typecheck to verify**

Run: `npx vitest run tests/settings/settings.test.ts && npm run typecheck`
Expected: PASS and no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/settings/settings.ts src/settings/settingsTab.ts tests/settings/settings.test.ts
git commit -m "feat(settings): add showCaptureButton toggle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `runCaptureTaskCommand` gains an explicit line

**Files:**

- Modify: `src/main.ts` (`runCaptureTaskCommand`, ~line 539)

**Interfaces:**

- Produces: `runCaptureTaskCommand(editor: Editor, notePath: string | null, line?: number): Promise<void>` — when `line` is given, it captures and replaces exactly that 0-based line (ignoring any selection); when omitted, behavior is unchanged (cursor line, or the selection with extra lines as the description).

This is Obsidian glue (no unit test). The gate is: existing behavior preserved (full suite still green) and typecheck clean. The new `line` path is exercised by Task 4's manual smoke test.

- [ ] **Step 1: Replace the method**

In `src/main.ts`, replace the entire `runCaptureTaskCommand` method with this version (only the line-resolution at the top and the replacement at the bottom change; the parse/create body is identical):

```ts
    private async runCaptureTaskCommand(
        editor: Editor,
        notePath: string | null,
        line?: number
    ): Promise<void> {
        const targetLine = line ?? editor.getCursor().line;
        // An explicit line (from the capture button) captures just that line; the
        // command path (no line) still supports a multi-line selection.
        const selection = line === undefined ? editor.getSelection() : "";
        const hasSelection = selection.trim().length > 0;
        const lines = hasSelection ? selection.split("\n") : [editor.getLine(targetLine)];
        const firstLine = lines[0];

        const parsed = parseTaskInput(firstLine, {
            priorities: this.settings.priorities,
            today: new Date(),
        });
        if (!parsed.title) {
            new Notice("DayTasks: nothing to capture on this line.");
            return;
        }

        const noteDate = notePath
            ? resolveDailyNoteDate(notePath, this.settings.dailyNoteFolder)
            : null;
        const scheduledDate = resolveCaptureScheduledDate(parsed, noteDate, todayDate());
        const description = lines.slice(1).join("\n").trim();

        const input: CreateDayTaskInput = {
            title: parsed.title,
            scheduledDate,
            tags: parsed.tags,
            contexts: parsed.contexts,
            projects: this.resolveProjectLinks(parsed.projects, notePath ?? ""),
            ...(parsed.dueDate ? { dueDate: parsed.dueDate } : {}),
            ...(parsed.priority ? { priority: parsed.priority } : {}),
            ...(parsed.estimateMinutes !== undefined
                ? { estimateMinutes: parsed.estimateMinutes }
                : {}),
            ...(description ? { description } : {}),
            ...(notePath ? { sourceNote: notePath } : {}),
        };

        let task: DayTask;
        try {
            task = await this.service.createTask(input);
            await this.persistTasks();
            this.refreshViews();
        } catch (error) {
            console.error("DayTasks: failed to capture task", error);
            new Notice("DayTasks: could not capture that task.");
            return;
        }

        const { prefix } = splitListPrefix(firstLine);
        const marker = formatCapturedLine(prefix, parsed.title, task.id);
        if (hasSelection) {
            editor.replaceSelection(marker);
        } else {
            editor.setLine(targetLine, marker);
        }
        new Notice(`DayTasks: captured ${task.id}.`);
    }
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Run the full suite (behavior preserved)**

Run: `npm run check`
Expected: all tests PASS (no behavior change for the existing command path).

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "refactor(capture): let runCaptureTaskCommand target an explicit line

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: CM6 capture-button extension + wiring + CSS

**Files:**

- Create: `src/obsidian/captureButton.ts`
- Create: `styles/capture-button.css`
- Modify: `build-css.mjs` (add the partial to `CSS_FILES`)
- Modify: `src/main.ts` (import + `registerEditorExtension`)

**Interfaces:**

- Consumes: `shouldShowCaptureButton` (Task 1); `runCaptureTaskCommand(editor, notePath, line)` (Task 3); `this.settings.enableInlineCapture` + `this.settings.showCaptureButton` (Task 2).
- Produces:
  - `interface CaptureButtonHost { isEnabled(): boolean; capture(line: number): void; }`
  - `function captureButtonExtension(host: CaptureButtonHost): Extension`

This task is Obsidian/CM6 glue — verified by typecheck, build, full suite, lint, and a manual smoke test (no unit test for the widget).

- [ ] **Step 1: Create the CM6 extension**

Create `src/obsidian/captureButton.ts`:

```ts
import type { Extension } from "@codemirror/state";
import {
    Decoration,
    DecorationSet,
    EditorView,
    PluginValue,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";
import { setIcon, setTooltip } from "obsidian";
import { shouldShowCaptureButton } from "../core/captureButton";

/** Everything the capture button needs from the plugin, kept narrow. */
export interface CaptureButtonHost {
    /** enableInlineCapture && showCaptureButton */
    isEnabled(): boolean;
    /** Capture the given 0-based editor line as a task. */
    capture(line: number): void;
}

const BUTTON_CLASS = "daytasks-capture-button";

class CaptureButtonWidget extends WidgetType {
    constructor(
        private readonly host: CaptureButtonHost,
        private readonly line: number
    ) {
        super();
    }

    eq(other: CaptureButtonWidget): boolean {
        return other.line === this.line;
    }

    toDOM(view: EditorView): HTMLElement {
        // Build in the editor's own document so the button renders in a
        // popout/detached window, not just the focused one.
        const doc = view.dom.ownerDocument;
        const button = doc.createElement("button");
        button.className = BUTTON_CLASS;
        button.type = "button";
        button.setAttribute("aria-label", "Capture task from line");
        const icon = doc.createElement("span");
        icon.className = `${BUTTON_CLASS}__icon`;
        button.appendChild(icon);
        setIcon(icon, "file-text");
        setTooltip(button, "Capture task from line", { placement: "top" });

        // pointerdown (mousedown fallback) so the line is captured before focus
        // shifts; preventDefault keeps the editor caret/selection untouched.
        const activationEvent =
            typeof window !== "undefined" && "PointerEvent" in window
                ? "pointerdown"
                : "mousedown";
        button.addEventListener(activationEvent, (event) => {
            event.preventDefault();
            this.host.capture(this.line);
        });
        return button;
    }

    ignoreEvent(): boolean {
        return false;
    }
}

function buildDecorations(view: EditorView, host: CaptureButtonHost): DecorationSet {
    if (!host.isEnabled()) {
        return Decoration.none;
    }
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    if (!shouldShowCaptureButton(line.text)) {
        return Decoration.none;
    }
    // CM6 lines are 1-based; the Obsidian Editor API is 0-based.
    const widget = new CaptureButtonWidget(host, line.number - 1);
    return Decoration.set([Decoration.widget({ widget, side: 1 }).range(line.to)]);
}

/**
 * Renders a single capture button at the end of the cursor line (Live Preview /
 * editor mode) when the line is non-empty and not already captured. Clicking it
 * captures that line via the host. Viewport/selection-scoped: one line of work
 * per update.
 */
export function captureButtonExtension(host: CaptureButtonHost): Extension {
    return ViewPlugin.fromClass(
        class implements PluginValue {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = buildDecorations(view, host);
            }

            update(update: ViewUpdate): void {
                if (update.docChanged || update.selectionSet || update.viewportChanged) {
                    this.decorations = buildDecorations(update.view, host);
                }
            }
        },
        { decorations: (value) => value.decorations }
    );
}
```

- [ ] **Step 2: Create the stylesheet partial**

Create `styles/capture-button.css`:

```css
.daytasks-capture-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-left: var(--size-4-2);
    padding: 0;
    border: none;
    border-radius: var(--radius-s);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0.55;
    vertical-align: middle;
    transition: opacity 0.1s ease, background-color 0.1s ease, color 0.1s ease;
}

.daytasks-capture-button:hover {
    opacity: 1;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

.daytasks-capture-button:active {
    transform: scale(0.95);
}

.daytasks-capture-button:focus-visible {
    opacity: 1;
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

.daytasks-capture-button__icon {
    display: inline-flex;
    width: 14px;
    height: 14px;
}

.daytasks-capture-button__icon svg {
    width: 14px;
    height: 14px;
}
```

- [ ] **Step 3: Register the partial in the CSS build**

In `build-css.mjs`, add the new partial to the end of the `CSS_FILES` array:

```js
    "styles/modal.css", // task modal: status picker, projects, label icons
    "styles/capture-button.css", // inline capture button
];
```

- [ ] **Step 4: Wire the extension in `main.ts`**

Add the import near the other `./obsidian/...` imports in `src/main.ts`:

```ts
import { captureButtonExtension } from "./obsidian/captureButton";
```

Then, in `onload`, immediately after the existing `this.registerEditorExtension(dailyTasksLivePreviewExtension({ ... }));` call, add:

```ts
        this.registerEditorExtension(
            captureButtonExtension({
                isEnabled: () =>
                    this.settings.enableInlineCapture && this.settings.showCaptureButton,
                capture: (line) => {
                    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                    if (view?.file) {
                        void this.runCaptureTaskCommand(view.editor, view.file.path, line);
                    }
                },
            })
        );
```

(`MarkdownView` is already imported in `src/main.ts`.)

- [ ] **Step 5: Typecheck + build CSS + build**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run build-css`
Expected: `styles.css` regenerated including the `.daytasks-capture-button` rules.

Run: `npm run build`
Expected: build succeeds; `main.js` regenerated.

- [ ] **Step 6: Run the full check + lint**

Run: `npm run check && npm run lint`
Expected: typecheck clean, all tests PASS, lint clean.

- [ ] **Step 7: Manual smoke test (glue verification)**

Install into the test vault and verify in Obsidian:

```bash
npm run build:test
```

Reload the plugin, then (Live Preview / editor mode):

1. Put the cursor on a non-empty line (e.g. `Email the board #work !high 45m`).
   - Expect: a faint `file-text` button appears at the end of that line; hovering brightens it and shows the "Capture task from line" tooltip.
2. Click the button.
   - Expect: the line is captured (task created, scheduled per the rules) and replaced with `Email the board  \`TSK-xxxxxxxx\``; a "captured" Notice shows; the button disappears (line now has a marker).
3. Move the cursor to a blank line.
   - Expect: no button.
4. Move the cursor onto an already-captured line (one with a `` `TSK-…` `` marker).
   - Expect: no button.
5. Settings → Inline capture → turn **Show capture button** off; return to the editor and move the cursor onto a normal line (or make any edit).
   - Expect: no button. Turn it back on → button returns. The **Capture task from line** command still works regardless.
6. Turn **Enable inline task capture** off.
   - Expect: no button and the command is gone.

Record the result of each check. If any fails, use superpowers:systematic-debugging before proceeding.

- [ ] **Step 8: Commit**

```bash
git add src/obsidian/captureButton.ts styles/capture-button.css build-css.mjs src/main.ts
git commit -m "feat(capture): add inline capture button on the cursor line

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

(`styles.css` is git-ignored in this repo — it is a built artifact, regenerated by `build-css`/CI. Do NOT stage it; only the source partial `styles/capture-button.css`, `build-css.mjs`, and the TS files are tracked.)

---

## Task 5: User-facing docs + release notes

**Files:**

- Modify: `docs/releases/unreleased.md`
- Modify: `docs/features.md`
- Modify: `docs/settings.md`

- [ ] **Step 1: Add the release note**

In `docs/releases/unreleased.md`, under the existing `## Added` section, add a bullet:

```markdown
- **Inline capture button.** With inline capture enabled, a small button appears
  at the end of the current line in editor / Live Preview mode; click it to capture
  that line as a task — no command palette needed. The button is hidden on blank
  lines and on lines already captured. New setting: **Inline capture › Show capture
  button** (on by default).
```

- [ ] **Step 2: Document the feature**

In `docs/features.md`, in the inline-capture section, add a short paragraph after the line-marker description:

```markdown
You can also capture without the command: with inline capture enabled, a small
button appears at the end of the line your cursor is on. Click it to capture that
line. The button is hidden on empty lines and on lines that already hold a captured
task. Toggle it with **Settings → Inline capture → Show capture button**.
```

- [ ] **Step 3: Document the setting**

In `docs/settings.md`, under the "Inline capture" heading, add (matching the file's `**Bold name** …` style):

```markdown
- **Show capture button** — show a one-click capture button at the end of the
  current line in the editor. Requires **Enable inline task capture**. Default on.
```

- [ ] **Step 4: Commit**

```bash
git add docs/releases/unreleased.md docs/features.md docs/settings.md
git commit -m "docs: document the inline capture button

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] **Run the complete check**

Run: `npm run check && npm run lint && npm run build`
Expected: typecheck clean, all tests PASS, lint clean, build succeeds.

- [ ] **Confirm the branch state**

Run: `git log --oneline -5` and `git status`
Expected: five feature commits for this plan on `feature/inline-capture`, clean working tree, every commit carrying the `Co-Authored-By` trailer.

---

## Notes / known caveats

- **Cursor-line only:** the button shows only on the active line, so it is quiet by design (low discoverability is acceptable — the command + docs cover discovery).
- **Live toggle:** the ViewPlugin reads `host.isEnabled()` on each update, so toggling the setting takes effect on the next editor interaction in a pane (cursor move/edit) — effectively immediate; guaranteed after a reload.
- **Icon overload:** `file-text` is also the detail-note glyph; the tooltip disambiguates (chosen deliberately).
- **Touch targets:** the button is ~18px (an inline editor affordance, desktop-first); below the 44px touch guideline — acceptable for an editor-only desktop interaction.

---

## Self-review (completed against the spec)

- **Goals covered:** one-click capture on the cursor line (Tasks 1+4), shown only when worthwhile (Task 1 predicate), reuse of the capture pipeline (Task 3 + Task 4 wiring), pure/tested predicate + thin glue (Task 1 pure, Task 4 smoke). ✔
- **Decisions honored:** cursor-line trigger; end-of-line `Decoration.widget` (`side: 1`, at `line.to`); `file-text` icon + tooltip; `showCaptureButton` toggle gated also by `enableInlineCapture`. ✔
- **Architecture:** pure `captureButton.ts` (no obsidian/cm imports), CM6 `ViewPlugin` mirroring `dailyTasksLivePreviewExtension`, marker regex reuses `TASK_ID_INLINE_SOURCE` (DRY), no regex lookbehind. ✔
- **Settings/CSS pipeline:** `asBooleanOr` decode + sentence-case toggle; new `styles/` partial registered in `build-css.mjs`; Obsidian CSS variables, scoped, `:focus-visible`, no `!important`. ✔
- **Testing:** pure predicate unit-tested (Task 1); `showCaptureButton` merge test (Task 2); the widget/click/`line?` path smoke-verified (Task 4). ✔
- **Per-commit green:** each task ends `npx vitest run` + `npm run typecheck`; Task 4 + final add `npm run check`/`lint`/`build`; every commit carries the trailer. ✔
