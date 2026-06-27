import type { DayTask } from "../core/task";
import {
	buildManagedFrontmatter,
	MANAGED_FM_KEYS,
} from "./detailNoteFrontmatter";
import { localIso } from "../util/localIso";

// ---------------------------------------------------------------------------
// VaultPort — the narrow interface the service requires from the vault layer.
// The real implementation (over Obsidian vault/metadataCache/fileManager) is
// wired in Task 6. Tests drive this against FakeVaultPort.
// ---------------------------------------------------------------------------

export interface VaultPort {
	/** Returns true if a file exists at the given path. */
	exists(path: string): boolean;

	/** Creates any missing folders along the given path. */
	ensureFolder(path: string): Promise<void>;

	/** Creates a new file at `path` with the given body content. */
	create(path: string, content: string): Promise<void>;

	/**
	 * Returns the frontmatter of the file at `path`, or null if the file does
	 * not exist or has no frontmatter.
	 */
	readFrontmatter(path: string): Record<string, unknown> | null;

	/**
	 * Reads the frontmatter of the file at `path`, runs `mutate` against it,
	 * then writes the mutated frontmatter back. Non-managed keys are preserved.
	 */
	writeFrontmatter(
		path: string,
		mutate: (fm: Record<string, unknown>) => void
	): Promise<void>;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Removes the characters `\ / : * ? " < > |` from `title` and trims
 * surrounding whitespace. Safe for use in a file-system path.
 */
export function sanitizeFileBase(title: string): string {
	return title.replace(/[\\/:*?"<>|]/g, "").trim();
}

/**
 * Builds the preferred file name for a task's detail note: `<sanitized-title>.md`
 * (the note's filename IS its title). Falls back to the task id when the title
 * sanitizes to empty. `create` appends `-<id>` only on a name collision.
 */
export function detailNoteFileName(task: DayTask): string {
	return `${sanitizeFileBase(task.title) || task.id}.md`;
}

// ---------------------------------------------------------------------------
// DetailNoteService
// ---------------------------------------------------------------------------

export class DetailNoteService {
	constructor(
		private readonly port: VaultPort,
		private readonly now: () => Date
	) {}

	/**
	 * Creates a new detail note for `task` inside `folder`.
	 *
	 * Steps:
	 * 1. Ensure the folder exists.
	 * 2. Create the file with an empty body.
	 * 3. Write the managed frontmatter block via the port (no hand-rolled YAML).
	 * 4. Return the full path.
	 */
	async create(task: DayTask, folder: string): Promise<string> {
		await this.port.ensureFolder(folder);
		// Prefer a clean `<title>.md`; fall back to `<title>-<id>.md` only when
		// that name is already taken (e.g. another task with the same title).
		const preferred = `${folder}/${detailNoteFileName(task)}`;
		const base = sanitizeFileBase(task.title) || task.id;
		const path = this.port.exists(preferred)
			? `${folder}/${base}-${task.id}.md`
			: preferred;
		await this.port.create(path, "");
		const iso = localIso(this.now());
		const managed = buildManagedFrontmatter(task, iso, iso);
		await this.port.writeFrontmatter(path, (fm) => {
			for (const k of MANAGED_FM_KEYS) {
				if (k in managed) {
					fm[k] = managed[k];
				}
			}
		});
		return path;
	}

	/**
	 * Synchronises the managed frontmatter of the task's detail note with the
	 * current task state.
	 *
	 * - If `task.detailNotePath` is absent or the file does not exist: no-op.
	 * - Diff-guard: if all managed keys (except `dateModified`) are equal to
	 *   what the note already has, the write is skipped entirely (no timestamp
	 *   churn).
	 * - A managed key that the task no longer carries (e.g. `priority` removed)
	 *   is deleted from the note's frontmatter.
	 * - Non-managed keys the user added are never touched.
	 */
	async sync(task: DayTask): Promise<void> {
		const path = task.detailNotePath;
		if (!path || !this.port.exists(path)) return;

		const current = this.port.readFrontmatter(path) ?? {};

		// Preserve the original creation stamp; fall back to now if somehow absent.
		const dateCreated =
			(current["dateCreated"] as string) ?? localIso(this.now());
		const managed = buildManagedFrontmatter(
			task,
			dateCreated,
			localIso(this.now())
		);

		// Diff-guard: compare all managed keys except dateModified.
		const SKIP = new Set(["dateModified"]);
		const hasChanges = MANAGED_FM_KEYS.some((k) => {
			if (SKIP.has(k)) return false;
			return JSON.stringify(managed[k]) !== JSON.stringify(current[k]);
		});

		if (!hasChanges) return;

		await this.port.writeFrontmatter(path, (fm) => {
			for (const k of MANAGED_FM_KEYS) {
				if (k in managed) {
					fm[k] = managed[k];
				} else {
					delete fm[k];
				}
			}
			// Always update dateModified when writing.
			fm["dateModified"] = managed["dateModified"];
		});
	}
}
