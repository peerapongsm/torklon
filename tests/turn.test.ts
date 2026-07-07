import { describe, it, expect } from "vitest";
import { currentPlayerId, isCurrentPlayer, nextTurnIndex } from "../src/lib/turn";
import type { Room } from "../src/types";

const base: Room = { id: "r", form: "klon8", hostId: "a", status: "open", lines: [], turnOrder: ["a", "b", "c"], turnIndex: 0, players: [], createdAt: "" };
describe("turn", () => {
  it("current player follows turnIndex round-robin", () => {
    expect(currentPlayerId(base)).toBe("a");
    expect(currentPlayerId({ ...base, turnIndex: 1 })).toBe("b");
    expect(currentPlayerId({ ...base, turnIndex: 3 })).toBe("a");
  });
  it("only the current player is current", () => {
    expect(isCurrentPlayer(base, "a")).toBe(true);
    expect(isCurrentPlayer(base, "b")).toBe(false);
  });
  it("nextTurnIndex skips absent players", () => {
    // from a (idx0); b absent → next present is c (idx2)
    expect(nextTurnIndex(base, new Set(["a", "c"]))).toBe(2);
  });
  it("nextTurnIndex wraps", () => {
    expect(nextTurnIndex({ ...base, turnIndex: 2 }, new Set(["a", "b", "c"]))).toBe(3);
  });
});
