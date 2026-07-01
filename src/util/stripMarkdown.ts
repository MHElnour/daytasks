/**
 * Flattens inline Markdown / Obsidian syntax to the readable text it wraps, for
 * displaying task titles and descriptions without the raw `**`, `[[`, `` ` ``
 * noise. Not a CommonMark parser — a pragmatic pass over the constructs that
 * show up in one-line titles and short descriptions.
 *
 * Underscore emphasis is boundary-guarded so intra-word underscores
 * (`user_id`) survive. No lookbehind is used (iOS < 16.4 rejects it).
 */

/** NUL sentinel wrapping stashed escape indices — never present in real text. */
const SENTINEL = String.fromCharCode(0);

/** `[[target|alias]]` -> alias; `[[a/b#sec]]` -> `b`. */
function resolveWikilink(inner: string): string {
	if (inner.includes("|")) {
		return inner.slice(inner.indexOf("|") + 1).trim();
	}
	const target = inner.replace(/#.*$/, "");
	const base = target.includes("/") ? target.slice(target.lastIndexOf("/") + 1) : target;
	return base.trim();
}

export function stripInlineMarkdown(text: string): string {
	if (!text) {
		return text;
	}

	let out = text.split(SENTINEL).join("");

	// Backslash-escaped punctuation is stashed as a placeholder up front so the
	// stripping passes can't reinterpret it (e.g. `\*` must survive the emphasis
	// pass); restored verbatim at the very end.
	const escaped: string[] = [];
	out = out.replace(/\\([\\`*_{}[\]()#+\-.!~=|>])/g, (_, ch: string) => {
		escaped.push(ch);
		return `${SENTINEL}${escaped.length - 1}${SENTINEL}`;
	});

	// Inline code first: keep the content verbatim, drop the backticks (its inner
	// text must not then be treated as emphasis).
	out = out.replace(/`([^`]+)`/g, "$1");

	// Embeds / images / wikilinks / links -> their display text.
	out = out.replace(/!\[\[([^\]]+)\]\]/g, (_, inner: string) => resolveWikilink(inner));
	out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
	out = out.replace(/\[\[([^\]]+)\]\]/g, (_, inner: string) => resolveWikilink(inner));
	out = out.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
	out = out.replace(/<((?:https?|obsidian):\/\/[^>\s]+)>/g, "$1");

	// Emphasis. Asterisks strip freely (require non-space inner boundaries so a
	// lone "2 * 3" is untouched); underscores are boundary-guarded so snake_case
	// survives.
	out = out.replace(/\*\*\*(\S(?:.*?\S)?)\*\*\*/g, "$1");
	out = out.replace(/\*\*(\S(?:.*?\S)?)\*\*/g, "$1");
	out = out.replace(/\*(\S(?:.*?\S)?)\*/g, "$1");
	out = out.replace(/(^|[^\w])___(\S(?:.*?\S)?)___(?=[^\w]|$)/g, "$1$2");
	out = out.replace(/(^|[^\w])__(\S(?:.*?\S)?)__(?=[^\w]|$)/g, "$1$2");
	out = out.replace(/(^|[^\w])_(\S(?:.*?\S)?)_(?=[^\w]|$)/g, "$1$2");

	// Strikethrough + highlight.
	out = out.replace(/~~(\S(?:.*?\S)?)~~/g, "$1");
	out = out.replace(/==(\S(?:.*?\S)?)==/g, "$1");

	// Line-leading block markers (headings, blockquotes, list bullets) — matters
	// for multi-line descriptions.
	out = out.replace(/^[ \t]*(#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/gm, "");

	// Collapse the spacing that removed syntax leaves behind (newlines kept).
	out = out.replace(/[ \t]{2,}/g, " ");

	// Restore escaped punctuation.
	out = out.replace(new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, "g"), (_, i: string) => escaped[Number(i)]);

	return out.trim();
}
