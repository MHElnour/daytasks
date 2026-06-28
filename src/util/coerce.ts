/**
 * Coercion helpers for decoding untrusted stored JSON (settings + plugin data).
 *
 * The two array variants make the dedupe contract explicit at every call site:
 * `asStringArrayOr` preserves duplicates (settings lists), while
 * `asUniqueStringArray` dedupes (task fields that would otherwise double-index).
 * Keeping them separately named prevents the silent dedupe-vs-not drift that a
 * single shared `asStringArray` invited (DRY-8).
 */

/** Returns `value` when it is a string, else `fallback`. */
export function asStringOr(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

/** Returns `value` when it is a string, else `undefined`. */
export function asOptionalString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

/** Returns `value` when it is a boolean, else `fallback`. */
export function asBooleanOr(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

/** Returns `value` when it is a finite number, else `fallback`. */
export function asFiniteNumberOr(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Returns `value` when it is a finite number, else `undefined`. */
export function asFiniteNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Filters `value` to its string entries, preserving order AND duplicates.
 * Non-arrays return a fresh copy of `fallback`.
 */
export function asStringArrayOr(value: unknown, fallback: string[]): string[] {
	if (!Array.isArray(value)) {
		return [...fallback];
	}
	return value.filter((entry): entry is string => typeof entry === "string");
}

/**
 * Filters `value` to UNIQUE string entries (first occurrence wins).
 * Non-arrays return an empty array.
 */
export function asUniqueStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const seen = new Set<string>();
	const result: string[] = [];
	for (const entry of value) {
		if (typeof entry === "string" && !seen.has(entry)) {
			seen.add(entry);
			result.push(entry);
		}
	}
	return result;
}
