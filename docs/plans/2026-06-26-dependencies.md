# Dependencies (Slice C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Task dependencies — a task can be *blocked by* other tasks (one stored
`blockedBy: string[]` edge of task ids); *blocking* is the inverse, derived and
editable from the same UI. Cycle-safe, with card boxes and click-through to a
task's daily note.

**Architecture:** Pure cycle logic in a new `src/core/dependencies.ts`
(`hasPath`, `wouldCreateCycle`). One stored edge (`blockedBy`); the inverse is an
index lookup (`byBlocker`). Service add/remove guards cycles and cleans up on
delete; the decoder prunes invalid/cyclic edges on load. The pure renderer draws
two relation boxes; Obsidian glue (task picker, modal sections, `main.ts`
click-through) is verified via `build:test` + the CLI.

**Tech Stack:** TypeScript (strict), Vitest + happy-dom, esbuild, Obsidian plugin
API, Lucide icons via the `data-icon` post-pass, CSS built from `styles/`.

## Global Constraints

- Branch is `feat/dependencies`. NEVER commit to `main`.
- `npm run check` (typecheck + vitest) green before every commit; `npm run lint:md`
  clean for any docs.
- `main.ts` and `taskCreationModal.ts` CANNOT load in vitest — no unit tests;
  verify via `npm run build:test` + `obsidian vault=daytask-vault dev:errors`.
- Pure decision logic lives in `src/core` / `src/util` and is unit-tested.
- One stored edge only: `blockedBy: string[]` of task ids. "Blocking" is derived
  via `byBlocker`. Editing the Blocking side writes the *other* task's `blockedBy`.
- Adding a dependency must never create a cycle (`wouldCreateCycle` guard).
- Obsidian CSS variables only; no hardcoded colors; no `!important`; sentence-case
  UI; real buttons + `aria-label` + `:focus-visible`.
- TypeScript strict (`noUnusedLocals`/`noUnusedParameters`).
- Spec: `docs/design/dependencies.md` (decisions locked).

---

### Task 1: Core — dependency cycle check

**Files:**

- Create: `src/core/dependencies.ts`
- Test: `tests/core/dependencies.test.ts`

**Interfaces:**

- Produces:
  - `hasPath(fromId: string, toId: string, blockersOf: (id: string) => string[]): boolean`
  - `wouldCreateCycle(taskId: string, blockerId: string, blockersOf: (id: string) => string[]): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// tests/core/dependencies.test.ts
import { describe, expect, it } from "vitest";
import { hasPath, wouldCreateCycle } from "../../src/core/dependencies";

// a blockedBy b, b blockedBy c  (blockersOf returns who a node is blocked by)
const edges: Record<string, string[]> = { a: ["b"], b: ["c"], c: [] };
const blockersOf = (id: string): string[] => edges[id] ?? [];

describe("hasPath", () => {
 it("finds a direct and transitive path", () => {
  expect(hasPath("a", "b", blockersOf)).toBe(true);
  expect(hasPath("a", "c", blockersOf)).toBe(true);
 });
 it("is false when unreachable", () => {
  expect(hasPath("c", "a", blockersOf)).toBe(false);
 });
 it("terminates on a cyclic graph", () => {
  const cyclic = (id: string): string[] => (id === "x" ? ["y"] : ["x"]);
  expect(hasPath("x", "z", cyclic)).toBe(false);
 });
});

describe("wouldCreateCycle", () => {
 it("rejects a self dependency", () => {
  expect(wouldCreateCycle("a", "a", blockersOf)).toBe(true);
 });
 it("rejects a direct back-edge (c already depends on... a via chain)", () => {
  // a depends on b depends on c; making c blocked by a closes the loop.
  expect(wouldCreateCycle("c", "a", blockersOf)).toBe(true);
 });
 it("allows a safe new edge", () => {
  // a blocked by c: a already reaches c, but c does not reach a → safe.
  expect(wouldCreateCycle("a", "c", blockersOf)).toBe(false);
 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/dependencies.test.ts`
Expected: FAIL — module/exports missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/dependencies.ts

/**
 * True when `toId` is reachable from `fromId` by following `blockedBy` edges
 * (`blockersOf`). DFS with a visited set, so a cyclic graph terminates.
 */
export function hasPath(
 fromId: string,
 toId: string,
 blockersOf: (id: string) => string[]
): boolean {
 const visited = new Set<string>();
 const stack = [fromId];
 while (stack.length > 0) {
  const current = stack.pop() as string;
  if (current === toId && current !== fromId) {
   return true;
  }
  for (const next of blockersOf(current)) {
   if (next === toId) {
    return true;
   }
   if (!visited.has(next)) {
    visited.add(next);
    stack.push(next);
   }
  }
 }
 return false;
}

/**
 * True when adding "`taskId` blocked by `blockerId`" would close a cycle: the
 * blocker is the task itself, or the task is already reachable from the blocker
 * (so the new edge points back into its own dependency chain).
 */
export function wouldCreateCycle(
 taskId: string,
 blockerId: string,
 blockersOf: (id: string) => string[]
): boolean {
 if (taskId === blockerId) {
  return true;
 }
 return hasPath(blockerId, taskId, blockersOf);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/dependencies.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/dependencies.ts tests/core/dependencies.test.ts
git commit -m "feat(core): add dependency cycle check (hasPath/wouldCreateCycle)"
```

---

### Task 2: Model — `blockedBy` field

**Files:**

- Modify: `src/core/task.ts` (`DayTask`, `CreateDayTaskInput`)
- Modify: `src/core/taskFactory.ts` (set `blockedBy` when provided)
- Test: `tests/core/taskFactory.test.ts`

**Interfaces:**

- Produces: `DayTask.blockedBy?: string[]`, `CreateDayTaskInput.blockedBy?: string[]`.
  Not added to `UpdateDayTaskInput` — `updateTask` preserves `blockedBy` via the
  `...task` spread; dependencies are edited through Task 5's service methods.

- [ ] **Step 1: Write the failing test**

```ts
// add to tests/core/taskFactory.test.ts (uses the file's existing createDayTask
// + statusManager setup — mirror the nearest existing test for the deps object)
it("sets blockedBy when provided", () => {
 const task = createDayTask(
  { title: "T", scheduledDate: "2026-06-25", blockedBy: ["TSK-aaaaaaaa"] },
  { statusManager, now: () => "2026-06-25T08:00:00.000Z", id: () => "TSK-bbbbbbbb" }
 );
 expect(task.blockedBy).toEqual(["TSK-aaaaaaaa"]);
});

it("omits blockedBy when not provided", () => {
 const task = createDayTask(
  { title: "T", scheduledDate: "2026-06-25" },
  { statusManager, now: () => "2026-06-25T08:00:00.000Z", id: () => "TSK-bbbbbbbb" }
 );
 expect(task.blockedBy).toBeUndefined();
});
```

Check the top of `tests/core/taskFactory.test.ts` for the exact `statusManager`
construction and `createDayTask` deps shape, and match it.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/taskFactory.test.ts`
Expected: FAIL — `blockedBy` not on the type / not set.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/task.ts — add to DayTask (near parentId):
//   blockedBy?: string[];
// add to CreateDayTaskInput (near parentId):
//   blockedBy?: string[];
```

```ts
// src/core/taskFactory.ts — in createDayTask, after the parentId block:
 if (input.blockedBy && input.blockedBy.length > 0) {
  task.blockedBy = mergeUniqueStrings(input.blockedBy);
 }
```

`mergeUniqueStrings` is already imported in `taskFactory.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/taskFactory.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/task.ts src/core/taskFactory.ts tests/core/taskFactory.test.ts
git commit -m "feat(core): add blockedBy field to the task model"
```

---

### Task 3: Index — `byBlocker` inverse lookup

**Files:**

- Modify: `src/core/taskIndex.ts`
- Test: `tests/core/taskIndex.test.ts`

**Interfaces:**

- Produces: `TaskIndex.byBlocker(id: string): DayTask[]` — tasks whose `blockedBy`
  contains `id`. Mirrors `byTag` (array-valued indexing).

- [ ] **Step 1: Write the failing test**

```ts
// add to tests/core/taskIndex.test.ts (mirror an existing byTag test for fixtures)
it("indexes tasks by the ids they are blocked by", () => {
 const index = new MemoryTaskIndex();
 const a = makeTask({ id: "TSK-aaaaaaaa", blockedBy: ["TSK-cccccccc"] });
 const b = makeTask({ id: "TSK-bbbbbbbb", blockedBy: ["TSK-cccccccc"] });
 index.rebuild([a, b]);
 expect(index.byBlocker("TSK-cccccccc").map((t) => t.id)).toEqual([
  "TSK-aaaaaaaa",
  "TSK-bbbbbbbb",
 ]);
 expect(index.byBlocker("TSK-none")).toEqual([]);
});

it("updates byBlocker when blockedBy changes", () => {
 const index = new MemoryTaskIndex();
 const a = makeTask({ id: "TSK-aaaaaaaa", blockedBy: ["TSK-cccccccc"] });
 index.upsert(a);
 index.upsert({ ...a, blockedBy: ["TSK-dddddddd"] });
 expect(index.byBlocker("TSK-cccccccc")).toEqual([]);
 expect(index.byBlocker("TSK-dddddddd").map((t) => t.id)).toEqual(["TSK-aaaaaaaa"]);
});
```

Use the file's existing task fixture helper (e.g. `makeTask`); if there isn't one,
build a full `DayTask` literal as the other tests in this file do.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/taskIndex.test.ts`
Expected: FAIL — `byBlocker` missing.

- [ ] **Step 3: Write minimal implementation**

In `src/core/taskIndex.ts`, mirror every place `byTagMap` / `task.tags` appears,
for `byBlockerMap` / `task.blockedBy ?? []`:

```ts
// interface TaskIndex: add
 byBlocker(id: string): DayTask[];

// class fields: add
 private byBlockerMap = new Map<string, DayTask[]>();

// rebuild(): add
 this.byBlockerMap = new Map();

// public accessor (mirror byTag):
 byBlocker(id: string): DayTask[] {
  return [...(this.byBlockerMap.get(id) ?? [])];
 }

// addToSecondaryMaps(): add
 for (const blockerId of task.blockedBy ?? []) {
  this.addToMap(this.byBlockerMap, blockerId, task);
 }

// removeFromSecondaryMaps(): add
 for (const blockerId of task.blockedBy ?? []) {
  this.removeFromMap(this.byBlockerMap, blockerId, task);
 }

// syncSecondaryMaps(): add
 this.syncMap(this.byBlockerMap, previous.blockedBy ?? [], next.blockedBy ?? [], next);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/taskIndex.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/taskIndex.ts tests/core/taskIndex.test.ts
git commit -m "feat(core): index tasks by blocker id (byBlocker)"
```

---

### Task 4: Decoder — validate `blockedBy` on load

**Files:**

- Modify: `src/obsidian/pluginDataAdapter.ts`
- Test: `tests/obsidian/pluginDataAdapter.test.ts`

**Interfaces:**

- Consumes: `hasPath` (Task 1), `asStringArray` (existing in this file).
- Produces: decoded `blockedBy` is a deduped string array with self-references,
  unknown ids, and cycle-closing edges removed.

- [ ] **Step 1: Write the failing test**

```ts
// add inside describe("decodePluginData", ...) in tests/obsidian/pluginDataAdapter.test.ts
it("coerces blockedBy and drops self + unknown ids", () => {
 const decoded = decodePluginData({
  tasks: [
   { ...validTask, id: "TSK-aaaaaaaa", blockedBy: ["TSK-aaaaaaaa", "TSK-bbbbbbbb", 5, "TSK-ghost"] },
   { ...validTask, id: "TSK-bbbbbbbb" },
  ],
 });
 expect(decoded.tasks[0].blockedBy).toEqual(["TSK-bbbbbbbb"]);
});

it("breaks a cyclic blockedBy chain on load", () => {
 const decoded = decodePluginData({
  tasks: [
   { ...validTask, id: "TSK-aaaaaaaa", blockedBy: ["TSK-bbbbbbbb"] },
   { ...validTask, id: "TSK-bbbbbbbb", blockedBy: ["TSK-aaaaaaaa"] },
  ],
 });
 const edges = decoded.tasks.flatMap((t) => (t.blockedBy ?? []).map((b) => `${t.id}->${b}`));
 // One direction is kept, the back-edge that would close the cycle is dropped.
 expect(edges).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/obsidian/pluginDataAdapter.test.ts`
Expected: FAIL — `blockedBy` passed through unvalidated / undefined.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/obsidian/pluginDataAdapter.ts
import { hasPath } from "../core/dependencies";

// In normalizeStoredTask, after the optionalStrings loop, coerce blockedBy:
 const blockedBy = asStringArray(task.blockedBy);
 if (blockedBy.length > 0) {
  normalized.blockedBy = blockedBy;
 }

// Add a second-pass validator and call it from decodePluginData:
function validateDependencies(tasks: DayTask[]): void {
 const ids = new Set(tasks.map((t) => t.id));
 const kept = new Map<string, string[]>(); // task id -> kept blockedBy
 const blockersOf = (id: string): string[] => kept.get(id) ?? [];
 for (const task of tasks) {
  if (!task.blockedBy) {
   continue;
  }
  const next: string[] = [];
  for (const blockerId of task.blockedBy) {
   if (blockerId === task.id || !ids.has(blockerId)) {
    continue; // self or unknown
   }
   // Keep only if it doesn't close a cycle against edges kept so far.
   if (hasPath(blockerId, task.id, blockersOf)) {
    continue;
   }
   next.push(blockerId);
   kept.set(task.id, next);
  }
  if (next.length > 0) {
   task.blockedBy = next;
  } else {
   delete task.blockedBy;
  }
 }
}

// In decodePluginData, after `const tasks = ...map(normalizeStoredTask)`:
 validateDependencies(tasks);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/obsidian/pluginDataAdapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/obsidian/pluginDataAdapter.ts tests/obsidian/pluginDataAdapter.test.ts
git commit -m "fix(decoder): validate blockedBy (drop self/unknown, break cycles)"
```

---

### Task 5: Service — add / remove dependency + delete cleanup

**Files:**

- Modify: `src/core/dayTaskService.ts`
- Test: `tests/core/dayTaskService.test.ts`

**Interfaces:**

- Consumes: `wouldCreateCycle` (Task 1), `index.byBlocker` (Task 3),
  `mergeUniqueStrings` (already imported in the service via taskFactory? import if
  needed).
- Produces:
  - `addDependency(taskId: string, blockerId: string): Promise<DayTask>`
  - `removeDependency(taskId: string, blockerId: string): Promise<DayTask>`
  - `deleteTask` also strips the deleted id from every inbound `blockedBy`.

- [ ] **Step 1: Write the failing test**

```ts
// add to tests/core/dayTaskService.test.ts (uses makeServiceWithIds from earlier)
describe("DayTaskService dependencies", () => {
 it("adds a blockedBy edge", async () => {
  const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
  await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
  await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
  const a = await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
  expect(a.blockedBy).toEqual(["TSK-bbbbbbbb"]);
 });

 it("rejects a dependency that would create a cycle", async () => {
  const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
  await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
  await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
  await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb"); // A blocked by B
  await expect(service.addDependency("TSK-bbbbbbbb", "TSK-aaaaaaaa")).rejects.toThrow(
   "cycle"
  );
 });

 it("removes a blockedBy edge", async () => {
  const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
  await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
  await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
  await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
  const a = await service.removeDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
  expect(a.blockedBy).toBeUndefined();
 });

 it("strips inbound edges when a blocker is deleted", async () => {
  const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
  await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
  await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
  await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb"); // A blocked by B
  await service.deleteTask("TSK-bbbbbbbb");
  const a = await service.getTask("TSK-aaaaaaaa");
  expect(a?.blockedBy).toBeUndefined();
 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/dayTaskService.test.ts`
Expected: FAIL — methods missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/dayTaskService.ts
import { wouldCreateCycle } from "./dependencies";
// (mergeUniqueStrings is exported from ./taskFactory — import if not already)
import { mergeUniqueProjects, mergeUniqueStrings } from "./taskFactory";

// methods on the class:
async addDependency(taskId: string, blockerId: string): Promise<DayTask> {
 const task = await this.dependencies.store.get(taskId);
 const blocker = await this.dependencies.store.get(blockerId);
 if (!task || !blocker) {
  throw new Error(`Task not found: ${!task ? taskId : blockerId}`);
 }
 const blockersOf = (id: string): string[] =>
  this.dependencies.index.byId(id)?.blockedBy ?? [];
 if (wouldCreateCycle(taskId, blockerId, blockersOf)) {
  throw new Error("Dependency would create a cycle");
 }
 const updated: DayTask = {
  ...task,
  blockedBy: mergeUniqueStrings(task.blockedBy, [blockerId]),
  updatedAt: this.now(),
 };
 await this.saveAndIndex(updated);
 return updated;
}

async removeDependency(taskId: string, blockerId: string): Promise<DayTask> {
 const task = await this.dependencies.store.get(taskId);
 if (!task) {
  throw new Error(`Task not found: ${taskId}`);
 }
 const remaining = (task.blockedBy ?? []).filter((id) => id !== blockerId);
 const { blockedBy: _drop, ...rest } = task;
 const base: DayTask = { ...rest, updatedAt: this.now() };
 const updated: DayTask = remaining.length > 0 ? { ...base, blockedBy: remaining } : base;
 await this.saveAndIndex(updated);
 return updated;
}
```

In `deleteTask`, before `store.delete(id)`, strip inbound edges (mirror the child
orphan loop):

```ts
 for (const dependent of this.dependencies.index.byBlocker(id)) {
  const fresh = await this.dependencies.store.get(dependent.id);
  if (!fresh?.blockedBy) {
   continue;
  }
  const remaining = fresh.blockedBy.filter((b) => b !== id);
  const { blockedBy: _drop, ...rest } = fresh;
  const next: DayTask =
   remaining.length > 0
    ? { ...rest, blockedBy: remaining, updatedAt: timestamp }
    : { ...rest, updatedAt: timestamp };
  await this.saveAndIndex(next);
 }
```

(`timestamp` is the one `deleteTask` already computes for the child loop.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/dayTaskService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/dayTaskService.ts tests/core/dayTaskService.test.ts
git commit -m "feat(core): add/remove dependency with cycle guard + delete cleanup"
```

---

### Task 6: View model — blocked-by / blocking refs + blocked state

**Files:**

- Modify: `src/ui/taskCard.ts`
- Modify: `src/ui/todayView.ts`
- Modify: `src/ui/dailyTasksWidgetController.ts`
- Test: `tests/ui/taskCard.test.ts`, `tests/ui/dailyTasksWidget.test.ts`

**Interfaces:**

- Produces:
  - `interface TaskRef { id: string; title: string; scheduledDate: string; completed: boolean }`
  - `TaskCardViewModel` gains `blockedBy: TaskRef[]`, `blocking: TaskRef[]`,
    `blocked: boolean`.
  - `createTaskCardViewModel(task, statusManager, referenceDate, priorities, nesting?, relations?)`
    where `relations?: { resolve: (id: string) => DayTask | undefined; blocking: DayTask[] }`,
    default `{ resolve: () => undefined, blocking: [] }`.
  - `DailyTasksWidgetService` gains `getById(id): DayTask | null` and
    `byBlocker(id): DayTask[]`; the widget-model builder threads them.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ui/taskCard.test.ts — add
it("resolves blockedBy + blocking refs and the blocked flag", () => {
 const blocker = { ...task, id: "TSK-blocker01", title: "Blocker", status: "open" };
 const blocked = { ...task, id: "TSK-blocked01", title: "Dependent", status: "open", blockedBy: ["TSK-blocker01"] };
 const model = createTaskCardViewModel(blocked, statusManager, "2026-06-24", priorities, {}, {
  resolve: (id) => (id === "TSK-blocker01" ? blocker : undefined),
  blocking: [],
 });
 expect(model.blockedBy.map((r) => r.id)).toEqual(["TSK-blocker01"]);
 expect(model.blockedBy[0].title).toBe("Blocker");
 expect(model.blocked).toBe(true); // blocker is open (not completed)
});

it("is not blocked when all blockers are completed", () => {
 const blocker = { ...task, id: "TSK-blocker01", status: "done" };
 const blocked = { ...task, id: "TSK-blocked01", blockedBy: ["TSK-blocker01"] };
 const model = createTaskCardViewModel(blocked, statusManager, "2026-06-24", priorities, {}, {
  resolve: () => blocker,
  blocking: [],
 });
 expect(model.blocked).toBe(false);
});
```

Update the existing exact-match `toEqual` fixtures in `taskCard.test.ts` and
`dailyTasksWidget.test.ts` to add `blockedBy: []`, `blocking: []`, `blocked: false`
to each card object.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/taskCard.test.ts`
Expected: FAIL — relations not resolved / fields missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ui/taskCard.ts
export interface TaskRef {
 id: string;
 title: string;
 scheduledDate: string;
 completed: boolean;
}

export interface TaskCardRelations {
 resolve?: (id: string) => DayTask | undefined;
 blocking?: DayTask[];
}

// TaskCardViewModel: add
//   blockedBy: TaskRef[];
//   blocking: TaskRef[];
//   blocked: boolean;

// signature:
export function createTaskCardViewModel(
 task: DayTask,
 statusManager: StatusManager,
 referenceDate: string,
 priorities: PriorityConfig[],
 nesting: TaskCardNesting = {},
 relations: TaskCardRelations = {}
): TaskCardViewModel {
 // ...existing body...
 const toRef = (t: DayTask): TaskRef => ({
  id: t.id,
  title: t.title,
  scheduledDate: t.scheduledDate,
  completed: statusManager.isCompletedStatus(t.status),
 });
 const blockedByTasks = (task.blockedBy ?? [])
  .map((id) => relations.resolve?.(id))
  .filter((t): t is DayTask => t !== undefined);
 const blockedBy = blockedByTasks.map(toRef);
 const blocking = (relations.blocking ?? []).map(toRef);
 const blocked = blockedBy.some((ref) => !ref.completed);
 // add to the returned object: blockedBy, blocking, blocked
}
```

```ts
// src/ui/todayView.ts — thread resolve + byBlocker.
// createDailyTasksWidgetModel gains params:
//   getById: (id: string) => DayTask | undefined = () => undefined,
//   getBlocking: (id: string) => DayTask[] = () => [],
// In toCard(node), pass relations:
//   createTaskCardViewModel(node.task, statusManager, referenceDate, priorities,
//     { children, childProgress, expanded },
//     { resolve: getById, blocking: getBlocking(node.task.id) });
```

```ts
// src/ui/dailyTasksWidgetController.ts
// DailyTasksWidgetService: add
//   getById(id: string): DayTask | null;
//   byBlocker(id: string): DayTask[];
// getWidgetForDate passes:
//   (id) => this.dependencies.service.getById(id) ?? undefined,
//   (id) => this.dependencies.service.byBlocker(id)
// to createDailyTasksWidgetModel (after the existing getChildren/expandedIds args).
```

Add the two methods to `DayTaskService` (Task 5 file): `getById(id)` →
`this.dependencies.index.byId(id)`; `byBlocker(id)` →
`this.dependencies.index.byBlocker(id)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ui/taskCard.test.ts tests/ui/dailyTasksWidget.test.ts tests/ui/dailyTasksWidgetController.test.ts`
Expected: PASS (after fixture updates).

- [ ] **Step 5: Commit**

```bash
git add src/ui/ tests/ui/ src/core/dayTaskService.ts
git commit -m "feat(ui): resolve blocked-by/blocking refs + blocked state"
```

---

### Task 7: Renderer — relation boxes + open-task handler

**Files:**

- Modify: `src/obsidian/widgetRenderer.ts`
- Test: `tests/obsidian/widgetRenderer.test.ts`

**Interfaces:**

- Consumes: `card.blockedBy`, `card.blocking`, `card.blocked` (Task 6).
- Produces: `WidgetRenderHandlers` gains `onOpenTask?(taskId: string): void`. Two
  boxes render below tags, above the subtask footer, each only when non-empty.

- [ ] **Step 1: Write the failing test**

```ts
// tests/obsidian/widgetRenderer.test.ts — add to a relations describe.
// Build a card via leafCard({ blockedBy: [ref], blocked: true }) — extend leafCard
// to default blockedBy: [], blocking: [], blocked: false.
it("renders a blocked-by box with clickable chips", () => {
 const ref = { id: "TSK-blocker01", title: "Blocker", scheduledDate: "2026-06-25", completed: false };
 const parent = leafCard({ id: "TSK-aaaaaaaa", blockedBy: [ref], blocked: true });
 const onOpenTask = vi.fn();
 const { root } = render(modelWith([parent]), allOn, { onOpenTask });
 const top = root.querySelector<HTMLElement>(".daytasks-cards > .daytasks-note-widget__card");
 const box = top?.querySelector(".task-card__blocked-by");
 expect(box).not.toBeNull();
 const chip = box?.querySelector<HTMLElement>(".task-card__rel-chip");
 expect(chip?.textContent).toContain("Blocker");
 chip?.dispatchEvent(new Event("click", { bubbles: true }));
 expect(onOpenTask).toHaveBeenCalledWith("TSK-blocker01");
 expect(top?.querySelector(".task-card")?.classList.contains("task-card--blocked")).toBe(true);
});

it("renders no relation boxes when empty", () => {
 const { root } = render(modelWith([leafCard()]));
 const top = root.querySelector(".daytasks-cards > .daytasks-note-widget__card");
 expect(top?.querySelector(".task-card__blocked-by")).toBeNull();
 expect(top?.querySelector(".task-card__blocking")).toBeNull();
});
```

Update `leafCard` and the `filledModel` fixtures to include `blockedBy: []`,
`blocking: []`, `blocked: false`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/obsidian/widgetRenderer.test.ts`
Expected: FAIL — boxes / handler missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/obsidian/widgetRenderer.ts
// WidgetRenderHandlers: add  onOpenTask?(taskId: string): void;

// Helper:
function renderRelationBox(
 className: string,
 label: string,
 refs: TaskCardViewModel["blockedBy"],
 handlers: WidgetRenderHandlers
): HTMLElement {
 const box = el("div", `task-card__rel-box ${className}`);
 box.appendChild(el("div", "task-card__rel-label", label));
 const list = el("div", "task-card__rel-list");
 for (const ref of refs) {
  const chip = el("button", "task-card__rel-chip", `${ref.id} · ${ref.title}`);
  if (ref.completed) {
   chip.classList.add("is-done");
  }
  chip.setAttribute("aria-label", `Open ${ref.title} (${ref.id})`);
  chip.addEventListener("click", (event) => {
   stop(event);
   handlers.onOpenTask?.(ref.id);
  });
  list.appendChild(chip);
 }
 box.appendChild(list);
 return box;
}

// In renderTaskCard, after the tags append and BEFORE the subtask footer:
 if (card.blocked) {
  cardEl.classList.add("task-card--blocked");
 }
 if (card.blockedBy.length > 0) {
  content.appendChild(
   renderRelationBox("task-card__blocked-by", "Blocked by", card.blockedBy, handlers)
  );
 }
 if (card.blocking.length > 0) {
  content.appendChild(
   renderRelationBox("task-card__blocking", "Blocking", card.blocking, handlers)
  );
 }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/obsidian/widgetRenderer.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the gate and commit**

```bash
npm run check
git add src/obsidian/widgetRenderer.ts tests/obsidian/widgetRenderer.test.ts
git commit -m "feat(ui): render blocked-by/blocking boxes with click-through"
```

---

### Task 8: Task picker (fuzzy SuggestModal over tasks)

**Files:**

- Create: `src/obsidian/taskPicker.ts`

**Interfaces:**

- Produces: `class TaskSuggestModal extends FuzzySuggestModal<TaskOption>` where
  `interface TaskOption { id: string; title: string; scheduledDate: string }`;
  constructed with the candidate list + an `onChoose(id)` callback. The picker is
  over the plugin's **own tasks** (`DayTask` data from the store/index — tasks are
  self-contained, NOT vault `.md` files), searched and shown by title + day.

This file is Obsidian-coupled — **no vitest** (verified in Task 12).

- [ ] **Step 1: Implement (mirror `MarkdownPathSuggestModal`)**

```ts
// src/obsidian/taskPicker.ts
import { App, FuzzySuggestModal } from "obsidian";

export interface TaskOption {
 id: string;
 title: string;
 scheduledDate: string;
}

/**
 * Searchable picker over the plugin's own tasks (DayTask data from the
 * store/index — NOT vault markdown files, since tasks are self-contained).
 * Matched and shown by title + day. Constructed with a pre-filtered candidate
 * list (excludes self + any task that would close a cycle).
 */
export class TaskSuggestModal extends FuzzySuggestModal<TaskOption> {
 constructor(
  app: App,
  private readonly options: TaskOption[],
  private readonly onChoose: (id: string) => void
 ) {
  super(app);
  this.setPlaceholder("Search tasks by title…");
 }

 getItems(): TaskOption[] {
  return this.options;
 }

 getItemText(item: TaskOption): string {
  // Shown + fuzzy-matched: task title and its scheduled day.
  return `${item.title} — ${item.scheduledDate}`;
 }

 onChooseItem(item: TaskOption): void {
  this.onChoose(item.id);
 }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/obsidian/taskPicker.ts
git commit -m "feat(obsidian): add a fuzzy task picker modal"
```

---

### Task 9: Editor — Blocked by / Blocking sections

**Files:**

- Modify: `src/obsidian/taskCreationModal.ts`

**Interfaces:**

- Consumes: `TaskSuggestModal` (Task 8); new modal options.
- Produces: replaces the `buildPlaceholder(..., "ban", "Blocked by", ...)` and
  `(..., "arrow-right", "Blocking", ...)` rows with real sections.

Obsidian-coupled — **no vitest** (verified in Task 12).

- [ ] **Step 1: Add option fields**

```ts
// TaskCreationModalOptions:
 getBlockedBy?: (taskId: string) => DayTask[];
 getBlocking?: (taskId: string) => DayTask[];
 getDependencyCandidates?: (taskId: string) => DayTask[]; // excludes self + cycles
 onAddDependency?: (taskId: string, blockerId: string) => Promise<void>;
 onRemoveDependency?: (taskId: string, blockerId: string) => Promise<void>;
```

- [ ] **Step 2: Replace the two placeholders**

```ts
// in onOpen, replace the two lines:
//   this.buildPlaceholder(placeholders, "ban", "Blocked by", "Add task");
//   this.buildPlaceholder(placeholders, "arrow-right", "Blocking", "Add task");
// with:
 this.buildDependencySection(placeholders, "blocked-by");
 this.buildDependencySection(placeholders, "blocking");
```

```ts
// Add the method. `kind` selects direction; both store the single blockedBy edge:
//   blocked-by add → onAddDependency(thisId, picked)
//   blocking add   → onAddDependency(picked, thisId)
private buildDependencySection(parent: HTMLElement, kind: "blocked-by" | "blocking"): void {
 const initial = this.options.initial;
 const isBlockedBy = kind === "blocked-by";
 const label = isBlockedBy ? "Blocked by" : "Blocking";
 const icon = isBlockedBy ? "ban" : "arrow-right";
 const row = parent.createDiv({ cls: "daytasks-deps" });
 const header = row.createDiv({ cls: "daytasks-placeholder-label" });
 setIcon(header.createSpan({ cls: "daytasks-label-icon" }), icon);
 header.createSpan({ text: label });

 const get = isBlockedBy ? this.options.getBlockedBy : this.options.getBlocking;
 if (!this.isEdit || !initial || !get || !this.options.onAddDependency) {
  header.createSpan({ cls: "daytasks-placeholder-hint", text: "Save the task first to add" });
  return;
 }
 const thisId = initial.id;
 const list = row.createDiv({ cls: "daytasks-deps-list" });
 const renderList = (): void => {
  list.empty();
  for (const dep of get(thisId)) {
   const item = list.createDiv({ cls: "daytasks-dep-row" });
   item.createSpan({ cls: "daytasks-dep-title", text: `${dep.title} (${dep.id})` });
   const remove = item.createEl("button", { cls: "daytasks-dep-remove" });
   setIcon(remove, "x");
   remove.setAttribute("aria-label", `Remove ${dep.title}`);
   remove.addEventListener("click", async () => {
    // blocked-by: thisId blocked by dep → remove(thisId, dep.id)
    // blocking:   dep blocked by thisId → remove(dep.id, thisId)
    if (isBlockedBy) {
     await this.options.onRemoveDependency?.(thisId, dep.id);
    } else {
     await this.options.onRemoveDependency?.(dep.id, thisId);
    }
    renderList();
   });
  }
 };
 renderList();

 const add = row.createEl("button", { cls: "daytasks-dep-add", text: "Add task" });
 add.addEventListener("click", () => {
  const candidates = (this.options.getDependencyCandidates?.(thisId) ?? []).map((t) => ({
   id: t.id,
   title: t.title,
   scheduledDate: t.scheduledDate,
  }));
  new TaskSuggestModal(this.app, candidates, async (pickedId) => {
   if (isBlockedBy) {
    await this.options.onAddDependency?.(thisId, pickedId);
   } else {
    await this.options.onAddDependency?.(pickedId, thisId);
   }
   renderList();
  }).open();
 });
}
```

Import `TaskSuggestModal` from `./taskPicker`. `DayTask` is already imported.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (`buildPlaceholder` is now unused → remove it and its CSS, or keep
only if still referenced; if unused, delete the method to satisfy strict mode).

- [ ] **Step 4: Commit**

```bash
git add src/obsidian/taskCreationModal.ts
git commit -m "feat(modal): wire blocked-by/blocking sections with the task picker"
```

---

### Task 10: main.ts — open-task + dependency wiring

**Files:**

- Modify: `src/main.ts`

**Interfaces:**

- Consumes: the renderer `onOpenTask` (Task 7); the modal options (Task 9); the
  controller threading (Task 6).

Obsidian-coupled — **no vitest** (verified in Task 12).

- [ ] **Step 1: Wire the render handler + controller**

```ts
// In renderWidgetInto handlers:
   onOpenTask: (taskId) => this.openTaskNote(taskId),

// Method — open the task's scheduled daily note (mirror openProject):
 private openTaskNote(taskId: string): void {
  const task = this.index.byId(taskId);
  if (!task) {
   return;
  }
  this.app.workspace.openLinkText(task.scheduledDate, "", false).catch((error) => {
   console.error("DayTasks: failed to open task note", error);
  });
 }

// DailyTasksWidgetController deps already get `service`; ensure DayTaskService now
// satisfies getById + byBlocker (added in Task 6). No controller change here beyond
// what Task 6 specified.
```

- [ ] **Step 2: Wire the edit-modal dependency callbacks**

```ts
// In openEditModal, add to the TaskCreationModal options:
   getBlockedBy: (id) => {
    const t = this.index.byId(id);
    return (t?.blockedBy ?? [])
     .map((b) => this.index.byId(b))
     .filter((x): x is NonNullable<typeof x> => x != null);
   },
   getBlocking: (id) => this.index.byBlocker(id),
   getDependencyCandidates: (id) => this.dependencyCandidates(id),
   onAddDependency: (tid, bid) => this.addDependency(tid, bid),
   onRemoveDependency: (tid, bid) => this.removeDependency(tid, bid),

// Methods:
 private dependencyCandidates(taskId: string): DayTask[] {
  const blockersOf = (id: string): string[] => this.index.byId(id)?.blockedBy ?? [];
  return this.store.allSync?.() // if no sync list, use index/dataVersion snapshot
   ? []
   : [];
 }
```

NOTE for the implementer: there is no synchronous "all tasks" accessor today.
Add a small one — `DayTaskService.allTasks(): DayTask[]` returning
`this.dependencies.index` snapshot, or expose `index` — and build candidates as
`allTasks().filter(t => t.id !== taskId && !wouldCreateCycle(taskId, t.id, blockersOf))`.
Decide the cleanest accessor while implementing; keep it pure-testable if it grows
logic (put the filter in `src/core/dependencies.ts` as
`dependencyCandidates(taskId, all, blockersOf)` with its own test).

```ts
 private async addDependency(taskId: string, blockerId: string): Promise<void> {
  try {
   await this.service.addDependency(taskId, blockerId);
   await this.persistTasks();
   this.refreshViews();
  } catch (error) {
   console.error("DayTasks: failed to add dependency", error);
   new Notice("DayTasks: could not add that dependency.");
  }
 }

 private async removeDependency(taskId: string, blockerId: string): Promise<void> {
  try {
   await this.service.removeDependency(taskId, blockerId);
   await this.persistTasks();
   this.refreshViews();
  } catch (error) {
   console.error("DayTasks: failed to remove dependency", error);
   new Notice("DayTasks: could not remove that dependency.");
  }
 }
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run check` then `npm run build`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts src/core/dayTaskService.ts
git commit -m "feat: wire dependency add/remove and open-task click-through"
```

---

### Task 11: CSS — relation boxes + blocked emphasis

**Files:**

- Modify: `styles/task-card.css`, `styles/modal.css`

- [ ] **Step 1: Add styles**

```css
/* styles/task-card.css */
.daytasks-plugin .task-card__rel-box {
 margin-top: 4px;
 padding: 4px 6px;
 border: 1px solid var(--background-modifier-border);
 border-radius: var(--radius-s);
}

.daytasks-plugin .task-card__rel-label {
 font-size: var(--font-ui-smaller);
 color: var(--text-muted);
 margin-bottom: 2px;
}

.daytasks-plugin .task-card__rel-list {
 display: flex;
 flex-wrap: wrap;
 gap: 4px;
}

.daytasks-plugin .task-card__rel-chip {
 display: inline-flex;
 align-items: center;
 gap: 4px;
 padding: 1px 6px;
 border-radius: 999px;
 border: 1px solid var(--background-modifier-border);
 background: transparent;
 color: var(--text-normal);
 cursor: pointer;
 font-size: var(--font-ui-smaller);
}

.daytasks-plugin .task-card__rel-chip.is-done {
 text-decoration: line-through;
 color: var(--text-muted);
}

.daytasks-plugin .task-card__rel-chip:focus-visible {
 box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
 outline: none;
}

.daytasks-plugin .task-card--blocked .task-card__blocked-by {
 border-color: color-mix(in srgb, var(--tn-color-error) 45%, var(--background-modifier-border));
}
```

```css
/* styles/modal.css — dependency rows mirror the subtask rows */
.daytasks-deps { display: flex; flex-direction: column; gap: var(--size-4-2); }
.daytasks-deps-list { display: flex; flex-direction: column; gap: var(--size-4-1); }
.daytasks-dep-row { display: flex; align-items: center; gap: var(--size-4-2); }
.daytasks-dep-title { flex: 1; }
.daytasks-dep-remove,
.daytasks-dep-add { cursor: pointer; }
.daytasks-dep-remove:focus-visible,
.daytasks-dep-add:focus-visible {
 box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
 outline: none;
}
```

- [ ] **Step 2: Build + Obsidian smoke**

```bash
npm run build:test
obsidian vault=daytask-vault plugin:reload id=daytasks
obsidian vault=daytask-vault dev:errors
```

Expected: `dev:errors` clean.

- [ ] **Step 3: Manual smoke test**

1. Create tasks A and B on `2026-06-25`.
2. Edit A → Blocked by → Add task → pick B. Confirm A's card shows a "Blocked by"
   box with a B chip and a blocked emphasis; B's card shows a "Blocking" box with
   an A chip (the inverse, no manual entry).
3. Try to add "B blocked by A" → rejected with a notice (cycle).
4. Complete B → A's blocked emphasis clears.
5. Click the B chip on A's card → B's daily note opens.
6. Delete B → A's Blocked-by box disappears.
7. `dev:errors` clean.

- [ ] **Step 4: Commit**

```bash
git add styles/task-card.css styles/modal.css
git commit -m "style: dependency boxes, chips, and blocked emphasis"
```

---

### Task 12: Release note

**Files:**

- Modify: `docs/releases/unreleased.md`

- [ ] **Step 1: Add the note**

```markdown
## Added

- Task dependencies: a task can be blocked by other tasks (and the inverse
  "blocking" view is shown). Edit either side in the task editor via a fuzzy task
  picker; cycles are prevented. Cards show Blocked by / Blocking boxes, mark a task
  blocked while a blocker is open, and a chip opens that task's daily note.
```

- [ ] **Step 2: Lint + gate + commit**

```bash
npm run lint:md
npm run check
git add docs/releases/unreleased.md
git commit -m "docs: note dependencies in unreleased"
```

---

## Self-Review

**Spec coverage:** single stored `blockedBy` edge (T2) + derived `byBlocker` (T3);
cycle guard (T1, T5); decoder validation incl. cycle break (T4); both-sides edit
writing one edge (T9 + T5); fuzzy picker excluding self+cycles (T8 + T10 candidate
filter); card boxes below tags / above progress with blocked emphasis (T7);
click-through to the daily note (T7 + T10); delete cleanup (T5). ✓

**Decoder reuse:** `hasPath` (T1) is reused by the decoder (T4) — order matters,
so T1 precedes T4. ✓

**Fixture churn flagged:** T6 and T7 update existing `toEqual` fixtures (`blockedBy: []`,
`blocking: []`, `blocked: false`) — called out in-task. ✓

**Open implementation detail (T10):** there is no synchronous "all tasks"
accessor today. The implementer adds one (`DayTaskService.allTasks()`), and should
push the candidate filter into a tested pure helper
(`dependencyCandidates(taskId, all, blockersOf)` in `dependencies.ts`) if it grows
beyond a one-liner. Noted, not hidden.

**Out of scope confirmed:** no hide/sort of blocked tasks; no graph view; no
subtask parent-cycle work. ✓
