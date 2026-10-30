-- M9 Tarefa 13: baixa dos blobs dos canais removidos e retenção de 90 dias da prova de ausência encerrada (condição I1 do Phil).
-- Idempotente (create or replace, revoke/grant). Só service_role executa.

create or replace function public.obs_archive_removal_blobs_done(p_site uuid, p_ref text, p_urls text[])
returns int language plpgsql security definer set search_path = '' as $$
declare v_restam int;
begin
  update public.obs_archive_channel_removals r
     set blobs_pending = coalesce((select array_agg(u) from unnest(r.blobs_pending) u where u <> all (p_urls)), '{}'::text[])
   where r.site_id = p_site and r.channel_ref = p_ref
  returning cardinality(r.blobs_pending) into v_restam;
  return coalesce(v_restam, 0);
end $$;
revoke all on function public.obs_archive_removal_blobs_done(uuid, text, text[]) from public, anon, authenticated;
grant execute on function public.obs_archive_removal_blobs_done(uuid, text, text[]) to service_role;

-- Retenção da prova de ausência: linha encerrada há mais de 90 dias sai; aberta nunca sai. Devolve quantas apagou.
create or replace function public.obs_archive_absence_prune(p_dias int default 90)
returns int language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  if p_dias is null or p_dias < 90 then raise exception 'retencao_minima_90_dias' using errcode = '22023'; end if;
  with d as (delete from public.obs_archive_absence a
              where a.encerrada_at is not null and a.encerrada_at < now() - make_interval(days => p_dias) returning 1)
  select count(*)::int into v_n from d;
  return v_n;
end $$;
revoke all on function public.obs_archive_absence_prune(int) from public, anon, authenticated;
grant execute on function public.obs_archive_absence_prune(int) to service_role;
