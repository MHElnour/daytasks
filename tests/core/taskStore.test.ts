import { describe, expect, it } from "vitest";
import type { DayTask } from "../../src/core/task";
import { MemoryTaskStore } from "../../src/core/taskStore";

const task: DayTask = {
	id: "TSK-8cA562sd",
	title: "Buy milk",
	status: "open",
	scheduledDate: "2026-06-24",
	timeEntries: [],
	createdAt: "2026-06-24T08:00:00.000Z",
	updatedAt: "2026-06-24T08:00:00.000Z",
};

describe("MemoryTaskStore", () => {
	it("saves, reads, lists, and deletes tasks by id", async () => {
		const store = new MemoryTaskStore();

		await store.save(task);

		expect(await store.get(task.id)).toEqual(task);
		expect(await store.list()).toEqual([task]);

		await store.delete(task.id);
		expect(await store.get(task.id)).toBeNull();
		expect(await store.list()).toEqual([]);
	});
});
