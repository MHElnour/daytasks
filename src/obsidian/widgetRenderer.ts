import type { TaskCardViewModel } from "../ui/taskCard";
import type { DailyTasksWidgetModel } from "../ui/todayView";

export interface WidgetRenderOptions {
	showTaskIds: boolean;
	showTags: boolean;
	showProjects: boolean;
}

export interface WidgetRenderHandlers {
	onToggleTask(taskId: string): void;
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
	options: WidgetRenderOptions
): void {
	const hasId = options.showTaskIds;
	const hasTags = options.showTags && card.tags.length > 0;
	const hasProjects = options.showProjects && card.projects.length > 0;
	if (!hasId && !hasTags && !hasProjects) {
		return;
	}

	const metadata = el("div", "task-card__metadata");

	if (hasId) {
		metadata.appendChild(el("span", "task-card__id", card.id));
	}

	if (hasTags) {
		const tagsProp = el(
			"span",
			"task-card__metadata-property task-card__metadata-property--tags"
		);
		for (const tag of card.tags) {
			tagsProp.appendChild(el("span", "tag", tag));
		}
		metadata.appendChild(tagsProp);
	}

	if (hasProjects) {
		const projectsProp = el("span", "task-card__metadata-property");
		for (const project of card.projects) {
			const pill = el("span", "task-card__project", project.label);
			pill.dataset.path = project.path;
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

	const mainRow = el("div", "task-card__main-row");

	const statusDot = el("div", "task-card__status-dot");
	statusDot.setAttribute("role", "checkbox");
	statusDot.setAttribute("aria-checked", card.checked ? "true" : "false");
	statusDot.setAttribute("aria-label", `Toggle ${card.title}`);
	statusDot.tabIndex = 0;
	statusDot.addEventListener("click", () => handlers.onToggleTask(card.id));
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
	renderMetadata(content, card, options);
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
	header.appendChild(el("span", "daytasks-widget__date", model.date));
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
