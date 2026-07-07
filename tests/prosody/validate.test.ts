// tests/validate.test.ts
import { describe, it, expect } from "vitest";
import { validate } from "../../src/prosody/validate";
import { getForm } from "../../src/prosody/forms";
import {
  KLON8_GOOD,
  KLON8_BROKEN_COUNT,
  KLON8_BROKEN_RHYME,
  YANI_GOOD,
  YANI_BROKEN_COUNT,
  KHLONG_GOOD,
  KHLONG_BROKEN_COUNT,
  KHLONG_BROKEN_RHYME,
  KHLONG_BROKEN_TONE,
} from "../../fixtures/poems";

describe("validate", () => {
  it("classic กลอนแปด passes with no blocking diagnostics", () => {
    const blocking = validate(KLON8_GOOD, getForm("klon8")).filter((d) => d.blocking);
    expect(blocking).toHaveLength(0);
  });
  it("flags a broken syllable count with count-mismatch", () => {
    const ds = validate(KLON8_BROKEN_COUNT, getForm("klon8"));
    expect(ds.some((d) => d.kind === "count-mismatch")).toBe(true);
  });
  it("flags a broken outer rhyme with outer-rhyme-broken", () => {
    const ds = validate(KLON8_BROKEN_RHYME, getForm("klon8"));
    expect(ds.some((d) => d.kind === "outer-rhyme-broken")).toBe(true);
  });

  it("classic กาพย์ยานี passes", () => {
    expect(validate(YANI_GOOD, getForm("yani11")).filter((d) => d.blocking)).toHaveLength(0);
  });
  it("flags a broken syllable count in กาพย์ยานี", () => {
    const ds = validate(YANI_BROKEN_COUNT, getForm("yani11"));
    expect(ds.some((d) => d.kind === "count-mismatch")).toBe(true);
  });

  // KHLONG_GOOD is a real, unaltered โคลงโลกนิติ verse, verified
  // syllable-by-syllable: its counts and all 3 outer-rhyme links are clean.
  it("โคลงสี่ good passes count and outer-rhyme checks", () => {
    const ds = validate(KHLONG_GOOD, getForm("khlong4"));
    expect(ds.filter((d) => d.kind === "count-mismatch")).toHaveLength(0);
    expect(ds.filter((d) => d.kind === "outer-rhyme-broken")).toHaveLength(0);
  });
  it("flags a broken syllable count in โคลงสี่", () => {
    const ds = validate(KHLONG_BROKEN_COUNT, getForm("khlong4"));
    expect(ds.some((d) => d.kind === "count-mismatch")).toBe(true);
  });
  it("flags a broken outer rhyme in โคลงสี่", () => {
    const ds = validate(KHLONG_BROKEN_RHYME, getForm("khlong4"));
    expect(ds.some((d) => d.kind === "outer-rhyme-broken")).toBe(true);
  });
  // forms.ts's tonePositions table for บาทที่ 2-4 was corrected (task-6
  // addendum, see task-6-report.md): the 2nd เอก and the โท for these บาท
  // live in the TAIL wak, not the core, as the old table had it. With the
  // fix, KHLONG_GOOD now cleanly satisfies every position except one
  // documented, isolated real-text anomaly (บาทที่ 4's "หญ้า" — see the
  // fixture comment in fixtures/poems.ts), down from 6 systemic false
  // positives before the fix.
  it("โคลงสี่ good has only the one documented tone-position anomaly", () => {
    const ds = validate(KHLONG_GOOD, getForm("khlong4"));
    const tone = ds.filter((d) => d.kind === "tone-position-violation");
    expect(tone).toHaveLength(1);
    expect(tone[0]!.pos).toEqual({ bot: 0, wak: 6, syl: 1 });
  });
  it("broken เอก-โท is flagged at the reliable บาทที่ 1 position", () => {
    // บาทที่ 1 (wak 0-1) is where the tonePositions encoding has always
    // checked out cleanly against real poetry, so it's the fair place to
    // demonstrate detection: the unaltered poem has zero violations there,
    // the broken variant introduces exactly one.
    const isBaht1 = (d: { kind: string; pos: { wak: number } }) => d.kind === "tone-position-violation" && d.pos.wak <= 1;
    expect(validate(KHLONG_GOOD, getForm("khlong4")).filter(isBaht1)).toHaveLength(0);
    expect(validate(KHLONG_BROKEN_TONE, getForm("khlong4")).filter(isBaht1).length).toBeGreaterThan(0);
    expect(validate(KHLONG_BROKEN_TONE, getForm("khlong4")).some((d) => d.kind === "tone-position-violation")).toBe(true);
  });

  it("inner-rhyme hints are non-blocking", () => {
    for (const d of validate(KLON8_GOOD, getForm("klon8"))) {
      if (d.kind === "inner-rhyme-hint") expect(d.blocking).toBe(false);
    }
  });
});
