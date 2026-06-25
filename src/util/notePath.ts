export const MARKDOWN_EXTENSION_PATTERN = /\.md$/i;

/**
 * Returns the final path segment with the `.md` extension removed.
 * Handles both forward and backslash separators.
 */
export function noteBasename(path: string): string {
	const fileName = path.split(/[\\/]/).pop() ?? path;
	return fileName.replace(MARKDOWN_EXTENSION_PATTERN, "");
}
