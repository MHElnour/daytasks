import type { ProjectLink } from "../core/task";

/** Returns a detached copy of a string array, preserving `undefined`. */
export function cloneStrings(values?: string[]): string[] | undefined {
	return values ? [...values] : undefined;
}

/** Returns a deep copy of project links, preserving `undefined`. */
export function cloneProjects(projects?: ProjectLink[]): ProjectLink[] | undefined {
	return projects ? projects.map((project) => ({ ...project })) : undefined;
}
