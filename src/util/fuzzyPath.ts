import { noteBasename } from "./notePath";

const MARKDOWN_EXTENSION_PATTERN = /\.md$/i;

function isSubsequence(haystack: string, needle: string): boolean {
	let index = 0;
	for (const char of haystack) {
		if (char === needle[index]) {
			index += 1;
			if (index === needle.length) {
				return true;
			}
		}
	}
	return needle.length === 0;
}

function matchScore(path: string, needle: string): number | null {
	const hay = path.toLowerCase();
	const base = noteBasename(path).toLowerCase();

	if (!isSubsequence(hay, needle)) {
		return null;
	}

	if (base.startsWith(needle)) {
		return 1000;
	}
	if (base.includes(needle)) {
		return 500;
	}
	if (hay.includes(needle)) {
		return 200;
	}
	return 0;
}

/**
 * Filters a list of vault paths to markdown files matching `query` as a
 * case-insensitive subsequence, ranked best-first (basename matches win).
 * An empty query returns all markdown paths sorted alphabetically.
 */
export function filterMarkdownPaths(paths: string[], query: string): string[] {
	const markdown = paths.filter((path) => MARKDOWN_EXTENSION_PATTERN.test(path));
	const needle = query.trim().toLowerCase();

	if (!needle) {
		return [...markdown].sort((a, b) => a.localeCompare(b));
	}

	const scored: Array<{ path: string; score: number }> = [];
	for (const path of markdown) {
		const score = matchScore(path, needle);
		if (score !== null) {
			scored.push({ path, score });
		}
	}

	scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
	return scored.map((entry) => entry.path);
}
