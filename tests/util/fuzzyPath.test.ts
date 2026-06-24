import { describe, expect, it } from "vitest";
import { filterMarkdownPaths } from "../../src/util/fuzzyPath";

const paths = [
	"Projects/Home.md",
	"Projects/Client Launch.md",
	"Notes/random.txt",
	"Archive/old-home.md",
	"image.png",
];

describe("filterMarkdownPaths", () => {
	it("keeps only markdown files for an empty query, sorted", () => {
		expect(filterMarkdownPaths(paths, "")).toEqual([
			"Archive/old-home.md",
			"Projects/Client Launch.md",
			"Projects/Home.md",
		]);
	});

	it("matches by substring", () => {
		expect(filterMarkdownPaths(paths, "client")).toEqual([
			"Projects/Client Launch.md",
		]);
	});

	it("matches non-contiguous subsequences", () => {
		// p, h subsequence within "Projects/Home.md"
		expect(filterMarkdownPaths(paths, "ph")).toContain("Projects/Home.md");
	});

	it("is case-insensitive", () => {
		expect(filterMarkdownPaths(paths, "HOME")).toContain("Projects/Home.md");
	});

	it("returns nothing when there is no match", () => {
		expect(filterMarkdownPaths(paths, "zzzzz")).toEqual([]);
	});

	it("ranks a basename match above a deeper match", () => {
		const result = filterMarkdownPaths(paths, "home");
		expect(result[0]).toBe("Projects/Home.md");
		expect(result).toContain("Archive/old-home.md");
	});
});
