import type { App } from "obsidian";

/**
 * Obsidian's global search lives on the built-in `global-search` plugin, which
 * is only reachable through the **private** `app.internalPlugins` API. This
 * module is the single place that touches that unsupported surface: the unsafe
 * cast and the feature-detection are contained here so the rest of the plugin
 * stays typed, and a future Obsidian change breaks one small file (gracefully —
 * callers get `false`) instead of leaking an `any` cast across the codebase.
 */

interface GlobalSearchInstance {
	openGlobalSearch?(query: string): void;
}

interface InternalPluginsApp {
	internalPlugins?: {
		getPluginById(id: string): { instance?: GlobalSearchInstance } | null;
	};
}

/** Characters that are NOT valid inside an Obsidian tag name. */
const NON_TAG_CHARS = /[^\p{L}\p{N}/_-]/gu;

/**
 * Builds a `tag:#…` global-search query from a (possibly attacker-controlled,
 * persisted) tag. The tag is reduced to valid tag characters first so a value
 * like `evil" OR file:secret` cannot inject extra search operators into the
 * query (SEC-5).
 */
export function buildTagSearchQuery(tag: string): string {
	return `tag:#${tag.replace(NON_TAG_CHARS, "")}`;
}

/**
 * Opens Obsidian's global search pre-filled with `query`. Returns `false` when
 * the global-search plugin or its API is unavailable, so callers can fall back.
 */
export function openGlobalSearch(app: App, query: string): boolean {
	const internalPlugins = (app as unknown as InternalPluginsApp).internalPlugins;
	const instance = internalPlugins?.getPluginById("global-search")?.instance;
	if (!instance || typeof instance.openGlobalSearch !== "function") {
		return false;
	}
	instance.openGlobalSearch(query);
	return true;
}
