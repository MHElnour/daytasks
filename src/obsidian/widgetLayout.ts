/**
 * Pure helpers for deciding when the Live Preview widget's bottom-offset margin
 * must be re-measured. Kept free of Obsidian / CodeMirror imports so it can be
 * unit-tested without that runtime (the CM glue lives in `livePreview.ts`).
 */

/** The geometry-affecting flags of a CodeMirror update we care about. */
export interface WidgetLayoutSignals {
	docChanged: boolean;
	geometryChanged: boolean;
	viewportChanged: boolean;
}

/**
 * Whether an editor update can change where the widget's bottom sits, so the
 * trim margin must be re-measured. `viewportChanged` matters because an external
 * file change (e.g. a git pull on an open daily note) replaces the document and
 * CodeMirror re-renders the viewport in a *later* update that sets only
 * `viewportChanged` — without it the stale trim margin overlaps the new text
 * until the note is closed and reopened.
 */
export function affectsWidgetLayout(update: WidgetLayoutSignals): boolean {
	return update.docChanged || update.geometryChanged || update.viewportChanged;
}
