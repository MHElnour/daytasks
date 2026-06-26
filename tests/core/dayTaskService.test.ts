import { describe, expect, it } from "vitest";
import type { UpdateDayTaskInput } from "../../src/core/task";
import { DayTaskService } from "../../src/core/dayTaskService";
import { BLOCKED_STATUS_VALUE, DEFAULT_STATUSES, withBlockedStatus } from "../../src/core/status";
import { StatusManager } from "../../src/core/statusManager";
import { MemoryTaskIndex } from "../../src/core/taskIndex";
import { MemoryTaskStore } from "../../src/core/taskStore";

const statusManager = new StatusManager(withBlockedStatus(DEFAULT_STATUSES), "open");

function makeServiceWithIds(ids: string[]): DayTaskService {
	let next = 0;
	return new DayTaskService({
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
}

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

	it("rejects an update whose due date precedes the scheduled date", async () => {
		const service = makeService();
		await service.createTask({ title: "Buy milk", scheduledDate: "2026-06-25" });

		await expect(
			service.updateTask(
				"TSK-8cA562sd",
				update({
					title: "Buy milk",
					scheduledDate: "2026-06-25",
					dueDate: "2026-06-24",
				})
			)
		).rejects.toThrow("Due date cannot be before the scheduled date");
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

describe("DayTaskService subtasks", () => {
	it("creates a subtask linked to its parent and lists it", async () => {
		const service = makeServiceWithIds(["TSK-parent01", "TSK-child0001"]);
		const parent = await service.createTask({ title: "Parent", scheduledDate: "2026-06-25" });

		const child = await service.createSubtask(parent.id, {
			title: "Child",
			scheduledDate: "2026-06-25",
		});

		expect(child.parentId).toBe("TSK-parent01");
		expect(service.getChildren(parent.id)).toEqual([child]);
	});

	it("rejects a subtask for a missing parent", async () => {
		const service = makeServiceWithIds(["TSK-child0001"]);
		await expect(
			service.createSubtask("TSK-missing01", { title: "Child", scheduledDate: "2026-06-25" })
		).rejects.toThrow("Parent task not found");
	});

	it("unlinks a subtask, clearing its parentId", async () => {
		const service = makeServiceWithIds(["TSK-parent01", "TSK-child0001"]);
		const parent = await service.createTask({ title: "Parent", scheduledDate: "2026-06-25" });
		const child = await service.createSubtask(parent.id, {
			title: "Child",
			scheduledDate: "2026-06-25",
		});

		const unlinked = await service.unlinkSubtask(child.id);

		expect(unlinked.parentId).toBeUndefined();
		expect(service.getChildren(parent.id)).toEqual([]);
	});
});

describe("DayTaskService dependencies", () => {
	it("adds a blockedBy edge", async () => {
		const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
		await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
		await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
		const a = await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
		expect(a.blockedBy).toEqual(["TSK-bbbbbbbb"]);
	});

	it("rejects a dependency that would create a cycle", async () => {
		const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
		await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
		await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
		await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb"); // A blocked by B
		await expect(service.addDependency("TSK-bbbbbbbb", "TSK-aaaaaaaa")).rejects.toThrow(
			"cycle"
		);
	});

	it("removes a blockedBy edge", async () => {
		const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
		await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
		await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
		await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
		const a = await service.removeDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
		expect(a.blockedBy).toBeUndefined();
	});

	it("strips inbound edges when a blocker is deleted", async () => {
		const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
		await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
		await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
		await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb"); // A blocked by B
		await service.deleteTask("TSK-bbbbbbbb");
		const a = await service.getTask("TSK-aaaaaaaa");
		expect(a?.blockedBy).toBeUndefined();
	});

	it("sets the dependent to blocked when a dependency is added", async () => {
		const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
		await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
		await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
		const a = await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
		expect(a.status).toBe(BLOCKED_STATUS_VALUE);
	});

	it("rejects adding a dependency to or from a completed task", async () => {
		const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
		await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
		await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
		await service.setStatus("TSK-bbbbbbbb", "done");
		await expect(service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb")).rejects.toThrow(/completed/);
	});

	it("releases the dependent to in-progress when its only blocker completes", async () => {
		const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
		await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
		await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
		await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb"); // A blocked by B
		await service.setStatus("TSK-bbbbbbbb", "done");            // complete B
		const a = await service.getTask("TSK-aaaaaaaa");
		expect(a?.blockedBy).toBeUndefined();
		expect(a?.status).toBe("in-progress");
	});

	it("keeps the dependent blocked until the last blocker completes", async () => {
		const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb", "TSK-cccccccc"]);
		await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
		await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
		await service.createTask({ title: "C", scheduledDate: "2026-06-25" });
		await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
		await service.addDependency("TSK-aaaaaaaa", "TSK-cccccccc");
		await service.setStatus("TSK-bbbbbbbb", "done"); // one of two blockers
		const mid = await service.getTask("TSK-aaaaaaaa");
		expect(mid?.blockedBy).toEqual(["TSK-cccccccc"]);
		expect(mid?.status).toBe(BLOCKED_STATUS_VALUE);
		await service.setStatus("TSK-cccccccc", "done"); // last blocker
		const done = await service.getTask("TSK-aaaaaaaa");
		expect(done?.blockedBy).toBeUndefined();
		expect(done?.status).toBe("in-progress");
	});

	it("releases on manual removal of the last blocker", async () => {
		const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
		await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
		await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
		await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
		const removed = await service.removeDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
		expect(removed.status).toBe("in-progress");
		expect(removed.blockedBy).toBeUndefined();
	});

	it("releases on blocker deletion when it was the last blocker", async () => {
		const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
		await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
		await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
		await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
		await service.deleteTask("TSK-bbbbbbbb");
		const a = await service.getTask("TSK-aaaaaaaa");
		expect(a?.status).toBe("in-progress");
		expect(a?.blockedBy).toBeUndefined();
	});

	it("preserves a dependent's status on last-blocker completion when it is not blocked", async () => {
		const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
		await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
		await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
		await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb"); // A blocked by B
		await service.setStatus("TSK-aaaaaaaa", "open"); // manually out of blocked, edge retained
		await service.setStatus("TSK-bbbbbbbb", "done"); // complete the blocker
		const a = await service.getTask("TSK-aaaaaaaa");
		expect(a?.status).toBe("open"); // not overwritten to in-progress
		expect(a?.blockedBy).toBeUndefined(); // edge still cleared
	});
});

describe("DayTaskService priority", () => {
	it("sets a priority value", async () => {
		const service = makeService();
		await service.createTask({ title: "Task", scheduledDate: "2026-06-25" });

		const updated = await service.setPriority("TSK-8cA562sd", "high");

		expect(updated.priority).toBe("high");
	});

	it("clears the priority when given undefined", async () => {
		const service = makeService({ defaultPriority: "normal" });
		await service.createTask({ title: "Task", scheduledDate: "2026-06-25" });

		const cleared = await service.setPriority("TSK-8cA562sd", undefined);

		expect(cleared.priority).toBeUndefined();
	});

	it("throws for a missing task", async () => {
		const service = makeService();
		await expect(service.setPriority("TSK-missing01", "high")).rejects.toThrow(
			"Task not found"
		);
	});
});

describe("DayTaskService updateTask blocked-status invariant", () => {
	it("updateTask releases a stale-blocked task that no longer has blockers", async () => {
		const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
		await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
		await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
		await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
		await service.removeDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
		// A is now unblocked; simulate a stale modal save that carries the old "blocked" status
		const result = await service.updateTask(
			"TSK-aaaaaaaa",
			update({ title: "A", scheduledDate: "2026-06-25", status: BLOCKED_STATUS_VALUE })
		);
		expect(result.status).toBe("in-progress");
		expect(result.blockedBy).toBeUndefined();
	});

	it("updateTask cannot move a task with blockers out of blocked", async () => {
		const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
		await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
		await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
		await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
		// Try to manually move A to in-progress while it still has a blocker
		const result = await service.updateTask(
			"TSK-aaaaaaaa",
			update({ title: "A", scheduledDate: "2026-06-25", status: "in-progress" })
		);
		expect(result.status).toBe(BLOCKED_STATUS_VALUE);
	});

	it("updateTask completing a blocker releases its dependent", async () => {
		const service = makeServiceWithIds(["TSK-aaaaaaaa", "TSK-bbbbbbbb"]);
		await service.createTask({ title: "A", scheduledDate: "2026-06-25" });
		await service.createTask({ title: "B", scheduledDate: "2026-06-25" });
		await service.addDependency("TSK-aaaaaaaa", "TSK-bbbbbbbb");
		// Complete B via updateTask (the modal path)
		await service.updateTask(
			"TSK-bbbbbbbb",
			update({ title: "B", scheduledDate: "2026-06-25", status: "done" })
		);
		const a = await service.getTask("TSK-aaaaaaaa");
		expect(a?.status).toBe("in-progress");
		expect(a?.blockedBy).toBeUndefined();
	});
});

describe("DayTaskService allTasks", () => {
	it("returns an empty array when no tasks exist", () => {
		const service = makeService();
		expect(service.allTasks()).toEqual([]);
	});

	it("returns all created tasks as a snapshot", async () => {
		const service = makeServiceWithIds(["TSK-001", "TSK-002"]);
		await service.createTask({ title: "First", scheduledDate: "2026-06-26" });
		await service.createTask({ title: "Second", scheduledDate: "2026-06-26" });

		const all = service.allTasks();
		expect(all).toHaveLength(2);
		expect(all.map((t) => t.id).sort()).toEqual(["TSK-001", "TSK-002"]);
	});
});
