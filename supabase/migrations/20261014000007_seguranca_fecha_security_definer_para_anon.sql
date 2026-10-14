-- Segurança (14/10/2026): fecha EXECUTE de PUBLIC/anon/authenticated nas funções SECURITY DEFINER de public
-- que só o sistema chama (service_role, pg_cron, triggers). Ficam abertas as 22 que precisam (login/branding)
-- ou que checam permissão no corpo. Idempotente. Portão: Yannis (classificação e ensaio) e Phil (o que quebra).
-- Detalhe e conferência: .superpowers/sdd/seguranca/anon-definer-14-10.md (fora do git).

-- Fecha EXECUTE de anon/authenticated/PUBLIC nas SECURITY DEFINER de public que
-- não precisam ser chamadas pelo cliente. Mantém service_role explícito.
do $$
declare
  r record;
  v_service_only text[] := array[
    -- (A)
    'lgpd_phase1_cleanup','lgpd_phase3_prenullify_fks','purge_content_events',
    'purge_sent_emails','anonymize_old_link_clicks','swap_slot_edition','rotate_cycle',
    'create_yt_notification','aggregate_ad_events_yesterday','upsert_linktree_daily_metrics',
    'increment_link_clicks','pin_weekly_pick','unpin_weekly_pick','pin_working_today',
    'unpin_working_today','update_pipeline_step','shift_link_in_bio_positions',
    'activate_research_foco_service','reassign_authors','social_publish_fair_batch',
    'get_audience_countries','get_audience_devices','get_audience_sources',
    'get_top_links_analytics','get_top_posts_analytics','get_top_referrers','get_utm_campaigns',
    'cron_try_lock','cron_unlock','purge_deleted_user_audit','user_exists_by_email',
    -- (C)
    'aggregate_content_events','expire_old_yt_notifications','refresh_newsletter_stats',
    'refresh_fan_scores','cron_purge_old_contact_submissions','cron_purge_sent_emails',
    'purge_old_contact_submissions','cancel_account_deletion_in_grace',
    'confirm_newsletter_subscription','unsubscribe_via_token','contact_rate_check',
    'newsletter_rate_check','check_deletion_safety','find_orphan_media_assets',
    'count_orphan_media_assets','generate_link_code','can_admin_site_for_user',
    'is_org_staff_for_user','record_password_reset_attempt',
    'enforce_publish_permission','invitations_rate_limit','pipeline_record_stage_change',
    'sync_tag_newsletter_link','tg_audit_mutation','tg_seed_youtube_niches',
    'tg_youtube_channels_slug','update_tracked_links_timestamp','rls_auto_enable'
  ];
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = any (v_service_only)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- Função nova em public deixa de nascer aberta para anon/PUBLIC.
-- O EXECUTE a PUBLIC é default GLOBAL do Postgres: default por schema só ADICIONA,
-- não tira (sondado: o revoke "in schema public ... from public" não tem efeito).
-- Por isso são dois comandos. authenticated e service_role continuam com o grant
-- explícito do Supabase em public; helper de policy novo que precise de anon recebe
-- "grant execute on function ... to anon" explícito, com o motivo.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
alter default privileges for role postgres
  revoke execute on functions from public;
