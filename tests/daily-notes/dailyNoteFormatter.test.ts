import { describe, expect, it } from "vitest";
import { formatDailyTaskLine } from "../../src/daily-notes/dailyNoteFormatter";
import { parseDailyTaskLine } from "../../src/daily-notes/dailyNoteParser";

const baseTask = {
	id: "TSK-8cA562sd",
	title: "Buy milk",
	status: "open",
	scheduledDate: "2026-06-24",
	tags: [],
	contexts: [],
	projects: [],
	timeEntries: [],
	createdAt: "2026-06-24T08:00:00.000Z",
	updatedAt: "2026-06-24T08:00:00.000Z",
};

describe("daily note task lines", () => {
	it("formats and parses open task lines", () => {
		const line = formatDailyTaskLine(baseTask, false);

		expect(line).toBe("- [ ] Buy milk <!-- TSK-8cA562sd -->");
		expect(parseDailyTaskLine(line)).toEqual({
			id: "TSK-8cA562sd",
			completed: false,
			title: "Buy milk",
		});
	});

	it("marks a task complete from the flag, not a hardcoded status value", () => {
		const line = formatDailyTaskLine(
			{ ...baseTask, id: "TSK-GJM4c42e", title: "Send proposal", status: "shipped" },
			true
		);

		expect(line).toBe("- [x] Send proposal <!-- TSK-GJM4c42e -->");
	});
});
