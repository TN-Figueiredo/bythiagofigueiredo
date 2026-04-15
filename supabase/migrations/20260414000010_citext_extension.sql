-- Enable citext for case-insensitive email columns
create extension if not exists citext;

-- Helper: exposes pg_typeof('a'::citext) so tests can assert the extension is live
-- via a single RPC roundtrip (no raw SQL endpoint required).
create or replace function public.pg_typeof_citext_probe()
returns text language sql stable as $$
  select pg_typeof('a'::citext)::text
$$;
