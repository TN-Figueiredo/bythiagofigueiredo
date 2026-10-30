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

`ativos` = sem `archive_frozen_at`; `leitura_mensal` = congelado e ainda online; `no_arquivo` = `archive_dropped_at` preenchido; `fora_da_coleta` = as duas últimas somadas (definição da M10a); `sem_data` = `published_at` nulo (conta à parte, entra em qualquer das outras).

```sql
select c.site_id, c.id as canal, c.channel_name, count(v.id) filter (where v.archive_frozen_at is null) as ativos, count(v.id) filter (where v.archive_frozen_at is not null and v.archive_dropped_at is null) as leitura_mensal, count(v.id) filter (where v.archive_dropped_at is not null) as no_arquivo, count(v.id) filter (where v.archive_frozen_at is not null) as fora_da_coleta, count(v.id) filter (where v.published_at is null) as sem_data from public.competitor_channels c left join public.competitor_videos v on v.competitor_channel_id = c.id group by c.site_id, c.id, c.channel_name order by c.site_id, c.channel_name;
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

Condição: zero unidades **e** zero remoções com limpeza pendente (`blobs_pending` não vazio ou `completed_at` nulo). O primeiro bloco da migration trava as duas tabelas (`lock ... access exclusive`) e recusa sozinho se qualquer condição falhar; a trava também segura um `obs_archive_record` concorrente. Antes da migration, o dono guarda o que a recusa pede: `npx supabase db query --linked "select * from public.obs_archive_channel_removals" > saidas/m3b-remocoes-antes-do-desfazer.txt`.

Ordem (código antes do banco, o inverso da subida; sem isso o botão chama `competitor_channel_remove` ausente e responde "Não deu para remover"): primeiro reverter e publicar os commits das Tarefas **13, 12, 11 e 9a**, nessa ordem; só então a migration, criada por `npm run db:new manutencao_m3b_desfaz`. O comando `obs-arquivo pode-desligar` (`arquivo/pode-desligar.ts`) e o `obs:arquivo` (peça 7, `arquivo-mensal/pendencias.ts`) passam a responder erro depois do desfazer: reverter os commits deles junto ou aceitar o erro. O `cli.ts` de remover usa `competitor_channel_remove_archived`, que a migration devolve: continua funcionando.

**A migration não é escrita à mão: é a trava abaixo, seguida de `supabase/rascunhos/m3b-recusa-desfazer.sql` e de `supabase/rascunhos/m3b-desfazer.sql`, nessa ordem, sem os `begin;`/`commit;` dos rascunhos (a migration já é uma transação).** Os dois rascunhos conferem md5 e recusam sozinhos se o corpo não for o esperado. Do `m3b-recusa-desfazer.sql` vem a devolução dos corpos de `competitor_video_purge` e `competitor_comments_purge` (E9, que chamam `obs_archive_m9_pronto`; sem isso todo apagar de vídeo e comentário falharia com `42883` depois do desfazer) e o drop de `obs_archive_m9_pronto`. Do `m3b-desfazer.sql` vêm gatilhos, o corpo de `competitor_channel_remove_archived` anterior à M3b (md5 `96fccc5423bdf22ef680692adb5f99cd`), as funções e as tabelas. Ficam de propósito: `obs_archive_is_site_admin` e `obs_archive_rehearsal` (existem antes da M3b) e a coluna `competitor_removed_items.archive_note` (guarda de "canal apagado inteiro" já escrita; coluna nula não custa). O drop do papel `obs_arquivo_leitor` não entra: o papel não existe em produção. Cole só as partes do rascunho que ficam: do `m3b-desfazer.sql`, tudo menos o `alter table ... drop column archive_note`, o bloco final do papel e o `begin;`/`commit;`.

Trava (primeiro bloco da migration):

```sql
do $trava$
declare n bigint;
begin
  lock table public.obs_archive_units, public.obs_archive_channel_removals in access exclusive mode;
  select count(*) into n from public.obs_archive_units;
  if n <> 0 then raise exception 'M3b:desfazer_recusado: % unidades existem', n using errcode = 'P0001'; end if;
  select count(*) into n from public.obs_archive_channel_removals where cardinality(blobs_pending) > 0 or completed_at is null;
  if n <> 0 then raise exception 'M3b:desfazer_recusado: % remoções com limpeza pendente; exportar antes (consulta 7 e \copy de obs_archive_channel_removals)', n using errcode = 'P0001'; end if;
end $trava$;
```

As funções que o `m3b-desfazer.sql` derruba (por nome, todas as sobrecargas) são as 72 da seção D, fora `obs_archive_m9_pronto`, que cai no rascunho da recusa; conferidas contra o catálogo das migrations `000002` a `000005`.

**Teste de ida e volta (26/10/2026, banco local 54422, em transação com rollback):** a trava recusou com 2 remoções pendentes; depois de limpar as remoções, a migration montada rodou inteira; `competitor_video_purge`, `competitor_comments_purge` e `competitor_channel_remove_archived` voltaram aos md5 `8c6d51b2…`, `2233c4ed…` e `96fccc54…`; `obs_archive_m9_pronto` e as tabelas sumiram; as migrations `000002` a `000005` reaplicaram limpas.

**Depois de 28/11 não há volta atrás por migration**: só conserto para a frente.

## C. Conferências com data (Passo 4 da Tarefa 14)

Cada uma por arquivo de comandos do dono, saída em `saidas/`. Cada conferência devolve uma coluna `veredito`. Zero linhas, erro do comando ou qualquer `VERMELHO` = vermelho no ledger (`m3b-site-progresso.md`) e aviso ao controlador no mesmo dia; `AMARELO` = conferir à mão (canal removido entre 01/11 e 28/11 aparece aqui, ver consulta 3). As consultas partem do que é esperado (sites com canal vezes as duas tabelas da série), então dado ausente aparece como `VERMELHO`, nunca como silêncio. Rodadas no 54422 sem selagem, as quatro dão `VERMELHO`, como devem.

### 28/11, depois das 16:00 de São Paulo (as duas execuções do dia)

Série de `2026-10`, uma linha por site e tabela. Esperado: `veredito` = `ok` em todas. Confere: registrado e selado; `nas_attested_at` dentro das últimas 24 h (item 32 do spec 06); `units_total` = `esperados` (de `obs_archive_expected_units`) = `channel_ref_distintos` (unidades não substituídas, o manifesto selado); na diária `com_dado`, `days_in_month` = 31 e `days_measured` = 29. `c_canais` (canais de hoje com `added_at` antes de 01/11) diferente de `esperados` é `AMARELO`: canal removido ou sem linha. Roda junto das consultas 1 a 4.

```sql
with s as (select k.id as site_id from public.sites k where exists (select 1 from public.competitor_channels c where c.site_id = k.id)), t(table_name) as (values ('competitor_video_daily'), ('competitor_video_early')), e as (select s.site_id, x.table_name, count(distinct x.channel_ref) as esperados from s cross join lateral public.obs_archive_expected_units(s.site_id, 'serie', date '2026-10-01') x group by 1, 2), l as (select s.site_id, t.table_name, m.month is not null as registrado, m.sealed_at, m.units_total, coalesce(e.esperados, 0) as esperados, (select count(*) from public.competitor_channels c where c.site_id = s.site_id and c.added_at < '2026-11-01') as c_canais, m.sealed_kind, m.days_measured, m.days_in_month, m.nas_attested_at, (select count(distinct u.channel_ref) from public.obs_archive_units u where u.site_id = s.site_id and u.class = 'serie' and u.table_name = t.table_name and u.month = date '2026-10-01' and u.superseded_at is null) as channel_ref_distintos from s cross join t left join public.obs_archive_months m on m.site_id = s.site_id and m.class = 'serie' and m.table_name = t.table_name and m.month = date '2026-10-01' left join e on e.site_id = s.site_id and e.table_name = t.table_name) select l.*, case when not l.registrado then 'VERMELHO: mês sem linha no registro' when l.sealed_at is null then 'VERMELHO: não selado' when l.nas_attested_at is null or l.nas_attested_at < now() - interval '24 hours' then 'VERMELHO: NAS sem atestado nas últimas 24 h' when l.units_total is distinct from l.esperados or l.channel_ref_distintos <> l.esperados then 'VERMELHO: unidades diferentes do esperado' when l.table_name = 'competitor_video_daily' and (l.sealed_kind <> 'com_dado' or l.days_in_month <> 31 or l.days_measured is distinct from 29) then 'VERMELHO: diária fora do esperado (29 de 31, com_dado)' when l.esperados <> l.c_canais then 'AMARELO: canais de hoje diferem dos esperados (canal removido ou sem linha); conferir' else 'ok' end as veredito from l order by 1, 2;
```

### 29/11, depois das 12:00

`ok` nas duas tabelas de cada site. `VERMELHO` com B2 não conferido: ler `conferir-b2.jsonl` na forja (canário, controle, sincronização do NAS para o B2).

```sql
select s.id as site_id, t.table_name, m.month is not null as registrado, m.b2_forja_ok_at, m.b2_last_attempt_at, m.b2_last_attempt_result, case when m.month is null then 'VERMELHO: mês sem linha no registro' when m.b2_forja_ok_at is null then 'VERMELHO: B2 não conferido pela forja; ler conferir-b2.jsonl' else 'ok' end as veredito from public.sites s cross join (values ('competitor_video_daily'), ('competitor_video_early')) t(table_name) left join public.obs_archive_months m on m.site_id = s.id and m.class = 'serie' and m.table_name = t.table_name and m.month = date '2026-10-01' where exists (select 1 from public.competitor_channels c where c.site_id = s.id) order by 1, 2;
```

### 03/12

`ok` por site. `VERMELHO` se o atraso (`amarelos`, `vermelhos`, `meses_sem_selo`) é diferente de zero, e também se está zerado mas outubro não está selado.

```sql
select s.id as site_id, a.atraso, case when a.atraso is null then 'VERMELHO: sem leitura' when (a.atraso->>'amarelos')::int <> 0 or (a.atraso->>'vermelhos')::int <> 0 or (a.atraso->>'meses_sem_selo')::int <> 0 then 'VERMELHO: outubro preso (atraso diferente de zero)' when not exists (select 1 from public.obs_archive_months m where m.site_id = s.id and m.class = 'serie' and m.month = date '2026-10-01' and m.sealed_at is not null) then 'VERMELHO: atraso zero mas outubro não selado' else 'ok' end as veredito from public.sites s cross join lateral (select public.obs_archive_atraso(s.id) as atraso) a where exists (select 1 from public.competitor_channels c where c.site_id = s.id) order by 1;
```

### Primeira volta de casa desligada (mudança) ou ensaio de casa fora (Phil C2 da forja)

Passe a hora do desligamento: `bash .superpowers/sdd/manutencao-nas/m3b/m3b-14-consultas-prod.sh casa "2026-12-10 09:00-03"` (o texto abaixo leva `$D` no lugar da hora). `ok` = varredura com `due_since` até um dia depois do desligamento e `finished_at` preenchido (depois de 1 ou 2 execuções). `AMARELO` = aberta, rodar de novo depois da 2ª execução. `VERMELHO` = nenhuma varredura para este desligamento: o defeito voltou.

```sql
select s.id as site_id, w.motivo, w.due_since, w.nas_back_at, w.started_at, w.finished_at, case when w.id is null then 'VERMELHO: nenhuma varredura aberta para este desligamento (o defeito voltou)' when w.finished_at is null then 'AMARELO: varredura aberta, ainda não terminou (rodar de novo depois da 2ª execução)' else 'ok' end as veredito from public.sites s left join lateral (select * from public.obs_archive_sweeps x where x.site_id = s.id and x.due_since <= timestamptz '$D' + interval '1 day' and coalesce(x.finished_at, 'infinity') > timestamptz '$D' order by x.due_since desc limit 1) w on true where exists (select 1 from public.competitor_channels c where c.site_id = s.id) order by 1;
```

## C2. A página Arquivo (manutenção M5)

**Onde fica e quem vê:** `/cms/youtube/competitors/arquivo`, dentro do Observatório. Quem tem permissão de edição do site (`requireSiteScope(..., 'edit')`, que chama `can_edit_site`); a pastilha e a aba do chrome usam a mesma guarda. A migration `20261027000003` entrou em produção em 27/10/2026 às 15:24 (São Paulo).

**O que cada forma quer dizer:** a grade mostra um mês por coluna e um canal por linha. A forma diz o estado do mês: octógono = pede ação ou está vermelho; régua = mês parcial (dado medido em parte dos dias); hachura = mês fora das telas (sem dado a mostrar). Cheio e liso = selado e conferido. A ordem do topo segue a regra A (dono, 27/10): o que está vermelho vem antes do que está só atrasado, e este antes do que está em dia. "Canais removidos" é só de leitura; o botão de comando é da M6.

**Quando a página diz "não medido":** quer dizer que o dado não existe ou ainda não foi lido, nunca que está tudo certo. Conferir, nesta ordem: (1) `select public.obs_archive_online_since(<site>)` (nulo = o arquivo ainda não ligou; esperado até a primeira leitura); (2) a conferência da seção C do dia; (3) o heartbeat da casa (`obs_archive_heartbeat`). Se o mês devia estar medido e não está, tratar como vermelho no ledger.

**Desfazer a M5:** `supabase/rascunhos/m5-desfazer.sql` (testado em `manutencao-m5-desfazer.test.ts`). Restaura os cinco corpos antigos e só depois derruba `obs_archive_aviso`, `obs_archive_pagina`, `obs_archive_online_since` e `obs_archive_horaria_desde`. Nunca derrubar `obs_archive_atraso_itens` nem a policy. Reverter o código do site antes ou junto: ele só tolera 42883/PGRST202 com `SAIDA_DE_MES_EXISTE = false`.

### Exceção à regra de RLS/RBAC do CLAUDE.md

A regra geral manda policy e `can_view_site`/`can_edit_site`. Estas **sete** funções de leitura da fase seguem outro caminho (E-D4, Yannis I-13): `security definer`, `revoke ... from public, anon, authenticated`, `grant execute ... to service_role`, e são chamadas pelo **cliente de serviço depois da guarda de edição** (`can_edit_site`), nunca com `grant ... to authenticated`:

`obs_archive_owner_pending`, `obs_archive_pagina`, `obs_archive_aviso`, `obs_archive_removed_channel_list`, `obs_archive_online_since`, `obs_archive_horaria_desde`, `obs_archive_channel_archive_impact`.

Código novo que as chame sem passar pela guarda de edição está errado. Função nova de leitura desta fase: ou entra nesta lista, ou segue a regra geral.

## D. Lista de funções e tabelas desta fase

Tabelas (15): `obs_archive_b2_files`, `obs_archive_b2_runs`, `obs_archive_canaries`, `obs_archive_channel_removals`, `obs_archive_heartbeat`, `obs_archive_months`, `obs_archive_prechecks`, `obs_archive_purges`, `obs_archive_restores`, `obs_archive_summaries`, `obs_archive_sweeps`, `obs_archive_switch`, `obs_archive_unit_attachments`, `obs_archive_unit_parts`, `obs_archive_units`.

Funções (`public`, 73 da M3b; a M5 acrescenta `obs_archive_aviso`, `obs_archive_horaria_desde`, `obs_archive_online_since` e `obs_archive_pagina`): `competitor_channel_remove`, `obs_archive_agora`, `obs_archive_atraso`, `obs_archive_atraso_itens`, `obs_archive_attest_b2`, `obs_archive_attest_b2_dono`, `obs_archive_attest_nas`, `obs_archive_b2_aceitar_paginas`, `obs_archive_b2_atrasados`, `obs_archive_b2_file_info`, `obs_archive_b2_franquia_mes`, `obs_archive_b2_month_state`, `obs_archive_b2_pede_completo`, `obs_archive_b2_plan`, `obs_archive_b2_recompute_month`, `obs_archive_b2_retirar`, `obs_archive_b2_run_gate`, `obs_archive_b2_teto_cor`, `obs_archive_b2_teto_dia`, `obs_archive_can_redo`, `obs_archive_channel_archive_impact`, `obs_archive_channel_blobs`, `obs_archive_channel_is_removed`, `obs_archive_channel_removal_decide`, `obs_archive_channel_unit_hashes`, `obs_archive_channel_units`, `obs_archive_class_table_guard`, `obs_archive_content_hash`, `obs_archive_current_units`, `obs_archive_descartados_sem_releitura`, `obs_archive_destino_declarado`, `obs_archive_due_on`, `obs_archive_expected_units`, `obs_archive_filho_do_arquivo`, `obs_archive_first_month`, `obs_archive_heartbeat_write`, `obs_archive_hoje_sp`, `obs_archive_insert_guard`, `obs_archive_is_terminal`, `obs_archive_m9_pronto`, `obs_archive_manifest_rows`, `obs_archive_mark_guard`, `obs_archive_mark_purged`, `obs_archive_mark_redo`, `obs_archive_meses_devidos`, `obs_archive_month_files`, `obs_archive_nas_cobertura`, `obs_archive_owner_pending`, `obs_archive_pending_units`, `obs_archive_plan`, `obs_archive_pode_desligar`, `obs_archive_policy`, `obs_archive_read_unit`, `obs_archive_receive`, `obs_archive_recompute_nas`, `obs_archive_record`, `obs_archive_record_core`, `obs_archive_record_manifest`, `obs_archive_removed_channel_list`, `obs_archive_resumo_devido`, `obs_archive_schema_fp`, `obs_archive_seal`, `obs_archive_summary_calc`, `obs_archive_summary_rows`, `obs_archive_table_exprs`, `obs_archive_unit_due`, `obs_archive_unit_part_info`, `obs_archive_unit_rehash`, `obs_archive_unit_source`, `obs_archive_vermelhos`, `obs_archive_vermelhos_remocao`, `obs_archive_video_antigo_months`, `obs_archive_vigia_remocao`.

Gatilhos novos: `obs_archive_z_destino_declarado` e `obs_archive_z_truncate` (em `competitor_channels`), `obs_archive_insert_guard` (`obs_archive_units`, `obs_archive_summaries`), `obs_archive_mark_guard` (as mesmas duas) e `obs_archive_class_table` (nas tabelas com `class` e `table_name`).

## Snapshots por tempo (M9-snap, Tarefa 9b; Tarefa 14, Passo 2)

Pela NFS da forja cada snapshot do NAS aparece vazio: o copiador não lê dentro, só lista os nomes e a hora (`auto-AAAA-MM-DD_hh-mm`, hora de São Paulo, conferida com o `mtime` do diretório). Quem decide é o banco: um snapshot só pode guardar o prefixo se foi tirado antes de ele sumir (`nas_absent_first_at` + 1 h), e a linha só libera depois de 14 dias. A página mostra "Aguardando os snapshots do NAS há N dias; libera por volta de DD/MM, sem ação sua." (espera normal) ou uma frase âmbar quando a espera não termina sozinha. Motivo da frase âmbar e o que fazer:

| Motivo (`snap_bloqueio`) | Em palavras | O que o dono faz |
|---|---|---|
| `fora_do_padrao` | há snapshot manual ou de outra tarefa | decidir se apaga o snapshot manual (decisão do dono, nunca do agente) |
| `retido` | snapshot de antes da remoção que não expira | procurar hold ou retenção maior que 14 dias (`midclt call pool.snapshot.query`); a linha só libera quando ele sair |
| `lista_vazia` | a forja não vê nenhum snapshot | conferir a tarefa de snapshot e a montagem `ro` na forja |
| `mtime_diverge` / `relogio` | a hora dos snapshots não confere | conferir o relógio do NAS; ligar `crossmnt` no NFS invalida a checagem de `mtime` (trocar de método no mesmo dia) |
| `ilegivel` | a forja não leu a lista | ver `snap_ilegivel` no log do copiador (EIO, ESTALE) |

Duas ressalvas conhecidas (Phil, re-revisão 29/10):

- **Âmbar sem histerese:** o `snap_bloqueio` vem da última leitura. Uma leitura `ilegivel` isolada (EIO de um instante) pinta a frase de âmbar até a execução seguinte do copiador; some sozinha, não é incidente.
- **`plano_invalido` repetido:** se o site reemitir a exportação de um caminho sob um prefixo com ausência aberta, o copiador recusa (`sob_prefixo_ausente` em `contagens`), deixa o arquivo em `_recebendo` e sai `plano_invalido` a cada rodada até a linha fechar (~15 dias). Esse vermelho prolongado pode mascarar outra falha: sempre conferir o contador `sob_prefixo_ausente` no log do copiador antes de supor que é só isso (ver Tarefa 14).

## `obs:arquivo` e `obs:expurgar` já não são só leitura (M9, Tarefa 8)

- `npm run -s obs:arquivo | ssh forja 'bash -s'` (pendências) e `npm run -s obs:expurgar -- --item <n> | ssh forja 'bash -s'` (expurgo de um item) **escrevem no site** (rota C14: `abrir`, `registrar`, `bloquear`) e **leem a forja por ssh** (montagem `ro`). Nada escrevem no NAS: quem grava é o script que o dono pipa para a forja. O stdout pode levar até cerca de 340 MB de base64.
- Argumento inválido imprime um script de falha no stdout (o pipe nunca sai verde com script vazio); o motivo vai ao stderr.
- Cópias do expurgo ficam em `.superpowers/sdd/manutencao-nas/copias/` (raiz do repositório, qualquer que seja o diretório de onde se roda; fora do git, 0600). Elas contêm comentários de terceiros: o Mac as apaga sozinho quando o item conclui, fica `bloqueado` ou o NAS já a recebeu (`apagar_antigas`/`conferir_b2`). Se um item de `obs:expurgar` terminar com o aviso "este Mac não a tem guardada", é **cópia perdida**: o site registrou a cópia e o Mac não a guardou; hoje o conserto é pedir o desbloqueio/reabertura do alvo no painel. Dívida: passo `reabrir` na C14 (servidor) para o Mac regenerar a partir da versão antiga.
