import {
	DEFAULT_PRIORITIES,
	DEFAULT_PRIORITY_VALUE,
	DEFAULT_STATUS_VALUE,
	DEFAULT_STATUSES,
	type PriorityConfig,
	type StatusConfig,
} from "../core/status";

export type WidgetPosition = "bottom";

export interface DayTasksSettings {
	// Daily notes
	dailyNoteFolder: string;
	dailyNoteDateFormat: string;
	// Widget
	showDailyNoteWidget: boolean;
	widgetPosition: WidgetPosition;
	showTaskIds: boolean;
	showTags: boolean;
	showContexts: boolean;
	showProjects: boolean;
	// Task defaults
	defaultStatus: string;
	defaultPriority?: string;
	defaultTags: string[];
	defaultProjectPath: string;
	createDetailNoteByDefault: boolean;
	detailNotesFolder: string;
	// Status / priority config
	statuses: StatusConfig[];
	priorities: PriorityConfig[];
	// API (schema only for this slice)
	apiEnabled: boolean;
	apiPort: number;
	apiToken: string;
}

function cloneStatuses(statuses: StatusConfig[]): StatusConfig[] {
	return statuses.map((status) => ({ ...status }));
}

function clonePriorities(priorities: PriorityConfig[]): PriorityConfig[] {
	return priorities.map((priority) => ({ ...priority }));
}

export const DEFAULT_SETTINGS: DayTasksSettings = {
	dailyNoteFolder: "",
	dailyNoteDateFormat: "YYYY-MM-DD",
	showDailyNoteWidget: true,
	widgetPosition: "bottom",
	showTaskIds: true,
	showTags: true,
	showContexts: true,
	showProjects: true,
	defaultStatus: DEFAULT_STATUS_VALUE,
	defaultPriority: DEFAULT_PRIORITY_VALUE,
	defaultTags: [],
	defaultProjectPath: "",
	createDetailNoteByDefault: false,
	detailNotesFolder: "DayTasks/Tasks",
	statuses: cloneStatuses(DEFAULT_STATUSES),
	priorities: clonePriorities(DEFAULT_PRIORITIES),
	apiEnabled: false,
	apiPort: 9982,
	apiToken: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function asString(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
	if (!Array.isArray(value)) {
		return [...fallback];
	}
	return value.filter((entry): entry is string => typeof entry === "string");
}

function isStatusConfig(value: unknown): value is StatusConfig {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.value === "string" &&
		typeof value.label === "string" &&
		typeof value.color === "string" &&
		typeof value.isCompleted === "boolean" &&
		typeof value.order === "number"
	);
}

function isPriorityConfig(value: unknown): value is PriorityConfig {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.value === "string" &&
		typeof value.label === "string" &&
		typeof value.color === "string" &&
		typeof value.weight === "number"
	);
}

function asStatuses(value: unknown): StatusConfig[] {
	if (Array.isArray(value)) {
		const valid = value.filter(isStatusConfig).map((status) => ({ ...status }));
		// Keep a usable config: enough statuses and at least one completed one.
		if (valid.length >= 2 && valid.some((status) => status.isCompleted)) {
			return valid;
		}
	}
	return cloneStatuses(DEFAULT_STATUSES);
}

function asPriorities(value: unknown): PriorityConfig[] {
	if (Array.isArray(value)) {
		const valid = value.filter(isPriorityConfig).map((priority) => ({ ...priority }));
		if (valid.length > 0) {
			return valid;
		}
	}
	return clonePriorities(DEFAULT_PRIORITIES);
}

/**
 * Merges persisted settings over the defaults, dropping unknown keys, coercing
 * wrongly-typed values, and migrating to a valid status/priority config.
 */
export function mergeSettings(stored: unknown): DayTasksSettings {
	if (!stored || typeof stored !== "object") {
		return {
			...DEFAULT_SETTINGS,
			defaultTags: [...DEFAULT_SETTINGS.defaultTags],
			statuses: cloneStatuses(DEFAULT_STATUSES),
			priorities: clonePriorities(DEFAULT_PRIORITIES),
		};
	}

	const s = stored as Record<string, unknown>;
	const statuses = asStatuses(s.statuses);
	const statusValues = new Set(statuses.map((status) => status.value));

	let defaultStatus = asString(s.defaultStatus, DEFAULT_STATUS_VALUE);
	if (!statusValues.has(defaultStatus)) {
		defaultStatus = statusValues.has(DEFAULT_STATUS_VALUE)
			? DEFAULT_STATUS_VALUE
			: statuses[0].value;
	}

	return {
		dailyNoteFolder: asString(s.dailyNoteFolder, DEFAULT_SETTINGS.dailyNoteFolder),
		dailyNoteDateFormat: asString(
			s.dailyNoteDateFormat,
			DEFAULT_SETTINGS.dailyNoteDateFormat
		),
		showDailyNoteWidget: asBoolean(
			s.showDailyNoteWidget,
			DEFAULT_SETTINGS.showDailyNoteWidget
		),
		widgetPosition: "bottom",
		showTaskIds: asBoolean(s.showTaskIds, DEFAULT_SETTINGS.showTaskIds),
		showTags: asBoolean(s.showTags, DEFAULT_SETTINGS.showTags),
		showContexts: asBoolean(s.showContexts, DEFAULT_SETTINGS.showContexts),
		showProjects: asBoolean(s.showProjects, DEFAULT_SETTINGS.showProjects),
		defaultStatus,
		defaultPriority: asString(
			s.defaultPriority,
			DEFAULT_SETTINGS.defaultPriority ?? DEFAULT_PRIORITY_VALUE
		),
		defaultTags: asStringArray(s.defaultTags, DEFAULT_SETTINGS.defaultTags),
		defaultProjectPath: asString(
			s.defaultProjectPath,
			DEFAULT_SETTINGS.defaultProjectPath
		),
		createDetailNoteByDefault: asBoolean(
			s.createDetailNoteByDefault,
			DEFAULT_SETTINGS.createDetailNoteByDefault
		),
		detailNotesFolder: asString(
			s.detailNotesFolder,
			DEFAULT_SETTINGS.detailNotesFolder
		),
		statuses,
		priorities: asPriorities(s.priorities),
		apiEnabled: asBoolean(s.apiEnabled, DEFAULT_SETTINGS.apiEnabled),
		apiPort: asNumber(s.apiPort, DEFAULT_SETTINGS.apiPort),
		apiToken: asString(s.apiToken, DEFAULT_SETTINGS.apiToken),
	};
}
