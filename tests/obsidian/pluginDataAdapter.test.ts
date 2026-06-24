import { describe, expect, it } from "vitest";
import type { DayTask } from "../../src/core/task";
import {
	DayTasksDataStore,
	decodePluginData,
	type PluginDataPort,
} from "../../src/obsidian/pluginDataAdapter";
import { DEFAULT_SETTINGS } from "../../src/settings/settings";

const validTask: DayTask = {
	id: "TSK-8cA562sd",
	title: "Buy milk",
	status: "open",
	scheduledDate: "2026-06-25",
	tags: ["errand"],
	timeEntries: [],
	createdAt: "2026-06-25T08:00:00.000Z",
	updatedAt: "2026-06-25T08:00:00.000Z",
};

function fakePort(initial: unknown): PluginDataPort & { saved: unknown } {
	const port = {
		saved: undefined as unknown,
		store: initial,
		async loadData() {
			return port.store;
		},
		async saveData(data: unknown) {
			port.store = data;
			port.saved = data;
		},
	};
	return port;
}

describe("decodePluginData", () => {
	it("falls back to defaults and an empty task list for missing data", () => {
		expect(decodePluginData(undefined)).toEqual({
			settings: DEFAULT_SETTINGS,
			tasks: [],
		});
		expect(decodePluginData("garbage")).toEqual({
			settings: DEFAULT_SETTINGS,
			tasks: [],
		});
	});

	it("merges stored settings and keeps valid tasks", () => {
		const decoded = decodePluginData({
			settings: { showTags: false },
			tasks: [validTask],
		});

		expect(decoded.settings.showTags).toBe(false);
		expect(decoded.tasks).toEqual([validTask]);
	});

	it("drops malformed task entries", () => {
		const decoded = decodePluginData({
			tasks: [validTask, null, { id: "no-other-fields" }, 42],
		});

		expect(decoded.tasks).toEqual([validTask]);
	});
});

describe("DayTasksDataStore", () => {
	it("loads decoded data through the port", async () => {
		const port = fakePort({ settings: { apiPort: 5000 }, tasks: [validTask] });
		const store = new DayTasksDataStore(port);

		const data = await store.load();

		expect(data.settings.apiPort).toBe(5000);
		expect(data.tasks).toEqual([validTask]);
	});

	it("saves the serialized shape through the port", async () => {
		const port = fakePort(undefined);
		const store = new DayTasksDataStore(port);

		await store.save({ settings: DEFAULT_SETTINGS, tasks: [validTask] });

		expect(port.saved).toEqual({ settings: DEFAULT_SETTINGS, tasks: [validTask] });
	});

	it("round-trips saved data back through load", async () => {
		const port = fakePort(undefined);
		const store = new DayTasksDataStore(port);
		const data = { settings: DEFAULT_SETTINGS, tasks: [validTask] };

		await store.save(data);

		expect(await store.load()).toEqual(data);
	});
});
