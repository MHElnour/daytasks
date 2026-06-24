import { describe, expect, it } from "vitest";
import type { DayTask } from "../../src/core/task";
import { createTaskCardViewModel } from "../../src/ui/taskCard";

const task: DayTask = {
	id: "TSK-8cA562sd",
	title: "Buy milk",
	status: "done",
	scheduledDate: "2026-06-24",
	tags: ["errand", "home"],
	projects: [{ path: "Projects/Home.md", title: "Home" }],
	timeEntries: [],
	createdAt: "2026-06-24T08:00:00.000Z",
	updatedAt: "2026-06-24T08:00:00.000Z",
};

describe("createTaskCardViewModel", () => {
	it("creates a card model with status, tags, and project links", () => {
		expect(createTaskCardViewModel(task)).toEqual({
			id: "TSK-8cA562sd",
			title: "Buy milk",
			checked: true,
			status: "done",
			tags: ["errand", "home"],
			projects: [{ path: "Projects/Home.md", label: "Home" }],
		});
	});

	it("uses the project filename as a fallback label", () => {
		const model = createTaskCardViewModel({
			...task,
			projects: [{ path: "Projects/Client Launch.md" }],
		});

		expect(model.projects).toEqual([
			{ path: "Projects/Client Launch.md", label: "Client Launch" },
		]);
	});
});
