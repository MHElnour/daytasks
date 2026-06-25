/** Minimal metadata-cache surface for resolving a link to its destination. */
interface MarkdownLinkResolver {
	getFirstLinkpathDest(
		linkpath: string,
		sourcePath: string
	): { extension?: string } | null;
}

/**
 * True when `linkpath` resolves — the same way `openLinkText` would — to an
 * existing markdown note. Project links are free-form / persisted text, so this
 * guards `openLinkText` against opening or creating an unexpected, non-markdown,
 * or non-existent target (SEC-6).
 */
export function resolvesToMarkdownNote(
	cache: MarkdownLinkResolver,
	linkpath: string
): boolean {
	return cache.getFirstLinkpathDest(linkpath, "")?.extension === "md";
}
