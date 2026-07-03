-- =============================================================================
-- MIGRATION: purge_used_dsar_tokens — retention/purge for waitlist_dsar_tokens
-- =============================================================================
-- Finding: public.waitlist_dsar_tokens (introduced in 20260618000001) stores the
-- data-subject's email in PLAINTEXT (public.citext) with NO purge/expiry, so a
-- used or abandoned DSAR rights link keeps that PII indefinitely. LGPD Art. 15/16
-- storage-limitation requires bounded retention.
--
-- Companion table note: unsubscribe_tokens (same plaintext-email shape) is ALREADY
-- purged — the lgpd-cleanup-sweep cron calls purgeStaleUnsubscribeTokens() (BTF-033,
-- 90-day age cutoff). No new work needed there; this migration closes the DSAR gap.
--
-- Approach (Option A — SQL purge function), mirroring the repo's existing
-- purge_sent_emails / cron_purge_sent_emails convention:
--   * public.purge_used_dsar_tokens(p_max_age_days int default 30) — deletes rows
--     that are USED (used_at IS NOT NULL — purpose served) OR STALE (created_at
--     older than p_max_age_days — abandoned link). Returns rows deleted.
--   * public.cron_purge_used_dsar_tokens() — pg_cron wrapper (RAISE LOG), parity
--     with the other cron_purge_* wrappers.
--
-- search_path: '' (strictest) — the bodies are FULLY schema-qualified
-- (public.waitlist_dsar_tokens); only pg_catalog built-ins (now, interval math,
-- count) are used unqualified, and pg_catalog is always implicitly in scope.
--
-- Idempotent: CREATE OR REPLACE; DELETE is naturally repeatable (a second run
-- simply finds fewer/zero matching rows). Restricted to service_role.
-- =============================================================================

-- ── Purge function ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_used_dsar_tokens(p_max_age_days integer DEFAULT 30)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_days    integer;
  v_deleted integer;
BEGIN
  v_days := greatest(coalesce(p_max_age_days, 30), 1);

  WITH del AS (
    DELETE FROM public.waitlist_dsar_tokens
    WHERE used_at IS NOT NULL
       OR created_at < now() - (v_days || ' days')::interval
    RETURNING token_hash
  )
  SELECT count(*) INTO v_deleted FROM del;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_used_dsar_tokens(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_used_dsar_tokens(integer) TO service_role;

COMMENT ON FUNCTION public.purge_used_dsar_tokens(integer) IS
  'LGPD storage-limitation: deletes waitlist_dsar_tokens that are used (used_at set) or older than p_max_age_days (default 30). Returns rows deleted. service_role only.';

-- ── pg_cron wrapper (parity with cron_purge_sent_emails) ────────────────────
CREATE OR REPLACE FUNCTION public.cron_purge_used_dsar_tokens()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  _deleted integer;
BEGIN
  SELECT public.purge_used_dsar_tokens(30) INTO _deleted;
  RAISE LOG '[pg_cron] purge-used-dsar-tokens: % rows', _deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cron_purge_used_dsar_tokens() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_purge_used_dsar_tokens() TO service_role;

COMMENT ON FUNCTION public.cron_purge_used_dsar_tokens() IS
  'pg_cron wrapper: purges used/stale waitlist_dsar_tokens. Schedule daily (e.g. 06:00 UTC) alongside the other cron_purge_* jobs.';
