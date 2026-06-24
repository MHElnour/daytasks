// Copies the built plugin into a local Obsidian vault for manual testing.
//
// Usage:
//   OBSIDIAN_VAULT="/path/to/Vault" npm run install-plugin
//   npm run install-plugin -- /path/to/Vault
//
// The plugin lands in <vault>/.obsidian/plugins/daytasks/.
import { access, copyFile, mkdir, readFile } from "node:fs/promises";
import { argv, env, exit } from "node:process";
import path from "node:path";

const FILES = ["main.js", "manifest.json", "styles.css"];

async function main() {
	const vault = argv[2] ?? env.OBSIDIAN_VAULT;
	if (!vault) {
		console.error(
			"DayTasks: set OBSIDIAN_VAULT or pass the vault path as an argument."
		);
		exit(1);
	}

	for (const file of FILES) {
		try {
			await access(file);
		} catch {
			console.error(`DayTasks: missing ${file}. Run "npm run build" first.`);
			exit(1);
		}
	}

	const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
	const target = path.join(vault, ".obsidian", "plugins", manifest.id);
	await mkdir(target, { recursive: true });

	for (const file of FILES) {
		await copyFile(file, path.join(target, file));
	}

	console.log(`DayTasks: installed ${manifest.id} to ${target}`);
	console.log("Reload Obsidian (or toggle the plugin) to pick up changes.");
}

main().catch((error) => {
	console.error("DayTasks: install failed", error);
	exit(1);
});
