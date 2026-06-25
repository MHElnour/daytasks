import type { StatusManager } from "../core/statusManager";
import type { DayTask } from "../core/task";
import { formatEstimateMinutes } from "../util/estimate";
import { noteBasename } from "../util/notePath";

export interface TaskCardProjectViewModel {
	path: string;
	label: string;
}

export interface TaskCardViewModel {
	id: string;
	title: string;
	checked: boolean;
	status: string;
	statusLabel: string;
	statusColor: string;
	statusIcon?: string;
	priority?: string;
	estimateLabel?: string;
	dueDate?: string;
	tags: string[];
	contexts: string[];
	projects: TaskCardProjectViewModel[];
	description?: string;
}

export function createTaskCardViewModel(
	task: DayTask,
	statusManager: StatusManager
): TaskCardViewModel {
	const config = statusManager.getStatusConfig(task.status);
	return {
		id: task.id,
		title: task.title,
		checked: statusManager.isCompletedStatus(task.status),
		status: task.status,
		statusLabel: config?.label ?? task.status,
		statusColor: config?.color ?? "var(--text-muted)",
		statusIcon: config?.icon,
		priority: task.priority,
		estimateLabel: formatEstimateMinutes(task.estimateMinutes),
		dueDate: task.dueDate,
		tags: [...task.tags],
		contexts: [...task.contexts],
		projects: task.projects.map((project) => ({
			path: project.path,
			label: project.title ?? noteBasename(project.path),
		})),
		description: task.description,
	};
}
