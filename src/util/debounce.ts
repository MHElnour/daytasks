export interface DebouncedFunction<A extends unknown[]> {
	(...args: A): void;
	/** Cancels a pending invocation, if any. */
	cancel(): void;
	/** Invokes a pending call immediately and clears the timer. */
	flush(): void;
}

export interface DebounceOptions {
	/**
	 * Invoke `fn` immediately on the first call of a quiet period (the leading
	 * edge), then coalesce any further calls within `waitMs` into a single
	 * trailing call. A lone call fires only once. Default `false` (trailing only).
	 */
	leading?: boolean;
}

/**
 * Returns a debounced wrapper that delays calling `fn` until `waitMs` have
 * elapsed since the last invocation. The most recent arguments win. `cancel`
 * drops a pending call; `flush` runs it now.
 *
 * With `{ leading: true }`, `fn` also runs on the leading edge: the first call
 * fires immediately, subsequent calls within the window coalesce into one
 * trailing call, and a lone call never double-fires.
 */
export function debounce<A extends unknown[]>(
	fn: (...args: A) => void,
	waitMs: number,
	options: DebounceOptions = {}
): DebouncedFunction<A> {
	const leading = options.leading ?? false;
	let timer: number | null = null;
	// Args awaiting a trailing call. `null` means nothing is pending (e.g. right
	// after a lone leading-edge fire), so the timer must not re-fire.
	let trailingArgs: A | null = null;

	const clear = (): void => {
		if (timer !== null) {
			window.clearTimeout(timer);
			timer = null;
		}
		trailingArgs = null;
	};

	const startTimer = (): void => {
		timer = window.setTimeout(() => {
			const args = trailingArgs;
			clear();
			if (args) {
				fn(...args);
			}
		}, waitMs);
	};

	const debounced = (...args: A): void => {
		if (timer === null) {
			// Start of a quiet period.
			if (leading) {
				trailingArgs = null; // a lone call has no trailing follow-up
				fn(...args);
			} else {
				trailingArgs = args;
			}
			startTimer();
			return;
		}
		// Within an active window: remember the latest args and restart the wait.
		trailingArgs = args;
		window.clearTimeout(timer);
		startTimer();
	};

	debounced.cancel = clear;

	debounced.flush = (): void => {
		const args = trailingArgs;
		clear();
		if (args) {
			fn(...args);
		}
	};

	return debounced;
}
