import { describe, expect, it } from "vitest";
import type { DayTask } from "../../src/core/task";
import { computeChildProgress, isDescendant, buildTaskForest } from "../../src/core/subtasks";

function task(over: Partial<DayTask> & { id: string }): DayTask {
	return {
		title: over.id,
		status: "open",
		scheduledDate: "2026-06-27",
		tags: [],
		contexts: [],
		projects: [],
		timeEntries: [],
		createdAt: "2026-06-27T00:00:00.000Z",
		updatedAt: "2026-06-27T00:00:00.000Z",
		...over,
	};
}

const notDone = (s: string) => s === "done";

const base: DayTask = {
	id: "TSK-00000000",
	title: "T",
	status: "open",
	scheduledDate: "2026-06-25",
	tags: [],
	contexts: [],
	projects: [],
	timeEntries: [],
	createdAt: "2026-06-25T08:00:00.000Z",
	updatedAt: "2026-06-25T08:00:00.000Z",
};
const child = (id: string, status: string): DayTask => ({ ...base, id, status });
const isCompleted = (status: string): boolean => status === "done";

describe("computeChildProgress", () => {
	it("counts completed children against the total", () => {
		const children = [child("a", "done"), child("b", "open"), child("c", "done")];
		expect(computeChildProgress(children, isCompleted)).toEqual({ done: 2, total: 3 });
	});

	it("returns zeroes for no children", () => {
		expect(computeChildProgress([], isCompleted)).toEqual({ done: 0, total: 0 });
	});
});

describe("isDescendant", () => {
	// a -> b -> c  (parentOf returns the PARENT of a node)
	const parents: Record<string, string | undefined> = { c: "b", b: "a", a: undefined };
	const parentOf = (id: string): string | undefined => parents[id];

	it("is true for the node itself", () => {
		expect(isDescendant("a", "a", parentOf)).toBe(true);
	});

	it("is true for a direct and transitive descendant", () => {
		expect(isDescendant("b", "a", parentOf)).toBe(true);
		expect(isDescendant("c", "a", parentOf)).toBe(true);
	});

	it("is false for an unrelated or upward node", () => {
		expect(isDescendant("a", "c", parentOf)).toBe(false);
		expect(isDescendant("x", "a", parentOf)).toBe(false);
	});

	it("terminates on a cyclic chain", () => {
		const cyclic = (id: string): string | undefined => (id === "p" ? "q" : "p");
		expect(isDescendant("p", "z", cyclic)).toBe(false);
	});
});

describe("buildTaskForest", () => {
	const t = (id: string, status: string, parentId?: string): DayTask => ({
		...base,
		id,
		status,
		...(parentId ? { parentId } : {}),
	});

	it("nests children under a parent in the set", () => {
		const forest = buildTaskForest(
			[t("p", "open"), t("c1", "open", "p"), t("c2", "open", "p")],
			isCompleted
		);
		expect(forest.map((n) => n.task.id)).toEqual(["p"]);
		expect(forest[0].children.map((n) => n.task.id)).toEqual(["c1", "c2"]);
	});

	it("treats a child whose parent is absent as a root", () => {
		const forest = buildTaskForest([t("c", "open", "missing")], isCompleted);
		expect(forest.map((n) => n.task.id)).toEqual(["c"]);
	});

	it("preserves insertion order when siblings have no sortOrder or createdAt difference", () => {
		const forest = buildTaskForest(
			[t("p", "open"), t("done1", "done", "p"), t("open1", "open", "p")],
			isCompleted
		);
		expect(forest[0].children.map((n) => n.task.id)).toEqual(["done1", "open1"]);
	});

	it("renders every task exactly once for a cyclic parent chain", () => {
		const forest = buildTaskForest([t("a", "open", "b"), t("b", "open", "a")], isCompleted);
		const seen: string[] = [];
		const walk = (n: { task: DayTask; children: unknown[] }): void => {
			seen.push(n.task.id);
			(n.children as { task: DayTask; children: unknown[] }[]).forEach(walk);
		};
		forest.forEach(walk);
		expect([...seen].sort()).toEqual(["a", "b"]);
	});
});

describe("buildTaskForest ordering", () => {
	it("orders roots by sortOrder, not completion", () => {
		const tasks = [
			task({ id: "b", sortOrder: "000020", status: "done" }),
			task({ id: "a", sortOrder: "000010" }),
		];
		const forest = buildTaskForest(tasks, notDone);
		expect(forest.map((n) => n.task.id)).toEqual(["a", "b"]);
	});

	it("tasks without sortOrder sort after, by createdAt", () => {
		const tasks = [
			task({ id: "new2", createdAt: "2026-06-27T02:00:00.000Z" }),
			task({ id: "ordered", sortOrder: "000010" }),
			task({ id: "new1", createdAt: "2026-06-27T01:00:00.000Z" }),
		];
		const forest = buildTaskForest(tasks, notDone);
		expect(forest.map((n) => n.task.id)).toEqual(["ordered", "new1", "new2"]);
	});

	it("orders children by sortOrder", () => {
		const tasks = [
			task({ id: "p" }),
			task({ id: "c2", parentId: "p", sortOrder: "000020", status: "done" }),
			task({ id: "c1", parentId: "p", sortOrder: "000010" }),
		];
		const forest = buildTaskForest(tasks, notDone);
		expect(forest[0].children.map((n) => n.task.id)).toEqual(["c1", "c2"]);
	});
});
