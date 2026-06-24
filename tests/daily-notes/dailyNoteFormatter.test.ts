import { describe, expect, it } from "vitest";
import { formatDailyTaskLine } from "../../src/daily-notes/dailyNoteFormatter";
import { parseDailyTaskLine } from "../../src/daily-notes/dailyNoteParser";

describe("daily note task lines", () => {
	it("formats and parses open task lines", () => {
		const line = formatDailyTaskLine({
			id: "TSK-8cA562sd",
			title: "Buy milk",
			status: "open",
			scheduledDate: "2026-06-24",
			timeEntries: [],
			createdAt: "2026-06-24T08:00:00.000Z",
			updatedAt: "2026-06-24T08:00:00.000Z",
		});

		expect(line).toBe("- [ ] Buy milk <!-- TSK-8cA562sd -->");
		expect(parseDailyTaskLine(line)).toEqual({
			id: "TSK-8cA562sd",
			completed: false,
			title: "Buy milk",
		});
	});

	it("formats completed task lines", () => {
		const line = formatDailyTaskLine({
			id: "TSK-GJM4c42e",
			title: "Send proposal",
			status: "done",
			scheduledDate: "2026-06-24",
			timeEntries: [],
			createdAt: "2026-06-24T08:00:00.000Z",
			updatedAt: "2026-06-24T08:00:00.000Z",
		});

		expect(line).toBe("- [x] Send proposal <!-- TSK-GJM4c42e -->");
	});
});
