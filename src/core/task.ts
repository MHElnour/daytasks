/** Status is a configurable string value (see StatusConfig), not a closed union. */
export type TaskStatus = string;

export interface TimeEntry {
	startTime: string;
	endTime?: string;
	description?: string;
}

export interface ProjectLink {
	path: string;
	title?: string;
}

export interface DayTask {
	id: string;
	title: string;
	status: string;
	priority?: string;

	scheduledDate: string;
	dueDate?: string;
	completedAt?: string;
	archivedAt?: string;

	parentId?: string;
	detailNotePath?: string;

	tags: string[];
	contexts: string[];
	projects: ProjectLink[];

	estimateMinutes?: number;
	description?: string;
	sortOrder?: string;

	timeEntries: TimeEntry[];

	createdAt: string;
	updatedAt: string;
}

export interface CreateDayTaskInput {
	title: string;
	scheduledDate: string;
	dueDate?: string;
	status?: string;
	priority?: string;

	parentId?: string;
	detailNote?: boolean;
	detailNotePath?: string;

	tags?: string[];
	contexts?: string[];
	projects?: ProjectLink[];

	estimateMinutes?: number;
	description?: string;
	sortOrder?: string;
}
