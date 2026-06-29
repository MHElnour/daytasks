import type { StatusManager } from "../core/statusManager";
import type { PriorityConfig } from "../core/status";
import type { DayTask } from "../core/task";
import { filterTasks, sortTasks, groupTasks } from "../core/taskFilter";
import type { TaskListState } from "../core/taskListState";
import { createTaskCardViewModel, type TaskCardViewModel } from "./taskCard";

export interface TaskListGroup {
	key: string;
	label: string;
	count: number;
	cards: TaskCardViewModel[];
	collapsed: boolean;
}

export interface TaskListModel {
	groups: TaskListGroup[];
	total: number;
	empty: boolean;
	state: TaskListState;
}

export function createTaskListModel(
	tasks: DayTask[],
	statusManager: StatusManager,
	referenceDate: string,
	priorities: PriorityConfig[],
	state: TaskListState,
	expandedCardIds: ReadonlySet<string>,
	collapsedGroupKeys: ReadonlySet<string>
): TaskListModel {
	const isCompleted = (status: string): boolean => statusManager.isCompletedStatus(status);
	const filtered = filterTasks(tasks, state, referenceDate, isCompleted);
	const sorted = sortTasks(filtered, state.sortBy, state.sortDir, priorities);
	const rawGroups = groupTasks(sorted, state.groupBy, statusManager, state.projects);

	const groups: TaskListGroup[] = rawGroups.map((group) => ({
		key: group.key,
		label: group.label,
		count: group.tasks.length,
		collapsed: collapsedGroupKeys.has(group.key),
		cards: group.tasks.map((task) =>
			createTaskCardViewModel(task, statusManager, referenceDate, priorities, {
				children: [],
				collapsed: !expandedCardIds.has(task.id),
			})
		),
	}));

	return { groups, total: filtered.length, empty: filtered.length === 0, state };
}
