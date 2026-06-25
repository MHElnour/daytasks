import { afterEach, describe, expect, it, vi } from "vitest";
import { safeCssColor } from "../../src/util/cssColor";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("safeCssColor", () => {
	it("keeps a value the platform reports as a valid CSS color", () => {
		vi.stubGlobal("CSS", { supports: (prop: string, value: string) => value === "#00aa00" });
		expect(safeCssColor("#00aa00", "var(--text-muted)")).toBe("#00aa00");
	});

	it("falls back when the value is not a valid CSS color", () => {
		vi.stubGlobal("CSS", { supports: () => false });
		expect(safeCssColor('url("http://evil/track")', "var(--text-muted)")).toBe(
			"var(--text-muted)"
		);
	});

	it("falls back for a blank value", () => {
		vi.stubGlobal("CSS", { supports: () => true });
		expect(safeCssColor("   ", "var(--text-muted)")).toBe("var(--text-muted)");
	});

	it("passes the value through when CSS.supports is unavailable", () => {
		vi.stubGlobal("CSS", undefined);
		expect(safeCssColor("#123456", "fallback")).toBe("#123456");
	});
});
