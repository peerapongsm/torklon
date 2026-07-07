// src/prosody/syllable.ts — hybrid Thai syllabifier + orthographic feature extraction.
//
// segmentWords()/segmentSyllables(): dictionary maximal-match over the baked
// word-syllables.json (PyThaiNLP thai_words() + subword_tokenize), falling
// back to ruleSplit() for out-of-vocabulary spans.
//
// features(): ports scripts/thai_phonology.py's rule table EXACTLY (see
// scripts/README.md, §1-4) — onset class / coda class / live-dead / vowel
// extraction / rhymeKey. Any drift from the Python version means the rhyme
// index baked at build time (rhyme-index.json) won't match what this
// function computes at runtime for the same syllable text.

import wordSyllablesJson from "./data/word-syllables.json";
import type { LiveDead, OnsetClass, Syllable, ToneMark, Weight } from "./types";

const WORD_SYLLABLES = wordSyllablesJson as Record<string, string[]>;
const WORD_MAP = new Map<string, string[]>(Object.entries(WORD_SYLLABLES));

let MAX_WORD_LEN = 0;
for (const key of WORD_MAP.keys()) if (key.length > MAX_WORD_LEN) MAX_WORD_LEN = key.length;

// --- อักษร 3 หมู่ (onset class) ------------------------------------------
const MID = "กจฎฏดตบปอ";
const HIGH = "ขฃฉฐถผฝศษสห";
// 44 พยัญชนะ (ฤ/ฦ excluded — vowel-like, not classified here).
const ALL_CONS = "กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ";

function onsetClassOf(c: string): OnsetClass {
  if (MID.includes(c)) return "กลาง";
  if (HIGH.includes(c)) return "สูง";
  return "ต่ำ"; // LOW, or unknown falls back to ต่ำ
}

// --- มาตราตัวสะกด (coda class) --------------------------------------------
const CODA_TABLE: Record<string, string> = {
  "กก": "กขคฆ",
  "กด": "จชซฎฏฐดตถทธศษส",
  "กบ": "บปพฟภ",
  "กง": "ง",
  "กน": "นณญรลฬ",
  "กม": "ม",
  "เกย": "ย",
  "เกอว": "ว",
};
const CODA_LOOKUP = new Map<string, string>();
for (const [cls, chars] of Object.entries(CODA_TABLE)) {
  for (const ch of chars) CODA_LOOKUP.set(ch, cls);
}
const SONORANT_CODAS = new Set(["กง", "กน", "กม", "เกย", "เกอว"]);
const STOP_CODAS = new Set(["กก", "กด", "กบ"]);

function codaClassOf(c: string | undefined): string {
  if (!c) return "";
  return CODA_LOOKUP.get(c) ?? "";
}

// --- tone marks ------------------------------------------------------------
const TONE_MARKS = "่้๊๋";
const TONE_NAMES: Record<string, ToneMark> = {
  "่": "ไม้เอก",
  "้": "ไม้โท",
  "๊": "ไม้ตรี",
  "๋": "ไม้จัตวา",
};

function stripTone(text: string): [string, ToneMark] {
  for (const ch of text) {
    if (TONE_MARKS.includes(ch)) {
      const idx = text.indexOf(ch);
      return [text.slice(0, idx) + text.slice(idx + 1), TONE_NAMES[ch] ?? null];
    }
  }
  return [text, null];
}

// --- vowel templates (ported verbatim, same order, from thai_phonology.py's
// VOWEL_TEMPLATES — see scripts/README.md §4 for the worked-out rationale,
// especially the four special cases in §4.5). {onset} = 1-2 consonants
// (greedy, backtracks), {final} = optional single trailing consonant. ---
const K = `[${ALL_CONS}]`;
const O = `(?<onset>${K}{1,2})`;
const F = `(?<final>${K})?`;
const FR = `(?<final>${K})`; // required final

interface VowelTemplate {
  re: RegExp;
  vowel: string;
  isLong: boolean;
  defaultCoda: string;
}

const VOWEL_TEMPLATES: VowelTemplate[] = [
  // leading เ/แ/โ/ใ/ไ forms, longest/most-specific first
  { re: new RegExp(`^ใ${O}$`), vowel: "ai", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^ไ${O}ย?$`), vowel: "ai", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^เ${O}ือะ$`), vowel: "uea", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^เ${O}ือ${F}$`), vowel: "uea", isLong: true, defaultCoda: "" },
  { re: new RegExp(`^เ${O}ียะ$`), vowel: "ia", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^เ${O}ีย${F}$`), vowel: "ia", isLong: true, defaultCoda: "" },
  { re: new RegExp(`^เ${O}อะ$`), vowel: "oe", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^เ${O}ิ${FR}$`), vowel: "oe", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^เ${O}อ${F}$`), vowel: "oe", isLong: true, defaultCoda: "" },
  { re: new RegExp(`^เ${O}าะ$`), vowel: "o-open", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^เ${O}า$`), vowel: "ao", isLong: true, defaultCoda: "" }, // เอา — always live
  { re: new RegExp(`^เ${O}็${FR}$`), vowel: "e", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^เ${O}ะ$`), vowel: "e", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^เ${O}${F}$`), vowel: "e", isLong: true, defaultCoda: "" },
  { re: new RegExp(`^แ${O}ะ$`), vowel: "ae", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^แ${O}็${FR}$`), vowel: "ae", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^แ${O}${F}$`), vowel: "ae", isLong: true, defaultCoda: "" },
  { re: new RegExp(`^โ${O}ะ$`), vowel: "o", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^โ${O}${F}$`), vowel: "o", isLong: true, defaultCoda: "" },
  // no leading vowel char
  { re: new RegExp(`^${O}ัวะ$`), vowel: "ua", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^${O}ัว${F}$`), vowel: "ua", isLong: true, defaultCoda: "" },
  { re: new RegExp(`^${O}ือ${F}$`), vowel: "ue", isLong: true, defaultCoda: "" },
  { re: new RegExp(`^${O}ื${FR}$`), vowel: "ue", isLong: true, defaultCoda: "" },
  { re: new RegExp(`^${O}ึ${F}$`), vowel: "ue", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^${O}ิ${F}$`), vowel: "i", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^${O}ี${F}$`), vowel: "i", isLong: true, defaultCoda: "" },
  { re: new RegExp(`^${O}ุ${F}$`), vowel: "u", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^${O}ู${F}$`), vowel: "u", isLong: true, defaultCoda: "" },
  { re: new RegExp(`^${O}ำ$`), vowel: "am", isLong: true, defaultCoda: "" }, // อำ — always live
  { re: new RegExp(`^${O}า${F}$`), vowel: "aa", isLong: true, defaultCoda: "" },
  // "reduced ออ" spelling: onset + bare อ (+ optional final), no other vowel
  // sign written, is the long "aw"/ɔɔ vowel — NOT a genuine final consonant
  // อ and NOT the implicit-o fallback below. Covers รอ ขอ ตอน อ่อน ยอม and,
  // notably, กลอน itself. Must be tried before the bare no-vowel-sign
  // fallback, which would otherwise misread อ as a coda.
  { re: new RegExp(`^${O}อ${FR}$`), vowel: "aw", isLong: true, defaultCoda: "" },
  { re: new RegExp(`^${O}อ$`), vowel: "aw", isLong: true, defaultCoda: "" },
  { re: new RegExp(`^${O}ะ$`), vowel: "a", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^${O}ั${FR}$`), vowel: "a", isLong: false, defaultCoda: "" },
  // "รร" (ro han): a doubled ร with no vowel sign is a short-a vowel sign in
  // its own right (กรรม, ธรรม, วรรณ) — the first ร is the vowel. If a
  // consonant follows, IT is the coda (กรรม -> ม -> กม). If nothing follows,
  // the second ร itself stands for a น coda (สรร -> short a + กน, as if
  // spelled สัน). MUST be checked before the bare-ร ending template below,
  // or doubled-ร words would wrongly match that template instead.
  { re: new RegExp(`^${O}รร${F}$`), vowel: "a", isLong: false, defaultCoda: "กน" },
  // "reduced ัว" spelling: onset + bare ว + final, no vowel sign written,
  // e.g. สวย ขวด ทรวง. The ว here carries the ua vowel, not a literal coda —
  // must be tried before the generic no-vowel-sign fallback below.
  { re: new RegExp(`^${O}ว${FR}$`), vowel: "ua", isLong: true, defaultCoda: "" },
  // Pali/Sanskrit tatsama bare-ร ending: onset (1-2 consonants) + final ร,
  // with NO vowel sign anywhere in the syllable, is read long "aw" — not the
  // generic implicit-short-o fallback below (correct for other bare CVC
  // syllables like คน, บด, นก). Covers นคร, ละคร, พร, and the
  // กร/จร/คร/ทร/ธร/ชร/นร/ษร family. Must come after "รร" above (so สรร/
  // กรรม/ธรรม keep matching that template first) and before the implicit-o
  // fallback below.
  { re: new RegExp(`^${O}(?<final>ร)$`), vowel: "aw", isLong: true, defaultCoda: "" },
  // bare consonant(s), no vowel sign at all: implicit inherent vowel. CVC
  // with no vowel mark -> implicit short o (แม่ ก กา rule); bare onset alone
  // -> implicit short a.
  { re: new RegExp(`^${O}${FR}$`), vowel: "o", isLong: false, defaultCoda: "" },
  { re: new RegExp(`^${O}$`), vowel: "a", isLong: false, defaultCoda: "" },
];

interface MatchResult {
  onsetClass: OnsetClass;
  onset: string; // leading onset consonant character (see onsetConsonant())
  vowel: string;
  codaClass: string;
  isLong: boolean;
}

function tryMatch(core: string): MatchResult | null {
  for (const t of VOWEL_TEMPLATES) {
    const m = t.re.exec(core);
    if (!m?.groups) continue;
    const onset = m.groups["onset"] ?? "";
    const final = m.groups["final"];
    const cc = final ? codaClassOf(final) : t.defaultCoda;
    const onsetChar = onset[0] ?? "";
    const oc = onsetClassOf(onsetChar);
    return { onsetClass: oc, onset: onsetChar, vowel: t.vowel, codaClass: cc, isLong: t.isLong };
  }
  return null;
}

// การันต์ (ทัณฑฆาต ์) silences the immediately preceding consonant (or,
// ambiguously, a 2-consonant cluster, or a whole CV unit). Try candidates in
// this preference order; analyzeCore keeps the first that yields a
// recognizable vowel/coda pattern. See scripts/README.md §4.2.
function karanCandidates(text: string): string[] {
  if (!text.includes("์")) return [text];
  const candidates: string[] = [];
  const m1 = new RegExp(`${K}์$`).exec(text);
  if (m1) candidates.push(text.slice(0, m1.index));
  const m2 = new RegExp(`${K}{2}์$`).exec(text);
  if (m2) candidates.push(text.slice(0, m2.index));
  const m3 = new RegExp(`${K}[ิุ]์$`).exec(text);
  if (m3) candidates.push(text.slice(0, m3.index));
  return candidates.length ? candidates : [text];
}

function liveDeadOf(vowel: string, isLong: boolean, cc: string): LiveDead {
  if (vowel === "am" || vowel === "ai" || vowel === "ao") return "เป็น"; // อำ ไอ/ใอ เอา — always live
  if (SONORANT_CODAS.has(cc)) return "เป็น";
  if (STOP_CODAS.has(cc)) return "ตาย";
  return isLong ? "เป็น" : "ตาย";
}

interface CoreResult {
  onsetClass: OnsetClass;
  onset: string; // leading onset consonant character (see onsetConsonant())
  vowel: string;
  codaClass: string;
  isLong: boolean;
  liveDead: LiveDead;
  toneMark: ToneMark;
  rhymeKey: string;
}

/** Best-effort feature extraction for one syllable. Returns null when the
 * syllable has no recognizable Thai consonant, or uses a spelling convention
 * this parser doesn't model (see scripts/README.md's "Known limitations"). */
function analyzeCore(syllable: string): CoreResult | null {
  const [afterTone, tone] = stripTone(syllable.trim());
  const text = afterTone.replace(/ๆ/g, "").replace(/ฯ/g, "");
  if (!text || !new RegExp(`[${ALL_CONS}]`).test(text)) return null;

  for (const core of karanCandidates(text)) {
    const result = tryMatch(core);
    if (result) {
      const live = liveDeadOf(result.vowel, result.isLong, result.codaClass);
      return {
        onsetClass: result.onsetClass,
        onset: result.onset,
        vowel: result.vowel,
        codaClass: result.codaClass,
        isLong: result.isLong,
        liveDead: live,
        toneMark: tone,
        rhymeKey: `${result.vowel}/${result.codaClass}`,
      };
    }
  }
  return null;
}

/** Orthographic feature extraction for one syllable's text — onset class,
 * vowel, coda class, live/dead, weight, tone mark, and the tone-independent
 * rhymeKey. Always returns a Syllable; for the small set of spelling
 * conventions this parser doesn't model (silent finals with no การันต์,
 * loanword ร์/ล์, ฤ/ฦ, abbreviations — see scripts/README.md), falls back to
 * a best-effort default rather than throwing. */
export function features(syllableText: string): Syllable {
  const core = analyzeCore(syllableText);
  if (core) {
    const weight: Weight =
      core.vowel === "am" || core.vowel === "ai" || core.vowel === "ao"
        ? "ครุ" // อำ ไอ/ใอ เอา — always heavy, same exception as liveDeadOf
        : core.codaClass !== "" || core.isLong
          ? "ครุ"
          : "ลหุ";
    return {
      text: syllableText,
      onsetClass: core.onsetClass,
      vowel: core.vowel,
      codaClass: core.codaClass,
      liveDead: core.liveDead,
      weight,
      toneMark: core.toneMark,
      rhymeKey: core.rhymeKey,
    };
  }
  const [afterTone, tone] = stripTone(syllableText.trim());
  const firstCons = Array.from(afterTone).find((c) => ALL_CONS.includes(c));
  return {
    text: syllableText,
    onsetClass: firstCons ? onsetClassOf(firstCons) : "ต่ำ",
    vowel: "",
    codaClass: "",
    liveDead: "ตาย",
    weight: "ลหุ",
    toneMark: tone,
    rhymeKey: "/",
  };
}

/** The syllable's onset consonant SOUND (สัมผัสอักษร compares this, not
 * onsetClass — which only buckets into สูง/กลาง/ต่ำ). For a consonant
 * cluster (ควบกล้ำ/อักษรนำ, e.g. กล-, หม-) this is the leading character,
 * matching how onsetClassOf() already classifies the whole cluster by its
 * first letter. Reuses features()'s own matching (analyzeCore/tryMatch)
 * rather than re-parsing vowel templates. */
export function onsetConsonant(syllableText: string): string {
  const core = analyzeCore(syllableText);
  if (core) return core.onset;
  const [afterTone] = stripTone(syllableText.trim());
  const firstCons = Array.from(afterTone).find((c) => ALL_CONS.includes(c));
  return firstCons ?? "";
}

// --- segmentation ------------------------------------------------------

/** Dictionary maximal-match word segmentation over word-syllables.json: at
 * each position, take the longest prefix present as a dict key; if none,
 * advance one char as a singleton OOV "word". */
export function segmentWords(line: string): string[] {
  const result: string[] = [];
  let i = 0;
  const n = line.length;
  while (i < n) {
    let matched = false;
    const maxLen = Math.min(MAX_WORD_LEN, n - i);
    for (let len = maxLen; len >= 1; len--) {
      const candidate = line.slice(i, i + len);
      if (WORD_MAP.has(candidate)) {
        result.push(candidate);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result.push(line[i] as string);
      i += 1;
    }
  }
  return result;
}

/** Deterministic OOV fallback: walk the string taking one best-effort
 * "syllable chunk" at a time — optional leading vowel (เ แ โ ใ ไ), an onset
 * (1-2 consonants, covering ควบกล้ำ/อักษรนำ clusters), an optional vowel
 * sign, tone mark, final consonant, and การันต์. Falls back to a single raw
 * character when nothing recognizable matches. This doesn't need to be as
 * precise as features() — dict hits dominate segmentSyllables() in practice. */
const LEAD_VOWEL = "เแโใไ";
const CLUSTER_SECOND = "รลว";
const VOWEL_AFTER = "ะัาำิีึืุูอ็";
const RULE_SYLLABLE_RE = new RegExp(
  `^[${LEAD_VOWEL}]?` +
    `[${ALL_CONS}](?:[${CLUSTER_SECOND}])?` +
    `[${VOWEL_AFTER}]?` +
    `[${TONE_MARKS}]?` +
    `[${ALL_CONS}]?` +
    `(?:์)?`,
);

export function ruleSplit(word: string): string[] {
  const out: string[] = [];
  let rest = word;
  while (rest.length > 0) {
    const m = RULE_SYLLABLE_RE.exec(rest);
    const len = m && m[0].length > 0 ? m[0].length : 1;
    out.push(rest.slice(0, len));
    rest = rest.slice(len);
  }
  return out;
}

/** words → baked syllables (word-syllables.json); runs of consecutive
 * out-of-vocabulary "words" (from segmentWords' singleton fallback) are
 * grouped and handed to ruleSplit() together, so it gets a real multi-char
 * window to apply orthographic rules to. */
export function segmentSyllables(line: string): string[] {
  const wordsArr = segmentWords(line);
  const out: string[] = [];
  let i = 0;
  while (i < wordsArr.length) {
    const w = wordsArr[i] as string;
    const syls = WORD_MAP.get(w);
    if (syls) {
      out.push(...syls);
      i += 1;
      continue;
    }
    let run = w;
    let j = i + 1;
    while (j < wordsArr.length && !WORD_MAP.has(wordsArr[j] as string)) {
      run += wordsArr[j];
      j += 1;
    }
    out.push(...ruleSplit(run));
    i = j;
  }
  return out;
}

/** Main entry: segment a วรรค into syllables and compute features for each. */
export function parseSyllables(line: string): Syllable[] {
  return segmentSyllables(line).map(features);
}
