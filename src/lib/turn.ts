import type { Room } from "../types";

export function currentPlayerId(room: Room): string | null {
  if (!room.turnOrder.length) return null;
  const playerId = room.turnOrder[room.turnIndex % room.turnOrder.length];
  return playerId ?? null;
}

export function isCurrentPlayer(room: Room, playerId: string): boolean {
  return currentPlayerId(room) === playerId;
}

export function nextTurnIndex(room: Room, presentIds: ReadonlySet<string>): number {
  const orderLen = room.turnOrder.length;
  if (orderLen === 0) return room.turnIndex + 1;

  // Start from the next position and advance until we find a present player
  for (let i = 0; i < orderLen; i++) {
    const nextIdx = room.turnIndex + 1 + i;
    const playerId = room.turnOrder[nextIdx % orderLen];
    if (playerId && presentIds.has(playerId)) {
      return nextIdx;
    }
  }

  // If nobody is present after a full rotation, return turnIndex + 1
  return room.turnIndex + 1;
}
