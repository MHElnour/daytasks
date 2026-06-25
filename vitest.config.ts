import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// DOM globals (document, window, CSS, …) for every test. Pure-logic tests
		// ignore them; renderer/DOM tests no longer need a per-file annotation.
		environment: "happy-dom",
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
		},
	},
});
