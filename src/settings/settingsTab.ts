import { App, PluginSettingTab, Setting } from "obsidian";
import type DayTasksPlugin from "../main";
import { MarkdownPathSuggestModal } from "../obsidian/modals";

function parseTags(value: string): string[] {
	return value
		.split(",")
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);
}

export class DayTasksSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: DayTasksPlugin
	) {
		super(app, plugin);
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
				text.setValue(settings.dailyNoteFolder).onChange(async (value) => {
					settings.dailyNoteFolder = value.trim();
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Daily note date format")
			.setDesc("Display only for v0. Detection still uses the YYYY-MM-DD filename prefix.")
			.addText((text) =>
				text.setValue(settings.dailyNoteDateFormat).onChange(async (value) => {
					settings.dailyNoteDateFormat = value.trim() || "YYYY-MM-DD";
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName("Widget").setHeading();

		new Setting(containerEl)
			.setName("Show daily note widget")
			.setDesc("When off, tasks are still stored but no widget is rendered.")
			.addToggle((toggle) =>
				toggle.setValue(settings.showDailyNoteWidget).onChange(async (value) => {
					settings.showDailyNoteWidget = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName("Show task IDs").addToggle((toggle) =>
			toggle.setValue(settings.showTaskIds).onChange(async (value) => {
				settings.showTaskIds = value;
				await this.plugin.saveSettings();
			})
		);

		new Setting(containerEl).setName("Show tags").addToggle((toggle) =>
			toggle.setValue(settings.showTags).onChange(async (value) => {
				settings.showTags = value;
				await this.plugin.saveSettings();
			})
		);

		new Setting(containerEl).setName("Show projects").addToggle((toggle) =>
			toggle.setValue(settings.showProjects).onChange(async (value) => {
				settings.showProjects = value;
				await this.plugin.saveSettings();
			})
		);

		new Setting(containerEl).setName("Task defaults").setHeading();

		new Setting(containerEl)
			.setName("Default tags")
			.setDesc("Comma-separated tags applied to tasks created by DayTasks commands.")
			.addText((text) =>
				text
					.setPlaceholder("work, errand")
					.setValue(settings.defaultTags.join(", "))
					.onChange(async (value) => {
						settings.defaultTags = parseTags(value);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Default project")
			.setDesc("New tasks link to this note. Use the picker to search your vault.")
			.addText((text) => {
				text.setValue(settings.defaultProjectPath).onChange(async (value) => {
					settings.defaultProjectPath = value.trim();
					await this.plugin.saveSettings();
				});
				text.inputEl.addClass("daytasks-project-input");
			})
			.addExtraButton((button) =>
				button
					.setIcon("search")
					.setTooltip("Browse markdown notes")
					.onClick(() => {
						new MarkdownPathSuggestModal(this.app, async (path) => {
							settings.defaultProjectPath = path;
							await this.plugin.saveSettings();
							this.display();
						}).open();
					})
			);

		new Setting(containerEl)
			.setName("Detail notes folder")
			.setDesc("Reserved for optional detail notes in a later milestone.")
			.addText((text) =>
				text.setValue(settings.detailNotesFolder).onChange(async (value) => {
					settings.detailNotesFolder = value.trim();
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Create detail note by default")
			.setDesc("Reserved for the detail-note milestone.")
			.addToggle((toggle) =>
				toggle.setValue(settings.createDetailNoteByDefault).onChange(async (value) => {
					settings.createDetailNoteByDefault = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName("API (inactive)").setHeading();

		new Setting(containerEl)
			.setName("Enable local API")
			.setDesc("Reserved. The local HTTP API ships in a later milestone.")
			.addToggle((toggle) =>
				toggle.setValue(settings.apiEnabled).onChange(async (value) => {
					settings.apiEnabled = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName("API port").addText((text) =>
			text.setValue(String(settings.apiPort)).onChange(async (value) => {
				const parsed = Number(value);
				settings.apiPort = Number.isFinite(parsed) ? parsed : settings.apiPort;
				await this.plugin.saveSettings();
			})
		);
	}
}
