/** Configurable task status (ported shape from TaskNotes StatusConfig). */
export interface StatusConfig {
	id: string;
	value: string;
	label: string;
	color: string;
	icon?: string;
	isCompleted: boolean;
	order: number;
	excludeFromCycle?: boolean;
	nextStatus?: string;
}

/** Configurable task priority. */
export interface PriorityConfig {
	id: string;
	value: string;
	label: string;
	color: string;
	icon?: string;
	weight: number;
}

export const DEFAULT_STATUSES: StatusConfig[] = [
	{
		id: "open",
		value: "open",
		label: "Open",
		color: "#808080",
		icon: "circle",
		isCompleted: false,
		order: 0,
	},
	{
		id: "in-progress",
		value: "in-progress",
		label: "In progress",
		color: "#0066cc",
		icon: "loader",
		isCompleted: false,
		order: 1,
	},
	{
		id: "done",
		value: "done",
		label: "Done",
		color: "#00aa00",
		icon: "check-circle",
		isCompleted: true,
		order: 2,
	},
];

export const DEFAULT_PRIORITIES: PriorityConfig[] = [
	{ id: "none", value: "none", label: "None", color: "#808080", weight: 0 },
	{ id: "low", value: "low", label: "Low", color: "#4aa3df", weight: 1 },
	{ id: "normal", value: "normal", label: "Normal", color: "#e0a800", weight: 2 },
	{ id: "high", value: "high", label: "High", color: "#d9534f", weight: 3 },
];

export const DEFAULT_STATUS_VALUE = "open";
export const DEFAULT_PRIORITY_VALUE = "normal";
