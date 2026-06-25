export interface DebouncedFunction<A extends unknown[]> {
	(...args: A): void;
	/** Cancels a pending invocation, if any. */
	cancel(): void;
	/** Invokes a pending call immediately and clears the timer. */
	flush(): void;
}

/**
 * Returns a debounced wrapper that delays calling `fn` until `waitMs` have
 * elapsed since the last invocation. The most recent arguments win. `cancel`
 * drops a pending call; `flush` runs it now.
 */
export function debounce<A extends unknown[]>(
	fn: (...args: A) => void,
	waitMs: number
): DebouncedFunction<A> {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let pendingArgs: A | null = null;

	const clear = (): void => {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
		pendingArgs = null;
	};

	const debounced = (...args: A): void => {
		pendingArgs = args;
		if (timer !== null) {
			clearTimeout(timer);
		}
		timer = setTimeout(() => {
			const args = pendingArgs;
			clear();
			if (args) {
				fn(...args);
			}
		}, waitMs);
	};

	debounced.cancel = clear;

	debounced.flush = (): void => {
		if (timer === null) {
			return;
		}
		const args = pendingArgs;
		clear();
		if (args) {
			fn(...args);
		}
	};

	return debounced;
}
