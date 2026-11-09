-- =============================================================================
-- MIGRATION:
-- =============================================================================

-- Fecha a leitura anônima de 8 objetos de public (spec .superpowers/sdd/anon-views-expostas/spec.md §2).
-- Causa: ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon (schema.sql:7460) + view sem security_invoker.
-- Idempotente. service_role não é tocado.

alter view public.link_summary_v2                 set (security_invoker = on);
alter view public.linktree_daily_geo              set (security_invoker = on);
alter view public.linktree_device_stats           set (security_invoker = on);
alter view public.newsletter_click_events         set (security_invoker = on);
alter view public.newsletter_click_events_unified set (security_invoker = on);
alter view public.youtube_channel_stats           set (security_invoker = on);
revoke all on public.link_summary_v2, public.linktree_daily_geo, public.linktree_device_stats,
  public.newsletter_click_events, public.newsletter_click_events_unified,
  public.youtube_channel_stats from anon, authenticated;

-- v_cron_health só existe onde pg_cron existe
do $$ begin
  if to_regclass('public.v_cron_health') is not null then
    execute 'alter view public.v_cron_health set (security_invoker = on)';
    execute 'revoke all on public.v_cron_health from anon, authenticated';
  end if;
end $$;

-- mv: security_invoker não se aplica e RLS não vale em mv; só o grant protege
revoke all on public.fan_scores from anon, authenticated;

-- redundância idempotente (20261014000007 já revogou)
revoke execute on function public.refresh_fan_scores() from anon, authenticated;

notify pgrst, 'reload schema';
