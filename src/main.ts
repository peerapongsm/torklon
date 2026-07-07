// src/main.ts — entry point: renders the lobby and wires its onCreate/onJoin
// callbacks into the net layer. On success, swaps #app to the real live room
// view (src/ui/room.ts) — this file's job ends at "the network round-trip
// worked, hand off to whatever comes next".
import { renderLobby, showLobbyError } from "./ui/lobby";
import { renderRoom } from "./ui/room";
import { createRoom, joinRoom } from "./net/room";
import type { FormId } from "./prosody";
import type { Player, Room } from "./types";

function mount(el: HTMLElement): void {
  document.querySelector<HTMLDivElement>("#app")?.replaceChildren(el);
}

function setBusy(root: HTMLElement, busy: boolean): void {
  const btn = root.querySelector<HTMLButtonElement>(".lobby-submit");
  if (btn) btn.disabled = busy;
}

function showRoom(room: Room, player: Player): void {
  const { el } = renderRoom(room, player);
  mount(el);
}

async function handleCreate(root: HTMLElement, form: FormId, player: Player): Promise<void> {
  setBusy(root, true);
  try {
    const room = await createRoom(form, player);
    showRoom(room, player);
  } catch {
    showLobbyError(root, "สร้างห้องไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  } finally {
    setBusy(root, false);
  }
}

async function handleJoin(root: HTMLElement, roomId: string, player: Player): Promise<void> {
  setBusy(root, true);
  try {
    const room = await joinRoom(roomId, player);
    if (!room) {
      showLobbyError(root, "เข้าร่วมห้องไม่ได้ — ห้องอาจเต็ม ปิดไปแล้ว หรือไม่มีอยู่จริง");
      return;
    }
    showRoom(room, player);
  } catch {
    showLobbyError(root, "เข้าร่วมห้องไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  } finally {
    setBusy(root, false);
  }
}

function showLobby(): void {
  let root: HTMLElement;
  root = renderLobby(
    (form, player) => void handleCreate(root, form, player),
    (roomId, player) => void handleJoin(root, roomId, player),
  );
  mount(root);
}

showLobby();
