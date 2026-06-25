import type { StatusManager } from "../core/statusManager";
import type { DayTask } from "../core/task";
import { getDailyNoteDateFromPath } from "../daily-notes/dailyNoteDate";
import {
	createDailyTasksWidgetModel,
	type DailyTasksWidgetModel,
} from "./todayView";

export interface DailyTasksWidgetService {
	getTasksForDate(date: string): DayTask[];
}

export interface DailyTasksWidgetControllerDependencies {
	service: DailyTasksWidgetService;
	statusManager: StatusManager;
	/** Returns the real current date (YYYY-MM-DD) for relative due / overdue. */
	today: () => string;
}

export class DailyTasksWidgetController {
	constructor(private readonly dependencies: DailyTasksWidgetControllerDependencies) {}

	getWidgetForNotePath(notePath: string): DailyTasksWidgetModel | null {
		const date = getDailyNoteDateFromPath(notePath);
		if (!date) {
			return null;
		}

		return createDailyTasksWidgetModel(
			date,
			this.dependencies.service.getTasksForDate(date),
			this.dependencies.statusManager,
			this.dependencies.today()
		);
	}
}
