import type { DayTask } from "./task";

export interface TaskIndex {
	rebuild(tasks: DayTask[]): void;
	upsert(task: DayTask): void;
	remove(id: string): void;
	byId(id: string): DayTask | null;
	byDate(date: string): DayTask[];
	byDueDate(date: string): DayTask[];
	byStatus(status: string): DayTask[];
	byParent(parentId: string): DayTask[];
	byTag(tag: string): DayTask[];
	byContext(context: string): DayTask[];
	byProject(projectPath: string): DayTask[];
	byBlocker(id: string): DayTask[];
}

export class MemoryTaskIndex implements TaskIndex {
	private byIdMap = new Map<string, DayTask>();
	private byDateMap = new Map<string, DayTask[]>();
	private byDueDateMap = new Map<string, DayTask[]>();
	private byStatusMap = new Map<string, DayTask[]>();
	private byParentMap = new Map<string, DayTask[]>();
	private byTagMap = new Map<string, DayTask[]>();
	private byContextMap = new Map<string, DayTask[]>();
	private byProjectMap = new Map<string, DayTask[]>();
	private byBlockerMap = new Map<string, DayTask[]>();

	rebuild(tasks: DayTask[]): void {
		this.byIdMap = new Map();
		this.byDateMap = new Map();
		this.byDueDateMap = new Map();
		this.byStatusMap = new Map();
		this.byParentMap = new Map();
		this.byTagMap = new Map();
		this.byContextMap = new Map();
		this.byProjectMap = new Map();
		this.byBlockerMap = new Map();

		for (const task of tasks) {
			this.upsert(task);
		}
	}

	upsert(task: DayTask): void {
		const existing = this.byIdMap.get(task.id);
		this.byIdMap.set(task.id, task);
		if (existing) {
			this.syncSecondaryMaps(existing, task);
		} else {
			this.addToSecondaryMaps(task);
		}
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

	byDueDate(date: string): DayTask[] {
		return [...(this.byDueDateMap.get(date) ?? [])];
	}

	byStatus(status: string): DayTask[] {
		return [...(this.byStatusMap.get(status) ?? [])];
	}

	byParent(parentId: string): DayTask[] {
		return [...(this.byParentMap.get(parentId) ?? [])];
	}

	byTag(tag: string): DayTask[] {
		return [...(this.byTagMap.get(tag) ?? [])];
	}

	byContext(context: string): DayTask[] {
		return [...(this.byContextMap.get(context) ?? [])];
	}

	byProject(projectPath: string): DayTask[] {
		return [...(this.byProjectMap.get(projectPath) ?? [])];
	}

	byBlocker(id: string): DayTask[] {
		return [...(this.byBlockerMap.get(id) ?? [])];
	}

	private addToSecondaryMaps(task: DayTask): void {
		this.addToMap(this.byDateMap, task.scheduledDate, task);
		this.addToMap(this.byStatusMap, task.status, task);
		if (task.dueDate) {
			this.addToMap(this.byDueDateMap, task.dueDate, task);
		}
		if (task.parentId) {
			this.addToMap(this.byParentMap, task.parentId, task);
		}
		for (const tag of task.tags) {
			this.addToMap(this.byTagMap, tag, task);
		}
		for (const context of task.contexts) {
			this.addToMap(this.byContextMap, context, task);
		}
		for (const project of task.projects) {
			this.addToMap(this.byProjectMap, project.path, task);
		}
		for (const blockerId of task.blockedBy ?? []) {
			this.addToMap(this.byBlockerMap, blockerId, task);
		}
	}

	private removeFromSecondaryMaps(task: DayTask): void {
		this.removeFromMap(this.byDateMap, task.scheduledDate, task);
		this.removeFromMap(this.byStatusMap, task.status, task);
		if (task.dueDate) {
			this.removeFromMap(this.byDueDateMap, task.dueDate, task);
		}
		if (task.parentId) {
			this.removeFromMap(this.byParentMap, task.parentId, task);
		}
		for (const tag of task.tags) {
			this.removeFromMap(this.byTagMap, tag, task);
		}
		for (const context of task.contexts) {
			this.removeFromMap(this.byContextMap, context, task);
		}
		for (const project of task.projects) {
			this.removeFromMap(this.byProjectMap, project.path, task);
		}
		for (const blockerId of task.blockedBy ?? []) {
			this.removeFromMap(this.byBlockerMap, blockerId, task);
		}
	}

	private syncSecondaryMaps(previous: DayTask, next: DayTask): void {
		this.syncMap(this.byDateMap, [previous.scheduledDate], [next.scheduledDate], next);
		this.syncMap(this.byStatusMap, [previous.status], [next.status], next);
		this.syncMap(
			this.byDueDateMap,
			previous.dueDate ? [previous.dueDate] : [],
			next.dueDate ? [next.dueDate] : [],
			next
		);
		this.syncMap(
			this.byParentMap,
			previous.parentId ? [previous.parentId] : [],
			next.parentId ? [next.parentId] : [],
			next
		);
		this.syncMap(this.byTagMap, previous.tags, next.tags, next);
		this.syncMap(this.byContextMap, previous.contexts, next.contexts, next);
		this.syncMap(
			this.byProjectMap,
			previous.projects.map((project) => project.path),
			next.projects.map((project) => project.path),
			next
		);
		this.syncMap(this.byBlockerMap, previous.blockedBy ?? [], next.blockedBy ?? [], next);
	}

	private addToMap<K>(map: Map<K, DayTask[]>, key: K, task: DayTask): void {
		const existing = map.get(key);
		if (existing) {
			existing.push(task);
			return;
		}

		map.set(key, [task]);
	}

	private syncMap<K>(
		map: Map<K, DayTask[]>,
		previousKeys: K[],
		nextKeys: K[],
		task: DayTask
	): void {
		const nextKeySet = new Set(nextKeys);
		for (const previousKey of previousKeys) {
			if (!nextKeySet.has(previousKey)) {
				this.removeFromMap(map, previousKey, task);
			}
		}

		const previousKeySet = new Set(previousKeys);
		for (const nextKey of nextKeys) {
			if (previousKeySet.has(nextKey)) {
				this.replaceInMap(map, nextKey, task);
			} else {
				this.addToMap(map, nextKey, task);
			}
		}
	}

	private replaceInMap<K>(map: Map<K, DayTask[]>, key: K, task: DayTask): void {
		const existing = map.get(key);
		if (!existing) {
			this.addToMap(map, key, task);
			return;
		}

		const index = existing.findIndex((candidate) => candidate.id === task.id);
		if (index === -1) {
			existing.push(task);
			return;
		}

		existing[index] = task;
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
