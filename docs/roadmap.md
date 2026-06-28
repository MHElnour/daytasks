# Roadmap

DayTasks is focused on becoming a complete Obsidian daily-note task plugin. API,
browser-extension, sync, and i18n work are intentionally deferred.

## Current Position (0.8.1)

Shipped:

- generated `TSK-xxxxxxxx` ids and store-first task persistence;
- validating decode/merge paths for tasks and settings;
- daily-note widget in Live Preview and reading mode;
- all-tasks Task List view with filters, grouping, sorting, and persisted state;
- task create, edit, delete, complete, status cycle, and priority cycle flows;
- tags, contexts, projects, estimates, scheduled dates, due dates, and
  descriptions;
- subtasks with nested cards and progress;
- dependency relationships with blocked-status behavior and cycle prevention;
- manual drag reorder within groups;
- optional detail notes with managed frontmatter and user-owned bodies;
- detail-note folder date templates;
- popout/split-pane widget support;
- keyboard focus and accessible labels for current task controls;
- local release scripts and automated checks.

Engineering status:

- `npm run check` is the pre-commit gate.
- The 2026-06-25 code audit and 2026-06-28 optimization/security assessment are
  resolved in `issue-analysis/`.
- The dead API stubs, dead daily-note write slice, duplicate create-task command,
  and unused relative-date helper were removed in the 2026-06-28 cleanup.

## Next Milestone: Configuration Completion

- Build a real status editor for label, value, color, completed flag, order, and
  next status.
- Build a real priority editor for label, value, color, icon, and weight.
- Remove or fully implement the reserved API settings section. Until the API
  milestone is active, avoid exposing controls that imply a working server.

## Obsidian Polish

- Improve detail-note and Task List manual smoke coverage.
- Keep popout-window behavior, keyboard focus, and theme compatibility part of
  every UI review.
- Decide whether `src/obsidian/vaultAdapter.ts` should become a real adapter or
  be deleted as the final remaining stub.

## Later

- Time tracking inside Obsidian.
- Pomodoro inside Obsidian.
- Local API.
- Browser extension.

Do not start API or browser-extension work until the Obsidian workflow is fully
functional, documented, and tested.
