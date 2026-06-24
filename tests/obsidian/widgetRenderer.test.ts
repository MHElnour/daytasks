// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import {
	renderDailyTasksWidget,
	type WidgetRenderOptions,
} from "../../src/obsidian/widgetRenderer";
import type { DailyTasksWidgetModel } from "../../src/ui/todayView";

const allOn: WidgetRenderOptions = {
	showTaskIds: true,
	showTags: true,
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
			tags: ["errand", "home"],
			projects: [{ path: "Projects/Home.md", label: "Home" }],
		},
		{
			id: "TSK-GJM4c42e",
			title: "Send proposal",
			checked: true,
			status: "done",
			tags: [],
			projects: [],
		},
	],
};

function render(
	model: DailyTasksWidgetModel,
	options: WidgetRenderOptions = allOn,
	onToggleTask = vi.fn()
): { root: HTMLElement; onToggleTask: ReturnType<typeof vi.fn> } {
	const parent = document.createElement("div");
	const root = renderDailyTasksWidget(parent, model, options, { onToggleTask });
	return { root, onToggleTask };
}

describe("renderDailyTasksWidget", () => {
	it("scopes the root under the plugin and the TaskNotes note-widget container", () => {
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

	it("renders one task card per task with the BEM structure", () => {
		const { root } = render(filledModel);

		const cards = root.querySelectorAll(".task-card");
		expect(cards).toHaveLength(2);
		expect(cards[0].querySelector(".task-card__title-text")?.textContent).toBe(
			"Buy milk"
		);
		expect(cards[0].querySelector(".task-card__status-dot")).not.toBeNull();
		expect(cards[0].closest(".daytasks-note-widget__card")).not.toBeNull();
		expect(root.querySelector(".daytasks-widget__empty")).toBeNull();
	});

	it("marks the completed card and its status dot", () => {
		const { root } = render(filledModel);
		const cards = root.querySelectorAll(".task-card");

		expect(cards[0].classList.contains("task-card--completed")).toBe(false);
		expect(cards[1].classList.contains("task-card--completed")).toBe(true);

		const dot = cards[1].querySelector(".task-card__status-dot");
		expect(dot?.getAttribute("aria-checked")).toBe("true");
	});

	it("renders the id, tags, and projects when enabled", () => {
		const { root } = render(filledModel);
		const firstCard = root.querySelectorAll(".task-card")[0];

		expect(firstCard.querySelector(".task-card__id")?.textContent).toBe("TSK-8cA562sd");
		const tags = firstCard.querySelectorAll(".task-card__metadata-property--tags .tag");
		expect([...tags].map((t) => t.textContent)).toEqual(["errand", "home"]);
		expect(firstCard.querySelector(".task-card__project")?.textContent).toContain(
			"Home"
		);
	});

	it("hides id, tags, and projects when disabled", () => {
		const { root } = render(filledModel, {
			showTaskIds: false,
			showTags: false,
			showProjects: false,
		});
		const firstCard = root.querySelectorAll(".task-card")[0];

		expect(firstCard.querySelector(".task-card__id")).toBeNull();
		expect(firstCard.querySelector(".tag")).toBeNull();
		expect(firstCard.querySelector(".task-card__project")).toBeNull();
	});

	it("calls onToggleTask when the status dot is clicked", () => {
		const { root, onToggleTask } = render(filledModel);
		const dot = root
			.querySelectorAll(".task-card")[0]
			.querySelector<HTMLElement>(".task-card__status-dot");

		dot?.dispatchEvent(new Event("click"));

		expect(onToggleTask).toHaveBeenCalledWith("TSK-8cA562sd");
	});
});
