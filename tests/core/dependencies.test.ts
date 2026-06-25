import { describe, expect, it } from "vitest";
import { hasPath, wouldCreateCycle } from "../../src/core/dependencies";

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
