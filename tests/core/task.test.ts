import { describe, expect, it } from "vitest";
import {
	DEFAULT_TASK_TAG,
	applyPrimaryProjectEdit,
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

describe("applyPrimaryProjectEdit", () => {
	it("replaces the primary link but preserves the other project links", () => {
		expect(
			applyPrimaryProjectEdit("Projects/New.md", [
				{ path: "Projects/Old.md" },
				{ path: "Projects/Keep.md" },
			])
		).toEqual([{ path: "Projects/New.md" }, { path: "Projects/Keep.md" }]);
	});

	it("drops only the primary when it is cleared, keeping the rest", () => {
		expect(
			applyPrimaryProjectEdit("", [{ path: "A.md" }, { path: "B.md" }])
		).toEqual([{ path: "B.md" }]);
	});

	it("deduplicates when the edited primary matches a preserved link", () => {
		expect(
			applyPrimaryProjectEdit("B.md", [{ path: "A.md" }, { path: "B.md" }])
		).toEqual([{ path: "B.md" }]);
	});

	it("preserves titles on the kept links", () => {
		expect(
			applyPrimaryProjectEdit("A.md", [
				{ path: "A.md" },
				{ path: "B.md", title: "Bee" },
			])
		).toEqual([{ path: "A.md" }, { path: "B.md", title: "Bee" }]);
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
