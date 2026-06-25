// Local release step 1 (build, no publish).
//
//   npm run release -- <patch|minor|major|X.Y.Z>
//
// Bumps the version across manifest.json / package.json / versions.json, runs
// the check gate + production build, rolls docs/releases/unreleased.md into a
// versioned notes file, then commits "release X.Y.Z" and tags X.Y.Z. Nothing is
// pushed or published — review, then run `npm run release:publish`.
//
// All shell-outs use execFileSync with argument arrays (no shell), so nothing is
// interpolated into a command string.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { argv, exit } from "node:process";

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
const capture = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const fail = (msg) => {
	console.error(`\nrelease: ${msg}`);
	exit(1);
};

const arg = argv[2];
if (!arg) fail("usage: npm run release -- <patch|minor|major|X.Y.Z>");

if (capture("git", ["status", "--porcelain"])) {
	fail("working tree is not clean — commit or stash changes first.");
}

const branch = capture("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
if (branch !== "main") {
	console.warn(`release: warning — releasing from "${branch}", not main.`);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const [maj, min, pat] = manifest.version.split(".").map(Number);
// Canonical semver only: no leading zeros (1.2.3 ok, 0.1.01 rejected). Obsidian
// and npm require MAJOR.MINOR.PATCH — patch = bug fix, minor = feature, major = big.
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
let next;
if (SEMVER.test(arg)) next = arg;
else if (arg === "major") next = `${maj + 1}.0.0`;
else if (arg === "minor") next = `${maj}.${min + 1}.0`;
else if (arg === "patch") next = `${maj}.${min}.${pat + 1}`;
else fail(`invalid bump "${arg}" — use patch (bug fix) | minor (feature) | major (big) | X.Y.Z`);

if (capture("git", ["tag", "-l", next])) fail(`tag ${next} already exists.`);

console.log(`release: ${manifest.version} -> ${next}`);

// 1. Version files. Obsidian needs manifest.json + versions.json in sync.
manifest.version = next;
writeFileSync("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.version = next;
writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

const versions = existsSync("versions.json")
	? JSON.parse(readFileSync("versions.json", "utf8"))
	: {};
versions[next] = manifest.minAppVersion;
writeFileSync("versions.json", `${JSON.stringify(versions, null, 2)}\n`);

// 2. Gate + build the release assets (main.js, styles.css).
run("npm", ["run", "check"]);
run("npm", ["run", "build"]);

// 3. Roll user-facing notes: unreleased body -> docs/releases/<version>.md.
const notesFile = `docs/releases/${next}.md`;
const unreleasedPath = "docs/releases/unreleased.md";
const staged = ["manifest.json", "package.json", "versions.json"];
if (existsSync(unreleasedPath)) {
	const raw = readFileSync(unreleasedPath, "utf8");
	const commentEnd = raw.indexOf("-->");
	const preamble = commentEnd >= 0 ? raw.slice(0, commentEnd + 3) : raw.split("\n")[0];
	const body = (commentEnd >= 0 ? raw.slice(commentEnd + 3) : "").trim();
	if (body) {
		writeFileSync(notesFile, `# DayTasks ${next}\n\n${body}\n`);
		writeFileSync(unreleasedPath, `${preamble}\n`);
		staged.push(notesFile, unreleasedPath);
		console.log(`release: rolled notes -> ${notesFile}`);
	} else {
		console.warn("release: unreleased.md has no notes; the release will have no notes file.");
	}
}

// 4. Commit + tag (main.js/styles.css stay gitignored — they ship as assets).
run("git", ["add", ...staged]);
run("git", ["commit", "-m", `release ${next}`]);
// Annotated tag (some git configs require a message; Obsidian accepts either).
run("git", ["tag", "-a", next, "-m", `DayTasks ${next}`]);

console.log(`\nrelease: committed + tagged ${next}.`);
console.log("Review the commit and main.js, then publish:  npm run release:publish");
