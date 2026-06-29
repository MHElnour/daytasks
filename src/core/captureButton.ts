import { TASK_ID_INLINE_SOURCE } from "./taskIds";

// Matches the marker formatCapturedLine writes: a backticked task id, e.g.
// `TSK-8cA562sd`. Reuses the canonical id source so the two never drift.
const CAPTURE_MARKER_RE = new RegExp("`" + TASK_ID_INLINE_SOURCE + "`");

/** True when a line already carries a capture marker (a backticked TSK id). */
export function hasCaptureMarker(line: string): boolean {
	return CAPTURE_MARKER_RE.test(line);
}

/**
 * True when the active line is worth showing a capture button on: it has
 * non-whitespace content and is not already captured.
 */
export function shouldShowCaptureButton(line: string): boolean {
	return line.trim().length > 0 && !hasCaptureMarker(line);
}
