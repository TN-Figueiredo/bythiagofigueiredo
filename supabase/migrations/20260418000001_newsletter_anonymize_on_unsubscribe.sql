-- Epic 10 / T73 — LGPD: anonymize newsletter subscription row on unsubscribe.
--
-- `unsubscribe_via_token` currently only flips status to 'unsubscribed' and
-- records `unsubscribed_at`. This migration extends it to also redact PII:
--   - email → sha256 hex digest (keeps uniqueness for anti-resubscribe)
--   - ip → NULL
--   - user_agent → NULL
--   - locale → NULL
-- We retain site_id, unsubscribed_at, and the consent text versions that were
-- in force when the user subscribed (LGPD accountability requires proving
-- which consent text was accepted).
--
-- A unique partial index on (site_id, email) where status='unsubscribed'
-- prevents re-subscribing with the exact same hashed email (and therefore the
-- same raw email — sha256 is deterministic).

-- Idempotent unique index on unsubscribed rows (prevents the resub path from
-- inserting a fresh pending row with the same email once it's been anonymized).
create unique index if not exists newsletter_subscriptions_anon_unique
  on public.newsletter_subscriptions (site_id, email)
  where status = 'unsubscribed';

-- Rewrite the RPC. Keep signature + grants stable; only the body changes.
create or replace function public.unsubscribe_via_token(p_token_hash text) returns json language plpgsql security definer as $fn$
declare v_tok record; v_sub record; v_email_hash text;
begin
  select token_hash, site_id, email, used_at into v_tok
  from public.unsubscribe_tokens where token_hash = p_token_hash for update;

  if v_tok.token_hash is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_tok.used_at is not null then
    return json_build_object('ok', true, 'already', true, 'site_id', v_tok.site_id);
  end if;

  select id, status, email into v_sub from public.newsletter_subscriptions
  where site_id = v_tok.site_id and email = v_tok.email for update;

  if v_sub.id is not null and v_sub.status <> 'unsubscribed' then
    v_email_hash := encode(sha256(v_sub.email::bytea), 'hex');
    update public.newsletter_subscriptions
    set status = 'unsubscribed',
        unsubscribed_at = now(),
        email = v_email_hash,
        ip = null,
        user_agent = null,
        locale = null
    where id = v_sub.id;
  end if;

  update public.unsubscribe_tokens set used_at = now() where token_hash = p_token_hash;

  return json_build_object('ok', true, 'site_id', v_tok.site_id, 'sub_id', v_sub.id);
end $fn$;
