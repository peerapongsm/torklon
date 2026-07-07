// tests/export.test.ts
import { describe, it, expect } from "vitest";
import { poemToText } from "../src/ui/export";
import type { Room } from "../src/types";
it("poemToText groups lines into บท", () => {
  const room = { form: "klon8", lines: [{ text: "ก\nข", authorId: "a", index: 0 }, { text: "ค\nง", authorId: "a", index: 1 }] } as unknown as Room;
  expect(poemToText(room)).toContain("ก");
});
