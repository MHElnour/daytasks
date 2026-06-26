import tsParser from "@typescript-eslint/parser";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

// Mirrors the Obsidian community scanner: eslint-plugin-obsidianmd +
// typescript-eslint recommendedTypeChecked, scoped to plugin source (src/**/*.ts).
export default [
	{
		// The plugin source is TypeScript under src/; ignore everything else so the
		// type-checked rules only run against files covered by tsconfig.
		ignores: [
			"node_modules/**",
			"coverage/**",
			"daytask-vault/**",
			"**/*.js",
			"**/*.mjs",
			"**/*.cjs",
			"styles.css",
			"vitest.config.ts",
			"tests/**",
			"package.json",
			"package-lock.json",
			"versions.json",
			"tsconfig.json",
		],
	},
	...tseslint.configs.recommendedTypeChecked.map((config) => ({
		...config,
		files: ["src/**/*.ts"],
	})),
	...obsidianmd.configs.recommended,
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: "./tsconfig.json",
				sourceType: "module",
			},
			globals: {
				activeDocument: "readonly",
				activeWindow: "readonly",
			},
		},
		rules: {
			// Off by default in obsidianmd v0.3.0 ("not working as intended"): it
			// flags the brand name "DayTasks" and date tokens like "YYYY-MM-DD".
			"obsidianmd/ui/sentence-case": "off",
			// Scanner allows warn/error/debug only.
			"no-console": ["error", { allow: ["warn", "error", "debug"] }],
			// Match the project's underscore-prefixed intentional discards.
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
		},
	},
];
