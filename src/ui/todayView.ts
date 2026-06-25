import type { StatusManager } from "../core/statusManager";
import type { DayTask } from "../core/task";
import { createTaskCardViewModel, type TaskCardViewModel } from "./taskCard";

export interface DailyTasksWidgetModel {
	date: string;
	title: string;
	empty: boolean;
	cards: TaskCardViewModel[];
}

export function createDailyTasksWidgetModel(
	date: string,
	tasks: DayTask[],
	statusManager: StatusManager
): DailyTasksWidgetModel {
	const cards = tasks.map((task) => createTaskCardViewModel(task, statusManager));

	return {
		date,
		title: "DayTasks",
		empty: cards.length === 0,
		cards,
	};
}
