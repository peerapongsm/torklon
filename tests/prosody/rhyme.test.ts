import { describe, it, expect } from "vitest";
import { rhymes, suggest, alliterates } from "../../src/prosody/rhyme";
import { features } from "../../src/prosody/syllable";

describe("rhyme", () => {
  it("ใจ ~ ไป rhyme; ใจ ≁ ใจร (diff coda) do not", () => {
    expect(rhymes(features("ใจ"), features("ไป"))).toBe(true);
    expect(rhymes(features("ใจ"), features("จันทร์"))).toBe(false);
  });
  it("suggest returns words all sharing the key", () => {
    const key = features("ใจ").rhymeKey;
    const out = suggest(key, 5);
    expect(out.length).toBeGreaterThan(0);
    for (const w of out) {
      // last syllable of each suggestion shares the key
      const last = w; // single-syllable bucket entries
      expect(features(last).rhymeKey).toBe(key);
    }
  });
  it("alliteration by onset", () => {
    expect(alliterates(features("ใจ"), features("จน"))).toBe(true);
  });
});
