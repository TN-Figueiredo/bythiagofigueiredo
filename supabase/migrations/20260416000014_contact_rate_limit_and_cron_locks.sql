-- Epic 4 hardening: token hashing, contact rate limit, auto-reply dedupe,
-- and fix a volatile now() partial index.

-- ─────────────────────────────────────────────────────────────────────────────
-- C1: Hash newsletter confirmation_token at rest
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.newsletter_subscriptions
  add column if not exists confirmation_token_hash text;

-- Backfill: any existing plaintext token gets hashed with sha256 hex (lowercase).
update public.newsletter_subscriptions
  set confirmation_token_hash = encode(digest(confirmation_token, 'sha256'), 'hex')
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
create or replace function public.confirm_newsletter_subscription(p_token_hash text)
returns json language plpgsql security definer as $$
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
end $$;

grant execute on function public.confirm_newsletter_subscription(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- C1: Hash unsubscribe_tokens at rest
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.unsubscribe_tokens
  add column if not exists token_hash text;

-- Backfill hash from existing plaintext token values.
update public.unsubscribe_tokens
  set token_hash = encode(digest(token, 'sha256'), 'hex')
  where token is not null and token_hash is null;

-- Make token nullable (we'll drop it after RPC is updated).
alter table public.unsubscribe_tokens alter column token drop not null;

-- Drop the old PK on token plaintext and old format check.
alter table public.unsubscribe_tokens drop constraint if exists unsubscribe_tokens_pkey;
alter table public.unsubscribe_tokens drop constraint if exists unsubscribe_tokens_token_check;

-- Add hash as primary key with format check.
alter table public.unsubscribe_tokens
  add constraint unsubscribe_tokens_hash_check check (token_hash ~ '^[a-f0-9]{64}$');

alter table public.unsubscribe_tokens
  add constraint unsubscribe_tokens_pkey primary key (token_hash);

-- Drop the plaintext column now.
alter table public.unsubscribe_tokens drop column if exists token;

-- Rewrite RPC to look up by hash.
create or replace function public.unsubscribe_via_token(p_token_hash text)
returns json language plpgsql security definer as $$
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
end $$;

grant execute on function public.unsubscribe_via_token(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- C4 + C5: Contact submission rate-limit RPC
-- ─────────────────────────────────────────────────────────────────────────────
-- Returns true when submission is allowed; false when either IP or email has
-- already produced > 5 submissions in the last 10 minutes for this site.
create or replace function public.contact_rate_check(
  p_site_id uuid, p_ip text, p_email text
) returns boolean language plpgsql security definer as $$
declare v_ip_count int; v_email_count int;
begin
  if p_site_id is null then return false; end if;

  select count(*) into v_ip_count
  from public.contact_submissions
  where site_id = p_site_id
    and p_ip is not null
    and host(ip) = p_ip
    and submitted_at > now() - interval '10 minutes';

  select count(*) into v_email_count
  from public.contact_submissions
  where site_id = p_site_id
    and p_email is not null
    and email = p_email::citext
    and submitted_at > now() - interval '10 minutes';

  return coalesce(v_ip_count, 0) <= 5 and coalesce(v_email_count, 0) <= 5;
end $$;

grant execute on function public.contact_rate_check(uuid, text, text) to anon, authenticated, service_role;

-- Also expose a newsletter rate-limit RPC for per-IP+site throttling (H1).
create or replace function public.newsletter_rate_check(
  p_site_id uuid, p_ip text
) returns boolean language plpgsql security definer as $$
declare v_count int;
begin
  if p_site_id is null or p_ip is null then return true; end if;
  select count(*) into v_count
  from public.newsletter_subscriptions
  where site_id = p_site_id
    and host(ip) = p_ip
    and subscribed_at > now() - interval '10 minutes';
  return coalesce(v_count, 0) <= 5;
end $$;

grant execute on function public.newsletter_rate_check(uuid, text) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- H6/H7: Advisory-lock RPCs for cron routes (serialise concurrent invocations).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.cron_try_lock(p_job text)
returns boolean language sql security definer as $$
  select pg_try_advisory_lock(hashtext(p_job));
$$;

create or replace function public.cron_unlock(p_job text)
returns boolean language sql security definer as $$
  select pg_advisory_unlock(hashtext(p_job));
$$;

grant execute on function public.cron_try_lock(text) to service_role;
grant execute on function public.cron_unlock(text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- C4: Unique partial index for contact auto-reply dedupe (per day UTC).
-- ─────────────────────────────────────────────────────────────────────────────
-- Uses ((sent_at at time zone 'UTC')::date) because date_trunc is STABLE but
-- cast to timestamptz of utc is immutable for indexing.
create unique index if not exists sent_emails_contact_autoreply_daily
  on public.sent_emails (
    site_id, to_email, template_name, ((sent_at at time zone 'UTC')::date)
  )
  where template_name = 'contact-received';
