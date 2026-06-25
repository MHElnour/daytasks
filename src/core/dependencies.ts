import type { DayTask } from "./task";

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
 * Returns all tasks from `all` that are valid blocker candidates for `taskId`:
 * excludes the task itself and any task that would create a dependency cycle.
 */
export function dependencyCandidates(
 taskId: string,
 all: DayTask[],
 blockersOf: (id: string) => string[]
): DayTask[] {
 return all.filter((t) => t.id !== taskId && !wouldCreateCycle(taskId, t.id, blockersOf));
}
