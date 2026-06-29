export interface ParsedTaskInput {
	title: string;
	scheduledDate?: string; // YYYY-MM-DD
	dueDate?: string; // YYYY-MM-DD
	priority?: string; // a configured priority value
	tags: string[];
	contexts: string[];
	projects: string[]; // raw +project values (word or wikilink target)
	estimateMinutes?: number;
}

// A leading list/checkbox/quote prefix: optional indent, any number of `>`
// quote markers, a bullet (-,*,+) or numbered (1. / 1)) marker, and an optional
// checkbox. The trailing space is part of the prefix so the marker re-attaches
// cleanly to the title on capture.
const LIST_PREFIX_RE = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+(?:\[[ xX/-]\]\s+)?)/;

const TAG_RE = /(^|\s)#([\p{L}\p{N}_/-]+)/gu;
const CONTEXT_RE = /(^|\s)@([\p{L}\p{N}_/-]+)/gu;
const PROJECT_RE = /(^|\s)\+(?:\[\[([^\]]+)\]\]|([\p{L}\p{N}_/-]+))/gu;

/** Strips a leading list/checkbox/quote prefix, returning it plus the body. */
export function splitListPrefix(line: string): { prefix: string; body: string } {
	const match = line.match(LIST_PREFIX_RE);
	if (!match) {
		return { prefix: "", body: line };
	}
	return { prefix: match[1], body: line.slice(match[1].length) };
}

function dedupe(values: string[]): string[] {
	return [...new Set(values)];
}

/** Pulls `#tags`, leaving the separating whitespace so words don't merge. */
function extractTags(text: string): { tags: string[]; rest: string } {
	const tags: string[] = [];
	const rest = text.replace(TAG_RE, (_m, lead: string, tag: string) => {
		tags.push(tag);
		return lead;
	});
	return { tags: dedupe(tags), rest };
}

function extractContexts(text: string): { contexts: string[]; rest: string } {
	const contexts: string[] = [];
	const rest = text.replace(CONTEXT_RE, (_m, lead: string, ctx: string) => {
		contexts.push(ctx);
		return lead;
	});
	return { contexts: dedupe(contexts), rest };
}

/** `+word` or `+[[wikilink target]]` → raw project string. */
function extractProjects(text: string): { projects: string[]; rest: string } {
	const projects: string[] = [];
	const rest = text.replace(
		PROJECT_RE,
		(_m, lead: string, wikilink: string | undefined, word: string | undefined) => {
			projects.push(wikilink ?? word ?? "");
			return lead;
		}
	);
	return { projects: dedupe(projects.filter(Boolean)), rest };
}

export function parseTaskInput(input: string): ParsedTaskInput {
	const { body } = splitListPrefix(input);
	let text = body;

	const tagsR = extractTags(text);
	text = tagsR.rest;
	const ctxR = extractContexts(text);
	text = ctxR.rest;
	const projR = extractProjects(text);
	text = projR.rest;

	const title = text.replace(/\s+/g, " ").trim();

	return {
		title,
		tags: tagsR.tags,
		contexts: ctxR.contexts,
		projects: projR.projects,
	};
}
