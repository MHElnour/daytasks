export interface DayTasksSettings {
	dailyNoteFolder: string;
	dailyTaskHeading: string;
	apiEnabled: boolean;
	apiPort: number;
	apiToken: string;
}

export const DEFAULT_SETTINGS: DayTasksSettings = {
	dailyNoteFolder: "",
	dailyTaskHeading: "Tasks",
	apiEnabled: false,
	apiPort: 9982,
	apiToken: "",
};
