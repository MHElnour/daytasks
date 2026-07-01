import { describe, expect, it } from "vitest";
import { stripInlineMarkdown } from "../../src/util/stripMarkdown";

describe("stripInlineMarkdown", () => {
	it("leaves plain text untouched", () => {
		expect(stripInlineMarkdown("Buy milk")).toBe("Buy milk");
	});

	it("returns empty string unchanged", () => {
		expect(stripInlineMarkdown("")).toBe("");
	});

	it("strips bold (** and __) and italic (* and _)", () => {
		expect(stripInlineMarkdown("**bold**")).toBe("bold");
		expect(stripInlineMarkdown("__bold__")).toBe("bold");
		expect(stripInlineMarkdown("*italic*")).toBe("italic");
		expect(stripInlineMarkdown("a _italic_ b")).toBe("a italic b");
	});

	it("strips bold-italic (***)", () => {
		expect(stripInlineMarkdown("***wow***")).toBe("wow");
	});

	it("strips strikethrough, highlight, and inline code", () => {
		expect(stripInlineMarkdown("~~gone~~")).toBe("gone");
		expect(stripInlineMarkdown("==hot==")).toBe("hot");
		expect(stripInlineMarkdown("`code`")).toBe("code");
	});

	it("keeps inline code content literally (no inner stripping)", () => {
		expect(stripInlineMarkdown("`a_b_c`")).toBe("a_b_c");
	});

	it("resolves wikilinks: plain -> base, aliased -> alias", () => {
		expect(stripInlineMarkdown("[[Note]]")).toBe("Note");
		expect(stripInlineMarkdown("[[Note|Alias]]")).toBe("Alias");
		expect(stripInlineMarkdown("[[folder/Note]]")).toBe("Note");
		expect(stripInlineMarkdown("[[folder/Note#sec|My Alias]]")).toBe("My Alias");
		expect(stripInlineMarkdown("[[Note#heading]]")).toBe("Note");
	});

	it("resolves embeds and markdown links to their text", () => {
		expect(stripInlineMarkdown("![[image.png]]")).toBe("image.png");
		expect(stripInlineMarkdown("[label](https://example.com)")).toBe("label");
		expect(stripInlineMarkdown("![alt text](pic.png)")).toBe("alt text");
	});

	it("strips a mix of constructs in one string", () => {
		expect(
			stripInlineMarkdown("**Call** [[John Doe|John]] about ~~old~~ `plan`")
		).toBe("Call John about old plan");
	});

	it("preserves intra-word underscores (snake_case)", () => {
		expect(stripInlineMarkdown("update user_id field")).toBe("update user_id field");
	});

	it("does not treat spaced asterisks as emphasis", () => {
		expect(stripInlineMarkdown("2 * 3 = 6")).toBe("2 * 3 = 6");
	});

	it("leaves unmatched markers alone", () => {
		expect(stripInlineMarkdown("a ** b")).toBe("a ** b");
	});

	it("keeps tags and contexts", () => {
		expect(stripInlineMarkdown("call #home @phone")).toBe("call #home @phone");
	});

	it("unescapes backslash-escaped markdown punctuation", () => {
		expect(stripInlineMarkdown("\\*literal\\*")).toBe("*literal*");
	});

	it("strips line-leading block markers across a multiline description", () => {
		expect(stripInlineMarkdown("# Heading\n> quote\n- item")).toBe("Heading\nquote\nitem");
	});

	it("collapses whitespace runs left by removed syntax", () => {
		expect(stripInlineMarkdown("a  b")).toBe("a b");
	});
});
