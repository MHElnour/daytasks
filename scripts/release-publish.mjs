// Local release step 2 (publish via CI). Run after `npm run release -- <bump>`.
//
//   npm run release:publish
//
// Pushes the release commit + the version tag. Pushing the tag triggers the
// GitHub Actions release workflow (.github/workflows/release.yml), which builds
// the plugin, attests build provenance, and creates the GitHub Release with the
// assets attached (main.js, manifest.json, styles.css). Nothing is built or
// uploaded locally — the runner is the single source of truth for the assets.
//
// All shell-outs use execFileSync with argument arrays (no shell).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { exit } from "node:process";

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
const capture = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const fail = (msg) => {
	console.error(`\nrelease:publish: ${msg}`);
	exit(1);
};

const version = JSON.parse(readFileSync("manifest.json", "utf8")).version;

// Guards: clean tree, tag exists and points at HEAD.
if (capture("git", ["status", "--porcelain"])) fail("working tree is not clean.");
if (!capture("git", ["tag", "-l", version])) {
	fail(`tag ${version} not found — run "npm run release -- <bump>" first.`);
}
// `^{commit}` dereferences an annotated tag to its commit for the comparison.
if (capture("git", ["rev-parse", `${version}^{commit}`]) !== capture("git", ["rev-parse", "HEAD"])) {
	fail(`tag ${version} is not at HEAD — re-run the release step.`);
}

const branch = capture("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
console.log(
	`release:publish: pushing ${branch} + tag ${version}; GitHub Actions will build, attest, and publish the release…`
);

run("git", ["push", "origin", branch]);
run("git", ["push", "origin", version]);

console.log(`\nrelease:publish: pushed tag ${version}. Watch the release build:`);
console.log("  https://github.com/MHElnour/daytasks/actions");
