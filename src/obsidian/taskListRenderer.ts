import { renderTaskCard, type WidgetRenderHandlers, type WidgetRenderOptions } from "./widgetRenderer";
import type { TaskListModel } from "../ui/taskListModel";
import type { TaskListState } from "../core/taskListState";

export interface TaskListFacets {
	statuses: { value: string; label: string }[];
	tags: string[];
	contexts: string[];
	projects: { path: string; label: string }[];
}

export interface TaskListHandlers {
	onSetStatuses(values: string[]): void;
	onSetDatePreset(preset: TaskListState["datePreset"]): void;
	onSetTags(values: string[]): void;
	onSetContexts(values: string[]): void;
	onSetProjects(values: string[]): void;
	onSetSearch(text: string): void;
	onSetGroupBy(groupBy: TaskListState["groupBy"]): void;
	onSetSort(sortBy: TaskListState["sortBy"], dir: TaskListState["sortDir"]): void;
	onClear(): void;
	onToggleGroup(key: string): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
	const node = activeDocument.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function select<T extends string>(
	className: string,
	current: T,
	choices: { value: T; label: string }[],
	onChange: (value: T) => void
): HTMLSelectElement {
	const sel = el("select", className);
	for (const choice of choices) {
		const opt = el("option", undefined, choice.label);
		opt.value = choice.value;
		if (choice.value === current) opt.selected = true;
		sel.appendChild(opt);
	}
	sel.addEventListener("change", () => onChange(sel.value as T));
	return sel;
}

/** Multiselect rendered as a row of toggle chips (kept simple + testable). */
function chipMultiselect(
	className: string,
	selected: string[],
	choices: { value: string; label: string }[],
	onChange: (values: string[]) => void
): HTMLElement {
	const wrap = el("div", className);
	for (const choice of choices) {
		const chip = el("button", "daytasks-tasklist__facet-chip", choice.label);
		const on = selected.includes(choice.value);
		if (on) chip.classList.add("is-active");
		chip.addEventListener("click", () => {
			const next = on ? selected.filter((v) => v !== choice.value) : [...selected, choice.value];
			onChange(next);
		});
		wrap.appendChild(chip);
	}
	return wrap;
}

function renderFilterBar(
	state: TaskListState,
	facets: TaskListFacets,
	lh: TaskListHandlers
): HTMLElement {
	const bar = el("div", "daytasks-tasklist__filterbar");

	const search = el("input", "daytasks-tasklist__search");
	search.type = "search";
	search.placeholder = "Search title / description…";
	search.value = state.search;
	search.addEventListener("input", () => lh.onSetSearch(search.value));
	bar.appendChild(search);

	bar.appendChild(chipMultiselect("daytasks-tasklist__statuses", state.statuses, facets.statuses, (values) => lh.onSetStatuses(values)));

	bar.appendChild(select<TaskListState["datePreset"]>("daytasks-tasklist__date", state.datePreset, [
		{ value: "all", label: "All dates" }, { value: "today", label: "Today" },
		{ value: "overdue", label: "Overdue" }, { value: "next7", label: "Next 7 days" },
	], (preset) => lh.onSetDatePreset(preset)));

	if (facets.tags.length) {
		bar.appendChild(chipMultiselect("daytasks-tasklist__tags", state.tags,
			facets.tags.map((t) => ({ value: t, label: `#${t}` })), (values) => lh.onSetTags(values)));
	}
	if (facets.contexts.length) {
		bar.appendChild(chipMultiselect("daytasks-tasklist__contexts", state.contexts,
			facets.contexts.map((c) => ({ value: c, label: `@${c}` })), (values) => lh.onSetContexts(values)));
	}
	if (facets.projects.length) {
		bar.appendChild(chipMultiselect("daytasks-tasklist__projects", state.projects,
			facets.projects.map((p) => ({ value: p.path, label: p.label })), (values) => lh.onSetProjects(values)));
	}

	bar.appendChild(select<TaskListState["groupBy"]>("daytasks-tasklist__groupby", state.groupBy, [
		{ value: "status", label: "Group: Status" }, { value: "scheduled", label: "Group: Date" },
		{ value: "project", label: "Group: Project" },
	], (groupBy) => lh.onSetGroupBy(groupBy)));

	bar.appendChild(select<TaskListState["sortBy"]>("daytasks-tasklist__sortby", state.sortBy, [
		{ value: "scheduled", label: "Sort: Scheduled" }, { value: "due", label: "Sort: Due" },
		{ value: "priority", label: "Sort: Priority" }, { value: "created", label: "Sort: Created" },
		{ value: "title", label: "Sort: Title" },
	], (value) => lh.onSetSort(value, state.sortDir)));

	const dir = el("button", "daytasks-tasklist__sortdir", state.sortDir === "asc" ? "↑" : "↓");
	dir.setAttribute("aria-label", "Toggle sort direction");
	dir.addEventListener("click", () => lh.onSetSort(state.sortBy, state.sortDir === "asc" ? "desc" : "asc"));
	bar.appendChild(dir);

	const clear = el("button", "daytasks-tasklist__clear", "Clear");
	clear.addEventListener("click", () => lh.onClear());
	bar.appendChild(clear);

	return bar;
}

export function renderTaskListView(
	parent: HTMLElement,
	model: TaskListModel,
	facets: TaskListFacets,
	options: WidgetRenderOptions,
	handlers: WidgetRenderHandlers,
	listHandlers: TaskListHandlers
): HTMLElement {
	const root = el("div");
	root.classList.add("daytasks-plugin", "daytasks-tasklist");
	root.appendChild(renderFilterBar(model.state, facets, listHandlers));

	if (model.empty) {
		root.appendChild(el("div", "daytasks-tasklist__empty", "No tasks match these filters."));
		parent.appendChild(root);
		return root;
	}

	for (const group of model.groups) {
		const section = el("div", "daytasks-tasklist__group");
		const head = el("div", "daytasks-tasklist__group-head");
		const toggle = el("button", "daytasks-tasklist__group-toggle");
		toggle.setAttribute("aria-expanded", String(!group.collapsed));
		const chevron = el("span", "daytasks-tasklist__group-icon");
		chevron.dataset.icon = group.collapsed ? "chevron-right" : "chevron-down";
		toggle.appendChild(chevron);
		toggle.addEventListener("click", () => listHandlers.onToggleGroup(group.key));
		head.appendChild(toggle);
		head.appendChild(el("span", "daytasks-tasklist__group-label", group.label));
		head.appendChild(el("span", "daytasks-tasklist__group-count", String(group.count)));
		section.appendChild(head);

		if (!group.collapsed) {
			const list = el("ul", "daytasks-tasklist__cards");
			for (const card of group.cards) {
				list.appendChild(renderTaskCard(card, options, handlers));
			}
			section.appendChild(list);
		}
		root.appendChild(section);
	}

	parent.appendChild(root);
	return root;
}
