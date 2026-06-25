import { describe, expect, it } from "vitest";
import { DayTaskService } from "../../src/core/dayTaskService";
import { DEFAULT_PRIORITIES, DEFAULT_STATUSES } from "../../src/core/status";
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
		const controller = new DailyTasksWidgetController({ service, statusManager, priorities: DEFAULT_PRIORITIES, today: () => "2026-06-24" });

		await service.createTask({
			title: "Buy milk",
			scheduledDate: "2026-06-24",
			tags: ["errand"],
			projects: [{ path: "Projects/Home.md", title: "Home" }],
		});

		expect(controller.getWidgetForDate("2026-06-24")).toEqual({
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
					priority: "normal",
					priorityLabel: "Normal",
					priorityColor: "#e0a800",
					priorityIcon: "flag",
					estimateLabel: undefined,
					scheduledLabel: "Jun 24",
					dueDate: undefined,
					dueLabel: undefined,
					overdue: false,
					tags: ["daytask", "errand"],
					contexts: [],
					projects: [{ path: "Projects/Home.md", label: "Home" }],
					description: undefined,
					children: [],
					expanded: false,
					blockedBy: [],
					blocking: [],
					blocked: false,
				},
			],
		});
	});

	it("builds an empty model for a date with no tasks", () => {
		const service = makeService();
		const controller = new DailyTasksWidgetController({ service, statusManager, priorities: DEFAULT_PRIORITIES, today: () => "2026-06-24" });

		expect(controller.getWidgetForDate("2026-06-26")).toEqual({
			date: "2026-06-26",
			title: "DayTasks",
			empty: true,
			totalCount: 0,
			doneCount: 0,
			overdueCount: 0,
			statusSummary: [],
			cards: [],
		});
	});

	it("nests children and reflects expandedIds", async () => {
		let next = 0;
		const ids = ["TSK-parent01", "TSK-child0001"];
		const service = new DayTaskService({
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
			id: () => ids[next++],
		});
		const controller = new DailyTasksWidgetController({
			service,
			statusManager,
			priorities: DEFAULT_PRIORITIES,
			today: () => "2026-06-24",
		});

		const parent = await service.createTask({ title: "Parent", scheduledDate: "2026-06-24" });
		await service.createSubtask(parent.id, { title: "Child", scheduledDate: "2026-06-24" });

		const model = controller.getWidgetForDate("2026-06-24", new Set([parent.id]));

		expect(model.cards.map((c) => c.id)).toEqual(["TSK-parent01"]);
		expect(model.cards[0].children.map((c) => c.id)).toEqual(["TSK-child0001"]);
		expect(model.cards[0].childProgress).toEqual({ done: 0, total: 1 });
		expect(model.cards[0].expanded).toBe(true);
	});
});
