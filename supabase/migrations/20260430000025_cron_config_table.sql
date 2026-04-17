-- ================================================================
-- pg_cron config via tabela (em vez de ALTER DATABASE SET)
-- ================================================================
--
-- Contexto: Supabase managed Postgres não dá permissão de
-- `ALTER DATABASE ... SET app.settings.*` pro role `postgres`
-- (precisaria de superuser, que só o staff deles tem). Migração 024
-- seguiu o padrão TNG que usa `current_setting('app.settings.*')` —
-- no Supabase hosted, isso não funciona.
--
-- Solução: tabela `cron_config` com RLS deny-all (service_role bypass).
-- Helper `cron_http_post_web` lê daqui. Operador atualiza a linha
-- `cron_secret` via UPDATE após apply:
--
--   UPDATE public.cron_config
--   SET value = '<CRON_SECRET do Vercel>'
--   WHERE key = 'cron_secret';
--
-- ================================================================


-- ============================================================
-- 1. Tabela de config
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cron_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cron_config_deny_all ON public.cron_config;
CREATE POLICY cron_config_deny_all ON public.cron_config
  FOR ALL USING (false) WITH CHECK (false);

-- Sem grant pra authenticated/anon. Só service_role (que bypassa RLS)
-- e o postgres role (via SQL editor) podem ler/escrever.

COMMENT ON TABLE public.cron_config IS
  'Config store para pg_cron helpers. Substitui app.settings.* (que requer superuser no Supabase).';


-- ============================================================
-- 2. Seed: web_url (público) + cron_secret (placeholder — atualizar!)
-- ============================================================

INSERT INTO public.cron_config (key, value) VALUES
  ('web_url', 'https://bythiagofigueiredo.com'),
  ('cron_secret', 'CHANGE_ME_AFTER_APPLY')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- 3. Re-declarar helper pra ler da tabela (substitui versão da mig 024)
-- ============================================================

DO $helper$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE '[cron_config] pg_net não habilitado — pulando helper. Habilite pg_net no Dashboard → Database → Extensions e re-rode esta migração.';
    RETURN;
  END IF;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.cron_http_post_web(p_path text, p_timeout_ms int DEFAULT 30000)
    RETURNS bigint
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $f$
    DECLARE
      v_url text;
      v_secret text;
    BEGIN
      SELECT value INTO v_url FROM public.cron_config WHERE key = 'web_url';
      SELECT value INTO v_secret FROM public.cron_config WHERE key = 'cron_secret';

      IF v_url IS NULL OR v_secret IS NULL OR v_secret = 'CHANGE_ME_AFTER_APPLY' THEN
        RAISE LOG '[cron_http_post_web] cron_config incompleto — pulando % (web_url=%, secret_ok=%)',
          p_path, (v_url IS NOT NULL), (v_secret IS NOT NULL AND v_secret != 'CHANGE_ME_AFTER_APPLY');
        RETURN NULL;
      END IF;

      RETURN net.http_post(
        url := v_url || p_path,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || v_secret,
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := p_timeout_ms
      );
    END $f$;
  $fn$;

  EXECUTE 'COMMENT ON FUNCTION public.cron_http_post_web(text, int) IS ''Helper: POST em rota web com Bearer CRON_SECRET via pg_net. Lê config de public.cron_config.''';
END $helper$;


-- ============================================================
-- 4. Re-agendar os 3 HTTP jobs (idempotente — unschedule antes)
--    Os 2 SQL-puro (purge-sent-emails, purge-old-contact-submissions)
--    não dependem de cron_config, foram agendados pela mig 024.
-- ============================================================

DO $http_cron$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '[cron_config] pg_cron não habilitado — pulando schedule.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE '[cron_config] pg_net não habilitado — pulando schedule.';
    RETURN;
  END IF;

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
-- 5. Cleanup: drop marker órfão (se a mig 024 tiver criado)
-- ============================================================

DROP TABLE IF EXISTS public._pgcron_migration_pending;
