import { describe, expect, it } from "vitest";
import { DEFAULT_PRIORITIES } from "../../src/core/status";
import { nextPriority } from "../../src/core/priorityCycle";

describe("nextPriority", () => {
	// Real priorities by weight: low → normal → high. "none" is the cleared state
	// (undefined), so the cycle is undefined → low → normal → high → undefined.
	it("advances an unset priority to the lowest real priority", () => {
		expect(nextPriority(undefined, DEFAULT_PRIORITIES)).toBe("low");
	});

	it("advances through the real priorities by weight", () => {
		expect(nextPriority("low", DEFAULT_PRIORITIES)).toBe("normal");
		expect(nextPriority("normal", DEFAULT_PRIORITIES)).toBe("high");
	});

	it("wraps the highest priority back to cleared (undefined)", () => {
		expect(nextPriority("high", DEFAULT_PRIORITIES)).toBeUndefined();
	});

	it("treats the stored 'none' value as the cleared slot", () => {
		expect(nextPriority("none", DEFAULT_PRIORITIES)).toBe("low");
	});

	it("returns the current value when no priorities are configured", () => {
		expect(nextPriority("normal", [])).toBe("normal");
	});
});
