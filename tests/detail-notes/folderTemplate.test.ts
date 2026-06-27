import { describe, expect, it } from "vitest";
import { resolveFolderTemplate } from "../../src/detail-notes/folderTemplate";

describe("resolveFolderTemplate", () => {
	const date = "2026-06-27";

	it("expands year/month/day from the date", () => {
		expect(resolveFolderTemplate("Tasks/{{year}}/{{month}}", date)).toBe("Tasks/2026/06");
		expect(resolveFolderTemplate("Tasks/{{year}}/{{month}}/{{day}}", date)).toBe(
			"Tasks/2026/06/27"
		);
	});

	it("expands {{date}} to the full ISO date", () => {
		expect(resolveFolderTemplate("Notes/{{date}}", date)).toBe("Notes/2026-06-27");
	});

	it("allows whitespace inside the braces", () => {
		expect(resolveFolderTemplate("Tasks/{{ year }}/{{ month }}", date)).toBe("Tasks/2026/06");
	});

	it("leaves a plain folder (no variables) unchanged", () => {
		expect(resolveFolderTemplate("DayTasks/Tasks", date)).toBe("DayTasks/Tasks");
	});

	it("trims a trailing slash and collapses repeated slashes", () => {
		expect(resolveFolderTemplate("Actions/{{year}}/", date)).toBe("Actions/2026");
		expect(resolveFolderTemplate("a//{{month}}///b", date)).toBe("a/06/b");
	});

	it("trims whitespace around each path segment", () => {
		expect(resolveFolderTemplate("Tasks/{{ year }} / {{ month }}", date)).toBe("Tasks/2026/06");
	});

	it("leaves unknown tokens untouched", () => {
		expect(resolveFolderTemplate("Tasks/{{quarter}}/{{year}}", date)).toBe(
			"Tasks/{{quarter}}/2026"
		);
	});

	it("supports a single variable as the whole folder", () => {
		expect(resolveFolderTemplate("{{year}}", date)).toBe("2026");
	});

	it("returns an empty string for a template that resolves to only slashes (vault root)", () => {
		expect(resolveFolderTemplate("/", date)).toBe("");
	});
});
