/** Returns the current time as an ISO 8601 timestamp. */
export function nowIso(): string {
	return new Date().toISOString();
}
