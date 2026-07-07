// Realtime Presence for torklon rooms — who's currently connected.
//
// Uses its own `torklon:<roomId>:presence` channel topic, distinct from
// net/room.ts's subscribeRoom() topic (`torklon:<roomId>:room`). Supabase's
// RealtimeClient.channel() dedupes by topic — calling .channel() with a
// topic that already has an open channel returns that SAME instance rather
// than creating an independent one, so a room screen that needs both live
// DB updates (subscribeRoom) and a presence list (trackPresence) at once
// would crash: the second .on()/.subscribe() call would be registered
// against an already-joining/joined channel. Distinct topics avoid that.
import { supabase } from "../config/supabase";
import type { Player } from "../types";

export function trackPresence(
  roomId: string,
  player: Player,
  onSync: (present: Player[]) => void,
): () => void {
  const channel = supabase.channel(`torklon:${roomId}:presence`, {
    config: { presence: { key: player.id } },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<Player>();
      onSync(dedupePlayers(Object.values(state).flat()));
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track(player);
      }
    });

  return () => {
    void channel.untrack();
    void supabase.removeChannel(channel);
  };
}

// Presence state is keyed by tracking key, but a player reconnecting from a
// second tab/connection can appear more than once under the same key — dedupe
// by player id so onSync always hands back one entry per distinct player.
function dedupePlayers(players: Player[]): Player[] {
  const seen = new Map<string, Player>();
  for (const p of players) {
    seen.set(p.id, p);
  }
  return [...seen.values()];
}
