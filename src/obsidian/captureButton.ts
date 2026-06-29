import type { Extension } from "@codemirror/state";
import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import { setIcon, setTooltip } from "obsidian";
import { shouldShowCaptureButton } from "../core/captureButton";

/** Everything the capture button needs from the plugin, kept narrow. */
export interface CaptureButtonHost {
	/** enableInlineCapture && showCaptureButton */
	isEnabled(): boolean;
	/** Capture the given 0-based editor line as a task. */
	capture(line: number): void;
}

const BUTTON_CLASS = "daytasks-capture-button";

class CaptureButtonWidget extends WidgetType {
	constructor(
		private readonly host: CaptureButtonHost,
		private readonly line: number
	) {
		super();
	}

	eq(other: CaptureButtonWidget): boolean {
		return other.line === this.line;
	}

	toDOM(view: EditorView): HTMLElement {
		// Build in the editor's own document so the button renders in a
		// popout/detached window, not just the focused one.
		const doc = view.dom.ownerDocument;
		const button = doc.createElement("button");
		button.className = BUTTON_CLASS;
		button.type = "button";
		button.setAttribute("aria-label", "Capture task from line");
		const icon = doc.createElement("span");
		icon.className = `${BUTTON_CLASS}__icon`;
		button.appendChild(icon);
		setIcon(icon, "file-text");
		setTooltip(button, "Capture task from line", { placement: "top" });

		// pointerdown (mousedown fallback) so the line is captured before focus
		// shifts; preventDefault keeps the editor caret/selection untouched.
		const activationEvent =
			typeof window !== "undefined" && "PointerEvent" in window
				? "pointerdown"
				: "mousedown";
		button.addEventListener(activationEvent, (event) => {
			event.preventDefault();
			this.host.capture(this.line);
		});
		return button;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

function buildDecorations(view: EditorView, host: CaptureButtonHost): DecorationSet {
	if (!host.isEnabled()) {
		return Decoration.none;
	}
	const head = view.state.selection.main.head;
	const line = view.state.doc.lineAt(head);
	if (!shouldShowCaptureButton(line.text)) {
		return Decoration.none;
	}
	// CM6 lines are 1-based; the Obsidian Editor API is 0-based.
	const widget = new CaptureButtonWidget(host, line.number - 1);
	return Decoration.set([Decoration.widget({ widget, side: 1 }).range(line.to)]);
}

/**
 * Renders a single capture button at the end of the cursor line (Live Preview /
 * editor mode) when the line is non-empty and not already captured. Clicking it
 * captures that line via the host. Viewport/selection-scoped: one line of work
 * per update.
 */
export function captureButtonExtension(host: CaptureButtonHost): Extension {
	return ViewPlugin.fromClass(
		class implements PluginValue {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildDecorations(view, host);
			}

			update(update: ViewUpdate): void {
				if (update.docChanged || update.selectionSet || update.viewportChanged) {
					this.decorations = buildDecorations(update.view, host);
				}
			}
		},
		{ decorations: (value) => value.decorations }
	);
}
