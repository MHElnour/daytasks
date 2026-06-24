import { describe, expect, it } from "vitest";
import { cloneProjects, cloneStrings } from "../../src/util/clone";

describe("cloneStrings", () => {
	it("returns undefined when the input is undefined", () => {
		expect(cloneStrings(undefined)).toBeUndefined();
	});

	it("returns a detached copy of the array", () => {
		const input = ["a", "b"];
		const copy = cloneStrings(input);

		expect(copy).toEqual(["a", "b"]);
		expect(copy).not.toBe(input);
	});

	it("preserves an empty array as an empty array", () => {
		expect(cloneStrings([])).toEqual([]);
	});
});

describe("cloneProjects", () => {
	it("returns undefined when the input is undefined", () => {
		expect(cloneProjects(undefined)).toBeUndefined();
	});

	it("deep-copies each project link", () => {
		const input = [{ path: "Projects/Home.md", title: "Home" }];
		const copy = cloneProjects(input);

		expect(copy).toEqual(input);
		expect(copy).not.toBe(input);
		expect(copy?.[0]).not.toBe(input[0]);
	});
});
