/** Status is a configurable string value (see StatusConfig), not a closed union. */
export type TaskStatus = string;

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
