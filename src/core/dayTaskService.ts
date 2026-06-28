import { nowIso } from "../util/time";
import { omit } from "../util/omit";
import type { DayTasksSettings } from "../settings/settings";
import type { StatusManager } from "./statusManager";
import {
	clampDescription,
	clampTitle,
	dueBeforeScheduled,
	withDefaultTag,
	type CreateDayTaskInput,
	type DayTask,
	type UpdateDayTaskInput,
} from "./task";
import { createDayTask, mergeUniqueProjects, mergeUniqueStrings } from "./taskFactory";
import type { TaskIndex } from "./taskIndex";
import type { TaskStore } from "./taskStore";
import { wouldCreateCycle } from "./dependencies";
import { BLOCKED_STATUS_VALUE } from "./status";

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

	/**
	 * Replaces an existing task's editable fields with `input`. This is a full
	 * replacement: any optional field passed as `undefined` is cleared. See
	 * `UpdateDayTaskInput`.
	 */
	async updateTask(id: string, input: UpdateDayTaskInput): Promise<DayTask> {
		const task = await this.dependencies.store.get(id);
		if (!task) {
			throw new Error(`Task not found: ${id}`);
		}

		const { statusManager } = this.dependencies;
		const title = clampTitle(input.title) || task.title;
		const requested = statusManager.normalizeStatusValue(input.status ?? task.status);
		const hasBlockers = (task.blockedBy?.length ?? 0) > 0;
		const status = hasBlockers
			? BLOCKED_STATUS_VALUE
			: statusManager.isBlockedStatus(requested)
				? statusManager.getReleaseStatus()
				: requested;
		const scheduledDate = input.scheduledDate || task.scheduledDate;
		if (dueBeforeScheduled(scheduledDate, input.dueDate)) {
			throw new Error("Due date cannot be before the scheduled date");
		}
		const timestamp = this.now();

		const updated: DayTask = {
			...task,
			title,
			status,
			scheduledDate,
			dueDate: input.dueDate,
			priority: input.priority,
			tags: withDefaultTag(mergeUniqueStrings(input.tags)),
			contexts: mergeUniqueStrings(input.contexts),
			projects: mergeUniqueProjects(input.projects),
			estimateMinutes: input.estimateMinutes,
			description: clampDescription(input.description),
			updatedAt: timestamp,
		};

		this.applyCompletion(updated, task.status, status, timestamp);

		await this.saveAndIndex(updated);

		if (
			this.dependencies.statusManager.isCompletedStatus(status) &&
			!this.dependencies.statusManager.isCompletedStatus(task.status)
		) {
			await this.releaseDependentsOf(id, timestamp);
		}

		return updated;
	}

	async addDependency(taskId: string, blockerId: string): Promise<DayTask> {
		const task = await this.dependencies.store.get(taskId);
		const blocker = await this.dependencies.store.get(blockerId);
		if (!task || !blocker) {
			throw new Error(`Task not found: ${!task ? taskId : blockerId}`);
		}
		const blockersOf = (id: string): string[] =>
			this.dependencies.index.byId(id)?.blockedBy ?? [];
		if (wouldCreateCycle(taskId, blockerId, blockersOf)) {
			throw new Error("Dependency would create a cycle");
		}
		const { statusManager } = this.dependencies;
		if (statusManager.isCompletedStatus(task.status) || statusManager.isCompletedStatus(blocker.status)) {
			throw new Error("Cannot add a dependency to or from a completed task");
		}
		const updated: DayTask = {
			...task,
			blockedBy: mergeUniqueStrings(task.blockedBy, [blockerId]),
			status: BLOCKED_STATUS_VALUE,
			updatedAt: this.now(),
		};
		await this.saveAndIndex(updated);
		return updated;
	}

	async removeDependency(taskId: string, blockerId: string): Promise<DayTask> {
		const task = await this.dependencies.store.get(taskId);
		if (!task) {
			throw new Error(`Task not found: ${taskId}`);
		}
		const { statusManager } = this.dependencies;
		const remaining = (task.blockedBy ?? []).filter((id) => id !== blockerId);
		const rest = omit(task, "blockedBy");
		const timestamp = this.now();
		let updated: DayTask;
		if (remaining.length > 0) {
			updated = { ...rest, blockedBy: remaining, updatedAt: timestamp };
		} else if (statusManager.isBlockedStatus(task.status)) {
			updated = { ...rest, status: statusManager.getReleaseStatus(), updatedAt: timestamp };
		} else {
			updated = { ...rest, updatedAt: timestamp };
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
			const rest = omit(fresh, "parentId");
			await this.saveAndIndex({ ...rest, updatedAt: timestamp });
		}

		const { statusManager } = this.dependencies;
		for (const dependent of this.dependencies.index.byBlocker(id)) {
			const fresh = await this.dependencies.store.get(dependent.id);
			if (!fresh?.blockedBy) {
				continue;
			}
			const remaining = fresh.blockedBy.filter((b) => b !== id);
			const rest = omit(fresh, "blockedBy");
			const next: DayTask =
				remaining.length > 0
					? { ...rest, blockedBy: remaining, updatedAt: timestamp }
					: {
							...rest,
							...(statusManager.isBlockedStatus(fresh.status)
								? { status: statusManager.getReleaseStatus() }
								: {}),
							updatedAt: timestamp,
					  };
			await this.saveAndIndex(next);
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
		const timestamp = this.now();

		const updated: DayTask = { ...task, status: normalized, updatedAt: timestamp };
		this.applyCompletion(updated, task.status, normalized, timestamp);

		await this.saveAndIndex(updated);

		if (
			statusManager.isCompletedStatus(normalized) &&
			!statusManager.isCompletedStatus(task.status)
		) {
			await this.releaseDependentsOf(id, timestamp);
		}

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

	/** Direct children of a task (from the index). */
	getChildren(parentId: string): DayTask[] {
		return this.dependencies.index.byParent(parentId);
	}

	/** Returns all tasks currently in the index as a snapshot. */
	allTasks(): DayTask[] {
		return this.dependencies.index.all();
	}

	/** Returns the task with the given id, or null if not found. */
	getById(id: string): DayTask | null {
		return this.dependencies.index.byId(id);
	}

	/** Returns tasks that are blocked by the given task id. */
	byBlocker(id: string): DayTask[] {
		return this.dependencies.index.byBlocker(id);
	}

	/** Creates a child task linked to `parentId`. Throws if the parent is unknown. */
	async createSubtask(parentId: string, input: CreateDayTaskInput): Promise<DayTask> {
		const parent = await this.dependencies.store.get(parentId);
		if (!parent) {
			throw new Error(`Parent task not found: ${parentId}`);
		}
		return this.createTask({ ...input, parentId });
	}

	/** Clears a child's parentId (orphans it), mirroring deleteTask's semantics. */
	async unlinkSubtask(childId: string): Promise<DayTask> {
		const child = await this.dependencies.store.get(childId);
		if (!child) {
			throw new Error(`Task not found: ${childId}`);
		}
		const rest = omit(child, "parentId");
		const updated: DayTask = { ...rest, updatedAt: this.now() };
		await this.saveAndIndex(updated);
		return updated;
	}

	/**
	 * Persists a manual sibling order by writing each task's `sortOrder`
	 * (zero-padded so it compares lexicographically). `parentId` is informational
	 * — the caller supplies the already-ordered sibling ids. Unknown ids are skipped.
	 */
	async reorderSiblings(_parentId: string | null, orderedIds: string[]): Promise<void> {
		for (let index = 0; index < orderedIds.length; index += 1) {
			const task = await this.dependencies.store.get(orderedIds[index]);
			if (!task) {
				continue;
			}
			const updated: DayTask = {
				...task,
				sortOrder: String(index * 10).padStart(6, "0"),
				updatedAt: this.now(),
			};
			await this.saveAndIndex(updated);
		}
	}

	/** Sets a task's detail note path, or clears it when `path` is undefined. */
	async setDetailNotePath(id: string, path: string | undefined): Promise<DayTask> {
		const task = await this.dependencies.store.get(id);
		if (!task) {
			throw new Error(`Task not found: ${id}`);
		}
		const rest = omit(task, "detailNotePath");
		const base: DayTask = { ...rest, updatedAt: this.now() };
		const updated: DayTask = path ? { ...base, detailNotePath: path } : base;
		await this.saveAndIndex(updated);
		return updated;
	}

	/** Sets a task's priority, or clears it when `priority` is undefined. */
	async setPriority(id: string, priority: string | undefined): Promise<DayTask> {
		const task = await this.dependencies.store.get(id);
		if (!task) {
			throw new Error(`Task not found: ${id}`);
		}
		const rest = omit(task, "priority");
		const base: DayTask = { ...rest, updatedAt: this.now() };
		const updated: DayTask = priority ? { ...base, priority } : base;
		await this.saveAndIndex(updated);
		return updated;
	}

	/**
	 * Stamps or clears `completedAt` when a status change crosses the completed
	 * boundary, leaving it untouched otherwise. Mutates `task` in place.
	 */
	private applyCompletion(
		task: DayTask,
		previousStatus: string,
		nextStatus: string,
		timestamp: string
	): void {
		const { statusManager } = this.dependencies;
		const wasCompleted = statusManager.isCompletedStatus(previousStatus);
		const isCompleted = statusManager.isCompletedStatus(nextStatus);
		if (isCompleted && !wasCompleted) {
			task.completedAt = timestamp;
		} else if (!isCompleted && wasCompleted) {
			task.completedAt = undefined;
		}
	}

	private async releaseDependentsOf(blockerId: string, timestamp: string): Promise<void> {
		const { statusManager } = this.dependencies;
		for (const dependent of this.dependencies.index.byBlocker(blockerId)) {
			const fresh = await this.dependencies.store.get(dependent.id);
			if (!fresh?.blockedBy) {
				continue;
			}
			const remaining = fresh.blockedBy.filter((b) => b !== blockerId);
			const rest = omit(fresh, "blockedBy");
			const next: DayTask =
				remaining.length > 0
					? { ...rest, blockedBy: remaining, updatedAt: timestamp }
					: statusManager.isBlockedStatus(fresh.status)
						? { ...rest, status: statusManager.getReleaseStatus(), updatedAt: timestamp }
						: { ...rest, updatedAt: timestamp };
			await this.saveAndIndex(next);
		}
	}

	private async saveAndIndex(task: DayTask): Promise<void> {
		await this.dependencies.store.save(task);
		this.dependencies.index.upsert(task);
	}

	private now(): string {
		return this.dependencies.now ? this.dependencies.now() : nowIso();
	}
}
