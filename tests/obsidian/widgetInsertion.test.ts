import { describe, expect, it } from "vitest";
import {
	findBottomAnchor,
	insertAfterElement,
	insertWidgetAtBottom,
} from "../../src/obsidian/widgetInsertion";

function div(className?: string): HTMLElement {
	const el = document.createElement("div");
	if (className) {
		el.className = className;
	}
	return el;
}

describe("findBottomAnchor", () => {
	it("prefers the cm-contentContainer when a cm-content exists (Live Preview)", () => {
		const sizer = div("cm-sizer");
		const contentContainer = div("cm-contentContainer");
		const content = div("cm-content");
		contentContainer.appendChild(content);
		sizer.appendChild(contentContainer);

		expect(findBottomAnchor(sizer)).toBe(contentContainer);
	});

	it("returns the last real child, skipping pusher/footer/existing widget (Reading mode)", () => {
		const sizer = div("markdown-preview-sizer");
		const pusher = div("markdown-preview-pusher");
		const content = div("real-content");
		const footer = div("mod-footer");
		const oldWidget = div("daytasks-widget-host");
		sizer.append(pusher, content, footer, oldWidget);

		expect(findBottomAnchor(sizer)).toBe(content);
	});

	it("returns null for an empty container", () => {
		expect(findBottomAnchor(div("markdown-preview-sizer"))).toBeNull();
	});
});

describe("insertAfterElement", () => {
	it("inserts the widget directly after the anchor", () => {
		const parent = div();
		const anchor = div("anchor");
		const trailing = div("trailing");
		parent.append(anchor, trailing);
		const widget = div("widget");

		expect(insertAfterElement(anchor, widget)).toBe(true);
		expect(anchor.nextElementSibling).toBe(widget);
		expect(widget.nextElementSibling).toBe(trailing);
	});

	it("returns false when the anchor has no parent", () => {
		expect(insertAfterElement(div("orphan"), div("widget"))).toBe(false);
	});
});

describe("insertWidgetAtBottom", () => {
	it("places the widget after the bottom anchor", () => {
		const sizer = div("markdown-preview-sizer");
		const content = div("real-content");
		const footer = div("mod-footer");
		sizer.append(content, footer);
		const widget = div("daytasks-widget-host");

		insertWidgetAtBottom(sizer, widget);

		expect(content.nextElementSibling).toBe(widget);
	});

	it("appends to the container when no anchor is found", () => {
		const sizer = div("markdown-preview-sizer");
		const widget = div("daytasks-widget-host");

		insertWidgetAtBottom(sizer, widget);

		expect(sizer.lastElementChild).toBe(widget);
	});
});
