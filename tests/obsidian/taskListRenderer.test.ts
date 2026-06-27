import { describe, expect, it, vi } from "vitest";
import { renderTaskListView, type TaskListFacets, type TaskListHandlers } from "../../src/obsidian/taskListRenderer";
import type { TaskListModel } from "../../src/ui/taskListModel";
import { DEFAULT_TASK_LIST_STATE } from "../../src/core/taskListState";
import type { WidgetRenderOptions } from "../../src/obsidian/widgetRenderer";

const options: WidgetRenderOptions = { showTaskIds: true, showTags: true, showContexts: true, showProjects: true };
const facets: TaskListFacets = { statuses: [{ value: "open", label: "Open" }], tags: ["x"], contexts: [], projects: [] };

function card(id: string) {
	return {
		id, title: id, checked: false, status: "open", statusLabel: "Open", statusColor: "#888", statusIcon: "circle",
		scheduledLabel: "Jun 27", createdLabel: "Jun 27", overdue: false, tags: [], contexts: [], projects: [],
		children: [], expanded: false, collapsed: true, blockedBy: [], blocking: [], blocked: false,
	};
}

const noopHandlers: TaskListHandlers = {
	onSetStatuses: vi.fn(), onSetDatePreset: vi.fn(), onSetTags: vi.fn(), onSetContexts: vi.fn(),
	onSetProjects: vi.fn(), onSetSearch: vi.fn(), onSetGroupBy: vi.fn(), onSetSort: vi.fn(),
	onClear: vi.fn(), onToggleGroup: vi.fn(),
};

function render(model: TaskListModel, lh: Partial<TaskListHandlers> = {}) {
	const parent = document.createElement("div");
	renderTaskListView(parent, model, facets, options, { onCycleStatus: vi.fn() }, { ...noopHandlers, ...lh });
	return parent;
}

describe("renderTaskListView", () => {
	const model: TaskListModel = {
		groups: [{ key: "open", label: "Open", count: 1, collapsed: false, cards: [card("TSK-a") as any] }],
		total: 1, empty: false, state: DEFAULT_TASK_LIST_STATE,
	};

	it("renders a filter bar, a group header with count, and a card per task", () => {
		const root = render(model);
		expect(root.querySelector(".daytasks-tasklist__filterbar")).not.toBeNull();
		const head = root.querySelector(".daytasks-tasklist__group-head")!;
		expect(head.textContent).toContain("Open");
		expect(head.textContent).toContain("1");
		expect(root.querySelectorAll(".task-card").length).toBe(1);
	});

	it("group chevron calls onToggleGroup with the key", () => {
		const onToggleGroup = vi.fn();
		const root = render(model, { onToggleGroup });
		(root.querySelector(".daytasks-tasklist__group-toggle") as HTMLElement).click();
		expect(onToggleGroup).toHaveBeenCalledWith("open");
	});

	it("renders an empty state when model.empty", () => {
		const root = render({ ...model, groups: [], total: 0, empty: true });
		expect(root.querySelector(".daytasks-tasklist__empty")).not.toBeNull();
		expect(root.querySelectorAll(".task-card").length).toBe(0);
	});

	it("typing in search calls onSetSearch", () => {
		const onSetSearch = vi.fn();
		const root = render(model, { onSetSearch });
		const input = root.querySelector(".daytasks-tasklist__search") as HTMLInputElement;
		input.value = "milk";
		input.dispatchEvent(new Event("input"));
		expect(onSetSearch).toHaveBeenCalledWith("milk");
	});

	it("clicking an unselected status chip adds it to the selection", () => {
		const onSetStatuses = vi.fn();
		const root = render({ ...model, state: { ...DEFAULT_TASK_LIST_STATE, statuses: [] } }, { onSetStatuses });
		const chip = root.querySelector(".daytasks-tasklist__statuses .daytasks-tasklist__facet-chip") as HTMLElement;
		chip.click();
		expect(onSetStatuses).toHaveBeenCalledWith(["open"]);
	});

	it("clicking a selected status chip removes it from the selection", () => {
		const onSetStatuses = vi.fn();
		const root = render({ ...model, state: { ...DEFAULT_TASK_LIST_STATE, statuses: ["open"] } }, { onSetStatuses });
		const chip = root.querySelector(".daytasks-tasklist__statuses .daytasks-tasklist__facet-chip") as HTMLElement;
		chip.click();
		expect(onSetStatuses).toHaveBeenCalledWith([]);
	});
});
