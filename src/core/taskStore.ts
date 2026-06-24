import type { DayTask } from "./task";

export interface TaskStore {
	list(): Promise<DayTask[]>;
	get(id: string): Promise<DayTask | null>;
	save(task: DayTask): Promise<void>;
	delete(id: string): Promise<void>;
}

function cloneTask(task: DayTask): DayTask {
	return {
		...task,
		tags: task.tags ? [...task.tags] : undefined,
		contexts: task.contexts ? [...task.contexts] : undefined,
		timeEntries: task.timeEntries.map((entry) => ({ ...entry })),
	};
}

export class MemoryTaskStore implements TaskStore {
	private readonly tasks = new Map<string, DayTask>();

	async list(): Promise<DayTask[]> {
		return Array.from(this.tasks.values(), cloneTask);
	}

	async get(id: string): Promise<DayTask | null> {
		const task = this.tasks.get(id);
		return task ? cloneTask(task) : null;
	}

	async save(task: DayTask): Promise<void> {
		this.tasks.set(task.id, cloneTask(task));
	}

	async delete(id: string): Promise<void> {
		this.tasks.delete(id);
	}
}
