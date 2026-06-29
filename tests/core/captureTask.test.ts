import { describe, expect, it } from "vitest";
import {
	formatCapturedLine,
	resolveCaptureScheduledDate,
} from "../../src/core/captureTask";

describe("resolveCaptureScheduledDate", () => {
	it("prefers a parsed scheduled date", () => {
		const date = resolveCaptureScheduledDate(
			{ scheduledDate: "2026-07-02", dueDate: "2026-07-05" },
			"2026-07-01",
			"2026-06-29"
		);
		expect(date).toBe("2026-07-02");
	});

	it("ignores a parsed due date for scheduling (due is a deadline only) and uses the note's day", () => {
		const date = resolveCaptureScheduledDate(
			{ dueDate: "2026-07-05" },
			"2026-07-01",
			"2026-06-29"
		);
		expect(date).toBe("2026-07-01");
	});

	it("schedules a due-only task on today when there is no daily-note date", () => {
		const date = resolveCaptureScheduledDate(
			{ dueDate: "2026-07-05" },
			null,
			"2026-06-29"
		);
		expect(date).toBe("2026-06-29");
	});

	it("falls back to the source note's daily date", () => {
		const date = resolveCaptureScheduledDate({}, "2026-07-01", "2026-06-29");
		expect(date).toBe("2026-07-01");
	});

	it("falls back to today when nothing else is available", () => {
		const date = resolveCaptureScheduledDate({}, null, "2026-06-29");
		expect(date).toBe("2026-06-29");
	});
});

describe("formatCapturedLine", () => {
	it("appends a code-spanned task id, preserving the list prefix", () => {
		expect(formatCapturedLine("- [ ] ", "Buy milk", "TSK-8cA562sd")).toBe(
			"- [ ] Buy milk  `TSK-8cA562sd`"
		);
	});

	it("works with an empty prefix", () => {
		expect(formatCapturedLine("", "Buy milk", "TSK-8cA562sd")).toBe(
			"Buy milk  `TSK-8cA562sd`"
		);
	});
});
