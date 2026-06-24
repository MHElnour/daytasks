import type { DayTask } from "../core/task";
import {
	createTaskCardViewModel,
	type TaskCardViewModel,
} from "./taskCard";

export interface DailyTasksWidgetModel {
	date: string;
	title: string;
	empty: boolean;
	cards: TaskCardViewModel[];
}

export function createDailyTasksWidgetModel(
	date: string,
	tasks: DayTask[]
): DailyTasksWidgetModel {
	const cards = tasks.map(createTaskCardViewModel);

	return {
		date,
		title: "DayTasks",
		empty: cards.length === 0,
		cards,
	};
}
