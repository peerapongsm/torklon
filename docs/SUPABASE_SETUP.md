# Supabase setup (torklon)

torklon uses the same **shared free-tier Supabase project** as makruk (#21)
and (eventually) pixel-canvas-online (#37). Every torklon object is
namespaced (`torklon_rooms` table, `torklon_submit_line`/`torklon_skip_turn`
RPCs, `torklon_cleanup` cron job, `torklon:<roomId>` Realtime channels) so it
can't collide with the other apps' objects on the same database. Keep that
prefix when touching this schema.

## 1. Run `supabase/schema.sql`

Pick one:

- **SQL editor (simplest):** open the project in the Supabase dashboard →
  SQL Editor → paste the contents of `supabase/schema.sql` → Run. The whole
  file is idempotent, so re-running it after a future edit is safe.
- **CLI migration:** if you prefer versioned migrations, copy
  `supabase/schema.sql` into `supabase/migrations/<timestamp>_torklon_rooms.sql`
  and run `supabase db push` against the linked project.

This creates the `torklon_rooms` table, enables RLS with permissive
`using (true)` policies (see the comment block in `schema.sql` for the
room-id-as-secret trust tradeoff), creates the `torklon_submit_line` /
`torklon_skip_turn` RPCs, adds the table to the `supabase_realtime`
publication, and schedules the `torklon_cleanup` pg_cron job.

## 2. Enable Realtime on `torklon_rooms`

`schema.sql` already does this for you via:

```sql
alter publication supabase_realtime add table torklon_rooms;
```

To confirm it took (or to do it by hand from the dashboard instead):
Database → Replication → find `supabase_realtime` → toggle **on** for the
`torklon_rooms` table. `net/room.ts`'s `subscribeRoom()` depends on this —
without it, `postgres_changes` events for the room never arrive and clients
only see updates on their next manual `getRoom()` refetch.

## 3. Get the project URL + anon key

Dashboard → Project Settings → API:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public key** → `VITE_SUPABASE_ANON_KEY`

Put both in a local `.env` (see `src/config/supabase.ts` for the exact var
names it reads via `import.meta.env`). Both values are public-safe — the
anon key is designed to be shipped client-side; access control lives in the
RLS policies above, not in keeping this key secret.

## 4. Verify pg_cron is available (free tier)

pg_cron is not guaranteed on every Supabase free-tier project. After running
`schema.sql`, confirm the job registered:

```sql
select jobid, jobname, schedule, active from cron.job where jobname = 'torklon_cleanup';
```

If `create extension if not exists pg_cron;` errors (extension not offered
on this project's tier/region) or the job never appears:

- **Fallback:** add a scheduled GitHub Actions workflow (cron trigger, e.g.
  daily) that calls a small script/Edge Function running:
  ```sql
  delete from torklon_rooms where created_at < now() - interval '7 days';
  ```
  via the Supabase REST API (service role key, stored as a repo secret —
  never the anon key) or `supabase.rpc(...)` against a dedicated cleanup
  RPC. This isn't wired up yet; add it only if the pg_cron check above
  fails.
