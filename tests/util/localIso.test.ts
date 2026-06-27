import { describe, expect, it } from "vitest";
import { localIso } from "../../src/util/localIso";

describe("localIso", () => {
	it("returns a string matching the expected format", () => {
		const date = new Date("2026-06-27T15:18:47.717Z");
		const result = localIso(date);
		expect(result).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/
		);
	});

	it("includes the correct local UTC offset", () => {
		const date = new Date("2026-06-27T15:18:47.717Z");
		const result = localIso(date);

		// Derive expected offset from the same date so this assertion holds in any timezone
		const offsetMin = date.getTimezoneOffset();
		const sign = offsetMin <= 0 ? "+" : "-";
		const absMin = Math.abs(offsetMin);
		const hh = String(Math.floor(absMin / 60)).padStart(2, "0");
		const mm = String(absMin % 60).padStart(2, "0");
		const expectedOffset = `${sign}${hh}:${mm}`;

		expect(result.endsWith(expectedOffset)).toBe(true);
	});

	it("uses the local date/time fields, not UTC", () => {
		const date = new Date("2026-06-27T15:18:47.717Z");
		const result = localIso(date);

		// The date-time portion should reflect local time
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");
		const seconds = String(date.getSeconds()).padStart(2, "0");
		const ms = String(date.getMilliseconds()).padStart(3, "0");
		const expectedPrefix = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;

		expect(result.startsWith(expectedPrefix)).toBe(true);
	});
});
