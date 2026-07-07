import { describe, it, expect } from "vitest";
import words from "../../src/prosody/data/word-syllables.json";
import rhymes from "../../src/prosody/data/rhyme-index.json";
import gold from "../../fixtures/syllable-gold.json";

describe("baked data shape", () => {
  it("word map is non-empty word→string[]", () => {
    const keys = Object.keys(words as Record<string, string[]>);
    expect(keys.length).toBeGreaterThan(1000);
    expect(Array.isArray((words as Record<string, string[]>)[keys[0]!])).toBe(true);
  });
  it("rhyme index maps key→word[]", () => {
    const k = Object.keys(rhymes as Record<string, string[]>)[0]!;
    expect(Array.isArray((rhymes as Record<string, string[]>)[k])).toBe(true);
  });
  it("gold set is {text,syllables}[]", () => {
    expect((gold as unknown[]).length).toBeGreaterThan(100);
    const g = (gold as { text: string; syllables: string[] }[])[0]!;
    expect(typeof g.text).toBe("string");
    expect(Array.isArray(g.syllables)).toBe(true);
  });
});
