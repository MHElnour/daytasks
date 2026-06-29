import { describe, expect, it } from "vitest";
import { parseTaskInput, splitListPrefix } from "../../src/core/parseTaskInput";
import { DEFAULT_PRIORITIES } from "../../src/core/status";

// Local noon on Mon 2026-06-29 — avoids UTC-midnight timezone drift.
const TODAY = new Date(2026, 5, 29, 12, 0, 0);

function parse(input: string) {
	return parseTaskInput(input, { priorities: DEFAULT_PRIORITIES, today: TODAY });
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

describe("parseTaskInput — priority", () => {
	it("matches a !marker priority by value", () => {
		const r = parse("Ship release !high");
		expect(r.priority).toBe("high");
		expect(r.title).toBe("Ship release");
	});

	it("does NOT treat a bare priority word as a priority", () => {
		// 'high' without the ! marker is ordinary title text — no collision.
		const r = parse("Ship release high level plan");
		expect(r.priority).toBeUndefined();
		expect(r.title).toBe("Ship release high level plan");
	});

	it("leaves priority undefined when none is present", () => {
		const r = parse("Ship release");
		expect(r.priority).toBeUndefined();
	});
});

describe("parseTaskInput — estimate", () => {
	it("parses hours and minutes", () => {
		expect(parse("Write report 1h30m").estimateMinutes).toBe(90);
	});

	it("parses hours only", () => {
		expect(parse("Write report 2h").estimateMinutes).toBe(120);
	});

	it("parses minutes only", () => {
		expect(parse("Write report 45m").estimateMinutes).toBe(45);
	});

	it("parses a bare number as minutes", () => {
		const r = parse("Write report 90");
		expect(r.estimateMinutes).toBe(90);
		expect(r.title).toBe("Write report");
	});

	it("leaves estimate undefined when absent", () => {
		expect(parse("Write report").estimateMinutes).toBeUndefined();
	});
});

const ISO = /^\d{4}-\d{2}-\d{2}$/;

describe("parseTaskInput — dates", () => {
	it("routes a due: marker to dueDate (ISO date)", () => {
		const r = parse("Submit form due:2026-07-05");
		expect(r.dueDate).toBe("2026-07-05");
		expect(r.scheduledDate).toBeUndefined();
		expect(r.title).toBe("Submit form");
	});

	it("treats by: and deadline: as due markers", () => {
		expect(parse("Submit form by:2026-07-05").dueDate).toBe("2026-07-05");
		expect(parse("Submit form deadline:2026-07-05").dueDate).toBe("2026-07-05");
	});

	it("routes a scheduled: marker to scheduledDate (ISO date)", () => {
		const r = parse("Plan week scheduled:2026-07-02");
		expect(r.scheduledDate).toBe("2026-07-02");
		expect(r.dueDate).toBeUndefined();
		expect(r.title).toBe("Plan week");
	});

	it("routes a bare date phrase to scheduledDate", () => {
		const r = parse("Plan week 2026-07-02");
		expect(r.scheduledDate).toBe("2026-07-02");
		expect(r.dueDate).toBeUndefined();
	});

	it("supports both scheduled and due in one line", () => {
		const r = parse("Plan launch scheduled:2026-07-02 due:2026-07-05");
		expect(r.scheduledDate).toBe("2026-07-02");
		expect(r.dueDate).toBe("2026-07-05");
		expect(r.title).toBe("Plan launch");
	});

	it("resolves a relative bare date with the injected today", () => {
		const r = parse("Call dentist friday");
		expect(r.scheduledDate).toMatch(ISO);
		// forwardDate: the upcoming Friday is after Mon 2026-06-29.
		expect(r.scheduledDate! > "2026-06-29").toBe(true);
		expect(r.dueDate).toBeUndefined();
	});

	it("does NOT treat bare prose 'by' as a due marker (no colon)", () => {
		const r = parse("Email report by friday");
		// 'by' without a colon is not a due marker...
		expect(r.dueDate).toBeUndefined();
		// ...but the bare date 'friday' is still scheduled.
		expect(r.scheduledDate).toMatch(ISO);
	});
});
