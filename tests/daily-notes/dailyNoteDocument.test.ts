import { describe, expect, it } from "vitest";
import type { DayTask } from "../../src/core/task";
import { upsertDailyTaskLine } from "../../src/daily-notes/dailyNoteDocument";

const task: DayTask = {
	id: "TSK-8cA562sd",
	title: "Buy milk",
	status: "open",
	scheduledDate: "2026-06-24",
	timeEntries: [],
	createdAt: "2026-06-24T08:00:00.000Z",
	updatedAt: "2026-06-24T08:00:00.000Z",
};

describe("upsertDailyTaskLine", () => {
	it("creates a task section when missing", () => {
		expect(upsertDailyTaskLine("", task, "Tasks")).toBe(
			"## Tasks\n\n- [ ] Buy milk <!-- TSK-8cA562sd -->\n"
		);
	});

	it("appends a task to an existing task section", () => {
		const input = "Intro\n\n## Tasks\n\n- [ ] Existing <!-- TSK-existing1 -->\n";

		expect(upsertDailyTaskLine(input, task, "Tasks")).toBe(
			"Intro\n\n## Tasks\n\n- [ ] Existing <!-- TSK-existing1 -->\n- [ ] Buy milk <!-- TSK-8cA562sd -->\n"
		);
	});

	it("updates an existing task line by id", () => {
		const doneTask = { ...task, status: "done" as const };
		const input = "## Tasks\n\n- [ ] Old title <!-- TSK-8cA562sd -->\n";

		expect(upsertDailyTaskLine(input, doneTask, "Tasks")).toBe(
			"## Tasks\n\n- [x] Buy milk <!-- TSK-8cA562sd -->\n"
		);
	});
});
