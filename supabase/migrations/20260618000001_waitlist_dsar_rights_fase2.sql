-- =============================================================================
-- MIGRATION: waitlist DSAR rights (Fase 2) — data-subject ACCESS + ERASURE for
-- public waitlist signups, so WAITLIST_ACCEPT_PUBLIC_SIGNUPS can be enabled
-- compliantly (LGPD Art. 18).
--
-- Design note: we use a DEDICATED token table instead of reusing
-- `unsubscribe_tokens` (whose PK is token_hash + UNIQUE(site_id,email)). The
-- newsletter unsubscribe token is deterministic over (site:email), so reusing
-- that table would collide on the PK / unique key with the live newsletter flow.
-- A separate table keeps the production newsletter unsubscribe untouched and
-- gives waitlist rights its own namespaced, independently-revocable token.
-- =============================================================================

-- ── Token table: hash → (site, email) for the rights link. ──────────────────
create table if not exists public.waitlist_dsar_tokens (
  token_hash  text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  site_id     uuid not null references public.sites(id) on delete restrict,
  email       public.citext not null,
  created_at  timestamptz not null default now(),
  used_at     timestamptz,
  -- one active token per (site, email); re-requests upsert the same row.
  constraint waitlist_dsar_tokens_site_email_key unique (site_id, email)
);

-- Service-role only. Anonymous/authenticated clients never read this table; the
-- public routes use the service client (post site-scope) and look up by token_hash.
alter table public.waitlist_dsar_tokens enable row level security;
-- No policies created → with RLS on, only service_role (which bypasses RLS) has access.

-- ── Per-email erasure RPC: mirrors the proven phase1/retention anonymization. ─
-- Hashes the email, nullifies network PII + locale, stamps anonymized_at. Keeps
-- consent_text_version + consent_grant_at (LGPD Art. 16 proof-of-consent retention).
-- Idempotent: only touches rows where anonymized_at IS NULL; returns rows affected.
drop function if exists public.waitlist_erase_by_email(uuid, public.citext);
create or replace function public.waitlist_erase_by_email(p_site_id uuid, p_email public.citext)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.waitlist_signups s set
    email        = encode(sha256(s.email::text::bytea), 'hex'),
    ip           = null,
    user_agent   = null,
    locale       = null,
    anonymized_at = now()
  where s.site_id = p_site_id
    and s.email operator(public.=) p_email
    and s.anonymized_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.waitlist_erase_by_email(uuid, public.citext) from public, anon, authenticated;
grant execute on function public.waitlist_erase_by_email(uuid, public.citext) to service_role;
