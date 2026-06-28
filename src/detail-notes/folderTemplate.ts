/**
 * Expands template variables in a detail-note folder path using a `YYYY-MM-DD`
 * date string (the task's scheduled date):
 *
 *   `{{year}}`  → `YYYY`
 *   `{{month}}` → `MM`
 *   `{{day}}`   → `DD`
 *   `{{date}}`  → `YYYY-MM-DD`
 *
 * Optional surrounding whitespace inside the braces is allowed (`{{ year }}`).
 * Unknown `{{…}}` tokens are left untouched. Slashes are normalized — repeated
 * slashes collapse and leading/trailing slashes are trimmed — so a plain folder
 * (no variables), a trailing-slash template, and a nested template all resolve
 * cleanly. A template with no variables returns the folder unchanged (aside from
 * slash trimming), so existing settings keep working.
 */
export function resolveFolderTemplate(template: string, isoDate: string): string {
	const [year = "", month = "", day = ""] = isoDate.split("-");
	const expanded = template
		.replace(/\{\{\s*year\s*\}\}/g, year)
		.replace(/\{\{\s*month\s*\}\}/g, month)
		.replace(/\{\{\s*day\s*\}\}/g, day)
		.replace(/\{\{\s*date\s*\}\}/g, isoDate);
	// Normalize per segment: trim whitespace around each path part, drop empty
	// parts, and drop `.`/`..` traversal segments — this collapses repeated
	// slashes, strips leading/trailing slashes, tidies spaces left around tokens
	// (`{{ year }} / {{ month }}`), and keeps the folder inside the vault so a
	// `../Outside` setting can't escape it (DATA-1).
	return expanded
		.split("/")
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
		.join("/");
}
