import { describe, it, expect } from "vitest";
import { evaluateSubmit } from "../src/lib/submit";
import type { Room } from "../src/types";
const room: Room = { id: "r", form: "klon8", hostId: "a", status: "open", lines: [], turnOrder: ["a", "b"], turnIndex: 0, players: [], createdAt: "" };
describe("evaluateSubmit", () => {
  it("rejects a non-current player without validating", () => {
    const r = evaluateSubmit(room, "b", "<any>");
    expect(r.accepted).toBe(false);
    expect(r.diagnostics.some((d) => d.rule.includes("turn"))).toBe(true);
  });
  it("accepts a valid บาท from the current player and builds a Line", () => {
    const r = evaluateSubmit(room, "a", "แม้นใครรักรักมั่งชังชังตอบ\nให้รอบคอบคิดอ่านนะหลานหนา");
    expect(r.accepted).toBe(true);
    expect(r.line?.index).toBe(0);
    expect(r.line?.authorId).toBe("a");
  });
  it("rejects an invalid บาท with #47 diagnostics", () => {
    const r = evaluateSubmit(room, "a", "แม้นใครรัก\nให้รอบคอบคิดอ่านนะหลานหนา");
    expect(r.accepted).toBe(false);
    expect(r.diagnostics.some((d) => d.blocking)).toBe(true);
  });
});
