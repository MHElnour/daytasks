import { describe, expect, it } from "vitest";
import { DEFAULT_STATUSES } from "../../src/core/status";
import { StatusManager } from "../../src/core/statusManager";
import { createDayTask } from "../../src/core/taskFactory";
import { isTaskId } from "../../src/core/taskIds";

const statusManager = new StatusManager(DEFAULT_STATUSES, "open");
const fixedDeps = {
	now: () => "2026-06-25T08:00:00.000Z",
	id: () => "TSK-8cA562sd",
	statusManager,
};

describe("createDayTask", () => {
	it("creates an open task with arrays defaulted, a generated id, and timestamps", () => {
		const task = createDayTask(
			{
				title: "Buy milk",
				scheduledDate: "2026-06-25",
				tags: ["errand", "home"],
				projects: [{ path: "Projects/Home.md", title: "Home" }],
			},
			fixedDeps
		);

		expect(task).toEqual({
			id: "TSK-8cA562sd",
			title: "Buy milk",
			status: "open",
			scheduledDate: "2026-06-25",
			tags: ["daytask", "errand", "home"],
			contexts: [],
			projects: [{ path: "Projects/Home.md", title: "Home" }],
			timeEntries: [],
			createdAt: "2026-06-25T08:00:00.000Z",
			updatedAt: "2026-06-25T08:00:00.000Z",
		});
		expect(isTaskId(task.id)).toBe(true);
		expect(task.completedAt).toBeUndefined();
	});

	it("merges default tags and projects with input, de-duplicated", () => {
		const task = createDayTask(
			{
				title: "Task",
				scheduledDate: "2026-06-25",
				tags: ["errand", "work"],
				projects: [{ path: "Projects/Home.md" }],
			},
			{
				...fixedDeps,
				defaults: {
					tags: ["work"],
					projects: [{ path: "Projects/Home.md", title: "Home" }],
				},
			}
		);

		expect(task.tags).toEqual(["daytask", "work", "errand"]);
		expect(task.projects).toEqual([{ path: "Projects/Home.md", title: "Home" }]);
	});

	it("applies the default status and sets completedAt for a completed start status", () => {
		const open = createDayTask(
			{ title: "A", scheduledDate: "2026-06-25" },
			{ ...fixedDeps, defaults: { status: "in-progress" } }
		);
		expect(open.status).toBe("in-progress");
		expect(open.completedAt).toBeUndefined();

		const done = createDayTask(
			{ title: "B", scheduledDate: "2026-06-25", status: "done" },
			fixedDeps
		);
		expect(done.status).toBe("done");
		expect(done.completedAt).toBe("2026-06-25T08:00:00.000Z");
	});

	it("accepts a custom status string from configuration", () => {
		const custom = new StatusManager(
			[
				{ id: "todo", value: "todo", label: "Todo", color: "#1", isCompleted: false, order: 0 },
				{ id: "shipped", value: "shipped", label: "Shipped", color: "#2", isCompleted: true, order: 1 },
			],
			"todo"
		);
		const task = createDayTask(
			{ title: "Ship", scheduledDate: "2026-06-25", status: "shipped" },
			{ ...fixedDeps, statusManager: custom }
		);
		expect(task.status).toBe("shipped");
		expect(task.completedAt).toBe("2026-06-25T08:00:00.000Z");
	});

	it("clamps the description to 500 characters", () => {
		const task = createDayTask(
			{
				title: "Long note",
				scheduledDate: "2026-06-25",
				description: "x".repeat(600),
			},
			fixedDeps
		);
		expect(task.description).toHaveLength(500);
	});

	it("rejects blank titles", () => {
		expect(() =>
			createDayTask({ title: "   ", scheduledDate: "2026-06-25" }, fixedDeps)
		).toThrow("Task title is required");
	});
});
