import type { Extension } from "@codemirror/state";
import { EditorView, PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { editorInfoField } from "obsidian";
import { applyBottomOffset, insertWidgetAtBottom } from "./widgetInsertion";
import { affectsWidgetLayout } from "./widgetLayout";

/** Everything the Live Preview widget needs from the plugin, kept narrow. */
export interface LivePreviewWidgetHost {
	isEnabled(): boolean;
	/** Renders the widget into `container`; returns true if a widget was drawn. */
	renderWidget(container: HTMLElement, notePath: string): boolean;
	/** Monotonic counter bumped whenever tasks or settings change. */
	version(): number;
	/**
	 * Destroys any drag-reorder handles whose list lives inside `widget`, called
	 * just before the widget is removed so a closed editor leaf doesn't leave a
	 * SortableJS instance (and its listeners) on a detached node (LIFE-3).
	 */
	detachDragFor(widget: HTMLElement): void;
}

const CM_WIDGET_CLASS = "daytasks-cm-widget";

function findSizer(view: EditorView): HTMLElement | null {
	return (
		view.dom
			.closest(".markdown-source-view")
			?.querySelector<HTMLElement>(".cm-sizer") ?? null
	);
}

/** Path of the file backing THIS editor (split-pane safe), not the active one. */
function notePathFromView(view: EditorView): string | null {
	return view.state.field(editorInfoField, false)?.file?.path ?? null;
}

/**
 * Live Preview integration. Injects the widget as a non-editable inline block
 * after the last content element in the editor's `.cm-sizer` (ported from
 * TaskNotes RelationshipsDecorations). It flows with the note body, scrolls, and
 * grows downward instead of stealing editor viewport like a docked panel.
 */
export function dailyTasksLivePreviewExtension(host: LivePreviewWidgetHost): Extension {
	return ViewPlugin.fromClass(
		class implements PluginValue {
			private widget: HTMLElement | null = null;
			private lastKey = "";
			/** Pending bottom-offset measure, tracked so rapid updates coalesce
			 *  into one rAF and can be cancelled on teardown. */
			private offsetFrame: { win: Window; id: number } | null = null;

			constructor(view: EditorView) {
				this.sync(view, true);
			}

			update(update: ViewUpdate): void {
				// Selection-only updates (cursor moves) cannot change content height,
				// so skip the bottom-offset re-measure for them and only re-measure
				// when the document, geometry, or viewport actually changed.
				this.sync(update.view, affectsWidgetLayout(update));
			}

			destroy(): void {
				this.remove();
			}

			private sync(view: EditorView, measureOffset: boolean): void {
				const container = findSizer(view);
				const path = notePathFromView(view);
				if (!host.isEnabled() || !path || !container) {
					this.remove();
					return;
				}

				const key = `${path}|${host.version()}`;
				const attached = this.widget?.parentElement != null;
				if (this.widget && attached && key === this.lastKey) {
					// Content height changes as the user types — keep the gap trimmed,
					// but only when geometry could have changed (rAF-batched, never
					// synchronously on every keystroke/cursor move).
					if (measureOffset) {
						this.scheduleOffsetRefresh(container, this.widget);
					}
					return;
				}

				this.remove();
				this.cleanupOrphans(container);

				// Build in THIS editor's document (not the focused window's) so the
				// widget renders correctly in a popout/detached split (LIFE-1).
				const wrapper = container.ownerDocument.createElement("div");
				wrapper.className = CM_WIDGET_CLASS;
				wrapper.setAttribute("contenteditable", "false");
				wrapper.spellcheck = false;

				let drawn = false;
				try {
					drawn = host.renderWidget(wrapper, path);
				} catch (error) {
					console.error("DayTasks: failed to render Live Preview widget", error);
				}
				if (!drawn) {
					return;
				}

				insertWidgetAtBottom(container, wrapper);
				this.widget = wrapper;
				this.lastKey = key;
				this.scheduleOffsetRefresh(container, wrapper);
			}

			private scheduleOffsetRefresh(container: HTMLElement, widget: HTMLElement): void {
				// Schedule on the editor's own window so the measure runs on the
				// right frame clock in a popout (LIFE-1).
				const win = container.ownerDocument.defaultView ?? window;
				// Coalesce bursts of layout updates — notably viewportChanged, which
				// fires on every scroll frame — into a single measure per frame.
				if (this.offsetFrame) {
					this.offsetFrame.win.cancelAnimationFrame(this.offsetFrame.id);
				}
				const id = win.requestAnimationFrame(() => {
					this.offsetFrame = null;
					if (widget.parentElement) {
						applyBottomOffset(container, widget);
					}
				});
				this.offsetFrame = { win, id };
			}

			private cleanupOrphans(container: HTMLElement): void {
				container
					.querySelectorAll<HTMLElement>(`.${CM_WIDGET_CLASS}`)
					.forEach((node) => {
						if (node !== this.widget) {
							node.remove();
						}
					});
			}

			private remove(): void {
				if (this.offsetFrame) {
					this.offsetFrame.win.cancelAnimationFrame(this.offsetFrame.id);
					this.offsetFrame = null;
				}
				if (this.widget) {
					// Drop drag handles while the widget is still attached, so the
					// host can match them by containment, then remove the node.
					host.detachDragFor(this.widget);
					this.widget.remove();
				}
				this.widget = null;
				this.lastKey = "";
			}
		}
	);
}
