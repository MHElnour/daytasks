const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface CalendarDate {
	year: number;
	month: number;
	day: number;
}

function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Parses a strict `YYYY-MM-DD` string into calendar components, validating the
 * month (1-12) and day (1-last-of-month, leap-aware). Returns null for any
 * malformed or impossible date (e.g. `2026-13-45`, `2026-02-29`). Pure
 * arithmetic — no `Date`, so no timezone surprises.
 */
export function parseCalendarDate(value: string): CalendarDate | null {
	const match = ISO_DATE.exec(value);
	if (!match) {
		return null;
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (month < 1 || month > 12) {
		return null;
	}
	const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
	if (day < 1 || day > maxDay) {
		return null;
	}
	return { year, month, day };
}

/** True when `value` is a real `YYYY-MM-DD` calendar date. */
export function isValidCalendarDate(value: string): boolean {
	return parseCalendarDate(value) !== null;
}
