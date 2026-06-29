import {
	DEFAULT_PRIORITIES,
	DEFAULT_PRIORITY_VALUE,
	DEFAULT_STATUS_VALUE,
	DEFAULT_STATUSES,
	type PriorityConfig,
	type StatusConfig,
} from "../core/status";
import { StatusManager } from "../core/statusManager";
import { DEFAULT_TASK_LIST_STATE, type TaskListState } from "../core/taskListState";
import { isRecord } from "../util/isRecord";
import {
	asStringOr,
	asBooleanOr,
	asFiniteNumberOr,
	asStringArrayOr,
} from "../util/coerce";

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
	// Inline capture
	enableInlineCapture: boolean;
	// Task defaults
	defaultStatus: string;
	defaultPriority?: string;
	defaultTags: string[];
	defaultProjectPath: string;
	createDetailNoteByDefault: boolean;
	detailNotesFolder: string;
	/** One-time flag: legacy detail notes normalized (filename + dropped title). */
	detailNotesMigrated: boolean;
	// Status / priority config
	statuses: StatusConfig[];
	priorities: PriorityConfig[];
	// API (schema only for this slice)
	apiEnabled: boolean;
	apiPort: number;
	apiToken: string;
	// Task list view
	taskListState: TaskListState;
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
	enableInlineCapture: true,
	defaultStatus: DEFAULT_STATUS_VALUE,
	defaultPriority: DEFAULT_PRIORITY_VALUE,
	defaultTags: [],
	defaultProjectPath: "",
	createDetailNoteByDefault: false,
	detailNotesFolder: "DayTasks/Tasks",
	detailNotesMigrated: false,
	statuses: cloneStatuses(DEFAULT_STATUSES),
	priorities: clonePriorities(DEFAULT_PRIORITIES),
	apiEnabled: false,
	apiPort: 9982,
	apiToken: "",
	taskListState: { ...DEFAULT_TASK_LIST_STATE },
};

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
		// Keep a usable config: enough statuses, at least one completed one, and
		// no semantic errors (duplicate values/ids, bad nextStatus). The default
		// status is resolved separately, so seed the validator with valid[0].
		if (
			valid.length >= 2 &&
			valid.some((status) => status.isCompleted) &&
			new StatusManager(valid, valid[0].value).validate().valid
		) {
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

function asTaskListState(value: unknown): TaskListState {
	if (!isRecord(value)) {
		return { ...DEFAULT_TASK_LIST_STATE };
	}
	const v = value;
	const strArr = (x: unknown): string[] =>
		Array.isArray(x) ? x.filter((e): e is string => typeof e === "string") : [];
	const oneOf = <T extends string>(x: unknown, allowed: readonly T[], fallback: T): T =>
		typeof x === "string" && (allowed as readonly string[]).includes(x) ? x as T : fallback;
	return {
		statuses: strArr(v.statuses),
		datePreset: oneOf(v.datePreset, ["all", "today", "overdue", "next7"] as const, "all"),
		tags: strArr(v.tags),
		contexts: strArr(v.contexts),
		projects: strArr(v.projects),
		search: typeof v.search === "string" ? v.search : "",
		groupBy: oneOf(v.groupBy, ["status", "scheduled", "project"] as const, "status"),
		sortBy: oneOf(v.sortBy, ["scheduled", "due", "priority", "created", "title"] as const, "scheduled"),
		sortDir: oneOf(v.sortDir, ["asc", "desc"] as const, "asc"),
	};
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
			taskListState: { ...DEFAULT_TASK_LIST_STATE },
		};
	}

	const s = stored as Record<string, unknown>;
	const statuses = asStatuses(s.statuses);
	const statusValues = new Set(statuses.map((status) => status.value));

	let defaultStatus = asStringOr(s.defaultStatus, DEFAULT_STATUS_VALUE);
	if (!statusValues.has(defaultStatus)) {
		defaultStatus = statusValues.has(DEFAULT_STATUS_VALUE)
			? DEFAULT_STATUS_VALUE
			: statuses[0].value;
	}

	return {
		dailyNoteFolder: asStringOr(s.dailyNoteFolder, DEFAULT_SETTINGS.dailyNoteFolder),
		dailyNoteDateFormat: asStringOr(
			s.dailyNoteDateFormat,
			DEFAULT_SETTINGS.dailyNoteDateFormat
		),
		showDailyNoteWidget: asBooleanOr(
			s.showDailyNoteWidget,
			DEFAULT_SETTINGS.showDailyNoteWidget
		),
		widgetPosition: "bottom",
		showTaskIds: asBooleanOr(s.showTaskIds, DEFAULT_SETTINGS.showTaskIds),
		showTags: asBooleanOr(s.showTags, DEFAULT_SETTINGS.showTags),
		showContexts: asBooleanOr(s.showContexts, DEFAULT_SETTINGS.showContexts),
		showProjects: asBooleanOr(s.showProjects, DEFAULT_SETTINGS.showProjects),
		enableInlineCapture: asBooleanOr(
			s.enableInlineCapture,
			DEFAULT_SETTINGS.enableInlineCapture
		),
		defaultStatus,
		defaultPriority: asStringOr(
			s.defaultPriority,
			DEFAULT_SETTINGS.defaultPriority ?? DEFAULT_PRIORITY_VALUE
		),
		defaultTags: asStringArrayOr(s.defaultTags, DEFAULT_SETTINGS.defaultTags),
		defaultProjectPath: asStringOr(
			s.defaultProjectPath,
			DEFAULT_SETTINGS.defaultProjectPath
		),
		createDetailNoteByDefault: asBooleanOr(
			s.createDetailNoteByDefault,
			DEFAULT_SETTINGS.createDetailNoteByDefault
		),
		detailNotesFolder: asStringOr(
			s.detailNotesFolder,
			DEFAULT_SETTINGS.detailNotesFolder
		),
		detailNotesMigrated: asBooleanOr(
			s.detailNotesMigrated,
			DEFAULT_SETTINGS.detailNotesMigrated
		),
		statuses,
		priorities: asPriorities(s.priorities),
		apiEnabled: asBooleanOr(s.apiEnabled, DEFAULT_SETTINGS.apiEnabled),
		apiPort: asFiniteNumberOr(s.apiPort, DEFAULT_SETTINGS.apiPort),
		apiToken: asStringOr(s.apiToken, DEFAULT_SETTINGS.apiToken),
		taskListState: asTaskListState(s.taskListState),
	};
}
