import { describe, it, expect } from "vitest";
import { canSubmit } from "../src/lib/rate";
describe("canSubmit cooldown", () => {
  it("allows the first submit", () => expect(canSubmit(null, 1000)).toBe(true));
  it("blocks within cooldown", () => expect(canSubmit(1000, 1500, 2000)).toBe(false));
  it("allows after cooldown", () => expect(canSubmit(1000, 3500, 2000)).toBe(true));
});
