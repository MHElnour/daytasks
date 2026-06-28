import { describe, expect, it } from "vitest";
import { noteBasename, stripTrailingSlashes } from "../../src/util/notePath";

describe("stripTrailingSlashes", () => {
	it("removes one or more trailing slashes", () => {
		expect(stripTrailingSlashes("a/")).toBe("a");
		expect(stripTrailingSlashes("a//")).toBe("a");
		expect(stripTrailingSlashes("a/b/")).toBe("a/b");
	});

	it("leaves a folder without a trailing slash unchanged", () => {
		expect(stripTrailingSlashes("a/b")).toBe("a/b");
		expect(stripTrailingSlashes("")).toBe("");
	});
});

describe("noteBasename", () => {
	it("returns the filename without folders or the .md extension", () => {
		expect(noteBasename("2026-06-24.md")).toBe("2026-06-24");
		expect(noteBasename("Daily/2026-06-24.md")).toBe("2026-06-24");
		expect(noteBasename("Projects/Client Launch.md")).toBe("Client Launch");
	});

	it("handles backslash separators and missing extensions", () => {
		expect(noteBasename("Projects\\Home.md")).toBe("Home");
		expect(noteBasename("plain-name")).toBe("plain-name");
	});

	it("strips the .md extension case-insensitively", () => {
		expect(noteBasename("Daily/2026-06-24.MD")).toBe("2026-06-24");
	});
});
