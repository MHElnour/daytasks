# DayTasks Documentation

DayTasks is a day-first Obsidian task plugin. This documentation is intentionally
small and aimed at the private plugin we are building now.

## Product Docs

- [Roadmap](roadmap.md) - current milestones and non-goals.
- [Releases](releases/unreleased.md) - user-facing change log draft.

## Development Docs

- [Architecture](development/architecture.md) - module boundaries and data flow.
- [Testing](development/testing.md) - unit, build, install, and Obsidian smoke checks.

## Design And Planning History

- [Design archive](design/README.md) - accepted specs and design decisions.
- [Plan archive](plans/README.md) - implementation plans and historical execution notes.

## Issue And Audit Tracking

- [Issue analysis](../issue-analysis/README.md) - issue status vocabulary, audit
  summaries, and open follow-ups.

## Documentation Policy

Keep this hierarchy boring and obvious:

```text
docs/
  index.md
  roadmap.md
  development/
  design/
  plans/
  releases/
issue-analysis/
```

Do not put new working docs under tool-specific folders. Tool-generated drafts
can be migrated into the hierarchy once they become useful project knowledge.
