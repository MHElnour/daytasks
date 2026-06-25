import { describe, expect, it } from "vitest";
import { resolvesToMarkdownNote } from "../../src/obsidian/vaultNote";

function cache(file: { extension?: string } | null) {
	return { getFirstLinkpathDest: () => file };
}

describe("resolvesToMarkdownNote", () => {
	it("accepts a link that resolves to an existing markdown note", () => {
		expect(resolvesToMarkdownNote(cache({ extension: "md" }), "Projects/Home.md")).toBe(true);
	});

	it("rejects a link that resolves to nothing", () => {
		expect(resolvesToMarkdownNote(cache(null), "Projects/Missing.md")).toBe(false);
	});

	it("rejects a link that resolves to a non-markdown file", () => {
		expect(resolvesToMarkdownNote(cache({ extension: "pdf" }), "doc.pdf")).toBe(false);
	});
});
