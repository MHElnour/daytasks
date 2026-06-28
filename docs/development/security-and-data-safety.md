# Security And Data Safety

DayTasks works inside a user's Obsidian vault. Treat storage, file writes,
migrations, and edit flows as data-loss class changes.

Use this checklist before merging or releasing any change that touches the
listed area.

## File And Vault Operations

- Normalize user-derived vault paths with Obsidian `normalizePath()`.
- Strip `.` and `..` path segments from folder templates before writing.
- Sanitize filenames before create or rename operations.
- Guard `Vault.create` with an existence check or disambiguation loop.
- Use Editor APIs for active-file edits and background vault APIs only for
  background work.
- Use `FileManager.processFrontMatter` for frontmatter writes.
- Preserve non-managed frontmatter keys.
- Before writing to a stored `detailNotePath`, confirm the note still belongs to
  the task by checking `taskId`.
- Use `FileManager.renameFile` for moves so links are preserved.
- Use `FileManager.trashFile` for file deletion if DayTasks adds deletion flows.
- Look up paths with `Vault.getAbstractFileByPath()` and `instanceof` checks.

## Storage And Migrations

- Never silently discard malformed stored tasks. Surface skipped entries before a
  later save can make the loss permanent.
- Decode fields individually; do not cast unknown persisted data directly to
  `DayTask`.
- Keep arrays normalized and deduped where duplicate values would double-index.
- Prune dependency self-references, unknown ids, and cycles on load.
- Make one-time migrations idempotent.
- Persist migration flags only after a fully clean pass.
- Extract risky migration orchestration into testable units.

## DOM And Rendering

- Do not use `innerHTML`, `insertAdjacentHTML`, or `outerHTML` with dynamic data.
- Build DOM through Obsidian helpers where possible.
- Use CSS custom properties for dynamic styling.
- Validate theme/user colors with `safeCssColor` before assigning them.
- Build and measure widget DOM against the editor or view owner document, not a
  global or active document.

## Platform And Lifecycle

- Register Obsidian events with `registerEvent`.
- Register DOM events on long-lived elements with `registerDomEvent`.
- Clear timers and animation frames on unload or close.
- Flush or intentionally cancel debounced saves on unload.
- Destroy third-party instances such as SortableJS when their host DOM is
  removed.
- Do not call `detachLeavesOfType()` in `onunload`.
- Do not store long-lived view instances on the plugin.

## Accessibility

- Every interactive element must be reachable by keyboard.
- Non-native controls need Enter and Space behavior.
- Every focusable control needs a visible `:focus-visible` indicator.
- Icon-only buttons need an `aria-label`.
- State should not be communicated by color alone.
- Use sentence-case UI text.

## CSS And Theming

- Use Obsidian CSS variables for colors, spacing, and borders.
- Avoid `!important`; use selector specificity or variables.
- Avoid `:has()`; toggle classes from TypeScript instead.
- Scope selectors under DayTasks containers.
- Edit source CSS under `styles/` and rebuild generated `styles.css`.

## Release Gate

Before release:

```bash
grep -rn "innerHTML\\|insertAdjacentHTML" src
grep -rn "fetch(" src
grep -rn "!important" styles
grep -rn ":has(" styles
npm run check
npm run lint
npm run lint:md
npm run build
```

Expected results: no unsafe DOM/network/theme selectors from the grep checks,
and every command exits 0.
