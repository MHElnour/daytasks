import { describe, expect, it } from "vitest";
import { truncate } from "../../src/util/truncate";

describe("truncate", () => {
	it("leaves text at or under the limit unchanged", () => {
		expect(truncate("hello", 100)).toBe("hello");
		expect(truncate("x".repeat(100), 100)).toBe("x".repeat(100));
	});

	it("caps longer text at the limit with an ellipsis", () => {
		const result = truncate("y".repeat(150), 100);
		expect(result).toHaveLength(100);
		expect(result.endsWith("…")).toBe(true);
		expect(result).toBe("y".repeat(99) + "…");
	});
});
