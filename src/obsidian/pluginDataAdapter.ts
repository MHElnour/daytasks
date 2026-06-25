import type { DayTask, ProjectLink } from "../core/task";
import { mergeSettings, type DayTasksSettings } from "../settings/settings";

/** Minimal surface of Obsidian's `Plugin` data API, kept narrow for testing. */
export interface PluginDataPort {
	loadData(): Promise<unknown>;
	saveData(data: unknown): Promise<void>;
}

export interface DayTasksPluginData {
	settings: DayTasksSettings;
	tasks: DayTask[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isValidTask(value: unknown): value is Record<string, unknown> {
	if (!isRecord(value)) {
		return false;
	}
	return (
		typeof value.id === "string" &&
		typeof value.title === "string" &&
		typeof value.status === "string" &&
		typeof value.scheduledDate === "string" &&
		Array.isArray(value.timeEntries) &&
		typeof value.createdAt === "string" &&
		typeof value.updatedAt === "string"
	);
}

function isProjectLink(value: unknown): value is ProjectLink {
	return isRecord(value) && typeof value.path === "string";
}

function asStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((entry): entry is string => typeof entry === "string")
		: [];
}

/** Fills the always-present arrays so stored (possibly older) tasks are valid. */
function normalizeStoredTask(task: Record<string, unknown>): DayTask {
	return {
		...(task as unknown as DayTask),
		tags: asStringArray(task.tags),
		contexts: asStringArray(task.contexts),
		projects: Array.isArray(task.projects)
			? task.projects.filter(isProjectLink).map((project) => ({ ...project }))
			: [],
	};
}

/** Decodes raw plugin data, repairing or discarding anything malformed. */
export function decodePluginData(raw: unknown): DayTasksPluginData {
	if (!isRecord(raw)) {
		return { settings: mergeSettings(undefined), tasks: [] };
	}

	const tasks = Array.isArray(raw.tasks)
		? raw.tasks.filter(isValidTask).map(normalizeStoredTask)
		: [];

	return {
		settings: mergeSettings(raw.settings),
		tasks,
	};
}

/** Serializes plugin data to the persisted shape. */
export function encodePluginData(data: DayTasksPluginData): DayTasksPluginData {
	return {
		settings: data.settings,
		tasks: data.tasks,
	};
}

/** Wraps a plugin data port with decode/encode so core stays Obsidian-free. */
export class DayTasksDataStore {
	constructor(private readonly port: PluginDataPort) {}

	async load(): Promise<DayTasksPluginData> {
		const raw = await this.port.loadData();
		return decodePluginData(raw);
	}

	async save(data: DayTasksPluginData): Promise<void> {
		await this.port.saveData(encodePluginData(data));
	}
}
