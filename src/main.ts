import { EditorView } from "@codemirror/view";
import { MarkdownView, Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { DayTaskService } from "./core/dayTaskService";
import { StatusManager } from "./core/statusManager";
import type { CreateDayTaskInput } from "./core/task";
import { MemoryTaskIndex } from "./core/taskIndex";
import { MemoryTaskStore } from "./core/taskStore";
import { resolveDailyNoteDate } from "./daily-notes/dailyNoteDate";
import { dailyTasksLivePreviewExtension } from "./obsidian/livePreview";
import {
	DayTasksDataStore,
	type DayTasksPluginData,
} from "./obsidian/pluginDataAdapter";
import { TaskCreationModal } from "./obsidian/taskCreationModal";
import { insertWidgetAtBottom } from "./obsidian/widgetInsertion";
import {
	renderDailyTasksWidget,
	type WidgetRenderOptions,
} from "./obsidian/widgetRenderer";
import { DEFAULT_SETTINGS, type DayTasksSettings } from "./settings/settings";
import { DayTasksSettingTab } from "./settings/settingsTab";
import { DailyTasksWidgetController } from "./ui/dailyTasksWidgetController";

const CREATE_TASK_COMMAND_ID = "create-task-for-current-daily-note";
const WIDGET_HOST_CLASS = "daytasks-widget-host";

export default class DayTasksPlugin extends Plugin {
	settings: DayTasksSettings = { ...DEFAULT_SETTINGS };

	private dataStore!: DayTasksDataStore;
	private store!: MemoryTaskStore;
	private index!: MemoryTaskIndex;
	private statusManager!: StatusManager;
	private service!: DayTaskService;
	private controller!: DailyTasksWidgetController;
	private dataVersion = 0;
	private readingRefreshTimer: number | null = null;

	async onload(): Promise<void> {
		this.dataStore = new DayTasksDataStore(this);

		const data = await this.loadPluginData();
		this.settings = data.settings;

		this.store = new MemoryTaskStore();
		this.index = new MemoryTaskIndex();
		for (const task of data.tasks) {
			await this.store.save(task);
		}
		this.index.rebuild(await this.store.list());
		this.rebuildServices();

		this.addSettingTab(new DayTasksSettingTab(this.app, this));

		this.addCommand({
			id: CREATE_TASK_COMMAND_ID,
			name: "Create task for current daily note",
			callback: () => this.runCreateTaskCommand(),
		});

		this.registerEditorExtension(
			dailyTasksLivePreviewExtension({
				isEnabled: () => this.settings.showDailyNoteWidget,
				renderWidget: (container, notePath) =>
					this.renderWidgetInto(container, notePath),
				version: () => this.dataVersion,
			})
		);

		// Reading mode is injected on layout/leaf changes (post-processors run on
		// detached DOM, so they cannot reliably reach the preview sizer).
		this.registerEvent(
			this.app.workspace.on("layout-change", () => this.scheduleReadingRefresh())
		);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => this.scheduleReadingRefresh())
		);
		this.registerEvent(this.app.workspace.on("file-open", () => this.refreshViews()));
		this.app.workspace.onLayoutReady(() => this.refreshReadingViews());
	}

	/** Rebuilds the status manager and services from current settings. */
	private rebuildServices(): void {
		this.statusManager = new StatusManager(
			this.settings.statuses,
			this.settings.defaultStatus
		);
		this.service = new DayTaskService({
			store: this.store,
			index: this.index,
			statusManager: this.statusManager,
			settings: this.settings,
		});
		this.controller = new DailyTasksWidgetController({
			service: this.service,
			statusManager: this.statusManager,
		});
	}

	private async loadPluginData(): Promise<DayTasksPluginData> {
		try {
			return await this.dataStore.load();
		} catch (error) {
			console.error("DayTasks: failed to load plugin data, using defaults", error);
			new Notice("DayTasks: stored data was unreadable. Started with defaults.");
			return { settings: { ...DEFAULT_SETTINGS }, tasks: [] };
		}
	}

	private widgetOptions(): WidgetRenderOptions {
		return {
			showTaskIds: this.settings.showTaskIds,
			showTags: this.settings.showTags,
			showContexts: this.settings.showContexts,
			showProjects: this.settings.showProjects,
		};
	}

	/** Renders the widget for a daily note into `container`. Returns true if drawn. */
	private renderWidgetInto(container: HTMLElement, notePath: string): boolean {
		if (!this.settings.showDailyNoteWidget) {
			return false;
		}
		const date = resolveDailyNoteDate(notePath, this.settings.dailyNoteFolder);
		if (!date) {
			return false;
		}
		const model = this.controller.getWidgetForNotePath(notePath);
		if (!model) {
			return false;
		}
		renderDailyTasksWidget(container, model, this.widgetOptions(), {
			onToggleComplete: (taskId) => void this.handleToggleComplete(taskId),
			onCycleStatus: (taskId) => void this.handleCycleStatus(taskId),
			onAddTask: () => this.openCreateModal(date),
			onEditTask: (taskId) => void this.openEditModal(taskId),
			onOpenProject: (path) => this.openProject(path),
			onSelectTag: (tag) => this.searchTag(tag),
		});
		return true;
	}

	private scheduleReadingRefresh(): void {
		if (this.readingRefreshTimer !== null) {
			window.clearTimeout(this.readingRefreshTimer);
		}
		this.readingRefreshTimer = window.setTimeout(() => {
			this.readingRefreshTimer = null;
			this.refreshReadingViews();
		}, 100);
	}

	private refreshReadingViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			if (leaf.view instanceof MarkdownView) {
				this.injectReadingView(leaf.view);
			}
		}
	}

	private injectReadingView(view: MarkdownView): void {
		try {
			const container = view.containerEl;
			container
				.querySelectorAll(`.${WIDGET_HOST_CLASS}`)
				.forEach((node) => node.remove());

			const path = view.file?.path;
			if (!path || view.getMode() !== "preview") {
				return;
			}
			if (
				!this.settings.showDailyNoteWidget ||
				!resolveDailyNoteDate(path, this.settings.dailyNoteFolder)
			) {
				return;
			}
			const sizer = container.querySelector(".markdown-preview-sizer");
			if (!(sizer instanceof HTMLElement)) {
				return;
			}

			const host = document.createElement("div");
			host.className = WIDGET_HOST_CLASS;
			host.dataset.notePath = path;
			host.setAttribute("contenteditable", "false");
			if (this.renderWidgetInto(host, path)) {
				insertWidgetAtBottom(sizer, host);
			}
		} catch (error) {
			console.error("DayTasks: failed to render reading-mode widget", error);
		}
	}

	private async handleCycleStatus(taskId: string): Promise<void> {
		try {
			await this.service.cycleStatus(taskId);
			await this.persistTasks();
			this.refreshViews();
		} catch (error) {
			console.error("DayTasks: failed to update task status", error);
			new Notice("DayTasks: could not update that task.");
		}
	}

	private async handleToggleComplete(taskId: string): Promise<void> {
		try {
			const task = await this.service.getTask(taskId);
			if (!task) {
				return;
			}
			const target = this.statusManager.getCompletionToggleTarget(task.status);
			await this.service.setStatus(taskId, target);
			await this.persistTasks();
			this.refreshViews();
		} catch (error) {
			console.error("DayTasks: failed to toggle task", error);
			new Notice("DayTasks: could not update that task.");
		}
	}

	private runCreateTaskCommand(): void {
		const path = this.app.workspace.getActiveFile()?.path ?? null;
		const date = path
			? resolveDailyNoteDate(path, this.settings.dailyNoteFolder)
			: null;
		if (!date) {
			new Notice("DayTasks: open a daily note (YYYY-MM-DD) to create a task.");
			return;
		}
		this.openCreateModal(date);
	}

	private openCreateModal(scheduledDate: string): void {
		new TaskCreationModal(this.app, {
			settings: this.settings,
			scheduledDate,
			onSubmit: (input) => {
				if (input) {
					void this.createTask(input);
				}
			},
		}).open();
	}

	private async createTask(input: CreateDayTaskInput): Promise<void> {
		try {
			const task = await this.service.createTask(input);
			await this.persistTasks();
			this.refreshViews();
			new Notice(`DayTasks: created ${task.id}.`);
		} catch (error) {
			console.error("DayTasks: failed to create task", error);
			new Notice("DayTasks: could not create that task.");
		}
	}

	private async openEditModal(taskId: string): Promise<void> {
		const task = await this.service.getTask(taskId);
		if (!task) {
			return;
		}
		new TaskCreationModal(this.app, {
			settings: this.settings,
			scheduledDate: task.scheduledDate,
			initial: task,
			onSubmit: (input) => {
				if (input) {
					void this.updateTask(taskId, input);
				}
			},
		}).open();
	}

	private async updateTask(id: string, input: CreateDayTaskInput): Promise<void> {
		try {
			await this.service.updateTask(id, input);
			await this.persistTasks();
			this.refreshViews();
		} catch (error) {
			console.error("DayTasks: failed to update task", error);
			new Notice("DayTasks: could not update that task.");
		}
	}

	private openProject(path: string): void {
		void this.app.workspace.openLinkText(path, "", false);
	}

	private searchTag(tag: string): void {
		const search = (
			this.app as unknown as {
				internalPlugins?: {
					getPluginById(id: string): { instance?: { openGlobalSearch?(q: string): void } } | null;
				};
			}
		).internalPlugins?.getPluginById("global-search")?.instance;
		search?.openGlobalSearch?.(`tag:#${tag}`);
	}

	private async persistTasks(): Promise<void> {
		await this.dataStore.save({
			settings: this.settings,
			tasks: await this.store.list(),
		});
	}

	async saveSettings(): Promise<void> {
		this.rebuildServices();
		await this.persistTasks();
		this.refreshViews();
	}

	private refreshViews(): void {
		this.dataVersion += 1;

		// Reading mode: rebuild injected widgets.
		this.refreshReadingViews();

		// Live Preview: nudge each editor so the ViewPlugin re-renders.
		this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
			const view = leaf.view as { editor?: { cm?: EditorView } };
			const cm = view.editor?.cm;
			if (cm) {
				cm.dispatch({});
			}
		});
	}
}
