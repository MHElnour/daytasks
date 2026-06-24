import { TASK_ID_INLINE_SOURCE } from "../core/taskIds";

export interface ParsedDailyTaskLine {
	id: string;
	completed: boolean;
	title: string;
}

const DAILY_TASK_LINE_PATTERN = new RegExp(
	`^-\\s+\\[([ xX])\\]\\s+(.+?)\\s+<!--\\s+(${TASK_ID_INLINE_SOURCE})\\s+-->\\s*$`
);

export function parseDailyTaskLine(line: string): ParsedDailyTaskLine | null {
	const match = line.match(DAILY_TASK_LINE_PATTERN);
	if (!match) {
		return null;
	}

	return {
		id: match[3],
		completed: match[1].toLowerCase() === "x",
		title: match[2].trim(),
	};
}
