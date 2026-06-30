import { StateEffect, StateField } from "@codemirror/state";
import type { EditorState, Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { editorInfoField } from "obsidian";

/** Everything the Live Preview widget needs from the plugin, kept narrow. */
export interface LivePreviewWidgetHost {
	/** Whether the daily-note widget is enabled at all (the global setting). */
	isEnabled(): boolean;
	/** Whether `notePath` is a note that renders a widget (daily or detail note). */
	rendersWidget(notePath: string): boolean;
	/** Renders the widget into `container`; returns true if a widget was drawn. */
	renderWidget(container: HTMLElement, notePath: string): boolean;
	/** Monotonic counter bumped whenever tasks or settings change. */
	version(): number;
	/**
	 * Destroys any drag-reorder handles whose list lives inside `widget`, called
	 * when CodeMirror discards the widget's DOM so a closed/replaced editor leaf
	 * doesn't leave a SortableJS instance (and its listeners) on a detached node
	 * (LIFE-3).
	 */
	detachDragFor(widget: HTMLElement): void;
}

const CM_WIDGET_CLASS = "daytasks-cm-widget";

/**
 * Dispatched into a widget-bearing editor when tasks or settings change so the
 * decoration field rebuilds the widget against the new `host.version()`. A
 * StateField only re-runs on a transaction, and a bare data change carries none,
 * so the plugin nudges each editor with this effect (see main.ts
 * `nudgeWidgetEditors`).
 */
export const refreshWidget = StateEffect.define<void>();

/**
 * The task list, rendered as a CodeMirror block widget. CodeMirror lays it out
 * in the content flow — directly below the last line, above the scroll-past-end
 * space — and owns its height via the editor's height map. There is no sibling
 * injection into `.cm-sizer` and no fill-space measurement, so the widget's
 * position can never drift out of sync with the text.
 */
class TaskListWidget extends WidgetType {
	constructor(
		private readonly host: LivePreviewWidgetHost,
		private readonly notePath: string,
		private readonly version: number
	) {
		super();
	}

	/**
	 * Same note + same data version => CodeMirror keeps the existing DOM (and the
	 * live SortableJS drag handles inside it) and merely repositions the block. A
	 * version bump makes this false, so CodeMirror discards the old DOM — firing
	 * `destroy()` -> `detachDragFor` — and rebuilds against the fresh data.
	 */
	eq(other: TaskListWidget): boolean {
		return other.notePath === this.notePath && other.version === this.version;
	}

	toDOM(view: EditorView): HTMLElement {
		// Build in THIS editor's document (not the focused window's) so the widget
		// renders correctly in a popout/detached split (LIFE-1).
		const wrapper = view.dom.ownerDocument.createElement("div");
		wrapper.className = CM_WIDGET_CLASS;
		wrapper.setAttribute("contenteditable", "false");
		wrapper.spellcheck = false;
		try {
			this.host.renderWidget(wrapper, this.notePath);
		} catch (error) {
			console.error("DayTasks: failed to render Live Preview widget", error);
		}
		return wrapper;
	}

	/**
	 * Let the widget's own controls (checkboxes, drag handles) handle their events
	 * instead of the editor treating clicks inside as cursor placement / selection.
	 */
	ignoreEvent(): boolean {
		return true;
	}

	/** Drop SortableJS handles when CodeMirror discards this widget's DOM (LIFE-3). */
	destroy(dom: HTMLElement): void {
		this.host.detachDragFor(dom);
	}
}

/**
 * One block widget at the end of the document, or nothing when this editor's
 * note carries no widget. Recomputed cheaply (a single range) — never measured.
 */
function buildDecorations(state: EditorState, host: LivePreviewWidgetHost): DecorationSet {
	const path = state.field(editorInfoField, false)?.file?.path;
	if (!path || !host.isEnabled() || !host.rendersWidget(path)) {
		return Decoration.none;
	}
	const widget = Decoration.widget({
		widget: new TaskListWidget(host, path, host.version()),
		block: true,
		side: 1, // sort after the last line: the widget sits below the text
	});
	return Decoration.set([widget.range(state.doc.length)]);
}

/**
 * Live Preview integration. Provides the task list as a CodeMirror block widget
 * decoration at the end of the document through a StateField.
 *
 * It MUST be a field, not a view plugin: block decorations change the editor's
 * vertical layout, which is computed before view plugins run, so CodeMirror only
 * accepts height-affecting decorations from the state.
 */
export function dailyTasksLivePreviewExtension(host: LivePreviewWidgetHost): Extension {
	return StateField.define<DecorationSet>({
		create: (state) => buildDecorations(state, host),
		update(decorations, tr) {
			// Reposition when the document end moves, and rebuild when tasks/settings
			// change (signalled by refreshWidget). Selection moves and scrolls leave
			// the widget untouched — there is nothing to re-measure.
			if (tr.docChanged || tr.effects.some((effect) => effect.is(refreshWidget))) {
				return buildDecorations(tr.state, host);
			}
			return decorations;
		},
		provide: (field) => EditorView.decorations.from(field),
	});
}
