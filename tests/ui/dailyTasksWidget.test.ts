import { describe, expect, it } from "vitest";
import { DEFAULT_PRIORITIES, DEFAULT_STATUSES } from "../../src/core/status";
import { StatusManager } from "../../src/core/statusManager";
import type { DayTask } from "../../src/core/task";
import { createDailyTasksWidgetModel } from "../../src/ui/todayView";

const statusManager = new StatusManager(DEFAULT_STATUSES, "open");
const priorities = DEFAULT_PRIORITIES;

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
		expect(createDailyTasksWidgetModel("2026-06-24", [task], statusManager, "2026-06-24", priorities)).toEqual({
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
					priorityLabel: undefined,
					priorityColor: undefined,
					priorityIcon: undefined,
					estimateLabel: undefined,
					scheduledLabel: "Jun 24",
					dueDate: undefined,
					dueLabel: undefined,
					overdue: false,
					tags: ["errand"],
					contexts: [],
					projects: [{ path: "Projects/Home.md", label: "Home" }],
					description: undefined,
					descriptionExpanded: false,
					children: [],
					childProgress: undefined,
					expanded: false,
					blockedBy: [],
					blocking: [],
					blocked: false,
					collapsed: false,
					createdLabel: "Jun 24",
				},
			],
		});
	});

	it("marks the model empty when no tasks exist for the date", () => {
		expect(createDailyTasksWidgetModel("2026-06-24", [], statusManager, "2026-06-24", priorities)).toEqual({
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

	it("counts done tasks and preserves insertion order (no completion sort)", () => {
		const done: DayTask = { ...task, id: "TSK-done0001", status: "done" };
		const open: DayTask = { ...task, id: "TSK-open0001", status: "open" };

		const model = createDailyTasksWidgetModel(
			"2026-06-24",
			[done, open],
			statusManager,
			"2026-06-24",
			priorities
		);

		// Order reflects insertion (no sortOrder, same createdAt) — completion no longer sorts.
		expect(model.cards.map((c) => c.id)).toEqual(["TSK-done0001", "TSK-open0001"]);
		expect(model.doneCount).toBe(1);
		expect(model.totalCount).toBe(2);
	});

	it("computes due labels against the real today, not the note's date", () => {
		const dueOnNoteDay: DayTask = {
			...task,
			status: "open",
			dueDate: "2026-06-24",
		};

		// Viewing the 2026-06-24 note, but today is 2026-06-25.
		const model = createDailyTasksWidgetModel(
			"2026-06-24",
			[dueOnNoteDay],
			statusManager,
			"2026-06-25",
			priorities
		);

		expect(model.cards[0].dueLabel).toBe("Jun 24");
		expect(model.cards[0].overdue).toBe(true);
		expect(model.overdueCount).toBe(1);
	});

	it("nests same-day children under their parent and counts progress", () => {
		const parent: DayTask = { ...task, id: "TSK-parent01", status: "open" };
		const child: DayTask = { ...task, id: "TSK-child0001", status: "done", parentId: "TSK-parent01" };
		const getChildren = (id: string): DayTask[] => (id === "TSK-parent01" ? [child] : []);

		const model = createDailyTasksWidgetModel(
			"2026-06-24",
			[parent, child],
			statusManager,
			"2026-06-24",
			priorities,
			getChildren
		);

		expect(model.cards.map((c) => c.id)).toEqual(["TSK-parent01"]);
		expect(model.cards[0].children.map((c) => c.id)).toEqual(["TSK-child0001"]);
		expect(model.cards[0].childProgress).toEqual({ done: 1, total: 1 });
		expect(model.totalCount).toBe(2);
		expect(model.doneCount).toBe(1);
	});

	it("counts an off-day child in progress but does not nest it", () => {
		const parent: DayTask = { ...task, id: "TSK-parent01", status: "open", scheduledDate: "2026-06-24" };
		const offDay: DayTask = {
			...task,
			id: "TSK-child0001",
			status: "open",
			scheduledDate: "2026-06-30",
			parentId: "TSK-parent01",
		};
		const getChildren = (id: string): DayTask[] => (id === "TSK-parent01" ? [offDay] : []);

		const model = createDailyTasksWidgetModel(
			"2026-06-24",
			[parent],
			statusManager,
			"2026-06-24",
			priorities,
			getChildren
		);

		expect(model.cards[0].children).toEqual([]);
		expect(model.cards[0].childProgress).toEqual({ done: 0, total: 1 });
	});

	it("reflects expandedIds on the parent card", () => {
		const parent: DayTask = { ...task, id: "TSK-parent01" };
		const child: DayTask = { ...task, id: "TSK-child0001", parentId: "TSK-parent01" };
		const getChildren = (id: string): DayTask[] => (id === "TSK-parent01" ? [child] : []);

		const model = createDailyTasksWidgetModel(
			"2026-06-24",
			[parent, child],
			statusManager,
			"2026-06-24",
			priorities,
			getChildren,
			new Set(["TSK-parent01"])
		);

		expect(model.cards[0].expanded).toBe(true);
	});
});
