import { describe, expect, it } from "vitest";
import { formatEstimateMinutes, parseEstimateMinutes } from "../../src/util/estimate";

describe("parseEstimateMinutes", () => {
	it("returns undefined for empty input", () => {
		expect(parseEstimateMinutes("")).toBeUndefined();
		expect(parseEstimateMinutes("   ")).toBeUndefined();
	});

	it("parses bare numbers as minutes", () => {
		expect(parseEstimateMinutes("30")).toBe(30);
		expect(parseEstimateMinutes("90")).toBe(90);
	});

	it("parses minutes and hours suffixes", () => {
		expect(parseEstimateMinutes("45m")).toBe(45);
		expect(parseEstimateMinutes("2h")).toBe(120);
		expect(parseEstimateMinutes("1h30m")).toBe(90);
		expect(parseEstimateMinutes("1h 30m")).toBe(90);
	});

	it("is case-insensitive and tolerates spaces", () => {
		expect(parseEstimateMinutes(" 2H ")).toBe(120);
	});

	it("returns undefined for unparseable input", () => {
		expect(parseEstimateMinutes("soon")).toBeUndefined();
		expect(parseEstimateMinutes("h")).toBeUndefined();
	});
});

describe("formatEstimateMinutes", () => {
	it("formats minutes, hours, and combinations", () => {
		expect(formatEstimateMinutes(30)).toBe("30m");
		expect(formatEstimateMinutes(60)).toBe("1h");
		expect(formatEstimateMinutes(90)).toBe("1h30m");
		expect(formatEstimateMinutes(120)).toBe("2h");
	});

	it("returns undefined for missing or non-positive values", () => {
		expect(formatEstimateMinutes(undefined)).toBeUndefined();
		expect(formatEstimateMinutes(0)).toBeUndefined();
	});
});
