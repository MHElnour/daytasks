export const TASK_ID_PREFIX = "TSK-";
export const TASK_ID_RANDOM_LENGTH = 8;

const TASK_ID_ALPHABET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const TASK_ID_CHAR_CLASS = "[A-Za-z0-9]";

/** Regex source matching a canonical task id (e.g. `TSK-8cA562sd`). */
export const TASK_ID_SOURCE = `${TASK_ID_PREFIX}${TASK_ID_CHAR_CLASS}{${TASK_ID_RANDOM_LENGTH}}`;
/** Regex source matching a task id embedded in surrounding text. */
export const TASK_ID_INLINE_SOURCE = `${TASK_ID_PREFIX}${TASK_ID_CHAR_CLASS}+`;

const TASK_ID_PATTERN = new RegExp(`^${TASK_ID_SOURCE}$`);

export function isTaskId(value: string): boolean {
	return TASK_ID_PATTERN.test(value);
}

export function generateTaskId(random: () => number = Math.random): string {
	let suffix = "";
	for (let index = 0; index < TASK_ID_RANDOM_LENGTH; index += 1) {
		const alphabetIndex = Math.floor(random() * TASK_ID_ALPHABET.length);
		suffix += TASK_ID_ALPHABET[Math.min(alphabetIndex, TASK_ID_ALPHABET.length - 1)];
	}
	return `${TASK_ID_PREFIX}${suffix}`;
}
