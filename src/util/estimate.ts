const HOURS_AND_MINUTES = /^(\d+)\s*h\s*(\d+)\s*m?$/i;
const HOURS_ONLY = /^(\d+)\s*h$/i;
const MINUTES_ONLY = /^(\d+)\s*m$/i;
const BARE_NUMBER = /^(\d+)$/;

/**
 * Parses a human estimate ("30", "45m", "2h", "1h30m") into minutes.
 * Returns undefined for empty or unparseable input.
 */
export function parseEstimateMinutes(text: string): number | undefined {
	const value = text.trim();
	if (!value) {
		return undefined;
	}

	const hm = value.match(HOURS_AND_MINUTES);
	if (hm) {
		return Number(hm[1]) * 60 + Number(hm[2]);
	}
	const h = value.match(HOURS_ONLY);
	if (h) {
		return Number(h[1]) * 60;
	}
	const m = value.match(MINUTES_ONLY);
	if (m) {
		return Number(m[1]);
	}
	const bare = value.match(BARE_NUMBER);
	if (bare) {
		return Number(bare[1]);
	}
	return undefined;
}

/** Formats minutes back into a compact label ("30m", "1h", "1h30m"). */
export function formatEstimateMinutes(minutes: number | undefined): string | undefined {
	if (minutes === undefined || minutes <= 0) {
		return undefined;
	}
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (hours > 0 && mins > 0) {
		return `${hours}h${mins}m`;
	}
	if (hours > 0) {
		return `${hours}h`;
	}
	return `${mins}m`;
}
