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
	cards: [],
};

const filledModel: DailyTasksWidgetModel = {
	date: "2026-06-25",
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
			estimateLabel: "1h30m",
			dueDate: "2026-07-01",
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
	const onToggleTask = handlers.onToggleTask ?? vi.fn();
	const parent = document.createElement("div");
	const root = renderDailyTasksWidget(parent, model, options, {
		...handlers,
		onToggleTask,
	});
	return { root, onToggleTask };
}

describe("renderDailyTasksWidget", () => {
	it("scopes the root under the plugin and the note-widget container", () => {
		const { root } = render(emptyModel);
		expect(root.classList.contains("daytasks-plugin")).toBe(true);
		expect(root.classList.contains("daytasks-note-widget")).toBe(true);
	});

	it("renders the header, date, and empty state for an empty model", () => {
		const { root } = render(emptyModel);
		expect(root.querySelector(".daytasks-widget__title")?.textContent).toBe("DayTasks");
		expect(root.querySelector(".daytasks-widget__date")?.textContent).toContain(
			"2026-06-25"
		);
		expect(root.querySelector(".daytasks-widget__empty")).not.toBeNull();
		expect(root.querySelectorAll(".task-card")).toHaveLength(0);
	});

	it("renders cards with status color, contexts, and description", () => {
		const { root } = render(filledModel);
		const cards = root.querySelectorAll(".task-card");
		expect(cards).toHaveLength(2);

		const first = cards[0];
		expect(first.querySelector(".task-card__title-text")?.textContent).toBe("Buy milk");
		expect(first.querySelector(".task-card__id")?.textContent).toBe("TSK-8cA562sd");
		expect(first.querySelector(".task-card__context")?.textContent).toBe("@phone");
		expect(first.querySelector(".task-card__estimate")?.textContent).toBe("~1h30m");
		expect(first.querySelector(".task-card__due")?.textContent).toBe("due 2026-07-01");
		expect(first.querySelector(".task-card__description")?.textContent).toBe(
			"from the corner store"
		);

		const doneDot = cards[1].querySelector<HTMLElement>(".task-card__status-dot");
		expect(cards[1].classList.contains("task-card--completed")).toBe(true);
		expect(doneDot?.style.getPropertyValue("--daytasks-status-color")).toBe("#00aa00");
	});

	it("hides id, tags, contexts, and projects when disabled", () => {
		const { root } = render(filledModel, {
			showTaskIds: false,
			showTags: false,
			showContexts: false,
			showProjects: false,
		});
		const first = root.querySelectorAll(".task-card")[0];
		expect(first.querySelector(".task-card__id")).toBeNull();
		expect(first.querySelector(".tag")).toBeNull();
		expect(first.querySelector(".task-card__context")).toBeNull();
		expect(first.querySelector(".task-card__project")).toBeNull();
	});

	it("calls onSelectTag and onOpenProject from clickable metadata", () => {
		const onSelectTag = vi.fn();
		const onOpenProject = vi.fn();
		const { root } = render(filledModel, allOn, { onSelectTag, onOpenProject });
		const first = root.querySelectorAll(".task-card")[0];

		first.querySelector<HTMLElement>(".tag")?.dispatchEvent(
			new Event("click", { bubbles: true })
		);
		first.querySelector<HTMLElement>(".task-card__project")?.dispatchEvent(
			new Event("click", { bubbles: true })
		);

		expect(onSelectTag).toHaveBeenCalledWith("errand");
		expect(onOpenProject).toHaveBeenCalledWith("Projects/Home.md");
	});

	it("opens edit on card click but cycles (not edits) on status-dot click", () => {
		const onEditTask = vi.fn();
		const onToggleTask = vi.fn();
		const { root } = render(filledModel, allOn, { onEditTask, onToggleTask });
		const first = root.querySelectorAll(".task-card")[0];

		first.querySelector<HTMLElement>(".task-card__status-dot")?.dispatchEvent(
			new Event("click", { bubbles: true })
		);
		expect(onToggleTask).toHaveBeenCalledWith("TSK-8cA562sd");
		expect(onEditTask).not.toHaveBeenCalled();

		(first as HTMLElement).dispatchEvent(new Event("click", { bubbles: true }));
		expect(onEditTask).toHaveBeenCalledWith("TSK-8cA562sd");
	});

	it("renders an add button only when onAddTask is provided", () => {
		const onAddTask = vi.fn();
		const { root } = render(emptyModel, allOn, { onAddTask });
		const addButton = root.querySelector<HTMLElement>(".daytasks-widget__add");
		expect(addButton).not.toBeNull();
		addButton?.dispatchEvent(new Event("click"));
		expect(onAddTask).toHaveBeenCalledOnce();

		const { root: noAdd } = render(emptyModel);
		expect(noAdd.querySelector(".daytasks-widget__add")).toBeNull();
	});
});
