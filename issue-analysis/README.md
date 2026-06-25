# Issue Analysis

Audits, bug investigations, and follow-up decisions for DayTasks. Each file starts
with YAML front matter and answers: what was observed, why it matters, which code
paths, what changed, how it was verified, what remains open.

**Status:** `open` · `in-progress` · `resolved` · `partial` · `deferred` · `wontfix`

**Front matter:**

```yaml
---
id: short-stable-id
title: Human readable title
type: bug | audit | decision | follow-up
status: open | in-progress | resolved | partial | deferred | wontfix
severity: critical | high | medium | low | none
opened: YYYY-MM-DD
closed:        # date when fully closed
area: [core, obsidian, settings, ui, util, daily-notes]
issues:        # audits only: closed/open/partial/wontfix/deferred id lists
resolution:
---
```

## Index

| File | Status | Purpose |
|------|--------|---------|
| [code-audit-2026-06-25.md](code-audit-2026-06-25.md) | partial | Two-pass Claude+Codex audit: 31 fixed, 3 open (low) + 1 partial, 2 won't-fix, 3 deferred. |
