import type { DayTask } from "../core/task";
import { formatDailyTaskLine } from "./dailyNoteFormatter";

function normalizeLineEndings(content: string): string {
	return content.replace(/\r\n/g, "\n");
}

function findNextHeadingIndex(lines: string[], startIndex: number): number {
	for (let index = startIndex; index < lines.length; index += 1) {
		if (/^#{1,6}\s+/.test(lines[index])) {
			return index;
		}
	}
	return -1;
}

export function upsertDailyTaskLine(
	content: string,
	task: DayTask,
	completed: boolean,
	heading: string
): string {
	const taskLine = formatDailyTaskLine(task, completed);
	const headingLine = `## ${heading}`;
	const normalized = normalizeLineEndings(content);

	if (!normalized.trim()) {
		return `${headingLine}\n\n${taskLine}\n`;
	}

	const lines = normalized.endsWith("\n")
		? normalized.slice(0, -1).split("\n")
		: normalized.split("\n");
	const headingIndex = lines.findIndex((line) => line.trim() === headingLine);

	if (headingIndex === -1) {
		return `${normalized.endsWith("\n") ? normalized : `${normalized}\n`}\n${headingLine}\n\n${taskLine}\n`;
	}

	const nextHeadingIndex = findNextHeadingIndex(lines, headingIndex + 1);
	const sectionEndIndex = nextHeadingIndex === -1 ? lines.length : nextHeadingIndex;
	const taskComment = `<!-- ${task.id} -->`;

	for (let index = headingIndex + 1; index < sectionEndIndex; index += 1) {
		if (lines[index].includes(taskComment)) {
			lines[index] = taskLine;
			return `${lines.join("\n")}\n`;
		}
	}

	lines.splice(sectionEndIndex, 0, taskLine);
	return `${lines.join("\n")}\n`;
}
