import { describe, expect, it } from "vitest";
import { siblingOrder } from "../../src/obsidian/dragReorder";

function listWith(ids: string[]): HTMLElement {
	const ul = document.createElement("ul");
	ul.className = "daytasks-cards";
	for (const id of ids) {
		const li = document.createElement("li");
		li.className = "daytasks-note-widget__card";
		const card = document.createElement("div");
		card.className = "task-card";
		card.dataset.taskId = id;
		li.appendChild(card);
		ul.appendChild(li);
	}
	return ul;
}

describe("siblingOrder", () => {
	it("returns direct child task ids in DOM order", () => {
		const ul = listWith(["a", "b", "c"]);
		expect(siblingOrder(ul)).toEqual(["a", "b", "c"]);
	});

	it("ignores cards nested deeper in the tree", () => {
		const ul = listWith(["a", "b"]);
		const nested = document.createElement("div");
		nested.className = "task-card";
		nested.dataset.taskId = "deep";
		ul.querySelector("li")!.appendChild(nested);
		expect(siblingOrder(ul)).toEqual(["a", "b"]);
	});
});
