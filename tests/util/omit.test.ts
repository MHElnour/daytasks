import { describe, expect, it } from "vitest";
import { omit } from "../../src/util/omit";

describe("omit", () => {
	it("returns a shallow copy without the given key", () => {
		expect(omit({ a: 1, b: 2 }, "b")).toEqual({ a: 1 });
	});

	it("does not mutate the original", () => {
		const original = { a: 1, b: 2 };
		omit(original, "a");
		expect(original).toEqual({ a: 1, b: 2 });
	});

	it("is a no-op copy when the key is absent", () => {
		const value: { a: number; b?: number } = { a: 1 };
		expect(omit(value, "b")).toEqual({ a: 1 });
	});
});
