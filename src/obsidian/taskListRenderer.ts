import { renderTaskCard, type WidgetRenderHandlers, type WidgetRenderOptions } from "./widgetRenderer";
import type { TaskListModel } from "../ui/taskListModel";
import type { TaskListState } from "../core/taskListState";

export interface TaskListFacets {
	statuses: { value: string; label: string; icon?: string; color?: string }[];
	tags: string[];
	contexts: string[];
	projects: { path: string; label: string }[];
}

/** The unbounded facets shown as searchable dropdowns (status stays inline). */
export type FacetKey = "tags" | "contexts" | "projects";

/** Ephemeral filter-bar UI state owned by the view (which dropdown is open + its search text). */
export interface TaskListUiState {
	openFacet: FacetKey | null;
	facetSearch: string;
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
	/** Opens the given facet's dropdown (or closes all when null). */
	onToggleFacetMenu(facet: FacetKey | null): void;
	/** Updates the open facet dropdown's search text. */
	onFacetSearch(text: string): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
	const node = activeDocument.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

/** A `data-icon` placeholder span; the host's applyIcons pass fills the glyph. */
function iconSpan(name: string, className = "daytasks-tasklist__ctrl-icon"): HTMLSpanElement {
	const span = el("span", className);
	span.dataset.icon = name;
	return span;
}

/** Wraps a control (e.g. a native select) with a leading icon for the toolbar. */
function withIcon(name: string, control: HTMLElement): HTMLElement {
	const wrap = el("div", "daytasks-tasklist__control");
	wrap.appendChild(iconSpan(name));
	wrap.appendChild(control);
	return wrap;
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

/** Multiselect rendered as a row of toggle chips (kept simple + testable). Each
 *  choice may carry an icon (data-icon) and a color (a status color), surfaced via
 *  a `--dt-status-color` custom property the stylesheet uses for the active state. */
function chipMultiselect(
	className: string,
	selected: string[],
	choices: { value: string; label: string; icon?: string; color?: string }[],
	onChange: (values: string[]) => void
): HTMLElement {
	const wrap = el("div", className);
	for (const choice of choices) {
		const chip = el("button", "daytasks-tasklist__facet-chip");
		if (choice.icon) chip.appendChild(iconSpan(choice.icon, "daytasks-tasklist__chip-icon"));
		chip.appendChild(el("span", "daytasks-tasklist__chip-label", choice.label));
		if (choice.color) chip.style.setProperty("--dt-status-color", choice.color);
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

/**
 * A facet shown as a dropdown button + searchable checklist popover, so it
 * scales to hundreds of values instead of spilling chips across the bar. The
 * popover is rendered open when `ui.openFacet === facetKey`; the view re-renders
 * on each toggle and restores the open popover + focus.
 */
function facetDropdown(
	facetKey: FacetKey,
	label: string,
	icon: string,
	selected: string[],
	choices: { value: string; label: string }[],
	ui: TaskListUiState,
	onSet: (values: string[]) => void,
	lh: TaskListHandlers
): HTMLElement {
	const wrap = el("div", "daytasks-tasklist__facet");

	const btn = el("button", "daytasks-tasklist__facet-btn");
	btn.appendChild(iconSpan(icon));
	btn.appendChild(
		el(
			"span",
			"daytasks-tasklist__facet-btn-label",
			selected.length ? `${label} (${selected.length})` : label
		)
	);
	if (selected.length) btn.classList.add("is-active");
	const caret = el("span", "daytasks-tasklist__facet-caret", "▾");
	btn.appendChild(caret);
	btn.addEventListener("click", (event) => {
		event.stopPropagation();
		lh.onToggleFacetMenu(ui.openFacet === facetKey ? null : facetKey);
	});
	wrap.appendChild(btn);

	if (ui.openFacet === facetKey) {
		wrap.classList.add("is-open");
		const pop = el("div", "daytasks-tasklist__facet-pop");
		pop.addEventListener("click", (event) => event.stopPropagation());

		const search = el("input", "daytasks-tasklist__facet-search");
		search.type = "search";
		search.placeholder = `Filter ${label.toLowerCase()}…`;
		search.value = ui.facetSearch;
		search.addEventListener("input", () => lh.onFacetSearch(search.value));
		pop.appendChild(search);

		const listEl = el("div", "daytasks-tasklist__facet-list");
		const query = ui.facetSearch.trim().toLowerCase();
		const filtered = query
			? choices.filter((c) => c.label.toLowerCase().includes(query))
			: choices;
		for (const choice of filtered) {
			const opt = el("button", "daytasks-tasklist__facet-opt", choice.label);
			const on = selected.includes(choice.value);
			if (on) opt.classList.add("is-on");
			opt.setAttribute("role", "menuitemcheckbox");
			opt.setAttribute("aria-checked", String(on));
			opt.addEventListener("click", (event) => {
				event.stopPropagation();
				onSet(on ? selected.filter((v) => v !== choice.value) : [...selected, choice.value]);
			});
			listEl.appendChild(opt);
		}
		if (filtered.length === 0) {
			listEl.appendChild(el("div", "daytasks-tasklist__facet-empty", "No matches"));
		}
		pop.appendChild(listEl);
		wrap.appendChild(pop);
	}

	return wrap;
}

function renderFilterBar(
	state: TaskListState,
	facets: TaskListFacets,
	ui: TaskListUiState,
	lh: TaskListHandlers
): HTMLElement {
	const bar = el("div", "daytasks-tasklist__filterbar");
	const row1 = el("div", "daytasks-tasklist__filterbar-row daytasks-tasklist__filterbar-row--primary");
	const row2 = el("div", "daytasks-tasklist__filterbar-row daytasks-tasklist__filterbar-row--secondary");

	// Row 1 — search + status pills.
	const searchWrap = el("div", "daytasks-tasklist__search-wrap");
	searchWrap.appendChild(iconSpan("search"));
	const search = el("input", "daytasks-tasklist__search");
	search.type = "search";
	search.placeholder = "Search title / description…";
	search.value = state.search;
	search.addEventListener("input", () => lh.onSetSearch(search.value));
	searchWrap.appendChild(search);
	row1.appendChild(searchWrap);

	row1.appendChild(chipMultiselect("daytasks-tasklist__statuses", state.statuses, facets.statuses, (values) => lh.onSetStatuses(values)));

	// Row 2 — date · group · sort (+dir) · tags · contexts · projects · clear.
	row2.appendChild(withIcon("calendar", select<TaskListState["datePreset"]>("daytasks-tasklist__date", state.datePreset, [
		{ value: "all", label: "All dates" }, { value: "today", label: "Today" },
		{ value: "overdue", label: "Overdue" }, { value: "next7", label: "Next 7 days" },
	], (preset) => lh.onSetDatePreset(preset))));

	row2.appendChild(withIcon("layout-list", select<TaskListState["groupBy"]>("daytasks-tasklist__groupby", state.groupBy, [
		{ value: "status", label: "Group: Status" }, { value: "scheduled", label: "Group: Date" },
		{ value: "project", label: "Group: Project" },
	], (groupBy) => lh.onSetGroupBy(groupBy))));

	row2.appendChild(withIcon("arrow-up-down", select<TaskListState["sortBy"]>("daytasks-tasklist__sortby", state.sortBy, [
		{ value: "scheduled", label: "Sort: Scheduled" }, { value: "due", label: "Sort: Due" },
		{ value: "priority", label: "Sort: Priority" }, { value: "created", label: "Sort: Created" },
		{ value: "title", label: "Sort: Title" },
	], (value) => lh.onSetSort(value, state.sortDir))));

	const dir = el("button", "daytasks-tasklist__sortdir");
	dir.dataset.icon = state.sortDir === "asc" ? "arrow-up" : "arrow-down";
	dir.setAttribute("aria-label", `Sort direction: ${state.sortDir === "asc" ? "ascending" : "descending"}`);
	dir.addEventListener("click", () => lh.onSetSort(state.sortBy, state.sortDir === "asc" ? "desc" : "asc"));
	row2.appendChild(dir);

	if (facets.tags.length) {
		row2.appendChild(facetDropdown("tags", "Tags", "hash", state.tags,
			facets.tags.map((t) => ({ value: t, label: `#${t}` })), ui, (values) => lh.onSetTags(values), lh));
	}
	if (facets.contexts.length) {
		row2.appendChild(facetDropdown("contexts", "Contexts", "at-sign", state.contexts,
			facets.contexts.map((c) => ({ value: c, label: `@${c}` })), ui, (values) => lh.onSetContexts(values), lh));
	}
	if (facets.projects.length) {
		row2.appendChild(facetDropdown("projects", "Projects", "folder", state.projects,
			facets.projects.map((p) => ({ value: p.path, label: p.label })), ui, (values) => lh.onSetProjects(values), lh));
	}

	const clear = el("button", "daytasks-tasklist__clear");
	clear.appendChild(iconSpan("x"));
	clear.appendChild(el("span", undefined, "Clear"));
	clear.addEventListener("click", () => lh.onClear());
	row2.appendChild(clear);

	bar.appendChild(row1);
	bar.appendChild(row2);
	return bar;
}

export function renderTaskListView(
	parent: HTMLElement,
	model: TaskListModel,
	facets: TaskListFacets,
	options: WidgetRenderOptions,
	handlers: WidgetRenderHandlers,
	listHandlers: TaskListHandlers,
	uiState: TaskListUiState
): HTMLElement {
	const root = el("div");
	root.classList.add("daytasks-plugin", "daytasks-tasklist");
	root.appendChild(renderFilterBar(model.state, facets, uiState, listHandlers));

	// Click-anywhere-else closes an open facet dropdown.
	if (uiState.openFacet) {
		const backdrop = el("div", "daytasks-tasklist__facet-backdrop");
		backdrop.addEventListener("click", () => listHandlers.onToggleFacetMenu(null));
		root.appendChild(backdrop);
	}

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
		// Icon-only button needs an accessible name (A11Y-3).
		toggle.setAttribute("aria-label", `${group.collapsed ? "Expand" : "Collapse"} ${group.label}`);
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
