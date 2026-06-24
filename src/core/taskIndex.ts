import type { DayTask } from "./task";

export interface TaskIndex {
	rebuild(tasks: DayTask[]): void;
	byId(id: string): DayTask | null;
	byDate(date: string): DayTask[];
	byStatus(status: DayTask["status"]): DayTask[];
	byParent(parentId: string): DayTask[];
}

export class MemoryTaskIndex implements TaskIndex {
	private byIdMap = new Map<string, DayTask>();
	private byDateMap = new Map<string, DayTask[]>();
	private byStatusMap = new Map<DayTask["status"], DayTask[]>();
	private byParentMap = new Map<string, DayTask[]>();

	rebuild(tasks: DayTask[]): void {
		this.byIdMap = new Map();
		this.byDateMap = new Map();
		this.byStatusMap = new Map();
		this.byParentMap = new Map();

		for (const task of tasks) {
			this.byIdMap.set(task.id, task);
			this.addToMap(this.byDateMap, task.scheduledDate, task);
			this.addToMap(this.byStatusMap, task.status, task);
			if (task.parentId) {
				this.addToMap(this.byParentMap, task.parentId, task);
			}
		}
	}

	byId(id: string): DayTask | null {
		return this.byIdMap.get(id) ?? null;
	}

	byDate(date: string): DayTask[] {
		return [...(this.byDateMap.get(date) ?? [])];
	}

	byStatus(status: DayTask["status"]): DayTask[] {
		return [...(this.byStatusMap.get(status) ?? [])];
	}

	byParent(parentId: string): DayTask[] {
		return [...(this.byParentMap.get(parentId) ?? [])];
	}

	private addToMap<K>(map: Map<K, DayTask[]>, key: K, task: DayTask): void {
		const existing = map.get(key);
		if (existing) {
			existing.push(task);
			return;
		}

		map.set(key, [task]);
	}
}
