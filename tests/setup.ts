// Obsidian augments the DOM at runtime: `activeDocument` / `activeWindow` getters
// (focused window) and a cross-window-safe `Node.instanceOf()`. happy-dom has
// neither, so shim them here so pure-DOM modules that use these APIs run under
// vitest exactly as they do in Obsidian.
Object.defineProperty(globalThis, "activeWindow", {
	configurable: true,
	get: () => window,
});
Object.defineProperty(globalThis, "activeDocument", {
	configurable: true,
	get: () => document,
});
if (!("instanceOf" in Node.prototype)) {
	Object.defineProperty(Node.prototype, "instanceOf", {
		configurable: true,
		writable: true,
		value: function instanceOf(type: new (...args: unknown[]) => unknown): boolean {
			return this instanceof type;
		},
	});
}
