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
