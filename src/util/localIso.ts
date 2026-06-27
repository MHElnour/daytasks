/**
 * Formats a Date as an ISO-8601 string with milliseconds and the local UTC offset.
 * Example: `2026-06-27T18:18:47.717+03:00`
 *
 * Never calls `Date.now()` or `new Date()` — callers must supply the Date so
 * behaviour is deterministic and testable.
 */
export function localIso(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	const seconds = String(date.getSeconds()).padStart(2, "0");
	const ms = String(date.getMilliseconds()).padStart(3, "0");

	// getTimezoneOffset() returns minutes and its sign is inverted vs ISO offset:
	// a +03:00 zone returns -180, so we negate to get the printed sign.
	const offsetMin = date.getTimezoneOffset();
	const sign = offsetMin <= 0 ? "+" : "-";
	const absMin = Math.abs(offsetMin);
	const offsetHH = String(Math.floor(absMin / 60)).padStart(2, "0");
	const offsetMM = String(absMin % 60).padStart(2, "0");

	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${sign}${offsetHH}:${offsetMM}`;
}
