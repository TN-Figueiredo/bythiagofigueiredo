-- Epic 4 hardening (round-4 consolidated): token hashing, contact/newsletter
-- rate-limit RPCs (inet-typed), advisory cron locks (64-bit hash), email
-- dedupe indexes, locale column on newsletter_subscriptions, state-machine
-- documentation, and performance indexes for cron sync.
--
-- This migration is the FINAL state — it supersedes the early split between
-- 000014 + 000015 that existed only in staging before first deploy.

-- ─────────────────────────────────────────────────────────────────────────────
-- C1: Hash newsletter confirmation_token at rest
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.newsletter_subscriptions
  add column if not exists confirmation_token_hash text;

-- Backfill: any existing plaintext token gets hashed with sha256 hex (lowercase).
update public.newsletter_subscriptions
  set confirmation_token_hash = encode(sha256(confirmation_token::bytea), 'hex')
  where confirmation_token is not null
    and confirmation_token_hash is null;

-- H3: drop the volatile partial index (now() in predicate is nondeterministic).
drop index if exists public.newsletter_pending_token;

-- Drop the plaintext column now that hash is backfilled.
alter table public.newsletter_subscriptions drop column if exists confirmation_token;

-- Recreate the unique constraint on the hash (time predicate removed — RPC enforces expiry).
create unique index if not exists newsletter_pending_token_hash
  on public.newsletter_subscriptions (confirmation_token_hash)
  where status = 'pending_confirmation' and confirmation_token_hash is not null;

-- Swap the RPC to lookup-by-hash. Caller passes the hash (app hashes the raw token).
-- Drop first — Postgres rejects CREATE OR REPLACE when input parameter name changes.
drop function if exists public.confirm_newsletter_subscription(text);
create or replace function public.confirm_newsletter_subscription(p_token_hash text) returns json language plpgsql security definer as $fn$
declare v_sub record;
begin
  select id, site_id, email, status, confirmation_expires_at into v_sub
  from public.newsletter_subscriptions
  where confirmation_token_hash = p_token_hash
  for update;

  if v_sub.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_sub.status = 'confirmed' then
    return json_build_object('ok', true, 'email', v_sub.email, 'site_id', v_sub.site_id, 'already', true);
  end if;
  if v_sub.confirmation_expires_at is null or v_sub.confirmation_expires_at <= now() then
    return json_build_object('ok', false, 'error', 'expired');
  end if;

  update public.newsletter_subscriptions
  set status = 'confirmed',
      confirmed_at = now(),
      confirmation_token_hash = null,
      confirmation_expires_at = null
  where id = v_sub.id;

  return json_build_object('ok', true, 'email', v_sub.email, 'site_id', v_sub.site_id);
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- C1: Hash unsubscribe_tokens at rest
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.unsubscribe_tokens
  add column if not exists token_hash text;

-- Backfill hash from existing plaintext token values.
update public.unsubscribe_tokens
  set token_hash = encode(sha256(token::bytea), 'hex')
  where token is not null and token_hash is null;

-- Drop the old PK on token plaintext and old format check.
-- (PK drop must come first — cannot alter nullability of a PK column.)
alter table public.unsubscribe_tokens drop constraint if exists unsubscribe_tokens_pkey;
alter table public.unsubscribe_tokens drop constraint if exists unsubscribe_tokens_token_check;

-- Add hash as primary key with format check.
alter table public.unsubscribe_tokens
  add constraint unsubscribe_tokens_hash_check check (token_hash ~ '^[a-f0-9]{64}$');

alter table public.unsubscribe_tokens
  add constraint unsubscribe_tokens_pkey primary key (token_hash);

-- Drop the plaintext column now.
alter table public.unsubscribe_tokens drop column if exists token;

-- Rewrite RPC to look up by hash. Drop first — param name change requires it.
drop function if exists public.unsubscribe_via_token(text);
create or replace function public.unsubscribe_via_token(p_token_hash text) returns json language plpgsql security definer as $fn$
declare v_tok record; v_sub record;
begin
  select token_hash, site_id, email, used_at into v_tok
  from public.unsubscribe_tokens where token_hash = p_token_hash for update;

  if v_tok.token_hash is null then return json_build_object('ok', false, 'error', 'not_found'); end if;
  if v_tok.used_at is not null then
    return json_build_object('ok', true, 'already', true, 'site_id', v_tok.site_id, 'email', v_tok.email);
  end if;

  select id, status into v_sub from public.newsletter_subscriptions
  where site_id = v_tok.site_id and email = v_tok.email for update;

  if v_sub.id is not null and v_sub.status <> 'unsubscribed' then
    update public.newsletter_subscriptions
    set status = 'unsubscribed', unsubscribed_at = now()
    where id = v_sub.id;
  end if;

  update public.unsubscribe_tokens set used_at = now() where token_hash = p_token_hash;

  return json_build_object('ok', true, 'site_id', v_tok.site_id, 'email', v_tok.email, 'sub_id', v_sub.id);
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- M3: Persist preferred locale on newsletter subscriptions.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.newsletter_subscriptions
  add column if not exists locale text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Newsletter subscription state-machine documentation.
-- ─────────────────────────────────────────────────────────────────────────────
comment on table public.newsletter_subscriptions is
$fn$Newsletter subscription state machine:
  pending_confirmation → confirmed   (via public.confirm_newsletter_subscription)
  confirmed            → unsubscribed (via public.unsubscribe_via_token)
  unsubscribed         → pending_confirmation (re-subscribe flow: token rotates,
                                               consent version re-captured)
  pending_confirmation → pending_confirmation (re-subscribe while pending: token
                                               rotates, expires_at resets)
Tokens are stored hashed (sha256 hex). Expiry enforced server-side by the RPCs,
not by a partial index (now() in a predicate is nondeterministic).$fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- C4 + C5: Contact submission rate-limit RPC (inet-typed, 10-min window, 5/window).
-- H3 note: window and cap are enforced here — tests do not need to re-validate.
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.contact_rate_check(uuid, text, text);

create or replace function public.contact_rate_check(
  p_site_id uuid, p_ip text, p_email text
) returns boolean language plpgsql security definer set search_path = public as $fn$
declare
  v_ip_inet inet;
  v_count int;
begin
  if p_site_id is null then return false; end if;

  begin
    v_ip_inet := case when p_ip is null or p_ip = '' then null else p_ip::inet end;
  exception when others then
    v_ip_inet := null;
  end;

  select count(*) into v_count
  from contact_submissions
  where site_id = p_site_id
    and submitted_at > now() - interval '10 minutes'
    and (
      (p_email is not null and email = p_email::citext)
      or (v_ip_inet is not null and ip = v_ip_inet)
    );

  return v_count < 5;
end;
$fn$;

  to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Newsletter rate-limit RPC (inet-typed, 1-hour window, 5/window).
-- H3 note: window is 1 hour here, which is looser than contact (10min). Newsletter
-- confirm flow is self-gated by unique email + pending status; this just caps
-- churn per IP/email pair across subscribe attempts.
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.newsletter_rate_check(uuid, text);
drop function if exists public.newsletter_rate_check(uuid, text, text);

create or replace function public.newsletter_rate_check(
  p_site_id uuid, p_ip text, p_email text
) returns boolean language plpgsql security definer set search_path = public as $fn$
declare
  v_ip_inet inet;
  v_count int;
begin
  if p_site_id is null then return false; end if;

  begin
    v_ip_inet := case when p_ip is null or p_ip = '' then null else p_ip::inet end;
  exception when others then
    v_ip_inet := null;
  end;

  select count(*) into v_count
  from newsletter_subscriptions
  where site_id = p_site_id
    and subscribed_at > now() - interval '1 hour'
    and (
      email = p_email
      or (v_ip_inet is not null and ip = v_ip_inet)
    );

  return v_count < 5;
end;
$fn$;

  to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- H6/H7: Advisory-lock RPCs for cron routes (serialise concurrent invocations).
-- Use hashtextextended (64-bit variant) rather than hashtext (32-bit) — lower
-- collision probability across the advisory-lock namespace.
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.cron_try_lock(text);
drop function if exists public.cron_unlock(text);

create or replace function public.cron_try_lock(p_job text) returns boolean language sql security definer as $fn$
  select pg_try_advisory_lock(hashtextextended(p_job, 0));
$fn$;

create or replace function public.cron_unlock(p_job text) returns boolean language sql security definer as $fn$
  select pg_advisory_unlock(hashtextextended(p_job, 0));
$fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Email dedupe indexes.
-- ─────────────────────────────────────────────────────────────────────────────

-- Contact auto-reply: one per (site, to_email, UTC day).
drop index if exists public.sent_emails_contact_autoreply_daily;
create unique index sent_emails_contact_autoreply_daily
  on public.sent_emails (
    site_id, to_email, template_name, ((sent_at at time zone 'UTC')::date)
  )
  where template_name = 'contact-received';

-- Newsletter welcome: only one per (site, to_email), ever.
drop index if exists public.sent_emails_welcome_unique;
create unique index sent_emails_welcome_unique
  on public.sent_emails (site_id, to_email)
  where template_name = 'welcome';

-- Contact admin alert: one per submission_id (prevents double-alerts on retries).
drop index if exists public.sent_emails_admin_alert_unique;
create unique index sent_emails_admin_alert_unique
  on public.sent_emails (site_id, template_name, ((metadata->>'submission_id')))
  where template_name = 'contact-admin-alert';

-- ─────────────────────────────────────────────────────────────────────────────
-- Perf index: cron sync-newsletter-pending scans rows needing Brevo push.
-- ─────────────────────────────────────────────────────────────────────────────
drop index if exists public.newsletter_pending_brevo_sync;
create index newsletter_pending_brevo_sync
  on public.newsletter_subscriptions (site_id)
  where status = 'confirmed' and brevo_contact_id is null;
