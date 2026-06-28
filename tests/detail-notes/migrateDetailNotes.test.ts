import { describe, expect, it } from "vitest";
import {
	runDetailNoteMigration,
	type MigrateDeps,
} from "../../src/detail-notes/migrateDetailNotes";
import type { DayTask } from "../../src/core/task";

const task = (over: Partial<DayTask>): DayTask => ({
	id: "t1",
	title: "T",
	status: "open",
	scheduledDate: "2026-06-27",
	tags: [],
	contexts: [],
	projects: [],
	timeEntries: [],
	createdAt: "2026-06-27T10:00:00.000Z",
	updatedAt: "2026-06-27T10:00:00.000Z",
	...over,
});

describe("runDetailNoteMigration", () => {
	it("skips tasks with no detailNotePath", async () => {
		const seen: string[] = [];
		const ok = await runDetailNoteMigration({
			tasks: [task({ id: "a" }), task({ id: "b", detailNotePath: "n.md" })],
			migrate: async (t) => {
				seen.push(t.id);
				return null;
			},
			onMigrated: async () => {},
			onError: () => {},
		});
		expect(seen).toEqual(["b"]);
		expect(ok).toBe(true);
	});

	it("calls onMigrated for each renamed task and returns true when all succeed", async () => {
		const links: Array<[string, string]> = [];
		const ok = await runDetailNoteMigration({
			tasks: [task({ id: "a", detailNotePath: "a-old.md" })],
			migrate: async () => "a.md",
			onMigrated: async (id, p) => {
				links.push([id, p]);
			},
			onError: () => {},
		});
		expect(links).toEqual([["a", "a.md"]]);
		expect(ok).toBe(true);
	});

	it("returns false and reports the error but still processes the rest", async () => {
		const migrated: string[] = [];
		const errors: string[] = [];
		const ok = await runDetailNoteMigration({
			tasks: [
				task({ id: "a", detailNotePath: "a.md" }),
				task({ id: "b", detailNotePath: "b.md" }),
			],
			migrate: async (t) => {
				if (t.id === "a") throw new Error("boom");
				migrated.push(t.id);
				return null;
			},
			onMigrated: async () => {},
			onError: (id) => errors.push(id),
		});
		expect(errors).toEqual(["a"]);
		expect(migrated).toEqual(["b"]);
		expect(ok).toBe(false);
	});

	it("retries a previously failed task on a later run (idempotent)", async () => {
		let attempt = 0;
		const links: string[] = [];
		const deps: MigrateDeps = {
			tasks: [task({ id: "a", detailNotePath: "a-old.md" })],
			migrate: async () => {
				attempt++;
				if (attempt === 1) throw new Error("boom");
				return "a.md";
			},
			onMigrated: async (id) => {
				links.push(id);
			},
			onError: () => {},
		};

		expect(await runDetailNoteMigration(deps)).toBe(false);
		expect(links).toEqual([]);

		expect(await runDetailNoteMigration(deps)).toBe(true);
		expect(links).toEqual(["a"]);
	});
});
