// src/ui/lobby.ts — thin DOM lobby: nickname + form picker when creating a
// room, or nickname + room-id when `?room=` is present in the URL (join
// flow). No framework — plain DOM construction via createElement/textContent
// (no innerHTML, so nickname/room-id user input is never parsed as markup),
// matching the other Vite-based fleet apps (project-42/43/44).
//
// DOM contract callers rely on beyond `renderLobby`'s return value:
//   - `.lobby-submit` — the primary action button. main.ts toggles its
//     `disabled` state while the async createRoom/joinRoom call it triggers
//     is in flight.
//   - `showLobbyError(root, message)` — surfaces a joinRoom-returned-null
//     (full/ended/missing room) or network-failure message inline. The
//     actual network call intentionally lives in main.ts (this module only
//     fires the onCreate/onJoin callbacks with validated input), so the
//     error display is exposed as a second export rather than baked into
//     the callback signatures.
import { getPlayer, setNickname } from "../lib/identity";
import { FORMS } from "../prosody";
import type { FormId } from "../prosody";
import type { Player } from "../types";

const FORM_ORDER: FormId[] = ["klon8", "yani11", "khlong4"];

const FORM_HINTS: Record<FormId, string> = {
  klon8: "4 วรรค · วรรคละ 7-9 คำ",
  yani11: "2 บาท · บาทละ 5+6 คำ",
  khlong4: "4 บาท · มีบังคับเอก-โท",
};

function textInput(id: string, opts: { value?: string; placeholder?: string } = {}): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.id = id;
  input.maxLength = 40;
  if (opts.value) input.value = opts.value;
  if (opts.placeholder) input.placeholder = opts.placeholder;
  return input;
}

function field(labelText: string, input: HTMLInputElement): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const label = document.createElement("label");
  label.textContent = labelText;
  label.htmlFor = input.id;
  wrap.append(label, input);
  return wrap;
}

function buildHeader(kicker: string, subtitle: string): HTMLElement {
  const header = document.createElement("header");
  header.className = "lobby-header";

  const kickerEl = document.createElement("p");
  kickerEl.className = "lobby-kicker";
  kickerEl.textContent = kicker;

  const titleEl = document.createElement("h1");
  titleEl.className = "lobby-title";
  const titleText = document.createElement("span");
  titleText.textContent = "ต่อกลอนสด";
  const badge = document.createElement("span");
  badge.className = "live-badge";
  const dot = document.createElement("span");
  dot.className = "live-dot";
  badge.append(dot, document.createTextNode("สด"));
  titleEl.append(titleText, badge);

  const subtitleEl = document.createElement("p");
  subtitleEl.className = "lobby-subtitle";
  subtitleEl.textContent = subtitle;

  header.append(kickerEl, titleEl, subtitleEl);
  return header;
}

function buildErrorSlot(): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = "lobby-error";
  p.hidden = true;
  return p;
}

function showError(errorEl: HTMLParagraphElement, message: string): void {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function buildFormPicker(onSelect: (id: FormId) => void): HTMLDivElement {
  const picker = document.createElement("div");
  picker.className = "form-picker";
  picker.setAttribute("role", "radiogroup");

  for (const id of FORM_ORDER) {
    const tile = document.createElement("label");
    tile.className = "form-tile";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "form";
    radio.value = id;
    radio.checked = id === FORM_ORDER[0];
    radio.addEventListener("change", () => onSelect(id));

    const name = document.createElement("span");
    name.className = "form-tile-name";
    name.textContent = FORMS[id].name;

    const hint = document.createElement("span");
    hint.className = "form-tile-hint";
    hint.textContent = FORM_HINTS[id];

    tile.append(radio, name, hint);
    picker.appendChild(tile);
  }

  return picker;
}

export function renderLobby(
  onCreate: (form: FormId, player: Player) => void,
  onJoin: (roomId: string, player: Player) => void,
): HTMLElement {
  const roomFromUrl = new URLSearchParams(location.search).get("room");

  const root = document.createElement("div");
  root.className = "lobby";

  const card = document.createElement("div");
  card.className = "lobby-card";

  const nicknameInput = textInput("nickname", { placeholder: "เช่น มะลิ", value: getPlayer().nickname });
  const errorEl = buildErrorSlot();
  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "lobby-submit";

  if (roomFromUrl) {
    root.appendChild(buildHeader("ได้รับคำเชิญ", "กรอกชื่อเล่นแล้วกดเข้าร่วม เพื่อนกำลังรอคุณอยู่"));

    const heading = document.createElement("h2");
    heading.className = "lobby-card-heading";
    heading.textContent = "เข้าร่วมห้อง";

    const roomInput = textInput("room-id", { value: roomFromUrl });

    submitBtn.textContent = "เข้าร่วม";
    submitBtn.addEventListener("click", () => {
      errorEl.hidden = true;
      const nickname = nicknameInput.value.trim();
      const roomId = roomInput.value.trim();
      if (!nickname) {
        showError(errorEl, "กรุณาใส่ชื่อเล่นก่อนเข้าร่วมห้อง");
        return;
      }
      if (!roomId) {
        showError(errorEl, "กรุณาใส่รหัสห้อง");
        return;
      }
      setNickname(nickname);
      onJoin(roomId, { ...getPlayer(), nickname });
    });

    card.append(heading, field("รหัสห้อง", roomInput), field("ชื่อเล่นของคุณ", nicknameInput), errorEl, submitBtn);
  } else {
    root.appendChild(buildHeader("ปาร์ตี้กลอนสดออนไลน์", "ชวนเพื่อนผลัดกันต่อกลอนทีละบาท ระบบตรวจฉันทลักษณ์ให้อัตโนมัติ"));

    let selectedForm: FormId = FORM_ORDER[0]!;
    const picker = buildFormPicker((id) => {
      selectedForm = id;
    });

    const pickerLabel = document.createElement("span");
    pickerLabel.className = "field-label";
    pickerLabel.textContent = "เลือกฉันทลักษณ์";
    const pickerField = document.createElement("div");
    pickerField.className = "field";
    pickerField.append(pickerLabel, picker);

    submitBtn.textContent = "สร้างห้อง";
    submitBtn.addEventListener("click", () => {
      errorEl.hidden = true;
      const nickname = nicknameInput.value.trim();
      if (!nickname) {
        showError(errorEl, "กรุณาใส่ชื่อเล่นก่อนสร้างห้อง");
        return;
      }
      setNickname(nickname);
      onCreate(selectedForm, { ...getPlayer(), nickname });
    });

    card.append(field("ชื่อเล่นของคุณ", nicknameInput), pickerField, errorEl, submitBtn);
  }

  root.appendChild(card);
  return root;
}

export function showLobbyError(root: HTMLElement, message: string): void {
  const errorEl = root.querySelector<HTMLParagraphElement>(".lobby-error");
  if (!errorEl) return;
  showError(errorEl, message);
}
