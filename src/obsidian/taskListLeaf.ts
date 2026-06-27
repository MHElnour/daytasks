import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { StatusManager } from "../core/statusManager";
import type { PriorityConfig } from "../core/status";
import type { DayTask } from "../core/task";
import type { TaskListState } from "../core/taskListState";
import { DEFAULT_TASK_LIST_STATE } from "../core/taskListState";
import { createTaskListModel } from "../ui/taskListModel";
import { renderTaskListView, type TaskListFacets, type TaskListHandlers } from "./taskListRenderer";
import type { WidgetRenderHandlers, WidgetRenderOptions } from "./widgetRenderer";
import { noteBasename } from "../util/notePath";

export const VIEW_TYPE_TASK_LIST = "daytasks-task-list";

export interface TaskListHost {
	allTasks(): DayTask[];
	statusManager(): StatusManager;
	priorities(): PriorityConfig[];
	today(): string;
	widgetOptions(): WidgetRenderOptions;
	cardHandlers(): WidgetRenderHandlers;
	getState(): TaskListState;
	setState(next: TaskListState): void;
	applyIcons(el: HTMLElement): void;
}

export class TaskListView extends ItemView {
	private readonly expandedCardIds = new Set<string>();
	private readonly collapsedGroupKeys = new Set<string>();

	constructor(leaf: WorkspaceLeaf, private readonly host: TaskListHost) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_TASK_LIST;
	}

	getDisplayText(): string {
		return "DayTasks";
	}

	getIcon(): string {
		return "list-checks";
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	/** Re-renders from current tasks + persisted state. Called by the plugin on change. */
	render(): void {
		const container = this.contentEl;

		// The search input is rebuilt on every render; preserve its focus + caret so
		// typing in it isn't interrupted (onSetSearch re-renders on each keystroke).
		const active = container.ownerDocument.activeElement;
		const searchFocused =
			active instanceof HTMLInputElement && active.classList.contains("daytasks-tasklist__search");
		const caret = searchFocused ? active.selectionStart : null;

		container.empty();

		const tasks = this.host.allTasks();
		const state = this.host.getState();
		const model = createTaskListModel(
			tasks,
			this.host.statusManager(),
			this.host.today(),
			this.host.priorities(),
			state,
			this.expandedCardIds,
			this.collapsedGroupKeys
		);

		renderTaskListView(
			container,
			model,
			this.facets(tasks),
			this.host.widgetOptions(),
			this.wrapCardHandlers(),
			this.listHandlers(state)
		);
		this.host.applyIcons(container);

		if (searchFocused) {
			const input = container.querySelector<HTMLInputElement>(".daytasks-tasklist__search");
			if (input) {
				input.focus();
				const pos = caret ?? input.value.length;
				input.setSelectionRange(pos, pos);
			}
		}
	}

	/** Distinct status/tag/context/project values across all tasks, for the filter bar. */
	private facets(tasks: DayTask[]): TaskListFacets {
		const tags = new Set<string>();
		const contexts = new Set<string>();
		const projects = new Map<string, string>();
		for (const task of tasks) {
			task.tags.forEach((t) => tags.add(t));
			task.contexts.forEach((c) => contexts.add(c));
			task.projects.forEach((p) => projects.set(p.path, p.title ?? noteBasename(p.path)));
		}
		return {
			statuses: this.host.statusManager().getStatusesByOrder().map((s) => ({ value: s.value, label: s.label })),
			tags: [...tags].sort(),
			contexts: [...contexts].sort(),
			projects: Array.from(projects, ([path, label]) => ({ path, label }))
				.sort((a, b) => a.label.localeCompare(b.label)),
		};
	}

	/** Card collapse is local to this view; everything else delegates to the plugin's shared handlers. */
	private wrapCardHandlers(): WidgetRenderHandlers {
		const base = this.host.cardHandlers();
		return {
			...base,
			onToggleCollapsed: (taskId) => {
				if (this.expandedCardIds.has(taskId)) this.expandedCardIds.delete(taskId);
				else this.expandedCardIds.add(taskId);
				this.render();
			},
		};
	}

	private update(next: Partial<TaskListState>): void {
		this.host.setState({ ...this.host.getState(), ...next });
		this.render();
	}

	private listHandlers(_state: TaskListState): TaskListHandlers {
		return {
			onSetStatuses: (statuses) => this.update({ statuses }),
			onSetDatePreset: (datePreset) => this.update({ datePreset }),
			onSetTags: (tags) => this.update({ tags }),
			onSetContexts: (contexts) => this.update({ contexts }),
			onSetProjects: (projects) => this.update({ projects }),
			onSetSearch: (search) => this.update({ search }),
			onSetGroupBy: (groupBy) => this.update({ groupBy }),
			onSetSort: (sortBy, sortDir) => this.update({ sortBy, sortDir }),
			onClear: () => this.update({ ...DEFAULT_TASK_LIST_STATE }),
			onToggleGroup: (key) => {
				if (this.collapsedGroupKeys.has(key)) this.collapsedGroupKeys.delete(key);
				else this.collapsedGroupKeys.add(key);
				this.render();
			},
		};
	}
}
