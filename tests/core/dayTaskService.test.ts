import { describe, expect, it } from "vitest";
import { DayTaskService } from "../../src/core/dayTaskService";
import { MemoryTaskIndex } from "../../src/core/taskIndex";
import { MemoryTaskStore } from "../../src/core/taskStore";
import type { DailyNotePort } from "../../src/daily-notes/dailyNoteService";

class MemoryDailyNotePort implements DailyNotePort {
	private notes = new Map<string, string>();

	async read(date: string): Promise<string> {
		return this.notes.get(date) ?? "";
	}

	async write(date: string, content: string): Promise<void> {
		this.notes.set(date, content);
	}

	get(date: string): string {
		return this.notes.get(date) ?? "";
	}
}

describe("DayTaskService", () => {
	it("creates tasks in the store, index, and daily note", async () => {
		const dailyNotes = new MemoryDailyNotePort();
		const service = new DayTaskService({
			store: new MemoryTaskStore(),
			index: new MemoryTaskIndex(),
			dailyNotes,
			dailyTaskHeading: "Tasks",
			now: () => "2026-06-24T08:00:00.000Z",
			id: () => "TSK-8cA562sd",
		});

		const task = await service.createTask({
			title: "Buy milk",
			scheduledDate: "2026-06-24",
		});

		expect(task.id).toBe("TSK-8cA562sd");
		expect(await service.getTask("TSK-8cA562sd")).toEqual(task);
		expect(service.getTasksForDate("2026-06-24")).toEqual([task]);
		expect(dailyNotes.get("2026-06-24")).toBe(
			"## Tasks\n\n- [ ] Buy milk <!-- TSK-8cA562sd -->\n"
		);
	});

	it("toggles status and updates the daily note line", async () => {
		const dailyNotes = new MemoryDailyNotePort();
		const service = new DayTaskService({
			store: new MemoryTaskStore(),
			index: new MemoryTaskIndex(),
			dailyNotes,
			dailyTaskHeading: "Tasks",
			now: () => "2026-06-24T08:00:00.000Z",
			id: () => "TSK-8cA562sd",
		});

		await service.createTask({ title: "Buy milk", scheduledDate: "2026-06-24" });
		const updated = await service.toggleStatus("TSK-8cA562sd");

		expect(updated.status).toBe("done");
		expect(dailyNotes.get("2026-06-24")).toBe(
			"## Tasks\n\n- [x] Buy milk <!-- TSK-8cA562sd -->\n"
		);
	});
});
