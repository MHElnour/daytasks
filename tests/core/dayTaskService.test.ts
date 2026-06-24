import { describe, expect, it } from "vitest";
import { DayTaskService } from "../../src/core/dayTaskService";
import { MemoryTaskIndex } from "../../src/core/taskIndex";
import { MemoryTaskStore } from "../../src/core/taskStore";

describe("DayTaskService", () => {
	it("creates tasks in the store and index without mutating daily notes", async () => {
		const service = new DayTaskService({
			store: new MemoryTaskStore(),
			index: new MemoryTaskIndex(),
			now: () => "2026-06-24T08:00:00.000Z",
			id: () => "TSK-8cA562sd",
		});

		const task = await service.createTask({
			title: "Buy milk",
			scheduledDate: "2026-06-24",
			tags: ["errand"],
			projects: [{ path: "Projects/Home.md", title: "Home" }],
		});

		expect(task.id).toBe("TSK-8cA562sd");
		expect(await service.getTask("TSK-8cA562sd")).toEqual(task);
		expect(service.getTasksForDate("2026-06-24")).toEqual([task]);
		expect(service.getTasksForTag("errand")).toEqual([task]);
		expect(service.getTasksForProject("Projects/Home.md")).toEqual([task]);
	});

	it("toggles status and refreshes the index", async () => {
		const service = new DayTaskService({
			store: new MemoryTaskStore(),
			index: new MemoryTaskIndex(),
			now: () => "2026-06-24T08:00:00.000Z",
			id: () => "TSK-8cA562sd",
		});

		await service.createTask({ title: "Buy milk", scheduledDate: "2026-06-24" });
		const updated = await service.toggleStatus("TSK-8cA562sd");

		expect(updated.status).toBe("done");
		expect(service.getTasksForDate("2026-06-24")).toEqual([updated]);
	});
});
