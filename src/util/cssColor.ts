/**
 * Returns `value` only when the platform confirms it is a valid CSS color,
 * otherwise `fallback`. Status/priority colors come from persisted settings and
 * are written into CSS custom properties; an attacker-controlled value such as
 * `url("http://x")` could otherwise be substituted wherever the property is
 * consumed and trigger a network fetch (SEC-3). When `CSS.supports` is
 * unavailable (e.g. a non-DOM context) the value is passed through unchanged —
 * Obsidian always provides it at render time.
 */
export function safeCssColor(value: string, fallback: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return fallback;
	}
	if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
		return CSS.supports("color", trimmed) ? trimmed : fallback;
	}
	return trimmed;
}
