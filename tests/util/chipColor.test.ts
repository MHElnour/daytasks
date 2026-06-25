import { describe, expect, it } from "vitest";
import { chipHue } from "../../src/util/chipColor";

describe("chipHue", () => {
	it("is deterministic for the same label", () => {
		expect(chipHue("work")).toBe(chipHue("work"));
	});

	it("returns a hue within [0, 360)", () => {
		for (const label of ["work", "home", "health", "finance", "personal", ""]) {
			const hue = chipHue(label);
			expect(hue).toBeGreaterThanOrEqual(0);
			expect(hue).toBeLessThan(360);
		}
	});

	it("gives different labels different hues (usually)", () => {
		expect(chipHue("work")).not.toBe(chipHue("personal"));
	});
});
