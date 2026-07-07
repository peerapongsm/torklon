// tests/forms.test.ts
import { describe, it, expect } from "vitest";
import { FORMS, getForm } from "../../src/prosody/forms";

describe("FORMS structure", () => {
  it("has the 3 v1 forms", () => {
    expect(Object.keys(FORMS).sort()).toEqual(["khlong4", "klon8", "yani11"]);
  });
  it("กลอนแปด: 1 บท = 4 วรรค, each 7–9 syllables", () => {
    const f = getForm("klon8");
    expect(f.units[0]).toHaveLength(4);
    expect(f.units[0]![0]!.syllables).toEqual([7, 9]);
  });
  it("กาพย์ยานี ๑๑: วรรค pattern 5+6 per บาท", () => {
    const f = getForm("yani11");
    const counts = f.units[0]!.map((u) => u.syllables);
    expect(counts).toEqual([5, 6, 5, 6]);
  });
  it("โคลงสี่สุภาพ has เอก-โท tone positions", () => {
    const f = getForm("khlong4");
    expect((f.tonePositions ?? []).length).toBeGreaterThan(0);
    const eks = f.tonePositions!.filter((t) => t.require === "เอก").length;
    const tos = f.tonePositions!.filter((t) => t.require === "โท").length;
    expect(eks).toBe(7); expect(tos).toBe(4);
  });
});
