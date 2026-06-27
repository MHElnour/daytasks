# Task List View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a filterable, grouped, sortable Task List view (an Obsidian `ItemView` opened from a ribbon icon + command) that shows all DayTasks tasks across days, reusing the existing task-card renderer.

**Architecture:** Pure logic (`filter`/`sort`/`group`) and a pure view-model + pure DOM renderer are unit-tested and Obsidian-free; a thin `ItemView` host owns ephemeral UI state and wires the existing card handlers; `main.ts` registers the view and persists filter state in settings.

**Tech Stack:** TypeScript, Obsidian plugin API (`ItemView`, `registerView`, `addRibbonIcon`, `addCommand`), vitest, esbuild, custom CSS build (`build-css.mjs`).

## Global Constraints

- Pure modules (`src/core/*`, `src/ui/*`, `src/obsidian/taskListRenderer.ts`) MUST NOT import from `obsidian`. Obsidian-only code lives in `src/obsidian/taskListLeaf.ts` and `src/main.ts`.
- CSS uses Obsidian theme variables / existing repo tokens only — no hardcoded hex/rgb/hsl.
- TDD: failing test first, watch it fail, minimal implementation, watch it pass, commit.
- `npm run check` (typecheck + tests) green before each commit that touches `src/`.
- Reuse, don't duplicate: the list reuses `createTaskCardViewModel` and `renderTaskCard`; do not write a second card renderer.
- The list is flat (no parent/child nesting): every card is built with `children: []`.
- Commit footer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Branch: `feat/task-list-view` (already created).
- View type id: `daytasks-task-list`. Icon: `list-checks`.

---

### Task 1: Filter state type + `filterTasks`

**Files:**
- Create: `src/core/taskListState.ts`, `src/core/taskFilter.ts`
- Test: `tests/core/taskFilter.test.ts`

**Interfaces:**
- Produces:
  - `TaskListState` (interface) + `DEFAULT_TASK_LIST_STATE` (const) in `taskListState.ts`.
  - `filterTasks(tasks: DayTask[], state: TaskListState, referenceDate: string, isCompleted: (status: string) => boolean): DayTask[]` in `taskFilter.ts`.

- [ ] **Step 1: Create the state type**

`src/core/taskListState.ts`:

```ts
export interface TaskListState {
	statuses: string[];
	datePreset: "all" | "today" | "overdue" | "next7";
	tags: string[];
	contexts: string[];
	projects: string[];
	search: string;
	groupBy: "status" | "scheduled" | "project";
	sortBy: "scheduled" | "due" | "priority" | "created" | "title";
	sortDir: "asc" | "desc";
}

export const DEFAULT_TASK_LIST_STATE: TaskListState = {
	statuses: [],
	datePreset: "all",
	tags: [],
	contexts: [],
	projects: [],
	search: "",
	groupBy: "status",
	sortBy: "scheduled",
	sortDir: "asc",
};
```

- [ ] **Step 2: Write the failing tests**

`tests/core/taskFilter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filterTasks } from "../../src/core/taskFilter";
import { DEFAULT_TASK_LIST_STATE, type TaskListState } from "../../src/core/taskListState";
import type { DayTask } from "../../src/core/task";

function task(over: Partial<DayTask> & { id: string }): DayTask {
	return {
		title: over.id,
		status: "open",
		scheduledDate: "2026-06-27",
		tags: [],
		contexts: [],
		projects: [],
		timeEntries: [],
		createdAt: "2026-06-27T00:00:00.000Z",
		updatedAt: "2026-06-27T00:00:00.000Z",
		...over,
	};
}

const isCompleted = (s: string) => s === "done";
const state = (over: Partial<TaskListState>): TaskListState => ({ ...DEFAULT_TASK_LIST_STATE, ...over });

describe("filterTasks", () => {
	const ref = "2026-06-27";

	it("keeps everything when filters are empty", () => {
		const tasks = [task({ id: "a" }), task({ id: "b", status: "done" })];
		expect(filterTasks(tasks, state({}), ref, isCompleted).map((t) => t.id)).toEqual(["a", "b"]);
	});

	it("filters by status", () => {
		const tasks = [task({ id: "a" }), task({ id: "b", status: "done" })];
		expect(filterTasks(tasks, state({ statuses: ["done"] }), ref, isCompleted).map((t) => t.id)).toEqual(["b"]);
	});

	it("datePreset today matches scheduledDate == reference", () => {
		const tasks = [task({ id: "a", scheduledDate: "2026-06-27" }), task({ id: "b", scheduledDate: "2026-06-28" })];
		expect(filterTasks(tasks, state({ datePreset: "today" }), ref, isCompleted).map((t) => t.id)).toEqual(["a"]);
	});

	it("datePreset overdue uses dueDate and completion", () => {
		const tasks = [
			task({ id: "a", dueDate: "2026-06-25" }),
			task({ id: "b", dueDate: "2026-06-25", status: "done" }),
			task({ id: "c", dueDate: "2026-06-30" }),
		];
		expect(filterTasks(tasks, state({ datePreset: "overdue" }), ref, isCompleted).map((t) => t.id)).toEqual(["a"]);
	});

	it("datePreset next7 includes reference..+6", () => {
		const tasks = [
			task({ id: "a", scheduledDate: "2026-06-27" }),
			task({ id: "b", scheduledDate: "2026-07-03" }),
			task({ id: "c", scheduledDate: "2026-07-04" }),
		];
		expect(filterTasks(tasks, state({ datePreset: "next7" }), ref, isCompleted).map((t) => t.id)).toEqual(["a", "b"]);
	});

	it("filters by tag/context/project (intersection, empty = all)", () => {
		const tasks = [
			task({ id: "a", tags: ["x"] }),
			task({ id: "b", contexts: ["home"] }),
			task({ id: "c", projects: [{ path: "P.md" }] }),
		];
		expect(filterTasks(tasks, state({ tags: ["x"] }), ref, isCompleted).map((t) => t.id)).toEqual(["a"]);
		expect(filterTasks(tasks, state({ contexts: ["home"] }), ref, isCompleted).map((t) => t.id)).toEqual(["b"]);
		expect(filterTasks(tasks, state({ projects: ["P.md"] }), ref, isCompleted).map((t) => t.id)).toEqual(["c"]);
	});

	it("search matches title or description, case-insensitive", () => {
		const tasks = [task({ id: "a", title: "Buy Milk" }), task({ id: "b", description: "call BOB" }), task({ id: "c" })];
		expect(filterTasks(tasks, state({ search: "milk" }), ref, isCompleted).map((t) => t.id)).toEqual(["a"]);
		expect(filterTasks(tasks, state({ search: "bob" }), ref, isCompleted).map((t) => t.id)).toEqual(["b"]);
	});
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/core/taskFilter.test.ts`
Expected: FAIL — `filterTasks` not found.

- [ ] **Step 4: Implement `filterTasks`**

`src/core/taskFilter.ts`:

```ts
import type { DayTask } from "./task";
import type { TaskListState } from "./taskListState";
import { parseCalendarDate } from "../util/calendarDate";
import { isOverdue } from "../util/relativeDate";

/** UTC day-number for a YYYY-MM-DD string, or null if unparseable. */
function dayNumber(date: string): number | null {
	const parsed = parseCalendarDate(date);
	if (!parsed) return null;
	return Math.floor(Date.UTC(parsed.year, parsed.month - 1, parsed.day) / 86400000);
}

function intersects(filter: string[], values: string[]): boolean {
	return filter.length === 0 || values.some((v) => filter.includes(v));
}

function matchesDate(task: DayTask, state: TaskListState, referenceDate: string, completed: boolean): boolean {
	switch (state.datePreset) {
		case "all":
			return true;
		case "today":
			return task.scheduledDate === referenceDate;
		case "overdue":
			return isOverdue(task.dueDate, referenceDate, completed);
		case "next7": {
			const start = dayNumber(referenceDate);
			const day = dayNumber(task.scheduledDate);
			if (start === null || day === null) return false;
			return day >= start && day <= start + 6;
		}
	}
}

/** Applies every active filter (empty filter = no constraint) and returns the kept tasks in input order. */
export function filterTasks(
	tasks: DayTask[],
	state: TaskListState,
	referenceDate: string,
	isCompleted: (status: string) => boolean
): DayTask[] {
	const search = state.search.trim().toLowerCase();
	return tasks.filter((task) => {
		if (state.statuses.length > 0 && !state.statuses.includes(task.status)) return false;
		if (!matchesDate(task, state, referenceDate, isCompleted(task.status))) return false;
		if (!intersects(state.tags, task.tags)) return false;
		if (!intersects(state.contexts, task.contexts)) return false;
		if (!intersects(state.projects, task.projects.map((p) => p.path))) return false;
		if (search) {
			const haystack = `${task.title}\n${task.description ?? ""}`.toLowerCase();
			if (!haystack.includes(search)) return false;
		}
		return true;
	});
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/core/taskFilter.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/taskListState.ts src/core/taskFilter.ts tests/core/taskFilter.test.ts
git commit -m "feat(tasklist): filter state type + filterTasks

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `sortTasks` + `groupTasks`

**Files:**
- Modify: `src/core/taskFilter.ts`
- Test: `tests/core/taskFilter.test.ts`

**Interfaces:**
- Consumes: `TaskListState`, `PriorityConfig` (`src/core/status`), `StatusManager` (`src/core/statusManager`).
- Produces:
  - `sortTasks(tasks: DayTask[], sortBy: TaskListState["sortBy"], dir: TaskListState["sortDir"], priorities: PriorityConfig[]): DayTask[]`
  - `TaskGroup` = `{ key: string; label: string; tasks: DayTask[] }`
  - `groupTasks(tasks: DayTask[], groupBy: TaskListState["groupBy"], statusManager: StatusManager): TaskGroup[]`

- [ ] **Step 1: Write the failing tests**

Append to `tests/core/taskFilter.test.ts`:

```ts
import { sortTasks, groupTasks } from "../../src/core/taskFilter";
import { StatusManager } from "../../src/core/statusManager";
import { DEFAULT_STATUSES, DEFAULT_PRIORITIES } from "../../src/core/status";

const sm = new StatusManager(DEFAULT_STATUSES, "open");

describe("sortTasks", () => {
	it("sorts by scheduled date asc/desc, missing last", () => {
		const tasks = [
			task({ id: "b", scheduledDate: "2026-06-28" }),
			task({ id: "a", scheduledDate: "2026-06-27" }),
		];
		expect(sortTasks(tasks, "scheduled", "asc", DEFAULT_PRIORITIES).map((t) => t.id)).toEqual(["a", "b"]);
		expect(sortTasks(tasks, "scheduled", "desc", DEFAULT_PRIORITIES).map((t) => t.id)).toEqual(["b", "a"]);
	});

	it("sorts by title", () => {
		const tasks = [task({ id: "b", title: "Banana" }), task({ id: "a", title: "Apple" })];
		expect(sortTasks(tasks, "title", "asc", DEFAULT_PRIORITIES).map((t) => t.id)).toEqual(["a", "b"]);
	});
});

describe("groupTasks", () => {
	it("groups by status in configured order, present statuses only", () => {
		const tasks = [task({ id: "a", status: "open" }), task({ id: "b", status: "done" })];
		const groups = groupTasks(tasks, "status", sm);
		expect(groups.map((g) => g.key)).toEqual(["open", "done"]);
		expect(groups[0].tasks.map((t) => t.id)).toEqual(["a"]);
	});

	it("groups by project with a no-project bucket last", () => {
		const tasks = [
			task({ id: "a", projects: [{ path: "P.md", title: "Proj" }] }),
			task({ id: "b" }),
		];
		const groups = groupTasks(tasks, "project", sm);
		expect(groups.map((g) => g.key)).toEqual(["P.md", ""]);
		expect(groups[1].label).toBe("(No project)");
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/core/taskFilter.test.ts -t "sortTasks|groupTasks"`
Expected: FAIL — `sortTasks`/`groupTasks` not found.

- [ ] **Step 3: Implement**

Append to `src/core/taskFilter.ts` (add imports at top):

```ts
import type { PriorityConfig } from "./status";
import type { StatusManager } from "./statusManager";
import { formatMonthDay } from "../util/relativeDate";
import { noteBasename } from "../util/notePath";

export interface TaskGroup {
	key: string;
	label: string;
	tasks: DayTask[];
}

/** Comparable key for a sort field; `undefined` always sorts last regardless of direction. */
function sortKey(task: DayTask, sortBy: TaskListState["sortBy"], rank: Map<string, number>): string | number | undefined {
	switch (sortBy) {
		case "scheduled":
			return task.scheduledDate;
		case "due":
			return task.dueDate;
		case "created":
			return task.createdAt;
		case "title":
			return task.title.toLowerCase();
		case "priority":
			return task.priority === undefined ? undefined : (rank.get(task.priority) ?? undefined);
	}
}

export function sortTasks(
	tasks: DayTask[],
	sortBy: TaskListState["sortBy"],
	dir: TaskListState["sortDir"],
	priorities: PriorityConfig[]
): DayTask[] {
	const rank = new Map(priorities.map((p, i) => [p.value, i]));
	const sign = dir === "desc" ? -1 : 1;
	return [...tasks].sort((a, b) => {
		const ka = sortKey(a, sortBy, rank);
		const kb = sortKey(b, sortBy, rank);
		if (ka === undefined && kb === undefined) return 0;
		if (ka === undefined) return 1; // missing last
		if (kb === undefined) return -1;
		if (ka < kb) return -1 * sign;
		if (ka > kb) return 1 * sign;
		return 0;
	});
}

export function groupTasks(
	tasks: DayTask[],
	groupBy: TaskListState["groupBy"],
	statusManager: StatusManager
): TaskGroup[] {
	const groups = new Map<string, TaskGroup>();
	const ensure = (key: string, label: string): TaskGroup => {
		let g = groups.get(key);
		if (!g) {
			g = { key, label, tasks: [] };
			groups.set(key, g);
		}
		return g;
	};

	if (groupBy === "status") {
		// Seed in configured order so present groups come out ordered; prune empties after.
		for (const status of statusManager.getStatusesByOrder()) {
			ensure(status.value, status.label);
		}
		for (const task of tasks) {
			const cfg = statusManager.getStatusConfig(task.status);
			ensure(task.status, cfg?.label ?? task.status).tasks.push(task);
		}
		return [...groups.values()].filter((g) => g.tasks.length > 0);
	}

	if (groupBy === "scheduled") {
		for (const task of tasks) {
			ensure(task.scheduledDate, formatMonthDay(task.scheduledDate)).tasks.push(task);
		}
		return [...groups.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
	}

	// project: first project path (or no-project bucket, keyed "" and ordered last)
	for (const task of tasks) {
		const first = task.projects[0];
		if (first) {
			ensure(first.path, first.title ?? noteBasename(first.path)).tasks.push(task);
		} else {
			ensure("", "(No project)").tasks.push(task);
		}
	}
	return [...groups.values()].sort((a, b) => {
		if (a.key === "") return 1;
		if (b.key === "") return -1;
		return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
	});
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/core/taskFilter.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/core/taskFilter.ts tests/core/taskFilter.test.ts
git commit -m "feat(tasklist): sortTasks + groupTasks

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Persist `taskListState` in settings

**Files:**
- Modify: `src/settings/settings.ts`
- Test: `tests/settings/settings.test.ts` (confirm name with `ls tests/settings`)

**Interfaces:**
- Consumes: `TaskListState`, `DEFAULT_TASK_LIST_STATE` (`src/core/taskListState`).
- Produces: `DayTasksSettings.taskListState: TaskListState`, defaulted and merged.

- [ ] **Step 1: Write the failing test**

Add to the settings test file:

```ts
import { DEFAULT_TASK_LIST_STATE } from "../../src/core/taskListState";

it("defaults taskListState and accepts a stored one", () => {
	expect(mergeSettings(undefined).taskListState).toEqual(DEFAULT_TASK_LIST_STATE);
	const stored = { taskListState: { ...DEFAULT_TASK_LIST_STATE, groupBy: "project", search: "x" } };
	expect(mergeSettings(stored).taskListState.groupBy).toBe("project");
	expect(mergeSettings(stored).taskListState.search).toBe("x");
});

it("falls back to default taskListState when stored value is malformed", () => {
	expect(mergeSettings({ taskListState: 42 }).taskListState).toEqual(DEFAULT_TASK_LIST_STATE);
});
```

(Match how the file imports `mergeSettings`.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/settings/settings.test.ts -t taskListState`
Expected: FAIL — `taskListState` undefined.

- [ ] **Step 3: Implement**

In `src/settings/settings.ts`:
- Import: `import { DEFAULT_TASK_LIST_STATE, type TaskListState } from "../core/taskListState";`
- Add to `DayTasksSettings`: `taskListState: TaskListState;`
- Add to `DEFAULT_SETTINGS`: `taskListState: { ...DEFAULT_TASK_LIST_STATE },`
- Add a coercion helper (validates each field against the allowed unions; any mismatch → default):

```ts
function asTaskListState(value: unknown): TaskListState {
	if (!isRecord(value)) {
		return { ...DEFAULT_TASK_LIST_STATE };
	}
	const v = value as Record<string, unknown>;
	const strArr = (x: unknown): string[] =>
		Array.isArray(x) ? x.filter((e): e is string => typeof e === "string") : [];
	const oneOf = <T extends string>(x: unknown, allowed: readonly T[], fallback: T): T =>
		typeof x === "string" && (allowed as readonly string[]).includes(x) ? (x as T) : fallback;
	return {
		statuses: strArr(v.statuses),
		datePreset: oneOf(v.datePreset, ["all", "today", "overdue", "next7"] as const, "all"),
		tags: strArr(v.tags),
		contexts: strArr(v.contexts),
		projects: strArr(v.projects),
		search: typeof v.search === "string" ? v.search : "",
		groupBy: oneOf(v.groupBy, ["status", "scheduled", "project"] as const, "status"),
		sortBy: oneOf(v.sortBy, ["scheduled", "due", "priority", "created", "title"] as const, "scheduled"),
		sortDir: oneOf(v.sortDir, ["asc", "desc"] as const, "asc"),
	};
}
```

- In `mergeSettings`, add to BOTH the no-store early-return object and the main return object: `taskListState: asTaskListState((stored as Record<string, unknown> | undefined)?.taskListState),`. In the early-return branch (`stored` not an object), use `taskListState: { ...DEFAULT_TASK_LIST_STATE },`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/settings/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/settings/settings.ts tests/settings/settings.test.ts
git commit -m "feat(tasklist): persist taskListState in settings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: View model — `createTaskListModel`

**Files:**
- Create: `src/ui/taskListModel.ts`
- Test: `tests/ui/taskListModel.test.ts`

**Interfaces:**
- Consumes: `filterTasks`/`sortTasks`/`groupTasks` (Task 1-2), `createTaskCardViewModel` + `TaskCardViewModel` (`src/ui/taskCard`), `StatusManager`, `PriorityConfig[]`, `TaskListState`.
- Produces:
  - `TaskListGroup` = `{ key: string; label: string; count: number; cards: TaskCardViewModel[]; collapsed: boolean }`
  - `TaskListModel` = `{ groups: TaskListGroup[]; total: number; empty: boolean; state: TaskListState }`
  - `createTaskListModel(tasks, statusManager, referenceDate, priorities, state, expandedCardIds, collapsedGroupKeys): TaskListModel`

- [ ] **Step 1: Write the failing test**

`tests/ui/taskListModel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTaskListModel } from "../../src/ui/taskListModel";
import { DEFAULT_TASK_LIST_STATE } from "../../src/core/taskListState";
import { StatusManager } from "../../src/core/statusManager";
import { DEFAULT_STATUSES, DEFAULT_PRIORITIES } from "../../src/core/status";
import type { DayTask } from "../../src/core/task";

const sm = new StatusManager(DEFAULT_STATUSES, "open");
function task(over: Partial<DayTask> & { id: string }): DayTask {
	return {
		title: over.id, status: "open", scheduledDate: "2026-06-27", tags: [], contexts: [], projects: [],
		timeEntries: [], createdAt: "2026-06-27T00:00:00.000Z", updatedAt: "2026-06-27T00:00:00.000Z", ...over,
	};
}

describe("createTaskListModel", () => {
	it("builds grouped flat cards, collapsed by default, with counts", () => {
		const tasks = [task({ id: "TSK-a" }), task({ id: "TSK-b", status: "done" })];
		const model = createTaskListModel(tasks, sm, "2026-06-27", DEFAULT_PRIORITIES, DEFAULT_TASK_LIST_STATE, new Set(), new Set());
		expect(model.total).toBe(2);
		expect(model.empty).toBe(false);
		expect(model.groups.map((g) => g.key)).toEqual(["open", "done"]);
		expect(model.groups[0].count).toBe(1);
		const card = model.groups[0].cards[0];
		expect(card.children).toEqual([]); // flat
		expect(card.collapsed).toBe(true); // collapsed by default
	});

	it("expands a card whose id is in expandedCardIds, collapses a group in collapsedGroupKeys", () => {
		const tasks = [task({ id: "TSK-a" })];
		const model = createTaskListModel(tasks, sm, "2026-06-27", DEFAULT_PRIORITIES, DEFAULT_TASK_LIST_STATE, new Set(["TSK-a"]), new Set(["open"]));
		expect(model.groups[0].cards[0].collapsed).toBe(false);
		expect(model.groups[0].collapsed).toBe(true);
	});

	it("empty is true when nothing matches", () => {
		const model = createTaskListModel([task({ id: "a" })], sm, "2026-06-27", DEFAULT_PRIORITIES,
			{ ...DEFAULT_TASK_LIST_STATE, search: "zzz" }, new Set(), new Set());
		expect(model.empty).toBe(true);
		expect(model.groups).toEqual([]);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/ui/taskListModel.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/ui/taskListModel.ts`:

```ts
import type { StatusManager } from "../core/statusManager";
import type { PriorityConfig } from "../core/status";
import type { DayTask } from "../core/task";
import { filterTasks, sortTasks, groupTasks } from "../core/taskFilter";
import type { TaskListState } from "../core/taskListState";
import { createTaskCardViewModel, type TaskCardViewModel } from "./taskCard";

export interface TaskListGroup {
	key: string;
	label: string;
	count: number;
	cards: TaskCardViewModel[];
	collapsed: boolean;
}

export interface TaskListModel {
	groups: TaskListGroup[];
	total: number;
	empty: boolean;
	state: TaskListState;
}

export function createTaskListModel(
	tasks: DayTask[],
	statusManager: StatusManager,
	referenceDate: string,
	priorities: PriorityConfig[],
	state: TaskListState,
	expandedCardIds: ReadonlySet<string>,
	collapsedGroupKeys: ReadonlySet<string>
): TaskListModel {
	const isCompleted = (status: string): boolean => statusManager.isCompletedStatus(status);
	const filtered = filterTasks(tasks, state, referenceDate, isCompleted);
	const sorted = sortTasks(filtered, state.sortBy, state.sortDir, priorities);
	const rawGroups = groupTasks(sorted, state.groupBy, statusManager);

	const groups: TaskListGroup[] = rawGroups.map((group) => ({
		key: group.key,
		label: group.label,
		count: group.tasks.length,
		collapsed: collapsedGroupKeys.has(group.key),
		cards: group.tasks.map((task) =>
			createTaskCardViewModel(task, statusManager, referenceDate, priorities, {
				children: [],
				collapsed: !expandedCardIds.has(task.id),
			})
		),
	}));

	return { groups, total: filtered.length, empty: filtered.length === 0, state };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/ui/taskListModel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/taskListModel.ts tests/ui/taskListModel.test.ts
git commit -m "feat(tasklist): createTaskListModel (grouped flat cards)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Renderer — `renderTaskListView` (reuses the card renderer)

**Files:**
- Modify: `src/obsidian/widgetRenderer.ts` (export `renderTaskCard`)
- Create: `src/obsidian/taskListRenderer.ts`
- Test: `tests/obsidian/taskListRenderer.test.ts`

**Interfaces:**
- Consumes: `TaskListModel`/`TaskListGroup` (Task 4), `renderTaskCard`, `WidgetRenderOptions`, `WidgetRenderHandlers` (`src/obsidian/widgetRenderer`).
- Produces:
  - `TaskListHandlers` = `{ onSetStatuses; onSetDatePreset; onSetTags; onSetContexts; onSetProjects; onSetSearch; onSetGroupBy; onSetSort; onClear; onToggleGroup }` (callback signatures below).
  - `TaskListFacets` = `{ statuses: {value,label}[]; tags: string[]; contexts: string[]; projects: {path,label}[] }` (the values the filter bar offers).
  - `renderTaskListView(parent: HTMLElement, model: TaskListModel, facets: TaskListFacets, options: WidgetRenderOptions, handlers: WidgetRenderHandlers, listHandlers: TaskListHandlers): HTMLElement`

- [ ] **Step 1: Export the card renderer**

In `src/obsidian/widgetRenderer.ts` change `function renderTaskCard(` (line ~386) to `export function renderTaskCard(`. Run `npx vitest run tests/obsidian/widgetRenderer.test.ts` to confirm the widget tests still pass (no behavior change).

- [ ] **Step 2: Write the failing test**

`tests/obsidian/taskListRenderer.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { renderTaskListView, type TaskListFacets, type TaskListHandlers } from "../../src/obsidian/taskListRenderer";
import type { TaskListModel } from "../../src/ui/taskListModel";
import { DEFAULT_TASK_LIST_STATE } from "../../src/core/taskListState";
import type { WidgetRenderOptions } from "../../src/obsidian/widgetRenderer";

const options: WidgetRenderOptions = { showTaskIds: true, showTags: true, showContexts: true, showProjects: true };
const facets: TaskListFacets = { statuses: [{ value: "open", label: "Open" }], tags: ["x"], contexts: [], projects: [] };

function card(id: string) {
	return {
		id, title: id, checked: false, status: "open", statusLabel: "Open", statusColor: "#888", statusIcon: "circle",
		scheduledLabel: "Jun 27", createdLabel: "Jun 27", overdue: false, tags: [], contexts: [], projects: [],
		children: [], expanded: false, collapsed: true, blockedBy: [], blocking: [], blocked: false,
	};
}

const noopHandlers: TaskListHandlers = {
	onSetStatuses: vi.fn(), onSetDatePreset: vi.fn(), onSetTags: vi.fn(), onSetContexts: vi.fn(),
	onSetProjects: vi.fn(), onSetSearch: vi.fn(), onSetGroupBy: vi.fn(), onSetSort: vi.fn(),
	onClear: vi.fn(), onToggleGroup: vi.fn(),
};

function render(model: TaskListModel, lh: Partial<TaskListHandlers> = {}) {
	const parent = document.createElement("div");
	renderTaskListView(parent, model, facets, options, { onCycleStatus: vi.fn() }, { ...noopHandlers, ...lh });
	return parent;
}

describe("renderTaskListView", () => {
	const model: TaskListModel = {
		groups: [{ key: "open", label: "Open", count: 1, collapsed: false, cards: [card("TSK-a") as any] }],
		total: 1, empty: false, state: DEFAULT_TASK_LIST_STATE,
	};

	it("renders a filter bar, a group header with count, and a card per task", () => {
		const root = render(model);
		expect(root.querySelector(".daytasks-tasklist__filterbar")).not.toBeNull();
		const head = root.querySelector(".daytasks-tasklist__group-head")!;
		expect(head.textContent).toContain("Open");
		expect(head.textContent).toContain("1");
		expect(root.querySelectorAll(".task-card").length).toBe(1);
	});

	it("group chevron calls onToggleGroup with the key", () => {
		const onToggleGroup = vi.fn();
		const root = render(model, { onToggleGroup });
		(root.querySelector(".daytasks-tasklist__group-toggle") as HTMLElement).click();
		expect(onToggleGroup).toHaveBeenCalledWith("open");
	});

	it("renders an empty state when model.empty", () => {
		const root = render({ ...model, groups: [], total: 0, empty: true });
		expect(root.querySelector(".daytasks-tasklist__empty")).not.toBeNull();
		expect(root.querySelectorAll(".task-card").length).toBe(0);
	});

	it("typing in search calls onSetSearch", () => {
		const onSetSearch = vi.fn();
		const root = render(model, { onSetSearch });
		const input = root.querySelector(".daytasks-tasklist__search") as HTMLInputElement;
		input.value = "milk";
		input.dispatchEvent(new Event("input"));
		expect(onSetSearch).toHaveBeenCalledWith("milk");
	});
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/obsidian/taskListRenderer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `taskListRenderer.ts`**

`src/obsidian/taskListRenderer.ts` (pure DOM, no `obsidian` import):

```ts
import { renderTaskCard, type WidgetRenderHandlers, type WidgetRenderOptions } from "./widgetRenderer";
import type { TaskListModel } from "../ui/taskListModel";
import type { TaskListState } from "../core/taskListState";

export interface TaskListFacets {
	statuses: { value: string; label: string }[];
	tags: string[];
	contexts: string[];
	projects: { path: string; label: string }[];
}

export interface TaskListHandlers {
	onSetStatuses(values: string[]): void;
	onSetDatePreset(preset: TaskListState["datePreset"]): void;
	onSetTags(values: string[]): void;
	onSetContexts(values: string[]): void;
	onSetProjects(values: string[]): void;
	onSetSearch(text: string): void;
	onSetGroupBy(groupBy: TaskListState["groupBy"]): void;
	onSetSort(sortBy: TaskListState["sortBy"], dir: TaskListState["sortDir"]): void;
	onClear(): void;
	onToggleGroup(key: string): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
	const node = activeDocument.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function select<T extends string>(
	className: string,
	current: T,
	choices: { value: T; label: string }[],
	onChange: (value: T) => void
): HTMLSelectElement {
	const sel = el("select", className);
	for (const choice of choices) {
		const opt = el("option", undefined, choice.label);
		opt.value = choice.value;
		if (choice.value === current) opt.selected = true;
		sel.appendChild(opt);
	}
	sel.addEventListener("change", () => onChange(sel.value as T));
	return sel;
}

/** Multiselect rendered as a row of toggle chips (kept simple + testable). */
function chipMultiselect(
	className: string,
	selected: string[],
	choices: { value: string; label: string }[],
	onChange: (values: string[]) => void
): HTMLElement {
	const wrap = el("div", className);
	for (const choice of choices) {
		const chip = el("button", "daytasks-tasklist__facet-chip", choice.label);
		const on = selected.includes(choice.value);
		if (on) chip.classList.add("is-active");
		chip.addEventListener("click", () => {
			const next = on ? selected.filter((v) => v !== choice.value) : [...selected, choice.value];
			onChange(next);
		});
		wrap.appendChild(chip);
	}
	return wrap;
}

function renderFilterBar(
	state: TaskListState,
	facets: TaskListFacets,
	lh: TaskListHandlers
): HTMLElement {
	const bar = el("div", "daytasks-tasklist__filterbar");

	const search = el("input", "daytasks-tasklist__search");
	search.type = "search";
	search.placeholder = "Search title / description…";
	search.value = state.search;
	search.addEventListener("input", () => lh.onSetSearch(search.value));
	bar.appendChild(search);

	bar.appendChild(chipMultiselect("daytasks-tasklist__statuses", state.statuses, facets.statuses, lh.onSetStatuses));

	bar.appendChild(select<TaskListState["datePreset"]>("daytasks-tasklist__date", state.datePreset, [
		{ value: "all", label: "All dates" }, { value: "today", label: "Today" },
		{ value: "overdue", label: "Overdue" }, { value: "next7", label: "Next 7 days" },
	], lh.onSetDatePreset));

	if (facets.tags.length) {
		bar.appendChild(chipMultiselect("daytasks-tasklist__tags", state.tags,
			facets.tags.map((t) => ({ value: t, label: `#${t}` })), lh.onSetTags));
	}
	if (facets.contexts.length) {
		bar.appendChild(chipMultiselect("daytasks-tasklist__contexts", state.contexts,
			facets.contexts.map((c) => ({ value: c, label: `@${c}` })), lh.onSetContexts));
	}
	if (facets.projects.length) {
		bar.appendChild(chipMultiselect("daytasks-tasklist__projects", state.projects,
			facets.projects.map((p) => ({ value: p.path, label: p.label })), lh.onSetProjects));
	}

	bar.appendChild(select<TaskListState["groupBy"]>("daytasks-tasklist__groupby", state.groupBy, [
		{ value: "status", label: "Group: Status" }, { value: "scheduled", label: "Group: Date" },
		{ value: "project", label: "Group: Project" },
	], lh.onSetGroupBy));

	bar.appendChild(select<TaskListState["sortBy"]>("daytasks-tasklist__sortby", state.sortBy, [
		{ value: "scheduled", label: "Sort: Scheduled" }, { value: "due", label: "Sort: Due" },
		{ value: "priority", label: "Sort: Priority" }, { value: "created", label: "Sort: Created" },
		{ value: "title", label: "Sort: Title" },
	], (value) => lh.onSetSort(value, state.sortDir)));

	const dir = el("button", "daytasks-tasklist__sortdir", state.sortDir === "asc" ? "↑" : "↓");
	dir.setAttribute("aria-label", "Toggle sort direction");
	dir.addEventListener("click", () => lh.onSetSort(state.sortBy, state.sortDir === "asc" ? "desc" : "asc"));
	bar.appendChild(dir);

	const clear = el("button", "daytasks-tasklist__clear", "Clear");
	clear.addEventListener("click", () => lh.onClear());
	bar.appendChild(clear);

	return bar;
}

export function renderTaskListView(
	parent: HTMLElement,
	model: TaskListModel,
	facets: TaskListFacets,
	options: WidgetRenderOptions,
	handlers: WidgetRenderHandlers,
	listHandlers: TaskListHandlers
): HTMLElement {
	const root = el("div");
	root.classList.add("daytasks-plugin", "daytasks-tasklist");
	root.appendChild(renderFilterBar(model.state, facets, listHandlers));

	if (model.empty) {
		root.appendChild(el("div", "daytasks-tasklist__empty", "No tasks match these filters."));
		parent.appendChild(root);
		return root;
	}

	for (const group of model.groups) {
		const section = el("div", "daytasks-tasklist__group");
		const head = el("div", "daytasks-tasklist__group-head");
		const toggle = el("button", "daytasks-tasklist__group-toggle");
		toggle.setAttribute("aria-expanded", String(!group.collapsed));
		const chevron = el("span", "daytasks-tasklist__group-icon");
		chevron.dataset.icon = group.collapsed ? "chevron-right" : "chevron-down";
		toggle.appendChild(chevron);
		toggle.addEventListener("click", () => listHandlers.onToggleGroup(group.key));
		head.appendChild(toggle);
		head.appendChild(el("span", "daytasks-tasklist__group-label", group.label));
		head.appendChild(el("span", "daytasks-tasklist__group-count", String(group.count)));
		section.appendChild(head);

		if (!group.collapsed) {
			const list = el("ul", "daytasks-tasklist__cards");
			for (const card of group.cards) {
				list.appendChild(renderTaskCard(card, options, handlers));
			}
			section.appendChild(list);
		}
		root.appendChild(section);
	}

	parent.appendChild(root);
	return root;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/obsidian/taskListRenderer.test.ts tests/obsidian/widgetRenderer.test.ts`
Expected: PASS (both files).

- [ ] **Step 6: Commit**

```bash
git add src/obsidian/widgetRenderer.ts src/obsidian/taskListRenderer.ts tests/obsidian/taskListRenderer.test.ts
git commit -m "feat(tasklist): filter-bar + grouped renderer reusing the card renderer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: The `TaskListView` ItemView host

**Files:**
- Create: `src/obsidian/taskListLeaf.ts`
- Test: manual (Obsidian host — keep logic thin)

**Interfaces:**
- Consumes: `renderTaskListView`, `TaskListFacets`, `TaskListHandlers` (Task 5); `createTaskListModel` (Task 4); `WidgetRenderOptions`, `WidgetRenderHandlers`.
- Produces:
  - `VIEW_TYPE_TASK_LIST = "daytasks-task-list"`.
  - `interface TaskListHost { allTasks(): DayTask[]; statusManager: StatusManager; priorities: PriorityConfig[]; today(): string; widgetOptions(): WidgetRenderOptions; cardHandlers(): WidgetRenderHandlers; getState(): TaskListState; setState(next: TaskListState): void; applyIcons(el: HTMLElement): void; }`
  - `class TaskListView extends ItemView` constructed with `(leaf, host)`.

- [ ] **Step 1: Implement the view**

`src/obsidian/taskListLeaf.ts`:

```ts
import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { StatusManager } from "../core/statusManager";
import type { PriorityConfig } from "../core/status";
import type { DayTask } from "../core/task";
import type { TaskListState } from "../core/taskListState";
import { DEFAULT_TASK_LIST_STATE } from "../core/taskListState";
import { createTaskListModel } from "../ui/taskListModel";
import { renderTaskListView, type TaskListFacets, type TaskListHandlers } from "./taskListRenderer";
import type { WidgetRenderHandlers, WidgetRenderOptions } from "./widgetRenderer";
import { noteBasename } from "../util/notePath";

export const VIEW_TYPE_TASK_LIST = "daytasks-task-list";

export interface TaskListHost {
	allTasks(): DayTask[];
	statusManager: StatusManager;
	priorities: PriorityConfig[];
	today(): string;
	widgetOptions(): WidgetRenderOptions;
	cardHandlers(): WidgetRenderHandlers;
	getState(): TaskListState;
	setState(next: TaskListState): void;
	applyIcons(el: HTMLElement): void;
}

export class TaskListView extends ItemView {
	private readonly expandedCardIds = new Set<string>();
	private readonly collapsedGroupKeys = new Set<string>();

	constructor(leaf: WorkspaceLeaf, private readonly host: TaskListHost) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_TASK_LIST;
	}

	getDisplayText(): string {
		return "DayTasks";
	}

	getIcon(): string {
		return "list-checks";
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	/** Re-renders from current tasks + persisted state. Called by the plugin on change. */
	render(): void {
		const container = this.contentEl;
		container.empty();

		const tasks = this.host.allTasks();
		const state = this.host.getState();
		const model = createTaskListModel(
			tasks,
			this.host.statusManager,
			this.host.today(),
			this.host.priorities,
			state,
			this.expandedCardIds,
			this.collapsedGroupKeys
		);

		renderTaskListView(
			container,
			model,
			this.facets(tasks),
			this.host.widgetOptions(),
			this.wrapCardHandlers(),
			this.listHandlers(state)
		);
		this.host.applyIcons(container);
	}

	/** Distinct status/tag/context/project values across all tasks, for the filter bar. */
	private facets(tasks: DayTask[]): TaskListFacets {
		const tags = new Set<string>();
		const contexts = new Set<string>();
		const projects = new Map<string, string>();
		for (const task of tasks) {
			task.tags.forEach((t) => tags.add(t));
			task.contexts.forEach((c) => contexts.add(c));
			task.projects.forEach((p) => projects.set(p.path, p.title ?? noteBasename(p.path)));
		}
		return {
			statuses: this.host.statusManager.getStatusesByOrder().map((s) => ({ value: s.value, label: s.label })),
			tags: [...tags].sort(),
			contexts: [...contexts].sort(),
			projects: [...projects].entries().map(([path, label]) => ({ path, label })).toArray()
				.sort((a, b) => a.label.localeCompare(b.label)),
		};
	}

	/** Card collapse is local to this view; everything else delegates to the plugin's shared handlers. */
	private wrapCardHandlers(): WidgetRenderHandlers {
		const base = this.host.cardHandlers();
		return {
			...base,
			onToggleCollapsed: (taskId) => {
				if (this.expandedCardIds.has(taskId)) this.expandedCardIds.delete(taskId);
				else this.expandedCardIds.add(taskId);
				this.render();
			},
		};
	}

	private update(next: Partial<TaskListState>): void {
		this.host.setState({ ...this.host.getState(), ...next });
		this.render();
	}

	private listHandlers(state: TaskListState): TaskListHandlers {
		return {
			onSetStatuses: (statuses) => this.update({ statuses }),
			onSetDatePreset: (datePreset) => this.update({ datePreset }),
			onSetTags: (tags) => this.update({ tags }),
			onSetContexts: (contexts) => this.update({ contexts }),
			onSetProjects: (projects) => this.update({ projects }),
			onSetSearch: (search) => this.update({ search }),
			onSetGroupBy: (groupBy) => this.update({ groupBy }),
			onSetSort: (sortBy, sortDir) => this.update({ sortBy, sortDir }),
			onClear: () => this.update({ ...DEFAULT_TASK_LIST_STATE }),
			onToggleGroup: (key) => {
				if (this.collapsedGroupKeys.has(key)) this.collapsedGroupKeys.delete(key);
				else this.collapsedGroupKeys.add(key);
				this.render();
			},
		};
	}
}
```

Note: `[...projects].entries()…toArray()` — if the TS target lacks `Iterator.toArray`, use `Array.from(projects, ([path, label]) => ({ path, label }))` instead. Confirm with `npm run typecheck` and switch if needed.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors (fix the projects-mapping form per the note if it complains).

- [ ] **Step 3: Commit**

```bash
git add src/obsidian/taskListLeaf.ts
git commit -m "feat(tasklist): TaskListView ItemView host

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Plugin wiring — register view, ribbon, command, refresh

**Files:**
- Modify: `src/main.ts`
- Test: manual

**Interfaces:**
- Consumes: `TaskListView`, `VIEW_TYPE_TASK_LIST`, `TaskListHost` (Task 6).

- [ ] **Step 1: Register the view + entry points**

In `src/main.ts`:
- Import: add `WorkspaceLeaf` to the `obsidian` import; `import { TaskListView, VIEW_TYPE_TASK_LIST, type TaskListHost } from "./obsidian/taskListLeaf";`
- In `onload()` (near the existing `addCommand`/`addSettingTab`):

```ts
this.registerView(VIEW_TYPE_TASK_LIST, (leaf) => new TaskListView(leaf, this.taskListHost()));
this.addRibbonIcon("list-checks", "DayTasks: task list", () => void this.openTaskList());
this.addCommand({
	id: "open-task-list",
	name: "Open task list",
	callback: () => void this.openTaskList(),
});
```

- Add the host factory + open method + refresh hook:

```ts
private taskListHost(): TaskListHost {
	return {
		allTasks: () => this.service.allTasks(),
		statusManager: this.statusManager,
		priorities: this.settings.priorities,
		today: () => this.today(),
		widgetOptions: () => this.widgetOptions(),
		cardHandlers: () => this.taskListCardHandlers(),
		getState: () => this.settings.taskListState,
		setState: (next) => {
			this.settings.taskListState = next;
			void this.saveSettings();
		},
		applyIcons: (el) => this.applyIcons(el),
	};
}

private async openTaskList(): Promise<void> {
	const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_TASK_LIST);
	if (existing.length > 0) {
		await this.app.workspace.revealLeaf(existing[0]);
		return;
	}
	const leaf = this.app.workspace.getLeaf(true);
	await leaf.setViewState({ type: VIEW_TYPE_TASK_LIST, active: true });
	await this.app.workspace.revealLeaf(leaf);
}

private taskListCardHandlers(): WidgetRenderHandlers {
	return {
		onCycleStatus: (taskId) => void this.handleCycleStatus(taskId),
		onCyclePriority: (taskId) => void this.handleCyclePriority(taskId),
		onEditTask: (taskId) => void this.openEditModal(taskId),
		onOpenProject: (path) => this.openProject(path),
		onOpenTask: (taskId) => this.openTaskNote(taskId),
		onSelectTag: (tag) => this.searchTag(tag),
		onOpenMenu: (taskId, anchor) => this.openTaskMenu(taskId, anchor),
	};
}
```

(Confirm the referenced private methods exist — `today`, `widgetOptions`, `applyIcons`, `saveSettings`, `handleCycleStatus`, `handleCyclePriority`, `openEditModal`, `openProject`, `openTaskNote`, `searchTag`, `openTaskMenu`, and `this.statusManager`/`this.service`/`this.settings`. They are all used by the existing widget wiring; reuse them. If `saveSettings`/`today`/`widgetOptions` have different names, match the existing ones.)

- In `refreshViews()`, after refreshing reading/live-preview, re-render any open task-list leaves:

```ts
for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_TASK_LIST)) {
	if (leaf.view instanceof TaskListView) {
		leaf.view.render();
	}
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck`
Expected: no errors. Then `npm run check` (full suite green).

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(tasklist): register view + ribbon + command + live refresh

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Styles

**Files:**
- Create: `styles/task-list-view.css`
- Modify: `build-css.mjs` (add the file to the include list)

**Interfaces:** none (presentational). Theme tokens only.

- [ ] **Step 1: Add the stylesheet**

`styles/task-list-view.css` (reuse the repo's token conventions — `--size-4-*`, `--radius-*`, `--text-*`, `--background-*`, `--daytasks-*`):

```css
.daytasks-tasklist {
	padding: var(--size-4-3);
	display: flex;
	flex-direction: column;
	gap: var(--size-4-2);
}

.daytasks-tasklist__filterbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--size-4-2);
	padding-bottom: var(--size-4-2);
	border-bottom: 1px solid var(--background-modifier-border);
}

.daytasks-tasklist__search {
	flex: 1 1 180px;
	min-width: 140px;
}

.daytasks-tasklist__statuses,
.daytasks-tasklist__tags,
.daytasks-tasklist__contexts,
.daytasks-tasklist__projects {
	display: flex;
	flex-wrap: wrap;
	gap: var(--size-2-2);
}

.daytasks-tasklist__facet-chip {
	padding: 0 var(--size-2-3);
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-s);
	background: transparent;
	color: var(--text-muted);
	cursor: pointer;
	font-size: var(--font-ui-smaller);
}

.daytasks-tasklist__facet-chip.is-active {
	background: var(--interactive-accent);
	color: var(--text-on-accent);
	border-color: var(--interactive-accent);
}

.daytasks-tasklist__group {
	display: flex;
	flex-direction: column;
}

.daytasks-tasklist__group-head {
	display: flex;
	align-items: center;
	gap: var(--size-2-2);
	padding: var(--size-2-2) 0;
	position: sticky;
	top: 0;
	background: var(--background-primary);
	z-index: 1;
}

.daytasks-tasklist__group-toggle {
	display: inline-flex;
	background: none;
	border: none;
	cursor: pointer;
	color: var(--text-muted);
	padding: 0;
}

.daytasks-tasklist__group-label {
	font-weight: var(--font-semibold);
}

.daytasks-tasklist__group-count {
	color: var(--text-faint);
	font-size: var(--font-ui-smaller);
}

.daytasks-tasklist__cards {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: var(--size-2-2);
}

.daytasks-tasklist__empty {
	color: var(--text-muted);
	padding: var(--size-4-4);
	text-align: center;
}
```

If a token name above isn't defined in the repo, swap it for the nearest one already used in `styles/` (grep `styles/variables.css` + existing files). No hardcoded colors.

- [ ] **Step 2: Add to the CSS build**

In `build-css.mjs`, add to the `files` array (after `"styles/widget.css"`):

```js
"styles/task-list-view.css", // task list view: filter bar, groups
```

- [ ] **Step 3: Rebuild CSS**

Run: `node build-css.mjs`
Expected: `[ok] included styles/task-list-view.css` and a regenerated `styles.css`.

- [ ] **Step 4: Commit**

```bash
git add styles/task-list-view.css build-css.mjs
git commit -m "style(tasklist): filter bar + group section styles

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Full build + manual verification

**Files:** none new — verification + any fixes surfaced.

- [ ] **Step 1: Check + lint**

Run: `npm run check && npm run lint`
Expected: typecheck + all tests PASS; lint clean (fix any unused-import / `any` from the new code).

- [ ] **Step 2: Build into the test vault**

Run: `npm run build:test`
Expected: build succeeds, plugin copied to `daytask-vault`. Reload the plugin in Obsidian (`obsidian command id=app:reload`).

- [ ] **Step 3: Manual verification (open `daytask-vault` in Obsidian)**

Verify each:
- Ribbon icon **and** the "DayTasks: Open task list" command both open the view as a main tab.
- The view lists tasks across multiple days (not just one daily note).
- Status chips / date preset / tag / context / project / search each filter the list; Clear resets them.
- Group-by switches between Status / Date / Project; sections collapse; counts are right.
- Sort dropdown + direction toggle reorder within groups.
- A card expands on its chevron; status/priority/edit/⋮ work; editing or completing a task updates the list live.
- Filter/sort/group choices persist after `app:reload`.
- Toggle a light and a dark theme → colors adapt (no hardcoded palette).

- [ ] **Step 4: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "fix(tasklist): address manual-verification issues

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Custom view (not Bases) → Task 6/7. ✓
- Filters: status/date/tag/context/project/search → Task 1 (`filterTasks`) + Task 5 (bar). ✓
- Switchable grouping (Status default · Date · Project) → Task 2 (`groupTasks`) + Task 5. ✓
- Sorting (5 keys + dir, default Scheduled asc) → Task 2 (`sortTasks`) + Task 5. ✓
- Reuse card UI, collapsed default, flat (children: []) → Task 4 + Task 5 (exported `renderTaskCard`). ✓
- Main tab + ribbon + command → Task 7. ✓
- Persist state in settings → Task 3 + Task 7 (`setState` → `saveSettings`). ✓
- Live updates → Task 7 (`refreshViews` hook). ✓
- No drag here → not wired (SortableJS not imported in this view). ✓
- Styles → Task 8. ✓

**Open items flagged for the implementer (resolve in-task, not blockers):**
- Settings test file name (Task 3) — `ls tests/settings`.
- Exact private-method names on the plugin (Task 7) — match existing widget wiring.
- `projects` map→array form (Task 6) — use `Array.from` if `Iterator.toArray` isn't in the TS target.
- CSS token names (Task 8) — reuse existing ones if any differ.

**Type consistency:** `TaskListState`/`DEFAULT_TASK_LIST_STATE` (Task 1) used in 2,3,4,6,7; `TaskGroup` (Task 2) consumed by `createTaskListModel` (Task 4); `TaskListModel`/`TaskListGroup` (Task 4) consumed by `renderTaskListView` (Task 5); `TaskListFacets`/`TaskListHandlers` (Task 5) consumed by Task 6; `renderTaskCard` exported in Task 5 and consumed there; `VIEW_TYPE_TASK_LIST`/`TaskListView`/`TaskListHost` (Task 6) consumed by Task 7. Consistent.
