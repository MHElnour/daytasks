/** Returns the current time as an ISO 8601 timestamp. */
export function nowIso(): string {
	return new Date().toISOString();
}

/** Returns the current local date as YYYY-MM-DD. */
export function todayDate(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = `${now.getMonth() + 1}`.padStart(2, "0");
	const day = `${now.getDate()}`.padStart(2, "0");
	return `${year}-${month}-${day}`;
}
