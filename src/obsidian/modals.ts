import { App, FuzzySuggestModal, TFile } from "obsidian";
import { filterMarkdownPaths } from "../util/fuzzyPath";
import { noteBasename } from "../util/notePath";

/** Searchable picker over the vault's markdown files. */
export class MarkdownPathSuggestModal extends FuzzySuggestModal<string> {
	/** Cached for the modal's lifetime — FuzzySuggestModal calls getItems() on
	 * every keystroke, and the vault file list is stable while the modal is open. */
	private cachedItems?: string[];

	constructor(
		app: App,
		private readonly onChoose: (path: string) => void
	) {
		super(app);
		this.setPlaceholder("Search for a markdown note…");
	}

	getItems(): string[] {
		if (!this.cachedItems) {
			const paths = this.app.vault
				.getFiles()
				.filter((file: TFile) => file.extension === "md")
				.map((file: TFile) => file.path);
			// Pre-sort with our shared util so the empty-query list is stable.
			this.cachedItems = filterMarkdownPaths(paths, "");
		}
		return this.cachedItems;
	}

	getItemText(item: string): string {
		return `${noteBasename(item)} — ${item}`;
	}

	onChooseItem(item: string): void {
		this.onChoose(item);
	}
}
