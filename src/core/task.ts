export type TaskStatus = "open" | "done";

export interface TimeEntry {
	startTime: string;
	endTime?: string;
	description?: string;
}

export interface DayTask {
	id: string;
	title: string;
	status: TaskStatus;
	scheduledDate: string;
	dueDate?: string;
	parentId?: string;
	detailNotePath?: string;
	tags?: string[];
	contexts?: string[];
	timeEntries: TimeEntry[];
	createdAt: string;
	updatedAt: string;
}
