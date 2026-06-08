-- =============================================================================
-- MIGRATION: newsletter hardening review
--
-- Hardens the newsletter system across four areas:
--   1. Columns for at-least-once send dedup + once-per-edition delivery alerting
--   2. Indexes for the send-cron resume query and per-edition subscriber fetch
--   3. Defense-in-depth CHECK constraints (NOT VALID — new writes only)
--   4. Global (cross-list) unsubscribe RPC
--
-- Everything is idempotent and safe to run against a populated production DB.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1) COLUMNS
-- -----------------------------------------------------------------------------

-- Claim timestamp set right before the SES send so the send-cron can suppress an
-- immediate re-send of rows that SES accepted but whose provider_message_id was
-- not yet recorded (at-least-once dedup window).
alter table public.newsletter_sends
  add column if not exists last_attempt_at timestamptz;

-- Set true once the delivery-reconciliation cron has alerted on this edition
-- (0% / low delivery), so it alerts at most once per edition.
alter table public.newsletter_editions
  add column if not exists delivery_alerted boolean not null default false;


-- -----------------------------------------------------------------------------
-- 2) INDEXES (plain CREATE INDEX — not CONCURRENTLY, this runs inside a migration)
-- -----------------------------------------------------------------------------

-- Partial index for the send-cron resume query: find the still-unsent rows of an
-- edition (provider_message_id IS NULL = not yet handed to SES / not recorded).
create index if not exists newsletter_sends_resume_idx
  on public.newsletter_sends (edition_id)
  where provider_message_id is null;

-- Partial composite for the per-edition confirmed-subscriber fetch.
create index if not exists newsletter_subscriptions_confirmed_fetch_idx
  on public.newsletter_subscriptions (newsletter_id, site_id)
  where status = 'confirmed';


-- -----------------------------------------------------------------------------
-- 3) DEFENSE-IN-DEPTH CHECK CONSTRAINTS (NOT VALID → enforced for new writes only;
--    legacy rows are not scanned or rejected). Each is guarded with drop-if-exists.
-- -----------------------------------------------------------------------------

alter table public.newsletter_editions
  drop constraint if exists newsletter_editions_scheduled_has_at;
alter table public.newsletter_editions
  add constraint newsletter_editions_scheduled_has_at
  check (status <> 'scheduled' or scheduled_at is not null) not valid;

alter table public.newsletter_editions
  drop constraint if exists newsletter_editions_sent_has_at;
alter table public.newsletter_editions
  add constraint newsletter_editions_sent_has_at
  check (status <> 'sent' or sent_at is not null) not valid;

alter table public.newsletter_subscriptions
  drop constraint if exists newsletter_subscriptions_confirmed_has_at;
alter table public.newsletter_subscriptions
  add constraint newsletter_subscriptions_confirmed_has_at
  check (status <> 'confirmed' or confirmed_at is not null) not valid;


-- -----------------------------------------------------------------------------
-- 4) GLOBAL UNSUBSCRIBE RPC
--
-- unsubscribe is global across all of the subscriber's lists for this site
-- (one-click RFC 8058 + consent withdrawal). Resolves the token to (site_id,
-- email), flips EVERY matching subscription whose status <> 'unsubscribed', then
-- hashes the email in place. The status flip runs first (over all newsletter_id
-- rows by plaintext email), and only after that do we hash the email — otherwise
-- the in-place hash would stop later rows from matching the same plaintext email.
--
-- Same signature / return type / SECURITY DEFINER as the original. We ADD
-- `set search_path = ''` (the original lacked one): every object reference below
-- is already schema-qualified (public.*) or a pg_catalog built-in, so an empty
-- search_path is the most secure form and satisfies the definer-search-path lint.
-- Return shape preserves `sub_id` (back-compat with the DB-gated integration
-- test and any caller) and adds `sub_count` (number of lists unsubscribed).
-- -----------------------------------------------------------------------------

create or replace function public.unsubscribe_via_token(p_token_hash text)
returns json
language plpgsql security definer
set search_path = ''
as $$
declare
  v_tok record;
  v_count integer;
  v_sub_id uuid;
  v_email_hash text;
begin
  select token_hash, site_id, email, used_at into v_tok
  from public.unsubscribe_tokens where token_hash = p_token_hash for update;

  if v_tok.token_hash is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_tok.used_at is not null then
    return json_build_object('ok', true, 'already', true, 'site_id', v_tok.site_id);
  end if;

  -- Step 1: flip ALL of this subscriber's lists for this site to unsubscribed,
  -- matching by plaintext email (still un-hashed at this point), clearing PII/locale.
  update public.newsletter_subscriptions
  set status = 'unsubscribed',
      unsubscribed_at = now(),
      ip = null,
      user_agent = null,
      locale = null
  where site_id = v_tok.site_id
    and email = v_tok.email
    and status <> 'unsubscribed';

  get diagnostics v_count = row_count;

  -- Capture one affected subscription id for back-compat (`sub_id`) while the
  -- email is still plaintext (before the step-2 hash). Single-list subscribers
  -- get their row id, as the original returned.
  select id into v_sub_id
  from public.newsletter_subscriptions
  where site_id = v_tok.site_id and email = v_tok.email
  limit 1;

  -- Step 2: only AFTER every row is flipped, hash the email in place across all
  -- of this subscriber's rows for the site (PII minimization on withdrawal).
  v_email_hash := encode(sha256(v_tok.email::text::bytea), 'hex');
  update public.newsletter_subscriptions
  set email = v_email_hash
  where site_id = v_tok.site_id
    and email = v_tok.email;

  update public.unsubscribe_tokens set used_at = now() where token_hash = p_token_hash;

  return json_build_object('ok', true, 'site_id', v_tok.site_id, 'sub_id', v_sub_id, 'sub_count', v_count);
end $$;


-- =============================================================================
-- SUMMARY
--   1. Columns: newsletter_sends.last_attempt_at (send dedup claim timestamp),
--      newsletter_editions.delivery_alerted (alert-once flag).
--   2. Indexes: newsletter_sends_resume_idx (partial, provider_message_id IS NULL),
--      newsletter_subscriptions_confirmed_fetch_idx (partial, status='confirmed').
--   3. CHECK constraints (NOT VALID): scheduled⇒scheduled_at, sent⇒sent_at,
--      confirmed⇒confirmed_at.
--   4. RPC: unsubscribe_via_token rewritten to unsubscribe globally across all of
--      the subscriber's lists for the site (flip-then-hash ordering preserved).
-- =============================================================================
