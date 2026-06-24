import { describe, expect, it } from "vitest";
import type { DayTask } from "../../src/core/task";
import { createDailyTasksWidgetModel } from "../../src/ui/todayView";

const task: DayTask = {
	id: "TSK-8cA562sd",
	title: "Buy milk",
	status: "open",
	scheduledDate: "2026-06-24",
	tags: ["errand"],
	projects: [{ path: "Projects/Home.md", title: "Home" }],
	timeEntries: [],
	createdAt: "2026-06-24T08:00:00.000Z",
	updatedAt: "2026-06-24T08:00:00.000Z",
};

describe("createDailyTasksWidgetModel", () => {
	it("creates a daily widget model from tasks for the active note date", () => {
		expect(createDailyTasksWidgetModel("2026-06-24", [task])).toEqual({
			date: "2026-06-24",
			title: "DayTasks",
			empty: false,
			cards: [
				{
					id: "TSK-8cA562sd",
					title: "Buy milk",
					checked: false,
					status: "open",
					tags: ["errand"],
					projects: [{ path: "Projects/Home.md", label: "Home" }],
				},
			],
		});
	});

	it("marks the model empty when no tasks exist for the date", () => {
		expect(createDailyTasksWidgetModel("2026-06-24", [])).toEqual({
			date: "2026-06-24",
			title: "DayTasks",
			empty: true,
			cards: [],
		});
	});
});
