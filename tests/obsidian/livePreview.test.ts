import { describe, expect, it } from "vitest";
import { affectsWidgetLayout } from "../../src/obsidian/widgetLayout";

const signals = (over: Partial<Record<"docChanged" | "geometryChanged" | "viewportChanged", boolean>>) => ({
	docChanged: false,
	geometryChanged: false,
	viewportChanged: false,
	...over,
});

describe("affectsWidgetLayout", () => {
	it("re-measures on a document change", () => {
		expect(affectsWidgetLayout(signals({ docChanged: true }))).toBe(true);
	});

	it("re-measures on a geometry change", () => {
		expect(affectsWidgetLayout(signals({ geometryChanged: true }))).toBe(true);
	});

	it("re-measures on a viewport change (external reload re-renders in a later update)", () => {
		// A git pull on an open daily note swaps the document, then CodeMirror
		// re-renders the viewport in a follow-up update carrying only
		// viewportChanged. Missing this leaves the trim margin overlapping the
		// new text until the note is reopened.
		expect(affectsWidgetLayout(signals({ viewportChanged: true }))).toBe(true);
	});

	it("ignores selection-only updates (cursor moves cannot change content height)", () => {
		expect(affectsWidgetLayout(signals({}))).toBe(false);
	});
});
