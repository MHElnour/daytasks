import type { PriorityConfig } from "./status";

/**
 * Next priority value when cycling a task's priority on the card. The cleared
 * state is `undefined` (no priority); the stored `"none"` value is treated as the
 * same cleared slot. Real priorities cycle by ascending `weight`, so the sequence
 * is: undefined → lowest → … → highest → undefined.
 *
 * Returns `current` unchanged when no priorities are configured.
 */
export function nextPriority(
	current: string | undefined,
	priorities: PriorityConfig[]
): string | undefined {
	const real = priorities
		.filter((priority) => priority.value !== "none")
		.sort((a, b) => a.weight - b.weight);
	if (real.length === 0) {
		return current;
	}

	const cycle: Array<string | undefined> = [undefined, ...real.map((p) => p.value)];
	const index = cycle.findIndex((value) => value === current);
	// An unknown or "none" value falls back to the cleared slot at index 0.
	const start = index === -1 ? 0 : index;
	return cycle[(start + 1) % cycle.length];
}
