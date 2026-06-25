import { App, Menu, Modal, Setting, setIcon } from "obsidian";
import { mergeUniqueProjects } from "../core/taskFactory";
import {
	MAX_DESCRIPTION_LENGTH,
	type CreateDayTaskInput,
	type DayTask,
	type ProjectLink,
} from "../core/task";
import type { DayTasksSettings } from "../settings/settings";
import { parseEstimateMinutes } from "../util/estimate";
import { noteBasename } from "../util/notePath";
import { parseLabelList } from "../util/parseLabelList";
import { MarkdownPathSuggestModal } from "./modals";

export interface TaskCreationModalOptions {
	settings: DayTasksSettings;
	scheduledDate: string;
	/** When set, the modal opens in edit mode prefilled from this task. */
	initial?: DayTask;
	onSubmit: (input: CreateDayTaskInput | null) => void;
	/** Edit mode only: called when the user confirms deletion. */
	onDelete?: (taskId: string) => void;
}

/**
 * Rich task-creation modal. Collects the full CreateDayTaskInput contract and
 * shows a live preview. NLP parsing of the title can be layered on later without
 * changing this contract.
 */
export class TaskCreationModal extends Modal {
	private submitted = false;
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

		new Setting(contentEl).setName("Title").addText((text) => {
			text.setValue(this.title);
			text.setPlaceholder("Buy milk").onChange((value) => {
				this.title = value;
				this.updatePreview();
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});

		const statusSetting = new Setting(contentEl).setName("Status");
		this.addLabelIcon(statusSetting, "circle-dot");
		statusSetting.addButton((button) => {
			button.buttonEl.addClass("daytasks-status-picker");
			button.buttonEl.setAttribute("aria-haspopup", "menu");
			const refresh = (): void => {
				const current = settings.statuses.find((s) => s.value === this.status);
				const el = button.buttonEl;
				el.empty();
				const iconEl = el.createSpan({ cls: "daytasks-picker-icon" });
				if (current?.icon) {
					setIcon(iconEl, current.icon);
				}
				el.createSpan({ text: current?.label ?? this.status });
				el.setAttribute("aria-label", `Status: ${current?.label ?? this.status}`);
			};
			refresh();
			button.onClick((evt) => {
				const menu = new Menu();
				for (const status of settings.statuses) {
					menu.addItem((item) => {
						item.setTitle(status.label);
						if (status.icon) {
							item.setIcon(status.icon);
						}
						item.onClick(() => {
							this.status = status.value;
							refresh();
							this.updatePreview();
						});
					});
				}
				menu.showAtMouseEvent(evt);
			});
		});

		const prioritySetting = new Setting(contentEl).setName("Priority");
		this.addLabelIcon(prioritySetting, "flag");
		prioritySetting.addDropdown((dropdown) => {
			dropdown.addOption("", "—");
			for (const priority of settings.priorities) {
				dropdown.addOption(priority.value, priority.label);
			}
			dropdown.setValue(this.priority).onChange((value) => {
				this.priority = value;
				this.updatePreview();
			});
		});

		const scheduledSetting = new Setting(contentEl).setName("Scheduled date");
		this.addLabelIcon(scheduledSetting, "calendar");
		scheduledSetting.addText((text) => {
			text.inputEl.type = "date";
			text.setValue(this.scheduledDate).onChange((value) => {
				this.scheduledDate = value.trim();
				this.updatePreview();
			});
		});

		const dueSetting = new Setting(contentEl).setName("Due date");
		this.addLabelIcon(dueSetting, "calendar-clock");
		dueSetting.addText((text) => {
			text.inputEl.type = "date";
			text.setValue(this.dueDate).onChange((value) => {
				this.dueDate = value.trim();
			});
		});

		new Setting(contentEl).setName("Tags").setDesc("Comma or space separated").addText(
			(text) =>
				text
					.setPlaceholder("errand, home")
					.setValue(this.tags)
					.onChange((value) => {
						this.tags = value;
						this.updatePreview();
					})
		);

		new Setting(contentEl).setName("Contexts").addText((text) =>
			text
				.setPlaceholder("phone, office")
				.setValue(this.contexts)
				.onChange((value) => {
					this.contexts = value;
					this.updatePreview();
				})
		);

		const projectsSetting = new Setting(contentEl)
			.setName("Projects")
			.setDesc("Link one or more project notes.");
		this.addLabelIcon(projectsSetting, "folder");
		const projectsList = contentEl.createDiv({ cls: "daytasks-projects-list" });
		const renderProjects = (): void => {
			projectsList.empty();
			for (const project of this.projects) {
				const row = projectsList.createDiv({ cls: "daytasks-project-row" });
				row.createSpan({
					cls: "daytasks-project-row__label",
					text: noteBasename(project.path),
				});
				const remove = row.createEl("button", {
					cls: "daytasks-project-row__remove",
				});
				setIcon(remove, "x");
				remove.setAttribute("aria-label", `Remove project ${noteBasename(project.path)}`);
				remove.addEventListener("click", () => {
					this.projects = this.projects.filter((p) => p.path !== project.path);
					renderProjects();
					this.updatePreview();
				});
			}
		};
		projectsSetting.addButton((button) =>
			button.setButtonText("Add project").onClick(() => {
				new MarkdownPathSuggestModal(this.app, (path) => {
					this.projects = mergeUniqueProjects(this.projects, [{ path }]);
					renderProjects();
					this.updatePreview();
				}).open();
			})
		);
		renderProjects();

		new Setting(contentEl).setName("Estimate").setDesc("e.g. 30m, 2h, 1h30m").addText(
			(text) =>
				text
					.setPlaceholder("30m")
					.setValue(this.estimate)
					.onChange((value) => {
						this.estimate = value;
					})
		);

		const descriptionSetting = new Setting(contentEl)
			.setName("Description")
			.setDesc(`${this.description.length}/${MAX_DESCRIPTION_LENGTH}`)
			.addTextArea((area) => {
				area.inputEl.maxLength = MAX_DESCRIPTION_LENGTH;
				area.setValue(this.description).onChange((value) => {
					this.description = value.slice(0, MAX_DESCRIPTION_LENGTH);
					descriptionSetting.setDesc(
						`${this.description.length}/${MAX_DESCRIPTION_LENGTH}`
					);
				});
			});

		new Setting(contentEl)
			.setName("Create detail note")
			.addToggle((toggle) =>
				toggle.setValue(this.createDetailNote).onChange((value) => {
					this.createDetailNote = value;
				})
			);

		this.preview = contentEl.createDiv({ cls: "daytasks-create-preview" });
		this.updatePreview();

		const actions = new Setting(contentEl);
		actions.addButton((button) =>
			button
				.setButtonText(this.isEdit ? "Save" : "Create")
				.setCta()
				.onClick(() => this.submit())
		);

		const initial = this.options.initial;
		if (this.isEdit && this.options.onDelete && initial) {
			let armed = false;
			actions.addButton((button) => {
				button
					.setButtonText("Delete")
					.setWarning()
					.onClick(() => {
						if (!armed) {
							armed = true;
							button.setButtonText("Confirm delete");
							return;
						}
						this.submitted = true;
						this.options.onDelete?.(initial.id);
						this.close();
					});
			});
		}
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

	/** Prepends a small Lucide icon to a setting's name label. */
	private addLabelIcon(setting: Setting, iconName: string): void {
		const icon = setting.nameEl.createSpan({ cls: "daytasks-label-icon" });
		setIcon(icon, iconName);
		setting.nameEl.prepend(icon);
	}

	private submit(): void {
		const title = this.title.trim();
		if (!title || !this.scheduledDate) {
			this.preview.setText("A title and scheduled date are required.");
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
		this.contentEl.empty();
		if (!this.submitted) {
			this.options.onSubmit(null);
		}
	}
}
