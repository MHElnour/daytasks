import { describe, expect, it } from "vitest";
import { isValidCalendarDate, parseCalendarDate } from "../../src/util/calendarDate";

describe("parseCalendarDate", () => {
	it("parses a real date into components", () => {
		expect(parseCalendarDate("2026-06-25")).toEqual({ year: 2026, month: 6, day: 25 });
	});

	it("accepts Feb 29 in a leap year but rejects it otherwise", () => {
		expect(parseCalendarDate("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
		expect(parseCalendarDate("2026-02-29")).toBeNull();
	});

	it("rejects out-of-range months and days", () => {
		expect(parseCalendarDate("2026-13-01")).toBeNull();
		expect(parseCalendarDate("2026-00-10")).toBeNull();
		expect(parseCalendarDate("2026-04-31")).toBeNull();
		expect(parseCalendarDate("2026-13-45")).toBeNull();
	});

	it("rejects malformed strings", () => {
		expect(parseCalendarDate("2026-6-25")).toBeNull();
		expect(parseCalendarDate("2026-06-25 ")).toBeNull();
		expect(parseCalendarDate("garbage")).toBeNull();
	});
});

describe("isValidCalendarDate", () => {
	it("is true for a real date and false for an impossible one", () => {
		expect(isValidCalendarDate("2026-06-25")).toBe(true);
		expect(isValidCalendarDate("2026-13-45")).toBe(false);
	});
});
