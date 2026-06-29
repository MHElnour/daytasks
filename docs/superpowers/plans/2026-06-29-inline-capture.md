# Inline Task Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user type a task in natural language on any note line, run one command, and have DayTasks parse it, create a scheduled task, link the source note, and replace the line with a readable `title + id` marker.

**Architecture:** A new pure parser module (`src/core/parseTaskInput.ts`) turns a line into structured fields using `chrono-node` for dates plus in-house regex extractors for `#tag @ctx +project !priority` and estimates (estimates reuse the existing `parseEstimateMinutes` util). A new optional `sourceNote` field flows through the existing data model, factory, and decoder. Pure capture helpers (`src/core/captureTask.ts`) compute the scheduled-date fallback and the line marker. A thin Obsidian command in `main.ts` wires the editor to these pure pieces and resolves parsed `+project` values to real vault paths.

**Tech Stack:** TypeScript, Obsidian plugin API, `chrono-node`, Vitest (happy-dom), esbuild.

## Global Constraints

- **Pure core, no Obsidian imports:** `src/core/parseTaskInput.ts` and `src/core/captureTask.ts` must NOT import from `obsidian`. They are unit-tested in isolation. Obsidian glue lives only in `src/main.ts`.
- **Determinism:** No `Date.now()` / argless `new Date()` inside pure modules — dates are injected (`opts.today: Date`). Use `localDate(date)` from `src/util/localIso.ts` to format `YYYY-MM-DD`.
- **Date format:** scheduled/due dates are `YYYY-MM-DD` strings, compared lexicographically.
- **Optional fields are omitted, not `undefined`:** follow the existing truthy-guard pattern (e.g. `if (input.sourceNote) task.sourceNote = input.sourceNote;`) so `undefined` keys never reach `data.json`.
- **Reuse utils, don't reinvent:** estimates use `parseEstimateMinutes` from `src/util/estimate.ts`; dates use `localDate` from `src/util/localIso.ts`. Do not add parallel implementations.
- **Green per commit:** each task ends with its tests green (`npx vitest run <file>`) and `npm run typecheck` clean (tsc covers all of `src/`); the full `npm run check` + `npm run lint` run at Task 8 and Final verification. `noUnusedLocals`/`noUnusedParameters` are on, so never commit an unused import or parameter — a symbol is added in the same task it is first used.
- **Test runner:** `npx vitest run <path>` for a single file; `npm run check` runs `typecheck` + full suite. `npx vitest` only proves tests; run `npm run typecheck` before any commit that changed `src/`.
- **Branch:** all work on `feature/inline-capture` (already checked out).

---

## File Structure

- **New** `src/core/parseTaskInput.ts` — pure NL parser: `ParsedTaskInput`, `ParseTaskInputOptions`, `parseTaskInput`, `splitListPrefix`.
- **New** `src/core/captureTask.ts` — pure capture helpers: `resolveCaptureScheduledDate`, `formatCapturedLine`.
- **New** `tests/core/parseTaskInput.test.ts`, `tests/core/captureTask.test.ts`.
- **Edit** `src/core/task.ts` — add `sourceNote?` to `DayTask` + `CreateDayTaskInput`.
- **Edit** `src/core/taskFactory.ts` — copy `sourceNote` through.
- **Edit** `src/obsidian/pluginDataAdapter.ts` — decode `sourceNote` (add to `optionalStrings`).
- **Edit** `src/settings/settings.ts` + `src/settings/settingsTab.ts` — `enableInlineCapture` flag + toggle.
- **Edit** `src/main.ts` — `capture-task-from-line` command + parsed-project path resolution.
- **Edit** `package.json` — add `chrono-node` dependency.
- **Edit** `docs/releases/unreleased.md`, `docs/features.md`, `docs/settings.md`, `docs/privacy.md` — user-facing docs.

> **Deferred to Phase 2 (NOT in this plan):** the `bySourceNote` index on `MemoryTaskIndex` and the note-level "Related tasks" widget. The `sourceNote` field is still stored in v1 (Tasks 1–2) so the link exists; only the lookup index waits until its first consumer (the widget) is built. See **Notes / known caveats**.

---

## Task 1: Add `sourceNote` to the data model + factory

**Files:**

- Modify: `src/core/task.ts` (DayTask ~line 74, CreateDayTaskInput ~line 105)
- Modify: `src/core/taskFactory.ts:104-106`
- Test: `tests/core/taskFactory.test.ts`

**Interfaces:**

- Produces: `DayTask.sourceNote?: string`, `CreateDayTaskInput.sourceNote?: string`. `createDayTask` copies `input.sourceNote` to the task when truthy.
- Note: `sourceNote` is deliberately NOT added to `UpdateDayTaskInput` — like `detailNotePath`, it is set at create time and preserved across edits, never cleared by the edit modal.

- [ ] **Step 1: Write the failing test**

Append to `tests/core/taskFactory.test.ts` inside the `describe("createDayTask", ...)` block:

```ts
    it("copies sourceNote through when provided", () => {
        const task = createDayTask(
            { title: "T", scheduledDate: "2026-06-25", sourceNote: "Notes/Inbox.md" },
            fixedDeps
        );
        expect(task.sourceNote).toBe("Notes/Inbox.md");
    });

    it("omits sourceNote when not provided", () => {
        const task = createDayTask(
            { title: "T", scheduledDate: "2026-06-25" },
            fixedDeps
        );
        expect(task.sourceNote).toBeUndefined();
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/taskFactory.test.ts`
Expected: FAIL — TypeScript error `'sourceNote' does not exist in type 'CreateDayTaskInput'` (or the assertion fails).

- [ ] **Step 3: Add the field to the model**

In `src/core/task.ts`, add `sourceNote?: string;` to the `DayTask` interface, just after `detailNotePath?: string;` (around line 76):

```ts
    parentId?: string;
    blockedBy?: string[];
    detailNotePath?: string;
    /** Path of the note this task was captured from, via inline capture. Opaque. */
    sourceNote?: string;
```

In the same file, add `sourceNote?: string;` to `CreateDayTaskInput`, just after `detailNotePath?: string;` (around line 108):

```ts
    parentId?: string;
    blockedBy?: string[];
    detailNote?: boolean;
    detailNotePath?: string;
    sourceNote?: string;
```

- [ ] **Step 4: Copy it through in the factory**

In `src/core/taskFactory.ts`, after the `detailNotePath` block (lines 104-106), add:

```ts
        if (input.detailNotePath) {
            task.detailNotePath = input.detailNotePath;
        }
        if (input.sourceNote) {
            task.sourceNote = input.sourceNote;
        }
```

- [ ] **Step 5: Run test + typecheck to verify it passes**

Run: `npx vitest run tests/core/taskFactory.test.ts && npm run typecheck`
Expected: PASS and no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/task.ts src/core/taskFactory.ts tests/core/taskFactory.test.ts
git commit -m "feat(core): add optional sourceNote field to tasks

"
```

---

## Task 2: Decode `sourceNote` from stored data

**Files:**

- Modify: `src/obsidian/pluginDataAdapter.ts:116-125`
- Test: `tests/obsidian/pluginDataAdapter.test.ts`

**Interfaces:**

- Consumes: `DayTask.sourceNote?` (Task 1).
- Produces: `normalizeStoredTask` preserves a string `sourceNote` and drops a non-string one.

- [ ] **Step 1: Write the failing test**

Append to `tests/obsidian/pluginDataAdapter.test.ts` inside the `describe("decodePluginData", ...)` block:

```ts
    it("decodes a string sourceNote and drops a non-string one", () => {
        const decoded = decodePluginData({
            tasks: [
                { ...validTask, id: "TSK-aaaaaaaa", sourceNote: "Notes/Inbox.md" },
                { ...validTask, id: "TSK-bbbbbbbb", sourceNote: 42 },
            ],
        });
        const [a, b] = decoded.tasks;
        expect(a.sourceNote).toBe("Notes/Inbox.md");
        expect(b.sourceNote).toBeUndefined();
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/obsidian/pluginDataAdapter.test.ts`
Expected: FAIL — `a.sourceNote` is `undefined` (field not yet decoded).

- [ ] **Step 3: Add `sourceNote` to the optional-string decode list**

In `src/obsidian/pluginDataAdapter.ts`, add `"sourceNote"` to the `optionalStrings` array (lines 116-125):

```ts
        const optionalStrings = [
            "priority",
            "dueDate",
            "completedAt",
            "archivedAt",
            "parentId",
            "detailNotePath",
            "sourceNote",
            "description",
            "sortOrder",
        ] as const;
```

- [ ] **Step 4: Run test + typecheck to verify it passes**

Run: `npx vitest run tests/obsidian/pluginDataAdapter.test.ts && npm run typecheck`
Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/obsidian/pluginDataAdapter.ts tests/obsidian/pluginDataAdapter.test.ts
git commit -m "feat(data): decode sourceNote from stored tasks

"
```

---

## Task 3: Parser module — list prefix + tags/contexts/projects

**Files:**

- Create: `src/core/parseTaskInput.ts`
- Test: `tests/core/parseTaskInput.test.ts`

**Interfaces:**

- Produces:
  - `interface ParsedTaskInput { title: string; scheduledDate?: string; dueDate?: string; priority?: string; tags: string[]; contexts: string[]; projects: string[]; estimateMinutes?: number; }`
  - `function parseTaskInput(input: string): ParsedTaskInput` — this task's signature has no options yet. The `opts` parameter (`ParseTaskInputOptions`) is added in Task 4, when the first consumer (`opts.priorities`) exists, so this commit has no unused parameter.
  - `function splitListPrefix(line: string): { prefix: string; body: string }`
- Consumes: nothing (no imports yet — `PriorityConfig`, `chrono`, and `localDate` arrive in Tasks 4–5 exactly where first used).

- [ ] **Step 1: Write the failing test**

Create `tests/core/parseTaskInput.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseTaskInput, splitListPrefix } from "../../src/core/parseTaskInput";

function parse(input: string) {
    return parseTaskInput(input);
}

describe("splitListPrefix", () => {
    it("splits a checkbox prefix from the body", () => {
        expect(splitListPrefix("- [ ] Buy milk")).toEqual({
            prefix: "- [ ] ",
            body: "Buy milk",
        });
    });

    it("splits a bullet prefix", () => {
        expect(splitListPrefix("* Buy milk")).toEqual({ prefix: "* ", body: "Buy milk" });
    });

    it("splits a numbered + quoted prefix", () => {
        expect(splitListPrefix("> 1. Buy milk")).toEqual({
            prefix: "> 1. ",
            body: "Buy milk",
        });
    });

    it("returns an empty prefix for a plain line", () => {
        expect(splitListPrefix("Buy milk")).toEqual({ prefix: "", body: "Buy milk" });
    });
});

describe("parseTaskInput — tags, contexts, projects", () => {
    it("extracts tags and strips them from the title", () => {
        const r = parse("Email the board #work #urgent");
        expect(r.tags).toEqual(["work", "urgent"]);
        expect(r.title).toBe("Email the board");
    });

    it("extracts contexts", () => {
        const r = parse("Call plumber @phone @home");
        expect(r.contexts).toEqual(["phone", "home"]);
        expect(r.title).toBe("Call plumber");
    });

    it("extracts a bare-word project", () => {
        const r = parse("Draft spec +website");
        expect(r.projects).toEqual(["website"]);
        expect(r.title).toBe("Draft spec");
    });

    it("extracts a wikilink project target", () => {
        const r = parse("Draft spec +[[Projects/Website]]");
        expect(r.projects).toEqual(["Projects/Website"]);
        expect(r.title).toBe("Draft spec");
    });

    it("de-duplicates repeated tokens", () => {
        const r = parse("Email #work #work");
        expect(r.tags).toEqual(["work"]);
    });

    it("strips a list prefix before parsing", () => {
        const r = parse("- [ ] Email the board #work");
        expect(r.title).toBe("Email the board");
        expect(r.tags).toEqual(["work"]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/parseTaskInput.test.ts`
Expected: FAIL — cannot find module `../../src/core/parseTaskInput`.

- [ ] **Step 3: Create the module with prefix + tag/context/project extraction**

Create `src/core/parseTaskInput.ts`:

```ts
export interface ParsedTaskInput {
    title: string;
    scheduledDate?: string; // YYYY-MM-DD
    dueDate?: string; // YYYY-MM-DD
    priority?: string; // a configured priority value
    tags: string[];
    contexts: string[];
    projects: string[]; // raw +project values (word or wikilink target)
    estimateMinutes?: number;
}

// A leading list/checkbox/quote prefix: optional indent, any number of `>`
// quote markers, a bullet (-,*,+) or numbered (1. / 1)) marker, and an optional
// checkbox. The trailing space is part of the prefix so the marker re-attaches
// cleanly to the title on capture.
const LIST_PREFIX_RE = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+(?:\[[ xX/-]\]\s+)?)/;

const TAG_RE = /(^|\s)#([\p{L}\p{N}_/-]+)/gu;
const CONTEXT_RE = /(^|\s)@([\p{L}\p{N}_/-]+)/gu;
const PROJECT_RE = /(^|\s)\+(?:\[\[([^\]]+)\]\]|([\p{L}\p{N}_/-]+))/gu;

/** Strips a leading list/checkbox/quote prefix, returning it plus the body. */
export function splitListPrefix(line: string): { prefix: string; body: string } {
    const match = line.match(LIST_PREFIX_RE);
    if (!match) {
        return { prefix: "", body: line };
    }
    return { prefix: match[1], body: line.slice(match[1].length) };
}

function dedupe(values: string[]): string[] {
    return [...new Set(values)];
}

/** Pulls `#tags`, leaving the separating whitespace so words don't merge. */
function extractTags(text: string): { tags: string[]; rest: string } {
    const tags: string[] = [];
    const rest = text.replace(TAG_RE, (_m, lead: string, tag: string) => {
        tags.push(tag);
        return lead;
    });
    return { tags: dedupe(tags), rest };
}

function extractContexts(text: string): { contexts: string[]; rest: string } {
    const contexts: string[] = [];
    const rest = text.replace(CONTEXT_RE, (_m, lead: string, ctx: string) => {
        contexts.push(ctx);
        return lead;
    });
    return { contexts: dedupe(contexts), rest };
}

/** `+word` or `+[[wikilink target]]` → raw project string. */
function extractProjects(text: string): { projects: string[]; rest: string } {
    const projects: string[] = [];
    const rest = text.replace(
        PROJECT_RE,
        (_m, lead: string, wikilink: string | undefined, word: string | undefined) => {
            projects.push(wikilink ?? word ?? "");
            return lead;
        }
    );
    return { projects: dedupe(projects.filter(Boolean)), rest };
}

export function parseTaskInput(input: string): ParsedTaskInput {
    const { body } = splitListPrefix(input);
    let text = body;

    const tagsR = extractTags(text);
    text = tagsR.rest;
    const ctxR = extractContexts(text);
    text = ctxR.rest;
    const projR = extractProjects(text);
    text = projR.rest;

    const title = text.replace(/\s+/g, " ").trim();

    return {
        title,
        tags: tagsR.tags,
        contexts: ctxR.contexts,
        projects: projR.projects,
    };
}
```

- [ ] **Step 4: Run test + typecheck to verify it passes**

Run: `npx vitest run tests/core/parseTaskInput.test.ts && npm run typecheck`
Expected: PASS and no type errors (no unused imports/params).

- [ ] **Step 5: Commit**

```bash
git add src/core/parseTaskInput.ts tests/core/parseTaskInput.test.ts
git commit -m "feat(core): parse tags/contexts/projects from a task line

"
```

---

## Task 4: Parser — priority (marker-only) + estimate

**Files:**

- Modify: `src/core/parseTaskInput.ts`
- Test: `tests/core/parseTaskInput.test.ts`

**Interfaces:**

- Consumes: `parseTaskInput` / `ParsedTaskInput` (Task 3); `PriorityConfig` from `src/core/status.ts`; `parseEstimateMinutes` from `src/util/estimate.ts`; `DEFAULT_PRIORITIES` (test only).
- Produces:
  - `interface ParseTaskInputOptions { priorities: PriorityConfig[]; today: Date; }` and the new signature `parseTaskInput(input: string, opts: ParseTaskInputOptions): ParsedTaskInput`. (`opts.priorities` is used here; `opts.today` is used in Task 5 — `opts` itself is referenced now, so no unused-parameter error.)
  - `ParsedTaskInput.priority` — **marker-only** (`!high`), matched against `opts.priorities` by value or label, case-insensitive. A bare priority word is NOT treated as a priority (avoids title-word collisions like "high level plan").
  - `ParsedTaskInput.estimateMinutes` — `1h30m` / `2h` / `45m` / `90`, computed by the shared `parseEstimateMinutes` util (this module only locates the candidate token).

- [ ] **Step 1: Update the test helper to pass options**

At the top of `tests/core/parseTaskInput.test.ts`, add the `DEFAULT_PRIORITIES` import and a fixed `today`, and rewrite the `parse` helper to pass options:

```ts
import { describe, expect, it } from "vitest";
import { parseTaskInput, splitListPrefix } from "../../src/core/parseTaskInput";
import { DEFAULT_PRIORITIES } from "../../src/core/status";

// Local noon on Mon 2026-06-29 — avoids UTC-midnight timezone drift.
const TODAY = new Date(2026, 5, 29, 12, 0, 0);

function parse(input: string) {
    return parseTaskInput(input, { priorities: DEFAULT_PRIORITIES, today: TODAY });
}
```

(The existing Task 3 describe-blocks keep using `parse(...)` unchanged.)

- [ ] **Step 2: Write the failing test**

Append to `tests/core/parseTaskInput.test.ts`:

```ts
describe("parseTaskInput — priority", () => {
    it("matches a !marker priority by value", () => {
        const r = parse("Ship release !high");
        expect(r.priority).toBe("high");
        expect(r.title).toBe("Ship release");
    });

    it("does NOT treat a bare priority word as a priority", () => {
        // 'high' without the ! marker is ordinary title text — no collision.
        const r = parse("Ship release high level plan");
        expect(r.priority).toBeUndefined();
        expect(r.title).toBe("Ship release high level plan");
    });

    it("leaves priority undefined when none is present", () => {
        const r = parse("Ship release");
        expect(r.priority).toBeUndefined();
    });
});

describe("parseTaskInput — estimate", () => {
    it("parses hours and minutes", () => {
        expect(parse("Write report 1h30m").estimateMinutes).toBe(90);
    });

    it("parses hours only", () => {
        expect(parse("Write report 2h").estimateMinutes).toBe(120);
    });

    it("parses minutes only", () => {
        expect(parse("Write report 45m").estimateMinutes).toBe(45);
    });

    it("parses a bare number as minutes", () => {
        const r = parse("Write report 90");
        expect(r.estimateMinutes).toBe(90);
        expect(r.title).toBe("Write report");
    });

    it("leaves estimate undefined when absent", () => {
        expect(parse("Write report").estimateMinutes).toBeUndefined();
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/core/parseTaskInput.test.ts`
Expected: FAIL — TypeScript error (`parseTaskInput` takes 1 arg) and/or `priority`/`estimateMinutes` undefined.

- [ ] **Step 4: Add imports + the options interface**

At the top of `src/core/parseTaskInput.ts`, add:

```ts
import { parseEstimateMinutes } from "../util/estimate";
import type { PriorityConfig } from "./status";
```

After the `ParsedTaskInput` interface, add:

```ts
export interface ParseTaskInputOptions {
    priorities: PriorityConfig[];
    today: Date;
}
```

- [ ] **Step 5: Add the priority + estimate extractors**

In `src/core/parseTaskInput.ts`, add above `parseTaskInput`:

```ts
const PRIORITY_MARKER_RE = /(^|\s)!([\p{L}\p{N}_-]+)/gu;

/** `!high` (marker only) → a configured priority value; bare words are ignored. */
function extractPriority(
    text: string,
    priorities: PriorityConfig[]
): { priority?: string; rest: string } {
    const byToken = new Map<string, string>();
    for (const p of priorities) {
        byToken.set(p.value.toLowerCase(), p.value);
        byToken.set(p.label.toLowerCase(), p.value);
    }
    let priority: string | undefined;

    const rest = text.replace(PRIORITY_MARKER_RE, (whole, lead: string, token: string) => {
        const match = byToken.get(token.toLowerCase());
        if (match && priority === undefined) {
            priority = match;
            return lead;
        }
        return whole;
    });

    return { priority, rest };
}

// Locates an estimate token anywhere in the residue; the actual parse (and the
// supported forms) is owned by parseEstimateMinutes — this regex only finds the
// candidate so a sentence word isn't fed to the util. The separating whitespace
// (capture group 1) is preserved when the token is stripped.
const ESTIMATE_TOKEN_RE = /(^|\s)(\d+h\d+m|\d+h|\d+m|\d+)(?=\s|$)/u;

function extractEstimate(text: string): { estimateMinutes?: number; rest: string } {
    const m = text.match(ESTIMATE_TOKEN_RE);
    if (!m || m.index === undefined) {
        return { rest: text };
    }
    const minutes = parseEstimateMinutes(m[2]);
    if (minutes === undefined) {
        return { rest: text };
    }
    const rest = text.slice(0, m.index) + m[1] + text.slice(m.index + m[0].length);
    return { estimateMinutes: minutes, rest };
}
```

- [ ] **Step 6: Add the options parameter and wire priority + estimate**

Change the `parseTaskInput` signature and body. Add `opts`, run priority then estimate after the projects extraction, and build the result with truthy guards:

```ts
export function parseTaskInput(
    input: string,
    opts: ParseTaskInputOptions
): ParsedTaskInput {
    const { body } = splitListPrefix(input);
    let text = body;

    const tagsR = extractTags(text);
    text = tagsR.rest;
    const ctxR = extractContexts(text);
    text = ctxR.rest;
    const projR = extractProjects(text);
    text = projR.rest;
    const prioR = extractPriority(text, opts.priorities);
    text = prioR.rest;
    const estR = extractEstimate(text);
    text = estR.rest;

    const title = text.replace(/\s+/g, " ").trim();

    const result: ParsedTaskInput = {
        title,
        tags: tagsR.tags,
        contexts: ctxR.contexts,
        projects: projR.projects,
    };
    if (prioR.priority !== undefined) {
        result.priority = prioR.priority;
    }
    if (estR.estimateMinutes !== undefined) {
        result.estimateMinutes = estR.estimateMinutes;
    }
    return result;
}
```

(`opts.today` is unused until Task 5; `opts` itself is read via `opts.priorities`, so `noUnusedParameters` is satisfied.)

- [ ] **Step 7: Run test + typecheck to verify it passes**

Run: `npx vitest run tests/core/parseTaskInput.test.ts && npm run typecheck`
Expected: PASS and no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/core/parseTaskInput.ts tests/core/parseTaskInput.test.ts
git commit -m "feat(core): parse marker priority and time estimate from a task line

"
```

---

## Task 5: Parser — date semantics (colon markers + bare date)

**Files:**

- Add dependency: `chrono-node` (`package.json`)
- Modify: `src/core/parseTaskInput.ts`
- Test: `tests/core/parseTaskInput.test.ts`

**Interfaces:**

- Consumes: `parseTaskInput` (Task 4); `chrono-node`; `localDate` from `src/util/localIso.ts`; `opts.today`.
- Produces: `ParsedTaskInput.dueDate` (set only by a `due:`/`by:`/`deadline:` marker) and `ParsedTaskInput.scheduledDate` (set by a `scheduled:` marker, else a bare date phrase). Times are ignored.

- [ ] **Step 1: Install chrono-node**

Run: `npm install chrono-node`
Expected: `chrono-node` added under `dependencies` in `package.json`; `node_modules/chrono-node` present. (`chrono-node` ships its own TypeScript types — no `@types` needed. It is bundled by esbuild, not externalized — confirmed against `esbuild.config.mjs` externals.)

- [ ] **Step 2: Write the failing test**

Append to `tests/core/parseTaskInput.test.ts`:

```ts
const ISO = /^\d{4}-\d{2}-\d{2}$/;

describe("parseTaskInput — dates", () => {
    it("routes a due: marker to dueDate (ISO date)", () => {
        const r = parse("Submit form due:2026-07-05");
        expect(r.dueDate).toBe("2026-07-05");
        expect(r.scheduledDate).toBeUndefined();
        expect(r.title).toBe("Submit form");
    });

    it("treats by: and deadline: as due markers", () => {
        expect(parse("Submit form by:2026-07-05").dueDate).toBe("2026-07-05");
        expect(parse("Submit form deadline:2026-07-05").dueDate).toBe("2026-07-05");
    });

    it("routes a scheduled: marker to scheduledDate (ISO date)", () => {
        const r = parse("Plan week scheduled:2026-07-02");
        expect(r.scheduledDate).toBe("2026-07-02");
        expect(r.dueDate).toBeUndefined();
        expect(r.title).toBe("Plan week");
    });

    it("routes a bare date phrase to scheduledDate", () => {
        const r = parse("Plan week 2026-07-02");
        expect(r.scheduledDate).toBe("2026-07-02");
        expect(r.dueDate).toBeUndefined();
    });

    it("supports both scheduled and due in one line", () => {
        const r = parse("Plan launch scheduled:2026-07-02 due:2026-07-05");
        expect(r.scheduledDate).toBe("2026-07-02");
        expect(r.dueDate).toBe("2026-07-05");
        expect(r.title).toBe("Plan launch");
    });

    it("resolves a relative bare date with the injected today", () => {
        const r = parse("Call dentist friday");
        expect(r.scheduledDate).toMatch(ISO);
        // forwardDate: the upcoming Friday is after Mon 2026-06-29.
        expect(r.scheduledDate! > "2026-06-29").toBe(true);
        expect(r.dueDate).toBeUndefined();
    });

    it("does NOT treat bare prose 'by' as a due marker (no colon)", () => {
        const r = parse("Email report by friday");
        // 'by' without a colon is not a due marker...
        expect(r.dueDate).toBeUndefined();
        // ...but the bare date 'friday' is still scheduled.
        expect(r.scheduledDate).toMatch(ISO);
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/core/parseTaskInput.test.ts`
Expected: FAIL — `dueDate` / `scheduledDate` undefined.

- [ ] **Step 4: Add imports + the date extractors**

At the top of `src/core/parseTaskInput.ts`, add (above the existing imports):

```ts
import * as chrono from "chrono-node";
import { localDate } from "../util/localIso";
```

Then add above `parseTaskInput`:

```ts
const DUE_MARKERS = ["due", "by", "deadline"];
const SCHEDULED_MARKERS = ["scheduled"];

/**
 * Finds `marker:` (one of `markers`) followed immediately by a chrono-parseable
 * date phrase, returns that date (YYYY-MM-DD) and the text with marker+phrase
 * removed. Requires the chrono match to start right after the marker so an
 * unrelated later date isn't grabbed.
 */
function extractMarkerDate(
    text: string,
    markers: string[],
    today: Date
): { date?: string; rest: string } {
    const markerRe = new RegExp(`(^|\\s)(?:${markers.join("|")}):\\s*`, "iu");
    const m = text.match(markerRe);
    if (!m || m.index === undefined) {
        return { rest: text };
    }
    const afterIndex = m.index + m[0].length;
    const tail = text.slice(afterIndex);
    const results = chrono.parse(tail, today, { forwardDate: true });
    if (results.length === 0 || results[0].index !== 0) {
        return { rest: text };
    }
    const result = results[0];
    const date = localDate(result.start.date());
    const rest = text.slice(0, m.index) + m[1] + text.slice(afterIndex + result.text.length);
    return { date, rest };
}

/** Scans the remaining text for any bare date phrase → scheduledDate. */
function extractBareDate(text: string, today: Date): { date?: string; rest: string } {
    const results = chrono.parse(text, today, { forwardDate: true });
    if (results.length === 0) {
        return { rest: text };
    }
    const result = results[0];
    const date = localDate(result.start.date());
    const rest = text.slice(0, result.index) + text.slice(result.index + result.text.length);
    return { date, rest };
}
```

- [ ] **Step 5: Wire dates into `parseTaskInput`**

In `parseTaskInput`, after the estimate extraction (`text = estR.rest;`) and before computing `title`:

```ts
    const estR = extractEstimate(text);
    text = estR.rest;

    // Marker dates first (due, then scheduled), then a bare date → scheduled.
    const dueR = extractMarkerDate(text, DUE_MARKERS, opts.today);
    text = dueR.rest;
    const schedMarkerR = extractMarkerDate(text, SCHEDULED_MARKERS, opts.today);
    text = schedMarkerR.rest;

    let scheduledDate = schedMarkerR.date;
    if (scheduledDate === undefined) {
        const bareR = extractBareDate(text, opts.today);
        text = bareR.rest;
        scheduledDate = bareR.date;
    }

    const title = text.replace(/\s+/g, " ").trim();
```

Then extend the result object (after the estimate guard, before `return result;`):

```ts
    if (estR.estimateMinutes !== undefined) {
        result.estimateMinutes = estR.estimateMinutes;
    }
    if (scheduledDate !== undefined) {
        result.scheduledDate = scheduledDate;
    }
    if (dueR.date !== undefined) {
        result.dueDate = dueR.date;
    }
    return result;
```

- [ ] **Step 6: Run test + typecheck to verify it passes**

Run: `npx vitest run tests/core/parseTaskInput.test.ts && npm run typecheck`
Expected: PASS (all parser describe-blocks green) and no type errors (confirms `chrono` / `localDate` / `opts.today` are now used).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/core/parseTaskInput.ts tests/core/parseTaskInput.test.ts
git commit -m "feat(core): route colon-marker and bare dates in the task parser

"
```

---

## Task 6: Capture helpers — scheduled-date fallback + line marker

**Files:**

- Create: `src/core/captureTask.ts`
- Test: `tests/core/captureTask.test.ts`

**Interfaces:**

- Consumes: `ParsedTaskInput` (Tasks 3-5).
- Produces:
  - `function resolveCaptureScheduledDate(parsed: Pick<ParsedTaskInput, "scheduledDate" | "dueDate">, noteDate: string | null, today: string): string` — precedence: scheduled > due > daily-note date > today.
  - `function formatCapturedLine(prefix: string, title: string, taskId: string): string` — `` `${prefix}${title}  \`${taskId}\`` ``.

- [ ] **Step 1: Write the failing test**

Create `tests/core/captureTask.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
    formatCapturedLine,
    resolveCaptureScheduledDate,
} from "../../src/core/captureTask";

describe("resolveCaptureScheduledDate", () => {
    it("prefers a parsed scheduled date", () => {
        const date = resolveCaptureScheduledDate(
            { scheduledDate: "2026-07-02", dueDate: "2026-07-05" },
            "2026-07-01",
            "2026-06-29"
        );
        expect(date).toBe("2026-07-02");
    });

    it("falls back to the parsed due date", () => {
        const date = resolveCaptureScheduledDate(
            { dueDate: "2026-07-05" },
            "2026-07-01",
            "2026-06-29"
        );
        expect(date).toBe("2026-07-05");
    });

    it("falls back to the source note's daily date", () => {
        const date = resolveCaptureScheduledDate({}, "2026-07-01", "2026-06-29");
        expect(date).toBe("2026-07-01");
    });

    it("falls back to today when nothing else is available", () => {
        const date = resolveCaptureScheduledDate({}, null, "2026-06-29");
        expect(date).toBe("2026-06-29");
    });
});

describe("formatCapturedLine", () => {
    it("appends a code-spanned task id, preserving the list prefix", () => {
        expect(formatCapturedLine("- [ ] ", "Buy milk", "TSK-8cA562sd")).toBe(
            "- [ ] Buy milk  `TSK-8cA562sd`"
        );
    });

    it("works with an empty prefix", () => {
        expect(formatCapturedLine("", "Buy milk", "TSK-8cA562sd")).toBe(
            "Buy milk  `TSK-8cA562sd`"
        );
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/captureTask.test.ts`
Expected: FAIL — cannot find module `../../src/core/captureTask`.

- [ ] **Step 3: Create the helper module**

Create `src/core/captureTask.ts`:

```ts
import type { ParsedTaskInput } from "./parseTaskInput";

/**
 * The scheduled date for a captured task: a parsed scheduled date, else a parsed
 * due date, else the source note's daily-note date, else today. DayTasks is
 * day-first, so a captured task always lands on a concrete day.
 */
export function resolveCaptureScheduledDate(
    parsed: Pick<ParsedTaskInput, "scheduledDate" | "dueDate">,
    noteDate: string | null,
    today: string
): string {
    return parsed.scheduledDate ?? parsed.dueDate ?? noteDate ?? today;
}

/** Replacement line for a captured task: prefix + title + code-spanned id. */
export function formatCapturedLine(prefix: string, title: string, taskId: string): string {
    return `${prefix}${title}  \`${taskId}\``;
}
```

- [ ] **Step 4: Run test + typecheck to verify it passes**

Run: `npx vitest run tests/core/captureTask.test.ts && npm run typecheck`
Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/captureTask.ts tests/core/captureTask.test.ts
git commit -m "feat(core): add capture scheduled-date fallback and line marker

"
```

---

## Task 7: Settings — `enableInlineCapture` flag + toggle

**Files:**

- Modify: `src/settings/settings.ts` (interface ~line 31, defaults ~line 68, mergeSettings ~line 196)
- Modify: `src/settings/settingsTab.ts`
- Test: `tests/settings/settings.test.ts` (existing — `describe("mergeSettings", ...)`)

**Interfaces:**

- Produces: `DayTasksSettings.enableInlineCapture: boolean` (default `true`); decoded via `asBooleanOr`.

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe("mergeSettings", ...)` block in `tests/settings/settings.test.ts`:

```ts
    it("defaults enableInlineCapture to true and coerces a non-boolean", () => {
        expect(mergeSettings({}).enableInlineCapture).toBe(true);
        expect(mergeSettings({ enableInlineCapture: false }).enableInlineCapture).toBe(false);
        expect(mergeSettings({ enableInlineCapture: "nope" }).enableInlineCapture).toBe(true);
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/settings/settings.test.ts`
Expected: FAIL — `enableInlineCapture` is `undefined`.

- [ ] **Step 3: Add the field to the interface**

In `src/settings/settings.ts`, add to `DayTasksSettings` after `showProjects: boolean;`:

```ts
    showProjects: boolean;
    // Inline capture
    enableInlineCapture: boolean;
```

- [ ] **Step 4: Add the default**

In `DEFAULT_SETTINGS`, after `showProjects: true,`:

```ts
    showProjects: true,
    enableInlineCapture: true,
```

- [ ] **Step 5: Decode it in `mergeSettings`**

In the returned object of `mergeSettings`, after the `showProjects:` line:

```ts
        showProjects: asBooleanOr(s.showProjects, DEFAULT_SETTINGS.showProjects),
        enableInlineCapture: asBooleanOr(
            s.enableInlineCapture,
            DEFAULT_SETTINGS.enableInlineCapture
        ),
```

- [ ] **Step 6: Add the settings-tab toggle**

In `src/settings/settingsTab.ts`, after the "Show projects" setting block and before the `new Setting(containerEl).setName("Task defaults").setHeading();` line:

```ts
        new Setting(containerEl).setName("Inline capture").setHeading();

        new Setting(containerEl)
            .setName("Enable inline task capture")
            .setDesc(
                "Adds the 'Capture task from line' command. Turn a note line into a scheduled task."
            )
            .addToggle((toggle) =>
                toggle.setValue(settings.enableInlineCapture).onChange(async (value) => {
                    settings.enableInlineCapture = value;
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
git commit -m "feat(settings): add enableInlineCapture toggle

"
```

---

## Task 8: Capture command (Obsidian glue in `main.ts`)

**Files:**

- Modify: `src/main.ts` (imports; `onload` command registration ~line 129; two new methods)

**Interfaces:**

- Consumes: `parseTaskInput`, `splitListPrefix` (Tasks 3-5); `resolveCaptureScheduledDate`, `formatCapturedLine` (Task 6); `resolveDailyNoteDate`; `todayDate`; `ProjectLink`; `this.app.metadataCache.getFirstLinkpathDest`; `this.service.createTask`; `this.settings.enableInlineCapture`.
- Produces: command `capture-task-from-line` ("Capture task from line"), no default hotkey. This is Obsidian glue — the logic is in the pure modules, so it is verified by manual smoke test, not a unit test.

- [ ] **Step 1: Add imports**

In `src/main.ts`, add `Editor` to the existing `obsidian` import on line 2 (leave the `@codemirror/view` import on line 1 untouched — `EditorView` stays there, `Editor` comes from `obsidian`):

```ts
import { Editor, MarkdownView, Menu, Notice, Plugin, TFile, TFolder, normalizePath, setIcon } from "obsidian";
```

Add `type ProjectLink` to the existing `./core/task` import:

```ts
import { toUpdateDayTaskInput, type CreateDayTaskInput, type DayTask, type ProjectLink } from "./core/task";
```

Add the pure-module imports near the other `./core/...` imports:

```ts
import { parseTaskInput, splitListPrefix } from "./core/parseTaskInput";
import { formatCapturedLine, resolveCaptureScheduledDate } from "./core/captureTask";
```

- [ ] **Step 2: Register the command**

In `onload`, after the existing `CREATE_TASK_COMMAND_ID` command block (lines 129-133):

```ts
        this.addCommand({
            id: "capture-task-from-line",
            name: "Capture task from line",
            editorCheckCallback: (checking, editor, ctx) => {
                if (!this.settings.enableInlineCapture) {
                    return false;
                }
                if (checking) {
                    return true;
                }
                void this.runCaptureTaskCommand(editor, ctx.file?.path ?? null);
                return true;
            },
        });
```

- [ ] **Step 3: Add the project-resolution helper + command handler**

Add both methods to the `DayTasksPlugin` class (next to `runCreateTaskCommand`, ~line 496):

```ts
    /**
     * Maps parsed `+project` raw values onto ProjectLinks whose paths match the
     * picker's convention. A `[[wikilink]]` target or bare word is resolved through
     * the metadata cache to a real vault path (e.g. `Projects/Foo` -> `Projects/Foo.md`)
     * so captured projects dedupe and filter alongside picker-created ones; an
     * unresolved value is kept verbatim.
     */
    private resolveProjectLinks(rawProjects: string[], sourcePath: string): ProjectLink[] {
        return rawProjects.map((raw) => {
            const dest = this.app.metadataCache.getFirstLinkpathDest(raw, sourcePath);
            return dest ? { path: dest.path } : { path: raw };
        });
    }

    private async runCaptureTaskCommand(
        editor: Editor,
        notePath: string | null
    ): Promise<void> {
        const selection = editor.getSelection();
        const hasSelection = selection.trim().length > 0;
        const cursor = editor.getCursor();
        const lines = hasSelection ? selection.split("\n") : [editor.getLine(cursor.line)];
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
            editor.setLine(cursor.line, marker);
        }
        new Notice(`DayTasks: captured ${task.id}.`);
    }
```

- [ ] **Step 4: Typecheck + full build**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds; `main.js` is regenerated (chrono-node bundled in).

- [ ] **Step 5: Run the full check**

Run: `npm run check && npm run lint`
Expected: typecheck clean, all tests PASS, lint clean.

- [ ] **Step 6: Manual smoke test (glue verification)**

Install into the test vault and verify in Obsidian:

```bash
npm run build:test
```

Then in Obsidian (reload the plugin):

1. In a daily note `2026-07-02.md`, type a line: `- [ ] Email the board #work !high due:friday 45m` and run **Capture task from line** (Command Palette) with the cursor on that line.
   - Expect: the line becomes `- [ ] Email the board  \`TSK-xxxxxxxx\``; a task appears in that day's widget with tag`work`, priority`high`, a due date, and a 45-minute estimate; a "captured" Notice shows.
2. In a non-daily note `Inbox.md`, type `Call dentist friday`, run the command.
   - Expect: scheduled to the upcoming Friday (no daily-note date available); `sourceNote` = `Inbox.md`.
3. Type `Draft brief +[[Projects/Website]]` where `Projects/Website.md` exists; run the command.
   - Expect: the task's project path is `Projects/Website.md` (resolved to the real note), matching a picker-created project.
4. Select two lines (title on line 1, notes on line 2), run the command.
   - Expect: selection replaced by one marker; the task's description holds line 2.
5. Turn **Enable inline task capture** off in settings; reopen the Command Palette.
   - Expect: "Capture task from line" no longer listed.

Record the result of each check. If any fails, use superpowers:systematic-debugging before proceeding.

- [ ] **Step 7: Commit**

```bash
git add src/main.ts
git commit -m "feat(capture): add 'Capture task from line' command

"
```

---

## Task 9: User-facing docs + release notes

DayTasks requires a release-note entry for any user-facing change (see `AGENTS.md` › Release Notes). Inline capture adds a command, a setting, a new stored `sourceNote` path, and a parser syntax — all user-facing.

**Files:**

- Modify: `docs/releases/unreleased.md`
- Modify: `docs/features.md`
- Modify: `docs/settings.md`
- Modify: `docs/privacy.md`

- [ ] **Step 1: Add the release note**

In `docs/releases/unreleased.md`, under an `### Added` section:

```markdown
### Added

- **Inline task capture.** Run the **Capture task from line** command on any note
  line (or a multi-line selection) to turn it into a scheduled DayTasks task. The
  line is parsed for `#tags`, `@contexts`, `+project` (or `+[[wikilink]]`),
  `!priority`, a time estimate (`45m`, `2h`, `1h30m`, or a bare number of minutes),
  and a date — `scheduled:`/`due:`/`by:`/`deadline:` markers or a bare date phrase.
  The captured line is replaced with `title  ` + the new task id, and the task
  records the note it came from. New setting: **Inline capture › Enable inline task
  capture** (on by default). Multi-line selections use the lines after the first as
  the task description.
```

- [ ] **Step 2: Document the feature**

In `docs/features.md`, add a short "Inline capture" section describing the command, the token syntax (`#tag @ctx +project !priority`, estimate forms), the date semantics (colon markers vs bare date; no date → the note's daily date if it is a daily note, else today), the line marker, and that priority is marker-only (`!high`). Match the surrounding heading level and tone.

- [ ] **Step 3: Document the setting**

In `docs/settings.md`, add **Enable inline task capture** under an "Inline capture" heading: default on; gates the **Capture task from line** command.

- [ ] **Step 4: Note the stored path**

In `docs/privacy.md`, add a line: captured tasks store the source note's vault path (`sourceNote`) in the plugin's local `data.json`, the same as other task data — nothing leaves the vault.

- [ ] **Step 5: Commit**

```bash
git add docs/releases/unreleased.md docs/features.md docs/settings.md docs/privacy.md
git commit -m "docs: document inline task capture

"
```

---

## Final verification

- [ ] **Run the complete check**

Run: `npm run check && npm run lint`
Expected: typecheck clean, all tests PASS, lint clean.

- [ ] **Confirm the branch state**

Run: `git log --oneline -9` and `git status`
Expected: nine feature commits on `feature/inline-capture`, clean working tree.

---

## Notes / known caveats (from the design)

- **Priority is marker-only:** `!high` sets priority; a bare word like "high" in "high level plan" is left as title text. This deliberately drops the spec's "bare priority words" to avoid common-word collisions.
- **Bare-date title collision:** `Review the Monday report` will schedule "Monday" and drop it from the title. Mitigation is to use an explicit `scheduled:` marker or avoid date words. Due is marker-only, so it is unambiguous.
- **Bare-number estimate:** a lone number (`Buy 2 apples`) is read as a 2-minute estimate (the `90`-form behavior of `parseEstimateMinutes`); markered forms (`45m`, `2h`) avoid it.
- **Project path resolution:** parsed `+project` values are resolved through the metadata cache in `main.ts` so a `+[[Projects/Foo]]` or `+Foo` that points at a real note stores the same `Projects/Foo.md` path the picker uses; an unresolved value is stored verbatim and simply won't merge with a picker entry until the note exists.
- **Deferred to Phase 2:** the `bySourceNote` index on `MemoryTaskIndex` and the note-level "Related tasks" widget (renders tasks whose `sourceNote` is the open note, via the existing daily/detail injection path — note-level, open-leaves only). The `sourceNote` field is already stored in v1; only the lookup index and widget wait until that consumer is built, so v1 ships no unused index code.

---

## Self-review (completed against the spec)

- **Goals covered:** single-line/selection capture (Task 8), NL parsing (Tasks 3-5), auto-schedule with fallback (Tasks 6+8), `sourceNote` link (Tasks 1-2), readable line marker (Task 6+8), pure-module testability (Tasks 3-6), user docs (Task 9). ✔
- **Architecture — `parseTaskInput`:** signature grows only as options are consumed (Task 3 takes no `opts`; Task 4 adds it for priority; Task 5 uses `opts.today`) so every commit is typecheck-clean under `noUnusedParameters`. Date semantics implemented in Task 5. The spec's `defaultToScheduled?` option is intentionally omitted (YAGNI — bare dates always route to scheduled). ✔
- **Util reuse:** estimates call `parseEstimateMinutes` (`src/util/estimate.ts`); dates call `localDate` (`src/util/localIso.ts`); decode reuses `optionalStrings`/`asOptionalString`; settings reuse `asBooleanOr`; the factory's merge/default-tag path is untouched. No parallel implementations. ✔
- **Data model:** `sourceNote` on `DayTask` + `CreateDayTaskInput` (Task 1), factory copy-through (Task 1), decode via `optionalStrings` (Task 2). Not added to `UpdateDayTaskInput` — preserved across edits like `detailNotePath`. Projects reuse the existing `CreateDayTaskInput.projects` path; `+project` raws are resolved to real vault paths in glue (Task 8). The `bySourceNote` index is deferred to Phase 2. ✔
- **Capture command:** id/name/no-hotkey, gated by `enableInlineCapture`, line/selection read, empty-title Notice, multi-line → description, scheduled-date precedence, field mapping, project resolution, marker replacement (Task 8). ✔
- **Settings:** `enableInlineCapture` default-on, gates the command (Tasks 7-8). ✔
- **Testing:** parser tests (Tasks 3-5), `sourceNote` decode round-trip (Task 2), factory copy-through (Task 1), capture helper tests (Task 6); the command is smoke-verified (Task 8). ✔
- **Per-commit green:** each task ends with `npx vitest run` + `npm run typecheck`; the final task adds `npm run lint`. No commit carries an unused import or parameter.
