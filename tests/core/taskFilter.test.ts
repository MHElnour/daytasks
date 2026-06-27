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
