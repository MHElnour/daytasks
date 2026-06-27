import type { DayTask } from "../core/task";
import { noteBasename } from "../util/notePath";

/**
 * The full ordered list of frontmatter keys this plugin manages in a detail note.
 * Consumers can use this to know which keys to preserve vs. overwrite.
 */
export const MANAGED_FM_KEYS: readonly string[] = [
	"status",
	"priority",
	"scheduled",
	"due",
	"contexts",
	"projects",
	"estimate",
	"parentId",
	"taskId",
	"taskCreated",
	"dateCreated",
	"dateModified",
	"tags",
];

/**
 * Builds the managed frontmatter block for a task's detail note.
 *
 * Keys are inserted in spec order. Optional keys (`priority`, `due`, `contexts`,
 * `projects`, `estimate`, `parentId`) are omitted entirely when absent or empty.
 *
 * @param task         The source DayTask.
 * @param dateCreated  ISO timestamp for when the note was first created.
 * @param dateModified ISO timestamp for the current modification time.
 */
export function buildManagedFrontmatter(
	task: DayTask,
	dateCreated: string,
	dateModified: string
): Record<string, unknown> {
	const fm: Record<string, unknown> = {};

	// Required keys — always present. The note's own filename is its title, so
	// `title` is intentionally NOT a managed frontmatter property.
	fm["status"] = task.status;

	// Optional: priority
	if (task.priority != null) {
		fm["priority"] = task.priority;
	}

	// Required: scheduled
	fm["scheduled"] = task.scheduledDate;

	// Optional: due
	if (task.dueDate != null) {
		fm["due"] = task.dueDate;
	}

	// Optional: contexts (omit when empty)
	if (task.contexts.length > 0) {
		fm["contexts"] = task.contexts;
	}

	// Optional: projects (omit when empty), map to wikilinks
	if (task.projects.length > 0) {
		fm["projects"] = task.projects.map(
			(link) => `[[${noteBasename(link.path)}]]`
		);
	}

	// Optional: estimate (raw minutes)
	if (task.estimateMinutes != null) {
		fm["estimate"] = task.estimateMinutes;
	}

	// Optional: parentId
	if (task.parentId != null) {
		fm["parentId"] = task.parentId;
	}

	// Required: identity / audit keys
	fm["taskId"] = task.id;
	fm["taskCreated"] = task.createdAt;
	fm["dateCreated"] = dateCreated;
	fm["dateModified"] = dateModified;

	// Required: tags (copied as-is; already contains default "daytask")
	fm["tags"] = task.tags;

	return fm;
}
