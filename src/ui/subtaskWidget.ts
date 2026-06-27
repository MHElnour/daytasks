import type { StatusManager } from "../core/statusManager";
import type { PriorityConfig } from "../core/status";
import type { DayTask } from "../core/task";
import { createDailyTasksWidgetModel, type DailyTasksWidgetModel } from "./todayView";

/** Collect all descendants of `rootId` into a flat array via BFS over `getChildren`. */
function collectDescendants(rootId: string, getChildren: (id: string) => DayTask[]): DayTask[] {
	const result: DayTask[] = [];
	const queue = getChildren(rootId);
	while (queue.length > 0) {
		const task = queue.shift()!;
		result.push(task);
		queue.push(...getChildren(task.id));
	}
	return result;
}

export function createSubtaskWidgetModel(
	parent: DayTask,
	statusManager: StatusManager,
	referenceDate: string,
	priorities: PriorityConfig[],
	getChildren: (id: string) => DayTask[],
	expandedIds: ReadonlySet<string>,
	collapsedIds: ReadonlySet<string>,
	getById: (id: string) => DayTask | undefined,
	getBlocking: (id: string) => DayTask[]
): DailyTasksWidgetModel {
	// Seed = all descendants (BFS). buildTaskForest will nest them correctly via parentId.
	// Direct children become forest roots because their parent (the DayTask `parent`) is not in the seed.
	const descendants = collectDescendants(parent.id, getChildren);
	const model = createDailyTasksWidgetModel(
		referenceDate, // `date` field — semantically unused for subtasks; referenceDate is harmless
		descendants, // seed = all descendants → direct children become forest roots
		statusManager,
		referenceDate,
		priorities,
		getChildren,
		expandedIds,
		getById,
		getBlocking,
		collapsedIds
	);
	return { ...model, title: "Subtasks" };
}
