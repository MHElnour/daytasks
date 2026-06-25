import { describe, expect, it } from "vitest";
import { StatusManager } from "../../src/core/statusManager";
import { DEFAULT_STATUSES, type StatusConfig } from "../../src/core/status";

function mgr(
	statuses: StatusConfig[] = DEFAULT_STATUSES,
	defaultStatus = "open"
): StatusManager {
	return new StatusManager(statuses, defaultStatus);
}

describe("StatusManager defaults", () => {
	it("validates the default statuses", () => {
		expect(mgr().validate()).toEqual({ valid: true, errors: [] });
	});

	it("returns statuses sorted by order", () => {
		const shuffled = [...DEFAULT_STATUSES].reverse();
		expect(mgr(shuffled).getStatusesByOrder().map((s) => s.value)).toEqual([
			"open",
			"in-progress",
			"done",
		]);
	});

	it("looks up a status config by value", () => {
		expect(mgr().getStatusConfig("done")?.label).toBe("Done");
		expect(mgr().getStatusConfig("nope")).toBeUndefined();
	});
});

describe("StatusManager cycling", () => {
	it("cycles in order and wraps around", () => {
		const m = mgr();
		expect(m.getNextStatus("open")).toBe("in-progress");
		expect(m.getNextStatus("in-progress")).toBe("done");
		expect(m.getNextStatus("done")).toBe("open");
	});

	it("honors nextStatus override when valid", () => {
		const statuses: StatusConfig[] = [
			{ id: "open", value: "open", label: "Open", color: "#1", isCompleted: false, order: 0, nextStatus: "done" },
			{ id: "wip", value: "wip", label: "WIP", color: "#2", isCompleted: false, order: 1 },
			{ id: "done", value: "done", label: "Done", color: "#3", isCompleted: true, order: 2 },
		];
		expect(mgr(statuses).getNextStatus("open")).toBe("done");
	});

	it("skips statuses excluded from the cycle", () => {
		const statuses: StatusConfig[] = [
			{ id: "open", value: "open", label: "Open", color: "#1", isCompleted: false, order: 0 },
			{ id: "hold", value: "hold", label: "Hold", color: "#2", isCompleted: false, order: 1, excludeFromCycle: true },
			{ id: "done", value: "done", label: "Done", color: "#3", isCompleted: true, order: 2 },
		];
		expect(mgr(statuses).getNextStatus("open")).toBe("done");
	});

	it("falls back to default for unknown current status", () => {
		expect(mgr().getNextStatus("bogus")).toBe("open");
	});
});

describe("StatusManager completion + normalize", () => {
	it("reports completed status", () => {
		expect(mgr().isCompletedStatus("done")).toBe(true);
		expect(mgr().isCompletedStatus("open")).toBe(false);
		expect(mgr().isCompletedStatus("bogus")).toBe(false);
	});

	it("normalizes unknown values to the default status", () => {
		expect(mgr().normalizeStatusValue("done")).toBe("done");
		expect(mgr().normalizeStatusValue("bogus")).toBe("open");
		expect(mgr().normalizeStatusValue(42)).toBe("open");
		expect(mgr().normalizeStatusValue(undefined)).toBe("open");
	});
});

describe("StatusManager validation", () => {
	const base = (over: Partial<StatusConfig>, ...rest: StatusConfig[]): StatusConfig[] => [
		{ id: "open", value: "open", label: "Open", color: "#1", isCompleted: false, order: 0, ...over },
		...rest,
	];

	it("requires at least two statuses", () => {
		const result = new StatusManager(base({}), "open").validate();
		expect(result.valid).toBe(false);
	});

	it("requires at least one completed status", () => {
		const statuses: StatusConfig[] = [
			{ id: "a", value: "a", label: "A", color: "#1", isCompleted: false, order: 0 },
			{ id: "b", value: "b", label: "B", color: "#2", isCompleted: false, order: 1 },
		];
		const result = new StatusManager(statuses, "a").validate();
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => /completed/i.test(e))).toBe(true);
	});

	it("rejects duplicate values, duplicate ids, missing default, and bad nextStatus", () => {
		const dupValue: StatusConfig[] = [
			{ id: "a", value: "x", label: "A", color: "#1", isCompleted: false, order: 0 },
			{ id: "b", value: "x", label: "B", color: "#2", isCompleted: true, order: 1 },
		];
		expect(new StatusManager(dupValue, "x").validate().valid).toBe(false);

		const missingDefault = new StatusManager(DEFAULT_STATUSES, "ghost").validate();
		expect(missingDefault.valid).toBe(false);

		const selfNext: StatusConfig[] = [
			{ id: "open", value: "open", label: "O", color: "#1", isCompleted: false, order: 0, nextStatus: "open" },
			{ id: "done", value: "done", label: "D", color: "#2", isCompleted: true, order: 1 },
		];
		expect(new StatusManager(selfNext, "open").validate().valid).toBe(false);
	});
});
