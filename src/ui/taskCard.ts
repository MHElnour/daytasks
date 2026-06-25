import type { StatusManager } from "../core/statusManager";
import type { PriorityConfig } from "../core/status";
import type { DayTask } from "../core/task";
import { safeCssColor } from "../util/cssColor";
import { formatEstimateMinutes } from "../util/estimate";
import { noteBasename } from "../util/notePath";
import { formatMonthDay, isOverdue } from "../util/relativeDate";

/** Lucide icon used for a priority that has no configured icon. */
const DEFAULT_PRIORITY_ICON = "flag";

export interface TaskCardProjectViewModel {
	path: string;
	label: string;
}

export interface TaskCardNesting {
	children?: TaskCardViewModel[];
	childProgress?: { done: number; total: number };
	expanded?: boolean;
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
	priorityLabel?: string;
	priorityColor?: string;
	priorityIcon?: string;
	estimateLabel?: string;
	scheduledLabel: string;
	dueDate?: string;
	dueLabel?: string;
	overdue: boolean;
	tags: string[];
	contexts: string[];
	projects: TaskCardProjectViewModel[];
	description?: string;
	children: TaskCardViewModel[];
	childProgress?: { done: number; total: number };
	expanded: boolean;
}

export function createTaskCardViewModel(
	task: DayTask,
	statusManager: StatusManager,
	referenceDate: string,
	priorities: PriorityConfig[],
	nesting: TaskCardNesting = {}
): TaskCardViewModel {
	const config = statusManager.getStatusConfig(task.status);
	const checked = statusManager.isCompletedStatus(task.status);
	const priorityConfig = task.priority
		? priorities.find((priority) => priority.value === task.priority)
		: undefined;
	return {
		id: task.id,
		title: task.title,
		checked,
		status: task.status,
		statusLabel: config?.label ?? task.status,
		statusColor: safeCssColor(config?.color ?? "", "var(--text-muted)"),
		statusIcon: config?.icon,
		priority: task.priority,
		priorityLabel: task.priority ? (priorityConfig?.label ?? task.priority) : undefined,
		priorityColor: task.priority
			? safeCssColor(priorityConfig?.color ?? "", "var(--text-muted)")
			: undefined,
		priorityIcon: task.priority
			? (priorityConfig?.icon ?? DEFAULT_PRIORITY_ICON)
			: undefined,
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
		children: nesting.children ?? [],
		childProgress: nesting.childProgress,
		expanded: nesting.expanded ?? false,
	};
}
