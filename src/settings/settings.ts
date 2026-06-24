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
	showProjects: boolean;
	// Task defaults
	defaultTags: string[];
	defaultProjectPath: string;
	detailNotesFolder: string;
	createDetailNoteByDefault: boolean;
	// API (schema only for this slice)
	apiEnabled: boolean;
	apiPort: number;
	apiToken: string;
}

export const DEFAULT_SETTINGS: DayTasksSettings = {
	dailyNoteFolder: "",
	dailyNoteDateFormat: "YYYY-MM-DD",
	showDailyNoteWidget: true,
	widgetPosition: "bottom",
	showTaskIds: true,
	showTags: true,
	showProjects: true,
	defaultTags: [],
	defaultProjectPath: "",
	detailNotesFolder: "DayTasks/Tasks",
	createDetailNoteByDefault: false,
	apiEnabled: false,
	apiPort: 9982,
	apiToken: "",
};

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

/**
 * Merges persisted settings over the defaults, dropping unknown keys and
 * coercing wrongly-typed values back to their defaults.
 */
export function mergeSettings(stored: unknown): DayTasksSettings {
	if (!stored || typeof stored !== "object") {
		return { ...DEFAULT_SETTINGS, defaultTags: [...DEFAULT_SETTINGS.defaultTags] };
	}

	const s = stored as Record<string, unknown>;

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
		showProjects: asBoolean(s.showProjects, DEFAULT_SETTINGS.showProjects),
		defaultTags: asStringArray(s.defaultTags, DEFAULT_SETTINGS.defaultTags),
		defaultProjectPath: asString(
			s.defaultProjectPath,
			DEFAULT_SETTINGS.defaultProjectPath
		),
		detailNotesFolder: asString(
			s.detailNotesFolder,
			DEFAULT_SETTINGS.detailNotesFolder
		),
		createDetailNoteByDefault: asBoolean(
			s.createDetailNoteByDefault,
			DEFAULT_SETTINGS.createDetailNoteByDefault
		),
		apiEnabled: asBoolean(s.apiEnabled, DEFAULT_SETTINGS.apiEnabled),
		apiPort: asNumber(s.apiPort, DEFAULT_SETTINGS.apiPort),
		apiToken: asString(s.apiToken, DEFAULT_SETTINGS.apiToken),
	};
}
