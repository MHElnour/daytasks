export interface ParsedDailyTaskLine {
	id: string;
	completed: boolean;
	title: string;
}

const DAILY_TASK_LINE_PATTERN = /^-\s+\[([ xX])\]\s+(.+?)\s+<!--\s+(TSK-[A-Za-z0-9]+)\s+-->\s*$/;

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
