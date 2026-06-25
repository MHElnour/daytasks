import { nowIso } from "../util/time";
import type { StatusManager } from "./statusManager";
import {
	clampDescription,
	withDefaultTag,
	type CreateDayTaskInput,
	type DayTask,
	type ProjectLink,
} from "./task";
import { generateTaskId } from "./taskIds";

export interface TaskFactoryDefaults {
	status?: string;
	priority?: string;
	tags?: string[];
	projects?: ProjectLink[];
}

export interface TaskFactoryDependencies {
	now?: () => string;
	id?: () => string;
	statusManager: StatusManager;
	defaults?: TaskFactoryDefaults;
}

function mergeUniqueStrings(...lists: Array<string[] | undefined>): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const list of lists) {
		for (const value of list ?? []) {
			if (!seen.has(value)) {
				seen.add(value);
				result.push(value);
			}
		}
	}
	return result;
}

function mergeUniqueProjects(...lists: Array<ProjectLink[] | undefined>): ProjectLink[] {
	const seen = new Set<string>();
	const result: ProjectLink[] = [];
	for (const list of lists) {
		for (const project of list ?? []) {
			if (!seen.has(project.path)) {
				seen.add(project.path);
				result.push({ ...project });
			}
		}
	}
	return result;
}

export function createDayTask(
	input: CreateDayTaskInput,
	dependencies: TaskFactoryDependencies
): DayTask {
	const title = input.title.trim();
	if (!title) {
		throw new Error("Task title is required");
	}

	const now = dependencies.now ?? nowIso;
	const id = dependencies.id ?? (() => generateTaskId());
	const { statusManager, defaults = {} } = dependencies;
	const timestamp = now();

	const status = statusManager.normalizeStatusValue(input.status ?? defaults.status);
	const priority = input.priority ?? defaults.priority;

	const task: DayTask = {
		id: id(),
		title,
		status,
		scheduledDate: input.scheduledDate,
		tags: withDefaultTag(mergeUniqueStrings(defaults.tags, input.tags)),
		contexts: mergeUniqueStrings(input.contexts),
		projects: mergeUniqueProjects(defaults.projects, input.projects),
		timeEntries: [],
		createdAt: timestamp,
		updatedAt: timestamp,
	};

	if (priority !== undefined) {
		task.priority = priority;
	}
	if (input.dueDate) {
		task.dueDate = input.dueDate;
	}
	if (input.parentId) {
		task.parentId = input.parentId;
	}
	if (input.detailNotePath) {
		task.detailNotePath = input.detailNotePath;
	}
	if (input.estimateMinutes !== undefined) {
		task.estimateMinutes = input.estimateMinutes;
	}
	const description = clampDescription(input.description);
	if (description) {
		task.description = description;
	}
	if (input.sortOrder) {
		task.sortOrder = input.sortOrder;
	}
	if (statusManager.isCompletedStatus(status)) {
		task.completedAt = timestamp;
	}

	return task;
}
