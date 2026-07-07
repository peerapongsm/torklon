// src/prosody/types.ts — core prosody vocabulary for Thai verse forms.
export type OnsetClass = "สูง" | "กลาง" | "ต่ำ";
export type Weight = "ครุ" | "ลหุ";
export type LiveDead = "เป็น" | "ตาย";
export type ToneMark = "ไม้เอก" | "ไม้โท" | "ไม้ตรี" | "ไม้จัตวา" | null;

export interface Syllable {
  text: string;
  onsetClass: OnsetClass;
  vowel: string;
  codaClass: string;
  liveDead: LiveDead;
  weight: Weight;
  toneMark: ToneMark;
  rhymeKey: string;
}

export type FormId = "klon8" | "yani11" | "khlong4";

/**
 * A position within a บท (stanza) template. 0-based indices.
 *
 * - `syl: -1` is a sentinel meaning "the last syllable of this วรรค (unit),
 *   whatever its actual resolved length is" — analogous to JS negative
 *   array indexing. Non-negative `syl` values are fixed 0-based positions
 *   counted from the start of the unit (used for anchors like "5th
 *   syllable" that are fixed regardless of the unit's variable length,
 *   since they count from the front).
 * - `bot` is always RELATIVE to whichever บท is currently being validated:
 *   `bot: 0` means "this บท". When validating a full poem, this offset must
 *   be re-applied per-บท across the whole poem (not just checked against
 *   บท index 0). Non-zero `bot` offsets only ever appear in
 *   `interBotRhyme`-style cross-บท references — `outerRhymes` and
 *   `tonePositions` are always intra-บท (so `bot` is always 0 within them),
 *   but that's a consequence of what those fields check, not a different
 *   meaning of the `bot` field itself.
 */
export interface Pos { bot: number; wak: number; syl: number }

/** A rhyme link between two {@link Pos} references within/across บท. */
export interface RhymeConstraint { from: Pos; to: Pos }

export interface FormSpec {
  id: FormId;
  name: string;
  units: ({ syllables: number | [number, number] }[])[]; // บท → วรรค → count (or [min,max])
  outerRhymes: RhymeConstraint[];
  tonePositions?: { pos: Pos; require: "เอก" | "โท" }[];
  interBotRhyme?: RhymeConstraint;
}

export type DiagnosticKind = "count-mismatch" | "outer-rhyme-broken" | "tone-position-violation" | "inner-rhyme-hint";

export interface Diagnostic { kind: DiagnosticKind; pos: Pos; message: string; rule: string; blocking: boolean }
