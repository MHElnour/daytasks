import { nowIso } from "../util/time";
import type { DayTasksSettings } from "../settings/settings";
import type { StatusManager } from "./statusManager";
import {
	clampDescription,
	withDefaultTag,
	type CreateDayTaskInput,
	type DayTask,
} from "./task";
import { createDayTask } from "./taskFactory";
import type { TaskIndex } from "./taskIndex";
import type { TaskStore } from "./taskStore";

export type DayTaskServiceSettings = Pick<
	DayTasksSettings,
	"defaultStatus" | "defaultPriority" | "defaultTags" | "defaultProjectPath"
>;

export interface DayTaskServiceDependencies {
	store: TaskStore;
	index: TaskIndex;
	statusManager: StatusManager;
	settings: DayTaskServiceSettings;
	now?: () => string;
	id?: () => string;
}

export class DayTaskService {
	constructor(private readonly dependencies: DayTaskServiceDependencies) {}

	async createTask(input: CreateDayTaskInput): Promise<DayTask> {
		const { settings, statusManager } = this.dependencies;
		const task = createDayTask(input, {
			now: this.dependencies.now,
			id: this.dependencies.id,
			statusManager,
			defaults: {
				status: settings.defaultStatus,
				priority: settings.defaultPriority,
				tags: settings.defaultTags,
				projects: settings.defaultProjectPath
					? [{ path: settings.defaultProjectPath }]
					: [],
			},
		});
		await this.saveAndIndex(task);
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

	getTasksForContext(context: string): DayTask[] {
		return this.dependencies.index.byContext(context);
	}

	getTasksForProject(projectPath: string): DayTask[] {
		return this.dependencies.index.byProject(projectPath);
	}

	/** Applies edited fields from a creation-input to an existing task. */
	async updateTask(id: string, input: CreateDayTaskInput): Promise<DayTask> {
		const task = await this.dependencies.store.get(id);
		if (!task) {
			throw new Error(`Task not found: ${id}`);
		}

		const { statusManager } = this.dependencies;
		const title = input.title.trim() || task.title;
		const status = statusManager.normalizeStatusValue(input.status ?? task.status);
		const wasCompleted = statusManager.isCompletedStatus(task.status);
		const isCompleted = statusManager.isCompletedStatus(status);
		const timestamp = this.now();

		const updated: DayTask = {
			...task,
			title,
			status,
			scheduledDate: input.scheduledDate || task.scheduledDate,
			dueDate: input.dueDate,
			priority: input.priority,
			tags: withDefaultTag(input.tags ? [...input.tags] : []),
			contexts: input.contexts ? [...input.contexts] : [],
			projects: input.projects ? input.projects.map((p) => ({ ...p })) : [],
			estimateMinutes: input.estimateMinutes,
			description: clampDescription(input.description),
			updatedAt: timestamp,
		};

		if (isCompleted && !wasCompleted) {
			updated.completedAt = timestamp;
		} else if (!isCompleted && wasCompleted) {
			updated.completedAt = undefined;
		}

		await this.saveAndIndex(updated);
		return updated;
	}

	/**
	 * Removes a task. Children are orphaned (their `parentId` is cleared) rather
	 * than cascade-deleted, so no task is left pointing at a missing parent.
	 */
	async deleteTask(id: string): Promise<void> {
		const children = this.dependencies.index.byParent(id);
		const timestamp = this.now();
		for (const child of children) {
			const fresh = await this.dependencies.store.get(child.id);
			if (!fresh) {
				continue;
			}
			const { parentId: _removed, ...rest } = fresh;
			await this.saveAndIndex({ ...rest, updatedAt: timestamp });
		}

		await this.dependencies.store.delete(id);
		this.dependencies.index.remove(id);
	}

	/** Sets an explicit status, applying completion side-effects on completedAt. */
	async setStatus(id: string, status: string): Promise<DayTask> {
		const task = await this.dependencies.store.get(id);
		if (!task) {
			throw new Error(`Task not found: ${id}`);
		}

		const { statusManager } = this.dependencies;
		const normalized = statusManager.normalizeStatusValue(status);
		const wasCompleted = statusManager.isCompletedStatus(task.status);
		const isCompleted = statusManager.isCompletedStatus(normalized);
		const timestamp = this.now();

		const updated: DayTask = { ...task, status: normalized, updatedAt: timestamp };
		if (isCompleted && !wasCompleted) {
			updated.completedAt = timestamp;
		} else if (!isCompleted && wasCompleted) {
			updated.completedAt = undefined;
		}

		await this.saveAndIndex(updated);
		return updated;
	}

	/** Advances a task to the next status in the configured cycle. */
	async cycleStatus(id: string): Promise<DayTask> {
		const task = await this.dependencies.store.get(id);
		if (!task) {
			throw new Error(`Task not found: ${id}`);
		}
		return this.setStatus(
			id,
			this.dependencies.statusManager.getNextStatus(task.status)
		);
	}

	private async saveAndIndex(task: DayTask): Promise<void> {
		await this.dependencies.store.save(task);
		this.dependencies.index.upsert(task);
	}

	private now(): string {
		return this.dependencies.now ? this.dependencies.now() : nowIso();
	}
}
