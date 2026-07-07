import { isCurrentPlayer } from "./turn";
import { validateNewBaht, isAccepted, advisories } from "./partial";
import { getForm } from "../prosody/forms";
import type { Room, SubmitResult } from "../types";
import type { Diagnostic } from "../prosody/types";

export function evaluateSubmit(room: Room, playerId: string, baht: string): SubmitResult {
  if (!isCurrentPlayer(room, playerId)) {
    const turnViolation: Diagnostic = {
      kind: "count-mismatch",
      pos: { bot: 0, wak: 0, syl: 0 },
      message: "ยังไม่ใช่ตาของคุณ",
      rule: "turn-order",
      blocking: true,
    };
    return {
      accepted: false,
      diagnostics: [turnViolation],
    };
  }

  const form = getForm(room.form);
  const prevLineTexts = room.lines.map((l) => l.text);
  const diags = validateNewBaht(prevLineTexts, baht, form);

  if (isAccepted(diags)) {
    return {
      accepted: true,
      line: {
        text: baht,
        authorId: playerId,
        index: room.lines.length,
      },
      diagnostics: advisories(diags),
    };
  }

  return {
    accepted: false,
    diagnostics: diags,
  };
}
