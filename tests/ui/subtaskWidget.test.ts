import { describe, expect, it } from "vitest";
import { DEFAULT_PRIORITIES, DEFAULT_STATUSES } from "../../src/core/status";
import { StatusManager } from "../../src/core/statusManager";
import type { DayTask } from "../../src/core/task";
import { createSubtaskWidgetModel } from "../../src/ui/subtaskWidget";

const statusManager = new StatusManager(DEFAULT_STATUSES, "open");
const priorities = DEFAULT_PRIORITIES;

// The completed status value confirmed from DEFAULT_STATUSES where isCompleted === true.
const DONE_STATUS = DEFAULT_STATUSES.find((s) => statusManager.isCompletedStatus(s.value))!.value; // "done"

const makeTask = (overrides: Partial<DayTask> & { id: string }): DayTask => ({
	id: overrides.id,
	title: "Task " + overrides.id,
	status: "open",
	scheduledDate: "2026-06-27",
	tags: [],
	contexts: [],
	projects: [],
	timeEntries: [],
	createdAt: "2026-06-27T08:00:00.000Z",
	updatedAt: "2026-06-27T08:00:00.000Z",
	...overrides,
});

describe("createSubtaskWidgetModel", () => {
	it("returns cards for parent's direct children with title 'Subtasks' and correct doneCount", () => {
		const parent = makeTask({ id: "TSK-parent01" });
		const childA = makeTask({ id: "TSK-childA01", parentId: "TSK-parent01" });
		const childB = makeTask({ id: "TSK-childB01", parentId: "TSK-parent01", status: DONE_STATUS });

		const getChildren = (id: string): DayTask[] => (id === parent.id ? [childA, childB] : []);

		const model = createSubtaskWidgetModel(
			parent,
			statusManager,
			"2026-06-27",
			priorities,
			getChildren,
			new Set(),
			new Set(),
			() => undefined,
			() => []
		);

		expect(model.cards.length).toBe(2);
		expect(model.title).toBe("Subtasks");
		expect(model.doneCount).toBe(1);
	});

	it("respects deeper nesting: grandchild appears under childA's children via getChildren BFS", () => {
		const parent = makeTask({ id: "TSK-parent01" });
		const childA = makeTask({ id: "TSK-childA01", parentId: "TSK-parent01" });
		const grandchild = makeTask({ id: "TSK-grand0001", parentId: "TSK-childA01" });

		// getChildren returns direct children only; createSubtaskWidgetModel does BFS to collect all descendants
		const getChildren = (id: string): DayTask[] => {
			if (id === parent.id) return [childA];
			if (id === childA.id) return [grandchild];
			return [];
		};

		const model = createSubtaskWidgetModel(
			parent,
			statusManager,
			"2026-06-27",
			priorities,
			getChildren,
			new Set([childA.id]), // childA expanded so grandchild is nested in the card tree
			new Set(),
			(id: string) => {
				const all = [parent, childA, grandchild];
				return all.find((t) => t.id === id);
			},
			() => []
		);

		// childA is the only root card; grandchild is nested under it via buildTaskForest
		expect(model.cards.length).toBe(1);
		expect(model.cards[0].id).toBe(childA.id);
		expect(model.cards[0].children.map((c) => c.id)).toContain(grandchild.id);
	});

	it("returns empty cards and title 'Subtasks' when parent has no children", () => {
		const parent = makeTask({ id: "TSK-parent01" });

		const model = createSubtaskWidgetModel(
			parent,
			statusManager,
			"2026-06-27",
			priorities,
			() => [],
			new Set(),
			new Set(),
			() => undefined,
			() => []
		);

		expect(model.cards.length).toBe(0);
		expect(model.title).toBe("Subtasks");
	});

	it("terminates and produces no duplicate cards on a cyclic getChildren graph", () => {
		const parent = makeTask({ id: "TSK-parent01" });
		const childA = makeTask({ id: "TSK-childA01", parentId: "TSK-parent01" });
		const grandchild = makeTask({ id: "TSK-grand0001", parentId: "TSK-childA01" });

		// Cyclic graph: parent → childA → grandchild → childA → ...
		const getChildren = (id: string): DayTask[] => {
			if (id === parent.id) return [childA];
			if (id === childA.id) return [grandchild];
			if (id === grandchild.id) return [childA];
			return [];
		};

		// (a) Must terminate (no infinite loop / timeout).
		const model = createSubtaskWidgetModel(
			parent,
			statusManager,
			"2026-06-27",
			priorities,
			getChildren,
			new Set([childA.id, grandchild.id]),
			new Set(),
			(id: string) => [parent, childA, grandchild].find((t) => t.id === id),
			() => []
		);

		// (b) No duplicate card ids across the whole forest (roots + nested children).
		const ids: string[] = [];
		const collect = (card: { id: string; children: { id: string; children: unknown[] }[] }): void => {
			ids.push(card.id);
			card.children.forEach((c) => collect(c as typeof card));
		};
		model.cards.forEach((c) => collect(c));

		expect(new Set(ids).size).toBe(ids.length);
	});
});
