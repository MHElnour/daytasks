import { describe, expect, it } from "vitest";
import type { DayTask } from "../../src/core/task";
import { MemoryTaskIndex } from "../../src/core/taskIndex";

const tasks: DayTask[] = [
	{
		id: "TSK-8cA562sd",
		title: "Buy milk",
		status: "open",
		scheduledDate: "2026-06-24",
		parentId: "TSK-parent1",
		tags: ["errand", "home"],
		projects: [{ path: "Projects/Home.md", title: "Home" }],
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
		expect(index.byTag("errand")).toEqual([tasks[0]]);
		expect(index.byProject("Projects/Home.md")).toEqual([tasks[0]]);
	});

	it("upsert adds a new task to every index", () => {
		const index = new MemoryTaskIndex();

		index.upsert(tasks[0]);

		expect(index.byId("TSK-8cA562sd")).toEqual(tasks[0]);
		expect(index.byDate("2026-06-24")).toEqual([tasks[0]]);
		expect(index.byStatus("open")).toEqual([tasks[0]]);
		expect(index.byParent("TSK-parent1")).toEqual([tasks[0]]);
		expect(index.byTag("errand")).toEqual([tasks[0]]);
		expect(index.byProject("Projects/Home.md")).toEqual([tasks[0]]);
	});

	it("upsert re-indexes a changed task without duplicating it", () => {
		const index = new MemoryTaskIndex();
		index.upsert(tasks[0]);

		const done: DayTask = { ...tasks[0], status: "done" };
		index.upsert(done);

		expect(index.byId("TSK-8cA562sd")).toEqual(done);
		expect(index.byStatus("open")).toEqual([]);
		expect(index.byStatus("done")).toEqual([done]);
		expect(index.byDate("2026-06-24")).toEqual([done]);
		expect(index.byTag("errand")).toEqual([done]);
	});

	it("upsert preserves same-key query order when a task is updated", () => {
		const index = new MemoryTaskIndex();
		const secondSameDay: DayTask = {
			...tasks[1],
			scheduledDate: "2026-06-24",
			status: "open",
		};
		index.rebuild([tasks[0], secondSameDay]);

		const done: DayTask = { ...tasks[0], status: "done" };
		index.upsert(done);

		expect(index.byDate("2026-06-24")).toEqual([done, secondSameDay]);
		expect(index.byStatus("done")).toEqual([done]);
	});

	it("remove deletes a task from every index", () => {
		const index = new MemoryTaskIndex();
		index.upsert(tasks[0]);

		index.remove("TSK-8cA562sd");

		expect(index.byId("TSK-8cA562sd")).toBeNull();
		expect(index.byDate("2026-06-24")).toEqual([]);
		expect(index.byStatus("open")).toEqual([]);
		expect(index.byParent("TSK-parent1")).toEqual([]);
		expect(index.byTag("errand")).toEqual([]);
		expect(index.byProject("Projects/Home.md")).toEqual([]);
	});
});
