export interface ApiEnvelope<T> {
	success: boolean;
	data?: T;
	error?: string;
}
