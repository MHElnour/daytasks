import type { DayTask } from "./task";
import type { TaskListState } from "./taskListState";
import type { PriorityConfig } from "./status";
import type { StatusManager } from "./statusManager";
import { parseCalendarDate } from "../util/calendarDate";
import { isOverdue, formatMonthDay } from "../util/relativeDate";
import { noteBasename } from "../util/notePath";

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

export interface TaskGroup {
	key: string;
	label: string;
	tasks: DayTask[];
}

/** Comparable key for a sort field; `undefined` always sorts last regardless of direction. */
function sortKey(task: DayTask, sortBy: TaskListState["sortBy"], rank: Map<string, number>): string | number | undefined {
	switch (sortBy) {
		case "scheduled":
			return task.scheduledDate;
		case "due":
			return task.dueDate;
		case "created":
			return task.createdAt;
		case "title":
			return task.title.toLowerCase();
		case "priority":
			return task.priority === undefined ? undefined : (rank.get(task.priority) ?? undefined);
	}
}

export function sortTasks(
	tasks: DayTask[],
	sortBy: TaskListState["sortBy"],
	dir: TaskListState["sortDir"],
	priorities: PriorityConfig[]
): DayTask[] {
	const rank = new Map(priorities.map((p, i) => [p.value, i]));
	const sign = dir === "desc" ? -1 : 1;
	return [...tasks].sort((a, b) => {
		const ka = sortKey(a, sortBy, rank);
		const kb = sortKey(b, sortBy, rank);
		if (ka === undefined && kb === undefined) return 0;
		if (ka === undefined) return 1; // missing last
		if (kb === undefined) return -1;
		if (ka < kb) return -1 * sign;
		if (ka > kb) return 1 * sign;
		return 0;
	});
}

export function groupTasks(
	tasks: DayTask[],
	groupBy: TaskListState["groupBy"],
	statusManager: StatusManager
): TaskGroup[] {
	const groups = new Map<string, TaskGroup>();
	const ensure = (key: string, label: string): TaskGroup => {
		let g = groups.get(key);
		if (!g) {
			g = { key, label, tasks: [] };
			groups.set(key, g);
		}
		return g;
	};

	if (groupBy === "status") {
		// Seed in configured order so present groups come out ordered; prune empties after.
		for (const status of statusManager.getStatusesByOrder()) {
			ensure(status.value, status.label);
		}
		for (const task of tasks) {
			const cfg = statusManager.getStatusConfig(task.status);
			ensure(task.status, cfg?.label ?? task.status).tasks.push(task);
		}
		return [...groups.values()].filter((g) => g.tasks.length > 0);
	}

	if (groupBy === "scheduled") {
		for (const task of tasks) {
			ensure(task.scheduledDate, formatMonthDay(task.scheduledDate)).tasks.push(task);
		}
		return [...groups.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
	}

	// project: first project path (or no-project bucket, keyed "" and ordered last)
	for (const task of tasks) {
		const first = task.projects[0];
		if (first) {
			ensure(first.path, first.title ?? noteBasename(first.path)).tasks.push(task);
		} else {
			ensure("", "(No project)").tasks.push(task);
		}
	}
	return [...groups.values()].sort((a, b) => {
		if (a.key === "") return 1;
		if (b.key === "") return -1;
		return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
	});
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
