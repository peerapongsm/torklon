// Supabase client for torklon live rooms.
//
// This is a SHARED free-tier Supabase project used by three apps (makruk, torklon,
// pixel-canvas) — do not create tables or channels without a per-app prefix.
//
// Both values are public-safe (the anon key is designed to be exposed client-side;
// access control lives in RLS/channel policy, not secrecy of this key). Fall back to
// the real shared-project values so a production build without env vars configured
// still works (GitHub Pages static hosting has no build-time secrets injection here).
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://zmhxqacxmtnwfbpskujz.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptaHhxYWN4bXRud2ZicHNrdWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MTY4NzQsImV4cCI6MjA5NzA5Mjg3NH0.EFy9dLOTcESZKZam-20gY3B82gV7cZvrTjOVZi86VLU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
