import { describe, it, expect } from "vitest";
import * as prosody from "../src/prosody/index";
describe("vendored prosody imports self-contained", () => {
  it("exposes the reusable API", () => {
    for (const k of ["validate", "parseSyllables", "rhymes", "suggest", "FORMS"]) expect(k in prosody).toBe(true);
  });
  it("validates a known-good line without throwing", () => {
    expect(() => prosody.validate("รักเธอหมดใจ", prosody.FORMS.klon8)).not.toThrow();
  });
});
