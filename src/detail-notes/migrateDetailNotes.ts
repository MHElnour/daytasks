import type { DayTask } from "../core/task";

/**
 * Dependencies for the one-time detail-note migration loop, injected so the
 * orchestration is testable without the Obsidian runtime (TEST-1).
 */
export interface MigrateDeps {
	/** All known tasks; only those with a `detailNotePath` are migrated. */
	tasks: DayTask[];
	/** Migrates one note, returning its new path when renamed, else null. */
	migrate(task: DayTask): Promise<string | null>;
	/** Called after a successful rename to persist the new link immediately. */
	onMigrated(taskId: string, newPath: string): Promise<void>;
	/** Called when a task's migration throws; the loop continues. */
	onError(taskId: string, error: unknown): void;
}

/**
 * Runs the detail-note migration over every task that has a detail note.
 *
 * A successful rename's new link is persisted immediately via `onMigrated`, so a
 * later failure can never leave the rename and the stored path diverged. Returns
 * `true` only when the whole pass was clean — the caller sets the "migrated" flag
 * (and stops re-running) only on `true`, so a task that errors is retried on the
 * next run (`migrate` is idempotent).
 */
export async function runDetailNoteMigration(deps: MigrateDeps): Promise<boolean> {
	let allOk = true;
	for (const task of deps.tasks) {
		if (!task.detailNotePath) {
			continue;
		}
		try {
			const newPath = await deps.migrate(task);
			if (newPath) {
				await deps.onMigrated(task.id, newPath);
			}
		} catch (error) {
			deps.onError(task.id, error);
			allOk = false;
		}
	}
	return allOk;
}
