# Manutenção M6: a saída do mês (destacar, descartar, trazer de volta, composta, interruptor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Emenda 23/10 (retomada)

Origem: re-revisões de hoje, `.superpowers/sdd/manutencao-nas/replan-23-10/onda0-rerevisao-m6-m9-phil.md` (N6-1 a N6-4) e `...-yannis.md` (N-M6-1, N-M6-2). Onde os dois pedem a mesma coisa, uma emenda só. Tabela completa: `replan-23-10/onda0-emenda-m6-m9.md`.

| Achado | Resumo | Onde foi consertado neste plano |
|---|---|---|
| N6-1 (Phil, importante) | CP13 mede com o volume de 14/10; o volume dobrou, a horária não é semeada, sem cauda, sem fator de máquina | Tarefa 6: bullet "Volume por razão medida", teste "CP13 por razão medida", Step 4 |
| N6-2 (Phil) + N-M6-2 (Yannis) | Dívida 3 e 4 desatualizadas (a E9 já mapeia a recusa); dois caminhos do apagar sem teste; frase tem de dizer "algum mês" | "Dívida técnica declarada" itens 3 e 4; Tarefa 2 (teste 126b); Tarefa 13 (arquivos, teste de `apagarCanalSemGuardar`, nota da frase) |
| N6-3 (Phil, fato para a Hanna) | M6b não arma antes de ~01/04/2027; as saídas manuais de 01/02 e 01/03 são o que o dono faz | "Partes", nota abaixo desta tabela |
| N6-4 (Phil, ordem) | Bateria roda no 54422 com esquema de 14/10; M6 só roda depois da M3b em produção | Tarefa 0, "Pré-condições de ambiente (emenda 23/10)" |
| N-M6-1 (Yannis, importante) | `delete` cru de canal nos testes recusa com `destino_do_arquivo_nao_declarado` quando a M3b está aplicada | Tarefa 0 (helper `apagarCanalDeclarando`), Tarefa 2 (teste 127), Tarefa 6 (`afterAll` e `finally` do CP13) |

Nota N6-3: o teste do item 46 exige 3 saídas reais feitas pelo dono (01/02, 01/03, 01/04, horária de out/nov/dez); a diária de outubro sai depois. "M6b antes de abril/2027" está certo; "antes de o dono embarcar" não acelera nada. A M6b pode esperar a M5/M7/M10 sem risco de dado. Meta de Phil: **M6a no ar até 15/01/2027** (o banco chega a 85% entre 24/01 e 03/03/2027). Aceite do desvio da Decisão 9 (motivo 7 por dia de São Paulo): **dado por Phil em 23/10**; falta o de Hanna.

**Goal:** o banco ganha as quatro funções que tiram um mês de série do online (`obs_archive_detach_month`, `obs_archive_discard_month`, `obs_archive_reattach_month`, `obs_archive_drop_month`), com o portão das 14 condições medido no instante da chamada, a regra dos dois passos por tabela, os gatilhos do invariante do mês destacado, o interruptor do automático e o sinal sem serrote; o site ganha a peça 3 (tirar o mês), a peça 4 (o interruptor), o chip "automático desligou", a frase de "Remover canal" com mês fora das telas e a tarefa diária `saida_automatica`.

**Architecture:** todo o SQL nasce num rascunho (`supabase/rascunhos/m6.sql`, TRAVA M6-1: fora da pasta que o `db push` lê) dividido em partes marcadas `-- M6 PARTE n`, aplicado pelos testes de integração em `begin … rollback` no `bythiago_int`; na Tarefa 14 vira a migration `*_manutencao_m6_saida.sql` por `npm run db:new`. O portão é uma função interna (`obs_archive_gate`) que recebe a relação a medir (partição anexada, ou a tabela `_saida` destacada) e a lista de condições de cada operação; o recálculo do hash por unidade roda antes da trava e pode vir pronto de conferências por canal (`obs_archive_precheck_unit`, gravadas em `obs_archive_prechecks`, válidas por 10 minutos: regra CP13), e sob a trava só se reconta contagem e soma e se compara o resumo da linha inteira (`row_digest`, gravado pela conferência; C-1). No site, um módulo só de servidor (`arquivo-mensal/saida.ts`) é o único caminho até as funções: as ações do botão e a tarefa da agenda o chamam; as frases são módulos puros com os literais do mockup aprovado.

**Tech Stack:** PostgreSQL 17 (plpgsql, `security definer`, `search_path = ''`), Supabase (PostgREST `rpc`), Next.js 16 server actions, React 19 client components, Zod, Vitest (`pg` direto no banco local de integração).

**Spec:** `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/` — `02-desenho-e-contrato-de-dados.md` §10.5 (as funções, o portão, o invariante, o estado destacado, os dois passos, o teto de tempo, a autorização, o somente leitura), `03-ciclo-falhas-e-ensaio.md` §12.4 (o interruptor) e §12.5 (o sinal), `04-telas.md` §14.3 (peça 3 e a frase de "Remover canal") e §14.4 (peça 4), `05-*.md` §15.1 (linha M6) e §16.6, `06-aceite-e-riscos.md` itens 40-49, 88-94, 114-118, 122, 124-130 e R27. Mockup aprovado (fonte das telas, M4 concluída): `docs/superpowers/mockups/2026-10-14-manutencao-nas/19-mes-fora-do-banco/` (`arquivo.js` T1-T11, `arq-dados.js` m8/m8a/m8b/m9/m10, `interruptor.js` MOTIVOS/DESLIGA/estados) e `remover-canal/rc.js` (`d7()`); `PLANO-DAS-TELAS.md` §7 e §10b. Desenho vigente da M3b (vale mais que o spec onde diverge): `supabase/rascunhos/m3b.sql`, `apps/web/test/helpers/m3b.ts`, planos `2026-10-14-manutencao-nas-m3b-site.md` e `-m3b-forja.md`.

## Partes: M6a (saída manual) e M6b (saída automática)

Corte pedido por Yannis e aprovado pela Hanna com um ajuste (`.superpowers/sdd/manutencao-nas/hanna-corte-m6.md`). O plano é um arquivo só; cada tarefa leva a marca **[M6a]** ou **[M6b]** no título. A M6a é entregável sozinha (o dono tira, libera e traz de volta um mês pela tela, com o banco e a peça 4 em "não pode ligar"); a M6b é o automático. Se a Hanna ou o dono mandarem unir, a junção é trivial: tirar as marcas, juntar PARTE 6 e PARTE 7 do rascunho numa só migration e apagar o `acoes-interruptor.ts`.

| Parte | Tarefas | O que o dono ganha |
|---|---|---|
| **M6a** | 0, 1, 2, 3, 4, 5, 6, **7a**, 9, 11, 12, **12b**, 13, **13b**, 14 | O portão das condições, `detach`, `discard`, `drop`, `reattach`, o invariante do mês destacado, os vermelhos e "em trânsito", a peça 3 encaixada na página do Arquivo (slots da M5, D-M5-14), a peça 4 só em "ainda não dá para ligar" (com os contadores "N de 3" saídas e "N de 2" simulações), "Remover canal" com mês fora das telas, "Encerrar o dado de teste" (item 121). Migration 1 (PARTES 1 a 6). |
| **M6b** | **7b**, 8, 10, **11b**, **12c**, **9b**, **14b** | O interruptor (ligar, desligar, vigia, desliga sozinho), a tarefa diária `saida_automatica`, o sinal sem serrote, o chip "automático desligou" e os demais estados da peça 4. Migration 2 (PARTE 7). |

**Da Tarefa 7 (Hanna H-1 e H-3):** na M6a ficam `obs_archive_switch_counts` (com `grant` a `service_role`: é o leitor mínimo dos contadores), `obs_archive_switch_sim_seen` (conferido por leitura: grava só `sims_seen` e `last_sim_at` em `obs_archive_switch`, não chama `arm` nem lê `armed_at`; a ação `simularSaida` o chama), `obs_archive_em_transito` (a Tarefa 13 lê), `obs_archive_vermelhos_saida` com a redefinição de `obs_archive_vermelhos` (os vermelhos de proteção ausente, partição sumida, trânsito longo e esquema divergente; **sem** o vermelho do desarme nas 72 h, que é da M6b), e as colunas novas de `obs_archive_switch` (Tarefa 3). Na M6b ficam `switch_state` (todos os estados), `arm`, `disarm`, `seen`, `watch`, `after_refusal`, `exit_candidates`, `armed_sites`, `next_exit` e o vermelho do desarme. Na M6a a peça 4 só conhece `nao_existe` e `nao_pode` (e `null` = não medido): descartes e simulações vêm de `switch_counts`.

**Os 7 critérios de aceite da M6a (texto do parecer da Hanna):**

1. Bateria da M6a verde no `bythiago_int` (54422), saída em arquivo, incluindo as corridas da Tarefa 6 com duas conexões, os testes C-1 e C-2 (conferência velha não passa a mudança de coluna que não é contagem nem soma; dois `detach`/`discard` simultâneos dão `ja_destacado`/`ja_descartado`) e os cinco casos do Review Focus. Confere: controlador.
2. Phil e Yannis de acordo com o plano já dividido, com o ajuste H-1 aplicado (portão de revisão).
3. Migration aplicada pelo dono com `db:push:prod` na janela; antes, `migration list --linked` mostra só a pendente do dia. Confere: controlador, por leitura.
4. Em produção: os gatilhos `obs_archive_a_mes_destacado` e `obs_archive_a_mes_destacado_truncate` existem em `competitor_videos` e `competitor_channels` com `tgenabled` em `'O'` ou `'A'`; as funções de saída só têm `EXECUTE` para `service_role` e as internas para ninguém. Confere: Phil, por consulta de leitura.
5. Na página do Arquivo em produção, autenticado (Gio, no navegador): a simulação de um mês real devolve "nada saiu" e lista o que falta em frase do catálogo (nunca código do banco; hoje espera-se falta de atestação ou "cedo demais"); a peça 4 aparece em `nao_pode` com "0 de 3" saídas e sem botão de ligar; nada mudou em `obs_archive_months`.
6. "Remover canal" sem mês em trânsito funciona como hoje (regressão, Gio); com mês destacado recusa com a frase D7 e não apaga nada (provado no teste de integração da Tarefa 13; confere o controlador).
7. Nenhuma peça do automático vai junto: o código da M6a não contém `saida_automatica`, `switch_arm`, `switch_watch` nem `OBS_ARQUIVO_AUTO_DROP`, e o catálogo da agenda não tem a ordem 11. Confere: controlador, por `grep`.

**Gatilhos de prazo (Hanna):** a Tarefa 10 (sinal sem serrote) em produção **antes de 01/02/2027**; as Tarefas 7b e 8 no ar **antes de abril/2027**. Na prioridade do §15.1 a M6b vem depois da M9. Recomendado no ar antes de o dono embarcar para a Ásia. A M8 e a M10c esperam a **M6a**; a M10b não depende da M6. A Tarefa 11 espera "3 a 6 e a parte da 7 que fica na M6a" (7a); a Tarefa 12 entrega a peça 3 completa e a peça 4 só em `nao_pode`. Estimativa de dias: não inventada; a medida é que a M6b ocupa cerca de 1.100 das 4.385 linhas do plano original.

## Global Constraints

- Migration só por `npm run db:new manutencao_m6_saida` (nunca à mão); idempotência: `drop trigger if exists` antes de `create trigger`, `drop constraint if exists` antes de `add constraint`, `create or replace function`, `add column if not exists`.
- Produção já tem `20261014000007` (A5): função nova em `public` nasce sem `EXECUTE` para `anon`/`PUBLIC`; toda função desta etapa leva `revoke all ... from public, anon, authenticated` e, quando a rota ou a ação a chama, `grant execute ... to service_role`; as internas revogam também de `service_role`.
- Todas as funções de saída: `security definer`, `search_path = ''`, `p_dry_run boolean default true`, retorno `jsonb` com `status` (`ok` | `recusado` | `simulacao`) e `faltam` (lista de `{codigo, ...}`); `execute` só para `service_role`.
- Nome da partição e da tabela destacada sempre derivado (`obs_part.nome_da_particao(tabela, mês)` e o sufixo `_saida`); a tabela só vale se estiver na política com `exit_mode = 'particao'`; nenhum argumento entra em SQL dinâmico sem `format('%I')`/`%L` ou `regclass`.
- `lock_timeout` de 3 s fixado dentro da função (`set_config('lock_timeout', '3s', true)`; também cobre a espera pela linha do registro). **Ordem das travas (C-2, Yannis; Decisão 11):** (1) leituras e o portão completo, com recálculo de hash, SEM trava; (2) `select ... from obs_archive_months where class = ... and table_name = ... and month = ... order by site_id, table_name for update` (todas as linhas do mês, de todos os sites, na mesma ordem em que a M3b trava `order by m.table_name`: `m3b.sql:670,830,1212`); (3) `competitor_videos` (`share row exclusive`), `sites` (só se a tabela tem chave para ela), tabela-mãe, partição; (4) **sob a trava, reler o registro e reavaliar** o estado e as condições baratas (`ja_destacado`, `ja_descartado`, `nao_destacado`, a relação ainda filha da mãe, o portão sem hash) antes de mexer em qualquer coisa. O papel `service_role` NÃO ganha `statement_timeout` próprio.
- Gatilhos do invariante: função `obs_archive_block_delete_while_detached`, `volatile`, `security definer`, `search_path` vazio, `raise exception 'mes_destacado_em_transito'` (SQLSTATE `P0001`) com os meses (tabela e `mm/aaaa`) no `detail`. Nomes `obs_archive_a_mes_destacado` (linha) e `obs_archive_a_mes_destacado_truncate` (instrução): em ordem alfabética antes de `obs_archive_z_destino_declarado` e `obs_archive_z_truncate` (M3b). Ligado = `tgenabled` em `'O'` ou `'A'`.
- Ação do botão: guarda de administrador do site NO TOPO (`denyUnlessSiteAdmin`), antes de `getSupabaseServiceClient()`; `p_by` vem da sessão, nunca do formulário; o código do banco nunca chega à tela (catálogo fechado de frases).
- **[M6b]** `OBS_ARQUIVO_AUTO_DROP`: só o valor `on` liga; ausente, vazio ou outro valor = desligado (motivo 9). Teste que APAGA a variável (`delete process.env.OBS_ARQUIVO_AUTO_DROP`).
- Testes com banco: `describe.skipIf(skipIfNoLocalDb())`, `SUPABASE_DB_URL` do `bythiago_int` (54422), nunca o 54321/54322 do navegador; DDL em `begin … rollback` com `pg_advisory_xact_lock(7339001)` na 1ª instrução da transação. Relógio falso: `set_config('obs_archive.agora', ..., true)` e `set_config('obs_archive.hoje', ..., true)`.
- TS strict, sem `any`, Zod para toda resposta do banco, arquivos kebab-case; commits `tipo: descrição`, um por tarefa, `git commit -- <caminhos>` no `staging`, terminados com `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`; nunca `git add -A`, `stash`, `reset`. `.superpowers/` é gitignored (ledger e LEIAME só no disco).
- Todo `db:push:prod` é do dono, precedido de `npx supabase migration list --linked`; só segue se as pendentes forem exatamente as do dia. Janela: fora de 11:30-13:00 UTC e fora dos minutos 0, 20 e 40; e fora de 23:40-24:00 de São Paulo (P10: a coleta da diária grava o `snap_date` do dia).
- Sem datas-meta. NAS e forja: nada nesta etapa escreve lá.
- Telas: o mockup aprovado é a fonte; não redesenhar. Onde o mockup e o spec divergem na letra, vale o mockup (anotado na seção "Divergências do mockup").

## Review Focus

1. **Mês que nunca teve linha deste site (partição só de outro site, ou vazia).** O dono espera "nada a tirar", nunca um destaque que some com dado alheio: `outro_site_na_particao` recusa, e mês sem linha do site não conta como saída limpa. Teste na Tarefa 4 (`outro site na partição recusa e nada muda`) e na Tarefa 5 (`descarte de mês vazio não conta para os 3`).
2. **Dois cliques seguidos em "Liberar o espaço" ou em "Trazer de volta" (duplo clique, aba duplicada).** O segundo devolve `ja_descartado` / `descartado` sem erro vermelho e sem mudar nada. Teste na Tarefa 5 e na Tarefa 4.
3. **A tabela `_saida` apagada à mão (ou a partição sumida) com `dropped_at` nulo.** O dono espera vermelho e "nada foi marcado como saído": `particao_ausente` no `discard` e no `reattach`, e o vermelho no pulso. Teste na Tarefa 5 e na Tarefa 9.
4. **O relógio do servidor perto da meia-noite de São Paulo e da virada do mês.** `ainda_na_janela` e `cedo_demais` contam em dia de São Paulo (`obs_archive_hoje_sp`), nunca em UTC: com `hoje = 2027-04-30` outubro de 2026 recusa; com `2027-05-01`, passa. Teste na Tarefa 3.
5. **A resposta do banco fora da forma (função ausente antes da migration, `null`, campo novo).** A tela diz "não deu para ler o estado" e nada sai; a tarefa termina `erro` com motivo de catálogo, nunca `ok`. Teste na Tarefa 8 (`resposta_invalida`, `funcao_ausente`) e na Tarefa 11 (`naoLido`).
6. **Coluna que não é contagem nem soma muda entre a conferência e a trava (C-1/I1).** Um `update ... set likes = 7` depois de a conferência por canal passar (10 minutos de validade) NÃO pode deixar o mês sair: a conferência guarda o resumo da linha inteira (`row_digest`) e a varredura sob a trava o compara. Teste na Tarefa 3 (`4 (CP13)`) e na Tarefa 5.
7. **Dois cliques simultâneos (duas abas, ou clique e tarefa) em tirar ou liberar o mesmo mês (C-2/I-1).** O segundo espera a linha do registro, relê o estado sob a trava e responde `ja_destacado`/`ja_descartado`/`nao_destacado` sem erro de tabela inexistente e sem mudar nada. Teste na Tarefa 6 com duas conexões.

---

## O que foi lido (fonte de cada fato)

| Fato | Fonte |
|---|---|
| Política: `obs_archive_policy()` com `class, table_name, exit_mode, window_months, seal_margin_days, wait_days, auto_allowed, released, control_column, filho`; `released = false` em tudo; série `window 6, wait 7`, horária `window 3, wait 7`, ensaio `window 6, wait 1`; `auto_allowed = 'depois_de_3'` (diária, horária) e `'depois_de_3_da_tabela'` (early) | `supabase/rascunhos/m3b.sql:9-34` |
| `obs_archive_months`: `detached_at/by`, `dropped_at/by`, `drop_mode ∈ (clique, automatico)`, `rows_dropped`, `bytes_freed`, `sealed_at`, `sealed_version`, `sealed_kind`, `unsealed_at`, `unsealed_reason ∈ (conteudo_mudou, mudou_no_destaque, unidade_nova)`, `nas_attested_at`, `b2_forja_ok_at`, `b2_forja_manifest_sha256`, `b2_dono_ok_at`, `b2_dono_manifest_sha256`, `b2_withdrawn_at/reason`, `b2_forja_diverged_at`, `manifest_sha256`; índice parcial `idx_oam_detached` | `m3b.sql:113-135` |
| `obs_archive_prechecks (site_id, class, table_name, month, channel_ref, checked_at)`; `obs_archive_restores (site_id, class, table_name, schema_fp, units_checked, rows_restored, diff_rows, done_by, done_at)`; `obs_archive_switch (site_id, class, armed_by, armed_at, expires_at, disarmed_at, disarm_reason, refusals_nas, first_month, first_month_at)` | `m3b.sql:137-156` |
| `obs_archive_unit_source(p_class, p_table)` monta o `from_where` com `from public.%I t` (diária, early, horária) e `from public.obs_archive_rehearsal t` (ensaio); `obs_archive_read_unit` e `obs_archive_content_hash` leem só a tabela-mãe; o trecho entre `-- obs-archive-hash.sql: início/fim` é `supabase/sql/obs-archive-hash.sql` byte a byte (D17) | `m3b.sql:295-395` |
| Conjunto corrente: `obs_archive_current_units(site, class, month)` (maior versão por tabela e canal); recálculo por unidade e o "dessela" em `obs_archive_unit_rehash` (`redo_reason = 'conteudo_mudou'`, `unsealed_at/unsealed_reason`) | `m3b.sql:742-749`, `:1039-1062` |
| Selado = `sealed_at` preenchido e `unsealed_at` nulo (a selagem limpa `unsealed_*`) | `m3b.sql:869-870` |
| `obs_archive_is_site_admin(p_site, p_user)` (`org_admin` da organização do site ou de organização raiz, e usuário existente em `auth.users`) | `m3b.sql:35-47` |
| Relógio de teste: `obs_archive_agora()` (GUC `obs_archive.agora`) e `obs_archive_hoje_sp()` (GUC `obs_archive.hoje`) | `m3b.sql:420-425`, `:1441-1444` |
| `obs_archive_vermelhos(p_site)` já chama, se existir, `obs_archive_vermelhos_remocao(uuid)` por `to_regprocedure`; NÃO tem gancho para a M6 | `m3b.sql:2101-2180` |
| `obs_archive_descartados_sem_releitura(p_site, p_dias)` (21 amarelo, 45 vermelho) e o plano do copiador já reconfere descartados com informe há mais de 14 dias | `m3b.sql:2076-2089`, `:2248-2383` |
| `obs_archive_atraso(p_site)->'vermelhos'` (unidade há mais de 30 dias); batimento em `obs_archive_heartbeat (site_id, worker, last_poll_at, ...)` | `m3b.sql:2062-2071`, `:157-164` |
| `competitor_channel_remove` apaga por `delete from public.competitor_channels` ("o gatilho da M6 (mês destacado) e o abaixo disparam aqui"); gatilhos M3b `obs_archive_z_destino_declarado` (linha) e `obs_archive_z_truncate` (instrução) | `m3b.sql:2439-2488` |
| Partições: `obs_part.<tabela>_<AAAAMM>`, limites à meia-noite de SP (`date` na diária; `timestamptz` com `-03` nas outras); `obs_part.nome_da_particao`, `obs_part.criar_particao`; `obs_partitions_ensure` pula mês com `detached_at` ou `dropped_at`; `obs_db_size_record` e `top_relations` já somam `obs_part.*_<AAAAMM>_saida` na tabela-mãe | `supabase/rascunhos/m2.sql:11-104`, `:400-440`, `:523-600`; plano M2 `:1090` |
| `obs_archive_uncovered()` caminha o fecho de cascata a partir de `competitor_channels` e ignora `relispartition` | `m2.sql:490-510` |
| Diária: PK `(video_id, snap_date)`, sem `site_id`, FK só para `competitor_videos`; `early` e `hourly`: FK para `competitor_videos` e `sites`; `competitor_hour_fold_log (video_id, day, site_id, ...)` PK `(video_id, day)`; marcas `competitor_video_marks` e `competitor_video_mark_misses` PK `(video_id, age_days)` | migrations `20261003000002:31`, `20261012000003:31`, `20261013000002:10-69`, `20261014000004:30-60` |
| `competitor_removed_items (site_id, kind, competitor_channel_id, archive_pending, ...)` | `20261012000002:128-145` |
| Sinal E10: `sinalDoBanco(linhas, agoraMs, regras)`, `lerSinalDoBanco(sb, agoraMs)`, `RULES.dbSize = { limitMb: 500, yellowPct: 70, redPct: 85, ... trendWindowDays: 28 }` | `apps/web/src/lib/youtube/observatorio/arquivo/sinal-do-banco.ts:294`, `ler-sinal.ts:50`, `observatorio/rules.ts:65` |
| Agenda: interface `Tarefa`/`ResultadoTarefa` (`motivo` = código; `detalhe` só números); o despachante respeita `aPartirDaHoraSP`; ordens usadas 1, 2, 4, 6, 7, 8 e 10 (M2); reservadas 3 e 5 | `agenda/tipos.ts`, `agenda/despachante.ts:97`, `agenda/definicoes.ts`, plano M2 `:1938-1975` |
| Guardas: `denyUnlessSiteAdmin(siteId, acao)`, `requireSiteAdminScope(siteId)` (devolve `user.id`), `siteAdminOnlyMessage` | `apps/web/lib/cms/auth-guards.ts:29-80` |
| Frases de "Remover canal" (M3b): `frases-remocao.ts` com `mesFora: { meses: 1 \| 2; recusadoNoClique }` e `fraseDaRecusaDaRemocao('mes_destacado_em_transito')` = "Nada foi removido." "até a M6 trocar pela frase dela" | plano M3b-site `:3150-3215`, `:3172` |
| Teste: `apps/web/test/helpers/m3b.ts` (`aplicarM3b`, `escalar`, `q1`, `tenta`, `semearCanal`, `semearDiaria`, `SITE_TESTE`), `m2.ts` (`aplicarM2`, `travarDdl`, `garantirParticoesDaDiaria`), `test/integration/video-antigo-m10a-caminho.ts` (`M10A_SQL`); sequência de preparo das integrações da M3b: `begin`, lock 7339001, `aplicarM2`, `M10A_SQL`, `aplicarM3b` | `apps/web/test/integration/manutencao-m3b-remocao.test.ts:52-59` |

## NÃO VERIFICADO (cada um com o que fazer)

- **A rota da página do Arquivo é da M5; o encaixe das peças é da M6 (D-M5-14, Yannis r2 N-3).** Os componentes desta etapa ficam em `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/` (pasta privada, não é rota). A M5 entrega só os slots `acoes?: ReactNode` (em `LinhaDoMes` e `CartaoDoTipo`) e nunca importa `_arquivo-saida/`; a **Tarefa 12b** da M6 estende `_arquivo/montar.ts` (servidor) para preencher `acoes` depois de `montarPagina`. A Tarefa 12 testa as peças isoladas e a 12b testa o encaixe. O que falta do lado da M5 (campos `tabela` e `mes` na linha, `hojeSP`) está em `.superpowers/sdd/manutencao-nas/pedidos-m6-para-m5.md`.
- **`obs_archive_online_since` não existe no `m3b.sql`.** O "online desde" e o rótulo "no arquivo" são da M5 (peça 1). Esta etapa entrega a coluna `reattach_out_of_order` e a chave `volta_fora_de_ordem` no retorno do `reattach`; a M5 as lê.
- **A forma da trava (as duas da linha "Concorrência") só se escolhe depois do item 128** (Tarefa 6). O plano parte da primeira (`share row exclusive` em `competitor_videos` antes da mãe) e a Tarefa 6 registra o que o Postgres aborta.
- **CP13 em volume (75 canais).** Se o recálculo passar de 4 s, a conferência por canal já é o caminho (o portão aceita prechecks de menos de 10 min); se a tarefa da agenda não couber em 85 s, ela vira `pesada` (Tarefa 6, Passo 5 decide pela medida).
- **A frase do R27 (`saida_fora_de_ordem`) na tela.** O texto abaixo é proposta do engenheiro; Logan revisa na Tarefa 12, Passo 6. Proposta: "Antes de <mês>, <mês mais antigo> ainda está no banco online. Tire os meses do mais antigo para o mais novo."
- **`released` só muda por migration, no release das telas (M5).** Esta etapa não libera classe nenhuma; com tudo `false` as quatro funções recusam com `classe_nao_liberada` em produção até a M5.
- **Se a cópia do NAS dos resumos por canal entra em `obs_archive_months.nas_attested_at`.** A condição 5 lê o agregado que a M3b grava (`obs_archive_recompute_nas` sobre `obs_archive_month_files`); a recusa diz as horas e, à parte, os canais da versão corrente sem resumo atestado.
- **Tempo real de hash, `tally` com resumo e `attach` em volume (75 canais).** Só a Tarefa 6 mede (maior conferência por canal; tempo com a mãe travada no `detach` e no `reattach`; ação do botão ponta a ponta contra o `maxDuration = 60` da página da M5). Até lá os tetos de 4 s e 8 s são hipótese.
- **Se o despachante repete a tarefa no mesmo dia (`tetoTentativas: 12`) e em que intervalo** [M6b]. Conferir em `agenda/despachante.ts` na Tarefa 8; o teste do catálogo fixa o que for achado.
- **O `maxDuration` da ação do botão na Vercel.** A ação faz `2 + C` idas ao banco (RTT Vercel para São Paulo não medido). A Tarefa 6 mede e a 11 registra.
- **Se algum escritor grava em meses antigos das séries** (uma escrita em partição destacada cai em `competitor_video_daily` sem partição e falha). Conferir por `grep` dos escritores na Tarefa 6 (caso iv/v).
- **Se `obs_archive_recompute_nas` zera `nas_attested_at` na reselagem** (M3b). Pergunta à M3b; o teste de `selarMes` não prova isso.
- **Canal em `obs_archive_channel_removals` que ainda existe** (M3b). O portão trata como removido; pergunta à M3b.
- **A ordem de escrita da coleta** (insere na diária e depois atualiza `competitor_videos`, ou o inverso). Não verificada; os casos (iv) e (v) da Tarefa 6 acham a ordem que aborta e, se a coleta for a abortada, a ordem das travas muda.
- **Se o PG17 adota as FK copiadas no `attach` sem duplicar.** O teste 115(a) mostra.
- **Cor do ciclo vermelha por saída distante e o motivo 5** (m-12, Yannis): confirmar com Phil que é desejado (o plano mantém).
- **Estimativa de canais para o CP13:** 701 vídeos por dia de snapshot e cerca de 30 canais hoje dão ~23 vídeos por canal; é ESTIMATIVA até o dono rodar a consulta da Tarefa 14 (Passo 3).
- **Unidades com `dropped_at` em série.** A M3b usa `obs_archive_units.dropped_at` na classe `video_antigo`; esta etapa grava o descarte só em `obs_archive_months` (o mês inteiro sai) e não toca a coluna da unidade.

## Decisões deste plano (registrar no ledger antes de 01/03/2027: R27)

1. **R27, primeira causa (saída fora de ordem):** `detach` e `drop` recusam com `saida_fora_de_ordem` quando há mês **anterior** da mesma (site, classe, tabela) com linha (`rows_total > 0`) e sem `detached_at` nem `dropped_at`. No automático, a recusa desarma (motivo 11): a tarefa sempre tenta o mês mais antigo, então ela só aparece por anomalia.
2. **R27, segunda causa (volta fora de ordem):** o `reattach` nunca recusa por ordem. Se houver mês **posterior** da mesma (site, classe, tabela) com `detached_at` ou `dropped_at`, o mês volta, a coluna `obs_archive_months.reattach_out_of_order` fica `true` e o retorno traz `volta_fora_de_ordem: true`; a M5 marca a linha e o "online desde".
3. **CP13 (teto de 8 s):** o portão aceita, para a condição 4, conferência por canal feita há menos de 10 minutos e depois do destaque (no `discard`); sem ela, recalcula ali mesmo (hash e `row_digest`) e grava a conferência. Sob a trava, o `tally` varre a relação uma vez e compara contagem, soma e `row_digest` de cada canal com o que a conferência guardou. O site sempre faz as conferências por canal antes da chamada final (Tarefa 11 e Tarefa 8); o recálculo inline fica para a simulação e para os testes.
4. **Classe `texto` não sai nesta etapa:** o ramo texto do `drop` (itens 96-101) é Onda 2; com `released = false` ele já recusa pela condição 1, e `obs_archive_drop_month` com tabela de `exit_mode <> 'particao'` recusa com `tabela_invalida`.
5. **Hash sobre a tabela destacada sem mexer no arquivo de hash da M3b:** um arquivo novo (`supabase/sql/obs-archive-hash-rel.sql`, copiado byte a byte entre marcadores no rascunho) com `obs_archive_unit_source_rel`, `obs_archive_content_hash_rel`; o `from_where` sai do `obs_archive_unit_source` original, trocando só a relação, e um teste prova que com `p_rel` nulo os dois são idênticos e que o hash na mãe é igual ao hash na `_saida`.
6. **Sub-sites (aspiracionais):** partição com linha de outro site verde é destacada para os dois; o registro de cada site com linha na partição ganha `detached_at`/`dropped_at` na mesma transação; `bytes_freed` vai só na linha de `p_site`.
7. **Condição 12 na simulação:** `p_dry_run` não pede trava (não se trava a tabela-mãe para uma simulação); a resposta não traz `ocupado`.
8. **[M6b] Ordem 11 da agenda** para `saida_automatica` (a primeira livre depois da M2; se outra etapa entrar antes com 11, usar a seguinte e ajustar o teste do catálogo no mesmo commit).
9. **[M6b] Motivo 7 do vigia = "mais de um `drop` automático da classe no mesmo dia de São Paulo"** (desvio declarado do spec `03` §12.4, que diz "24 h"; Phil e Hanna confirmam). Motivo: a tarefa tenta no máximo uma saída por classe por rodada e `exit_candidates` omite a classe que já saiu no dia SP corrente; com "24 h", dois dias seguidos com a rodada perto da meia-noite desligariam sem anomalia.
10. **C-1 (Yannis) = I1 (Phil): a conferência guarda o resumo da linha inteira.** `obs_archive_prechecks.row_digest` (soma de `hashtextextended(t::text, 0)` sobre as linhas do canal no mês) é gravado pela conferência e comparado, sob a trava, com o mesmo cálculo feito na varredura única do `tally`. Contagem e soma sozinhas não pegam uma coluna que não é a de controle.
11. **C-2 (Yannis): as linhas de `obs_archive_months` do mês são travadas primeiro** (ver Global Constraints), e o estado e as condições baratas são reavaliados sob a trava.
12. **`p_dry_run` tem `default true` nas quatro funções** (Yannis I-1): quem esquece o argumento simula, nunca tira.
13. **A data de "pode sair" vem de `public.obs_archive_pode_sair_em(p_month, p_window)`** (plano da M7, D15, Tarefa 4 dela), que aplica o piso do registro (`2026-10-01`). O portão (condição 2) e `obs_archive_next_exit` a chamam. Ordem: se a M7 sair primeiro, a função já existe; se a M6a sair primeiro, a PARTE 3 a cria com `create or replace` idêntica à da M7 (inclusive `obs_archive_piso_registro`) e a M7 apenas a recria igual.
14. **Quem encaixa as peças na página é a M6 (D-M5-14).** Tarefa 12b.
15. **`reattach` valida antes de travar a mãe** (Yannis I-7, Phil M6): FK `not valid` + `validate` e `CHECK` com os limites do mês `not valid` + `validate` na `_saida` ANTES do `ACCESS EXCLUSIVE` na mãe; o `attach` pula a varredura por causa do `CHECK`, que é removido depois.
16. **A classe `ensaio` só é liberada (`released = true`) se a Hanna/o dono decidirem** (ensaio do dono, spec `05` §16.7). Proposta: passo opcional 1b da Tarefa 14, depois da migration da M5 (que recria `obs_archive_policy()` para liberar `serie` e `horaria`) para não sobrescrevê-la. Pendente.

## Divergências do mockup (vale o mockup; anotadas para Logan)

- Spec "avise o Claude Code" → mockup "avise quem cuida do site" (T6 quarta frase, T10c, T10d).
- Spec: link "(abrir o Arquivo)" para todo administrador → mockup (`rc.js:109`): o link só aparece depois da data ("Você já pode liberar o espaço ou trazer o mês de volta. (abrir o Arquivo)"); antes da data, sem link.
- Mockup D7r acrescenta "O mês saiu das telas enquanto este diálogo estava aberto." antes do nome do mês e "**Nada foi removido.**" antes da frase da data.

## Dívida técnica declarada (Yannis §5)

1. **A serialização do hash existe em dois lugares** (`obs_archive_read_unit` e `obs_archive_content_hash_rel`); um teste de texto (Tarefa 1) trava a igualdade da expressão, mas é guarda, não solução. Unificar é da M3b.
2. **Os testes de integração só rodam com banco local** (`HAS_LOCAL_DB`); a CI não os roda. A bateria é do controlador antes do push (critério 1 da M6a).
3. **Invariante global:** mês destacado de qualquer site bloqueia toda remoção de canal e todo `delete` em `competitor_channels`/`competitor_videos`, de qualquer site, **enquanto houver um mês `detached_at` sem `dropped_at`**. É deliberado (sub-sites são aspiracionais). (Emenda 23/10, Phil N6-2) Caminhos que ele alcança hoje: `competitor_video_purge` e `competitor_channel_purge` (E9), `competitor_channel_remove_archived` e `competitor_channel_delete_unarchived` (F1: "Remover sem guardar" e "Desfazer"), mais o "Remover canal" da Tarefa 13. **Não alcança** `competitor_comments_purge` (só apaga comentários). Duração: cada saída segura o invariante de `detached_at` até `dropped_at`, no mínimo 7 dias por classe por mês (janela de espera de série/horária), ou seja, ordem de ~7 de cada ~30 dias o dono não consegue apagar vídeo nem canal (**ESTIMATIVA**; a Tarefa 7a mede o real). Não perde dado: a recusa é nítida e tem fim definido. A frase diz que é **algum mês** (não o do vídeo/canal dele) e traz a data de liberação.
4. **(Reescrita 23/10, Phil N6-2 e Yannis N-M6-2.)** A E9 **já mapeia** a recusa (`saiu/responder.ts:30-31,49` reconhece `^mes_destacado_em_transito` e não manda ao Sentry; `saiu/modelo.ts:22,167` tem a frase; é da M9 só conferir/ajustar a frase, ver Tarefa 11 da M9). Não há nada a pedir à A5 nesse ponto. Os caminhos da F1 (`apagarCanalSemGuardar`, `remover.ts`) passam pelo `chamar` e `codigoE10` da Tarefa 13 e herdam o mapeamento; a Tarefa 13 acrescenta o teste que prova isso. O CLI do arquivo segue como a Tarefa 13 descreve.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/rascunhos/m6.sql` (criar; Tarefa 14 move as PARTES 1 a 6 para a migration da M6a e a 14b a PARTE 7 para a da M6b) | todo o SQL, em 7 partes (1 a 6 = M6a; 7 = M6b) |
| `supabase/sql/obs-archive-hash-rel.sql` (criar) | as duas funções de hash sobre relação (byte a byte igual ao trecho do rascunho) |
| `apps/web/test/helpers/m6.ts` (criar) | `M6_SQL_CAMINHO`, `M6_EM_MIGRATION`, `prepararM6`, `liberarClasses`, `selarMes`, `relogio`, `novoAdmin` |
| `apps/web/test/integration/manutencao-m6-*.test.ts` (criar: `hash`, `invariante`, `portao`, `destaque`, `descarte`, `corridas`, `saida-estado` [M6a], `interruptor` [M6b], `rodizio`, `teste-encerrado`) | integração por parte |
| `apps/web/test/youtube/observatorio/migrations-leitura.test.ts` (modificar, se existir; senão criar `manutencao-m6-trava.test.ts`) | TRAVA M6-1 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/saida.ts` (criar, `server-only`) | o único caminho do site até as funções: Zod, conferência por canal, chamada final, leitura do estado |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/frases-saida.ts` (criar, puro) | catálogo fechado das frases da peça 3 e do retorno |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/interruptor.ts` (criar, puro) | estado e frases da peça 4: na M6a só títulos, `faltaParaLigar` e `NAO_MEDIDO`; motivos, `idDoMotivo`, frase digitada, `CALMA` e `ESPERA` na M6b |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/ligado.ts` (criar, puro) [M6b] | `autoDropLigado(env)` (m-9: o módulo da tarefa e a ação importam daqui, sem arrastar a tarefa para o cliente) |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/frases-remocao.ts` (modificar; criado pela M3b) | D7/D7r com meses e data |
| `apps/web/src/lib/youtube/agenda/tarefas/saida-automatica.ts` (criar), `agenda/definicoes.ts`, `agenda/catalogo.ts` (modificar) [M6b] | a tarefa diária |
| `apps/web/src/lib/youtube/observatorio/arquivo/sinal-do-banco.ts`, `ler-sinal.ts` (modificar) [M6b] | o sinal sem serrote |
| `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes.ts` (criar, `'use server'`) [M6a] | as ações do botão (simular, tirar, liberar, trazer, encerrar o dado de teste) |
| `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes-interruptor.ts` (criar, `'use server'`) [M6b] | ligar, desligar, marcar simulação vista, marcar desligamento visto |
| `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/encaixar.ts` (criar, servidor) e `_arquivo/montar.ts` (modificar, da M5) [M6a] | Tarefa 12b: preenche `acoes` das linhas e dos cartões (D-M5-14) |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts` (modificar, da M5) [M6a] | `SAIDA_DE_MES_EXISTE = true` no commit da migration (D-M5-15) |
| `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/peca-tirar-mes.tsx`, `peca-interruptor.tsx` (criar, `'use client'`) [M6a: peça 3 e a peça 4 em `nao_pode`], `chip-automatico.tsx` [M6b] | peça 3, peça 4 e o chip |
| `apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts` (modificar) | `removeCompetitorChannel` devolve os meses em trânsito na recusa |
| `docs/ops/env-vars.md` (modificar) | `OBS_ARQUIVO_AUTO_DROP` |
| `.superpowers/sdd/manutencao-nas/m6/LEIAME-COMANDOS.md` e `progress.md` (criar, só disco) | comandos do dono e ledger |

---

### Task 0 [M6a]: O rascunho, a trava e o helper de teste

**Pré-condições de ambiente (emenda 23/10, Phil N6-4):** antes desta tarefa, (1) o banco de integração `bythiago_int` (54422) é recriado a partir de `origin/staging` (o local está ~1.000 commits atrás; hoje tem o esquema de 14/10, e as funções do canal e `obs_archive_registry` mudaram em produção), (2) a M2 rebaseada (C-1 do `phil.md`) está aplicada, (3) a M3b está aplicada no 54422 e em produção (`obs_archive_months` não existe em produção hoje). Sem isso o "verde" do critério 1 da M6a vale para um banco que não existe mais. Registrar no ledger o `git rev-parse origin/staging` da recriação.

**Files:**
- Create: `supabase/rascunhos/m6.sql`
- Create: `apps/web/test/helpers/m6.ts`
- Create: `apps/web/test/integration/manutencao-m6-trava.test.ts`

**Interfaces:**
- Consumes: `aplicarM2`, `travarDdl`, `garantirParticoesDaDiaria` (`test/helpers/m2.ts`); `aplicarM3b`, `escalar`, `q1`, `tenta`, `semearCanal`, `semearDiaria`, `SITE_TESTE` (`test/helpers/m3b.ts`); `M10A_SQL` (`test/integration/video-antigo-m10a-caminho.ts`).
- Produces (em `test/helpers/m6.ts`):
  - `M6_SQL_CAMINHO: string`, `M6_EM_MIGRATION: boolean`, `HASH_REL_SQL_CAMINHO: string`
  - `type ParteM6 = 1 | 2 | 3 | 4 | 5 | 6 | 7` (1 a 6 = M6a; 7 = M6b); `sqlM6Ate(ate?: ParteM6): string`
  - `prepararM6(c: Client, ate?: ParteM6): Promise<void>` (lock 7339001, M2, M10a, M3b, M6 até a parte; o chamador abre e desfaz a transação)
  - `relogio(c: Client, agora: string, hoje?: string): Promise<void>`
  - `liberarClasses(c: Client, classes: readonly string[]): Promise<void>`
  - `novoAdmin(c: Client, site: string): Promise<string>`
  - `selarMes(c: Client, o: SelarMes): Promise<void>` com `interface SelarMes { site: string; classe: string; tabela: string; mes: string; versao?: number; nasHa?: string; b2ForjaHa?: string | null; restauradoHa?: string | null }`
  - `particaoDe(tabela: string, mes: string): string` (`'obs_part.<tabela>_<AAAAMM>'`)
  - (emenda 23/10, Yannis N-M6-1) `apagarCanalDeclarando(c: Client, site: string, canal: string, admin: string): Promise<void>`: apaga o canal por `select public.competitor_channel_remove($1, $2, 'apagar', 'botao', $3)`, que declara o destino no mesmo `xid`. Com a M3b aplicada, o gatilho `obs_archive_z_destino_declarado` recusa (`destino_do_arquivo_nao_declarado`) todo `delete from public.competitor_channels` cru. Se o helper único de limpeza do replanejamento (`yannis.md` §3.4, `apagarCanalDeTeste` em `apps/web/test/helpers/`) já existir quando esta tarefa rodar, este helper só o chama. Regra: caso que espera `ok: true` ou limpeza usa o helper; caso que espera a recusa do invariante mantém o `delete` cru (o gatilho `a_` dispara antes do `z_`).

- [ ] **Step 1: O teste da trava (falha: o rascunho não existe)**

```ts
// apps/web/test/integration/manutencao-m6-trava.test.ts
// @vitest-environment node
/** TRAVA M6-1: o SQL da M6 vive em supabase/rascunhos/m6.sql (fora da pasta que o db push lê) até a Tarefa 14. */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { M6_SQL_CAMINHO, M6_EM_MIGRATION, HASH_REL_SQL_CAMINHO } from '../helpers/m6'

const MIGRATIONS = resolve(__dirname, '../../../../supabase/migrations')

describe('TRAVA M6-1', () => {
  it('enquanto M6_EM_MIGRATION é false, nenhuma migration define as funções de saída', () => {
    if (M6_EM_MIGRATION) return
    expect(existsSync(M6_SQL_CAMINHO)).toBe(true)
    for (const f of readdirSync(MIGRATIONS).filter(n => n.endsWith('.sql'))) {
      const sql = readFileSync(resolve(MIGRATIONS, f), 'utf8')
      expect(sql, f).not.toMatch(/function public\.obs_archive_(detach|discard|reattach|drop)_month/)
      expect(sql, f).not.toMatch(/obs_archive_block_delete_while_detached/)
    }
  })
  it('o trecho entre os marcadores do rascunho é o arquivo de hash sobre relação, byte a byte', () => {
    const sql = readFileSync(M6_SQL_CAMINHO, 'utf8')
    const ini = sql.indexOf('-- obs-archive-hash-rel.sql: início\n')
    const fim = sql.indexOf('-- obs-archive-hash-rel.sql: fim')
    expect(ini).toBeGreaterThanOrEqual(0)
    expect(fim).toBeGreaterThan(ini)
    const trecho = sql.slice(ini + '-- obs-archive-hash-rel.sql: início\n'.length, fim)
    expect(trecho).toBe(readFileSync(HASH_REL_SQL_CAMINHO, 'utf8'))
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run (em `apps/web`): `npx vitest run test/integration/manutencao-m6-trava.test.ts > /tmp/m6-t0.log 2>&1; grep -E "FAIL|Tests |Cannot find" /tmp/m6-t0.log`
Expected: FAIL (`Cannot find module '../helpers/m6'`).

- [ ] **Step 3: O rascunho com a casca das partes e o arquivo de hash vazio**

`supabase/rascunhos/m6.sql`:

```sql
-- Manutenção M6: a saída do mês. RASCUNHO (TRAVA M6-1): fora de supabase/migrations até a Tarefa 14 do plano
-- docs/superpowers/plans/2026-10-14-manutencao-nas-m6-saida.md. Depende de M2 (obs_part, partições) e M3b (registro).
-- M6 PARTE 1: o hash sobre uma relação (a partição anexada ou a tabela destacada)
-- obs-archive-hash-rel.sql: início
-- obs-archive-hash-rel.sql: fim
-- M6 PARTE 2: o invariante do mês destacado
-- M6 PARTE 3: colunas novas, o portão e a conferência por canal
-- M6 PARTE 4: destacar e trazer de volta
-- M6 PARTE 5: descartar e a composta
-- M6 PARTE 6 [M6a]: contadores do interruptor, simulação vista, em trânsito, vermelhos da saída e encerrar o dado de teste
-- M6 PARTE 7 [M6b]: o interruptor (estado, ligar, desligar, vigia), os candidatos, o vermelho do desarme e a próxima saída
```

`supabase/sql/obs-archive-hash-rel.sql`: arquivo vazio (0 bytes).

- [ ] **Step 4: O helper**

```ts
// apps/web/test/helpers/m6.ts
/** Manutenção M6: o SQL vive em supabase/rascunhos/m6.sql até a Tarefa 14 (TRAVA M6-1). Este é o único lugar que a Tarefa 14 muda. */
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { aplicarM2, travarDdl } from './m2'
import { aplicarM3b, escalar } from './m3b'
import { M10A_SQL } from '../integration/video-antigo-m10a-caminho'

export const M6_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/rascunhos/m6.sql')
export const M6_EM_MIGRATION = false
export const HASH_REL_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/sql/obs-archive-hash-rel.sql')
export type ParteM6 = 1 | 2 | 3 | 4 | 5 | 6 | 7   // 1 a 6 = M6a; 7 = M6b (o interruptor)

/** O rascunho até a parte `ate` (inclusive). Parte pedida que não existe falha alto. */
export function sqlM6Ate(ate?: ParteM6): string {
  const sql = readFileSync(M6_SQL_CAMINHO, 'utf8')
  if (ate === undefined || ate === 7) return sql
  const fim = sql.indexOf(`-- M6 PARTE ${ate + 1}`)
  if (fim < 0) throw new Error(`parte ${ate + 1} não encontrada no rascunho da M6`)
  return sql.slice(0, fim)
}

/** Aplica M2, M10a, M3b e a M6 até `ate` na conexão (o chamador abriu a transação e a desfaz). */
export async function prepararM6(c: Client, ate?: ParteM6): Promise<void> {
  await travarDdl(c)
  await aplicarM2(c)
  await c.query(readFileSync(M10A_SQL, 'utf8'))
  await aplicarM3b(c)
  await c.query(sqlM6Ate(ate))
}

/** Relógio falso local à transação: `obs_archive.agora` (timestamptz) e `obs_archive.hoje` (dia de SP, AAAA-MM-DD). */
export async function relogio(c: Client, agora: string, hoje?: string): Promise<void> {
  await c.query(`select set_config('obs_archive.agora', $1, true)`, [agora])
  const dia = hoje ?? (await escalar<string>(c, `select to_char(($1::timestamptz at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD')`, [agora]))
  await c.query(`select set_config('obs_archive.hoje', $1, true)`, [dia])
}

/** Recria `obs_archive_policy()` (só nesta transação) com `released = true` nas classes pedidas. */
export async function liberarClasses(c: Client, classes: readonly string[]): Promise<void> {
  const def = await escalar<string>(c, `select pg_get_functiondef('public.obs_archive_policy()'::regprocedure)`)
  const alvo = new RegExp(`(\\('(?:${classes.join('|')})', '[a-z_]+', '[a-z]+', \\d+, \\d+, \\d+, '[a-z_0-9]+', )false,`, 'g')
  const nova = def.replace(alvo, '$1true,')
  if (nova === def) throw new Error(`nenhuma linha da política trocada para ${classes.join(',')}`)
  await c.query(nova)
}

export async function novoAdmin(c: Client, site: string): Promise<string> {
  const id = randomUUID()
  await c.query(`insert into auth.users (id, instance_id, aud, role, email) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2)`, [id, `m6-${id}@t.test`])
  const org = (await c.query(`select org_id from public.sites where id = $1`, [site])).rows[0].org_id as string
  await c.query(`insert into public.organization_members (org_id, user_id, role) values ($1, $2, 'org_admin')`, [org, id])
  return id
}

export function particaoDe(tabela: string, mes: string): string {
  return `obs_part.${tabela}_${mes.slice(0, 4)}${mes.slice(5, 7)}`
}

export interface SelarMes { site: string; classe: string; tabela: string; mes: string; versao?: number; nasHa?: string; b2ForjaHa?: string | null; restauradoHa?: string | null }

/**
 * Grava o registro de um mês selado e verde DIRETO nas tabelas (sem passar pelas rotas da M3b), com os três valores de cada unidade
 * lidos agora do online por obs_archive_content_hash: uma unidade por canal do site com linha no mês. `nasHa`/`b2ForjaHa`/`restauradoHa`
 * são intervalos ('2 hours'); null em b2/restauração = não gravar. É fixture de teste: a selagem de verdade é da M3b.
 */
export async function selarMes(c: Client, o: SelarMes): Promise<void> {
  const v = o.versao ?? 1
  const agora = `public.obs_archive_agora()`
  await c.query(`
    insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp, sha256_bytes, received_at, nas_attested_at)
    select $1::uuid, $2, $3, ch.id::text, $4::date, $5, h.row_count, h.control_sum::numeric, h.hash_conteudo,
           public.obs_archive_schema_fp(('public.' || $3)::regclass),
           case when h.row_count = 0 then null else repeat('a', 64) end, ${agora}, ${agora} - $6::interval
      from public.competitor_channels ch
      cross join lateral public.obs_archive_content_hash($1::uuid, $2, $3, ch.id, $4::date) h
     where ch.site_id = $1::uuid`, [o.site, o.classe, o.tabela, o.mes, v, o.nasHa ?? '1 hour'])
  await c.query(`
    insert into public.obs_archive_months (site_id, class, table_name, month, sealed_at, sealed_version, sealed_kind, rows_total, units_total,
                                           manifest_sha256, nas_attested_at, b2_forja_ok_at, b2_forja_manifest_sha256, b2_attested_at, b2_attested_via)
    select $1::uuid, $2, $3, $4::date, ${agora} - interval '1 day', $5, case when sum(u.row_count) > 0 then 'com_dado' else 'vazio_conferido' end,
           sum(u.row_count), count(*), repeat('m', 64), ${agora} - $6::interval,
           case when $7::interval is null then null else ${agora} - $7::interval end, repeat('m', 64),
           case when $7::interval is null then null else ${agora} - $7::interval end, case when $7::interval is null then null else 'forja' end
      from public.obs_archive_units u where u.site_id = $1::uuid and u.class = $2 and u.table_name = $3 and u.month = $4::date and u.version = $5
    on conflict (site_id, class, table_name, month) do update set sealed_at = excluded.sealed_at, sealed_version = excluded.sealed_version,
      sealed_kind = excluded.sealed_kind, rows_total = excluded.rows_total, units_total = excluded.units_total, unsealed_at = null, unsealed_reason = null,
      manifest_sha256 = excluded.manifest_sha256, nas_attested_at = excluded.nas_attested_at, b2_forja_ok_at = excluded.b2_forja_ok_at,
      b2_forja_manifest_sha256 = excluded.b2_forja_manifest_sha256, b2_attested_at = excluded.b2_attested_at, b2_attested_via = excluded.b2_attested_via`,
    [o.site, o.classe, o.tabela, o.mes, v, o.nasHa ?? '1 hour', o.b2ForjaHa === undefined ? '1 day' : o.b2ForjaHa])
  if (o.restauradoHa !== null) {
    await c.query(`insert into public.obs_archive_restores (site_id, class, table_name, schema_fp, origem, chave, units_checked, rows_restored, diff_rows, done_by, done_at)
      values ($1, $2, $3, public.obs_archive_schema_fp(('public.' || $3)::regclass), 'b2', 'cofre', 1, 10, 0, 'dono@t.test', ${agora} - $4::interval)`,
      [o.site, o.classe, o.tabela, o.restauradoHa ?? '10 days'])
  }
}
```

(Se `obs_archive_units` tiver `check` que a fixture fira, o erro diz qual: ajustar a fixture, nunca o `check`. A classe `ensaio` usa `public.obs_archive_rehearsal` no `schema_fp`; a fixture recebe a tabela da política, que já é esse nome.)

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run test/integration/manutencao-m6-trava.test.ts > /tmp/m6-t0.log 2>&1; grep -E "FAIL|Tests " /tmp/m6-t0.log`
Expected: PASS (2 testes; o arquivo vazio é igual ao trecho vazio).

- [ ] **Step 6: Commit**

```bash
git add supabase/rascunhos/m6.sql supabase/sql/obs-archive-hash-rel.sql apps/web/test/helpers/m6.ts apps/web/test/integration/manutencao-m6-trava.test.ts
git commit -m "test: M6: rascunho da saída do mês com TRAVA M6-1 e helper de teste (selagem direta, relógio, classes liberadas)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m6.sql supabase/sql/obs-archive-hash-rel.sql apps/web/test/helpers/m6.ts apps/web/test/integration/manutencao-m6-trava.test.ts
```

---

### Task 1 [M6a]: O hash e o resumo da linha inteira sobre a relação (partição anexada ou tabela destacada)

**Files:**
- Modify: `supabase/sql/obs-archive-hash-rel.sql`, `supabase/rascunhos/m6.sql` (PARTE 1, entre os marcadores)
- Create: `apps/web/test/integration/manutencao-m6-hash.test.ts`

**Interfaces:**
- Consumes: `public.obs_archive_unit_source(text, text)`, `public.obs_archive_content_hash(uuid, text, text, uuid, date)`, `public.obs_archive_policy()` (M3b).
- Produces:
  - `public.obs_archive_unit_source_rel(p_class text, p_table text, p_rel regclass) returns table (rel regclass, from_where text, order_by text, control_expr text)`: `p_rel` nulo = idêntico ao original; senão troca só a relação do `from`. Só aceita `obs_part.<p_table>_<AAAAMM>` ou `..._saida`. Erros: `relacao_so_em_particao`, `relacao_invalida`, `fonte_sem_tabela` (P0001).
  - `public.obs_archive_content_hash_rel(p_site uuid, p_class text, p_table text, p_rel regclass, p_channel uuid, p_month date) returns table (row_count bigint, control_sum text, hash_conteudo text)`: os mesmos três valores de `obs_archive_content_hash`, lidos de `p_rel`. Interna (sem `execute` para ninguém além do dono). Recusa com `relacao_invalida` se o sufixo `AAAAMM` do nome da relação não é o de `p_month` (m-13).
  - `public.obs_archive_row_digest_rel(p_site uuid, p_class text, p_table text, p_rel regclass, p_channel uuid, p_month date) returns numeric` (C-1/I1): `coalesce(sum(hashtextextended(t::text, 0)::numeric), 0)` sobre as MESMAS linhas do `from_where` do hash (mesmos seis parâmetros, mesmos `set` de sessão). É o resumo da linha inteira que a conferência guarda e o `tally` compara sob a trava. Interna.

- [ ] **Step 1: Os testes (falham: a função não existe)**

```ts
// apps/web/test/integration/manutencao-m6-hash.test.ts
// @vitest-environment node
/** M6 parte 1 (plano M6, Tarefa 1): o hash sobre a partição e sobre a tabela destacada é o MESMO da tabela-mãe. Banco: bythiago_int, begin … rollback. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar, q1, tenta, semearCanal, semearDiaria } from '../helpers/m3b'
import { prepararM6, particaoDe } from '../helpers/m6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MES = '2026-10-01'

describe.skipIf(skipIfNoLocalDb())('M6 parte 1: hash sobre relação', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try { await prepararM6(c, 1); await f() } finally { await c.query('rollback') }
  }

  it('com p_rel nulo, unit_source_rel é idêntico a unit_source em toda linha de partição da política', async () => {
    await emTransacao(async () => {
      const r = await c.query(`select p.class, p.table_name,
          (select row(s.*)::text from public.obs_archive_unit_source(p.class, p.table_name) s) as a,
          (select row(s.*)::text from public.obs_archive_unit_source_rel(p.class, p.table_name, null) s) as b
        from public.obs_archive_policy() p where p.exit_mode = 'particao'`)
      expect(r.rows.length).toBe(4)
      for (const x of r.rows) expect(x.b, `${x.class}/${x.table_name}`).toBe(x.a)
    })
  })

  it('o hash na mãe, na partição anexada e na tabela destacada (_saida) é o mesmo, para cada canal', async () => {
    await emTransacao(async () => {
      const { site, canal, videos } = await semearCanal(c, { videos: 4 })
      await semearDiaria(c, videos, '2026-10-01', 31)
      const mae = await q1(c, `select * from public.obs_archive_content_hash($1, 'serie', 'competitor_video_daily', $2, $3)`, [site, canal, MES])
      const part = particaoDe('competitor_video_daily', MES)
      const anexada = await q1(c, `select * from public.obs_archive_content_hash_rel($1, 'serie', 'competitor_video_daily', $2::regclass, $3, $4)`, [site, part, canal, MES])
      expect(anexada).toEqual(mae)
      expect(Number(mae.row_count)).toBe(124)
      await c.query(`alter table public.competitor_video_daily detach partition ${part}`)
      await c.query(`alter table ${part} rename to competitor_video_daily_202610_saida`)
      const saida = await q1(c, `select * from public.obs_archive_content_hash_rel($1, 'serie', 'competitor_video_daily', 'obs_part.competitor_video_daily_202610_saida'::regclass, $2, $3)`, [site, canal, MES])
      expect(saida).toEqual(mae)
    })
  })

  it('o dado não existe: canal sem linha no mês dá 0 linhas e o hash da string vazia, igual ao da mãe', async () => {
    await emTransacao(async () => {
      const { site, canal } = await semearCanal(c, { videos: 1 })
      await semearDiaria(c, [], '2026-10-01', 1)
      const part = particaoDe('competitor_video_daily', MES)
      const a = await q1(c, `select * from public.obs_archive_content_hash_rel($1, 'serie', 'competitor_video_daily', $2::regclass, $3, $4)`, [site, part, canal, MES])
      const b = await q1(c, `select * from public.obs_archive_content_hash($1, 'serie', 'competitor_video_daily', $2, $3)`, [site, canal, MES])
      expect(a).toEqual(b)
      expect(Number(a.row_count)).toBe(0)
    })
  })

  it('relação fora do contrato é recusada: outra tabela, outro schema, tabela de texto', async () => {
    await emTransacao(async () => {
      const r1 = await tenta(c, `select * from public.obs_archive_unit_source_rel('serie', 'competitor_video_daily', 'public.competitor_videos'::regclass)`)
      expect(r1).toMatchObject({ ok: false, message: expect.stringContaining('relacao_invalida') })
      const r2 = await tenta(c, `select * from public.obs_archive_unit_source_rel('texto', 'competitor_raw', 'public.competitor_raw'::regclass)`)
      expect(r2).toMatchObject({ ok: false, message: expect.stringContaining('relacao_so_em_particao') })
      const r3 = await tenta(c, `select * from public.obs_archive_unit_source_rel('serie', 'competitor_video_daily', '${particaoDe('competitor_video_early', MES)}'::regclass)`)
      expect(r3).toMatchObject({ ok: false, message: expect.stringContaining('relacao_invalida') })
    })
  })

  it('as funções de relação não têm execute para anon, authenticated nem service_role', async () => {
    await emTransacao(async () => {
      for (const papel of ['anon', 'authenticated', 'service_role']) {
        expect(await escalar<boolean>(c, `select has_function_privilege($1, 'public.obs_archive_content_hash_rel(uuid, text, text, regclass, uuid, date)', 'execute')`, [papel]), papel).toBe(false)
        expect(await escalar<boolean>(c, `select has_function_privilege($1, 'public.obs_archive_unit_source_rel(text, text, regclass)', 'execute')`, [papel]), papel).toBe(false)
        expect(await escalar<boolean>(c, `select has_function_privilege($1, 'public.obs_archive_row_digest_rel(uuid, text, text, regclass, uuid, date)', 'execute')`, [papel]), papel).toBe(false)
      }
    })
  })

  it('C-1: o resumo da linha inteira é igual na mãe, na partição e na _saida, e muda com uma coluna que não é a de controle (likes), sem mexer em contagem nem soma', async () => {
    await emTransacao(async () => {
      const { site, canal, videos } = await semearCanal(c, { videos: 3 })
      await semearDiaria(c, videos, MES, 31)
      const part = particaoDe('competitor_video_daily', MES)
      const dig = (rel: string | null): Promise<string> => escalar<string>(c, `select public.obs_archive_row_digest_rel($1, 'serie', 'competitor_video_daily', $2::regclass, $3, $4)::text`, [site, rel, canal, MES])
      const mae = await dig(null)
      expect(await dig(part)).toBe(mae)
      expect(Number(mae)).not.toBe(0)
      const antes = await q1(c, `select * from public.obs_archive_content_hash_rel($1, 'serie', 'competitor_video_daily', $2::regclass, $3, $4)`, [site, part, canal, MES])
      await c.query(`update public.competitor_video_daily set likes = coalesce(likes, 0) + 7 where video_id = $1 and snap_date = '2026-10-05'`, [videos[0]])
      const depois = await q1(c, `select * from public.obs_archive_content_hash_rel($1, 'serie', 'competitor_video_daily', $2::regclass, $3, $4)`, [site, part, canal, MES])
      expect(depois.row_count).toBe(antes.row_count)
      expect(depois.control_sum).toBe(antes.control_sum)          // a coluna de controle (views) não mudou
      const novo = await dig(part)
      expect(novo).not.toBe(mae)                                      // o resumo da linha inteira pega
      await c.query(`alter table public.competitor_video_daily detach partition ${part}`)
      await c.query(`alter table ${part} rename to competitor_video_daily_202610_saida`)
      expect(await dig('obs_part.competitor_video_daily_202610_saida')).toBe(novo)   // a tabela destacada dá o mesmo resumo da partição anexada
    })
  })

  it('m-13: relação de outro mês é recusada (o sufixo AAAAMM tem de ser o do mês pedido)', async () => {
    await emTransacao(async () => {
      const { site, canal } = await semearCanal(c, { videos: 1 })
      await c.query(`select obs_part.criar_particao('public.competitor_video_daily'::regclass, '2026-09-01')`)
      const set = particaoDe('competitor_video_daily', '2026-09-01')
      const r1 = await tenta(c, `select * from public.obs_archive_content_hash_rel($1, 'serie', 'competitor_video_daily', $2::regclass, $3, $4)`, [site, set, canal, MES])
      expect(r1).toMatchObject({ ok: false, message: expect.stringContaining('relacao_invalida') })
      const r2 = await tenta(c, `select public.obs_archive_row_digest_rel($1, 'serie', 'competitor_video_daily', $2::regclass, $3, $4)`, [site, set, canal, MES])
      expect(r2).toMatchObject({ ok: false, message: expect.stringContaining('relacao_invalida') })
    })
  })

  it('m-6: guarda de texto: o hash sobre relação e o leitor da M3b serializam a linha com a MESMA expressão (dívida declarada)', async () => {
    await emTransacao(async () => {
      const a = await escalar<string>(c, `select prosrc from pg_proc where oid = 'public.obs_archive_content_hash_rel(uuid, text, text, regclass, uuid, date)'::regprocedure`)
      const b = await escalar<string>(c, `select prosrc from pg_proc where proname = 'obs_archive_read_unit' and pronamespace = 'public'::regnamespace`)
      const ex = 'to_jsonb(array[%1$s]::text[])'
      expect(a).toContain(ex)
      expect(b).toContain(ex)
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/manutencao-m6-hash.test.ts > /tmp/m6-t1.log 2>&1; grep -E "FAIL|Tests |does not exist" /tmp/m6-t1.log | head`
Expected: FAIL (`function public.obs_archive_unit_source_rel ... does not exist`).

- [ ] **Step 3: O SQL (o mesmo texto no arquivo e entre os marcadores do rascunho)**

```sql
-- Tabela-mãe (p_rel nulo), partição anexada ou tabela destacada (_saida): o mesmo from_where da M3b, trocando só a relação (M6, decisão 5).
create or replace function public.obs_archive_unit_source_rel(p_class text, p_table text, p_rel regclass)
returns table (rel regclass, from_where text, order_by text, control_expr text)
language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  s record;
  v_modo text;
  v_de text;
begin
  select * into s from public.obs_archive_unit_source(p_class, p_table);
  if p_rel is null then
    rel := s.rel; from_where := s.from_where; order_by := s.order_by; control_expr := s.control_expr;
    return next; return;
  end if;
  select p.exit_mode into v_modo from public.obs_archive_policy() p where p.class = p_class and p.table_name = p_table;
  if v_modo is distinct from 'particao' then raise exception 'relacao_so_em_particao' using errcode = 'P0001', detail = p_class || '/' || p_table; end if;
  if not exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
                  where c.oid = p_rel and n.nspname = 'obs_part' and c.relname::text ~ ('^' || p_table || '_[0-9]{6}(_saida)?$')) then
    raise exception 'relacao_invalida' using errcode = 'P0001', detail = p_rel::text;
  end if;
  v_de := 'from public.' || pg_catalog.quote_ident(p_table) || ' t ';
  rel := p_rel; order_by := s.order_by; control_expr := s.control_expr;
  from_where := pg_catalog.replace(s.from_where, v_de, 'from ' || p_rel::text || ' t ');
  if from_where = s.from_where then raise exception 'fonte_sem_tabela' using errcode = 'P0001', detail = p_table; end if;
  return next;
end $$;

-- Os três valores de obs_archive_content_hash, lidos de p_rel (sem paginação). Mesma serialização de obs_archive_read_unit.
create or replace function public.obs_archive_content_hash_rel(p_site uuid, p_class text, p_table text, p_rel regclass, p_channel uuid, p_month date)
returns table (row_count bigint, control_sum text, hash_conteudo text)
language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  s record; v_cols text;
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := (((p_month + interval '1 month')::date)::text || ' 00:00:00-03')::timestamptz;
begin
  if p_month <> date_trunc('month', p_month)::date then raise exception 'mes_invalido' using errcode = 'P0001'; end if;
  if p_rel is not null and p_rel::text !~ ('_' || pg_catalog.to_char(p_month, 'YYYYMM') || '(_saida)?$') then
    raise exception 'relacao_invalida' using errcode = 'P0001', detail = p_rel::text || ' não é a relação de ' || p_month::text;   -- m-13
  end if;
  select * into s from public.obs_archive_unit_source_rel(p_class, p_table, p_rel);
  select string_agg('t.' || pg_catalog.quote_ident(a.attname) || '::text', ', ' order by a.attnum) into v_cols
    from pg_catalog.pg_attribute a
   where a.attrelid = (select x.rel from public.obs_archive_unit_source(p_class, p_table) x) and a.attnum > 0 and not a.attisdropped;
  return query execute format(
    'with u as (select to_jsonb(array[%1$s]::text[]) as r, %2$s as c, row_number() over (order by %3$s) as n %4$s)
     select (select count(*) from u)::bigint,
            (coalesce((select sum(u.c) from u), $7::numeric))::text,
            (select encode(sha256(convert_to(coalesce(string_agg(u.r::text, E''\n'' order by u.n), ''''), ''UTF8'')), ''hex'') from u)',
    v_cols, s.control_expr, s.order_by, s.from_where)
  using p_site, p_channel, p_month, v_ini, v_fim, (p_month + interval '1 month')::date,
        case when s.control_expr = 'null::numeric' then null::numeric else 0::numeric end;
end $$;

-- C-1/I1: o resumo da LINHA INTEIRA do canal no mês, sobre as mesmas linhas do from_where do hash. A conferência o guarda; o tally o compara sob a trava
-- (o hash caro roda antes da trava; contagem e soma sozinhas não pegam uma coluna que não é a de controle).
create or replace function public.obs_archive_row_digest_rel(p_site uuid, p_class text, p_table text, p_rel regclass, p_channel uuid, p_month date)
returns numeric
language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set extra_float_digits = 3 set datestyle = 'ISO, YMD' set intervalstyle = 'postgres' set bytea_output = 'hex'
as $$
declare
  s record; v numeric;
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := (((p_month + interval '1 month')::date)::text || ' 00:00:00-03')::timestamptz;
begin
  if p_month <> date_trunc('month', p_month)::date then raise exception 'mes_invalido' using errcode = 'P0001'; end if;
  if p_rel is not null and p_rel::text !~ ('_' || pg_catalog.to_char(p_month, 'YYYYMM') || '(_saida)?$') then
    raise exception 'relacao_invalida' using errcode = 'P0001', detail = p_rel::text;
  end if;
  select * into s from public.obs_archive_unit_source_rel(p_class, p_table, p_rel);
  execute pg_catalog.format('select coalesce(sum(pg_catalog.hashtextextended(t::text, 0)::numeric), 0) %s', s.from_where)
    into v using p_site, p_channel, p_month, v_ini, v_fim, (p_month + interval '1 month')::date;
  return v;
end $$;
revoke all on function public.obs_archive_unit_source_rel(text, text, regclass) from public, anon, authenticated, service_role;
revoke all on function public.obs_archive_content_hash_rel(uuid, text, text, regclass, uuid, date) from public, anon, authenticated, service_role;
revoke all on function public.obs_archive_row_digest_rel(uuid, text, text, regclass, uuid, date) from public, anon, authenticated, service_role;
```

(`hashtextextended(t::text, 0)` é determinístico dentro da mesma versão do Postgres e das mesmas colunas; o digest só é comparado dentro da janela de 10 minutos e nunca sai do banco. As colunas vêm da tabela-mãe, como no `obs_archive_read_unit`: a lista e a ordem de colunas são as mesmas na partição e na destacada; se um dia divergirem, o teste da igualdade falha antes de qualquer saída. Para a classe `ensaio`, `p_table` é `obs_archive_rehearsal` e o `from` original é `from public.obs_archive_rehearsal t `: a troca vale igual.)

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2 e `npx vitest run test/integration/manutencao-m6-trava.test.ts`.
Expected: PASS (8 + 2).

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/integration/manutencao-m6-hash.test.ts
git commit -m "feat: M6 parte 1: hash por unidade sobre a partição ou a tabela destacada, igual ao da tabela-mãe

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/sql/obs-archive-hash-rel.sql supabase/rascunhos/m6.sql apps/web/test/integration/manutencao-m6-hash.test.ts
```

---
### Task 2 [M6a]: O invariante do mês destacado (gatilhos, ordem e catálogo)

**Files:**
- Modify: `supabase/rascunhos/m6.sql` (PARTE 2)
- Create: `apps/web/test/integration/manutencao-m6-invariante.test.ts`

**Interfaces:**
- Consumes: `public.obs_archive_months` (M3b); gatilhos `obs_archive_z_destino_declarado` e `obs_archive_z_truncate` (M3b).
- Produces:
  - `public.obs_archive_block_delete_while_detached() returns trigger` (volatile, security definer, `search_path` vazio): recusa com `mes_destacado_em_transito` (P0001) e `detail` `'<tabela> mm/aaaa, ...'`.
  - Gatilhos `obs_archive_a_mes_destacado` (before delete, por linha) e `obs_archive_a_mes_destacado_truncate` (before truncate, por instrução) em `public.competitor_videos` e `public.competitor_channels`.
  - `public.obs_archive_invariante_faltam() returns text[]`: os gatilhos ausentes ou desligados, como `'<tabela>.<gatilho>'`; vazio = os quatro ligados (`tgenabled` em `O`/`A`).
  - Gatilho `obs_archive_a_unidade_em_mes_destacado` (before insert em `obs_archive_units`): unidade nova de mês destacado recusa com `mes_destacado_em_transito` (o `expurgar` e qualquer reexportação; item 89).

- [ ] **Step 1: Os testes (falham: os gatilhos não existem)**

```ts
// apps/web/test/integration/manutencao-m6-invariante.test.ts
// @vitest-environment node
/**
 * M6 parte 2 (plano M6, Tarefa 2; itens 126 e 127): com mês destacado, nada apaga vídeo nem canal, por nenhum caminho; fora dele, nada muda.
 * O destaque aqui é só a marca no registro (detached_at): a tabela destacada de verdade e a contagem dela são da Tarefa 4.
 * begin … rollback; nunca deixa mês destacado confirmado (as limpezas da E14/E16 apagam canais).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar, tenta, semearCanal, SITE_TESTE } from '../helpers/m3b'
import { prepararM6, apagarCanalDeclarando, novoAdmin } from '../helpers/m6'   // emenda 23/10 (N-M6-1): `admin = await novoAdmin(c, SITE_TESTE)` dentro de cada `emTransacao` que apaga canal

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const GATILHOS = [
  'competitor_channels.obs_archive_a_mes_destacado', 'competitor_channels.obs_archive_a_mes_destacado_truncate',
  'competitor_videos.obs_archive_a_mes_destacado', 'competitor_videos.obs_archive_a_mes_destacado_truncate',
]

describe.skipIf(skipIfNoLocalDb())('M6 parte 2: o invariante do mês destacado', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try { await prepararM6(c, 2); await f() } finally { await c.query('rollback') }
  }
  async function destacar(site: string, classe = 'serie', tabela = 'competitor_video_daily', mes = '2026-10-01'): Promise<void> {
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, detached_at) values ($1, $2, $3, $4, now())
                   on conflict (site_id, class, table_name, month) do update set detached_at = now(), dropped_at = null`, [site, classe, tabela, mes])
  }

  it('catálogo: os quatro gatilhos existem, ligados, com a função volatile, security definer e search_path vazio', async () => {
    await emTransacao(async () => {
      expect(await escalar<string[]>(c, `select public.obs_archive_invariante_faltam()`)).toEqual([])
      const f = (await c.query(`select provolatile, prosecdef, proconfig from pg_proc where oid = 'public.obs_archive_block_delete_while_detached()'::regprocedure`)).rows[0]
      expect(f).toEqual({ provolatile: 'v', prosecdef: true, proconfig: ['search_path=""'] })
    })
  })

  it('ordem: o gatilho do mês destacado dispara ANTES dos da M3b (ordem alfabética do nome)', async () => {
    await emTransacao(async () => {
      const del = (await c.query(`select tgname from pg_trigger where tgrelid = 'public.competitor_channels'::regclass and not tgisinternal
                                    and (tgtype & 2) = 2 and (tgtype & 8) = 8 and (tgtype & 1) = 1 order by tgname`)).rows.map(r => r.tgname as string)
      expect(del.indexOf('obs_archive_a_mes_destacado')).toBeGreaterThanOrEqual(0)
      expect(del.indexOf('obs_archive_a_mes_destacado')).toBeLessThan(del.indexOf('obs_archive_z_destino_declarado'))
      const tru = (await c.query(`select tgname from pg_trigger where tgrelid = 'public.competitor_channels'::regclass and not tgisinternal
                                    and (tgtype & 2) = 2 and (tgtype & 32) = 32 order by tgname`)).rows.map(r => r.tgname as string)
      expect(tru.indexOf('obs_archive_a_mes_destacado_truncate')).toBeLessThan(tru.indexOf('obs_archive_z_truncate'))
    })
  })

  it('tgenabled D ou R conta como ausente; O e A, como ligado', async () => {
    await emTransacao(async () => {
      await c.query(`alter table public.competitor_videos disable trigger obs_archive_a_mes_destacado`)
      expect(await escalar<string[]>(c, `select public.obs_archive_invariante_faltam()`)).toEqual(['competitor_videos.obs_archive_a_mes_destacado'])
      await c.query(`alter table public.competitor_videos enable replica trigger obs_archive_a_mes_destacado`)
      expect(await escalar<string[]>(c, `select public.obs_archive_invariante_faltam()`)).toEqual(['competitor_videos.obs_archive_a_mes_destacado'])
      await c.query(`alter table public.competitor_videos enable always trigger obs_archive_a_mes_destacado`)
      expect(await escalar<string[]>(c, `select public.obs_archive_invariante_faltam()`)).toEqual([])
      await c.query(`drop trigger obs_archive_a_mes_destacado_truncate on public.competitor_channels`)
      expect(await escalar<string[]>(c, `select public.obs_archive_invariante_faltam()`)).toEqual(['competitor_channels.obs_archive_a_mes_destacado_truncate'])
    })
  })

  it('126: com mês destacado, (a) delete de vídeo, (b) delete de canal, (c) cascata com o gatilho do canal desligado, (d) função security definer, (e) truncate: todos recusam e nada some', async () => {
    await emTransacao(async () => {
      const { canal, videos } = await semearCanal(c, { videos: 2 })
      await destacar(SITE_TESTE)
      const antes = await escalar<string>(c, `select count(*)::text from public.competitor_videos where competitor_channel_id = $1`, [canal])
      const casos: Array<[string, string]> = [
        ['a', `delete from public.competitor_videos where id = '${videos[0]}'`],
        ['b', `delete from public.competitor_channels where id = '${canal}'`],
        ['e1', `truncate public.competitor_videos cascade`],
        ['e2', `truncate public.competitor_channels cascade`],
      ]
      for (const [nome, sql] of casos) {
        const r = await tenta(c, sql)
        expect(r, nome).toMatchObject({ ok: false, code: 'P0001', message: 'mes_destacado_em_transito' })
      }
      await c.query(`alter table public.competitor_channels disable trigger obs_archive_a_mes_destacado`)
      const rc = await tenta(c, `delete from public.competitor_channels where id = $1`, [canal])
      expect(rc, 'c').toMatchObject({ ok: false, message: 'mes_destacado_em_transito' })
      await c.query(`alter table public.competitor_channels enable trigger obs_archive_a_mes_destacado`)
      await c.query(`create function pg_temp.apaga_canal(p uuid) returns void language sql security definer as $f$ delete from public.competitor_channels where id = p $f$`)
      await c.query(`set local role service_role`)
      const rd = await tenta(c, `select pg_temp.apaga_canal($1)`, [canal])
      await c.query(`reset role`)
      expect(rd, 'd').toMatchObject({ ok: false, message: 'mes_destacado_em_transito' })
      expect(await escalar<string>(c, `select count(*)::text from public.competitor_videos where competitor_channel_id = $1`, [canal])).toBe(antes)
    })
  })

  it('o detail traz a tabela e o mês (mm/aaaa) de cada mês destacado; vale para outro site e para a classe ensaio', async () => {
    await emTransacao(async () => {
      const { canal } = await semearCanal(c, { videos: 1 })
      await destacar('00000000-0000-0000-0000-0000000000f1', 'ensaio', 'obs_archive_rehearsal', '2026-03-01')
      await destacar('00000000-0000-0000-0000-0000000000f2', 'serie', 'competitor_video_early', '2026-11-01')
      await c.query('savepoint s')
      try { await c.query(`delete from public.competitor_channels where id = $1`, [canal]); throw new Error('não recusou') } catch (e) {
        const d = (e as { detail?: string }).detail ?? ''
        expect(d).toContain('obs_archive_rehearsal 03/2026')
        expect(d).toContain('competitor_video_early 11/2026')
      }
      await c.query('rollback to savepoint s')
    })
  })

  it('127: sem mês destacado, depois de descartado (dropped_at) e depois de trazido de volta (detached_at nulo), apagar funciona como hoje', async () => {
    await emTransacao(async () => {
      const a = await semearCanal(c, { videos: 1 })
      expect(await tenta(c, `delete from public.competitor_videos where id = $1`, [a.videos[0]])).toMatchObject({ ok: true })
      await destacar(SITE_TESTE)
      await c.query(`update public.obs_archive_months set dropped_at = now() where site_id = $1`, [SITE_TESTE])
      const b = await semearCanal(c, { videos: 1 })
      await apagarCanalDeclarando(c, SITE_TESTE, b.canal, admin)    // emenda 23/10 (N-M6-1): delete cru recusa com a M3b aplicada
      await c.query(`update public.obs_archive_months set dropped_at = null, detached_at = null where site_id = $1`, [SITE_TESTE])
      const d = await semearCanal(c, { videos: 1 })
      await apagarCanalDeclarando(c, SITE_TESTE, d.canal, admin)    // idem: se a função recusar, o teste falha (ela levanta)
    })
  })

  // emenda 23/10 (Yannis N-M6-2, Phil N6-2): os dois chamadores da E9 já em produção passam pelo invariante
  it('126b: com mês destacado, competitor_video_purge e competitor_channel_purge (E9) recusam com mes_destacado_em_transito e nada some', async () => {
    await emTransacao(async () => {
      const { canal, videos } = await semearCanal(c, { videos: 1 })
      await destacar(SITE_TESTE)
      for (const sql of [
        `select public.competitor_video_purge('${SITE_TESTE}', '${videos[0]}', 'teste')`,       // ajustar assinatura ao corpo de produção (git show origin/staging:supabase/migrations/20261015000001_*.sql)
        `select public.competitor_channel_purge('${SITE_TESTE}', '${canal}', 'teste')`,
      ]) {
        const r = await tenta(c, sql)
        expect(r).toMatchObject({ ok: false })
        expect(JSON.stringify(r)).toContain('mes_destacado_em_transito')
      }
      expect(await escalar<string>(c, `select count(*)::text from public.competitor_videos where id = $1`, [videos[0]])).toBe('1')
    })
  })

  it('89: unidade nova de mês destacado (expurgo, reexportação) é recusada', async () => {
    await emTransacao(async () => {
      const { canal } = await semearCanal(c, { videos: 1 })
      await destacar(SITE_TESTE)
      const r = await tenta(c, `insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp)
        values ($1, 'serie', 'competitor_video_daily', $2, '2026-10-01', 2, 0, 0, repeat('0', 64), repeat('0', 64))`, [SITE_TESTE, canal])
      expect(r).toMatchObject({ ok: false, message: 'mes_destacado_em_transito' })
    })
  })

  it('128 (guarda): nenhum caminho que apaga vídeo ou canal abre transação acima de read committed', async () => {
    const { execSync } = await import('node:child_process')
    const achados = execSync(`grep -rlE "isolation level (repeatable read|serializable)" ../../supabase/migrations ../../supabase/rascunhos src lib || true`, { cwd: process.cwd(), encoding: 'utf8' }).trim()
    expect(achados).toBe('')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/manutencao-m6-invariante.test.ts > /tmp/m6-t2.log 2>&1; grep -E "FAIL|Tests |✓|×" /tmp/m6-t2.log | head -20`
Expected: FAIL (`parte 3 não encontrada` não: a parte 2 é o fim do rascunho; a falha é `function public.obs_archive_invariante_faltam() does not exist`). O último teste (grep) já passa.

- [ ] **Step 3: O SQL (PARTE 2 do rascunho)**

```sql
-- O invariante (02 §10.5): enquanto existir mês destacado e não descartado, de qualquer site e de qualquer tabela que sai por partição
-- (inclusive o ensaio), nada apaga vídeo nem canal de concorrente. VOLATILE: em read committed, lê retrato novo e enxerga um destaque
-- confirmado enquanto o apagamento esperava a trava.
create or replace function public.obs_archive_block_delete_while_detached()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
declare v_meses text;
begin
  select string_agg(m.table_name || ' ' || pg_catalog.to_char(m.month, 'MM/YYYY'), ', ' order by m.month, m.table_name) into v_meses
    from public.obs_archive_months m
   where m.detached_at is not null and m.dropped_at is null;
  if v_meses is not null then
    raise exception 'mes_destacado_em_transito' using errcode = 'P0001', detail = v_meses;
  end if;
  if tg_level = 'ROW' then return old; end if;
  return null;
end $$;
revoke all on function public.obs_archive_block_delete_while_detached() from public, anon, authenticated, service_role;

-- Nomes com "a_": em ordem alfabética antes de obs_archive_z_destino_declarado e obs_archive_z_truncate (M3b). O teste de ordem é da M6.
drop trigger if exists obs_archive_a_mes_destacado on public.competitor_videos;
create trigger obs_archive_a_mes_destacado before delete on public.competitor_videos
  for each row execute function public.obs_archive_block_delete_while_detached();
drop trigger if exists obs_archive_a_mes_destacado_truncate on public.competitor_videos;
create trigger obs_archive_a_mes_destacado_truncate before truncate on public.competitor_videos
  for each statement execute function public.obs_archive_block_delete_while_detached();
drop trigger if exists obs_archive_a_mes_destacado on public.competitor_channels;
create trigger obs_archive_a_mes_destacado before delete on public.competitor_channels
  for each row execute function public.obs_archive_block_delete_while_detached();
drop trigger if exists obs_archive_a_mes_destacado_truncate on public.competitor_channels;
create trigger obs_archive_a_mes_destacado_truncate before truncate on public.competitor_channels
  for each statement execute function public.obs_archive_block_delete_while_detached();

-- Os quatro gatilhos, ligados ('O' ou 'A'); 'D' e 'R' contam como ausentes (MEDIDO 13/10: com 'R' o apagamento passa).
create or replace function public.obs_archive_invariante_faltam()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(e.tab || '.' || e.nome order by e.tab, e.nome) filter (where t.oid is null), '{}'::text[])
    from (values ('competitor_videos', 'obs_archive_a_mes_destacado'), ('competitor_videos', 'obs_archive_a_mes_destacado_truncate'),
                 ('competitor_channels', 'obs_archive_a_mes_destacado'), ('competitor_channels', 'obs_archive_a_mes_destacado_truncate')) e(tab, nome)
    left join pg_catalog.pg_trigger t
      on t.tgrelid = pg_catalog.to_regclass('public.' || e.tab) and t.tgname = e.nome and t.tgenabled in ('O', 'A')
     and t.tgfoid = 'public.obs_archive_block_delete_while_detached()'::pg_catalog.regprocedure
$$;
revoke all on function public.obs_archive_invariante_faltam() from public, anon, authenticated;
grant execute on function public.obs_archive_invariante_faltam() to service_role;

-- Item 89: o mês destacado é imutável no registro também (expurgo e reexportação esperam o reattach).
create or replace function public.obs_archive_unit_in_detached_month() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
begin
  if exists (select 1 from public.obs_archive_months m
              where m.site_id = new.site_id and m.class = new.class and m.table_name = new.table_name and m.month = new.month
                and m.detached_at is not null and m.dropped_at is null) then
    raise exception 'mes_destacado_em_transito' using errcode = 'P0001', detail = new.table_name || ' ' || pg_catalog.to_char(new.month, 'MM/YYYY');
  end if;
  return new;
end $$;
revoke all on function public.obs_archive_unit_in_detached_month() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_a_unidade_em_mes_destacado on public.obs_archive_units;
create trigger obs_archive_a_unidade_em_mes_destacado before insert on public.obs_archive_units
  for each row execute function public.obs_archive_unit_in_detached_month();
```

(O teste do catálogo compara `proconfig` com `['search_path=""']`: é como o Postgres guarda `set search_path = ''`. Se o banco local mostrar outra grafia, o teste copia a do `pg_proc` da função `obs_archive_agora`, que tem a mesma cláusula.)

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2, e de novo `manutencao-m6-hash.test.ts` e `manutencao-m3b-remocao.test.ts` (a remoção da M3b continua igual sem mês destacado).
Expected: PASS nos três.

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/integration/manutencao-m6-invariante.test.ts
git commit -m "feat: M6 parte 2: gatilhos do mês destacado em vídeos e canais, antes dos da M3b, com vigia do catálogo

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m6.sql apps/web/test/integration/manutencao-m6-invariante.test.ts
```

---

### Task 3 [M6a]: Colunas novas, o portão e a conferência por canal

**Files:**
- Modify: `supabase/rascunhos/m6.sql` (PARTE 3)
- Create: `apps/web/test/integration/manutencao-m6-portao.test.ts`

**Interfaces:**
- Consumes: Tarefa 1 (`obs_archive_content_hash_rel`, `obs_archive_row_digest_rel`), Tarefa 2 (`obs_archive_invariante_faltam`); M7 (plano da M7, Tarefa 4): `obs_archive_pode_sair_em` (a PARTE 3 a cria idêntica se ainda não existir; Decisão 13); M3b: `obs_archive_policy`, `obs_archive_current_units`, `obs_archive_is_site_admin`, `obs_archive_schema_fp`, `obs_archive_agora`, `obs_archive_hoje_sp`, `obs_archive_channel_removals`; M2: `obs_part.nome_da_particao`.
- Produces:
  - Colunas: `obs_archive_prechecks.row_digest numeric` (C-1: o resumo da linha inteira da conferência); `obs_archive_switch.sims_seen int not null default 0`, `last_sim_at`, `refusals_b2 int not null default 0`, `disarm_month date`, `disarm_detail jsonb`, `disarm_seen_at`; `check` de `disarm_reason ∈ ('1','2','3','4','5','6','7','8','9','10','11','13','manual')`; `obs_archive_months.reattached_at`, `obs_archive_months.reattach_out_of_order boolean not null default false`.
  - `public.obs_archive_exit_class(p_table text) returns text` (classe da tabela de partição, ou nulo).
  - `public.obs_archive_part_rel(p_table text, p_month date, p_saida boolean) returns regclass` (nulo se não existe).
  - `public.obs_archive_month_green(p_site uuid, p_class text, p_table text, p_month date) returns boolean` (selado, NAS ≤ 24 h, B2 válido).
  - `public.obs_archive_gate(p_site uuid, p_class text, p_table text, p_month date, p_by uuid, p_mode text, p_rel regclass, p_conds integer[], p_dry_run boolean) returns jsonb` (lista de `{codigo, ...}`; condições 1-11, 13 e 20 = R27). Interna.
  - `public.obs_archive_tally(p_site uuid, p_class text, p_table text, p_month date, p_rel regclass, p_resumo boolean default false) returns jsonb` (`{linhas, soma, esperado_linhas, esperado_soma, sites, codigo}`; `codigo` nulo, `canal_sem_unidade` ou `conteudo_mudou`). Uma varredura só, agrupada por canal; com `p_resumo` (sob a trava) soma também o `hashtextextended(t::text, 0)` de cada canal e o compara com `obs_archive_prechecks.row_digest`: diferença ou ausência de conferência = `conteudo_mudou` (C-1). `sites` = os OUTROS sites com linha na relação (m-5). Interna.
  - `public.obs_archive_outros_sites_ok(p_class text, p_table text, p_month date, p_tally jsonb) returns boolean`: a condição 13 sob a trava, sobre a lista de sites que o `tally` devolveu (sem nova varredura). Interna.
  - `public.obs_archive_conferir_canal(p_site uuid, p_class text, p_table text, p_rel regclass, p_channel uuid, p_month date, p_row_count bigint, p_control_sum numeric, p_hash text, p_gravar boolean) returns boolean`: resumo, hash e resumo de novo (os dois resumos têm de ser iguais: o dado não mudou durante a conferência); com `p_gravar`, grava a conferência com o resumo (ou apaga a anterior se não bate: M2). Interna.
  - `public.obs_archive_pode_sair_em(p_month date, p_window integer) returns date` e `public.obs_archive_piso_registro() returns date`: iguais às da M7 (Decisão 13). Internas.
  - `public.obs_archive_precheck_channels(p_site uuid, p_table text, p_month date, p_only_stale boolean default false) returns text[]` (com `p_only_stale`, só os canais sem conferência de menos de 8 minutos; Phil M5) e `public.obs_archive_precheck_unit(p_site uuid, p_table text, p_month date, p_channel uuid) returns jsonb` (`{ok, codigo?}`): `service_role`.
  - `public.obs_archive_exit_check(p_site uuid, p_table text, p_month date, p_by uuid) returns jsonb` (as condições de registro, sem varrer hash: `{estado, faltam, dois_passos, descartes, liberar_a_partir}`): `service_role`. É o que a linha do mês lê para o estado T1/T3/T7.
  - Códigos (catálogo fechado): `classe_nao_liberada`, `ainda_na_janela {pode_sair_em}`, `nao_selado`, `canal_sem_unidade {canais}`, `conteudo_mudou {canais}`, `nas_sem_atestacao {horas, canais_sem_resumo}`, `b2_sem_atestacao {motivo: 'prazo'|'retirada', dias_forja, dias_dono, em, razao}`, `restauracao_vencida {classe, tabela, ultima}`, `esquema_mudou {tabela}`, `dia_nao_somado {pares}`, `marca_pendente {videos}`, `marcas_ausentes`, `expurgo_pendente {itens}`, `sem_direito`, `interruptor_desligado`, `outro_site_na_particao`, `saida_fora_de_ordem {antes}`.

- [ ] **Step 1: Os testes (falham: o portão não existe)**

```ts
// apps/web/test/integration/manutencao-m6-portao.test.ts
// @vitest-environment node
/** M6 parte 3 (plano M6, Tarefa 3; itens 40, 90, 91, 122, 129 e R27): uma recusa por condição, medida no instante. begin … rollback. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar, q1, semearCanal, semearDiaria, SITE_TESTE } from '../helpers/m3b'
import { prepararM6, relogio, liberarClasses, novoAdmin, selarMes, particaoDe } from '../helpers/m6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MES = '2026-10-01'
const D = 'competitor_video_daily'
type Falta = { codigo: string } & Record<string, unknown>

describe.skipIf(skipIfNoLocalDb())('M6 parte 3: o portão', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })

  /** Um mês verde de verdade: canal com 3 vídeos, outubro inteiro na diária, selado, NAS de 1 h, B2 da forja de 1 dia, ensaio de 10 dias. */
  async function cenario(): Promise<{ site: string; canal: string; videos: string[]; admin: string }> {
    await relogio(c, '2027-05-02 12:00:00+00')
    await liberarClasses(c, ['serie', 'horaria', 'ensaio'])
    const s = await semearCanal(c, { videos: 3 })
    await semearDiaria(c, s.videos, MES, 31)
    await selarMes(c, { site: s.site, classe: 'serie', tabela: D, mes: MES })
    await c.query(`insert into public.competitor_video_marks (video_id, age_days, site_id, views, gap_hours, age_base_at, read_before_at, read_after_at)
                   select v, 30, $2, 1, 1, now(), now(), now() from unnest($1::uuid[]) v on conflict do nothing`, [s.videos, s.site])
    return { ...s, admin: await novoAdmin(c, s.site) }
  }
  async function portao(site: string, por: string | null, conds: number[], o: { modo?: string; simular?: boolean; mes?: string; tabela?: string } = {}): Promise<Falta[]> {
    const tabela = o.tabela ?? D, mes = o.mes ?? MES
    return escalar<Falta[]>(c, `select public.obs_archive_gate($1, public.obs_archive_exit_class($2), $2, $3, $4, $5, public.obs_archive_part_rel($2, $3, false), $6::int[], $7)`,
      [site, tabela, mes, por, o.modo ?? 'clique', conds, o.simular ?? true])
  }
  const codigos = (f: Falta[]): string[] => f.map(x => x.codigo)
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try { await prepararM6(c, 3); await f() } finally { await c.query('rollback') }
  }
  const TODAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 20]

  it('o mês verde passa por todas as condições', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      expect(await portao(site, admin, TODAS)).toEqual([])
    })
  })

  it('1: classe não liberada', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await c.query(`select 1`)  // a política volta ao original só com nova recriação:
      const def = await escalar<string>(c, `select pg_get_functiondef('public.obs_archive_policy()'::regprocedure)`)
      await c.query(def.replace(`('serie', 'competitor_video_daily', 'particao', 6, 28, 7, 'depois_de_3', true,`, `('serie', 'competitor_video_daily', 'particao', 6, 28, 7, 'depois_de_3', false,`))
      expect(codigos(await portao(site, admin, [1]))).toEqual(['classe_nao_liberada'])
    })
  })

  it('2: dentro da janela em dia de São Paulo: 30/04 recusa com pode_sair_em 2027-05-01; 01/05 passa', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await relogio(c, '2027-05-01 02:59:00+00')                 // 23:59 de 30/04 em SP
      expect(await portao(site, admin, [2])).toEqual([{ codigo: 'ainda_na_janela', pode_sair_em: '2027-05-01' }])
      await relogio(c, '2027-05-01 03:00:00+00')                 // 00:00 de 01/05 em SP
      expect(await portao(site, admin, [2])).toEqual([])
    })
  })

  it('2 e D15: a data do portão é a da função única obs_archive_pode_sair_em (a M7 usa a mesma)', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await relogio(c, '2027-04-20 12:00:00+00')
      const [f] = await portao(site, admin, [2])
      expect(f).toEqual({ codigo: 'ainda_na_janela', pode_sair_em: '2027-05-01' })
      expect(await escalar<string>(c, `select public.obs_archive_pode_sair_em($1::date, 6)::text`, [MES])).toBe('2027-05-01')
    })
  })

  it('3: não selado; e canal com linha e sem unidade', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await c.query(`update public.obs_archive_months set unsealed_at = now(), unsealed_reason = 'unidade_nova' where site_id = $1`, [site])
      expect(codigos(await portao(site, admin, [3]))).toEqual(['nao_selado'])
      await c.query(`update public.obs_archive_months set unsealed_at = null, unsealed_reason = null where site_id = $1`, [site])
      const outro = await semearCanal(c, { videos: 1 })
      await semearDiaria(c, outro.videos, MES, 2)
      const f = await portao(site, admin, [3])
      expect(f).toEqual([{ codigo: 'canal_sem_unidade', canais: [outro.canal] }])
    })
  })

  it('4: linha inserida depois da selagem recusa e, fora da simulação, o mês volta a não selado', async () => {
    await emTransacao(async () => {
      const { site, admin, videos } = await cenario()
      await c.query(`update public.competitor_video_daily set views = views + 1 where video_id = $1 and snap_date = '2026-10-05'`, [videos[0]])
      expect(codigos(await portao(site, admin, [4], { simular: true }))).toEqual(['conteudo_mudou'])
      expect(await escalar<string | null>(c, `select unsealed_reason from public.obs_archive_months where site_id = $1`, [site])).toBeNull()
      expect(codigos(await portao(site, admin, [4], { simular: false }))).toEqual(['conteudo_mudou'])
      expect(await escalar<string | null>(c, `select unsealed_reason from public.obs_archive_months where site_id = $1`, [site])).toBe('conteudo_mudou')
    })
  })

  it('4 (CP13, C-1): a conferência fresca dispensa o recálculo no portão, mas NÃO a comparação do resumo da linha inteira sob a trava; de 11 minutos, o portão recalcula', async () => {
    await emTransacao(async () => {
      const { site, admin, canal, videos } = await cenario()
      const r = await escalar<{ ok: boolean }>(c, `select public.obs_archive_precheck_unit($1, $2, $3, $4)`, [site, D, MES, canal])
      expect(r).toEqual({ ok: true })
      expect(await escalar<string | null>(c, `select row_digest::text from public.obs_archive_prechecks where site_id = $1 and channel_ref = $2::text`, [site, canal])).not.toBeNull()
      // muda uma coluna que NÃO é a de controle DEPOIS da conferência: com ela fresca o portão não recalcula e passa...
      await c.query(`update public.competitor_video_daily set likes = coalesce(likes, 0) + 7 where video_id = $1 and snap_date = '2026-10-05'`, [videos[0]])
      expect(await portao(site, admin, [4], { simular: false })).toEqual([])
      // ...mas o tally COM resumo, que é o que roda sob a trava, pega; sem resumo (simulação) só vê contagem e soma.
      const rel = `public.obs_archive_part_rel($2, $3, false)`
      const com = await escalar<{ codigo: string | null }>(c, `select public.obs_archive_tally($1, 'serie', $2, $3, ${rel}, true)`, [site, D, MES])
      expect(com.codigo).toBe('conteudo_mudou')
      const sem = await escalar<{ codigo: string | null }>(c, `select public.obs_archive_tally($1, 'serie', $2, $3, ${rel}, false)`, [site, D, MES])
      expect(sem.codigo).toBeNull()
      await relogio(c, '2027-05-02 12:11:00+00')
      expect(codigos(await portao(site, admin, [4]))).toEqual(['conteudo_mudou'])
    })
  })

  it('M2: a conferência que não bate apaga a anterior; sem conferência, o tally com resumo recusa', async () => {
    await emTransacao(async () => {
      const { site, canal, videos } = await cenario()
      expect(await escalar(c, `select public.obs_archive_precheck_unit($1, $2, $3, $4)`, [site, D, MES, canal])).toEqual({ ok: true })
      await c.query(`update public.competitor_video_daily set views = views + 1 where video_id = $1 and snap_date = '2026-10-06'`, [videos[0]])
      expect(await escalar(c, `select public.obs_archive_precheck_unit($1, $2, $3, $4)`, [site, D, MES, canal])).toEqual({ ok: false, codigo: 'conteudo_mudou' })
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_prechecks where site_id = $1 and channel_ref = $2::text`, [site, canal])).toBe(0)
      const t = await escalar<{ codigo: string | null }>(c, `select public.obs_archive_tally($1, 'serie', $2, $3, public.obs_archive_part_rel($2, $3, false), true)`, [site, D, MES])
      expect(t.codigo).toBe('conteudo_mudou')
    })
  })

  it('só os velhos: canal conferido há menos de 8 minutos sai da lista; com 9 minutos volta', async () => {
    await emTransacao(async () => {
      const { site, canal } = await cenario()
      expect(await escalar<string[]>(c, `select public.obs_archive_precheck_channels($1, $2, $3, true)`, [site, D, MES])).toEqual([canal])
      await escalar(c, `select public.obs_archive_precheck_unit($1, $2, $3, $4)`, [site, D, MES, canal])
      expect(await escalar<string[]>(c, `select public.obs_archive_precheck_channels($1, $2, $3, true)`, [site, D, MES])).toEqual([])
      expect(await escalar<string[]>(c, `select public.obs_archive_precheck_channels($1, $2, $3)`, [site, D, MES])).toEqual([canal])
      await relogio(c, '2027-05-02 12:09:00+00')
      expect(await escalar<string[]>(c, `select public.obs_archive_precheck_channels($1, $2, $3, true)`, [site, D, MES])).toEqual([canal])
    })
  })

  it('5 e 122: NAS de 25 horas recusa com as horas, em qualquer modo', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await c.query(`update public.obs_archive_months set nas_attested_at = public.obs_archive_agora() - interval '25 hours' where site_id = $1`, [site])
      for (const modo of ['clique', 'automatico']) {
        const f = await portao(site, admin, [5], { modo })
        expect(f, modo).toEqual([expect.objectContaining({ codigo: 'nas_sem_atestacao', horas: 25 })])
      }
    })
  })

  it('6: B2 da forja de 8 dias e do dono de 36 recusam por prazo; do dono de 34, passa; retirada recusa mesmo recente', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await c.query(`update public.obs_archive_months set b2_forja_ok_at = public.obs_archive_agora() - interval '8 days', b2_dono_ok_at = public.obs_archive_agora() - interval '36 days', b2_dono_manifest_sha256 = manifest_sha256 where site_id = $1`, [site])
      expect(await portao(site, admin, [6])).toEqual([{ codigo: 'b2_sem_atestacao', motivo: 'prazo', dias_forja: 8, dias_dono: 36 }])
      await c.query(`update public.obs_archive_months set b2_dono_ok_at = public.obs_archive_agora() - interval '34 days' where site_id = $1`, [site])
      expect(await portao(site, admin, [6])).toEqual([])
      await c.query(`update public.obs_archive_months set b2_withdrawn_at = public.obs_archive_agora() - interval '1 hour', b2_withdrawn_reason = 'divergente', b2_withdrawn_via = 'forja' where site_id = $1`, [site])
      expect(await portao(site, admin, [6])).toEqual([expect.objectContaining({ codigo: 'b2_sem_atestacao', motivo: 'retirada', razao: 'divergente' })])
    })
  })

  it('7 e 90: ensaio de 181 dias recusa nomeando a tabela; o da early não vale para a diária; ensaio sem linha não vale; coluna nova = esquema_mudou', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await c.query(`update public.obs_archive_restores set done_at = public.obs_archive_agora() - interval '181 days' where site_id = $1`, [site])
      expect(await portao(site, admin, [7])).toEqual([expect.objectContaining({ codigo: 'restauracao_vencida', classe: 'serie', tabela: D })])
      await c.query(`insert into public.obs_archive_restores (site_id, class, table_name, schema_fp, origem, chave, units_checked, rows_restored, diff_rows, done_by)
                     values ($1, 'serie', 'competitor_video_early', public.obs_archive_schema_fp('public.competitor_video_early'::regclass), 'b2', 'cofre', 1, 5, 0, 'd')`, [site])
      expect(codigos(await portao(site, admin, [7]))).toEqual(['restauracao_vencida'])
      await c.query(`insert into public.obs_archive_restores (site_id, class, table_name, schema_fp, origem, chave, units_checked, rows_restored, diff_rows, done_by)
                     values ($1, 'serie', $2, public.obs_archive_schema_fp('public.competitor_video_daily'::regclass), 'b2', 'cofre', 1, 0, 0, 'd')`, [site, D])
      expect(codigos(await portao(site, admin, [7]))).toEqual(['restauracao_vencida'])
      await c.query(`update public.obs_archive_restores set done_at = public.obs_archive_agora() - interval '10 days', rows_restored = 10 where site_id = $1 and table_name = $2`, [site, D])
      await c.query(`alter table public.competitor_video_daily add column coluna_nova_m6 int`)
      expect(await portao(site, admin, [7])).toEqual([{ codigo: 'esquema_mudou', tabela: D }])
    })
  })

  it('8: leitura horária com par (vídeo, dia de SP) sem soma no mapa', async () => {
    await emTransacao(async () => {
      await relogio(c, '2027-02-02 12:00:00+00')
      await liberarClasses(c, ['horaria'])
      const { site, videos } = await semearCanal(c, { videos: 1 })
      const admin = await novoAdmin(c, site)
      await c.query(`select obs_part.criar_particao('public.competitor_video_hourly'::regclass, $1)`, [MES])
      await c.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views) values ($1, '2026-10-10 15:00+00', '2026-10-10 15:05+00', $2, 10)`, [videos[0], site])
      const f = await portao(site, admin, [8], { tabela: 'competitor_video_hourly' })
      expect(f).toEqual([{ codigo: 'dia_nao_somado', pares: 1 }])
      await c.query(`insert into public.competitor_hour_fold_log (video_id, day, site_id, intervals_clean, intervals_long) values ($1, '2026-10-10', $2, 1, 0)`, [videos[0], site])
      expect(await portao(site, admin, [8], { tabela: 'competitor_video_hourly' })).toEqual([])
    })
  })

  it('9: marca de 30 dias pendente; tabela de marcas ausente', async () => {
    await emTransacao(async () => {
      const { site, admin, canal } = await cenario()
      await c.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at) values ($1, 'm6marcapend', 'v', '2026-09-20 12:00+00')`, [canal])
      expect(await portao(site, admin, [9])).toEqual([{ codigo: 'marca_pendente', videos: 1 }])
      await c.query(`alter table public.competitor_video_mark_misses rename to competitor_video_mark_misses_m6`)
      expect(codigos(await portao(site, admin, [9]))).toEqual(['marcas_ausentes'])
    })
  })

  it('10: expurgo pendente de vídeo segura o mês (o caso 129(b), item com todas as unidades purged_at, está na Tarefa 4)', async () => {
    await emTransacao(async () => {
      const { site, admin, canal } = await cenario()
      const admin2 = admin
      await c.query(`insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_by, rows_deleted, archive_pending)
                     values ($1, 'video', 'm6exp', $2, $3, '{}'::jsonb, true)`, [site, canal, admin2])
      expect(await portao(site, admin, [10])).toEqual([{ codigo: 'expurgo_pendente', itens: 1 }])
    })
  })

  it('11: quem não administra recusa com sem_direito; automático sem interruptor armado, interruptor_desligado', async () => {
    await emTransacao(async () => {
      const { site } = await cenario()
      const qualquer = '00000000-0000-0000-0000-00000000dead'
      expect(codigos(await portao(site, qualquer, [11]))).toEqual(['sem_direito'])
      expect(codigos(await portao(site, null, [11]))).toEqual(['sem_direito'])
      expect(codigos(await portao(site, null, [11], { modo: 'automatico' }))).toEqual(['interruptor_desligado'])
      await c.query(`insert into public.obs_archive_switch (site_id, class, armed_at, expires_at) values ($1, 'serie', public.obs_archive_agora(), public.obs_archive_agora() + interval '90 days')`, [site])
      expect(await portao(site, null, [11], { modo: 'automatico' })).toEqual([])
      await relogio(c, '2027-08-01 12:00:00+00')
      expect(codigos(await portao(site, null, [11], { modo: 'automatico' }))).toEqual(['interruptor_desligado'])
    })
  })

  it('13 e 91: linha de outro site na partição, sem mês selado e verde dele, recusa; com o mês dele verde, passa', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      const outro = await semearCanal(c, { site: '00000000-0000-0000-0000-00000000a3b1', videos: 1 })
      await semearDiaria(c, outro.videos, MES, 3)
      expect(codigos(await portao(site, admin, [13]))).toEqual(['outro_site_na_particao'])
      await selarMes(c, { site: outro.site, classe: 'serie', tabela: D, mes: MES })
      expect(await portao(site, admin, [13])).toEqual([])
    })
  })

  it('R27: mês anterior com linha ainda online recusa com saida_fora_de_ordem', async () => {
    await emTransacao(async () => {
      const { site, admin, videos } = await cenario()
      await semearDiaria(c, videos, '2026-09-01', 30)
      await selarMes(c, { site, classe: 'serie', tabela: D, mes: '2026-09-01' })
      expect(await portao(site, admin, [20])).toEqual([{ codigo: 'saida_fora_de_ordem', antes: '2026-09-01' }])
      await c.query(`update public.obs_archive_months set dropped_at = now() where site_id = $1 and month = '2026-09-01'`, [site])
      expect(await portao(site, admin, [20])).toEqual([])
    })
  })

  it('I7 (Phil): partição anexada de mês anterior com linha e SEM registro também bloqueia a saída de outubro', async () => {
    await emTransacao(async () => {
      const { site, admin, videos } = await cenario()
      await semearDiaria(c, videos, '2026-09-01', 30)          // setembro tem linha na partição e nenhuma linha em obs_archive_months
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_months where site_id = $1 and month = '2026-09-01'`, [site])).toBe(0)
      expect(await portao(site, admin, [20])).toEqual([{ codigo: 'saida_fora_de_ordem', antes: '2026-09-01' }])
    })
  })

  it('o dado não existe: mês sem linha no registro dá nao_selado (nunca passa), e exit_check devolve o estado sem varrer', async () => {
    await emTransacao(async () => {
      await relogio(c, '2027-05-02 12:00:00+00')
      await liberarClasses(c, ['serie'])
      const { site } = await semearCanal(c, { videos: 1 })
      await semearDiaria(c, [], MES, 1)
      const admin = await novoAdmin(c, site)
      expect(codigos(await portao(site, admin, [3]))).toEqual(['nao_selado'])
      const ec = await escalar<{ estado: string; faltam: Falta[]; dois_passos: boolean; descartes: number }>(c, `select public.obs_archive_exit_check($1, $2, $3, $4)`, [site, D, MES, admin])
      expect(ec).toMatchObject({ estado: 'online', dois_passos: true, descartes: 0 })
      expect(codigos(ec.faltam)).toContain('nao_selado')
      expect(await escalar<string>(c, `select public.obs_archive_part_rel($1, $2, false)::text`, [D, MES])).toBe(particaoDe(D, MES))
      expect(await escalar<string | null>(c, `select public.obs_archive_part_rel($1, $2, true)::text`, [D, MES])).toBeNull()
    })
  })
})
```

(A regra "item cujas unidades têm todas `purged_at` não segura" é afirmada na Tarefa 4, item 129(b), com a remoção de verdade pela `competitor_channel_remove`, que é quem grava `purged_at`.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/manutencao-m6-portao.test.ts > /tmp/m6-t3.log 2>&1; grep -E "FAIL|Tests |does not exist" /tmp/m6-t3.log | head`
Expected: FAIL (`function public.obs_archive_gate(...) does not exist`).

- [ ] **Step 3: O SQL (PARTE 3 do rascunho)**

```sql
alter table public.obs_archive_prechecks add column if not exists row_digest numeric;
comment on column public.obs_archive_prechecks.row_digest is 'M6 (C-1): soma de hashtextextended(t::text, 0) das linhas do canal no mês, medida na conferência; o tally a compara sob a trava.';
alter table public.obs_archive_switch add column if not exists sims_seen integer not null default 0;
alter table public.obs_archive_switch add column if not exists last_sim_at timestamptz;
alter table public.obs_archive_switch add column if not exists refusals_b2 integer not null default 0;
alter table public.obs_archive_switch add column if not exists disarm_month date;
alter table public.obs_archive_switch add column if not exists disarm_detail jsonb;
alter table public.obs_archive_switch add column if not exists disarm_seen_at timestamptz;
alter table public.obs_archive_switch drop constraint if exists obs_archive_switch_disarm_reason_check;
alter table public.obs_archive_switch add constraint obs_archive_switch_disarm_reason_check
  check (disarm_reason is null or disarm_reason in ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '13', 'manual'));
comment on column public.obs_archive_switch.disarm_reason is 'M6: motivo do desligamento, na numeração da lista fechada de 03 §12.4 (o 12 foi retirado); manual = "Desligar" do dono.';
alter table public.obs_archive_months add column if not exists reattached_at timestamptz;
alter table public.obs_archive_months add column if not exists reattach_out_of_order boolean not null default false;
comment on column public.obs_archive_months.reattach_out_of_order is 'M6 (R27, segunda causa): o mês voltou com mês posterior da mesma tabela ainda fora; a página (M5) marca a linha e o "online desde".';

-- Decisão 13: a data de "pode sair" é UMA função (a mesma da Tarefa 4 do plano da M7, D15). `create or replace` idêntica: a que chegar segunda não muda nada.
create or replace function public.obs_archive_piso_registro() returns date
language sql immutable set search_path = '' as $$ select date '2026-10-01' $$;
revoke all on function public.obs_archive_piso_registro() from public, anon, authenticated, service_role;
create or replace function public.obs_archive_pode_sair_em(p_month date, p_window integer) returns date
language sql immutable set search_path = '' as $$
  select (greatest(date_trunc('month', p_month)::date, public.obs_archive_piso_registro()) + pg_catalog.make_interval(months => p_window + 1))::date
$$;
revoke all on function public.obs_archive_pode_sair_em(date, integer) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_exit_class(p_table text) returns text
language sql stable security definer set search_path = '' as $$
  select p.class from public.obs_archive_policy() p where p.table_name = p_table and p.exit_mode = 'particao'
$$;
revoke all on function public.obs_archive_exit_class(text) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_part_rel(p_table text, p_month date, p_saida boolean) returns regclass
language sql stable security definer set search_path = '' as $$
  select pg_catalog.to_regclass(pg_catalog.format('obs_part.%I', obs_part.nome_da_particao(p_table, p_month) || case when p_saida then '_saida' else '' end))
$$;
revoke all on function public.obs_archive_part_rel(text, date, boolean) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_month_green(p_site uuid, p_class text, p_table text, p_month date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.obs_archive_months m
    where m.site_id = p_site and m.class = p_class and m.table_name = p_table and m.month = p_month
      and m.sealed_at is not null and m.unsealed_at is null
      and m.nas_attested_at >= public.obs_archive_agora() - interval '24 hours'
      and m.b2_withdrawn_at is null
      and ((m.b2_forja_ok_at >= public.obs_archive_agora() - interval '7 days' and m.b2_forja_manifest_sha256 = m.manifest_sha256)
        or (m.b2_dono_ok_at >= public.obs_archive_agora() - interval '35 days' and m.b2_dono_manifest_sha256 = m.manifest_sha256)))
$$;
revoke all on function public.obs_archive_month_green(uuid, text, text, date) from public, anon, authenticated, service_role;

-- UMA varredura da relação, agrupada por canal: contagem, soma da coluna de controle e (C-1) o resumo da linha inteira. Linha sobrando = canal_sem_unidade;
-- faltando, soma diferente, ou (com p_resumo) resumo diferente do que a conferência guardou, ou conferência ausente = conteudo_mudou (02 §10.5, canal removido).
-- Devolve também os OUTROS sites com linha na relação (m-5), para a condição 13 sob a trava sem nova varredura.
create or replace function public.obs_archive_tally(p_site uuid, p_class text, p_table text, p_month date, p_rel regclass, p_resumo boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_l bigint := 0; v_s numeric := 0; e_l bigint; e_s numeric; v_col text; g record; v_outros uuid[] := '{}'; v_dif boolean := false;
  v_vistos text[] := '{}'; v_pc numeric;
begin
  select p.control_column into v_col from public.obs_archive_policy() p where p.class = p_class and p.table_name = p_table;
  for g in execute pg_catalog.format(
    'select ch.site_id, ch.id::text as canal, count(*) as n, coalesce(sum(t.%I::numeric), 0) as s,
            coalesce(sum(pg_catalog.hashtextextended(t::text, 0)::numeric), 0) as d
       from %s t join public.competitor_videos v on v.id = t.video_id join public.competitor_channels ch on ch.id = v.competitor_channel_id
      group by ch.site_id, ch.id', v_col, p_rel)
  loop
    if g.site_id <> p_site then v_outros := v_outros || g.site_id; continue; end if;
    continue when exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = g.canal);
    v_l := v_l + g.n; v_s := v_s + g.s; v_vistos := v_vistos || g.canal;
    if p_resumo then
      select pc.row_digest into v_pc from public.obs_archive_prechecks pc
       where pc.site_id = p_site and pc.class = p_class and pc.table_name = p_table and pc.month = p_month and pc.channel_ref = g.canal;
      if v_pc is distinct from g.d then v_dif := true; end if;
    end if;
  end loop;
  select coalesce(sum(u.row_count), 0), coalesce(sum(u.control_sum), 0) into e_l, e_s
    from public.obs_archive_current_units(p_site, p_class, p_month) u
   where u.table_name = p_table and u.lost_at is null and u.purged_at is null
     and exists (select 1 from public.competitor_channels ch where ch.id::text = u.channel_ref and ch.site_id = p_site)
     and not exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = u.channel_ref);
  if p_resumo then
    -- unidade sem conferência com resumo, ou conferência de canal que agora não tem linha mas tinha: o dado mudou (ou nunca foi conferido)
    if exists (select 1 from public.obs_archive_current_units(p_site, p_class, p_month) u
                where u.table_name = p_table and u.lost_at is null and u.purged_at is null
                  and exists (select 1 from public.competitor_channels ch where ch.id::text = u.channel_ref and ch.site_id = p_site)
                  and not exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = u.channel_ref)
                  and not exists (select 1 from public.obs_archive_prechecks pc where pc.site_id = p_site and pc.class = p_class and pc.table_name = p_table
                                     and pc.month = p_month and pc.channel_ref = u.channel_ref and pc.row_digest is not null))
       or exists (select 1 from public.obs_archive_prechecks pc where pc.site_id = p_site and pc.class = p_class and pc.table_name = p_table
                     and pc.month = p_month and pc.row_digest <> 0 and pc.channel_ref <> all (v_vistos)) then
      v_dif := true;
    end if;
  end if;
  return jsonb_build_object('linhas', v_l, 'soma', v_s, 'esperado_linhas', e_l, 'esperado_soma', e_s,
    'sites', pg_catalog.to_jsonb(coalesce((select array_agg(distinct x) from unnest(v_outros) x), '{}'::uuid[])),
    'codigo', case when v_l > e_l then 'canal_sem_unidade' when v_l < e_l or v_s <> e_s or v_dif then 'conteudo_mudou' end);
end $$;
revoke all on function public.obs_archive_tally(uuid, text, text, date, regclass, boolean) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_outros_sites_ok(p_class text, p_table text, p_month date, p_tally jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from jsonb_array_elements_text(coalesce(p_tally->'sites', '[]'::jsonb)) o(s)
                      where not public.obs_archive_month_green(o.s::uuid, p_class, p_table, p_month))
$$;
revoke all on function public.obs_archive_outros_sites_ok(text, text, date, jsonb) from public, anon, authenticated, service_role;

-- C-1: o resumo da linha inteira, o hash e o resumo de novo; os dois resumos têm de ser iguais (o dado não mudou DURANTE a conferência).
-- Com p_gravar: grava a conferência com o resumo, ou apaga a anterior se não bate (M2).
create or replace function public.obs_archive_conferir_canal(p_site uuid, p_class text, p_table text, p_rel regclass, p_channel uuid, p_month date,
                                                             p_row_count bigint, p_control_sum numeric, p_hash text, p_gravar boolean)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare d1 numeric; d2 numeric; h record; v_ok boolean;
begin
  d1 := public.obs_archive_row_digest_rel(p_site, p_class, p_table, p_rel, p_channel, p_month);
  select * into h from public.obs_archive_content_hash_rel(p_site, p_class, p_table, p_rel, p_channel, p_month);
  d2 := public.obs_archive_row_digest_rel(p_site, p_class, p_table, p_rel, p_channel, p_month);
  v_ok := h.row_count = p_row_count and h.control_sum::numeric is not distinct from p_control_sum and h.hash_conteudo = p_hash and d1 = d2;
  if p_gravar then
    if v_ok then
      insert into public.obs_archive_prechecks (site_id, class, table_name, month, channel_ref, checked_at, row_digest)
      values (p_site, p_class, p_table, p_month, p_channel::text, public.obs_archive_agora(), d2)
      on conflict (site_id, class, table_name, month, channel_ref) do update set checked_at = excluded.checked_at, row_digest = excluded.row_digest;
    else
      delete from public.obs_archive_prechecks pc where pc.site_id = p_site and pc.class = p_class and pc.table_name = p_table and pc.month = p_month and pc.channel_ref = p_channel::text;
    end if;
  end if;
  return v_ok;
end $$;
revoke all on function public.obs_archive_conferir_canal(uuid, text, text, regclass, uuid, date, bigint, numeric, text, boolean) from public, anon, authenticated, service_role;

-- O portão (02 §10.5). p_conds: os números da tabela de condições (12 é a trava, medida pela operação; 20 = R27, saída fora de ordem).
-- p_rel: a partição anexada (detach, drop, check) ou a tabela destacada (discard). Fora da simulação, conteudo_mudou dessela o mês.
create or replace function public.obs_archive_gate(p_site uuid, p_class text, p_table text, p_month date, p_by uuid, p_mode text,
                                                   p_rel regclass, p_conds integer[], p_dry_run boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare
  f jsonb := '[]'::jsonb;
  pol record; m public.obs_archive_months; sw public.obs_archive_switch; u record; h record; v_rst record;
  v_agora timestamptz := public.obs_archive_agora();
  v_hoje date := public.obs_archive_hoje_sp();
  v_mae regclass := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(p_table));
  v_join text := 'join public.competitor_videos v on v.id = t.video_id join public.competitor_channels ch on ch.id = v.competitor_channel_id';
  v_ini timestamptz := (p_month::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := (((p_month + interval '1 month')::date)::text || ' 00:00:00-03')::timestamptz;
  v_lista text[]; v_sites uuid[]; v_mudou uuid[] := '{}'; v_canais text[] := '{}'; v_n bigint; v_pode date; pr record; v_tem boolean; v_pode_txt text;
begin
  select * into pol from public.obs_archive_policy() p where p.class = p_class and p.table_name = p_table;
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = p_class and x.table_name = p_table and x.month = p_month;

  if 1 = any(p_conds) and not pol.released then
    f := f || jsonb_build_array(jsonb_build_object('codigo', 'classe_nao_liberada', 'classe', p_class));
  end if;

  if 2 = any(p_conds) then
    v_pode := public.obs_archive_pode_sair_em(p_month, pol.window_months);       -- Decisão 13 (M7 D15)
    if v_hoje < v_pode then f := f || jsonb_build_array(jsonb_build_object('codigo', 'ainda_na_janela', 'pode_sair_em', v_pode)); end if;
  end if;

  if 3 = any(p_conds) then
    if m.id is null or m.sealed_at is null or m.unsealed_at is not null then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'nao_selado'));
    elsif p_rel is not null then
      execute pg_catalog.format(
        'select array_agg(distinct v.competitor_channel_id::text order by v.competitor_channel_id::text) from %s t %s
          where ch.site_id = $1 and not exists (select 1 from public.obs_archive_current_units($1, $2, $3) cu
                                                 where cu.table_name = $4 and cu.channel_ref = v.competitor_channel_id::text)', p_rel, v_join)
        into v_lista using p_site, p_class, p_month, p_table;
      if v_lista is not null then f := f || jsonb_build_array(jsonb_build_object('codigo', 'canal_sem_unidade', 'canais', pg_catalog.to_jsonb(v_lista))); end if;
    end if;
  end if;

  if 4 = any(p_conds) and p_rel is not null and m.sealed_at is not null and m.unsealed_at is null then
    for u in select cu.id, cu.channel_ref, cu.row_count, cu.control_sum, cu.hash_conteudo
               from public.obs_archive_current_units(p_site, p_class, p_month) cu
              where cu.table_name = p_table and cu.purged_at is null and cu.lost_at is null
                and exists (select 1 from public.competitor_channels ch where ch.id::text = cu.channel_ref and ch.site_id = p_site)
                and not exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = cu.channel_ref)
    loop
      continue when exists (select 1 from public.obs_archive_prechecks pc
                             where pc.site_id = p_site and pc.class = p_class and pc.table_name = p_table and pc.month = p_month
                               and pc.channel_ref = u.channel_ref and pc.row_digest is not null and pc.checked_at >= v_agora - interval '10 minutes'
                               and pc.checked_at >= m.sealed_at and pc.checked_at >= coalesce(m.detached_at, '-infinity'::timestamptz));
      -- sem conferência fresca: hash, resumo antes e depois (C-1); fora da simulação a conferência é gravada para o tally da trava comparar
      if not public.obs_archive_conferir_canal(p_site, p_class, p_table, p_rel, u.channel_ref::uuid, p_month, u.row_count, u.control_sum, u.hash_conteudo, not p_dry_run) then
        v_mudou := v_mudou || u.id; v_canais := v_canais || u.channel_ref;
      end if;
    end loop;
    if cardinality(v_mudou) > 0 then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'conteudo_mudou', 'canais', pg_catalog.to_jsonb(v_canais)));
      if not p_dry_run then
        update public.obs_archive_units set redo_reason = 'conteudo_mudou' where id = any(v_mudou);
        update public.obs_archive_months set unsealed_at = v_agora, unsealed_reason = 'conteudo_mudou'
         where site_id = p_site and class = p_class and month = p_month and sealed_at is not null and unsealed_at is null;
      end if;
    end if;
  end if;

  if 5 = any(p_conds) and (m.nas_attested_at is null or m.nas_attested_at < v_agora - interval '24 hours') then
    select array_agg(distinct cu.channel_ref order by cu.channel_ref) into v_lista
      from public.obs_archive_current_units(p_site, p_class, p_month) cu
     where cu.table_name = p_table and cu.purged_at is null and cu.lost_at is null
       and not exists (select 1 from public.obs_archive_summaries s
                        where s.site_id = p_site and s.class = p_class and s.channel_ref = cu.channel_ref and s.month = p_month
                          and s.superseded_at is null and s.purged_at is null and s.lost_at is null and s.nas_attested_at >= v_agora - interval '24 hours');
    f := f || jsonb_build_array(jsonb_build_object('codigo', 'nas_sem_atestacao',
           'horas', case when m.nas_attested_at is null then null else floor(extract(epoch from (v_agora - m.nas_attested_at)) / 3600)::int end,
           'canais_sem_resumo', coalesce(pg_catalog.to_jsonb(v_lista), '[]'::jsonb)));
  end if;

  if 6 = any(p_conds) then
    if m.b2_withdrawn_at is not null then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'b2_sem_atestacao', 'motivo', 'retirada', 'em', m.b2_withdrawn_at, 'razao', m.b2_withdrawn_reason));
    elsif not coalesce((m.b2_forja_ok_at >= v_agora - interval '7 days' and m.b2_forja_manifest_sha256 = m.manifest_sha256)
                    or (m.b2_dono_ok_at >= v_agora - interval '35 days' and m.b2_dono_manifest_sha256 = m.manifest_sha256), false) then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'b2_sem_atestacao', 'motivo', 'prazo',
             'dias_forja', case when m.b2_forja_ok_at is null then null else floor(extract(epoch from (v_agora - m.b2_forja_ok_at)) / 86400)::int end,
             'dias_dono', case when m.b2_dono_ok_at is null then null else floor(extract(epoch from (v_agora - m.b2_dono_ok_at)) / 86400)::int end));
    end if;
  end if;

  if 7 = any(p_conds) then
    select r.done_at, r.schema_fp into v_rst from public.obs_archive_restores r
     where r.site_id = p_site and r.class = p_class and r.table_name = p_table and r.units_checked > 0 and r.rows_restored > 0 and r.diff_rows = 0
     order by r.done_at desc limit 1;
    if v_rst.done_at is null or v_rst.done_at < v_agora - interval '180 days' then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'restauracao_vencida', 'classe', p_class, 'tabela', p_table, 'ultima', v_rst.done_at));
    elsif v_rst.schema_fp <> public.obs_archive_schema_fp(v_mae) then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'esquema_mudou', 'tabela', p_table));
    end if;
  end if;

  if 8 = any(p_conds) and p_class = 'horaria' and p_rel is not null then
    execute pg_catalog.format(
      'select count(*) from (select distinct t.video_id, (t.hour_slot at time zone ''America/Sao_Paulo'')::date as d from %s t %s where ch.site_id = $1) x
        where not exists (select 1 from public.competitor_hour_fold_log l where l.video_id = x.video_id and l.day = x.d)', p_rel, v_join)
      into v_n using p_site;
    if v_n > 0 then f := f || jsonb_build_array(jsonb_build_object('codigo', 'dia_nao_somado', 'pares', v_n)); end if;
  end if;

  if 9 = any(p_conds) and p_class = 'serie' then
    if pg_catalog.to_regclass('public.competitor_video_marks') is null or pg_catalog.to_regclass('public.competitor_video_mark_misses') is null then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'marcas_ausentes'));
    else
      execute 'select count(*) from public.competitor_videos v join public.competitor_channels ch on ch.id = v.competitor_channel_id
                where ch.site_id = $1
                  and greatest(v.published_at, v.live_actual_start_at) + interval ''30 days'' >= $2
                  and greatest(v.published_at, v.live_actual_start_at) + interval ''30 days'' < $3
                  and not exists (select 1 from public.competitor_video_marks k where k.video_id = v.id and k.age_days = 30)
                  and not exists (select 1 from public.competitor_video_mark_misses k where k.video_id = v.id and k.age_days = 30)'
        into v_n using p_site, v_ini, v_fim;
      if v_n > 0 then f := f || jsonb_build_array(jsonb_build_object('codigo', 'marca_pendente', 'videos', v_n)); end if;
    end if;
  end if;

  if 10 = any(p_conds) then
    select count(*) into v_n from public.competitor_removed_items i
     where i.site_id = p_site and i.archive_pending and i.kind = 'video'
       and exists (select 1 from public.obs_archive_current_units(p_site, p_class, p_month) cu
                    where cu.table_name = p_table and cu.channel_ref = i.competitor_channel_id::text and cu.purged_at is null);
    if v_n > 0 then f := f || jsonb_build_array(jsonb_build_object('codigo', 'expurgo_pendente', 'itens', v_n)); end if;
  end if;

  if 11 = any(p_conds) then
    if p_mode = 'automatico' then
      select * into sw from public.obs_archive_switch s where s.site_id = p_site and s.class = p_class;
      if p_class not in ('horaria', 'serie') or sw.armed_at is null or sw.disarmed_at is not null or sw.expires_at <= v_agora then
        f := f || jsonb_build_array(jsonb_build_object('codigo', 'interruptor_desligado'));
      end if;
    elsif p_by is null or not public.obs_archive_is_site_admin(p_site, p_by) then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'sem_direito'));
    end if;
  end if;

  if 13 = any(p_conds) and p_rel is not null then
    execute pg_catalog.format('select array_agg(distinct ch.site_id) from %s t %s where ch.site_id <> $1', p_rel, v_join) into v_sites using p_site;
    if exists (select 1 from unnest(coalesce(v_sites, '{}'::uuid[])) o(s) where not public.obs_archive_month_green(o.s, p_class, p_table, p_month)) then
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'outro_site_na_particao'));
    end if;
  end if;

  if 20 = any(p_conds) then
    -- R27 + I7 (Phil): mês anterior com linha ainda online, pelo registro OU por partição anexada com linha (mesmo sem registro de mês: defeito, não "vazio")
    select array_agg(pg_catalog.to_char(x.month, 'YYYY-MM-DD') order by x.month) into v_lista from public.obs_archive_months x
     where x.site_id = p_site and x.class = p_class and x.table_name = p_table and x.month < p_month
       and coalesce(x.rows_total, 0) > 0 and x.detached_at is null and x.dropped_at is null;
    for pr in select pg_catalog.to_char(pg_catalog.to_date(pg_catalog.right(c.relname::text, 6), 'YYYYMM'), 'YYYY-MM-DD') as mes, c.oid::regclass as rel
                from pg_catalog.pg_inherits i join pg_catalog.pg_class c on c.oid = i.inhrelid join pg_catalog.pg_namespace n on n.oid = c.relnamespace
               where i.inhparent = v_mae and n.nspname = 'obs_part' and c.relname::text ~ ('^' || p_table || '_[0-9]{6}$')
                 and pg_catalog.to_date(pg_catalog.right(c.relname::text, 6), 'YYYYMM') < p_month loop
      execute pg_catalog.format('select exists (select 1 from %s limit 1)', pr.rel) into v_tem;
      if v_tem then v_lista := coalesce(v_lista, '{}'::text[]) || pr.mes; end if;
    end loop;
    if v_lista is not null then
      select min(z) into v_pode_txt from unnest(v_lista) z;
      f := f || jsonb_build_array(jsonb_build_object('codigo', 'saida_fora_de_ordem', 'antes', v_pode_txt));
    end if;
  end if;

  return f;
end $$;
revoke all on function public.obs_archive_gate(uuid, text, text, date, uuid, text, regclass, integer[], boolean) from public, anon, authenticated, service_role;

-- A conferência por canal (CP13): uma chamada por canal, cada uma bem abaixo dos 8 s; vale 10 minutos para a condição 4 (e o resumo da linha inteira dela
-- é o que a trava compara). Com p_only_stale, só os canais sem conferência de menos de 8 minutos (a ação e a tarefa passam true; Phil M5).
create or replace function public.obs_archive_precheck_channels(p_site uuid, p_table text, p_month date, p_only_stale boolean default false) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(cu.channel_ref order by cu.channel_ref), '{}'::text[])
    from public.obs_archive_current_units(p_site, public.obs_archive_exit_class(p_table), p_month) cu
   where cu.table_name = p_table and cu.purged_at is null and cu.lost_at is null
     and exists (select 1 from public.competitor_channels ch where ch.id::text = cu.channel_ref and ch.site_id = p_site)
     and not exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = cu.channel_ref)
     and (not p_only_stale or not exists (
           select 1 from public.obs_archive_prechecks pc
            where pc.site_id = p_site and pc.class = public.obs_archive_exit_class(p_table) and pc.table_name = p_table and pc.month = p_month
              and pc.channel_ref = cu.channel_ref and pc.row_digest is not null and pc.checked_at >= public.obs_archive_agora() - interval '8 minutes'
              and pc.checked_at >= coalesce((select mm.detached_at from public.obs_archive_months mm where mm.site_id = p_site
                                               and mm.class = public.obs_archive_exit_class(p_table) and mm.table_name = p_table and mm.month = p_month), '-infinity'::timestamptz)))
$$;
revoke all on function public.obs_archive_precheck_channels(uuid, text, date, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_precheck_channels(uuid, text, date, boolean) to service_role;

create or replace function public.obs_archive_precheck_unit(p_site uuid, p_table text, p_month date, p_channel uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_class text := public.obs_archive_exit_class(p_table);
  m public.obs_archive_months; u public.obs_archive_units; v_rel regclass;
begin
  if v_class is null then return jsonb_build_object('ok', false, 'codigo', 'tabela_invalida'); end if;
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.id is null or m.sealed_at is null or m.unsealed_at is not null then return jsonb_build_object('ok', false, 'codigo', 'nao_selado'); end if;
  if m.dropped_at is not null then return jsonb_build_object('ok', false, 'codigo', 'ja_descartado'); end if;
  v_rel := public.obs_archive_part_rel(p_table, p_month, m.detached_at is not null);
  if v_rel is null then return jsonb_build_object('ok', false, 'codigo', 'particao_ausente'); end if;
  select cu.* into u from public.obs_archive_current_units(p_site, v_class, p_month) cu where cu.table_name = p_table and cu.channel_ref = p_channel::text;
  if u.id is null then return jsonb_build_object('ok', false, 'codigo', 'canal_sem_unidade'); end if;
  if public.obs_archive_conferir_canal(p_site, v_class, p_table, v_rel, p_channel, p_month, u.row_count, u.control_sum, u.hash_conteudo, true) then
    return jsonb_build_object('ok', true);
  end if;
  return jsonb_build_object('ok', false, 'codigo', 'conteudo_mudou');
end $$;
revoke all on function public.obs_archive_precheck_unit(uuid, text, date, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_precheck_unit(uuid, text, date, uuid) to service_role;

-- O estado da linha do mês, barato (sem hash, sem varrer a série): é o que a página lê para T1, T3, T7, T7a, T9.
create or replace function public.obs_archive_exit_check(p_site uuid, p_table text, p_month date, p_by uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_class text := public.obs_archive_exit_class(p_table);
  m public.obs_archive_months; pol record; v_desc integer; v_rel regclass; f jsonb;
  v_liberar date;
begin
  if v_class is null then return jsonb_build_object('estado', 'invalido', 'faltam', jsonb_build_array(jsonb_build_object('codigo', 'tabela_invalida'))); end if;
  select * into pol from public.obs_archive_policy() p where p.class = v_class and p.table_name = p_table;
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  select count(*) into v_desc from public.obs_archive_months x
   where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.dropped_at is not null and coalesce(x.rows_dropped, 0) > 0;
  if m.dropped_at is not null then
    return jsonb_build_object('estado', 'descartado', 'descartado_em', m.dropped_at, 'bytes_freed', m.bytes_freed, 'faltam', '[]'::jsonb, 'descartes', v_desc, 'dois_passos', v_desc < 3);
  end if;
  if m.detached_at is not null then
    v_liberar := (m.detached_at at time zone 'America/Sao_Paulo')::date + pol.wait_days;
    v_rel := public.obs_archive_part_rel(p_table, p_month, true);
    f := public.obs_archive_gate(p_site, v_class, p_table, p_month, p_by, 'clique', v_rel, array[1, 3, 5, 6, 7, 10, 11], true);
    return jsonb_build_object('estado', 'destacado', 'destacado_em', m.detached_at, 'liberar_a_partir', v_liberar,
                              'faltam', f, 'protecao_faltam', pg_catalog.to_jsonb(public.obs_archive_invariante_faltam()),
                              'particao_ausente', v_rel is null, 'descartes', v_desc, 'dois_passos', v_desc < 3);
  end if;
  v_rel := public.obs_archive_part_rel(p_table, p_month, false);
  f := public.obs_archive_gate(p_site, v_class, p_table, p_month, p_by, 'clique', null, array[1, 2, 3, 5, 6, 7, 10, 11, 20], true);
  return jsonb_build_object('estado', 'online', 'faltam', f, 'descartes', v_desc, 'dois_passos', v_desc < 3, 'particao_ausente', v_rel is null);
end $$;
revoke all on function public.obs_archive_exit_check(uuid, text, date, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_exit_check(uuid, text, date, uuid) to service_role;
```

(O portão é `volatile` porque grava o "dessela" fora da simulação. `exit_check` chama o portão com `p_dry_run = true` e sem as condições que varrem a série; a condição 3 só confere o selo quando `p_rel` é nulo.)

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2.
Expected: PASS (21 testes). Se o caso "1: classe não liberada" não trocar a linha (o `replace` não acha o texto), o teste falha alto: copiar a grafia exata do `pg_get_functiondef` do banco local para o literal do teste.

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/integration/manutencao-m6-portao.test.ts
git commit -m "feat: M6 parte 3: o portão das condições da saída, a conferência por canal e o estado barato da linha do mês

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m6.sql apps/web/test/integration/manutencao-m6-portao.test.ts
```

---
### Task 4 [M6a]: Tirar das telas (`detach`) e trazer de volta (`reattach`)

**Files:**
- Modify: `supabase/rascunhos/m6.sql` (PARTE 4)
- Create: `apps/web/test/integration/manutencao-m6-destaque.test.ts`

**Interfaces:**
- Consumes: Tarefas 1-3 (`obs_archive_gate`, `obs_archive_tally` com `p_resumo`, `obs_archive_outros_sites_ok`, `obs_archive_part_rel`, `obs_archive_exit_class`, `obs_archive_invariante_faltam`, `obs_archive_content_hash_rel`, `obs_archive_schema_fp`); M2 `obs_part.nome_da_particao`, `public.obs_partitions_ensure`, `public.obs_archive_uncovered`.
- Produces (as duas com `grant execute ... to service_role`; nenhuma para `anon`/`authenticated`/`public`):
  - `public.obs_archive_detach_month(p_site uuid, p_table text, p_month date, p_by uuid, p_mode text default 'clique', p_dry_run boolean default true) returns jsonb`
  - `public.obs_archive_reattach_month(p_site uuid, p_table text, p_month date, p_by uuid, p_dry_run boolean default true) returns jsonb`
  - **`p_dry_run` tem default `true` (I-1, Decisão 12):** esquecer o argumento simula, nunca apaga.
  - `public.obs_archive_part_check(p_mae regclass, p_month date) returns text` (a expressão do CHECK dos limites do mês, date ou timestamptz -03) e `public.obs_archive_part_bounds(...)`. Internas.
  - **A ordem das funções que mudam (C-2, Decisão 11):** (1) leituras e portão completo SEM trava (a parte cara); (2) `select ... from obs_archive_months where class, table_name, month order by site_id for update` (a mesma ordem da M3b), com `lock_timeout` de 3 s; (3) trava de tabela: vídeos (SRE), mãe, partição; (4) sob a trava, relê o registro e reavalia estado, existência da partição e as condições baratas; só então o `tally` com resumo.
  - Forma da resposta (as duas): `{status: 'ok'|'simulado'|'recusado', codigo?: text, faltam?: jsonb[], linhas?: bigint, soma?: numeric, canais?: int, fracao_da_classe?: numeric, sites?: uuid[], volta_fora_de_ordem?: boolean, conteudo_mudou?: boolean, protecao_faltam?: text[]}`. Códigos de `recusado` (além dos do portão): `tabela_invalida`, `particao_ausente`, `ja_destacado`, `ja_descartado`, `nao_destacado`, `gatilho_ausente`, `ocupado`, `conteudo_mudou`, `orfa_inesperada`, `esquema_divergente`, `fora_do_mes`, `outro_site_na_particao`.

- [ ] **Step 1: Os testes (falham: as funções não existem)**

```ts
// apps/web/test/integration/manutencao-m6-destaque.test.ts
// @vitest-environment node
/** M6 parte 4 (plano M6, Tarefa 4; itens 42, 89, 115): o destaque e a volta. begin … rollback (o destaque nunca é confirmado aqui; o item 128 é da Tarefa 6). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar, tenta, semearCanal, semearDiaria } from '../helpers/m3b'
import { prepararM6, relogio, liberarClasses, novoAdmin, selarMes, particaoDe } from '../helpers/m6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MES = '2026-10-01'
const D = 'competitor_video_daily'
type Resp = { status: string; codigo?: string; faltam?: Array<{ codigo: string }>; linhas?: number; volta_fora_de_ordem?: boolean; conteudo_mudou?: boolean; protecao_faltam?: string[] }

describe.skipIf(skipIfNoLocalDb())('M6 parte 4: tirar das telas e trazer de volta', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try { await prepararM6(c, 4); await f() } finally { await c.query('rollback') }
  }
  async function cenario(): Promise<{ site: string; canal: string; videos: string[]; admin: string }> {
    await relogio(c, '2027-05-02 12:00:00+00')
    await liberarClasses(c, ['serie', 'ensaio'])
    const s = await semearCanal(c, { videos: 2 })
    await semearDiaria(c, s.videos, MES, 31)
    await selarMes(c, { site: s.site, classe: 'serie', tabela: D, mes: MES })
    await c.query(`insert into public.competitor_video_marks (video_id, age_days, site_id, views, gap_hours, age_base_at, read_before_at, read_after_at)
                   select v, 30, $2, 1, 1, now(), now(), now() from unnest($1::uuid[]) v on conflict do nothing`, [s.videos, s.site])
    return { ...s, admin: await novoAdmin(c, s.site) }
  }
  const detach = (site: string, por: string | null, o: { modo?: string; simular?: boolean; mes?: string } = {}): Promise<Resp> =>
    escalar<Resp>(c, `select public.obs_archive_detach_month($1, $2, $3, $4, $5, $6)`, [site, D, o.mes ?? MES, por, o.modo ?? 'clique', o.simular ?? false])
  const reattach = (site: string, por: string | null, o: { simular?: boolean; mes?: string } = {}): Promise<Resp> =>
    escalar<Resp>(c, `select public.obs_archive_reattach_month($1, $2, $3, $4, $5)`, [site, D, o.mes ?? MES, por, o.simular ?? false])
  const existe = (rel: string): Promise<boolean> => escalar<boolean>(c, `select to_regclass($1) is not null`, [rel])

  it('42: destaca o mês verde: a partição sai da mãe com sufixo _saida, sem FK, e as telas não leem mais o mês', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      const antes = await escalar<string>(c, `select count(*)::text from public.competitor_video_daily where snap_date >= $1 and snap_date < ($1::date + interval '1 month')`, [MES])
      const r = await detach(site, admin)
      expect(r).toMatchObject({ status: 'ok', linhas: Number(antes) })
      expect(await existe(particaoDe(D, MES))).toBe(false)
      expect(await existe(particaoDe(D, MES) + '_saida')).toBe(true)
      expect(await escalar<string>(c, `select count(*)::text from public.competitor_video_daily where snap_date >= $1 and snap_date < ($1::date + interval '1 month')`, [MES])).toBe('0')
      expect(await escalar<number>(c, `select count(*)::int from pg_constraint where conrelid = to_regclass($1) and contype = 'f'`, [particaoDe(D, MES) + '_saida'])).toBe(0)
      expect(await escalar<boolean>(c, `select detached_at is not null and detached_by = $2 from public.obs_archive_months where site_id = $1 and month = $3 and table_name = $4`, [site, admin, MES, D])).toBe(true)
    })
  })

  it('89: com o mês destacado, o vigia de cobertura da M2 segue vazio e o ensure não recria a partição do mês', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await detach(site, admin)
      expect(await escalar<unknown[]>(c, `select coalesce(to_jsonb(public.obs_archive_uncovered()), '[]'::jsonb)`)).toEqual([])
      await c.query(`select public.obs_partitions_ensure(12)`)
      expect(await existe(particaoDe(D, MES))).toBe(false)
    })
  })

  it('simulação: devolve a contagem, não trava, não muda nada', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      const r = await detach(site, admin, { simular: true })
      expect(r.status).toBe('simulado')
      expect(r.linhas).toBeGreaterThan(0)
      expect(await existe(particaoDe(D, MES))).toBe(true)
      expect(await escalar<number>(c, `select count(*)::int from pg_locks where relation = to_regclass($1) and mode = 'AccessExclusiveLock'`, [particaoDe(D, MES)])).toBe(0)
    })
  })

  it('recusas da porta: tabela de faixa, partição ausente, mês já destacado, gatilho desligado; nenhuma destaca', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      expect(await escalar<Resp>(c, `select public.obs_archive_detach_month($1, 'competitor_video_comments', $2, $3)`, [site, MES, admin])).toMatchObject({ status: 'recusado', codigo: 'tabela_invalida' })
      expect(await detach(site, admin, { mes: '2019-01-01' })).toMatchObject({ status: 'recusado', codigo: 'particao_ausente' })
      await c.query(`alter table public.competitor_videos disable trigger obs_archive_a_mes_destacado`)
      expect(await detach(site, admin)).toMatchObject({ status: 'recusado', codigo: 'gatilho_ausente' })
      await c.query(`alter table public.competitor_videos enable trigger obs_archive_a_mes_destacado`)
      expect((await detach(site, admin)).status).toBe('ok')
      expect(await detach(site, admin)).toMatchObject({ status: 'recusado', codigo: 'ja_destacado' })
    })
  })

  it('o portão recusa com a lista e nada sai; conteúdo mudado fora da simulação dessela', async () => {
    await emTransacao(async () => {
      const { site, admin, videos } = await cenario()
      await c.query(`update public.competitor_video_daily set views = views + 3 where video_id = $1 and snap_date = '2026-10-07'`, [videos[0]])
      const r = await detach(site, admin)
      expect(r.status).toBe('recusado')
      expect(r.faltam?.map(f => f.codigo)).toContain('conteudo_mudou')
      expect(await existe(particaoDe(D, MES))).toBe(true)
      expect(await escalar<string>(c, `select unsealed_reason from public.obs_archive_months where site_id = $1 and month = $2`, [site, MES])).toBe('conteudo_mudou')
    })
  })

  it('115(a): volta igual: a partição volta à mãe com o nome original, FK validadas, detached_at nulo, reattached_at gravado', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      const soma = await escalar<string>(c, `select sum(views)::text from ${particaoDe(D, MES)}`)
      await detach(site, admin)
      const r = await reattach(site, admin)
      expect(r).toMatchObject({ status: 'ok', conteudo_mudou: false, volta_fora_de_ordem: false, protecao_faltam: [] })
      expect(await existe(particaoDe(D, MES))).toBe(true)
      expect(await escalar<string>(c, `select sum(views)::text from public.competitor_video_daily where snap_date >= $1 and snap_date < ($1::date + interval '1 month')`, [MES])).toBe(soma)
      expect(await escalar<boolean>(c, `select bool_and(convalidated) from pg_constraint where conrelid = to_regclass($1) and contype = 'f'`, [particaoDe(D, MES)])).toBe(true)
      expect(await escalar<boolean>(c, `select detached_at is null and reattached_at is not null and unsealed_at is null from public.obs_archive_months where site_id = $1 and month = $2`, [site, MES])).toBe(true)
    })
  })

  it('115(b): voltou diferente: o mês volta e fica desselado com mudou_no_destaque', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await detach(site, admin)
      await c.query(`update ${particaoDe(D, MES)}_saida set views = views + 1 where snap_date = '2026-10-03'`)
      const r = await reattach(site, admin)
      expect(r).toMatchObject({ status: 'ok', conteudo_mudou: true })
      expect(await escalar<string>(c, `select unsealed_reason from public.obs_archive_months where site_id = $1 and month = $2`, [site, MES])).toBe('mudou_no_destaque')
    })
  })

  it('115(c): registro órfão na tabela destacada: recusa orfa_inesperada e nada é desfeito pela metade', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await detach(site, admin)
      await c.query(`insert into ${particaoDe(D, MES)}_saida (video_id, snap_date, views, taken_at) values (gen_random_uuid(), '2026-10-09', 1, now())`)
      expect(await reattach(site, admin)).toMatchObject({ status: 'recusado', codigo: 'orfa_inesperada' })
      expect(await existe(particaoDe(D, MES) + '_saida')).toBe(true)
      expect(await existe(particaoDe(D, MES))).toBe(false)
      expect(await escalar<boolean>(c, `select detached_at is not null from public.obs_archive_months where site_id = $1 and month = $2`, [site, MES])).toBe(true)
    })
  })

  it('115(d): sem direito e mês não destacado recusam; descartado recusa com ja_descartado; _saida sumida recusa com particao_ausente', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      expect(await reattach(site, admin)).toMatchObject({ status: 'recusado', codigo: 'nao_destacado' })
      await detach(site, admin)
      expect(await reattach(site, '00000000-0000-0000-0000-00000000dead')).toMatchObject({ status: 'recusado', codigo: 'sem_direito' })
      await c.query(`alter table ${particaoDe(D, MES)}_saida rename to m6_sumiu`)
      expect(await reattach(site, admin)).toMatchObject({ status: 'recusado', codigo: 'particao_ausente' })
      await c.query(`alter table obs_part.m6_sumiu rename to ${particaoDe(D, MES).slice('obs_part.'.length)}_saida`)
      await c.query(`update public.obs_archive_months set dropped_at = now() where site_id = $1 and month = $2`, [site, MES])
      expect(await reattach(site, admin)).toMatchObject({ status: 'recusado', codigo: 'ja_descartado' })
    })
  })

  it('115(e) e R27: voltar outubro com novembro fora volta assim mesmo, marcado volta_fora_de_ordem', async () => {
    await emTransacao(async () => {
      const { site, admin, videos } = await cenario()
      await relogio(c, '2027-06-02 12:00:00+00')
      await semearDiaria(c, videos, '2026-11-01', 30)
      await selarMes(c, { site, classe: 'serie', tabela: D, mes: '2026-11-01' })
      await selarMes(c, { site, classe: 'serie', tabela: D, mes: MES })
      expect((await detach(site, admin)).status).toBe('ok')
      expect((await detach(site, admin, { mes: '2026-11-01' })).status).toBe('ok')
      const r = await reattach(site, admin)
      expect(r).toMatchObject({ status: 'ok', volta_fora_de_ordem: true })
      expect(await escalar<boolean>(c, `select reattach_out_of_order from public.obs_archive_months where site_id = $1 and month = $2`, [site, MES])).toBe(true)
    })
  })

  it('115(f): voltou sem a proteção instalada: volta, e o retorno traz o que falta', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await detach(site, admin)
      await c.query(`drop trigger obs_archive_a_mes_destacado_truncate on public.competitor_videos`)
      const r = await reattach(site, admin)
      expect(r).toMatchObject({ status: 'ok', protecao_faltam: ['competitor_videos.obs_archive_a_mes_destacado_truncate'] })
    })
  })

  it('91: partição com linha de outro site verde: destaca para os dois sites', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      const outro = await semearCanal(c, { site: '00000000-0000-0000-0000-00000000a3b1', videos: 1 })
      await semearDiaria(c, outro.videos, MES, 3)
      await selarMes(c, { site: outro.site, classe: 'serie', tabela: D, mes: MES })
      const r = await detach(site, admin)
      expect(r.status).toBe('ok')
      expect(await escalar<number>(c, `select count(*)::int from public.obs_archive_months where month = $1 and table_name = $2 and detached_at is not null`, [MES, D])).toBe(2)
    })
  })

  it('I-1: sem o 6º argumento a função SIMULA (default true): a partição continua na mãe', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      const r = await escalar<Resp>(c, `select public.obs_archive_detach_month($1, $2, $3, $4)`, [site, D, MES, admin])
      expect(r.status).toBe('simulado')
      expect(await existe(particaoDe(D, MES))).toBe(true)
      const v = await escalar<Resp>(c, `select public.obs_archive_reattach_month($1, $2, $3, $4)`, [site, D, MES, admin])
      expect(v).toMatchObject({ status: 'recusado', codigo: 'nao_destacado' })
    })
  })

  it('m-4: a simulação devolve fracao_da_classe pelo rows_total do registro (sem contar a mãe inteira)', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      const r = await escalar<Resp & { fracao_da_classe: number }>(c, `select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', true)`, [site, D, MES, admin])
      expect(Number(r.fracao_da_classe)).toBeGreaterThan(0)
      expect(Number(r.fracao_da_classe)).toBeLessThanOrEqual(1)
      const src = await escalar<string>(c, `select prosrc from pg_proc where oid = 'public.obs_archive_detach_month(uuid, text, date, uuid, text, boolean)'::regprocedure`)
      expect(src).not.toMatch(/select count\(\*\) from %s/)
    })
  })

  it('129(a): canal removido pelo botão entre a selagem e o destaque: passa sem conteudo_mudou e o mês não volta a não selado', async () => {
    await emTransacao(async () => {
      const { site, admin, canal } = await cenario()
      const outro = await semearCanal(c, { site, videos: 1 })
      await semearDiaria(c, outro.videos, MES, 5)
      await selarMes(c, { site, classe: 'serie', tabela: D, mes: MES })
      expect(await tenta(c, `select public.competitor_channel_remove($1, $2, 'apagar', 'botao', $3)`, [site, canal, admin])).toMatchObject({ ok: true })
      const r = await detach(site, admin)
      expect(r.status).toBe('ok')
      expect(r.conteudo_mudou).not.toBe(true)
      expect(await escalar<boolean>(c, `select unsealed_at is null from public.obs_archive_months where site_id = $1 and month = $2 and table_name = $3`, [site, MES, D])).toBe(true)
    })
  })

  it('129(b): item de fila cujas unidades já têm todas purged_at não segura o destaque', async () => {
    await emTransacao(async () => {
      const { site, admin, canal } = await cenario()
      const outro = await semearCanal(c, { site, videos: 1 })
      await semearDiaria(c, outro.videos, MES, 5)
      await selarMes(c, { site, classe: 'serie', tabela: D, mes: MES })
      expect(await tenta(c, `select public.competitor_channel_remove($1, $2, 'apagar', 'botao', $3)`, [site, canal, admin])).toMatchObject({ ok: true })
      await c.query(`insert into public.competitor_removed_items (site_id, kind, youtube_id, competitor_channel_id, decided_by, rows_deleted, archive_pending)
                     values ($1, 'video', 'm6purged', $2, $3, '{}'::jsonb, true)`, [site, canal, admin])
      expect((await detach(site, admin)).status).toBe('ok')
    })
  })

  it('129(c): vídeo avulso apagado de canal que continua: conteudo_mudou e o mês dessela', async () => {
    await emTransacao(async () => {
      const { site, admin, videos } = await cenario()
      await c.query(`delete from public.competitor_videos where id = $1`, [videos[0]])
      const r = await detach(site, admin)
      expect(r.status).toBe('recusado')
      expect(r.faltam?.map(f => f.codigo)).toContain('conteudo_mudou')
    })
  })

  it('I3: a mãe ganhou uma coluna enquanto o mês estava fora: a volta acrescenta a coluna à _saida, volta ok e marca conteudo_mudou', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await detach(site, admin)
      await c.query(`alter table public.competitor_video_daily add column m6_extra integer`)
      const r = await reattach(site, admin)
      expect(r).toMatchObject({ status: 'ok', conteudo_mudou: true })
      expect(await existe(particaoDe(D, MES))).toBe(true)
      expect(await escalar<string>(c, `select unsealed_reason from public.obs_archive_months where site_id = $1 and month = $2`, [site, MES])).toBe('mudou_no_destaque')
    })
  })

  it('I3: esquema que o plano não sabe consertar (coluna a mais só na _saida) recusa esquema_divergente e nada muda', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario()
      await detach(site, admin)
      await c.query(`alter table ${particaoDe(D, MES)}_saida add column m6_so_aqui integer`)
      expect(await reattach(site, admin)).toMatchObject({ status: 'recusado', codigo: 'esquema_divergente' })
      expect(await existe(particaoDe(D, MES) + '_saida')).toBe(true)
    })
  })

  it('I-7: linha de outro mês na tabela destacada: o CHECK validado ANTES de travar a mãe recusa fora_do_mes', async () => {
    await emTransacao(async () => {
      const { site, admin, videos } = await cenario()
      await detach(site, admin)
      await c.query(`insert into ${particaoDe(D, MES)}_saida (video_id, snap_date, views, taken_at) values ($1, '2026-11-02', 1, now())`, [videos[0]])
      expect(await reattach(site, admin)).toMatchObject({ status: 'recusado', codigo: 'fora_do_mes' })
      expect(await existe(particaoDe(D, MES))).toBe(false)
    })
  })

  it('o dado não existe: mês sem registro recusa com nao_selado e nunca destaca', async () => {
    await emTransacao(async () => {
      await relogio(c, '2027-05-02 12:00:00+00')
      await liberarClasses(c, ['serie'])
      const { site, videos } = await semearCanal(c, { videos: 1 })
      await semearDiaria(c, videos, MES, 3)
      const admin = await novoAdmin(c, site)
      const r = await detach(site, admin)
      expect(r.status).toBe('recusado')
      expect(r.faltam?.map(f => f.codigo)).toContain('nao_selado')
      expect(await existe(particaoDe(D, MES))).toBe(true)
    })
  })

  it('a função não aceita chamada de anon nem de authenticated', async () => {
    await emTransacao(async () => {
      for (const papel of ['anon', 'authenticated']) {
        await c.query(`set local role ${papel}`)
        const r = await tenta(c, `select public.obs_archive_detach_month(gen_random_uuid(), 'competitor_video_daily', '2026-10-01', null)`)
        await c.query('reset role')
        expect(r, papel).toMatchObject({ ok: false, code: '42501' })
      }
    })
  })
})
```

(O "ocupado" e as corridas, com duas conexões e mês confirmado, são da Tarefa 6; o teste que só conferia o texto da função foi tirado: m-1.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/manutencao-m6-destaque.test.ts > /tmp/m6-t4.log 2>&1; grep -E "FAIL|Tests |does not exist" /tmp/m6-t4.log | head`
Expected: FAIL (`function public.obs_archive_detach_month(...) does not exist`).

- [ ] **Step 3: O SQL (PARTE 4 do rascunho)**

```sql
-- Os limites da partição de um mês na mãe, no tipo da chave (date para daily/early/ensaio; timestamptz em hora de SP para a horária).
create or replace function public.obs_archive_part_bounds(p_mae regclass, p_month date) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_tipo text; v_fim date := (p_month + interval '1 month')::date;
begin
  select pg_catalog.format_type(a.atttypid, a.atttypmod) into v_tipo
    from pg_catalog.pg_partitioned_table pt join pg_catalog.pg_attribute a on a.attrelid = pt.partrelid and a.attnum = pt.partattrs[0]
   where pt.partrelid = p_mae;
  if v_tipo = 'date' then return pg_catalog.format('from (%L) to (%L)', p_month, v_fim); end if;
  return pg_catalog.format('from (%L) to (%L)', p_month::text || ' 00:00:00-03', v_fim::text || ' 00:00:00-03');
end $$;
revoke all on function public.obs_archive_part_bounds(regclass, date) from public, anon, authenticated, service_role;

-- A expressão do CHECK que dispensa o attach de varrer a tabela (I-7): os mesmos limites, escritos como condição.
create or replace function public.obs_archive_part_check(p_mae regclass, p_month date) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_col text; v_tipo text; v_fim date := (p_month + interval '1 month')::date;
begin
  select a.attname::text, pg_catalog.format_type(a.atttypid, a.atttypmod) into v_col, v_tipo
    from pg_catalog.pg_partitioned_table pt join pg_catalog.pg_attribute a on a.attrelid = pt.partrelid and a.attnum = pt.partattrs[0]
   where pt.partrelid = p_mae;
  if v_tipo = 'date' then return pg_catalog.format('%I >= %L::date and %I < %L::date', v_col, p_month, v_col, v_fim); end if;
  return pg_catalog.format('%I >= %L::timestamptz and %I < %L::timestamptz', v_col, p_month::text || ' 00:00:00-03', v_col, v_fim::text || ' 00:00:00-03');
end $$;
revoke all on function public.obs_archive_part_check(regclass, date) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_detach_month(p_site uuid, p_table text, p_month date, p_by uuid,
                                                           p_mode text default 'clique', p_dry_run boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_class text := public.obs_archive_exit_class(p_table);
  v_mae regclass := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(p_table));
  v_rel regclass; v_nome text; m public.obs_archive_months; f jsonb; t jsonb; v_fk record; v_sites uuid[]; v_total numeric;
begin
  if v_class is null or v_mae is null then return jsonb_build_object('status', 'recusado', 'codigo', 'tabela_invalida'); end if;
  if p_mode not in ('clique', 'automatico') then return jsonb_build_object('status', 'recusado', 'codigo', 'tabela_invalida'); end if;

  -- (1) leituras e o portão completo, SEM trava (o recálculo do hash é a parte cara; CP13).
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado'); end if;
  if m.detached_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_destacado'); end if;
  v_nome := obs_part.nome_da_particao(p_table, p_month);
  v_rel := public.obs_archive_part_rel(p_table, p_month, false);
  if v_rel is null then return jsonb_build_object('status', 'recusado', 'codigo', 'particao_ausente'); end if;
  if cardinality(public.obs_archive_invariante_faltam()) > 0 then
    return jsonb_build_object('status', 'recusado', 'codigo', 'gatilho_ausente', 'protecao_faltam', pg_catalog.to_jsonb(public.obs_archive_invariante_faltam()));
  end if;
  f := public.obs_archive_gate(p_site, v_class, p_table, p_month, p_by, p_mode, v_rel, array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 20], p_dry_run);
  if jsonb_array_length(f) > 0 then return jsonb_build_object('status', 'recusado', 'faltam', f); end if;

  if p_dry_run then   -- decisão 7: simulação não trava
    t := public.obs_archive_tally(p_site, v_class, p_table, p_month, v_rel);
    select coalesce(sum(x.rows_total), 0) into v_total from public.obs_archive_months x
     where x.class = v_class and x.table_name = p_table and x.detached_at is null and x.dropped_at is null;   -- m-4: sem count(*) da mãe
    return jsonb_build_object('status', 'simulado', 'linhas', t->'linhas', 'soma', t->'soma',
      'canais', (select count(*) from public.obs_archive_precheck_channels(p_site, p_table, p_month) x),
      'fracao_da_classe', case when v_total > 0 then round(least((t->>'linhas')::numeric / v_total, 1), 4) else 0 end,
      'codigo', t->'codigo');
  end if;

  -- (2) o registro primeiro, na mesma ordem de toda função da M3b (site_id); (3) depois as tabelas: vídeos, mãe, partição.
  perform pg_catalog.set_config('lock_timeout', '3s', true);
  begin
    perform 1 from public.obs_archive_months x where x.class = v_class and x.table_name = p_table and x.month = p_month order by x.site_id for update;
    lock table public.competitor_videos in share row exclusive mode;
    execute pg_catalog.format('lock table %s in access exclusive mode', v_mae);
    execute pg_catalog.format('lock table %s in access exclusive mode', v_rel);
  exception
    when undefined_table then   -- a partição mudou de nome ou sumiu enquanto esperava: outra chamada chegou antes (a conexão que perde a corrida)
      select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
      return jsonb_build_object('status', 'recusado', 'codigo', case when m.dropped_at is not null then 'ja_descartado' when m.detached_at is not null then 'ja_destacado' else 'particao_ausente' end);
    when lock_not_available or deadlock_detected then return jsonb_build_object('status', 'recusado', 'codigo', 'ocupado');
  end;

  -- (4) sob a trava: relê o registro e reavalia estado, partição e as condições baratas (C-2). Duas chamadas simultâneas: a segunda acha ja_destacado.
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado'); end if;
  if m.detached_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_destacado'); end if;
  if not exists (select 1 from pg_catalog.pg_inherits i where i.inhparent = v_mae and i.inhrelid = v_rel) then
    return jsonb_build_object('status', 'recusado', 'codigo', 'ja_destacado');
  end if;
  f := public.obs_archive_gate(p_site, v_class, p_table, p_month, p_by, p_mode, null, array[1, 2, 3, 5, 6, 7, 10, 11, 20], false);
  if jsonb_array_length(f) > 0 then return jsonb_build_object('status', 'recusado', 'faltam', f); end if;

  -- Uma varredura, com o resumo da linha inteira (C-1): o que foi conferido tem de ser o que está na partição agora.
  t := public.obs_archive_tally(p_site, v_class, p_table, p_month, v_rel, true);
  if t->>'codigo' is not null then
    if t->>'codigo' = 'conteudo_mudou' then
      update public.obs_archive_months set unsealed_at = public.obs_archive_agora(), unsealed_reason = 'conteudo_mudou'
       where site_id = p_site and class = v_class and table_name = p_table and month = p_month and unsealed_at is null;
    end if;
    return jsonb_build_object('status', 'recusado', 'codigo', t->>'codigo');
  end if;
  if not public.obs_archive_outros_sites_ok(v_class, p_table, p_month, t) then
    return jsonb_build_object('status', 'recusado', 'codigo', 'outro_site_na_particao');
  end if;
  v_sites := array[p_site] || coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(t->'sites') x), '{}'::uuid[]);

  execute pg_catalog.format('alter table %s detach partition %s', v_mae, v_rel);
  for v_fk in select c.conname from pg_catalog.pg_constraint c where c.conrelid = v_rel and c.contype = 'f' loop
    execute pg_catalog.format('alter table %s drop constraint %I', v_rel, v_fk.conname);
  end loop;
  execute pg_catalog.format('alter table %s rename to %I', v_rel, v_nome || '_saida');

  -- Decisão 6: todo site com linha na partição ganha o destaque na mesma transação (os sites vêm do tally: sem segunda varredura, m-5).
  update public.obs_archive_months set detached_at = public.obs_archive_agora(), detached_by = p_by, reattached_at = null, reattach_out_of_order = false
   where class = v_class and table_name = p_table and month = p_month and site_id = any(v_sites);
  return jsonb_build_object('status', 'ok', 'linhas', t->'linhas', 'soma', t->'soma', 'sites', pg_catalog.to_jsonb(v_sites));
end $$;
revoke all on function public.obs_archive_detach_month(uuid, text, date, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_detach_month(uuid, text, date, uuid, text, boolean) to service_role;

create or replace function public.obs_archive_reattach_month(p_site uuid, p_table text, p_month date, p_by uuid, p_dry_run boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_class text := public.obs_archive_exit_class(p_table);
  v_mae regclass := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(p_table));
  v_rel regclass; v_nome text; m public.obs_archive_months; u record; h record; v_fk record; v_col record;
  v_mudou boolean := false; v_fora boolean; v_faltam_col text[] := '{}';
begin
  if v_class is null or v_mae is null then return jsonb_build_object('status', 'recusado', 'codigo', 'tabela_invalida'); end if;
  if p_by is null or not public.obs_archive_is_site_admin(p_site, p_by) then return jsonb_build_object('status', 'recusado', 'codigo', 'sem_direito'); end if;

  -- (1) leituras e conferência, SEM trava (a tabela destacada ninguém escreve).
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado', 'descartado_em', m.dropped_at); end if;
  if m.detached_at is null then return jsonb_build_object('status', 'recusado', 'codigo', 'nao_destacado'); end if;
  v_nome := obs_part.nome_da_particao(p_table, p_month);
  v_rel := public.obs_archive_part_rel(p_table, p_month, true);
  if v_rel is null then return jsonb_build_object('status', 'recusado', 'codigo', 'particao_ausente'); end if;

  -- I3: a mãe pode ter ganhado coluna enquanto o mês estava fora. Coluna que só a mãe tem: a volta acrescenta (tipo e default da mãe) e marca
  -- conteudo_mudou. NOT NULL sem default, ou coluna a mais só na _saida, ou tipo diferente: esquema_divergente (o dono decide).
  if public.obs_archive_schema_fp(v_rel) is distinct from public.obs_archive_schema_fp(v_mae) then
    for v_col in select a.attname::text as nome, pg_catalog.format_type(a.atttypid, a.atttypmod) as tipo, a.attnotnull as nn,
                        pg_catalog.pg_get_expr(d.adbin, d.adrelid) as def
                   from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
                  where a.attrelid = v_mae and a.attnum > 0 and not a.attisdropped
                    and not exists (select 1 from pg_catalog.pg_attribute b where b.attrelid = v_rel and b.attname = a.attname and not b.attisdropped) loop
      if v_col.nn and v_col.def is null then return jsonb_build_object('status', 'recusado', 'codigo', 'esquema_divergente', 'coluna', v_col.nome); end if;
      v_faltam_col := v_faltam_col || pg_catalog.format('%I %s%s%s', v_col.nome, v_col.tipo, coalesce(' default ' || v_col.def, ''), case when v_col.nn then ' not null' else '' end);
    end loop;
    v_mudou := true;
    -- depois de acrescentar, as colunas têm de ser as mesmas: coluna a mais na _saida ou tipo diferente não se conserta aqui
    if exists (select 1 from pg_catalog.pg_attribute b where b.attrelid = v_rel and b.attnum > 0 and not b.attisdropped
                  and not exists (select 1 from pg_catalog.pg_attribute a where a.attrelid = v_mae and a.attname = b.attname and not a.attisdropped
                                     and a.atttypid = b.atttypid and a.atttypmod = b.atttypmod)) then
      return jsonb_build_object('status', 'recusado', 'codigo', 'esquema_divergente');
    end if;
  else
    -- O mês volta igual ou diferente? Recalcula as unidades correntes de canal que existe sobre a tabela destacada.
    for u in select cu.channel_ref, cu.row_count, cu.control_sum, cu.hash_conteudo from public.obs_archive_current_units(p_site, v_class, p_month) cu
              where cu.table_name = p_table and cu.purged_at is null and cu.lost_at is null
                and exists (select 1 from public.competitor_channels ch where ch.id::text = cu.channel_ref and ch.site_id = p_site) loop
      select * into h from public.obs_archive_content_hash_rel(p_site, v_class, p_table, v_rel, u.channel_ref::uuid, p_month);
      if not (h.row_count = u.row_count and h.control_sum::numeric is not distinct from u.control_sum and h.hash_conteudo = u.hash_conteudo) then v_mudou := true; end if;
    end loop;
  end if;
  v_fora := exists (select 1 from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table
                       and x.month > p_month and (x.detached_at is not null or x.dropped_at is not null));
  if p_dry_run then
    return jsonb_build_object('status', 'simulado', 'conteudo_mudou', v_mudou, 'volta_fora_de_ordem', v_fora);
  end if;

  -- (2) o registro primeiro (mesma ordem da M3b); (3) vídeos e a tabela destacada. A mãe só DEPOIS de FK e CHECK validados (I-7): a trava
  -- exclusiva da mãe dura o rename e o attach, não a varredura.
  perform pg_catalog.set_config('lock_timeout', '3s', true);
  begin
    perform 1 from public.obs_archive_months x where x.class = v_class and x.table_name = p_table and x.month = p_month order by x.site_id for update;
    lock table public.competitor_videos in share row exclusive mode;
    execute pg_catalog.format('lock table %s in access exclusive mode', v_rel);
  exception
    when undefined_table then   -- a tabela destacada já voltou (outra chamada chegou antes) ou sumiu
      select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
      return jsonb_build_object('status', 'recusado', 'codigo', case when m.dropped_at is not null then 'ja_descartado' when m.detached_at is null then 'nao_destacado' else 'particao_ausente' end);
    when lock_not_available or deadlock_detected then return jsonb_build_object('status', 'recusado', 'codigo', 'ocupado');
  end;

  -- (4) sob a trava, reavalia.
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado', 'descartado_em', m.dropped_at); end if;
  if m.detached_at is null then return jsonb_build_object('status', 'recusado', 'codigo', 'nao_destacado'); end if;

  begin
    for v_col in select unnest(v_faltam_col) as def loop
      execute pg_catalog.format('alter table %s add column %s', v_rel, v_col.def);
    end loop;
    -- As FK da mãe, copiadas como NOT VALID e validadas (a varredura é da tabela destacada, que ninguém lê: sem a mãe travada).
    for v_fk in select c.conname, pg_catalog.pg_get_constraintdef(c.oid) as def from pg_catalog.pg_constraint c where c.conrelid = v_mae and c.contype = 'f' loop
      execute pg_catalog.format('alter table %s add constraint %I %s not valid', v_rel, v_fk.conname, v_fk.def);
      execute pg_catalog.format('alter table %s validate constraint %I', v_rel, v_fk.conname);
    end loop;
    -- O CHECK dos limites do mês: validado agora, dispensa a varredura do attach.
    execute pg_catalog.format('alter table %s add constraint m6_limites check (%s) not valid', v_rel, public.obs_archive_part_check(v_mae, p_month));
    execute pg_catalog.format('alter table %s validate constraint m6_limites', v_rel);
    -- Só agora a mãe (ACCESS EXCLUSIVE): rename e attach, que adota as FK iguais (PG17) e pula a varredura.
    execute pg_catalog.format('lock table %s in access exclusive mode', v_mae);
    execute pg_catalog.format('alter table %s rename to %I', v_rel, v_nome);
    execute pg_catalog.format('alter table %s attach partition obs_part.%I for values %s', v_mae, v_nome, public.obs_archive_part_bounds(v_mae, p_month));
    execute pg_catalog.format('alter table obs_part.%I drop constraint m6_limites', v_nome);
  exception
    when foreign_key_violation then return jsonb_build_object('status', 'recusado', 'codigo', 'orfa_inesperada');
    when check_violation then return jsonb_build_object('status', 'recusado', 'codigo', 'fora_do_mes');
    when invalid_table_definition or datatype_mismatch then return jsonb_build_object('status', 'recusado', 'codigo', 'esquema_divergente');
    when lock_not_available or deadlock_detected then return jsonb_build_object('status', 'recusado', 'codigo', 'ocupado');
  end;

  update public.obs_archive_months
     set detached_at = null, detached_by = null, reattached_at = public.obs_archive_agora(), reattach_out_of_order = v_fora,
         unsealed_at = case when v_mudou then public.obs_archive_agora() else unsealed_at end,
         unsealed_reason = case when v_mudou then 'mudou_no_destaque' else unsealed_reason end
   where class = v_class and table_name = p_table and month = p_month and detached_at is not null and dropped_at is null;
  return jsonb_build_object('status', 'ok', 'conteudo_mudou', v_mudou, 'volta_fora_de_ordem', v_fora,
                            'protecao_faltam', pg_catalog.to_jsonb(public.obs_archive_invariante_faltam()));
end $$;
revoke all on function public.obs_archive_reattach_month(uuid, text, date, uuid, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_reattach_month(uuid, text, date, uuid, boolean) to service_role;
```

Notas para o executor:
- Se `unnest(v_faltam_col)` não casar com o `record` do laço, trocar por `foreach v_def in array v_faltam_col` (variável `text`).
- A trava exclusiva da MÃE em `reattach` só dura o rename e o attach; a Tarefa 6 mede esse tempo com a mãe travada, no `detach` e no `reattach`.
- `pg_get_constraintdef` devolve `FOREIGN KEY (video_id) REFERENCES competitor_videos(id) ON DELETE CASCADE` sem esquema quando o `search_path` está vazio? Não: com `search_path = ''` ele qualifica (`public.competitor_videos`). Se o banco local mostrar outra coisa, o teste 115(a) falha no `add constraint`; corrigir qualificando.
- Se o `attach` criar FK duplicadas em vez de adotar as copiadas (PG17 adota as de mesma definição; NÃO VERIFICADO), o teste 115(a) mostra duas linhas em `pg_constraint`; aí o laço passa a só validar (`NOT VALID` + `VALIDATE` num nome temporário) e a remover antes do attach.
- O "o mês destacado não dispara a vigia de cobertura" (item 89) depende de a `obs_archive_uncovered` da M2 ignorar relação fora de partição; se o teste falhar, a correção é na M2, não aqui: registrar no ledger e avisar o controlador.

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2, e de novo `manutencao-m6-invariante.test.ts` e `manutencao-m6-portao.test.ts`.
Expected: PASS nos três.

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/integration/manutencao-m6-destaque.test.ts
git commit -m "feat: M6 parte 4: tirar o mês das telas (detach com portão antes da trava) e trazer de volta (FK validadas, volta fora de ordem marcada)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m6.sql apps/web/test/integration/manutencao-m6-destaque.test.ts
```

---

### Task 5 [M6a]: Liberar o espaço (`discard`) e a saída em um passo (`drop`)

**Files:**
- Modify: `supabase/rascunhos/m6.sql` (PARTE 5)
- Create: `apps/web/test/integration/manutencao-m6-descarte.test.ts`

**Interfaces:**
- Consumes: Tarefas 1-4 (a ordem de travas e a reavaliação sob a trava da Tarefa 4 valem aqui: Decisão 11).
- Produces (`service_role`; as duas com `p_dry_run default true`, I-1):
  - `public.obs_archive_discard_month(p_site uuid, p_table text, p_month date, p_by uuid, p_mode text default 'clique', p_dry_run boolean default true) returns jsonb`
  - `public.obs_archive_drop_month(p_site uuid, p_table text, p_month date, p_by uuid, p_mode text default 'clique', p_dry_run boolean default true) returns jsonb`
  - Interna: `public.obs_archive_discard_core(p_site uuid, p_class text, p_table text, p_month date, p_rel regclass, p_by uuid, p_mode text) returns jsonb` (`{linhas, bytes}`).
  - Respostas: `{status: 'ok', linhas, bytes, descartado_em}` | `{status: 'simulado', linhas, bytes, fracao_da_classe}` | `{status: 'recusado', codigo?, faltam?, descartado_em?, liberar_a_partir?}`. Códigos novos: `cedo_demais {liberar_a_partir}`, `dois_passos_obrigatorios {descartes}`, `ja_descartado {descartado_em}`, `esquema_mudou`, `conteudo_mudou`, `outro_site_na_particao`.
  - Gancho da Tarefa 7b [M6b]: TODA resposta `recusado` em modo automático (inclusive `tabela_invalida`, `gatilho_ausente`, `particao_ausente`: m-7), fora da simulação, passa por `public.obs_archive_after_auto(p_site, p_class, p_month, p_resp, p_mode, p_dry_run)`, que chama `public.obs_archive_switch_after_refusal(...)` se a função existir (`to_regprocedure`; na M6a ela não existe e a chamada só devolve a resposta); em `ok` automático zera `refusals_nas` e `refusals_b2`.

- [ ] **Step 1: Os testes (falham)**

```ts
// apps/web/test/integration/manutencao-m6-descarte.test.ts
// @vitest-environment node
/** M6 parte 5 (plano M6, Tarefa 5; itens 41, 43, 44, 88, 114, 124, 125, 127): liberar o espaço e a saída em um passo. begin … rollback. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar, tenta, semearCanal, semearDiaria } from '../helpers/m3b'
import { prepararM6, relogio, liberarClasses, novoAdmin, selarMes, particaoDe } from '../helpers/m6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const D = 'competitor_video_daily'
type Resp = { status: string; codigo?: string; faltam?: Array<{ codigo: string }>; linhas?: number; bytes?: number; liberar_a_partir?: string; descartado_em?: string; descartes?: number }

describe.skipIf(skipIfNoLocalDb())('M6 parte 5: liberar o espaço e sair em um passo', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try { await prepararM6(c, 5); await f() } finally { await c.query('rollback') }
  }
  /** Meses verdes de jan a out de 2026 (para chegar aos três descartes). */
  async function cenario(meses: string[]): Promise<{ site: string; canal: string; videos: string[]; admin: string }> {
    await relogio(c, '2027-05-02 12:00:00+00')
    await liberarClasses(c, ['serie', 'ensaio'])
    const s = await semearCanal(c, { videos: 2 })
    for (const mes of meses) {
      await c.query(`select obs_part.criar_particao('public.competitor_video_daily'::regclass, $1)`, [mes])
      await semearDiaria(c, s.videos, mes, 28)
      await selarMes(c, { site: s.site, classe: 'serie', tabela: D, mes })
    }
    await c.query(`insert into public.competitor_video_marks (video_id, age_days, site_id, views, gap_hours, age_base_at, read_before_at, read_after_at)
                   select v, 30, $2, 1, 1, now(), now(), now() from unnest($1::uuid[]) v on conflict do nothing`, [s.videos, s.site])
    return { ...s, admin: await novoAdmin(c, s.site) }
  }
  const chama = (fn: 'detach' | 'discard' | 'drop', site: string, mes: string, por: string | null, o: { modo?: string; simular?: boolean } = {}): Promise<Resp> =>
    escalar<Resp>(c, `select public.obs_archive_${fn}_month($1, $2, $3, $4, $5, $6)`, [site, D, mes, por, o.modo ?? 'clique', o.simular ?? false])   // simular SEMPRE explícito aqui; o default true tem teste próprio abaixo
  const existe = (rel: string): Promise<boolean> => escalar<boolean>(c, `select to_regclass($1) is not null`, [rel])
  const M1 = '2026-08-01', M2 = '2026-09-01', M3 = '2026-10-01', M4 = '2026-11-01'

  it('43: liberar antes do prazo recusa com cedo_demais e a data; no dia, libera e grava linhas e bytes', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      await chama('detach', site, M1, admin)
      await relogio(c, '2027-05-08 12:00:00+00')
      expect(await chama('discard', site, M1, admin)).toMatchObject({ status: 'recusado', codigo: 'cedo_demais', liberar_a_partir: '2027-05-09' })
      await relogio(c, '2027-05-09 03:00:00+00')
      const r = await chama('discard', site, M1, admin)
      expect(r.status).toBe('ok')
      expect(r.linhas).toBeGreaterThan(0)
      expect(r.bytes).toBeGreaterThan(0)
      expect(await existe(particaoDe(D, M1) + '_saida')).toBe(false)
      const m = (await c.query(`select dropped_at, dropped_by, drop_mode, rows_dropped, bytes_freed from public.obs_archive_months where site_id = $1 and month = $2`, [site, M1])).rows[0]
      expect(m).toMatchObject({ dropped_by: admin, drop_mode: 'clique', rows_dropped: String(r.linhas), bytes_freed: String(r.bytes) })
    })
  })

  it('44 e 125: duplo clique: o segundo responde ja_descartado com a data; _saida sumida sem registro = particao_ausente', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      await chama('detach', site, M1, admin)
      await relogio(c, '2027-05-10 12:00:00+00')
      expect((await chama('discard', site, M1, admin)).status).toBe('ok')
      expect(await chama('discard', site, M1, admin)).toMatchObject({ status: 'recusado', codigo: 'ja_descartado' })
      expect((await chama('discard', site, M1, admin)).descartado_em).toBeTruthy()
      const { site: s2, admin: a2 } = await cenario([M2])
      await chama('detach', s2, M2, a2)
      await c.query(`drop table ${particaoDe(D, M2)}_saida`)
      await relogio(c, '2027-05-20 12:00:00+00')
      expect(await chama('discard', s2, M2, a2)).toMatchObject({ status: 'recusado', codigo: 'particao_ausente' })
    })
  })

  it('88: liberar reconfere a cópia: B2 retirado recusa e o mês continua podendo voltar', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      await chama('detach', site, M1, admin)
      await relogio(c, '2027-05-10 12:00:00+00')
      await c.query(`update public.obs_archive_months set b2_withdrawn_at = now(), b2_withdrawn_reason = 'ausente', b2_withdrawn_via = 'forja' where site_id = $1 and month = $2`, [site, M1])
      const r = await chama('discard', site, M1, admin)
      expect(r.status).toBe('recusado')
      expect(r.faltam?.map(f => f.codigo)).toEqual(['b2_sem_atestacao'])
      expect(await existe(particaoDe(D, M1) + '_saida')).toBe(true)
    })
  })

  it('88: a tabela destacada mudou: liberar recusa com conteudo_mudou e não apaga', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      await chama('detach', site, M1, admin)
      await relogio(c, '2027-05-10 12:00:00+00')
      await c.query(`update ${particaoDe(D, M1)}_saida set views = views + 1 where snap_date = '2026-08-03'`)
      const r = await chama('discard', site, M1, admin)
      expect(r.faltam?.map(f => f.codigo)).toContain('conteudo_mudou')
      expect(await existe(particaoDe(D, M1) + '_saida')).toBe(true)
    })
  })

  it('41 e 114: drop recusa dois_passos_obrigatorios antes do 3º descarte DA TABELA; o ensaio e mês vazio não contam; depois do 3º, sai em um passo', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1, M2, M3, M4])
      expect(await chama('drop', site, M1, admin)).toMatchObject({ status: 'recusado', codigo: 'dois_passos_obrigatorios', descartes: 0 })
      for (const [i, mes] of [M1, M2, M3].entries()) {
        await relogio(c, `2027-0${5 + i}-02 12:00:00+00`)
        await selarMes(c, { site, classe: 'serie', tabela: D, mes })
        expect((await chama('detach', site, mes, admin)).status, mes).toBe('ok')
        await relogio(c, `2027-0${5 + i}-12 12:00:00+00`)
        await selarMes(c, { site, classe: 'serie', tabela: D, mes })
        expect((await chama('discard', site, mes, admin)).status, mes).toBe('ok')
      }
      await relogio(c, '2027-08-02 12:00:00+00')
      await selarMes(c, { site, classe: 'serie', tabela: D, mes: M4 })
      const r = await chama('drop', site, M4, admin)
      expect(r.status).toBe('ok')
      expect(await existe(particaoDe(D, M4))).toBe(false)
      expect(await existe(particaoDe(D, M4) + '_saida')).toBe(false)
      expect(await escalar<boolean>(c, `select detached_at is not null and dropped_at is not null from public.obs_archive_months where site_id = $1 and month = $2`, [site, M4])).toBe(true)
    })
  })

  it('114: o 3º descarte vale por tabela: três descartes da diária não liberam o drop da early', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      for (const mes of ['2026-01-01', '2026-02-01', '2026-03-01']) {
        await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped) values ($1, 'serie', $2, $3, now(), 10)`, [site, D, mes])
      }
      const r = await escalar<Resp>(c, `select public.obs_archive_drop_month($1, 'competitor_video_early', $2, $3)`, [site, M1, admin])
      expect(r).toMatchObject({ status: 'recusado', codigo: 'dois_passos_obrigatorios', descartes: 0 })
    })
  })

  it('124: drop de mês já destacado recusa com ja_destacado (é o caminho de liberar)', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      for (const mes of ['2026-01-01', '2026-02-01', '2026-03-01']) {
        await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped) values ($1, 'serie', $2, $3, now(), 10)`, [site, D, mes])
      }
      await chama('detach', site, M1, admin)
      expect(await chama('drop', site, M1, admin)).toMatchObject({ status: 'recusado', codigo: 'ja_destacado' })
    })
  })

  it('127: logo depois do descarte, remover canal volta a funcionar', async () => {
    await emTransacao(async () => {
      const { site, admin, canal } = await cenario([M1])
      await chama('detach', site, M1, admin)
      const recusa = await tenta(c, `select public.competitor_channel_remove($1, $2, 'apagar', 'botao', $3)`, [site, canal, admin])
      expect(recusa).toMatchObject({ ok: false, message: 'mes_destacado_em_transito' })
      await relogio(c, '2027-05-10 12:00:00+00')
      expect((await chama('discard', site, M1, admin)).status).toBe('ok')
      expect(await tenta(c, `select public.competitor_channel_remove($1, $2, 'apagar', 'botao', $3)`, [site, canal, admin])).toMatchObject({ ok: true })
    })
  })

  it('o ensaio espera 1 dia; texto sai com tabela_invalida', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([])
      expect(await escalar<Resp>(c, `select public.obs_archive_drop_month($1, 'competitor_video_comments', '2026-10-01', $2)`, [site, admin])).toMatchObject({ status: 'recusado', codigo: 'tabela_invalida' })
      expect(await escalar<Resp>(c, `select public.obs_archive_discard_month($1, 'competitor_raw', '2026-10-01', $2)`, [site, admin])).toMatchObject({ status: 'recusado', codigo: 'tabela_invalida' })
    })
  })

  it('simulação de liberar e de drop: nada é apagado; a resposta traz linhas e bytes', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      await chama('detach', site, M1, admin)
      await relogio(c, '2027-05-10 12:00:00+00')
      const r = await chama('discard', site, M1, admin, { simular: true })
      expect(r).toMatchObject({ status: 'simulado' })
      expect(r.bytes).toBeGreaterThan(0)
      expect(await existe(particaoDe(D, M1) + '_saida')).toBe(true)
    })
  })

  it('I-1: drop sem o 6º argumento SIMULA (default true): num mês verde com 3 descartes, a partição continua na mãe', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      for (const mes of ['2026-01-01', '2026-02-01', '2026-03-01']) {
        await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped) values ($1, 'serie', $2, $3, now(), 10)`, [site, D, mes])
      }
      const r = await escalar<Resp>(c, `select public.obs_archive_drop_month($1, $2, $3, $4)`, [site, D, M1, admin])
      expect(r.status).toBe('simulado')
      expect(await existe(particaoDe(D, M1))).toBe(true)
      expect(await escalar<Resp>(c, `select public.obs_archive_discard_month($1, $2, $3, $4)`, [site, D, M1, admin])).toMatchObject({ status: 'recusado', codigo: 'nao_destacado' })
    })
  })

  it('C-1: conferiu, depois alguém mudou likes (fora da coluna de controle): o drop recusa conteudo_mudou sob a trava e a partição existe', async () => {
    await emTransacao(async () => {
      const { site, admin, canal, videos } = await cenario([M1])
      for (const mes of ['2026-01-01', '2026-02-01', '2026-03-01']) {
        await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped) values ($1, 'serie', $2, $3, now(), 10)`, [site, D, mes])
      }
      expect(await escalar(c, `select public.obs_archive_precheck_unit($1, $2, $3, $4)`, [site, D, M1, canal])).toEqual({ ok: true })
      await c.query(`update public.competitor_video_daily set likes = coalesce(likes, 0) + 7 where video_id = $1 and snap_date = '2026-08-05'`, [videos[0]])
      expect(await chama('drop', site, M1, admin)).toMatchObject({ status: 'recusado', codigo: 'conteudo_mudou' })
      expect(await existe(particaoDe(D, M1))).toBe(true)
    })
  })

  it('M2: conferiu, mudou views, conferiu de novo: a conferência anterior é apagada e o drop recusa', async () => {
    await emTransacao(async () => {
      const { site, admin, canal, videos } = await cenario([M1])
      for (const mes of ['2026-01-01', '2026-02-01', '2026-03-01']) {
        await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped) values ($1, 'serie', $2, $3, now(), 10)`, [site, D, mes])
      }
      expect(await escalar(c, `select public.obs_archive_precheck_unit($1, $2, $3, $4)`, [site, D, M1, canal])).toEqual({ ok: true })
      await c.query(`update public.competitor_video_daily set views = views + 1 where video_id = $1 and snap_date = '2026-08-05'`, [videos[0]])
      expect(await escalar(c, `select public.obs_archive_precheck_unit($1, $2, $3, $4)`, [site, D, M1, canal])).toEqual({ ok: false, codigo: 'conteudo_mudou' })
      const r = await chama('drop', site, M1, admin)
      expect(r.status).toBe('recusado')
      expect(await existe(particaoDe(D, M1))).toBe(true)
    })
  })

  it('m-3: liberar reavalia a condição 13: outro site com linha na tabela destacada e B2 retirado recusa', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      const outro = await semearCanal(c, { site: '00000000-0000-0000-0000-00000000a3b1', videos: 1 })
      await semearDiaria(c, outro.videos, M1, 3)
      await selarMes(c, { site: outro.site, classe: 'serie', tabela: D, mes: M1 })
      await chama('detach', site, M1, admin)
      await relogio(c, '2027-05-10 12:00:00+00')
      await c.query(`update public.obs_archive_months set b2_withdrawn_at = now(), b2_withdrawn_reason = 'ausente', b2_withdrawn_via = 'forja' where site_id = $1 and month = $2`, [outro.site, M1])
      const r = await chama('discard', site, M1, admin)
      expect(r.status).toBe('recusado')
      expect(await existe(particaoDe(D, M1) + '_saida')).toBe(true)
    })
  })

  it('esquema: a mãe ganhou coluna depois do destaque: liberar recusa esquema_mudou (a cópia no B2 não tem a coluna)', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      await chama('detach', site, M1, admin)
      await c.query(`alter table public.competitor_video_daily add column m6_extra integer`)
      await relogio(c, '2027-05-10 12:00:00+00')
      expect(await chama('discard', site, M1, admin)).toMatchObject({ status: 'recusado', codigo: 'esquema_mudou' })
      expect(await existe(particaoDe(D, M1) + '_saida')).toBe(true)
    })
  })

  it('o dado não existe: liberar mês que nunca foi destacado recusa com nao_destacado', async () => {
    await emTransacao(async () => {
      const { site, admin } = await cenario([M1])
      expect(await chama('discard', site, M1, admin)).toMatchObject({ status: 'recusado', codigo: 'nao_destacado' })
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/manutencao-m6-descarte.test.ts > /tmp/m6-t5.log 2>&1; grep -E "FAIL|Tests |does not exist" /tmp/m6-t5.log | head`
Expected: FAIL (`function public.obs_archive_discard_month(...) does not exist`).

- [ ] **Step 3: O SQL (PARTE 5 do rascunho)**

```sql
create or replace function public.obs_archive_discard_core(p_site uuid, p_class text, p_table text, p_month date, p_rel regclass, p_by uuid, p_mode text)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare v_l bigint; v_b bigint; v_sites uuid[];
begin
  execute pg_catalog.format('select count(*) from %s', p_rel) into v_l;
  v_b := pg_catalog.pg_total_relation_size(p_rel);
  execute pg_catalog.format('select array_agg(distinct ch.site_id) from %s t join public.competitor_videos v on v.id = t.video_id
                               join public.competitor_channels ch on ch.id = v.competitor_channel_id', p_rel) into v_sites;
  execute pg_catalog.format('drop table %s', p_rel);
  update public.obs_archive_months
     set dropped_at = public.obs_archive_agora(), dropped_by = p_by, drop_mode = p_mode,
         rows_dropped = case when site_id = p_site then v_l else rows_dropped end,
         bytes_freed = case when site_id = p_site then v_b else 0 end           -- decisão 6: os bytes só na linha de quem tirou
   where class = p_class and table_name = p_table and month = p_month and dropped_at is null
     and (site_id = p_site or site_id = any(coalesce(v_sites, '{}'::uuid[])));
  return jsonb_build_object('linhas', v_l, 'bytes', v_b);
end $$;
revoke all on function public.obs_archive_discard_core(uuid, text, text, date, regclass, uuid, text) from public, anon, authenticated, service_role;

-- O que o automático faz com uma resposta (m-7: TODA recusa, inclusive as que voltam antes do portão). Fora do automático, ou em simulação, devolve a resposta.
-- A função obs_archive_switch_after_refusal é da PARTE 7 [M6b]: na M6a não existe e só o `ok` zera os contadores.
create or replace function public.obs_archive_after_auto(p_site uuid, p_class text, p_month date, p_resp jsonb, p_mode text, p_dry_run boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_mode <> 'automatico' or p_dry_run then return p_resp; end if;
  if p_resp->>'status' = 'ok' then
    update public.obs_archive_switch set refusals_nas = 0, refusals_b2 = 0 where site_id = p_site and class = p_class;
  elsif p_resp->>'status' = 'recusado' and pg_catalog.to_regprocedure('public.obs_archive_switch_after_refusal(uuid, text, date, jsonb)') is not null then
    execute 'select public.obs_archive_switch_after_refusal($1, $2, $3, $4)' using p_site, p_class, p_month, p_resp;
  end if;
  return p_resp;
end $$;
revoke all on function public.obs_archive_after_auto(uuid, text, date, jsonb, text, boolean) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_discard_month(p_site uuid, p_table text, p_month date, p_by uuid,
                                                            p_mode text default 'clique', p_dry_run boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_class text := public.obs_archive_exit_class(p_table);
  v_mae regclass := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(p_table));
  pol record; m public.obs_archive_months; v_rel regclass; f jsonb; t jsonb; v_lib date; r jsonb;
begin
  if v_class is null or v_mae is null or p_mode not in ('clique', 'automatico') then return jsonb_build_object('status', 'recusado', 'codigo', 'tabela_invalida'); end if;
  select * into pol from public.obs_archive_policy() p where p.class = v_class and p.table_name = p_table;
  -- (1) leituras e portão SEM trava
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado', 'descartado_em', m.dropped_at); end if;
  if m.detached_at is null then return jsonb_build_object('status', 'recusado', 'codigo', 'nao_destacado'); end if;
  v_rel := public.obs_archive_part_rel(p_table, p_month, true);
  if v_rel is null then return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', 'particao_ausente'), p_mode, p_dry_run); end if;
  v_lib := (m.detached_at at time zone 'America/Sao_Paulo')::date + pol.wait_days;     -- dias reais de SP (ensaio: 1)
  if public.obs_archive_hoje_sp() < v_lib then
    return jsonb_build_object('status', 'recusado', 'codigo', 'cedo_demais', 'liberar_a_partir', v_lib);
  end if;
  if cardinality(public.obs_archive_invariante_faltam()) > 0 then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', 'gatilho_ausente'), p_mode, p_dry_run);
  end if;
  -- I3: a mãe ganhou ou perdeu coluna depois do destaque: a cópia no B2 não tem a forma de hoje; apagar a tabela destacada seria perder a única cópia na forma nova.
  if public.obs_archive_schema_fp(v_rel) is distinct from public.obs_archive_schema_fp(v_mae) then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', 'esquema_mudou'), p_mode, p_dry_run);
  end if;
  f := public.obs_archive_gate(p_site, v_class, p_table, p_month, p_by, p_mode, v_rel, array[1, 3, 4, 5, 6, 7, 10, 11, 13], p_dry_run);
  if jsonb_array_length(f) > 0 then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'faltam', f), p_mode, p_dry_run);
  end if;
  if p_dry_run then
    return jsonb_build_object('status', 'simulado', 'linhas', (public.obs_archive_tally(p_site, v_class, p_table, p_month, v_rel))->'linhas',
                              'bytes', pg_catalog.pg_total_relation_size(v_rel));
  end if;

  -- (2) o registro primeiro (ordem da M3b); (3) a tabela destacada
  perform pg_catalog.set_config('lock_timeout', '3s', true);
  begin
    perform 1 from public.obs_archive_months x where x.class = v_class and x.table_name = p_table and x.month = p_month order by x.site_id for update;
    execute pg_catalog.format('lock table %s in access exclusive mode', v_rel);
  exception
    when undefined_table then   -- outra chamada apagou antes: a que perde a corrida acha ja_descartado
      select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
      return jsonb_build_object('status', 'recusado', 'codigo', case when m.dropped_at is not null then 'ja_descartado' else 'particao_ausente' end, 'descartado_em', m.dropped_at);
    when lock_not_available or deadlock_detected then return jsonb_build_object('status', 'recusado', 'codigo', 'ocupado');
  end;

  -- (4) sob a trava: relê e reavalia o barato (estado, prazo, atestação do B2, expurgo pendente), depois a contagem com o resumo da linha inteira
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado', 'descartado_em', m.dropped_at); end if;
  if m.detached_at is null then return jsonb_build_object('status', 'recusado', 'codigo', 'nao_destacado'); end if;
  if public.obs_archive_hoje_sp() < (m.detached_at at time zone 'America/Sao_Paulo')::date + pol.wait_days then
    return jsonb_build_object('status', 'recusado', 'codigo', 'cedo_demais', 'liberar_a_partir', (m.detached_at at time zone 'America/Sao_Paulo')::date + pol.wait_days);
  end if;
  f := public.obs_archive_gate(p_site, v_class, p_table, p_month, p_by, p_mode, null, array[1, 3, 5, 6, 7, 10, 11], false);
  if jsonb_array_length(f) > 0 then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'faltam', f), p_mode, false);
  end if;
  t := public.obs_archive_tally(p_site, v_class, p_table, p_month, v_rel, true);
  if t->>'codigo' is not null then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', t->>'codigo'), p_mode, false);
  end if;
  if not public.obs_archive_outros_sites_ok(v_class, p_table, p_month, t) then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', 'outro_site_na_particao'), p_mode, false);
  end if;
  t := public.obs_archive_discard_core(p_site, v_class, p_table, p_month, v_rel, p_by, p_mode);
  r := jsonb_build_object('status', 'ok', 'linhas', t->'linhas', 'bytes', t->'bytes', 'descartado_em', public.obs_archive_agora());
  return public.obs_archive_after_auto(p_site, v_class, p_month, r, p_mode, false);
end $$;
revoke all on function public.obs_archive_discard_month(uuid, text, date, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_discard_month(uuid, text, date, uuid, text, boolean) to service_role;

-- Em um passo: destaque e descarte na MESMA transação (nunca abre a janela de "trazer de volta"); só depois de 3 descartes com linha DA TABELA.
create or replace function public.obs_archive_drop_month(p_site uuid, p_table text, p_month date, p_by uuid,
                                                         p_mode text default 'clique', p_dry_run boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_class text := public.obs_archive_exit_class(p_table);
  v_mae regclass := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(p_table));
  m public.obs_archive_months; v_rel regclass; v_nome text; f jsonb; t jsonb; r jsonb; v_desc integer; v_fk record; v_sites uuid[];
begin
  if v_class is null or v_mae is null or p_mode not in ('clique', 'automatico') then
    return public.obs_archive_after_auto(p_site, coalesce(v_class, ''), p_month, jsonb_build_object('status', 'recusado', 'codigo', 'tabela_invalida'), p_mode, p_dry_run);
  end if;
  -- (1) leituras e portão completo SEM trava
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado', 'descartado_em', m.dropped_at); end if;
  if m.detached_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_destacado'); end if;
  select count(*) into v_desc from public.obs_archive_months x
   where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.dropped_at is not null and coalesce(x.rows_dropped, 0) > 0;
  if v_desc < 3 then return jsonb_build_object('status', 'recusado', 'codigo', 'dois_passos_obrigatorios', 'descartes', v_desc); end if;
  v_nome := obs_part.nome_da_particao(p_table, p_month);
  v_rel := public.obs_archive_part_rel(p_table, p_month, false);
  if v_rel is null then return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', 'particao_ausente'), p_mode, p_dry_run); end if;
  if cardinality(public.obs_archive_invariante_faltam()) > 0 then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', 'gatilho_ausente'), p_mode, p_dry_run);
  end if;
  f := public.obs_archive_gate(p_site, v_class, p_table, p_month, p_by, p_mode, v_rel, array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 20], p_dry_run);
  if jsonb_array_length(f) > 0 then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'faltam', f), p_mode, p_dry_run);
  end if;
  if p_dry_run then
    return jsonb_build_object('status', 'simulado', 'linhas', (public.obs_archive_tally(p_site, v_class, p_table, p_month, v_rel))->'linhas',
                              'bytes', pg_catalog.pg_total_relation_size(v_rel));
  end if;

  -- (2) o registro, (3) vídeos, mãe, partição
  perform pg_catalog.set_config('lock_timeout', '3s', true);
  begin
    perform 1 from public.obs_archive_months x where x.class = v_class and x.table_name = p_table and x.month = p_month order by x.site_id for update;
    lock table public.competitor_videos in share row exclusive mode;
    execute pg_catalog.format('lock table %s in access exclusive mode', v_mae);
    execute pg_catalog.format('lock table %s in access exclusive mode', v_rel);
  exception
    when undefined_table then
      select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
      return jsonb_build_object('status', 'recusado', 'codigo', case when m.dropped_at is not null then 'ja_descartado' when m.detached_at is not null then 'ja_destacado' else 'particao_ausente' end);
    when lock_not_available or deadlock_detected then
      return jsonb_build_object('status', 'recusado', 'codigo', 'ocupado');   -- ocupado não desarma (Tarefa 7b)
  end;

  -- (4) sob a trava: relê e reavalia (C-2): estado, 3 descartes, partição ainda filha da mãe, condições baratas (b2_withdrawn_at gravado por outra conexão, etc.)
  select * into m from public.obs_archive_months x where x.site_id = p_site and x.class = v_class and x.table_name = p_table and x.month = p_month;
  if m.dropped_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_descartado', 'descartado_em', m.dropped_at); end if;
  if m.detached_at is not null then return jsonb_build_object('status', 'recusado', 'codigo', 'ja_destacado'); end if;
  if not exists (select 1 from pg_catalog.pg_inherits i where i.inhparent = v_mae and i.inhrelid = v_rel) then
    return jsonb_build_object('status', 'recusado', 'codigo', 'ja_destacado');
  end if;
  f := public.obs_archive_gate(p_site, v_class, p_table, p_month, p_by, p_mode, null, array[1, 2, 3, 5, 6, 7, 10, 11, 20], false);
  if jsonb_array_length(f) > 0 then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'faltam', f), p_mode, false);
  end if;
  -- C-1: UMA varredura com o resumo da linha inteira contra o que a conferência guardou; sites vêm dela (m-5)
  t := public.obs_archive_tally(p_site, v_class, p_table, p_month, v_rel, true);
  if t->>'codigo' is not null then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', t->>'codigo'), p_mode, false);
  end if;
  if not public.obs_archive_outros_sites_ok(v_class, p_table, p_month, t) then
    return public.obs_archive_after_auto(p_site, v_class, p_month, jsonb_build_object('status', 'recusado', 'codigo', 'outro_site_na_particao'), p_mode, false);
  end if;
  v_sites := array[p_site] || coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(t->'sites') x), '{}'::uuid[]);

  execute pg_catalog.format('alter table %s detach partition %s', v_mae, v_rel);
  for v_fk in select c.conname from pg_catalog.pg_constraint c where c.conrelid = v_rel and c.contype = 'f' loop
    execute pg_catalog.format('alter table %s drop constraint %I', v_rel, v_fk.conname);
  end loop;
  -- m-2: o destaque em todos os sites da partição, como no detach (o descarte já grava dropped_at em todos)
  update public.obs_archive_months set detached_at = public.obs_archive_agora(), detached_by = p_by
   where class = v_class and table_name = p_table and month = p_month and site_id = any(v_sites);
  if not found then
    raise exception 'registro_ausente' using errcode = 'P0001';   -- o portão exige selo; sem linha no registro é defeito (aborta tudo)
  end if;
  t := public.obs_archive_discard_core(p_site, v_class, p_table, p_month, v_rel, p_by, p_mode);
  r := jsonb_build_object('status', 'ok', 'linhas', t->'linhas', 'bytes', t->'bytes', 'descartado_em', public.obs_archive_agora());
  return public.obs_archive_after_auto(p_site, v_class, p_month, r, p_mode, false);
end $$;
revoke all on function public.obs_archive_drop_month(uuid, text, date, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_drop_month(uuid, text, date, uuid, text, boolean) to service_role;
```

(No `drop` a partição não é renomeada: ela é destacada e apagada na mesma instrução de função; não existe instante em que outra transação a veja como `_saida`.)

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2 e de novo os de `destaque`, `portao` e `invariante`.
Expected: PASS nos quatro.

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/integration/manutencao-m6-descarte.test.ts
git commit -m "feat: M6 parte 5: liberar o espaço do mês destacado e a saída em um passo depois de três descartes da tabela

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m6.sql apps/web/test/integration/manutencao-m6-descarte.test.ts
```

---
### Task 6 [M6a]: As corridas (item 128) e a medida do CP13 em volume

Arquivo serializado, desligado por padrão: só roda com `M6_CORRIDAS=1` e `SUPABASE_DB_URL` explícito no banco de integração (54422). Aqui o destaque É confirmado (duas conexões precisam vê-lo); o `reattach` vai no `finally` de cada caso e o `afterAll` desfaz a M6 e a M3b. Os helpers de corrida RECUSAM rodar com `M6_EM_MIGRATION = true` (depois que a migration existe, `m6-desfazer.sql` derrubaria funções de produção do banco de integração sem a migration para refazê-las: Yannis I-9).

**Files:**
- Create: `supabase/rascunhos/m6-desfazer.sql`
- Modify: `apps/web/test/helpers/m6.ts` (acrescenta `corridasM6Ligadas`, `confirmarM6ParaCorridas`, `desfazerM6DasCorridas`)
- Create: `apps/web/test/integration/manutencao-m6-corridas.test.ts`
- Modify (só disco): `.superpowers/sdd/manutencao-nas/m6/progress.md` (as medidas)

**Interfaces:**
- Consumes: `confirmarM3bParaCorridas`, `desfazerM3bDasCorridas`, `urlDasCorridas` (helper M3b); Tarefas 2-5.
- Produces: `corridasM6Ligadas(): boolean`, `confirmarM6ParaCorridas(): Promise<void>` (lança se `M6_EM_MIGRATION`), `desfazerM6DasCorridas(): Promise<void>`; as medidas no ledger (forma da trava escolhida, tempo do recálculo, `statement_timeout` por papel, tempo com a mãe travada no `detach` e no `reattach`, ação ponta a ponta contra o `maxDuration = 60`).
- Volume por razão medida (M4/I-8): `M6_CANAIS` (padrão 75) e `M6_VIDEOS_POR_CANAL` (padrão 23: 701 vídeos ÷ ~30 canais, **ESTIMATIVA**; a consulta de volume do LEIAME da Tarefa 14 dá o número de verdade antes de fechar a regra de peso). Cada medida roda 3 vezes e vale a pior.
- **Emenda 23/10 (Phil N6-1), o volume de 14/10 está defasado:** medido em 23/10 (`phil.md` §2b/§1c) a diária tem **1.488 linhas/dia** (46.100 no mês cheio com 31 canais; ~138.000 com 3× canais) e a horária **1.734 linhas/dia** (53.800/mês; 161.000 com 3×). A horária é a primeira classe a sair (01/02/2027) e o teste só semeava a diária. O maior canal-mês medido é 1.419 linhas em 21 dias na diária (~2.100/mês) e 1.621 em 10,7 dias na horária (~4.700/mês); com 3× canais, 6.300 e 14.100. Portanto: (1) semear também a **horária** (e a early) com o mesmo `M6_CANAIS`; (2) distribuição com **cauda**: 1 canal com 6.300 linhas de diária e 14.100 de horária no mês, os demais com ~700 e ~1.500; (3) os dois `expect` de tempo passam a `< 4_000 / FATOR` e `< 60_000 / FATOR`, com `FATOR = Number(process.env.M6_FATOR ?? 4.05)` (o CP29 mediu produção 3,98 a 4,05 vezes mais lenta que o banco local; limite local equivalente 988 ms e 14,8 s; comentário aponta para `phil.md` §1b); (4) rodar uma vez com `M6_CANAIS=225` (3×) e anotar o `tally` da horária no ledger. Conferência: o ledger traz `tally_horaria_ms` e `maior_conferencia_ms` já multiplicados por 4,05, ambos abaixo de 8.000. Estimativa de Phil para o `tally` (10 a 20 µs/linha x 4,05, não medida): diária 1,9 a 3,7 s, horária 2,2 a 4,4 s, horária 3× 6,5 a 13 s. Se o `tally` da horária 3× passar de 8 s, vale a regra já prevista: conferência por canal obrigatória (sem recálculo inline) e `PESADA_FIM_MS` na tarefa.

- [ ] **Step 1: O desfazer da M6 (só para as corridas; produção nunca roda isto)**

```sql
-- supabase/rascunhos/m6-desfazer.sql — volta o banco de integração ao estado sem a M6 (as corridas confirmam a M6). Nunca em produção.
drop trigger if exists obs_archive_a_mes_destacado on public.competitor_videos;
drop trigger if exists obs_archive_a_mes_destacado_truncate on public.competitor_videos;
drop trigger if exists obs_archive_a_mes_destacado on public.competitor_channels;
drop trigger if exists obs_archive_a_mes_destacado_truncate on public.competitor_channels;
drop trigger if exists obs_archive_a_unidade_em_mes_destacado on public.obs_archive_units;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in (
              -- M6a
              'obs_archive_block_delete_while_detached', 'obs_archive_invariante_faltam', 'obs_archive_unit_in_detached_month',
              'obs_archive_unit_source_rel', 'obs_archive_content_hash_rel', 'obs_archive_row_digest_rel', 'obs_archive_exit_class', 'obs_archive_part_rel',
              'obs_archive_month_green', 'obs_archive_tally', 'obs_archive_outros_sites_ok', 'obs_archive_conferir_canal', 'obs_archive_gate',
              'obs_archive_precheck_channels', 'obs_archive_precheck_unit', 'obs_archive_exit_check', 'obs_archive_part_bounds', 'obs_archive_part_check',
              'obs_archive_detach_month', 'obs_archive_reattach_month', 'obs_archive_discard_core', 'obs_archive_after_auto', 'obs_archive_discard_month',
              'obs_archive_drop_month', 'obs_archive_switch_counts', 'obs_archive_switch_sim_seen', 'obs_archive_em_transito', 'obs_archive_vermelhos_saida',
              'obs_archive_test_close',
              -- M6b
              'obs_archive_switch_state', 'obs_archive_switch_arm', 'obs_archive_switch_disarm', 'obs_archive_switch_seen', 'obs_archive_switch_watch',
              'obs_archive_switch_after_refusal', 'obs_archive_exit_candidates', 'obs_archive_switch_armed_sites', 'obs_archive_next_exit',
              'obs_archive_vermelhos_automatico')
  loop execute format('drop function %s', f.sig); end loop;
end $$;
alter table public.obs_archive_switch drop constraint if exists obs_archive_switch_disarm_reason_check;
alter table public.obs_archive_prechecks drop column if exists row_digest;
alter table public.obs_archive_switch drop column if exists sims_seen, drop column if exists last_sim_at, drop column if exists refusals_b2,
  drop column if exists disarm_month, drop column if exists disarm_detail, drop column if exists disarm_seen_at;
alter table public.obs_archive_months drop column if exists reattached_at, drop column if exists reattach_out_of_order;
-- obs_archive_vermelhos: a M6 a redefine (Tarefa 7a). O desfazer da M3b, que roda logo depois, a apaga; nada a fazer aqui.
-- obs_archive_pode_sair_em e obs_archive_piso_registro NÃO estão na lista: a M7 também as define (mesma definição). Se a M7 ainda não foi aplicada
-- no banco de integração e a M6 as criou, acrescente-as aqui à mão antes de rodar; senão, o desfazer derrubaria função de outra entrega.
```

(Toda função que uma tarefa posterior criar entra nesta lista no commit da tarefa; o teste do Step 2 confere que, depois do desfazer, nenhuma função `obs_archive_*` da M6 sobra: compara a lista acima com `grep -o "function public\.obs_archive_[a-z_]*" supabase/rascunhos/m6.sql`, menos `pode_sair_em` e `piso_registro`.)

- [ ] **Step 2: O helper e o teste das corridas**

Acrescentar ao fim de `apps/web/test/helpers/m6.ts`:

```ts
import { confirmarM3bParaCorridas, desfazerM3bDasCorridas, urlDasCorridas } from './m3b'

export const M6_DESFAZER_CAMINHO: string = resolve(__dirname, '../../../../supabase/rascunhos/m6-desfazer.sql')
export const corridasM6Ligadas = (): boolean => !skipIfNoLocalDb() && process.env.M6_CORRIDAS === '1'
/** Confirma a M3b inteira (lock de sessão do helper da M3b: dois arquivos de corrida ao mesmo tempo falham alto) e depois a M6 inteira. */
export async function confirmarM6ParaCorridas(): Promise<void> {
  if (M6_EM_MIGRATION) throw new Error('as corridas da M6 só rodam antes da migration existir (M6_EM_MIGRATION = true): o desfazer derrubaria funções reais')
  await confirmarM3bParaCorridas(99 as never)
  const x = new Client({ connectionString: urlDasCorridas() }); await x.connect()
  try { await x.query(sqlM6Ate()) } finally { await x.end() }
}
export async function desfazerM6DasCorridas(): Promise<void> {
  const x = new Client({ connectionString: urlDasCorridas() }); await x.connect()
  try { await x.query(readFileSync(M6_DESFAZER_CAMINHO, 'utf8')) } finally { await x.end() }
  await desfazerM3bDasCorridas()
}
```

(`confirmarM3bParaCorridas(ate)` com `ate` maior que a última parte aplica o rascunho inteiro: conferir em `sqlM3bAte`; se ele exigir uma parte válida, passar a última, `ParteM3b` máxima, em vez de `99 as never`.)

```ts
// apps/web/test/integration/manutencao-m6-corridas.test.ts
// @vitest-environment node
/**
 * M6, item 128 (plano M6, Tarefa 6): o apagamento e o destaque disputando a mesma linha, em read committed, com duas conexões de verdade.
 * Só com M6_CORRIDAS=1 e SUPABASE_DB_URL no 54422; em série: `npx vitest run --no-file-parallelism test/integration/manutencao-m6-corridas.test.ts`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { urlDasCorridas, semearCanal, semearDiaria } from '../helpers/m3b'
import { corridasM6Ligadas, confirmarM6ParaCorridas, desfazerM6DasCorridas, selarMes, particaoDe, novoAdmin, M6_EM_MIGRATION } from '../helpers/m6'

const D = 'competitor_video_daily'
const MES = '2026-10-01'

describe.skipIf(!corridasM6Ligadas())('M6 item 128: corridas entre apagar e destacar', () => {
  let a: Client, b: Client, site: string, canal: string, admin: string, videos: string[]
  const dorme = (ms: number): Promise<void> => new Promise(res => setTimeout(res, ms))
  beforeAll(async () => {
    await confirmarM6ParaCorridas()
    a = new Client({ connectionString: urlDasCorridas() }); await a.connect()
    b = new Client({ connectionString: urlDasCorridas() }); await b.connect()
    // Política e relógio são por transação nos testes de unidade; aqui a sessão inteira: o relógio via GUC de sessão, a política liberada por recriação confirmada.
    for (const c of [a, b]) { await c.query(`select set_config('obs_archive.agora', '2027-05-02 12:00:00+00', false)`); await c.query(`select set_config('obs_archive.hoje', '2027-05-02', false)`) }
    const def = (await a.query(`select pg_get_functiondef('public.obs_archive_policy()'::regprocedure) as d`)).rows[0].d as string
    await a.query(def.replace(`('serie', 'competitor_video_daily', 'particao', 6, 28, 7, 'depois_de_3', false,`, `('serie', 'competitor_video_daily', 'particao', 6, 28, 7, 'depois_de_3', true,`))
    const s = await semearCanal(a, { videos: 2 }); site = s.site; canal = s.canal; videos = s.videos
    await semearDiaria(a, s.videos, MES, 31)
    await selarMes(a, { site, classe: 'serie', tabela: D, mes: MES })
    await a.query(`insert into public.competitor_video_marks (video_id, age_days, site_id, views, gap_hours, age_base_at, read_before_at, read_after_at)
                   select v, 30, $2, 1, 1, now(), now(), now() from unnest($1::uuid[]) v on conflict do nothing`, [s.videos, site])
    admin = await novoAdmin(a, site)
  }, 120_000)
  afterAll(async () => {
    await a?.query(`select public.obs_archive_reattach_month($1, $2, $3, $4)`, [site, D, MES, admin]).catch(() => undefined)
    await apagarCanalDeclarando(a, site, canal, admin).catch((e: Error) => console.error('[m6-corridas] limpeza do canal falhou', e.message))   // emenda 23/10 (N-M6-1): delete cru recusa com a M3b; não engolir a falha
    await a?.end(); await b?.end()
    await desfazerM6DasCorridas()
  }, 120_000)

  async function destacarVoltando<T>(f: () => Promise<T>): Promise<T> {
    try { return await f() } finally { await a.query(`select public.obs_archive_reattach_month($1, $2, $3, $4)`, [site, D, MES, admin]).catch(() => undefined) }
  }

  it('(i) apagar canal ANTES do destaque confirmar: o apagamento espera a trava e, ao seguir, enxerga o destaque e recusa', async () => {
    await destacarVoltando(async () => {
      await a.query('begin')
      const r = (await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4) as r`, [site, D, MES, admin])).rows[0].r as { status: string }
      expect(r.status).toBe('ok')
      const apagar = b.query(`delete from public.competitor_channels where id = $1`, [canal]).then(() => 'apagou', (e: { message: string }) => e.message)
      await new Promise(res => setTimeout(res, 500))
      await a.query('commit')
      expect(await apagar).toBe('mes_destacado_em_transito')
    })
  })

  it('(ii) destacar com um apagamento aberto: o destaque espera até 3 s e responde ocupado; nada muda', async () => {
    await b.query('begin')
    await b.query(`delete from public.competitor_video_daily where video_id in (select id from public.competitor_videos where competitor_channel_id = $1) and snap_date = '2026-10-02'`, [canal])
    try {
      const t0 = Date.now()
      const r = (await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4) as r`, [site, D, MES, admin])).rows[0].r as { status: string; codigo?: string }
      expect(r).toMatchObject({ status: 'recusado', codigo: 'ocupado' })
      expect(Date.now() - t0).toBeLessThan(6_000)
    } finally { await b.query('rollback') }
    expect((await a.query(`select to_regclass($1) is not null as e`, [particaoDe(D, MES)])).rows[0].e).toBe(true)
  })

  it('(iii) leitor em read committed durante o destaque: depois do commit não vê linha órfã; em repeatable read, o retrato antigo mostra (documentado)', async () => {
    await destacarVoltando(async () => {
      await b.query('begin isolation level repeatable read')
      const antes = Number((await b.query(`select count(*) as n from public.competitor_video_daily where snap_date >= $1 and snap_date < ($1::date + interval '1 month')`, [MES])).rows[0].n)
      await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4)`, [site, D, MES, admin])
      const rr = Number((await b.query(`select count(*) as n from public.competitor_video_daily where snap_date >= $1 and snap_date < ($1::date + interval '1 month')`, [MES])).rows[0].n)
      await b.query('commit')
      const rc = Number((await b.query(`select count(*) as n from public.competitor_video_daily where snap_date >= $1 and snap_date < ($1::date + interval '1 month')`, [MES])).rows[0].n)
      expect(antes).toBeGreaterThan(0)
      expect(rc).toBe(0)
      // Repeatable read mantém o retrato (rr = antes). É por isso que a Tarefa 2 trava em CI que nenhum caminho que apaga abra transação assim.
      expect(rr).toBe(antes)
    })
  })

  const chamar = (c: Client, fn: string, mes: string, extra = ''): Promise<{ status: string; codigo?: string; faltam?: Array<{ codigo: string }> }> =>
    c.query(`select public.obs_archive_${fn}_month($1, $2, $3, $4${extra}) as r`, [site, D, mes, admin]).then(r => r.rows[0].r)

  it('C-2: dois detach ao mesmo tempo: um ok e o outro ja_destacado, nenhum erro de banco', async () => {
    await destacarVoltando(async () => {
      const [r1, r2] = await Promise.all([chamar(a, 'detach', MES, ", 'clique', false"), chamar(b, 'detach', MES, ", 'clique', false")])
      expect([r1.status, r2.status].sort()).toEqual(['ok', 'recusado'])
      expect([r1, r2].find(r => r.status === 'recusado')).toMatchObject({ codigo: 'ja_destacado' })
    })
  })

  it('C-2: dois reattach ao mesmo tempo: um ok e o outro nao_destacado', async () => {
    await chamar(a, 'detach', MES, ", 'clique', false")
    const [r1, r2] = await Promise.all([chamar(a, 'reattach', MES, ', false'), chamar(b, 'reattach', MES, ', false')])
    expect([r1.status, r2.status].sort()).toEqual(['ok', 'recusado'])
    expect([r1, r2].find(r => r.status === 'recusado')).toMatchObject({ codigo: 'nao_destacado' })
  })

  it('(iv) coleta já escreveu na série e vai escrever nos vídeos: o destaque cede (ocupado), a coleta nunca é a abortada', async () => {
    await b.query('begin')
    try {
      await b.query(`insert into public.competitor_video_daily (video_id, snap_date, views, taken_at) values ($1, current_date, 1, now()) on conflict do nothing`, [videos[0]])
      const emVoo = chamar(a, 'detach', MES, ", 'clique', false")
      await dorme(300)
      await b.query(`update public.competitor_videos set updated_at = now() where id = $1`, [videos[0]])     // não pode dar deadlock contra a coleta
      await b.query('commit')
      expect((await emVoo).codigo ?? (await emVoo).status).toMatch(/ocupado|ok/)
    } catch (e) { await b.query('rollback').catch(() => undefined); throw e }
    finally { await a.query(`select public.obs_archive_reattach_month($1, $2, $3, $4, false)`, [site, D, MES, admin]).catch(() => undefined) }
  })

  it('(v) coleta já escreveu nos vídeos e vai escrever na série: o destaque espera a coleta terminar; a coleta nunca é a abortada', async () => {
    await b.query('begin')
    try {
      await b.query(`update public.competitor_videos set updated_at = now() where id = $1`, [videos[0]])
      const emVoo = chamar(a, 'detach', MES, ", 'clique', false")
      await dorme(300)
      await b.query(`insert into public.competitor_video_daily (video_id, snap_date, views, taken_at) values ($1, current_date, 1, now()) on conflict do nothing`, [videos[0]])
      await b.query('commit')
      expect((await emVoo).status).toMatch(/ok|recusado/)
    } catch (e) { await b.query('rollback').catch(() => undefined); throw e }
    finally { await a.query(`select public.obs_archive_reattach_month($1, $2, $3, $4, false)`, [site, D, MES, admin]).catch(() => undefined) }
  })

  it('statement_timeout por papel: o service_role cabe nos 8 s do PostgREST; anotar a medida', async () => {
    const st = (await a.query(`select rolname, rolconfig from pg_roles where rolname in ('service_role', 'authenticator', 'authenticated')`)).rows
    console.log('[m6-corridas] statement_timeout por papel:', JSON.stringify(st))
    const t0 = Date.now()
    await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', true)`, [site, D, MES, admin])
    console.log('[m6-corridas] simulação de destaque (2 canais, 31 dias):', Date.now() - t0, 'ms')
    expect(Date.now() - t0).toBeLessThan(8_000)
  })

  /** Um mês extra (partição criada, linhas e selo) para os casos que apagam: o mês de outubro precisa continuar no lugar para os demais. */
  async function mesExtra(mes: string): Promise<void> {
    await a.query(`select obs_part.criar_particao('public.competitor_video_daily'::regclass, $1)`, [mes])
    await semearDiaria(a, videos, mes, 28)
    await selarMes(a, { site, classe: 'serie', tabela: D, mes })
  }
  async function tresDescartes(): Promise<void> {
    for (const mes of ['2026-01-01', '2026-02-01', '2026-03-01']) {
      await a.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped) values ($1, 'serie', $2, $3, now(), 10) on conflict do nothing`, [site, D, mes])
    }
  }

  it('C-2: dois discard ao mesmo tempo: um ok e o outro ja_descartado (mês de setembro, destacado antes)', async () => {
    await mesExtra('2026-09-01')
    await chamar(a, 'detach', '2026-09-01', ", 'clique', false")
    for (const c of [a, b]) { await c.query(`select set_config('obs_archive.agora', '2027-05-20 12:00:00+00', false)`); await c.query(`select set_config('obs_archive.hoje', '2027-05-20', false)`) }
    try {
      const [r1, r2] = await Promise.all([chamar(a, 'discard', '2026-09-01', ", 'clique', false"), chamar(b, 'discard', '2026-09-01', ", 'clique', false")])
      expect([r1.status, r2.status].sort()).toEqual(['ok', 'recusado'])
      expect([r1, r2].find(r => r.status === 'recusado')).toMatchObject({ codigo: 'ja_descartado' })
    } finally {
      for (const c of [a, b]) { await c.query(`select set_config('obs_archive.agora', '2027-05-02 12:00:00+00', false)`); await c.query(`select set_config('obs_archive.hoje', '2027-05-02', false)`) }
    }
  })

  it('C-2 no drop: B2 retirado gravado por OUTRA conexão entre o portão e a trava: recusa b2_sem_atestacao e a partição existe', async () => {
    await mesExtra('2026-08-01')
    await tresDescartes()
    await b.query('begin')
    await b.query(`select 1 from public.obs_archive_months where site_id = $1 and class = 'serie' and table_name = $2 and month = '2026-08-01' for update`, [site, D])
    const emVoo = chamar(a, 'drop', '2026-08-01', ", 'clique', false")     // passa o portão sem trava, bloqueia no passo 2 (a linha do registro)
    await dorme(500)
    await b.query(`update public.obs_archive_months set b2_withdrawn_at = now(), b2_withdrawn_reason = 'ausente', b2_withdrawn_via = 'forja' where site_id = $1 and table_name = $2 and month = '2026-08-01'`, [site, D])
    await b.query('commit')                                                 // dentro dos 3 s do lock_timeout
    const r = await emVoo
    expect(r.status).toBe('recusado')
    expect(r.faltam?.map(f => f.codigo)).toEqual(['b2_sem_atestacao'])
    expect((await a.query(`select to_regclass($1) is not null as e`, [particaoDe(D, '2026-08-01')])).rows[0].e).toBe(true)
  })

  it('CP13 por razão medida: conferência por canal, a mãe travada e a ação ponta a ponta contra o maxDuration de 60 s (3 rodadas, vale a pior)', async () => {
    const canais = Number(process.env.M6_CANAIS ?? 75), porCanal = Number(process.env.M6_VIDEOS_POR_CANAL ?? 23)
    const outros: string[] = []
    try {
      for (let i = 0; i < canais - 1; i++) {
        const s = await semearCanal(a, { site, videos: porCanal }); outros.push(s.canal)
        await semearDiaria(a, s.videos, MES, 31)
        // emenda 23/10 (N6-1): semear também a horária e a early (mesmo M6_CANAIS) e dar cauda a UM canal (6.300 diária / 14.100 horária no mês);
        // os demais ~700 e ~1.500. Usar/estender o helper de semeadura da M2/M3b (semearHoraria, semearEarly); o canal da cauda é outros[0].
      }
      let pior = { inline: 0, maior: 0, travaDetach: 0, travaReattach: 0, ponta: 0 }
      for (let rodada = 0; rodada < 3; rodada++) {
        await selarMes(a, { site, classe: 'serie', tabela: D, mes: MES })
        await a.query(`delete from public.obs_archive_prechecks where site_id = $1`, [site])
        // (c) a ação ponta a ponta, como service_role: simulação + C conferências (4 em paralelo na ação; aqui em série e dividido por 4) + o destaque
        await a.query('set role service_role')
        const t0 = Date.now()
        let t = Date.now()
        await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', true)`, [site, D, MES, admin])
        pior.inline = Math.max(pior.inline, Date.now() - t)
        const lista = (await a.query(`select unnest(public.obs_archive_precheck_channels($1, $2, $3, true)) as c`, [site, D, MES])).rows.map(r => r.c as string)
        let somaConf = 0
        for (const c of lista) {                                              // (a) a maior conferência por canal
          t = Date.now()
          await a.query(`select public.obs_archive_precheck_unit($1, $2, $3, $4::uuid)`, [site, D, MES, c])
          const d = Date.now() - t; somaConf += d; pior.maior = Math.max(pior.maior, d)
        }
        t = Date.now()                                                        // (b) o tempo com a mãe travada: a própria chamada do destaque
        const r = (await a.query(`select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', false) as r`, [site, D, MES, admin])).rows[0].r as { status: string }
        pior.travaDetach = Math.max(pior.travaDetach, Date.now() - t)
        await a.query('reset role')
        expect(r.status).toBe('ok')
        pior.ponta = Math.max(pior.ponta, pior.inline + Math.ceil(somaConf / 4) + pior.travaDetach + 2 * 150)   // + idas ao banco (RTT, ESTIMATIVA)
        t = Date.now()
        await a.query(`select public.obs_archive_reattach_month($1, $2, $3, $4, false)`, [site, D, MES, admin])
        pior.travaReattach = Math.max(pior.travaReattach, Date.now() - t)
        void t0
      }
      console.log('[m6-corridas] CP13', JSON.stringify({ canais, porCanal, ...pior }))
      const FATOR = Number(process.env.M6_FATOR ?? 4.05)   // produção é ~4,05x mais lenta que o banco local (CP29; phil.md §1b)
      expect(pior.maior).toBeLessThan(4_000 / FATOR)
      expect(pior.ponta).toBeLessThan(60_000 / FATOR)
    } finally {
      await a.query('reset role').catch(() => undefined)
      for (const c of outros) await apagarCanalDeclarando(a, site, c, admin).catch((e: Error) => console.error('[m6-corridas] limpeza falhou', e.message))   // emenda 23/10 (N-M6-1)
    }
  }, 600_000)
})
```

- [ ] **Step 3: Rodar (em série, banco de integração) e salvar a saída em arquivo**

Run: `cd apps/web && M6_CORRIDAS=1 HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run --no-file-parallelism test/integration/manutencao-m6-corridas.test.ts > /tmp/m6-corridas.log 2>&1; grep -E "FAIL|Tests |m6-corridas|×" /tmp/m6-corridas.log | head -20`
Expected: PASS em todos (os cinco originais, as corridas C-2, (iv), (v) e o CP13 por razão medida); as linhas `[m6-corridas]` trazem as medidas. Este comando passa de 4 minutos: rodar em background com a saída no arquivo e conferir o log no fim (`run_in_background`). Se (i) devolver `apagou`, a forma da trava não serve: trocar para a segunda forma da linha "Concorrência" do spec (o apagamento pega `share` em `obs_archive_months` antes de apagar) e rodar de novo; registrar a troca no ledger.

- [ ] **Step 4: As medidas no ledger e a decisão do peso da tarefa**

Escrever em `.superpowers/sdd/manutencao-nas/m6/progress.md` (só disco): a forma da trava que passou em (i); o `statement_timeout` de cada papel; o tempo do recálculo inline; o maior tempo da conferência por canal; o tempo com a mãe travada no `detach` e no `reattach` (se passar de 2 s, o `lock_timeout` de 3 s e a janela de leitura da coleta precisam de nova conta); a ação ponta a ponta contra o `maxDuration = 60` (se passar de 45 s, `conferirCanais` sobe o paralelismo ou a ação vira dois passos). Os tempos entram **já multiplicados por 4,05** (N6-1), junto com `tally_horaria_ms` e `maior_conferencia_ms`. O volume real entra pela consulta do LEIAME da Tarefa 14 (a 23 vídeos por canal é ESTIMATIVA). Regra: se `75 × maior` passar de 60 s, a Tarefa 8 troca `peso: 'leve'` por `peso: 'pesada'` (`comecaAteMs` e `fimAteMs` das pesadas, `PESADA_FIM_MS`) e o teste do catálogo acompanha no mesmo commit.

- [ ] **Step 5: Commit**

```bash
git add supabase/rascunhos/m6-desfazer.sql apps/web/test/integration/manutencao-m6-corridas.test.ts
git commit -m "test: M6 item 128: corridas entre apagar e destacar com duas conexões, cliques simultâneos e a medida do CP13 por razão de volume

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m6-desfazer.sql apps/web/test/helpers/m6.ts apps/web/test/integration/manutencao-m6-corridas.test.ts
```

---

### Task 7a [M6a]: Os contadores, os meses em trânsito e os vermelhos da saída (a parte do estado)

**Files:**
- Modify: `supabase/rascunhos/m6.sql` (PARTE 6)
- Create: `apps/web/test/integration/manutencao-m6-saida-estado.test.ts`

**Interfaces:**
- Consumes: Tarefas 3-5; M3b `obs_archive_vermelhos` (corpo copiado e estendido), `obs_archive_switch`.
- Produces (`service_role`, salvo as internas):
  - `public.obs_archive_switch_counts(p_site uuid, p_class text) returns jsonb` (`{descartes, simulacoes}`; descartes = meses da classe com `dropped_at`, `rows_dropped > 0` e `drop_mode = 'clique'`): **o leitor mínimo da peça 4 na M6a** (Hanna H-1). Com `grant` a `service_role`.
  - `public.obs_archive_switch_sim_seen(p_site uuid, p_class text, p_by uuid) returns jsonb` (`{simulacoes}`, no máximo 2; grava só `sims_seen` e `last_sim_at`; não lê nem grava `armed_at`: independente do interruptor).
  - `public.obs_archive_em_transito(p_site uuid) returns jsonb` (`[{tabela, mes, destacado_em, liberar_a_partir}]`, mais antigo primeiro).
  - `public.obs_archive_vermelhos_saida(p_site uuid) returns text[]`: `saida_protecao_ausente:<tabela>.<gatilho>` (mês em trânsito e gatilho faltando), `saida_particao_ausente:<tabela>:<AAAA-MM>`, `saida_transito_longo:<tabela>:<AAAA-MM>` (hoje em SP > liberar_a_partir + 14 dias; Phil I5) e `saida_esquema_divergente:<tabela>:<AAAA-MM>` (a mãe mudou de forma depois do destaque; I3). **Sem** o vermelho do desarme nas 72 h (M6b, Tarefa 7b).
  - `public.obs_archive_vermelhos(p_site uuid)` redefinida = corpo da M3b + o bloco que acrescenta os da saída e, se a função existir (`to_regprocedure`), os do desarme (Tarefa 7b).

- [ ] **Step 1: Os testes (falham)**

```ts
// apps/web/test/integration/manutencao-m6-saida-estado.test.ts
// @vitest-environment node
/** M6 parte 6 [M6a] (plano M6, Tarefa 7a; itens 89, 92, 119): contadores, meses em trânsito e os vermelhos da saída. begin … rollback. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar, tenta, semearCanal, semearDiaria, M3B_SQL_CAMINHO } from '../helpers/m3b'
import { prepararM6, relogio, liberarClasses, novoAdmin, selarMes, particaoDe, M6_SQL_CAMINHO } from '../helpers/m6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const D = 'competitor_video_daily'
const MES = '2026-10-01'

describe.skipIf(skipIfNoLocalDb())('M6 parte 6 [M6a]: contadores, trânsito e vermelhos da saída', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try { await prepararM6(c, 6); await f() } finally { await c.query('rollback') }
  }
  /** Mês de outubro selado e DESTACADO de verdade (a tabela _saida existe), em 02/05/2027. */
  async function destacado(): Promise<{ site: string; admin: string }> {
    await relogio(c, '2027-05-02 12:00:00+00')
    await liberarClasses(c, ['serie'])
    const s = await semearCanal(c, { videos: 2 })
    await semearDiaria(c, s.videos, MES, 31)
    await selarMes(c, { site: s.site, classe: 'serie', tabela: D, mes: MES })
    await c.query(`insert into public.competitor_video_marks (video_id, age_days, site_id, views, gap_hours, age_base_at, read_before_at, read_after_at)
                   select v, 30, $2, 1, 1, now(), now(), now() from unnest($1::uuid[]) v on conflict do nothing`, [s.videos, s.site])
    const admin = await novoAdmin(c, s.site)
    const r = await escalar<{ status: string }>(c, `select public.obs_archive_detach_month($1, $2, $3, $4, 'clique', false)`, [s.site, D, MES, admin])
    expect(r.status).toBe('ok')
    return { site: s.site, admin }
  }
  const vermelhos = (site: string): Promise<string[]> => escalar<string[]>(c, `select public.obs_archive_vermelhos_saida($1)`, [site])

  it('em trânsito: mês destacado aparece com a data de liberar, mais antigo primeiro', async () => {
    await emTransacao(async () => {
      const { site } = await destacado()
      expect(await escalar<unknown>(c, `select public.obs_archive_em_transito($1)`, [site])).toEqual([{ tabela: D, mes: MES, destacado_em: expect.any(String), liberar_a_partir: '2027-05-09' }])
    })
  })

  it('sem nada fora do lugar, os vermelhos da saída são vazios; gatilho desligado com mês em trânsito é vermelho', async () => {
    await emTransacao(async () => {
      const { site } = await destacado()
      expect(await vermelhos(site)).toEqual([])
      await c.query(`alter table public.competitor_channels disable trigger obs_archive_a_mes_destacado`)
      expect(await vermelhos(site)).toEqual(['saida_protecao_ausente:competitor_channels.obs_archive_a_mes_destacado'])
    })
  })

  it('partição destacada que sumiu: saida_particao_ausente; esquema da mãe mudou: saida_esquema_divergente', async () => {
    await emTransacao(async () => {
      const { site } = await destacado()
      await c.query(`alter table public.competitor_video_daily add column m6_extra integer`)
      expect(await vermelhos(site)).toEqual([`saida_esquema_divergente:${D}:2026-10`])
      await c.query(`alter table ${particaoDe(D, MES)}_saida rename to m6_sumiu`)
      expect(await vermelhos(site)).toEqual([`saida_particao_ausente:${D}:2026-10`])
    })
  })

  it('Phil I5: mês em trânsito há mais de 14 dias depois da data de liberar é vermelho (23/05 não, 24/05 sim)', async () => {
    await emTransacao(async () => {
      const { site } = await destacado()                          // destacado em 02/05; liberar em 09/05
      await relogio(c, '2027-05-23 12:00:00+00')
      expect(await vermelhos(site)).toEqual([])
      await relogio(c, '2027-05-24 12:00:00+00')
      expect(await vermelhos(site)).toEqual([`saida_transito_longo:${D}:2026-10`])
    })
  })

  it('obs_archive_vermelhos da M6 é a última definição da M3b mais os blocos da saída (nada da M3b se perde), e inclui os da saída', async () => {
    await emTransacao(async () => {
      const { site } = await destacado()
      await c.query(`alter table public.competitor_channels disable trigger obs_archive_a_mes_destacado`)
      expect(await escalar<string[]>(c, `select public.obs_archive_vermelhos($1)`, [site])).toContain('saida_protecao_ausente:competitor_channels.obs_archive_a_mes_destacado')
      const def = await escalar<string>(c, `select prosrc from pg_proc where oid = 'public.obs_archive_vermelhos(uuid)'::regprocedure`)
      expect(def).toContain('public.obs_archive_vermelhos_remocao')
      expect(def).toContain('public.obs_archive_vermelhos_saida')
      expect(def).toContain('public.obs_archive_descartados_sem_releitura(p_site, 45)')
    })
  })

  it('o corpo da M3b vem inteiro: removendo os blocos da M6, sobra exatamente a última definição do m3b.sql', () => {
    const corpo = (sql: string): string => {
      const i = sql.lastIndexOf('create or replace function public.obs_archive_vermelhos(p_site uuid)')
      return sql.slice(i, sql.indexOf('end $$;', i))
    }
    const m6 = corpo(readFileSync(M6_SQL_CAMINHO, 'utf8')).replace(/\n  -- M6[^\n]*\n  if [^\n]*\n    execute [^\n]*\n  end if;/g, '')
    expect(m6).toBe(corpo(readFileSync(M3B_SQL_CAMINHO, 'utf8')))
  })

  it('sim_seen conta no máximo 2, só para administrador, e não toca em armed_at; switch_counts lê descartes de clique com linha e as simulações', async () => {
    await emTransacao(async () => {
      await relogio(c, '2027-05-02 12:00:00+00')
      const { site } = await semearCanal(c, { videos: 1 })
      const admin = await novoAdmin(c, site)
      for (let i = 0; i < 3; i++) expect(await escalar<{ simulacoes: number }>(c, `select public.obs_archive_switch_sim_seen($1, 'serie', $2)`, [site, admin])).toEqual({ simulacoes: Math.min(i + 1, 2) })
      expect(await escalar<unknown>(c, `select public.obs_archive_switch_sim_seen($1, 'serie', $2)`, [site, '00000000-0000-0000-0000-00000000dead'])).toMatchObject({ status: 'recusado', codigo: 'sem_direito' })
      expect(await escalar<boolean>(c, `select armed_at is null from public.obs_archive_switch where site_id = $1 and class = 'serie'`, [site])).toBe(true)
      await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, drop_mode, rows_dropped) values
                       ($1, 'serie', $2, '2026-01-01', now(), 'clique', 10), ($1, 'serie', $2, '2026-02-01', now(), 'automatico', 10), ($1, 'serie', $2, '2026-03-01', now(), 'clique', 0)`, [site, D])
      expect(await escalar<unknown>(c, `select public.obs_archive_switch_counts($1, 'serie')`, [site])).toEqual({ descartes: 1, simulacoes: 2 })
      expect(await escalar<unknown>(c, `select public.obs_archive_switch_sim_seen($1, 'texto', $2)`, [site, admin])).toEqual({ simulacoes: 0 })
    })
  })

  it('switch_counts é chamável pelo service_role e por mais ninguém', async () => {
    await emTransacao(async () => {
      await relogio(c, '2027-05-02 12:00:00+00')
      const { site } = await semearCanal(c, { videos: 1 })
      await c.query(`set local role service_role`)
      expect(await tenta(c, `select public.obs_archive_switch_counts($1, 'serie')`, [site])).toMatchObject({ ok: true })
      await c.query('reset role')
      for (const papel of ['anon', 'authenticated']) {
        await c.query(`set local role ${papel}`)
        expect(await tenta(c, `select public.obs_archive_switch_counts($1, 'serie')`, [site]), papel).toMatchObject({ ok: false, code: '42501' })
        await c.query('reset role')
      }
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/manutencao-m6-saida-estado.test.ts > /tmp/m6-t7a.log 2>&1; grep -E "FAIL|Tests |does not exist" /tmp/m6-t7a.log | head`
Expected: FAIL (`function public.obs_archive_em_transito(...) does not exist`).

- [ ] **Step 3: O SQL (PARTE 6 do rascunho)**

```sql
create or replace function public.obs_archive_switch_counts(p_site uuid, p_class text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'descartes', (select count(*) from public.obs_archive_months m where m.site_id = p_site and m.class = p_class and m.dropped_at is not null
                    and coalesce(m.rows_dropped, 0) > 0 and coalesce(m.drop_mode, 'clique') = 'clique'),
    'simulacoes', coalesce((select s.sims_seen from public.obs_archive_switch s where s.site_id = p_site and s.class = p_class), 0))
$$;
revoke all on function public.obs_archive_switch_counts(uuid, text) from public, anon, authenticated;
grant execute on function public.obs_archive_switch_counts(uuid, text) to service_role;   -- M6a: o leitor mínimo dos contadores (Hanna H-1)

create or replace function public.obs_archive_switch_sim_seen(p_site uuid, p_class text, p_by uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_class not in ('horaria', 'serie') then return jsonb_build_object('simulacoes', 0); end if;
  if p_by is null or not public.obs_archive_is_site_admin(p_site, p_by) then return jsonb_build_object('status', 'recusado', 'codigo', 'sem_direito'); end if;
  insert into public.obs_archive_switch (site_id, class, sims_seen, last_sim_at) values (p_site, p_class, 1, public.obs_archive_agora())
  on conflict (site_id, class) do update set sims_seen = least(public.obs_archive_switch.sims_seen + 1, 2), last_sim_at = excluded.last_sim_at;
  return jsonb_build_object('simulacoes', (select s.sims_seen from public.obs_archive_switch s where s.site_id = p_site and s.class = p_class));
end $$;
revoke all on function public.obs_archive_switch_sim_seen(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_switch_sim_seen(uuid, text, uuid) to service_role;

create or replace function public.obs_archive_em_transito(p_site uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('tabela', m.table_name, 'mes', m.month, 'destacado_em', m.detached_at,
           'liberar_a_partir', (m.detached_at at time zone 'America/Sao_Paulo')::date + p.wait_days) order by m.month, m.table_name), '[]'::jsonb)
    from public.obs_archive_months m join public.obs_archive_policy() p on p.class = m.class and p.table_name = m.table_name
   where m.detached_at is not null and m.dropped_at is null and (m.site_id = p_site or p_site is null)
$$;
revoke all on function public.obs_archive_em_transito(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_em_transito(uuid) to service_role;

create or replace function public.obs_archive_vermelhos_saida(p_site uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare v text[] := '{}'; i record; f text; v_mae regclass; v_rel regclass; v_lib date;
begin
  if exists (select 1 from public.obs_archive_months m where m.detached_at is not null and m.dropped_at is null) then
    foreach f in array public.obs_archive_invariante_faltam() loop v := v || ('saida_protecao_ausente:' || f); end loop;
  end if;
  for i in select m.table_name, m.month, m.detached_at, p.wait_days from public.obs_archive_months m
             join public.obs_archive_policy() p on p.class = m.class and p.table_name = m.table_name
            where m.site_id = p_site and m.detached_at is not null and m.dropped_at is null order by m.month, m.table_name loop
    v_rel := public.obs_archive_part_rel(i.table_name, i.month, true);
    if v_rel is null then
      v := v || ('saida_particao_ausente:' || i.table_name || ':' || pg_catalog.to_char(i.month, 'YYYY-MM'));
      continue;
    end if;
    -- Yannis I-3 / Phil I5: mês em trânsito há mais de 14 dias depois da data de liberar ninguém liberou nem trouxe de volta: vermelho
    v_lib := (i.detached_at at time zone 'America/Sao_Paulo')::date + i.wait_days;
    if public.obs_archive_hoje_sp() > v_lib + 14 then
      v := v || ('saida_transito_longo:' || i.table_name || ':' || pg_catalog.to_char(i.month, 'YYYY-MM'));
    end if;
    -- I3: a mãe mudou de forma depois do destaque; liberar recusa esquema_mudou e a volta acrescenta colunas: o dono precisa saber
    v_mae := pg_catalog.to_regclass('public.' || pg_catalog.quote_ident(i.table_name));
    if v_mae is not null and public.obs_archive_schema_fp(v_rel) is distinct from public.obs_archive_schema_fp(v_mae) then
      v := v || ('saida_esquema_divergente:' || i.table_name || ':' || pg_catalog.to_char(i.month, 'YYYY-MM'));
    end if;
  end loop;
  return v;
end $$;
revoke all on function public.obs_archive_vermelhos_saida(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_vermelhos_saida(uuid) to service_role;
```

E a redefinição de `obs_archive_vermelhos`: **copiar o corpo inteiro da última definição da M3b** (`m3b.sql`, `create or replace function public.obs_archive_vermelhos(p_site uuid)`, hoje em `:2101-2181`) para o rascunho, mudando só o fim, de

```sql
  if pg_catalog.to_regprocedure('public.obs_archive_vermelhos_remocao(uuid)') is not null then
    execute 'select $1 || public.obs_archive_vermelhos_remocao($2)' into v using v, p_site;
  end if;
  return coalesce(v, '{}'::text[]);
```

para

```sql
  if pg_catalog.to_regprocedure('public.obs_archive_vermelhos_remocao(uuid)') is not null then
    execute 'select $1 || public.obs_archive_vermelhos_remocao($2)' into v using v, p_site;
  end if;
  -- M6a: os vermelhos da saída (proteção ausente, tabela destacada sumida, trânsito longo, esquema divergente)
  if pg_catalog.to_regprocedure('public.obs_archive_vermelhos_saida(uuid)') is not null then
    execute 'select $1 || public.obs_archive_vermelhos_saida($2)' into v using v, p_site;
  end if;
  -- M6b: o automático desligou sozinho nas últimas 72 h (a função só existe depois da migration da Tarefa 14b)
  if pg_catalog.to_regprocedure('public.obs_archive_vermelhos_automatico(uuid)') is not null then
    execute 'select $1 || public.obs_archive_vermelhos_automatico($2)' into v using v, p_site;
  end if;
  return coalesce(v, '{}'::text[]);
```

(O teste "o corpo da M3b vem inteiro" remove os dois blocos `-- M6a`/`-- M6b` e exige igualdade com a última definição do `m3b.sql`; se a M3b mudar a função depois deste plano, o teste acusa. O arquivo `m3b.sql` e o `M3B_SQL_CAMINHO` do helper da M3b são os do repositório: conferir o nome exportado.)

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2 e todas as integrações da M6 (`npx vitest run test/integration/manutencao-m6-` com o mesmo ambiente, saída para `/tmp/m6-todas.log`).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/integration/manutencao-m6-saida-estado.test.ts
git commit -m "feat: M6a parte 6: contadores, meses em trânsito e os vermelhos da saída (proteção, partição, trânsito longo, esquema)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m6.sql apps/web/test/integration/manutencao-m6-saida-estado.test.ts supabase/rascunhos/m6-desfazer.sql
```

(`obs_archive_switch_counts` e as funções desta tarefa já estão na lista do `m6-desfazer.sql` da Tarefa 6.)

---

### Task 7b [M6b]: O interruptor do automático, o vigia e o vermelho do desarme

**Files:**
- Modify: `supabase/rascunhos/m6.sql` (PARTE 7)
- Create: `apps/web/test/integration/manutencao-m6-interruptor.test.ts`

**Interfaces:**
- Consumes: Tarefas 3-5 e 7a; M3b `obs_archive_atraso`, `obs_archive_heartbeat`; `obs_archive_pode_sair_em` (Decisão 13).
- Produces (todas `service_role`, salvo as marcadas internas):
  - `public.obs_archive_switch_state(p_site uuid, p_class text) returns jsonb`: `{estado: 'nao_existe'|'nao_pode'|'desligado'|'ligado'|'desligou_sozinho'|'venceu'|'desligado_na_configuracao', armado_ate?, desligado_em?, motivo?, mes?, detalhe?, visto?, descartes: int, simulacoes: int, simulacao_depois: boolean}` (o `desligado_na_configuracao` só vem pela ação quando a variável está desligada; aqui, `p_env_on` não entra).
  - `public.obs_archive_switch_arm(p_site uuid, p_class text, p_by uuid, p_frase_confirmada boolean, p_env_on boolean) returns jsonb` (`{status: 'ok', armado_ate}` | `{status: 'recusado', codigo}`; códigos `classe_sem_automatico`, `sem_direito`, `saidas_insuficientes {descartes}`, `simulacoes_insuficientes {simulacoes}`, `simulacao_depois_do_desligamento`, `variavel_desligada`, `frase_nao_confere`).
  - `public.obs_archive_switch_disarm(p_site uuid, p_class text, p_reason text, p_month date, p_detail jsonb, p_by uuid) returns jsonb`.
  - `public.obs_archive_switch_seen(p_site uuid, p_class text, p_by uuid) returns jsonb`.
  - `public.obs_archive_switch_watch(p_site uuid, p_sinal text, p_env_on boolean) returns jsonb` (`{desligou: [{classe, motivo}]}`; `p_sinal ∈ ('verde','amarelo','vermelho','nao_medido')`). **Motivo 7 (Decisão 9):** mais de um drop automático da classe no MESMO dia de São Paulo.
  - Interna: `public.obs_archive_switch_after_refusal(p_site uuid, p_class text, p_month date, p_resp jsonb) returns void` (chamada por `obs_archive_after_auto`, Tarefa 5).
  - `public.obs_archive_exit_candidates(p_site uuid) returns jsonb` (`[{classe, tabela, mes, descartes}]` ordenado por mês e tabela: por tabela das classes com automático, o mês mais antigo com linha, online, sem destaque; **omite a classe que já teve saída automática no dia de SP corrente** (I-2); `descartes` = descartes com linha DESTA tabela, a mesma conta do `drop`; a Tarefa 8 lê).
  - `public.obs_archive_switch_armed_sites() returns uuid[]`: os sites com alguma classe armada e não desligada (inclusive vencida: o vigia é quem desliga).
  - `public.obs_archive_vermelhos_automatico(p_site uuid) returns text[]`: `saida_automatico_desligou:<classe>:<motivo>` nas 72 h, exceto 8, 9 e manual.
  - `public.obs_archive_next_exit() returns date`: o primeiro dia em que algum mês online de classe que sai pode sair, por `obs_archive_pode_sair_em` (a Tarefa 10 lê).

- [ ] **Step 1: Os testes (falham)**

```ts
// apps/web/test/integration/manutencao-m6-interruptor.test.ts
// @vitest-environment node
/** M6 parte 7 [M6b] (plano M6, Tarefa 7b; itens 46, 92, 117): ligar, desligar sozinho, vigiar. begin … rollback. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar, semearCanal } from '../helpers/m3b'
import { prepararM6, relogio, liberarClasses, novoAdmin } from '../helpers/m6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const D = 'competitor_video_daily'
type Resp = { status?: string; codigo?: string; estado?: string; motivo?: string; desligou?: Array<{ classe: string; motivo: string }>; descartes?: number; simulacoes?: number }

describe.skipIf(skipIfNoLocalDb())('M6 parte 7 [M6b]: o interruptor', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try { await prepararM6(c, 7); await f() } finally { await c.query('rollback') }
  }
  async function pronto(o: { descartes?: number; sims?: number } = {}): Promise<{ site: string; admin: string }> {
    await relogio(c, '2027-05-02 12:00:00+00')
    await liberarClasses(c, ['serie'])
    const { site } = await semearCanal(c, { videos: 1 })
    const admin = await novoAdmin(c, site)
    for (let i = 0; i < (o.descartes ?? 3); i++) {
      await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, detached_at, dropped_at, drop_mode, rows_dropped)
                     values ($1, 'serie', $2, make_date(2026, $3, 1), now() - interval '20 days', now() - interval '10 days', 'clique', 100)`, [site, D, i + 1])
    }
    for (let i = 0; i < (o.sims ?? 2); i++) await c.query(`select public.obs_archive_switch_sim_seen($1, 'serie', $2)`, [site, admin])
    return { site, admin }
  }
  const ligar = (site: string, admin: string, frase = true, env = true): Promise<Resp> =>
    escalar<Resp>(c, `select public.obs_archive_switch_arm($1, 'serie', $2, $3, $4)`, [site, admin, frase, env])
  const estado = (site: string): Promise<Resp> => escalar<Resp>(c, `select public.obs_archive_switch_state($1, 'serie')`, [site])
  const vigiar = (site: string, sinal = 'verde', env = true): Promise<Resp> => escalar<Resp>(c, `select public.obs_archive_switch_watch($1, $2, $3)`, [site, sinal, env])

  it('46: ligar exige 3 saídas feitas por você, 2 simulações vistas, a frase e a variável; o ensaio e saída vazia não contam', async () => {
    await emTransacao(async () => {
      const { site, admin } = await pronto({ descartes: 2, sims: 1 })
      await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped) values ($1, 'ensaio', 'obs_archive_rehearsal', '2026-05-01', now(), 9), ($1, 'serie', $2, '2026-06-01', now(), 0)`, [site, D])
      expect(await estado(site)).toMatchObject({ estado: 'nao_pode', descartes: 2, simulacoes: 1 })
      expect(await ligar(site, admin)).toMatchObject({ status: 'recusado', codigo: 'saidas_insuficientes' })
      await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped) values ($1, 'serie', $2, '2026-07-01', now(), 5)`, [site, D])
      expect(await ligar(site, admin)).toMatchObject({ status: 'recusado', codigo: 'simulacoes_insuficientes' })
      await c.query(`select public.obs_archive_switch_sim_seen($1, 'serie', $2)`, [site, admin])
      expect(await ligar(site, admin, false)).toMatchObject({ status: 'recusado', codigo: 'frase_nao_confere' })
      expect(await ligar(site, admin, true, false)).toMatchObject({ status: 'recusado', codigo: 'variavel_desligada' })
      expect(await ligar(site, '00000000-0000-0000-0000-00000000dead')).toMatchObject({ status: 'recusado', codigo: 'sem_direito' })
      expect(await escalar<Resp>(c, `select public.obs_archive_switch_arm($1, 'texto', $2, true, true)`, [site, admin])).toMatchObject({ status: 'recusado', codigo: 'classe_sem_automatico' })
      expect(await ligar(site, admin)).toMatchObject({ status: 'ok' })
      expect(await estado(site)).toMatchObject({ estado: 'ligado' })
      expect(await escalar<string>(c, `select (expires_at - armed_at)::text from public.obs_archive_switch where site_id = $1 and class = 'serie'`, [site])).toBe('90 days')
    })
  })

  it('92: depois de desligar sozinho, ligar de novo exige uma simulação vista DEPOIS do desligamento; depois do "Desligar" manual, não', async () => {
    await emTransacao(async () => {
      const { site, admin } = await pronto()
      await ligar(site, admin)
      await c.query(`select public.obs_archive_switch_disarm($1, 'serie', '2', null, null, null)`, [site])
      expect(await estado(site)).toMatchObject({ estado: 'desligou_sozinho', motivo: '2' })
      await relogio(c, '2027-05-03 12:00:00+00')
      expect(await ligar(site, admin)).toMatchObject({ status: 'recusado', codigo: 'simulacao_depois_do_desligamento' })
      await c.query(`select public.obs_archive_switch_sim_seen($1, 'serie', $2)`, [site, admin])
      expect(await ligar(site, admin)).toMatchObject({ status: 'ok' })
      await c.query(`select public.obs_archive_switch_disarm($1, 'serie', 'manual', null, null, $2)`, [site, admin])
      expect(await estado(site)).toMatchObject({ estado: 'desligado' })
      expect(await ligar(site, admin)).toMatchObject({ status: 'ok' })
    })
  })

  it('117: o vigia desliga por: validade (8), NAS retirado (1), copiador calado (2), atraso vermelho (4), sinal vermelho (5), não medido (6), mais de um drop automático da classe no mesmo dia de São Paulo (7), variável (9), B2 retirado (10), B2 divergente (13)', async () => {
    const casos: Array<[string, string, (site: string) => Promise<void>, string?]> = [
      ['8', 'validade', async () => { await relogio(c, '2027-08-01 12:00:00+00') }],
      ['1', 'nas', async s => { await c.query(`insert into public.obs_archive_units (site_id, class, table_name, channel_ref, month, version, row_count, control_sum, hash_conteudo, schema_fp, sha256_bytes, nas_withdrawn_at, nas_withdrawn_reason) values ($1, 'serie', $2, gen_random_uuid()::text, '2026-12-01', 1, 1, 1, repeat('0',64), repeat('0',64), repeat('a',64), now(), 'divergente')`, [s, D]) }],
      ['2', 'copiador', async s => { await c.query(`insert into public.obs_archive_heartbeat (site_id, worker, last_poll_at) values ($1, 'copiador', public.obs_archive_agora() - interval '37 hours') on conflict (site_id, worker) do update set last_poll_at = excluded.last_poll_at`, [s]) }],
      ['4', 'atraso', async () => { await c.query(`create or replace function public.obs_archive_atraso(p_site uuid) returns jsonb language sql stable as $f$ select '{"vermelhos": 1}'::jsonb $f$`) }],   // a fonte do atraso é da M3b; aqui só a leitura
      ['5', 'sinal', async () => undefined, 'vermelho'],
      ['6', 'nao_medido', async () => undefined, 'nao_medido'],
      ['7', 'dois_drops', async s => { await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, drop_mode, rows_dropped) values ($1, 'serie', $2, '2026-04-01', public.obs_archive_agora() - interval '2 hours', 'automatico', 1), ($1, 'serie', 'competitor_video_early', '2026-04-01', public.obs_archive_agora() - interval '1 hour', 'automatico', 1)`, [s, D]) }],
      ['10', 'b2', async s => { await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, b2_withdrawn_at, b2_withdrawn_reason, b2_withdrawn_via) values ($1, 'serie', $2, '2026-12-01', now(), 'ausente', 'forja')`, [s, D]) }],
      ['13', 'b2_div', async s => { await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, b2_forja_diverged_at) values ($1, 'serie', $2, '2026-12-01', now())`, [s, D]) }],
    ]
    for (const [motivo, nome, preparar, sinal] of casos) {
      await emTransacao(async () => {
        const { site, admin } = await pronto()
        await c.query(`insert into public.obs_archive_heartbeat (site_id, worker, last_poll_at) values ($1, 'copiador', public.obs_archive_agora()) on conflict (site_id, worker) do update set last_poll_at = excluded.last_poll_at`, [site])
        expect((await ligar(site, admin)).status, nome).toBe('ok')
        expect((await vigiar(site)).desligou, `${nome}: verde não desliga`).toEqual([])
        await preparar(site)
        const r = await vigiar(site, sinal ?? 'verde')
        expect(r.desligou, nome).toEqual([{ classe: 'serie', motivo }])
        expect(await estado(site), nome).toMatchObject({ motivo })
      })
    }
    await emTransacao(async () => {
      const { site, admin } = await pronto()
      await c.query(`insert into public.obs_archive_heartbeat (site_id, worker, last_poll_at) values ($1, 'copiador', public.obs_archive_agora()) on conflict (site_id, worker) do update set last_poll_at = excluded.last_poll_at`, [site])
      await ligar(site, admin)
      expect((await vigiar(site, 'verde', false)).desligou).toEqual([{ classe: 'serie', motivo: '9' }])
    })
  })

  it('o dado não existe: sem linha de batimento do copiador, o vigia desliga (motivo 2), nunca fica verde por omissão', async () => {
    await emTransacao(async () => {
      const { site, admin } = await pronto()
      await ligar(site, admin)
      expect((await vigiar(site)).desligou).toEqual([{ classe: 'serie', motivo: '2' }])
    })
  })

  it('recusas no automático: ainda_na_janela, ocupado e dois_passos não desarmam; a 1ª de NAS conta e a 2ª seguida desarma (3); B2 por prazo idem (3b); retirada desarma (10); outra desarma (11)', async () => {
    await emTransacao(async () => {
      const { site, admin } = await pronto()
      const recusa = (r: object): Promise<unknown> => c.query(`select public.obs_archive_switch_after_refusal($1, 'serie', '2026-10-01', $2::jsonb)`, [site, JSON.stringify(r)])
      for (const x of [{ status: 'recusado', faltam: [{ codigo: 'ainda_na_janela' }] }, { status: 'recusado', codigo: 'ocupado' }, { status: 'recusado', codigo: 'dois_passos_obrigatorios' }]) {
        await ligar(site, admin); await recusa(x)
        expect(await estado(site), JSON.stringify(x)).toMatchObject({ estado: 'ligado' })
      }
      await recusa({ status: 'recusado', faltam: [{ codigo: 'nas_sem_atestacao', horas: 25 }] })
      expect(await estado(site)).toMatchObject({ estado: 'ligado' })
      await recusa({ status: 'recusado', faltam: [{ codigo: 'nas_sem_atestacao', horas: 49 }] })
      expect(await estado(site)).toMatchObject({ estado: 'desligou_sozinho', motivo: '3' })
      await c.query(`select public.obs_archive_switch_sim_seen($1, 'serie', $2)`, [site, admin]); await ligar(site, admin)
      await recusa({ status: 'recusado', faltam: [{ codigo: 'b2_sem_atestacao', motivo: 'prazo' }] })
      await recusa({ status: 'recusado', faltam: [{ codigo: 'b2_sem_atestacao', motivo: 'prazo' }] })
      expect(await estado(site)).toMatchObject({ motivo: '3', detalhe: { b2: true } })
      await c.query(`select public.obs_archive_switch_sim_seen($1, 'serie', $2)`, [site, admin]); await ligar(site, admin)
      await recusa({ status: 'recusado', faltam: [{ codigo: 'b2_sem_atestacao', motivo: 'retirada' }] })
      expect(await estado(site)).toMatchObject({ motivo: '10' })
      await c.query(`select public.obs_archive_switch_sim_seen($1, 'serie', $2)`, [site, admin]); await ligar(site, admin)
      await recusa({ status: 'recusado', faltam: [{ codigo: 'saida_fora_de_ordem', antes: '2026-09-01' }] })
      expect(await estado(site)).toMatchObject({ motivo: '11', mes: '2026-10-01' })
    })
  })

  it('7: dois drops automáticos da classe em dias de SP diferentes, com menos de 24 h entre eles, NÃO desligam; no mesmo dia de SP, sim (Decisão 9)', async () => {
    await emTransacao(async () => {
      const { site, admin } = await pronto()
      await c.query(`insert into public.obs_archive_heartbeat (site_id, worker, last_poll_at) values ($1, 'copiador', public.obs_archive_agora()) on conflict (site_id, worker) do update set last_poll_at = excluded.last_poll_at`, [site])
      await ligar(site, admin)
      // agora = 2027-05-02 12:00Z (09:00 em SP). 02:30Z é 23:30 de 01/05 em SP; 11:00Z é 08:00 de 02/05: 8,5 h de distância, dias de SP diferentes.
      await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, drop_mode, rows_dropped) values
                       ($1, 'serie', $2, '2026-04-01', '2027-05-02 02:30:00+00', 'automatico', 1), ($1, 'serie', 'competitor_video_early', '2026-04-01', '2027-05-02 11:00:00+00', 'automatico', 1)`, [site, D])
      expect((await vigiar(site)).desligou).toEqual([])
      await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, drop_mode, rows_dropped) values ($1, 'serie', 'competitor_video_comments', '2026-04-01', '2027-05-02 11:30:00+00', 'automatico', 1)`, [site])
      expect((await vigiar(site)).desligou).toEqual([{ classe: 'serie', motivo: '7' }])
    })
  })

  it('vermelho do desarme: nas 72 h, exceto 8, 9 e manual; o obs_archive_vermelhos o inclui (corpo da M3b preservado: Tarefa 7a)', async () => {
    await emTransacao(async () => {
      const { site, admin } = await pronto()
      await ligar(site, admin)
      await c.query(`select public.obs_archive_switch_disarm($1, 'serie', '8', null, null, null)`, [site])
      expect(await escalar<string[]>(c, `select public.obs_archive_vermelhos_automatico($1)`, [site])).toEqual([])
      await c.query(`update public.obs_archive_switch set disarm_reason = '4' where site_id = $1`, [site])
      expect(await escalar<string[]>(c, `select public.obs_archive_vermelhos_automatico($1)`, [site])).toEqual(['saida_automatico_desligou:serie:4'])
      expect(await escalar<string[]>(c, `select public.obs_archive_vermelhos($1)`, [site])).toContain('saida_automatico_desligou:serie:4')
      await c.query(`update public.obs_archive_switch set disarm_reason = 'manual' where site_id = $1`, [site])
      expect(await escalar<string[]>(c, `select public.obs_archive_vermelhos_automatico($1)`, [site])).toEqual([])
      await c.query(`update public.obs_archive_switch set disarm_reason = '4' where site_id = $1`, [site])
      await relogio(c, '2027-05-06 12:00:00+00')
      expect(await escalar<string[]>(c, `select public.obs_archive_vermelhos_automatico($1)`, [site])).toEqual([])
    })
  })

  it('candidatos: por tabela, o mês mais antigo com linha ainda online, na ordem mês/tabela; tabela com mês destacado não tem candidato', async () => {
    await emTransacao(async () => {
      const { site } = await pronto()
      await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, rows_total, sealed_at) values ($1, 'serie', $2, '2026-09-01', 10, now()), ($1, 'serie', $2, '2026-10-01', 10, now())`, [site, D])
      expect(await escalar<unknown>(c, `select public.obs_archive_exit_candidates($1)`, [site])).toEqual([{ classe: 'serie', tabela: D, mes: '2026-09-01', descartes: 3 }])
      await c.query(`update public.obs_archive_months set detached_at = now() where site_id = $1 and month = '2026-09-01'`, [site])
      expect(await escalar<unknown>(c, `select public.obs_archive_exit_candidates($1)`, [site])).toEqual([])
    })
  })

  it('I-2: classe que já teve saída automática no dia de SP corrente não tem candidato (uma por classe por dia); no dia seguinte volta', async () => {
    await emTransacao(async () => {
      const { site } = await pronto()
      await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, rows_total, sealed_at) values ($1, 'serie', $2, '2026-09-01', 10, now())`, [site, D])
      await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, drop_mode, rows_dropped) values ($1, 'serie', 'competitor_video_early', '2026-04-01', public.obs_archive_agora(), 'automatico', 1)`, [site])
      expect(await escalar<unknown[]>(c, `select public.obs_archive_exit_candidates($1)`, [site])).toEqual([])
      await relogio(c, '2027-05-03 12:00:00+00')
      expect(await escalar<unknown[]>(c, `select public.obs_archive_exit_candidates($1)`, [site])).toHaveLength(1)
    })
  })

  it('next_exit usa obs_archive_pode_sair_em: o primeiro dia em que algum mês online pode sair, com o piso do registro', async () => {
    await emTransacao(async () => {
      const { site } = await pronto()
      await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, rows_total, sealed_at) values ($1, 'serie', $2, '2026-10-01', 10, now())`, [site, D])
      expect(await escalar<string | null>(c, `select min(public.obs_archive_pode_sair_em(m.month, p.window_months))::text from public.obs_archive_months m join public.obs_archive_policy() p on p.class = m.class and p.table_name = m.table_name where m.site_id = $1 and m.dropped_at is null and m.class = 'serie' and p.table_name = $2`, [site, D])).toBe('2027-05-01')
      expect(await escalar<string | null>(c, `select public.obs_archive_next_exit()::text`)).not.toBeNull()
    })
  })
})
```

(O motivo 3b da tela é o 3 do banco com `detalhe.b2 = true`; a tela escolhe a frase 3b por esse detalhe, Tarefa 12c.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/manutencao-m6-interruptor.test.ts > /tmp/m6-t7b.log 2>&1; grep -E "FAIL|Tests |does not exist" /tmp/m6-t7b.log | head`
Expected: FAIL (`function public.obs_archive_switch_arm(...) does not exist`).

- [ ] **Step 3: O SQL (PARTE 7 do rascunho)**

```sql
create or replace function public.obs_archive_switch_state(p_site uuid, p_class text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.obs_archive_switch; k jsonb := public.obs_archive_switch_counts(p_site, p_class); v_agora timestamptz := public.obs_archive_agora(); base jsonb;
begin
  if p_class not in ('horaria', 'serie') then return jsonb_build_object('estado', 'nao_existe'); end if;
  select * into s from public.obs_archive_switch x where x.site_id = p_site and x.class = p_class;
  base := k || jsonb_build_object('simulacao_depois', s.disarmed_at is not null and s.last_sim_at > s.disarmed_at);
  if s.armed_at is not null and s.disarmed_at is null and s.expires_at > v_agora then
    return base || jsonb_build_object('estado', 'ligado', 'armado_ate', s.expires_at);
  end if;
  if s.disarmed_at is not null and s.disarm_reason = '8' then
    return base || jsonb_build_object('estado', 'venceu', 'desligado_em', s.disarmed_at, 'motivo', '8', 'visto', s.disarm_seen_at is not null);
  end if;
  if s.disarmed_at is not null and s.disarm_reason <> 'manual' then
    return base || jsonb_build_object('estado', 'desligou_sozinho', 'desligado_em', s.disarmed_at, 'motivo', s.disarm_reason,
                                      'mes', s.disarm_month, 'detalhe', s.disarm_detail, 'visto', s.disarm_seen_at is not null);
  end if;
  if (k->>'descartes')::int < 3 or (k->>'simulacoes')::int < 2 then return base || jsonb_build_object('estado', 'nao_pode'); end if;
  return base || jsonb_build_object('estado', 'desligado', 'desligado_em', s.disarmed_at);
end $$;
revoke all on function public.obs_archive_switch_state(uuid, text) from public, anon, authenticated;
grant execute on function public.obs_archive_switch_state(uuid, text) to service_role;

create or replace function public.obs_archive_switch_arm(p_site uuid, p_class text, p_by uuid, p_frase_confirmada boolean, p_env_on boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare s public.obs_archive_switch; k jsonb; v_agora timestamptz := public.obs_archive_agora();
begin
  if p_class not in ('horaria', 'serie') then return jsonb_build_object('status', 'recusado', 'codigo', 'classe_sem_automatico'); end if;
  if p_by is null or not public.obs_archive_is_site_admin(p_site, p_by) then return jsonb_build_object('status', 'recusado', 'codigo', 'sem_direito'); end if;
  if not coalesce(p_env_on, false) then return jsonb_build_object('status', 'recusado', 'codigo', 'variavel_desligada'); end if;
  k := public.obs_archive_switch_counts(p_site, p_class);
  if (k->>'descartes')::int < 3 then return jsonb_build_object('status', 'recusado', 'codigo', 'saidas_insuficientes') || k; end if;
  if (k->>'simulacoes')::int < 2 then return jsonb_build_object('status', 'recusado', 'codigo', 'simulacoes_insuficientes') || k; end if;
  select * into s from public.obs_archive_switch x where x.site_id = p_site and x.class = p_class for update;
  if s.disarmed_at is not null and s.disarm_reason <> 'manual' and (s.last_sim_at is null or s.last_sim_at <= s.disarmed_at) then
    return jsonb_build_object('status', 'recusado', 'codigo', 'simulacao_depois_do_desligamento');
  end if;
  if not coalesce(p_frase_confirmada, false) then return jsonb_build_object('status', 'recusado', 'codigo', 'frase_nao_confere'); end if;
  update public.obs_archive_switch set armed_by = p_by, armed_at = v_agora, expires_at = v_agora + interval '90 days',
         disarmed_at = null, disarm_reason = null, disarm_month = null, disarm_detail = null, disarm_seen_at = null, refusals_nas = 0, refusals_b2 = 0
   where site_id = p_site and class = p_class;
  return jsonb_build_object('status', 'ok', 'armado_ate', v_agora + interval '90 days');
end $$;
revoke all on function public.obs_archive_switch_arm(uuid, text, uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_switch_arm(uuid, text, uuid, boolean, boolean) to service_role;

create or replace function public.obs_archive_switch_disarm(p_site uuid, p_class text, p_reason text, p_month date, p_detail jsonb, p_by uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_reason = 'manual' and (p_by is null or not public.obs_archive_is_site_admin(p_site, p_by)) then
    return jsonb_build_object('status', 'recusado', 'codigo', 'sem_direito');
  end if;
  update public.obs_archive_switch set disarmed_at = public.obs_archive_agora(), disarm_reason = p_reason, disarm_month = p_month,
         disarm_detail = p_detail, disarm_seen_at = case when p_reason = 'manual' then public.obs_archive_agora() end
   where site_id = p_site and class = p_class and armed_at is not null and disarmed_at is null;
  return jsonb_build_object('status', 'ok', 'desligou', found);
end $$;
revoke all on function public.obs_archive_switch_disarm(uuid, text, text, date, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_switch_disarm(uuid, text, text, date, jsonb, uuid) to service_role;

create or replace function public.obs_archive_switch_seen(p_site uuid, p_class text, p_by uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_by is null or not public.obs_archive_is_site_admin(p_site, p_by) then return jsonb_build_object('status', 'recusado', 'codigo', 'sem_direito'); end if;
  update public.obs_archive_switch set disarm_seen_at = public.obs_archive_agora() where site_id = p_site and class = p_class and disarmed_at is not null;
  return jsonb_build_object('status', 'ok');
end $$;
revoke all on function public.obs_archive_switch_seen(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_switch_seen(uuid, text, uuid) to service_role;


-- O vigia (03 §12.4): roda no começo de cada execução da tarefa e a cada medida do sinal. Na dúvida, desliga.
create or replace function public.obs_archive_switch_watch(p_site uuid, p_sinal text, p_env_on boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare s record; v_motivo text; v_mes date; v_agora timestamptz := public.obs_archive_agora(); v_h timestamptz; v_out jsonb := '[]'::jsonb; n integer;
begin
  for s in select * from public.obs_archive_switch x where x.site_id = p_site and x.armed_at is not null and x.disarmed_at is null order by x.class loop
    v_motivo := null; v_mes := null;
    if s.expires_at <= v_agora then v_motivo := '8';
    elsif not coalesce(p_env_on, false) then v_motivo := '9';
    elsif p_sinal = 'vermelho' then v_motivo := '5';
    elsif p_sinal is null or p_sinal not in ('verde', 'amarelo') then v_motivo := '6';
    else
      select min(u.month) into v_mes from public.obs_archive_units u
       where u.site_id = p_site and u.class = s.class and u.nas_withdrawn_at is not null and u.superseded_at is null and u.lost_at is null
         and (u.nas_withdrawn_reason in ('divergente', 'conteudo_divergente')
              or (u.nas_withdrawn_reason = 'ausente' and exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = s.class
                                                                    and m.month = u.month and m.dropped_at is not null)));
      if v_mes is not null then v_motivo := '1'; end if;
      if v_motivo is null then
        select h.last_poll_at into v_h from public.obs_archive_heartbeat h where h.site_id = p_site and h.worker = 'copiador';
        if v_h is null or v_h < v_agora - interval '36 hours' then v_motivo := '2'; end if;
      end if;
      if v_motivo is null and coalesce((public.obs_archive_atraso(p_site)->>'vermelhos')::int, 0) > 0 then v_motivo := '4'; end if;
      if v_motivo is null then
        -- Decisão 9: mais de um drop automático da classe no MESMO dia de São Paulo (a tarefa faz no máximo um por classe por dia: mais de um é defeito).
        select count(*) into n from public.obs_archive_months m where m.site_id = p_site and m.class = s.class and m.drop_mode = 'automatico'
           and (m.dropped_at at time zone 'America/Sao_Paulo')::date = public.obs_archive_hoje_sp();
        if n > 1 then v_motivo := '7'; end if;
      end if;
      if v_motivo is null then
        select min(m.month) into v_mes from public.obs_archive_months m where m.site_id = p_site and m.class = s.class and m.b2_withdrawn_at is not null;
        if v_mes is not null then v_motivo := '10'; end if;
      end if;
      if v_motivo is null then
        select min(m.month) into v_mes from public.obs_archive_months m where m.site_id = p_site and m.class = s.class and m.b2_forja_diverged_at is not null;
        if v_mes is not null then v_motivo := '13'; end if;
      end if;
    end if;
    if v_motivo is not null then
      perform public.obs_archive_switch_disarm(p_site, s.class, v_motivo, v_mes, null, null);
      v_out := v_out || jsonb_build_array(jsonb_build_object('classe', s.class, 'motivo', v_motivo));
    end if;
  end loop;
  return jsonb_build_object('desligou', v_out);
end $$;
revoke all on function public.obs_archive_switch_watch(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_switch_watch(uuid, text, boolean) to service_role;


-- Depois de uma recusa do automático (chamada por obs_archive_after_auto, Tarefa 5).
create or replace function public.obs_archive_switch_after_refusal(p_site uuid, p_class text, p_month date, p_resp jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_cods text[]; v_b2 jsonb; s public.obs_archive_switch;
begin
  select coalesce(array_agg(x->>'codigo'), '{}') into v_cods from jsonb_array_elements(coalesce(p_resp->'faltam', '[]'::jsonb)) x;
  if p_resp ? 'codigo' then v_cods := v_cods || (p_resp->>'codigo'); end if;
  if v_cods <@ array['ainda_na_janela', 'ocupado', 'dois_passos_obrigatorios', 'ja_destacado', 'ja_descartado'] then return; end if;
  select * into s from public.obs_archive_switch x where x.site_id = p_site and x.class = p_class for update;
  if s.armed_at is null or s.disarmed_at is not null then return; end if;
  select x into v_b2 from jsonb_array_elements(coalesce(p_resp->'faltam', '[]'::jsonb)) x where x->>'codigo' = 'b2_sem_atestacao' limit 1;
  if v_b2->>'motivo' = 'retirada' then
    perform public.obs_archive_switch_disarm(p_site, p_class, '10', p_month, v_b2, null); return;
  end if;
  if v_cods = array['nas_sem_atestacao'] then
    if s.refusals_nas >= 1 then perform public.obs_archive_switch_disarm(p_site, p_class, '3', p_month, jsonb_build_object('nas', true), null);
    else update public.obs_archive_switch set refusals_nas = refusals_nas + 1 where site_id = p_site and class = p_class; end if;
    return;
  end if;
  if v_cods = array['b2_sem_atestacao'] then
    if s.refusals_b2 >= 1 then perform public.obs_archive_switch_disarm(p_site, p_class, '3', p_month, jsonb_build_object('b2', true), null);
    else update public.obs_archive_switch set refusals_b2 = refusals_b2 + 1 where site_id = p_site and class = p_class; end if;
    return;
  end if;
  perform public.obs_archive_switch_disarm(p_site, p_class, '11', p_month, p_resp, null);
end $$;
revoke all on function public.obs_archive_switch_after_refusal(uuid, text, date, jsonb) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_exit_candidates(p_site uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('classe', x.class, 'tabela', x.table_name, 'mes', x.month,
           'descartes', (select count(*) from public.obs_archive_months d where d.site_id = p_site and d.class = x.class and d.table_name = x.table_name
                           and d.dropped_at is not null and coalesce(d.rows_dropped, 0) > 0)::int) order by x.month, x.table_name), '[]'::jsonb)
    from (select distinct on (m.class, m.table_name) m.class, m.table_name, m.month
            from public.obs_archive_months m join public.obs_archive_policy() p on p.class = m.class and p.table_name = m.table_name
           where m.site_id = p_site and p.exit_mode = 'particao' and m.class in ('horaria', 'serie') and coalesce(m.rows_total, 0) > 0
             and m.dropped_at is null
             and not exists (select 1 from public.obs_archive_months d where d.site_id = p_site and d.class = m.class and d.table_name = m.table_name
                               and d.detached_at is not null and d.dropped_at is null)
             and m.detached_at is null
             -- I-2: uma saída automática por classe por dia de SP (a tarefa tenta uma por rodada; o candidato some no dia em que a classe já saiu)
             and not exists (select 1 from public.obs_archive_months d where d.site_id = p_site and d.class = m.class and d.drop_mode = 'automatico'
                               and (d.dropped_at at time zone 'America/Sao_Paulo')::date = public.obs_archive_hoje_sp())
           order by m.class, m.table_name, m.month) x
$$;
revoke all on function public.obs_archive_exit_candidates(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_exit_candidates(uuid) to service_role;

create or replace function public.obs_archive_switch_armed_sites() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct s.site_id order by s.site_id), '{}'::uuid[]) from public.obs_archive_switch s where s.armed_at is not null and s.disarmed_at is null
$$;
revoke all on function public.obs_archive_switch_armed_sites() from public, anon, authenticated;
grant execute on function public.obs_archive_switch_armed_sites() to service_role;

-- O vermelho do desarme (M6b): o automático desligou sozinho nas últimas 72 h por qualquer motivo que não seja validade (8), variável (9) ou o clique (manual).
create or replace function public.obs_archive_vermelhos_automatico(p_site uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare v text[] := '{}'; i record;
begin
  for i in select s.class, s.disarm_reason from public.obs_archive_switch s
            where s.site_id = p_site and s.disarmed_at > public.obs_archive_agora() - interval '72 hours' and s.disarm_reason not in ('8', '9', 'manual')
            order by s.class loop
    v := v || ('saida_automatico_desligou:' || i.class || ':' || i.disarm_reason);
  end loop;
  return v;
end $$;
revoke all on function public.obs_archive_vermelhos_automatico(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_vermelhos_automatico(uuid) to service_role;

-- O primeiro dia em que algum mês ainda online de classe que sai pode sair (a mesma data do portão: obs_archive_pode_sair_em, com o piso do registro; M7 Phil).
create or replace function public.obs_archive_next_exit() returns date
language sql stable security definer set search_path = '' as $$
  select min(public.obs_archive_pode_sair_em(m.month, p.window_months))
    from public.obs_archive_months m join public.obs_archive_policy() p on p.class = m.class and p.table_name = m.table_name
   where p.exit_mode = 'particao' and m.class <> 'ensaio' and coalesce(m.rows_total, 0) > 0 and m.detached_at is null and m.dropped_at is null
$$;
revoke all on function public.obs_archive_next_exit() from public, anon, authenticated;
grant execute on function public.obs_archive_next_exit() to service_role;
```

- [ ] **Step 4: Rodar e ver passar**

Run: o comando do Step 2 e de novo `manutencao-m6-saida-estado.test.ts` (o `obs_archive_vermelhos` agora inclui o desarme).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/integration/manutencao-m6-interruptor.test.ts
git commit -m "feat: M6b parte 7: o interruptor do automático (ligar, vigia, desligar sozinho), candidatos de saída e o vermelho do desarme

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m6.sql apps/web/test/integration/manutencao-m6-interruptor.test.ts supabase/rascunhos/m6-desfazer.sql
```

---

### Task 8 [M6b]: A tarefa diária `saida_automatica`

**Files:**
- Modify: `apps/web/src/lib/youtube/agenda/definicoes.ts` (só a constante `DEFINICAO_SAIDA_AUTOMATICA`, exportada; **não** entra em `DEFINICOES_MANUTENCAO` neste primeiro commit)
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/ligado.ts` (`autoDropLigado`, puro: m-9; a tarefa e a ação da Tarefa 11b importam daqui, nenhuma importa da outra)
- Create: `apps/web/src/lib/youtube/agenda/tarefas/saida-automatica.ts`
- Create: `apps/web/test/youtube/agenda/saida-automatica.test.ts`
- Segundo commit (só depois do passo 3 do LEIAME da Tarefa 14b): Modify `definicoes.ts` e `catalogo.ts` (duas linhas: registrar a definição em `DEFINICOES_MANUTENCAO` e a tarefa no `CATALOGO`) e Create `apps/web/test/youtube/agenda/saida-automatica-catalogo.test.ts` (I-3: o registro e o teste do catálogo vão no MESMO commit; antes disso, uma tarefa registrada com a migration não aplicada ficaria `erro funcao_ausente` todo dia)

**Interfaces:**
- Consumes: Tarefa 7b (`obs_archive_switch_armed_sites`, `obs_archive_switch_watch`, `obs_archive_switch_state`, `obs_archive_exit_candidates`), Tarefa 3 (`obs_archive_precheck_channels` com `p_only_stale`, `obs_archive_precheck_unit`), `obs_archive_exit_check`, Tarefa 5 (`obs_archive_drop_month`); `lerSinalDoBanco` (`observatorio/arquivo/ler-sinal.ts`); `DEFINICOES_MANUTENCAO` (M2).
- Produces: `DEFINICAO_SAIDA_AUTOMATICA: Definicao` (nome `'saida_automatica'`, ordem 11); `saidaAutomatica: Tarefa`; `autoDropLigado(env?: NodeJS.ProcessEnv): boolean` (em `arquivo-mensal/ligado.ts`; só `'on'` liga); `DROP_MS = 8_500`. **No máximo UMA tentativa de saída por classe por rodada** (I-2): o candidato `daily` e o `early` da mesma classe não saem os dois no mesmo disparo; o banco também recusa pelo dia de SP (`exit_candidates`, motivo 7).

- [ ] **Step 1: Os testes (falham: o módulo não existe)**

```ts
// apps/web/test/youtube/agenda/saida-automatica.test.ts
// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { saidaAutomatica, DROP_MS } from '@/lib/youtube/agenda/tarefas/saida-automatica'
import { autoDropLigado } from '@/lib/youtube/observatorio/arquivo-mensal/ligado'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'

vi.mock('@/lib/youtube/observatorio/arquivo/ler-sinal', () => ({ lerSinalDoBanco: vi.fn(async () => ({ valor: { cor: 'verde' } })) }))

type Resp = { data: unknown; error: { code?: string; message?: string } | null }
const SITE = '00000000-0000-0000-0000-00000000a3b0'
const CAND = [{ classe: 'serie', tabela: 'competitor_video_daily', mes: '2026-10-01', descartes: 3 }]
function ctx(respostas: Record<string, Resp | Resp[] | 'lanca'>): { c: ContextoTarefa; chamadas: Array<{ fn: string; args: Record<string, unknown> }> } {
  const chamadas: Array<{ fn: string; args: Record<string, unknown> }> = []
  const sb = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      chamadas.push({ fn, args })
      const r = respostas[fn]
      const um = Array.isArray(r) ? (r.length > 1 ? r.shift()! : r[0]!) : r
      return { abortSignal: () => (um === 'lanca' ? Promise.reject(new Error('rede')) : Promise.resolve(um ?? { data: null, error: { code: '42883' } })) }
    },
  } as unknown as SupabaseClient
  return { c: { t0: 0, agora: () => 0, apiKey: '', sb, linhas: null }, chamadas }
}
const ok = (data: unknown): Resp => ({ data, error: null })
const BASE = {
  obs_archive_switch_armed_sites: ok([SITE]),
  obs_archive_switch_watch: ok({ desligou: [] }),
  obs_archive_switch_state: ok({ estado: 'ligado' }),
  obs_archive_exit_candidates: ok(CAND),
  obs_archive_precheck_channels: ok(['c1', 'c2']),
  obs_archive_precheck_unit: ok({ ok: true }),
}

afterEach(() => { delete process.env.OBS_ARQUIVO_AUTO_DROP })

describe('OBS_ARQUIVO_AUTO_DROP', () => {
  it('sem a variável, desligado; só "on" liga ("1", "true", "ON " não ligam)', () => {
    delete process.env.OBS_ARQUIVO_AUTO_DROP
    expect(autoDropLigado()).toBe(false)
    for (const v of ['1', 'true', 'ON ', 'yes', '']) expect(autoDropLigado({ OBS_ARQUIVO_AUTO_DROP: v } as NodeJS.ProcessEnv), v).toBe(false)
    expect(autoDropLigado({ OBS_ARQUIVO_AUTO_DROP: 'on' } as NodeJS.ProcessEnv)).toBe(true)
  })
  it('45: sem a variável, o vigia roda com env desligado (desarma pelo motivo 9) e nada sai', async () => {
    const { c, chamadas } = ctx(BASE)
    const r = await saidaAutomatica.rodar(c)
    expect(chamadas.find(x => x.fn === 'obs_archive_switch_watch')?.args).toMatchObject({ p_site: SITE, p_env_on: false })
    expect(chamadas.some(x => x.fn === 'obs_archive_drop_month')).toBe(false)
    expect(r).toMatchObject({ estado: 'ok', feitas: 0, detalhe: { variavel_desligada: 1 } })
  })
})

describe('saida_automatica: o que roda', () => {
  it('47: armado e verde: confere canal por canal e tira o mês mais antigo em um passo, modo automatico, sem p_by', async () => {
    process.env.OBS_ARQUIVO_AUTO_DROP = 'on'
    const { c, chamadas } = ctx({ ...BASE, obs_archive_drop_month: ok({ status: 'ok', linhas: 10, bytes: 2048 }) })
    const r = await saidaAutomatica.rodar(c)
    expect(chamadas.find(x => x.fn === 'obs_archive_precheck_channels')?.args).toMatchObject({ p_only_stale: true })   // Phil M5: só os canais sem conferência fresca
    expect(chamadas.filter(x => x.fn === 'obs_archive_precheck_unit').map(x => x.args.p_channel)).toEqual(['c1', 'c2'])
    expect(chamadas.find(x => x.fn === 'obs_archive_drop_month')?.args).toEqual({ p_site: SITE, p_table: 'competitor_video_daily', p_month: '2026-10-01', p_by: null, p_mode: 'automatico', p_dry_run: false })
    expect(r).toMatchObject({ estado: 'ok', feitas: 1, detalhe: { meses: 1, bytes: 2048 } })
  })
  it('tabela com menos de 3 descartes é pulada (o drop recusaria); classe desligada não tem candidato', async () => {
    process.env.OBS_ARQUIVO_AUTO_DROP = 'on'
    const { c, chamadas } = ctx({ ...BASE, obs_archive_exit_candidates: ok([{ ...CAND[0], descartes: 2 }, { classe: 'horaria', tabela: 'competitor_video_hourly', mes: '2026-12-01', descartes: 5 }]),
      obs_archive_switch_state: [ok({ estado: 'ligado' }), ok({ estado: 'desligado' })] })
    const r = await saidaAutomatica.rodar(c)
    expect(chamadas.some(x => x.fn === 'obs_archive_drop_month')).toBe(false)
    expect(r).toMatchObject({ estado: 'ok', feitas: 0 })
  })
  it('conferência por canal que não bate: não chama o drop (o portão recalcularia e desselaria; quem dessela é o clique ou a próxima volta)', async () => {
    process.env.OBS_ARQUIVO_AUTO_DROP = 'on'
    const { c, chamadas } = ctx({ ...BASE, obs_archive_precheck_unit: [ok({ ok: true }), ok({ ok: false, codigo: 'conteudo_mudou' })] })
    const r = await saidaAutomatica.rodar(c)
    expect(chamadas.some(x => x.fn === 'obs_archive_drop_month')).toBe(true)   // o drop é quem decide e desarma (motivo 11) com a recusa
    expect(r.estado).toBe('ok')
  })
  it('ocupado: parcial (tenta de novo no próximo disparo)', async () => {
    process.env.OBS_ARQUIVO_AUTO_DROP = 'on'
    const { c } = ctx({ ...BASE, obs_archive_drop_month: ok({ status: 'recusado', codigo: 'ocupado' }) })
    expect(await saidaAutomatica.rodar(c)).toMatchObject({ estado: 'parcial', motivo: 'ocupado' })
  })
  it('recusa do portão: ok com a contagem (o banco já desarmou o interruptor); nunca erro', async () => {
    process.env.OBS_ARQUIVO_AUTO_DROP = 'on'
    const { c } = ctx({ ...BASE, obs_archive_drop_month: ok({ status: 'recusado', faltam: [{ codigo: 'nas_sem_atestacao', horas: 30 }] }) })
    expect(await saidaAutomatica.rodar(c)).toMatchObject({ estado: 'ok', feitas: 0, detalhe: { recusados: 1 } })
  })
  it('118: o dado não existe ou vem torto: função ausente, prazo, resposta fora da forma e exceção são erro, nunca ok', async () => {
    process.env.OBS_ARQUIVO_AUTO_DROP = 'on'
    const casos: Array<[Record<string, Resp | Resp[] | 'lanca'>, string]> = [
      [{ ...BASE, obs_archive_switch_armed_sites: { data: null, error: { code: '42883', message: 'function does not exist' } } }, 'funcao_ausente'],
      [{ ...BASE, obs_archive_switch_armed_sites: { data: null, error: { message: 'AbortError: aborted' } } }, 'prazo'],
      [{ ...BASE, obs_archive_switch_armed_sites: ok(null) }, 'resposta_invalida'],
      [{ ...BASE, obs_archive_exit_candidates: ok([{ classe: 'serie' }]) }, 'resposta_invalida'],
      [{ ...BASE, obs_archive_drop_month: ok({ estado: 'ok' }) }, 'resposta_invalida'],
      [{ ...BASE, obs_archive_switch_watch: 'lanca' }, 'inesperado'],
    ]
    for (const [r, motivo] of casos) {
      const { c } = ctx(r)
      expect(await saidaAutomatica.rodar(c), motivo).toMatchObject({ estado: 'erro', motivo })
    }
  })
  it('nenhum site armado: ok sem chamar mais nada', async () => {
    process.env.OBS_ARQUIVO_AUTO_DROP = 'on'
    const { c, chamadas } = ctx({ ...BASE, obs_archive_switch_armed_sites: ok([]) })
    expect(await saidaAutomatica.rodar(c)).toMatchObject({ estado: 'ok', feitas: 0 })
    expect(chamadas.map(x => x.fn)).toEqual(['obs_archive_switch_armed_sites'])
  })
  it('I-2: candidatos daily e early da MESMA classe, os dois com 3 descartes: um único drop na rodada (o segundo espera o dia seguinte)', async () => {
    process.env.OBS_ARQUIVO_AUTO_DROP = 'on'
    const { c, chamadas } = ctx({ ...BASE, obs_archive_exit_candidates: ok([CAND[0], { classe: 'serie', tabela: 'competitor_video_early', mes: '2026-09-01', descartes: 4 }]),
      obs_archive_drop_month: ok({ status: 'ok', linhas: 10, bytes: 2048 }) })
    const r = await saidaAutomatica.rodar(c)
    expect(chamadas.filter(x => x.fn === 'obs_archive_drop_month')).toHaveLength(1)
    expect(r).toMatchObject({ estado: 'ok', feitas: 1 })
  })
  it('candidato com menos de 3 descartes não gasta a tentativa da classe: o seguinte, com 3, sai', async () => {
    process.env.OBS_ARQUIVO_AUTO_DROP = 'on'
    const { c, chamadas } = ctx({ ...BASE, obs_archive_exit_candidates: ok([{ ...CAND[0], descartes: 2 }, { classe: 'serie', tabela: 'competitor_video_early', mes: '2026-09-01', descartes: 3 }]),
      obs_archive_drop_month: ok({ status: 'ok', linhas: 10, bytes: 2048 }) })
    await saidaAutomatica.rodar(c)
    expect(chamadas.filter(x => x.fn === 'obs_archive_drop_month').map(x => x.args.p_table)).toEqual(['competitor_video_early'])
  })
  it('prazo no drop: relê o estado do mês antes de gravar erro; destacado ou descartado = saiu, senão parcial prazo', async () => {
    process.env.OBS_ARQUIVO_AUTO_DROP = 'on'
    const saiu = ctx({ ...BASE, obs_archive_drop_month: { data: null, error: { message: 'AbortError: aborted' } }, obs_archive_exit_check: ok({ estado: 'descartado' }) })
    expect(await saidaAutomatica.rodar(saiu.c)).toMatchObject({ estado: 'ok', feitas: 1 })
    const nao = ctx({ ...BASE, obs_archive_drop_month: { data: null, error: { message: 'AbortError: aborted' } }, obs_archive_exit_check: ok({ estado: 'online' }) })
    expect(await saidaAutomatica.rodar(nao.c)).toMatchObject({ estado: 'parcial', motivo: 'prazo' })
  })
  it('sem tempo: não começa candidato depois de fimAteMs − (DROP_MS + 5 s); parcial sem_tempo', async () => {
    process.env.OBS_ARQUIVO_AUTO_DROP = 'on'
    const { c } = ctx({ ...BASE, obs_archive_drop_month: ok({ status: 'ok', linhas: 1, bytes: 1 }) })
    const tarde = { ...c, agora: () => 85_000 - DROP_MS - 4_000 }
    expect(await saidaAutomatica.rodar(tarde)).toMatchObject({ estado: 'parcial', motivo: 'sem_tempo' })
  })
  it('sinal com ciclo nao_medido (leitura das saídas falhou) vai ao vigia como nao_medido, mesmo com a cor verde', async () => {
    process.env.OBS_ARQUIVO_AUTO_DROP = 'on'
    const { lerSinalDoBanco } = await import('@/lib/youtube/observatorio/arquivo/ler-sinal')
    vi.mocked(lerSinalDoBanco).mockResolvedValueOnce({ valor: { cor: 'verde', ciclo: 'nao_medido' } } as never)
    const { c, chamadas } = ctx(BASE)
    await saidaAutomatica.rodar(c)
    expect(chamadas.find(x => x.fn === 'obs_archive_switch_watch')?.args).toMatchObject({ p_sinal: 'nao_medido' })
  })
  it('sinal não lido vai ao vigia como nao_medido (desarma pelo motivo 6)', async () => {
    process.env.OBS_ARQUIVO_AUTO_DROP = 'on'
    const { lerSinalDoBanco } = await import('@/lib/youtube/observatorio/arquivo/ler-sinal')
    vi.mocked(lerSinalDoBanco).mockResolvedValueOnce({ porque: 'prazo' })
    const { c, chamadas } = ctx(BASE)
    await saidaAutomatica.rodar(c)
    expect(chamadas.find(x => x.fn === 'obs_archive_switch_watch')?.args).toMatchObject({ p_sinal: 'nao_medido' })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/agenda/saida-automatica.test.ts > /tmp/m6-t8.log 2>&1; grep -E "FAIL|Tests |Cannot find" /tmp/m6-t8.log | head`
Expected: FAIL (`Cannot find module '@/lib/youtube/agenda/tarefas/saida-automatica'`).

- [ ] **Step 3: A definição e a tarefa**

Em `definicoes.ts`, depois de `DEFINICAO_PARTICOES_A_FRENTE` (M2):

```ts
/** M6: a saída automática. Só age com o interruptor armado pelo dono e `OBS_ARQUIVO_AUTO_DROP=on`; antes de tudo roda o vigia, que desliga na dúvida. */
export const DEFINICAO_SAIDA_AUTOMATICA: Definicao = {
  nome: 'saida_automatica', rotulo: 'saída automática', ordem: 11, peso: 'leve', periodo: 'dia', aPartirDaHoraSP: 6,
  tetoTentativas: 12, toleranciaVigiaH: 36, naoTerminouVermelhoEm: null,
  comecaAteMs: LEVE_COMECA_ATE_MS, fimAteMs: 85_000,
  motivos: {
    funcao_ausente: 'as funções da saída não existem no banco (migration da M6 não aplicada)',
    prazo: 'o banco não respondeu a tempo',
    resposta_invalida: 'resposta do banco fora da forma esperada',
    ocupado: 'a coleta estava gravando; a saída tenta de novo no próximo disparo',
    sem_tempo: 'o tempo do disparo acabou antes de todos os meses',
    inesperado: 'a saída automática falhou com erro inesperado (ver Sentry)',
  },
}
```

A constante só é exportada neste passo; o registro em `DEFINICOES_MANUTENCAO` (`[DEFINICAO_PARTICOES_A_FRENTE, DEFINICAO_SAIDA_AUTOMATICA]`) e em `catalogo.ts` (re-exportar, importar `saidaAutomatica` de `./tarefas/saida-automatica` e acrescentá-la ao fim de `CATALOGO`) é o segundo commit do Step 5. A tarefa **não** entra em `antesDoLoteAntigo` (com a agenda desligada, nada sai sozinho).

```ts
// apps/web/src/lib/youtube/agenda/tarefas/saida-automatica.ts
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { CODIGOS_SCHEMA_AUSENTE } from '@/lib/youtube/coleta/schema'
import { lerSinalDoBanco } from '@/lib/youtube/observatorio/arquivo/ler-sinal'
import { autoDropLigado } from '../../observatorio/arquivo-mensal/ligado'
import { DEFINICAO_SAIDA_AUTOMATICA } from '../definicoes'
import { BANCO_MS } from '../relogio'
import type { ContextoTarefa, ResultadoTarefa, Tarefa } from '../tipos'

/** Teto de cada chamada de drop e de conferência por canal, do lado do cliente (8,5 s). O `statement_timeout` do papel `service_role` e o tempo real da função vêm da medida da Tarefa 6; este número é o orçamento da tarefa, não um limite do PostgREST. */
export const DROP_MS = 8_500
const FOLGA_MS = 5_000

class Falha extends Error { constructor(readonly motivo: 'funcao_ausente' | 'prazo' | 'resposta_invalida') { super(motivo) } }

const Uuids = z.array(z.string().uuid())
const Candidatos = z.array(z.object({ classe: z.enum(['horaria', 'serie']), tabela: z.string().min(1), mes: z.string().regex(/^\d{4}-\d{2}-01$/), descartes: z.number().int().min(0) }))
const Estado = z.object({ estado: z.string() }).passthrough()
const Canais = z.array(z.string().uuid())
const Conferencia = z.object({ ok: z.boolean(), codigo: z.string().optional() })
const Saida = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), linhas: z.number(), bytes: z.number() }).passthrough(),
  z.object({ status: z.literal('recusado'), codigo: z.string().optional(), faltam: z.array(z.object({ codigo: z.string() }).passthrough()).optional() }).passthrough(),
])

async function rpc<T>(c: ContextoTarefa, fn: string, args: Record<string, unknown>, forma: z.ZodType<T>, ms: number = BANCO_MS): Promise<T> {
  const { data, error } = await c.sb.rpc(fn, args).abortSignal(AbortSignal.timeout(ms))
  if (error) {
    if (/abort/i.test(String(error.message ?? ''))) throw new Falha('prazo')
    throw new Falha(CODIGOS_SCHEMA_AUSENTE.includes(String(error.code ?? '')) ? 'funcao_ausente' : 'resposta_invalida')
  }
  const p = forma.safeParse(data)
  if (!p.success) throw new Falha('resposta_invalida')
  return p.data
}

async function rodar(c: ContextoTarefa): Promise<ResultadoTarefa> {
  const ligado = autoDropLigado()
  let meses = 0, bytes = 0, recusados = 0, ocupado = false, semTempo = false
  try {
    const sites = await rpc(c, 'obs_archive_switch_armed_sites', {}, Uuids)
    if (sites.length === 0) return { estado: 'ok', feitas: 0, deixadas: 0 }
    const lido = await lerSinalDoBanco(c.sb, c.agora())
    const sinal = 'valor' in lido && lido.valor.cor && lido.valor.ciclo !== 'nao_medido' ? lido.valor.cor : 'nao_medido'   // I4: ciclo não medido = motivo 6
    for (const site of sites) {
      const tentouClasse = new Set<string>()   // I-2: no máximo uma tentativa de saída por classe por rodada
      await rpc(c, 'obs_archive_switch_watch', { p_site: site, p_sinal: sinal, p_env_on: ligado }, z.object({ desligou: z.array(z.unknown()) }))
      if (!ligado) continue
      const candidatos = await rpc(c, 'obs_archive_exit_candidates', { p_site: site }, Candidatos)
      const ligadas = new Map<string, boolean>()
      for (const k of candidatos) {
        if (!ligadas.has(k.classe)) ligadas.set(k.classe, (await rpc(c, 'obs_archive_switch_state', { p_site: site, p_class: k.classe }, Estado)).estado === 'ligado')
        if (!ligadas.get(k.classe) || k.descartes < 3 || tentouClasse.has(k.classe)) continue   // menos de 3 descartes: pula SEM gastar a tentativa da classe
        if (c.agora() - c.t0 > DEFINICAO_SAIDA_AUTOMATICA.fimAteMs - DROP_MS - FOLGA_MS) { semTempo = true; break }
        tentouClasse.add(k.classe)
        const canais = await rpc(c, 'obs_archive_precheck_channels', { p_site: site, p_table: k.tabela, p_month: k.mes, p_only_stale: true }, Canais)
        for (const canal of canais) {
          if (c.agora() - c.t0 > DEFINICAO_SAIDA_AUTOMATICA.fimAteMs - DROP_MS - FOLGA_MS) { semTempo = true; break }
          await rpc(c, 'obs_archive_precheck_unit', { p_site: site, p_table: k.tabela, p_month: k.mes, p_channel: canal }, Conferencia, DROP_MS)
        }
        if (semTempo) break
        let r: z.infer<typeof Saida>
        try {
          r = await rpc(c, 'obs_archive_drop_month', { p_site: site, p_table: k.tabela, p_month: k.mes, p_by: null, p_mode: 'automatico', p_dry_run: false }, Saida, DROP_MS)
        } catch (e) {
          // O cliente desistiu, mas o banco pode ter terminado: relê o estado do mês antes de gravar erro (destacado ou descartado = saiu).
          if (!(e instanceof Falha) || e.motivo !== 'prazo') throw e
          const est = await rpc(c, 'obs_archive_exit_check', { p_site: site, p_table: k.tabela, p_month: k.mes, p_by: null }, Estado).catch(() => null)
          if (est && (est.estado === 'destacado' || est.estado === 'descartado')) { meses++; continue }
          return { estado: 'parcial', feitas: meses, deixadas: null, motivo: 'prazo', detalhe: { meses, bytes, recusados } }
        }
        if (r.status === 'ok') { meses++; bytes += r.bytes }
        else if (r.codigo === 'ocupado') ocupado = true
        else recusados++
      }
      if (semTempo) break
    }
  } catch (err) {
    if (err instanceof Falha) return { estado: 'erro', feitas: meses, deixadas: null, motivo: err.motivo }
    Sentry.captureException(err, { tags: { component: 'agenda', tarefa: 'saida_automatica' } })
    return { estado: 'erro', feitas: meses, deixadas: null, motivo: 'inesperado' }
  }
  const detalhe: Record<string, number> = { meses, bytes, recusados }
  if (!ligado) detalhe.variavel_desligada = 1
  if (semTempo) return { estado: 'parcial', feitas: meses, deixadas: null, motivo: 'sem_tempo', detalhe }
  if (ocupado) return { estado: 'parcial', feitas: meses, deixadas: null, motivo: 'ocupado', detalhe }
  return { estado: 'ok', feitas: meses, deixadas: 0, detalhe }
}

export const saidaAutomatica: Tarefa = { ...DEFINICAO_SAIDA_AUTOMATICA, rodar }
```

(O teste de "nenhum site armado" exige que o sinal não seja lido antes de haver site: a ordem acima já faz isso. O teste "conferência que não bate" fixa que a tarefa não decide pela conferência: quem decide é o portão dentro do `drop`, que recalcula por não ter conferência fresca daquele canal e recusa; a recusa desarma pelo motivo 11.)

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run test/youtube/agenda/ > /tmp/m6-t8.log 2>&1; grep -E "FAIL|Tests " /tmp/m6-t8.log` e `npm run typecheck -w apps/web > /tmp/m6-tc.log 2>&1; tail -5 /tmp/m6-tc.log`
Expected: PASS e typecheck limpo. O teste de catálogo da M2 (`TODAS_AS_DEFINICOES.length`) continua valendo porque a definição entra em `DEFINICOES_MANUTENCAO`.

- [ ] **Step 5: Commit (em dois tempos: I-3)**

Primeiro commit: o módulo, a constante da definição, `ligado.ts` e o teste da tarefa; **sem** registrar no catálogo (a tarefa ainda não roda em lugar nenhum). Pode ir já.

```bash
git add apps/web/src/lib/youtube/observatorio/arquivo-mensal/ligado.ts apps/web/src/lib/youtube/agenda/tarefas/saida-automatica.ts apps/web/test/youtube/agenda/saida-automatica.test.ts
git commit -m "feat: M6b: tarefa diária saida_automatica (vigia, conferência por canal e saída em um passo só com o interruptor armado), ainda fora do catálogo

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/ligado.ts apps/web/src/lib/youtube/agenda/definicoes.ts apps/web/src/lib/youtube/agenda/tarefas/saida-automatica.ts apps/web/test/youtube/agenda/saida-automatica.test.ts
```

Segundo commit, **só depois do passo 3 do LEIAME da Tarefa 14b** (a migration da PARTE 7 aplicada em produção): duas linhas em `definicoes.ts` (`DEFINICOES_MANUTENCAO: readonly Definicao[] = [DEFINICAO_PARTICOES_A_FRENTE, DEFINICAO_SAIDA_AUTOMATICA]`) e duas em `catalogo.ts` (re-exportar a definição e acrescentar `saidaAutomatica` ao fim de `CATALOGO`), com o teste do catálogo no MESMO commit:

```ts
// apps/web/test/youtube/agenda/saida-automatica-catalogo.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { CATALOGO } from '@/lib/youtube/agenda/catalogo'
import { TODAS_AS_DEFINICOES } from '@/lib/youtube/agenda/definicoes'

describe('saida_automatica no catálogo', () => {
  it('ordem 11, leve, dia, a partir das 06:00 de SP, nunca termina depois de 85 s', () => {
    expect(CATALOGO.map(t => t.nome)).toContain('saida_automatica')
    expect(TODAS_AS_DEFINICOES.find(d => d.nome === 'saida_automatica')).toMatchObject({ ordem: 11, peso: 'leve', periodo: 'dia', aPartirDaHoraSP: 6, fimAteMs: 85_000 })
    expect(new Set(TODAS_AS_DEFINICOES.map(d => d.ordem)).size).toBe(TODAS_AS_DEFINICOES.length)
  })
})
```

```bash
git add apps/web/test/youtube/agenda/saida-automatica-catalogo.test.ts
git commit -m "feat: M6b: registrar saida_automatica no catálogo da agenda (a migration da PARTE 7 já está em produção)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/agenda/definicoes.ts apps/web/src/lib/youtube/agenda/catalogo.ts apps/web/test/youtube/agenda/saida-automatica-catalogo.test.ts
```

(O teste de catálogo da M2 que conta `TODAS_AS_DEFINICOES` acompanha no mesmo commit.)

---

### Task 9 [M6a]: O rodízio de reconferência dos meses descartados (item 116)

Não há código novo: o plano de releitura (`obs_archive_plan`, `reconferir`), a contagem de "sem releitura" (`obs_archive_descartados_sem_releitura`) e o vermelho de 45 dias são da M3b. Esta tarefa prova, com os meses descartados de verdade pela M6, que o rodízio os cobre. O caso em que a releitura divergente desarma o automático (arm e watch) é da **Tarefa 9b [M6b]**.

**Files:**
- Modify: `apps/web/test/helpers/m6.ts` (acrescenta `vinteQuatroDescartados(c, dias)`, usada por esta tarefa e pela 9b)
- Create: `apps/web/test/integration/manutencao-m6-rodizio.test.ts`

**Interfaces:**
- Consumes: M3b `obs_archive_plan(uuid, boolean, text)`, `obs_archive_descartados_sem_releitura(uuid, integer)`, `obs_archive_vermelhos(uuid)`; Tarefas 5 e 7a. **Sem** chamar nenhuma função `obs_archive_switch_*` além das da PARTE 6 (se um caso precisar de desarme direto, guardar com `to_regprocedure('public.obs_archive_switch_disarm(uuid,text,text,date,jsonb,uuid)')`: na M6a ela não existe).
- Produces: nada (só teste e o helper).

- [ ] **Step 1: O helper e o teste**

Acrescentar ao fim de `apps/web/test/helpers/m6.ts` (importa `Client`, `semearCanal`, `semearDiaria` que o helper já usa):

```ts
/** 24 meses selados e descartados (registro direto: o descarte de verdade está provado na Tarefa 5), cada um com a unidade relida há `dias`. */
export async function vinteQuatroDescartados(c: Client, dias: number): Promise<{ site: string; admin: string; canal: string }> {
  await relogio(c, '2027-05-02 12:00:00+00')
  await liberarClasses(c, ['serie'])
  const s = await semearCanal(c, { videos: 1 })
  for (let i = 0; i < 24; i++) {
    const mes = `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`
    await c.query(`select obs_part.criar_particao('public.competitor_video_daily'::regclass, $1)`, [mes])
    await semearDiaria(c, s.videos, mes, 2)
    await selarMes(c, { site: s.site, classe: 'serie', tabela: 'competitor_video_daily', mes })
    await c.query(`update public.obs_archive_months set detached_at = now() - interval '60 days', dropped_at = now() - interval '50 days', rows_dropped = 2 where site_id = $1 and month = $2`, [s.site, mes])
  }
  await c.query(`update public.obs_archive_units set received_at = now() - interval '70 days', nas_reported_at = now() - make_interval(days => $2) where site_id = $1`, [s.site, dias])
  return { site: s.site, canal: s.canal, admin: await novoAdmin(c, s.site) }
}
```

```ts
// apps/web/test/integration/manutencao-m6-rodizio.test.ts
// @vitest-environment node
/** M6, item 116 (plano M6, Tarefa 9): mês descartado continua sendo relido em rodízio; a falta e a diferença desarmam. begin … rollback. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar } from '../helpers/m3b'
import { prepararM6, vinteQuatroDescartados } from '../helpers/m6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('M6 item 116: o rodízio dos meses descartados', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try { await prepararM6(c, 6); await f() } finally { await c.query('rollback') }
  }

  const reconferir = async (site: string): Promise<string[]> =>
    (await escalar<{ reconferir: Array<{ mes: string }> }>(c, `select public.obs_archive_plan($1, false, null)`, [site])).reconferir.map(r => r.mes)

  it('relido há 13 dias: nenhum mês descartado no plano; há 15: os 24 entram (o rodízio cobre todos em 14 dias)', async () => {
    await emTransacao(async () => {
      const { site } = await vinteQuatroDescartados(c, 13)
      expect((await reconferir(site)).filter(m => m < '2026-01')).toEqual([])
      await c.query(`update public.obs_archive_units set nas_reported_at = now() - interval '15 days' where site_id = $1`, [site])
      expect(new Set((await reconferir(site)).filter(m => m < '2026-01')).size).toBe(24)
    })
  })

  it('sem releitura: 21 dias não conta, 22 é amarelo; 45 não é vermelho, 46 é', async () => {
    await emTransacao(async () => {
      const { site } = await vinteQuatroDescartados(c, 21)
      expect(await escalar<number>(c, `select public.obs_archive_descartados_sem_releitura($1, 21)`, [site])).toBe(0)
      await c.query(`update public.obs_archive_units set nas_reported_at = now() - interval '22 days' where site_id = $1`, [site])
      expect(await escalar<number>(c, `select public.obs_archive_descartados_sem_releitura($1, 21)`, [site])).toBe(24)
      await c.query(`update public.obs_archive_units set nas_reported_at = now() - interval '45 days' + interval '1 hour' where site_id = $1`, [site])
      expect((await escalar<string[]>(c, `select public.obs_archive_vermelhos($1)`, [site])).some(v => v.startsWith('mês descartado sem releitura'))).toBe(false)
      await c.query(`update public.obs_archive_units set nas_reported_at = now() - interval '46 days' where site_id = $1`, [site])
      expect((await escalar<string[]>(c, `select public.obs_archive_vermelhos($1)`, [site])).some(v => v.startsWith('mês descartado sem releitura'))).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Rodar**

Run: `HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/manutencao-m6-rodizio.test.ts > /tmp/m6-t9.log 2>&1; grep -E "FAIL|Tests |AssertionError" /tmp/m6-t9.log | head`
Expected: PASS nos dois casos. Se o plano não listar os descartados (o `reconferir` depende de `obs_archive_month_files` enxergar a unidade com `received_at`), a fixture está incompleta: conferir em `m3b.sql` o que `obs_archive_month_files` exige e acrescentar ao `update` da fixture. O comportamento da M3b não muda nesta etapa; se ela de fato não cobrir mês descartado, é defeito da M3b: parar e avisar o controlador.

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/integration/manutencao-m6-rodizio.test.ts
git commit -m "test: M6a item 116: o rodízio relê os meses descartados em 14 dias

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/test/helpers/m6.ts apps/web/test/integration/manutencao-m6-rodizio.test.ts
```

---

### Task 9b [M6b]: A releitura divergente desarma o automático (item 116, parte do interruptor)

**Files:**
- Create: `apps/web/test/integration/manutencao-m6-rodizio-vigia.test.ts`

**Interfaces:**
- Consumes: Tarefa 7b (`obs_archive_switch_arm`, `obs_archive_switch_watch`), `vinteQuatroDescartados` (Tarefa 9), M3b `obs_archive_vermelhos`.
- Produces: nada (só teste).

- [ ] **Step 1: O teste**

```ts
// apps/web/test/integration/manutencao-m6-rodizio-vigia.test.ts
// @vitest-environment node
/** M6b, item 116 (plano M6, Tarefa 9b): arquivo de mês descartado ausente ou diferente na releitura: vermelho e o vigia desliga (motivo 1). begin … rollback. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { escalar } from '../helpers/m3b'
import { prepararM6, vinteQuatroDescartados } from '../helpers/m6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('M6b item 116: a releitura divergente desliga o automático', () => {
  let c: Client
  beforeAll(async () => { c = new Client({ connectionString: PG_URL }); await c.connect() })
  afterAll(async () => { await c?.end() })
  async function emTransacao(f: () => Promise<void>): Promise<void> {
    await c.query('begin'); await c.query('select pg_advisory_xact_lock(7339001)')
    try { await prepararM6(c, 7); await f() } finally { await c.query('rollback') }
  }

  it('arquivo de mês descartado ausente ou diferente na releitura: vermelho e o automático desliga pelo motivo 1 no mesmo vigia', async () => {
    for (const razao of ['ausente', 'divergente']) {
      await emTransacao(async () => {
        const { site, admin } = await vinteQuatroDescartados(c, 2)
        for (let i = 0; i < 2; i++) await c.query(`select public.obs_archive_switch_sim_seen($1, 'serie', $2)`, [site, admin])
        await c.query(`insert into public.obs_archive_heartbeat (site_id, worker, last_poll_at) values ($1, 'copiador', public.obs_archive_agora()) on conflict (site_id, worker) do update set last_poll_at = excluded.last_poll_at`, [site])
        expect(await escalar<{ status: string }>(c, `select public.obs_archive_switch_arm($1, 'serie', $2, true, true)`, [site, admin])).toMatchObject({ status: 'ok' })
        await c.query(`update public.obs_archive_units set nas_withdrawn_at = now(), nas_withdrawn_reason = $2 where site_id = $1 and month = '2024-03-01'`, [site, razao])
        expect((await escalar<string[]>(c, `select public.obs_archive_vermelhos($1)`, [site])).some(v => v.startsWith('NAS:'))).toBe(true)
        expect(await escalar<{ desligou: unknown[] }>(c, `select public.obs_archive_switch_watch($1, 'verde', true)`, [site])).toEqual({ desligou: [{ classe: 'serie', motivo: '1' }] })
      })
    }
  })
})
```

- [ ] **Step 2: Rodar**

Run: `HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/manutencao-m6-rodizio-vigia.test.ts > /tmp/m6-t9b.log 2>&1; grep -E "FAIL|Tests |AssertionError" /tmp/m6-t9b.log | head`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/integration/manutencao-m6-rodizio-vigia.test.ts
git commit -m "test: M6b item 116: a releitura divergente de mês descartado desliga o automático pelo motivo 1

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/test/integration/manutencao-m6-rodizio-vigia.test.ts
```

---

### Task 10 [M6b]: O sinal sem serrote (item 48)

**Gatilho:** em produção antes de **01/02/2027** (Hanna: a primeira saída do banco real é por volta de abril/2027 e o sinal precisa estar medindo o ciclo antes disso).

**Files:**
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo/sinal-do-banco.ts` (argumento opcional `saidas`, a soma de volta e os dois prazos)
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo/ler-sinal.ts` (lê as saídas)
- Create: `apps/web/test/youtube/observatorio/sinal-sem-serrote.test.ts`

**Interfaces:**
- Consumes: `obs_archive_months.dropped_at`, `bytes_freed` (Tarefa 5); `obs_archive_next_exit()` (Tarefa 7b, PARTE 7).
- Produces:
  - `export interface SaidaMedida { dia: string; bytes: number; em?: number }` (`dia` de SP, `AAAA-MM-DD`; `em` = instante do descarte em ms). **M7 Phil:** os `bytes` só voltam à medida de um dia cuja medição (`measured_at`) é POSTERIOR ao descarte (`em <= Date.parse(medidoEm)`); sem `em`, vale o dia (`s.n <= v.n`). A medição das 08:05Z de um dia em que o descarte foi às 10:00Z ainda não viu a queda.
  - `sinalDoBanco(linhas, agoraMs, regras = RULES.dbSize, saidas: readonly SaidaMedida[] = [], proximaSaidaEm: string | null = null, saidasLidas = true)`: sem saídas, idêntico a hoje; o quinto argumento vem de `obs_archive_next_exit` (combinado com a E10, pedido 4 da seção 17); `saidasLidas = false` (a leitura de `obs_archive_months` falhou) dá `ciclo: 'nao_medido'`, nunca o sinal sem serrote dado como medido (I4).
  - `SinalDoBanco.ciclo: CicloDoBanco | 'nao_medido' | null` com `interface CicloDoBanco { brutoMbPorDia: number; maiorMb: number; proximaSaidaEm: string | null; diasAte85: number | null; diasAteProximoMes: number | null }`; `null` sem saída na janela (leitura boa); `'nao_medido'` quando a leitura das saídas falhou. A tarefa `saida_automatica` (Tarefa 8) manda `p_sinal = 'nao_medido'` ao vigia nesse caso (motivo 6); a M5 trata `ciclo === 'nao_medido'` na tela (pedido em `pedidos-m6-para-m5.md`).
  - `lerSinalDoBanco(sb, agoraMs)` passa a ler `obs_archive_months` (`dropped_at`, `bytes_freed`, dos últimos 28 dias) e a função `obs_archive_next_exit()`. **Se a leitura das saídas falhar** (`error` da resposta, que o supabase-js NÃO lança, ou exceção), `ciclo = 'nao_medido'`: o sinal da reta simples é mais OTIMISTA que o real (a reta com serrote subestima o crescimento bruto), então devolvê-lo como se fosse medido seria dizer "verde" a mais (I4).
  - `public.obs_archive_next_exit() returns date` está na PARTE 7 (Tarefa 7b) e usa `obs_archive_pode_sair_em` (M7 Phil): o primeiro dia em que algum mês ainda online de classe que sai pode sair, entre todos os sites. Nulo quando nenhum.

- [ ] **Step 1: Os testes (falham)**

```ts
// apps/web/test/youtube/observatorio/sinal-sem-serrote.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { sinalDoBanco, type CicloDoBanco, type LinhaBruta } from '@/lib/youtube/observatorio/arquivo/sinal-do-banco'

const MB = 1024 * 1024
const AGORA = Date.parse('2027-03-01T12:00:00-03:00')
/** 28 dias terminando em 01/03/2027: cresce 2 MB/dia a partir de 300 MB, e uma saída de 40 MB em 15/02 (o serrote). */
function serie(comSaida: boolean): LinhaBruta[] {
  const linhas: LinhaBruta[] = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date(Date.parse('2027-03-01T12:00:00Z') - i * 86_400_000).toISOString().slice(0, 10)
    const n = 27 - i
    const db = (300 + 2 * n - (comSaida && d >= '2027-02-15' ? 40 : 0)) * MB
    linhas.push({ day: d, db_bytes: db, competitor_bytes: db * 0.6, own_bytes: db * 0.1, measured_at: `${d}T08:05:00Z` })
  }
  return linhas
}

describe('sinal sem serrote', () => {
  it('sem saídas: idêntico ao de hoje (e ciclo nulo)', () => {
    const a = sinalDoBanco(serie(false), AGORA)
    const b = sinalDoBanco(serie(false), AGORA, undefined, [])
    expect(b).toEqual({ ...a, ciclo: null })
  })
  it('com a saída somada de volta, a inclinação bruta é 2 MB/dia (a reta simples mentiria menos)', () => {
    const simples = sinalDoBanco(serie(true), AGORA)
    const s = sinalDoBanco(serie(true), AGORA, undefined, [{ dia: '2027-02-15', bytes: 40 * MB }], '2027-04-01')
    expect(simples.projecao.estado === 'medida' ? simples.projecao.mbPorDia : 0).toBeLessThan(1.5)
    expect((s.ciclo as CicloDoBanco).brutoMbPorDia).toBeCloseTo(2, 5)
  })
  it('o maior tamanho do ciclo é hoje + bruto × dias até a próxima saída possível, e é ele que decide a cor', () => {
    const s = sinalDoBanco(serie(true), AGORA, undefined, [{ dia: '2027-02-15', bytes: 40 * MB }], '2027-04-01')
    const hojeMb = 300 + 2 * 27 - 40
    expect((s.ciclo as CicloDoBanco).maiorMb).toBeCloseTo(hojeMb + 2 * 31, 0)
    expect((s.ciclo as CicloDoBanco).proximaSaidaEm).toBe('2027-04-01')
  })
  it('dois prazos: até 85% e até a próxima saída; o primeiro menor que o segundo é vermelho', () => {
    // 85% de 500 = 425 MB; hoje 314 MB; 2 MB/dia → 56 dias. Próxima saída em 90 dias → vermelho.
    const longe = sinalDoBanco(serie(true), AGORA, undefined, [{ dia: '2027-02-15', bytes: 40 * MB }], '2027-05-30')
    expect(longe.ciclo).toMatchObject({ diasAte85: 56, diasAteProximoMes: 90 })
    expect(longe.cor).toBe('vermelho')
    const perto = sinalDoBanco(serie(true), AGORA, undefined, [{ dia: '2027-02-15', bytes: 40 * MB }], '2027-03-10')
    expect(perto.ciclo).toMatchObject({ diasAteProximoMes: 9 })
    expect(perto.cor).not.toBe('vermelho')
  })
  it('o dado não existe: saída fora da janela de 28 dias não entra; próxima saída desconhecida não inventa prazo', () => {
    const s = sinalDoBanco(serie(false), AGORA, undefined, [{ dia: '2026-12-01', bytes: 40 * MB }])
    expect(s.ciclo).toBeNull()
    const t = sinalDoBanco(serie(true), AGORA, undefined, [{ dia: '2027-02-15', bytes: 40 * MB }], null)
    expect(t.ciclo).toMatchObject({ proximaSaidaEm: null, diasAteProximoMes: null })
  })
  it('M7 Phil: medição ANTES do descarte no mesmo dia não recebe os bytes de volta; a do dia seguinte recebe', () => {
    const linhas = serie(true)
    const dia15 = linhas.find(l => l.day === '2027-02-15')!
    dia15.db_bytes = (300 + 2 * 21) * MB                       // a medição das 08:05Z do dia 15 ainda não viu a queda de 40 MB
    dia15.competitor_bytes = dia15.db_bytes! * 0.6; dia15.own_bytes = dia15.db_bytes! * 0.1
    const s = sinalDoBanco(linhas, AGORA, undefined, [{ dia: '2027-02-15', bytes: 40 * MB, em: Date.parse('2027-02-15T10:00:00Z') }], '2027-04-01')
    expect(s.ciclo).not.toBe('nao_medido')
    expect((s.ciclo as { brutoMbPorDia: number }).brutoMbPorDia).toBeCloseTo(2, 5)
  })
  it('I4: leitura das saídas que falhou dá ciclo nao_medido; nunca o sinal sem serrote como se fosse medido', () => {
    const s = sinalDoBanco(serie(true), AGORA, undefined, [], null, false)
    expect(s.ciclo).toBe('nao_medido')
    expect(sinalDoBanco(serie(false), AGORA, undefined, [], null, true).ciclo).toBeNull()
  })
  it('saída com bytes negativos, nulos ou dia inválido é ignorada (conta como ilegível, não zera nada)', () => {
    const s = sinalDoBanco(serie(true), AGORA, undefined, [{ dia: 'x', bytes: 1 }, { dia: '2027-02-15', bytes: -5 }], '2027-04-01')
    expect(s.ciclo).toBeNull()
  })
})
```

(Assinatura final, a mesma do bloco **Interfaces**: `sinalDoBanco(linhas, agoraMs, regras = RULES.dbSize, saidas: readonly SaidaMedida[] = [], proximaSaidaEm: string | null = null)`.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/sinal-sem-serrote.test.ts > /tmp/m6-t10.log 2>&1; grep -E "FAIL|Tests " /tmp/m6-t10.log`
Expected: FAIL (`ciclo` indefinido).

- [ ] **Step 3: A implementação**

Em `sinal-do-banco.ts`:

```ts
export interface SaidaMedida { dia: string; bytes: number }
export interface CicloDoBanco { brutoMbPorDia: number; maiorMb: number; proximaSaidaEm: string | null; diasAte85: number | null; diasAteProximoMes: number | null }
// SinalDoBanco ganha:  ciclo: CicloDoBanco | 'nao_medido' | null

/** Item 48 (03 §12.5): soma de volta, a cada dia, os bytes liberados pelas saídas da janela até aquele dia; a inclinação é o crescimento bruto. */
function ciclo(validas: readonly Valida[], ref: Valida, regras: typeof RULES.dbSize, saidas: readonly SaidaMedida[], proxima: string | null, lidas: boolean): CicloDoBanco | 'nao_medido' | null {
  if (!lidas) return 'nao_medido'
  const janela = validas.filter(v => v.n <= ref.n && ref.n - v.n <= regras.trendWindowDays - 1).sort((a, b) => a.n - b.n)
  const boas = saidas.flatMap(s => {
    const n = numeroDoDia(s.dia)
    return n !== null && Number.isFinite(s.bytes) && s.bytes > 0 && n <= ref.n && ref.n - n <= regras.trendWindowDays - 1 ? [{ n, bytes: s.bytes, em: s.em }] : []
  })
  if (boas.length === 0 || janela.length < regras.trendMinDays) return null
  const x = janela.map(v => v.n - janela[0]!.n)
  // M7 Phil: só soma de volta o que a medição daquele dia já enxergava (medida DEPOIS do descarte); sem `em`, vale o dia.
  const y = janela.map(v => (v.db + boas.filter(s => (s.em !== undefined ? s.em <= Date.parse(v.medidoEm) : s.n <= v.n)).reduce((t, s) => t + s.bytes, 0)) / MB)
  const bruto = inclinacao(x, y)
  const hojeMb = ref.db / MB
  const nProx = proxima === null ? null : numeroDoDia(proxima)
  const diasAteProximoMes = nProx === null ? null : Math.max(0, nProx - ref.n)
  const maiorMb = arred1(hojeMb + Math.max(0, bruto) * (diasAteProximoMes ?? regras.trendWindowDays))
  const alvo = (regras.limitMb * regras.redPct) / 100
  const diasAte85 = bruto > INCLINACAO_MIN ? Math.max(0, Math.round((alvo - hojeMb) / bruto)) : null
  return { brutoMbPorDia: bruto, maiorMb, proximaSaidaEm: proxima, diasAte85, diasAteProximoMes }
}
```

e, em `sinalDoBanco`, depois de `const a = avaliar(...)`:

```ts
  const cic = ciclo(validas, hoje ?? ultimaLinha, regras, saidas, proximaSaidaEm, saidasLidas)
  // A cor do ciclo: o maior tamanho decide; o alívio que não chega a tempo é vermelho. Só piora a cor da reta simples, nunca a melhora para verde.
  if (cic !== null && cic !== 'nao_medido') {
    const pctMaior = Math.round((cic.maiorMb * 100) / regras.limitMb)
    const corCiclo: CorDoBanco = (cic.diasAte85 !== null && cic.diasAteProximoMes !== null && cic.diasAte85 < cic.diasAteProximoMes) || pctMaior >= regras.redPct
      ? 'vermelho' : pctMaior >= regras.yellowPct ? 'amarelo' : 'verde'
    const ordem: Record<CorDoBanco, number> = { verde: 0, amarelo: 1, vermelho: 2 }
    if (ordem[corCiclo] > ordem[a.cor]) a.cor = corCiclo
  }
```

`ciclo: cic` entra nos três `return` com linha medida e `ciclo: null` no de `ultimaLinha === null`. (`Avaliacao.cor` deixa de ser `readonly` na prática: o objeto é local; se o lint reclamar, criar `const cor = ...` e usar no retorno.) A frase da tela continua a de hoje; a frase do ciclo ("o mais que o banco chega a ocupar antes da próxima saída") é da M5 (peça do sinal), que lê `ciclo`.

Em `ler-sinal.ts`, depois de ler `obs_db_size_daily`:

```ts
async function lerSaidas(sb: SupabaseClient, agoraMs: number): Promise<{ lidas: boolean; saidas: SaidaMedida[]; proxima: string | null }> {
  try {
    const desde = new Date(agoraMs - 29 * 86_400_000).toISOString()
    const [m, p] = await Promise.all([
      sb.from('obs_archive_months').select('dropped_at, bytes_freed').gte('dropped_at', desde).abortSignal(AbortSignal.timeout(TETO_LEITURA_MS)),
      sb.rpc('obs_archive_next_exit').abortSignal(AbortSignal.timeout(TETO_LEITURA_MS)),
    ])
    // O supabase-js NÃO lança em erro de banco: devolve `{ data: null, error }`. Sem checar `error`, a falha viraria "sem saídas" e o sinal ficaria otimista.
    if (m.error || p.error || !Array.isArray(m.data)) return { lidas: false, saidas: [], proxima: null }
    const saidas = m.data.flatMap((r: { dropped_at?: unknown; bytes_freed?: unknown }) =>
      typeof r.dropped_at === 'string' && typeof r.bytes_freed === 'number' && Number.isFinite(Date.parse(r.dropped_at))
        ? [{ dia: new Date(Date.parse(r.dropped_at) - 3 * 3_600_000).toISOString().slice(0, 10), bytes: r.bytes_freed, em: Date.parse(r.dropped_at) }] : [])
    return { lidas: true, saidas, proxima: typeof p.data === 'string' ? p.data : null }
  } catch {
    return { lidas: false, saidas: [], proxima: null }
  }
}
```

e `return { valor: sinalDoBanco(res.data.map(linhaBruta), agoraMs, undefined, s.saidas, s.proxima, s.lidas) }` com `const s = await lerSaidas(sb, agoraMs)`. Os testes existentes de `ler-sinal` usam um `sb` falso só com `from('obs_db_size_daily')`: o `lerSaidas` cai no `catch` e o resultado passa a ser `ciclo: 'nao_medido'` (a cor da reta simples não muda); **atualizar esses testes no mesmo commit** para afirmar a cor e aceitar `ciclo: 'nao_medido'`.

Teste novo em `apps/web/test/youtube/observatorio/ler-sinal-saidas.test.ts`: um `sb` falso cujo `from('obs_archive_months')` devolve `{ data: null, error: { message: 'x' } }` (resposta de erro, não exceção) e cujo `rpc` devolve `{ data: '2027-04-01', error: null }` ⇒ `valor.ciclo === 'nao_medido'`; com `data: []` ⇒ `ciclo === null`; com uma linha `{ dropped_at, bytes_freed }` válida ⇒ `ciclo` objeto.

O SQL de `obs_archive_next_exit()` está na PARTE 7 (Tarefa 7b), com `obs_archive_pode_sair_em`. A leitura da tabela `obs_archive_months` pelo `service_role` usa o grant que a M3b dá ao papel; se a M3b só deu via funções, trocar o `from(...)` por uma função `obs_archive_recent_exits(p_days int)` na PARTE 7 e no `m6-desfazer.sql`, no mesmo padrão.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/ > /tmp/m6-t10.log 2>&1; grep -E "FAIL|Tests " /tmp/m6-t10.log` e o typecheck.
Expected: PASS em todos os testes do sinal (os antigos sem mudança).

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/youtube/observatorio/sinal-sem-serrote.test.ts apps/web/test/youtube/observatorio/ler-sinal-saidas.test.ts
git commit -m "feat: M6: sinal do banco sem serrote (bytes liberados somados de volta, maior tamanho do ciclo e os dois prazos)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/observatorio/arquivo/sinal-do-banco.ts apps/web/src/lib/youtube/observatorio/arquivo/ler-sinal.ts apps/web/test/youtube/observatorio/sinal-sem-serrote.test.ts apps/web/test/youtube/observatorio/ler-sinal-saidas.test.ts
```

---
### Task 11 [M6a]: O caminho do site até as funções (`saida.ts`) e as ações do botão

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/saida.ts` (`import 'server-only'`)
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes.ts` (`'use server'`)
- Create: `apps/web/test/youtube/observatorio/arquivo-saida-acoes.test.ts`

**Espera:** as Tarefas 3 a 6 e a 7a (as funções do banco e os contadores). O interruptor completo (`ligarAutomatico` e as outras três ações) é da **Tarefa 11b [M6b]**; `encerrarDadoDeTeste` entra na Tarefa 13b.

**Interfaces:**
- Consumes: Tarefas 3-6 e 7a (as funções do banco); `denyUnlessSiteAdmin`, `requireSiteAdminScope`, `siteAdminOnlyMessage` (`@/lib/cms/auth-guards`); `getSiteContext` (`@/lib/cms/site-context`); `getSupabaseServiceClient` (`@/lib/supabase/service`).
- Produces:
  - Em `saida.ts`: `type RespostaSaida = { tipo: 'ok'; linhas: number; bytes: number | null; conteudoMudou?: boolean; voltaForaDeOrdem?: boolean; protecaoFaltam?: string[] } | { tipo: 'simulado'; linhas: number; bytes: number | null; canais: number; fracao: number; canalSemUnidade: boolean } | { tipo: 'recusado'; codigo: string | null; faltam: Falta[]; liberarAPartir?: string; descartadoEm?: string } | { tipo: 'falhou'; causa: 'somente_leitura' | 'prazo' | 'forma' | 'banco' }`; `type Falta = { codigo: string } & Record<string, unknown>`; funções `conferirCanais(sb, site, tabela, mes): Promise<{ ok: number; falhou: number } | { causa: 'prazo' | 'forma' | 'banco' }>` (em paralelo, limite 4, `p_only_stale: true`), `executarSaida(sb, { site, tabela, mes, por, simular, doisPassos }): Promise<RespostaSaida>` (chama `detach` com `doisPassos`, senão `drop`; `doisPassos` vem de `exit_check.dois_passos`), `executarLiberar(sb, {...})`, `executarTrazer(sb, {...})`, `lerEstadoDoMes(sb, site, tabela, mes, por): Promise<EstadoDoMes | null>` (lê `obs_archive_exit_check`), `lerInterruptor(sb, site, classe): Promise<EstadoInterruptor | null>` (**M6a: só os contadores**, via `obs_archive_switch_counts`: `nao_existe`, `nao_pode` com `descartes` e `simulacoes`, ou `null`; o estado completo vem na 11b), `lerEmTransito(sb, site): Promise<MesEmTransito[] | null>`.
  - Em `acoes.ts` (todas devolvem `{ ok: boolean; error?: string; resposta?: RespostaSaida }`; nenhuma devolve código do banco em `error`): `simularSaida(tabela, mes)`, `tirarMes(tabela, mes)`, `liberarEspaco(tabela, mes)`, `trazerDeVolta(tabela, mes)`. `simularSaida` chama `obs_archive_switch_sim_seen` quando a resposta é `simulado` e a classe não é `ensaio`.
  - m-8: `tirarMes` num mês cujo `exit_check.estado` já é `destacado` (ou `descartado`) devolve `{ ok: true, resposta: { tipo: 'recusado', codigo: 'ja_destacado' | 'ja_descartado', faltam: [] } }`; a frase "Este mês já saiu das telas." é da Tarefa 12, não um erro de leitura.

**O que acontece quando o dado não existe:** `exit_check` nulo, função ausente ou resposta fora da forma: a ação devolve `{ ok: false, error: 'Não foi possível ler o estado deste mês. Nada foi tirado.' }`; nunca "pode sair". Sem resposta do `drop`/`detach` no prazo: "Não foi possível confirmar se o mês saiu. Recarregue a página antes de tentar de novo." (o banco decide sozinho; a página relê).

- [ ] **Step 1: Os testes (falham)**

```ts
// apps/web/test/youtube/observatorio/arquivo-saida-acoes.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
const admin = { ok: true as boolean }
vi.mock('@/lib/cms/auth-guards', () => ({
  denyUnlessSiteAdmin: async (_s: string, acao: string) => (admin.ok ? null : { ok: false, error: `Só quem administra o site pode ${acao}.` }),
  requireSiteAdminScope: async () => (admin.ok ? { ok: true, user: { id: 'u-admin' } } : { ok: false, reason: 'insufficient_access' }),
  siteAdminOnlyMessage: (acao: string) => `Só quem administra o site pode ${acao}.`,
}))
type R = { data: unknown; error: { code?: string; message?: string } | null }
let respostas: Record<string, R | R[]> = {}
const chamadas: Array<{ fn: string; args: Record<string, unknown> }> = []
let emVoo = 0, maxEmVoo = 0
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: (fn: string, args: Record<string, unknown>) => {
      chamadas.push({ fn, args })
      const r = respostas[fn]; const um = Array.isArray(r) ? (r.length > 1 ? r.shift()! : r[0]!) : r
      return {
        abortSignal: () => {
          emVoo++; maxEmVoo = Math.max(maxEmVoo, emVoo)
          return new Promise<R>(res => setTimeout(() => { emVoo--; res(um ?? { data: null, error: { code: '42883', message: 'x' } }) }, 2))
        },
      }
    },
  }),
}))
const ok = (data: unknown): R => ({ data, error: null })
const EST_ONLINE = { estado: 'online', faltam: [], descartes: 0, dois_passos: true, particao_ausente: false }

beforeEach(() => { respostas = {}; chamadas.length = 0; emVoo = 0; maxEmVoo = 0; admin.ok = true; delete process.env.OBS_ARQUIVO_AUTO_DROP })

describe('ações da saída', () => {
  it('93: quem não administra recebe a frase e nenhuma função do banco é chamada', async () => {
    admin.ok = false
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    for (const r of [await a.tirarMes('competitor_video_daily', '2026-10-01'), await a.liberarEspaco('competitor_video_daily', '2026-10-01'),
                     await a.trazerDeVolta('competitor_video_daily', '2026-10-01')]) {
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/^Só quem administra o site pode /)
    }
    expect(chamadas).toEqual([])
  })
  it('49: tirar com dois passos: confere canal por canal e chama detach com p_by da sessão (nunca do formulário)', async () => {
    respostas = { obs_archive_exit_check: ok(EST_ONLINE), obs_archive_precheck_channels: ok(['00000000-0000-0000-0000-0000000000c1']),
                  obs_archive_precheck_unit: ok({ ok: true }), obs_archive_detach_month: ok({ status: 'ok', linhas: 120, soma: 9 }) }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    const r = await a.tirarMes('competitor_video_daily', '2026-10-01')
    expect(r).toMatchObject({ ok: true, resposta: { tipo: 'ok', linhas: 120 } })
    expect(chamadas.map(c => c.fn)).toEqual(['obs_archive_exit_check', 'obs_archive_precheck_channels', 'obs_archive_precheck_unit', 'obs_archive_detach_month'])
    expect(chamadas.at(-1)!.args).toEqual({ p_site: 's1', p_table: 'competitor_video_daily', p_month: '2026-10-01', p_by: 'u-admin', p_mode: 'clique', p_dry_run: false })
    expect(chamadas[1]!.args).toMatchObject({ p_only_stale: true })   // Phil M5: só os canais sem conferência fresca
  })
  it('depois de 3 descartes da tabela: tirar chama drop', async () => {
    respostas = { obs_archive_exit_check: ok({ ...EST_ONLINE, descartes: 3, dois_passos: false }), obs_archive_precheck_channels: ok([]),
                  obs_archive_drop_month: ok({ status: 'ok', linhas: 5, bytes: 4096 }) }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toMatchObject({ ok: true, resposta: { tipo: 'ok', bytes: 4096 } })
    expect(chamadas.at(-1)!.fn).toBe('obs_archive_drop_month')
  })
  it('simular: chama com p_dry_run e conta a simulação vista; recusa traz a lista (sem códigos na frase de erro)', async () => {
    respostas = { obs_archive_exit_check: ok(EST_ONLINE), obs_archive_precheck_channels: ok([]),
                  obs_archive_detach_month: ok({ status: 'recusado', faltam: [{ codigo: 'ainda_na_janela', pode_sair_em: '2027-05-01' }] }) }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    const r = await a.simularSaida('competitor_video_daily', '2026-10-01')
    expect(r).toMatchObject({ ok: true, resposta: { tipo: 'recusado', faltam: [{ codigo: 'ainda_na_janela' }] } })
    expect(chamadas.find(c => c.fn === 'obs_archive_detach_month')!.args.p_dry_run).toBe(true)
    expect(chamadas.some(c => c.fn === 'obs_archive_switch_sim_seen')).toBe(false)   // só "simulado" conta
  })
  it('simulação que deu certo conta a vista (classe da tabela)', async () => {
    respostas = { obs_archive_exit_check: ok(EST_ONLINE), obs_archive_precheck_channels: ok([]),
                  obs_archive_detach_month: ok({ status: 'simulado', linhas: 10, soma: 1, canais: 1, fracao_da_classe: 0.38, codigo: null }),
                  obs_archive_switch_sim_seen: ok({ simulacoes: 1 }) }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    await a.simularSaida('competitor_video_daily', '2026-10-01')
    expect(chamadas.find(c => c.fn === 'obs_archive_switch_sim_seen')!.args).toEqual({ p_site: 's1', p_class: 'serie', p_by: 'u-admin' })
  })
  it('T11: banco em modo somente leitura (25006) vira a frase do passo de emergência; o código não aparece', async () => {
    respostas = { obs_archive_exit_check: ok(EST_ONLINE), obs_archive_precheck_channels: ok([]),
                  obs_archive_detach_month: { data: null, error: { code: '25006', message: 'cannot execute in a read-only transaction' } } }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    const r = await a.tirarMes('competitor_video_daily', '2026-10-01')
    expect(r).toEqual({ ok: false, error: 'O banco passou do limite e está em modo somente leitura. Siga o passo de emergência.' })
  })
  it('o dado não existe: exit_check nulo ou fora da forma = não tira e diz que não leu', async () => {
    for (const ec of [ok(null), ok({ estado: 'qualquer' }), { data: null, error: { code: '42883', message: 'x' } }]) {
      respostas = { obs_archive_exit_check: ec }; chamadas.length = 0
      const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
      expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toEqual({ ok: false, error: 'Não foi possível ler o estado deste mês. Nada foi tirado.' })
      expect(chamadas.map(c => c.fn)).toEqual(['obs_archive_exit_check'])
    }
  })
  it('entrada fora da forma (tabela que não sai por partição, mês que não é dia 1) recusa sem chamar o banco', async () => {
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    expect((await a.tirarMes('competitor_video_comments', '2026-10-01')).ok).toBe(false)
    expect((await a.tirarMes('competitor_video_daily', '2026-10-15')).ok).toBe(false)
    expect(chamadas).toEqual([])
  })
  it('m-8: tirar um mês que já está destacado (segundo clique) responde ja_destacado, não "não foi possível ler"', async () => {
    respostas = { obs_archive_exit_check: ok({ ...EST_ONLINE, estado: 'destacado' }) }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes')
    expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toEqual({ ok: true, resposta: { tipo: 'recusado', codigo: 'ja_destacado', faltam: [] } })
    expect(chamadas.map(c => c.fn)).toEqual(['obs_archive_exit_check'])
    respostas = { obs_archive_exit_check: ok({ ...EST_ONLINE, estado: 'descartado' }) }
    expect(await a.tirarMes('competitor_video_daily', '2026-10-01')).toMatchObject({ ok: true, resposta: { tipo: 'recusado', codigo: 'ja_descartado' } })
  })
  it('conferirCanais roda em paralelo, no máximo 4 por vez, e uma falha de leitura interrompe', async () => {
    const canais = Array.from({ length: 10 }, (_, i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, '0')}`)
    respostas = { obs_archive_precheck_channels: ok(canais), obs_archive_precheck_unit: ok({ ok: true }) }
    const { conferirCanais } = await import('@/lib/youtube/observatorio/arquivo-mensal/saida')
    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    expect(await conferirCanais(getSupabaseServiceClient(), 's1', 'competitor_video_daily', '2026-10-01')).toEqual({ ok: 10, falhou: 0 })
    expect(chamadas.filter(c => c.fn === 'obs_archive_precheck_unit')).toHaveLength(10)
    expect(maxEmVoo).toBeGreaterThan(1)
    expect(maxEmVoo).toBeLessThanOrEqual(4)
    respostas = { obs_archive_precheck_channels: ok(canais), obs_archive_precheck_unit: { data: null, error: { code: '42883', message: 'x' } } }
    expect(await conferirCanais(getSupabaseServiceClient(), 's1', 'competitor_video_daily', '2026-10-01')).toEqual({ causa: 'banco' })
  })
  it('contadores da peça 4 na M6a: lerInterruptor devolve nao_existe para classe sem automático e nao_pode com os contadores; falha de leitura = null', async () => {
    const { lerInterruptor } = await import('@/lib/youtube/observatorio/arquivo-mensal/saida')
    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    const sb = getSupabaseServiceClient()
    expect(await lerInterruptor(sb, 's1', 'ensaio' as never)).toEqual({ estado: 'nao_existe' })
    respostas = { obs_archive_switch_counts: ok({ descartes: 2, simulacoes: 1 }) }
    expect(await lerInterruptor(sb, 's1', 'serie')).toEqual({ estado: 'nao_pode', descartes: 2, simulacoes: 1 })
    respostas = { obs_archive_switch_counts: ok({ descartes: 'x' }) }
    expect(await lerInterruptor(sb, 's1', 'serie')).toBeNull()
    respostas = {}
    expect(await lerInterruptor(sb, 's1', 'serie')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/arquivo-saida-acoes.test.ts > /tmp/m6-t11.log 2>&1; grep -E "FAIL|Tests |Cannot find" /tmp/m6-t11.log | head`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: O módulo de servidor**

```ts
// apps/web/src/lib/youtube/observatorio/arquivo-mensal/saida.ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

/** As tabelas que saem por partição e a classe de cada uma (o espelho de obs_archive_policy, exit_mode = 'particao'; o banco confere de novo). */
export const TABELAS_DA_SAIDA = { competitor_video_hourly: 'horaria', competitor_video_daily: 'serie', competitor_video_early: 'serie', obs_archive_rehearsal: 'ensaio' } as const
export type TabelaDaSaida = keyof typeof TABELAS_DA_SAIDA
export const ChamadaSaida = z.object({ tabela: z.enum(Object.keys(TABELAS_DA_SAIDA) as [TabelaDaSaida, ...TabelaDaSaida[]]), mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/) })
export const CHAMADA_MS = 8_500

const Falta = z.object({ codigo: z.string() }).passthrough()
export type Falta = z.infer<typeof Falta>
const Bruta = z.object({
  status: z.enum(['ok', 'simulado', 'recusado']), codigo: z.string().nullable().optional(), faltam: z.array(Falta).optional(),
  linhas: z.coerce.number().optional(), bytes: z.coerce.number().optional(), canais: z.number().optional(), fracao_da_classe: z.coerce.number().optional(),
  conteudo_mudou: z.boolean().optional(), volta_fora_de_ordem: z.boolean().optional(), protecao_faltam: z.array(z.string()).optional(),
  liberar_a_partir: z.string().optional(), descartado_em: z.string().optional(),
})
export type RespostaSaida =
  | { tipo: 'ok'; linhas: number; bytes: number | null; conteudoMudou?: boolean; voltaForaDeOrdem?: boolean; protecaoFaltam?: string[] }
  | { tipo: 'simulado'; linhas: number; bytes: number | null; canais: number; fracao: number; canalSemUnidade: boolean }
  | { tipo: 'recusado'; codigo: string | null; faltam: Falta[]; liberarAPartir?: string; descartadoEm?: string }
  | { tipo: 'falhou'; causa: 'somente_leitura' | 'prazo' | 'forma' | 'banco' }

export const EstadoDoMes = z.object({
  estado: z.enum(['online', 'destacado', 'descartado', 'invalido']), faltam: z.array(Falta), descartes: z.number().int(), dois_passos: z.boolean(),
  particao_ausente: z.boolean().optional(), destacado_em: z.string().optional(), liberar_a_partir: z.string().optional(),
  protecao_faltam: z.array(z.string()).optional(), descartado_em: z.string().optional(), bytes_freed: z.coerce.number().nullable().optional(),
})
export type EstadoDoMes = z.infer<typeof EstadoDoMes>
export const EstadoInterruptor = z.object({
  estado: z.enum(['nao_existe', 'nao_pode', 'desligado', 'ligado', 'desligou_sozinho', 'venceu']),
  armado_ate: z.string().optional(), desligado_em: z.string().nullable().optional(), motivo: z.string().optional(), mes: z.string().nullable().optional(),
  detalhe: z.record(z.unknown()).nullable().optional(), visto: z.boolean().optional(),
  descartes: z.number().int().optional(), simulacoes: z.number().int().optional(), simulacao_depois: z.boolean().optional(),
})
export type EstadoInterruptor = z.infer<typeof EstadoInterruptor>
export const MesEmTransito = z.object({ tabela: z.string(), mes: z.string(), destacado_em: z.string(), liberar_a_partir: z.string() })
export type MesEmTransito = z.infer<typeof MesEmTransito>

type Lido<T> = { valor: T } | { causa: 'somente_leitura' | 'prazo' | 'forma' | 'banco' }
async function chamar<T>(sb: SupabaseClient, fn: string, args: Record<string, unknown>, forma: z.ZodType<T>, ms = CHAMADA_MS): Promise<Lido<T>> {
  try {
    const { data, error } = await sb.rpc(fn, args).abortSignal(AbortSignal.timeout(ms))
    if (error) {
      if (error.code === '25006') return { causa: 'somente_leitura' }
      return { causa: /abort/i.test(String(error.message ?? '')) ? 'prazo' : 'banco' }
    }
    const p = forma.safeParse(data)
    return p.success ? { valor: p.data } : { causa: 'forma' }
  } catch (err) {
    return { causa: /abort|timeout/i.test(String((err as Error)?.message ?? '')) ? 'prazo' : 'banco' }
  }
}
function traduzir(b: z.infer<typeof Bruta>): RespostaSaida {
  if (b.status === 'ok') return { tipo: 'ok', linhas: b.linhas ?? 0, bytes: b.bytes ?? null, conteudoMudou: b.conteudo_mudou, voltaForaDeOrdem: b.volta_fora_de_ordem, protecaoFaltam: b.protecao_faltam }
  if (b.status === 'simulado') return { tipo: 'simulado', linhas: b.linhas ?? 0, bytes: b.bytes ?? null, canais: b.canais ?? 0, fracao: b.fracao_da_classe ?? 0, canalSemUnidade: b.codigo === 'canal_sem_unidade' }
  return { tipo: 'recusado', codigo: b.codigo ?? null, faltam: b.faltam ?? [], liberarAPartir: b.liberar_a_partir, descartadoEm: b.descartado_em }
}
const ouFalha = <T>(l: Lido<T>): T | RespostaSaida => ('valor' in l ? l.valor : { tipo: 'falhou', causa: l.causa })

export async function lerEstadoDoMes(sb: SupabaseClient, site: string, tabela: TabelaDaSaida, mes: string, por: string): Promise<EstadoDoMes | null> {
  const l = await chamar(sb, 'obs_archive_exit_check', { p_site: site, p_table: tabela, p_month: mes, p_by: por }, EstadoDoMes)
  return 'valor' in l && l.valor.estado !== 'invalido' ? l.valor : null
}
/** CP13: uma chamada curta por canal antes da chamada final; o portão aceita a conferência por 10 minutos. Conferência que não bate não para aqui: o portão recusa e dessela. */
const PARALELO = 4
export async function conferirCanais(sb: SupabaseClient, site: string, tabela: TabelaDaSaida, mes: string): Promise<{ ok: number; falhou: number } | { causa: 'somente_leitura' | 'prazo' | 'forma' | 'banco' }> {
  // p_only_stale: só os canais sem conferência de menos de 8 minutos (Phil M5); o portão aceita a conferência por 10.
  const canais = await chamar(sb, 'obs_archive_precheck_channels', { p_site: site, p_table: tabela, p_month: mes, p_only_stale: true }, z.array(z.string().uuid()))
  if (!('valor' in canais)) return canais
  // Em paralelo, no máximo 4 por vez: 75 chamadas em série passariam do maxDuration da página (Tarefa 6 mede). A primeira falha de leitura interrompe.
  const lista = canais.valor
  let proximo = 0, ok = 0, falhou = 0
  let erro: 'somente_leitura' | 'prazo' | 'forma' | 'banco' | null = null
  const trabalhador = async (): Promise<void> => {
    while (erro === null) {
      const i = proximo++
      if (i >= lista.length) return
      const r = await chamar(sb, 'obs_archive_precheck_unit', { p_site: site, p_table: tabela, p_month: mes, p_channel: lista[i]! }, z.object({ ok: z.boolean() }).passthrough())
      if (!('valor' in r)) { erro = r.causa; return }
      if (r.valor.ok) ok++; else falhou++
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALELO, lista.length) }, trabalhador))
  return erro !== null ? { causa: erro } : { ok, falhou }
}
export async function executarSaida(sb: SupabaseClient, a: { site: string; tabela: TabelaDaSaida; mes: string; por: string; simular: boolean; doisPassos: boolean }): Promise<RespostaSaida> {
  const c = await conferirCanais(sb, a.site, a.tabela, a.mes)
  if ('causa' in c) return { tipo: 'falhou', causa: c.causa }
  const fn = a.doisPassos ? 'obs_archive_detach_month' : 'obs_archive_drop_month'
  const r = ouFalha(await chamar(sb, fn, { p_site: a.site, p_table: a.tabela, p_month: a.mes, p_by: a.por, p_mode: 'clique', p_dry_run: a.simular }, Bruta))
  return 'tipo' in r ? r : traduzir(r)
}
export async function executarLiberar(sb: SupabaseClient, a: { site: string; tabela: TabelaDaSaida; mes: string; por: string; simular: boolean }): Promise<RespostaSaida> {
  const c = await conferirCanais(sb, a.site, a.tabela, a.mes)
  if ('causa' in c) return { tipo: 'falhou', causa: c.causa }
  const r = ouFalha(await chamar(sb, 'obs_archive_discard_month', { p_site: a.site, p_table: a.tabela, p_month: a.mes, p_by: a.por, p_mode: 'clique', p_dry_run: a.simular }, Bruta))
  return 'tipo' in r ? r : traduzir(r)
}
export async function executarTrazer(sb: SupabaseClient, a: { site: string; tabela: TabelaDaSaida; mes: string; por: string }): Promise<RespostaSaida> {
  const r = ouFalha(await chamar(sb, 'obs_archive_reattach_month', { p_site: a.site, p_table: a.tabela, p_month: a.mes, p_by: a.por, p_dry_run: false }, Bruta))
  return 'tipo' in r ? r : traduzir(r)
}
/** M6a: só os contadores (`obs_archive_switch_counts`). A peça 4 desta etapa conhece `nao_existe`, `nao_pode` e `null` (não lido). O estado completo é da Tarefa 11b [M6b]. */
export async function lerInterruptor(sb: SupabaseClient, site: string, classe: 'horaria' | 'serie'): Promise<EstadoInterruptor | null> {
  if (classe !== 'horaria' && classe !== 'serie') return { estado: 'nao_existe' }
  const l = await chamar(sb, 'obs_archive_switch_counts', { p_site: site, p_class: classe }, z.object({ descartes: z.number().int(), simulacoes: z.number().int() }), 3_000)
  return 'valor' in l ? { estado: 'nao_pode', descartes: l.valor.descartes, simulacoes: l.valor.simulacoes } : null
}
export async function lerEmTransito(sb: SupabaseClient, site: string): Promise<MesEmTransito[] | null> {
  const l = await chamar(sb, 'obs_archive_em_transito', { p_site: site }, z.array(MesEmTransito), 3_000)
  return 'valor' in l ? l.valor : null
}
```

- [ ] **Step 4: As ações**

```ts
// apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes.ts
'use server'
import { revalidatePath } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { denyUnlessSiteAdmin, requireSiteAdminScope } from '@/lib/cms/auth-guards'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ChamadaSaida, TABELAS_DA_SAIDA, executarLiberar, executarSaida, executarTrazer, lerEstadoDoMes, type RespostaSaida } from '@/lib/youtube/observatorio/arquivo-mensal/saida'

type Retorno = { ok: boolean; error?: string; resposta?: RespostaSaida }
const NAO_LEU = 'Não foi possível ler o estado deste mês. Nada foi tirado.'
const SOMENTE_LEITURA = 'O banco passou do limite e está em modo somente leitura. Siga o passo de emergência.'
const SEM_RESPOSTA = 'Não foi possível confirmar se o mês saiu. Recarregue a página antes de tentar de novo.'
const PAGINA = '/cms/youtube/competitors'

/** O guarda no TOPO (antes do cliente de serviço) e o id de quem age vem da sessão, nunca do formulário. */
async function quem(acao: string): Promise<{ site: string; por: string } | { negado: Retorno }> {
  const { siteId } = await getSiteContext()
  const negado = await denyUnlessSiteAdmin(siteId, acao)
  if (negado) return { negado }
  const s = await requireSiteAdminScope(siteId)
  if (!s.ok) return { negado: { ok: false } }
  return { site: siteId, por: s.user.id }
}
function fechar(r: RespostaSaida): Retorno {
  if (r.tipo === 'falhou') return { ok: false, error: r.causa === 'somente_leitura' ? SOMENTE_LEITURA : r.causa === 'prazo' ? SEM_RESPOSTA : NAO_LEU }
  if (r.tipo === 'ok') revalidatePath(PAGINA, 'layout')
  return { ok: true, resposta: r }
}
async function tirarOuSimular(tabela: string, mes: string, simular: boolean): Promise<Retorno> {
  const q = await quem('tirar um mês do banco online')
  if ('negado' in q) return q.negado
  const p = ChamadaSaida.safeParse({ tabela, mes })
  if (!p.success) return { ok: false, error: NAO_LEU }
  const sb = getSupabaseServiceClient()
  const est = await lerEstadoDoMes(sb, q.site, p.data.tabela, p.data.mes, q.por)
  // m-8: segundo clique num mês que já saiu das telas (ou foi descartado) não é "não foi possível ler": é o estado real
  if (est && est.estado === 'destacado') return { ok: true, resposta: { tipo: 'recusado', codigo: 'ja_destacado', faltam: [] } }
  if (est && est.estado === 'descartado') return { ok: true, resposta: { tipo: 'recusado', codigo: 'ja_descartado', faltam: [] } }
  if (!est || est.estado !== 'online') return { ok: false, error: NAO_LEU }
  const r = await executarSaida(sb, { site: q.site, tabela: p.data.tabela, mes: p.data.mes, por: q.por, simular, doisPassos: est.dois_passos })
  const classe = TABELAS_DA_SAIDA[p.data.tabela]
  if (simular && r.tipo === 'simulado' && classe !== 'ensaio') {
    await sb.rpc('obs_archive_switch_sim_seen', { p_site: q.site, p_class: classe, p_by: q.por }).abortSignal(AbortSignal.timeout(3_000))
  }
  return fechar(r)
}
export async function simularSaida(tabela: string, mes: string): Promise<Retorno> { return tirarOuSimular(tabela, mes, true) }
export async function tirarMes(tabela: string, mes: string): Promise<Retorno> { return tirarOuSimular(tabela, mes, false) }

export async function liberarEspaco(tabela: string, mes: string): Promise<Retorno> {
  const q = await quem('liberar o espaço de um mês')
  if ('negado' in q) return q.negado
  const p = ChamadaSaida.safeParse({ tabela, mes })
  if (!p.success) return { ok: false, error: NAO_LEU }
  return fechar(await executarLiberar(getSupabaseServiceClient(), { site: q.site, tabela: p.data.tabela, mes: p.data.mes, por: q.por, simular: false }))
}
export async function trazerDeVolta(tabela: string, mes: string): Promise<Retorno> {
  const q = await quem('trazer um mês de volta ao banco online')
  if ('negado' in q) return q.negado
  const p = ChamadaSaida.safeParse({ tabela, mes })
  if (!p.success) return { ok: false, error: NAO_LEU }
  return fechar(await executarTrazer(getSupabaseServiceClient(), { site: q.site, tabela: p.data.tabela, mes: p.data.mes, por: q.por }))
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: o comando do Step 2 e o typecheck do `apps/web` (saída em arquivo).
Expected: PASS e typecheck limpo.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/youtube/observatorio/arquivo-mensal/saida.ts "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes.ts" apps/web/test/youtube/observatorio/arquivo-saida-acoes.test.ts
git commit -m "feat: M6a: o caminho do site até as funções da saída (conferência por canal em paralelo, Zod) e as ações do botão

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/saida.ts "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes.ts" apps/web/test/youtube/observatorio/arquivo-saida-acoes.test.ts
```

---

### Task 11b [M6b]: As ações do interruptor e o estado completo do interruptor

**Espera:** Tarefa 7b (as funções do interruptor), Tarefa 8 (o `ligado.ts`) e a Tarefa 12c (`interruptor.ts` com `fraseConfere` e `FRASE_DE_LIGAR`; se a 11b vier antes, criar já esse arquivo com as duas exportações e o teste delas, e a 12c o completa).

**Files:**
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/saida.ts` (`lerInterruptor` passa a ler `obs_archive_switch_state`, com o estado completo)
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes-interruptor.ts` (`'use server'`)
- Create: `apps/web/test/youtube/observatorio/arquivo-saida-acoes-interruptor.test.ts`

**Interfaces:**
- Consumes: Tarefas 7b e 8; `autoDropLigado` de `arquivo-mensal/ligado.ts`.
- Produces: `ligarAutomatico(classe, fraseDigitada)`, `desligarAutomatico(classe)`, `marcarSimulacaoVista(classe)`, `marcarDesligamentoVisto(classe)` (mesmo formato de retorno; `ligarAutomatico` devolve também `codigo` da recusa); `lerInterruptor` com o `EstadoInterruptor` completo (`ligado`, `desligado`, `desligou_sozinho`, `venceu`, além de `nao_existe` e `nao_pode`).

- [ ] **Step 1: Os testes (falham)**

```ts
// apps/web/test/youtube/observatorio/arquivo-saida-acoes-interruptor.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
const admin = { ok: true as boolean }
vi.mock('@/lib/cms/auth-guards', () => ({
  denyUnlessSiteAdmin: async (_s: string, acao: string) => (admin.ok ? null : { ok: false, error: `Só quem administra o site pode ${acao}.` }),
  requireSiteAdminScope: async () => (admin.ok ? { ok: true, user: { id: 'u-admin' } } : { ok: false, reason: 'insufficient_access' }),
  siteAdminOnlyMessage: (acao: string) => `Só quem administra o site pode ${acao}.`,
}))
type R = { data: unknown; error: { code?: string; message?: string } | null }
let respostas: Record<string, R | R[]> = {}
const chamadas: Array<{ fn: string; args: Record<string, unknown> }> = []
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: (fn: string, args: Record<string, unknown>) => {
      chamadas.push({ fn, args })
      const r = respostas[fn]; const um = Array.isArray(r) ? (r.length > 1 ? r.shift()! : r[0]!) : r
      return { abortSignal: () => Promise.resolve(um ?? { data: null, error: { code: '42883', message: 'x' } }) }
    },
  }),
}))
const ok = (data: unknown): R => ({ data, error: null })
const EST_ONLINE = { estado: 'online', faltam: [], descartes: 0, dois_passos: true, particao_ausente: false }

beforeEach(() => { respostas = {}; chamadas.length = 0; admin.ok = true; delete process.env.OBS_ARQUIVO_AUTO_DROP })

describe('ações do interruptor', () => {
  it('93: quem não administra recebe a frase e nenhuma função do banco é chamada (interruptor)', async () => {
    admin.ok = false
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes-interruptor')
    for (const r of [await a.ligarAutomatico('serie', 'ligar automático de views por dia'), await a.desligarAutomatico('serie'),
                     await a.marcarSimulacaoVista('serie'), await a.marcarDesligamentoVisto('serie')]) {
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/^Só quem administra o site pode /)
    }
    expect(chamadas).toEqual([])
  })
  it('ligar: a frase digitada confere sem maiúscula nem acento; a variável vai como p_env_on', async () => {
    process.env.OBS_ARQUIVO_AUTO_DROP = 'on'
    respostas = { obs_archive_switch_arm: ok({ status: 'ok', armado_ate: '2027-08-01T12:00:00Z' }) }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes-interruptor')
    expect(await a.ligarAutomatico('serie', 'LIGAR AUTOMATICO de views por dia ')).toMatchObject({ ok: true })
    expect(chamadas[0]!.args).toEqual({ p_site: 's1', p_class: 'serie', p_by: 'u-admin', p_frase_confirmada: true, p_env_on: true })
    chamadas.length = 0
    await a.ligarAutomatico('serie', 'ligar automatico')
    expect(chamadas[0]!.args.p_frase_confirmada).toBe(false)
  })
  it('desligar grava motivo manual com p_by da sessão', async () => {
    respostas = { obs_archive_switch_disarm: ok({ status: 'ok', desligou: true }) }
    const a = await import('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes-interruptor')
    await a.desligarAutomatico('horaria')
    expect(chamadas[0]).toEqual({ fn: 'obs_archive_switch_disarm', args: { p_site: 's1', p_class: 'horaria', p_reason: 'manual', p_month: null, p_detail: null, p_by: 'u-admin' } })
  })})
```

- [ ] **Step 2: O `lerInterruptor` completo**

Em `saida.ts`, trocar o corpo da M6a:

```ts
export async function lerInterruptor(sb: SupabaseClient, site: string, classe: 'horaria' | 'serie'): Promise<EstadoInterruptor | null> {
  const l = await chamar(sb, 'obs_archive_switch_state', { p_site: site, p_class: classe }, EstadoInterruptor, 3_000)
  return 'valor' in l ? l.valor : null
}
```

e acrescentar ao teste da M6a um caso que o `obs_archive_switch_state` devolve `ligado` e que fora da forma dá `null` (o caso de `switch_counts` da M6a sai).

- [ ] **Step 3: As ações do interruptor**

```ts
// apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes-interruptor.ts
'use server'
import { revalidatePath } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { denyUnlessSiteAdmin, requireSiteAdminScope } from '@/lib/cms/auth-guards'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { autoDropLigado } from '@/lib/youtube/observatorio/arquivo-mensal/ligado'
import { fraseConfere, FRASE_DE_LIGAR } from '@/lib/youtube/observatorio/arquivo-mensal/interruptor'

type Retorno = { ok: boolean; error?: string }
const SOMENTE_LEITURA = 'O banco passou do limite e está em modo somente leitura. Siga o passo de emergência.'
const PAGINA = '/cms/youtube/competitors'

/** O guarda no TOPO (antes do cliente de serviço) e o id de quem age vem da sessão, nunca do formulário. */
async function quem(acao: string): Promise<{ site: string; por: string } | { negado: Retorno }> {
  const { siteId } = await getSiteContext()
  const negado = await denyUnlessSiteAdmin(siteId, acao)
  if (negado) return { negado }
  const s = await requireSiteAdminScope(siteId)
  if (!s.ok) return { negado: { ok: false } }
  return { site: siteId, por: s.user.id }
}

type Classe = 'horaria' | 'serie'
const ehClasse = (c: string): c is Classe => c === 'horaria' || c === 'serie'
async function interruptor(acao: string, classe: string, fn: string, args: (q: { site: string; por: string }) => Record<string, unknown>): Promise<Retorno & { codigo?: string }> {
  const q = await quem(acao)
  if ('negado' in q) return q.negado
  if (!ehClasse(classe)) return { ok: false }
  const { data, error } = await getSupabaseServiceClient().rpc(fn, args(q)).abortSignal(AbortSignal.timeout(3_000))
  if (error) return { ok: false, error: error.code === '25006' ? SOMENTE_LEITURA : 'Não foi possível falar com o banco. Nada mudou.' }
  revalidatePath(PAGINA, 'layout')
  const d = data as { status?: string; codigo?: string } | null
  return d?.status === 'recusado' ? { ok: false, codigo: d.codigo } : { ok: true }
}
export async function ligarAutomatico(classe: string, fraseDigitada: string): Promise<Retorno & { codigo?: string }> {
  return interruptor('ligar o automático', classe, 'obs_archive_switch_arm', q => ({
    p_site: q.site, p_class: classe, p_by: q.por,
    p_frase_confirmada: ehClasse(classe) && fraseConfere(fraseDigitada, FRASE_DE_LIGAR[classe]), p_env_on: autoDropLigado(),
  }))
}
export async function desligarAutomatico(classe: string): Promise<Retorno> {
  return interruptor('desligar o automático', classe, 'obs_archive_switch_disarm', q => ({ p_site: q.site, p_class: classe, p_reason: 'manual', p_month: null, p_detail: null, p_by: q.por }))
}
export async function marcarSimulacaoVista(classe: string): Promise<Retorno> {
  return interruptor('ver o que sairia', classe, 'obs_archive_switch_sim_seen', q => ({ p_site: q.site, p_class: classe, p_by: q.por }))
}
export async function marcarDesligamentoVisto(classe: string): Promise<Retorno> {
  return interruptor('marcar o aviso como visto', classe, 'obs_archive_switch_seen', q => ({ p_site: q.site, p_class: classe, p_by: q.por }))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/arquivo-saida-acoes.test.ts test/youtube/observatorio/arquivo-saida-acoes-interruptor.test.ts > /tmp/m6-t11b.log 2>&1; grep -E "FAIL|Tests " /tmp/m6-t11b.log` e o typecheck.
Expected: PASS e typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/observatorio/arquivo-mensal/saida.ts "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes-interruptor.ts" apps/web/test/youtube/observatorio/arquivo-saida-acoes-interruptor.test.ts apps/web/test/youtube/observatorio/arquivo-saida-acoes.test.ts
git commit -m "feat: M6b: as ações do interruptor do automático e o estado completo do interruptor

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/saida.ts "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes-interruptor.ts" apps/web/test/youtube/observatorio/arquivo-saida-acoes-interruptor.test.ts apps/web/test/youtube/observatorio/arquivo-saida-acoes.test.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/interruptor.ts
```

---

### Task 12 [M6a]: As frases e as peças da tela (peça 3 e a peça 4 mínima)

O mockup aprovado é a fonte (`docs/superpowers/mockups/2026-10-14-manutencao-nas/19-mes-fora-do-banco/`: `arquivo.js` para a peça 3, `interruptor.js` para a peça 4, `index.js` para o chip). Os literais abaixo foram copiados de lá; onde este plano e o mockup divergirem em frase, vale o mockup, e o teste compara contra literais copiados dele (o executor abre os dois arquivos ao escrever o teste).

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/frases-saida.ts` (puro)
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/interruptor.ts` (puro, MÍNIMO nesta etapa: `tituloDoInterruptor`, `NAO_MEDIDO`, `faltaParaLigar`, `SO_ADMIN`; os motivos, a frase digitada, `CALMA` e `ESPERA` entram na Tarefa 12c [M6b], que completa este arquivo)
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/peca-tirar-mes.tsx`, `peca-interruptor.tsx` (`'use client'`; nesta etapa a peça 4 só desenha `nao_existe`, `nao_pode` e não medido; os demais estados e o `chip-automatico.tsx` são da Tarefa 12c)
- Create: `apps/web/test/youtube/observatorio/arquivo-frases-saida.test.ts`, `apps/web/test/youtube/observatorio/arquivo-interruptor.test.ts` (títulos e `faltaParaLigar`), `apps/web/test/youtube/observatorio/arquivo-pecas-saida.test.tsx` (`// @vitest-environment jsdom`)

As peças desta tarefa ainda não têm rota: o encaixe na página da M5 é a Tarefa 12b (D-M5-14).

**Interfaces:**
- Consumes: `RespostaSaida`, `EstadoDoMes`, `EstadoInterruptor`, `Falta` (Tarefa 11, só tipos: `import type`); as ações (por props, nunca import direto no componente cliente: CLAUDE.md "não importar server actions em client components").
- Produces:
  - `frases-saida.ts`: `nomeDoMes(mes: 'AAAA-MM-01'): string` ("outubro de 2027"), `ddmmaaaa(iso: string): string`, `fraseDaFalta(f: Falta, ctx: { mes: string; janelaMeses: number }): string`, `fraseDaSimulacao(r: Extract<RespostaSaida, {tipo:'simulado'}>, mes: string): string`, `fraseDoRetorno(op: 'tirar'|'liberar'|'trazer', r: RespostaSaida, ctx: { mes: string; doisPassos: boolean; liberarAPartir?: string; pctDoBanco?: number }): { tom: 'ok'|'aviso'|'erro'; texto: string }`, `estadoDaLinha(e: EstadoDoMes, hojeSP: string): 'T1'|'T3'|'T7'|'T7a'|'T7b'|'T9'`, `fraseDaLinhaDestacada(e: EstadoDoMes, hojeSP: string, pctDoBanco: number | null): string`, `TEXTO_SAIDA_FORA_DE_ORDEM(mes: string, antes: string): string` (proposta, Logan revisa).
  - `interruptor.ts` (M6a): `tituloDoInterruptor(e: EstadoInterruptor | null, envOn: boolean, hojeSP: string): string`, `NAO_MEDIDO`, `faltaParaLigar(descartes, simulacoes): string`, `SO_ADMIN`. (`FRASE_DE_LIGAR`, `fraseConfere`, `MOTIVOS`, `idDoMotivo`, `CALMA`, `ESPERA`, `PARA_LIGAR_DE_NOVO` e `FRASE_NAO_CONFERE`: Tarefa 12c [M6b].)

- [ ] **Step 1: Os testes das frases (falham)**

```ts
// apps/web/test/youtube/observatorio/arquivo-frases-saida.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { nomeDoMes, fraseDaFalta, fraseDaSimulacao, fraseDoRetorno, estadoDaLinha, fraseDaLinhaDestacada } from '@/lib/youtube/observatorio/arquivo-mensal/frases-saida'

const MES = '2027-10-01'
describe('frases da peça 3 (literais do arquivo.js)', () => {
  it('nome do mês', () => { expect(nomeDoMes(MES)).toBe('outubro de 2027') })
  it('T1: cada falta tem a frase do mockup', () => {
    expect(fraseDaFalta({ codigo: 'b2_sem_atestacao', motivo: 'prazo', dias_forja: 9, dias_dono: null }, { mes: MES, janelaMeses: 6 })).toBe('A forja não confere o B2 há 9 dias.')
    expect(fraseDaFalta({ codigo: 'b2_sem_atestacao', motivo: 'prazo', dias_forja: null, dias_dono: 41 }, { mes: MES, janelaMeses: 6 })).toBe('Falta conferir o B2 (última conferência há 41 dias).')
    expect(fraseDaFalta({ codigo: 'nas_sem_atestacao', horas: 30 }, { mes: MES, janelaMeses: 6 })).toBe('Cópia sem verificação há 30 horas: a casa não respondeu. Nada se perde: o mês só sai quando a casa voltar. Veja o que fazer no aviso do banco.')
    expect(fraseDaFalta({ codigo: 'ainda_na_janela', pode_sair_em: '2028-06-01' }, { mes: MES, janelaMeses: 6 })).toBe('Ainda dentro dos 6 meses: pode sair em 01/06/2028.')
  })
  it('toda falta do catálogo tem frase; código desconhecido tem frase genérica, nunca o código', () => {
    for (const codigo of ['classe_nao_liberada', 'ainda_na_janela', 'nao_selado', 'canal_sem_unidade', 'conteudo_mudou', 'nas_sem_atestacao', 'b2_sem_atestacao',
      'restauracao_vencida', 'esquema_mudou', 'dia_nao_somado', 'marca_pendente', 'marcas_ausentes', 'expurgo_pendente', 'sem_direito', 'interruptor_desligado',
      'outro_site_na_particao', 'saida_fora_de_ordem', 'esquema_divergente', 'fora_do_mes', 'codigo_que_nao_existe']) {
      const t = fraseDaFalta({ codigo, antes: '2027-09-01', pode_sair_em: '2028-06-01' }, { mes: MES, janelaMeses: 6 })
      expect(t, codigo).toMatch(/^[A-ZÀ-Ú]/)
      expect(t, codigo).not.toContain(codigo)
      expect(t, codigo).not.toContain('_')
    }
  })
  it('simulação', () => {
    expect(fraseDaSimulacao({ tipo: 'simulado', linhas: 1234567, bytes: null, canais: 45, fracao: 0.38, canalSemUnidade: false }, MES))
      .toBe('Se você tirasse outubro de 2027 agora: 45 canais, 1.234.567 registros, 38% do que este tipo de dado ocupa. Contado agora: tudo bate.')
  })
  it('retornos T6, T8r, T8x, T9, T10, T10b, T10c, T10d', () => {
    const c = { mes: MES, doisPassos: true }
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'ocupado', faltam: [] }, c).texto).toBe('Ocupado: a coleta está gravando. Tente em alguns minutos.')
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'conteudo_mudou', faltam: [] }, c).texto).toBe('O dado mudou desde a cópia: nada foi tirado; o mês será copiado de novo.')
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'gatilho_ausente', faltam: [] }, c).texto).toBe('A proteção contra remoção durante a saída não está instalada: nada foi tirado. É defeito de instalação; avise quem cuida do site.')
    expect(fraseDoRetorno('liberar', { tipo: 'recusado', codigo: 'ja_descartado', faltam: [], descartadoEm: '2028-05-03T17:32:00Z' }, c).texto).toBe('O espaço deste mês já foi liberado em 03/05/2028.')
    expect(fraseDoRetorno('liberar', { tipo: 'recusado', codigo: null, faltam: [{ codigo: 'b2_sem_atestacao', motivo: 'prazo' }] }, c).texto).toBe('A cópia não pôde ser confirmada agora (o B2 não respondeu à conferência). O espaço não foi liberado e o mês continua podendo voltar.')
    expect(fraseDoRetorno('trazer', { tipo: 'ok', linhas: 1, bytes: null, conteudoMudou: false, protecaoFaltam: [] }, { ...c, hoje: '2028-05-03' }).texto).toBe('Outubro de 2027 voltou ao banco online em 03/05/2028.')
    expect(fraseDoRetorno('trazer', { tipo: 'ok', linhas: 1, bytes: null, conteudoMudou: false, protecaoFaltam: ['x'] }, { ...c, hoje: '2028-05-03' }).texto).toBe('O mês voltou. A proteção contra remoção durante a saída não está instalada; avise quem cuida do site antes de tirar outro mês.')
    expect(fraseDoRetorno('trazer', { tipo: 'recusado', codigo: 'orfa_inesperada', faltam: [] }, c).texto).toBe('Não foi possível trazer de volta: o banco encontrou registros sem vídeo. Nada foi alterado; o mês continua fora das telas. Avise quem cuida do site.')
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'ja_destacado', faltam: [] }, c).texto).toBe('Este mês já saiu das telas.')
    expect(fraseDoRetorno('tirar', { tipo: 'recusado', codigo: 'esquema_divergente', faltam: [] }, c).texto).toBe('A tabela deste mês mudou de forma desde a cópia: nada foi tirado; o mês será copiado de novo.')
    expect(fraseDoRetorno('trazer', { tipo: 'recusado', codigo: 'fora_do_mes', faltam: [] }, c).texto).toBe('Não foi possível trazer de volta: há registros fora deste mês. Nada foi alterado; o mês continua fora das telas. Avise quem cuida do site.')
    expect(fraseDoRetorno('tirar', { tipo: 'falhou', causa: 'somente_leitura' }, c).texto).toBe('O banco passou do limite e está em modo somente leitura. Siga o passo de emergência.')
  })
  it('linha destacada: m8 antes da data, m8a no dia, m8b depois de 15 dias; T9 descartado', () => {
    const base = { estado: 'destacado' as const, faltam: [], descartes: 0, dois_passos: true, destacado_em: '2028-05-02T15:00:00Z', liberar_a_partir: '2028-05-09' }
    expect(estadoDaLinha(base, '2028-05-05')).toBe('T7')
    expect(fraseDaLinhaDestacada(base, '2028-05-05', 4)).toBe('Saiu das telas em 02/05/2028. O espaço ainda não voltou. Você pode trazer de volta a qualquer momento, até liberar o espaço. A partir de 09/05/2028 você pode liberar o espaço. Até lá não dá para remover canal nem apagar vídeo. Liberar o espaço devolve cerca de 4% do banco.')
    expect(estadoDaLinha(base, '2028-05-09')).toBe('T7a')
    expect(estadoDaLinha(base, '2028-05-18')).toBe('T7b')
    expect(fraseDaLinhaDestacada(base, '2028-05-18', 4)).toMatch(/^Saiu das telas há 16 dias e o espaço ainda não foi liberado\./)
    expect(estadoDaLinha({ ...base, estado: 'descartado', descartado_em: '2028-05-03T17:32:00Z' }, '2028-05-20')).toBe('T9')
  })
})
```

(As frases m8/m8a/m8b, T8, T9 e T10 vêm de `arquivo.js`; o literal de m8 acima foi montado das partes do mockup e o executor confere ponto e espaço contra o arquivo antes de rodar. O mesmo para a frase de `fraseDaSimulacao`.)

```ts
// apps/web/test/youtube/observatorio/arquivo-interruptor.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { tituloDoInterruptor, faltaParaLigar } from '@/lib/youtube/observatorio/arquivo-mensal/interruptor'

describe('interruptor mínimo (literais do interruptor.js)', () => {
  it('faltaParaLigar', () => {
    expect(faltaParaLigar(1, 0)).toBe('Falta: 2 saídas feitas por você (1 de 3) e 2 simulações vistas (0 de 2).')
    expect(faltaParaLigar(2, 1)).toBe('Falta: 1 saída feita por você (2 de 3) e 1 simulação vista (1 de 2).')
    expect(faltaParaLigar(3, 1)).toBe('Falta: 1 simulação vista (1 de 2).')
  })
  it('títulos: não medido quando o estado não foi lido; desligado na configuração quando a variável está desligada', () => {
    expect(tituloDoInterruptor(null, true, '2028-05-03')).toBe('Automático: não medido')
    expect(tituloDoInterruptor({ estado: 'ligado', armado_ate: '2028-07-31T12:00:00Z' }, false, '2028-05-03')).toBe('Automático: desligado na configuração')
    expect(tituloDoInterruptor({ estado: 'nao_pode', descartes: 1, simulacoes: 0 }, true, '2028-05-03')).toBe('Automático: ainda não dá para ligar')
    expect(tituloDoInterruptor({ estado: 'ligado', armado_ate: '2028-05-09T12:00:00Z' }, true, '2028-05-03')).toBe('Automático: ligado, vence em 6 dias')
    expect(tituloDoInterruptor({ estado: 'desligou_sozinho', motivo: '2', desligado_em: '2028-05-02T12:00:00Z' }, true, '2028-05-03')).toBe('Automático: desligou sozinho em 02/05/2028')
    expect(tituloDoInterruptor({ estado: 'venceu', motivo: '8', desligado_em: '2028-05-02T12:00:00Z' }, true, '2028-05-03')).toBe('Automático: a validade de 90 dias acabou em 02/05/2028')
    expect(tituloDoInterruptor({ estado: 'nao_existe' }, true, '2028-05-03')).toBe('Automático: não existe aqui')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/arquivo-frases-saida.test.ts test/youtube/observatorio/arquivo-interruptor.test.ts > /tmp/m6-t12.log 2>&1; grep -E "FAIL|Tests " /tmp/m6-t12.log`
Expected: FAIL.

- [ ] **Step 3: Os módulos puros**

```ts
// apps/web/src/lib/youtube/observatorio/arquivo-mensal/frases-saida.ts
/** Frases da peça 3 (tirar um mês). Puro: sem 'server-only', importado pelo componente cliente. Literais do mockup aprovado (arquivo.js). */
import type { EstadoDoMes, Falta, RespostaSaida } from './saida'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export function nomeDoMes(mes: string): string { return `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}` }
const maiuscula = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
/** 'AAAA-MM-DD' ou instante ISO → dd/mm/aaaa no dia de São Paulo. */
export function ddmmaaaa(iso: string): string {
  const dia = iso.length === 10 ? iso : new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().slice(0, 10)
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`
}
const n = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)
const milhar = (x: number): string => x.toLocaleString('pt-BR')
const AVISE = 'avise quem cuida do site'

export const TEXTO_SAIDA_FORA_DE_ORDEM = (mes: string, antes: string): string =>
  `Antes de ${nomeDoMes(mes)}, ${nomeDoMes(antes)} ainda está no banco online. Tire os meses do mais antigo para o mais novo.`   // proposta; Logan revisa (Passo 6)

export function fraseDaFalta(f: Falta, ctx: { mes: string; janelaMeses: number }): string {
  switch (f.codigo) {
    case 'ainda_na_janela': return `Ainda dentro dos ${ctx.janelaMeses} meses: pode sair em ${ddmmaaaa(String(f.pode_sair_em))}.`
    case 'nas_sem_atestacao': return n(f.horas) === null
      ? 'A cópia na casa ainda não foi verificada. Nada se perde: o mês só sai quando a casa confirmar.'
      : `Cópia sem verificação há ${n(f.horas)} horas: a casa não respondeu. Nada se perde: o mês só sai quando a casa voltar. Veja o que fazer no aviso do banco.`
    case 'b2_sem_atestacao':
      if (f.motivo === 'retirada') return `A última conferência do B2 falhou em ${ddmmaaaa(String(f.em))}: nada foi tirado. A forja confere de novo amanhã; se quiser adiantar, rode a conferência no seu Mac.`
      if (n(f.dias_forja) !== null) return `A forja não confere o B2 há ${n(f.dias_forja)} dias.`
      return n(f.dias_dono) !== null ? `Falta conferir o B2 (última conferência há ${n(f.dias_dono)} dias).` : 'Falta conferir o B2.'
    case 'classe_nao_liberada': return 'Este tipo de dado ainda não pode sair do banco online.'
    case 'nao_selado': return 'A cópia deste mês ainda não terminou.'
    case 'canal_sem_unidade': return 'Há canal com registros deste mês ainda sem cópia. O mês só sai depois da próxima cópia.'
    case 'conteudo_mudou': return 'O dado mudou desde a cópia: nada foi tirado; o mês será copiado de novo.'
    case 'restauracao_vencida': return 'O ensaio de restauração deste tipo de dado tem mais de 180 dias. Rode o ensaio antes de tirar.'
    case 'esquema_mudou': return 'A tabela mudou desde o último ensaio de restauração. Rode o ensaio antes de tirar.'
    case 'dia_nao_somado': return 'Ainda há dia de leitura de hora em hora sem a soma do dia. O mês sai depois da soma.'
    case 'marca_pendente': return 'Ainda há vídeo deste mês sem a marca de 30 dias. O mês sai depois dela.'
    case 'marcas_ausentes': return `Falta uma parte do banco que guarda as marcas de 30 dias; ${AVISE}.`
    case 'expurgo_pendente': return 'Há vídeo apagado deste mês esperando sair do arquivo. O mês sai depois disso.'
    case 'sem_direito': return 'Só quem administra o site tira um mês do banco.'
    case 'interruptor_desligado': return 'O automático está desligado.'
    case 'outro_site_na_particao': return 'Outro site tem registros neste mês que ainda não estão copiados.'
    case 'esquema_divergente': return 'A tabela deste mês mudou de forma desde a cópia. O mês será copiado de novo antes de sair.'
    case 'fora_do_mes': return 'Há registros fora deste mês na cópia. Nada foi tirado.'
    case 'saida_fora_de_ordem': return TEXTO_SAIDA_FORA_DE_ORDEM(ctx.mes, String(f.antes))
    default: return `O banco recusou tirar este mês por um motivo que esta tela não conhece; ${AVISE}.`
  }
}

export function fraseDaSimulacao(r: Extract<RespostaSaida, { tipo: 'simulado' }>, mes: string): string {
  const conta = r.canalSemUnidade ? 'Contado agora: há registro sem cópia; nada sairia.' : 'Contado agora: tudo bate.'
  return `Se você tirasse ${nomeDoMes(mes)} agora: ${r.canais} canais, ${milhar(r.linhas)} registros, ${Math.round(r.fracao * 100)}% do que este tipo de dado ocupa. ${conta}`
}

type Tom = 'ok' | 'aviso' | 'erro'
export function fraseDoRetorno(op: 'tirar' | 'liberar' | 'trazer', r: RespostaSaida, ctx: { mes: string; doisPassos: boolean; hoje?: string; liberarAPartir?: string; pctDoBanco?: number }): { tom: Tom; texto: string } {
  if (r.tipo === 'falhou') {
    if (r.causa === 'somente_leitura') return { tom: 'erro', texto: 'O banco passou do limite e está em modo somente leitura. Siga o passo de emergência.' }
    return { tom: 'erro', texto: r.causa === 'prazo' ? 'Não foi possível confirmar se o mês saiu. Recarregue a página antes de tentar de novo.' : 'Não foi possível ler o estado deste mês. Nada foi tirado.' }
  }
  if (r.tipo === 'recusado') {
    if (r.codigo === 'ocupado') return { tom: 'aviso', texto: 'Ocupado: a coleta está gravando. Tente em alguns minutos.' }
    if (r.codigo === 'conteudo_mudou') return { tom: 'aviso', texto: 'O dado mudou desde a cópia: nada foi tirado; o mês será copiado de novo.' }
    if (r.codigo === 'gatilho_ausente') return { tom: 'erro', texto: `A proteção contra remoção durante a saída não está instalada: nada foi tirado. É defeito de instalação; ${AVISE}.` }
    if (r.codigo === 'ja_destacado') return { tom: 'aviso', texto: 'Este mês já saiu das telas.' }
    if (r.codigo === 'esquema_divergente') return { tom: 'aviso', texto: 'A tabela deste mês mudou de forma desde a cópia: nada foi tirado; o mês será copiado de novo.' }
    if (r.codigo === 'fora_do_mes') return { tom: 'erro', texto: `Não foi possível trazer de volta: há registros fora deste mês. Nada foi alterado; o mês continua fora das telas. ${maiuscula(AVISE)}.` }
    if (r.codigo === 'ja_descartado') return { tom: 'aviso', texto: `O espaço deste mês já foi liberado em ${ddmmaaaa(r.descartadoEm ?? '')}.` }
    if (r.codigo === 'orfa_inesperada') return { tom: 'erro', texto: `Não foi possível trazer de volta: o banco encontrou registros sem vídeo. Nada foi alterado; o mês continua fora das telas. ${maiuscula(AVISE)}.` }
    if (r.codigo === 'cedo_demais') return { tom: 'aviso', texto: `O espaço só pode ser liberado a partir de ${ddmmaaaa(r.liberarAPartir ?? '')}.` }
    if (op === 'liberar' && r.faltam.some(f => f.codigo === 'b2_sem_atestacao' || f.codigo === 'nas_sem_atestacao'))
      return { tom: 'aviso', texto: 'A cópia não pôde ser confirmada agora (o B2 não respondeu à conferência). O espaço não foi liberado e o mês continua podendo voltar.' }
    const primeira = r.faltam[0]
    return { tom: 'aviso', texto: primeira ? fraseDaFalta(primeira, { mes: ctx.mes, janelaMeses: 6 }) : `O banco recusou; nada mudou. ${maiuscula(AVISE)}.` }
  }
  if (r.tipo === 'simulado') return { tom: 'ok', texto: fraseDaSimulacao(r, ctx.mes) }
  if (op === 'trazer') {
    if (r.protecaoFaltam && r.protecaoFaltam.length > 0) return { tom: 'erro', texto: `O mês voltou. A proteção contra remoção durante a saída não está instalada; ${AVISE} antes de tirar outro mês.` }
    const base = `${maiuscula(nomeDoMes(ctx.mes))} voltou ao banco online em ${ddmmaaaa(ctx.hoje ?? '')}.`
    return { tom: r.conteudoMudou ? 'aviso' : 'ok', texto: r.conteudoMudou ? `${base} O dado dele não bateu com a cópia: o mês será copiado de novo.` : base }
  }
  // tirar (ok) e liberar (ok): a linha relida mostra T7/T9; o retorno é curto
  return { tom: 'ok', texto: op === 'liberar' || !ctx.doisPassos ? `Saiu em ${ddmmaaaa(ctx.hoje ?? '')}.` : `Saiu das telas em ${ddmmaaaa(ctx.hoje ?? '')}.` }
}

const diasEntre = (a: string, b: string): number => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000)
const diaSP = (iso: string): string => new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().slice(0, 10)

export function estadoDaLinha(e: EstadoDoMes, hojeSP: string): 'T1' | 'T3' | 'T7' | 'T7a' | 'T7b' | 'T9' {
  if (e.estado === 'descartado') return 'T9'
  if (e.estado === 'destacado') {
    if (e.destacado_em && diasEntre(diaSP(e.destacado_em), hojeSP) > 15) return 'T7b'
    return e.liberar_a_partir && hojeSP >= e.liberar_a_partir ? 'T7a' : 'T7'
  }
  return e.faltam.length > 0 ? 'T1' : 'T3'
}

export function fraseDaLinhaDestacada(e: EstadoDoMes, hojeSP: string, pctDoBanco: number | null): string {
  const libera = pctDoBanco === null ? '' : ` Liberar o espaço devolve cerca de ${pctDoBanco}% do banco.`
  const s = estadoDaLinha(e, hojeSP)
  if (s === 'T7b') return `Saiu das telas há ${diasEntre(diaSP(e.destacado_em ?? ''), hojeSP)} dias e o espaço ainda não foi liberado. Enquanto isso não dá para remover canal nem apagar vídeo. Libere o espaço ou traga o mês de volta.`
  if (s === 'T7a') return `Pronto para liberar o espaço. Ainda dá para trazer de volta.${libera}`
  return `Saiu das telas em ${ddmmaaaa(e.destacado_em ?? '')}. O espaço ainda não voltou. Você pode trazer de volta a qualquer momento, até liberar o espaço. A partir de ${ddmmaaaa(e.liberar_a_partir ?? '')} você pode liberar o espaço. Até lá não dá para remover canal nem apagar vídeo.${libera}`
}
```

```ts
// apps/web/src/lib/youtube/observatorio/arquivo-mensal/interruptor.ts
/** Frases e estado da peça 4 (o automático). Puro. Literais do mockup aprovado (interruptor.js). M6a: só o mínimo; a Tarefa 12c [M6b] acrescenta motivos e frase digitada. */
import type { EstadoInterruptor } from './saida'

export const SO_ADMIN = 'Quem administra o site liga o automático.'

const ddmmaaaa = (iso: string): string => { const d = new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().slice(0, 10); return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` }
export function tituloDoInterruptor(e: EstadoInterruptor | null, envOn: boolean, hojeSP: string): string {
  if (e === null) return 'Automático: não medido'
  if (e.estado === 'nao_existe') return 'Automático: não existe aqui'
  if (!envOn) return 'Automático: desligado na configuração'
  if (e.estado === 'nao_pode') return 'Automático: ainda não dá para ligar'
  if (e.estado === 'ligado') {
    const fim = new Date(Date.parse(e.armado_ate ?? '') - 3 * 3_600_000).toISOString().slice(0, 10)
    const dias = Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${hojeSP}T12:00:00Z`)) / 86_400_000)
    return dias <= 7 ? `Automático: ligado, vence em ${dias} dias` : `Automático: ligado até ${ddmmaaaa(e.armado_ate ?? '')}`
  }
  if (e.estado === 'venceu') return `Automático: a validade de 90 dias acabou em ${ddmmaaaa(e.desligado_em ?? '')}`
  if (e.estado === 'desligou_sozinho') return `Automático: desligou sozinho em ${ddmmaaaa(e.desligado_em ?? '')}`
  return 'Automático: desligado'
}
export const NAO_MEDIDO = 'Não foi possível ler o estado do automático. Enquanto isso, nada sai sozinho.'
export function faltaParaLigar(descartes: number, simulacoes: number): string {
  const partes: string[] = []
  if (descartes < 3) partes.push(`${3 - descartes} ${3 - descartes === 1 ? 'saída feita' : 'saídas feitas'} por você (${descartes} de 3)`)
  if (simulacoes < 2) partes.push(`${2 - simulacoes} ${2 - simulacoes === 1 ? 'simulação vista' : 'simulações vistas'} (${simulacoes} de 2)`)
  return `Falta: ${partes.join(' e ')}.`
}
```

(O motivo 11 do mockup traz o motivo da recusa depois dos dois-pontos; o componente compõe `MOTIVOS['11'].texto(mes)` + " " + `fraseDaFalta(detalhe.faltam[0])` quando o `detalhe` tiver a lista. O teste do motivo 11 fica na peça.)

- [ ] **Step 4: As peças (componentes cliente)**

`peca-tirar-mes.tsx` recebe por props `{ tabela, mes, estado: EstadoDoMes | null, hojeSP, pctDoBanco, ehAdmin, acoes: { simular, tirar, liberar, trazer }, soBloco?: boolean }` (`soBloco`: desenha só o bloco de ação, sem a frase da linha, porque a M5 já a escreve; ver Tarefa 12b) (as ações são passadas pelo encaixe da Tarefa 12b, que roda no servidor e as importa de `acoes.ts`), e desenha, na ordem do mockup:
1. **T1/T3** (online): a lista de `fraseDaFalta` (ícone "tri" para faltas de cópia, "pont" para `ainda_na_janela`, como em `COND`); os botões "Tirar <mês> do banco online" (desabilitado com faltas) e "Ver o que sairia"; a simulação abre com a marca "simulação, nada foi tirado" e a frase de `fraseDaSimulacao`.
2. O diálogo de confirmação: título "Tirar <mês> do banco online?", o texto `DOIS` (com a data de liberar) ou `QUARTA` (um passo) copiado de `arquivo.js:171-174`, botões "Tirar <mês> do banco" e "Cancelar" (o foco abre em "Cancelar").
3. Durante a chamada: "Conferindo o banco contra o arquivo", depois "Tirando" (T5); `aria-busy`.
4. **T7/T7a/T7b** (destacado): `fraseDaLinhaDestacada`; botões "Trazer de volta" e "Liberar o espaço" (este só a partir da data); o diálogo T8 ("Liberar o espaço de <mês>?", "Depois disso não dá mais para trazer de volta pelo site. Isto libera cerca de N% do banco. O dado continua no NAS e no B2.", botão "Liberar o espaço").
5. **T9**: "Saiu em dd/mm/aaaa às hh:mm. Liberou N% do banco".
6. O retorno de cada ação: `fraseDoRetorno`, com `role="status"` (ok/aviso) ou `role="alert"` (erro).
7. Quem não administra vê o estado e as frases, sem botões, e a linha "Quem administra o site tira um mês do banco."

`peca-interruptor.tsx` (M6a, mínimo) recebe `{ classe, estado: EstadoInterruptor | null, envOn, hojeSP, ehAdmin }` e desenha o título (`tituloDoInterruptor`) e, por estado: `null` mostra `NAO_MEDIDO` (nunca "pode ligar"); `nao_existe` só o título; `nao_pode` mostra as barras "Saídas feitas por você" (de 3) e "Simulações vistas" (de 2) e a linha de `faltaParaLigar`. **Não há botão de ligar nesta etapa**: quando os dois contadores já bastam (`descartes >= 3` e `simulacoes >= 2`), a peça diz "O automático chega na próxima etapa." e nada mais. A Tarefa 12c [M6b] troca isto pelo componente completo (props `acoes`, diálogo de ligar, motivos, `chip-automatico.tsx`).

O teste dos componentes (`arquivo-pecas-saida.test.tsx`, jsdom, `@testing-library/react`):

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PecaTirarMes } from '@/app/cms/(authed)/youtube/competitors/_arquivo-saida/peca-tirar-mes'
import { PecaInterruptor } from '@/app/cms/(authed)/youtube/competitors/_arquivo-saida/peca-interruptor'

const ONLINE = { estado: 'online' as const, faltam: [], descartes: 0, dois_passos: true }
const acoes = () => ({ simular: vi.fn(async () => ({ ok: true, resposta: { tipo: 'simulado' as const, linhas: 10, bytes: null, canais: 1, fracao: 0.1, canalSemUnidade: false } })),
  tirar: vi.fn(async () => ({ ok: true, resposta: { tipo: 'ok' as const, linhas: 10, bytes: null } })), liberar: vi.fn(), trazer: vi.fn() })

describe('peça 3', () => {
  it('94: tirar pede confirmação com foco em Cancelar; só depois chama a ação', async () => {
    const a = acoes()
    render(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={ONLINE} hojeSP="2028-05-02" pctDoBanco={4} ehAdmin acoes={a} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tirar outubro de 2027 do banco online' }))
    expect(screen.getByRole('dialog', { name: 'Tirar outubro de 2027 do banco online?' })).toBeTruthy()
    expect(document.activeElement?.textContent).toBe('Cancelar')
    expect(a.tirar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Tirar outubro de 2027 do banco' }))
    await waitFor(() => expect(a.tirar).toHaveBeenCalledWith('competitor_video_daily', '2027-10-01'))
  })
  it('com faltas, o botão de tirar fica desabilitado e as frases aparecem; editor não vê botão', () => {
    const { rerender } = render(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={{ ...ONLINE, faltam: [{ codigo: 'b2_sem_atestacao', motivo: 'prazo', dias_forja: 9 }] }} hojeSP="2028-05-02" pctDoBanco={4} ehAdmin acoes={acoes()} />)
    expect((screen.getByRole('button', { name: 'Tirar outubro de 2027 do banco online' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('A forja não confere o B2 há 9 dias.')).toBeTruthy()
    rerender(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={ONLINE} hojeSP="2028-05-02" pctDoBanco={4} ehAdmin={false} acoes={acoes()} />)
    expect(screen.queryByRole('button', { name: /Tirar/ })).toBeNull()
  })
  it('estado não lido: diz que não leu, sem botão (nunca "pode sair")', () => {
    render(<PecaTirarMes tabela="competitor_video_daily" mes="2027-10-01" estado={null} hojeSP="2028-05-02" pctDoBanco={null} ehAdmin acoes={acoes()} />)
    expect(screen.getByText('Não foi possível ler o estado deste mês. Nada foi tirado.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Tirar/ })).toBeNull()
  })
})
describe('peça 4 (mínima, M6a)', () => {
  it('não medido: frase de não medido e nenhum botão de ligar', () => {
    render(<PecaInterruptor classe="serie" estado={null} envOn hojeSP="2028-05-02" ehAdmin />)
    expect(screen.getByText('Automático: não medido')).toBeTruthy()
    expect(screen.getByText('Não foi possível ler o estado do automático. Enquanto isso, nada sai sozinho.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Ligar/ })).toBeNull()
  })
  it('nao_pode: mostra o que falta e nenhum botão; com os contadores cheios, diz que o automático chega na próxima etapa', () => {
    const { rerender } = render(<PecaInterruptor classe="serie" estado={{ estado: 'nao_pode', descartes: 1, simulacoes: 0 }} envOn hojeSP="2028-05-02" ehAdmin />)
    expect(screen.getByText('Falta: 2 saídas feitas por você (1 de 3) e 2 simulações vistas (0 de 2).')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    rerender(<PecaInterruptor classe="serie" estado={{ estado: 'nao_pode', descartes: 3, simulacoes: 2 }} envOn hojeSP="2028-05-02" ehAdmin />)
    expect(screen.getByText('O automático chega na próxima etapa.')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
```

(O nome do botão de confirmar do diálogo de ligar no mockup é conferido em `interruptor.js` pelo executor; se for outro, o teste usa o do mockup.)

- [ ] **Step 5: Rodar e ver passar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/arquivo-frases-saida.test.ts test/youtube/observatorio/arquivo-interruptor.test.ts test/youtube/observatorio/arquivo-pecas-saida.test.tsx > /tmp/m6-t12.log 2>&1; grep -E "FAIL|Tests " /tmp/m6-t12.log` e o typecheck.
Expected: PASS.

- [ ] **Step 6: Revisão de tela (Logan, Naksu, Gio) antes de ir ao dono**

As peças só têm rota depois da Tarefa 12b (o encaixe é da M6, D-M5-14); a validação na página real é da 12b. Para esta revisão, o Gio monta cada estado com dados falsos num teste jsdom de captura (`arquivo-pecas-saida.captura.test.tsx`, fora do commit, no disco do executor), grava o HTML de cada estado em `docs/superpowers/mockups/2026-10-14-manutencao-nas/m6-implementado/` e compara com o mockup aberto no navegador, lado a lado, a 390 px e a 1440 px, claro e escuro (T1, T3, simulação, diálogo, T5, T6, T7, T7a, T7b, T8, T8r, T8x, T9, T10, T10b, T10c, T10d, T11; peça 4 em não medido, não existe e não pode; os 9 títulos e os 14 motivos são da 12c). Logan revisa o fluxo e a frase proposta do R27 (`TEXTO_SAIDA_FORA_DE_ORDEM`), Naksu o desenho contra os tokens. Os pareceres vão para `docs/superpowers/mockups/2026-10-14-manutencao-nas/` como `REVISAO-LOGAN-M6-1.md`, `REVISAO-NAKSU-M6-1.md` e `REVISAO-GIO-M6-1.md`; defeito volta para esta tarefa antes do commit. A validação autenticada na página real é da Tarefa 12b.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/youtube/observatorio/arquivo-mensal/frases-saida.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/interruptor.ts "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/peca-tirar-mes.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/peca-interruptor.tsx" apps/web/test/youtube/observatorio/arquivo-frases-saida.test.ts apps/web/test/youtube/observatorio/arquivo-interruptor.test.ts apps/web/test/youtube/observatorio/arquivo-pecas-saida.test.tsx
git commit -m "feat: M6a: frases e peças da tela da saída (tirar um mês e a peça 4 mínima), com os literais do mockup aprovado

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/frases-saida.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/interruptor.ts "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/peca-tirar-mes.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/peca-interruptor.tsx" apps/web/test/youtube/observatorio/arquivo-frases-saida.test.ts apps/web/test/youtube/observatorio/arquivo-interruptor.test.ts apps/web/test/youtube/observatorio/arquivo-pecas-saida.test.tsx
```

---
### Task 12b [M6a]: O encaixe das peças na página do Arquivo da M5 (D-M5-14)

A M5 entrega a página com slots `acoes?: ReactNode` em `LinhaDoMes` e `CartaoDoTipo` e nunca importa `_arquivo-saida/` (D-M5-14). Quem preenche os slots é esta tarefa, no servidor, depois de `montarPagina` (que segue `.ts` puro, sem React). `released` das classes `serie` e `horaria` é da migration da M5; o encaixe é daqui. Os pedidos à M5 estão em `.superpowers/sdd/manutencao-nas/pedidos-m6-para-m5.md`.

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/encaixar.ts` (servidor, `import 'server-only'`)
- Modify (código da M5): `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo/montar.ts` (uma chamada, depois de `montarPagina`) e `apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts` (`SAIDA_DE_MES_EXISTE = true`, D-M5-15: no MESMO commit da primeira função de saída, que é o da Tarefa 14; aqui só se confere que o teste das duas posições da M5 passa)
- Create: `apps/web/test/youtube/observatorio/arquivo-saida-encaixar.test.tsx` (node, sem DOM: confere as props dos elementos devolvidos e a contagem de chamadas)

**Interfaces:**
- Consumes: `ModeloPagina`, `LinhaDoMes`, `CartaoDoTipo` (M5, `estado-do-mes.ts`); da M5 (pedidos, ver abaixo) `LinhaDoMes.tabela`, `LinhaDoMes.mes` (`'AAAA-MM-01'`), `LinhaDoMes.fora: 'online' | 'destacado' | 'descartado'`, `ModeloPagina.hojeSP` e `ModeloPagina.teste.acoes?: ReactNode`; `lerEstadoDoMes`, `lerInterruptor`, `TABELAS_DA_SAIDA` (Tarefa 11); `PecaTirarMes`, `PecaInterruptor` (Tarefa 12); `simularSaida`, `tirarMes`, `liberarEspaco`, `trazerDeVolta` (Tarefa 11).
- Produces: `encaixarSaida(modelo: ModeloPagina, ctx: { sb: SupabaseClient; site: string; por: string; ehAdmin: boolean }): Promise<ModeloPagina>`; devolve um modelo novo (não muta o da M5), com `acoes` preenchido em linhas e cartões.

**Pré-condição (se a M5 ainda não pôs os campos):** `grep -n "tabela\|fora\|hojeSP" apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-do-mes.ts`. Se faltarem, a mudança é aditiva e entra no mesmo commit desta tarefa: `montarPagina` copia `tabela`, `mes` (de `meses[].month`) e `fora` (`dropped_at` → `descartado`, senão `detached_at` → `destacado`, senão `online`) para cada `LinhaDoMes`, e `hojeSP = pagina.hoje`; o teste da M5 (`arquivo-estado-do-mes.test.ts`) ganha só asserções dos campos novos. Não mudar nenhum outro comportamento da M5.

**O que acontece quando o dado não existe:** `lerEstadoDoMes` volta `null` (banco não respondeu) → a linha recebe a peça com `estado={null}`, que diz "Não foi possível ler o estado deste mês. Nada foi tirado." e nenhum botão (nunca "pode sair"); `lerInterruptor` volta `null` → a peça 4 diz "não medido". Linha sem `tabela`/`mes` (M5 antiga) → sem `acoes`, a página fica como a M5 a entrega. Quem só edita (`!ehAdmin`) vê as frases e nenhum botão.

**Regra de leitura (sem N+1).** Por tabela de série (`competitor_video_daily`, `competitor_video_hourly`; as de `ensaio` entram no grupo de teste) a linha que oferece "Tirar do banco" é só o **mês online mais antigo** (a saída é do mais antigo para o mais novo; as demais linhas online não têm botão, mostram a frase `saida_fora_de_ordem` já presente na falta do mês mais antigo). Leem-se: 1 `lerEstadoDoMes` por tabela (o mais antigo online), 1 por mês **destacado** (precisam de `liberar_a_partir`), e 1 `lerInterruptor` por classe (2). Tudo em `Promise.all`. Total: `T + destacados + 2` chamadas ao banco, qualquer que seja o número de meses da página.

- [ ] **Step 1: O teste (falha)**

```tsx
// apps/web/test/youtube/observatorio/arquivo-saida-encaixar.test.tsx
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import type { ModeloPagina, LinhaDoMes } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'

vi.mock('server-only', () => ({}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes', () => ({ simularSaida: vi.fn(), tirarMes: vi.fn(), liberarEspaco: vi.fn(), trazerDeVolta: vi.fn() }))
import { encaixarSaida } from '@/app/cms/(authed)/youtube/competitors/_arquivo-saida/encaixar'

const linha = (tabela: string, mes: string, fora: 'online' | 'destacado' | 'descartado'): LinhaDoMes =>
  ({ chave: `${tabela}|${mes}`, tabela, mes, fora, mesNome: mes, regua: [], frase: 'x', secundaria: null, gravidade: 'nenhuma', sobeAoTopo: false })
const mes12 = (tabela: string): LinhaDoMes[] => Array.from({ length: 12 }, (_, i) => linha(tabela, `2027-${String(i + 1).padStart(2, '0')}-01`, 'online'))
const modelo = (extra: LinhaDoMes[] = []): ModeloPagina => ({ hojeSP: '2028-05-02', resumo: { texto: 'r', forma: 'visto' }, casa: { estado: 'responde', desde: null, forma: 'visto', frase: '' }, problemas: [], mesesAFrente: [], teste: null, ligado: true,
  tipos: [{ tipo: 'serie', titulo: 'Views por dia', resumo: '', anosNoArquivo: [], linhas: [...mes12('competitor_video_daily'), ...extra] }, { tipo: 'horaria', titulo: 'Hora em hora', resumo: '', anosNoArquivo: [], linhas: mes12('competitor_video_hourly') }] })
function sb() {
  const rpc = vi.fn(async (fn: string) => fn === 'obs_archive_exit_check'
    ? { data: { estado: 'online', faltam: [], descartes: 0, dois_passos: true }, error: null }
    : { data: { descartes: 1, simulacoes: 0 }, error: null })
  return { rpc, client: { rpc } as never }
}

describe('encaixarSaida (D-M5-14)', () => {
  it('12 meses por tabela: só o mais antigo online ganha a peça 3; chamadas = T + destacados + 2', async () => {
    const { rpc, client } = sb()
    const out = await encaixarSaida(modelo(), { sb: client, site: 's', por: 'u', ehAdmin: true })
    const serie = out.tipos[0]!.linhas
    expect(serie.filter(l => l.acoes).map(l => l.mes)).toEqual(['2027-01-01'])
    expect(rpc).toHaveBeenCalledTimes(2 + 0 + 2)
  })
  it('com 24 meses por tabela e 1 destacado a conta é a mesma regra, sem passar de T + destacados + 2', async () => {
    const { rpc, client } = sb()
    const m = modelo(); m.tipos[0]!.linhas = [linha('competitor_video_daily', '2026-12-01', 'destacado'), ...m.tipos[0]!.linhas, ...mes12('competitor_video_daily').map(l => ({ ...l, mes: l.mes.replace('2027', '2028'), chave: l.chave + 'b' }))]
    await encaixarSaida(m, { sb: client, site: 's', por: 'u', ehAdmin: true })
    expect(rpc.mock.calls.length).toBeLessThanOrEqual(2 + 1 + 2)
  })
  it('leitura nula: a peça recebe estado null; quem não administra não recebe ação', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'x' } }))
    const out = await encaixarSaida(modelo(), { sb: { rpc } as never, site: 's', por: 'u', ehAdmin: false })
    expect(out.tipos[0]!.linhas[0]!.acoes).toBeTruthy()   // a peça existe, em modo leitura/não lido
    const props = (out.tipos[0]!.linhas[0]!.acoes as { props: { estado: unknown; ehAdmin: boolean } }).props
    expect(props.estado).toBeNull(); expect(props.ehAdmin).toBe(false)
  })
  it('a frase da linha destacada da M5 fica; o encaixe só acrescenta o bloco de ação', async () => {
    const { client } = sb()
    const m = modelo(); m.tipos[0]!.linhas[0] = { ...m.tipos[0]!.linhas[0]!, fora: 'destacado', frase: 'FRASE DA M5' }
    const out = await encaixarSaida(m, { sb: client, site: 's', por: 'u', ehAdmin: true })
    expect(out.tipos[0]!.linhas[0]!.frase).toBe('FRASE DA M5')
  })
  it('não muta o modelo da M5', async () => {
    const { client } = sb(); const m = modelo()
    await encaixarSaida(m, { sb: client, site: 's', por: 'u', ehAdmin: true })
    expect(m.tipos[0]!.linhas.every(l => l.acoes === undefined)).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/arquivo-saida-encaixar.test.tsx > /tmp/m6-t12b.log 2>&1; grep -E "FAIL|Tests " /tmp/m6-t12b.log`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: O encaixe**

```tsx
// apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/encaixar.ts
import 'server-only'
import { createElement } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CartaoDoTipo, LinhaDoMes, ModeloPagina } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { lerEstadoDoMes, lerInterruptor, type EstadoDoMes, type TabelaDaSaida } from '@/lib/youtube/observatorio/arquivo-mensal/saida'
import { PecaTirarMes } from './peca-tirar-mes'
import { PecaInterruptor } from './peca-interruptor'
import { simularSaida, tirarMes, liberarEspaco, trazerDeVolta } from './acoes'

const ACOES = { simular: simularSaida, tirar: tirarMes, liberar: liberarEspaco, trazer: trazerDeVolta }
interface Ctx { sb: SupabaseClient; site: string; por: string; ehAdmin: boolean }
const temTabela = (l: LinhaDoMes): l is LinhaDoMes & { tabela: TabelaDaSaida; mes: string; fora: 'online' | 'destacado' | 'descartado' } => !!l.tabela && !!l.mes && !!l.fora

/** Lê o estado de cada mês que oferece ação: o online mais antigo de cada tabela e os destacados. Nunca um por linha. */
async function lerEstados(linhas: LinhaDoMes[], c: Ctx): Promise<Map<string, EstadoDoMes | null>> {
  const alvos = new Map<string, LinhaDoMes & { tabela: TabelaDaSaida; mes: string }>()
  const maisAntigo = new Map<string, LinhaDoMes & { tabela: TabelaDaSaida; mes: string }>()
  for (const l of linhas.filter(temTabela)) {
    if (l.fora === 'destacado') alvos.set(l.chave, l)
    if (l.fora === 'online') { const a = maisAntigo.get(l.tabela); if (!a || l.mes < a.mes) maisAntigo.set(l.tabela, l) }
  }
  for (const l of maisAntigo.values()) alvos.set(l.chave, l)
  const lidos = await Promise.all([...alvos.values()].map(async l => [l.chave, await lerEstadoDoMes(c.sb, c.site, l.tabela, l.mes, c.por)] as const))
  return new Map(lidos)
}

export async function encaixarSaida(modelo: ModeloPagina, c: Ctx): Promise<ModeloPagina> {
  const todas = [...modelo.tipos.flatMap(t => t.linhas), ...(modelo.teste?.linhas ?? [])]
  const [estados, serie, horaria] = await Promise.all([lerEstados(todas, c), lerInterruptor(c.sb, c.site, 'serie'), lerInterruptor(c.sb, c.site, 'horaria')])
  const linhaComAcao = (l: LinhaDoMes): LinhaDoMes => {
    if (!temTabela(l) || l.fora === 'descartado' || (l.fora === 'online' && !estados.has(l.chave))) return l   // online que não é o mais antigo: sem botão
    return { ...l, acoes: createElement(PecaTirarMes, { tabela: l.tabela, mes: l.mes, estado: estados.get(l.chave) ?? null, hojeSP: modelo.hojeSP, pctDoBanco: null, ehAdmin: c.ehAdmin, acoes: ACOES, soBloco: true }) }
  }
  const cartao = (t: CartaoDoTipo): CartaoDoTipo => t.tipo === 'texto' ? t : {
    ...t, linhas: t.linhas.map(linhaComAcao),
    acoes: createElement(PecaInterruptor, { classe: t.tipo, estado: t.tipo === 'serie' ? serie : horaria, envOn: true, hojeSP: modelo.hojeSP, ehAdmin: c.ehAdmin }),
  }
  return { ...modelo, tipos: modelo.tipos.map(cartao), teste: modelo.teste && { ...modelo.teste, linhas: modelo.teste.linhas.map(linhaComAcao) } }
}
```

Notas ao executor: (1) `soBloco: true` faz a peça 3 desenhar só o bloco de ação (botões, diálogos, retorno), sem repetir a frase da linha que a M5 já escreve em `estado-do-mes`; `fraseDaLinhaDestacada` da M6 só aparece no bloco quando a linha da M5 não traz a frase da data (teste de componente da Tarefa 12 acrescenta `soBloco`). (2) `pctDoBanco: null` até a medida existir (a frase omite o "devolve cerca de N%"). (3) `envOn` é lido de `autoDropLigado()` na Tarefa 12c; aqui a peça 4 mínima não o usa. (4) Em `montar.ts`, depois de `montarPagina(...)`: `modelo = await encaixarSaida(modelo, { sb: getSupabaseServiceClient(), site: siteId, por: user.id, ehAdmin: acesso === 'administra' })`, só quando `acesso !== 'so_le'` e o arquivo está ligado; falha de `encaixarSaida` (exceção) devolve o modelo da M5 sem `acoes` (try/catch com `captureException`).

- [ ] **Step 4: Rodar e ver passar; typecheck**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/arquivo-saida-encaixar.test.tsx test/youtube/observatorio/arquivo-montar.test.ts test/youtube/observatorio/arquivo-pagina.test.tsx > /tmp/m6-t12b.log 2>&1; grep -E "FAIL|Tests " /tmp/m6-t12b.log; npm run typecheck -w apps/web > /tmp/m6-t12b-tc.log 2>&1; tail -5 /tmp/m6-t12b-tc.log`
Expected: PASS (os testes da M5 seguem verdes: o encaixe é aditivo).

- [ ] **Step 5: Validação autenticada na página real (Gio)**

Com o banco de integração da Tarefa 14 aplicado e a página `/cms/youtube/competitors/arquivo` aberta como administrador (`docs/ops/runbook-cms-e2e-local.md`): o mês online mais antigo de cada tabela tem "Tirar do banco" e "Ver o que sairia"; os outros meses online não têm botão; o editor vê o estado sem botão; a peça 4 de cada cartão mostra o que falta. Captura em `docs/superpowers/mockups/2026-10-14-manutencao-nas/m6-implementado/`.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/encaixar.ts" "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo/montar.ts" apps/web/test/youtube/observatorio/arquivo-saida-encaixar.test.tsx
git commit -m "feat: M6a: encaixe das peças de saída nos slots da página do Arquivo (D-M5-14)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/encaixar.ts" "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo/montar.ts" apps/web/test/youtube/observatorio/arquivo-saida-encaixar.test.tsx
```

(Se a pré-condição exigiu editar `estado-do-mes.ts` e seu teste, esses dois caminhos entram no `git add` e no `--`.)

---
### Task 12c [M6b]: Os motivos, a frase de ligar, o diálogo e o chip do automático

Completa `interruptor.ts` (Tarefa 12) com tudo o que só existe quando o automático existe, e troca a peça 4 mínima pelo componente completo. Espera: Tarefa 11b (ações do interruptor), Tarefa 12, Tarefa 12b.

**Files:**
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/interruptor.ts` (acrescentar `FRASE_DE_LIGAR`, `fraseConfere`, `FRASE_NAO_CONFERE`, `CALMA`, `ESPERA`, `PARA_LIGAR_DE_NOVO`, `IdMotivo`, `MOTIVOS`, `idDoMotivo`; **se a Tarefa 11b veio antes**, esse arquivo já tem `FRASE_DE_LIGAR` e `fraseConfere`: não duplicar)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/peca-interruptor.tsx` (props ganham `acoes: { ligar, desligar, marcarVisto }`; estados `desligado`, `ligado`, `desligou_sozinho`, `venceu`; diálogo de ligar)
- Create: `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/chip-automatico.tsx` (`'use client'`)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/encaixar.ts` (passa `acoes` do interruptor e `envOn = autoDropLigado()`)
- Modify: `apps/web/test/youtube/observatorio/arquivo-interruptor.test.ts` (acrescenta os testes abaixo) e Create `apps/web/test/youtube/observatorio/arquivo-peca-interruptor.test.tsx` (jsdom)

**Interfaces:**
- Produces: tudo o que a Tarefa 12 listou como "Tarefa 12c": `FRASE_DE_LIGAR`, `fraseConfere`, `MOTIVOS`, `idDoMotivo`, `CALMA`, `ESPERA`, `PARA_LIGAR_DE_NOVO`, `FRASE_NAO_CONFERE`.

**O que acontece quando o dado não existe:** estado do interruptor nulo → "Automático: não medido" e nenhum botão; motivo desconhecido (`idDoMotivo` nulo) → o título "desligou sozinho em dd/mm" sem texto de motivo e o aviso "Veja o aviso do banco"; nunca o código bruto.

- [ ] **Step 1: Os testes (falham)**

Acrescentar ao `describe` de `arquivo-interruptor.test.ts` (e trocar o import por `import { MOTIVOS, idDoMotivo, tituloDoInterruptor, faltaParaLigar, fraseConfere, FRASE_DE_LIGAR, CALMA, ESPERA } from ...`):

```ts
  it('a frase de ligar e a conferência sem maiúscula, acento nem espaço sobrando', () => {
    expect(FRASE_DE_LIGAR).toEqual({ serie: 'ligar automático de views por dia', horaria: 'ligar automático de leitura de hora em hora' })
    expect(fraseConfere('  Ligar AUTOMATICO de views   por dia ', FRASE_DE_LIGAR.serie)).toBe(true)
    expect(fraseConfere('ligar automático', FRASE_DE_LIGAR.serie)).toBe(false)
    expect(fraseConfere('', FRASE_DE_LIGAR.serie)).toBe(false)
  })
  it('os 14 motivos do mockup, com "pode esperar" nos mesmos', () => {
    expect(Object.keys(MOTIVOS).sort()).toEqual(['1', '10', '11', '13', '2', '2v', '3', '3b', '4', '5', '6', '7', '8', '9'].sort())
    expect(Object.entries(MOTIVOS).filter(([, m]) => m.podeEsperar).map(([k]) => k).sort()).toEqual(['10', '13', '2', '3', '3b', '4'].sort())
    expect(MOTIVOS['1'].texto('outubro de 2027')).toBe('O arquivo de outubro de 2027 ficou diferente do que o site guardou. Nada sai até você resolver.')
    expect(MOTIVOS['8'].texto()).toBe('A validade de 90 dias acabou. Nada deu errado.')
    expect(MOTIVOS['13'].texto('outubro de 2027')).toBe('A forja e o seu Mac deram respostas diferentes sobre a cópia de outubro de 2027 no B2. Nada sai sozinho até você olhar.')
    expect(CALMA).toBe('Nada saiu do banco por causa disso, e nada sai até você ligar de novo.')
    expect(ESPERA).toBe('Pode esperar: se você está fora de casa, resolva quando voltar.')
  })
  it('3 com detalhe.b2 é 3b; manual não é motivo de aviso', () => {
    expect(idDoMotivo({ estado: 'desligou_sozinho', motivo: '3', detalhe: { b2: true } })).toBe('3b')
    expect(idDoMotivo({ estado: 'desligou_sozinho', motivo: '3', detalhe: { nas: true } })).toBe('3')
    expect(idDoMotivo({ estado: 'desligado' })).toBeNull()
  })
```

E o teste de componente, em `arquivo-peca-interruptor.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PecaInterruptor } from '@/app/cms/(authed)/youtube/competitors/_arquivo-saida/peca-interruptor'

describe('peça 4 completa (M6b)', () => {
  it('ligar: o botão de confirmar só libera com a frase certa; frase errada mostra a ajuda', async () => {
    const ligar = vi.fn(async () => ({ ok: true }))
    render(<PecaInterruptor classe="serie" estado={{ estado: 'desligado', descartes: 3, simulacoes: 2 }} envOn hojeSP="2028-05-02" ehAdmin acoes={{ ligar, desligar: vi.fn(), marcarVisto: vi.fn() }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ligar o automático…' }))
    const campo = screen.getByRole('textbox')
    fireEvent.change(campo, { target: { value: 'ligar automatico' } })
    expect(screen.getByText('Ainda não bate com a frase. Maiúscula e acento não importam.')).toBeTruthy()
    fireEvent.change(campo, { target: { value: 'Ligar automático de views por dia' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ligar' }))
    await waitFor(() => expect(ligar).toHaveBeenCalledWith('serie', 'Ligar automático de views por dia'))
  })
  it('chip: desligou sozinho e não visto mostra "automático desligou em dd/mm"', () => {
    render(<PecaInterruptor classe="serie" estado={{ estado: 'desligou_sozinho', motivo: '8', desligado_em: '2028-05-02T12:00:00Z', visto: false }} envOn hojeSP="2028-05-03" ehAdmin
      acoes={{ ligar: vi.fn(), desligar: vi.fn(), marcarVisto: vi.fn() }} />)
    expect(screen.getByText(/automático desligou em 02\/05/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/arquivo-interruptor.test.ts test/youtube/observatorio/arquivo-peca-interruptor.test.tsx > /tmp/m6-t12c.log 2>&1; grep -E "FAIL|Tests " /tmp/m6-t12c.log`
Expected: FAIL.

- [ ] **Step 3: O que se acrescenta a `interruptor.ts`**

```ts
// acrescentar ao final de apps/web/src/lib/youtube/observatorio/arquivo-mensal/interruptor.ts
export const FRASE_DE_LIGAR = { serie: 'ligar automático de views por dia', horaria: 'ligar automático de leitura de hora em hora' } as const
const normal = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
export function fraseConfere(digitado: string, frase: string): boolean { const a = normal(digitado); return a !== '' && a === normal(frase) }
export const FRASE_NAO_CONFERE = 'Ainda não bate com a frase. Maiúscula e acento não importam.'
export const CALMA = 'Nada saiu do banco por causa disso, e nada sai até você ligar de novo.'
export const ESPERA = 'Pode esperar: se você está fora de casa, resolva quando voltar.'
export const PARA_LIGAR_DE_NOVO = 'Para ligar de novo: veja o que sairia (uma vez) e digite a frase. Ele não liga sozinho.'

export type IdMotivo = '1' | '2' | '2v' | '3' | '3b' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '13'
interface Motivo { titulo: string; texto: (mes?: string, data?: string) => string; fazer: (mes?: string, data?: string) => string; podeEsperar: boolean }
export const MOTIVOS: Record<IdMotivo, Motivo> = {
  '1': { titulo: 'O arquivo de um mês ficou diferente', texto: m => `O arquivo de ${m} ficou diferente do que o site guardou. Nada sai até você resolver.`, fazer: m => `Abra a linha de ${m} na lista abaixo e leia o aviso dela.`, podeEsperar: false },
  '2': { titulo: 'A casa ficou mais de 36 horas sem responder', texto: () => 'A casa ficou mais de 36 horas sem responder. Veja o que fazer no aviso da casa.', fazer: () => 'Veja o aviso da casa no topo desta página e espere ela voltar.', podeEsperar: true },
  '2v': { titulo: 'A casa ficou mais de 36 horas sem responder', texto: () => 'A casa ficou mais de 36 horas sem responder. Veja o que fazer no aviso da casa.', fazer: (_m, d) => `A casa voltou a responder em ${d}. Veja o que sairia e ligue de novo quando quiser.`, podeEsperar: false },
  '3': { titulo: 'A cópia ficou sem verificação duas vezes seguidas (no NAS)', texto: m => `A cópia de ${m} ficou sem verificação em duas rodadas seguidas. Veja se a casa está respondendo.`, fazer: () => 'Veja se a forja e o NAS estão ligados e respondendo.', podeEsperar: true },
  '3b': { titulo: 'A cópia ficou sem verificação duas vezes seguidas (no B2)', texto: m => `A forja ficou sem conferir o B2 de ${m} por mais de 7 dias, duas vezes seguidas.`, fazer: () => 'Veja se a forja está ligada e conferindo o B2.', podeEsperar: true },
  '4': { titulo: 'A cópia atrasou mais de 30 dias', texto: () => 'A cópia atrasou mais de 30 dias.', fazer: () => 'Veja o aviso da linha do mês atrasado; se a casa também estiver fora, o aviso dela está no topo desta página.', podeEsperar: true },
  '5': { titulo: 'O banco passou de 85%', texto: () => 'O banco passou de 85%: agora quem decide é você; veja o que pode sair.', fazer: () => 'Veja na lista abaixo o que pode sair e tire pelo botão de cada mês.', podeEsperar: false },
  '6': { titulo: 'O banco não pôde ser medido hoje', texto: () => 'Não foi possível medir o banco hoje.', fazer: () => 'Veja o aviso do banco no topo; a medida é refeita na próxima leitura.', podeEsperar: false },
  '7': { titulo: 'Mais de um mês sairia no mesmo dia', texto: () => 'O automático tentou tirar mais de um mês no mesmo dia e parou.', fazer: () => 'Veja na lista abaixo quais meses saíram hoje antes de ligar de novo.', podeEsperar: false },
  '8': { titulo: 'A validade de 90 dias acabou', texto: () => 'A validade de 90 dias acabou. Nada deu errado.', fazer: () => 'Ligue de novo quando quiser.', podeEsperar: false },
  '9': { titulo: 'Foi desligado na configuração do site', texto: () => 'O automático foi desligado na configuração do site.', fazer: () => 'Você liga de volta na configuração do site (veja o ⓘ); sem isso não dá para ligar aqui.', podeEsperar: false },
  '10': { titulo: 'A conferência do B2 falhou', texto: (m, d) => `A conferência do B2 de ${m} falhou em ${d}: faltam arquivos.`, fazer: m => `Na linha de ${m}, use “Ver o comando” e rode a conferência do B2 de novo.`, podeEsperar: true },
  '11': { titulo: 'O banco recusou tirar um mês', texto: m => `O banco recusou tirar ${m}.`, fazer: () => 'Leia o motivo acima. Se não entender, anote a frase e deixe para quando voltar.', podeEsperar: false },
  '13': { titulo: 'A forja e o seu Mac discordaram sobre o B2', texto: m => `A forja e o seu Mac deram respostas diferentes sobre a cópia de ${m} no B2. Nada sai sozinho até você olhar.`, fazer: m => `Na linha de ${m}, use “Ver o comando” e rode a conferência no seu Mac; compare com a da forja.`, podeEsperar: true },
}

export function idDoMotivo(e: EstadoInterruptor, copiadorVoltou = false): IdMotivo | null {
  if (e.estado !== 'desligou_sozinho' && e.estado !== 'venceu') return null
  const m = e.motivo
  if (m === '3') return (e.detalhe as { b2?: boolean } | null | undefined)?.b2 ? '3b' : '3'
  if (m === '2') return copiadorVoltou ? '2v' : '2'
  return m && m in MOTIVOS ? (m as IdMotivo) : null
}
```

(O motivo 11 do mockup traz o motivo da recusa depois dos dois-pontos; o componente compõe `MOTIVOS['11'].texto(mes)` + " " + `fraseDaFalta(detalhe.faltam[0])` quando o `detalhe` tiver a lista. O motivo 7 do mockup diz "no mesmo dia"; o banco o dispara por mais de um descarte automático da classe no mesmo **dia de São Paulo** (Decisão 9), e o texto não cita 24 horas.)

- [ ] **Step 4: A peça 4 completa e o chip**

`peca-interruptor.tsx` passa a receber `{ classe, estado: EstadoInterruptor | null, envOn, hojeSP, ehAdmin, acoes: { ligar, desligar, marcarVisto } }` e desenha título (`tituloDoInterruptor`), as barras "Saídas feitas por você" (de 3) e "Simulações vistas" (de 2) no estado `nao_pode`, o aviso do motivo (`MOTIVOS`, `CALMA`, `ESPERA` quando `podeEsperar`, `PARA_LIGAR_DE_NOVO`), o diálogo de ligar (a regra `DESLIGA` em 4 linhas, o campo da frase, `FRASE_NAO_CONFERE` em `aria-live`), "Ver a regra", "Desligar" e "Ligar de novo" ("Falta ver o que sairia." quando `simulacao_depois` é falso). `chip-automatico.tsx` mostra "automático desligou em dd/mm" quando `idDoMotivo` não é nulo e `visto` é falso.

`chip-automatico.tsx` é um componente cliente pequeno: recebe `{ estado, hojeSP }`, chama `idDoMotivo` e, quando não é nulo e `visto` é falso, mostra "automático desligou em dd/mm" (data de `desligado_em` no dia de São Paulo). O `encaixar.ts` passa `acoes` (de `acoes-interruptor.ts`, Tarefa 11b) e `envOn = autoDropLigado()` à peça; o chip entra no cabeçalho do cartão da classe.

- [ ] **Step 5: Rodar e ver passar; revisão de tela**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/arquivo-interruptor.test.ts test/youtube/observatorio/arquivo-peca-interruptor.test.tsx test/youtube/observatorio/arquivo-pecas-saida.test.tsx > /tmp/m6-t12c.log 2>&1; grep -E "FAIL|Tests " /tmp/m6-t12c.log` e o typecheck.
Expected: PASS. Revisão de Logan, Naksu e Gio como no Step 6 da Tarefa 12, agora com os 9 títulos e os 14 motivos (pareceres `REVISAO-LOGAN-M6-2.md`, `REVISAO-NAKSU-M6-2.md`, `REVISAO-GIO-M6-2.md`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/youtube/observatorio/arquivo-mensal/interruptor.ts "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/peca-interruptor.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/chip-automatico.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/encaixar.ts" apps/web/test/youtube/observatorio/arquivo-interruptor.test.ts apps/web/test/youtube/observatorio/arquivo-peca-interruptor.test.tsx
git commit -m "feat: M6b: motivos, frase de ligar, diálogo e chip do automático

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/interruptor.ts "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/peca-interruptor.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/chip-automatico.tsx" "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/encaixar.ts" apps/web/test/youtube/observatorio/arquivo-interruptor.test.ts apps/web/test/youtube/observatorio/arquivo-peca-interruptor.test.tsx
```

---
### Task 13 [M6a]: A remoção de canal enquanto um mês está em trânsito (D7 e D7r com meses, data e papel)

A M3b deixou o D7/D7r com a frase dos meses e "Nada foi removido." como recusa provisória (`m3b-site.md`, Passo 1 e Passo 4 da tarefa da remoção). Esta tarefa troca pela frase completa do mockup (`remover-canal/rc.js:105-114`), com a data "a partir de dd/mm", o papel (admin ou editor) e o link "(abrir o Arquivo)" só depois da data. Nada é gravado na recusa: nem `competitor_removed_items`, nem `audit_log` (o `competitor_channel_remove` levanta a exceção antes de gravar; o teste de banco da Tarefa 2 já prova; aqui o teste da ação prova que a ação não grava nada por conta própria).

**Files:**
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/frases-remocao.ts` (da M3b)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts` (`removeCompetitorChannel`, versão da M3b). **Emenda 23/10 (Phil N6-2, ponto 3):** a linha 156 é de antes da F1, que reescreveu o fluxo (`pedirRemocao`, `cancelarRemocao`, `apagarCanalSemGuardarAction` em `actions.ts:278` e `remover.ts`); no `origin/staging` não há mais `removeCompetitorChannel`. Reconferir nomes e linhas com `git show origin/staging:apps/web/src/app/cms/\(authed\)/youtube/competitors/actions.ts` antes de editar e aplicar a tarefa ao(s) ponto(s) de entrada de remoção que existirem (as quatro portas: remover, remover sem guardar, desfazer, purge)
- Modify: `apps/web/test/youtube/observatorio/arquivo-mensal-frases-remocao.test.ts` (da M3b)
- Modify: `apps/web/test/youtube/observatorio/canais-add-action.test.ts` (o `describe('removeCompetitorChannel')`)
- Modify (I6, Phil): `apps/web/src/lib/youtube/observatorio/arquivo/codigos.ts:11-24, 32-39` (o código `mes_destacado_em_transito` no catálogo `CodigoE10`) e `apps/web/test/youtube/observatorio/arquivo-codigos.test.ts` (ou o teste de `codigos` que já existe; `grep -rln codigoE10 apps/web/test`)

**Interfaces:**
- Consumes: `lerEmTransito(sb, site): Promise<MesEmTransito[] | null>` e `MesEmTransito` (Tarefa 11); `obs_archive_em_transito(p_site)` (Tarefa 7a); `EntradaDialogo`, `frasesDoDialogo`, `fraseDaRecusaDaRemocao` (M3b).
- Produces:
  - `EntradaDialogo.mesFora` passa a ser `{ meses: 1 | 2; recusadoNoClique: boolean; nomes?: string[]; liberarAPartir?: string; podeAdministrar?: boolean; hojeSP?: string } | null` (campos novos opcionais: o que a M3b já monta continua compilando; sem eles a frase cai na forma da M3b, sem a parte do papel).
  - `fraseDoMesFora(m: NonNullable<EntradaDialogo['mesFora']>): { negrito: string; resto: string; linkArquivo: boolean; info: string }`.
  - `fraseDaRecusaDaRemocao('mes_destacado_em_transito')` devolve `'Não dá para remover canal agora: o mês saiu das telas.'` (o status do mockup); a ação devolve também `mesFora` para o diálogo passar a D7r.
  - `removeCompetitorChannel(id): Promise<{ ok: boolean; error?: string; mesFora?: { meses: 1 | 2; nomes: string[]; liberarAPartir: string } }>`.

**O que acontece quando o dado não existe:** `obs_archive_em_transito` falha ou volta vazio depois da recusa: a ação devolve só a frase de status, sem `mesFora`, e o diálogo mostra o D7r na forma da M3b ("Nada foi removido."); nunca diz "pode remover".

- [ ] **Step 1: Os testes (falham)**

Em `arquivo-mensal-frases-remocao.test.ts`, o import da M3b ganha `fraseDoMesFora` e `fraseDaRecusaDaRemocao`, e dentro de `describe('D4, D5, D7, D9')`:

```ts
it('M6, item 130: D7 com data, papel e link só depois da data', () => {
  const um = { meses: 1 as const, recusadoNoClique: false, nomes: ['2026-10-01'], liberarAPartir: '2026-10-24' }
  expect(fraseDoMesFora({ ...um, podeAdministrar: true, hojeSP: '2026-10-20' })).toEqual({
    negrito: 'Outubro de 2026 saiu das telas e o espaço dele ainda não foi liberado.',
    resto: 'Enquanto isso não dá para remover canal nem apagar vídeo. O espaço só pode ser liberado a partir de 24/10; até lá, o que dá para fazer é trazer o mês de volta.',
    linkArquivo: false,
    info: 'Enquanto o mês pode voltar ao banco, remover o canal deixaria, na volta, registros dele sem canal a que pertencer. “Exportar” continua permitido.',
  })
  expect(fraseDoMesFora({ ...um, podeAdministrar: true, hojeSP: '2026-10-24' })).toMatchObject({
    resto: 'Enquanto isso não dá para remover canal nem apagar vídeo. Você já pode liberar o espaço ou trazer o mês de volta.', linkArquivo: true })
  expect(fraseDoMesFora({ ...um, podeAdministrar: false, hojeSP: '2026-10-20' }).resto)
    .toBe('Enquanto isso não dá para remover canal nem apagar vídeo. O espaço só pode ser liberado a partir de 24/10; até lá, o que dá para fazer é trazer o mês de volta. Quem só edita o site: peça a quem o administra.')
  expect(fraseDoMesFora({ ...um, podeAdministrar: false, hojeSP: '2026-10-25' })).toMatchObject({
    resto: 'Enquanto isso não dá para remover canal nem apagar vídeo. O espaço já pode ser liberado, e o mês também pode voltar, por quem administra o site.', linkArquivo: false })
})
it('D7 com dois meses e D7r', () => {
  const dois = { meses: 2 as const, recusadoNoClique: true, nomes: ['2026-10-01', '2026-11-01'], liberarAPartir: '2026-10-24', podeAdministrar: true, hojeSP: '2026-10-20' }
  const f7 = fraseDoMesFora(dois)
  expect(f7.negrito).toBe('O mês saiu das telas enquanto este diálogo estava aberto. Outubro e novembro de 2026 saíram das telas e o espaço deles ainda não foi liberado.')
  expect(f7.resto.startsWith('Enquanto isso não dá para remover canal nem apagar vídeo. Nada foi removido. O espaço só pode')).toBe(true)
})
it('sem os campos novos, a forma da M3b continua (compatível)', () => {
  expect(f({ mesFora: { meses: 1, recusadoNoClique: true } }).lead).toContain('Nada foi removido.')
})
it('a recusa da remoção em trânsito tem a frase de status; o código nunca aparece', () => {
  expect(fraseDaRecusaDaRemocao('mes_destacado_em_transito')).toBe('Não dá para remover canal agora: o mês saiu das telas.')
  expect(fraseDaRecusaDaRemocao('ERROR: mes_destacado_em_transito')).toBe('Não dá para remover canal agora: o mês saiu das telas.')
})
```

(Meses de anos diferentes, "dezembro de 2026 e janeiro de 2027", ficam como `Dezembro de 2026 e janeiro de 2027 saíram...`; um caso a mais no teste: `nomes: ['2026-12-01', '2027-01-01']`.)

Em `canais-add-action.test.ts`, no `describe('removeCompetitorChannel')`:

```ts
it('M6: recusa por mês em trânsito devolve a frase e os meses; não grava nada por conta própria', async () => {
  rpcMock.mockImplementation((fn: string) => fn === 'competitor_channel_remove'
    ? Promise.resolve({ data: null, error: { code: 'P0001', message: 'mes_destacado_em_transito' } })
    : { abortSignal: () => Promise.resolve({ data: [{ tabela: 'competitor_video_daily', mes: '2026-10-01', destacado_em: '2026-10-17T15:00:00Z', liberar_a_partir: '2026-10-24' }], error: null }) })
  const r = await removeCompetitorChannel('c1')
  expect(r).toEqual({ ok: false, error: 'Não dá para remover canal agora: o mês saiu das telas.', mesFora: { meses: 1, nomes: ['2026-10-01'], liberarAPartir: '2026-10-24' } })
  expect(fromMock).not.toHaveBeenCalledWith('competitor_removed_items')
  expect(fromMock).not.toHaveBeenCalledWith('audit_log')
})
it('M6: leitura dos meses falha: só a frase, sem mesFora', async () => {
  rpcMock.mockImplementation((fn: string) => fn === 'competitor_channel_remove'
    ? Promise.resolve({ data: null, error: { code: 'P0001', message: 'mes_destacado_em_transito' } })
    : { abortSignal: () => Promise.resolve({ data: null, error: { code: '42883', message: 'x' } }) })
  expect(await removeCompetitorChannel('c1')).toEqual({ ok: false, error: 'Não dá para remover canal agora: o mês saiu das telas.' })
})
```

(`rpcMock`/`fromMock` são os nomes do mock do `getSupabaseServiceClient` que o arquivo já usa desde a M3b; o executor ajusta ao nome real do arquivo, sem mudar o que é afirmado.)

Em `arquivo-codigos.test.ts` (I6, Phil): `codigoE10` hoje só reconhece `^E10:<codigo>:`; a recusa da M6 levanta `mes_destacado_em_transito` **sem** prefixo (é o que o `competitor_channel_remove` da M3b faz, `m3b.sql`), então cairia em `inesperado` e `remover.ts:73` mandaria `remocao_inesperada` ao Sentry numa recusa que é normal:

```ts
it('M6: mes_destacado_em_transito sem o prefixo E10 é um código do catálogo, com a mesma frase da tela', () => {
  expect(codigoE10({ code: 'P0001', message: 'mes_destacado_em_transito' })).toBe('mes_destacado_em_transito')
  expect(codigoE10({ code: 'P0001', message: 'ERROR: mes_destacado_em_transito' })).toBe('mes_destacado_em_transito')
  expect(FRASES_E10.mes_destacado_em_transito).toBe('Não dá para remover canal agora: o mês saiu das telas.')
  expect(codigoE10({ code: 'P0001', message: 'outra_coisa' })).toBe('inesperado')
})
```

(Emenda 23/10, Phil N6-2) Idem para `apagarCanalSemGuardar` (`remover.ts`, F1): um teste com `rpc` devolvendo P0001 `mes_destacado_em_transito` afirma `falha.codigo = 'mes_destacado_em_transito'` e que `Sentry.captureMessage` **não** é chamado. A frase de status e o `liberarAPartir` valem para as quatro portas, não só para o "Remover canal"; o texto do diálogo diz que **algum** mês do arquivo está saindo do banco (o invariante é global, Dívida 3). A frase do status do mockup ("o mês saiu das telas") fica como está até a decisão: decisão: Logan/Naksu (trocar por "algum mês saiu das telas").

E em `remover.ts`, um teste com `rpc` devolvendo `{ error: { code: 'P0001', message: 'mes_destacado_em_transito' } }` em `removerCanalArquivado`: afirma que devolve a recusa com a frase do catálogo e que o Sentry (`relatar`) **não** é chamado. Em `codigos.ts`: acrescentar `'mes_destacado_em_transito'` ao tipo `CodigoE10`, a frase em `FRASES_E10` (a mesma de `fraseDaRecusaDaRemocao`), e em `codigoE10`, antes do `MENSAGEM_E10`: `if (typeof erro.message === 'string' && /(^|[^a-z_])mes_destacado_em_transito($|[^a-z_])/.test(erro.message)) return 'mes_destacado_em_transito'`. **Não** entra em `DO_BANCO` (esse conjunto é só do que vem com `E10:`). O `arquivo/cli.ts:334` (que chama `competitor_channel_remove_archived`) não foi reconferido contra a recusa nova: o executor lê `cli.ts:320-345` e, se o `catch` classifica por `erroDoBanco`, o código novo já chega com a frase certa; senão, acrescenta o ramo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run test/youtube/observatorio/arquivo-mensal-frases-remocao.test.ts test/youtube/observatorio/canais-add-action.test.ts > /tmp/m6-t13.log 2>&1; grep -E "FAIL|Tests " /tmp/m6-t13.log`
Expected: FAIL nos casos novos.

- [ ] **Step 3: As frases**

Em `frases-remocao.ts`:

```ts
const MESES_R = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const nomeMes = (m: string): string => MESES_R[Number(m.slice(5, 7)) - 1]!
const ddmm = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
export const INFO_MES_FORA = 'Enquanto o mês pode voltar ao banco, remover o canal deixaria, na volta, registros dele sem canal a que pertencer. “Exportar” continua permitido.'

export function fraseDoMesFora(m: NonNullable<EntradaDialogo['mesFora']>): { negrito: string; resto: string; linkArquivo: boolean; info: string } {
  const recus = m.recusadoNoClique ? 'O mês saiu das telas enquanto este diálogo estava aberto. ' : ''
  let meses: string
  const n = m.nomes ?? []
  if (n.length === 2) {
    const [a, b] = n as [string, string]
    meses = a.slice(0, 4) === b.slice(0, 4)
      ? `${cap(nomeMes(a))} e ${nomeMes(b)} de ${a.slice(0, 4)} saíram das telas e o espaço deles ainda não foi liberado.`
      : `${cap(nomeMes(a))} de ${a.slice(0, 4)} e ${nomeMes(b)} de ${b.slice(0, 4)} saíram das telas e o espaço deles ainda não foi liberado.`
  } else if (n.length === 1) {
    meses = `${cap(nomeMes(n[0]!))} de ${n[0]!.slice(0, 4)} saiu das telas e o espaço dele ainda não foi liberado.`
  } else {
    meses = m.meses === 2 ? 'Dois meses saíram das telas e o espaço deles ainda não foi liberado.' : 'Um mês saiu das telas e o espaço dele ainda não foi liberado.'
  }
  let resto = 'Enquanto isso não dá para remover canal nem apagar vídeo.'
  if (m.recusadoNoClique) resto += ' Nada foi removido.'
  let linkArquivo = false
  if (m.liberarAPartir && m.hojeSP && m.podeAdministrar !== undefined) {
    const depois = m.hojeSP >= m.liberarAPartir
    const antes = `O espaço só pode ser liberado a partir de ${ddmm(m.liberarAPartir)}; até lá, o que dá para fazer é trazer o mês de volta.`
    if (m.podeAdministrar) { resto += depois ? ' Você já pode liberar o espaço ou trazer o mês de volta.' : ` ${antes}`; linkArquivo = depois }
    else resto += depois ? ' O espaço já pode ser liberado, e o mês também pode voltar, por quem administra o site.' : ` ${antes} Quem só edita o site: peça a quem o administra.`
  }
  return { negrito: recus + meses, resto, linkArquivo, info: INFO_MES_FORA }
}
```

`frasesDoDialogo` passa a montar o `lead` do D7/D7r com `fraseDoMesFora` quando `mesFora.nomes` existir (o `lead` da M3b é a concatenação `negrito + ' ' + resto`; o componente da M3b, que já põe o negrito e o ⓘ, passa a ler `negrito`, `resto`, `linkArquivo` e `info` de um campo novo opcional `mesFora` no `ModeloDoDialogo`, e mostra o link "(abrir o Arquivo)" para a página do Arquivo só quando `linkArquivo`). Sem `nomes`, o `lead` da M3b não muda. E:

```ts
export function fraseDaRecusaDaRemocao(mensagem: string): string | undefined {
  if (mensagem.includes('mes_destacado_em_transito')) return 'Não dá para remover canal agora: o mês saiu das telas.'
  // ... os ramos da M3b ficam como estão (sem_direito, canal_nao_encontrado, outro)
}
```

- [ ] **Step 4: A ação**

Em `actions.ts`, no `removeCompetitorChannel` da M3b, troca só o ramo do erro:

```ts
  if (error) {
    const frase = fraseDaRecusaDaRemocao(error.message)
    if (!error.message.includes('mes_destacado_em_transito')) return { ok: false, error: frase }
    const transito = await lerEmTransito(supabase, siteId)
    if (!transito || transito.length === 0) return { ok: false, error: frase }
    const nomes = [...new Set(transito.map(t => t.mes))].sort().slice(0, 2)
    const liberarAPartir = transito.map(t => t.liberar_a_partir).sort()[0]!
    return { ok: false, error: frase, mesFora: { meses: nomes.length === 2 ? 2 : 1, nomes, liberarAPartir } }
  }
```

(`lerEmTransito` vem de `@/lib/youtube/observatorio/arquivo-mensal/saida`, que é `server-only`; `actions.ts` é `'use server'`, então o import é permitido. O diálogo cliente recebe `mesFora` pela resposta da ação e monta `EntradaDialogo.mesFora` com `recusadoNoClique: true`, `podeAdministrar` (a capacidade que a M3b já passa à tela) e `hojeSP` (o dia de São Paulo que a página já calcula). Mais de 2 meses em trânsito não acontece: o portão recusa tirar o terceiro antes de liberar (R27, Tarefa 3); se acontecer, mostram-se os 2 primeiros.)

O D7 sem recusa (o diálogo abre já com mês em trânsito) usa a mesma leitura: o carregador do diálogo da M3b passa a chamar `obs_archive_em_transito` junto das contagens e preenche `mesFora` com `recusadoNoClique: false`; se a leitura falhar, o diálogo segue para os estados normais e o banco recusa no clique (D7r): falha segura, nada é apagado.

- [ ] **Step 5: Rodar e ver passar**

Run: o comando do Step 2, mais `npx vitest run test/youtube/observatorio/remove-dialog` (o teste do componente da M3b não pode quebrar) e o typecheck.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: M6a: remoção de canal com mês em trânsito diz quais meses, a data e o que cada papel pode fazer

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/frases-remocao.ts "apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts" apps/web/test/youtube/observatorio/arquivo-mensal-frases-remocao.test.ts apps/web/test/youtube/observatorio/canais-add-action.test.ts apps/web/src/lib/youtube/observatorio/arquivo/codigos.ts apps/web/test/youtube/observatorio/arquivo-codigos.test.ts
```

(Os caminhos de `codigos.ts` e do teste de `codigos` entram também no `git add`. Se o componente do diálogo da M3b mudar para ler `mesFora` do modelo, ele entra no mesmo commit, com o caminho explícito.)

---

### Task 13b [M6a]: Encerrar o dado de teste (item 121, Yannis I-6, D-M5-6)

A M5 mostra o grupo "Dado de teste" e lê `teste.encerrado_em` (`closed_at` das linhas `ensaio`, SQL da M5 em `obs_archive_pagina`, `m5` L335-340). Quem grava `closed_at` é esta tarefa: sem ela o grupo de teste fica aberto para sempre.

**Files:**
- Modify: `supabase/rascunhos/m6.sql` (PARTE 6: `obs_archive_test_close`)
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes.ts` (acrescenta `encerrarDadoDeTeste`)
- Create: `apps/web/test/integration/manutencao-m6-teste-encerrado.test.ts`
- Modify: `apps/web/test/youtube/observatorio/arquivo-saida-acoes.test.ts` (a ação)

**Interfaces:**
- Produces: `public.obs_archive_test_close(p_site uuid, p_by uuid) returns jsonb` (`{status:'ok', encerrados}` | `{status:'recusado', codigo}`; códigos `sem_direito`, `descarte_de_teste_nao_feito`, `recuperacao_nao_testada`); só `service_role`. Ação: `encerrarDadoDeTeste(): Promise<{ ok: boolean; error?: string }>`.

**O que acontece quando o dado não existe:** nenhum mês `ensaio` no site → recusa `descarte_de_teste_nao_feito` (nunca `ok` com 0 encerrados); nenhum restore da classe `ensaio` → `recuperacao_nao_testada`. A tela diz o que falta; nada é gravado.

- [ ] **Step 1: O teste de banco (falha)**

```ts
// apps/web/test/integration/manutencao-m6-teste-encerrado.test.ts
import { describe, it, expect } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { prepararM6, novoAdmin, escalar } from '../helpers/m6'

describe.skipIf(skipIfNoLocalDb())('M6 parte 6 [M6a]: encerrar o dado de teste', () => {
  it('sem mês ensaio descartado: descarte_de_teste_nao_feito; com descarte e sem restore: recuperacao_nao_testada; com os dois: ok, idempotente (closed_at não muda)', async () => {
    await prepararM6(c, 6)   // c é a conexão do arquivo, como nos outros testes da M6
    const { site, admin } = await novoAdmin(c)
    expect(await escalar<unknown>(c, `select public.obs_archive_test_close($1, $2)`, [site, admin])).toMatchObject({ status: 'recusado', codigo: 'descarte_de_teste_nao_feito' })
    await c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, dropped_at, rows_dropped) values ($1, 'ensaio', 'obs_archive_rehearsal', '2026-05-01', now(), 9)`, [site])
    expect(await escalar<unknown>(c, `select public.obs_archive_test_close($1, $2)`, [site, admin])).toMatchObject({ status: 'recusado', codigo: 'recuperacao_nao_testada' })
    await c.query(`insert into public.obs_archive_restores (site_id, class, table_name, schema_fp, origem, chave, units_checked, rows_restored, diff_rows, done_by) values ($1, 'ensaio', 'obs_archive_rehearsal', 'fp', 'teste', 'k', 1, 9, 0, $2)`, [site, admin])
    expect(await escalar<unknown>(c, `select public.obs_archive_test_close($1, $2)`, [site, admin])).toMatchObject({ status: 'ok', encerrados: 1 })
    const antes = await escalar<string>(c, `select closed_at::text from public.obs_archive_months where site_id = $1 and class = 'ensaio'`, [site])
    expect(await escalar<unknown>(c, `select public.obs_archive_test_close($1, $2)`, [site, admin])).toMatchObject({ status: 'ok' })
    expect(await escalar<string>(c, `select closed_at::text from public.obs_archive_months where site_id = $1 and class = 'ensaio'`, [site])).toBe(antes)
  })
  it('quem não administra recebe sem_direito; restore com diff_rows > 0 não vale', async () => {
    const { site } = await novoAdmin(c)
    expect(await escalar<unknown>(c, `select public.obs_archive_test_close($1, $2)`, [site, '00000000-0000-0000-0000-00000000dead'])).toMatchObject({ status: 'recusado', codigo: 'sem_direito' })
  })
})
```

(`c`, `prepararM6`, `novoAdmin` e `escalar` seguem o padrão dos outros testes da M6, com o `beforeAll` que abre a conexão; o executor copia o cabeçalho de `manutencao-m6-saida-estado.test.ts`. Acrescentar um terceiro caso: restore com `diff_rows = 1` ou `rows_restored = 0` não satisfaz, devolve `recuperacao_nao_testada`.)

- [ ] **Step 2: A função (PARTE 6 do rascunho)**

```sql
create or replace function public.obs_archive_test_close(p_site uuid, p_by uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n int;
begin
  if p_by is null or not public.obs_archive_is_site_admin(p_site, p_by) then return jsonb_build_object('status', 'recusado', 'codigo', 'sem_direito'); end if;
  if not exists (select 1 from public.obs_archive_months where site_id = p_site and class = 'ensaio' and dropped_at is not null) then
    return jsonb_build_object('status', 'recusado', 'codigo', 'descarte_de_teste_nao_feito'); end if;
  if not exists (select 1 from public.obs_archive_restores where site_id = p_site and class = 'ensaio' and diff_rows = 0 and rows_restored > 0) then
    return jsonb_build_object('status', 'recusado', 'codigo', 'recuperacao_nao_testada'); end if;
  update public.obs_archive_months set closed_at = coalesce(closed_at, now()), closed_by = coalesce(closed_by, p_by) where site_id = p_site and class = 'ensaio';
  get diagnostics v_n = row_count;
  return jsonb_build_object('status', 'ok', 'encerrados', v_n);
end $$;
revoke all on function public.obs_archive_test_close(uuid, uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_test_close(uuid, uuid) to service_role;
```

- [ ] **Step 3: A ação**

Em `acoes.ts`, seguindo o formato das outras (`denyUnlessSiteAdmin` no topo, `requireSiteAdminScope` para o `p_by`, `getSiteContext` para o site, `revalidatePath` da página do Arquivo): `encerrarDadoDeTeste()` chama `obs_archive_test_close`; a recusa vira frase (`descarte_de_teste_nao_feito`: "Ainda falta descartar um mês de teste."; `recuperacao_nao_testada`: "Ainda falta testar a recuperação do dado de teste."), o código nunca chega à tela. Teste da ação com `rpc` devolvendo cada um dos três resultados e a guarda de administrador (a ação não chama o banco quando o papel é editor). O botão "Encerrar o dado de teste" é do grupo de teste da M5 e entra pelo slot `teste.acoes` (pedido à M5; a Tarefa 12b o preenche).

- [ ] **Step 4: Rodar e ver passar; commit**

Run: `cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/manutencao-m6-teste-encerrado.test.ts test/youtube/observatorio/arquivo-saida-acoes.test.ts > /tmp/m6-t13b.log 2>&1; grep -E "FAIL|Tests " /tmp/m6-t13b.log`
Expected: PASS.

```bash
git add supabase/rascunhos/m6.sql "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes.ts" apps/web/test/integration/manutencao-m6-teste-encerrado.test.ts apps/web/test/youtube/observatorio/arquivo-saida-acoes.test.ts
git commit -m "feat: M6a: encerrar o dado de teste (closed_at dos meses ensaio)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/rascunhos/m6.sql "apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes.ts" apps/web/test/integration/manutencao-m6-teste-encerrado.test.ts apps/web/test/youtube/observatorio/arquivo-saida-acoes.test.ts
```

---
### Task 14 [M6a]: A migration 1 (PARTES 1 a 6), o arquivo de comandos do dono e o ledger

**Files:**
- Create: `supabase/migrations/<timestamp>_manutencao_m6_saida.sql` (por `npm run db:new manutencao_m6_saida`, nunca à mão)
- Create: `.superpowers/sdd/manutencao-nas/m6/LEIAME-COMANDOS.md` (gitignored)
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts` (`SAIDA_DE_MES_EXISTE = true`, D-M5-15, no MESMO commit da migration)
- Create: `apps/web/test/integration/manutencao-m6-migration-igual-rascunho.test.ts` (m-10)
- Modify: `.superpowers/sdd/manutencao-nas/progress.md` (ledger; gitignored)
- Modify: `apps/web/test/helpers/m6.ts` (`M6_EM_MIGRATION = true`)

**Interfaces:**
- Consumes: `supabase/rascunhos/m6.sql` até `-- M6 PARTE 7` (PARTES 1 a 6: Tarefas 1-7a, 9, 13b), já testado com `sqlM6Ate(6)`.
- Produces: a migration 1 que o dono aplica; depois dela a M6a está entregue (o dono tira meses à mão). A migration 2 (PARTE 7, o automático) é a Tarefa 14b [M6b].

**Pré-condição dura 1:** a migration da M3b já está em produção (`npx supabase migration list --linked` mostra a linha dela nos dois lados). Sem isso esta tarefa para: as funções da M6 leem `obs_archive_months`, `obs_archive_prechecks` e `obs_archive_switch`, que nascem na M3b, e redefinem `obs_archive_vermelhos` com o corpo da M3b.

**Pré-condição dura 2 (a página da M5 não pode quebrar com a coluna nova):** o leitor da M5 usa lista explícita de colunas em produção, não `select *` nem `to_jsonb(m)` inteiro sobre a tabela de meses: `grep -n "reattach_out_of_order\|to_jsonb(m)" apps/web/src/lib/youtube/observatorio/arquivo-mensal/pagina.ts supabase/migrations/*m5*`. A migration 1 acrescenta `obs_archive_months.reattach_out_of_order` e `obs_archive_prechecks.row_digest`; a M5 lê a primeira por `to_jsonb(m)->>'reattach_out_of_order'` com `coalesce false` (pedidos à M5, item 5) e a lista fechada de chaves do `obs_archive_pagina` não muda. Se o leitor da M5 for `.strict()` sobre o JSON e a chave nova aparecer, a página cai em `fora_do_esquema`: conferir no banco de integração com as duas migrations (M5 e M6) antes do push.

- [ ] **Step 1: Criar a migration pelo script**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run db:new manutencao_m6_saida
```

Copiar o conteúdo de `supabase/rascunhos/m6.sql` **até a linha `-- M6 PARTE 7`** (PARTES 1 a 6; a PARTE 7 é a migration 2, Tarefa 14b) para o arquivo criado (o rascunho já é idempotente: `create or replace function`, `drop trigger if exists` antes de `create trigger`, `add column if not exists`, `revoke ... from public, anon, authenticated` e `grant execute ... to service_role` só nas funções que a rota ou a tarefa chamam, como manda a A5). Trocar em `apps/web/test/helpers/m6.ts` a constante `M6_EM_MIGRATION` para `true` **só depois do passo 3 do LEIAME** (o `prepararM6` deixa de aplicar o rascunho e confere que a migration está no banco local; com a PARTE 7 ainda fora, `prepararM6(c, 7)` continua aplicando o rascunho da PARTE 7 por cima). Trocar também `SAIDA_DE_MES_EXISTE` para `true` em `capacidades.ts` no mesmo commit; o teste das duas posições da constante (M5, Tarefa 4) tem de continuar verde.

**Teste m-10 (o corpo da migration é o rascunho):** `manutencao-m6-migration-igual-rascunho.test.ts` lê `supabase/migrations/*_manutencao_m6_saida.sql` e `sqlM6Ate(6)` e afirma que os textos são iguais depois de tirar espaço em branco nas pontas e comentários de linha; sem isso o rascunho testado e a migration aplicada podem divergir em silêncio.

- [ ] **Step 2: Rodar toda a bateria da M6 contra a migration no banco de integração**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run db:reset -- --db-url postgresql://postgres:postgres@127.0.0.1:54422/postgres > /tmp/m6-reset.log 2>&1; tail -3 /tmp/m6-reset.log
cd apps/web && HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/manutencao-m6-*.test.ts test/integration/manutencao-m3b-*.test.ts > /tmp/m6-t14.log 2>&1; grep -E "FAIL|Tests " /tmp/m6-t14.log
```

(Rodar em background com saída em arquivo: a bateria passa de 4 minutos; os testes de corrida e de volume (Tarefa 6) já rodam na Tarefa 6, aqui só se confirma que seguem verdes. Os testes de `manutencao-m6-interruptor` e `-rodizio-vigia` (PARTE 7) ficam de fora até a 14b; `prepararM6(c, 6)` não aplica a PARTE 7.)

Expected: PASS em tudo, com `M6_EM_MIGRATION = true` (inclusive o teste m-10 e os testes da M3b: a redefinição de `obs_archive_vermelhos` não pode quebrar nenhum). O comando de reset do banco de integração é o que a memória `reference_banco_local_integracao.md` e o `m3b.ts` usam; se o `db:reset` não aceitar `--db-url`, usar o mesmo caminho que o plano da M3b usou para o 54422 (o executor confere `apps/web/test/helpers/m3b.ts` antes).

- [ ] **Step 3: O arquivo de comandos do dono**

`.superpowers/sdd/manutencao-nas/m6/LEIAME-COMANDOS.md` (só o caminho para frente, memória `feedback_leiame_comandos.md`; um comando por linha, cada um curto):

```markdown
# M6: aplicar a saída em produção

Janela: fora de 11:30-13:00 UTC (rodada da forja), fora dos minutos 0, 20 e 40 (coleta) e fora de 23:40-24:00 de São Paulo (fechamento do dia).

0. Antes do push: conferir que nenhum registro de interruptor tem motivo de desarme que a PARTE 7 ainda não entende (esperado: nenhuma linha, ou só `null`):

    npx supabase db query --linked "select disarm_reason, count(*) from public.obs_archive_switch group by 1"

1. Conferir o que falta aplicar (a M3b tem de aparecer nos dois lados; a M6 só do lado local):

    npx supabase migration list --linked

2. Aplicar (pede YES):

    npm run db:push:prod

3. Conferir que a função nova existe e que anon não executa:

    npx supabase db query --linked "select has_function_privilege('anon','public.obs_archive_detach_month(uuid,text,date,uuid,text,boolean)','execute') as anon, has_function_privilege('service_role','public.obs_archive_detach_month(uuid,text,date,uuid,text,boolean)','execute') as servico"

   Esperado: anon = f, servico = t.

3b. Conferir que o invariante dos meses destacados está limpo (esperado `{}`):

    npx supabase db query --linked "select public.obs_archive_invariante_faltam()"

3c. Conferir que os gatilhos da saída estão habilitados (esperado `O` em todas as linhas):

    npx supabase db query --linked "select tgname, tgenabled from pg_trigger where tgname like 'obs_archive_%' and not tgisinternal order by 1"

3d. Conferir os privilégios (critério 4: nenhuma função nova executável por anon ou authenticated; esperado nenhuma linha):

    npx supabase db query --linked "select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'obs_archive_%' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')) and p.proname not in (select proname from public.obs_archive_funcoes_publicas())"

   (se `obs_archive_funcoes_publicas` não existir, o executor troca a última condição pela lista de exceções que a M3b registrou em `m3b.sql`; o importante é a lista de saída ser vazia.)

4. Conferir que nenhuma classe foi liberada (released continua falso até a M5; a classe `ensaio` só se libera pelo passo 1b abaixo, se o dono decidir):

    npx supabase db query --linked "select class, released from public.obs_archive_policy()"

   Esperado: todas com released = f.
```

5. Volume para a M4 e para o CP13 (só leitura; anotar os três números no ledger):

    npx supabase db query --linked "select count(distinct v.competitor_channel_id) as canais, count(distinct d.video_id) as videos, count(*) as linhas from public.competitor_video_daily d join public.competitor_videos v on v.id = d.video_id where d.snap_date >= date_trunc('month', current_date - 1)"

Depois do passo 3, o controlador troca `M6_EM_MIGRATION` e `SAIDA_DE_MES_EXISTE` e commita (a Tarefa 14 manda o commit). A migration 1 NÃO liga nada sozinha: nenhuma classe é liberada.

**Volta e desfazer.** Voltar a migration em produção só com `npx supabase db query --linked "select count(*) from public.obs_archive_months where detached_at is not null and dropped_at is null"` igual a zero (nenhum mês em trânsito; senão os gatilhos e a coluna nova são o que protege o dado). `supabase/rascunhos/m6-desfazer.sql` roda **só** no banco de integração (Tarefa 6); em produção o desfazer é uma migration nova, escrita no dia.

**Passo opcional 1b (liberar a classe `ensaio`, Decisão 16; só se Hanna ou o dono decidirem, depois da migration da M5 em produção):** o comando de uma linha chama um `.sh` que roda o bloco `do $$` da Decisão 16 (troca só a linha `ensaio` de `false` para `true` no texto de `pg_get_functiondef('public.obs_archive_policy()')`, aborta se não encontrar a linha, recria a função). O `.sh` é preparado no dia, com o comando no clipboard um por vez (memória `feedback_comando_no_clipboard.md`).

**Quinze de dezembro de 2026 (item 12 do spec):** medir a horária no mês cheio e refazer a regra de peso do banco; anotar a medida no ledger. Não é passo desta migration.

A variável `OBS_ARQUIVO_AUTO_DROP` **não** é desta etapa: é da M6b (Tarefa 14b).

- [ ] **Step 4: O ledger**

Acrescentar a `.superpowers/sdd/manutencao-nas/progress.md`, na seção da M6a: a decisão do R27 (saída em ordem: o portão recusa tirar um mês com mês mais antigo da mesma tabela ainda online; condição 20; frase proposta `TEXTO_SAIDA_FORA_DE_ORDEM` em revisão do Logan), as medidas da Tarefa 6 (tempo do destaque com 75 canais, tempo do descarte, `statement_timeout` usado, se a Tarefa 8 virou pesada) e o hash do commit da migration.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_manutencao_m6_saida.sql apps/web/test/helpers/m6.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts apps/web/test/integration/manutencao-m6-migration-igual-rascunho.test.ts
git commit -m "feat: M6a: migration da saída do banco online (destaque, descarte, reattach e portão)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/migrations/*_manutencao_m6_saida.sql apps/web/test/helpers/m6.ts apps/web/src/lib/youtube/observatorio/arquivo-mensal/capacidades.ts apps/web/test/integration/manutencao-m6-migration-igual-rascunho.test.ts
```

O `db:push:prod` é do dono, pelo LEIAME. Depois que ele confirmar o passo 3, o controlador troca as duas constantes, commita e faz o push (memória `feedback_push_e_promocao_do_agente.md`). **A M6a está entregue aqui.**

---

### Task 14b [M6b]: A migration 2 (PARTE 7, o automático), a variável e o commit da tarefa diária

Espera: M6a no ar (Tarefa 14 aplicada), Tarefas 7b, 8 (primeiro commit), 9b, 10, 11b e 12c commitadas, e a **M9** (a tela do Arquivo e as atestações em produção; gatilho da Hanna: M6b depois da M9).

**Files:**
- Create: `supabase/migrations/<timestamp>_manutencao_m6_automatico.sql` (por `npm run db:new manutencao_m6_automatico`)
- Create: `.superpowers/sdd/manutencao-nas/m6/LEIAME-COMANDOS-2.md` (gitignored)
- Modify: `docs/ops/env-vars.md` (a variável `OBS_ARQUIVO_AUTO_DROP`)
- Modify: `apps/web/test/helpers/m6.ts` (nova constante `M6_PARTE7_EM_MIGRATION = true`: `prepararM6(c, 7)` deixa de aplicar o rascunho da PARTE 7 e confere que a migration 2 está no banco local)
- Modify (segundo commit da Tarefa 8): `apps/web/src/lib/youtube/agenda/definicoes.ts` e `apps/web/src/lib/youtube/agenda/catalogo.ts` (registrar a tarefa; ver Tarefa 8) e `apps/web/test/youtube/observatorio/saida-automatica-catalogo.test.ts`

**Pré-condição dura:** `select public.obs_archive_invariante_faltam()` devolve `{}` em produção e nenhum mês ficou em trânsito além de `liberar_a_partir + 14 dias` (vermelho `saida_transito_longo` da 7a apagado); senão o automático nasceria sobre um estado que o dono ainda não resolveu.

- [ ] **Step 1: Criar a migration pelo script e copiar a PARTE 7**

`npm run db:new manutencao_m6_automatico`, copiar de `supabase/rascunhos/m6.sql` o trecho depois da linha `-- M6 PARTE 7` até o fim. Rodar a bateria da M6 inteira (PARTES 1-7) no banco de integração com as duas migrations aplicadas, em background com saída em arquivo; só as falhas no contexto. Teste m-10 estendido: a migration 2 é igual a `sqlM6Parte(7)`.

- [ ] **Step 2: O LEIAME-COMANDOS-2**

Só o caminho para frente: janela fora da rodada da forja; `npx supabase migration list --linked`; `npm run db:push:prod`; conferir `select public.obs_archive_invariante_faltam()` (`{}`), a existência de `obs_archive_switch_arm` e a ausência de privilégio de `anon`; commit 2 da Tarefa 8 (registrar `saida_automatica` em `DEFINICOES_MANUTENCAO` e `CATALOGO` no mesmo commit do teste do catálogo); só então a variável.

- [ ] **Step 3: A variável em `docs/ops/env-vars.md`**

Acrescentar à tabela das flags operacionais:

```markdown
| `OBS_ARQUIVO_AUTO_DROP` | desligada (ausente) | Só o valor exato `on` deixa a tarefa `saida_automatica` tirar um mês sozinha e o interruptor ser ligado na tela. Qualquer outro valor (vazio, `true`, `1`, `ON`) é desligado. Desligar com o interruptor ligado faz a próxima rodada desligá-lo com o motivo 9 ("Foi desligado na configuração do site"); nada sai. Ligar a variável não liga o automático: ele só liga pela tela, com a frase digitada. Vercel (produção) e `.env.local`. Fase de manutenção, M6. |
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_manutencao_m6_automatico.sql apps/web/test/helpers/m6.ts docs/ops/env-vars.md
git commit -m "feat: M6b: migration do automático (interruptor, vigia e candidatos de saída)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- supabase/migrations/*_manutencao_m6_automatico.sql apps/web/test/helpers/m6.ts docs/ops/env-vars.md
```

O `db:push:prod` é do dono, pelo LEIAME-2. Depois que ele confirmar, o controlador faz o commit 2 da Tarefa 8 e o push. O automático continua desligado: a variável `OBS_ARQUIVO_AUTO_DROP` e o interruptor da tela são duas travas separadas, e o interruptor só liga depois de 3 saídas manuais e 2 simulações vistas.

---

## Ordem de execução e o que espera o quê

| Tarefa | Espera | Pode correr junto de |
|---|---|---|
| 0 | M3b no banco de integração (rascunho `m3b.sql` aplicável), M2 (partições) | — |
| 1, 2 [M6a] | 0 | entre si |
| 3 [M6a] | 1, 2 | — |
| 4, 5 [M6a] | 3 | entre si (arquivos de teste diferentes; o rascunho é um só, então commit em série) |
| 6 [M6a] | 4, 5 | 9 |
| 7a [M6a] | 3, 5 | 6, 9 |
| 9 [M6a] | 5 | 6, 7a |
| 11 [M6a] | 3 a 6 e 7a | 12 (só tipos) |
| 12 [M6a] | 11 (tipos) | 13 |
| 12b [M6a] | 11, 12 e os campos pedidos à M5 (`.superpowers/sdd/manutencao-nas/pedidos-m6-para-m5.md`); a página do Arquivo da M5 commitada | 13, 13b |
| 13 [M6a] | 7a, 11, e a tarefa da remoção da M3b já commitada | 12 |
| 13b [M6a] | 6 (PARTE 6 do rascunho) | 13 |
| 14 [M6a] | 0 a 7a, 9, 13b (SQL), a M3b em produção e o leitor da M5 com lista explícita de colunas | — |
| **M6a entregue aqui.** | | |
| 7b [M6b] | 7a | 10 |
| 8 [M6b] | 7b (código); o commit de registro só depois da Tarefa 14b em produção | 10, 11b |
| 9b [M6b] | 7b, 9 | 8 |
| 10 [M6b] | 7b (`obs_archive_next_exit` está na PARTE 7); a M7 (`obs_archive_pode_sair_em`) e o gancho de relógio dela | 8, 11b |
| 11b [M6b] | 7b, 8 (`ligado.ts`), 11; usa `fraseConfere`/`FRASE_DE_LIGAR` de `interruptor.ts` (se vier antes da 12c, cria o arquivo com essas duas exportações) | 10 |
| 12c [M6b] | 11b, 12, 12b | — |
| 14b [M6b] | 7b, 8, 9b, 10, 11b, 12c, a M6a no ar e a **M9** (gatilho da Hanna) | — |

Gatilhos de prazo (Hanna): Tarefa 10 no ar antes de 01/02/2027; 7b e 8 antes de abril/2027; a M8 e a M10c esperam a M6a; a M10b não depende da M6; a Tarefa 11 espera "3 a 6 e 7a"; a Tarefa 12 entrega a peça 3 completa e a peça 4 só em `nao_pode`.

`released` das classes `serie` e `horaria` é da M5 (migration dela, D-M5-4); o **encaixe das peças na página é da M6** (Tarefa 12b, D-M5-14: a M5 entrega os slots `acoes`, nunca importa `_arquivo-saida/`). A M4 entrega as atestações (NAS e B2) que o portão lê. Sem a M4 em produção, todo mês fica com a falta `nas_sem_atestacao` ou `b2_sem_atestacao` e nada sai: falha segura, e a tela diz por quê.
