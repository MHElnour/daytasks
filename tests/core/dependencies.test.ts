import { describe, expect, it } from "vitest";
import { hasPath, wouldCreateCycle, dependencyCandidates } from "../../src/core/dependencies";
import type { DayTask } from "../../src/core/task";

// a blockedBy b, b blockedBy c  (blockersOf returns who a node is blocked by)
const edges: Record<string, string[]> = { a: ["b"], b: ["c"], c: [] };
const blockersOf = (id: string): string[] => edges[id] ?? [];

describe("hasPath", () => {
 it("finds a direct and transitive path", () => {
  expect(hasPath("a", "b", blockersOf)).toBe(true);
  expect(hasPath("a", "c", blockersOf)).toBe(true);
 });
 it("is false when unreachable", () => {
  expect(hasPath("c", "a", blockersOf)).toBe(false);
 });
 it("terminates on a cyclic graph", () => {
  const cyclic = (id: string): string[] => (id === "x" ? ["y"] : ["x"]);
  expect(hasPath("x", "z", cyclic)).toBe(false);
 });
});

describe("wouldCreateCycle", () => {
 it("rejects a self dependency", () => {
  expect(wouldCreateCycle("a", "a", blockersOf)).toBe(true);
 });
 it("rejects a direct back-edge (c already depends on... a via chain)", () => {
  // a depends on b depends on c; making c blocked by a closes the loop.
  expect(wouldCreateCycle("c", "a", blockersOf)).toBe(true);
 });
 it("allows a safe new edge", () => {
  // a blocked by c: a already reaches c, but c does not reach a → safe.
  expect(wouldCreateCycle("a", "c", blockersOf)).toBe(false);
 });
});

function makeTask(id: string): DayTask {
 return {
  id,
  title: id,
  status: "open",
  scheduledDate: "2026-06-26",
  createdAt: "2026-06-26T00:00:00.000Z",
  updatedAt: "2026-06-26T00:00:00.000Z",
  tags: [],
  contexts: [],
  projects: [],
 };
}

describe("dependencyCandidates", () => {
 // a blockedBy b, b blockedBy c (same edges fixture above)
 const all = [makeTask("a"), makeTask("b"), makeTask("c"), makeTask("d")];

 it("excludes the task itself", () => {
  const result = dependencyCandidates("a", all, blockersOf);
  expect(result.find((t) => t.id === "a")).toBeUndefined();
 });

 it("excludes a task that would close a cycle (c → a would close a→b→c)", () => {
  // a blocked by b, b blocked by c → adding c blocked by a closes a cycle
  // So "a" as a blocker candidate for "c" would create a cycle; "a" must be excluded.
  const result = dependencyCandidates("c", all, blockersOf);
  expect(result.find((t) => t.id === "a")).toBeUndefined();
 });

 it("includes a safe candidate (d has no edges to anything)", () => {
  const result = dependencyCandidates("a", all, blockersOf);
  expect(result.find((t) => t.id === "d")).toBeDefined();
 });

 it("includes the task itself's blockers when they don't close a cycle", () => {
  // b and c are already upstream of a (a is blocked by b, b by c) — they're safe
  // to add as additional blockers since a→b→c→? doesn't come back to a
  const result = dependencyCandidates("a", all, blockersOf);
  expect(result.find((t) => t.id === "b")).toBeDefined();
  expect(result.find((t) => t.id === "c")).toBeDefined();
 });
});
