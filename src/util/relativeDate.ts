const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtcDays(date: string): number | null {
	const match = date.match(DATE_PATTERN);
	if (!match) {
		return null;
	}
	const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
	return Math.floor(ms / 86400000);
}

/** "Today" / "Tomorrow" / "Yesterday" relative to `reference`, else the date. */
export function formatRelativeDate(date: string, reference: string): string {
	const a = toUtcDays(date);
	const b = toUtcDays(reference);
	if (a === null || b === null) {
		return date;
	}
	const diff = a - b;
	if (diff === 0) return "Today";
	if (diff === 1) return "Tomorrow";
	if (diff === -1) return "Yesterday";
	return date;
}

/** True when a due date is before the reference and the task is not completed. */
export function isOverdue(
	due: string | undefined,
	reference: string,
	completed: boolean
): boolean {
	if (!due || completed) {
		return false;
	}
	// YYYY-MM-DD compares chronologically as plain strings.
	return due < reference;
}
