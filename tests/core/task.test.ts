import { describe, expect, it } from "vitest";
import {
	DEFAULT_TASK_TAG,
	applyPrimaryProjectEdit,
	withDefaultTag,
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
