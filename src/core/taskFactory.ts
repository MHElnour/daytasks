import { cloneProjects, cloneStrings } from "../util/clone";
import { nowIso } from "../util/time";
import type { CreateDayTaskInput, DayTask } from "./task";
import { generateTaskId } from "./taskIds";

export interface TaskFactoryDependencies {
	now?: () => string;
	id?: () => string;
}

function copyNonEmpty(values: string[] | undefined): string[] | undefined {
	return values && values.length > 0 ? cloneStrings(values) : undefined;
}

function copyProjects(input: CreateDayTaskInput): DayTask["projects"] {
	return input.projects && input.projects.length > 0
		? cloneProjects(input.projects)
		: undefined;
}

export function createDayTask(
	input: CreateDayTaskInput,
	dependencies: TaskFactoryDependencies = {}
): DayTask {
	const title = input.title.trim();
	if (!title) {
		throw new Error("Task title is required");
	}

	const now = dependencies.now ?? nowIso;
	const id = dependencies.id ?? (() => generateTaskId());
	const timestamp = now();

	const task: DayTask = {
		id: id(),
		title,
		status: "open",
		scheduledDate: input.scheduledDate,
		timeEntries: [],
		createdAt: timestamp,
		updatedAt: timestamp,
	};

	if (input.dueDate) {
		task.dueDate = input.dueDate;
	}
	if (input.parentId) {
		task.parentId = input.parentId;
	}
	if (input.detailNotePath) {
		task.detailNotePath = input.detailNotePath;
	}

	const tags = copyNonEmpty(input.tags);
	if (tags) {
		task.tags = tags;
	}

	const contexts = copyNonEmpty(input.contexts);
	if (contexts) {
		task.contexts = contexts;
	}

	const projects = copyProjects(input);
	if (projects) {
		task.projects = projects;
	}

	return task;
}
