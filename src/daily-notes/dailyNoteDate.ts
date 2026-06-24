const DAILY_NOTE_DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:$|\s)/;

export function getDailyNoteDateFromPath(path: string): string | null {
	const fileName = path.split(/[\\/]/).pop() ?? path;
	const name = fileName.replace(/\.md$/i, "");
	const match = name.match(DAILY_NOTE_DATE_PATTERN);

	return match ? match[1] : null;
}
