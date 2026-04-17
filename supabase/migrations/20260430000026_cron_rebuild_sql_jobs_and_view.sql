-- ================================================================
-- Fechar gap: re-agendar os 2 jobs SQL-puros + criar v_cron_health
-- ================================================================
--
-- Mig 024 rodou ANTES das extensões estarem habilitadas — todos os
-- DO blocks com `IF NOT EXISTS (pg_extension ... 'pg_cron') THEN RETURN`
-- viraram no-op. Mig 025 só re-agenda os 3 HTTP jobs.
-- Esta migração completa: schedule dos 2 SQL-only + view de saúde.
-- ================================================================


-- 1. purge-sent-emails (daily 06:00 UTC, chama cron_purge_sent_emails())
DO $sched$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN RETURN; END IF;
  BEGIN PERFORM cron.unschedule('purge-sent-emails'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM cron.schedule('purge-sent-emails', '0 6 * * *',
    'SELECT public.cron_purge_sent_emails()');
END $sched$;


-- 2. purge-old-contact-submissions (Sunday 06:00 UTC)
DO $sched$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN RETURN; END IF;
  BEGIN PERFORM cron.unschedule('purge-old-contact-submissions'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM cron.schedule('purge-old-contact-submissions', '0 6 * * 0',
    'SELECT public.cron_purge_old_contact_submissions()');
END $sched$;


-- 3. v_cron_health view
DO $view$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '[cron view] pg_cron não habilitado — pulando.';
    RETURN;
  END IF;

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
        WHEN d.start_time < NOW() - INTERVAL '25 hours'
             AND j.schedule NOT LIKE '*/%'
             AND j.schedule NOT LIKE '* %' THEN 'ATRASADO'
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

  EXECUTE 'COMMENT ON VIEW public.v_cron_health IS ''Dashboard de saúde dos cron jobs.''';
  EXECUTE 'GRANT SELECT ON public.v_cron_health TO service_role';
END $view$;
