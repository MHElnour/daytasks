import { describe, expect, it } from "vitest";
import { generateTaskId, isTaskId } from "../../src/core/taskIds";

describe("isTaskId", () => {
	it("accepts canonical TSK ids with an 8-character suffix", () => {
		expect(isTaskId("TSK-8cA562sd")).toBe(true);
		expect(isTaskId("TSK-AAAAAAAA")).toBe(true);
	});

	it("rejects ids with the wrong prefix, length, or characters", () => {
		expect(isTaskId("TSK-short")).toBe(false);
		expect(isTaskId("TSK-8cA562sde")).toBe(false);
		expect(isTaskId("XYZ-8cA562sd")).toBe(false);
		expect(isTaskId("TSK-8cA562s!")).toBe(false);
	});
});

describe("generateTaskId", () => {
	it("produces a valid id using the injected random source", () => {
		expect(generateTaskId(() => 0)).toBe("TSK-AAAAAAAA");
		expect(isTaskId(generateTaskId(() => 0))).toBe(true);
	});
});
