-- torklon (ต่อกลอนสด) — live-room schema.
--
-- SHARED FREE-TIER SUPABASE PROJECT: this database also hosts makruk (#21,
-- broadcast-only, no tables) and will eventually host pixel-canvas-online
-- (#37). Every object below is namespaced `torklon_` so it cannot collide
-- with another app's tables, functions, or cron jobs on the same project.
-- Do not add an unprefixed table/function/policy/job to this file.
--
-- Safe to re-run: every statement below is idempotent (CREATE ... IF NOT
-- EXISTS / CREATE OR REPLACE / guarded DO blocks), so re-applying this file
-- after a partial run or a schema tweak won't error on "already exists".

-- ============================================================================
-- Table
-- ============================================================================

create table if not exists torklon_rooms (
  id text primary key,                        -- unguessable, client-generated (crypto) — see RLS note below
  form text not null,                         -- FormId: 'klon8' | 'yani11' | 'khlong4'
  host_id text not null,
  status text not null default 'open',        -- 'open' | 'ended'
  lines jsonb not null default '[]',           -- Line[] — appended atomically via torklon_submit_line
  turn_order jsonb not null default '[]',      -- string[] of player ids, round-robin order
  turn_index int not null default 0,
  players jsonb not null default '[]',         -- Player[] — { id, nickname }
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
--
-- Trust model: room-id-as-secret. `id` is a long, client-generated random
-- token (see net/room.ts) never guessable and never listed anywhere public.
-- Anyone who has the id can read/write the room; there is no auth.uid()
-- because players are anonymous (no login flow in torklon). This is a
-- deliberate simplicity/security tradeoff: acceptable for a party-game room
-- that self-expires after 7 days (pg_cron below) and holds no sensitive
-- data, NOT acceptable if this table ever stores anything private. The
-- permissive `using (true)` policies below only gate "did you already know
-- the id", same as a Google Docs "anyone with the link" share.

alter table torklon_rooms enable row level security;

drop policy if exists torklon_rooms_select on torklon_rooms;
create policy torklon_rooms_select on torklon_rooms
  for select using (true);

drop policy if exists torklon_rooms_insert on torklon_rooms;
create policy torklon_rooms_insert on torklon_rooms
  for insert with check (true);

drop policy if exists torklon_rooms_update on torklon_rooms;
create policy torklon_rooms_update on torklon_rooms
  for update using (true);

-- ============================================================================
-- RPCs — atomic conditional updates (the Q5 race guard)
-- ============================================================================
--
-- A plain client-side "read, mutate, write" would race two players who
-- submit on the same turn: both read turn_index = N, both write, one
-- clobbers the other's line. These RPCs make the check-and-advance a single
-- atomic UPDATE guarded by `turn_index = p_expected`, so only the first
-- writer wins; the loser's UPDATE matches zero rows and `FOUND` is false.

create or replace function torklon_submit_line(
  p_room text,
  p_expected int,
  p_line jsonb,
  p_next int
) returns boolean
language plpgsql
as $$
begin
  update torklon_rooms
    set lines = lines || p_line,
        turn_index = p_next
    where id = p_room
      and turn_index = p_expected
      and status = 'open';
  return found;
end;
$$;

create or replace function torklon_skip_turn(
  p_room text,
  p_expected int,
  p_next int
) returns boolean
language plpgsql
as $$
begin
  update torklon_rooms
    set turn_index = p_next
    where id = p_room
      and turn_index = p_expected
      and status = 'open';
  return found;
end;
$$;

-- torklon_join_room: same atomic-conditional-UPDATE pattern as the two RPCs
-- above, applied to joining. A client-side "read players, append, write
-- players" (the pattern this RPC replaces) has no guard tying the write to
-- the snapshot it read: two concurrent joiners who both read players=[A]
-- each compute and write their own full array ([A,B] and [A,C]); whichever
-- UPDATE lands last wins and silently discards the other join. Folding the
-- append + room-open + not-full checks into one atomic UPDATE closes that
-- window — the loser's UPDATE matches zero rows and `found` is false, so
-- joinRoom can tell the two cases apart instead of both callers believing
-- they joined.
create or replace function torklon_join_room(
  p_room text,
  p_player jsonb
) returns jsonb
language plpgsql
as $$
declare
  updated torklon_rooms;
begin
  update torklon_rooms
    set players = players || p_player,
        turn_order = turn_order || to_jsonb(p_player->>'id')
    where id = p_room
      and status = 'open'
      and jsonb_array_length(players) < 8
    returning * into updated;

  if not found then
    return null;
  end if;
  return to_jsonb(updated);
end;
$$;

-- ============================================================================
-- Realtime — add torklon_rooms to the Supabase Realtime publication
-- ============================================================================
--
-- Lets net/room.ts subscribeRoom() receive postgres_changes on this table.
-- Guarded so re-running this file doesn't error with "relation is already
-- member of publication".

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'torklon_rooms'
  ) then
    alter publication supabase_realtime add table torklon_rooms;
  end if;
end $$;

-- ============================================================================
-- pg_cron — 7-day room retention
-- ============================================================================
--
-- Job name 'torklon_cleanup' is namespaced so it can't collide with a cron
-- job scheduled by another app on this shared project. cron.schedule() with
-- a job name is idempotent (pg_cron re-registers/updates rather than
-- duplicating), so re-running this is safe.
--
-- NOTE: pg_cron availability is not guaranteed on every Supabase free-tier
-- project — verify this section applies cleanly (see docs/SUPABASE_SETUP.md
-- for the check + a GH Actions fallback if it doesn't).

create extension if not exists pg_cron;

select cron.schedule(
  'torklon_cleanup',
  '0 3 * * *',
  $$delete from torklon_rooms where created_at < now() - interval '7 days'$$
);
