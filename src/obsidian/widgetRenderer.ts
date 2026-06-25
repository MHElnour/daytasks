import { chipColor } from "../util/chipColor";
import type { TaskCardViewModel } from "../ui/taskCard";
import type { DailyTasksWidgetModel } from "../ui/todayView";

export interface WidgetRenderOptions {
	showTaskIds: boolean;
	showTags: boolean;
	showContexts: boolean;
	showProjects: boolean;
}

export interface WidgetRenderHandlers {
	onToggleComplete(taskId: string): void;
	onCycleStatus(taskId: string): void;
	onAddTask?(): void;
	onEditTask?(taskId: string): void;
	onOpenProject?(path: string): void;
	onSelectTag?(tag: string): void;
}

/** Root class names: `daytasks-plugin` scopes the ported TaskNotes CSS. */
export const WIDGET_ROOT_CLASSES = ["daytasks-plugin", "daytasks-note-widget"];

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
	text?: string
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) {
		node.className = className;
	}
	if (text !== undefined) {
		node.textContent = text;
	}
	return node;
}

function colorChip(
	className: string,
	rawLabel: string,
	text: string
): HTMLElement {
	const chip = el("a", className, text);
	chip.style.setProperty("--chip-color", chipColor(rawLabel));
	return chip;
}

function stop(event: Event): void {
	event.stopPropagation();
}

function renderMetadata(
	card: TaskCardViewModel,
	options: WidgetRenderOptions,
	handlers: WidgetRenderHandlers
): HTMLElement | null {
	const metadata = el("div", "task-card__metadata");
	let rendered = false;

	if (card.dueLabel) {
		const due = el("span", "task-card__due", `📅 ${card.dueLabel}`);
		if (card.overdue) {
			due.classList.add("is-overdue");
		}
		metadata.appendChild(due);
		rendered = true;
	}

	if (options.showTags && card.tags.length > 0) {
		const group = el("span", "task-card__chips");
		for (const tag of card.tags) {
			const chip = colorChip("task-card__chip", tag, `#${tag}`);
			chip.addEventListener("click", (event) => {
				stop(event);
				handlers.onSelectTag?.(tag);
			});
			group.appendChild(chip);
		}
		metadata.appendChild(group);
		rendered = true;
	}

	if (options.showContexts && card.contexts.length > 0) {
		const group = el("span", "task-card__chips");
		for (const context of card.contexts) {
			group.appendChild(colorChip("task-card__chip", context, `@${context}`));
		}
		metadata.appendChild(group);
		rendered = true;
	}

	if (options.showProjects && card.projects.length > 0) {
		const group = el("span", "task-card__chips");
		for (const project of card.projects) {
			const chip = colorChip("task-card__chip task-card__chip--project", project.label, `↗ ${project.label}`);
			chip.dataset.path = project.path;
			chip.addEventListener("click", (event) => {
				stop(event);
				handlers.onOpenProject?.(project.path);
			});
			group.appendChild(chip);
		}
		metadata.appendChild(group);
		rendered = true;
	}

	if (card.estimateLabel) {
		metadata.appendChild(el("span", "task-card__estimate", `Est: ${card.estimateLabel}`));
		rendered = true;
	}

	return rendered ? metadata : null;
}

function renderTaskCard(
	card: TaskCardViewModel,
	options: WidgetRenderOptions,
	handlers: WidgetRenderHandlers
): HTMLElement {
	const wrapper = el("li", "daytasks-note-widget__card");

	const cardEl = el("div", "task-card");
	cardEl.dataset.taskId = card.id;
	cardEl.dataset.status = card.status;
	if (card.checked) {
		cardEl.classList.add("task-card--completed");
	}
	if (card.overdue) {
		cardEl.classList.add("task-card--overdue");
	}
	if (handlers.onEditTask) {
		cardEl.classList.add("task-card--interactive");
		cardEl.addEventListener("click", () => handlers.onEditTask?.(card.id));
	}

	const mainRow = el("div", "task-card__main-row");

	const checkbox = el("input", "task-card__checkbox");
	checkbox.type = "checkbox";
	checkbox.checked = card.checked;
	checkbox.setAttribute("aria-label", `Complete ${card.title}`);
	checkbox.addEventListener("click", stop);
	checkbox.addEventListener("change", () => handlers.onToggleComplete(card.id));
	mainRow.appendChild(checkbox);

	const content = el("div", "task-card__content");

	const titleRow = el("div", "task-card__title-row");
	titleRow.appendChild(el("span", "task-card__title-text", card.title));

	const statusPill = el("button", "task-card__status");
	statusPill.style.setProperty("--daytasks-status-color", card.statusColor);
	statusPill.appendChild(el("span", "task-card__status-dot"));
	statusPill.appendChild(el("span", "task-card__status-label", card.statusLabel));
	statusPill.setAttribute("aria-label", `Status: ${card.statusLabel} (click to advance)`);
	statusPill.addEventListener("click", (event) => {
		stop(event);
		handlers.onCycleStatus(card.id);
	});
	titleRow.appendChild(statusPill);
	content.appendChild(titleRow);

	if (options.showTaskIds) {
		content.appendChild(el("div", "task-card__id", `Task ID: ${card.id}`));
	}
	if (card.description) {
		content.appendChild(el("div", "task-card__description", card.description));
	}
	const metadata = renderMetadata(card, options, handlers);
	if (metadata) {
		content.appendChild(metadata);
	}

	mainRow.appendChild(content);
	cardEl.appendChild(mainRow);
	wrapper.appendChild(cardEl);
	return wrapper;
}

function renderFooter(model: DailyTasksWidgetModel): HTMLElement {
	const footer = el("div", "daytasks-widget__footer");
	footer.appendChild(
		el("span", "daytasks-widget__footer-total", `${model.totalCount} tasks total`)
	);

	const legend = el("div", "daytasks-widget__legend");
	for (const entry of model.statusSummary) {
		const item = el("span", "daytasks-widget__legend-item", `${entry.count} ${entry.label}`);
		const dot = el("span", "daytasks-widget__legend-dot");
		dot.style.setProperty("--daytasks-status-color", entry.color);
		item.prepend(dot);
		legend.appendChild(item);
	}
	if (model.overdueCount > 0) {
		legend.appendChild(
			el(
				"span",
				"daytasks-widget__legend-item daytasks-widget__legend-item--overdue",
				`${model.overdueCount} Overdue`
			)
		);
	}
	footer.appendChild(legend);
	return footer;
}

/**
 * Renders the DayTasks daily widget into `parent` and returns the root element.
 * Pure DOM (no Obsidian APIs) — unit-tested and reused by reading mode and
 * Live Preview.
 */
export function renderDailyTasksWidget(
	parent: HTMLElement,
	model: DailyTasksWidgetModel,
	options: WidgetRenderOptions,
	handlers: WidgetRenderHandlers
): HTMLElement {
	const root = el("div");
	root.classList.add(...WIDGET_ROOT_CLASSES);

	const header = el("div", "daytasks-widget__header");
	const left = el("div", "daytasks-widget__header-left");
	left.appendChild(el("span", "daytasks-widget__title", model.title));
	if (model.totalCount > 0) {
		left.appendChild(
			el("span", "daytasks-widget__count", `${model.totalCount} tasks`)
		);
	}
	header.appendChild(left);

	const right = el("div", "daytasks-widget__header-right");
	right.appendChild(el("span", "daytasks-widget__date", model.date));
	if (handlers.onAddTask) {
		const addButton = el("button", "daytasks-widget__add", "+ New Task");
		addButton.setAttribute("aria-label", "Add task");
		addButton.addEventListener("click", () => handlers.onAddTask?.());
		right.appendChild(addButton);
	}
	header.appendChild(right);
	root.appendChild(header);

	if (model.empty) {
		root.appendChild(el("div", "daytasks-widget__empty", "No tasks for this day."));
	} else {
		const list = el("ul", "daytasks-cards");
		for (const card of model.cards) {
			list.appendChild(renderTaskCard(card, options, handlers));
		}
		root.appendChild(list);
		root.appendChild(renderFooter(model));
	}

	parent.appendChild(root);
	return root;
}
