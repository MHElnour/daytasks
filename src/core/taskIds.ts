export const TASK_ID_PREFIX = "TSK-";
export const TASK_ID_RANDOM_LENGTH = 8;

const TASK_ID_ALPHABET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const TASK_ID_PATTERN = /^TSK-[A-Za-z0-9]{8}$/;

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
