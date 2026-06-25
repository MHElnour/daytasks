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
 * (or whose parent isn't in `tasks`). Completed siblings sink to the bottom of
 * each group. A visited set makes the build cycle-safe: every task is placed
 * exactly once, so corrupt/cyclic stored `parentId` can never loop the renderer.
 */
export function buildTaskForest(
	tasks: DayTask[],
	isCompleted: (status: string) => boolean
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

	const completedLast = (a: DayTask, b: DayTask): number =>
		Number(isCompleted(a.status)) - Number(isCompleted(b.status));

	const visited = new Set<string>();
	const build = (task: DayTask): TaskNode => {
		visited.add(task.id);
		const kids = [...(childrenOf.get(task.id) ?? [])]
			.sort(completedLast)
			.filter((child) => !visited.has(child.id));
		return { task, children: kids.map(build) };
	};

	const forest = tasks
		.filter((task) => !task.parentId || !byId.has(task.parentId))
		.sort(completedLast)
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
