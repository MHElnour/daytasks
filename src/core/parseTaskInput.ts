import { parseEstimateMinutes } from "../util/estimate";
import type { PriorityConfig } from "./status";

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

export interface ParseTaskInputOptions {
	priorities: PriorityConfig[];
	today: Date;
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

/** `!high` (marker only) → a configured priority value; bare words are ignored. */
function extractPriority(
	text: string,
	priorities: PriorityConfig[]
): { priority?: string; rest: string } {
	// Local (fresh per call) so the global flag's shared lastIndex can't leak
	// across callers; the `g` flag is required so replace scans every `!marker`.
	const priorityMarkerRe = /(^|\s)!([\p{L}\p{N}_-]+)/gu;
	const byToken = new Map<string, string>();
	for (const p of priorities) {
		byToken.set(p.value.toLowerCase(), p.value);
		byToken.set(p.label.toLowerCase(), p.value);
	}
	let priority: string | undefined;

	const rest = text.replace(priorityMarkerRe, (whole, lead: string, token: string) => {
		const match = byToken.get(token.toLowerCase());
		if (match && priority === undefined) {
			priority = match;
			return lead;
		}
		return whole;
	});

	return { priority, rest };
}

// Locates an estimate token anywhere in the residue; the actual parse (and the
// supported forms) is owned by parseEstimateMinutes — this regex only finds the
// candidate so a sentence word isn't fed to the util. The separating whitespace
// (capture group 1) is preserved when the token is stripped.
const ESTIMATE_TOKEN_RE = /(^|\s)(\d+h\d+m|\d+h|\d+m|\d+)(?=\s|$)/u;

function extractEstimate(text: string): { estimateMinutes?: number; rest: string } {
	const m = text.match(ESTIMATE_TOKEN_RE);
	if (!m || m.index === undefined) {
		return { rest: text };
	}
	const minutes = parseEstimateMinutes(m[2]);
	if (minutes === undefined) {
		return { rest: text };
	}
	const rest = text.slice(0, m.index) + m[1] + text.slice(m.index + m[0].length);
	return { estimateMinutes: minutes, rest };
}

export function parseTaskInput(
	input: string,
	opts: ParseTaskInputOptions
): ParsedTaskInput {
	const { body } = splitListPrefix(input);
	let text = body;

	const tagsR = extractTags(text);
	text = tagsR.rest;
	const ctxR = extractContexts(text);
	text = ctxR.rest;
	const projR = extractProjects(text);
	text = projR.rest;
	const prioR = extractPriority(text, opts.priorities);
	text = prioR.rest;
	const estR = extractEstimate(text);
	text = estR.rest;

	const title = text.replace(/\s+/g, " ").trim();

	const result: ParsedTaskInput = {
		title,
		tags: tagsR.tags,
		contexts: ctxR.contexts,
		projects: projR.projects,
	};
	if (prioR.priority !== undefined) {
		result.priority = prioR.priority;
	}
	if (estR.estimateMinutes !== undefined) {
		result.estimateMinutes = estR.estimateMinutes;
	}
	return result;
}
