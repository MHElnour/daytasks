import type { DayTask } from "./task";

export interface TaskStore {
	list(): Promise<DayTask[]>;
	get(id: string): Promise<DayTask | null>;
	save(task: DayTask): Promise<void>;
	delete(id: string): Promise<void>;
}
