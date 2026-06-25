/**
 * Caps `text` at `max` characters. When it is longer, the result is `max`
 * characters total: the first `max - 1` characters plus a single ellipsis.
 */
export function truncate(text: string, max: number): string {
	if (text.length <= max) {
		return text;
	}
	return text.slice(0, max - 1) + "…";
}
