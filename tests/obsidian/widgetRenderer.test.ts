// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import {
	renderDailyTasksWidget,
	type WidgetRenderHandlers,
	type WidgetRenderOptions,
} from "../../src/obsidian/widgetRenderer";
import type { DailyTasksWidgetModel } from "../../src/ui/todayView";

const allOn: WidgetRenderOptions = {
	showTaskIds: true,
	showTags: true,
	showContexts: true,
	showProjects: true,
};

const emptyModel: DailyTasksWidgetModel = {
	date: "2026-06-25",
	title: "DayTasks",
	empty: true,
	totalCount: 0,
	doneCount: 0,
	overdueCount: 0,
	statusSummary: [],
	cards: [],
};

const filledModel: DailyTasksWidgetModel = {
	date: "2026-06-25",
	title: "DayTasks",
	empty: false,
	totalCount: 2,
	doneCount: 1,
	overdueCount: 1,
	statusSummary: [
		{ value: "open", label: "Open", color: "#808080", count: 1 },
		{ value: "done", label: "Done", color: "#00aa00", count: 1 },
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
			estimateLabel: "1h30m",
			dueDate: "2026-06-24",
			dueLabel: "Yesterday",
			overdue: true,
			tags: ["errand", "home"],
			contexts: ["phone"],
			projects: [{ path: "Projects/Home.md", label: "Home" }],
			description: "from the corner store",
		},
		{
			id: "TSK-GJM4c42e",
			title: "Send proposal",
			checked: true,
			status: "done",
			statusLabel: "Done",
			statusColor: "#00aa00",
			statusIcon: "check-circle",
			overdue: false,
			tags: [],
			contexts: [],
			projects: [],
		},
	],
};

function render(
	model: DailyTasksWidgetModel,
	options: WidgetRenderOptions = allOn,
	handlers: Partial<WidgetRenderHandlers> = {}
) {
	const onToggleComplete = handlers.onToggleComplete ?? vi.fn();
	const onCycleStatus = handlers.onCycleStatus ?? vi.fn();
	const parent = document.createElement("div");
	const root = renderDailyTasksWidget(parent, model, options, {
		...handlers,
		onToggleComplete,
		onCycleStatus,
	});
	return { root, onToggleComplete, onCycleStatus };
}

describe("renderDailyTasksWidget", () => {
	it("renders header with count and empty state", () => {
		const { root } = render(emptyModel);
		expect(root.classList.contains("daytasks-plugin")).toBe(true);
		expect(root.querySelector(".daytasks-widget__title")?.textContent).toBe("DayTasks");
		expect(root.querySelector(".daytasks-widget__empty")).not.toBeNull();
	});

	it("renders a card per task with checkbox, status pill, id, description, chips", () => {
		const { root } = render(filledModel);
		const cards = root.querySelectorAll(".task-card");
		expect(cards).toHaveLength(2);

		const first = cards[0];
		expect(first.querySelector(".task-card__title-text")?.textContent).toBe("Buy milk");
		expect(first.querySelector<HTMLInputElement>(".task-card__checkbox")?.checked).toBe(false);
		expect(first.querySelector(".task-card__status-label")?.textContent).toBe("Open");
		expect(first.querySelector(".task-card__id")?.textContent).toBe("Task ID: TSK-8cA562sd");
		expect(first.querySelector(".task-card__description")?.textContent).toBe(
			"from the corner store"
		);
		expect(first.querySelector(".task-card__due")?.textContent).toContain("Yesterday");
		expect(first.querySelector(".task-card__due")?.classList.contains("is-overdue")).toBe(
			true
		);
		expect(first.querySelector(".task-card__estimate")?.textContent).toBe("Est: 1h30m");
		expect(first.querySelectorAll(".task-card__chip")).toHaveLength(4); // 2 tags + 1 ctx + 1 project
		expect(first.classList.contains("task-card--overdue")).toBe(true);
		expect(cards[1].classList.contains("task-card--completed")).toBe(true);
	});

	it("hides id and chips when options are disabled", () => {
		const { root } = render(filledModel, {
			showTaskIds: false,
			showTags: false,
			showContexts: false,
			showProjects: false,
		});
		const first = root.querySelectorAll(".task-card")[0];
		expect(first.querySelector(".task-card__id")).toBeNull();
		expect(first.querySelector(".task-card__chip")).toBeNull();
	});

	it("checkbox toggles completion; status pill cycles; neither triggers edit", () => {
		const onToggleComplete = vi.fn();
		const onCycleStatus = vi.fn();
		const onEditTask = vi.fn();
		const { root } = render(filledModel, allOn, {
			onToggleComplete,
			onCycleStatus,
			onEditTask,
		});
		const first = root.querySelectorAll(".task-card")[0];

		const checkbox = first.querySelector<HTMLInputElement>(".task-card__checkbox");
		checkbox!.checked = true;
		checkbox!.dispatchEvent(new Event("change", { bubbles: true }));
		expect(onToggleComplete).toHaveBeenCalledWith("TSK-8cA562sd");

		first.querySelector<HTMLElement>(".task-card__status")?.dispatchEvent(
			new Event("click", { bubbles: true })
		);
		expect(onCycleStatus).toHaveBeenCalledWith("TSK-8cA562sd");
		expect(onEditTask).not.toHaveBeenCalled();

		(first as HTMLElement).dispatchEvent(new Event("click", { bubbles: true }));
		expect(onEditTask).toHaveBeenCalledWith("TSK-8cA562sd");
	});

	it("chips call onSelectTag and onOpenProject", () => {
		const onSelectTag = vi.fn();
		const onOpenProject = vi.fn();
		const { root } = render(filledModel, allOn, { onSelectTag, onOpenProject });
		const first = root.querySelectorAll(".task-card")[0];

		first.querySelector<HTMLElement>(".task-card__chip")?.dispatchEvent(
			new Event("click", { bubbles: true })
		);
		first
			.querySelector<HTMLElement>(".task-card__chip--project")
			?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(onSelectTag).toHaveBeenCalledWith("errand");
		expect(onOpenProject).toHaveBeenCalledWith("Projects/Home.md");
	});

	it("renders an add button only when onAddTask is provided", () => {
		const onAddTask = vi.fn();
		const { root } = render(emptyModel, allOn, { onAddTask });
		const addButton = root.querySelector<HTMLElement>(".daytasks-widget__add");
		expect(addButton).not.toBeNull();
		addButton?.dispatchEvent(new Event("click"));
		expect(onAddTask).toHaveBeenCalledOnce();
	});

	it("renders a footer summary with legend and overdue", () => {
		const { root } = render(filledModel);
		expect(root.querySelector(".daytasks-widget__footer-total")?.textContent).toBe(
			"2 tasks total"
		);
		const legend = root.querySelectorAll(".daytasks-widget__legend-item");
		expect(legend.length).toBe(3); // 2 statuses + overdue
		expect(
			root.querySelector(".daytasks-widget__legend-item--overdue")?.textContent
		).toContain("1 Overdue");
	});
});
