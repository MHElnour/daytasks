# Design: Inline Task Capture

Status: approved (brainstorm 2026-06-29). Branch: `feature/inline-capture`.

## Overview

Let a user type a task in natural language on a line in **any** note, run one
command, and have DayTasks parse it, create a scheduled task in the store, link
the source note, and leave a readable marker on the line. This removes the
current capture friction (open the daily note → click + New Task → fill the
modal) without compromising DayTasks' lean, day-first identity.

The daily-note widget and detail notes are explicitly **not** changed — they are
the plugin's strengths. This feature is additive.

## Goals

- Capture a task from a single line (or selection) in any note via one command.
- Parse natural language for the fields DayTasks already has.
- Schedule the task automatically (parsed date, else the note's daily date, else
  today).
- Record where the task came from via a new `sourceNote` link.
- Replace the captured line with a readable `title + id` marker (not delete it).
- Keep everything testable: parsing logic lives in a pure module.

## Non-goals

- Recurrence and times-of-day (DayTasks has dates only — no such fields).
- Per-line live rendering / the TaskNotes link-overlay subsystem (~3k LOC).
- Auto-detection of tasks by tag or checkbox (no live scanning; capture is an
  explicit command).
- A trigger-character configuration UI.
- *Automatic* context assignment to captured tasks (a later, optional setting).
  Explicit `#tag`/`@context`/`+project` the user types ARE parsed — this
  non-goal is only about auto-adding them.

## Decisions (resolved in brainstorm)

1. **Trigger:** an explicit command on the current line/selection — not tag/
   checkbox auto-detection. Cleaner and avoids "is this line a task?" ambiguity.
2. **NLP dependency:** **chrono-node + minimal in-house extractors** (option a).
   chrono does the hard, tested date parsing; we add ~100 lines of tested
   regex extractors for `#tag @ctx +project !priority` + estimate. We do NOT pull in
   `tasknotes-nlp-core`/`rrule` (recurrence/time/status machinery DayTasks lacks
   = dead bundle weight).
3. **Note↔task link:** a **dedicated `sourceNote` field** on the task (not the
   `projects` field), so capture notes do not pollute the project list.
4. **Line handling:** replace with a `title + \`TSK-id\`` marker, preserving any
   list/checkbox prefix. Not deleted.

## Architecture

### New pure module: `src/core/parseTaskInput.ts`

```ts
export interface ParsedTaskInput {
  title: string;
  scheduledDate?: string; // YYYY-MM-DD
  dueDate?: string;       // YYYY-MM-DD
  priority?: string;      // a configured priority value
  tags: string[];
  contexts: string[];
  projects: string[];     // raw +project values (word or wikilink target)
  estimateMinutes?: number;
}

export function parseTaskInput(
  input: string,
  opts: { priorities: PriorityConfig[]; today: Date; defaultToScheduled?: boolean }
): ParsedTaskInput;
```

Pipeline (each stage extracts its tokens, then strips them; the residue is the
title), adapted from TaskNotes' approach but trimmed to DayTasks' fields:

1. Strip a leading list/checkbox prefix (`- [ ]`, `1.`, `> - [ ]`).
2. `#tag` → tags; `@context` → contexts; `+project` (`+word` or `+[[wikilink]]`)
   → projects (regex, Unicode-aware). The `+` token captures the wikilink target
   or the bare word as a raw string; the capture command maps each to a
   `ProjectLink`.
3. `!priority` (and bare priority words) → match against `opts.priorities`.
4. Estimate: `1h30m`, `45m`, `2h`, `90` → `estimateMinutes`.
5. Dates via `chrono-node` → `scheduledDate` / `dueDate` per the **Date
   semantics** rules below. Times are ignored (no time fields).
6. Remaining trimmed text → `title` (empty title is a parse failure the caller
   handles with a Notice).

### Date semantics

Dates use **colon markers** so they never collide with normal sentence words —
`due:`/`by:`/`deadline:` only fire *with the colon*, so "written by John" or
"meeting on Friday" are not misread as dates. `scheduledDate` is always set
(required field); `dueDate` is only set when a due marker is present.

- **Due:** `due:` / `by:` / `deadline:` followed by a date phrase → `dueDate`.
  Examples: `due:friday`, `by:next monday`, `deadline:2026-07-05`.
- **Scheduled:** `scheduled:` followed by a date phrase, **or** a bare date
  phrase with no marker → `scheduledDate`. Examples: `scheduled:monday`,
  `2026-07-02`, or just `friday`.
- **Both:** `scheduled:monday due:friday` → scheduled = Monday, due = Friday.
- **No date typed → auto to the current day:** `scheduledDate` falls back to the
  source note's date if it is a daily note (capturing in `2026-07-02.md` →
  scheduled `2026-07-02`), otherwise `todayDate()`. (This fallback lives in the
  capture command, not the pure parser, which only reports parsed dates.)

Order: marker dates are extracted first (date phrase parsed by chrono and
stripped), then any remaining bare date is chrono-scanned into `scheduledDate`.
Caveat: bare-date scanning can still grab a date word that was meant as title
text ("Review the Monday report" → scheduled Monday); use an explicit
`scheduled:` marker, or avoid date words in titles, when that matters. Due is
fully unambiguous (marker-only).

Pure, no Obsidian imports → unit-tested in isolation. `chrono-node` is the only
new dependency.

### Data model

- `DayTask` gains optional `sourceNote?: string` (task.ts). **Projects already
  exist on the model** — parsed `+project`s reuse `CreateDayTaskInput.projects`
  via the existing `mergeUniqueProjects`; no model change for projects.
- `CreateDayTaskInput` gains optional `sourceNote?: string`; `taskFactory`
  copies it through (truthy-guard, like other optional strings).
- `pluginDataAdapter` decodes `sourceNote` via the existing optional-string path
  (add to the `optionalStrings` list); it is opaque (no validation).
- `MemoryTaskIndex` gains `bySourceNote(path): DayTask[]`, mirroring the existing
  `byProject` index (built in `rebuild`/`upsert`/`remove`).

### Capture command (Obsidian glue, `main.ts`)

Command id `capture-task-from-line`, name "Capture task from line", editor
callback, **no default hotkey** (Obsidian rule):

1. Read the current line (or the full selection for multi-line).
2. `parseTaskInput(text, { priorities, today })`. Empty title → Notice, abort.
3. Multi-line selection: lines after the first become the task `description`.
4. `scheduledDate` = parsed scheduled > parsed due > (source is a daily note →
   that date via `resolveDailyNoteDate`) > `todayDate()`.
5. Create via the service: map parsed fields → `CreateDayTaskInput` (parsed
   `projects` → `ProjectLink[]`; `sourceNote` = active file path); persist;
   refresh.
6. Replace the captured line: `${listPrefix}${title}  \`${task.id}\`` (preserve
   the list/checkbox prefix if present).

No new rendering in v1 — the task appears in the daily-note widget for its date.

### Related Tasks note widget — Phase 2

A note whose path has `bySourceNote(path)` hits grows ONE note-level widget
(same injection path as the daily/detail widgets — cheap, only for open leaves)
that renders those task cards under a "Related tasks" header.

- Extend `notePathRendersWidget` / `renderWidgetInto` (main.ts) with a third
  case: source-note → build a widget model from `bySourceNote(path)`.
- Reuses `renderDailyTasksWidget` + the existing reading/live-preview injectors.
- Ships after v1 is validated in daily use.

## Settings

- `enableInlineCapture` (default on) — gates the command.
- (Phase 2) optional `captureAddsContext` etc. — deferred; not in v1.

## Testing

- `tests/core/parseTaskInput.test.ts` (the bulk): tags, contexts, `+project`
  (`+word` and `+[[wikilink]]`), `!priority` matching, estimate forms
  (`1h30m`/`45m`/`2h`/`90`), date routing via colon markers (`due:`/`by:`/
  `deadline:` → due; `scheduled:` or bare date → scheduled) including that plain
  prose words like "by"/"on" are NOT treated as dates without the colon,
  list/checkbox prefix stripping, multi-line →
  description, empty-title failure, and chrono-relative dates with an injected
  `today`. (The no-date → current/daily-day fallback lives in the capture
  command, so it's covered as glue, not in the pure parser.)
- `tests/core/taskIndex.test.ts`: `bySourceNote` lookup.
- `tests/obsidian/pluginDataAdapter.test.ts`: `sourceNote` decode round-trip.
- The `main.ts` command is Obsidian glue → smoke-verified (logic is in the pure
  parser).

## Phasing

- **v1:** `parseTaskInput` + `sourceNote` field/index/decode + capture command +
  line marker. Self-contained, shippable.
- **v2:** Related Tasks note widget.

## Risks / tradeoffs

- **Bundle size:** chrono-node adds weight. Accepted — date NLP is the point;
  rrule/recurrence avoided keeps it minimal.
- **Date-keyword routing** (due vs scheduled) can mis-guess; default to scheduled
  (day-first) and cover with tests. Iterate on the keyword list if needed.
- **Line-marker format** is user-facing and may be refined after dogfooding.
- **Related Tasks injection** must stay note-level (open leaves only) to avoid
  any vault-size cost — same proven pattern as today.

## Files touched

- New: `src/core/parseTaskInput.ts`, `tests/core/parseTaskInput.test.ts`.
- Edit: `src/core/task.ts`, `src/core/taskFactory.ts`, `src/core/taskIndex.ts`,
  `src/obsidian/pluginDataAdapter.ts`, `src/main.ts`, `src/settings/settings.ts`
  (+ `settingsTab.ts` toggle), `package.json` (chrono-node).
- Phase 2: `src/obsidian/widgetRenderer.ts` / `main.ts` injection branch.
