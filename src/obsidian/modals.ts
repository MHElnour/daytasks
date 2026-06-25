import { App, FuzzySuggestModal, TFile } from "obsidian";
import { filterMarkdownPaths } from "../util/fuzzyPath";
import { noteBasename } from "../util/notePath";

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
