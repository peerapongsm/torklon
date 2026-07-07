import { describe, it, expect } from "vitest";
import type { Syllable, FormSpec } from "../../src/prosody/types";

describe("prosody types are usable", () => {
  it("constructs a Syllable literal", () => {
    const s: Syllable = { text: "ใจ", onsetClass: "กลาง", vowel: "ai", codaClass: "", liveDead: "เป็น", weight: "ลหุ", toneMark: null, rhymeKey: "ai/" };
    expect(s.text).toBe("ใจ");
  });
  it("constructs a FormSpec literal", () => {
    const f: FormSpec = { id: "klon8", name: "กลอนแปด", units: [[{ syllables: [7, 9] }, { syllables: [7, 9] }]], outerRhymes: [] };
    expect(f.id).toBe("klon8");
  });
});
