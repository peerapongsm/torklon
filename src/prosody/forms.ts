// src/prosody/forms.ts — declarative FormSpec ผัง for the 3 canonical v1 forms:
// กลอนแปด (กลอนสุภาพ), กาพย์ยานี ๑๑, โคลงสี่สุภาพ. Data only — no validation logic
// (that's a later task); this module just encodes the ตำราฉันทลักษณ์ rules as data.
//
// Pos-encoding conventions used below (types.ts's Pos/RhymeConstraint are generic
// containers; these are the project-specific conventions this file adopts):
//
// 1. `syl: -1` is a sentinel meaning "the last syllable of this วรรค/unit,
//    whatever its actual rendered length is" (resolved dynamically by whatever
//    validates against a real poem). Non-negative `syl` values are fixed 0-based
//    positions counted from the start of the unit (used for "3rd syllable",
//    "5th syllable" mid-line rhyme/tone anchors, which are fixed regardless of
//    a variable-length line because they count from the front).
//    Rationale: units allow a syllable-count range (e.g. [7,9] for กลอนแปด), so
//    a fixed positive index can't reliably mean "last" — a sentinel is required.
//
// 2. `Pos.bot` is 0 within a single FormSpec's `units`/`outerRhymes` (there is
//    only one บท template per form, repeated for as many บทs as the poem has).
//    For `interBotRhyme` specifically, `bot` is a *relative offset* rather than
//    an absolute index into `units`: `bot: 0` = the current บท being checked,
//    `bot: 1` = the next บท. This is the encoding suggested by the task brief
//    and is the only way to express a cross-บท link given `units` only holds
//    one บท's shape.

import type { FormId, FormSpec } from "./types";

// SOURCE: standard Thai school-curriculum ฉันทลักษณ์ (ตำราฉันทลักษณ์ทั่วไป, e.g.
// the กลอนสุภาพ/กลอนแปด scheme taught via วรรคสดับ-รับ-รอง-ส่ง with สัมผัสระหว่างบท
// linking ส่ง→รับ of the next บท). วรรค order: 0=สดับ, 1=รับ, 2=รอง, 3=ส่ง.
const klon8: FormSpec = {
  id: "klon8",
  name: "กลอนแปด (กลอนสุภาพ)",
  units: [
    [
      { syllables: [7, 9] }, // วรรคสดับ
      { syllables: [7, 9] }, // วรรครับ
      { syllables: [7, 9] }, // วรรครอง
      { syllables: [7, 9] }, // วรรคส่ง
    ],
  ],
  outerRhymes: [
    // last of สดับ ↔ 3rd syllable of รับ (canonical position; 5th is a variant, not encoded)
    { from: { bot: 0, wak: 0, syl: -1 }, to: { bot: 0, wak: 1, syl: 2 } },
    // last of รับ ↔ last of รอง
    { from: { bot: 0, wak: 1, syl: -1 }, to: { bot: 0, wak: 2, syl: -1 } },
    // last of รอง ↔ 3rd syllable of ส่ง
    { from: { bot: 0, wak: 2, syl: -1 }, to: { bot: 0, wak: 3, syl: 2 } },
  ],
  // สัมผัสระหว่างบท: last of ส่ง (this บท) ↔ last of รับ (next บท)
  interBotRhyme: { from: { bot: 0, wak: 3, syl: -1 }, to: { bot: 1, wak: 1, syl: -1 } },
};

// SOURCE: standard Thai school-curriculum ฉันทลักษณ์ (ตำราฉันทลักษณ์ทั่วไป) — กาพย์ยานี ๑๑,
// 1 บท = 2 บาท, each บาท = 2 วรรค of 5+6 syllables. วรรค order: 0,1 = บาทที่ 1 (5,6);
// 2,3 = บาทที่ 2 (5,6).
const yani11: FormSpec = {
  id: "yani11",
  name: "กาพย์ยานี ๑๑",
  units: [
    [
      { syllables: 5 }, // บาทที่ 1, วรรคแรก
      { syllables: 6 }, // บาทที่ 1, วรรคหลัง
      { syllables: 5 }, // บาทที่ 2, วรรคแรก
      { syllables: 6 }, // บาทที่ 2, วรรคหลัง
    ],
  ],
  outerRhymes: [
    // last of วรรค1 (5) ↔ 3rd syllable of วรรค2 (6)
    { from: { bot: 0, wak: 0, syl: -1 }, to: { bot: 0, wak: 1, syl: 2 } },
    // last of วรรค2 ↔ last of วรรค3 (cross-บาท link within the same บท)
    { from: { bot: 0, wak: 1, syl: -1 }, to: { bot: 0, wak: 2, syl: -1 } },
    // last of วรรค3 (5) ↔ 3rd syllable of วรรค4 (6) — mirrors บาทที่ 1's internal scheme
    { from: { bot: 0, wak: 2, syl: -1 }, to: { bot: 0, wak: 3, syl: 2 } },
  ],
};

// SOURCE: standard Thai school-curriculum ฉันทลักษณ์ (ตำราฉันทลักษณ์ทั่วไป) — โคลงสี่สุภาพ.
// CORRECTED during review (cross-referenced against multiple Thai-language
// pedagogical sources, incl. a direct source quote for the บาท2→บาท4 rhyme
// link, and the ลิลิตพระลอ tail-rhyme example) — the previous encoding
// conflated the mandatory tail with optional คำสร้อย, anchored outerRhymes
// on the wrong (core, not tail) wak, and linked the wrong source บาท for the
// 3rd rhyme. See task-5 report for details.
//
// 4 บาท. Each of บาทที่ 1-3 = 5-syllable core (วรรคหน้า) + a TAIL wak
// (วรรคหลัง): for บาทที่ 1 and 3 the tail is a mandatory 2-syllable unit
// plus an optional 0-2 syllable คำสร้อย appendage (คำสร้อย is only
// traditionally allowed after บาทที่ 1 and 3, never บาทที่ 2), encoded as
// `[2, 4]`; for บาทที่ 2 the tail is a fixed mandatory 2 syllables only (no
// คำสร้อย), encoded as `2`. บาทที่ 4 = 5-syllable core + mandatory
// 4-syllable extension (its own longer non-optional tail, unrelated to
// คำสร้อย). units[0] is flattened to 8 entries: [core, tail] × บาท 1-4.
// wak indices: 0,1 = บาท1 (core, tail); 2,3 = บาท2; 4,5 = บาท3; 6,7 = บาท4.
//
// รสัมผัส (outerRhymes): the rhyme carries from the END OF THE TAIL wak of
// the source บาท (not the core) — verified against ลิลิตพระลอ, where the
// tail's last syllable ("ใด") carries the rhyme, not the core's last
// syllable ("อ้าง"). Links:
//   last-of-บาท1(tail, wak1) ↔ 5th-syllable-of-บาท2(core, wak2)
//   last-of-บาท1(tail, wak1) ↔ 5th-syllable-of-บาท3(core, wak4)   ("one rhyme, two receivers")
//   last-of-บาท2(tail, wak3) ↔ 5th-syllable-of-บาท4(core, wak6)   (corrected: source is
//     บาทที่ 2, not บาทที่ 3 — cf. "คำสุดท้ายของบาทสอง คือ คำที่ ๗ ส่งสัมผัสไปรับกับคำที่ ๕ ของบาทสี่")
//
// เอก/โท position choices (ผังโคลงสี่สุภาพ ตำราแบบเรียนมาตรฐาน).
//
// CORRECTED (task-6 follow-up review) — the previous table for บาทที่ 2-4
// anchored 2 of each บาท's 3 positions entirely inside the 5-syllable CORE
// (a "syllables 2,4 = เอก; syllable 5 = โท" pattern mechanically copied from
// บาทที่ 1's shape), which is wrong: real classical practice puts the บาท's
// SECOND เอก and its โท (where it has one) in the 2-syllable TAIL wak, not
// the core. This was confirmed 3 ways: (1) two independent Thai-language
// sources quoting the same "คำที่" position list — inskru.com's "สูตร 4 /
// 26 / 37 / 26" (เอก) and "5 / 7 / 0 / 57" (โท) mnemonic, and
// mykht.blogspot.com's prose equivalent ("บาทที่ 2 คำที่ 2 และคำที่ 6...
// บาทที่ 4 คำที่ 2 และคำที่ 6"; โท "บาทที่ 2 คำที่ 7 ... บาทที่ 4 คำที่ 5
// และคำที่ 7"), both totaling 7 เอก / 4 โท; and (2) direct re-verification
// against ลิลิตพระลอ's opening บท ("เสียงฦๅเสียงเล่าอ้าง...") and the
// existing KHLONG_GOOD โคลงโลกนิติ fixture — with these corrected positions,
// EVERY previously-false tone-position-violation on both real poems
// disappears (using the SAME literal-mark + dead-syllable-for-เอก check
// already in validate.ts — no substitution-rule change was needed). E.g.
// ลิลิตพระลอ's บาทที่ 2 โท requirement is NOT at the core's 5th syllable
// ("ใคร", unmarked — the old table's false-positive site) but at the tail's
// 2nd syllable ("หล้า", genuinely ไม้โท-marked).
//
// Numbering below is "คำที่ N" = the Nth syllable counting the whole บาท
// (core + tail) front-to-back, 1-based, matching how the sources state it;
// mapped to 0-based (wak, syl):
//   บาทที่ 1 (core=wak0, tail=wak1): คำที่ 4 (core syl 3) = เอก,
//     คำที่ 5 (core syl 4) = โท.                                (1 เอก, 1 โท)
//   บาทที่ 2 (core=wak2, tail=wak3): คำที่ 2 (core syl 1) = เอก,
//     คำที่ 6 (tail syl 0) = เอก, คำที่ 7 (tail syl 1) = โท.      (2 เอก, 1 โท)
//   บาทที่ 3 (core=wak4, tail=wak5): คำที่ 3 (core syl 2) = เอก,
//     คำที่ 7 (tail syl 1) = เอก. No โท requirement in บาทที่ 3 at all — a
//     well-known distinguishing quirk of โคลงสี่สุภาพ.             (2 เอก, 0 โท)
//   บาทที่ 4 (core=wak6, tail=wak7): คำที่ 2 (core syl 1) = เอก,
//     คำที่ 6 (tail syl 0) = เอก, คำที่ 5 (core syl 4) = โท,
//     คำที่ 7 (tail syl 1) = โท.                                  (2 เอก, 2 โท)
//   Total: 1+2+2+2 = 7 เอก, 1+1+0+2 = 4 โท — matches the canonical count.
// บาทที่ 2/3's tail-position syl index (0 or 1) is safe as a fixed index:
// บาทที่ 2's tail (wak3) is a fixed-2 unit (no คำสร้อย); บาทที่ 3's tail
// (wak5) is [2,4] but syl:1 is the end of the MANDATORY portion regardless
// of an appended คำสร้อย (same reasoning as the outerRhymes anchors above).
const khlong4: FormSpec = {
  id: "khlong4",
  name: "โคลงสี่สุภาพ",
  units: [
    [
      { syllables: 5 }, // บาทที่ 1 core (วรรคหน้า)
      { syllables: [2, 4] }, // บาทที่ 1 tail: mandatory 2 + optional คำสร้อย up to 2 more
      { syllables: 5 }, // บาทที่ 2 core (วรรคหน้า)
      { syllables: 2 }, // บาทที่ 2 tail: mandatory 2, no คำสร้อย
      { syllables: 5 }, // บาทที่ 3 core (วรรคหน้า)
      { syllables: [2, 4] }, // บาทที่ 3 tail: mandatory 2 + optional คำสร้อย up to 2 more
      { syllables: 5 }, // บาทที่ 4 core (วรรคหน้า)
      { syllables: 4 }, // บาทที่ 4 extension (mandatory, not คำสร้อย)
    ],
  ],
  outerRhymes: [
    // last of บาทที่ 1's TAIL ↔ 5th syllable of บาทที่ 2's core.
    // `syl: 1` (not the usual `-1` sentinel) because wak 1 is a variable-length
    // [2,4] unit (mandatory 2 + optional คำสร้อย): the rhyme anchors on the END
    // OF THE MANDATORY PORTION ("ใด" in ลิลิตพระลอ's "อันใด พี่เอย"), which is
    // always index 1 whether or not คำสร้อย is appended. `-1` would incorrectly
    // resolve to the คำสร้อย's last syllable ("เอย") whenever it's present — the
    // `-1`-means-"last" sentinel only works when the mandatory and full rendered
    // length coincide, which isn't guaranteed here.
    { from: { bot: 0, wak: 1, syl: 1 }, to: { bot: 0, wak: 2, syl: 4 } },
    // last of บาทที่ 1's TAIL ↔ 5th syllable of บาทที่ 3's core (same syl:1 reasoning as above)
    { from: { bot: 0, wak: 1, syl: 1 }, to: { bot: 0, wak: 4, syl: 4 } },
    // last of บาทที่ 2's TAIL ↔ 5th syllable of บาทที่ 4's core (corrected source บาท).
    // wak 3 is fixed at exactly 2 syllables (no คำสร้อย allowed after บาทที่ 2), so
    // `syl: -1` and `syl: 1` are equivalent here; left as `-1` since there's no
    // variable-length ambiguity to guard against.
    { from: { bot: 0, wak: 3, syl: -1 }, to: { bot: 0, wak: 6, syl: 4 } },
  ],
  tonePositions: [
    // บาทที่ 1 (core = wak 0, tail = wak 1): เอก @ core syl 3 (คำที่ 4),
    // โท @ core syl 4 (คำที่ 5). Unchanged — independently corroborated.
    { pos: { bot: 0, wak: 0, syl: 3 }, require: "เอก" },
    { pos: { bot: 0, wak: 0, syl: 4 }, require: "โท" },
    // บาทที่ 2 (core = wak 2, tail = wak 3): เอก @ core syl 1 (คำที่ 2) and
    // tail syl 0 (คำที่ 6); โท @ tail syl 1 (คำที่ 7). CORRECTED: the โท and
    // the 2nd เอก move out of the core into the tail — see comment above.
    { pos: { bot: 0, wak: 2, syl: 1 }, require: "เอก" },
    { pos: { bot: 0, wak: 3, syl: 0 }, require: "เอก" },
    { pos: { bot: 0, wak: 3, syl: 1 }, require: "โท" },
    // บาทที่ 3 (core = wak 4, tail = wak 5): เอก @ core syl 2 (คำที่ 3) and
    // tail syl 1 (คำที่ 7). No โท position in บาทที่ 3. CORRECTED likewise.
    { pos: { bot: 0, wak: 4, syl: 2 }, require: "เอก" },
    { pos: { bot: 0, wak: 5, syl: 1 }, require: "เอก" },
    // บาทที่ 4 (core = wak 6, tail = wak 7): เอก @ core syl 1 (คำที่ 2) and
    // tail syl 0 (คำที่ 6); โท @ core syl 4 (คำที่ 5) and tail syl 1
    // (คำที่ 7). CORRECTED: the 2nd เอก moves from the core into the tail.
    { pos: { bot: 0, wak: 6, syl: 1 }, require: "เอก" },
    { pos: { bot: 0, wak: 7, syl: 0 }, require: "เอก" },
    { pos: { bot: 0, wak: 6, syl: 4 }, require: "โท" },
    { pos: { bot: 0, wak: 7, syl: 1 }, require: "โท" },
  ],
};

export const FORMS: Record<FormId, FormSpec> = { klon8, yani11, khlong4 };

export function getForm(id: FormId): FormSpec {
  return FORMS[id];
}
