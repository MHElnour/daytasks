import { App, FuzzySuggestModal, Modal, Setting, TFile } from "obsidian";
import { filterMarkdownPaths } from "../util/fuzzyPath";
import { noteBasename } from "../util/notePath";

/** Prompts for a single line of text, resolving with the trimmed value or null. */
export class TitleInputModal extends Modal {
	private value: string;
	private submitted = false;

	constructor(
		app: App,
		private readonly initial: string,
		private readonly onSubmit: (title: string | null) => void
	) {
		super(app);
		this.value = initial;
	}

	onOpen(): void {
		this.titleEl.setText("New DayTasks task");

		new Setting(this.contentEl).setName("Title").addText((text) => {
			text.setValue(this.initial);
			text.setPlaceholder("Task title");
			text.onChange((next) => {
				this.value = next;
			});
			text.inputEl.addEventListener("keydown", (event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					this.submit();
				}
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});

		new Setting(this.contentEl).addButton((button) =>
			button
				.setButtonText("Create")
				.setCta()
				.onClick(() => this.submit())
		);
	}

	private submit(): void {
		this.submitted = true;
		const trimmed = this.value.trim();
		this.onSubmit(trimmed.length > 0 ? trimmed : null);
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.submitted) {
			this.onSubmit(null);
		}
	}
}

/** Searchable picker over the vault's markdown files. */
export class MarkdownPathSuggestModal extends FuzzySuggestModal<string> {
	constructor(
		app: App,
		private readonly onChoose: (path: string) => void
	) {
		super(app);
		this.setPlaceholder("Search for a markdown note…");
	}

	getItems(): string[] {
		const paths = this.app.vault
			.getFiles()
			.filter((file: TFile) => file.extension === "md")
			.map((file: TFile) => file.path);
		// Pre-sort with our shared util so the empty-query list is stable.
		return filterMarkdownPaths(paths, "");
	}

	getItemText(item: string): string {
		return `${noteBasename(item)} — ${item}`;
	}

	onChooseItem(item: string): void {
		this.onChoose(item);
	}
}
