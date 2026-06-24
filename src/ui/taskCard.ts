import type { DayTask } from "../core/task";

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

function projectLabel(path: string): string {
	const fileName = path.split(/[\\/]/).pop() ?? path;
	return fileName.replace(/\.md$/i, "");
}

export function createTaskCardViewModel(task: DayTask): TaskCardViewModel {
	return {
		id: task.id,
		title: task.title,
		checked: task.status === "done",
		status: task.status,
		tags: [...(task.tags ?? [])],
		projects: (task.projects ?? []).map((project) => ({
			path: project.path,
			label: project.title ?? projectLabel(project.path),
		})),
	};
}
