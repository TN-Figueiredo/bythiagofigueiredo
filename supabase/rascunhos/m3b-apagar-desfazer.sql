-- Desfaz 20261025000004: volta competitor_channel_remove à definição de 20261025000002 (sem a guarda apagar_com_arquivo).
begin;
create or replace function public.competitor_channel_remove(p_site uuid, p_channel uuid, p_decision text, p_via text, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ch record; v_ref text := p_channel::text; v_units integer; v_bytes bigint; v_first date; v_last date; v_blobs text[];
begin
  if p_decision is null or p_decision not in ('apagar', 'guardar') then raise exception 'decisao_invalida' using errcode = 'P0001'; end if;
  if p_via is null or p_via not in ('botao', 'fila', 'e10_export') then raise exception 'decisao_invalida' using errcode = 'P0001'; end if;   -- Yannis M9
  if p_decision = 'guardar' and p_via <> 'e10_export' then raise exception 'guardar_so_pela_e10' using errcode = 'P0001'; end if;
  if not public.obs_archive_is_site_admin(p_site, p_actor) then raise exception 'sem_direito' using errcode = 'P0001'; end if;
  select c.id, c.channel_id, c.channel_name into v_ch from public.competitor_channels c where c.id = p_channel and c.site_id = p_site for update;
  if not found then raise exception 'canal_nao_encontrado' using errcode = 'P0001'; end if;
  -- unidades do conjunto corrente (a maior versão por classe, tabela e mês; Phil I8); bytes de todas as versões (o que está no disco)
  select count(*) filter (where u.version = (select max(x.version) from public.obs_archive_units x where x.site_id = u.site_id and x.class = u.class
                                               and x.table_name = u.table_name and x.channel_ref = u.channel_ref and x.month = u.month)),
         coalesce(sum(u.file_bytes), 0), min(u.month), max(u.month)
    into v_units, v_bytes, v_first, v_last
    from public.obs_archive_units u where u.site_id = p_site and u.channel_ref = v_ref and u.purged_at is null;
  v_blobs := public.obs_archive_channel_blobs(p_site, v_ref);
  insert into public.obs_archive_channel_removals (site_id, channel_ref, youtube_channel_id, name_at_removal, removed_at, removed_by, removed_via,
         archive_decision, decided_at, decided_by, units_at_removal, bytes_at_removal, first_month, last_month, blobs_pending, online_thumbs_known, declared_xid)
  values (p_site, v_ref, v_ch.channel_id, v_ch.channel_name, now(), p_actor, p_via, p_decision, now(), p_actor, v_units, v_bytes, v_first, v_last,
          v_blobs, true, pg_current_xact_id());
  if p_decision = 'apagar' then perform public.obs_archive_mark_purged(p_site, v_ref, p_actor); end if;
  perform public.obs_archive_video_antigo_months(p_site, v_ref);
  delete from public.competitor_channels where id = p_channel and site_id = p_site;   -- o gatilho da M6 (mês destacado) e o abaixo disparam aqui
  return jsonb_build_object('status', 'ok', 'decisao', p_decision, 'unidades', v_units, 'blobs_pendentes', coalesce(array_length(v_blobs, 1), 0));
end $$;
revoke all on function public.competitor_channel_remove(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.competitor_channel_remove(uuid, uuid, text, text, uuid) to service_role;
commit;
