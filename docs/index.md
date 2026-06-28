# DayTasks Documentation

DayTasks is a lightweight, day-first task manager for Obsidian daily notes. The
plugin stores task data in Obsidian plugin storage, renders the active day's
tasks inside daily notes, and adds an all-tasks view for review and cleanup.

This documentation is the current source of truth. Old design drafts, execution
plans, and private working notes should be consolidated here or deleted.

## Start Here

- [Core concepts](core-concepts.md) - purpose, data model, and design
  principles.
- [Features](features.md) - daily-note widget, Task List view, subtasks,
  dependencies, and detail notes.
- [Settings](settings.md) - every setting and what it affects.
- [Roadmap](roadmap.md) - current status, next work, and non-goals.

## Operations

- [Troubleshooting](troubleshooting.md) - common problems and checks.
- [Privacy](privacy.md) - what DayTasks stores and what it does not send.
- [Releases](releases/unreleased.md) - user-facing release note draft.

## Development

- [Architecture](development/architecture.md) - module boundaries and data flow.
- [Testing](development/testing.md) - unit, build, install, and Obsidian smoke
  checks.
- [Security and data safety](development/security-and-data-safety.md) - review
  checklist for vault writes, storage, DOM, lifecycle, and accessibility.
- [Release process](development/release-process.md) - local release workflow and
  release asset rules.

## Audit Tracking

- [Issue analysis](../issue-analysis/README.md) - resolved audits, active
  findings, and follow-up decisions.

## Documentation Policy

Keep the tree small and current:

```text
docs/
  index.md
  core-concepts.md
  features.md
  settings.md
  troubleshooting.md
  privacy.md
  roadmap.md
  development/
  releases/
issue-analysis/
```

Do not recreate `docs/design/`, `docs/plans/`, or `docs/private/`. If a draft
contains lasting product or engineering knowledge, migrate the useful parts into
one of the current docs. If it only records old execution history, delete it.
