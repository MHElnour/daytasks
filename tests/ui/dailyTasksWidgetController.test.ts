import { describe, expect, it } from "vitest";
import { DayTaskService } from "../../src/core/dayTaskService";
import { MemoryTaskIndex } from "../../src/core/taskIndex";
import { MemoryTaskStore } from "../../src/core/taskStore";
import { DailyTasksWidgetController } from "../../src/ui/dailyTasksWidgetController";

describe("DailyTasksWidgetController", () => {
	it("creates a widget model for the active daily note", async () => {
		const service = new DayTaskService({
			store: new MemoryTaskStore(),
			index: new MemoryTaskIndex(),
			now: () => "2026-06-24T08:00:00.000Z",
			id: () => "TSK-8cA562sd",
		});
		const controller = new DailyTasksWidgetController({ service });

		await service.createTask({
			title: "Buy milk",
			scheduledDate: "2026-06-24",
			tags: ["errand"],
			projects: [{ path: "Projects/Home.md", title: "Home" }],
		});

		expect(controller.getWidgetForNotePath("Daily/2026-06-24.md")).toEqual({
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

	it("does not create a widget model for non-daily notes", () => {
		const service = new DayTaskService({
			store: new MemoryTaskStore(),
			index: new MemoryTaskIndex(),
			now: () => "2026-06-24T08:00:00.000Z",
			id: () => "TSK-8cA562sd",
		});
		const controller = new DailyTasksWidgetController({ service });

		expect(controller.getWidgetForNotePath("Projects/Home.md")).toBeNull();
	});
});
