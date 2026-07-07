// tests/partial.test.ts
import { describe, it, expect } from "vitest";
import { validateNewBaht, isAccepted, advisories, bahtVrancRange, vrancPerBaht } from "../src/lib/partial";
import { getForm } from "../src/prosody";
import { KLON8_GOOD, KLON8_BROKEN_COUNT, KLON8_BROKEN_RHYME } from "../fixtures/poems";

const klon8 = getForm("klon8");
const [sadap, rap, rong, song] = KLON8_GOOD.split("\n"); // real สดับ/รับ/รอง/ส่ง from the #47 classic
const [, , brokenRong] = KLON8_BROKEN_RHYME.split("\n"); // same บท, รอง swapped for a non-rhyming word
const [tooShortSadap] = KLON8_BROKEN_COUNT.split("\n"); // same บท, สดับ truncated to 3 syllables

describe("partial-validate one บาท", () => {
  it("maps บาท index → flat วรรค range (klon8: บาท0 = วรรค0-1)", () => {
    expect(bahtVrancRange(klon8, 0)).toEqual({ start: 0, end: 2 });
    expect(bahtVrancRange(klon8, 1)).toEqual({ start: 2, end: 4 });
  });

  it("วรรค/บาท is 2 for all 3 v1 forms", () => {
    expect(vrancPerBaht(getForm("klon8"))).toBe(2);
    expect(vrancPerBaht(getForm("yani11"))).toBe(2);
    expect(vrancPerBaht(getForm("khlong4"))).toBe(2);
  });

  it("a valid first บาท is accepted (count OK, no backward สัมผัส required)", () => {
    const d = validateNewBaht([], `${sadap}\n${rap}`, klon8); // KLON8_GOOD's สดับ+รับ
    expect(isAccepted(d)).toBe(true);
  });

  it("a บาท with wrong syllable count is rejected with a blocking count diagnostic", () => {
    const d = validateNewBaht([], `${tooShortSadap}\n${rap}`, klon8); // KLON8_BROKEN_COUNT's truncated สดับ + valid รับ
    expect(isAccepted(d)).toBe(false);
    expect(d.some((x) => x.kind === "count-mismatch" && x.blocking)).toBe(true);
  });

  it("a บาท that breaks สัมผัสเชื่อม to the previous line is rejected", () => {
    const good = [sadap!, rap!]; // KLON8_GOOD's สดับ+รับ, already accepted into the poem
    const d = validateNewBaht(good, `${brokenRong}\n${song}`, klon8); // KLON8_BROKEN_RHYME's non-rhyming รอง + ส่ง
    expect(d.some((x) => x.kind === "outer-rhyme-broken" && x.blocking)).toBe(true);
    expect(isAccepted(d)).toBe(false);
  });

  it("สัมผัสใน surfaces only as non-blocking advisory", () => {
    // KLON8_GOOD's สดับ ("แม้นใครรักรักมั่งชังชังตอบ") repeats "รัก" and "ชัง"
    // back-to-back — a real, verified-from-source สัมผัสใน case.
    const d = validateNewBaht([], `${sadap}\n${rap}`, klon8);
    for (const x of d) if (x.kind === "inner-rhyme-hint") expect(x.blocking).toBe(false);
    expect(advisories(d).every((x) => !x.blocking)).toBe(true);
  });
});
