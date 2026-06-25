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
			totalCount: 1,
			doneCount: 0,
			overdueCount: 0,
			statusSummary: [
				{ value: "open", label: "Open", color: "#808080", count: 1 },
			],
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
					estimateLabel: undefined,
					dueDate: undefined,
					dueLabel: undefined,
					overdue: false,
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
			totalCount: 0,
			doneCount: 0,
			overdueCount: 0,
			statusSummary: [],
			cards: [],
		});
	});

	it("sorts open tasks before completed ones and counts done", () => {
		const done: DayTask = { ...task, id: "TSK-done0001", status: "done" };
		const open: DayTask = { ...task, id: "TSK-open0001", status: "open" };

		const model = createDailyTasksWidgetModel(
			"2026-06-24",
			[done, open],
			statusManager
		);

		expect(model.cards.map((c) => c.id)).toEqual(["TSK-open0001", "TSK-done0001"]);
		expect(model.doneCount).toBe(1);
		expect(model.totalCount).toBe(2);
	});
});
