import type { StatusConfig } from "./status";

export interface StatusValidationResult {
	valid: boolean;
	errors: string[];
}

/**
 * Status cycling, completion checks, and validation over a configurable set of
 * statuses. Behavior ported (and trimmed) from TaskNotes StatusManager.
 */
export class StatusManager {
	/** Statuses sorted by `order`, computed once (the set is immutable here). */
	private readonly orderedStatuses: StatusConfig[];

	constructor(
		private readonly statuses: StatusConfig[],
		private readonly defaultStatus: string
	) {
		this.orderedStatuses = [...statuses].sort((a, b) => a.order - b.order);
	}

	getAllStatuses(): StatusConfig[] {
		return [...this.statuses];
	}

	getStatusesByOrder(): StatusConfig[] {
		return [...this.orderedStatuses];
	}

	getStatusConfig(value: string): StatusConfig | undefined {
		return this.statuses.find((status) => status.value === value);
	}

	isCompletedStatus(value: string): boolean {
		return this.getStatusConfig(value)?.isCompleted ?? false;
	}

	normalizeStatusValue(value: unknown): string {
		if (typeof value === "string" && this.getStatusConfig(value)) {
			return value;
		}
		return this.defaultStatus;
	}

	private getCycleStatuses(): StatusConfig[] {
		return this.getStatusesByOrder().filter((status) => !status.excludeFromCycle);
	}

	getNextStatus(current: string): string {
		const currentConfig = this.getStatusConfig(current);

		if (currentConfig?.nextStatus && currentConfig.nextStatus !== currentConfig.value) {
			const configured = this.getStatusConfig(currentConfig.nextStatus);
			if (configured) {
				return configured.value;
			}
		}

		const cycle = this.getCycleStatuses();
		if (cycle.length === 0) {
			return currentConfig?.value ?? this.defaultStatus;
		}

		const index = cycle.findIndex((status) => status.value === current);
		if (index !== -1) {
			return cycle[(index + 1) % cycle.length].value;
		}

		if (!currentConfig) {
			return this.normalizeStatusValue(undefined);
		}

		return (
			cycle.find((status) => status.order > currentConfig.order)?.value ??
			cycle[0].value
		);
	}

	/**
	 * Target status for a checkbox toggle: a completed task flips back to the
	 * default status; an incomplete task flips to the first completed status.
	 */
	getCompletionToggleTarget(current: string): string {
		if (this.isCompletedStatus(current)) {
			return this.defaultStatus;
		}
		const completed = this.getStatusesByOrder().find((status) => status.isCompleted);
		return completed?.value ?? this.defaultStatus;
	}

	validate(): StatusValidationResult {
		const errors: string[] = [];

		if (this.statuses.length < 2) {
			errors.push("At least two statuses are required.");
		}
		if (!this.statuses.some((status) => status.isCompleted)) {
			errors.push("At least one completed status is required.");
		}

		const values = new Set<string>();
		const ids = new Set<string>();
		for (const status of this.statuses) {
			if (values.has(status.value)) {
				errors.push(`Duplicate status value: ${status.value}`);
			}
			if (ids.has(status.id)) {
				errors.push(`Duplicate status id: ${status.id}`);
			}
			values.add(status.value);
			ids.add(status.id);
		}

		if (!values.has(this.defaultStatus)) {
			errors.push(`Default status does not exist: ${this.defaultStatus}`);
		}

		for (const status of this.statuses) {
			if (status.nextStatus === undefined) {
				continue;
			}
			if (status.nextStatus === status.value) {
				errors.push(`Status ${status.value} cannot point its nextStatus at itself.`);
			} else if (!values.has(status.nextStatus)) {
				errors.push(
					`Status ${status.value} has an unknown nextStatus: ${status.nextStatus}`
				);
			}
		}

		return { valid: errors.length === 0, errors };
	}
}
