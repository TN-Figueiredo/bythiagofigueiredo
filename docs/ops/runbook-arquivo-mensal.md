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
- Cópias do expurgo ficam em `.superpowers/sdd/manutencao-nas/copias/` (raiz do repositório, qualquer que seja o diretório de onde se roda; fora do git, 0600). Elas contêm comentários de terceiros: o Mac as apaga sozinho quando o item conclui ou o NAS já a recebeu (`apagar_antigas`/`conferir_b2`); em `bloqueado` ela NÃO é apagada e fica sem prazo (ver a dívida em "Alvo bloqueado"). Se um item de `obs:expurgar` terminar com o aviso "este Mac não a tem guardada", é **cópia perdida**: o site registrou a cópia e o Mac não a guardou; hoje o conserto é pedir o desbloqueio/reabertura do alvo no painel (com alvo em `aguardando_nova` o desbloqueio recusa com `alvo_fora_de_bloqueado`: sem o passo `reabrir` abaixo é beco sem saída). Dívida: passo `reabrir` na C14 (servidor) para o Mac regenerar a partir da versão antiga.

## Expurgo enxuto (M9, Tarefa 14)

O expurgo tira de dentro do arquivo (NAS e B2) as linhas de um vídeo ou de comentários que o dono apagou no site. Aqui só o que falta dizer; as seções "Snapshots por tempo" e "`obs:arquivo` e `obs:expurgar`" acima valem como estão.

**Estado hoje (30/10).** O interruptor da M9 está **ligado desde 29/10 22:34** e **nenhum item real rodou ainda**: a primeira prova em dado real só vem depois da selagem de 28/11 (conferência datada no ACOMPANHAMENTO; sem item real, registrar e reagendar). A limpeza de canal removido é da M9b (plano `docs/superpowers/plans/2026-10-30-manutencao-nas-m9b-canal.md`): o canal anda por `pedido`, `apagado_nas`, `apagado_b2` e `concluido` (função `obs_archive_removal_advance`) e só conclui com os atestados do NAS, dos snapshots e do B2. **Não existe `expurgar --canal`** (decisão de 30/10, Decisão 1): a limpeza do arquivo é do `obs:arquivo`.

**Ciclo do canal removido (M9b).** O canal anda `guardado` (ou `sem_destino`) -> **Apagar do arquivo** na tela (quem administra; diálogo digita o nome, ou o código no `sem_destino`) -> `pedido` -> `npm run -s obs:arquivo | ssh forja 'bash -s'` (apaga arquivo a arquivo, conferindo sha256 do registro, e limpa as pastas vazias do canal, inclusive `_recebendo/` e `_recebendo/_quarentena/`) -> o copiador atesta a ausência -> 2ª conferência com 11 h -> `apagado_nas` -> snapshots do NAS (cerca de 14 dias e 8 h) -> `obs:arquivo` imprime `B2-PAINEL: <nome>` e o dono apaga no painel do B2 -> `apagado_b2` -> `concluido`. Nenhum comando novo: **sem `expurgar --canal`, sem SQL, sem kit.** O `obs:arquivo` repete sem risco: a 2ª rodada diz `JA-APAGADO` e sai 0. Saída esperada: `FEITO`, sem `RESTA`. Guarde a saída em `.superpowers/sdd/manutencao-nas/saidas/` e a data de cada estado no ledger. Antes da 1ª rodada, conferir o que está parado (leitura): `select channel_ref, decided_at, completed_at from public.obs_archive_channel_removals where archive_decision = 'apagar' and completed_at is null;`. A ordem do deploy (passos 3 e 4: consulta de parada e T5 por último) está no plano da M9b.

A tabela do que a pendência diz quando falta algo (`falta`): `snapshots` (espera de 14 dias, ver abaixo), `blobs` (miniaturas do Blob ainda não apagadas; a variável dos blobs está desligada), `imagens` (não se sabe se há miniaturas online e o dono não deu o aval), `lote_e10` (o canal veio de exportação e o lote ainda não foi conferido), `so_prefixo` (só restam pastas, sem arquivo conhecido: o script as limpa quando vazias). Nenhuma é erro; todas dizem o que falta.

**Se `obs:arquivo` terminar com `NÃO TERMINOU`**, leia as linhas `PULADO` e `RESTA` acima dele. `PULADO` é montagem ou sentinela ausente ou sha256 divergente: nada foi apagado, resolva a causa e rode de novo.

### Sobrou arquivo no canal

Quando o script imprime `RESTA <filho>/<prefixo>: a pasta não ficou vazia; veja "Sobrou arquivo no canal" no runbook`, a pasta tem algo que o registro não conhece (ou que o `find` não pôde apagar por permissão). O script nunca apaga o que não conhece. Quem decide é o dono, nunca um agente.

1. **Leitura** (na forja, `ssh forja '<leitura>'`), trocando `<filho>` por `numerico` ou `texto` e `<prefixo>` pelo da mensagem:

```
ssh forja 'find /mnt/arquivo/escrita/<filho>/<prefixo> -xdev -ls'
```

   (`/mnt/arquivo/escrita` é a montagem de escrita do script, `ARQ_MONTAGEM_ESCRITA`). Anote o que há: nome, tamanho, data.
2. **`RESTA` em `_recebendo/_quarentena/`**: tende a se resolver sozinho. A quarentena do copiador é de 30 dias (`copiar.py:37`); espere o prazo antes de mexer.
3. **Decisão do dono:** se o arquivo for resto sem valor (parcial, temporário), ele apaga à mão, por ssh, só o que a leitura mostrou: `rm -- <arquivo>` e, depois, rodar `obs:arquivo` de novo, que remove a pasta vazia. Se não souber o que é, deixa: o canal fica em `apagar_antigas` e nada se perde.
4. **Nunca `rm -r` na pasta do canal** por pressa: o `rm -r` apaga arquivo que ninguém conferiu. Se um `RESTA` real e frequente aparecer, abre-se `expurgar --canal` como tarefa própria (Decisão 1 do plano).
5. **Arquivo restaurado do B2** com `restaurar_do_b2.py --file-id <id>` (ferramenta manual do dono, sem site) reaparece no NAS como `presente` e reabre a limpeza: rode `obs:arquivo` de novo.

### Lote da E10 depois do `concluido` (Decisão 4)

`concluido` não apaga o export da E10 (`~/Workspace/arquivo-observatorio/<lote>` no Mac e o destino do `comandos-nas` no NAS): `deleted_at` do lote quer dizer "linhas apagadas do banco". Ele guarda comentários de terceiros (LGPD). Depois do `concluido`, o dono apaga os dois à mão (a tela avisa) e registra no ledger do passo 19:

```
rm -r ~/Workspace/arquivo-observatorio/<lote>
ssh forja 'rm -r <destino do comandos-nas>/<lote>'
ls ~/Workspace/arquivo-observatorio/<lote>
```

O `ls` deve dizer que não existe; guarde essa saída em `saidas/`. Conferir o caminho com `ls` antes do `rm -r`.

### Voltar atrás: devolver o canal a `guardado` (provado na T6)

Só vale para canal **sem arquivo apagado** (`obs:arquivo` ainda não rodou); depois disso nada volta. O texto abaixo foi provado dentro de `begin ... rollback` em `manutencao-m9b-canal.test.ts`. **Apagar** as linhas de `obs_archive_absence` do canal, nunca só encerrá-las: encerradas, um novo `decide` não reabre a prova de ausência e o canal conclui sem ela. Troque o site e o canal:

```sql
update public.obs_archive_channel_removals set archive_decision = 'guardar' where site_id = '<site>' and channel_ref = '<canal>' and completed_at is null;
update public.obs_archive_units set purged_at = null, purged_by = null, purge_ref = null where site_id = '<site>' and channel_ref = '<canal>' and purge_ref = 'remocao:<canal>';
update public.obs_archive_summaries set purged_at = null, purged_by = null, purge_ref = null where site_id = '<site>' and channel_ref = '<canal>' and purge_ref = 'remocao:<canal>';
delete from public.obs_archive_absence where site_id = '<site>' and alvo = 'canal:<canal>';
```

**Interruptor.** O expurgo é ligado por site (`select public.obs_archive_m9_ligar('<site>', true);` no painel do banco, devolve boolean; só o `postgres` executa; erro `captura_ausente` se a captura não está no ar). Está ligado hoje. Enquanto desligado, o kit novo e o antigo se comportam igual e a prova de ausência não anda.

**Retorno de emergência.** Só o dono pede. Se o código do site precisar voltar para uma versão anterior à M9:

1. `select public.obs_archive_m9_ligar('<site>', false);`
2. Rodar `supabase/rascunhos/m9-emergencia.sql` (restaura a `obs_archive_owner_pending` da M3b, `versao 1`).

O resto da M9 fica, compatível com o código antigo enquanto o interruptor estiver desligado. Efeitos que ninguém avisa: (a) apagar vídeo ou comentário no site passa a falhar com `m9_desligada` enquanto durar, e a fila "Saíram do YouTube" para; (b) desligar NÃO recolhe um apagar já liberado: **entre os dois passos, não rode `obs:arquivo`**, porque ele ainda imprime `apaga_conferido`. Para voltar a M9: reaplicar a `obs_archive_owner_pending` da migration `20261029000004` (corpo vigente, com as chaves de espera por snapshot; reaplicar a da 000002 tira essas chaves) e depois ligar de novo.

### Ciclo mensal com expurgo

1. `npm run -s obs:arquivo | ssh forja 'bash -s'` mostra `copiar`: o dono roda a linha que ele imprime.
2. O copiador confere a unidade nova. O item só passa a `apagar_antigas` com a nova inteira no NAS e no B2 e o mês selado de novo depois dela. Entre a 1ª e a 2ª linha podem passar dias; é espera normal, não defeito. A frase `ESPERA` diz o que falta:

| `falta` | O que significa | O que o dono faz |
|---|---|---|
| `unidade_no_nas`, `resumo`, `manifesto` | a forja ainda copia ou refaz o arquivo | nada, o ciclo segue |
| `b2_nova` | a versão nova ainda não chegou ao B2 ou o B2 do mês não foi atestado depois do selo | nada, a sincronização envia |
| `versao_em_curso`, `segunda_conferencia`, `conferencia_nas_recente`, `b2_sync` | conferências do NAS e do B2 (a 2ª só 11 h depois da 1ª; a última do NAS no máximo 24 h) | nada, rodam sozinhas |
| `snapshots` | os snapshots do NAS de antes da remoção ainda não expiraram (14 dias) | nada; ver "Snapshot que ainda guarda o canal" |
| `m9_desligado` | interruptor desligado | ligar só se for o caso (ver Interruptor) |

3. Nova rodada: a linha de apagar as versões antigas apaga no NAS e o item passa a `conferir_b2` só depois de a ausência ser confirmada duas vezes e dos snapshots; mínimo de cerca de 15 dias entre o apagar e o `conferir_b2`.
4. No `conferir_b2` o script imprime `B2-PAINEL: <nome>`. No painel do B2 (Buckets, Browse Files), com **"mostrar versões" ligado, apague todas as versões de cada nome, inclusive a marca de ocultação**. O `conferir-b2` diário confere e, sem nenhuma versão, o item conclui sozinho. **Não há atestado do dono.** Conferência: `select alvo, b2_nomes, b2_absent_at from public.obs_archive_absence where encerrada_at is null and b2_absent_at is null;` antes e depois da limpeza; depois do `conferir-b2` seguinte `b2_absent_at` fica preenchido.
5. Versão antiga de texto superada por outra sai em `antiga:<uuid>` 30 dias depois de a nova ser **recebida** pelo NAS (`received_at`), desde que o NAS a tenha atestado há até 48 h e o B2 há até 7 dias; versão numérica superada só entra se tiver item removido. Cerca de 45 dias até o item encerrar.

As chaves `blobs`, `imagens`, `lote_e10` e `so_prefixo` não estão na tabela: são só de canal e não aparecem até a M9b.

`competitor_removed_items` nunca é podada: o item concluído continua lá.

### Alvo bloqueado

Item em `bloqueado` tem um de quatro motivos: `antiga_ausente`, `antiga_divergente`, `grande_demais` (conjunto acima do limite de uma rodada, 64 MB) ou `contagem_divergente`; `depende_m10b` não libera por aqui. Restaurar a unidade só resolve `antiga_ausente` e `antiga_divergente`: com `grande_demais` ou `contagem_divergente` desbloquear e rodar bloqueia de novo, e a decisão é do dono caso a caso. O `<alvo_id>` não sai do `obs:arquivo`; achar assim: `select t.id as alvo_id, t.item_id, t.motivo, t.table_name, t.month from public.obs_archive_item_targets t where t.estado = 'bloqueado';`. A restauração é no NAS (pela NFS o snapshot aparece vazio). Depois, no painel do banco: `select public.obs_archive_expurgo_unblock('<site>', <alvo_id>);`. **Ler o `status` do resultado**: `recusado` vem sem erro e o painel fica verde. Com alvo em `aguardando_nova` o desbloqueio recusa (`alvo_fora_de_bloqueado`).

**Dívida conhecida (T8).** A cópia local do item em `bloqueado` não tem prazo: o Mac a guarda até o item concluir, ser desbloqueado ou o NAS recebê-la. Um alvo esquecido em `bloqueado` deixa comentários de terceiros no disco do Mac. Revisar `.superpowers/sdd/manutencao-nas/copias/` ao ver um `bloqueado` parado.

### Snapshot que ainda guarda o canal (`falta 'snapshots'`)

Com `snap_bloqueio` nulo a espera é de cerca de 14 dias e acaba sozinha. Com motivo, o que o dono faz está na tabela de "Snapshots por tempo" acima (`fora_do_padrao`, `retido`, `lista_vazia`, `ilegivel`, `mtime_diverge`/`relogio`). Mudou a retenção do NAS: revisar D-M9-9b. Apagar snapshot à mão é decisão do dono, nunca de agente. O mesmo vale para item e `antiga:`.

### Ligar a limpeza de blobs do canal

`OBS_ARQUIVO_LIMPEZA_CANAL` (liga o botão "Apagar do arquivo" e a promessa do comando na tela) e `OBS_ARQUIVO_LIMPEZA_BLOBS` (a tentativa diária de apagar as miniaturas) são **variáveis separadas**, ambas **desligadas** (ausentes no Vercel). A ordem é a do plano da M9b: primeiro o código no ar, depois o `obs:arquivo` com a T5 (`git pull` no Mac), depois `OBS_ARQUIVO_LIMPEZA_CANAL=on`. `OBS_ARQUIVO_LIMPEZA_BLOBS=on` apaga miniaturas do Blob **sem volta** e só liga quando o canal de teste chegar a `apagado_b2` (NAS, snapshots e B2 já provados), depois de repetir nesse dia a leitura de `blobs_pending` e mostrá-la ao dono; quem liga é o controlador, com o "pode" dele (Decisão 2). Enquanto ausente, o canal fica com a pendência `falta 'blobs'`, nunca `concluido`.

### `obs:arquivo` sai com `versao` errada

O site e o Mac estão em versões diferentes (o leitor do Mac aceita só a versão que conhece e imprime o script de falha). Promover o que falta (site ou `git pull` no checkout do Mac) e rodar de novo. Antes do primeiro `obs:arquivo` depois do deploy, `git pull` no checkout do dono.

### Limites do expurgo (o que ele NÃO prova nem apaga)

- **Conferência por amostra na parte 1 (Phil M4).** Quando a versão nova da unidade vem em várias partes, o script do dono confere o sha256 só da parte 1 antes de apagar a antiga. O banco, antes de liberar, já exigiu a nova inteira recebida e atestada (`obs_archive_item_falta`); a conferência do script é a segunda camada, não a única.
- **Mês com versão mais nova vazia (Phil M5).** Se a versão mais nova do mês está vazia, o expurgo pula esse mês: as linhas do item que estiverem numa versão anterior ficam no NAS e no B2 sem alvo e sem bandeira, e o item aparece como limpo. Nenhuma tela mostra isso; a consulta abaixo lista meses candidatos (não prova que o item está neles) e a decisão é do dono, caso a caso:

```sql
with ult as (select distinct on (site_id, class, table_name, channel_ref, month) * from public.obs_archive_units where lost_at is null and purged_at is null and class <> 'ensaio' order by site_id, class, table_name, channel_ref, month, version desc)
select u.class, u.table_name, u.channel_ref, u.month, u.version as vazia, o.version as anterior, o.row_count from ult u join public.obs_archive_units o on o.site_id = u.site_id and o.class = u.class and o.table_name = u.table_name and o.channel_ref = u.channel_ref and o.month = u.month and o.version < u.version and o.row_count > 0 and o.lost_at is null and o.purged_at is null where u.row_count = 0 order by 3, 4;
```

- **Dívida nomeada: `purged_at` no núcleo (Hanna H5, Yannis I5).** Arquivo citado num manifesto e ausente, de unidade ou resumo com `purged_at`, ainda não está provado como "não é `arquivo_ausente`" em `conferir-b2`, `atestar-b2`, `ensaiar-restauracao` e na restauração do kit (`arquivo/restaurar_do_b2.py`, `arquivo/conferir-b2/conferir.py` não mencionam `purged`). Vale para vídeo e comentário, ou seja, é do núcleo, não da M9b. Falta o teste no kit ou decisão escrita do dono. A parte de canal do item 165 (restauração pula canal removido) é da M9b.
