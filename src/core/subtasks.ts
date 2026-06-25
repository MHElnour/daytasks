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
