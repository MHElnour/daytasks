/**
 * Returns a shallow copy of `obj` without `key` — an immutable property drop.
 *
 * Replaces the destructuring-omit idiom that pulls a key into an
 * intentionally-unused binding (which some linters flag).
 */
export function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
	const rest: Partial<T> = { ...obj };
	delete rest[key];
	return rest as Omit<T, K>;
}
