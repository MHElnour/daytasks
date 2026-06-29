import { describe, expect, it } from "vitest";
import { parseTaskInput, splitListPrefix } from "../../src/core/parseTaskInput";

function parse(input: string) {
	return parseTaskInput(input);
}

describe("splitListPrefix", () => {
	it("splits a checkbox prefix from the body", () => {
		expect(splitListPrefix("- [ ] Buy milk")).toEqual({
			prefix: "- [ ] ",
			body: "Buy milk",
		});
	});

	it("splits a bullet prefix", () => {
		expect(splitListPrefix("* Buy milk")).toEqual({ prefix: "* ", body: "Buy milk" });
	});

	it("splits a numbered + quoted prefix", () => {
		expect(splitListPrefix("> 1. Buy milk")).toEqual({
			prefix: "> 1. ",
			body: "Buy milk",
		});
	});

	it("returns an empty prefix for a plain line", () => {
		expect(splitListPrefix("Buy milk")).toEqual({ prefix: "", body: "Buy milk" });
	});
});

describe("parseTaskInput — tags, contexts, projects", () => {
	it("extracts tags and strips them from the title", () => {
		const r = parse("Email the board #work #urgent");
		expect(r.tags).toEqual(["work", "urgent"]);
		expect(r.title).toBe("Email the board");
	});

	it("extracts contexts", () => {
		const r = parse("Call plumber @phone @home");
		expect(r.contexts).toEqual(["phone", "home"]);
		expect(r.title).toBe("Call plumber");
	});

	it("extracts a bare-word project", () => {
		const r = parse("Draft spec +website");
		expect(r.projects).toEqual(["website"]);
		expect(r.title).toBe("Draft spec");
	});

	it("extracts a wikilink project target", () => {
		const r = parse("Draft spec +[[Projects/Website]]");
		expect(r.projects).toEqual(["Projects/Website"]);
		expect(r.title).toBe("Draft spec");
	});

	it("de-duplicates repeated tokens", () => {
		const r = parse("Email #work #work");
		expect(r.tags).toEqual(["work"]);
	});

	it("strips a list prefix before parsing", () => {
		const r = parse("- [ ] Email the board #work");
		expect(r.title).toBe("Email the board");
		expect(r.tags).toEqual(["work"]);
	});
});
