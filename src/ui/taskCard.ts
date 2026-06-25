import type { StatusManager } from "../core/statusManager";
import type { DayTask } from "../core/task";
import { safeCssColor } from "../util/cssColor";
import { formatEstimateMinutes } from "../util/estimate";
import { noteBasename } from "../util/notePath";
import { formatMonthDay, isOverdue } from "../util/relativeDate";

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
	scheduledLabel: string;
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
		statusColor: safeCssColor(config?.color ?? "", "var(--text-muted)"),
		statusIcon: config?.icon,
		priority: task.priority,
		estimateLabel: formatEstimateMinutes(task.estimateMinutes),
		scheduledLabel: formatMonthDay(task.scheduledDate),
		dueDate: task.dueDate,
		dueLabel: task.dueDate ? formatMonthDay(task.dueDate) : undefined,
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
