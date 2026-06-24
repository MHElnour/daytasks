import type { DayTask } from "../core/task";

export interface DailyTaskLine {
	task: DayTask;
	line: string;
}

export function formatDailyTaskLine(task: DayTask): string {
	const checkbox = task.status === "done" ? "x" : " ";
	return `- [${checkbox}] ${task.title} <!-- ${task.id} -->`;
}
