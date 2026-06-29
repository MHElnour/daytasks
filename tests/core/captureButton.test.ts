import { describe, expect, it } from "vitest";
import { hasCaptureMarker, shouldShowCaptureButton } from "../../src/core/captureButton";

describe("hasCaptureMarker", () => {
	it("detects a backticked task id", () => {
		expect(hasCaptureMarker("Email the board  `TSK-8cA562sd`")).toBe(true);
	});

	it("is false when there is no marker", () => {
		expect(hasCaptureMarker("Email the board")).toBe(false);
	});

	it("is false for a bare task id without backticks", () => {
		expect(hasCaptureMarker("see TSK-8cA562sd later")).toBe(false);
	});
});

describe("shouldShowCaptureButton", () => {
	it("is true for a non-empty, uncaptured line", () => {
		expect(shouldShowCaptureButton("Buy milk")).toBe(true);
	});

	it("is false for an empty or whitespace-only line", () => {
		expect(shouldShowCaptureButton("")).toBe(false);
		expect(shouldShowCaptureButton("   ")).toBe(false);
	});

	it("is false for an already-captured line", () => {
		expect(shouldShowCaptureButton("Buy milk  `TSK-8cA562sd`")).toBe(false);
	});
});
