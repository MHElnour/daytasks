import type { ParsedTaskInput } from "./parseTaskInput";

/**
 * The scheduled date for a captured task: a parsed scheduled date, else a parsed
 * due date, else the source note's daily-note date, else today. DayTasks is
 * day-first, so a captured task always lands on a concrete day.
 */
export function resolveCaptureScheduledDate(
	parsed: Pick<ParsedTaskInput, "scheduledDate" | "dueDate">,
	noteDate: string | null,
	today: string
): string {
	return parsed.scheduledDate ?? parsed.dueDate ?? noteDate ?? today;
}

/** Replacement line for a captured task: prefix + title + code-spanned id. */
export function formatCapturedLine(prefix: string, title: string, taskId: string): string {
	return `${prefix}${title}  \`${taskId}\``;
}
