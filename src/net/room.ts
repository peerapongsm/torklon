// Network layer for torklon live rooms — thin wrapper over the shared
// Supabase project's `torklon_rooms` table + `torklon_submit_line` /
// `torklon_skip_turn` RPCs (see supabase/schema.sql).
//
// Untestable-by-unit-test by design (real network calls); verified live
// per task-5-brief.md Step 3. Keep this file a thin mapping layer — no
// game logic here (that lives in src/lib/*).
import { supabase } from "../config/supabase";
import type { Room, Player, Line } from "../types";
import type { FormId } from "../prosody";

const TABLE = "torklon_rooms";
const MAX_PLAYERS = 8;

// Raw shape of a torklon_rooms row as returned by PostgREST (snake_case).
interface RoomRow {
  id: string;
  form: string;
  host_id: string;
  status: string;
  lines: unknown;
  turn_order: unknown;
  turn_index: number;
  players: unknown;
  created_at: string;
}

// The one place DB snake_case is mapped to the `Room` type's camelCase.
function mapRow(row: RoomRow): Room {
  return {
    id: row.id,
    form: row.form as FormId,
    hostId: row.host_id,
    status: row.status === "ended" ? "ended" : "open",
    lines: (row.lines as Line[] | null) ?? [],
    turnOrder: (row.turn_order as string[] | null) ?? [],
    turnIndex: row.turn_index,
    players: (row.players as Player[] | null) ?? [],
    createdAt: row.created_at,
  };
}

export async function createRoom(form: FormId, host: Player): Promise<Room> {
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      id,
      form,
      host_id: host.id,
      status: "open",
      lines: [],
      turn_order: [host.id],
      turn_index: 0,
      players: [host],
    })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data as RoomRow);
}

export async function getRoom(roomId: string): Promise<Room | null> {
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", roomId).maybeSingle();
  if (error || !data) return null;
  return mapRow(data as RoomRow);
}

export async function joinRoom(roomId: string, player: Player): Promise<Room | null> {
  const room = await getRoom(roomId);
  if (!room || room.status === "ended") return null;
  if (room.players.some((p) => p.id === player.id)) return room; // idempotent rejoin
  if (room.players.length >= MAX_PLAYERS) return null;

  const players = [...room.players, player];
  const turnOrder = [...room.turnOrder, player.id];

  // Guarded on status='open' so a room ended between the read above and
  // this write can't be silently rejoined. Not a fully atomic guard against
  // a concurrent join racing the player-count check (see task-5 report) —
  // acceptable per brief: worst case is a soft, momentary overshoot of
  // MAX_PLAYERS, not a correctness bug.
  const { data, error } = await supabase
    .from(TABLE)
    .update({ players, turn_order: turnOrder })
    .eq("id", roomId)
    .eq("status", "open")
    .select()
    .single();

  if (error || !data) return null;
  return mapRow(data as RoomRow);
}

export async function submitLine(
  roomId: string,
  expectedTurn: number,
  line: Line,
  nextTurn: number,
): Promise<"ok" | "raced"> {
  const { data, error } = await supabase.rpc("torklon_submit_line", {
    p_room: roomId,
    p_expected: expectedTurn,
    p_line: line,
    p_next: nextTurn,
  });
  if (error) throw error;
  return data ? "ok" : "raced";
}

// `hostId` is accepted for interface parity with endRoom and so callers can
// gate the skip action to the host client-side; the torklon_skip_turn RPC
// itself only checks id/turn_index/status (see schema.sql) — same
// room-id-as-secret trust model as the rest of this schema, not a stricter
// per-action check.
export async function skipTurn(
  roomId: string,
  hostId: string,
  nextTurn: number,
  expectedTurn: number,
): Promise<"ok" | "raced"> {
  void hostId;
  const { data, error } = await supabase.rpc("torklon_skip_turn", {
    p_room: roomId,
    p_expected: expectedTurn,
    p_next: nextTurn,
  });
  if (error) throw error;
  return data ? "ok" : "raced";
}

export async function endRoom(roomId: string, hostId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ status: "ended" })
    .eq("id", roomId)
    .eq("host_id", hostId);
  if (error) throw error;
}

export function subscribeRoom(roomId: string, onChange: (room: Room) => void): () => void {
  const channel = supabase
    .channel(`torklon:${roomId}`)
    .on<RoomRow>(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `id=eq.${roomId}` },
      (payload) => {
        const row = payload.new as Partial<RoomRow>;
        if (typeof row.id === "string") {
          onChange(mapRow(row as RoomRow));
        }
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
