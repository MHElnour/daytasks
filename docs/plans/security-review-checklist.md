# Security & Safety Review Checklist

Reusable pre-merge / pre-release checklist for DayTasks, specialized to this repo and
to Obsidian plugin constraints. Derived from
[issue-analysis/optimization-security-assessment-2026-06-28.md](../../issue-analysis/optimization-security-assessment-2026-06-28.md)
and [code-audit-2026-06-25](../../issue-analysis/code-audit-2026-06-25.md).

How to use: walk every section that the change touches. Each item is pass / N/A
(with a one-line reason). For DayTasks the prime directive (AGENTS.md) is **preserve
user data** — treat file writes, storage, and migrations as data-loss class.

---

## 1. File & vault operations (highest risk)

- [ ] Any user-derived path (settings, templates, task titles) passed to a vault API is run through Obsidian `normalizePath()` first. (DATA-1; `grep -rn "normalizePath" src` should be non-empty once fixed.)
- [ ] Folder/path templates strip `.` and `..` segments before use. (`folderTemplate.ts`.)
- [ ] Filenames are sanitized of `\ / : * ? " < > |` (and trimmed) before `create`/`rename`. (`sanitizeFileBase`.)
- [ ] `Vault.create` is never called on a path that may already exist without an `exists()` guard or a disambiguation loop — `create` THROWS on collision. (DATA-2.)
- [ ] Active-file edits use the Editor API, not `Vault.modify`. Background edits use `Vault.process`. (Rule 18/19.)
- [ ] Frontmatter is written via `FileManager.processFrontMatter` (not hand-rolled YAML, not full-file rewrite). (Rule confirmed in detailNoteService.)
- [ ] Frontmatter writes preserve non-managed (user) keys; only `MANAGED_FM_KEYS` are touched.
- [ ] Before writing to a stored path (`detailNotePath`), confirm the file still belongs to the task (`frontmatter.taskId === task.id`) so a moved/replaced note is never clobbered. (DATA-3.)
- [ ] File moves use `FileManager.renameFile` (link-preserving), not raw `Vault.rename`.
- [ ] File deletion uses `FileManager.trashFile`, not `Vault.delete`/`Vault.trash`. (Rule 20 — currently no deletes in src; re-check if any are added.)
- [ ] File lookup uses `Vault.getAbstractFileByPath` + `instanceof TFile/TFolder`, not `getFiles().find`. (Rule 21.)
- [ ] Writes are ordered so a partial failure can't diverge stored state from disk (persist the new path immediately after a rename; set "done" flags only on a fully-clean pass). (Migration pattern.)

## 2. Storage & migrations (data-loss class)

- [ ] Decoding malformed/legacy `data.json` never **silently** discards tasks; a drop is surfaced (Notice/warn) before the next `save()` finalizes it. (DATA-4.)
- [ ] Per-field decode/coercion is used (no blanket `as unknown as DayTask`); optional fields are individually validated. (BAD-1/SEC-2.)
- [ ] Arrays are deduped on decode where duplicates would double-index (tags/contexts/projects). (P2-2.)
- [ ] Dependency edges are pruned of self-refs, unknown ids, and cycles on load. (`validateDependencies`.)
- [ ] One-time migrations are idempotent and gated by a persisted flag set only after a fully-clean pass; a failed item is retried next load. (TEST-1.)
- [ ] A throwing data port (corrupt JSON / IO error) falls back to defaults with a user Notice — and this path is tested. (TEST-5.)
- [ ] Migration / decode logic is extracted into testable units, not buried in `main.ts` orchestration. (TEST-1.)

## 3. DOM safety & rendering

- [ ] No `innerHTML` / `insertAdjacentHTML` / `outerHTML` with interpolated data. (`grep -rn "innerHTML" src` → 0.)
- [ ] DOM is built with Obsidian helpers (`createEl`/`createDiv`/`createSpan`/`createFragment`), not `document.createElement`/`createDocumentFragment`. (Rule 35; MNT-1.)
- [ ] Dynamic styling sets **CSS custom properties** (`--var`) consumed by the stylesheet, not arbitrary inline layout/visual properties. (Sanctioned pattern.)
- [ ] Theme-supplied colors are validated via `CSS.supports` before reaching `style.setProperty`. (`safeCssColor`, SEC-3.)
- [ ] User-supplied text used in a search/query string is sanitized (e.g. tag → tag-char set before `tag:#…`). (SEC-5.)

## 4. Platform & popout-window safety

- [ ] Widget DOM is created and measured against the **editor's own** `view.dom.ownerDocument` / `view.containerEl.ownerDocument`, not the global/active `document` (which tracks the focused leaf). (LIFE-1.)
- [ ] Timers/rAF for per-editor work run on that editor's `ownerDocument.defaultView`, not an unrelated window. (LIFE-1.) Note: `eslint-plugin-obsidianmd@0.3.0` *requires* `window.setTimeout` for the global case — popout correctness is about the *editor's* window, not `activeWindow`.
- [ ] `activeDocument` is not captured at setup and re-read at cleanup (it drifts with focus). Prefer `registerDomEvent` or a captured owner element. (Rule 29a.)
- [ ] Node.js module imports (if any) are guarded by `Platform.isDesktop`, or the manifest is `isDesktopOnly: true` and the dependence is intentional. (Rule 36; currently no Node imports in src.)
- [ ] OS detection uses the `Platform` API, not `navigator.platform`/`userAgent`. (Rule 23.)
- [ ] Network calls use `requestUrl()`, not `fetch()`. (Rule 24; currently no network calls.)
- [ ] No regex lookbehind (iOS < 16.4) — only relevant if the plugin ever drops `isDesktopOnly`. (Rule 37.)

## 5. Lifecycle & cleanup (leaks)

- [ ] Workspace/metadata events use `registerEvent`; DOM events on persistent elements use `registerDomEvent`. (Rule 6/6a.)
- [ ] Every manual `setTimeout`/`setInterval`/rAF handle is cleared on `onunload`/`onClose`. (LIFE-2, LIFE-4.)
- [ ] Debounced saves/syncs are flushed (or intentionally cancelled) on `onunload` so a pending write isn't dropped on reload. (LIFE-2.)
- [ ] Third-party widget instances (SortableJS) are destroyed when their host DOM is removed, not only on the next reattach. (LIFE-3.)
- [ ] `onunload` does NOT call `detachLeavesOfType` (let Obsidian own leaf cleanup). (Rule 8 — currently correct.)
- [ ] View instances are not stored on the plugin; views are looked up via `getLeavesOfType`. (Rule 7 — currently correct.)
- [ ] `ItemView`s implement `onClose` to empty their `contentEl`. (LIFE-5.)
- [ ] No `console.log` in `onload`/`onunload` in production; logging is minimized. (Rule 25.)

## 6. Accessibility (mandatory for any UI change)

- [ ] Every interactive element is keyboard-reachable (Tab) and operable (Enter/Space for non-native controls). (Rule 38; `makeActivatable`.)
- [ ] Every focusable control has a visible `:focus-visible` indicator using `var(--interactive-accent)` — including custom-styled native controls whose UA outline a theme may suppress. (A11Y-1, A11Y-2.)
- [ ] Icon-only buttons have an `aria-label`. (Rule 39; A11Y-3.)
- [ ] State is not signaled by color alone (pair with weight/icon/text). (Verified for overdue/blocked/legend.)
- [ ] Tooltips on Obsidian controls use `data-tooltip-position`; native `title` is acceptable when paired with `aria-label`.

## 7. CSS & theming

- [ ] No hardcoded colors/sizes/spacing — use Obsidian CSS variables (incl. inside `color-mix`). Hardcoded tints must be a single documented, overridable variable. (Rule 32; CSS-1, CSS-2.)
- [ ] No `!important` — raise specificity or use variables. (Rule 34a; CSS-3; `grep -rn "!important" styles` → 0.)
- [ ] No `:has()` selectors — toggle classes from TypeScript. (Rule 34b; `grep -rn ":has(" styles` → 0.)
- [ ] Selectors are scoped under a plugin container class (`.daytasks-*`), no bare element/global selectors. (Rule 33.)
- [ ] No `<style>`/`<link>` elements created from JS; all CSS lives in `styles/` and is built into `styles.css`. (Rule 34.)
- [ ] `styles/` source edited (not only generated `styles.css`); `npm run build-css` regenerates cleanly. (AGENTS.md.)

## 8. Code quality & scope

- [ ] No new API / browser-extension / sync / i18n scope unless a milestone explicitly activates it. (AGENTS.md; DEAD-1.)
- [ ] No dead/unwired code added; if scaffolding is intentional, it's recorded in `architecture.md`. (DEAD-1/2/3/4; DOC-1.)
- [ ] No duplicated logic where a shared util exists or should (see [refactor-consolidation-map.md](refactor-consolidation-map.md)). (DRY-7/8/9.)
- [ ] Private Obsidian-API casts are contained in an adapter module and feature-detected before use. (BAD-5; globalSearch, cm.dispatch.)
- [ ] UI text is sentence case; settings use `.setHeading()` with no "General"/plugin-name heading. (Rules 11/17; UX-1.)
- [ ] `async`/`await` (no floating promises; rejections handled with a Notice). (BAD-4/BAD-7.)
- [ ] TypeScript stays strict; `tsc --noEmit` clean with `noUnusedLocals`/`noUnusedParameters`. No weakening of TS/Vitest/build config to pass. (AGENTS.md guardrail.)

## 9. Tests

- [ ] Risky logic (writes, migrations, decode, collisions) has unit tests against a fake that faithfully models Obsidian semantics (create throws on exists; processFrontMatter requires the file). (TEST-1/TEST-2.)
- [ ] Pure decision logic is extracted from Obsidian glue so it is unit-testable (Vitest, happy-dom). (Testing strategy.)
- [ ] No fragile tests: clocks/dates are injected, not read from `new Date()`; no order/`Math.random` dependence.
- [ ] Shared fixtures are factored (`tests/fixtures/`), not copy-pasted across files. (TEST-7.)
- [ ] Tests do not exist solely to cover dead code (false coverage signal). (DEAD-2/DEAD-4.)

## 10. Release / build safety

- [ ] `npm run check` (typecheck + Vitest) green. `npm run build` green. `npm run lint` + `npm run lint:md` clean.
- [ ] `manifest.json` `version`/`minAppVersion` correct; bump `minAppVersion` if a newer Obsidian API is used. (Rule 27.)
- [ ] Plugin id/name/description follow naming rules (no "Obsidian"/"plugin"/redundant words); description ends with terminal punctuation. (Rules 1-5.)
- [ ] No default hotkeys; command ids/names omit "command" and the plugin id. (Rules 14-16.)
- [ ] `LICENSE` holder is not "Dynalist Inc." and the year is current. (validate-license.)
- [ ] Release done from `main`; tag is the bare version (no `v`); `main.js`/`styles.css` shipped as Release assets, not commits. (AGENTS.md.)
- [ ] `versions.json` maps the new version to its `minAppVersion`.
- [ ] User-facing behavior changes are noted in `docs/releases/unreleased.md` (no entries for test-only changes). (AGENTS.md.)
- [ ] Build/release scripts use `execFileSync(cmd, args[])` (no shell string interpolation) and validate inputs (semver, vault path is a real `.obsidian` vault). (Verified; install-script vault check is a low finding.)

---

## Quick grep gate (run before every release)

```bash
grep -rn "normalizePath" src        # expect: present on user-path writes
grep -rn "innerHTML\|insertAdjacentHTML" src   # expect: 0
grep -rn "fetch(" src               # expect: 0 (use requestUrl)
grep -rn "!important" styles        # expect: 0
grep -rn ":has(" styles             # expect: 0
grep -rn "document.createElement\|createDocumentFragment" src   # expect: 0 (use createEl)
npx eslint .                        # expect: 0 problems
npm run check                       # expect: exit 0
```
