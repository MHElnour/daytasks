import { describe, expect, it } from "vitest";
import { getDailyNoteDateFromPath } from "../../src/daily-notes/dailyNoteDate";

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
});
