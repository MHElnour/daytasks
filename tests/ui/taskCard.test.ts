import { describe, expect, it } from "vitest";
import { DEFAULT_STATUSES } from "../../src/core/status";
import { StatusManager } from "../../src/core/statusManager";
import type { DayTask } from "../../src/core/task";
import { createTaskCardViewModel } from "../../src/ui/taskCard";

const statusManager = new StatusManager(DEFAULT_STATUSES, "open");

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
		expect(createTaskCardViewModel(task, statusManager)).toEqual({
			id: "TSK-8cA562sd",
			title: "Buy milk",
			checked: true,
			status: "done",
			statusLabel: "Done",
			statusColor: "#00aa00",
			statusIcon: "check-circle",
			priority: undefined,
			tags: ["errand", "home"],
			contexts: [],
			projects: [{ path: "Projects/Home.md", label: "Home" }],
			description: undefined,
		});
	});

	it("uses the project filename as a fallback label", () => {
		const model = createTaskCardViewModel(
			{ ...task, projects: [{ path: "Projects/Client Launch.md" }] },
			statusManager
		);

		expect(model.projects).toEqual([
			{ path: "Projects/Client Launch.md", label: "Client Launch" },
		]);
	});

	it("treats a non-completed status as unchecked", () => {
		const model = createTaskCardViewModel({ ...task, status: "open" }, statusManager);
		expect(model.checked).toBe(false);
		expect(model.statusLabel).toBe("Open");
	});

	it("formats the estimate and carries the due date", () => {
		const model = createTaskCardViewModel(
			{ ...task, estimateMinutes: 90, dueDate: "2026-07-01" },
			statusManager
		);
		expect(model.estimateLabel).toBe("1h30m");
		expect(model.dueDate).toBe("2026-07-01");
	});
});
