// Local release step 2 (publish). Run after `npm run release -- <bump>`.
//
//   npm run release:publish
//
// Pushes the current branch + the version tag, then creates the GitHub Release
// for the version in manifest.json with the Obsidian assets attached
// (main.js, manifest.json, styles.css). Notes come from docs/releases/<v>.md
// when present, otherwise GitHub auto-generates them.
//
// All shell-outs use execFileSync with argument arrays (no shell).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { exit } from "node:process";

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
const capture = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const fail = (msg) => {
	console.error(`\nrelease:publish: ${msg}`);
	exit(1);
};

const version = JSON.parse(readFileSync("manifest.json", "utf8")).version;

// Guards: clean tree, tag exists and points at HEAD, assets built.
if (capture("git", ["status", "--porcelain"])) fail("working tree is not clean.");
if (!capture("git", ["tag", "-l", version])) {
	fail(`tag ${version} not found — run "npm run release -- <bump>" first.`);
}
if (capture("git", ["rev-parse", version]) !== capture("git", ["rev-parse", "HEAD"])) {
	fail(`tag ${version} is not at HEAD — re-run the release step.`);
}
for (const asset of ["main.js", "manifest.json", "styles.css"]) {
	if (!existsSync(asset)) fail(`missing asset ${asset} — run "npm run release" or "npm run build".`);
}

const branch = capture("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
console.log(`release:publish: pushing ${branch} + tag ${version}, creating GitHub release…`);

run("git", ["push", "origin", branch]);
run("git", ["push", "origin", version]);

const notesFile = `docs/releases/${version}.md`;
const notesArgs = existsSync(notesFile)
	? ["--notes-file", notesFile]
	: ["--generate-notes"];

run("gh", [
	"release",
	"create",
	version,
	"main.js",
	"manifest.json",
	"styles.css",
	"--title",
	version,
	...notesArgs,
]);

console.log(`\nrelease:publish: published ${version}.`);
