import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce } from "../../src/util/debounce";

describe("debounce", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("invokes the function once after the wait when called repeatedly", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 200);

		debounced();
		debounced();
		debounced();
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(199);
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("invokes with the arguments from the last call", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 100);

		debounced("a");
		debounced("b");
		vi.advanceTimersByTime(100);

		expect(fn).toHaveBeenCalledWith("b");
	});

	it("restarts the wait on each call", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 100);

		debounced();
		vi.advanceTimersByTime(80);
		debounced();
		vi.advanceTimersByTime(80);
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(20);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("cancel discards a pending invocation", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 100);

		debounced();
		debounced.cancel();
		vi.advanceTimersByTime(100);

		expect(fn).not.toHaveBeenCalled();
	});

	it("flush invokes immediately and clears the pending timer", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 100);

		debounced("x");
		debounced.flush();
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith("x");

		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("flush does nothing when no call is pending", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 100);

		debounced.flush();
		expect(fn).not.toHaveBeenCalled();
	});
});
