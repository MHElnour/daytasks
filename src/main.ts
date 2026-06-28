import { EditorView } from "@codemirror/view";
import { MarkdownView, Menu, Notice, Plugin, TFile, TFolder, normalizePath, setIcon } from "obsidian";
import { DayTaskService } from "./core/dayTaskService";
import { dependencyCandidates } from "./core/dependencies";
import { nextPriority } from "./core/priorityCycle";
import { StatusManager } from "./core/statusManager";
import { withBlockedStatus } from "./core/status";
import { toUpdateDayTaskInput, type CreateDayTaskInput, type DayTask } from "./core/task";
import { MemoryTaskIndex } from "./core/taskIndex";
import { MemoryTaskStore } from "./core/taskStore";
import { DetailNoteService, type VaultPort } from "./detail-notes/detailNoteService";
import { resolveFolderTemplate } from "./detail-notes/folderTemplate";
import { dailyNotePathForDate, resolveDailyNoteDate } from "./daily-notes/dailyNoteDate";
import { attachReorder, type ReorderHandle } from "./obsidian/dragReorder";
import { buildTagSearchQuery, openGlobalSearch } from "./obsidian/globalSearch";
import { dailyTasksLivePreviewExtension } from "./obsidian/livePreview";
import {
	DayTasksDataStore,
	type DayTasksPluginData,
} from "./obsidian/pluginDataAdapter";
import { TaskCreationModal } from "./obsidian/taskCreationModal";
import { TaskListView, VIEW_TYPE_TASK_LIST, type TaskListHost } from "./obsidian/taskListLeaf";
import { resolvesToMarkdownNote } from "./obsidian/vaultNote";
import { todayDate } from "./util/time";
import { debounce } from "./util/debounce";
import {
	renderDailyTasksWidget,
	type WidgetRenderHandlers,
	type WidgetRenderOptions,
} from "./obsidian/widgetRenderer";
import { DEFAULT_SETTINGS, type DayTasksSettings } from "./settings/settings";
import { DayTasksSettingTab } from "./settings/settingsTab";
import { DailyTasksWidgetController } from "./ui/dailyTasksWidgetController";
import { createSubtaskWidgetModel } from "./ui/subtaskWidget";

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
	private detailNotes!: DetailNoteService;
	/** Ids of tasks that currently have a detail note — the sync pass iterates
	 * only these instead of scanning every task. Self-prunes on stale entries. */
	private readonly detailNoteIds = new Set<string>();
	private expandedIds = new Set<string>();
	private collapsedIds = new Set<string>();
	private reorderHandles: { handle: ReorderHandle; listEl: HTMLElement }[] = [];
	private dataVersion = 0;
	private readingRefreshTimer: number | null = null;
	private readonly saveTaskListState = debounce(() => void this.saveSettings(), 400);
	private readonly syncDetailNotes = debounce(() => void this.runDetailNoteSync(), 800);

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

		// VaultPort + DetailNoteService — instantiated once; settings-independent.
		// Every path is run through Obsidian's normalizePath() at this boundary so a
		// user-derived folder (settings/template) can't reach the vault unnormalized
		// (DATA-1); folderTemplate already strips `.`/`..` traversal segments.
		const port: VaultPort = {
			exists: (path: string): boolean =>
				this.app.vault.getAbstractFileByPath(normalizePath(path)) !== null,
			ensureFolder: async (path: string): Promise<void> => {
				const folder = normalizePath(path);
				if (this.app.vault.getAbstractFileByPath(folder) instanceof TFolder) return;
				try {
					await this.app.vault.createFolder(folder);
				} catch (e) {
					// Swallow "already exists" race
					if (!(e instanceof Error && e.message.includes("already exists"))) throw e;
				}
			},
			create: async (path: string, content: string): Promise<void> => {
				await this.app.vault.create(normalizePath(path), content);
			},
			readFrontmatter: (path: string): Record<string, unknown> | null => {
				const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
				if (!(file instanceof TFile)) return null;
				return this.app.metadataCache.getFileCache(file)?.frontmatter ?? null;
			},
			writeFrontmatter: async (
				path: string,
				mutate: (fm: Record<string, unknown>) => void
			): Promise<void> => {
				const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
				if (!(file instanceof TFile)) return;
				await this.app.fileManager.processFrontMatter(file, mutate);
			},
			rename: async (from: string, to: string): Promise<void> => {
				const file = this.app.vault.getAbstractFileByPath(normalizePath(from));
				if (!(file instanceof TFile)) return;
				await this.app.fileManager.renameFile(file, normalizePath(to));
			},
		};
		this.detailNotes = new DetailNoteService(port, () => new Date());
		for (const task of this.service.allTasks()) {
			if (task.detailNotePath) this.detailNoteIds.add(task.id);
		}

		this.addSettingTab(new DayTasksSettingTab(this.app, this));

		this.registerView(VIEW_TYPE_TASK_LIST, (leaf) => new TaskListView(leaf, this.taskListHost()));
		this.addRibbonIcon("list-checks", "DayTasks: task list", () => void this.openTaskList());
		this.addCommand({
			id: "open-task-list",
			name: "Open task list",
			callback: () => void this.openTaskList(),
		});

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
		this.app.workspace.onLayoutReady(() => {
			this.refreshReadingViews();
			void this.migrateDetailNotes();
		});
	}

	onunload(): void {
		this.destroyReorder();
	}

	/** Rebuilds the status manager and services from current settings. */
	private rebuildServices(): void {
		this.statusManager = new StatusManager(
			withBlockedStatus(this.settings.statuses),
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
			priorities: this.settings.priorities,
			today: () => todayDate(),
		});
	}

	private async loadPluginData(): Promise<DayTasksPluginData> {
		try {
			const decoded = await this.dataStore.load();
			if (decoded.droppedTasks > 0) {
				// Don't let a later save silently finalize the loss (DATA-4).
				console.warn(
					`DayTasks: dropped ${decoded.droppedTasks} unreadable task(s) from stored data.`
				);
				new Notice(
					`DayTasks: ${decoded.droppedTasks} unreadable task(s) were skipped. Back up your data before making changes if this is unexpected.`
				);
			}
			return { settings: decoded.settings, tasks: decoded.tasks };
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

	private widgetCardHandlers(addDate: string | null): WidgetRenderHandlers {
		return {
			onCycleStatus: (taskId) => void this.handleCycleStatus(taskId),
			onCyclePriority: (taskId) => void this.handleCyclePriority(taskId),
			...(addDate !== null ? { onAddTask: () => this.openCreateModal(addDate) } : {}),
			onEditTask: (taskId) => void this.openEditModal(taskId),
			onOpenProject: (path) => this.openProject(path),
			onOpenTask: (taskId) => this.openTaskNote(taskId),
			onSelectTag: (tag) => this.searchTag(tag),
			onToggleSubtasks: (taskId) => this.toggleSubtasks(taskId),
			onToggleCollapsed: (taskId) => this.toggleCollapsed(taskId),
			onOpenMenu: (taskId, anchor) => this.openTaskMenu(taskId, anchor),
			onOpenDetailNote: (taskId) => void this.openDetailNote(taskId),
		};
	}

	/** The task a detail note points to via its frontmatter `taskId`, or null. */
	private detailNoteTask(notePath: string): DayTask | null {
		const file = this.app.vault.getAbstractFileByPath(notePath);
		if (!(file instanceof TFile)) return null;
		const taskId: unknown = this.app.metadataCache.getFileCache(file)?.frontmatter?.taskId;
		if (typeof taskId !== "string") return null;
		return this.service.getById(taskId);
	}

	/** True when a note path would render a widget (daily note or detail note). */
	private notePathRendersWidget(notePath: string): boolean {
		return (
			Boolean(resolveDailyNoteDate(notePath, this.settings.dailyNoteFolder)) ||
			this.detailNoteTask(notePath) !== null
		);
	}

	/** Renders the widget for a daily or detail note into `container`. Returns true if drawn. */
	private renderWidgetInto(container: HTMLElement, notePath: string): boolean {
		if (!this.settings.showDailyNoteWidget) return false;

		const date = resolveDailyNoteDate(notePath, this.settings.dailyNoteFolder);
		if (date) {
			const model = this.controller.getWidgetForDate(date, this.expandedIds, this.collapsedIds);
			renderDailyTasksWidget(container, model, this.widgetOptions(), this.widgetCardHandlers(date));
			this.applyIcons(container);
			this.attachDrag(container);
			return true;
		}

		// Detail note: a note whose frontmatter `taskId` matches an indexed task.
		const task = this.detailNoteTask(notePath);
		if (!task) return false;

		const model = createSubtaskWidgetModel(
			task,
			this.statusManager,
			todayDate(),
			this.settings.priorities,
			(id) => this.service.getChildren(id),
			this.expandedIds,
			this.collapsedIds,
			(id) => this.service.getById(id) ?? undefined,
			(id) => this.service.byBlocker(id)
		);
		renderDailyTasksWidget(container, model, this.widgetOptions(), this.widgetCardHandlers(null));
		this.applyIcons(container);
		return true;
	}

	/**
	 * Fills the renderer's `data-icon` placeholder spans with Lucide icons.
	 * `setIcon` is an Obsidian API, so the pure renderer leaves placeholders and
	 * this single post-pass (shared by Reading mode and Live Preview) draws them.
	 */
	private applyIcons(container: HTMLElement): void {
		container.querySelectorAll<HTMLElement>("[data-icon]").forEach((iconEl) => {
			const name = iconEl.getAttribute("data-icon");
			if (name) {
				setIcon(iconEl, name);
			}
		});
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
			// The reading-mode host only ever lives in the preview DOM, so an
			// editor-mode leaf has nothing to clean or inject — skip the per-leaf
			// DOM scan entirely (the common case is notes open in edit mode).
			if (view.getMode() !== "preview") {
				return;
			}
			const container = view.containerEl;
			container
				.querySelectorAll(`.${WIDGET_HOST_CLASS}`)
				.forEach((node) => node.remove());

			const path = view.file?.path;
			if (!path || !this.settings.showDailyNoteWidget) {
				return;
			}
			// Inject into the scroll container (.markdown-preview-view), AFTER the
			// sizer — not inside it. Obsidian virtual-renders the sizer's children on
			// long notes and reconciles them to its own block list on scroll, which
			// evicts a foreign node appended there; the scroller itself is stable.
			const sizer = container.querySelector(".markdown-preview-sizer");
			const preview = sizer?.parentElement;
			if (!(preview instanceof HTMLElement)) {
				return;
			}

			const host = activeDocument.createElement("div");
			host.className = WIDGET_HOST_CLASS;
			host.dataset.notePath = path;
			host.setAttribute("contenteditable", "false");
			if (this.renderWidgetInto(host, path)) {
				preview.appendChild(host);
			}
		} catch (error) {
			console.error("DayTasks: failed to render reading-mode widget", error);
		}
	}

	private toggleSubtasks(taskId: string): void {
		if (this.expandedIds.has(taskId)) {
			this.expandedIds.delete(taskId);
		} else {
			this.expandedIds.add(taskId);
		}
		this.refreshViews();
	}

	private toggleCollapsed(taskId: string): void {
		if (this.collapsedIds.has(taskId)) {
			this.collapsedIds.delete(taskId);
		} else {
			this.collapsedIds.add(taskId);
		}
		this.refreshViews();
	}

	private openTaskMenu(taskId: string, anchor: HTMLElement): void {
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle("Edit").setIcon("pencil").onClick(() => {
				void this.openEditModal(taskId);
			});
		});
		menu.addItem((item) => {
			item.setTitle("Delete").setIcon("trash").onClick(() => {
				void this.deleteTask(taskId);
			});
		});
		const dnPath = this.service.getById(taskId)?.detailNotePath;
		menu.addItem((item) => {
			if (dnPath) {
				item.setTitle("Open detail note").setIcon("file-text").onClick(() => void this.openDetailNote(taskId));
			} else {
				item.setTitle("Create detail note").setIcon("file-text").onClick(() => void this.createDetailNote(taskId));
			}
		});
		const rect = anchor.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom });
	}

	private async handleReorder(parentId: string | null, orderedIds: string[]): Promise<void> {
		try {
			await this.service.reorderSiblings(parentId, orderedIds);
			await this.persistTasks();
		} catch (error) {
			console.error("DayTasks: reorder failed", error);
		}
		this.refreshViews();
	}

	private attachDrag(container: HTMLElement): void {
		// Prune stale handles (from detached containers, e.g. live-preview re-renders).
		this.reorderHandles = this.reorderHandles.filter(({ handle, listEl }) => {
			if (!listEl.isConnected) {
				handle.destroy();
				return false;
			}
			return true;
		});

		// Attach SortableJS to every task list in this container.
		container.querySelectorAll<HTMLElement>(".daytasks-cards, .task-card__subtasks").forEach((listEl) => {
			// Determine parentId from the nearest card ancestor's task-id.
			const parentCard = listEl.closest<HTMLElement>(".task-card");
			const parentId = parentCard?.dataset.taskId ?? null;
			const handle = attachReorder(listEl, parentId, (pid, ids) => {
				void this.handleReorder(pid, ids);
			});
			this.reorderHandles.push({ handle, listEl });
		});
	}

	private destroyReorder(): void {
		for (const { handle } of this.reorderHandles) {
			handle.destroy();
		}
		this.reorderHandles = [];
	}

	private async handleCycleStatus(taskId: string): Promise<void> {
		const task = await this.service.getTask(taskId);
		if (!task) {
			return;
		}
		if (this.statusManager.isBlockedStatus(task.status)) {
			new Notice("DayTasks: this task is blocked by another task.");
			return;
		}
		try {
			await this.service.cycleStatus(taskId);
			await this.persistTasks();
			this.refreshViews();
		} catch (error) {
			console.error("DayTasks: failed to update task status", error);
			new Notice("DayTasks: could not update that task.");
		}
	}

	private async handleCyclePriority(taskId: string): Promise<void> {
		try {
			const task = await this.service.getTask(taskId);
			if (!task) {
				return;
			}
			await this.service.setPriority(
				taskId,
				nextPriority(task.priority, this.settings.priorities)
			);
			await this.persistTasks();
			this.refreshViews();
		} catch (error) {
			console.error("DayTasks: failed to change task priority", error);
			new Notice("DayTasks: could not change that priority.");
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
		let task: DayTask;
		try {
			task = await this.service.createTask(input);
			await this.persistTasks();
			this.refreshViews();
			new Notice(`DayTasks: created ${task.id}.`);
		} catch (error) {
			console.error("DayTasks: failed to create task", error);
			new Notice("DayTasks: could not create that task.");
			return;
		}
		if (input.detailNote) {
			try {
				const path = await this.detailNotes.create(task, this.detailNotesFolderFor(task));
				await this.updateDetailNoteLink(task.id, path);
				await this.persistTasks();
				this.refreshViews();
				await this.app.workspace.openLinkText(path, "", true);
			} catch (error) {
				console.error("DayTasks: failed to create detail note", error);
				new Notice("DayTasks: task created, but the detail note could not be created.");
			}
		}
	}

	/**
	 * The folder for a task's new detail note — the `detailNotesFolder` setting
	 * with `{{year}}/{{month}}/{{day}}` expanded from the task's scheduled date.
	 */
	private detailNotesFolderFor(task: DayTask): string {
		return resolveFolderTemplate(this.settings.detailNotesFolder, task.scheduledDate);
	}

	private async createDetailNote(taskId: string): Promise<void> {
		try {
			const task = this.service.getById(taskId);
			if (!task || task.detailNotePath) return;
			const path = await this.detailNotes.create(task, this.detailNotesFolderFor(task));
			await this.updateDetailNoteLink(task.id, path);
			await this.persistTasks();
			this.refreshViews();
			await this.app.workspace.openLinkText(path, "", true);
		} catch (error) {
			console.error("DayTasks: failed to create detail note", error);
			new Notice("DayTasks: could not create the detail note.");
		}
	}

	private async openDetailNote(taskId: string): Promise<void> {
		const task = this.service.getById(taskId);
		const path = task?.detailNotePath;
		if (!path) return;
		if (this.app.vault.getAbstractFileByPath(path) === null) {
			new Notice("DayTasks: detail note is missing. Clearing the link.");
			await this.updateDetailNoteLink(taskId, undefined);
			await this.persistTasks();
			this.refreshViews();
			return;
		}
		await this.app.workspace.openLinkText(path, "", false);
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
			onDelete: (id) => void this.deleteTask(id),
			getChildren: (parentId) => this.service.getChildren(parentId),
			onAddSubtask: (parentId, title) => this.addSubtask(parentId, title),
			onUnlinkSubtask: (childId) => this.unlinkSubtask(childId),
			getBlockedBy: (id) => {
				const t = this.index.byId(id);
				return (t?.blockedBy ?? [])
					.map((b) => this.index.byId(b))
					.filter((x): x is NonNullable<typeof x> => x != null);
			},
			getBlocking: (id) => this.index.byBlocker(id),
			getDependencyCandidates: (id) => this.getDependencyCandidates(id),
			onAddDependency: (tid, bid) => this.addDependency(tid, bid),
			onRemoveDependency: (tid, bid) => this.removeDependency(tid, bid),
		}).open();
	}

	private async addSubtask(parentId: string, title: string): Promise<void> {
		try {
			const parent = await this.service.getTask(parentId);
			if (!parent) {
				return;
			}
			await this.service.createSubtask(parentId, {
				title,
				scheduledDate: parent.scheduledDate,
			});
			await this.persistTasks();
			this.refreshViews();
		} catch (error) {
			console.error("DayTasks: failed to add subtask", error);
			new Notice("DayTasks: could not add that subtask.");
		}
	}

	private async unlinkSubtask(childId: string): Promise<void> {
		try {
			await this.service.unlinkSubtask(childId);
			await this.persistTasks();
			this.refreshViews();
		} catch (error) {
			console.error("DayTasks: failed to unlink subtask", error);
			new Notice("DayTasks: could not unlink that subtask.");
		}
	}

	private async deleteTask(id: string): Promise<void> {
		try {
			await this.service.deleteTask(id);
			await this.persistTasks();
			this.refreshViews();
			new Notice("DayTasks: task deleted.");
		} catch (error) {
			console.error("DayTasks: failed to delete task", error);
			new Notice("DayTasks: could not delete that task.");
		}
	}

	private async updateTask(id: string, input: CreateDayTaskInput): Promise<void> {
		try {
			// The edit modal submits the full editable state (omitted = cleared).
			await this.service.updateTask(id, toUpdateDayTaskInput(input));
			await this.persistTasks();
			this.refreshViews();
		} catch (error) {
			console.error("DayTasks: failed to update task", error);
			new Notice("DayTasks: could not update that task.");
			return;
		}
		// "Create detail note" toggled on in the edit modal: create one now (no-op
		// if the task already has one).
		if (input.detailNote) {
			await this.createDetailNote(id);
		}
	}

	private openTaskNote(taskId: string): void {
		const task = this.index.byId(taskId);
		if (!task) {
			return;
		}
		const linkText = dailyNotePathForDate(task.scheduledDate, this.settings.dailyNoteFolder);
		this.app.workspace.openLinkText(linkText, "", false).catch((error) => {
			console.error("DayTasks: failed to open task note", error);
		});
	}

	private getDependencyCandidates(taskId: string): DayTask[] {
		const blockersOf = (id: string): string[] => this.index.byId(id)?.blockedBy ?? [];
		return dependencyCandidates(
			taskId,
			this.service.allTasks(),
			blockersOf,
			(status) => this.statusManager.isCompletedStatus(status)
		);
	}

	private async addDependency(taskId: string, blockerId: string): Promise<void> {
		try {
			await this.service.addDependency(taskId, blockerId);
			await this.persistTasks();
			this.refreshViews();
		} catch (error) {
			console.error("DayTasks: failed to add dependency", error);
			new Notice("DayTasks: could not add that dependency.");
		}
	}

	private async removeDependency(taskId: string, blockerId: string): Promise<void> {
		try {
			await this.service.removeDependency(taskId, blockerId);
			await this.persistTasks();
			this.refreshViews();
		} catch (error) {
			console.error("DayTasks: failed to remove dependency", error);
			new Notice("DayTasks: could not remove that dependency.");
		}
	}

	private openProject(path: string): void {
		// Project paths can be free-form / persisted text; only open a link that
		// resolves to an existing markdown note (SEC-6).
		if (!resolvesToMarkdownNote(this.app.metadataCache, path)) {
			new Notice("DayTasks: that project note was not found.");
			return;
		}
		this.app.workspace.openLinkText(path, "", false).catch((error) => {
			console.error("DayTasks: failed to open project note", error);
		});
	}

	private searchTag(tag: string): void {
		if (!openGlobalSearch(this.app, buildTagSearchQuery(tag))) {
			new Notice("DayTasks: global search is unavailable.");
		}
	}

	private taskListHost(): TaskListHost {
		return {
			allTasks: () => this.service.allTasks(),
			statusManager: () => this.statusManager,
			priorities: () => this.settings.priorities,
			today: () => todayDate(),
			widgetOptions: () => this.widgetOptions(),
			cardHandlers: () => this.taskListCardHandlers(),
			getState: () => this.settings.taskListState,
			setState: (next) => {
				this.settings.taskListState = next;
				this.saveTaskListState();
			},
			applyIcons: (el) => this.applyIcons(el),
		};
	}

	private async openTaskList(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_TASK_LIST);
		if (existing.length > 0) {
			await this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: VIEW_TYPE_TASK_LIST, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}

	private taskListCardHandlers(): WidgetRenderHandlers {
		return {
			onCycleStatus: (taskId) => void this.handleCycleStatus(taskId),
			onCyclePriority: (taskId) => void this.handleCyclePriority(taskId),
			onEditTask: (taskId) => void this.openEditModal(taskId),
			onOpenProject: (path) => this.openProject(path),
			onOpenTask: (taskId) => this.openTaskNote(taskId),
			onSelectTag: (tag) => this.searchTag(tag),
			onOpenMenu: (taskId, anchor) => this.openTaskMenu(taskId, anchor),
			onOpenDetailNote: (taskId) => void this.openDetailNote(taskId),
		};
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
		this.destroyReorder();
		this.dataVersion += 1;

		// Reading mode: rebuild injected widgets.
		this.refreshReadingViews();

		// Live Preview: nudge only the editors showing a widget-bearing note (daily
		// or detail) so their ViewPlugin re-renders against the new dataVersion.
		// Other editors carry no widget, so dispatching into them is wasted work.
		this.nudgeWidgetEditors();

		// Task list view: re-render any open leaves.
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_TASK_LIST)) {
			if (leaf.view instanceof TaskListView) {
				leaf.view.render();
			}
		}

		// Debounced detail-note frontmatter sync (no-op when no tasks have detail notes).
		this.syncDetailNotes();
	}

	private async runDetailNoteSync(): Promise<void> {
		// Iterate only tasks known to have a detail note (not every task), pruning
		// ids whose task was deleted or whose link was cleared.
		for (const id of [...this.detailNoteIds]) {
			const task = this.service.getById(id);
			if (!task?.detailNotePath) {
				this.detailNoteIds.delete(id);
				continue;
			}
			try {
				await this.detailNotes.sync(task);
			} catch (error) {
				console.error("DayTasks: detail-note sync failed for", id, error);
			}
		}
	}

	/**
	 * Sets/clears a task's detail-note link via the service AND keeps the
	 * `detailNoteIds` index in step — the single host entry point for link
	 * changes, so the sync index never drifts.
	 */
	private async updateDetailNoteLink(
		id: string,
		path: string | undefined
	): Promise<void> {
		await this.service.setDetailNotePath(id, path);
		if (path) {
			this.detailNoteIds.add(id);
		} else {
			this.detailNoteIds.delete(id);
		}
	}

	/**
	 * One-time normalization of detail notes created before the 0.7.1 filename
	 * change: each note has its unmanaged `title` property stripped and a legacy
	 * `<title>-<taskId>.md` file renamed to `<title>.md` (see
	 * `DetailNoteService.migrate`). A successful rename's new link is persisted
	 * immediately, so a later failure can never leave the rename and the stored
	 * path diverged. The "migrated" flag is set only when the whole pass is clean,
	 * so a note that errors is retried on the next load (migrate is idempotent).
	 */
	private async migrateDetailNotes(): Promise<void> {
		if (this.settings.detailNotesMigrated) return;
		let allOk = true;
		for (const task of this.service.allTasks()) {
			if (!task.detailNotePath) continue;
			try {
				const newPath = await this.detailNotes.migrate(task);
				if (newPath) {
					await this.updateDetailNoteLink(task.id, newPath);
					await this.persistTasks();
				}
			} catch (error) {
				console.error("DayTasks: detail-note migration failed for", task.id, error);
				allOk = false;
			}
		}
		if (allOk) {
			this.settings.detailNotesMigrated = true;
			await this.persistTasks();
		}
	}

	private nudgeWidgetEditors(): void {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) {
				continue;
			}
			const path = view.file?.path;
			if (!path || !this.notePathRendersWidget(path)) {
				continue;
			}
			const cm = (view as unknown as { editor?: { cm?: EditorView } }).editor?.cm;
			// Feature-detect: `cm` is a private shape, so confirm dispatch is callable.
			if (cm && typeof cm.dispatch === "function") {
				cm.dispatch({});
			}
		}
	}
}
