import { describe, expect, it } from "vitest";
import type { UpdateDayTaskInput } from "../../src/core/task";
import { DayTaskService } from "../../src/core/dayTaskService";
import { DEFAULT_STATUSES } from "../../src/core/status";
import { StatusManager } from "../../src/core/statusManager";
import { MemoryTaskIndex } from "../../src/core/taskIndex";
import { MemoryTaskStore } from "../../src/core/taskStore";

const statusManager = new StatusManager(DEFAULT_STATUSES, "open");

function makeService(
	settings: Partial<{
		defaultStatus: string;
		defaultPriority?: string;
		defaultTags: string[];
		defaultProjectPath: string;
	}> = {}
) {
	return new DayTaskService({
		store: new MemoryTaskStore(),
		index: new MemoryTaskIndex(),
		statusManager,
		settings: {
			defaultStatus: "open",
			defaultPriority: "normal",
			defaultTags: [],
			defaultProjectPath: "",
			...settings,
		},
		now: () => "2026-06-25T08:00:00.000Z",
		id: () => "TSK-8cA562sd",
	});
}

/** Builds a full UpdateDayTaskInput, defaulting unspecified fields to cleared. */
function update(
	overrides: Partial<UpdateDayTaskInput> &
		Pick<UpdateDayTaskInput, "title" | "scheduledDate">
): UpdateDayTaskInput {
	return {
		status: undefined,
		dueDate: undefined,
		priority: undefined,
		tags: undefined,
		contexts: undefined,
		projects: undefined,
		estimateMinutes: undefined,
		description: undefined,
		...overrides,
	};
}

describe("DayTaskService", () => {
	it("creates tasks in the store and index", async () => {
		const service = makeService();

		const task = await service.createTask({
			title: "Buy milk",
			scheduledDate: "2026-06-25",
			tags: ["errand"],
			contexts: ["home"],
			projects: [{ path: "Projects/Home.md", title: "Home" }],
		});

		expect(task.id).toBe("TSK-8cA562sd");
		expect(await service.getTask("TSK-8cA562sd")).toEqual(task);
		expect(service.getTasksForDate("2026-06-25")).toEqual([task]);
		expect(service.getTasksForTag("errand")).toEqual([task]);
		expect(service.getTasksForContext("home")).toEqual([task]);
		expect(service.getTasksForProject("Projects/Home.md")).toEqual([task]);
	});

	it("merges default tags and project from settings", async () => {
		const service = makeService({
			defaultTags: ["work"],
			defaultProjectPath: "Projects/Home.md",
		});

		const task = await service.createTask({
			title: "Task",
			scheduledDate: "2026-06-25",
		});

		expect(task.tags).toEqual(["daytask", "work"]);
		expect(service.getTasksForProject("Projects/Home.md")).toEqual([task]);
	});

	it("sets completedAt when status becomes completed and clears it on revert", async () => {
		const service = makeService();
		await service.createTask({ title: "Buy milk", scheduledDate: "2026-06-25" });

		const done = await service.setStatus("TSK-8cA562sd", "done");
		expect(done.status).toBe("done");
		expect(done.completedAt).toBe("2026-06-25T08:00:00.000Z");

		const reopened = await service.setStatus("TSK-8cA562sd", "open");
		expect(reopened.status).toBe("open");
		expect(reopened.completedAt).toBeUndefined();
	});

	it("updates editable fields and re-indexes tags/projects", async () => {
		const service = makeService();
		await service.createTask({
			title: "Buy milk",
			scheduledDate: "2026-06-25",
			tags: ["errand"],
		});

		const updated = await service.updateTask(
			"TSK-8cA562sd",
			update({
				title: "Buy oat milk",
				scheduledDate: "2026-06-25",
				status: "done",
				tags: ["shopping"],
				description: "from the corner store",
			})
		);

		expect(updated.title).toBe("Buy oat milk");
		expect(updated.status).toBe("done");
		expect(updated.completedAt).toBe("2026-06-25T08:00:00.000Z");
		expect(updated.description).toBe("from the corner store");
		expect(service.getTasksForTag("errand")).toEqual([]);
		expect(service.getTasksForTag("shopping")).toEqual([updated]);
	});

	it("deduplicates tags on update so the index lists the task once", async () => {
		const service = makeService();
		await service.createTask({ title: "Buy milk", scheduledDate: "2026-06-25" });

		const updated = await service.updateTask(
			"TSK-8cA562sd",
			update({
				title: "Buy milk",
				scheduledDate: "2026-06-25",
				tags: ["shopping", "shopping"],
			})
		);

		expect(updated.tags.filter((tag) => tag === "shopping")).toEqual(["shopping"]);
		expect(service.getTasksForTag("shopping")).toHaveLength(1);
	});

	it("deduplicates contexts and projects on update so the index lists the task once", async () => {
		const service = makeService();
		await service.createTask({ title: "Buy milk", scheduledDate: "2026-06-25" });

		const updated = await service.updateTask(
			"TSK-8cA562sd",
			update({
				title: "Buy milk",
				scheduledDate: "2026-06-25",
				contexts: ["home", "home"],
				projects: [{ path: "P.md" }, { path: "P.md", title: "dup" }],
			})
		);

		expect(updated.contexts).toEqual(["home"]);
		expect(updated.projects).toEqual([{ path: "P.md" }]);
		expect(service.getTasksForContext("home")).toHaveLength(1);
		expect(service.getTasksForProject("P.md")).toHaveLength(1);
	});

	it("deletes a task from the store and index", async () => {
		const service = makeService();
		await service.createTask({
			title: "Buy milk",
			scheduledDate: "2026-06-25",
			tags: ["errand"],
		});

		await service.deleteTask("TSK-8cA562sd");

		expect(await service.getTask("TSK-8cA562sd")).toBeNull();
		expect(service.getTasksForDate("2026-06-25")).toEqual([]);
		expect(service.getTasksForTag("errand")).toEqual([]);
	});

	it("orphans children (clears parentId) when their parent is deleted", async () => {
		const ids = ["TSK-parent01", "TSK-child0001"];
		let next = 0;
		const service = new DayTaskService({
			store: new MemoryTaskStore(),
			index: new MemoryTaskIndex(),
			statusManager,
			settings: {
				defaultStatus: "open",
				defaultPriority: "normal",
				defaultTags: [],
				defaultProjectPath: "",
			},
			now: () => "2026-06-25T08:00:00.000Z",
			id: () => ids[next++],
		});

		const parent = await service.createTask({ title: "Parent", scheduledDate: "2026-06-25" });
		const child = await service.createTask({
			title: "Child",
			scheduledDate: "2026-06-25",
			parentId: parent.id,
		});
		expect(child.parentId).toBe("TSK-parent01");

		await service.deleteTask(parent.id);

		expect(await service.getTask(parent.id)).toBeNull();
		const childAfter = await service.getTask(child.id);
		expect(childAfter).not.toBeNull();
		expect(childAfter?.parentId).toBeUndefined();
	});

	it("cycles status and refreshes the index", async () => {
		const service = makeService();
		await service.createTask({ title: "Buy milk", scheduledDate: "2026-06-25" });

		const cycled = await service.cycleStatus("TSK-8cA562sd");

		expect(cycled.status).toBe("in-progress");
		expect(service.getTasksForDate("2026-06-25")).toEqual([cycled]);
	});
});
