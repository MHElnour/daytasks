import { describe, expect, it } from "vitest";
import { createTaskListModel } from "../../src/ui/taskListModel";
import { DEFAULT_TASK_LIST_STATE } from "../../src/core/taskListState";
import { StatusManager } from "../../src/core/statusManager";
import { DEFAULT_STATUSES, DEFAULT_PRIORITIES } from "../../src/core/status";
import type { DayTask } from "../../src/core/task";

const sm = new StatusManager(DEFAULT_STATUSES, "open");
function task(over: Partial<DayTask> & { id: string }): DayTask {
	return {
		title: over.id, status: "open", scheduledDate: "2026-06-27", tags: [], contexts: [], projects: [],
		timeEntries: [], createdAt: "2026-06-27T00:00:00.000Z", updatedAt: "2026-06-27T00:00:00.000Z", ...over,
	};
}

describe("createTaskListModel", () => {
	it("builds grouped flat cards, collapsed by default, with counts", () => {
		const tasks = [task({ id: "TSK-a" }), task({ id: "TSK-b", status: "done" })];
		const model = createTaskListModel(tasks, sm, "2026-06-27", DEFAULT_PRIORITIES, DEFAULT_TASK_LIST_STATE, new Set(), new Set());
		expect(model.total).toBe(2);
		expect(model.empty).toBe(false);
		expect(model.groups.map((g) => g.key)).toEqual(["open", "done"]);
		expect(model.groups[0].count).toBe(1);
		const card = model.groups[0].cards[0];
		expect(card.children).toEqual([]); // flat
		expect(card.collapsed).toBe(true); // collapsed by default
	});

	it("expands a card whose id is in expandedCardIds, collapses a group in collapsedGroupKeys", () => {
		const tasks = [task({ id: "TSK-a" })];
		const model = createTaskListModel(tasks, sm, "2026-06-27", DEFAULT_PRIORITIES, DEFAULT_TASK_LIST_STATE, new Set(["TSK-a"]), new Set(["open"]));
		expect(model.groups[0].cards[0].collapsed).toBe(false);
		expect(model.groups[0].collapsed).toBe(true);
	});

	it("empty is true when nothing matches", () => {
		const model = createTaskListModel([task({ id: "a" })], sm, "2026-06-27", DEFAULT_PRIORITIES,
			{ ...DEFAULT_TASK_LIST_STATE, search: "zzz" }, new Set(), new Set());
		expect(model.empty).toBe(true);
		expect(model.groups).toEqual([]);
	});
});
