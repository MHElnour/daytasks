import { parseCalendarDate } from "./calendarDate";

const MONTHS = [
	"Jan", "Feb", "Mar", "Apr", "May", "Jun",
	"Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Formats a YYYY-MM-DD date as "Jun 25". Returns the input if unparseable. */
export function formatMonthDay(date: string): string {
	const parsed = parseCalendarDate(date);
	if (!parsed) {
		return date;
	}
	return `${MONTHS[parsed.month - 1]} ${parsed.day}`;
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
