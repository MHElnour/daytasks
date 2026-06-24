import { describe, expect, it } from "vitest";
import { noteBasename } from "../../src/util/notePath";

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
