/**
 * Maps a label to a stable hue (0-359) so a given tag/context/project always
 * gets the same chip color. Simple FNV-ish hash over code points.
 */
export function chipHue(label: string): number {
	let hash = 2166136261;
	for (let i = 0; i < label.length; i += 1) {
		hash ^= label.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return Math.abs(hash) % 360;
}

/** CSS color expression for a chip label (mid-saturation, theme-neutral). */
export function chipColor(label: string): string {
	return `hsl(${chipHue(label)}, 60%, 50%)`;
}
