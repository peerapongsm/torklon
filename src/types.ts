import type { FormId, Diagnostic } from "./prosody";

export interface Player {
  id: string;
  nickname: string;
}

export interface Line {
  text: string;
  authorId: string;
  index: number;
} // one บาท (its วรรค joined by "\n" or " / ")

export type RoomStatus = "open" | "ended";

export interface Room {
  id: string;
  form: FormId;
  hostId: string;
  status: RoomStatus;
  lines: Line[];
  turnOrder: string[];
  turnIndex: number;
  players: Player[];
  createdAt: string;
}

export interface SubmitResult {
  accepted: boolean;
  diagnostics: Diagnostic[];
  line?: Line;
}
