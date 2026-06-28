import { describe, expect, it } from "vitest";
import {
	asStringOr,
	asOptionalString,
	asBooleanOr,
	asFiniteNumberOr,
	asFiniteNumber,
	asStringArrayOr,
	asUniqueStringArray,
} from "../../src/util/coerce";

describe("asStringOr", () => {
	it("returns the string, else the fallback", () => {
		expect(asStringOr("x", "f")).toBe("x");
		expect(asStringOr(5, "f")).toBe("f");
		expect(asStringOr(undefined, "f")).toBe("f");
	});
});

describe("asOptionalString", () => {
	it("returns the string, else undefined", () => {
		expect(asOptionalString("x")).toBe("x");
		expect(asOptionalString(5)).toBeUndefined();
	});
});

describe("asBooleanOr", () => {
	it("returns the boolean, else the fallback", () => {
		expect(asBooleanOr(true, false)).toBe(true);
		expect(asBooleanOr("nope", false)).toBe(false);
	});
});

describe("asFiniteNumberOr", () => {
	it("returns a finite number, else the fallback", () => {
		expect(asFiniteNumberOr(3, 0)).toBe(3);
		expect(asFiniteNumberOr(Infinity, 0)).toBe(0);
		expect(asFiniteNumberOr(Number.NaN, 0)).toBe(0);
		expect(asFiniteNumberOr("3", 0)).toBe(0);
	});
});

describe("asFiniteNumber", () => {
	it("returns a finite number, else undefined", () => {
		expect(asFiniteNumber(3)).toBe(3);
		expect(asFiniteNumber(Number.NaN)).toBeUndefined();
		expect(asFiniteNumber("3")).toBeUndefined();
	});
});

describe("asStringArrayOr", () => {
	it("keeps strings in order, INCLUDING duplicates", () => {
		expect(asStringArrayOr(["a", "a", "b", 2], [])).toEqual(["a", "a", "b"]);
	});

	it("returns a fresh copy of the fallback for non-arrays", () => {
		const fallback = ["x"];
		const out = asStringArrayOr("nope", fallback);
		expect(out).toEqual(["x"]);
		expect(out).not.toBe(fallback);
	});
});

describe("asUniqueStringArray", () => {
	it("dedupes strings, first occurrence wins", () => {
		expect(asUniqueStringArray(["a", "a", "b", 2])).toEqual(["a", "b"]);
	});

	it("returns [] for non-arrays", () => {
		expect(asUniqueStringArray("nope")).toEqual([]);
	});
});
