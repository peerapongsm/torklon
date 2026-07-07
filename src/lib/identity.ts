// Player identity for torklon — a per-browser id + an editable nickname.
// No auth: `id` only needs to be stable enough (across a session) to tell
// "me" apart from other players in a room (matching turnOrder entries,
// recognizing my own lines). Persisted in localStorage so a page refresh
// mid-room doesn't mint a new identity. Keys are namespaced `torklon:*` —
// this Supabase project is shared with other project-365 apps (see
// config/supabase.ts), and this browser origin may host other apps too.
//
// Mirrors the fleet convention already used by project-18-makruk's
// lib/identity.ts, adapted to torklon's `Player { id, nickname }` shape
// (types.ts) rather than makruk's `{ peerId, nickname }`.
import type { Player } from "../types";

const ID_KEY = "torklon:id";
const NICKNAME_KEY = "torklon:nickname";

function getOrCreateId(): string {
  const existing = localStorage.getItem(ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(ID_KEY, id);
  return id;
}

/** This browser's persisted `Player` — mints an id on first call, nickname is "" until set. */
export function getPlayer(): Player {
  return { id: getOrCreateId(), nickname: localStorage.getItem(NICKNAME_KEY) ?? "" };
}

export function setNickname(nickname: string): void {
  localStorage.setItem(NICKNAME_KEY, nickname);
}
