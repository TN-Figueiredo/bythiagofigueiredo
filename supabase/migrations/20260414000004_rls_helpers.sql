-- RLS helper functions.
--
-- Deviation from sprint-1a plan: these helpers live in `public` schema instead
-- of `auth`. Rationale: the auth schema is owned by supabase_admin, and the
-- migration runner (role `postgres`) lacks CREATE privilege there under the
-- local Supabase CLI. Hosted Supabase has the same ownership model — creating
-- objects in `auth` from user migrations is not a supported pattern. Placing
-- helpers in `public` matches Supabase's documented guidance for user-defined
-- RLS helpers and works identically in local + prod.
--
-- Functions read the JWT role claim from `request.jwt.claims` directly via
-- current_setting, which is what auth.jwt() does under the hood. This works
-- in both the PostgREST request path (where the claim is set per request) and
-- the local test harness (where tests set it via set_config).

create or replace function public.user_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'role',
    'anon'
  )
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select public.user_role() in ('editor','admin','super_admin')
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.user_role() in ('admin','super_admin')
$$;

grant execute on function public.user_role() to anon, authenticated, service_role;
grant execute on function public.is_staff() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
