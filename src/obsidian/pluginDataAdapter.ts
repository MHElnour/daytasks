import type { DayTask, ProjectLink, TimeEntry } from "../core/task";
import { mergeSettings, type DayTasksSettings } from "../settings/settings";
import { isRecord } from "../util/isRecord";

/** Minimal surface of Obsidian's `Plugin` data API, kept narrow for testing. */
export interface PluginDataPort {
	loadData(): Promise<unknown>;
	saveData(data: unknown): Promise<void>;
}

export interface DayTasksPluginData {
	settings: DayTasksSettings;
	tasks: DayTask[];
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

function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Coerces to a list of unique strings (duplicates would double-index the task). */
function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const seen = new Set<string>();
	const result: string[] = [];
	for (const entry of value) {
		if (typeof entry === "string" && !seen.has(entry)) {
			seen.add(entry);
			result.push(entry);
		}
	}
	return result;
}

/** Coerces to project links, deduplicated by path (first occurrence wins). */
function asProjects(value: unknown): ProjectLink[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const seen = new Set<string>();
	const projects: ProjectLink[] = [];
	for (const raw of value) {
		if (!isProjectLink(raw) || seen.has(raw.path)) {
			continue;
		}
		seen.add(raw.path);
		const project: ProjectLink = { path: raw.path };
		const title = asString(raw.title);
		if (title !== undefined) {
			project.title = title;
		}
		projects.push(project);
	}
	return projects;
}

function asTimeEntries(value: unknown): TimeEntry[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const entries: TimeEntry[] = [];
	for (const raw of value) {
		if (!isRecord(raw) || typeof raw.startTime !== "string") {
			continue;
		}
		const entry: TimeEntry = { startTime: raw.startTime };
		const endTime = asString(raw.endTime);
		if (endTime !== undefined) {
			entry.endTime = endTime;
		}
		const description = asString(raw.description);
		if (description !== undefined) {
			entry.description = description;
		}
		entries.push(entry);
	}
	return entries;
}

/**
 * Builds a clean `DayTask` from a stored record whose required fields are
 * already verified by `isValidTask`. Optional fields are validated/coerced
 * individually so a malformed `data.json` cannot leak wrong-typed values into
 * the service or renderer.
 */
function normalizeStoredTask(task: Record<string, unknown>): DayTask {
	const normalized: DayTask = {
		id: task.id as string,
		title: task.title as string,
		status: task.status as string,
		scheduledDate: task.scheduledDate as string,
		tags: asStringArray(task.tags),
		contexts: asStringArray(task.contexts),
		projects: asProjects(task.projects),
		timeEntries: asTimeEntries(task.timeEntries),
		createdAt: task.createdAt as string,
		updatedAt: task.updatedAt as string,
	};

	const optionalStrings = [
		"priority",
		"dueDate",
		"completedAt",
		"archivedAt",
		"parentId",
		"detailNotePath",
		"description",
		"sortOrder",
	] as const;
	for (const key of optionalStrings) {
		const value = asString(task[key]);
		if (value !== undefined) {
			normalized[key] = value;
		}
	}

	// A task cannot be its own parent; drop a corrupt self-reference so it can't
	// loop the renderer. (Transitive parent cycles are pruned in Slice C.)
	if (normalized.parentId === normalized.id) {
		delete normalized.parentId;
	}

	const estimateMinutes = asFiniteNumber(task.estimateMinutes);
	if (estimateMinutes !== undefined) {
		normalized.estimateMinutes = estimateMinutes;
	}

	return normalized;
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
