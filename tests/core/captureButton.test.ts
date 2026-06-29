import { describe, expect, it } from "vitest";
import {
	hasCaptureMarker,
	isCheckboxLine,
	shouldShowCaptureButton,
} from "../../src/core/captureButton";

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

describe("isCheckboxLine", () => {
	it("matches unordered checkbox lines with content", () => {
		expect(isCheckboxLine("- [ ] Buy milk")).toBe(true);
		expect(isCheckboxLine("* [x] Done thing")).toBe(true);
		expect(isCheckboxLine("+ [/] In progress")).toBe(true);
	});

	it("matches numbered checkbox lines", () => {
		expect(isCheckboxLine("1. [ ] First")).toBe(true);
		expect(isCheckboxLine("2) [ ] Second")).toBe(true);
	});

	it("matches indented and blockquoted checkbox lines", () => {
		expect(isCheckboxLine("\t- [ ] Indented")).toBe(true);
		expect(isCheckboxLine("> - [ ] Quoted")).toBe(true);
	});

	it("is false for a checkbox with no task content", () => {
		expect(isCheckboxLine("- [ ] ")).toBe(false);
		expect(isCheckboxLine("- [ ]")).toBe(false);
	});

	it("is false for a plain line, a bullet without a checkbox, or prose", () => {
		expect(isCheckboxLine("Buy milk")).toBe(false);
		expect(isCheckboxLine("- Buy milk")).toBe(false);
		expect(isCheckboxLine("1. Buy milk")).toBe(false);
		expect(isCheckboxLine("")).toBe(false);
	});
});

describe("shouldShowCaptureButton", () => {
	it("is true for an uncaptured checkbox line with content", () => {
		expect(shouldShowCaptureButton("- [ ] Buy milk")).toBe(true);
	});

	it("is false for a plain (non-checkbox) line", () => {
		expect(shouldShowCaptureButton("Buy milk")).toBe(false);
		expect(shouldShowCaptureButton("- Buy milk")).toBe(false);
	});

	it("is false for an empty or whitespace-only line", () => {
		expect(shouldShowCaptureButton("")).toBe(false);
		expect(shouldShowCaptureButton("   ")).toBe(false);
	});

	it("is false for an already-captured checkbox line", () => {
		expect(shouldShowCaptureButton("- [ ] Buy milk  `TSK-8cA562sd`")).toBe(false);
	});
});
