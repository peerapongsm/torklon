// src/prosody/rhyme.ts — thin façade over syllable.ts's computed features:
// rhyme comparison/suggestion (สัมผัสสระ) and onset alliteration (สัมผัสอักษร).

import rhymeIndexJson from "./data/rhyme-index.json";
import { onsetConsonant } from "./syllable";
import type { Syllable } from "./types";

const RHYME_INDEX = rhymeIndexJson as Record<string, string[]>;

/** A syllable's rhyme key (vowel + coda class), tone-independent. Named
 * facade over Syllable.rhymeKey for call-site clarity (see #48). */
export function rhymeKey(s: Syllable): string {
  return s.rhymeKey;
}

/** สัมผัสสระ: do two syllables rhyme (same vowel + coda class)? */
export function rhymes(a: Syllable, b: Syllable): boolean {
  return a.rhymeKey === b.rhymeKey;
}

/** Up to n words sharing rhymeKey, from the baked rhyme index. */
export function suggest(key: string, n = 20): string[] {
  return RHYME_INDEX[key]?.slice(0, n) ?? [];
}

/** สัมผัสอักษร: do two syllables alliterate (same onset consonant sound)? */
export function alliterates(a: Syllable, b: Syllable): boolean {
  const oa = onsetConsonant(a.text);
  const ob = onsetConsonant(b.text);
  return oa !== "" && oa === ob;
}
