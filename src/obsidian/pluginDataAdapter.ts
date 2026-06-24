import type { DayTask, TaskStatus } from "../core/task";
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

function isTaskStatus(value: unknown): value is TaskStatus {
	return value === "open" || value === "done";
}

function isValidTask(value: unknown): value is DayTask {
	if (!isRecord(value)) {
		return false;
	}
	return (
		typeof value.id === "string" &&
		typeof value.title === "string" &&
		isTaskStatus(value.status) &&
		typeof value.scheduledDate === "string" &&
		Array.isArray(value.timeEntries) &&
		typeof value.createdAt === "string" &&
		typeof value.updatedAt === "string"
	);
}

/** Decodes raw plugin data, repairing or discarding anything malformed. */
export function decodePluginData(raw: unknown): DayTasksPluginData {
	if (!isRecord(raw)) {
		return { settings: mergeSettings(undefined), tasks: [] };
	}

	const tasks = Array.isArray(raw.tasks) ? raw.tasks.filter(isValidTask) : [];

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
