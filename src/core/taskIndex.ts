import type { DayTask } from "./task";

export interface TaskIndex {
	rebuild(tasks: DayTask[]): void;
	byId(id: string): DayTask | null;
	byDate(date: string): DayTask[];
	byStatus(status: DayTask["status"]): DayTask[];
	byParent(parentId: string): DayTask[];
}
