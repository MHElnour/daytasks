export interface TaskListState {
	statuses: string[];
	datePreset: "all" | "today" | "overdue" | "next7";
	tags: string[];
	contexts: string[];
	projects: string[];
	search: string;
	groupBy: "status" | "scheduled" | "project";
	sortBy: "scheduled" | "due" | "priority" | "created" | "title";
	sortDir: "asc" | "desc";
}

export const DEFAULT_TASK_LIST_STATE: TaskListState = {
	statuses: [],
	datePreset: "all",
	tags: [],
	contexts: [],
	projects: [],
	search: "",
	groupBy: "status",
	sortBy: "scheduled",
	sortDir: "asc",
};
