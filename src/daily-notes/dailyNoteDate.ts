import { isValidCalendarDate } from "../util/calendarDate";
import { noteBasename } from "../util/notePath";

const DAILY_NOTE_DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:$|\s)/;

export function getDailyNoteDateFromPath(path: string): string | null {
	const match = noteBasename(path).match(DAILY_NOTE_DATE_PATTERN);
	// A YYYY-MM-DD shape is not enough — reject impossible dates (e.g. 2026-13-45).
	if (!match || !isValidCalendarDate(match[1])) {
		return null;
	}
	return match[1];
}

/** True when `path` lives inside `folder` (empty folder matches anything). */
export function isWithinDailyNoteFolder(path: string, folder: string): boolean {
	const normalized = folder.replace(/\/+$/, "");
	if (!normalized) {
		return true;
	}
	return path.startsWith(`${normalized}/`);
}

/**
 * Returns the link target (path without .md extension) for a daily note on
 * `date`, honoring the configured `folder`. The inverse of `resolveDailyNoteDate`:
 * `resolveDailyNoteDate(dailyNotePathForDate(d, f) + ".md", f) === d`.
 */
export function dailyNotePathForDate(date: string, folder: string): string {
	const normalized = folder.replace(/\/+$/, "");
	if (!normalized) {
		return date;
	}
	return `${normalized}/${date}`;
}

/**
 * Resolves a daily-note date from a path, honoring the configured daily-note
 * folder. Returns null when the note is outside the folder or its filename is
 * not a `YYYY-MM-DD` daily note.
 */
export function resolveDailyNoteDate(path: string, folder: string): string | null {
	if (!isWithinDailyNoteFolder(path, folder)) {
		return null;
	}
	return getDailyNoteDateFromPath(path);
}
