import process from "node:process";
import esbuild from "esbuild";

const production = process.argv.includes("--production");

const banner = "/* DayTasks plugin - bundled by esbuild. Do not edit directly. */";

// Provided by Obsidian's runtime; never bundle these.
const external = [
	"obsidian",
	"electron",
	"@codemirror/autocomplete",
	"@codemirror/collab",
	"@codemirror/commands",
	"@codemirror/language",
	"@codemirror/lint",
	"@codemirror/search",
	"@codemirror/state",
	"@codemirror/view",
	"@lezer/common",
	"@lezer/highlight",
	"@lezer/lr",
];

const options = {
	entryPoints: ["src/main.ts"],
	bundle: true,
	format: "cjs",
	target: "es2020",
	platform: "browser",
	external,
	outfile: "main.js",
	sourcemap: production ? false : "inline",
	minify: production,
	treeShaking: true,
	logLevel: "info",
	banner: { js: banner },
};

if (production) {
	await esbuild.build(options);
	console.log("DayTasks: production build complete (main.js).");
} else {
	const ctx = await esbuild.context(options);
	await ctx.rebuild();
	await ctx.watch();
	console.log("DayTasks: watching for changes…");
}
