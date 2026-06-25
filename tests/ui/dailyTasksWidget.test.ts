import { describe, expect, it } from "vitest";
import { DEFAULT_STATUSES } from "../../src/core/status";
import { StatusManager } from "../../src/core/statusManager";
import type { DayTask } from "../../src/core/task";
import { createDailyTasksWidgetModel } from "../../src/ui/todayView";

const statusManager = new StatusManager(DEFAULT_STATUSES, "open");

const task: DayTask = {
	id: "TSK-8cA562sd",
	title: "Buy milk",
	status: "open",
	scheduledDate: "2026-06-24",
	tags: ["errand"],
	contexts: [],
	projects: [{ path: "Projects/Home.md", title: "Home" }],
	timeEntries: [],
	createdAt: "2026-06-24T08:00:00.000Z",
	updatedAt: "2026-06-24T08:00:00.000Z",
};

describe("createDailyTasksWidgetModel", () => {
	it("creates a daily widget model from tasks for the active note date", () => {
		expect(createDailyTasksWidgetModel("2026-06-24", [task], statusManager)).toEqual({
			date: "2026-06-24",
			title: "DayTasks",
			empty: false,
			cards: [
				{
					id: "TSK-8cA562sd",
					title: "Buy milk",
					checked: false,
					status: "open",
					statusLabel: "Open",
					statusColor: "#808080",
					statusIcon: "circle",
					priority: undefined,
					tags: ["errand"],
					contexts: [],
					projects: [{ path: "Projects/Home.md", label: "Home" }],
					description: undefined,
				},
			],
		});
	});

	it("marks the model empty when no tasks exist for the date", () => {
		expect(createDailyTasksWidgetModel("2026-06-24", [], statusManager)).toEqual({
			date: "2026-06-24",
			title: "DayTasks",
			empty: true,
			cards: [],
		});
	});
});
