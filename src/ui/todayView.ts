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
	expandedIds: ReadonlySet<string> = new Set(),
	getById: (id: string) => DayTask | undefined = () => undefined,
	getBlocking: (id: string) => DayTask[] = () => [],
	collapsedIds: ReadonlySet<string> = new Set(),
	descExpandedIds: ReadonlySet<string> = new Set()
): DailyTasksWidgetModel {
	const isCompleted = (status: string): boolean => statusManager.isCompletedStatus(status);

	const toCard = (node: TaskNode, depth: number): TaskCardViewModel => {
		const directChildren = getChildren(node.task.id);
		const childProgress =
			directChildren.length > 0 ? computeChildProgress(directChildren, isCompleted) : undefined;
		// Top-level default expanded; subtasks default collapsed. `collapsedIds`
		// holds the ids the user has toggled away from their default.
		const toggled = collapsedIds.has(node.task.id);
		const collapsed = depth === 0 ? toggled : !toggled;
		return createTaskCardViewModel(
			node.task,
			statusManager,
			referenceDate,
			priorities,
			{
				children: node.children.map((child) => toCard(child, depth + 1)),
				childProgress,
				expanded: expandedIds.has(node.task.id),
				collapsed,
				descriptionExpanded: descExpandedIds.has(node.task.id),
			},
			{ resolve: getById, blocking: getBlocking(node.task.id) }
		);
	};

	const cards = buildTaskForest(tasks, isCompleted).map((node) => toCard(node, 0));

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
