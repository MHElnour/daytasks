import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import { openGlobalSearch } from "../../src/obsidian/globalSearch";

function fakeApp(instance?: { openGlobalSearch?: (query: string) => void }): App {
	return {
		internalPlugins: {
			getPluginById: (id: string) => (id === "global-search" ? { instance } : null),
		},
	} as unknown as App;
}

describe("openGlobalSearch", () => {
	it("invokes the global-search plugin with the query and returns true", () => {
		const open = vi.fn();
		const app = fakeApp({ openGlobalSearch: open });

		expect(openGlobalSearch(app, "tag:#errand")).toBe(true);
		expect(open).toHaveBeenCalledWith("tag:#errand");
	});

	it("returns false when internalPlugins is unavailable", () => {
		const app = {} as unknown as App;
		expect(openGlobalSearch(app, "tag:#errand")).toBe(false);
	});

	it("returns false when the global-search plugin is not found", () => {
		const app = {
			internalPlugins: { getPluginById: () => null },
		} as unknown as App;
		expect(openGlobalSearch(app, "tag:#errand")).toBe(false);
	});

	it("returns false when the plugin lacks an openGlobalSearch function", () => {
		const app = fakeApp({});
		expect(openGlobalSearch(app, "tag:#errand")).toBe(false);
	});
});
