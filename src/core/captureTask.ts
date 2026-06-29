import type { ParsedTaskInput } from "./parseTaskInput";

/**
 * The scheduled date for a captured task: an explicit parsed `scheduled:` date,
 * else the source note's daily-note date, else today. A parsed `due:` date is a
 * deadline only and never sets the day the task sits on — capture lands the task
 * on a concrete actionable day (the note's day or today), keeping DayTasks
 * day-first. `dueDate` is accepted so the signature mirrors the parsed input, but
 * it is intentionally not part of the precedence.
 */
export function resolveCaptureScheduledDate(
	parsed: Pick<ParsedTaskInput, "scheduledDate" | "dueDate">,
	noteDate: string | null,
	today: string
): string {
	return parsed.scheduledDate ?? noteDate ?? today;
}

/** Replacement line for a captured task: prefix + title + code-spanned id. */
export function formatCapturedLine(prefix: string, title: string, taskId: string): string {
	return `${prefix}${title}  \`${taskId}\``;
}
