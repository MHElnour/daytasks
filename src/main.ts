import { EditorView } from "@codemirror/view";
import { MarkdownView, Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { createTaskForActiveNote } from "./commands/createTaskCommand";
import { DayTaskService } from "./core/dayTaskService";
import { MemoryTaskIndex } from "./core/taskIndex";
import { MemoryTaskStore } from "./core/taskStore";
import { resolveDailyNoteDate } from "./daily-notes/dailyNoteDate";
import {
	DayTasksDataStore,
	type DayTasksPluginData,
} from "./obsidian/pluginDataAdapter";
import { dailyTasksLivePreviewExtension } from "./obsidian/livePreview";
import { TitleInputModal } from "./obsidian/modals";
import { insertWidgetAtBottom } from "./obsidian/widgetInsertion";
import {
	renderDailyTasksWidget,
	type WidgetRenderOptions,
} from "./obsidian/widgetRenderer";
import { DayTasksSettingTab } from "./settings/settingsTab";
import { DEFAULT_SETTINGS, type DayTasksSettings } from "./settings/settings";
import { DailyTasksWidgetController } from "./ui/dailyTasksWidgetController";

const CREATE_TASK_COMMAND_ID = "create-test-task-for-current-daily-note";
const WIDGET_HOST_CLASS = "daytasks-widget-host";

export default class DayTasksPlugin extends Plugin {
	settings: DayTasksSettings = { ...DEFAULT_SETTINGS };

	private dataStore!: DayTasksDataStore;
	private store!: MemoryTaskStore;
	private index!: MemoryTaskIndex;
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
		this.service = new DayTaskService({ store: this.store, index: this.index });
		this.controller = new DailyTasksWidgetController({ service: this.service });

		this.addSettingTab(new DayTasksSettingTab(this.app, this));

		this.addCommand({
			id: CREATE_TASK_COMMAND_ID,
			name: "Create test task for current daily note",
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
			showProjects: this.settings.showProjects,
		};
	}

	/** Renders the widget for a daily note into `container`. Returns true if drawn. */
	private renderWidgetInto(container: HTMLElement, notePath: string): boolean {
		if (!this.settings.showDailyNoteWidget) {
			return false;
		}
		if (!resolveDailyNoteDate(notePath, this.settings.dailyNoteFolder)) {
			return false;
		}
		const model = this.controller.getWidgetForNotePath(notePath);
		if (!model) {
			return false;
		}
		renderDailyTasksWidget(container, model, this.widgetOptions(), {
			onToggleTask: (taskId) => void this.handleToggle(taskId),
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

	private async handleToggle(taskId: string): Promise<void> {
		try {
			await this.service.toggleStatus(taskId);
			await this.persistTasks();
			this.refreshViews();
		} catch (error) {
			console.error("DayTasks: failed to toggle task", error);
			new Notice("DayTasks: could not update that task.");
		}
	}

	private runCreateTaskCommand(): void {
		new TitleInputModal(this.app, "Test task", (title) => {
			if (title === null) {
				return;
			}
			void this.createTask(title);
		}).open();
	}

	private async createTask(title: string): Promise<void> {
		const task = await createTaskForActiveNote(
			{
				getActiveFilePath: () => this.app.workspace.getActiveFile()?.path ?? null,
				settings: this.settings,
				service: this.service,
				notify: (message) => new Notice(message),
			},
			title
		);
		if (task) {
			await this.persistTasks();
			this.refreshViews();
		}
	}

	private async persistTasks(): Promise<void> {
		await this.dataStore.save({
			settings: this.settings,
			tasks: await this.store.list(),
		});
	}

	async saveSettings(): Promise<void> {
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
