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
			children: [],
			expanded: false,
			blockedBy: [],
			blocking: [],
			blocked: false,
			collapsed: false,
			createdLabel: "Jun 24",
			hasDetailNote: false,
		});
	});

	it("strips inline markdown from the title, description, and dependency ref titles", () => {
		const blocker = { ...task, id: "TSK-blocker01", title: "**Blocker** [[Note|note]]", status: "open" };
		const model = createTaskCardViewModel(
			{ ...task, title: "**Buy** [[Milk]]", description: "get __2%__ milk", blockedBy: ["TSK-blocker01"], status: "blocked" },
			statusManager,
			"2026-06-24",
			priorities,
			{},
			{ resolve: (id) => (id === "TSK-blocker01" ? blocker : undefined), blocking: [] }
		);
		expect(model.title).toBe("Buy Milk");
		expect(model.description).toBe("get 2% milk");
		expect(model.blockedBy[0].title).toBe("Blocker note");
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

	it("defaults nesting fields for a leaf", () => {
		const model = createTaskCardViewModel(task, statusManager, "2026-06-24", priorities);
		expect(model.children).toEqual([]);
		expect(model.expanded).toBe(false);
		expect(model.childProgress).toBeUndefined();
	});

	it("threads a nesting option onto the model", () => {
		const childModel = createTaskCardViewModel(
			{ ...task, id: "TSK-child0001" },
			statusManager,
			"2026-06-24",
			priorities
		);
		const model = createTaskCardViewModel(task, statusManager, "2026-06-24", priorities, {
			children: [childModel],
			childProgress: { done: 1, total: 2 },
			expanded: true,
		});
		expect(model.children).toEqual([childModel]);
		expect(model.childProgress).toEqual({ done: 1, total: 2 });
		expect(model.expanded).toBe(true);
	});

	it("resolves blockedBy + blocking refs and the blocked flag", () => {
		const blocker = { ...task, id: "TSK-blocker01", title: "Blocker", status: "open" };
		const blocked = { ...task, id: "TSK-blocked01", title: "Dependent", status: "blocked", blockedBy: ["TSK-blocker01"] };
		const model = createTaskCardViewModel(blocked, statusManager, "2026-06-24", priorities, {}, {
			resolve: (id) => (id === "TSK-blocker01" ? blocker : undefined),
			blocking: [],
		});
		expect(model.blockedBy.map((r) => r.id)).toEqual(["TSK-blocker01"]);
		expect(model.blockedBy[0].title).toBe("Blocker");
		expect(model.blocked).toBe(true); // status is "blocked"
	});

	it("is not blocked when all blockers are completed", () => {
		const blocker = { ...task, id: "TSK-blocker01", status: "done" };
		const blocked = { ...task, id: "TSK-blocked01", blockedBy: ["TSK-blocker01"] };
		const model = createTaskCardViewModel(blocked, statusManager, "2026-06-24", priorities, {}, {
			resolve: () => blocker,
			blocking: [],
		});
		expect(model.blocked).toBe(false);
	});

	it("exposes createdLabel from createdAt date portion", () => {
		const vm = createTaskCardViewModel(
			{ ...task, createdAt: "2026-06-25T13:00:00.000Z" },
			statusManager,
			"2026-06-27",
			priorities
		);
		expect(vm.createdLabel).toBe("Jun 25");
		expect(vm.collapsed).toBe(false);
	});

	it("collapsed reflects the nesting flag", () => {
		const vm = createTaskCardViewModel(
			task,
			statusManager,
			"2026-06-27",
			priorities,
			{ collapsed: true }
		);
		expect(vm.collapsed).toBe(true);
	});

	it("hasDetailNote is true when task.detailNotePath is set", () => {
		const vm = createTaskCardViewModel(
			{ ...task, detailNotePath: "Notes/TSK-8cA562sd.md" },
			statusManager,
			"2026-06-24",
			priorities
		);
		expect(vm.hasDetailNote).toBe(true);
	});

	it("hasDetailNote is false when task.detailNotePath is undefined", () => {
		const vm = createTaskCardViewModel(task, statusManager, "2026-06-24", priorities);
		expect(vm.hasDetailNote).toBe(false);
	});
});
