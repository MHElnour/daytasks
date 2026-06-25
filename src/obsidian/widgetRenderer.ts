import { chipColor } from "../util/chipColor";
import { truncate } from "../util/truncate";
import type { TaskCardViewModel } from "../ui/taskCard";
import type { DailyTasksWidgetModel } from "../ui/todayView";

/** Card titles are capped so the top row stays a single, predictable height. */
const MAX_TITLE_LENGTH = 100;

export interface WidgetRenderOptions {
	showTaskIds: boolean;
	showTags: boolean;
	showContexts: boolean;
	showProjects: boolean;
}

export interface WidgetRenderHandlers {
	onCycleStatus(taskId: string): void;
	onCyclePriority?(taskId: string): void;
	onAddTask?(): void;
	onEditTask?(taskId: string): void;
	onOpenProject?(path: string): void;
	onSelectTag?(tag: string): void;
	onToggleSubtasks?(taskId: string): void;
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

/**
 * Makes a non-button element (e.g. an `<a>` chip without `href`) operable like a
 * button: focusable via keyboard, announced as a button, and activatable with
 * click or Enter/Space. Stops propagation so it never triggers the card click.
 */
function makeActivatable(element: HTMLElement, activate: () => void): void {
	element.setAttribute("role", "button");
	element.tabIndex = 0;
	element.addEventListener("click", (event) => {
		event.stopPropagation();
		activate();
	});
	element.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			event.stopPropagation();
			activate();
		}
	});
}

/**
 * A metadata item shown as a Lucide icon + value. The icon span is left empty
 * with a `data-icon` attribute; the Obsidian caller fills it via `setIcon` after
 * render, so this stays pure DOM (and unit-testable). The icon is decorative —
 * the value text carries the meaning.
 */
function metaWithIcon(className: string, iconName: string, text: string): HTMLElement {
	const item = el("span", `task-card__meta ${className}`);
	const icon = el("span", "task-card__meta-icon");
	icon.dataset.icon = iconName;
	icon.setAttribute("aria-hidden", "true");
	item.appendChild(icon);
	item.appendChild(el("span", "task-card__meta-text", text));
	return item;
}

function renderMetadata(
	card: TaskCardViewModel,
	options: WidgetRenderOptions,
	handlers: WidgetRenderHandlers
): HTMLElement | null {
	const metadata = el("div", "task-card__metadata");

	if (card.dueLabel) {
		const due = metaWithIcon("task-card__due", "calendar-clock", card.dueLabel);
		if (card.overdue) {
			due.classList.add("is-overdue");
		}
		metadata.appendChild(due);
	}

	metadata.appendChild(
		metaWithIcon("task-card__scheduled", "calendar", card.scheduledLabel)
	);

	if (card.estimateLabel) {
		metadata.appendChild(metaWithIcon("task-card__estimate", "clock", card.estimateLabel));
	}


	if (options.showProjects && card.projects.length > 0) {
		for (const project of card.projects) {
			const link = colorChip(
				"task-card__meta task-card__project",
				project.label,
				`↗ ${project.label}`
			);
			link.dataset.path = project.path;
			makeActivatable(link, () => handlers.onOpenProject?.(project.path));
			metadata.appendChild(link);
		}
	}

	if (options.showContexts && card.contexts.length > 0) {
		for (const context of card.contexts) {
			metadata.appendChild(el("span", "task-card__meta task-card__context", `@${context}`));
		}
	}

	return metadata;
}

/** Tags rendered as colored boxes on their own line below the meta row. */
function renderTags(
	card: TaskCardViewModel,
	options: WidgetRenderOptions,
	handlers: WidgetRenderHandlers
): HTMLElement | null {
	if (!options.showTags || card.tags.length === 0) {
		return null;
	}
	const row = el("div", "task-card__tags");
	for (const tag of card.tags) {
		const chip = colorChip("task-card__tag", tag, `#${tag}`);
		makeActivatable(chip, () => handlers.onSelectTag?.(tag));
		row.appendChild(chip);
	}
	return row;
}

/** Icon-only status control: the status icon, tinted; the label shows on hover. */
function renderStatusControl(
	card: TaskCardViewModel,
	handlers: WidgetRenderHandlers
): HTMLElement {
	const button = el("button", "task-card__status");
	button.style.setProperty("--daytasks-status-color", card.statusColor);
	const icon = el("span", "task-card__status-icon");
	icon.dataset.icon = card.statusIcon ?? "circle";
	icon.setAttribute("aria-hidden", "true");
	button.appendChild(icon);
	button.setAttribute("aria-label", `Status: ${card.statusLabel} (click to advance)`);
	button.setAttribute("title", card.statusLabel);
	button.addEventListener("click", (event) => {
		stop(event);
		handlers.onCycleStatus(card.id);
	});
	return button;
}

/** Always-present priority flag; click cycles the priority. */
function renderPriorityControl(
	card: TaskCardViewModel,
	handlers: WidgetRenderHandlers
): HTMLElement {
	const button = el("button", "task-card__priority-control");
	button.style.setProperty("--chip-color", card.priorityColor ?? "var(--text-muted)");
	const icon = el("span", "task-card__priority-icon");
	icon.dataset.icon = card.priorityIcon ?? "flag";
	icon.setAttribute("aria-hidden", "true");
	button.appendChild(icon);
	const label = card.priorityLabel ?? "None";
	button.setAttribute("aria-label", `Priority: ${label} (click to change)`);
	button.setAttribute("title", `Priority: ${label}`);
	button.addEventListener("click", (event) => {
		stop(event);
		handlers.onCyclePriority?.(card.id);
	});
	return button;
}

/** Subtask disclosure chevron (parent cards only). */
function renderDisclosure(
	card: TaskCardViewModel,
	handlers: WidgetRenderHandlers
): HTMLElement {
	const button = el("button", "task-card__disclosure");
	button.setAttribute("aria-expanded", String(card.expanded));
	button.setAttribute("aria-controls", `subtasks-${card.id}`);
	button.setAttribute("aria-label", card.expanded ? "Collapse subtasks" : "Expand subtasks");
	if (card.expanded) {
		button.classList.add("is-expanded");
	}
	const chevron = el("span", "task-card__disclosure-icon");
	chevron.dataset.icon = "chevron-right";
	chevron.setAttribute("aria-hidden", "true");
	button.appendChild(chevron);
	button.addEventListener("click", (event) => {
		stop(event);
		handlers.onToggleSubtasks?.(card.id);
	});
	return button;
}

/** Subtask progress bar with a `done/total` label. */
function renderProgress(progress: { done: number; total: number }): HTMLElement {
	const wrap = el("div", "task-card__progress-wrap");
	const bar = el("progress", "task-card__progress");
	bar.max = progress.total;
	bar.value = progress.done;
	bar.setAttribute("aria-label", `${progress.done} of ${progress.total} subtasks done`);
	wrap.appendChild(bar);
	wrap.appendChild(el("span", "task-card__progress-label", `${progress.done}/${progress.total}`));
	return wrap;
}

/**
 * Top-right control cluster (priority + status). Absolutely positioned via CSS so
 * it never takes flow width from the title/metadata.
 */
function renderRailTop(
	card: TaskCardViewModel,
	handlers: WidgetRenderHandlers
): HTMLElement {
	const top = el("div", "task-card__rail-top");
	top.appendChild(renderPriorityControl(card, handlers));
	top.appendChild(renderStatusControl(card, handlers));
	return top;
}

/**
 * Bottom-right control cluster (subtask progress + expand chevron), or `null` for
 * a leaf card. Absolutely positioned via CSS.
 */
function renderRailBottom(
	card: TaskCardViewModel,
	handlers: WidgetRenderHandlers
): HTMLElement | null {
	if (!card.childProgress && card.children.length === 0) {
		return null;
	}
	const bottom = el("div", "task-card__rail-bottom");
	if (card.childProgress) {
		bottom.appendChild(renderProgress(card.childProgress));
	}
	if (card.children.length > 0) {
		bottom.appendChild(renderDisclosure(card, handlers));
	}
	return bottom;
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
	if (card.childProgress) {
		cardEl.classList.add("task-card--parent");
	}
	if (handlers.onEditTask) {
		cardEl.classList.add("task-card--interactive");
		cardEl.addEventListener("click", () => handlers.onEditTask?.(card.id));
	}

	const mainRow = el("div", "task-card__main-row");

	const handle = el("span", "task-card__handle");
	handle.setAttribute("aria-hidden", "true");
	mainRow.appendChild(handle);

	const content = el("div", "task-card__content");

	// Top row is the title only (capped); the state + subtask controls live in a
	// fixed right-rail so their position never shifts with card content.
	const titleRow = el("div", "task-card__title-row");
	const titleBlock = el("div", "task-card__title-block");
	titleBlock.appendChild(el("span", "task-card__title-text", truncate(card.title, MAX_TITLE_LENGTH)));
	if (options.showTaskIds) {
		titleBlock.appendChild(el("div", "task-card__id", `Task ID: ${card.id}`));
	}
	titleRow.appendChild(titleBlock);
	content.appendChild(titleRow);

	if (card.description) {
		content.appendChild(el("div", "task-card__description", card.description));
	}
	const metadata = renderMetadata(card, options, handlers);
	if (metadata) {
		content.appendChild(metadata);
	}
	const tags = renderTags(card, options, handlers);
	if (tags) {
		content.appendChild(tags);
	}

	mainRow.appendChild(content);
	cardEl.appendChild(mainRow);

	// Control clusters are absolutely positioned (CSS), so they never steal flow
	// width from the title or metadata.
	cardEl.appendChild(renderRailTop(card, handlers));
	const railBottom = renderRailBottom(card, handlers);
	if (railBottom) {
		cardEl.appendChild(railBottom);
	}

	wrapper.appendChild(cardEl);

	if (card.children.length > 0) {
		const sublist = el("ul", "task-card__subtasks");
		sublist.id = `subtasks-${card.id}`;
		if (!card.expanded) {
			sublist.setAttribute("hidden", "");
		}
		for (const child of card.children) {
			sublist.appendChild(renderTaskCard(child, options, handlers));
		}
		wrapper.appendChild(sublist);
	}

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
	if (handlers.onAddTask) {
		const addButton = el("button", "daytasks-widget__add", "+ New Task");
		addButton.setAttribute("aria-label", "Add task");
		addButton.addEventListener("click", () => handlers.onAddTask?.());
		right.appendChild(addButton);
	}
	right.appendChild(el("span", "daytasks-widget__date", model.date));
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
