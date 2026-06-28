export const MARKDOWN_EXTENSION_PATTERN = /\.md$/i;

/** Removes any trailing slash(es) from a folder path (`"a/b/"` → `"a/b"`). */
export function stripTrailingSlashes(folder: string): string {
	return folder.replace(/\/+$/, "");
}

/**
 * Returns the final path segment with the `.md` extension removed.
 * Handles both forward and backslash separators.
 */
export function noteBasename(path: string): string {
	const fileName = path.split(/[\\/]/).pop() ?? path;
	return fileName.replace(MARKDOWN_EXTENSION_PATTERN, "");
}
