import { App, FuzzySuggestModal } from "obsidian";

export interface TaskOption {
 id: string;
 title: string;
 scheduledDate: string;
}

/**
 * Searchable picker over the plugin's own tasks (DayTask data from the
 * store/index — NOT vault markdown files, since tasks are self-contained).
 * Matched and shown by title + day. Constructed with a pre-filtered candidate
 * list (excludes self + any task that would close a cycle).
 */
export class TaskSuggestModal extends FuzzySuggestModal<TaskOption> {
 constructor(
  app: App,
  private readonly options: TaskOption[],
  private readonly onChoose: (id: string) => void
 ) {
  super(app);
  this.setPlaceholder("Search tasks by title…");
 }

 getItems(): TaskOption[] {
  return this.options;
 }

 getItemText(item: TaskOption): string {
  // Shown + fuzzy-matched: task title and its scheduled day.
  return `${item.title} — ${item.scheduledDate}`;
 }

 onChooseItem(item: TaskOption): void {
  this.onChoose(item.id);
 }
}
