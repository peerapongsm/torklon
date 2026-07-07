// src/prosody/validate.ts — the diagnostics engine: walks a FormSpec's บท
// template against real วรรค text (parsed via Task 3's parseSyllables()) and
// reports every rule violation as a Diagnostic. See types.ts for the Pos/
// RhymeConstraint/FormSpec conventions this module resolves against
// (`syl: -1` = last actual syllable of a wak; `bot` is relative-to-the-
// current-บท for interBotRhyme, always 0 for outerRhymes/tonePositions).

import { rhymes } from "./rhyme";
import { parseSyllables } from "./syllable";
import type { Diagnostic, FormSpec, Pos, Syllable } from "./types";

/** Resolve a Pos to the Syllable it refers to. `botIndex` is the absolute
 * บท currently being checked; `pos.bot` is added as a relative offset (0 for
 * everything except interBotRhyme, where it's 1 = "the next บท"). Returns
 * undefined if the บท/wak/syllable doesn't exist (e.g. text is shorter than
 * the form expects, or a wak parsed to fewer syllables than a fixed index
 * needs) — callers skip the check rather than throwing.
 */
export function resolvePos(botSyllables: Syllable[][][], botIndex: number, pos: Pos): Syllable | undefined {
  const bot = botSyllables[botIndex + pos.bot];
  const wak = bot?.[pos.wak];
  if (!wak || wak.length === 0) return undefined;
  return pos.syl === -1 ? wak[wak.length - 1] : wak[pos.syl];
}

/** `text` = วรรค separated by newlines (UI contract). Blank lines are
 * dropped. The lines are grouped into consecutive chunks of
 * `form.units[0].length` วรรค each — one chunk per บท the poem contains —
 * and each chunk is checked against the same single-บท template (trailing
 * lines that don't fill a whole บท are ignored). */
export function validate(text: string, form: FormSpec): Diagnostic[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const unit = form.units[0] ?? [];
  const wakPerBot = unit.length;
  if (wakPerBot === 0) return [];

  const numBot = Math.floor(lines.length / wakPerBot);
  const botSyllables: Syllable[][][] = [];
  for (let b = 0; b < numBot; b++) {
    const waks: Syllable[][] = [];
    for (let w = 0; w < wakPerBot; w++) {
      waks.push(parseSyllables(lines[b * wakPerBot + w] ?? ""));
    }
    botSyllables.push(waks);
  }

  const diagnostics: Diagnostic[] = [];

  for (let b = 0; b < numBot; b++) {
    // (a) syllable count per วรรค vs unit.syllables (number or [min,max])
    unit.forEach((u, w) => {
      const count = botSyllables[b]?.[w]?.length ?? 0;
      const [min, max] = typeof u.syllables === "number" ? [u.syllables, u.syllables] : u.syllables;
      if (count < min || count > max) {
        const want = min === max ? `${min}` : `${min}-${max}`;
        diagnostics.push({
          kind: "count-mismatch",
          pos: { bot: b, wak: w, syl: -1 },
          message: `บทที่ ${b + 1} วรรคที่ ${w + 1} มี ${count} พยางค์ แต่${form.name}กำหนดไว้ ${want} พยางค์`,
          rule: `${form.name}: จำนวนพยางค์ (วรรค ${w + 1})`,
          blocking: true,
        });
      }
    });

    // (b) outer rhymes (สัมผัสนอก), intra-บท
    for (const rc of form.outerRhymes) {
      const from = resolvePos(botSyllables, b, rc.from);
      const to = resolvePos(botSyllables, b, rc.to);
      if (!from || !to) continue;
      if (!rhymes(from, to)) {
        diagnostics.push({
          kind: "outer-rhyme-broken",
          pos: { ...rc.from, bot: b },
          message: `บทที่ ${b + 1}: คำว่า "${from.text}" (วรรค ${rc.from.wak + 1}) กับ "${to.text}" (วรรค ${rc.to.wak + 1}) ไม่สัมผัสกันตามฉันทลักษณ์`,
          rule: `${form.name}: สัมผัสนอก`,
          blocking: true,
        });
      }
    }

    // (c) tone positions (โคลงสี่สุภาพ only): the syllable must carry the
    // required เอก/โท tone mark. Simplification: a dead syllable (คำตาย,
    // liveDead "ตาย") with no tone mark is accepted as a substitute for an
    // เอก requirement (a well-documented classical convention). No such
    // substitution rule is implemented for โท — only a literal ไม้โท mark
    // satisfies it. See task-6-report.md for what this does and doesn't
    // cover.
    //
    // FOLLOW-UP (task-6 addendum): the original บาทที่ 2-4 false-positive
    // wave reported here was actually a wrong tonePositions TABLE in
    // forms.ts (2 of each บาท's 3 positions were anchored in the wrong wak),
    // not a gap in this check — see forms.ts's tonePositions comment for the
    // correction and its 3-way corroboration. This check itself was and
    // remains a literal-mark check (+ the เอก dead-syllable allowance
    // above); เอกโทษ/โทโทษ (mark-forcing via a nonstandard spelling) turned
    // out NOT to require any change here, since by definition it makes the
    // REQUIRED mark literally appear (it changes which word/spelling is
    // used, not which mark satisfies which requirement) — the literal check
    // already accommodates it. One genuine residual anomaly remains after
    // the forms.ts fix: KHLONG_GOOD's บาทที่ 4 core syllable 2 ("หญ้า")
    // carries ไม้โท at an เอก position, in a real, independently-verified
    // โคลงโลกนิติ verse. This wasn't resolved — no substitution rule found
    // in research covers "opposite mark satisfies the requirement", and
    // adding one on the strength of a single data point risked masking
    // genuine violations elsewhere, so it's left as a documented open edge
    // case rather than papered over.
    for (const tp of form.tonePositions ?? []) {
      const s = resolvePos(botSyllables, b, tp.pos);
      if (!s) continue;
      const literalOk = tp.require === "เอก" ? s.toneMark === "ไม้เอก" : s.toneMark === "ไม้โท";
      const deadSyllableOk = tp.require === "เอก" && s.toneMark === null && s.liveDead === "ตาย";
      if (!literalOk && !deadSyllableOk) {
        diagnostics.push({
          kind: "tone-position-violation",
          pos: { ...tp.pos, bot: b },
          message: `บทที่ ${b + 1}: คำว่า "${s.text}" (วรรค ${tp.pos.wak + 1}) ต้องเป็นเสียง${tp.require} แต่ไม่ใช่`,
          rule: `${form.name}: ตำแหน่งวรรณยุกต์${tp.require}`,
          blocking: true,
        });
      }
    }

    // (e) inner-rhyme hint (ไม่บังคับ): two syllables sharing a rhymeKey
    // within the same วรรค is a nice-to-have euphony bonus, not a rule.
    // Report at most one hint per วรรค.
    unit.forEach((_, w) => {
      const syl = botSyllables[b]?.[w] ?? [];
      findPair: for (let i = 0; i < syl.length; i++) {
        for (let j = i + 1; j < syl.length; j++) {
          const a = syl[i]!;
          const c = syl[j]!;
          if (a.rhymeKey && a.rhymeKey !== "/" && a.rhymeKey === c.rhymeKey) {
            diagnostics.push({
              kind: "inner-rhyme-hint",
              pos: { bot: b, wak: w, syl: i },
              message: `บทที่ ${b + 1} วรรคที่ ${w + 1}: คำว่า "${a.text}" กับ "${c.text}" สัมผัสกัน (สัมผัสใน ไม่บังคับ)`,
              rule: `${form.name}: สัมผัสใน (ไม่บังคับ)`,
              blocking: false,
            });
            break findPair;
          }
        }
      }
    });
  }

  // (d) interBotRhyme (กลอนแปด only): สัมผัสระหว่างบท, checked between each
  // adjacent pair of บท. Only exercised when text contains more than one บท.
  if (form.interBotRhyme) {
    for (let b = 0; b < numBot - 1; b++) {
      const from = resolvePos(botSyllables, b, form.interBotRhyme.from);
      const to = resolvePos(botSyllables, b, form.interBotRhyme.to);
      if (!from || !to) continue;
      if (!rhymes(from, to)) {
        diagnostics.push({
          kind: "outer-rhyme-broken",
          pos: { ...form.interBotRhyme.from, bot: b },
          message: `สัมผัสระหว่างบทที่ ${b + 1} กับบทที่ ${b + 2}: คำว่า "${from.text}" กับ "${to.text}" ไม่สัมผัสกัน`,
          rule: `${form.name}: สัมผัสระหว่างบท`,
          blocking: true,
        });
      }
    }
  }

  return diagnostics;
}
