import type { CreateDayTaskInput, DayTask } from "./task";
import { generateTaskId } from "./taskIds";

export interface TaskFactoryDependencies {
	now?: () => string;
	id?: () => string;
}

function copyNonEmpty(values: string[] | undefined): string[] | undefined {
	if (!values || values.length === 0) {
		return undefined;
	}
	return [...values];
}

export function createDayTask(
	input: CreateDayTaskInput,
	dependencies: TaskFactoryDependencies = {}
): DayTask {
	const title = input.title.trim();
	if (!title) {
		throw new Error("Task title is required");
	}

	const now = dependencies.now ?? (() => new Date().toISOString());
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

	return task;
}
