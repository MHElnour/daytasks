import { describe, expect, it } from "vitest";
import { nowIso } from "../../src/util/time";

describe("nowIso", () => {
	it("returns the current time as an ISO 8601 string", () => {
		const value = nowIso();

		expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		expect(new Date(value).toISOString()).toBe(value);
	});
});
