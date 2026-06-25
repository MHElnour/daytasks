import { describe, expect, it } from "vitest";
import { DEFAULT_PRIORITIES, DEFAULT_STATUSES } from "../../src/core/status";
import { StatusManager } from "../../src/core/statusManager";
import type { DayTask } from "../../src/core/task";
import { createTaskCardViewModel } from "../../src/ui/taskCard";

const statusManager = new StatusManager(DEFAULT_STATUSES, "open");
const priorities = DEFAULT_PRIORITIES;

const task: DayTask = {
	id: "TSK-8cA562sd",
	title: "Buy milk",
	status: "done",
	scheduledDate: "2026-06-24",
	tags: ["errand", "home"],
	contexts: [],
	projects: [{ path: "Projects/Home.md", title: "Home" }],
	timeEntries: [],
	createdAt: "2026-06-24T08:00:00.000Z",
	updatedAt: "2026-06-24T08:00:00.000Z",
};

describe("createTaskCardViewModel", () => {
	it("creates a card model with status presentation, tags, and project links", () => {
		expect(createTaskCardViewModel(task, statusManager, "2026-06-24", priorities)).toEqual({
			id: "TSK-8cA562sd",
			title: "Buy milk",
			checked: true,
			status: "done",
			statusLabel: "Done",
			statusColor: "#00aa00",
			statusIcon: "check-circle",
			priority: undefined,
			priorityLabel: undefined,
			priorityColor: undefined,
			priorityIcon: undefined,
			estimateLabel: undefined,
			scheduledLabel: "Jun 24",
			dueDate: undefined,
			dueLabel: undefined,
			overdue: false,
			tags: ["errand", "home"],
			contexts: [],
			projects: [{ path: "Projects/Home.md", label: "Home" }],
			description: undefined,
		});
	});

	it("uses the project filename as a fallback label", () => {
		const model = createTaskCardViewModel(
			{ ...task, projects: [{ path: "Projects/Client Launch.md" }] },
			statusManager,
			"2026-06-24",
			priorities
		);

		expect(model.projects).toEqual([
			{ path: "Projects/Client Launch.md", label: "Client Launch" },
		]);
	});

	it("treats a non-completed status as unchecked", () => {
		const model = createTaskCardViewModel(
			{ ...task, status: "open" },
			statusManager,
			"2026-06-24",
			priorities
		);
		expect(model.checked).toBe(false);
		expect(model.statusLabel).toBe("Open");
	});

	it("formats the estimate and a month-day due label", () => {
		const model = createTaskCardViewModel(
			{ ...task, status: "open", estimateMinutes: 90, dueDate: "2026-06-23" },
			statusManager,
			"2026-06-24",
			priorities
		);
		expect(model.estimateLabel).toBe("1h30m");
		expect(model.dueLabel).toBe("Jun 23");
		expect(model.scheduledLabel).toBe("Jun 24");
		expect(model.overdue).toBe(true);
	});

	it("resolves priority label, color, and a fallback icon", () => {
		const model = createTaskCardViewModel(
			{ ...task, priority: "high" },
			statusManager,
			"2026-06-24",
			priorities
		);
		expect(model.priorityLabel).toBe("High");
		expect(model.priorityColor).toBe("#d9534f");
		expect(model.priorityIcon).toBe("flag");
	});

	it("leaves priority fields undefined when the task has no priority", () => {
		const model = createTaskCardViewModel(task, statusManager, "2026-06-24", priorities);
		expect(model.priorityLabel).toBeUndefined();
		expect(model.priorityColor).toBeUndefined();
		expect(model.priorityIcon).toBeUndefined();
	});
});
