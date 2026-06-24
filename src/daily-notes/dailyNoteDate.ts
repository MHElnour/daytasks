import { noteBasename } from "../util/notePath";

const DAILY_NOTE_DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:$|\s)/;

export function getDailyNoteDateFromPath(path: string): string | null {
	const match = noteBasename(path).match(DAILY_NOTE_DATE_PATTERN);

	return match ? match[1] : null;
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
