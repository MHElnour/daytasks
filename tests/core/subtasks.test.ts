import { describe, expect, it } from "vitest";
import type { DayTask } from "../../src/core/task";
import { computeChildProgress, isDescendant } from "../../src/core/subtasks";

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
