import { describe, expect, it } from "vitest";
import { DayTaskService } from "../../src/core/dayTaskService";
import { DEFAULT_STATUSES } from "../../src/core/status";
import { StatusManager } from "../../src/core/statusManager";
import { MemoryTaskIndex } from "../../src/core/taskIndex";
import { MemoryTaskStore } from "../../src/core/taskStore";
import { DailyTasksWidgetController } from "../../src/ui/dailyTasksWidgetController";

const statusManager = new StatusManager(DEFAULT_STATUSES, "open");

function makeService(): DayTaskService {
	return new DayTaskService({
		store: new MemoryTaskStore(),
		index: new MemoryTaskIndex(),
		statusManager,
		settings: {
			defaultStatus: "open",
			defaultPriority: "normal",
			defaultTags: [],
			defaultProjectPath: "",
		},
		now: () => "2026-06-24T08:00:00.000Z",
		id: () => "TSK-8cA562sd",
	});
}

describe("DailyTasksWidgetController", () => {
	it("creates a widget model for the active daily note", async () => {
		const service = makeService();
		const controller = new DailyTasksWidgetController({ service, statusManager });

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
					statusLabel: "Open",
					statusColor: "#808080",
					statusIcon: "circle",
					priority: "normal",
					tags: ["errand"],
					contexts: [],
					projects: [{ path: "Projects/Home.md", label: "Home" }],
					description: undefined,
				},
			],
		});
	});

	it("does not create a widget model for non-daily notes", () => {
		const service = makeService();
		const controller = new DailyTasksWidgetController({ service, statusManager });

		expect(controller.getWidgetForNotePath("Projects/Home.md")).toBeNull();
	});
});
