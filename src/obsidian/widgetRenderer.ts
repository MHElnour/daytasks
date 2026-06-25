import type { TaskCardViewModel } from "../ui/taskCard";
import type { DailyTasksWidgetModel } from "../ui/todayView";

export interface WidgetRenderOptions {
	showTaskIds: boolean;
	showTags: boolean;
	showContexts: boolean;
	showProjects: boolean;
}

export interface WidgetRenderHandlers {
	onToggleTask(taskId: string): void;
	onAddTask?(): void;
	onEditTask?(taskId: string): void;
	onOpenProject?(path: string): void;
	onSelectTag?(tag: string): void;
}

/** Root class names: `daytasks-plugin` scopes the ported TaskNotes CSS.
 * `daytasks-note-widget` is our own container class (not TaskNotes') to avoid
 * restyling TaskNotes when both plugins are installed. */
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

function renderMetadata(
	content: HTMLElement,
	card: TaskCardViewModel,
	options: WidgetRenderOptions,
	handlers: WidgetRenderHandlers
): void {
	const hasId = options.showTaskIds;
	const hasTags = options.showTags && card.tags.length > 0;
	const hasContexts = options.showContexts && card.contexts.length > 0;
	const hasProjects = options.showProjects && card.projects.length > 0;
	const hasMeta =
		hasId ||
		hasTags ||
		hasContexts ||
		hasProjects ||
		Boolean(card.dueDate) ||
		Boolean(card.estimateLabel);
	if (!hasMeta) {
		return;
	}

	const metadata = el("div", "task-card__metadata");

	if (hasId) {
		metadata.appendChild(el("span", "task-card__id", card.id));
	}

	if (card.dueDate) {
		metadata.appendChild(el("span", "task-card__due", `due ${card.dueDate}`));
	}

	if (card.estimateLabel) {
		metadata.appendChild(el("span", "task-card__estimate", `~${card.estimateLabel}`));
	}

	if (hasTags) {
		const tagsProp = el(
			"span",
			"task-card__metadata-property task-card__metadata-property--tags"
		);
		for (const tag of card.tags) {
			const chip = el("a", "tag", tag);
			chip.addEventListener("click", (event) => {
				event.stopPropagation();
				handlers.onSelectTag?.(tag);
			});
			tagsProp.appendChild(chip);
		}
		metadata.appendChild(tagsProp);
	}

	if (hasContexts) {
		const contextsProp = el("span", "task-card__metadata-property");
		for (const context of card.contexts) {
			contextsProp.appendChild(el("span", "task-card__context", `@${context}`));
		}
		metadata.appendChild(contextsProp);
	}

	if (hasProjects) {
		const projectsProp = el("span", "task-card__metadata-property");
		for (const project of card.projects) {
			const pill = el("a", "task-card__project", project.label);
			pill.dataset.path = project.path;
			pill.addEventListener("click", (event) => {
				event.stopPropagation();
				handlers.onOpenProject?.(project.path);
			});
			projectsProp.appendChild(pill);
		}
		metadata.appendChild(projectsProp);
	}

	content.appendChild(metadata);
}

function renderTaskCard(
	card: TaskCardViewModel,
	options: WidgetRenderOptions,
	handlers: WidgetRenderHandlers
): HTMLElement {
	const wrapper = el("li", "daytasks-note-widget__card");

	const cardEl = el("div", "task-card");
	if (card.checked) {
		cardEl.classList.add("task-card--completed");
	}
	cardEl.dataset.taskId = card.id;
	cardEl.dataset.status = card.status;
	if (handlers.onEditTask) {
		cardEl.classList.add("task-card--interactive");
		cardEl.addEventListener("click", () => handlers.onEditTask?.(card.id));
	}

	const mainRow = el("div", "task-card__main-row");

	const statusDot = el("div", "task-card__status-dot");
	statusDot.setAttribute("role", "checkbox");
	statusDot.setAttribute("aria-checked", card.checked ? "true" : "false");
	statusDot.setAttribute("aria-label", `Toggle ${card.title}`);
	statusDot.title = card.statusLabel;
	statusDot.style.setProperty("--daytasks-status-color", card.statusColor);
	statusDot.tabIndex = 0;
	statusDot.addEventListener("click", (event) => {
		event.stopPropagation();
		handlers.onToggleTask(card.id);
	});
	statusDot.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			handlers.onToggleTask(card.id);
		}
	});
	mainRow.appendChild(statusDot);

	const content = el("div", "task-card__content");
	const title = el("div", "task-card__title");
	title.appendChild(el("span", "task-card__title-text", card.title));
	content.appendChild(title);
	renderMetadata(content, card, options, handlers);
	if (card.description) {
		content.appendChild(el("div", "task-card__description", card.description));
	}
	mainRow.appendChild(content);

	cardEl.appendChild(mainRow);
	wrapper.appendChild(cardEl);
	return wrapper;
}

/**
 * Renders the DayTasks daily widget into `parent` and returns the root element.
 * The card markup mirrors TaskNotes' BEM TaskCard so the ported styles apply.
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
	header.appendChild(el("span", "daytasks-widget__title", model.title));
	const right = el("div", "daytasks-widget__header-right");
	right.appendChild(el("span", "daytasks-widget__date", model.date));
	if (handlers.onAddTask) {
		const addButton = el("button", "daytasks-widget__add", "+");
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
	}

	parent.appendChild(root);
	return root;
}
