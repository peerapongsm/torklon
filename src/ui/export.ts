// src/ui/export.ts — export the accumulated poem as plain text (for copy) and
// as a client-rendered PNG "card" (for download) — no server round-trip, no
// paid image API, both derived purely from the same Room snapshot room.ts
// already has in memory.
//
// บท-grouping: reuses `bahtPerBot` (torklon's บาท/บท convention, computed
// from #47's FormSpec + the same บาท-count table validateNewBaht relies on)
// from src/lib/partial.ts — the SAME helper room.ts's renderPoem() uses to
// group `room.lines` into บท, so the export's บท numbering always matches
// what players saw on screen. See task-8 report for why this was hoisted
// into partial.ts (it used to be a private copy in room.ts) rather than
// re-derived here.
import { getForm } from "../prosody";
import { bahtPerBot } from "../lib/partial";
import type { Room } from "../types";

const CREDIT = "ต่อกลอนสด — torklon.peerapongsm.dev";

function nicknameFor(room: Room, playerId: string): string {
  return room.players?.find((p) => p.id === playerId)?.nickname ?? "ผู้เล่น";
}

/** Group `room.lines` (one Line per บาท) into บท-sized chunks, per the form's
 * บาท/บท convention. Mirrors room.ts's renderPoem() grouping exactly. */
function groupIntoBot(room: Room): Room["lines"][] {
  const form = getForm(room.form);
  const step = Math.max(1, bahtPerBot(form));
  const lines = room.lines ?? [];
  const groups: Room["lines"][] = [];
  for (let i = 0; i < lines.length; i += step) {
    groups.push(lines.slice(i, i + step));
  }
  return groups;
}

/** Plain-text rendering of the poem-so-far: บท-grouped lines, each tagged
 * with its author's nickname, a "ร่วมแต่งโดย" credit line (when player info
 * is available), and a torklon watermark — suitable for copy-to-clipboard. */
export function poemToText(room: Room): string {
  const form = getForm(room.form);
  const groups = groupIntoBot(room);

  const sections: string[] = [form.name];

  groups.forEach((group, i) => {
    const botLines = group.map((line) => {
      const text = line.text.split("\n").join(" / ");
      return `${text} — ${nicknameFor(room, line.authorId)}`;
    });
    sections.push([`บทที่ ${i + 1}`, ...botLines].join("\n"));
  });

  if ((room.players?.length ?? 0) > 0) {
    const lines = room.lines ?? [];
    const authorIds = Array.from(new Set(lines.map((l) => l.authorId)));
    if (authorIds.length > 0) {
      sections.push(`ร่วมแต่งโดย: ${authorIds.map((id) => nicknameFor(room, id)).join(", ")}`);
    }
  }

  sections.push(CREDIT);

  return sections.join("\n\n");
}

const CARD_WIDTH = 1080;
const CARD_PADDING = 72;
const CARD_MIN_HEIGHT = 720;
const CARD_MAX_HEIGHT = 2400;

const COLOR_NIGHT = "#0f1d16";
const COLOR_GROVE = "#16261e";
const COLOR_CREAM = "#f2ead6";
const COLOR_CREAM_DIM = "#a9bfab";
const COLOR_GOLD_BRIGHT = "#f3cd85";
const COLOR_JADE_BRIGHT = "#9be0bb";

const FONT_FAMILY = '"IBM Plex Sans Thai", sans-serif';

/** Greedy word-wrap (breaks on spaces only — torklon's poem lines are short
 * enough per-วรรค to fit unwrapped; this is only exercised by the longer
 * "ร่วมแต่งโดย" credit line, whose nicknames are space/comma-separated). */
function wrapWords(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface CardRow {
  text: string;
  size: number; // px
  weight: 400 | 600 | 700;
  color: string;
  gapAfter: number;
}

function rowFont(row: CardRow): string {
  return `${row.weight} ${row.size}px ${FONT_FAMILY}`;
}

// A fixed multiplier of the declared font-size, NOT `measureText`'s
// actualBoundingBoxAscent/Descent — those are per-glyph and were observed to
// occasionally return wildly inflated values (e.g. a real Chromium
// measurement of "บทที่ 1" at 700 24px returning actualBoundingBoxDescent:
// 210, ~9x the sane value seen for the same string/font measured in
// isolation) which silently pushed every row below it far down the card. A
// fixed per-size line height is the standard, deterministic alternative and
// sidesteps that glyph-metric flakiness entirely.
function lineHeightFor(size: number): number {
  return Math.round(size * 1.35);
}

/** Lays out the poem into fixed-size rows (title, per-บท label + lines,
 * credit) using `ctx` only to measure text WIDTH for word-wrapping (stable —
 * unlike the vertical metrics above) — no drawing yet. Returns the rows plus
 * the total content height so the caller can size the canvas BEFORE any
 * actual drawing happens. */
function layoutCard(ctx: CanvasRenderingContext2D, room: Room): { rows: CardRow[]; height: number } {
  const form = getForm(room.form);
  const groups = groupIntoBot(room);
  const maxWidth = CARD_WIDTH - CARD_PADDING * 2;

  const rows: CardRow[] = [{ text: form.name, size: 46, weight: 700, color: COLOR_GOLD_BRIGHT, gapAfter: 30 }];

  if (groups.length === 0) {
    rows.push({ text: "ยังไม่มีใครแต่งบาทแรก", size: 34, weight: 400, color: COLOR_CREAM_DIM, gapAfter: 0 });
  }

  groups.forEach((group, i) => {
    rows.push({ text: `บทที่ ${i + 1}`, size: 24, weight: 700, color: COLOR_JADE_BRIGHT, gapAfter: 10 });
    for (const line of group) {
      ctx.font = rowFont({ text: "", size: 34, weight: 400, color: "", gapAfter: 0 });
      const text = line.text.split("\n").join(" / ");
      for (const wrapped of wrapWords(ctx, text, maxWidth)) {
        rows.push({ text: wrapped, size: 34, weight: 400, color: COLOR_CREAM, gapAfter: 2 });
      }
      rows.push({ text: `— ${nicknameFor(room, line.authorId)}`, size: 22, weight: 400, color: COLOR_CREAM_DIM, gapAfter: 18 });
    }
  });

  rows.push({ text: CREDIT, size: 22, weight: 600, color: COLOR_GOLD_BRIGHT, gapAfter: 0 });

  let height = CARD_PADDING * 2;
  for (const row of rows) height += lineHeightFor(row.size) + row.gapAfter;

  return { rows, height: Math.min(CARD_MAX_HEIGHT, Math.max(CARD_MIN_HEIGHT, Math.round(height))) };
}

/** Draws the poem-so-far onto a fresh canvas: a clean บท-grouped layout with
 * per-line author credits and a small torklon watermark. Two-pass: first
 * measure the content (via a throwaway-sized canvas's context) to size the
 * canvas, THEN set canvas.width/height (which resets the 2D context — hence
 * doing it before any real drawing) and draw for real. */
export function renderPoemCard(room: Room): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_MIN_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const { rows, height } = layoutCard(ctx, room);

  // Resizing the canvas resets the context's state (font/fillStyle/etc.) —
  // fine here since nothing has been drawn yet, only measured.
  canvas.width = CARD_WIDTH;
  canvas.height = height;

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, COLOR_GROVE);
  bg.addColorStop(1, COLOR_NIGHT);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, height);

  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  let y = CARD_PADDING;
  for (const row of rows) {
    ctx.font = rowFont(row);
    ctx.fillStyle = row.color;
    ctx.fillText(row.text, CARD_PADDING, y);
    y += lineHeightFor(row.size) + row.gapAfter;
  }

  return canvas;
}
