import type { DayTask } from "./task";
import type { TaskListState } from "./taskListState";
import { parseCalendarDate } from "../util/calendarDate";
import { isOverdue } from "../util/relativeDate";

/** UTC day-number for a YYYY-MM-DD string, or null if unparseable. */
function dayNumber(date: string): number | null {
	const parsed = parseCalendarDate(date);
	if (!parsed) return null;
	return Math.floor(Date.UTC(parsed.year, parsed.month - 1, parsed.day) / 86400000);
}

function intersects(filter: string[], values: string[]): boolean {
	return filter.length === 0 || values.some((v) => filter.includes(v));
}

function matchesDate(task: DayTask, state: TaskListState, referenceDate: string, completed: boolean): boolean {
	switch (state.datePreset) {
		case "all":
			return true;
		case "today":
			return task.scheduledDate === referenceDate;
		case "overdue":
			return isOverdue(task.dueDate, referenceDate, completed);
		case "next7": {
			const start = dayNumber(referenceDate);
			const day = dayNumber(task.scheduledDate);
			if (start === null || day === null) return false;
			return day >= start && day <= start + 6;
		}
	}
}

/** Applies every active filter (empty filter = no constraint) and returns the kept tasks in input order. */
export function filterTasks(
	tasks: DayTask[],
	state: TaskListState,
	referenceDate: string,
	isCompleted: (status: string) => boolean
): DayTask[] {
	const search = state.search.trim().toLowerCase();
	return tasks.filter((task) => {
		if (state.statuses.length > 0 && !state.statuses.includes(task.status)) return false;
		if (!matchesDate(task, state, referenceDate, isCompleted(task.status))) return false;
		if (!intersects(state.tags, task.tags)) return false;
		if (!intersects(state.contexts, task.contexts)) return false;
		if (!intersects(state.projects, task.projects.map((p) => p.path))) return false;
		if (search) {
			const haystack = `${task.title}\n${task.description ?? ""}`.toLowerCase();
			if (!haystack.includes(search)) return false;
		}
		return true;
	});
}
