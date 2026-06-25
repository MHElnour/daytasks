import type { StatusManager } from "../core/statusManager";
import type { DayTask } from "../core/task";
import { isOverdue } from "../util/relativeDate";
import { createTaskCardViewModel, type TaskCardViewModel } from "./taskCard";

export interface StatusSummaryEntry {
	value: string;
	label: string;
	color: string;
	count: number;
}

export interface DailyTasksWidgetModel {
	date: string;
	title: string;
	empty: boolean;
	totalCount: number;
	doneCount: number;
	overdueCount: number;
	statusSummary: StatusSummaryEntry[];
	cards: TaskCardViewModel[];
}

export function createDailyTasksWidgetModel(
	date: string,
	tasks: DayTask[],
	statusManager: StatusManager
): DailyTasksWidgetModel {
	// Open tasks first, completed tasks sunk to the bottom (stable within group).
	const ordered = [...tasks].sort(
		(a, b) =>
			Number(statusManager.isCompletedStatus(a.status)) -
			Number(statusManager.isCompletedStatus(b.status))
	);
	const cards = ordered.map((task) =>
		createTaskCardViewModel(task, statusManager, date)
	);
	const doneCount = cards.filter((card) => card.checked).length;
	const overdueCount = tasks.filter((task) =>
		isOverdue(task.dueDate, date, statusManager.isCompletedStatus(task.status))
	).length;

	const statusSummary: StatusSummaryEntry[] = statusManager
		.getStatusesByOrder()
		.map((status) => ({
			value: status.value,
			label: status.label,
			color: status.color,
			count: tasks.filter((task) => task.status === status.value).length,
		}))
		.filter((entry) => entry.count > 0);

	return {
		date,
		title: "DayTasks",
		empty: cards.length === 0,
		totalCount: cards.length,
		doneCount,
		overdueCount,
		statusSummary,
		cards,
	};
}
