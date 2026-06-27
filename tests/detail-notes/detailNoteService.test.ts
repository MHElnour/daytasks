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

	/** Test-only accessor for the stored body (null if the file is absent). */
	readBody(path: string): string | null {
		const entry = this.files.get(path);
		return entry ? entry.body : null;
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

	async rename(from: string, to: string): Promise<void> {
		const entry = this.files.get(from);
		if (!entry) return;
		this.files.delete(from);
		this.files.set(to, entry);
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
	it("produces <sanitized-title>.md (no id suffix)", () => {
		const task: DayTask = { ...baseTask, title: "Write tests", id: "task-001" };
		expect(detailNoteFileName(task)).toBe("Write tests.md");
	});

	it("sanitizes the title", () => {
		const task: DayTask = { ...baseTask, title: "My: Task?", id: "abc" };
		expect(detailNoteFileName(task)).toBe("My Task.md");
	});

	it("falls back to the id when the title sanitizes to empty", () => {
		const task: DayTask = { ...baseTask, title: "///", id: "abc" };
		expect(detailNoteFileName(task)).toBe("abc.md");
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

	it("creates the file at <folder>/<sanitized-title>.md", async () => {
		const path = await service.create(baseTask, "Notes/Tasks");
		expect(path).toBe("Notes/Tasks/Write tests.md");
		expect(port.exists(path)).toBe(true);
	});

	it("returns the full path", async () => {
		const path = await service.create(baseTask, "Notes/Tasks");
		expect(path).toBe("Notes/Tasks/Write tests.md");
	});

	it("falls back to <title>-<id>.md when the clean name is already taken", async () => {
		// Pre-occupy the clean path with an unrelated note.
		await port.create("Notes/Tasks/Write tests.md", "existing");
		const path = await service.create(baseTask, "Notes/Tasks");
		expect(path).toBe("Notes/Tasks/Write tests-task-001.md");
		expect(port.exists(path)).toBe(true);
	});

	it("stored body is empty string", async () => {
		const path = await service.create(baseTask, "Notes/Tasks");
		expect(port.readBody(path)).toBe("");
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

	it("diff-guard reacts to array-content changes (tags + contexts)", async () => {
		const path = await service.create(fullTask, "Notes/Tasks");
		port.writeFrontmatterCallCount = 0; // reset after create

		// Advance clock and change only array-valued managed fields.
		clock = new Date("2026-06-27T11:00:00.000Z");
		const updatedTask: DayTask = {
			...fullTask,
			tags: ["daytask", "later"],
			contexts: ["home"],
			detailNotePath: path,
		};
		await service.sync(updatedTask);

		expect(port.writeFrontmatterCallCount).toBe(1);
		expect(port.readFrontmatter(path)!.tags).toEqual(["daytask", "later"]);
		expect(port.readFrontmatter(path)!.contexts).toEqual(["home"]);
	});

	it("diff-guard does NOT misfire when only a non-managed key changed", async () => {
		const path = await service.create(baseTask, "Notes/Tasks");

		// Inject a user-managed key after creation.
		port.readFrontmatter(path)!["myField"] = 1;
		port.writeFrontmatterCallCount = 0; // reset after create

		// Task and clock otherwise unchanged — only the non-managed key exists.
		const sameTask: DayTask = { ...baseTask, detailNotePath: path };
		await service.sync(sameTask);

		expect(port.writeFrontmatterCallCount).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// DetailNoteService.migrate (one-time legacy normalization)
// ---------------------------------------------------------------------------

describe("DetailNoteService.migrate", () => {
	const clock = new Date("2026-06-27T10:00:00.000Z");
	const taskWith = (over: Partial<DayTask>): DayTask => ({ ...baseTask, ...over });

	async function seed(
		port: FakeVaultPort,
		path: string,
		fm: Record<string, unknown>,
		body = "user body"
	): Promise<void> {
		await port.create(path, body);
		await port.writeFrontmatter(path, (f) => Object.assign(f, fm));
	}

	it("strips title and renames a legacy <title>-<id>.md note (body preserved)", async () => {
		const port = new FakeVaultPort();
		const service = new DetailNoteService(port, () => clock);
		const legacy = "Notes/Tasks/Write tests-task-001.md";
		await seed(port, legacy, { title: "Write tests", status: "todo", taskId: "task-001" });
		const task = taskWith({ id: "task-001", title: "Write tests", detailNotePath: legacy });

		const result = await service.migrate(task);

		expect(result).toBe("Notes/Tasks/Write tests.md");
		expect(port.exists(legacy)).toBe(false);
		expect(port.exists("Notes/Tasks/Write tests.md")).toBe(true);
		expect(port.readFrontmatter("Notes/Tasks/Write tests.md")).not.toHaveProperty("title");
		expect(port.readFrontmatter("Notes/Tasks/Write tests.md")!.status).toBe("todo");
		expect(port.readBody("Notes/Tasks/Write tests.md")).toBe("user body");
	});

	it("is a no-op (null, no write) for an already-clean note", async () => {
		const port = new FakeVaultPort();
		const service = new DetailNoteService(port, () => clock);
		const clean = "Notes/Tasks/Write tests.md";
		await seed(port, clean, { status: "todo", taskId: "task-001" });
		port.writeFrontmatterCallCount = 0;
		const task = taskWith({ id: "task-001", title: "Write tests", detailNotePath: clean });

		expect(await service.migrate(task)).toBeNull();
		expect(port.writeFrontmatterCallCount).toBe(0);
	});

	it("strips a stale title from a clean-named note without renaming", async () => {
		const port = new FakeVaultPort();
		const service = new DetailNoteService(port, () => clock);
		const clean = "Notes/Tasks/Write tests.md";
		await seed(port, clean, { title: "Write tests", status: "todo" });
		const task = taskWith({ id: "task-001", title: "Write tests", detailNotePath: clean });

		expect(await service.migrate(task)).toBeNull();
		expect(port.readFrontmatter(clean)).not.toHaveProperty("title");
	});

	it("keeps the legacy name (first-wins) when the clean name is taken, but still strips title", async () => {
		const port = new FakeVaultPort();
		const service = new DetailNoteService(port, () => clock);
		const legacy = "Notes/Tasks/Write tests-task-001.md";
		await seed(port, legacy, { title: "Write tests", status: "todo" });
		await port.create("Notes/Tasks/Write tests.md", "other note");
		const task = taskWith({ id: "task-001", title: "Write tests", detailNotePath: legacy });

		expect(await service.migrate(task)).toBeNull();
		expect(port.exists(legacy)).toBe(true);
		expect(port.readFrontmatter(legacy)).not.toHaveProperty("title");
		expect(port.readBody("Notes/Tasks/Write tests.md")).toBe("other note");
	});

	it("is a no-op when the file is missing or the task has no note", async () => {
		const port = new FakeVaultPort();
		const service = new DetailNoteService(port, () => clock);
		expect(
			await service.migrate(taskWith({ id: "task-001", detailNotePath: "Notes/Tasks/gone.md" }))
		).toBeNull();
		expect(await service.migrate(taskWith({ detailNotePath: undefined }))).toBeNull();
	});
});
