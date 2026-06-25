import { App, Notice, PluginSettingTab, Setting, type TextComponent } from "obsidian";
import type DayTasksPlugin from "../main";
import { addMarkdownPathPicker } from "../obsidian/projectPicker";
import { debounce, type DebouncedFunction } from "../util/debounce";
import { parseLabelList } from "../util/parseLabelList";

/** Delay before a typed text setting is persisted, to coalesce keystrokes. */
const TEXT_SAVE_DEBOUNCE_MS = 400;

export class DayTasksSettingTab extends PluginSettingTab {
	private readonly persistDebounced: DebouncedFunction<[]>;

	constructor(
		app: App,
		private readonly plugin: DayTasksPlugin
	) {
		super(app, plugin);
		this.persistDebounced = debounce(() => {
			void this.saveSettingsWithNotice();
		}, TEXT_SAVE_DEBOUNCE_MS);
	}

	/** Persists pending text edits when the settings pane closes. */
	hide(): void {
		this.persistDebounced.flush();
	}

	/** Saves settings, surfacing a failure instead of swallowing the rejection. */
	private async saveSettingsWithNotice(): Promise<void> {
		try {
			await this.plugin.saveSettings();
		} catch (error) {
			console.error("DayTasks: failed to save settings", error);
			new Notice("DayTasks: could not save settings.");
		}
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const settings = this.plugin.settings;

		new Setting(containerEl).setName("Daily notes").setHeading();

		new Setting(containerEl)
			.setName("Daily note folder")
			.setDesc("Only notes in this folder are treated as daily notes. Empty = any folder.")
			.addText((text) =>
				text.setValue(settings.dailyNoteFolder).onChange((value) => {
					settings.dailyNoteFolder = value.trim();
					this.persistDebounced();
				})
			);

		new Setting(containerEl)
			.setName("Daily note date format")
			.setDesc("Display only for v0. Detection still uses the YYYY-MM-DD filename prefix.")
			.addText((text) =>
				text.setValue(settings.dailyNoteDateFormat).onChange((value) => {
					settings.dailyNoteDateFormat = value.trim() || "YYYY-MM-DD";
					this.persistDebounced();
				})
			);

		new Setting(containerEl).setName("Widget").setHeading();

		new Setting(containerEl)
			.setName("Show daily note widget")
			.setDesc("When off, tasks are still stored but no widget is rendered.")
			.addToggle((toggle) =>
				toggle.setValue(settings.showDailyNoteWidget).onChange(async (value) => {
					settings.showDailyNoteWidget = value;
					await this.saveSettingsWithNotice();
				})
			);

		new Setting(containerEl).setName("Show task IDs").addToggle((toggle) =>
			toggle.setValue(settings.showTaskIds).onChange(async (value) => {
				settings.showTaskIds = value;
				await this.saveSettingsWithNotice();
			})
		);

		new Setting(containerEl).setName("Show tags").addToggle((toggle) =>
			toggle.setValue(settings.showTags).onChange(async (value) => {
				settings.showTags = value;
				await this.saveSettingsWithNotice();
			})
		);

		new Setting(containerEl).setName("Show contexts").addToggle((toggle) =>
			toggle.setValue(settings.showContexts).onChange(async (value) => {
				settings.showContexts = value;
				await this.saveSettingsWithNotice();
			})
		);

		new Setting(containerEl).setName("Show projects").addToggle((toggle) =>
			toggle.setValue(settings.showProjects).onChange(async (value) => {
				settings.showProjects = value;
				await this.saveSettingsWithNotice();
			})
		);

		new Setting(containerEl).setName("Task defaults").setHeading();

		new Setting(containerEl)
			.setName("Default status")
			.setDesc("Status applied to newly created tasks.")
			.addDropdown((dropdown) => {
				for (const status of settings.statuses) {
					dropdown.addOption(status.value, status.label);
				}
				dropdown.setValue(settings.defaultStatus).onChange(async (value) => {
					settings.defaultStatus = value;
					await this.saveSettingsWithNotice();
				});
			});

		new Setting(containerEl)
			.setName("Default priority")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "—");
				for (const priority of settings.priorities) {
					dropdown.addOption(priority.value, priority.label);
				}
				dropdown.setValue(settings.defaultPriority ?? "").onChange(async (value) => {
					settings.defaultPriority = value || undefined;
					await this.saveSettingsWithNotice();
				});
			});

		new Setting(containerEl)
			.setName("Default tags")
			.setDesc("Comma-separated tags applied to tasks created by DayTasks commands.")
			.addText((text) =>
				text
					.setPlaceholder("work, errand")
					.setValue(settings.defaultTags.join(", "))
					.onChange((value) => {
						settings.defaultTags = parseLabelList(value);
						this.persistDebounced();
					})
			);

		let projectInput: TextComponent | undefined;
		const projectSetting = new Setting(containerEl)
			.setName("Default project")
			.setDesc("New tasks link to this note. Use the picker to search your vault.")
			.addText((text) => {
				projectInput = text;
				text.setValue(settings.defaultProjectPath).onChange((value) => {
					settings.defaultProjectPath = value.trim();
					this.persistDebounced();
				});
				text.inputEl.addClass("daytasks-project-input");
			});
		addMarkdownPathPicker(
			projectSetting,
			this.app,
			() => projectInput,
			(path) => {
				settings.defaultProjectPath = path;
				void this.saveSettingsWithNotice();
			}
		);

		new Setting(containerEl)
			.setName("Detail notes folder")
			.setDesc("Reserved for optional detail notes in a later milestone.")
			.addText((text) =>
				text.setValue(settings.detailNotesFolder).onChange((value) => {
					settings.detailNotesFolder = value.trim();
					this.persistDebounced();
				})
			);

		new Setting(containerEl)
			.setName("Create detail note by default")
			.setDesc("Reserved for the detail-note milestone.")
			.addToggle((toggle) =>
				toggle.setValue(settings.createDetailNoteByDefault).onChange(async (value) => {
					settings.createDetailNoteByDefault = value;
					await this.saveSettingsWithNotice();
				})
			);

		new Setting(containerEl).setName("API (inactive)").setHeading();

		new Setting(containerEl)
			.setName("Enable local API")
			.setDesc("Reserved. The local HTTP API ships in a later milestone.")
			.addToggle((toggle) =>
				toggle.setValue(settings.apiEnabled).onChange(async (value) => {
					settings.apiEnabled = value;
					await this.saveSettingsWithNotice();
				})
			);

		new Setting(containerEl).setName("API port").addText((text) =>
			text.setValue(String(settings.apiPort)).onChange((value) => {
				const parsed = Number(value);
				settings.apiPort = Number.isFinite(parsed) ? parsed : settings.apiPort;
				this.persistDebounced();
			})
		);
	}
}
