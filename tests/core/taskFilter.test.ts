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
