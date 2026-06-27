import { describe, expect, it } from "vitest";
import {
	buildManagedFrontmatter,
	MANAGED_FM_KEYS,
} from "../../src/detail-notes/detailNoteFrontmatter";
import type { DayTask } from "../../src/core/task";

const baseTask: DayTask = {
	id: "task-001",
	title: "Write tests",
	status: "todo",
	scheduledDate: "2026-06-27",
	tags: ["daytask"],
	contexts: [],
	projects: [],
	timeEntries: [],
	createdAt: "2026-06-27T10:00:00.000+03:00",
	updatedAt: "2026-06-27T11:00:00.000+03:00",
};

const fullTask: DayTask = {
	...baseTask,
	priority: "high",
	dueDate: "2026-06-30",
	contexts: ["work", "home"],
	projects: [{ path: "Projects/Welcome.md" }, { path: "Projects/Alpha.md" }],
	estimateMinutes: 90,
	parentId: "task-000",
	tags: ["daytask", "urgent"],
};

describe("MANAGED_FM_KEYS", () => {
	it("contains all keys in the specified order", () => {
		expect(MANAGED_FM_KEYS).toEqual([
			"title",
			"status",
			"priority",
			"scheduled",
			"due",
			"contexts",
			"projects",
			"estimate",
			"parentId",
			"taskId",
			"taskCreated",
			"dateCreated",
			"dateModified",
			"tags",
		]);
	});
});

describe("buildManagedFrontmatter", () => {
	it("fully-populated task yields keys in the correct order", () => {
		const result = buildManagedFrontmatter(
			fullTask,
			"2026-06-27T10:00:00.000+03:00",
			"2026-06-27T12:00:00.000+03:00"
		);

		expect(Object.keys(result)).toEqual([
			"title",
			"status",
			"priority",
			"scheduled",
			"due",
			"contexts",
			"projects",
			"estimate",
			"parentId",
			"taskId",
			"taskCreated",
			"dateCreated",
			"dateModified",
			"tags",
		]);
	});

	it("maps all full task values correctly", () => {
		const dateCreated = "2026-06-27T10:00:00.000+03:00";
		const dateModified = "2026-06-27T12:00:00.000+03:00";
		const result = buildManagedFrontmatter(fullTask, dateCreated, dateModified);

		expect(result.title).toBe("Write tests");
		expect(result.status).toBe("todo");
		expect(result.priority).toBe("high");
		expect(result.scheduled).toBe("2026-06-27");
		expect(result.due).toBe("2026-06-30");
		expect(result.contexts).toEqual(["work", "home"]);
		expect(result.projects).toEqual(["[[Welcome]]", "[[Alpha]]"]);
		expect(result.estimate).toBe(90);
		expect(result.parentId).toBe("task-000");
		expect(result.taskId).toBe("task-001");
		expect(result.taskCreated).toBe("2026-06-27T10:00:00.000+03:00");
		expect(result.dateCreated).toBe(dateCreated);
		expect(result.dateModified).toBe(dateModified);
		expect(result.tags).toEqual(["daytask", "urgent"]);
	});

	it("minimal task omits priority, due, contexts, projects, estimate, parentId", () => {
		const result = buildManagedFrontmatter(
			baseTask,
			"2026-06-27T10:00:00.000+03:00",
			"2026-06-27T10:00:00.000+03:00"
		);

		expect(Object.keys(result)).toEqual([
			"title",
			"status",
			"scheduled",
			"taskId",
			"taskCreated",
			"dateCreated",
			"dateModified",
			"tags",
		]);

		expect(result).not.toHaveProperty("priority");
		expect(result).not.toHaveProperty("due");
		expect(result).not.toHaveProperty("contexts");
		expect(result).not.toHaveProperty("projects");
		expect(result).not.toHaveProperty("estimate");
		expect(result).not.toHaveProperty("parentId");
	});

	it("maps project paths to wikilink strings", () => {
		const task: DayTask = {
			...baseTask,
			projects: [{ path: "Projects/Welcome.md" }],
		};
		const result = buildManagedFrontmatter(
			task,
			"2026-06-27T10:00:00.000+03:00",
			"2026-06-27T10:00:00.000+03:00"
		);

		expect(result.projects).toEqual(["[[Welcome]]"]);
	});

	it("tags array is copied as-is from the task", () => {
		const result = buildManagedFrontmatter(
			baseTask,
			"2026-06-27T10:00:00.000+03:00",
			"2026-06-27T10:00:00.000+03:00"
		);

		expect(result.tags).toEqual(["daytask"]);
	});
});
