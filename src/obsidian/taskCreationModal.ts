import { App, Menu, Modal, setIcon } from "obsidian";
import { mergeUniqueProjects } from "../core/taskFactory";
import {
	MAX_DESCRIPTION_LENGTH,
	MAX_TITLE_LENGTH,
	dueBeforeScheduled,
	type CreateDayTaskInput,
	type DayTask,
	type ProjectLink,
} from "../core/task";
import type { DayTasksSettings } from "../settings/settings";
import { safeCssColor } from "../util/cssColor";
import { parseEstimateMinutes } from "../util/estimate";
import { noteBasename } from "../util/notePath";
import { parseLabelList } from "../util/parseLabelList";
import { MarkdownPathSuggestModal } from "./modals";
import { TaskSuggestModal } from "./taskPicker";

export interface TaskCreationModalOptions {
	settings: DayTasksSettings;
	scheduledDate: string;
	/** When set, the modal opens in edit mode prefilled from this task. */
	initial?: DayTask;
	onSubmit: (input: CreateDayTaskInput | null) => void;
	/** Edit mode only: called when the user confirms deletion. */
	onDelete?: (taskId: string) => void;
	/** Edit mode: direct children of the task being edited. */
	getChildren?: (parentId: string) => DayTask[];
	/** Edit mode: create a child task under the given parent. */
	onAddSubtask?: (parentId: string, title: string) => Promise<void>;
	/** Edit mode: unlink (orphan) a child task. */
	onUnlinkSubtask?: (childId: string) => Promise<void>;
	/** Edit mode: tasks that block this task (this task is blocked by them). */
	getBlockedBy?: (taskId: string) => DayTask[];
	/** Edit mode: tasks that this task is blocking. */
	getBlocking?: (taskId: string) => DayTask[];
	/** Edit mode: candidate tasks for adding as a dependency (excludes self + cycles). */
	getDependencyCandidates?: (taskId: string) => DayTask[];
	/** Edit mode: record that taskId is blocked by blockerId. */
	onAddDependency?: (taskId: string, blockerId: string) => Promise<void>;
	/** Edit mode: remove the blockedBy edge between taskId and blockerId. */
	onRemoveDependency?: (taskId: string, blockerId: string) => Promise<void>;
}

interface MenuChipItem {
	value: string;
	label: string;
	icon?: string;
}

interface MenuChipOptions {
	ariaPrefix: string;
	/** Icon-only chip (value shown via tooltip) so its width never shifts. */
	iconOnly?: boolean;
	fallbackIcon?: string;
	emptyLabel?: string;
	getCurrent: () => { label: string; icon?: string; color?: string } | undefined;
	items: MenuChipItem[];
	onPick: (value: string) => void;
}

/**
 * Rich task create/edit modal. Two boxes (the task, its metadata) with a compact
 * icon toolbar; relationship sections (subtasks / blocked-by / blocking) are
 * disabled placeholders until those slices ship. Collects the full
 * CreateDayTaskInput contract and shows a live preview.
 */
export class TaskCreationModal extends Modal {
	private submitted = false;
	private focusTimer: number | null = null;
	private preview!: HTMLElement;

	private title = "";
	private status: string;
	private priority: string;
	private scheduledDate: string;
	private dueDate = "";
	private tags = "";
	private contexts = "";
	private projects: ProjectLink[];
	private estimate = "";
	private description = "";
	private createDetailNote: boolean;

	constructor(
		app: App,
		private readonly options: TaskCreationModalOptions
	) {
		super(app);
		const { settings, initial } = options;
		this.status = settings.defaultStatus;
		this.priority = settings.defaultPriority ?? "";
		this.scheduledDate = options.scheduledDate;
		this.projects = settings.defaultProjectPath
			? [{ path: settings.defaultProjectPath }]
			: [];
		this.createDetailNote = settings.createDetailNoteByDefault;

		if (initial) {
			this.title = initial.title;
			this.status = initial.status;
			this.priority = initial.priority ?? "";
			this.scheduledDate = initial.scheduledDate;
			this.dueDate = initial.dueDate ?? "";
			this.tags = initial.tags.join(", ");
			this.contexts = initial.contexts.join(", ");
			this.projects = initial.projects.map((project) => ({ ...project }));
			this.estimate =
				initial.estimateMinutes !== undefined ? String(initial.estimateMinutes) : "";
			this.description = initial.description ?? "";
		}
	}

	private get isEdit(): boolean {
		return this.options.initial !== undefined;
	}

	onOpen(): void {
		const { settings } = this.options;
		this.titleEl.setText(this.isEdit ? "Edit task" : "New DayTasks task");
		const { contentEl } = this;
		contentEl.addClass("daytasks-task-modal");

		// ---- Box 1: the task ----
		const box1 = contentEl.createDiv({ cls: "daytasks-modal-box" });
		const toolbar = box1.createDiv({ cls: "daytasks-toolbar" });

		this.buildMenuChip(toolbar, {
			ariaPrefix: "Status",
			iconOnly: true,
			getCurrent: () => settings.statuses.find((s) => s.value === this.status),
			items: settings.statuses.map((s) => ({ value: s.value, label: s.label, icon: s.icon })),
			onPick: (value) => {
				this.status = value;
				this.updatePreview();
			},
		});

		this.buildMenuChip(toolbar, {
			ariaPrefix: "Priority",
			iconOnly: true,
			fallbackIcon: "flag",
			emptyLabel: "None",
			getCurrent: () => settings.priorities.find((p) => p.value === this.priority),
			items: settings.priorities.map((p) => ({
				value: p.value,
				label: p.label,
				icon: p.icon ?? "flag",
			})),
			onPick: (value) => {
				this.priority = value;
				this.updatePreview();
			},
		});

		this.buildDateChip(toolbar, "calendar", this.scheduledDate, "Scheduled date", (value) => {
			this.scheduledDate = value;
			this.updatePreview();
		});
		this.buildDateChip(toolbar, "calendar-clock", this.dueDate, "Due date", (value) => {
			this.dueDate = value;
		});
		this.buildTextChip(toolbar, "clock", this.estimate, "30m", "Estimate", (value) => {
			this.estimate = value;
		});

		const titleInput = box1.createEl("input", {
			cls: "daytasks-title-input",
			attr: {
				type: "text",
				placeholder: "Buy milk",
				maxlength: String(MAX_TITLE_LENGTH),
				"aria-label": "Title",
			},
		});
		titleInput.value = this.title.slice(0, MAX_TITLE_LENGTH);
		const titleCounter = box1.createDiv({
			cls: "daytasks-char-counter",
			text: `${titleInput.value.length}/${MAX_TITLE_LENGTH}`,
		});
		titleInput.addEventListener("input", () => {
			this.title = titleInput.value.slice(0, MAX_TITLE_LENGTH);
			titleCounter.setText(`${this.title.length}/${MAX_TITLE_LENGTH}`);
			this.updatePreview();
		});
		// Defer focus to the next tick; track the handle so a modal closed within
		// the same tick clears it instead of focusing a detached input (LIFE-4).
		this.focusTimer = window.setTimeout(() => {
			this.focusTimer = null;
			titleInput.focus();
		}, 0);

		const description = box1.createEl("textarea", {
			cls: "daytasks-description-input",
			attr: {
				placeholder: "Description…",
				maxlength: String(MAX_DESCRIPTION_LENGTH),
				"aria-label": "Description",
			},
		});
		description.value = this.description;
		const counter = box1.createDiv({
			cls: "daytasks-char-counter",
			text: `${this.description.length}/${MAX_DESCRIPTION_LENGTH}`,
		});
		description.addEventListener("input", () => {
			this.description = description.value.slice(0, MAX_DESCRIPTION_LENGTH);
			counter.setText(`${this.description.length}/${MAX_DESCRIPTION_LENGTH}`);
		});

		// ---- Box 2: metadata ----
		const box2 = contentEl.createDiv({ cls: "daytasks-modal-box" });
		const fields = box2.createDiv({ cls: "daytasks-field-2up" });
		this.buildLabeledInput(fields, "hash", this.tags, "errand, home", "Tags", (value) => {
			this.tags = value;
			this.updatePreview();
		});
		this.buildLabeledInput(fields, "at-sign", this.contexts, "phone, office", "Contexts", (value) => {
			this.contexts = value;
			this.updatePreview();
		});

		const projectsField = box2.createDiv({ cls: "daytasks-projects-field" });
		const projectsHeader = projectsField.createDiv({ cls: "daytasks-projects-header" });
		const projectsLabel = projectsHeader.createDiv({ cls: "daytasks-field-label" });
		setIcon(projectsLabel.createSpan({ cls: "daytasks-label-icon" }), "folder");
		projectsLabel.createSpan({ text: "Projects" });
		const addProjectButton = projectsHeader.createEl("button", {
			cls: "daytasks-add-project",
			text: "Add project",
		});
		const projectsList = projectsField.createDiv({ cls: "daytasks-projects-list" });
		const renderProjects = (): void => {
			projectsList.empty();
			for (const project of this.projects) {
				const row = projectsList.createDiv({ cls: "daytasks-project-row" });
				row.createSpan({
					cls: "daytasks-project-row__label",
					text: noteBasename(project.path),
				});
				const remove = row.createEl("button", { cls: "daytasks-project-row__remove" });
				setIcon(remove, "x");
				remove.setAttribute("aria-label", `Remove project ${noteBasename(project.path)}`);
				remove.addEventListener("click", () => {
					this.projects = this.projects.filter((p) => p.path !== project.path);
					renderProjects();
					this.updatePreview();
				});
			}
		};
		addProjectButton.addEventListener("click", () => {
			new MarkdownPathSuggestModal(this.app, (path) => {
				this.projects = mergeUniqueProjects(this.projects, [{ path }]);
				renderProjects();
				this.updatePreview();
			}).open();
		});
		renderProjects();

		const detailRow = box2.createDiv({ cls: "daytasks-toggle-row" });
		detailRow.createSpan({ text: "Create detail note" });
		const detailToggle = detailRow.createEl("input", {
			attr: { type: "checkbox", "aria-label": "Create detail note" },
		});
		detailToggle.checked = this.createDetailNote;
		detailToggle.addEventListener("change", () => {
			this.createDetailNote = detailToggle.checked;
		});

		// ---- Relationship placeholders (wired in later slices) ----
		const placeholders = contentEl.createDiv({ cls: "daytasks-placeholders" });
		this.buildSubtasks(placeholders);
		this.buildDependencySection(placeholders, "blocked-by");
		this.buildDependencySection(placeholders, "blocking");

		this.preview = contentEl.createDiv({ cls: "daytasks-create-preview" });
		this.updatePreview();

		// ---- Actions ----
		const actions = contentEl.createDiv({ cls: "daytasks-modal-actions" });
		const submitButton = actions.createEl("button", {
			cls: "mod-cta",
			text: this.isEdit ? "Save" : "Create",
		});
		submitButton.addEventListener("click", () => this.submit());

		const initial = this.options.initial;
		if (this.isEdit && this.options.onDelete && initial) {
			let armed = false;
			const deleteButton = actions.createEl("button", {
				cls: "mod-warning",
				text: "Delete",
			});
			deleteButton.addEventListener("click", () => {
				if (!armed) {
					armed = true;
					deleteButton.setText("Confirm delete");
					return;
				}
				this.submitted = true;
				this.options.onDelete?.(initial.id);
				this.close();
			});
		}
	}

	/** A toolbar chip (icon + label) that opens an Obsidian menu of options. */
	private buildMenuChip(parent: HTMLElement, opts: MenuChipOptions): void {
		const button = parent.createEl("button", { cls: "daytasks-chip" });
		button.setAttribute("aria-haspopup", "menu");
		const refresh = (): void => {
			const current = opts.getCurrent();
			button.empty();
			const iconName = current?.icon ?? opts.fallbackIcon;
			if (iconName) {
				setIcon(button.createSpan({ cls: "daytasks-chip-icon" }), iconName);
			}
			if (current?.color) {
				button.style.setProperty(
					"--chip-color",
					safeCssColor(current.color, "var(--text-muted)")
				);
			} else {
				button.style.removeProperty("--chip-color");
			}
			const label = current?.label ?? opts.emptyLabel ?? "—";
			if (!opts.iconOnly) {
				button.createSpan({ cls: "daytasks-chip-label", text: label });
			}
			button.setAttribute("aria-label", `${opts.ariaPrefix}: ${label}`);
			button.setAttribute("title", `${opts.ariaPrefix}: ${label}`);
		};
		refresh();
		button.addEventListener("click", (evt) => {
			const menu = new Menu();
			for (const item of opts.items) {
				menu.addItem((menuItem) => {
					menuItem.setTitle(item.label);
					if (item.icon) {
						menuItem.setIcon(item.icon);
					}
					menuItem.onClick(() => {
						opts.onPick(item.value);
						refresh();
					});
				});
			}
			menu.showAtMouseEvent(evt);
		});
	}

	/** A toolbar chip with a leading icon and a native date input. */
	private buildDateChip(
		parent: HTMLElement,
		iconName: string,
		value: string,
		ariaLabel: string,
		onChange: (value: string) => void
	): void {
		const chip = parent.createDiv({
			cls: "daytasks-chip daytasks-chip--input daytasks-chip--date",
		});
		setIcon(chip.createSpan({ cls: "daytasks-chip-icon" }), iconName);
		const input = chip.createEl("input", {
			attr: { type: "date", "aria-label": ariaLabel, title: ariaLabel },
		});
		input.value = value;
		input.addEventListener("input", () => onChange(input.value.trim()));
		// The native picker indicator is hidden (it duplicated our icon), so open
		// the picker when the chip is clicked. Typing still works.
		chip.addEventListener("click", () => {
			try {
				input.showPicker();
			} catch {
				// showPicker unavailable/blocked; the field still accepts typing.
			}
		});
	}

	/** A toolbar chip with a leading icon and a small text input. */
	private buildTextChip(
		parent: HTMLElement,
		iconName: string,
		value: string,
		placeholder: string,
		ariaLabel: string,
		onChange: (value: string) => void
	): void {
		const chip = parent.createDiv({ cls: "daytasks-chip daytasks-chip--input" });
		setIcon(chip.createSpan({ cls: "daytasks-chip-icon" }), iconName);
		const input = chip.createEl("input", {
			cls: "daytasks-estimate-input",
			attr: { type: "text", placeholder, "aria-label": ariaLabel },
		});
		input.value = value;
		input.addEventListener("input", () => onChange(input.value));
	}

	/** An icon-prefixed text field used for tags / contexts in the metadata box. */
	private buildLabeledInput(
		parent: HTMLElement,
		iconName: string,
		value: string,
		placeholder: string,
		ariaLabel: string,
		onChange: (value: string) => void
	): void {
		const field = parent.createDiv({ cls: "daytasks-field" });
		setIcon(field.createSpan({ cls: "daytasks-field-icon" }), iconName);
		const input = field.createEl("input", {
			attr: { type: "text", placeholder, "aria-label": ariaLabel },
		});
		input.value = value;
		input.addEventListener("input", () => onChange(input.value));
	}

	private buildSubtasks(parent: HTMLElement): void {
		const initial = this.options.initial;
		const row = parent.createDiv({ cls: "daytasks-subtasks" });
		const header = row.createDiv({ cls: "daytasks-placeholder-label" });
		setIcon(header.createSpan({ cls: "daytasks-label-icon" }), "list-tree");
		header.createSpan({ text: "Subtasks" });

		if (!this.isEdit || !initial || !this.options.getChildren) {
			header.createSpan({
				cls: "daytasks-placeholder-hint",
				text: "Save the task first to add subtasks",
			});
			return;
		}
		const parentId = initial.id;
		const getChildren = this.options.getChildren;

		const list = row.createDiv({ cls: "daytasks-subtasks-list" });
		const renderList = (): void => {
			list.empty();
			for (const child of getChildren(parentId)) {
				const item = list.createDiv({ cls: "daytasks-subtask-row" });
				const dot = item.createSpan({ cls: "daytasks-subtask-dot" });
				dot.style.setProperty(
					"--daytasks-status-color",
					safeCssColor(
						this.options.settings.statuses.find((s) => s.value === child.status)?.color ?? "",
						"var(--text-muted)"
					)
				);
				item.createSpan({ cls: "daytasks-subtask-title", text: child.title });
				const unlink = item.createEl("button", { cls: "daytasks-subtask-unlink" });
				setIcon(unlink, "x");
				unlink.setAttribute("aria-label", `Unlink subtask ${child.title}`);
				unlink.addEventListener("click", () => {
					void (async () => {
						await this.options.onUnlinkSubtask?.(child.id);
						renderList();
					})();
				});
			}
		};
		renderList();

		const add = row.createDiv({ cls: "daytasks-subtask-add" });
		const input = add.createEl("input", {
			cls: "daytasks-subtask-input",
			attr: {
				type: "text",
				placeholder: "Add subtask",
				maxlength: String(MAX_TITLE_LENGTH),
				"aria-label": "Add subtask",
			},
		});
		const submitSubtask = async (): Promise<void> => {
			const title = input.value.trim();
			if (!title) {
				return;
			}
			input.value = "";
			await this.options.onAddSubtask?.(parentId, title);
			renderList();
		};
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				void submitSubtask();
			}
		});
		const addButton = add.createEl("button", { cls: "daytasks-subtask-add-button", text: "Add subtask" });
		addButton.addEventListener("click", () => void submitSubtask());
	}

	private buildDependencySection(parent: HTMLElement, kind: "blocked-by" | "blocking"): void {
		const initial = this.options.initial;
		const isBlockedBy = kind === "blocked-by";
		const label = isBlockedBy ? "Blocked by" : "Blocking";
		const icon = isBlockedBy ? "ban" : "arrow-right";
		const row = parent.createDiv({ cls: "daytasks-deps" });
		const header = row.createDiv({ cls: "daytasks-placeholder-label" });
		setIcon(header.createSpan({ cls: "daytasks-label-icon" }), icon);
		header.createSpan({ text: label });

		const get = isBlockedBy ? this.options.getBlockedBy : this.options.getBlocking;
		if (!this.isEdit || !initial || !get || !this.options.onAddDependency) {
			header.createSpan({ cls: "daytasks-placeholder-hint", text: "Save the task first to add" });
			return;
		}
		const statusConfig = this.options.settings.statuses.find((s) => s.value === initial.status);
		if (statusConfig?.isCompleted) {
			header.createSpan({ cls: "daytasks-placeholder-hint", text: "Completed tasks can't have dependencies" });
			return;
		}
		const thisId = initial.id;
		const list = row.createDiv({ cls: "daytasks-deps-list" });
		const renderList = (): void => {
			list.empty();
			for (const dep of get(thisId)) {
				const item = list.createDiv({ cls: "daytasks-dep-row" });
				item.createSpan({ cls: "daytasks-dep-title", text: `${dep.title} (${dep.id})` });
				const remove = item.createEl("button", { cls: "daytasks-dep-remove" });
				setIcon(remove, "x");
				remove.setAttribute("aria-label", `Remove ${dep.title}`);
				remove.addEventListener("click", () => {
					// blocked-by: thisId blocked by dep → remove(thisId, dep.id)
					// blocking:   dep blocked by thisId → remove(dep.id, thisId)
					void (async () => {
						if (isBlockedBy) {
							await this.options.onRemoveDependency?.(thisId, dep.id);
						} else {
							await this.options.onRemoveDependency?.(dep.id, thisId);
						}
						renderList();
					})();
				});
			}
		};
		renderList();

		const add = row.createEl("button", { cls: "daytasks-dep-add", text: "Add task" });
		add.addEventListener("click", () => {
			const candidates = (this.options.getDependencyCandidates?.(thisId) ?? []).map((t) => ({
				id: t.id,
				title: t.title,
				scheduledDate: t.scheduledDate,
			}));
			new TaskSuggestModal(this.app, candidates, (pickedId) => {
				void (async () => {
					if (isBlockedBy) {
						await this.options.onAddDependency?.(thisId, pickedId);
					} else {
						await this.options.onAddDependency?.(pickedId, thisId);
					}
					renderList();
				})();
			}).open();
		});
	}

	private updatePreview(): void {
		const parts = [this.title.trim() || "(untitled)", `· ${this.status}`];
		if (this.scheduledDate) {
			parts.push(`· ${this.scheduledDate}`);
		}
		for (const tag of parseLabelList(this.tags)) {
			parts.push(`#${tag}`);
		}
		for (const context of parseLabelList(this.contexts)) {
			parts.push(`@${context}`);
		}
		for (const project of this.projects) {
			parts.push(`+${project.path}`);
		}
		this.preview.setText(parts.join(" "));
	}

	private submit(): void {
		const title = this.title.trim();
		if (!title || !this.scheduledDate) {
			this.preview.setText("A title and scheduled date are required.");
			return;
		}
		if (dueBeforeScheduled(this.scheduledDate, this.dueDate)) {
			this.preview.setText("Due date cannot be before the scheduled date.");
			return;
		}

		const tags = parseLabelList(this.tags);
		const contexts = parseLabelList(this.contexts);
		const input: CreateDayTaskInput = {
			title,
			scheduledDate: this.scheduledDate,
			status: this.status,
		};
		if (this.priority) {
			input.priority = this.priority;
		}
		if (this.dueDate) {
			input.dueDate = this.dueDate;
		}
		if (tags.length > 0) {
			input.tags = tags;
		}
		if (contexts.length > 0) {
			input.contexts = contexts;
		}
		if (this.projects.length > 0) {
			input.projects = this.projects.map((project) => ({ ...project }));
		}
		const estimate = parseEstimateMinutes(this.estimate);
		if (estimate !== undefined) {
			input.estimateMinutes = estimate;
		}
		if (this.description.trim()) {
			input.description = this.description.trim();
		}
		input.detailNote = this.createDetailNote;

		this.submitted = true;
		this.options.onSubmit(input);
		this.close();
	}

	onClose(): void {
		if (this.focusTimer !== null) {
			window.clearTimeout(this.focusTimer);
			this.focusTimer = null;
		}
		this.contentEl.empty();
		if (!this.submitted) {
			this.options.onSubmit(null);
		}
	}
}
