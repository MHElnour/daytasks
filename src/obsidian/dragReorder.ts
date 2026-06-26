import Sortable from "sortablejs";

/**
 * Direct-child task ids of a card list, in DOM order. Reads the `data-task-id`
 * of each immediate `<li>.daytasks-note-widget__card`'s `.task-card`, so nested
 * subtask cards (deeper in the tree) are not counted as siblings.
 */
export function siblingOrder(listEl: HTMLElement): string[] {
	const ids: string[] = [];
	for (const li of Array.from(listEl.children)) {
		if (!li.classList.contains("daytasks-note-widget__card")) {
			continue;
		}
		const card = li.querySelector(":scope > .task-card");
		const id = card?.getAttribute("data-task-id");
		if (id) {
			ids.push(id);
		}
	}
	return ids;
}

export interface ReorderHandle {
	destroy(): void;
}

/**
 * Wires SortableJS onto one sibling list. Dragging is grabbed by the card handle
 * only; groups are NOT shared, so items never cross between lists (siblings-only).
 */
export function attachReorder(
	listEl: HTMLElement,
	parentId: string | null,
	onReorder: (parentId: string | null, orderedIds: string[]) => void
): ReorderHandle {
	const sortable = Sortable.create(listEl, {
		handle: ".task-card__handle",
		draggable: ".daytasks-note-widget__card",
		animation: 150,
		onEnd: () => onReorder(parentId, siblingOrder(listEl)),
	});
	return { destroy: () => sortable.destroy() };
}
