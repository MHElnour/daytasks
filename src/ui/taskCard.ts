import type { StatusManager } from "../core/statusManager";
import type { DayTask } from "../core/task";
import { formatEstimateMinutes } from "../util/estimate";
import { noteBasename } from "../util/notePath";
import { formatRelativeDate, isOverdue } from "../util/relativeDate";

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
	dueLabel?: string;
	overdue: boolean;
	tags: string[];
	contexts: string[];
	projects: TaskCardProjectViewModel[];
	description?: string;
}

export function createTaskCardViewModel(
	task: DayTask,
	statusManager: StatusManager,
	referenceDate: string
): TaskCardViewModel {
	const config = statusManager.getStatusConfig(task.status);
	const checked = statusManager.isCompletedStatus(task.status);
	return {
		id: task.id,
		title: task.title,
		checked,
		status: task.status,
		statusLabel: config?.label ?? task.status,
		statusColor: config?.color ?? "var(--text-muted)",
		statusIcon: config?.icon,
		priority: task.priority,
		estimateLabel: formatEstimateMinutes(task.estimateMinutes),
		dueDate: task.dueDate,
		dueLabel: task.dueDate
			? formatRelativeDate(task.dueDate, referenceDate)
			: undefined,
		overdue: isOverdue(task.dueDate, referenceDate, checked),
		tags: [...task.tags],
		contexts: [...task.contexts],
		projects: task.projects.map((project) => ({
			path: project.path,
			label: project.title ?? noteBasename(project.path),
		})),
		description: task.description,
	};
}
