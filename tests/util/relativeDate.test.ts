import { describe, expect, it } from "vitest";
import { formatMonthDay, isOverdue } from "../../src/util/relativeDate";

describe("formatMonthDay", () => {
	it("formats YYYY-MM-DD as 'Mon D'", () => {
		expect(formatMonthDay("2026-06-25")).toBe("Jun 25");
		expect(formatMonthDay("2026-01-01")).toBe("Jan 1");
		expect(formatMonthDay("2026-12-09")).toBe("Dec 9");
	});

	it("returns the input when unparseable", () => {
		expect(formatMonthDay("nope")).toBe("nope");
	});
});

describe("isOverdue", () => {
	it("is true only for past dates on incomplete tasks", () => {
		expect(isOverdue("2026-06-24", "2026-06-25", false)).toBe(true);
		expect(isOverdue("2026-06-25", "2026-06-25", false)).toBe(false);
		expect(isOverdue("2026-06-26", "2026-06-25", false)).toBe(false);
		expect(isOverdue("2026-06-24", "2026-06-25", true)).toBe(false);
		expect(isOverdue(undefined, "2026-06-25", false)).toBe(false);
	});
});
