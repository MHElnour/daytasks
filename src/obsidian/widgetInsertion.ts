/**
 * Bottom-of-note widget insertion, ported from TaskNotes
 * RelationshipsDecorations.ts. Injects a widget as an inline block after the
 * last real content element, so it flows in the document body, scrolls with the
 * note, and grows with content — instead of a docked panel.
 *
 * Targets:
 *   - Live Preview:  .cm-sizer  (anchor: .cm-contentContainer)
 *   - Reading mode:  .markdown-preview-sizer  (anchor: last real child)
 */

/** Classes that are never valid bottom anchors (our own widgets / chrome). */
const NON_ANCHOR_CLASSES = [
	"daytasks-cm-widget",
	"daytasks-widget-host",
	"embedded-backlinks",
	"markdown-preview-pusher",
	"mod-footer",
];

/** CSS custom property used to cancel CodeMirror's spacer gap below content. */
export const WIDGET_MARGIN_TOP_VAR = "--daytasks-widget-margin-top";

function htmlChildren(container: HTMLElement): HTMLElement[] {
	return Array.from(container.children).filter(
		(child): child is HTMLElement => child.instanceOf(HTMLElement)
	);
}

export function insertAfterElement(anchor: Element, widget: HTMLElement): boolean {
	const parent = anchor.parentNode;
	if (!parent) {
		return false;
	}
	parent.insertBefore(widget, anchor.nextSibling);
	return true;
}

export function findBottomAnchor(container: HTMLElement): HTMLElement | null {
	const cmContent = container.querySelector<HTMLElement>(".cm-content");
	if (cmContent) {
		return cmContent.closest<HTMLElement>(".cm-contentContainer") ?? cmContent;
	}

	const children = htmlChildren(container).filter(
		(child) => !NON_ANCHOR_CLASSES.some((cls) => child.classList.contains(cls))
	);
	return children.length > 0 ? children[children.length - 1] : null;
}

function parsePixelValue(value: string): number | null {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function defaultMarginTop(widget: HTMLElement): number {
	const view = widget.ownerDocument.defaultView ?? window;
	const style = view.getComputedStyle(widget);
	const marginTop = parsePixelValue(style.marginTop);
	if (marginTop !== null) {
		return marginTop;
	}
	const fontSize = parsePixelValue(style.fontSize);
	return fontSize !== null ? fontSize * 1.5 : 24;
}

function visibleBottom(element: HTMLElement): number | null {
	const rect = element.getBoundingClientRect();
	if (rect.width <= 0 && rect.height <= 0) {
		return null;
	}
	return rect.bottom;
}

function renderedBottom(element: HTMLElement): number | null {
	let bottom = visibleBottom(element);
	element.querySelectorAll<HTMLElement>("*").forEach((child) => {
		const childBottom = visibleBottom(child);
		if (childBottom !== null && (bottom === null || childBottom > bottom)) {
			bottom = childBottom;
		}
	});
	return bottom;
}

/**
 * Removes the gap CodeMirror leaves between the last text line and the bottom of
 * .cm-contentContainer by shrinking the widget's top margin accordingly.
 */
export function applyBottomOffset(container: HTMLElement, widget: HTMLElement): void {
	widget.style.removeProperty(WIDGET_MARGIN_TOP_VAR);

	const cmContent = container.querySelector<HTMLElement>(".cm-content");
	if (!cmContent) {
		return;
	}

	const lines = htmlChildren(cmContent).filter((child) =>
		child.classList.contains("cm-line")
	);
	let contentBottom: number | null = null;
	for (const line of lines) {
		const lineBottom = renderedBottom(line);
		if (lineBottom !== null && (contentBottom === null || lineBottom > contentBottom)) {
			contentBottom = lineBottom;
		}
	}

	const contentContainer = cmContent.closest<HTMLElement>(".cm-contentContainer");
	if (contentBottom === null || !contentContainer) {
		return;
	}

	const spacerGap = Math.max(
		0,
		Math.round(contentContainer.getBoundingClientRect().bottom - contentBottom)
	);
	if (spacerGap > 0) {
		const adjusted = Math.round(defaultMarginTop(widget) - spacerGap);
		widget.style.setProperty(WIDGET_MARGIN_TOP_VAR, `${adjusted}px`);
	}
}

/** Inserts `widget` after the bottom content anchor, then trims the spacer gap. */
export function insertWidgetAtBottom(container: HTMLElement, widget: HTMLElement): void {
	const anchor = findBottomAnchor(container);
	if (anchor) {
		insertAfterElement(anchor, widget);
	} else {
		container.appendChild(widget);
	}
	applyBottomOffset(container, widget);
}
