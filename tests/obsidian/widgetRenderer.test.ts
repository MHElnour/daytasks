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
			priority: "normal",
			priorityLabel: "Normal",
			priorityColor: "#e0a800",
			priorityIcon: "flag",
			estimateLabel: "1h30m",
			scheduledLabel: "Jun 25",
			dueDate: "2026-06-24",
			dueLabel: "Jun 24",
			overdue: true,
			tags: ["daytask", "errand"],
			contexts: ["phone"],
			projects: [{ path: "Projects/Home.md", label: "Home" }],
			description: "from the corner store",
			descriptionExpanded: false,
			children: [],
			expanded: false,
			blockedBy: [],
			blocking: [],
			blocked: false,
			collapsed: false,
			createdLabel: "Jun 25",
		},
		{
			id: "TSK-GJM4c42e",
			title: "Send proposal",
			checked: true,
			status: "done",
			statusLabel: "Done",
			statusColor: "#00aa00",
			statusIcon: "check-circle",
			scheduledLabel: "Jun 25",
			overdue: false,
			tags: [],
			contexts: [],
			projects: [],
			descriptionExpanded: false,
			children: [],
			expanded: false,
			blockedBy: [],
			blocking: [],
			blocked: false,
			collapsed: false,
			createdLabel: "Jun 25",
		},
	],
};

function render(
	model: DailyTasksWidgetModel,
	options: WidgetRenderOptions = allOn,
	handlers: Partial<WidgetRenderHandlers> = {}
) {
	const onCycleStatus = handlers.onCycleStatus ?? vi.fn();
	const parent = document.createElement("div");
	const root = renderDailyTasksWidget(parent, model, options, {
		...handlers,
		onCycleStatus,
	});
	return { root, onCycleStatus };
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
		expect(first.querySelector(".task-card__checkbox")).toBeNull();
		// Status is an icon-only control in the rail; the label shows on hover (title).
		const statusControl = first.querySelector<HTMLElement>(".task-card__rail-top .task-card__status");
		expect(statusControl?.querySelector("[data-icon]")?.getAttribute("data-icon")).toBe("circle");
		expect(statusControl?.getAttribute("title")).toBe("Open");
		expect(first.querySelector(".task-card__status-label")).toBeNull();
		expect(first.querySelector(".task-card__id")?.textContent).toBe("Task ID: TSK-8cA562sd");
		expect(first.querySelector(".task-card__description")?.textContent).toBe(
			"from the corner store"
		);
		// Meta grid — 4 cells: Priority, Due, Created, Estimate.
		const metaCells = first.querySelectorAll(".task-card__metadata-grid .task-card__meta-cell");
		// Due is the 2nd cell; value text and overdue class live on the cell.
		const dueCell = metaCells[1];
		expect(dueCell.querySelector(".task-card__meta-text")?.textContent).toBe("Jun 24");
		expect(
			dueCell.querySelector(".task-card__meta-icon")?.getAttribute("data-icon")
		).toBe("calendar-clock");
		expect(dueCell.classList.contains("is-overdue")).toBe(true);
		// Scheduled is intentionally absent from the grid (dropped in redesign).
		expect(first.querySelector(".task-card__scheduled")).toBeNull();
		// Estimate is the 4th cell.
		const estimateCell = metaCells[3];
		expect(estimateCell.querySelector(".task-card__meta-text")?.textContent).toBe("1h30m");
		// Priority is a quick-change control in the title row, not a meta chip.
		expect(first.querySelector(".task-card__metadata .task-card__priority")).toBeNull();
		const priorityControl = first.querySelector<HTMLElement>(".task-card__priority-control");
		expect(priorityControl?.getAttribute("aria-label")).toContain("Normal");
		expect(priorityControl?.querySelector("[data-icon]")?.getAttribute("data-icon")).toBe("flag");
		// project + context are plain meta text; tags are boxes on their own row
		expect(first.querySelector(".task-card__project")?.textContent).toBe("↗ Home");
		expect(first.querySelector(".task-card__context")?.textContent).toBe("@phone");
		expect(
			[...first.querySelectorAll(".task-card__tag")].map((chip) => chip.textContent)
		).toEqual(["#daytask", "#errand"]);
		expect(first.querySelector(".task-card__handle")).not.toBeNull();
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
		expect(first.querySelector(".task-card__tag")).toBeNull();
		expect(first.querySelector(".task-card__project")).toBeNull();
		expect(first.querySelector(".task-card__context")).toBeNull();
	});

	it("status pill cycles status; card click edits; pill does not trigger edit", () => {
		const onCycleStatus = vi.fn();
		const onEditTask = vi.fn();
		const { root } = render(filledModel, allOn, { onCycleStatus, onEditTask });
		const first = root.querySelectorAll(".task-card")[0];

		first.querySelector<HTMLElement>(".task-card__status")?.dispatchEvent(
			new Event("click", { bubbles: true })
		);
		expect(onCycleStatus).toHaveBeenCalledWith("TSK-8cA562sd");
		expect(onEditTask).not.toHaveBeenCalled();

		(first as HTMLElement).dispatchEvent(new Event("click", { bubbles: true }));
		expect(onEditTask).toHaveBeenCalledWith("TSK-8cA562sd");
	});

	it("priority control cycles priority without triggering the card edit", () => {
		const onCyclePriority = vi.fn();
		const onEditTask = vi.fn();
		const { root } = render(filledModel, allOn, { onCyclePriority, onEditTask });
		const first = root.querySelectorAll(".task-card")[0];

		first.querySelector<HTMLElement>(".task-card__priority-control")?.dispatchEvent(
			new Event("click", { bubbles: true })
		);
		expect(onCyclePriority).toHaveBeenCalledWith("TSK-8cA562sd");
		expect(onEditTask).not.toHaveBeenCalled();
	});

	it("tag boxes call onSelectTag and project text calls onOpenProject", () => {
		const onSelectTag = vi.fn();
		const onOpenProject = vi.fn();
		const { root } = render(filledModel, allOn, { onSelectTag, onOpenProject });
		const first = root.querySelectorAll(".task-card")[0];

		first.querySelector<HTMLElement>(".task-card__tag")?.dispatchEvent(
			new Event("click", { bubbles: true })
		);
		first
			.querySelector<HTMLElement>(".task-card__project")
			?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(onSelectTag).toHaveBeenCalledWith("daytask");
		expect(onOpenProject).toHaveBeenCalledWith("Projects/Home.md");
	});

	it("makes tag and project chips keyboard-operable", () => {
		const onSelectTag = vi.fn();
		const onOpenProject = vi.fn();
		const { root } = render(filledModel, allOn, { onSelectTag, onOpenProject });
		const first = root.querySelectorAll(".task-card")[0];

		const tag = first.querySelector<HTMLElement>(".task-card__tag");
		const project = first.querySelector<HTMLElement>(".task-card__project");

		expect(tag?.getAttribute("role")).toBe("button");
		expect(tag?.tabIndex).toBe(0);
		expect(project?.getAttribute("role")).toBe("button");
		expect(project?.tabIndex).toBe(0);

		tag?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(onSelectTag).toHaveBeenCalledWith("daytask");

		project?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
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

function leafCard(over: Partial<DailyTasksWidgetModel["cards"][number]> = {}): DailyTasksWidgetModel["cards"][number] {
	return {
		id: "TSK-leaf00001",
		title: "Leaf",
		checked: false,
		status: "open",
		statusLabel: "Open",
		statusColor: "#808080",
		statusIcon: "circle",
		scheduledLabel: "Jun 25",
		overdue: false,
		tags: [],
		contexts: [],
		projects: [],
		descriptionExpanded: false,
		children: [],
		expanded: false,
		blockedBy: [],
		blocking: [],
		blocked: false,
		collapsed: false,
		createdLabel: "Jun 25",
		...over,
	};
}

function modelWith(cards: DailyTasksWidgetModel["cards"]): DailyTasksWidgetModel {
	return { ...filledModel, cards, totalCount: cards.length, empty: cards.length === 0 };
}

describe("renderDailyTasksWidget subtasks", () => {
	it("renders a progress bar and collapsed subtasks for a parent", () => {
		const child = leafCard({ id: "TSK-child0001", title: "Child" });
		const parent = leafCard({
			id: "TSK-parent01",
			title: "Parent",
			children: [child],
			childProgress: { done: 1, total: 2 },
			expanded: false,
		});
		const onToggleSubtasks = vi.fn();
		const { root } = render(modelWith([parent]), allOn, { onToggleSubtasks });

		const top = root.querySelector<HTMLElement>(".daytasks-cards > .daytasks-note-widget__card");
		expect(top?.querySelector(".task-card__progress-label")?.textContent).toBe("1/2");
		const bar = top?.querySelector<HTMLProgressElement>("progress.task-card__progress");
		expect(bar?.max).toBe(2);
		expect(bar?.value).toBe(1);

		const disclosure = top?.querySelector<HTMLElement>(".task-card__disclosure");
		expect(disclosure?.getAttribute("aria-expanded")).toBe("false");
		// Chevron lives in the bottom of the right rail, not in the title row.
		expect(top?.querySelector(".task-card__subtask-footer .task-card__disclosure")).not.toBeNull();
		expect(top?.querySelector(".task-card__title-row .task-card__disclosure")).toBeNull();
		// Progress bar sits in the bottom of the rail too.
		expect(top?.querySelector(".task-card__subtask-footer .task-card__progress")).not.toBeNull();
		// A parent (has subtasks) gets a class so its title can shrink to wrap less.
		expect(top?.querySelector(".task-card")?.classList.contains("task-card--parent")).toBe(true);

		const sublist = top?.querySelector<HTMLElement>("ul.task-card__subtasks");
		expect(sublist?.hasAttribute("hidden")).toBe(true);
		expect(sublist?.querySelector(".task-card__title-text")?.textContent).toBe("Child");

		disclosure?.dispatchEvent(new Event("click", { bubbles: true }));
		expect(onToggleSubtasks).toHaveBeenCalledWith("TSK-parent01");
	});

	it("shows expanded subtasks without the hidden attribute", () => {
		const child = leafCard({ id: "TSK-child0001", title: "Child" });
		const parent = leafCard({
			id: "TSK-parent01",
			children: [child],
			childProgress: { done: 0, total: 1 },
			expanded: true,
		});
		const { root } = render(modelWith([parent]));
		const top = root.querySelector<HTMLElement>(".daytasks-cards > .daytasks-note-widget__card");
		expect(top?.querySelector(".task-card__disclosure")?.getAttribute("aria-expanded")).toBe("true");
		expect(top?.querySelector("ul.task-card__subtasks")?.hasAttribute("hidden")).toBe(false);
	});

	it("renders no disclosure or progress bar for a leaf", () => {
		const { root } = render(modelWith([leafCard()]));
		const top = root.querySelector(".daytasks-cards > .daytasks-note-widget__card");
		expect(top?.querySelector(".task-card__disclosure")).toBeNull();
		expect(top?.querySelector(".task-card__subtask-footer")).toBeNull();
		expect(top?.querySelector(".task-card")?.classList.contains("task-card--parent")).toBe(false);
		expect(top?.querySelector("progress.task-card__progress")).toBeNull();
		expect(top?.querySelector("ul.task-card__subtasks")).toBeNull();
	});

	it("caps a long card title at 100 characters", () => {
		const { root } = render(modelWith([leafCard({ title: "z".repeat(150) })]));
		const text = root.querySelector(".task-card__title-text")?.textContent ?? "";
		expect(text).toHaveLength(100);
		expect(text.endsWith("…")).toBe(true);
	});
});

describe("renderDailyTasksWidget metadata grid", () => {
	it("renders a 4-column metadata grid including Created", () => {
		const { root } = render(filledModel);
		const grid = root.querySelector(".task-card__metadata-grid")!;
		const labels = [...grid.querySelectorAll(".task-card__meta-label")].map((n) => n.textContent);
		expect(labels).toEqual(["Priority", "Due", "Created", "Estimate"]);
		const created = grid.querySelectorAll(".task-card__meta-cell")[2];
		expect(created.querySelector(".task-card__meta-value")?.textContent).toBe("Jun 25");
	});
});

describe("renderDailyTasksWidget collapsed cards", () => {
	it("renders a collapsed card as a slim row with id and due, no metadata grid", () => {
		const model = { ...filledModel, cards: [{ ...filledModel.cards[0], collapsed: true }] };
		const { root } = render(model);
		const card = root.querySelector(".task-card")!;
		expect(card.classList.contains("task-card--collapsed")).toBe(true);
		expect(card.querySelector(".task-card__metadata-grid")).toBeNull();
		expect(card.querySelector(".task-card__collapsed-id")?.textContent).toContain("TSK-8cA562sd");
	});

	it("chevron toggles collapse via handler", () => {
		const onToggleCollapsed = vi.fn();
		const { root } = render(filledModel, allOn, { onToggleCollapsed });
		(root.querySelector(".task-card__collapse") as HTMLElement).click();
		expect(onToggleCollapsed).toHaveBeenCalledWith("TSK-8cA562sd");
	});
});

describe("renderDailyTasksWidget relations", () => {
	it("renders a blocked-by box with clickable chips", () => {
		const ref = { id: "TSK-blocker01", title: "Blocker", scheduledDate: "2026-06-25", completed: false };
		const parent = leafCard({ id: "TSK-aaaaaaaa", blockedBy: [ref], blocked: true });
		const onOpenTask = vi.fn();
		const { root } = render(modelWith([parent]), allOn, { onOpenTask });
		const top = root.querySelector<HTMLElement>(".daytasks-cards > .daytasks-note-widget__card");
		const box = top?.querySelector(".task-card__blocked-by");
		expect(box).not.toBeNull();
		const chip = box?.querySelector<HTMLElement>(".task-card__rel-chip");
		expect(chip?.textContent?.trim()).toBe("TSK-blocker01");
		chip?.dispatchEvent(new Event("click", { bubbles: true }));
		expect(onOpenTask).toHaveBeenCalledWith("TSK-blocker01");
		expect(top?.querySelector(".task-card")?.classList.contains("task-card--blocked")).toBe(true);
	});

	it("renders no relation boxes when empty", () => {
		const { root } = render(modelWith([leafCard()]));
		const top = root.querySelector(".daytasks-cards > .daytasks-note-widget__card");
		expect(top?.querySelector(".task-card__blocked-by")).toBeNull();
		expect(top?.querySelector(".task-card__blocking")).toBeNull();
	});
});

const longDesc = "x".repeat(200);

describe("renderDailyTasksWidget description toggle", () => {
	it("truncates long descriptions with a Read more toggle", () => {
		const model = { ...filledModel, cards: [{ ...filledModel.cards[0], description: longDesc, descriptionExpanded: false }] };
		const onToggleDescription = vi.fn();
		const { root } = render(model, allOn, { onToggleDescription });
		const desc = root.querySelector(".task-card__description")!;
		expect(desc.textContent!.length).toBeLessThan(longDesc.length);
		(root.querySelector(".task-card__read-more") as HTMLElement).click();
		expect(onToggleDescription).toHaveBeenCalledWith("TSK-8cA562sd");
	});

	it("shows full description with a Read less toggle when expanded", () => {
		const model = { ...filledModel, cards: [{ ...filledModel.cards[0], description: longDesc, descriptionExpanded: true }] };
		const { root } = render(model);
		expect(root.querySelector(".task-card__description")!.textContent).toBe(longDesc);
		const toggle = root.querySelector(".task-card__read-more");
		expect(toggle).not.toBeNull();
		expect(toggle!.textContent).toBe("Read less");
	});
});

describe("renderDailyTasksWidget chip rows", () => {
	it("renders labeled Projects/Contexts/Tags rows", () => {
		const { root } = render(filledModel);
		const labels = [...root.querySelectorAll(".task-card__chip-row-label")].map((n) => n.textContent);
		expect(labels).toEqual(["Projects", "Contexts", "Tags"]);
		const tagsRow = [...root.querySelectorAll(".task-card__chip-row")]
			.find((r) => r.querySelector(".task-card__chip-row-label")?.textContent === "Tags")!;
		expect(tagsRow.querySelectorAll(".task-card__tag").length).toBe(2);
	});

	it("omits a chip row when its list is empty", () => {
		const model = { ...filledModel, cards: [{ ...filledModel.cards[1], collapsed: false }] };
		const { root } = render(model);
		expect(root.querySelector(".task-card__chip-row")).toBeNull();
	});
});
