export interface DailyNotePort {
	read(date: string): Promise<string>;
	write(date: string, content: string): Promise<void>;
}
