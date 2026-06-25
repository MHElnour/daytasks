/** Maximum stored length for a task description. */
export const MAX_DESCRIPTION_LENGTH = 500;

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

/** Trims and clamps a description to the maximum length, or undefined if blank. */
export function clampDescription(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}
	return trimmed.slice(0, MAX_DESCRIPTION_LENGTH);
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
	detailNotePath?: string;

	tags: string[];
	contexts: string[];
	projects: ProjectLink[];

	estimateMinutes?: number;
	description?: string;
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
	detailNote?: boolean;
	detailNotePath?: string;

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
