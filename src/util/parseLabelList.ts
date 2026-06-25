/**
 * Parses a free-text label field (tags, contexts, projects) into a clean list:
 * split on commas/whitespace, strip a single leading `#`, `@`, or `+`, trim,
 * drop empties, and de-duplicate (first occurrence wins).
 */
export function parseLabelList(value: string): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const raw of value.split(/[,\s]+/)) {
		const label = raw.replace(/^[#@+]/, "").trim();
		if (label.length > 0 && !seen.has(label)) {
			seen.add(label);
			result.push(label);
		}
	}
	return result;
}
