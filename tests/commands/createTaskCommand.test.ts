import { describe, expect, it, vi } from "vitest";
import { createTaskForActiveNote } from "../../src/commands/createTaskCommand";
import type { CreateDayTaskInput, DayTask } from "../../src/core/task";
import { DEFAULT_SETTINGS } from "../../src/settings/settings";

function makeTask(input: CreateDayTaskInput): DayTask {
	return {
		id: "TSK-8cA562sd",
		title: input.title,
		status: input.status ?? "open",
		scheduledDate: input.scheduledDate,
		tags: input.tags ?? [],
		contexts: input.contexts ?? [],
		projects: input.projects ?? [],
		timeEntries: [],
		createdAt: "2026-06-25T08:00:00.000Z",
		updatedAt: "2026-06-25T08:00:00.000Z",
	};
}

function deps(overrides: Partial<Parameters<typeof createTaskForActiveNote>[0]> = {}) {
	const createTask = vi.fn(async (input: CreateDayTaskInput) => makeTask(input));
	const notify = vi.fn();
	return {
		createTask,
		notify,
		deps: {
			getActiveFilePath: () => "Daily/2026-06-25.md",
			settings: DEFAULT_SETTINGS,
			service: { createTask },
			notify,
			...overrides,
		},
	};
}

describe("createTaskForActiveNote", () => {
	it("refuses when the active file is not a daily note", async () => {
		const { deps: d, createTask, notify } = deps({
			getActiveFilePath: () => "Projects/Home.md",
		});

		const result = await createTaskForActiveNote(d, "My task");

		expect(result).toBeNull();
		expect(createTask).not.toHaveBeenCalled();
		expect(notify).toHaveBeenCalledOnce();
	});

	it("refuses a daily note outside the configured daily-note folder", async () => {
		const { deps: d, createTask, notify } = deps({
			getActiveFilePath: () => "2026-06-25.md",
			settings: { ...DEFAULT_SETTINGS, dailyNoteFolder: "Daily" },
		});

		const result = await createTaskForActiveNote(d, "My task");

		expect(result).toBeNull();
		expect(createTask).not.toHaveBeenCalled();
		expect(notify).toHaveBeenCalledOnce();
	});

	it("refuses when there is no active file", async () => {
		const { deps: d, createTask } = deps({ getActiveFilePath: () => null });

		const result = await createTaskForActiveNote(d, "My task");

		expect(result).toBeNull();
		expect(createTask).not.toHaveBeenCalled();
	});

	it("refuses a blank title", async () => {
		const { deps: d, createTask, notify } = deps();

		const result = await createTaskForActiveNote(d, "   ");

		expect(result).toBeNull();
		expect(createTask).not.toHaveBeenCalled();
		expect(notify).toHaveBeenCalledOnce();
	});

	it("creates a task for the daily note date with the given title", async () => {
		const { deps: d, createTask } = deps();

		const task = await createTaskForActiveNote(d, "  Write spec  ");

		expect(createTask).toHaveBeenCalledWith({
			title: "Write spec",
			scheduledDate: "2026-06-25",
			tags: undefined,
			projects: undefined,
		});
		expect(task?.scheduledDate).toBe("2026-06-25");
	});

	it("applies default tags and project from settings", async () => {
		const { deps: d, createTask } = deps({
			settings: {
				...DEFAULT_SETTINGS,
				defaultTags: ["work"],
				defaultProjectPath: "Projects/Home.md",
			},
		});

		await createTaskForActiveNote(d, "Task");

		expect(createTask).toHaveBeenCalledWith({
			title: "Task",
			scheduledDate: "2026-06-25",
			tags: ["work"],
			projects: [{ path: "Projects/Home.md" }],
		});
	});

	it("notifies and returns null when creation throws", async () => {
		const createTask = vi.fn(async () => {
			throw new Error("disk full");
		});
		const notify = vi.fn();

		const result = await createTaskForActiveNote(
			{
				getActiveFilePath: () => "2026-06-25.md",
				settings: DEFAULT_SETTINGS,
				service: { createTask },
				notify,
			},
			"Task"
		);

		expect(result).toBeNull();
		expect(notify).toHaveBeenCalledOnce();
	});
});
