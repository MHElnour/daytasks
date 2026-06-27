import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../../src/settings/settings";
import { DEFAULT_TASK_LIST_STATE } from "../../src/core/taskListState";

describe("DEFAULT_SETTINGS", () => {
	it("matches the spec defaults", () => {
		expect(DEFAULT_SETTINGS).toMatchObject({
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
		});
	});
});

describe("mergeSettings", () => {
	it("returns defaults when stored data is missing or not an object", () => {
		expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
		expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(mergeSettings("nope")).toEqual(DEFAULT_SETTINGS);
	});

	it("overlays stored values on top of defaults", () => {
		const merged = mergeSettings({
			showTags: false,
			apiPort: 1234,
			defaultTags: ["work"],
			defaultProjectPath: "Projects/Home.md",
		});

		expect(merged.showTags).toBe(false);
		expect(merged.apiPort).toBe(1234);
		expect(merged.defaultTags).toEqual(["work"]);
		expect(merged.defaultProjectPath).toBe("Projects/Home.md");
		expect(merged.showProjects).toBe(true);
		expect(merged.widgetPosition).toBe("bottom");
	});

	it("ignores unknown keys and wrongly-typed values", () => {
		const merged = mergeSettings({
			bogus: "x",
			apiPort: "not-a-number",
			defaultTags: "not-an-array",
		});

		expect(merged).toEqual(DEFAULT_SETTINGS);
		expect(merged).not.toHaveProperty("bogus");
	});

	it("keeps only string entries inside defaultTags", () => {
		const merged = mergeSettings({ defaultTags: ["ok", 2, null, "fine"] });

		expect(merged.defaultTags).toEqual(["ok", "fine"]);
	});

	it("does not share array references with DEFAULT_SETTINGS", () => {
		const merged = mergeSettings({});
		merged.defaultTags.push("mutated");

		expect(DEFAULT_SETTINGS.defaultTags).toEqual([]);
	});

	it("preserves a cleared default priority as none across reload", () => {
		// "" is the persisted "no default priority" choice; it must round-trip
		// rather than being coerced back to the "normal" default (P2-1).
		expect(mergeSettings({ defaultPriority: "" }).defaultPriority).toBe("");
		expect(mergeSettings({ defaultPriority: "high" }).defaultPriority).toBe("high");
	});

	it("provides default statuses and priorities", () => {
		const merged = mergeSettings({});
		expect(merged.statuses.map((s) => s.value)).toEqual([
			"open",
			"in-progress",
			"done",
		]);
		expect(merged.defaultStatus).toBe("open");
		expect(merged.priorities.length).toBeGreaterThan(0);
	});

	it("keeps a valid custom status config", () => {
		const custom = [
			{ id: "todo", value: "todo", label: "Todo", color: "#1", isCompleted: false, order: 0 },
			{ id: "shipped", value: "shipped", label: "Shipped", color: "#2", isCompleted: true, order: 1 },
		];
		const merged = mergeSettings({ statuses: custom, defaultStatus: "todo" });
		expect(merged.statuses.map((s) => s.value)).toEqual(["todo", "shipped"]);
		expect(merged.defaultStatus).toBe("todo");
	});

	it("falls back to default statuses when stored config is broken", () => {
		const merged = mergeSettings({ statuses: [{ nope: true }] });
		expect(merged.statuses.map((s) => s.value)).toEqual([
			"open",
			"in-progress",
			"done",
		]);
	});

	it("coerces a default status that is not in the status list", () => {
		const merged = mergeSettings({ defaultStatus: "ghost" });
		expect(merged.defaultStatus).toBe("open");
	});

	it("falls back to defaults when stored statuses have duplicate values", () => {
		const duplicates = [
			{ id: "a", value: "dup", label: "A", color: "#1", isCompleted: false, order: 0 },
			{ id: "b", value: "dup", label: "B", color: "#2", isCompleted: true, order: 1 },
		];
		const merged = mergeSettings({ statuses: duplicates });
		expect(merged.statuses.map((s) => s.value)).toEqual([
			"open",
			"in-progress",
			"done",
		]);
	});

	it("falls back to defaults when a status points nextStatus at an unknown value", () => {
		const badNext = [
			{
				id: "todo",
				value: "todo",
				label: "Todo",
				color: "#1",
				isCompleted: false,
				order: 0,
				nextStatus: "ghost",
			},
			{ id: "done", value: "done", label: "Done", color: "#2", isCompleted: true, order: 1 },
		];
		const merged = mergeSettings({ statuses: badNext });
		expect(merged.statuses.map((s) => s.value)).toEqual([
			"open",
			"in-progress",
			"done",
		]);
	});

	it("defaults taskListState and accepts a stored one", () => {
		expect(mergeSettings(undefined).taskListState).toEqual(DEFAULT_TASK_LIST_STATE);
		const stored = { taskListState: { ...DEFAULT_TASK_LIST_STATE, groupBy: "project", search: "x" } };
		expect(mergeSettings(stored).taskListState.groupBy).toBe("project");
		expect(mergeSettings(stored).taskListState.search).toBe("x");
	});

	it("falls back to default taskListState when stored value is malformed", () => {
		expect(mergeSettings({ taskListState: 42 }).taskListState).toEqual(DEFAULT_TASK_LIST_STATE);
	});
});
