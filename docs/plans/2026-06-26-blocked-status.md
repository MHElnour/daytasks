# Blocked status + dependency locking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the derived "blocked" emphasis into a real plugin-managed
**blocked status** with a status lock and an automatic release cascade, plus
done-task inertness and chip cleanup.

**Architecture:** A reserved, non-editable `blocked` status injected into the
active `StatusManager` (never persisted to the user's status list). The service
sets a task `blocked` when it gains an incomplete blocker and releases it (→
in-progress) when its **last** blocker clears (completed / removed / deleted).
Completing a blocker auto-removes its edge, so a live `blockedBy` edge always
points at an incomplete blocker. The UI locks status changes on blocked tasks and
greys dependency editing on completed tasks. Decision logic stays in pure,
unit-tested modules; Obsidian glue (main.ts, modal) is verified via `build:test` +
the CLI.

**Tech Stack:** TypeScript (strict), Vitest + happy-dom, esbuild, Obsidian plugin
API, Lucide icons via `setIcon` / the `data-icon` post-pass, CSS built from
`styles/`.

## Global Constraints

- Branch is `feat/dependencies` (folds into the unreleased 0.4.0). NEVER commit to
  `main`.
- `npm run check` (typecheck + vitest) green before every commit; `npm run lint:md`
  clean for any docs.
- `main.ts` and `taskCreationModal.ts` CANNOT load in vitest — no unit tests;
  verify via `npm run build:test` + `obsidian vault=daytask-vault dev:errors`.
- Pure decision logic lives in `src/core` and is unit-tested.
- **Reserved blocked status:** value `blocked`, label "Blocked",
  `isCompleted: false`, `excludeFromCycle: true`, never the default, never in the
  user-editable settings list. The plugin sets/clears it automatically.
- **Release target:** a task released from blocked goes to **in-progress** if that
  status exists, else the configured default.
- **"blocked" ⇔ a task has ≥1 `blockedBy` edge.** Completing a blocker removes its
  edge; only clearing the **last** blocker releases the task.
- **Done tasks are inert:** a completed task cannot be a blocker (excluded from the
  picker) and cannot be given dependencies (editor sections greyed).
- **Status lock:** while a task is `blocked`, status changes are rejected in the UI
  with a `Notice`. Other edits and add/remove dependency stay allowed.
- Empty `blockedBy` must be ABSENT (undefined), never `[]`.
- Obsidian CSS variables only; no hardcoded colors in CSS; no `!important`;
  sentence-case UI; real buttons + `aria-label` + `:focus-visible`. (Status
  configs themselves carry hex colors — that is the existing data model, not CSS.)
- TypeScript strict (`noUnusedLocals`/`noUnusedParameters`).
- Spec: `docs/design/blocked-status.md` (decisions locked).

---

### Task 1: Core — reserved blocked status primitives

**Files:**

- Modify: `src/core/status.ts`
- Modify: `src/core/statusManager.ts`
- Test: `tests/core/statusManager.test.ts` (create `tests/core/status.test.ts` only
  if no status-level test file exists for `withBlockedStatus`)

**Interfaces:**

- Produces:
  - `BLOCKED_STATUS_VALUE = "blocked"`, `IN_PROGRESS_STATUS_VALUE = "in-progress"`
    (consts in `status.ts`)
  - `RESERVED_BLOCKED_STATUS: StatusConfig`
  - `withBlockedStatus(statuses: StatusConfig[]): StatusConfig[]`
  - `StatusManager.isBlockedStatus(value: string): boolean`
  - `StatusManager.getReleaseStatus(): string`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/core/statusManager.test.ts — add (mirror the file's existing StatusManager
// construction; build managers from DEFAULT_STATUSES via withBlockedStatus)
import { DEFAULT_STATUSES, withBlockedStatus, BLOCKED_STATUS_VALUE } from "../../src/core/status";
import { StatusManager } from "../../src/core/statusManager";

describe("blocked status primitives", () => {
 it("withBlockedStatus appends the reserved blocked status exactly once", () => {
  const once = withBlockedStatus(DEFAULT_STATUSES);
  expect(once.filter((s) => s.value === BLOCKED_STATUS_VALUE)).toHaveLength(1);
  const twice = withBlockedStatus(once);
  expect(twice.filter((s) => s.value === BLOCKED_STATUS_VALUE)).toHaveLength(1);
 });

 it("withBlockedStatus overrides a user status colliding on the blocked value", () => {
  const collide = [...DEFAULT_STATUSES, { ...DEFAULT_STATUSES[0], id: "x", value: BLOCKED_STATUS_VALUE, label: "Mine" }];
  const result = withBlockedStatus(collide);
  const blocked = result.filter((s) => s.value === BLOCKED_STATUS_VALUE);
  expect(blocked).toHaveLength(1);
  expect(blocked[0].label).toBe("Blocked");
  expect(blocked[0].excludeFromCycle).toBe(true);
 });

 it("isBlockedStatus is true only for the blocked value", () => {
  const m = new StatusManager(withBlockedStatus(DEFAULT_STATUSES), "open");
  expect(m.isBlockedStatus(BLOCKED_STATUS_VALUE)).toBe(true);
  expect(m.isBlockedStatus("open")).toBe(false);
 });

 it("getReleaseStatus returns in-progress when present, else the default", () => {
  const withIp = new StatusManager(withBlockedStatus(DEFAULT_STATUSES), "open");
  expect(withIp.getReleaseStatus()).toBe("in-progress");
  const noIp = new StatusManager(
   withBlockedStatus([
    { id: "open", value: "open", label: "Open", color: "#888", isCompleted: false, order: 0 },
    { id: "done", value: "done", label: "Done", color: "#0a0", isCompleted: true, order: 1 },
   ]),
   "open"
  );
  expect(noIp.getReleaseStatus()).toBe("open");
 });

 it("excludes blocked from the click cycle", () => {
  const m = new StatusManager(withBlockedStatus(DEFAULT_STATUSES), "open");
  expect(m.getNextStatus("open")).not.toBe(BLOCKED_STATUS_VALUE);
  expect(m.getNextStatus(BLOCKED_STATUS_VALUE)).not.toBe(BLOCKED_STATUS_VALUE);
 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/statusManager.test.ts`
Expected: FAIL — exports/methods missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/status.ts — add near DEFAULT_STATUS_VALUE:
export const BLOCKED_STATUS_VALUE = "blocked";
export const IN_PROGRESS_STATUS_VALUE = "in-progress";

/** Reserved, plugin-managed status. Not user-editable; never the default; never
 *  in the click cycle. Set/cleared automatically by the dependency cascade. */
export const RESERVED_BLOCKED_STATUS: StatusConfig = {
 id: "blocked",
 value: BLOCKED_STATUS_VALUE,
 label: "Blocked",
 color: "#d9534f",
 icon: "ban",
 isCompleted: false,
 order: 10,
 excludeFromCycle: true,
};

/** Returns the active status set with the reserved blocked status guaranteed
 *  present (any user status colliding on its value is replaced). */
export function withBlockedStatus(statuses: StatusConfig[]): StatusConfig[] {
 return [...statuses.filter((s) => s.value !== BLOCKED_STATUS_VALUE), RESERVED_BLOCKED_STATUS];
}
```

```ts
// src/core/statusManager.ts — add the import and two methods:
import { BLOCKED_STATUS_VALUE, IN_PROGRESS_STATUS_VALUE } from "./status";

 isBlockedStatus(value: string): boolean {
  return value === BLOCKED_STATUS_VALUE;
 }

 /** Status a task returns to when released from blocked: in-progress if it exists,
  *  else the configured default. */
 getReleaseStatus(): string {
  return this.getStatusConfig(IN_PROGRESS_STATUS_VALUE)?.value ?? this.defaultStatus;
 }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/statusManager.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/status.ts src/core/statusManager.ts tests/core/statusManager.test.ts
git commit -m "feat(core): add reserved blocked status + release/lock helpers"
```

---

### Task 2: main.ts — inject the reserved status into the running plugin

**Files:**

- Modify: `src/main.ts` (`rebuildServices`, around line 88)

**Interfaces:**

- Consumes: `withBlockedStatus` (Task 1).

Obsidian-coupled — **no vitest**. Verified via build + the CLI (the pill must show
"Blocked").

- [ ] **Step 1: Wire it**

In `rebuildServices`, build the `StatusManager` from the augmented status set so the
reserved `blocked` status resolves everywhere the manager is used (service, view
models, pill). The user-editable `this.settings.statuses` stays untouched.

```ts
// src/main.ts — import:
import { withBlockedStatus } from "./core/status";

// in rebuildServices, replace:
//   this.statusManager = new StatusManager(this.settings.statuses, this.settings.defaultStatus);
// with:
 this.statusManager = new StatusManager(
  withBlockedStatus(this.settings.statuses),
  this.settings.defaultStatus
 );
```

- [ ] **Step 2: Build + smoke**

```bash
npm run check
npm run build:test
obsidian vault=daytask-vault plugin:reload id=daytasks
obsidian vault=daytask-vault dev:errors
```

Expected: `dev:errors` clean. (Full blocked-pill behavior is exercised in Task 9's
smoke once the cascade lands.)

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: inject the reserved blocked status into the status manager"
```

---

### Task 3: Service — set blocked, cascade release on completion / removal / delete

**Files:**

- Modify: `src/core/dayTaskService.ts`
- Test: `tests/core/dayTaskService.test.ts`

**Interfaces:**

- Consumes: `StatusManager.isCompletedStatus`, `isBlockedStatus`, `getReleaseStatus`
  (Task 1); `BLOCKED_STATUS_VALUE` (Task 1); `index.byBlocker` (existing).
- Produces: `addDependency` now rejects completed endpoints and sets the dependent
  `blocked`; a private `releaseDependentsOf(blockerId, timestamp)`; `setStatus`,
  `updateTask`, `removeDependency`, `deleteTask` all apply the release rule.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/core/dayTaskService.test.ts — add to the dependencies describe block.
// IMPORTANT: the test helper that builds the service (makeServiceWithIds or similar)
// must construct its StatusManager via withBlockedStatus(DEFAULT_STATUSES) with
// default "open", so "blocked"/getReleaseStatus resolve. Update that helper.
import { BLOCKED_STATUS_VALUE } from "../../src/core/status";

it("sets the dependent to blocked when a dependency is added", async () => {
 const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
 await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
 await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
 const a = await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
 expect(a.status).toBe(BLOCKED_STATUS_VALUE);
});

it("rejects adding a dependency to or from a completed task", async () => {
 const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
 await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
 await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
 await service.setStatus("TSK-bbbbbbbb", "done");
 await expect(service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb")).rejects.toThrow(/completed/);
});

it("releases the dependent to in-progress when its only blocker completes", async () => {
 const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
 await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
 await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
 await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb"); // A blocked by B
 await service.setStatus("TSK-bbbbbbbb", "done");            // complete B
 const a = await service.getTask("TSK-aaaaaaaa");
 expect(a?.blockedBy).toBeUndefined();
 expect(a?.status).toBe("in-progress");
});

it("keeps the dependent blocked until the last blocker completes", async () => {
 const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb", "TSK-cccccccc"]);
 await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
 await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
 await service.createTask({ title: "C", scheduledDate: "2026-06-25" });
 await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
 await service.addDependency("TSK-aaaaaaaa", "TSK-cccccccc");
 await service.setStatus("TSK-bbbbbbbb", "done"); // one of two blockers
 const mid = await service.getTask("TSK-aaaaaaaa");
 expect(mid?.blockedBy).toEqual(["TSK-cccccccc"]);
 expect(mid?.status).toBe(BLOCKED_STATUS_VALUE);
 await service.setStatus("TSK-cccccccc", "done"); // last blocker
 const done = await service.getTask("TSK-aaaaaaaa");
 expect(done?.blockedBy).toBeUndefined();
 expect(done?.status).toBe("in-progress");
});

it("releases on manual removal and on blocker deletion of the last blocker", async () => {
 const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
 await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
 await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
 await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
 const removed = await service.removeDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
 expect(removed.status).toBe("in-progress");
 expect(removed.blockedBy).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/dayTaskService.test.ts`
Expected: FAIL — status stays unchanged / no release.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/dayTaskService.ts — import the constant:
import { BLOCKED_STATUS_VALUE } from "./status";

// addDependency — after the cycle guard, before building `updated`:
 const { statusManager } = this.dependencies;
 if (statusManager.isCompletedStatus(task.status) || statusManager.isCompletedStatus(blocker.status)) {
  throw new Error("Cannot add a dependency to or from a completed task");
 }
 const updated: DayTask = {
  ...task,
  blockedBy: mergeUniqueStrings(task.blockedBy, [blockerId]),
  status: BLOCKED_STATUS_VALUE,
  updatedAt: this.now(),
 };
 await this.saveAndIndex(updated);
 return updated;
```

```ts
// setStatus — after `await this.saveAndIndex(updated);` and before `return updated;`:
 if (
  statusManager.isCompletedStatus(normalized) &&
  !statusManager.isCompletedStatus(task.status)
 ) {
  await this.releaseDependentsOf(id, timestamp);
 }

// updateTask — same release after its `await this.saveAndIndex(updated);`:
 if (
  this.dependencies.statusManager.isCompletedStatus(status) &&
  !this.dependencies.statusManager.isCompletedStatus(task.status)
 ) {
  await this.releaseDependentsOf(id, timestamp);
 }
```

```ts
// New private method — for each dependent, drop this blocker; release on last:
 private async releaseDependentsOf(blockerId: string, timestamp: string): Promise<void> {
  const { statusManager } = this.dependencies;
  for (const dependent of this.dependencies.index.byBlocker(blockerId)) {
   const fresh = await this.dependencies.store.get(dependent.id);
   if (!fresh?.blockedBy) {
    continue;
   }
   const remaining = fresh.blockedBy.filter((b) => b !== blockerId);
   const { blockedBy: _drop, ...rest } = fresh;
   const next: DayTask =
    remaining.length > 0
     ? { ...rest, blockedBy: remaining, updatedAt: timestamp }
     : { ...rest, status: statusManager.getReleaseStatus(), updatedAt: timestamp };
   await this.saveAndIndex(next);
  }
 }
```

```ts
// removeDependency — replace its body's `updated` construction so the last-edge
// removal releases a blocked task:
 const { statusManager } = this.dependencies;
 const remaining = (task.blockedBy ?? []).filter((id) => id !== blockerId);
 const { blockedBy: _drop, ...rest } = task;
 const timestamp = this.now();
 let updated: DayTask;
 if (remaining.length > 0) {
  updated = { ...rest, blockedBy: remaining, updatedAt: timestamp };
 } else if (statusManager.isBlockedStatus(task.status)) {
  updated = { ...rest, status: statusManager.getReleaseStatus(), updatedAt: timestamp };
 } else {
  updated = { ...rest, updatedAt: timestamp };
 }
 await this.saveAndIndex(updated);
 return updated;
```

```ts
// deleteTask — in the existing inbound-cleanup loop, add `statusManager` and the
// release branch (replace the `next` construction):
 const { statusManager } = this.dependencies;
 // ...inside the `for (const dependent of ...byBlocker(id))` loop:
   const remaining = fresh.blockedBy.filter((b) => b !== id);
   const { blockedBy: _drop, ...rest } = fresh;
   const next: DayTask =
    remaining.length > 0
     ? { ...rest, blockedBy: remaining, updatedAt: timestamp }
     : {
        ...rest,
        ...(statusManager.isBlockedStatus(fresh.status)
         ? { status: statusManager.getReleaseStatus() }
         : {}),
        updatedAt: timestamp,
       };
   await this.saveAndIndex(next);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/dayTaskService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/dayTaskService.ts tests/core/dayTaskService.test.ts
git commit -m "feat(core): block on dependency add, release on last blocker clear"
```

---

### Task 4: Candidates — exclude completed tasks from the picker

**Files:**

- Modify: `src/core/dependencies.ts`
- Modify: `src/main.ts` (`getDependencyCandidates`, ~line 389)
- Test: `tests/core/dependencies.test.ts`

**Interfaces:**

- Produces: `dependencyCandidates(taskId, all, blockersOf, isCompleted)` — gains a
  4th param `isCompleted: (status: string) => boolean`; excludes completed tasks.

- [ ] **Step 1: Write the failing test**

```ts
// tests/core/dependencies.test.ts — add (and UPDATE existing dependencyCandidates
// tests to pass a 4th arg `() => false`).
it("excludes completed tasks from candidates", () => {
 const all = [
  { id: "TSK-aaaaaaaa", status: "open", blockedBy: [] },
  { id: "TSK-bbbbbbbb", status: "open" },
  { id: "TSK-cccccccc", status: "done" },
 ] as unknown as DayTask[];
 const blockersOf = (id: string): string[] =>
  all.find((t) => t.id === id)?.blockedBy ?? [];
 const isCompleted = (status: string): boolean => status === "done";
 const ids = dependencyCandidates("TSK-aaaaaaaa", all, blockersOf, isCompleted).map((t) => t.id);
 expect(ids).toContain("TSK-bbbbbbbb");
 expect(ids).not.toContain("TSK-cccccccc"); // completed excluded
 expect(ids).not.toContain("TSK-aaaaaaaa"); // self excluded
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/dependencies.test.ts`
Expected: FAIL — 4th param / completed-exclusion missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/dependencies.ts — extend the signature + filter:
export function dependencyCandidates(
 taskId: string,
 all: DayTask[],
 blockersOf: (id: string) => string[],
 isCompleted: (status: string) => boolean
): DayTask[] {
 return all.filter(
  (t) =>
   t.id !== taskId &&
   !isCompleted(t.status) &&
   !wouldCreateCycle(taskId, t.id, blockersOf)
 );
}
```

```ts
// src/main.ts — update the call site (getDependencyCandidates):
 private getDependencyCandidates(taskId: string): DayTask[] {
  const blockersOf = (id: string): string[] => this.index.byId(id)?.blockedBy ?? [];
  return dependencyCandidates(
   taskId,
   this.service.allTasks(),
   blockersOf,
   (status) => this.statusManager.isCompletedStatus(status)
  );
 }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/dependencies.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/dependencies.ts src/main.ts tests/core/dependencies.test.ts
git commit -m "feat: exclude completed tasks from dependency candidates"
```

---

### Task 5: main.ts — status lock on blocked tasks

**Files:**

- Modify: `src/main.ts` (`handleCycleStatus`, ~line 230)

**Interfaces:**

- Consumes: `StatusManager.isBlockedStatus` (Task 1).

Obsidian-coupled — **no vitest**. Verified via build + the CLI.

- [ ] **Step 1: Guard the status handler(s)**

`handleCycleStatus` is the only status-mutation handler in the render handlers
(completion happens by cycling to a completed status). Look the task up first
(mirror `handleCyclePriority`’s `this.service.getTask` pattern) and no-op with a
`Notice` when the task is blocked. If a separate completion-toggle handler exists,
guard it the same way.

```ts
// src/main.ts — handleCycleStatus:
 private async handleCycleStatus(taskId: string): Promise<void> {
  const task = await this.service.getTask(taskId);
  if (!task) {
   return;
  }
  if (this.statusManager.isBlockedStatus(task.status)) {
   new Notice("DayTasks: this task is blocked by another task.");
   return;
  }
  try {
   await this.service.cycleStatus(taskId);
   await this.persistTasks();
   this.refreshViews();
  } catch (error) {
   console.error("DayTasks: failed to update task status", error);
   new Notice("DayTasks: could not update that task.");
  }
 }
```

- [ ] **Step 2: Build + smoke**

```bash
npm run check
npm run build:test
obsidian vault=daytask-vault plugin:reload id=daytasks
obsidian vault=daytask-vault dev:errors
```

Expected: `dev:errors` clean.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: lock status changes on blocked tasks"
```

---

### Task 6: Decoder — reconcile stored status against the edge set on load

**Files:**

- Modify: `src/core/dependencies.ts`
- Modify: `src/obsidian/pluginDataAdapter.ts`
- Test: `tests/core/dependencies.test.ts`

**Interfaces:**

- Produces: `reconcileBlockedStatuses(tasks, isCompleted, releaseStatus): void` —
  after edge validation, forces `blocked` on tasks that have blockers (and aren’t
  completed) and releases tasks that are `blocked` with no blockers.

The decoder may prune edges, so stored status can drift; this keeps it consistent.

- [ ] **Step 1: Write the failing test**

```ts
// tests/core/dependencies.test.ts — add:
import { reconcileBlockedStatuses } from "../../src/core/dependencies";
import { BLOCKED_STATUS_VALUE } from "../../src/core/status";

it("reconciles blocked status against the edge set", () => {
 const tasks = [
  { id: "TSK-aaaaaaaa", status: "open", blockedBy: ["TSK-bbbbbbbb"] },     // has blocker, not blocked → blocked
  { id: "TSK-bbbbbbbb", status: BLOCKED_STATUS_VALUE },                    // no blockers, stale blocked → released
  { id: "TSK-cccccccc", status: "done", blockedBy: ["TSK-bbbbbbbb"] },     // completed → left alone
 ] as unknown as DayTask[];
 reconcileBlockedStatuses(tasks, (s) => s === "done", "in-progress");
 expect(tasks[0].status).toBe(BLOCKED_STATUS_VALUE);
 expect(tasks[1].status).toBe("in-progress");
 expect(tasks[2].status).toBe("done");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/dependencies.test.ts`
Expected: FAIL — function missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/dependencies.ts — add (import BLOCKED_STATUS_VALUE from "./status"):
export function reconcileBlockedStatuses(
 tasks: DayTask[],
 isCompleted: (status: string) => boolean,
 releaseStatus: string
): void {
 for (const task of tasks) {
  const hasBlockers = (task.blockedBy?.length ?? 0) > 0;
  if (hasBlockers && !isCompleted(task.status) && task.status !== BLOCKED_STATUS_VALUE) {
   task.status = BLOCKED_STATUS_VALUE;
  } else if (!hasBlockers && task.status === BLOCKED_STATUS_VALUE) {
   task.status = releaseStatus;
  }
 }
}
```

```ts
// src/obsidian/pluginDataAdapter.ts — call it from decodePluginData AFTER
// validateDependencies(tasks). Build isCompleted + releaseStatus from the decoded
// statuses (decodePluginData already produces the merged settings/statuses; use
// them). If the decoder does not have the status set in scope, derive it via
// withBlockedStatus(decodedStatuses) + a StatusManager, or import DEFAULT_STATUSES
// as the floor. Concretely:
import { reconcileBlockedStatuses } from "../core/dependencies";
// after validateDependencies(tasks):
 const completedValues = new Set(
  decodedStatuses.filter((s) => s.isCompleted).map((s) => s.value)
 );
 const releaseStatus = decodedStatuses.some((s) => s.value === "in-progress")
  ? "in-progress"
  : decodedDefaultStatus;
 reconcileBlockedStatuses(tasks, (status) => completedValues.has(status), releaseStatus);
```

If `decodePluginData` lacks the status set entirely, instead expose
`reconcileBlockedStatuses` and call it once at startup in `main.ts` right after the
index is first built (using `this.statusManager`); note which you chose in the
report.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/dependencies.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/dependencies.ts src/obsidian/pluginDataAdapter.ts tests/core/dependencies.test.ts
git commit -m "fix(decoder): reconcile blocked status with the edge set on load"
```

---

### Task 7: Editor — grey dependency sections for completed tasks

**Files:**

- Modify: `src/obsidian/taskCreationModal.ts` (`buildDependencySection`, ~line 482)

**Interfaces:**

- Consumes: the edited task’s status (`this.options.initial?.status`) and the
  configured statuses (`this.options.settings.statuses`).

Obsidian-coupled — **no vitest**. Verified via build + the CLI.

- [ ] **Step 1: Add the completed-task branch**

In `buildDependencySection`, after the existing create-mode "Save the task first to
add" guard, add a branch: when editing a **completed** task, show a disabled/greyed
hint and return (both sections). Determine completion from the settings status
config of `initial.status`:

```ts
// inside buildDependencySection, after the existing save-first guard:
 const statusConfig = this.options.settings.statuses.find((s) => s.value === initial.status);
 if (statusConfig?.isCompleted) {
  header.createSpan({
   cls: "daytasks-placeholder-hint",
   text: "Completed tasks can't have dependencies",
  });
  return;
 }
```

(If `this.options.settings` is not already available in the modal, thread the
statuses or an `isCompleted` predicate through `TaskCreationModalOptions` and pass
it from `main.ts` — match the existing options pattern.)

- [ ] **Step 2: Build + smoke**

```bash
npm run check
npm run build:test
obsidian vault=daytask-vault plugin:reload id=daytasks
obsidian vault=daytask-vault dev:errors
```

Expected: `dev:errors` clean; a done task’s editor shows the greyed hint, not the
Add-task control.

- [ ] **Step 3: Commit**

```bash
git add src/obsidian/taskCreationModal.ts
git commit -m "feat(modal): disable dependency editing for completed tasks"
```

---

### Task 8: Renderer + CSS — chip shows the id only, no strikethrough

**Files:**

- Modify: `src/obsidian/widgetRenderer.ts` (`renderRelationBox`, ~line 281)
- Modify: `styles/task-card.css`
- Test: `tests/obsidian/widgetRenderer.test.ts`

**Interfaces:**

- Produces: relation chip label is the task id only; chips never render
  struck-through.

- [ ] **Step 1: Update the failing test**

```ts
// tests/obsidian/widgetRenderer.test.ts — update the existing blocked-by chip test
// so it asserts the chip text is the id (not the title):
 expect(chip?.textContent?.trim()).toBe("TSK-blocker01");
// (remove any assertion that the chip text contains the ref title, and any is-done
// strikethrough assertion if present.)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/obsidian/widgetRenderer.test.ts`
Expected: FAIL — chip currently renders `${ref.id} · ${ref.title}`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/obsidian/widgetRenderer.ts — chip label (line ~281):
 const chip = el("button", "task-card__rel-chip", ref.id);
// and remove the is-done class application on the chip (refs are never completed
// now). Delete the `if (ref.completed) chip.classList.add("is-done");` line.
```

```css
/* styles/task-card.css — delete the now-unreachable done-chip strikethrough rule
   (task-card.css:448-451):
   .daytasks-plugin .task-card__rel-chip.is-done { text-decoration: line-through; color: var(--text-muted); }
   Chips must never inherit a completed-card line-through. */
```

- [ ] **Step 4: Run test + gate**

Run: `npx vitest run tests/obsidian/widgetRenderer.test.ts`
Expected: PASS. Then `npm run check`.

- [ ] **Step 5: Commit**

```bash
git add src/obsidian/widgetRenderer.ts styles/task-card.css tests/obsidian/widgetRenderer.test.ts
git commit -m "style: relation chips show the task id only, never struck through"
```

---

### Task 9: Release note + Obsidian smoke

**Files:**

- Modify: `docs/releases/unreleased.md`

- [ ] **Step 1: Add the note**

Add under the existing `## Added` / a new `## Changed` as fits:

```markdown
## Changed

- Task dependencies now drive a real **Blocked** status: a task gains an
  incomplete blocker becomes blocked and its status is locked until released.
  Completing (or removing) a blocker drops that link; clearing the last blocker
  returns the task to in-progress automatically. Completed tasks can't be picked
  as blockers and can't be given dependencies. Relation chips show the task id.
```

- [ ] **Step 2: Lint + gate**

```bash
npm run lint:md
npm run check
```

- [ ] **Step 3: Manual Obsidian smoke**

```bash
npm run build:test
obsidian vault=daytask-vault plugin:reload id=daytasks
obsidian vault=daytask-vault dev:errors
```

1. Create tasks A and B on `2026-06-25`.
2. Edit A → Blocked by → Add task → pick B. A’s status pill shows **Blocked**;
   B’s card shows a Blocking box with an A chip (chip is `TSK-…` id only).
3. Click A’s status pill / try to cycle it → a notice appears, status unchanged.
4. The picker for B excludes any completed task.
5. Complete B → its edge to A disappears, A is released to **in-progress**, A’s
   pill is interactive again.
6. Re-add a blocker, then open the editor on a completed task → dependency sections
   are greyed ("Completed tasks can't have dependencies").
7. `dev:errors` clean.

- [ ] **Step 4: Commit**

```bash
git add docs/releases/unreleased.md
git commit -m "docs: note the blocked status + dependency locking"
```

---

## Self-Review

**Spec coverage:** reserved blocked status (T1) + injected into the manager (T2);
set-blocked + cascade release on completion/removal/delete (T3); done-task picker
exclusion (T4); status lock with notice (T5); load-time status/edge reconciliation
(T6); done-task editor greying (T7); chip id-only + no strikethrough (T8); release
note + smoke (T9). ✓

**Release target:** `getReleaseStatus()` (T1) prefers in-progress, falls back to
default — used by every release path in T3. ✓

**Done-task inertness:** picker exclusion (T4) + editor greying (T7) + add-guard in
the service (T3 rejects completed endpoints). ✓

**Lock:** enforced in the UI (T5) so the service stays free to perform system
transitions (the cascade releases blocked tasks). ✓

**Fixture churn flagged:** T3 updates the service test helper’s StatusManager to use
`withBlockedStatus`; T4 updates existing `dependencyCandidates` tests to pass the
4th arg; T8 updates the chip assertion. ✓

**Open wiring detail (T6):** reconciliation is wired in the decoder if it has the
status set, else at startup in main.ts — flagged in-task, not hidden. ✓

**Out of scope confirmed:** no graph view, no hide/sort of blocked tasks, no
subtask-parent cycle work. ✓
