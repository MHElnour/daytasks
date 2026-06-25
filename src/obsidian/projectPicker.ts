import { App, Setting, type TextComponent } from "obsidian";
import { MarkdownPathSuggestModal } from "./modals";

/**
 * Adds a "browse markdown notes" extra-button to `setting` that opens the vault
 * path picker, writes the chosen path into the bound text input, and then runs
 * `onPick`. Shared by the task-creation modal and the settings tab.
 */
export function addMarkdownPathPicker(
	setting: Setting,
	app: App,
	getInput: () => TextComponent | undefined,
	onPick: (path: string) => void
): void {
	setting.addExtraButton((button) =>
		button
			.setIcon("search")
			.setTooltip("Browse markdown notes")
			.onClick(() => {
				new MarkdownPathSuggestModal(app, (path) => {
					getInput()?.setValue(path);
					onPick(path);
				}).open();
			})
	);
}
