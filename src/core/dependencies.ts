import type { DayTask } from "./task";
import { BLOCKED_STATUS_VALUE } from "./status";

/**
 * True when `toId` is reachable from `fromId` by following `blockedBy` edges
 * (`blockersOf`). DFS with a visited set, so a cyclic graph terminates.
 */
export function hasPath(
 fromId: string,
 toId: string,
 blockersOf: (id: string) => string[]
): boolean {
 const visited = new Set<string>();
 const stack = [fromId];
 while (stack.length > 0) {
  const current = stack.pop() as string;
  if (current === toId && current !== fromId) {
   return true;
  }
  for (const next of blockersOf(current)) {
   if (next === toId) {
    return true;
   }
   if (!visited.has(next)) {
    visited.add(next);
    stack.push(next);
   }
  }
 }
 return false;
}

/**
 * True when adding "`taskId` blocked by `blockerId`" would close a cycle: the
 * blocker is the task itself, or the task is already reachable from the blocker
 * (so the new edge points back into its own dependency chain).
 */
export function wouldCreateCycle(
 taskId: string,
 blockerId: string,
 blockersOf: (id: string) => string[]
): boolean {
 if (taskId === blockerId) {
  return true;
 }
 return hasPath(blockerId, taskId, blockersOf);
}

/**
 * Reconciles each task's stored `status` against the live edge set. After
 * `validateDependencies` may have pruned edges, some tasks' statuses can drift:
 * - A task with blockers that is not completed and not already blocked → `blocked`.
 * - A task with no blockers that IS `blocked` → `releaseStatus`.
 * Tasks that are completed are left untouched regardless of their blockers.
 */
export function reconcileBlockedStatuses(
	tasks: DayTask[],
	isCompleted: (status: string) => boolean,
	releaseStatus: string
): void {
	for (const task of tasks) {
		const hasBlockers = (task.blockedBy?.length ?? 0) > 0;
		if (hasBlockers && !isCompleted(task.status) && task.status !== BLOCKED_STATUS_VALUE) {
			task.status = BLOCKED_STATUS_VALUE;
		} else if (!hasBlockers && task.status === BLOCKED_STATUS_VALUE) {
			task.status = releaseStatus;
		}
	}
}

/**
 * Returns all tasks from `all` that are valid blocker candidates for `taskId`:
 * excludes the task itself and any task that would create a dependency cycle.
 */
export function dependencyCandidates(
 taskId: string,
 all: DayTask[],
 blockersOf: (id: string) => string[],
 isCompleted: (status: string) => boolean
): DayTask[] {
 return all.filter(
  (t) =>
   t.id !== taskId &&
   !isCompleted(t.status) &&
   !wouldCreateCycle(taskId, t.id, blockersOf)
 );
}
