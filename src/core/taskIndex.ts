import type { DayTask } from "./task";

export interface TaskIndex {
	rebuild(tasks: DayTask[]): void;
	upsert(task: DayTask): void;
	remove(id: string): void;
	byId(id: string): DayTask | null;
	byDate(date: string): DayTask[];
	byStatus(status: DayTask["status"]): DayTask[];
	byParent(parentId: string): DayTask[];
	byTag(tag: string): DayTask[];
	byProject(projectPath: string): DayTask[];
}

export class MemoryTaskIndex implements TaskIndex {
	private byIdMap = new Map<string, DayTask>();
	private byDateMap = new Map<string, DayTask[]>();
	private byStatusMap = new Map<DayTask["status"], DayTask[]>();
	private byParentMap = new Map<string, DayTask[]>();
	private byTagMap = new Map<string, DayTask[]>();
	private byProjectMap = new Map<string, DayTask[]>();

	rebuild(tasks: DayTask[]): void {
		this.byIdMap = new Map();
		this.byDateMap = new Map();
		this.byStatusMap = new Map();
		this.byParentMap = new Map();
		this.byTagMap = new Map();
		this.byProjectMap = new Map();

		for (const task of tasks) {
			this.upsert(task);
		}
	}

	upsert(task: DayTask): void {
		const existing = this.byIdMap.get(task.id);
		if (existing) {
			this.removeFromSecondaryMaps(existing);
		}

		this.byIdMap.set(task.id, task);
		this.addToSecondaryMaps(task);
	}

	remove(id: string): void {
		const existing = this.byIdMap.get(id);
		if (!existing) {
			return;
		}

		this.removeFromSecondaryMaps(existing);
		this.byIdMap.delete(id);
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

	byTag(tag: string): DayTask[] {
		return [...(this.byTagMap.get(tag) ?? [])];
	}

	byProject(projectPath: string): DayTask[] {
		return [...(this.byProjectMap.get(projectPath) ?? [])];
	}

	private addToSecondaryMaps(task: DayTask): void {
		this.addToMap(this.byDateMap, task.scheduledDate, task);
		this.addToMap(this.byStatusMap, task.status, task);
		if (task.parentId) {
			this.addToMap(this.byParentMap, task.parentId, task);
		}
		for (const tag of task.tags ?? []) {
			this.addToMap(this.byTagMap, tag, task);
		}
		for (const project of task.projects ?? []) {
			this.addToMap(this.byProjectMap, project.path, task);
		}
	}

	private removeFromSecondaryMaps(task: DayTask): void {
		this.removeFromMap(this.byDateMap, task.scheduledDate, task);
		this.removeFromMap(this.byStatusMap, task.status, task);
		if (task.parentId) {
			this.removeFromMap(this.byParentMap, task.parentId, task);
		}
		for (const tag of task.tags ?? []) {
			this.removeFromMap(this.byTagMap, tag, task);
		}
		for (const project of task.projects ?? []) {
			this.removeFromMap(this.byProjectMap, project.path, task);
		}
	}

	private addToMap<K>(map: Map<K, DayTask[]>, key: K, task: DayTask): void {
		const existing = map.get(key);
		if (existing) {
			existing.push(task);
			return;
		}

		map.set(key, [task]);
	}

	private removeFromMap<K>(map: Map<K, DayTask[]>, key: K, task: DayTask): void {
		const existing = map.get(key);
		if (!existing) {
			return;
		}

		const next = existing.filter((candidate) => candidate.id !== task.id);
		if (next.length > 0) {
			map.set(key, next);
		} else {
			map.delete(key);
		}
	}
}
