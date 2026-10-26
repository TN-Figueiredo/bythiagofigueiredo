# Arquivo mensal (manutenção M3b): runbook de leitura, volta atrás e conferências

Plano: `docs/superpowers/plans/2026-10-14-manutencao-nas-m3b-site.md` (Tarefa 14). Migrations: `20261025000002` (as 15 tabelas e as funções), `000003` (`obs_archive_m9_pronto`), `000004` e `000005` (`competitor_channel_remove`). Variáveis: `OBS_ARQUIVO`, `OBS_ARQUIVO_LIMPEZA_CANAL` e `OBS_ARQUIVO_LIMPEZA_CANAL_DATA` em `docs/ops/env-vars.md`. Comandos de E10 (exportar, pausar, remover por comando): `docs/ops/observatorio-arquivo-runbook.md`.

**Regra:** toda consulta desta página é de leitura e é do dono, em produção (`npx supabase db query --linked "<consulta>"`). O mesmo conjunto, pronto para colar, está em `.superpowers/sdd/manutencao-nas/m3b/m3b-14-consultas-prod.sh` (saída em `.superpowers/sdd/manutencao-nas/saidas/`). Todas rodaram sem erro no banco local de integração 54422 (estado até a migration `20261025000004`; a `000005` não estava lá e não muda nenhuma tabela lida aqui).

## A. Consultas de leitura

### 1. Cadeia de cada mês de cada tabela (item 80)

Uma linha por site, classe, tabela e mês. Colunas em ordem da cadeia: selado (`sealed_at`, `sealed_kind`), verificado no NAS (`nas_attested_at`), conferido no B2 com a origem (`b2_attested_at`, `b2_attested_via` = `forja` ou `dono`, mais `b2_forja_ok_at` e `b2_dono_ok_at`), ensaiado (último restore da tabela), destacado, descartado e fechado. Vazio antes de 28/11: ainda não há mês selado.

```sql
select m.site_id, m.class, m.table_name, to_char(m.month, 'YYYY-MM') as mes, m.sealed_kind, m.units_total, m.days_measured, m.days_in_month, m.sealed_at, m.nas_attested_at, m.b2_attested_at, m.b2_attested_via, m.b2_forja_ok_at, m.b2_dono_ok_at, (select max(r.done_at) from public.obs_archive_restores r where r.site_id = m.site_id and r.class = m.class and r.table_name = m.table_name) as ensaiado_em, m.detached_at, m.dropped_at, m.closed_at from public.obs_archive_months m order by m.month desc, m.class, m.table_name;
```

### 2. Vídeos por canal (item 80, emenda de 14/10)

`ativos` = sem `archive_frozen_at`; `fora_da_coleta` = congelado e ainda online; `no_arquivo` = `archive_dropped_at` preenchido; `sem_data` = `published_at` nulo (conta à parte, entra em qualquer das três).

```sql
select c.site_id, c.id as canal, c.channel_name, count(v.id) filter (where v.archive_frozen_at is null) as ativos, count(v.id) filter (where v.archive_frozen_at is not null and v.archive_dropped_at is null) as fora_da_coleta, count(v.id) filter (where v.archive_dropped_at is not null) as no_arquivo, count(v.id) filter (where v.published_at is null) as sem_data from public.competitor_channels c left join public.competitor_videos v on v.competitor_channel_id = c.id group by c.site_id, c.id, c.channel_name order by c.site_id, c.channel_name;
```

### 3. Órfãs por canal (item 80/145)

Unidades cujo canal não existe mais e que não têm linha de remoção. Tem de dar zero linhas.

```sql
select u.site_id, u.channel_ref, count(*) as unidades_orfas from public.obs_archive_units u where not exists (select 1 from public.competitor_channels k where k.id::text = u.channel_ref and k.site_id = u.site_id) and not exists (select 1 from public.obs_archive_channel_removals r where r.site_id = u.site_id and r.channel_ref = u.channel_ref) group by u.site_id, u.channel_ref order by 1, 2;
```

### 4. Os quatro números da vigia (item 160, consultas 1 a 4)

Cada site com unidade ou remoção. `c1` a `c4` têm de ser todos 0 (`c4` é 0 até a M9).

```sql
select s.id as site_id, public.obs_archive_vigia_remocao(s.id) as vigia_c1_a_c4 from public.sites s where exists (select 1 from public.obs_archive_units u where u.site_id = s.id) or exists (select 1 from public.obs_archive_channel_removals r where r.site_id = s.id) order by 1;
```

### 5. Consulta 5 do item 160

Resultado em `obs_archive_results` com linha de canal que tem remoção `apagar`. Tem de dar 0. Enquanto a M7 não existir devolve "a fila do relatório ainda não existe" (por `to_regclass`, nunca um erro em verde).

```sql
select case when to_regclass('public.obs_archive_results') is null then 'a fila do relatório ainda não existe' else (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.obs_archive_results r join public.obs_archive_channel_removals x on x.site_id = r.site_id and x.channel_ref = any(r.channel_refs) where x.archive_decision = ''apagar''', false, true, '')))[1]::text end as resultados_de_canal_apagado;
```

### 6. Consulta 6 do item 160

Item pendente de vídeo ou comentário em `competitor_removed_items` cujo canal tem unidades e todas já têm `purged_at`. Tem de dar 0.

```sql
select count(*) as pendentes_sem_nada_a_esperar from public.competitor_removed_items i where i.kind in ('video', 'comentario') and i.archive_pending and i.competitor_channel_id is not null and exists (select 1 from public.obs_archive_units u where u.site_id = i.site_id and u.channel_ref = i.competitor_channel_id::text) and not exists (select 1 from public.obs_archive_units u where u.site_id = i.site_id and u.channel_ref = i.competitor_channel_id::text and u.purged_at is null);
```

### 7. Irmã de P39: miniatura no Blob depois de remoção concluída

Duas contagens: remoções concluídas que ainda listam imagens em `blobs_pending`, e vídeos retirados (`archive_dropped_at`) cujas versões ainda apontam para `thumb_blob_url`. As duas têm de dar 0; a segunda é 0 até a M9.

```sql
select (select count(*) from public.obs_archive_channel_removals r where r.completed_at is not null and cardinality(r.blobs_pending) > 0) as remocoes_concluidas_com_imagem_no_blob, (select count(*) from public.competitor_video_versions ver join public.competitor_videos v on v.id = ver.video_id where v.archive_dropped_at is not null and ver.thumb_blob_url is not null) as videos_retirados_com_miniatura_no_blob;
```

## B. Volta atrás

### B1. O gatilho `before delete` recusa em falso (P47)

Migration própria do dono, criada por `npm run db:new manutencao_m3b_desfaz_gatilho`, com:

```sql
drop trigger if exists obs_archive_z_destino_declarado on public.competitor_channels;
drop trigger if exists obs_archive_z_truncate on public.competitor_channels;
```

Depois dela o botão de remover canal continua declarando o destino do arquivo, porque a função `competitor_channel_remove` não depende do gatilho. O que se perde é a recusa de apagar canal por fora do botão.

### B2. A M3b inteira, só antes de 28/11 (nenhuma unidade existe)

Condição: `select count(*) from public.obs_archive_units;` igual a **0**, lido **no mesmo dia** da migration (o bloco abaixo recusa sozinho se não for zero).

Ordem (código antes do banco, o inverso da subida; sem isso o botão chama `competitor_channel_remove` ausente e responde "Não deu para remover"): primeiro reverter e publicar os commits das Tarefas **13, 12, 11 e 9a**, nessa ordem; só então a migration, criada por `npm run db:new manutencao_m3b_desfaz`:

```sql
do $$
declare r record; n bigint;
begin
  select count(*) into n from public.obs_archive_units;
  if n <> 0 then raise exception 'M3b:desfazer_recusado: % unidades existem', n using errcode = 'P0001'; end if;
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where s.nspname = 'public' and p.proname in (
    'competitor_channel_remove', 'obs_archive_agora', 'obs_archive_atraso',
    'obs_archive_atraso_itens', 'obs_archive_attest_b2', 'obs_archive_attest_b2_dono',
    'obs_archive_attest_nas', 'obs_archive_b2_aceitar_paginas', 'obs_archive_b2_atrasados',
    'obs_archive_b2_file_info', 'obs_archive_b2_franquia_mes', 'obs_archive_b2_month_state',
    'obs_archive_b2_pede_completo', 'obs_archive_b2_plan', 'obs_archive_b2_recompute_month',
    'obs_archive_b2_retirar', 'obs_archive_b2_run_gate', 'obs_archive_b2_teto_cor',
    'obs_archive_b2_teto_dia', 'obs_archive_can_redo', 'obs_archive_channel_archive_impact',
    'obs_archive_channel_blobs', 'obs_archive_channel_is_removed',
    'obs_archive_channel_removal_decide', 'obs_archive_channel_unit_hashes',
    'obs_archive_channel_units', 'obs_archive_class_table_guard', 'obs_archive_content_hash',
    'obs_archive_current_units', 'obs_archive_descartados_sem_releitura',
    'obs_archive_destino_declarado', 'obs_archive_due_on', 'obs_archive_expected_units',
    'obs_archive_filho_do_arquivo', 'obs_archive_first_month', 'obs_archive_heartbeat_write',
    'obs_archive_hoje_sp', 'obs_archive_insert_guard', 'obs_archive_is_terminal',
    'obs_archive_m9_pronto', 'obs_archive_manifest_rows', 'obs_archive_mark_guard',
    'obs_archive_mark_purged', 'obs_archive_mark_redo', 'obs_archive_meses_devidos',
    'obs_archive_month_files', 'obs_archive_nas_cobertura', 'obs_archive_owner_pending',
    'obs_archive_pending_units', 'obs_archive_plan', 'obs_archive_pode_desligar',
    'obs_archive_policy', 'obs_archive_read_unit', 'obs_archive_receive',
    'obs_archive_recompute_nas', 'obs_archive_record', 'obs_archive_record_core',
    'obs_archive_record_manifest', 'obs_archive_removed_channel_list', 'obs_archive_resumo_devido',
    'obs_archive_schema_fp', 'obs_archive_seal', 'obs_archive_summary_calc',
    'obs_archive_summary_rows', 'obs_archive_table_exprs', 'obs_archive_unit_due',
    'obs_archive_unit_part_info', 'obs_archive_unit_rehash', 'obs_archive_unit_source',
    'obs_archive_vermelhos', 'obs_archive_vermelhos_remocao', 'obs_archive_video_antigo_months',
    'obs_archive_vigia_remocao'
            ) loop
    execute format('drop function %s cascade', r.sig);
  end loop;
  drop table if exists
    public.obs_archive_b2_files, public.obs_archive_b2_runs, public.obs_archive_canaries,
    public.obs_archive_channel_removals, public.obs_archive_heartbeat, public.obs_archive_months,
    public.obs_archive_prechecks, public.obs_archive_purges, public.obs_archive_restores,
    public.obs_archive_summaries, public.obs_archive_sweeps, public.obs_archive_switch,
    public.obs_archive_unit_attachments, public.obs_archive_unit_parts, public.obs_archive_units cascade;
end $$;
```

Duas coisas que o bloco não faz e a migration precisa fazer: (1) repor o corpo de `competitor_channel_remove_archived(uuid,uuid,uuid)` anterior à M3b (o da `20261024000002_manutencao_m2_particoes.sql`; a M3b o trocou por cópia com a declaração do destino); (2) manter `obs_archive_is_site_admin` e `obs_archive_rehearsal` (existem antes da M3b). A lista acima vem do catálogo: 73 funções criadas pelas migrations `000002` e `000003` (menos a `is_site_admin`, mais `competitor_channel_remove`) e as 15 tabelas de `000002`. Os gatilhos das tabelas e de `competitor_channels` caem junto das funções (`cascade`).

**Depois de 28/11 não há volta atrás por migration**: só conserto para a frente.

## C. Conferências com data (Passo 4 da Tarefa 14)

Cada uma por arquivo de comandos do dono, saída em `saidas/`. Qualquer diferença vira vermelho no ledger (`m3b-site-progresso.md`) e aviso ao controlador no mesmo dia.

### 28/11, depois das 16:00 de São Paulo (as duas execuções do dia)

Série de `2026-10`, uma linha por tabela. Esperado: `selado` = t; `units_total` = `c_canais` (C: canais com `added_at` antes de 01/11); `sealed_kind` = `com_dado` na diária e `vazio_conferido` na early se ela seguir vazia; na diária `days_measured` = 29 e `days_in_month` = 31; `nas_atestado` = t; `channel_ref_distintos` = C (contado nas unidades não substituídas, que é o manifesto selado). Roda junto das consultas 1 a 4. É também a consulta do item 32.

```sql
select m.site_id, m.table_name, m.sealed_at is not null as selado, m.units_total, (select count(*) from public.competitor_channels c where c.site_id = m.site_id and c.added_at < '2026-11-01') as c_canais, m.sealed_kind, m.days_measured, m.days_in_month, m.nas_attested_at is not null as nas_atestado, (select count(distinct u.channel_ref) from public.obs_archive_units u where u.site_id = m.site_id and u.class = m.class and u.table_name = m.table_name and u.month = m.month and u.superseded_at is null) as channel_ref_distintos from public.obs_archive_months m where m.class = 'serie' and m.month = date '2026-10-01' order by m.site_id, m.table_name;
```

### 29/11, depois das 12:00

`b2_forja_ok` = t nas duas linhas. Nulo: ler `conferir-b2.jsonl` na forja (canário, controle, sincronização do NAS para o B2).

```sql
select m.site_id, m.table_name, m.b2_forja_ok_at, m.b2_forja_ok_at is not null as b2_forja_ok, m.b2_last_attempt_at, m.b2_last_attempt_result from public.obs_archive_months m where m.class = 'serie' and m.month = date '2026-10-01' order by m.site_id, m.table_name;
```

### 03/12

`amarelos` = 0 e `meses_sem_selo` = 0. Diferente: o mês de outubro está preso.

```sql
select s.id as site_id, public.obs_archive_atraso(s.id) as atraso from public.sites s where exists (select 1 from public.obs_archive_months m where m.site_id = s.id) order by 1;
```

### Primeira volta de casa desligada (mudança) ou ensaio de casa fora (Phil C2 da forja)

Uma linha com `due_since` anterior ao desligamento e `finished_at` preenchido depois de 1 ou 2 execuções. Linha ausente: o defeito voltou.

```sql
select motivo, due_since, nas_back_at, started_at, finished_at from public.obs_archive_sweeps order by due_since desc limit 1;
```

## D. Lista de funções e tabelas desta fase

Tabelas (15): `obs_archive_b2_files`, `obs_archive_b2_runs`, `obs_archive_canaries`, `obs_archive_channel_removals`, `obs_archive_heartbeat`, `obs_archive_months`, `obs_archive_prechecks`, `obs_archive_purges`, `obs_archive_restores`, `obs_archive_summaries`, `obs_archive_sweeps`, `obs_archive_switch`, `obs_archive_unit_attachments`, `obs_archive_unit_parts`, `obs_archive_units`.

Funções (`public`, 73): `competitor_channel_remove`, `obs_archive_agora`, `obs_archive_atraso`, `obs_archive_atraso_itens`, `obs_archive_attest_b2`, `obs_archive_attest_b2_dono`, `obs_archive_attest_nas`, `obs_archive_b2_aceitar_paginas`, `obs_archive_b2_atrasados`, `obs_archive_b2_file_info`, `obs_archive_b2_franquia_mes`, `obs_archive_b2_month_state`, `obs_archive_b2_pede_completo`, `obs_archive_b2_plan`, `obs_archive_b2_recompute_month`, `obs_archive_b2_retirar`, `obs_archive_b2_run_gate`, `obs_archive_b2_teto_cor`, `obs_archive_b2_teto_dia`, `obs_archive_can_redo`, `obs_archive_channel_archive_impact`, `obs_archive_channel_blobs`, `obs_archive_channel_is_removed`, `obs_archive_channel_removal_decide`, `obs_archive_channel_unit_hashes`, `obs_archive_channel_units`, `obs_archive_class_table_guard`, `obs_archive_content_hash`, `obs_archive_current_units`, `obs_archive_descartados_sem_releitura`, `obs_archive_destino_declarado`, `obs_archive_due_on`, `obs_archive_expected_units`, `obs_archive_filho_do_arquivo`, `obs_archive_first_month`, `obs_archive_heartbeat_write`, `obs_archive_hoje_sp`, `obs_archive_insert_guard`, `obs_archive_is_terminal`, `obs_archive_m9_pronto`, `obs_archive_manifest_rows`, `obs_archive_mark_guard`, `obs_archive_mark_purged`, `obs_archive_mark_redo`, `obs_archive_meses_devidos`, `obs_archive_month_files`, `obs_archive_nas_cobertura`, `obs_archive_owner_pending`, `obs_archive_pending_units`, `obs_archive_plan`, `obs_archive_pode_desligar`, `obs_archive_policy`, `obs_archive_read_unit`, `obs_archive_receive`, `obs_archive_recompute_nas`, `obs_archive_record`, `obs_archive_record_core`, `obs_archive_record_manifest`, `obs_archive_removed_channel_list`, `obs_archive_resumo_devido`, `obs_archive_schema_fp`, `obs_archive_seal`, `obs_archive_summary_calc`, `obs_archive_summary_rows`, `obs_archive_table_exprs`, `obs_archive_unit_due`, `obs_archive_unit_part_info`, `obs_archive_unit_rehash`, `obs_archive_unit_source`, `obs_archive_vermelhos`, `obs_archive_vermelhos_remocao`, `obs_archive_video_antigo_months`, `obs_archive_vigia_remocao`.

Gatilhos novos: `obs_archive_z_destino_declarado` e `obs_archive_z_truncate` (em `competitor_channels`), `obs_archive_insert_guard` (`obs_archive_units`, `obs_archive_summaries`), `obs_archive_mark_guard` (as mesmas duas) e `obs_archive_class_table` (nas tabelas com `class` e `table_name`).
