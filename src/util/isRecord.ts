/** Narrows an unknown value to a non-null object (a string-keyed record). */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
