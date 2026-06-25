import { describe, expect, it } from "vitest";
import type { DayTask } from "../../src/core/task";
import { computeChildProgress } from "../../src/core/subtasks";

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
