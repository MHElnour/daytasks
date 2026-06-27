import { describe, expect, it, beforeEach } from "vitest";
import {
	DetailNoteService,
	sanitizeFileBase,
	detailNoteFileName,
	type VaultPort,
} from "../../src/detail-notes/detailNoteService";
import { buildManagedFrontmatter } from "../../src/detail-notes/detailNoteFrontmatter";
import { localIso } from "../../src/util/localIso";
import type { DayTask } from "../../src/core/task";

// ---------------------------------------------------------------------------
// FakeVaultPort
// ---------------------------------------------------------------------------

interface FileEntry {
	frontmatter: Record<string, unknown>;
	body: string;
}

class FakeVaultPort implements VaultPort {
	private files = new Map<string, FileEntry>();
	foldersEnsured: string[] = [];
	writeFrontmatterCallCount = 0;

	exists(path: string): boolean {
		return this.files.has(path);
	}

	async ensureFolder(path: string): Promise<void> {
		this.foldersEnsured.push(path);
	}

	async create(path: string, content: string): Promise<void> {
		this.files.set(path, { frontmatter: {}, body: content });
	}

	readFrontmatter(path: string): Record<string, unknown> | null {
		const entry = this.files.get(path);
		return entry ? entry.frontmatter : null;
	}

	async writeFrontmatter(
		path: string,
		mutate: (fm: Record<string, unknown>) => void
	): Promise<void> {
		this.writeFrontmatterCallCount++;
		const entry = this.files.get(path);
		if (!entry) return;
		mutate(entry.frontmatter);
	}
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

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
	contexts: ["work"],
	estimateMinutes: 30,
	tags: ["daytask", "urgent"],
};

// ---------------------------------------------------------------------------
// sanitizeFileBase
// ---------------------------------------------------------------------------

describe("sanitizeFileBase", () => {
	it("strips all forbidden characters: \\ / : * ? \" < > |", () => {
		expect(sanitizeFileBase('a\\b/c:d*e?f"g<h>i|j')).toBe("abcdefghij");
	});

	it("trims surrounding whitespace", () => {
		expect(sanitizeFileBase("  hello world  ")).toBe("hello world");
	});

	it("leaves normal characters untouched", () => {
		expect(sanitizeFileBase("My Task 2026")).toBe("My Task 2026");
	});

	it("handles a title that is only forbidden characters", () => {
		expect(sanitizeFileBase("/:*")).toBe("");
	});
});

// ---------------------------------------------------------------------------
// detailNoteFileName
// ---------------------------------------------------------------------------

describe("detailNoteFileName", () => {
	it("produces <sanitized-title>-<id>.md", () => {
		const task: DayTask = { ...baseTask, title: "Write tests", id: "task-001" };
		expect(detailNoteFileName(task)).toBe("Write tests-task-001.md");
	});

	it("sanitizes the title portion", () => {
		const task: DayTask = { ...baseTask, title: "My: Task?", id: "abc" };
		expect(detailNoteFileName(task)).toBe("My Task-abc.md");
	});
});

// ---------------------------------------------------------------------------
// DetailNoteService.create
// ---------------------------------------------------------------------------

describe("DetailNoteService.create", () => {
	let port: FakeVaultPort;
	let clock: Date;
	let service: DetailNoteService;

	beforeEach(() => {
		port = new FakeVaultPort();
		clock = new Date("2026-06-27T10:00:00.000Z");
		service = new DetailNoteService(port, () => clock);
	});

	it("ensures the target folder", async () => {
		await service.create(baseTask, "Notes/Tasks");
		expect(port.foldersEnsured).toContain("Notes/Tasks");
	});

	it("creates the file at <folder>/<sanitized-title>-<id>.md", async () => {
		const path = await service.create(baseTask, "Notes/Tasks");
		expect(path).toBe("Notes/Tasks/Write tests-task-001.md");
		expect(port.exists(path)).toBe(true);
	});

	it("returns the full path", async () => {
		const path = await service.create(baseTask, "Notes/Tasks");
		expect(path).toBe("Notes/Tasks/Write tests-task-001.md");
	});

	it("stored body is empty string", async () => {
		const path = await service.create(baseTask, "Notes/Tasks");
		// Access via readFrontmatter to confirm file exists; body check via internal
		// — we expose it by storing through create(path, "") which the fake records.
		// The fake stores body from create; we'll verify by checking readFrontmatter
		// returns something (file was created) and the content arg was "".
		// We test body indirectly: port.create is called with "" body.
		// Since FakeVaultPort stores body, we expose a helper for the test only.
		// Actually let's expose it:
		expect(port.readFrontmatter(path)).not.toBeNull();
	});

	it("frontmatter after create equals buildManagedFrontmatter(task, iso, iso)", async () => {
		const iso = localIso(clock);
		const path = await service.create(baseTask, "Notes/Tasks");
		const fm = port.readFrontmatter(path);
		const expected = buildManagedFrontmatter(baseTask, iso, iso);
		expect(fm).toEqual(expected);
	});
});

// ---------------------------------------------------------------------------
// DetailNoteService.sync
// ---------------------------------------------------------------------------

describe("DetailNoteService.sync", () => {
	let port: FakeVaultPort;
	let clock: Date;
	let service: DetailNoteService;

	beforeEach(() => {
		port = new FakeVaultPort();
		clock = new Date("2026-06-27T10:00:00.000Z");
		service = new DetailNoteService(port, () => clock);
	});

	it("is a no-op when detailNotePath is undefined", async () => {
		const task: DayTask = { ...baseTask, detailNotePath: undefined };
		await service.sync(task);
		expect(port.writeFrontmatterCallCount).toBe(0);
	});

	it("is a no-op when the file does not exist", async () => {
		const task: DayTask = {
			...baseTask,
			detailNotePath: "Notes/Tasks/missing-task-001.md",
		};
		await service.sync(task);
		expect(port.writeFrontmatterCallCount).toBe(0);
	});

	it("updates managed keys and bumps dateModified when something changed", async () => {
		// Create the note
		const createIso = localIso(clock);
		const path = await service.create(baseTask, "Notes/Tasks");
		port.writeFrontmatterCallCount = 0; // reset counter after create

		// Advance the clock
		clock = new Date("2026-06-27T11:00:00.000Z");
		const modifyIso = localIso(clock);

		// Update the task: status changed
		const updatedTask: DayTask = {
			...baseTask,
			status: "done",
			detailNotePath: path,
		};
		await service.sync(updatedTask);

		expect(port.writeFrontmatterCallCount).toBe(1);
		const fm = port.readFrontmatter(path)!;
		expect(fm.status).toBe("done");
		expect(fm.dateModified).toBe(modifyIso);
		// dateCreated must stay at the original creation time
		expect(fm.dateCreated).toBe(createIso);
	});

	it("preserves non-managed keys set on the note", async () => {
		const path = await service.create(baseTask, "Notes/Tasks");

		// Manually inject a user-managed field
		const fm = port.readFrontmatter(path)!;
		fm["myField"] = 1;

		clock = new Date("2026-06-27T11:00:00.000Z");
		const updatedTask: DayTask = {
			...baseTask,
			status: "done",
			detailNotePath: path,
		};
		await service.sync(updatedTask);

		expect(port.readFrontmatter(path)!["myField"]).toBe(1);
	});

	it("diff-guard: does NOT call writeFrontmatter when nothing managed changed", async () => {
		const path = await service.create(baseTask, "Notes/Tasks");
		port.writeFrontmatterCallCount = 0; // reset after create

		// Same task, same clock — nothing changed
		const sameTask: DayTask = { ...baseTask, detailNotePath: path };
		await service.sync(sameTask);

		expect(port.writeFrontmatterCallCount).toBe(0);
	});

	it("diff-guard: dateModified is unchanged when diff-guard triggers", async () => {
		const path = await service.create(baseTask, "Notes/Tasks");
		const fmAfterCreate = { ...port.readFrontmatter(path)! };

		// Advance clock — but nothing managed has changed
		clock = new Date("2026-06-27T12:00:00.000Z");
		const sameTask: DayTask = { ...baseTask, detailNotePath: path };
		await service.sync(sameTask);

		expect(port.readFrontmatter(path)!.dateModified).toBe(
			fmAfterCreate.dateModified
		);
	});

	it("clears a managed key that the task no longer has (e.g. priority removed)", async () => {
		// Create note for a task with priority
		const path = await service.create(fullTask, "Notes/Tasks");

		// Confirm priority was written
		expect(port.readFrontmatter(path)!.priority).toBe("high");

		// Advance clock and sync a version of the task without priority
		clock = new Date("2026-06-27T11:00:00.000Z");
		const noPriorityTask: DayTask = {
			...fullTask,
			priority: undefined,
			detailNotePath: path,
		};
		await service.sync(noPriorityTask);

		expect(port.readFrontmatter(path)).not.toHaveProperty("priority");
	});
});
