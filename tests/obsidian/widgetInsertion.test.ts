import { describe, expect, it, vi } from "vitest";
import {
	applyBottomOffset,
	findBottomAnchor,
	insertAfterElement,
	insertWidgetAtBottom,
	WIDGET_MARGIN_TOP_VAR,
} from "../../src/obsidian/widgetInsertion";

function div(className?: string): HTMLElement {
	const el = document.createElement("div");
	if (className) {
		el.className = className;
	}
	return el;
}

/** Forces a fixed layout rect so happy-dom (which has no layout) can drive the
 *  bottom-offset measurement maths. Only `.bottom` is read for the gap. */
function stubRect(el: HTMLElement, bottom: number): void {
	el.getBoundingClientRect = () =>
		({ x: 0, y: 0, top: 0, left: 0, right: 10, width: 10, height: 10, bottom, toJSON: () => ({}) }) as DOMRect;
}

/** Live Preview scaffold: a `.cm-sizer` with one text line whose bottom sits
 *  `gap` px above the content container's bottom (the spacer CodeMirror leaves). */
function livePreviewSizer(lineBottom: number, containerBottom: number) {
	const sizer = div("cm-sizer");
	const contentContainer = div("cm-contentContainer");
	const content = div("cm-content");
	const line = div("cm-line");
	stubRect(line, lineBottom);
	stubRect(contentContainer, containerBottom);
	content.appendChild(line);
	contentContainer.appendChild(content);
	sizer.appendChild(contentContainer);
	const widget = div("daytasks-cm-widget");
	sizer.appendChild(widget);
	return { sizer, widget };
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

describe("applyBottomOffset", () => {
	it("sets the margin var to trim CodeMirror's spacer gap", () => {
		const { sizer, widget } = livePreviewSizer(150, 200);

		applyBottomOffset(sizer, widget);

		expect(widget.style.getPropertyValue(WIDGET_MARGIN_TOP_VAR)).not.toBe("");
	});

	it("does NOT re-mutate style on a repeat measure with unchanged geometry (RO loop break)", () => {
		const { sizer, widget } = livePreviewSizer(150, 200);
		applyBottomOffset(sizer, widget);

		// Our margin write itself fires CodeMirror's ResizeObserver → geometryChanged
		// → another applyBottomOffset. The gap is measured on .cm-contentContainer
		// (a sibling ABOVE the widget) so it is unchanged; a second pass must be a
		// no-op, or the feedback loop never settles.
		const setSpy = vi.spyOn(widget.style, "setProperty");
		const removeSpy = vi.spyOn(widget.style, "removeProperty");

		applyBottomOffset(sizer, widget);

		expect(setSpy).not.toHaveBeenCalled();
		expect(removeSpy).not.toHaveBeenCalled();
	});

	it("re-applies when the content height actually changes", () => {
		const { sizer, widget } = livePreviewSizer(150, 200);
		applyBottomOffset(sizer, widget);
		const first = widget.style.getPropertyValue(WIDGET_MARGIN_TOP_VAR);

		// A new line shrinks the spacer gap (line bottom rises toward the container).
		stubRect(sizer.querySelector(".cm-line") as HTMLElement, 180);
		applyBottomOffset(sizer, widget);

		expect(widget.style.getPropertyValue(WIDGET_MARGIN_TOP_VAR)).not.toBe(first);
	});
});
