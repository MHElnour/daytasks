import { App, Modal, Setting, type TextComponent } from "obsidian";
import { MAX_DESCRIPTION_LENGTH, type CreateDayTaskInput, type DayTask } from "../core/task";
import type { DayTasksSettings } from "../settings/settings";
import { parseEstimateMinutes } from "../util/estimate";
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

function parseList(value: string): string[] {
	return value
		.split(/[,\s]+/)
		.map((entry) => entry.replace(/^[#@+]/, "").trim())
		.filter((entry) => entry.length > 0);
}

/**
 * Rich task-creation modal. Collects the full CreateDayTaskInput contract and
 * shows a live preview. NLP parsing of the title can be layered on later without
 * changing this contract.
 */
export class TaskCreationModal extends Modal {
	private submitted = false;
	private preview!: HTMLElement;
	private projectInput?: TextComponent;

	private title = "";
	private status: string;
	private priority: string;
	private scheduledDate: string;
	private dueDate = "";
	private tags = "";
	private contexts = "";
	private projectPath: string;
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
		this.projectPath = settings.defaultProjectPath;
		this.createDetailNote = settings.createDetailNoteByDefault;

		if (initial) {
			this.title = initial.title;
			this.status = initial.status;
			this.priority = initial.priority ?? "";
			this.scheduledDate = initial.scheduledDate;
			this.dueDate = initial.dueDate ?? "";
			this.tags = initial.tags.join(", ");
			this.contexts = initial.contexts.join(", ");
			this.projectPath = initial.projects[0]?.path ?? "";
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

		new Setting(contentEl).setName("Status").addDropdown((dropdown) => {
			for (const status of settings.statuses) {
				dropdown.addOption(status.value, status.label);
			}
			dropdown.setValue(this.status).onChange((value) => {
				this.status = value;
				this.updatePreview();
			});
		});

		new Setting(contentEl).setName("Priority").addDropdown((dropdown) => {
			dropdown.addOption("", "—");
			for (const priority of settings.priorities) {
				dropdown.addOption(priority.value, priority.label);
			}
			dropdown.setValue(this.priority).onChange((value) => {
				this.priority = value;
				this.updatePreview();
			});
		});

		new Setting(contentEl).setName("Scheduled date").addText((text) => {
			text.inputEl.type = "date";
			text.setValue(this.scheduledDate).onChange((value) => {
				this.scheduledDate = value.trim();
				this.updatePreview();
			});
		});

		new Setting(contentEl).setName("Due date").addText((text) => {
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

		new Setting(contentEl)
			.setName("Project")
			.addText((text) => {
				this.projectInput = text;
				text.setValue(this.projectPath).onChange((value) => {
					this.projectPath = value.trim();
					this.updatePreview();
				});
				text.inputEl.addClass("daytasks-project-input");
			})
			.addExtraButton((button) =>
				button
					.setIcon("search")
					.setTooltip("Browse markdown notes")
					.onClick(() => {
						new MarkdownPathSuggestModal(this.app, (path) => {
							this.projectPath = path;
							this.projectInput?.setValue(path);
							this.updatePreview();
						}).open();
					})
			);

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
		for (const tag of parseList(this.tags)) {
			parts.push(`#${tag}`);
		}
		for (const context of parseList(this.contexts)) {
			parts.push(`@${context}`);
		}
		if (this.projectPath) {
			parts.push(`+${this.projectPath}`);
		}
		this.preview.setText(parts.join(" "));
	}

	private submit(): void {
		const title = this.title.trim();
		if (!title || !this.scheduledDate) {
			this.preview.setText("A title and scheduled date are required.");
			return;
		}

		const tags = parseList(this.tags);
		const contexts = parseList(this.contexts);
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
		if (this.projectPath) {
			input.projects = [{ path: this.projectPath }];
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
