import { getDailyNoteDateFromPath } from "../daily-notes/dailyNoteDate";
import type { CreateDayTaskInput, DayTask } from "../core/task";
import type { DayTasksSettings } from "../settings/settings";

export interface CreateTaskCommandDeps {
	getActiveFilePath(): string | null;
	settings: Pick<DayTasksSettings, "defaultTags" | "defaultProjectPath">;
	service: { createTask(input: CreateDayTaskInput): Promise<DayTask> };
	notify(message: string): void;
}

/**
 * Creates a task for the active daily note. Returns the new task, or `null`
 * (after notifying the user) when the note is not a daily note, the title is
 * blank, or creation fails.
 */
export async function createTaskForActiveNote(
	deps: CreateTaskCommandDeps,
	title: string
): Promise<DayTask | null> {
	const path = deps.getActiveFilePath();
	const date = path ? getDailyNoteDateFromPath(path) : null;
	if (!date) {
		deps.notify("DayTasks: open a daily note (YYYY-MM-DD) to create a task.");
		return null;
	}

	const trimmedTitle = title.trim();
	if (!trimmedTitle) {
		deps.notify("DayTasks: a task title is required.");
		return null;
	}

	const { defaultTags, defaultProjectPath } = deps.settings;

	try {
		const task = await deps.service.createTask({
			title: trimmedTitle,
			scheduledDate: date,
			tags: defaultTags.length > 0 ? [...defaultTags] : undefined,
			projects: defaultProjectPath ? [{ path: defaultProjectPath }] : undefined,
		});
		deps.notify(`DayTasks: created ${task.id}.`);
		return task;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		deps.notify(`DayTasks: could not create task. ${message}`);
		return null;
	}
}
