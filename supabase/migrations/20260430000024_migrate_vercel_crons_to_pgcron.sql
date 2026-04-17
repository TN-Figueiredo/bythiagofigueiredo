-- ================================================================
-- Migrar 5 Vercel crons → pg_cron (Supabase Pro)
-- ================================================================
--
-- Pré-requisitos (configurar ANTES de aplicar):
--   1. Supabase Pro (pg_cron + pg_net habilitados nas Extensions)
--   2. ALTER DATABASE postgres SET app.settings.web_url = 'https://bythiagofigueiredo.com';
--   3. ALTER DATABASE postgres SET app.settings.cron_secret = '<CRON_SECRET do Vercel>';
--
-- Estratégia:
--   - 2 jobs SQL puro (purge-sent-emails, purge-old-contact-submissions)
--     → funções dedicadas que chamam as RPCs existentes.
--   - 3 jobs HTTP POST via pg_net para rotas Next.js existentes
--     (publish-scheduled, sync-newsletter-pending, lgpd-cleanup-sweep)
--
-- Se pg_cron/pg_net não existirem (ex: local reset), a migração é
-- pulada graciosamente com RAISE NOTICE — todo scheduling está dentro
-- de DO blocks gated em `pg_extension`.
--
-- Rollback: ver seção ROLLBACK no final.
-- ================================================================


-- ============================================================
-- PRÉ-FLIGHT: registrar status dos pré-requisitos
-- ============================================================

DO $preflight$
DECLARE
  _has_pgcron BOOLEAN;
  _has_pgnet BOOLEAN;
  _web_url TEXT;
  _has_secret BOOLEAN;
  _missing TEXT[] := '{}';
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') INTO _has_pgcron;
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_net') INTO _has_pgnet;
  _web_url := current_setting('app.settings.web_url', true);
  _has_secret := current_setting('app.settings.cron_secret', true) IS NOT NULL;

  IF NOT _has_pgcron THEN _missing := array_append(_missing, 'pg_cron'); END IF;
  IF NOT _has_pgnet  THEN _missing := array_append(_missing, 'pg_net'); END IF;
  IF _web_url IS NULL OR _web_url = '' THEN _missing := array_append(_missing, 'app.settings.web_url'); END IF;
  IF NOT _has_secret THEN _missing := array_append(_missing, 'app.settings.cron_secret'); END IF;

  IF array_length(_missing, 1) > 0 THEN
    RAISE NOTICE '[pg_cron migration] Pré-requisitos ausentes: %. HTTP cron jobs ficarão pulados. Configure com ALTER DATABASE e aplique scripts/setup-pgcron-prod.sh.',
      array_to_string(_missing, ', ');
  ELSE
    RAISE NOTICE '[pg_cron migration] Todos os pré-requisitos OK — scheduling os 5 jobs.';
  END IF;
END $preflight$;


-- ============================================================
-- PARTE 1: SQL-only jobs (não precisam de pg_net)
-- ============================================================

-- 1A. purge-sent-emails: apaga sent_emails com mais de 90 dias
--     Wrapper enxuto sobre o RPC public.purge_sent_emails(int) já existente
--     (Sprint 4a Epic 10, migration 20260418000003).

CREATE OR REPLACE FUNCTION public.cron_purge_sent_emails()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted int;
BEGIN
  SELECT public.purge_sent_emails(90) INTO _deleted;
  RAISE LOG '[pg_cron] purge-sent-emails: % rows', _deleted;
END $$;

COMMENT ON FUNCTION public.cron_purge_sent_emails()
  IS 'pg_cron wrapper: purga sent_emails > 90d. Roda daily 06:00 UTC. Migrado de Vercel cron.';

DO $unsched$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN RETURN; END IF;
  BEGIN PERFORM cron.unschedule('purge-sent-emails'); EXCEPTION WHEN OTHERS THEN NULL; END;
END $unsched$;

DO $sched$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN RETURN; END IF;
  PERFORM cron.schedule('purge-sent-emails', '0 6 * * *', 'SELECT public.cron_purge_sent_emails()');
END $sched$;


-- 1B. purge-old-contact-submissions: anonimiza contact_submissions > 2 anos
--     Wrapper sobre o RPC public.purge_old_contact_submissions(int) já existente
--     (Sprint 5a P1-9, migration 20260430000023).

CREATE OR REPLACE FUNCTION public.cron_purge_old_contact_submissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _anonymized int;
BEGIN
  SELECT public.purge_old_contact_submissions(730) INTO _anonymized;
  RAISE LOG '[pg_cron] purge-old-contact-submissions: % rows', _anonymized;
END $$;

COMMENT ON FUNCTION public.cron_purge_old_contact_submissions()
  IS 'pg_cron wrapper: anonimiza contact_submissions > 2 anos. Roda domingo 06:00 UTC.';

DO $unsched$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN RETURN; END IF;
  BEGIN PERFORM cron.unschedule('purge-old-contact-submissions'); EXCEPTION WHEN OTHERS THEN NULL; END;
END $unsched$;

DO $sched$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN RETURN; END IF;
  PERFORM cron.schedule('purge-old-contact-submissions', '0 6 * * 0', 'SELECT public.cron_purge_old_contact_submissions()');
END $sched$;


-- ============================================================
-- PARTE 2: HTTP POST helper (pg_net)
-- ============================================================

DO $helper$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN RETURN; END IF;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.cron_http_post_web(p_path text, p_timeout_ms int DEFAULT 30000)
    RETURNS bigint
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $f$
      SELECT net.http_post(
        url := current_setting('app.settings.web_url') || p_path,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := p_timeout_ms
      );
    $f$;
  $fn$;

  EXECUTE 'COMMENT ON FUNCTION public.cron_http_post_web(text, int) IS ''Helper: POST em rota web com Bearer CRON_SECRET via pg_net. Usado pelos cron jobs HTTP.''';
END $helper$;


-- ============================================================
-- PARTE 3: HTTP cron jobs (publish-scheduled, sync-newsletter, lgpd-sweep)
-- ============================================================

DO $http_cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')  THEN RETURN; END IF;
  IF current_setting('app.settings.web_url', true) IS NULL
     OR current_setting('app.settings.web_url', true) = '' THEN RETURN; END IF;

  -- 3A. publish-scheduled: every 5min
  BEGIN PERFORM cron.unschedule('publish-scheduled'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM cron.schedule('publish-scheduled', '*/5 * * * *',
    'SELECT public.cron_http_post_web(''/api/cron/publish-scheduled'')');

  -- 3B. sync-newsletter-pending: every minute
  BEGIN PERFORM cron.unschedule('sync-newsletter-pending'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM cron.schedule('sync-newsletter-pending', '* * * * *',
    'SELECT public.cron_http_post_web(''/api/cron/sync-newsletter-pending'')');

  -- 3C. lgpd-cleanup-sweep: daily 07:00 UTC
  BEGIN PERFORM cron.unschedule('lgpd-cleanup-sweep'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM cron.schedule('lgpd-cleanup-sweep', '0 7 * * *',
    'SELECT public.cron_http_post_web(''/api/cron/lgpd-cleanup-sweep'')');
END $http_cron$;


-- ============================================================
-- PARTE 4: Monitoring view
-- ============================================================

DO $health$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN RETURN; END IF;

  EXECUTE $v$
    CREATE OR REPLACE VIEW public.v_cron_health AS
    SELECT
      j.jobname,
      j.schedule,
      d.status AS last_status,
      d.start_time AS last_run,
      d.end_time AS last_end,
      EXTRACT(EPOCH FROM (d.end_time - d.start_time))::numeric(10,2) AS duration_secs,
      d.return_message,
      CASE
        WHEN d.status = 'failed' THEN 'ALERTA'
        WHEN d.start_time < NOW() - INTERVAL '25 hours' AND j.schedule NOT LIKE '*/%' AND j.schedule NOT LIKE '* %' THEN 'ATRASADO'
        ELSE 'OK'
      END AS health
    FROM cron.job j
    LEFT JOIN LATERAL (
      SELECT rd.status, rd.start_time, rd.end_time, rd.return_message
      FROM cron.job_run_details rd
      WHERE rd.jobid = j.jobid
      ORDER BY rd.start_time DESC
      LIMIT 1
    ) d ON true
    ORDER BY j.jobname;
  $v$;

  EXECUTE 'COMMENT ON VIEW public.v_cron_health IS ''Dashboard de saúde dos cron jobs. Mostra última execução, status e alertas.''';
  EXECUTE 'GRANT SELECT ON public.v_cron_health TO service_role';
END $health$;


-- ============================================================
-- ROLLBACK (manual, se necessário)
-- ============================================================
-- SELECT cron.unschedule('publish-scheduled');
-- SELECT cron.unschedule('sync-newsletter-pending');
-- SELECT cron.unschedule('lgpd-cleanup-sweep');
-- SELECT cron.unschedule('purge-sent-emails');
-- SELECT cron.unschedule('purge-old-contact-submissions');
-- DROP FUNCTION IF EXISTS public.cron_purge_sent_emails();
-- DROP FUNCTION IF EXISTS public.cron_purge_old_contact_submissions();
-- DROP FUNCTION IF EXISTS public.cron_http_post_web(text, int);
-- DROP VIEW IF EXISTS public.v_cron_health;
-- Depois: restaurar `crons` no apps/web/vercel.json e redeploy.
