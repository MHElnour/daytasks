import type { DayTask } from "./task";

/** Done/total over a task's direct children, using an injected completed check. */
export function computeChildProgress(
	children: DayTask[],
	isCompleted: (status: string) => boolean
): { done: number; total: number } {
	let done = 0;
	for (const child of children) {
		if (isCompleted(child.status)) {
			done += 1;
		}
	}
	return { done, total: children.length };
}

/**
 * True when `candidateId` is `ancestorId` itself or a transitive descendant of
 * it (walking `parentOf` upward reaches `ancestorId`). A visited set guarantees a
 * corrupt cyclic chain terminates instead of looping. This is the reparent-safety
 * primitive and the seed for the Slice C dependency cycle check.
 */
export function isDescendant(
	candidateId: string,
	ancestorId: string,
	parentOf: (id: string) => string | undefined
): boolean {
	const visited = new Set<string>();
	let current: string | undefined = candidateId;
	while (current !== undefined && !visited.has(current)) {
		if (current === ancestorId) {
			return true;
		}
		visited.add(current);
		current = parentOf(current);
	}
	return false;
}

export interface TaskNode {
	task: DayTask;
	children: TaskNode[];
}

/**
 * Groups one day's flat task list into a forest. Roots are tasks with no parent
 * (or whose parent isn't in `tasks`). Siblings are ordered by `sortOrder` (then
 * `createdAt`); completion no longer affects position. A visited set makes the
 * build cycle-safe: every task is placed exactly once, so corrupt/cyclic stored
 * `parentId` can never loop the renderer.
 */
export function buildTaskForest(
	tasks: DayTask[],
	_isCompleted: (status: string) => boolean
): TaskNode[] {
	const byId = new Map<string, DayTask>();
	for (const task of tasks) {
		byId.set(task.id, task);
	}

	const childrenOf = new Map<string, DayTask[]>();
	for (const task of tasks) {
		if (task.parentId && byId.has(task.parentId)) {
			const siblings = childrenOf.get(task.parentId);
			if (siblings) {
				siblings.push(task);
			} else {
				childrenOf.set(task.parentId, [task]);
			}
		}
	}

	/**
	 * Sibling order: tasks with a stored `sortOrder` come first (lexicographic over
	 * the zero-padded strings); tasks without one fall after, ordered by `createdAt`.
	 * Completion no longer affects order — manual drag order wins.
	 */
	const bySortOrder = (a: DayTask, b: DayTask): number => {
		const ao = a.sortOrder;
		const bo = b.sortOrder;
		if (ao !== undefined && bo !== undefined) {
			return ao < bo ? -1 : ao > bo ? 1 : 0;
		}
		if (ao !== undefined) return -1;
		if (bo !== undefined) return 1;
		return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
	};

	const visited = new Set<string>();
	const build = (task: DayTask): TaskNode => {
		visited.add(task.id);
		const kids = [...(childrenOf.get(task.id) ?? [])]
			.sort(bySortOrder)
			.filter((child) => !visited.has(child.id));
		return { task, children: kids.map(build) };
	};

	const forest = tasks
		.filter((task) => !task.parentId || !byId.has(task.parentId))
		.sort(bySortOrder)
		.map(build);

	// Any task not reached (trapped in a cycle) is surfaced as a root so it still
	// renders exactly once.
	for (const task of tasks) {
		if (!visited.has(task.id)) {
			forest.push(build(task));
		}
	}

	return forest;
}
