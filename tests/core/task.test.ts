import { describe, expect, it } from "vitest";
import {
	DEFAULT_TASK_TAG,
	toUpdateDayTaskInput,
	withDefaultTag,
	type CreateDayTaskInput,
} from "../../src/core/task";

describe("withDefaultTag", () => {
	it("prepends the default tag when absent", () => {
		expect(withDefaultTag(["errand"])).toEqual([DEFAULT_TASK_TAG, "errand"]);
	});

	it("keeps a single default tag when already present", () => {
		expect(withDefaultTag([DEFAULT_TASK_TAG, "errand"])).toEqual([
			DEFAULT_TASK_TAG,
			"errand",
		]);
	});

	it("removes duplicate tags", () => {
		expect(withDefaultTag(["errand", "errand", "home"])).toEqual([
			DEFAULT_TASK_TAG,
			"errand",
			"home",
		]);
	});

	it("removes duplicates even when the default tag is already present", () => {
		expect(withDefaultTag([DEFAULT_TASK_TAG, "shopping", "shopping"])).toEqual([
			DEFAULT_TASK_TAG,
			"shopping",
		]);
	});
});

describe("toUpdateDayTaskInput", () => {
	it("maps every editable field from the modal input", () => {
		const input: CreateDayTaskInput = {
			title: "Buy milk",
			scheduledDate: "2026-06-25",
			status: "done",
			dueDate: "2026-07-01",
			priority: "high",
			tags: ["errand"],
			contexts: ["home"],
			projects: [{ path: "Projects/Home.md" }],
			estimateMinutes: 30,
			description: "note",
		};
		expect(toUpdateDayTaskInput(input)).toEqual({
			title: "Buy milk",
			scheduledDate: "2026-06-25",
			status: "done",
			dueDate: "2026-07-01",
			priority: "high",
			tags: ["errand"],
			contexts: ["home"],
			projects: [{ path: "Projects/Home.md" }],
			estimateMinutes: 30,
			description: "note",
		});
	});

	it("passes omitted optionals through as undefined (full replacement clears them)", () => {
		expect(
			toUpdateDayTaskInput({ title: "T", scheduledDate: "2026-06-25" })
		).toEqual({
			title: "T",
			scheduledDate: "2026-06-25",
			status: undefined,
			dueDate: undefined,
			priority: undefined,
			tags: undefined,
			contexts: undefined,
			projects: undefined,
			estimateMinutes: undefined,
			description: undefined,
		});
	});
});
