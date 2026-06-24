import type { CreateDayTaskInput, DayTask } from "./task";
import { createDayTask, type TaskFactoryDependencies } from "./taskFactory";
import type { TaskIndex } from "./taskIndex";
import type { TaskStore } from "./taskStore";

export interface DayTaskServiceDependencies extends TaskFactoryDependencies {
	store: TaskStore;
	index: TaskIndex;
}

export class DayTaskService {
	constructor(private readonly dependencies: DayTaskServiceDependencies) {}

	async createTask(input: CreateDayTaskInput): Promise<DayTask> {
		const task = createDayTask(input, {
			now: this.dependencies.now,
			id: this.dependencies.id,
		});
		await this.saveAndReindex(task);
		return task;
	}

	async getTask(id: string): Promise<DayTask | null> {
		return this.dependencies.store.get(id);
	}

	getTasksForDate(date: string): DayTask[] {
		return this.dependencies.index.byDate(date);
	}

	getTasksForTag(tag: string): DayTask[] {
		return this.dependencies.index.byTag(tag);
	}

	getTasksForProject(projectPath: string): DayTask[] {
		return this.dependencies.index.byProject(projectPath);
	}

	async toggleStatus(id: string): Promise<DayTask> {
		const task = await this.dependencies.store.get(id);
		if (!task) {
			throw new Error(`Task not found: ${id}`);
		}

		const updatedTask: DayTask = {
			...task,
			status: task.status === "done" ? "open" : "done",
			updatedAt: this.now(),
		};
		await this.saveAndReindex(updatedTask);
		return updatedTask;
	}

	private async saveAndReindex(task: DayTask): Promise<void> {
		await this.dependencies.store.save(task);
		this.dependencies.index.rebuild(await this.dependencies.store.list());
	}

	private now(): string {
		return this.dependencies.now ? this.dependencies.now() : new Date().toISOString();
	}
}
