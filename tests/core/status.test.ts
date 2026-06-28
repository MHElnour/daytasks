import { describe, expect, it } from "vitest";
import {
	withBlockedStatus,
	BLOCKED_STATUS_VALUE,
	RESERVED_BLOCKED_STATUS,
	DEFAULT_STATUSES,
	type StatusConfig,
} from "../../src/core/status";

describe("withBlockedStatus", () => {
	it("appends the reserved blocked status when absent", () => {
		const result = withBlockedStatus(DEFAULT_STATUSES);
		expect(result).toHaveLength(DEFAULT_STATUSES.length + 1);
		expect(result[result.length - 1]).toEqual(RESERVED_BLOCKED_STATUS);
		expect(result.filter((s) => s.value === BLOCKED_STATUS_VALUE)).toHaveLength(1);
	});

	it("replaces a user status that collides on the reserved 'blocked' value", () => {
		const collider: StatusConfig = {
			id: "mine",
			value: BLOCKED_STATUS_VALUE,
			label: "My blocked",
			color: "#123456",
			isCompleted: true,
			order: 5,
		};
		const result = withBlockedStatus([collider]);
		const blocked = result.filter((s) => s.value === BLOCKED_STATUS_VALUE);
		expect(blocked).toHaveLength(1);
		// The reserved one wins (not the user's collider).
		expect(blocked[0]).toEqual(RESERVED_BLOCKED_STATUS);
		expect(blocked[0].excludeFromCycle).toBe(true);
	});
});
