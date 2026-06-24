import { noteBasename } from "../util/notePath";

const DAILY_NOTE_DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:$|\s)/;

export function getDailyNoteDateFromPath(path: string): string | null {
	const match = noteBasename(path).match(DAILY_NOTE_DATE_PATTERN);

	return match ? match[1] : null;
}
