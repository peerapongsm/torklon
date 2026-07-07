// src/lib/partial.ts — strict-core gate: validate ONE new บาท (torklon's
// "turn") against the poem-so-far, using the vendored #47 prosody engine
// (../prosody). This is the only new prosody glue torklon adds: everything
// else (syllabifying, rhyme checks, form ผัง) is #47's, unmodified.
//
// A "บาท" isn't itself a concept #47's FormSpec encodes (it only knows
// บท → วรรค, see types.ts). torklon defines "บาท" as a convention on top:
// klon8/yani11 group their 4 units[0] entries into 2 บาท of 2 วรรค each
// (สดับ+รับ / รอง+ส่ง for klon8; วรรคแรก+วรรคหลัง ×2 for yani11). khlong4's
// units[0] is already 8 flattened [core,tail] pairs for its 4 บาท (see
// forms.ts's extensive comment on why), so it's 4 บาท of 2 วรรค (core+tail)
// each. All 3 v1 forms land on 2 วรรค/บาท, but *how many บาท a บท has* isn't
// derivable from FormSpec alone (it's a torklon-only convention), so it's an
// explicit per-form table rather than something inferred from units[0].length.
import { validate } from "../prosody";
import type { Diagnostic, FormSpec, Pos } from "../prosody";

const BAHT_PER_BOT: Record<FormSpec["id"], number> = { klon8: 2, yani11: 2, khlong4: 4 };

/** วรรค per บาท for a form (torklon convention — see file header). */
export function vrancPerBaht(form: FormSpec): number {
  const wakPerBot = form.units[0]?.length ?? 0;
  return wakPerBot / BAHT_PER_BOT[form.id];
}

/** Flat วรรค [start, end) range covered by บาทที่ `bahtIndex` (0-based). */
export function bahtVrancRange(form: FormSpec, bahtIndex: number): { start: number; end: number } {
  const n = vrancPerBaht(form);
  return { start: bahtIndex * n, end: bahtIndex * n + n };
}

/** บาท per บท for a form, derived from vrancPerBaht (วรรค per บาท) and the
 * form's total วรรค per บท (`units[0].length`) — used to group `room.lines`
 * (one Line per บาท) into บท chunks for display/export. */
export function bahtPerBot(form: FormSpec): number {
  const wakPerBot = form.units[0]?.length ?? 0;
  const n = vrancPerBaht(form);
  return n > 0 ? wakPerBot / n : 0;
}

/** Inverse of bahtVrancRange's indexing: flatten a Diagnostic's Pos to a flat
 * วรรค index. validate.ts always resolves Diagnostic.pos.bot to the absolute
 * บท index within the checked text (not the FormSpec's relative-0/1
 * convention — that's only for the *template*'s outerRhymes/interBotRhyme
 * entries before resolution), so this is a plain bot*wakPerBot + wak. */
function flatVrancIndex(form: FormSpec, pos: Pos): number {
  const wakPerBot = form.units[0]?.length ?? 0;
  return pos.bot * wakPerBot + pos.wak;
}

// Placeholder text used to pad the poem-so-far forward to a complete บท so
// #47's validate() — which only checks whole บท chunks and drops any
// trailing lines that don't fill one (see validate.ts) — actually runs
// checks on the new บาท. It has to be non-blank Thai text (blank lines are
// stripped by validate() before counting, so they wouldn't "complete" the
// chunk at all) but its content is otherwise irrelevant: any diagnostic
// whose rhyme link resolves onto padding is discarded below (see
// `realCount`), since padding can't legitimately confirm or break a rhyme
// that hasn't been written yet.
const PAD_WAK = "กก";

/** Diagnostics from validating `newBaht` (one complete บาท — its own วรรค
 * joined by "\n", per #47's text contract) against `prevLines` (flat วรรค
 * already accepted into the poem, one วรรค per array entry) — filtered down
 * to only the diagnostics that pertain to the new บาท. */
export function validateNewBaht(prevLines: string[], newBaht: string, form: FormSpec): Diagnostic[] {
  const wakPerBot = form.units[0]?.length ?? 0;
  if (wakPerBot === 0) return [];

  const realLines = [...prevLines, ...newBaht.split("\n")];
  const realCount = realLines.length;
  const bahtIndex = Math.floor(prevLines.length / vrancPerBaht(form));
  const range = bahtVrancRange(form, bahtIndex);

  const totalNeeded = Math.ceil(realCount / wakPerBot) * wakPerBot;
  const padded = [...realLines, ...(Array(totalNeeded - realCount).fill(PAD_WAK) as string[])];
  const diags = validate(padded.join("\n"), form);

  const inRange = (idx: number) => idx >= range.start && idx < range.end;
  const rhymeLinks = [...form.outerRhymes, ...(form.interBotRhyme ? [form.interBotRhyme] : [])];

  return diags.filter((d) => {
    if (d.kind !== "outer-rhyme-broken") return inRange(flatVrancIndex(form, d.pos));

    // A rhyme diagnostic is recorded at its `from` position (validate.ts:
    // `pos: { ...rc.from, bot: b }`), but the constraint it failed spans
    // `from` AND `to` — and khlong4 has two links sharing the same `from`
    // (บาทที่1's tail rhymes to both บาทที่2 and บาทที่3 — "one rhyme, two
    // receivers", see forms.ts), so more than one link can match. Only
    // trust a candidate whose `to` side is real (not our padding); if every
    // matching candidate's `to` lands on padding, the diagnostic can't be
    // attributed to real, already-written text and is discarded.
    const candidates = rhymeLinks.filter((rc) => rc.from.wak === d.pos.wak && rc.from.syl === d.pos.syl);
    const realCandidates = candidates.filter((rc) => (d.pos.bot + rc.to.bot) * wakPerBot + rc.to.wak < realCount);
    if (realCandidates.length === 0) return false;
    return realCandidates.some((rc) => {
      const toIdx = (d.pos.bot + rc.to.bot) * wakPerBot + rc.to.wak;
      return inRange(flatVrancIndex(form, d.pos)) || inRange(toIdx);
    });
  });
}

/** No blocking diagnostic → the new บาท is accepted into the shared poem. */
export function isAccepted(diags: Diagnostic[]): boolean {
  return !diags.some((d) => d.blocking);
}

/** Non-blocking hints (currently only สัมผัสใน) surfaced to the author. */
export function advisories(diags: Diagnostic[]): Diagnostic[] {
  return diags.filter((d) => !d.blocking);
}
