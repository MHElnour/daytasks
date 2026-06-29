import { TASK_ID_INLINE_SOURCE } from "./taskIds";

// Matches the marker formatCapturedLine writes: a backticked task id, e.g.
// `TSK-8cA562sd`. Reuses the canonical id source so the two never drift.
const CAPTURE_MARKER_RE = new RegExp("`" + TASK_ID_INLINE_SOURCE + "`");

// A Markdown checkbox line with task content: optional indent, any number of
// blockquote markers, a bullet (-,*,+) or numbered (1./1)) marker, a
// `[ ]`-style checkbox, then at least one non-space character of task text. No
// regex lookbehind (iOS-safe).
const CHECKBOX_LINE_RE = /^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[[ xX/-]\]\s+\S/;

/** True when a line already carries a capture marker (a backticked TSK id). */
export function hasCaptureMarker(line: string): boolean {
	return CAPTURE_MARKER_RE.test(line);
}

/** True when a line is a Markdown checkbox/task line with content (`- [ ] x`). */
export function isCheckboxLine(line: string): boolean {
	return CHECKBOX_LINE_RE.test(line);
}

/**
 * True when the active line is worth showing a capture button on: it is a
 * Markdown checkbox/task line with content and is not already captured. Plain
 * prose lines get no button — the command still captures any line.
 */
export function shouldShowCaptureButton(line: string): boolean {
	return isCheckboxLine(line) && !hasCaptureMarker(line);
}
