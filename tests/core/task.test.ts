import { describe, expect, it } from "vitest";
import { DEFAULT_TASK_TAG, withDefaultTag } from "../../src/core/task";

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
