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
	contexts: [],
	projects: [],
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
			droppedTasks: 0,
		});
		expect(decodePluginData("garbage")).toEqual({
			settings: DEFAULT_SETTINGS,
			tasks: [],
			droppedTasks: 0,
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

	it("drops wrongly-typed optional fields", () => {
		const decoded = decodePluginData({
			tasks: [
				{
					...validTask,
					priority: 5,
					dueDate: 123,
					estimateMinutes: "soon",
					description: { nope: true },
					parentId: 0,
				},
			],
		});

		const task = decoded.tasks[0];
		expect(task.priority).toBeUndefined();
		expect(task.dueDate).toBeUndefined();
		expect(task.estimateMinutes).toBeUndefined();
		expect(task.description).toBeUndefined();
		expect(task.parentId).toBeUndefined();
	});

	it("keeps valid optional fields", () => {
		const decoded = decodePluginData({
			tasks: [
				{
					...validTask,
					priority: "high",
					dueDate: "2026-07-01",
					estimateMinutes: 30,
					description: "note",
				},
			],
		});

		const task = decoded.tasks[0];
		expect(task.priority).toBe("high");
		expect(task.dueDate).toBe("2026-07-01");
		expect(task.estimateMinutes).toBe(30);
		expect(task.description).toBe("note");
	});

	it("filters malformed time entries and keeps valid ones", () => {
		const decoded = decodePluginData({
			tasks: [
				{
					...validTask,
					timeEntries: [
						{ startTime: "2026-06-25T08:00:00.000Z" },
						{
							startTime: "2026-06-25T09:00:00.000Z",
							endTime: "2026-06-25T10:00:00.000Z",
							description: "work",
						},
						{ endTime: "no-start" },
						null,
						"nope",
					],
				},
			],
		});

		expect(decoded.tasks[0].timeEntries).toEqual([
			{ startTime: "2026-06-25T08:00:00.000Z" },
			{
				startTime: "2026-06-25T09:00:00.000Z",
				endTime: "2026-06-25T10:00:00.000Z",
				description: "work",
			},
		]);
	});

	it("drops project links missing a path and non-string titles", () => {
		const decoded = decodePluginData({
			tasks: [
				{
					...validTask,
					projects: [{ path: "a.md", title: 5 }, { path: "b.md", title: "B" }, { nopath: true }],
				},
			],
		});

		expect(decoded.tasks[0].projects).toEqual([
			{ path: "a.md" },
			{ path: "b.md", title: "B" },
		]);
	});

	it("collapses duplicate tags, contexts, and project links on decode", () => {
		const decoded = decodePluginData({
			tasks: [
				{
					...validTask,
					tags: ["errand", "errand", "home"],
					contexts: ["phone", "phone"],
					projects: [
						{ path: "a.md" },
						{ path: "a.md", title: "dup" },
						{ path: "b.md" },
					],
				},
			],
		});

		const task = decoded.tasks[0];
		expect(task.tags).toEqual(["errand", "home"]);
		expect(task.contexts).toEqual(["phone"]);
		expect(task.projects).toEqual([{ path: "a.md" }, { path: "b.md" }]);
	});

	it("defaults missing arrays to empty on stored tasks", () => {
		const decoded = decodePluginData({
			tasks: [
				{
					id: "TSK-legacyOld",
					title: "Legacy",
					status: "done",
					scheduledDate: "2026-06-25",
					timeEntries: [],
					createdAt: "2026-06-25T08:00:00.000Z",
					updatedAt: "2026-06-25T08:00:00.000Z",
				},
			],
		});

		expect(decoded.tasks[0].tags).toEqual([]);
		expect(decoded.tasks[0].contexts).toEqual([]);
		expect(decoded.tasks[0].projects).toEqual([]);
	});

	it("drops a self-referential parentId", () => {
		const decoded = decodePluginData({ tasks: [{ ...validTask, parentId: validTask.id }] });
		expect(decoded.tasks[0].parentId).toBeUndefined();
	});

	it("keeps a parentId that points at another task", () => {
		const decoded = decodePluginData({ tasks: [{ ...validTask, parentId: "TSK-other0001" }] });
		expect(decoded.tasks[0].parentId).toBe("TSK-other0001");
	});

	it("coerces blockedBy and drops self + unknown ids", () => {
		const decoded = decodePluginData({
			tasks: [
				{ ...validTask, id: "TSK-aaaaaaaa", blockedBy: ["TSK-aaaaaaaa", "TSK-bbbbbbbb", 5, "TSK-ghost"] },
				{ ...validTask, id: "TSK-bbbbbbbb" },
			],
		});
		expect(decoded.tasks[0].blockedBy).toEqual(["TSK-bbbbbbbb"]);
	});

	it("breaks a cyclic blockedBy chain on load", () => {
		const decoded = decodePluginData({
			tasks: [
				{ ...validTask, id: "TSK-aaaaaaaa", blockedBy: ["TSK-bbbbbbbb"] },
				{ ...validTask, id: "TSK-bbbbbbbb", blockedBy: ["TSK-aaaaaaaa"] },
			],
		});
		const edges = decoded.tasks.flatMap((t) => (t.blockedBy ?? []).map((b) => `${t.id}->${b}`));
		// One direction is kept, the back-edge that would close the cycle is dropped.
		expect(edges).toHaveLength(1);
	});

	it("reports how many malformed tasks were dropped (DATA-4)", () => {
		const decoded = decodePluginData({ tasks: [validTask, null, { id: "x" }] });
		expect(decoded.tasks).toHaveLength(1);
		expect(decoded.droppedTasks).toBe(2);
	});

	it("reports zero dropped for all-valid data", () => {
		expect(decodePluginData({ tasks: [validTask] }).droppedTasks).toBe(0);
	});

	it("keeps sortOrder verbatim — it is an opaque lexicographic key, not validated (DATA-5)", () => {
		const decoded = decodePluginData({ tasks: [{ ...validTask, sortOrder: "abc" }] });
		expect(decoded.tasks[0].sortOrder).toBe("abc");
		expect(decoded.droppedTasks).toBe(0);
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

		// load() returns the decode result, which carries droppedTasks alongside
		// the round-tripped settings/tasks.
		expect(await store.load()).toEqual({ ...data, droppedTasks: 0 });
	});

	it("propagates a rejecting loadData so the host can recover with defaults (TEST-5)", async () => {
		const store = new DayTasksDataStore({
			loadData: () => Promise.reject(new Error("corrupt data.json")),
			saveData: () => Promise.resolve(),
		});
		await expect(store.load()).rejects.toThrow("corrupt data.json");
	});
});
