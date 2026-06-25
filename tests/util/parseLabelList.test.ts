import { describe, expect, it } from "vitest";
import { parseLabelList } from "../../src/util/parseLabelList";

describe("parseLabelList", () => {
	it("splits on commas and whitespace", () => {
		expect(parseLabelList("a, b  c,d")).toEqual(["a", "b", "c", "d"]);
	});

	it("strips a single leading #, @ or + prefix", () => {
		expect(parseLabelList("#tag @ctx +proj")).toEqual(["tag", "ctx", "proj"]);
	});

	it("trims entries and drops empties", () => {
		expect(parseLabelList("  a ,, b ")).toEqual(["a", "b"]);
	});

	it("removes duplicates, keeping first occurrence", () => {
		expect(parseLabelList("a a b a")).toEqual(["a", "b"]);
	});

	it("returns an empty array for blank input", () => {
		expect(parseLabelList("")).toEqual([]);
		expect(parseLabelList("   ")).toEqual([]);
	});
});
