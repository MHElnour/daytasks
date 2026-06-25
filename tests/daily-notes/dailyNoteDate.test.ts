import { describe, expect, it } from "vitest";
import {
	getDailyNoteDateFromPath,
	resolveDailyNoteDate,
} from "../../src/daily-notes/dailyNoteDate";

describe("getDailyNoteDateFromPath", () => {
	it("reads a YYYY-MM-DD date from daily note filenames", () => {
		expect(getDailyNoteDateFromPath("2026-06-24.md")).toBe("2026-06-24");
		expect(getDailyNoteDateFromPath("Daily/2026-06-24.md")).toBe("2026-06-24");
		expect(getDailyNoteDateFromPath("Daily/2026-06-24 Wednesday.md")).toBe(
			"2026-06-24"
		);
	});

	it("returns null when the filename does not start with a daily-note date", () => {
		expect(getDailyNoteDateFromPath("Notes/random.md")).toBeNull();
		expect(getDailyNoteDateFromPath("Daily/June 24 2026.md")).toBeNull();
	});

	it("rejects a YYYY-MM-DD shape that is not a real calendar date", () => {
		expect(getDailyNoteDateFromPath("2026-13-45.md")).toBeNull();
		expect(getDailyNoteDateFromPath("2026-02-29.md")).toBeNull();
	});
});

describe("resolveDailyNoteDate", () => {
	it("ignores folder when no daily-note folder is configured", () => {
		expect(resolveDailyNoteDate("2026-06-25.md", "")).toBe("2026-06-25");
		expect(resolveDailyNoteDate("Anywhere/2026-06-25.md", "")).toBe("2026-06-25");
	});

	it("only accepts notes inside the configured folder", () => {
		expect(resolveDailyNoteDate("Daily/2026-06-25.md", "Daily")).toBe("2026-06-25");
		expect(resolveDailyNoteDate("Daily/Sub/2026-06-25.md", "Daily")).toBe("2026-06-25");
		expect(resolveDailyNoteDate("2026-06-25.md", "Daily")).toBeNull();
		expect(resolveDailyNoteDate("Other/2026-06-25.md", "Daily")).toBeNull();
	});

	it("tolerates a trailing slash on the configured folder", () => {
		expect(resolveDailyNoteDate("Daily/2026-06-25.md", "Daily/")).toBe("2026-06-25");
	});

	it("still requires a daily-note filename inside the folder", () => {
		expect(resolveDailyNoteDate("Daily/notes.md", "Daily")).toBeNull();
	});
});
