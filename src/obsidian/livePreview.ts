import type { Extension } from "@codemirror/state";
import { EditorView, PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { applyBottomOffset, insertWidgetAtBottom } from "./widgetInsertion";

/** Everything the Live Preview widget needs from the plugin, kept narrow. */
export interface LivePreviewWidgetHost {
	isEnabled(): boolean;
	getActiveNotePath(): string | null;
	/** Renders the widget into `container`; returns true if a widget was drawn. */
	renderWidget(container: HTMLElement, notePath: string): boolean;
	/** Monotonic counter bumped whenever tasks or settings change. */
	version(): number;
}

const CM_WIDGET_CLASS = "daytasks-cm-widget";

function findSizer(view: EditorView): HTMLElement | null {
	return (
		view.dom
			.closest(".markdown-source-view")
			?.querySelector<HTMLElement>(".cm-sizer") ?? null
	);
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

			constructor(view: EditorView) {
				this.sync(view);
			}

			update(update: ViewUpdate): void {
				this.sync(update.view);
			}

			destroy(): void {
				this.remove();
			}

			private sync(view: EditorView): void {
				const container = findSizer(view);
				const path = host.getActiveNotePath();
				if (!host.isEnabled() || !path || !container) {
					this.remove();
					return;
				}

				const key = `${path}|${host.version()}`;
				const attached = this.widget?.parentElement != null;
				if (this.widget && attached && key === this.lastKey) {
					// Content height changes as the user types — keep the gap trimmed.
					applyBottomOffset(container, this.widget);
					return;
				}

				this.remove();
				this.cleanupOrphans(container);

				const wrapper = document.createElement("div");
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
				requestAnimationFrame(() => {
					if (widget.parentElement) {
						applyBottomOffset(container, widget);
					}
				});
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
				this.widget?.remove();
				this.widget = null;
				this.lastKey = "";
			}
		}
	);
}
