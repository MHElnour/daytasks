---
id: v0-daily-task-loop
title: V0 Daily Task Loop
type: plan
status: historical
opened: 2026-06-24
closed:
area:
  - core
  - obsidian
  - ui
---

# V0 Daily Task Loop Implementation Plan

**Goal:** Build the first testable DayTasks core loop: create a task, save it, index it, and render a daily-note widget model for the active day.

**Architecture:** Keep v0 store-first and adapter-friendly. Core modules are pure TypeScript; Obsidian-specific code stays out until the core contracts are stable. Daily notes are the workspace surface, while the canonical task store feeds a bottom-of-note widget keyed by stable `TSK-xxxxxxxx` IDs.

**Pivot note:** The original plan included markdown line upserts inside daily notes. We kept the pure markdown helpers as optional utilities, but the active v0 service path no longer mutates note content.

**Tech Stack:** TypeScript, Vitest for unit tests, Obsidian plugin-compatible module layout.

---

## File Structure

- Modify `package.json` to add `test`, `test:watch`, and current dev dependencies.
- Modify `src/core/task.ts` with v0 task input/update types.
- Modify `src/core/taskIds.ts` with generated ID helpers.
- Create `src/core/taskFactory.ts` to normalize task creation inputs.
- Modify `src/core/taskStore.ts` with a memory-backed task store.
- Modify `src/core/taskIndex.ts` with a memory-backed task index.
- Create `src/core/dayTaskService.ts` to orchestrate task creation, status toggles, and indexing.
- Add project and tag metadata to core tasks and indexes.
- Add daily-note date detection plus task-card and daily-widget view models.
- Modify `src/daily-notes/dailyNoteFormatter.ts` with task line formatting.
- Modify `src/daily-notes/dailyNoteParser.ts` with task line parsing.
- Create `src/daily-notes/dailyNoteDocument.ts` with pure section upsert helpers.
- Modify `src/daily-notes/dailyNoteService.ts` with the daily note port interface.
- Add tests under `tests/core/` and `tests/daily-notes/`.

## Task 1: Test Tooling

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Add Vitest scripts and dependencies**

Update `package.json` scripts and dev dependencies:

```json
{
  "scripts": {
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^2.1.9"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: dependency installation succeeds and creates `package-lock.json`.

- [ ] **Step 3: Verify empty test baseline**

Run: `npm test -- --passWithNoTests`

Expected: Vitest exits successfully with no tests.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "test: add vitest"
```

## Task 2: Task IDs and Task Factory

**Files:**

- Modify: `src/core/task.ts`
- Modify: `src/core/taskIds.ts`
- Create: `src/core/taskFactory.ts`
- Test: `tests/core/taskFactory.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/core/taskFactory.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDayTask } from "../../src/core/taskFactory";
import { isTaskId } from "../../src/core/taskIds";

describe("createDayTask", () => {
  it("creates an open task with a generated TSK id and timestamps", () => {
    const task = createDayTask(
      { title: "Buy milk", scheduledDate: "2026-06-24" },
      {
        now: () => "2026-06-24T08:00:00.000Z",
        id: () => "TSK-8cA562sd",
      }
    );

    expect(task).toEqual({
      id: "TSK-8cA562sd",
      title: "Buy milk",
      status: "open",
      scheduledDate: "2026-06-24",
      timeEntries: [],
      createdAt: "2026-06-24T08:00:00.000Z",
      updatedAt: "2026-06-24T08:00:00.000Z",
    });
    expect(isTaskId(task.id)).toBe(true);
  });

  it("rejects blank titles", () => {
    expect(() =>
      createDayTask(
        { title: "   ", scheduledDate: "2026-06-24" },
        { now: () => "2026-06-24T08:00:00.000Z", id: () => "TSK-8cA562sd" }
      )
    ).toThrow("Task title is required");
  });
});
```

- [ ] **Step 2: Run tests to verify red**

Run: `npm test -- tests/core/taskFactory.test.ts`

Expected: fails because `createDayTask` is missing.

- [ ] **Step 3: Implement task ID and factory code**

Implement `isTaskId`, `generateTaskId`, and `createDayTask` so the tests pass. `generateTaskId` returns `TSK-` plus 8 alphanumeric characters.

- [ ] **Step 4: Run tests to verify green**

Run: `npm test -- tests/core/taskFactory.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/task.ts src/core/taskIds.ts src/core/taskFactory.ts tests/core/taskFactory.test.ts
git commit -m "feat: add task factory"
```

## Task 3: Store and Index

**Files:**

- Modify: `src/core/taskStore.ts`
- Modify: `src/core/taskIndex.ts`
- Test: `tests/core/taskStore.test.ts`
- Test: `tests/core/taskIndex.test.ts`

- [ ] **Step 1: Write failing store tests**

Create `tests/core/taskStore.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MemoryTaskStore } from "../../src/core/taskStore";
import type { DayTask } from "../../src/core/task";

const task: DayTask = {
  id: "TSK-8cA562sd",
  title: "Buy milk",
  status: "open",
  scheduledDate: "2026-06-24",
  timeEntries: [],
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z",
};

describe("MemoryTaskStore", () => {
  it("saves, reads, lists, and deletes tasks by id", async () => {
    const store = new MemoryTaskStore();

    await store.save(task);

    expect(await store.get(task.id)).toEqual(task);
    expect(await store.list()).toEqual([task]);

    await store.delete(task.id);
    expect(await store.get(task.id)).toBeNull();
    expect(await store.list()).toEqual([]);
  });
});
```

- [ ] **Step 2: Write failing index tests**

Create `tests/core/taskIndex.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MemoryTaskIndex } from "../../src/core/taskIndex";
import type { DayTask } from "../../src/core/task";

const tasks: DayTask[] = [
  {
    id: "TSK-8cA562sd",
    title: "Buy milk",
    status: "open",
    scheduledDate: "2026-06-24",
    parentId: "TSK-parent1",
    timeEntries: [],
    createdAt: "2026-06-24T08:00:00.000Z",
    updatedAt: "2026-06-24T08:00:00.000Z",
  },
  {
    id: "TSK-GJM4c42e",
    title: "Send proposal",
    status: "done",
    scheduledDate: "2026-06-25",
    timeEntries: [],
    createdAt: "2026-06-24T09:00:00.000Z",
    updatedAt: "2026-06-24T09:00:00.000Z",
  },
];

describe("MemoryTaskIndex", () => {
  it("indexes tasks by id, date, status, and parent", () => {
    const index = new MemoryTaskIndex();

    index.rebuild(tasks);

    expect(index.byId("TSK-8cA562sd")).toEqual(tasks[0]);
    expect(index.byDate("2026-06-24")).toEqual([tasks[0]]);
    expect(index.byStatus("done")).toEqual([tasks[1]]);
    expect(index.byParent("TSK-parent1")).toEqual([tasks[0]]);
  });
});
```

- [ ] **Step 3: Run tests to verify red**

Run: `npm test -- tests/core/taskStore.test.ts tests/core/taskIndex.test.ts`

Expected: fails because memory implementations are missing.

- [ ] **Step 4: Implement memory store and index**

Implement `MemoryTaskStore` and `MemoryTaskIndex` using `Map` instances. Preserve insertion order for list and query results.

- [ ] **Step 5: Run tests to verify green**

Run: `npm test -- tests/core/taskStore.test.ts tests/core/taskIndex.test.ts`

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/taskStore.ts src/core/taskIndex.ts tests/core/taskStore.test.ts tests/core/taskIndex.test.ts
git commit -m "feat: add task store and index"
```

## Task 4: Daily Note Formatting and Document Sync

**Files:**

- Modify: `src/daily-notes/dailyNoteFormatter.ts`
- Modify: `src/daily-notes/dailyNoteParser.ts`
- Create: `src/daily-notes/dailyNoteDocument.ts`
- Test: `tests/daily-notes/dailyNoteFormatter.test.ts`
- Test: `tests/daily-notes/dailyNoteDocument.test.ts`

- [ ] **Step 1: Write failing formatter tests**

Create `tests/daily-notes/dailyNoteFormatter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatDailyTaskLine } from "../../src/daily-notes/dailyNoteFormatter";
import { parseDailyTaskLine } from "../../src/daily-notes/dailyNoteParser";

describe("daily note task lines", () => {
  it("formats and parses open task lines", () => {
    const line = formatDailyTaskLine({
      id: "TSK-8cA562sd",
      title: "Buy milk",
      status: "open",
      scheduledDate: "2026-06-24",
      timeEntries: [],
      createdAt: "2026-06-24T08:00:00.000Z",
      updatedAt: "2026-06-24T08:00:00.000Z",
    });

    expect(line).toBe("- [ ] Buy milk <!-- TSK-8cA562sd -->");
    expect(parseDailyTaskLine(line)).toEqual({
      id: "TSK-8cA562sd",
      completed: false,
      title: "Buy milk",
    });
  });

  it("formats completed task lines", () => {
    const line = formatDailyTaskLine({
      id: "TSK-GJM4c42e",
      title: "Send proposal",
      status: "done",
      scheduledDate: "2026-06-24",
      timeEntries: [],
      createdAt: "2026-06-24T08:00:00.000Z",
      updatedAt: "2026-06-24T08:00:00.000Z",
    });

    expect(line).toBe("- [x] Send proposal <!-- TSK-GJM4c42e -->");
  });
});
```

- [ ] **Step 2: Write failing document sync tests**

Create `tests/daily-notes/dailyNoteDocument.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { upsertDailyTaskLine } from "../../src/daily-notes/dailyNoteDocument";
import type { DayTask } from "../../src/core/task";

const task: DayTask = {
  id: "TSK-8cA562sd",
  title: "Buy milk",
  status: "open",
  scheduledDate: "2026-06-24",
  timeEntries: [],
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z",
};

describe("upsertDailyTaskLine", () => {
  it("creates a task section when missing", () => {
    expect(upsertDailyTaskLine("", task, "Tasks")).toBe(
      "## Tasks\n\n- [ ] Buy milk <!-- TSK-8cA562sd -->\n"
    );
  });

  it("appends a task to an existing task section", () => {
    const input = "Intro\n\n## Tasks\n\n- [ ] Existing <!-- TSK-existing1 -->\n";

    expect(upsertDailyTaskLine(input, task, "Tasks")).toBe(
      "Intro\n\n## Tasks\n\n- [ ] Existing <!-- TSK-existing1 -->\n- [ ] Buy milk <!-- TSK-8cA562sd -->\n"
    );
  });

  it("updates an existing task line by id", () => {
    const doneTask = { ...task, status: "done" as const };
    const input = "## Tasks\n\n- [ ] Old title <!-- TSK-8cA562sd -->\n";

    expect(upsertDailyTaskLine(input, doneTask, "Tasks")).toBe(
      "## Tasks\n\n- [x] Buy milk <!-- TSK-8cA562sd -->\n"
    );
  });
});
```

- [ ] **Step 3: Run tests to verify red**

Run: `npm test -- tests/daily-notes/dailyNoteFormatter.test.ts tests/daily-notes/dailyNoteDocument.test.ts`

Expected: fails because formatter/document functions are missing.

- [ ] **Step 4: Implement formatter, parser, and document sync**

Implement:

```ts
formatDailyTaskLine(task: DayTask): string
parseDailyTaskLine(line: string): ParsedDailyTaskLine | null
upsertDailyTaskLine(content: string, task: DayTask, heading: string): string
```

Document sync should create `## ${heading}` when missing, append missing task lines inside the section, and replace existing lines containing the same task ID.

- [ ] **Step 5: Run tests to verify green**

Run: `npm test -- tests/daily-notes/dailyNoteFormatter.test.ts tests/daily-notes/dailyNoteDocument.test.ts`

Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/daily-notes/dailyNoteFormatter.ts src/daily-notes/dailyNoteParser.ts src/daily-notes/dailyNoteDocument.ts tests/daily-notes/dailyNoteFormatter.test.ts tests/daily-notes/dailyNoteDocument.test.ts
git commit -m "feat: sync daily note task lines"
```

## Task 5: Core Daily Task Service

**Files:**

- Create: `src/core/dayTaskService.ts`
- Modify: `src/daily-notes/dailyNoteService.ts`
- Test: `tests/core/dayTaskService.test.ts`

- [ ] **Step 1: Write failing service test**

Create `tests/core/dayTaskService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DayTaskService } from "../../src/core/dayTaskService";
import { MemoryTaskIndex } from "../../src/core/taskIndex";
import { MemoryTaskStore } from "../../src/core/taskStore";
import type { DailyNotePort } from "../../src/daily-notes/dailyNoteService";

class MemoryDailyNotePort implements DailyNotePort {
  private notes = new Map<string, string>();

  async read(date: string): Promise<string> {
    return this.notes.get(date) ?? "";
  }

  async write(date: string, content: string): Promise<void> {
    this.notes.set(date, content);
  }

  get(date: string): string {
    return this.notes.get(date) ?? "";
  }
}

describe("DayTaskService", () => {
  it("creates tasks in the store, index, and daily note", async () => {
    const dailyNotes = new MemoryDailyNotePort();
    const service = new DayTaskService({
      store: new MemoryTaskStore(),
      index: new MemoryTaskIndex(),
      dailyNotes,
      dailyTaskHeading: "Tasks",
      now: () => "2026-06-24T08:00:00.000Z",
      id: () => "TSK-8cA562sd",
    });

    const task = await service.createTask({
      title: "Buy milk",
      scheduledDate: "2026-06-24",
    });

    expect(task.id).toBe("TSK-8cA562sd");
    expect(await service.getTask("TSK-8cA562sd")).toEqual(task);
    expect(service.getTasksForDate("2026-06-24")).toEqual([task]);
    expect(dailyNotes.get("2026-06-24")).toBe(
      "## Tasks\n\n- [ ] Buy milk <!-- TSK-8cA562sd -->\n"
    );
  });

  it("toggles status and updates the daily note line", async () => {
    const dailyNotes = new MemoryDailyNotePort();
    const service = new DayTaskService({
      store: new MemoryTaskStore(),
      index: new MemoryTaskIndex(),
      dailyNotes,
      dailyTaskHeading: "Tasks",
      now: () => "2026-06-24T08:00:00.000Z",
      id: () => "TSK-8cA562sd",
    });

    await service.createTask({ title: "Buy milk", scheduledDate: "2026-06-24" });
    const updated = await service.toggleStatus("TSK-8cA562sd");

    expect(updated.status).toBe("done");
    expect(dailyNotes.get("2026-06-24")).toBe(
      "## Tasks\n\n- [x] Buy milk <!-- TSK-8cA562sd -->\n"
    );
  });
});
```

- [ ] **Step 2: Run test to verify red**

Run: `npm test -- tests/core/dayTaskService.test.ts`

Expected: fails because `DayTaskService` and `DailyNotePort` are missing.

- [ ] **Step 3: Implement service and port**

Implement `DailyNotePort` and `DayTaskService`. The service should:

- load existing tasks from the store during construction through an async `initialize()` if needed, or update the index as tasks are created in v0;
- create tasks with `createDayTask`;
- save tasks to the store;
- rebuild or update the index after writes;
- upsert the task line in the daily note;
- toggle `open` to `done` and `done` to `open`;
- throw `Task not found: ${id}` for unknown toggles.

- [ ] **Step 4: Run tests to verify green**

Run: `npm test -- tests/core/dayTaskService.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Run all tests and typecheck**

Run:

```bash
npm test
npm run typecheck
```

Expected: all tests and typecheck pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/dayTaskService.ts src/daily-notes/dailyNoteService.ts tests/core/dayTaskService.test.ts
git commit -m "feat: add core daily task service"
```

## Self-Review

- Spec coverage: v0 core creation, ID generation, store, index, daily-note projection, and status toggle are covered.
- Scope intentionally excludes card UI, Obsidian vault persistence, and HTTP API implementation. Those remain in the milestone list but should follow after the core loop is tested.
- Placeholder scan: no `TBD` or unspecified implementation steps remain.
- Type consistency: task type is `DayTask`, status is `"open" | "done"`, ID format is `TSK-xxxxxxxx`, and daily-note lines use HTML comments with the task ID.
