import { describe, it, expect } from "vitest";
import { features, parseSyllables, segmentSyllables } from "../../src/prosody/syllable";
import gold from "../../fixtures/syllable-gold.json";

describe("features()", () => {
  it("ใจ = mid-class, live, no coda", () => {
    const s = features("ใจ");
    expect(s.onsetClass).toBe("กลาง");
    expect(s.liveDead).toBe("เป็น");
    expect(s.codaClass).toBe("");
  });
  it("ไป rhymes with ใจ (same rhymeKey)", () => {
    expect(features("ไป").rhymeKey).toBe(features("ใจ").rhymeKey);
  });
  it("นก = คำตาย, coda มาตรากก", () => {
    const s = features("นก");
    expect(s.liveDead).toBe("ตาย");
    expect(s.codaClass).toBe("กก");
  });

  // อำ/ไอ/ใอ/เอา are ALWAYS ครุ (heavy), mirroring the same "always live"
  // exception liveDeadOf already applies for เป็น/ตาย — these vowels have no
  // coda and are phonologically short, so the base coda-or-long rule alone
  // would misclassify them as ลหุ.
  it("ใจ/ไป (ใอ/ไอ vowel) are always ครุ despite no coda and short vowel", () => {
    expect(features("ใจ").weight).toBe("ครุ");
    expect(features("ไป").weight).toBe("ครุ");
  });
  it("นก (real coda, already ครุ) stays ครุ — fix is additive, not a regression", () => {
    expect(features("นก").weight).toBe("ครุ");
  });
  it("short open syllable with no special vowel stays ลหุ", () => {
    expect(features("จะ").weight).toBe("ลหุ");
  });
  it("detects tone mark", () => {
    expect(features("ข่า").toneMark).toBe("ไม้เอก");
  });

  // Regression guard (Task 2 reviewer's note): the "รร" (ro han) vowel
  // template MUST be checked before the bare-ร-ending ("aw") template, or
  // doubled-ร words silently misparse as the Pali/Sanskrit bare-ร ending
  // instead of the short-a + ro-han reading. See scripts/README.md §4.5.
  it("รร (ro han) is checked before the bare-ร ending template", () => {
    expect(features("กรรม").vowel).toBe("a");
    expect(features("สรร").vowel).toBe("a");
    expect(features("ธรรม").vowel).toBe("a");
  });
});

describe("segmentSyllables() gold-set accuracy", () => {
  it("matches PyThaiNLP gold at >= 97% syllable boundaries", () => {
    let ok = 0, total = 0;
    for (const g of gold as { text: string; syllables: string[] }[]) {
      const got = segmentSyllables(g.text);
      total += g.syllables.length;
      // count exact positional syllable matches
      for (let i = 0; i < g.syllables.length; i++) if (got[i] === g.syllables[i]) ok++;
    }
    expect(ok / total).toBeGreaterThanOrEqual(0.97);
  });
});

describe("parseSyllables()", () => {
  it("returns feature-rich syllables for a วรรค", () => {
    const out = parseSyllables("รักเธอหมดใจ");
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((s) => typeof s.rhymeKey === "string")).toBe(true);
  });
});
