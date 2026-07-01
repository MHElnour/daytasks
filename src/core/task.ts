import { stripInlineMarkdown } from "../util/stripMarkdown";

/** Maximum stored length for a task description. */
export const MAX_DESCRIPTION_LENGTH = 500;

/** Maximum stored length for a task title. */
export const MAX_TITLE_LENGTH = 100;

/**
 * Flattens inline markdown to plain text, then clamps to the maximum length.
 * Stripping first means the `**`/`[[` syntax a user types is never stored and
 * never counts against the length budget — only the visible text does.
 */
export function clampTitle(value: string): string {
	return stripInlineMarkdown(value).slice(0, MAX_TITLE_LENGTH);
}

/** Tag added to every task by default. */
export const DEFAULT_TASK_TAG = "daytask";

/** Ensures the default tag is present (first) and the list is de-duplicated. */
export function withDefaultTag(tags: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const tag of [DEFAULT_TASK_TAG, ...tags]) {
		if (!seen.has(tag)) {
			seen.add(tag);
			result.push(tag);
		}
	}
	return result;
}

/**
 * True when a due date falls before the scheduled date — an invalid task, since
 * a deadline cannot precede the day work is planned. `YYYY-MM-DD` compares
 * chronologically as plain strings.
 */
export function dueBeforeScheduled(
	scheduledDate: string,
	dueDate: string | undefined
): boolean {
	return !!dueDate && dueDate < scheduledDate;
}

/**
 * Flattens inline markdown, then clamps to the maximum length, or undefined if
 * blank once stripped. Same rationale as `clampTitle`: syntax is neither stored
 * nor counted against the budget.
 */
export function clampDescription(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}
	const stripped = stripInlineMarkdown(value);
	if (!stripped) {
		return undefined;
	}
	return stripped.slice(0, MAX_DESCRIPTION_LENGTH);
}

export interface TimeEntry {
	startTime: string;
	endTime?: string;
	description?: string;
}

export interface ProjectLink {
	path: string;
	title?: string;
}

export interface DayTask {
	id: string;
	title: string;
	status: string;
	priority?: string;

	scheduledDate: string;
	dueDate?: string;
	completedAt?: string;
	archivedAt?: string;

	parentId?: string;
	blockedBy?: string[];
	detailNotePath?: string;
	/** Path of the note this task was captured from, via inline capture. Opaque. */
	sourceNote?: string;

	tags: string[];
	contexts: string[];
	projects: ProjectLink[];

	estimateMinutes?: number;
	description?: string;
	/**
	 * Opaque manual-ordering key. Written as a zero-padded numeric string
	 * (e.g. "000010") and compared lexicographically among siblings — it is a
	 * sort key, NOT a number, so it is intentionally stored/decoded verbatim with
	 * no numeric validation (DATA-5). A malformed value only sorts oddly.
	 */
	sortOrder?: string;

	timeEntries: TimeEntry[];

	createdAt: string;
	updatedAt: string;
}

export interface CreateDayTaskInput {
	title: string;
	scheduledDate: string;
	dueDate?: string;
	status?: string;
	priority?: string;

	parentId?: string;
	blockedBy?: string[];
	detailNote?: boolean;
	detailNotePath?: string;
	sourceNote?: string;

	tags?: string[];
	contexts?: string[];
	projects?: ProjectLink[];

	estimateMinutes?: number;
	description?: string;
	sortOrder?: string;
}

/**
 * Full editable state for `DayTaskService.updateTask`. Unlike
 * `CreateDayTaskInput`, every editable field is a **required key** (optionals
 * typed `| undefined`): an update **replaces** the task's editable fields, so a
 * caller must state each one — pass `undefined` to clear it. This turns an
 * accidentally-omitted field into a compile error instead of silent data loss.
 * For single-field changes use `setStatus`/`cycleStatus` instead.
 */
export interface UpdateDayTaskInput {
	title: string;
	scheduledDate: string;
	status: string | undefined;
	dueDate: string | undefined;
	priority: string | undefined;
	tags: string[] | undefined;
	contexts: string[] | undefined;
	projects: ProjectLink[] | undefined;
	estimateMinutes: number | undefined;
	description: string | undefined;
}

/**
 * Maps the modal's `CreateDayTaskInput` onto the full-replacement
 * `UpdateDayTaskInput`: every editable field is stated, so an omitted optional
 * becomes `undefined` (cleared) rather than silently preserved. Centralized here
 * so adding a field to `UpdateDayTaskInput` is a compile error until it is mapped.
 */
export function toUpdateDayTaskInput(input: CreateDayTaskInput): UpdateDayTaskInput {
	return {
		title: input.title,
		scheduledDate: input.scheduledDate,
		status: input.status,
		dueDate: input.dueDate,
		priority: input.priority,
		tags: input.tags,
		contexts: input.contexts,
		projects: input.projects,
		estimateMinutes: input.estimateMinutes,
		description: input.description,
	};
}
