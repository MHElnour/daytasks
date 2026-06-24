import type { DayTask } from "../core/task";
import { cloneStrings } from "../util/clone";
import { noteBasename } from "../util/notePath";

export interface TaskCardProjectViewModel {
	path: string;
	label: string;
}

export interface TaskCardViewModel {
	id: string;
	title: string;
	checked: boolean;
	status: DayTask["status"];
	tags: string[];
	projects: TaskCardProjectViewModel[];
}

export function createTaskCardViewModel(task: DayTask): TaskCardViewModel {
	return {
		id: task.id,
		title: task.title,
		checked: task.status === "done",
		status: task.status,
		tags: cloneStrings(task.tags) ?? [],
		projects: (task.projects ?? []).map((project) => ({
			path: project.path,
			label: project.title ?? noteBasename(project.path),
		})),
	};
}
