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
