import type { DayTask } from "../core/task";

export interface DailyTaskLine {
	task: DayTask;
	line: string;
}

/**
 * Renders a task as a daily-note checkbox line. Completion is supplied by the
 * caller (via `StatusManager.isCompletedStatus`) rather than matched against a
 * hardcoded status value, so it honors the configurable status model.
 */
export function formatDailyTaskLine(task: DayTask, completed: boolean): string {
	const checkbox = completed ? "x" : " ";
	return `- [${checkbox}] ${task.title} <!-- ${task.id} -->`;
}
