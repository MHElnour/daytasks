import { localDate } from "./localIso";

/** Returns the current time as an ISO 8601 timestamp. */
export function nowIso(): string {
	return new Date().toISOString();
}

/** Returns the current local date as YYYY-MM-DD. */
export function todayDate(): string {
	return localDate(new Date());
}
