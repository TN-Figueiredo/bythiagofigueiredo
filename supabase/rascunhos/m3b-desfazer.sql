-- Volta atrás do rascunho m3b.sql num banco LOCAL de ensaio (nunca produção, nunca o 54322 do navegador).
-- Só toca o que a M3b cria: as 15 tabelas obs_archive_* dela, as funções dela (por nome, todas as sobrecargas), os dois gatilhos em
-- competitor_channels, a coluna competitor_removed_items.archive_note e o papel obs_arquivo_leitor.
-- NÃO toca no que já existia antes: obs_archive_batches, _rehearsal, _video_policy, obs_archive_is_site_admin (migration 20261014000002)
-- nem as funções da MG6/M2 (obs_archive_register, _uncovered, _verify, ...).
begin;
drop trigger if exists obs_archive_z_destino_declarado on public.competitor_channels;
drop trigger if exists obs_archive_z_truncate on public.competitor_channels;

-- Yannis N5 (2ª rodada): a parte 6 recria competitor_channel_remove_archived (E10) com a declaração do destino. Antes de dropar as tabelas,
-- devolve o corpo do bloco 11b da M2 (md5 96fccc5423bdf22ef680692adb5f99cd) tirando a declaração que a parte 6 inseriu (o mesmo texto, v_decl).
-- Sem a declaração no corpo: nada. Corpo que não volta ao md5 conhecido: recusa (nada é trocado) e o desfazer inteiro aborta.
do $$
declare
  v_oid  oid := pg_catalog.to_regprocedure('public.competitor_channel_remove_archived(uuid,uuid,uuid)');
  v_def  text;
  v_decl text;
  v_novo text;
  v_chk  text;
begin
  if v_oid is null then return; end if;
  if (select p.prosrc from pg_catalog.pg_proc p where p.oid = v_oid) !~ 'obs_archive_channel_removals' then return; end if;
  v_decl := $d$
  declare v_u integer; v_by bigint; v_f date; v_l date;
  begin
    -- M3b (Yannis 3): declara o destino do arquivo na mesma transação do delete; o gatilho obs_archive_z_destino_declarado confere o xid
    select count(*) filter (where u.version = (select max(x.version) from public.obs_archive_units x where x.site_id = u.site_id and x.class = u.class
                                                 and x.table_name = u.table_name and x.channel_ref = u.channel_ref and x.month = u.month)),
           coalesce(sum(u.file_bytes), 0), min(u.month), max(u.month)
      into v_u, v_by, v_f, v_l
      from public.obs_archive_units u where u.site_id = p_site and u.channel_ref = p_channel::text and u.purged_at is null;
    insert into public.obs_archive_channel_removals (site_id, channel_ref, youtube_channel_id, name_at_removal, removed_at, removed_by, removed_via,
           archive_decision, decided_at, decided_by, units_at_removal, bytes_at_removal, first_month, last_month, blobs_pending, online_thumbs_known, declared_xid)
    values (p_site, p_channel::text, v_c.channel_id, v_c.channel_name, now(), p_actor, 'e10_export', 'guardar', now(), p_actor, v_u, v_by, v_f, v_l,
            public.obs_archive_channel_blobs(p_site, p_channel::text), true, pg_current_xact_id());
  end;
  $d$;
  v_def := pg_catalog.pg_get_functiondef(v_oid);
  v_novo := pg_catalog.replace(v_def, v_decl, '');
  if v_novo = v_def then
    raise exception 'M3b-desfazer:competitor_channel_remove_archived_sem_declaracao' using errcode = 'P0001', detail = 'a declaração não aparece como a parte 6 a inseriu';
  end if;
  execute v_novo;
  select p.prosrc into v_chk from pg_catalog.pg_proc p where p.oid = pg_catalog.to_regprocedure('public.competitor_channel_remove_archived(uuid,uuid,uuid)');
  if pg_catalog.md5(v_chk) <> '96fccc5423bdf22ef680692adb5f99cd' then
    raise exception 'M3b-desfazer:competitor_channel_remove_archived_md5' using errcode = 'P0001', detail = 'o corpo restaurado não é o do bloco 11b';
  end if;
end $$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as fn
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in (
        'competitor_channel_remove',
        'obs_archive_agora',
        'obs_archive_atraso',
        'obs_archive_atraso_itens',
        'obs_archive_attest_b2',
        'obs_archive_attest_b2_dono',
        'obs_archive_attest_nas',
        'obs_archive_b2_aceitar_paginas',
        'obs_archive_b2_atrasados',
        'obs_archive_b2_file_info',
        'obs_archive_b2_franquia_mes',
        'obs_archive_b2_month_state',
        'obs_archive_b2_pede_completo',
        'obs_archive_b2_plan',
        'obs_archive_b2_recompute_month',
        'obs_archive_b2_retirar',
        'obs_archive_b2_run_gate',
        'obs_archive_b2_teto_cor',
        'obs_archive_b2_teto_dia',
        'obs_archive_can_redo',
        'obs_archive_channel_archive_impact',
        'obs_archive_channel_blobs',
        'obs_archive_channel_is_removed',
        'obs_archive_channel_removal_decide',
        'obs_archive_channel_unit_hashes',
        'obs_archive_channel_units',
        'obs_archive_class_table_guard',
        'obs_archive_content_hash',
        'obs_archive_current_units',
        'obs_archive_descartados_sem_releitura',
        'obs_archive_destino_declarado',
        'obs_archive_due_on',
        'obs_archive_expected_units',
        'obs_archive_filho_do_arquivo',
        'obs_archive_first_month',
        'obs_archive_heartbeat_write',
        'obs_archive_hoje_sp',
        'obs_archive_insert_guard',
        'obs_archive_is_terminal',
        'obs_archive_manifest_rows',
        'obs_archive_mark_guard',
        'obs_archive_mark_purged',
        'obs_archive_mark_redo',
        'obs_archive_meses_devidos',
        'obs_archive_month_files',
        'obs_archive_nas_cobertura',
        'obs_archive_owner_pending',
        'obs_archive_pending_units',
        'obs_archive_plan',
        'obs_archive_pode_desligar',
        'obs_archive_policy',
        'obs_archive_read_unit',
        'obs_archive_receive',
        'obs_archive_recompute_nas',
        'obs_archive_record',
        'obs_archive_record_core',
        'obs_archive_record_manifest',
        'obs_archive_removed_channel_list',
        'obs_archive_resumo_devido',
        'obs_archive_schema_fp',
        'obs_archive_seal',
        'obs_archive_summary_rows',
        'obs_archive_table_exprs',
        'obs_archive_unit_due',
        'obs_archive_unit_part_info',
        'obs_archive_unit_rehash',
        'obs_archive_unit_source',
        'obs_archive_vermelhos',
        'obs_archive_vermelhos_remocao',
        'obs_archive_video_antigo_months',
        'obs_archive_vigia_remocao'
       )
  loop
    execute format('drop function %s cascade', f.fn);
  end loop;
end $$;

drop table if exists
  public.obs_archive_units, public.obs_archive_unit_parts, public.obs_archive_months, public.obs_archive_prechecks,
  public.obs_archive_restores, public.obs_archive_switch, public.obs_archive_heartbeat, public.obs_archive_purges,
  public.obs_archive_unit_attachments, public.obs_archive_summaries, public.obs_archive_channel_removals,
  public.obs_archive_b2_runs, public.obs_archive_b2_files, public.obs_archive_canaries, public.obs_archive_sweeps
  cascade;
alter table public.competitor_removed_items drop column if exists archive_note;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'obs_arquivo_leitor') then
    revoke usage on schema public from obs_arquivo_leitor;   -- o único privilégio que sobra depois que funções e tabelas caem
    drop role obs_arquivo_leitor;
  end if;
end $$;
commit;
