-- supabase/rascunhos/m6-desfazer.sql — volta o banco de integração ao estado sem a M6 (as corridas confirmam a M6). Nunca em produção.
-- Desvio do plano (28/10): a M3b já é migration no int (e a M5 também); o desfazer NÃO toca nelas, só no que o m6.sql cria. Por isso inclui
-- obs_archive_piso_registro e obs_archive_pode_sair_em (a M7 ainda não existe no int e o m6.sql as cria).
-- obs_archive_vermelhos (M3b) é só redefinida pela M6: não é derrubada; sem as funções da saída, os blocos novos (to_regprocedure) não rodam.
drop trigger if exists obs_archive_a_mes_destacado on public.competitor_videos;
drop trigger if exists obs_archive_a_mes_destacado_truncate on public.competitor_videos;
drop trigger if exists obs_archive_a_mes_destacado on public.competitor_channels;
drop trigger if exists obs_archive_a_mes_destacado_truncate on public.competitor_channels;
drop trigger if exists obs_archive_a_unidade_em_mes_destacado on public.obs_archive_units;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in (
              -- M6a (as do m6.sql)
              'obs_archive_after_auto',
              'obs_archive_block_delete_while_detached',
              'obs_archive_conferir_canal',
              'obs_archive_content_hash_rel',
              'obs_archive_detach_month',
              'obs_archive_discard_core',
              'obs_archive_discard_month',
              'obs_archive_drop_month',
              'obs_archive_exit_check',
              'obs_archive_exit_class',
              'obs_archive_gate',
              'obs_archive_invariante_faltam',
              'obs_archive_month_green',
              'obs_archive_outros_sites_ok',
              'obs_archive_part_bounds',
              'obs_archive_saida_trava',
              'obs_archive_saida_mudou',
              'obs_archive_saida_era_corrida',
              'obs_archive_part_check',
              'obs_archive_part_rel',
              'obs_archive_piso_registro',
              'obs_archive_pode_sair_em',
              'obs_archive_precheck_channels',
              'obs_archive_precheck_unit',
              'obs_archive_reattach_month',
              'obs_archive_row_digest_rel',
              'obs_archive_tally',
              'obs_archive_unit_in_detached_month',
              'obs_archive_unit_source_rel',
              -- M6b
              'obs_archive_switch_state',
              'obs_archive_switch_arm',
              'obs_archive_switch_disarm',
              'obs_archive_switch_seen',
              'obs_archive_switch_watch',
              'obs_archive_switch_after_refusal',
              'obs_archive_exit_candidates',
              'obs_archive_switch_armed_sites',
              'obs_archive_next_exit',
              'obs_archive_vermelhos_automatico',
              -- M6a parte 6
              'obs_archive_switch_counts',
              'obs_archive_switch_sim_seen',
              'obs_archive_em_transito',
              'obs_archive_vermelhos_saida')
  loop execute format('drop function %s', f.sig); end loop;
end $$;
alter table public.obs_archive_switch drop constraint if exists obs_archive_switch_disarm_reason_check;
alter table public.obs_archive_prechecks drop column if exists row_digest;
alter table public.obs_archive_switch drop column if exists sims_seen, drop column if exists last_sim_at, drop column if exists refusals_b2,
  drop column if exists disarm_month, drop column if exists disarm_detail, drop column if exists disarm_seen_at;
alter table public.obs_archive_months drop column if exists reattached_at, drop column if exists reattach_out_of_order;
