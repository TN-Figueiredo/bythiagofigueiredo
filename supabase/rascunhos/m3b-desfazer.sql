-- Volta atrás do rascunho m3b.sql num banco LOCAL de ensaio (nunca produção, nunca o 54322 do navegador).
-- Só toca o que a M3b cria: as 15 tabelas obs_archive_* dela, as funções dela (por nome, todas as sobrecargas), os dois gatilhos em
-- competitor_channels, a coluna competitor_removed_items.archive_note e o papel obs_arquivo_leitor.
-- NÃO toca no que já existia antes: obs_archive_batches, _rehearsal, _video_policy, obs_archive_is_site_admin (migration 20261014000002)
-- nem as funções da MG6/M2 (obs_archive_register, _uncovered, _verify, ...).
begin;
drop trigger if exists obs_archive_z_destino_declarado on public.competitor_channels;
drop trigger if exists obs_archive_z_truncate on public.competitor_channels;

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
