# Roadmap

DayTasks is focused on the Obsidian daily-note task workflow. This roadmap is
public-facing: it describes what is shipped, what is next, and what is
intentionally out of scope.

## Shipped In 0.8.1

The current plugin includes:

- generated `TSK-xxxxxxxx` ids;
- store-first task persistence in Obsidian plugin data;
- daily-note widget in Live Preview, reading mode, split panes, and popouts;
- Task List view across all days with filters, grouping, sorting, and persisted
  view state;
- task create, edit, complete, delete, status cycle, and priority cycle flows;
- tags, contexts, projects, estimates, scheduled dates, due dates, and
  descriptions;
- subtasks with nested cards and progress;
- dependency relationships with blocked-status behavior and cycle prevention;
- manual drag reorder within groups;
- optional detail notes with managed frontmatter and user-owned bodies;
- detail-note folder date templates;
- theme-aware styling and keyboard-accessible controls.

Engineering foundation:

- `npm run check` is the pre-commit gate.
- Release scripts build local assets and publish GitHub Releases.
- Data-safety rules for vault writes, detail notes, decoding, and migrations are
  documented in [Security and data safety](development/security-and-data-safety.md).

## Before Public Release

- Add screenshots or GIFs to the README once the release UI is final.
- Remove or fully implement the reserved API settings section. Public UI should
  not expose controls for features that do not work yet.
- Run a final Obsidian smoke pass on a clean vault: daily widget, Task List,
  subtasks, dependencies, detail notes, popouts, theme switching, and keyboard
  navigation.
- Confirm release assets and installation instructions match the first public
  GitHub Release.

## Next Feature Milestone: Configuration Completion

- Build a real status editor for label, value, color, completed flag, order, and
  next status.
- Build a real priority editor for label, value, color, icon, and weight.
- Keep status and priority validation strict so broken settings cannot corrupt
  task state.

## Obsidian Polish

- Decide whether `src/obsidian/vaultAdapter.ts` should become a real adapter or
  be deleted as the final remaining stub.
- Improve manual smoke coverage for detail notes and Task List state.
- Keep popout-window behavior, keyboard focus, and theme compatibility part of
  every UI review.

## Later, After The Obsidian Core Is Solid

- Time tracking inside Obsidian.
- Pomodoro inside Obsidian.
- Local API.
- Browser extension.
- Sync.
- i18n.

Do not start API, browser-extension, sync, or i18n work until the Obsidian
workflow is fully functional, documented, and tested.
