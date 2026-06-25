import type { StatusManager } from "../core/statusManager";
import type { PriorityConfig } from "../core/status";
import type { DayTask } from "../core/task";
import {
	createDailyTasksWidgetModel,
	type DailyTasksWidgetModel,
} from "./todayView";

export interface DailyTasksWidgetService {
	getTasksForDate(date: string): DayTask[];
	getChildren(parentId: string): DayTask[];
	getById(id: string): DayTask | null;
	byBlocker(id: string): DayTask[];
}

export interface DailyTasksWidgetControllerDependencies {
	service: DailyTasksWidgetService;
	statusManager: StatusManager;
	priorities: PriorityConfig[];
	/** Returns the real current date (YYYY-MM-DD) for relative due / overdue. */
	today: () => string;
}

export class DailyTasksWidgetController {
	constructor(private readonly dependencies: DailyTasksWidgetControllerDependencies) {}

	/**
	 * Builds the widget model for an already-resolved daily-note date. The caller
	 * owns daily-note / folder detection (one folder-aware resolver), so the date
	 * is not re-derived here.
	 */
	getWidgetForDate(
		date: string,
		expandedIds: ReadonlySet<string> = new Set()
	): DailyTasksWidgetModel {
		return createDailyTasksWidgetModel(
			date,
			this.dependencies.service.getTasksForDate(date),
			this.dependencies.statusManager,
			this.dependencies.today(),
			this.dependencies.priorities,
			(id) => this.dependencies.service.getChildren(id),
			expandedIds,
			(id) => this.dependencies.service.getById(id) ?? undefined,
			(id) => this.dependencies.service.byBlocker(id)
		);
	}
}
