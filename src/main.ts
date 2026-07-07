// src/main.ts — entry point: renders the lobby and wires its onCreate/onJoin
// callbacks into the net layer. On success, swaps #app to a minimal
// room-created/joined placeholder (Task 7 replaces this with the real live
// room view — this file's job ends at "the network round-trip worked, hand
// off to whatever comes next").
import { renderLobby, showLobbyError } from "./ui/lobby";
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

function labeledField(labelText: string, input: HTMLInputElement): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const label = document.createElement("span");
  label.className = "field-label";
  label.textContent = labelText;
  wrap.append(label, input);
  return wrap;
}

function readonlyInput(value: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.readOnly = true;
  input.value = value;
  return input;
}

// Placeholder room view — Task 7 replaces this entirely with the real live
// room UI (turn order, poem-so-far, submit box, etc).
function showRoomStub(room: Room, player: Player): void {
  const inviteUrl = `${location.origin}/?room=${room.id}`;

  const root = document.createElement("div");
  root.className = "lobby";

  const header = document.createElement("header");
  header.className = "lobby-header";
  const kicker = document.createElement("p");
  kicker.className = "lobby-kicker";
  kicker.textContent = "ห้องพร้อมแล้ว";
  const title = document.createElement("h1");
  title.className = "lobby-title";
  title.textContent = `สวัสดี ${player.nickname}`;
  const subtitle = document.createElement("p");
  subtitle.className = "lobby-subtitle";
  subtitle.textContent = "ชวนเพื่อนมาต่อกลอนด้วยกันได้เลย (หน้าห้องเต็มรูปแบบจะมาเร็ว ๆ นี้)";
  header.append(kicker, title, subtitle);

  const card = document.createElement("div");
  card.className = "lobby-card";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "lobby-submit";
  copyBtn.textContent = "คัดลอกลิงก์เชิญ";
  copyBtn.addEventListener("click", () => {
    void navigator.clipboard?.writeText(inviteUrl);
    copyBtn.textContent = "คัดลอกแล้ว!";
    window.setTimeout(() => {
      copyBtn.textContent = "คัดลอกลิงก์เชิญ";
    }, 1800);
  });

  card.append(
    labeledField("รหัสห้อง", readonlyInput(room.id)),
    labeledField("ลิงก์เชิญเพื่อน", readonlyInput(inviteUrl)),
    copyBtn,
  );

  root.append(header, card);
  mount(root);
}

async function handleCreate(root: HTMLElement, form: FormId, player: Player): Promise<void> {
  setBusy(root, true);
  try {
    const room = await createRoom(form, player);
    showRoomStub(room, player);
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
    showRoomStub(room, player);
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
