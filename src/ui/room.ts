// src/ui/room.ts — the live room screen: accumulated poem, turn gate, #47
// live feedback (same engine as the accept/reject gate — no separate rule
// set), presence-driven players list with auto-skip on disconnect, and
// host-only skip/end controls. Plain DOM (createElement/textContent, no
// innerHTML), matching src/ui/lobby.ts's convention — nickname/line text is
// user input and must never be parsed as markup.
//
// State model: `currentRoom`/`presentPlayers` are closure-local mutable
// snapshots updated by subscribeRoom's onChange and trackPresence's onSync;
// the DOM is built once and mutated in place (not rebuilt) on every update so
// the draft <textarea> the player is actively typing into never loses its
// value/focus/caret from an unrelated realtime event landing mid-keystroke.
import { getRoom, subscribeRoom, submitLine, skipTurn, endRoom } from "../net/room";
import { trackPresence } from "../net/presence";
import { currentPlayerId, isCurrentPlayer, nextTurnIndex } from "../lib/turn";
import { evaluateSubmit } from "../lib/submit";
import { validateNewBaht, bahtPerBot } from "../lib/partial";
import { canSubmit } from "../lib/rate";
import { getForm } from "../prosody/forms";
import { poemToText, renderPoemCard } from "./export";
import type { Diagnostic, DiagnosticKind } from "../prosody/types";
import type { Room, Player } from "../types";

const LIVE_FEEDBACK_DEBOUNCE_MS = 300;
const COPY_RESET_MS = 1500;

function statusChip(diags: Diagnostic[], kind: DiagnosticKind, label: string): HTMLSpanElement {
  const bad = diags.some((d) => d.kind === kind && d.blocking);
  const chip = document.createElement("span");
  chip.className = `room-diag-chip ${bad ? "is-bad" : "is-good"}`;
  chip.textContent = `${bad ? "✗" : "✓"} ${label}`;
  return chip;
}

// Renders a Diagnostic[] (either live-typing feedback from validateNewBaht,
// or a rejected evaluateSubmit's diagnostics) into `container`.
//
// IMPORTANT: evaluateSubmit's turn-violation diagnostic is tagged
// `kind: "count-mismatch"` as a placeholder (there's no dedicated
// DiagnosticKind for it — a deliberate, reviewed Task 4 gap; see
// src/lib/submit.ts). It's identified by `rule === "turn-order"`, NOT by
// `kind`, and must be pulled out FIRST so it can never be counted toward the
// จำนวนคำ (count-mismatch) status chip or appear in the prosody blocking list.
function renderDiagnostics(container: HTMLElement, diags: Diagnostic[]): void {
  container.replaceChildren();

  const turnDiags = diags.filter((d) => d.rule === "turn-order");
  const rest = diags.filter((d) => d.rule !== "turn-order");

  if (turnDiags.length > 0) {
    const notice = document.createElement("p");
    notice.className = "room-diag-turn";
    notice.textContent = "ยังไม่ใช่ตาของคุณ";
    container.appendChild(notice);
  }

  if (rest.length === 0) return;

  const chips = document.createElement("div");
  chips.className = "room-diag-chips";
  chips.append(
    statusChip(rest, "count-mismatch", "จำนวนคำ"),
    statusChip(rest, "outer-rhyme-broken", "สัมผัส"),
    statusChip(rest, "tone-position-violation", "เอกโท"),
  );
  container.appendChild(chips);

  const blocking = rest.filter((d) => d.blocking);
  if (blocking.length > 0) {
    const list = document.createElement("ul");
    list.className = "room-diag-list is-blocking";
    for (const d of blocking) {
      const li = document.createElement("li");
      li.textContent = d.message;
      list.appendChild(li);
    }
    container.appendChild(list);
  }

  const hints = rest.filter((d) => !d.blocking);
  if (hints.length > 0) {
    const list = document.createElement("ul");
    list.className = "room-diag-list is-hint";
    for (const d of hints) {
      const li = document.createElement("li");
      li.textContent = `💡 ${d.message}`;
      list.appendChild(li);
    }
    container.appendChild(list);
  }
}

export function renderRoom(room: Room, me: Player): { el: HTMLElement; destroy: () => void } {
  let currentRoom: Room = room;
  // Assume everyone listed is present until trackPresence's first onSync
  // tells us otherwise — avoids nextTurnIndex/auto-skip mis-firing against
  // an empty present-set during the brief window before presence syncs.
  let presentPlayers: Player[] = room.players.slice();
  let lastSubmitMs: number | null = null;
  let destroyed = false;
  let debounceHandle: number | undefined;

  const root = document.createElement("div");
  root.className = "room";

  const header = document.createElement("header");
  header.className = "room-header";
  const turnIndicator = document.createElement("p");
  turnIndicator.className = "room-turn";
  const hostControls = document.createElement("div");
  hostControls.className = "room-host-controls";
  const skipBtn = document.createElement("button");
  skipBtn.type = "button";
  skipBtn.className = "room-host-btn room-skip-btn";
  skipBtn.textContent = "ข้ามตา";
  const endBtn = document.createElement("button");
  endBtn.type = "button";
  endBtn.className = "room-host-btn room-end-btn";
  endBtn.textContent = "จบกลอน";
  hostControls.append(skipBtn, endBtn);
  header.append(turnIndicator, hostControls);

  // Invite control — the room id doubles as the join code (see net/room.ts's
  // "room-id-as-secret" trust model), so sharing the link is just appending
  // `?room=<id>` to the current URL; src/ui/lobby.ts already knows how to
  // read that param and render the join form. Shown for anyone while the
  // game is open (not just the host) since any player may want to bring in
  // more people, and the room isn't capped to 2 (torklon_join_room allows up
  // to 8 — see supabase/schema.sql).
  const inviteSection = document.createElement("div");
  inviteSection.className = "room-invite";
  const inviteLabel = document.createElement("span");
  inviteLabel.className = "room-invite-label";
  inviteLabel.textContent = "ชวนเพื่อนเข้าห้อง";
  const inviteLink = document.createElement("input");
  inviteLink.type = "text";
  inviteLink.className = "room-invite-link";
  inviteLink.readOnly = true;
  inviteLink.value = `${location.origin}${location.pathname}?room=${currentRoom.id}`;
  inviteLink.addEventListener("click", () => inviteLink.select());
  const inviteCopyBtn = document.createElement("button");
  inviteCopyBtn.type = "button";
  inviteCopyBtn.className = "room-host-btn room-invite-btn";
  inviteCopyBtn.textContent = "คัดลอกลิงก์เชิญ";
  inviteSection.append(inviteLabel, inviteLink, inviteCopyBtn);

  const poemPanel = document.createElement("div");
  poemPanel.className = "room-poem";

  // Export controls — available anytime (not gated on `status === "ended"`),
  // since players may want to save/share a snapshot of the poem-so-far
  // mid-game just as much as at the end.
  const exportSection = document.createElement("div");
  exportSection.className = "room-export";
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "room-host-btn";
  copyBtn.textContent = "คัดลอกข้อความ";
  const downloadBtn = document.createElement("button");
  downloadBtn.type = "button";
  downloadBtn.className = "room-host-btn";
  downloadBtn.textContent = "ดาวน์โหลดรูปภาพ";
  exportSection.append(copyBtn, downloadBtn);

  const playersList = document.createElement("ul");
  playersList.className = "room-players";

  const draftSection = document.createElement("div");
  draftSection.className = "room-draft";
  const textarea = document.createElement("textarea");
  textarea.className = "room-textarea";
  textarea.rows = 4;
  textarea.placeholder = "แต่งบาทต่อจากกลอนด้านบน แล้วกด \"ส่ง\"";
  const feedback = document.createElement("div");
  feedback.className = "room-feedback";
  const submitError = document.createElement("p");
  submitError.className = "room-submit-error";
  submitError.hidden = true;
  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "room-submit-btn";
  submitBtn.textContent = "ส่ง";
  draftSection.append(textarea, feedback, submitError, submitBtn);

  root.append(header, inviteSection, poemPanel, exportSection, playersList, draftSection);

  function nicknameFor(playerId: string): string {
    return currentRoom.players.find((p) => p.id === playerId)?.nickname ?? "ผู้เล่น";
  }

  function renderPoem(): void {
    poemPanel.replaceChildren();
    if (currentRoom.lines.length === 0) {
      const empty = document.createElement("p");
      empty.className = "room-poem-empty";
      empty.textContent = "ยังไม่มีใครแต่งบาทแรก เริ่มได้เลย!";
      poemPanel.appendChild(empty);
      return;
    }

    const form = getForm(currentRoom.form);
    const step = Math.max(1, bahtPerBot(form));
    for (let i = 0; i < currentRoom.lines.length; i += step) {
      const group = currentRoom.lines.slice(i, i + step);
      const botEl = document.createElement("div");
      botEl.className = "room-bot";
      const botLabel = document.createElement("p");
      botLabel.className = "room-bot-label";
      botLabel.textContent = `บทที่ ${Math.floor(i / step) + 1}`;
      botEl.appendChild(botLabel);
      for (const line of group) {
        const lineEl = document.createElement("p");
        lineEl.className = "room-line";
        const textSpan = document.createElement("span");
        textSpan.className = "room-line-text";
        textSpan.textContent = line.text.split("\n").join(" / ");
        const authorSpan = document.createElement("span");
        authorSpan.className = "room-line-author";
        authorSpan.textContent = nicknameFor(line.authorId);
        lineEl.append(textSpan, authorSpan);
        botEl.appendChild(lineEl);
      }
      poemPanel.appendChild(botEl);
    }
  }

  function renderTurn(): void {
    if (currentRoom.status === "ended") {
      turnIndicator.textContent = "กลอนจบแล้ว";
      return;
    }
    const currentId = currentPlayerId(currentRoom);
    turnIndicator.textContent = currentId ? `ตาของ ${nicknameFor(currentId)}` : "รอผู้เล่น...";
  }

  function renderPlayers(): void {
    playersList.replaceChildren();
    const presentIds = new Set(presentPlayers.map((p) => p.id));
    for (const p of currentRoom.players) {
      const li = document.createElement("li");
      li.className = "room-player";
      if (presentIds.has(p.id)) li.classList.add("is-present");
      if (p.id === currentRoom.hostId) li.classList.add("is-host");
      if (isCurrentPlayer(currentRoom, p.id)) li.classList.add("is-turn");
      li.textContent = p.nickname;
      playersList.appendChild(li);
    }
  }

  function updateControls(): void {
    const canAct = currentRoom.status === "open" && isCurrentPlayer(currentRoom, me.id);
    textarea.disabled = !canAct;
    submitBtn.disabled = !canAct;

    const isHost = me.id === currentRoom.hostId && currentRoom.status === "open";
    skipBtn.hidden = !isHost;
    endBtn.hidden = !isHost;
  }

  function renderAll(): void {
    renderTurn();
    renderPoem();
    renderPlayers();
    updateControls();
  }

  function updateLiveFeedback(): void {
    const draft = textarea.value;
    if (!draft.trim()) {
      feedback.replaceChildren();
      return;
    }
    const form = getForm(currentRoom.form);
    const diags = validateNewBaht(
      currentRoom.lines.map((l) => l.text),
      draft,
      form,
    );
    renderDiagnostics(feedback, diags);
  }

  textarea.addEventListener("input", () => {
    window.clearTimeout(debounceHandle);
    debounceHandle = window.setTimeout(updateLiveFeedback, LIVE_FEEDBACK_DEBOUNCE_MS);
  });

  function showSubmitError(message: string): void {
    submitError.textContent = message;
    submitError.hidden = false;
  }

  async function handleSubmit(): Promise<void> {
    if (destroyed || currentRoom.status !== "open") return;
    const draft = textarea.value.trim();
    if (!draft) return;

    submitError.hidden = true;

    if (!canSubmit(lastSubmitMs, Date.now())) {
      showSubmitError("กรุณารอสักครู่ก่อนส่งอีกครั้ง");
      return;
    }

    // Fast local check first — evaluateSubmit runs the SAME validateNewBaht
    // engine as the live feedback above, so a rejection here means the
    // submitLine RPC would have rejected it too. Not calling submitLine on a
    // doomed request avoids a wasted (and, since the RPC race-guards on
    // turn_index, potentially misleading) network round-trip.
    const result = evaluateSubmit(currentRoom, me.id, draft);
    renderDiagnostics(feedback, result.diagnostics);
    if (!result.accepted || !result.line) return;

    lastSubmitMs = Date.now();
    submitBtn.disabled = true;
    try {
      const presentIds = new Set(presentPlayers.map((p) => p.id));
      const nextTurn = nextTurnIndex(currentRoom, presentIds);
      const outcome = await submitLine(currentRoom.id, currentRoom.turnIndex, result.line, nextTurn);
      if (outcome === "raced") {
        showSubmitError("มีคนส่งไปก่อนคุณแล้ว กรุณาลองใหม่อีกครั้ง");
        const fresh = await getRoom(currentRoom.id);
        if (!destroyed && fresh) {
          currentRoom = fresh;
          renderAll();
        }
      } else {
        textarea.value = "";
        feedback.replaceChildren();
      }
    } catch {
      showSubmitError("ส่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      if (!destroyed) updateControls();
    }
  }

  submitBtn.addEventListener("click", () => void handleSubmit());

  // A client observing Presence (host or otherwise) auto-skips the current
  // player once they drop from the present set. The torklon_skip_turn RPC
  // race-guards on turn_index (see net/room.ts), so if several present
  // clients all detect the same drop and call this concurrently, only the
  // first lands as "ok" — the rest get "raced" and no-op harmlessly.
  function maybeAutoSkip(): void {
    if (destroyed || currentRoom.status !== "open") return;
    const currentId = currentPlayerId(currentRoom);
    if (!currentId) return;
    if (presentPlayers.some((p) => p.id === currentId)) return;

    const presentIds = new Set(presentPlayers.map((p) => p.id));
    const nextTurn = nextTurnIndex(currentRoom, presentIds);
    skipTurn(currentRoom.id, currentRoom.hostId, nextTurn, currentRoom.turnIndex).catch(() => {
      // Raced or transient network failure — the next onChange/onSync pass
      // (from this client or another) will re-evaluate and retry.
    });
  }

  skipBtn.addEventListener("click", () => {
    if (currentRoom.status !== "open" || me.id !== currentRoom.hostId) return;
    const currentId = currentPlayerId(currentRoom);
    if (!currentId) return;
    const presentIds = new Set(presentPlayers.map((p) => p.id));
    const nextTurn = nextTurnIndex(currentRoom, presentIds);
    skipTurn(currentRoom.id, currentRoom.hostId, nextTurn, currentRoom.turnIndex).catch(() => {
      showSubmitError("ข้ามตาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    });
  });

  endBtn.addEventListener("click", () => {
    if (me.id !== currentRoom.hostId) return;
    endRoom(currentRoom.id, currentRoom.hostId).catch(() => {
      showSubmitError("จบกลอนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    });
  });

  let copyResetHandle: number | undefined;

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(poemToText(currentRoom));
      if (destroyed) return;
      copyBtn.textContent = "คัดลอกแล้ว ✓";
      window.clearTimeout(copyResetHandle);
      copyResetHandle = window.setTimeout(() => {
        if (!destroyed) copyBtn.textContent = "คัดลอกข้อความ";
      }, COPY_RESET_MS);
    } catch {
      showSubmitError("คัดลอกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  }

  copyBtn.addEventListener("click", () => void handleCopy());

  let inviteCopyResetHandle: number | undefined;

  async function handleInviteCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(inviteLink.value);
      if (destroyed) return;
      inviteCopyBtn.textContent = "คัดลอกแล้ว ✓";
      window.clearTimeout(inviteCopyResetHandle);
      inviteCopyResetHandle = window.setTimeout(() => {
        if (!destroyed) inviteCopyBtn.textContent = "คัดลอกลิงก์เชิญ";
      }, COPY_RESET_MS);
    } catch {
      inviteLink.select();
      showSubmitError("คัดลอกลิงก์ไม่สำเร็จ ลองกดที่ช่องลิงก์แล้วคัดลอกเอง");
    }
  }

  inviteCopyBtn.addEventListener("click", () => void handleInviteCopy());

  downloadBtn.addEventListener("click", () => {
    const canvas = renderPoemCard(currentRoom);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `torklon-${currentRoom.id}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  });

  function onRoomChange(updated: Room): void {
    if (destroyed) return;
    currentRoom = updated;
    renderAll();
    maybeAutoSkip();
  }

  function onPresenceSync(present: Player[]): void {
    if (destroyed) return;
    presentPlayers = present;
    renderPlayers();
    maybeAutoSkip();
  }

  renderAll();

  let stopRoom: (() => void) | null = null;
  let stopPresence: (() => void) | null = null;

  // getRoom first for the authoritative (reconnect-safe) snapshot, then wire
  // the live subscriptions — matches the brief's mount ordering. If destroy()
  // is called while this is still in flight, unsubscribe immediately once the
  // channels are created rather than leaving them dangling.
  void (async () => {
    const fresh = await getRoom(room.id);
    if (!destroyed && fresh) {
      currentRoom = fresh;
      presentPlayers = presentPlayers.filter((p) => fresh.players.some((fp) => fp.id === p.id));
      renderAll();
    }

    stopRoom = subscribeRoom(room.id, onRoomChange);
    stopPresence = trackPresence(room.id, me, onPresenceSync);

    if (destroyed) {
      stopRoom();
      stopPresence();
      stopRoom = null;
      stopPresence = null;
    }
  })();

  function destroy(): void {
    destroyed = true;
    window.clearTimeout(debounceHandle);
    window.clearTimeout(copyResetHandle);
    window.clearTimeout(inviteCopyResetHandle);
    stopRoom?.();
    stopPresence?.();
    stopRoom = null;
    stopPresence = null;
  }

  return { el: root, destroy };
}
