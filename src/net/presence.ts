// Realtime Presence for torklon rooms — who's currently connected.
//
// Uses the same `torklon:<roomId>` channel namespace that net/room.ts's
// subscribeRoom() uses for postgres_changes (each module opens its own
// channel instance on that topic; Supabase multiplexes them independently).
import { supabase } from "../config/supabase";
import type { Player } from "../types";

export function trackPresence(
  roomId: string,
  player: Player,
  onSync: (present: Player[]) => void,
): () => void {
  const channel = supabase.channel(`torklon:${roomId}`, {
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
