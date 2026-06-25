import type { StatusManager } from "../core/statusManager";
import type { PriorityConfig } from "../core/status";
import type { DayTask } from "../core/task";
import { buildTaskForest, computeChildProgress, type TaskNode } from "../core/subtasks";
import { safeCssColor } from "../util/cssColor";
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
	statusManager: StatusManager,
	referenceDate: string,
	priorities: PriorityConfig[],
	getChildren: (id: string) => DayTask[] = () => [],
	expandedIds: ReadonlySet<string> = new Set()
): DailyTasksWidgetModel {
	const isCompleted = (status: string): boolean => statusManager.isCompletedStatus(status);

	const toCard = (node: TaskNode): TaskCardViewModel => {
		const directChildren = getChildren(node.task.id);
		const childProgress =
			directChildren.length > 0 ? computeChildProgress(directChildren, isCompleted) : undefined;
		return createTaskCardViewModel(node.task, statusManager, referenceDate, priorities, {
			children: node.children.map(toCard),
			childProgress,
			expanded: expandedIds.has(node.task.id),
		});
	};

	const cards = buildTaskForest(tasks, isCompleted).map(toCard);

	// Counts cover every task for the day, including nested ones.
	const flat: TaskCardViewModel[] = [];
	const collect = (card: TaskCardViewModel): void => {
		flat.push(card);
		card.children.forEach(collect);
	};
	cards.forEach(collect);

	const doneCount = flat.filter((card) => card.checked).length;
	const overdueCount = flat.filter((card) => card.overdue).length;

	const statusSummary: StatusSummaryEntry[] = statusManager
		.getStatusesByOrder()
		.map((status) => ({
			value: status.value,
			label: status.label,
			color: safeCssColor(status.color, "var(--text-muted)"),
			count: tasks.filter((t) => t.status === status.value).length,
		}))
		.filter((entry) => entry.count > 0);

	return {
		date,
		title: "DayTasks",
		empty: tasks.length === 0,
		totalCount: tasks.length,
		doneCount,
		overdueCount,
		statusSummary,
		cards,
	};
}
