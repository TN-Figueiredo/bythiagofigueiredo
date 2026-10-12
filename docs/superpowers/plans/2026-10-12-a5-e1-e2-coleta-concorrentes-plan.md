# A5 · E1 e E2: coleta dos concorrentes (campos, sinalizadores, `raw`, o que saiu do YouTube, série com faixas no tempo) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Escrito em 12/10/2026 sobre `staging` local em `f6de92d5` (78 commits à frente de `origin/staging` `4843caef`; a diferença é a A4, docs e duplicatas da E12). Produção: `main` `9478979d`, última migration aplicada `20261009000001`. Nenhuma migration deste plano existe ainda como arquivo.

**O que já foi executado ao escrever este plano, e o que não foi** (para o portão de fim de plano saber em que confiar):

| O quê | Como | Resultado |
|---|---|---|
| SQL da MG1 e da MG2 (Apêndices A e B) | banco **local**, dentro de transação com `rollback`; aplicado duas vezes seguidas; roteiro de asserções (A, B, A; segunda corrente recusada; ausência em duas leituras com a data de São Paulo; cota somada e `operations` por chave; duas trocas de faixa no mesmo dia; cascata; quem executa) | passou; o banco local ficou como estava (conferido: 0 tabelas e 0 colunas novas depois) |
| V1 a V3, K1 a K14 e R1 | banco local com as migrations (transação desfeita); V1 e R1 também em produção, só leitura | nenhuma dá erro de SQL |
| Código dos módulos puros (Tarefas 2, 3, 4, 5, a parte de 9 e a 12), extraído **do texto deste plano** | compilado com `strict` e `noUncheckedIndexedAccess`, e os testes do plano rodados, numa pasta fora do repositório | 0 erro de tipo; **85 de 85 testes passam** |
| Edições da Tarefa 16 (motor) aplicadas, como o plano descreve, a uma **cópia** de `src/lib` | os 14 testes novos e a pasta `test/youtube/observatorio` inteira, antes e depois | 14 de 14; os 5.266 testes que rodam na cópia continuam passando, e o conjunto de falhas é idêntico ao de antes (110, todas por arquivo de tela que a cópia não tem) |
| Funções de pacote da Tarefa 17 | o teste de medição do plano, na mesma cópia | maior canal com um ano de série diária e semanal: **665.900** caracteres de 2.000.000; no teto, sem a semanal: 1.641.404 |
| **Não executado** | o código das Tarefas 6 a 11 e 13 (escrito contra o arquivo lido linha a linha, mas não rodado: é onde a revisão por tarefa mais rende); as edições do carregador e da fixture da Tarefa 17; o bloco de RLS da Tarefa 1; a Tarefa 14 (ensaio com a API real) | — |

## 1. Perguntas que só o dono responde

Nenhuma trava o início. Pela regra dele (decisão 44), onde o spec tem padrão vale o padrão; as três abaixo são decisões que este plano tomou onde o spec não fecha, e que ele pode vetar.

1. **Miniatura dos vídeos antigos (faixa semanal): não é conferida nem arquivada.** O spec diz "o Blob guarda: sem mudança, nada novo é arquivado" (4.2) e ao mesmo tempo quer detectar troca num vídeo semanal (item 17). Medido em produção: 716 vídeos ficam em faixa semanal e **687 deles não têm versão nenhuma guardada** (nunca foram conferidos). Conferir a miniatura deles custaria 687 arquivos novos no Blob (hoje são 707) e cerca de 100 s a mais por dia na faixa das 12:00 durante a primeira semana. **Padrão do plano: a passada semanal confere título e descrição (vêm de graça na resposta) e não a miniatura.** Consequência dita sem suavizar: troca de miniatura num vídeo fora dos 50 mais recentes continua invisível, como é hoje. Se ele quiser a miniatura também, é uma linha (a opção `skipThumb`) e a conta acima.
2. **Contagem que o YouTube deixa de devolver passa a ser gravada como "não medido" também nos vídeos fixados.** Hoje, só para vídeo fixado, a contagem antiga é mantida quando o YouTube esconde o contador (decisão da fase de fixar vídeo). O spec aprovado (princípio D2 e item 6) manda nulo mais o sinalizador para todos. O plano segue o spec: a tela passa a dizer "não medido" em vez de mostrar um número velho sem data. Três testes mudam por isso (Tarefa 6).
3. **Um envio para a coleta (E1 e E2 juntas) e outro, depois, para o leitor.** O spec põe a E1 e a E2 em ordens seguidas (3 e 4) e permite aplicar a MG1 e a MG2 juntas. Cada push custa 4 builds da Vercel. O plano entrega em dois lotes: **Lote 1** (a coleta inteira: é o que para de perder dado) e **Lote 2** (o motor e o carregador passam a saber ler a série semanal; não perde dado por esperar). Os commits da E1 não dependem da MG2, então dá para promover a E1 sozinha se ele preferir.

Aviso (não é pergunta): **a primeira semana grava cerca de 8 a 10 MB de uma vez** (a primeira resposta guardada de cada um dos 1.390 vídeos e o primeiro valor de cada campo). O banco vai de 179 para cerca de 189 MB. Conta na seção 5.

## 2. O que é do dono

**Uma coisa só: aplicar as duas migrations, antes do código.** Nenhum agente roda `db:push:prod`.

| Passo | Quem | O quê |
|---|---|---|
| 1 | agente (Tarefa 1) | `npm run db:new observatorio_a5_e1_campos_sinalizadores_raw` e cola o Apêndice A; depois `npm run db:new observatorio_a5_e2_serie_faixas` e cola o Apêndice B. **Nesta ordem** (a MG2 usa colunas da MG1; o carimbo de hora do segundo arquivo tem de ser maior). Commit local. |
| 2 | agente | prova no banco local (Tarefa 1) e as consultas V1 a V3 abaixo rodadas no banco local |
| 3 | **dono** | `npm run db:push:prod` (digita `YES`). Aplica as duas no mesmo comando. Se o arquivo da MG13 (etapa E20) já existir e ainda não tiver sido aplicado, vai junto: o spec permite (lote A) |
| 4 | agente | roda V1, V2 e V3 em produção (só leitura) e cola o resultado no ledger |
| 5 | agente | só então o push do código (seção 9) |

**Compatibilidade, nos dois sentidos.**

- **Migration aplicada, código antigo ainda em `main`** (é o estado normal entre os passos 3 e 5, e pode durar dias): nada quebra. As duas migrations só acrescentam: coluna anulável ou com padrão, tabela nova, função nova. As três exceções, conferidas uma a uma: (a) tirar o `default 0` de `view_count`, `like_count` e `comment_count` não muda o que o código antigo grava, porque o único `insert` em `competitor_videos` (`competitor-sync.ts:484`) manda os três campos (lido no código; as três colunas já são anuláveis em produção, medido); (b) o padrão de `youtube_quota_usage.operations` passa de `'[]'` para `'{}'`: a tabela tem 0 linhas e nenhum escritor (medido e lido); (c) `competitor_channel_removal_impact` é recriada com as mesmas chaves e mais quatro: o leitor (`competitor-removal-impact.ts`) confere só as cinco que usa e ignora o resto (lido). A Tarefa 1 prova isso rodando os testes de integração do código **antigo** contra o schema novo, antes de qualquer mudança de código.
- **Código novo sem a migration** (ordem invertida por engano): o cron de concorrentes **para em vermelho na primeira linha e não grava nada**, com a mensagem "migrations MG1/MG2 não aplicadas" (guarda `schemaReady`, Tarefas 9 e 13, com teste). O código antigo faria `update` com coluna inexistente e seguiria em verde; por isso a guarda existe.

**V1: a migration entrou inteira?** (testada em 12/10 no banco local, antes e depois, e em produção antes: lá deu 0, 0, 0, 0, 0, `'[]'::jsonb`, 3.) Depois de aplicada tem de dar **21, 12, 5, 5, 9, `'{}'::jsonb`, 0**.

```sql
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'competitor_videos' and column_name in ('discovered_at', 'default_language', 'default_audio_language', 'live_broadcast_content', 'live_scheduled_start_at', 'live_actual_start_at', 'live_actual_end_at', 'was_live', 'comments_disabled', 'likes_hidden', 'views_hidden', 'miss_streak', 'miss_first_at', 'missing_since', 'last_seen_at', 'removal_decision', 'removal_decided_at', 'removal_decided_by', 'series_tier', 'series_tier_since', 'daily_until')) as colunas_video_de_21, (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'competitor_channels' and column_name in ('custom_url', 'description', 'published_at', 'country', 'subscribers_hidden', 'miss_streak', 'miss_first_at', 'missing_since', 'last_seen_at', 'removal_decision', 'removal_decided_at', 'removal_decided_by')) as colunas_canal_de_12, (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relname in ('competitor_field_versions', 'competitor_raw', 'competitor_removed_items', 'competitor_video_early', 'competitor_video_tier_spans')) as tabelas_com_rls_de_5, (select count(*) from pg_policies where schemaname = 'public' and tablename in ('competitor_field_versions', 'competitor_raw', 'competitor_removed_items', 'competitor_video_early', 'competitor_video_tier_spans')) as policies_de_5, (select count(distinct p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('apply_competitor_field_plan', 'apply_competitor_raw_plan', 'competitor_mark_missing', 'competitor_channel_mark_missing', 'youtube_quota_add', 'jsonb_num_merge', 'competitor_capture_health', 'apply_competitor_tier_plan', 'competitor_series_health')) as funcoes_de_9, (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'youtube_quota_usage' and column_name = 'operations') as padrao_operations, (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'competitor_videos' and column_name in ('view_count', 'like_count', 'comment_count') and column_default is not null) as contadores_com_padrao;
```

**V2: nada foi tocado nos dados?** Esperado, enquanto o código antigo estiver em `main`: `videos = videos_intactos` (1.390 em 12/10), `canais_intactos = 15`, `linhas_nas_5_tabelas_novas = 0`.

```sql
select (select count(*) from competitor_videos) as videos, (select count(*) from competitor_videos where miss_streak = 0 and missing_since is null and series_tier is null and last_seen_at is null) as videos_intactos, (select count(*) from competitor_channels where miss_streak = 0 and last_seen_at is null) as canais_intactos, (select count(*) from competitor_field_versions) + (select count(*) from competitor_raw) + (select count(*) from competitor_video_early) + (select count(*) from competitor_video_tier_spans) + (select count(*) from competitor_removed_items) as linhas_nas_5_tabelas_novas;
```

**V3: quem executa as funções?** Esperado: dez linhas, todas `anon = false`, `autenticado = false`, `servico = true`.

```sql
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as autenticado, has_function_privilege('service_role', p.oid, 'execute') as servico from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('apply_competitor_field_plan', 'apply_competitor_raw_plan', 'competitor_mark_missing', 'competitor_channel_mark_missing', 'youtube_quota_add', 'jsonb_num_merge', 'competitor_capture_health', 'apply_competitor_tier_plan', 'competitor_series_health', 'competitor_channel_removal_impact') order by 1;
```

**Plano de volta das migrations:** não há o que desfazer. Sem o código novo, as tabelas ficam vazias e as colunas, nulas. Nenhuma das duas apaga, renomeia ou estreita nada.

---

**Goal:** A cada sincronização dos concorrentes, guardar com histórico o que hoje é sobrescrito (tags, categoria, duração, idioma, ao vivo), separar "zero" de "não medido", marcar o que deixou de vir do YouTube, guardar a resposta crua quando muda, registrar a cota gasta, e dar série a todo vídeo guardado (diária, semanal e primeiras horas), com a faixa gravada no tempo para que um buraco de coleta nunca seja lido como dado.

**Architecture:** Duas migrations aditivas (MG1, MG2). Quatro módulos puros novos (catálogo e extração, plano de versões, faixas, cota e prova) e a integração deles no `syncCompetitorChannel` que já existe, sem chamada nova por vídeo e sem cron novo. A escrita de histórico é sempre "estado desejado × estado gravado": quando nada mudou, zero gravações; quando um passo falha, a execução seguinte conserta sozinha. Toda perda vira estado lido do banco a cada disparo (duas funções de prova), não nota de uma execução. O leitor (Lote 2) ganha a série semanal em **campos novos**: os campos que as telas leem hoje ficam byte a byte iguais.

**Tech Stack:** Next.js 16 (rota de cron em Node), TypeScript estrito (sem `any`), Supabase (PostgREST e funções SQL), Vitest (falso do banco escrito à mão em `test/youtube/competitor-sync.test.ts`; `test/helpers/fake-supabase.ts` para o carregador; banco local com `HAS_LOCAL_DB=1` para SQL e RLS).

**Spec:** `docs/superpowers/specs/2026-10-12-observatorio-a5/01-coleta-concorrentes.md` (princípios D1 a D7, 4.1, 4.3, a tabela de 4.5, itens 1 a 23 e 221 a 225); `00-indice-decisoes-e-sequencia.md` (seção 14: ordens 3 e 4, tabela das migrations, C0.8, ordem do dia do deploy, interruptor, OP-15; seção 10: itens 245 a 247); `06-ciclo-de-vida-volume-e-cota.md` (9.1, 9.4, 9.6). Decisões do dono: `.superpowers/sdd/a5/decisoes-do-dono.md`. Lições da E12: `.superpowers/sdd/a5-e12/progress.md`.

## Global Constraints

- **Sem branch, sem worktree, sem `git stash`, sem `git reset`.** Tudo em `staging`. Commits por caminho explícito (`git commit -- <caminhos>`). Outros terminais trabalham na mesma árvore.
- **Nada escreve em produção.** Migration é do dono. Leitura de produção só por `npx supabase db query --linked "<select>"`.
- **Migration só por `npm run db:new <nome>`**; idempotente (`if not exists`, `create or replace`, `drop policy if exists` antes de `create policy`); funções com `set search_path = ''` e nomes qualificados (`public.`), `execute` só para `service_role` (OP-2).
- **Não tocar** em `docs/cowork-*`, `apps/web/data/pipeline-docs/` nem `apps/web/src/lib/pipeline/api-registry.ts`. Este plano não cria nem muda rota de pipeline. Se uma tarefa parecer pedir, pare e relate.
- **Não tocar nos arquivos que a A4 mexe** (lista na seção 9): em especial `apps/web/test/helpers/fake-supabase.ts`, `apps/web/e2e/fixtures/observatorio-seed.ts`, `lib/youtube/observatorio/links.ts`, `stats.ts` e `proprio/`. Se um teste precisar de algo novo no falso do banco, crie o auxiliar no próprio arquivo de teste.
- **D1: nenhuma chamada nova por vídeo.** As partes novas entram nas chamadas `videos.list` e `channels.list` que já existem. A única chamada a mais é a da passada semanal (uma por 50 vídeos devidos).
- **D2: nunca zero por falta.** Contagem ausente é nulo mais o sinalizador.
- **D3:** nenhum tipo novo em `competitor_video_versions.field` nem em `competitor_changes.change_type`.
- **D5:** `snap_date` é a data de São Paulo. O dia da cota é o do Pacífico.
- **Corte silencioso é proibido:** toda leitura que pode passar de 1.000 linhas é paginada ou falha; todo teto que corta registra quantos cortou.
- **Fixtures de teste sem data futura fixa** (`test/unit/test-hygiene.test.ts`): use `Date.now()` relativo, o `NOW` que o arquivo já tem, ou data do ano corrente.
- **Nenhum comando ou espera acima de 4 minutos.** Suíte completa (`npx vitest run`, cerca de 160 s): saída para arquivo, e no contexto só as falhas.
- **Não rodar `npm run db:types`**: o cliente de serviço não é tipado pelo schema, e o banco local está atrás de produção (o arquivo gerado mudaria por motivos alheios).
- Palavras do código: identificadores em inglês como o arquivo já usa; mensagens que o dono lê (nota do cron, erro do canal) em português, sem jargão.

## Review Focus

Entradas que o spec implica e que mais provavelmente mordem; cada uma tem o teste na tarefa dona.

1. **A resposta do YouTube vem sem uma parte inteira** (`snippet`, `statistics` ou `contentDetails` ausente no item). Esperado: os campos daquela parte não são comparados (parte ausente não é "mudou para nulo"), nenhuma versão é criada, e a execução conta `partsMissing`. Teste na Tarefa 3.
2. **O mesmo vídeo é pedido duas vezes na mesma sincronização** (página de uploads e passada diária) e falta nas duas. Esperado: uma falta só (`miss_streak` soma 1, não 2). Teste na Tarefa 8.
3. **Uma chamada `videos.list` falha com HTTP 500.** Esperado: os vídeos daquela chamada **não** são contados como ausentes (falha de rede não é sumiço). Teste na Tarefa 8.
4. **O relógio do lote estoura antes da passada semanal.** Esperado: a série diária já foi gravada, os semanais ficam devidos pelo próprio dado e são lidos na faixa seguinte; a execução devolve quantos adiou. Teste na Tarefa 11.
5. **A função de prova devolve nulo ou uma forma inesperada** (função ausente, erro de rede). Esperado: o cron fica vermelho com "não foi possível ler a prova"; nunca verde. Teste na Tarefa 12.

---

## 3. Fatos medidos em produção em 12/10/2026 (só `select`, por `npx supabase db query --linked`)

| Fato | Valor | Para que serve |
|---|---|---|
| Canais concorrentes, sites | 15, 1 | todas as contas |
| Vídeos guardados | 1.390 (0 sem `published_at`, 0 fixados, 0 com `view_count` nulo) | volume, faixas |
| Com linha de série no último dia (12/10) | 674 | conjunto diário de hoje |
| Fora da série (viram faixa semanal) | 716; por canal: 235, 223, 88, 85, 45, 22, 7, 4, 2, 2, 1 e quatro canais com 0 | cota e tempo da passada semanal |
| Publicados em 30 dias; em 72 horas; em 14 dias | 127; 13; 55 | primeiras horas, regra de idade |
| Vídeos com até 30 dias fora dos 50 mais recentes | **0** (o canal que mais publica tem 45 em 30 dias) | a regra de idade não acrescenta leitura hoje |
| `comment_count = 0`; `like_count = 0` | 64; 2 | item 6 (não se sabe quantos são "desligado") |
| C0.8: `view_count`, `like_count`, `comment_count` | os três **anuláveis**, `default 0` | a MG1 só tira o padrão; não precisa de `drop not null` |
| C0.8: `youtube_quota_usage` | chave `(site_id, date)`; `operations jsonb default '[]'`; **0 linhas** | a soma é por site e dia; a MG1 troca o padrão para `'{}'` |
| C0.8: escritores de `competitor_videos` | um `insert` (`competitor-sync.ts:484`), quatro `update` (`competitor-sync.ts:329` e `:520`, `short-backfill.ts:58`, `competitors/actions.ts:473`); nenhum depende do padrão 0 | compatibilidade da MG1 |
| `competitor_videos` e `competitor_video_daily` não têm `site_id` | o site vem do canal | forma das funções de prova |
| Tamanho do banco | 178.990.227 bytes (≈ 179 MB) | a conta do volume |
| `competitor_videos` 2,76 MB; `competitor_video_versions` 2,15 MB (2.126 linhas, ≈ 1.010 B cada); `competitor_video_daily` 0,96 MB (6.154 linhas, ≈ 156 B cada); `competitor_channel_snapshots` 0,65 MB | | a conta do volume |
| Série diária | de 03/10 a 12/10, um ponto por vídeo por dia; lida entre 12:00:49 e 12:21:55 de São Paulo | tempo |
| Dos 716 fora da série, com versão de título guardada | **29**; 687 sem versão nenhuma | pergunta 1; a primeira leitura semanal abre linha de base, não "troca" |
| Versões correntes vistas há mais de 8 dias | 12 | tamanho do caso "janela longa" (Tarefa 11) |
| Descrição corrente: média e máximo | 1.097 e 5.126 bytes | tamanho do `raw` |
| Cron `sync-youtube-competitors` | último sucesso 12/10 18:20 UTC, 0 falhas seguidas, nunca falhou | linha de base da saúde |
| **Duração por canal na faixa das 12:00** (diferença entre os inícios seguidos) | 24, 23, 24, 21, 15, 10, 20, 22, 21, 18 s nos dez primeiros; 27, 22, 17 s no segundo disparo. Mediana 21 s | tempo |
| **A faixa das 12:00 já não cabe num disparo** | o primeiro disparo começou o 1º canal às 12:00:49 e o 11º às 12:04:06 (197 s); os quatro canais restantes saíram no disparo das 12:20 | tempo; item 22 |
| `cron_runs` não registra este cron | 0 linhas com `sync-youtube` | a duração só se mede pelos inícios dos canais (consulta K12) |

**Não medido, declarado estimativa onde aparecer:** o tempo de ida e volta ao banco a partir da Vercel (suposto 50 ms; a Tarefa 14 mede); o tamanho real de uma resposta `videos.list` com as quatro partes (o banco não guarda nenhuma hoje); quantos vídeos antigos trocaram de título desde a última vez que foram vistos; o atraso do disparo da Vercel na hora cheia (o primeiro canal começa 49 s depois das 12:00: inclui o atraso e a sonda de controle; é a conferência C0.5, da E16).

**Medido no banco local, com dado sintético** (1.000 vídeos, resposta de 3,9 kB com descrição repetitiva; transação desfeita): `competitor_field_versions` **296 B por linha** com os três índices; `competitor_raw` **1.507 B por linha** (a descrição sintética comprime melhor que a real: o real fica entre 2 e 3 kB, estimativa); `competitor_video_tier_spans` 246 B; `competitor_video_early` 156 B.

**Medido por simulação determinística** (o teste da Tarefa 17, rodado em 12/10 numa cópia do motor; dado sintético com a forma do pacote): o pacote em cache do maior canal (285 vídeos, 50 diários) com um ano de série diária **e semanal** tem **665.900 caracteres (33% do teto de 2 milhões)**; só com a diária, cerca de 431 mil. No teto de 200 diários mais 800 semanais não cabe (cerca de 2,5 milhões); sem a semanal, 1.641.404 (82%). Por isso a Tarefa 17 leva a série semanal no pacote e tem a saída de emergência do spec, com teste.

## 4. A conta: cota

A Data API cobra 1 unidade por chamada `videos.list`, `channels.list` e `playlistItems.list`, qualquer que seja o número de partes (documentação oficial; inventário 2.3). Pedir `liveStreamingDetails` não custa nada.

| Parcela | Por canal por dia | 15 canais | 20 canais | Base |
|---|---|---|---|---|
| Sincronização de hoje: 4 faixas × (canal + página de uploads + detalhes) | 12 | 180 | 240 | lido no código (`video_limit` 50 dá 1 página) |
| Passada diária: uma chamada por 50 vídeos da faixa diária | 1 | 15 | 20 | 674 vídeos em 15 canais, no máximo 50 por canal |
| **E1** (partes novas nas mesmas chamadas) | 0 | 0 | 0 | D1 |
| **E2, passada semanal**: os devidos do dia entram nos mesmos lotes de 50 da passada diária; canal com 50 diários e pelo menos um semanal devido faz 1 chamada a mais | 0 a 1 | **≈ 8** | ≈ 13 | seis canais têm semanal devido todo dia (235, 223, 88, 85, 45 e 22 vídeos); os cinco pequenos, em parte dos dias (7, 4, 2, 2 e 1 vídeos: 0,66 + 0,46 + 0,27 + 0,27 + 0,14) |
| **E2, primeiras horas** (reaproveita a página de uploads) | 0 | 0 | 0 | 4.3, ponto 4 |
| **Total** | | **≈ 203 (2,0% de 10.000)** | **≈ 273 (2,7%)** | |

- **Pior caso por canal:** um canal em modo `full` com 2.000 vídeos guardados tem 1.950 semanais, 279 por dia, 6 chamadas. Com 75 canais do tamanho de hoje: ≈ 1.050 por dia (10,5%).
- A cota é a mesma do A/B Lab, do envio de vídeos e da busca de canais (fato 13 do spec). **O que a E1 passa a registrar em `youtube_quota_usage` é só a parte dos concorrentes** (chave `competitors`); a soma do projeto inteiro continua sem registro. Dito para não se ler a linha do dia como "a cota do dia".
- A conta é presa por teste: a Tarefa 11 afirma o número de chamadas de uma sincronização com 50 diários e 34 semanais devidos (5 chamadas: canal, página, detalhes e 2 lotes; 4 quando a página não traz vídeo), e a Tarefa 9 afirma que o número gasto é o que vai para a linha do dia.

## 5. A conta: tempo de função e volume

**Tempo.** Limites de hoje, lidos no código: `maxDuration` 300 s; o lote para de começar canal aos 200 s (`budgetMs`), até 15 canais por disparo, cron a cada 20 minutos, faixas de 6 horas (18 disparos por faixa).

| | Hoje (medido) | Depois, semana 1 (estimativa) | Depois, em regime (estimativa) |
|---|---|---|---|
| Canal típico, faixa das 12:00 | 21 s | ≈ 22 s | ≈ 21,5 s |
| Maior canal (285 vídeos, 34 semanais devidos por dia) | 21 s | ≈ 27 s | ≈ 25 s |
| Soma da faixa das 12:00, 15 canais | ≈ 305 s, **2 disparos** | ≈ 335 s, 2 disparos | ≈ 325 s, 2 disparos |
| 20 canais | ≈ 410 s, 3 disparos | ≈ 465 s, 3 disparos | ≈ 450 s, 3 disparos |
| 75 canais | ≈ 1.540 s, 8 disparos (2 h 40) | ≈ 1.700 s, 9 disparos (3 h) | idem |

De onde vem o acréscimo (suposição: 50 ms por ida ao banco, a medir na Tarefa 14 e em D0): por sincronização de canal, cerca de 7 idas a mais (captura do canal, captura da página, carimbo de "visto", cota, leitura de todos os vídeos) ≈ 0,35 s; na faixa das 12:00, os 102 vídeos semanais do dia custam uma chamada à API por lote (≈ 0,4 s), a gravação da linha do vídeo (≈ 50 ms cada) e, só na primeira semana, a linha de base de título e descrição (≈ 60 ms cada): ≈ 22 s na semana 1, ≈ 16 s depois. A sonda de miniatura, que é o que mais pesa hoje (cerca de 15 dos 21 s), **não** é feita para os semanais (pergunta 1).

**O que protege se a estimativa estiver errada** (preso por teste na Tarefa 13): a passada semanal só começa um lote enquanto o disparo tem menos de 150 s (`WEEKLY_CUTOFF_MS`); a diária vem sempre antes; o que não coube fica devido pelo dado e é lido na faixa das 18:00. A ordem dos tetos é `150 s < 200 s < 230 s < 300 s`.

**Volume, uma vez** (do D0 ao D+6, à medida que cada vídeo é lido pela primeira vez):

| O quê | Linhas | Tamanho | Base |
|---|---|---|---|
| Primeiro valor de cada campo (10 por vídeo, 7 por canal) | 14.005 | ≈ 4,1 MB | 296 B por linha, medido local |
| Primeira resposta guardada (`raw`) | 1.405 | 2,1 a 4,2 MB | 1,5 kB medido com texto sintético; 3 kB é o teto estimado |
| Faixa inicial de cada vídeo | 1.390 | 0,34 MB | 246 B, medido local |
| Linha de base de título e descrição dos 687 nunca conferidos | 1.374 | ≈ 1,4 MB | 1.010 B por versão, medido em produção |
| **Total** | | **≈ 8 a 10 MB** (o banco vai de 179 para ≈ 189 MB) | |

**Volume, por dia e por ano, só o que este plano acrescenta:**

| O quê | Por dia | Por ano, 15 canais | Por ano, 20 canais | Base |
|---|---|---|---|---|
| Série semanal (716 vídeos × 52) | 102 linhas, 16 kB | 5,8 MB | 7,7 MB | 156 B medidos; cresce cerca de 0,8 MB por canal a cada ano (9.6) |
| Primeiras horas (vídeo novo × até 12 leituras) | ≈ 50 linhas, 8 kB | 2,9 MB | 3,9 MB | 127 vídeos novos em 30 dias (medido); com a E15 passa a uma leitura por hora |
| `raw` (vídeo novo e resposta que mudou) | ≈ 7,5 linhas, 11 a 22 kB | 4,1 a 8,2 MB | 5,5 a 11 MB | 1.545 novos por ano (medido) mais 80 mudanças por canal (estimativa do spec) |
| Histórico de campo | ≈ 46 linhas, 14 kB | 5,0 MB | 6,7 MB | 10 linhas por vídeo novo mais as mudanças (estimativa) |
| Faixas no tempo | ≈ 8 linhas, 2 kB | 0,8 MB | 1,0 MB | 2 linhas por vídeo novo na vida |
| **Total** | **≈ 51 a 62 kB** | **≈ 19 a 23 MB** | **≈ 25 a 30 MB** | a série diária que já existe (38 MB por ano) não muda |

O histórico de campo custa mais que a estimativa do spec (0,2 MB por canal por ano, contra 0,33): a linha é pequena, os três índices não. Não muda decisão; a consulta K11 mede o real em D+8.

## 6. O que acontece quando o dado não existe, e em cada falha

"Vermelho" = `cron_health` do `sync-youtube-competitors` em falha, que o vigia (`cron-watchdog`, a cada 15 minutos) avisa. **Todo vermelho abaixo é lido do banco a cada disparo** (a cada 20 minutos), pelas funções `competitor_capture_health` e `competitor_series_health`: não é nota de uma execução que o disparo seguinte apaga.

| Situação | Hoje | Depois | Como o dono vê | Tem fim? |
|---|---|---|---|---|
| O YouTube não devolve `commentCount` | grava 0 | nulo e `comments_disabled` | a tela diz "não medido" | — |
| Não devolve `viewCount` (estatística oculta, estreia agendada) | a linha diária não é gravada; o vídeo é pedido de novo, sem aviso | `views_hidden`; sem linha de série; **fora das provas**; a execução devolve "N fora da prova" | número na resposta do cron (`fora_da_prova`) | sai sozinho quando a contagem volta |
| Uma parte inteira da resposta não vem | os campos são sobrescritos com vazio | os campos daquela parte não são comparados; `partsMissing` na resposta | resposta do cron | — |
| O vídeo deixa de vir de `videos.list` | a linha fica congelada, sem marca | 1ª leitura: `miss_streak = 1`; 2ª seguida: `missing_since` com a data da 1ª e versão `availability = 'sumiu'`. Nada é apagado | `videos_ausentes` na resposta do cron; a fila na tela é a E9 | sai quando volta (abre `no_ar`) ou quando o dono decidir (E9) |
| A chamada `videos.list` falha (HTTP 500, tempo) | o canal fica em erro | igual, **e nenhum vídeo daquela chamada conta como ausente** | o canal aparece em "erro" na lista de canais | na sincronização seguinte |
| `channels.list` vem sem o canal | o canal fica em erro "não encontrado" | igual, mais `miss_streak`; na 2ª, `missing_since` | "erro" na lista; `canais_ausentes` na resposta | quando voltar ou na E9 |
| Um canal fica em erro por mais de 12 horas (duas faixas) | **verde** (o disparo seguinte, sem nada devido, grava sucesso) | **vermelho**: "N canais em erro há mais de 12 h" | vigia | quando o canal sincronizar, ou o dono o remover |
| A gravação do histórico de campo ou do `raw` falha | — | a série do dia já foi gravada antes; o canal termina em erro ("captura: …"); o "visto" não é carimbado, então a janela da próxima mudança continua certa | "erro" na lista; vermelho se metade dos canais falhar; `videos_vistos_sem_raw` na prova | na sincronização seguinte (o plano é refeito do zero) |
| A resposta de um vídeo passa de 100 kB | — | não é guardada; `rawTooBig` | **vermelho**: "N vídeos lidos sem resposta guardada" | só subindo o teto (uma constante); nunca visto: a descrição máxima é 5 kB |
| A cota não é gravada | nunca é gravada (0 linhas) | a sincronização segue; **vermelho** se houve canal lido no dia do Pacífico e a linha do dia está em 0 | vigia | quando a gravação voltar |
| Mais de 200 vídeos na regra diária | (não existe) | os mais antigos da regra de idade vão para a semanal; o número fica em `operations.teto_diario_cortados` e na resposta | resposta do cron e linha da cota | — |
| A passada diária falha para um canal | o canal fica em erro; a sincronização seguinte completa | igual; **e** depois das 18:00, com a faixa inteira tentada: vermelho "N vídeos da faixa diária sem ponto hoje" | vigia | no dia seguinte vira a linha de baixo |
| Ficou um dia sem ponto na faixa diária | **verde**, e o motor recusa o intervalo | **vermelho por 3 dias**: "N buracos na série diária nos últimos 3 dias" | vigia | sai sozinho no 4º dia (o ponto não volta; o aviso não é eterno) |
| Um vídeo semanal passa de 8 dias sem ponto | (não existe) | **vermelho**: "N vídeos da faixa semanal sem ponto há mais de 8 dias" | vigia | quando for lido; vídeo ausente ou sem contagem fica fora |
| O relógio não deixou começar a passada semanal | (não existe) | `weeklyDeferred` na resposta; os vídeos seguem devidos | resposta do cron | na faixa das 18:00; se falhar três dias, vira a linha de cima |
| Vídeo com `series_tier` sem linha de faixa correspondente, ou sem faixa depois de o canal sincronizar | (não existe) | **vermelho**: "N vídeos sem faixa de série" | vigia | na sincronização seguinte do canal |
| A função de prova não responde, ou responde outra forma | (não existe) | **vermelho**: "não foi possível ler a prova" | vigia | quando responder |
| As migrations não foram aplicadas | (não se aplica) | o cron para antes de qualquer gravação: "migrations MG1/MG2 não aplicadas" | vigia | quando o dono aplicar |
| Nenhum canal cadastrado | "ok", nada a fazer | igual: as provas contam 0 em tudo e não há alarme | — | — |
| Canal novo, sem `last_seen_at` | — | a primeira versão de cada campo nasce `first` (não é mudança) | — | — |
| Vídeo anterior à MG1 (`discovered_at` nulo) | — | nunca ganha "primeiras horas" e a tela dirá "antes de dd/mm"; não é preenchido por palpite | — | — |
| Vídeo anterior à MG2 (sem linha de faixa) | — | ganha a faixa na primeira sincronização do canal; antes disso nunca tem intervalo semanal | — | — |
| A série semanal não cabe no pacote em cache (Lote 2) | — | o pacote é refeito sem ela, com a marca `weeklyOmitted`, e um aviso no Sentry | Sentry; a tela continua como hoje | quando o canal encolher ou o teto mudar |

## 7. Simulação do dia do deploy e dos seguintes

D0 é o dia em que o Lote 1 é promovido a `main`. **A data absoluta de D0, D+1, D+3, D+7 e D+8 é escrita no ledger pelo controlador no commit do deploy** (item 246).

**Antes de D0** (qualquer dia): o dono aplica MG1 e MG2. O código antigo segue: mesmas chamadas, mesmas gravações, tabelas novas vazias (V2).

**D0, primeiro disparo depois da promoção.** A guarda `schemaReady` passa. Para cada canal devido na faixa:

1. `channels.list`: os 7 campos do canal nascem `first`; 1 linha de `raw` do canal; `last_seen_at` do canal.
2. Página de uploads (50 vídeos, agora com `liveStreamingDetails`): para cada um, 10 campos `first` e 1 `raw` (duas gravações por página, não por vídeo); sinalizadores e contagens na linha do vídeo; vídeo novo ganha `discovered_at`.
3. Faixas: **todos** os vídeos do canal são classificados (uma gravação por canal): os 50 mais recentes, diária; o resto, semanal. Uma linha de faixa por vídeo.
4. Se a faixa for a das 12:00 ou a das 18:00: a passada diária como hoje (os vídeos já capturados no passo 2 não são capturados de novo), mais os semanais cujo dia fixo é hoje (cerca de 1 em 7): ponto na série, campos, `raw`, linha de base de título e descrição.
5. A linha do dia em `youtube_quota_usage` nasce, com `operations = {"competitors": N}`.

Se a promoção for depois das 12:21 de São Paulo, os canais já foram lidos pelo código antigo nessa faixa: o primeiro contato do código novo é a faixa das 18:00 (que também passa das 12:00, então a diária e a semanal do dia rodam lá; a diária já tem os pontos de hoje e não regrava).

| | O que roda | O que grava (15 canais) | O que aparece em falha |
|---|---|---|---|
| **D0** | o descrito acima | `raw`: 15 + ≈ 776 (674 diários, ≈ 102 semanais); campos: 105 + ≈ 7.760; faixas: 1.390; série: os 674 de sempre mais ≈ 102; versões de título e descrição: ≈ 196; cota: 1 linha | nada esperado. Se vier: "N vídeos lidos sem resposta guardada" (captura falhou), "cota do dia não registrada", "N vídeos sem faixa". "Buracos" e "semanal atrasado" não podem aparecer: as faixas começam hoje |
| **D+1 a D+6** | cada dia, mais ≈ 102 semanais ganham o primeiro ponto, a primeira resposta e a linha de base | por dia: ≈ 102 `raw`, ≈ 1.020 campos, ≈ 102 pontos, ≈ 196 versões; quase nada nos 674 diários (só o que mudou) | um dia de diária perdido deixa "buracos" por 3 dias |
| **D+3** | primeiro vídeo descoberto depois do deploy completa 72 horas | — | consulta K8 (item 16): tem de voltar vazia |
| **D+6** | — | todos os 1.390 têm `raw`, campos e pelo menos um ponto | K1 = 0 |
| **D+7** | os semanais do dia fixo de D0 ganham o **segundo** ponto: primeira vez em que a promoção por ganho (1.000 views e 5%) pode disparar, e primeira vez em que uma troca de título num semanal pode ser detectada | pontos; `daily_until` em quem for promovido | — |
| **D+8** | a prova "semanal sem ponto há mais de 8 dias" passa a valer (antes, nenhuma faixa tinha 8 dias) | — | "N vídeos da faixa semanal sem ponto há mais de 8 dias" se a passada tiver sido adiada três dias seguidos |

**O que não acontece em D0, para ninguém procurar:** nenhuma "troca" falsa em massa (687 dos 716 antigos não têm versão: a primeira leitura abre linha de base); nenhuma notificação em rajada (mudança com janela de mais de 8 dias é gravada como versão, com a janela honesta, mas não vira aviso nem linha de `competitor_changes`: Tarefa 11); nenhuma sonda de miniatura a mais; nenhum arquivo novo no Blob.

## 8. Desvios declarados do texto do spec (para os revisores)

O spec é a referência; onde o plano faz diferente, é aqui, com o motivo.

| # | Onde | O spec diz | O plano faz | Por quê |
|---|---|---|---|---|
| D-1 | MG1 | `miss_streak`, `missing_since`, `last_seen_at` | mais uma coluna, `miss_first_at`, no vídeo e no canal | "`missing_since` recebe a data da **primeira** das duas leituras" não tem de onde sair: `last_seen_at` é a última vez que veio, não a primeira que faltou. Num vídeo semanal as duas podem distar 7 dias |
| D-2 | 4.1 | `apply_competitor_field_plan(p_channel, p_video, p_close bigint[], p_open jsonb)`, uma chamada por vídeo | `(p_site_id, p_channel_id, p_close jsonb, p_open jsonb)`, uma chamada por lote de até 50 vídeos; `p_close` leva `{id, last_seen_at}` | em D0 seriam 776 chamadas, cerca de 40 s a mais numa faixa que já usa os 200 s; e a data de fecho (item 223) vem de quem leu o vídeo antes de regravá-lo |
| D-3 | 4.1 | `value_hash` = sha256 do JSON canônico | os 16 primeiros caracteres hexadecimais (o mesmo corte de `hashValue`, em `competitor-versions.ts`); o `raw` usa o sha256 inteiro | 49 bytes a menos por linha em 14 mil linhas; a chave é a identidade, não o hash (A, B, A não colide) |
| D-4 | 4.1 | "a primeira linha de cada campo tem `precision = 'first'`" | vale também para `availability` (uma linha `no_ar` por vídeo) | uma regra só: "sumiu" e "voltou" são trocas de um campo como outro qualquer, e uma falha no meio se conserta sozinha |
| D-5 | 4.3 | faixa do intervalo por horas: até 36 h diário, até 8 dias semanal | diário = dois dias seguidos (como o motor faz hoje); semanal = de 2 a 8 dias **de calendário** de São Paulo, com todos os dias do meio em faixa semanal | pela conta em horas, um intervalo que o motor aceita hoje (publicação às 20:00, primeiro ponto 40 h depois) seria recusado e os números das telas mudariam (item 20); e uma leitura às 12:02 oito dias depois de uma às 12:00 cairia fora por 2 minutos |
| D-6 | 4.3, efeito 1 e item 19 | efeito de troca sobre série semanal responde "inconclusivo: série semanal" | a frase vai no **motivo**; o estado continua `sem-serie` | as telas contam os `inconclusivo` e indexam uma tabela pelo tipo; estado novo mudaria contadores sem mockup (isso é da E5) |
| D-7 | 4.3, efeito 2 | `load.ts` lê a série dos observados e dos que têm linha | lê, e põe a dos **não observados** num campo novo (`unobservedSeries`); `series` continua vazia para eles | nenhum campo que as telas leem hoje muda: o item 20 vira consequência da forma do dado, provada por teste, e a E4 e a E5 ligam a leitura com mockup |
| D-8 | 4.1 | o `comment_count` deixa de receber 0; "as 64 linhas com 0 ficam até a próxima leitura" | idem; **e** os 716 vídeos fora da série só são relidos na semana do deploy | consequência da cadência semanal: parte dos 64 zeros só se corrige até D+6 |
| D-9 | 4.3 | promoção quando "foi detectada mudança de título, miniatura ou descrição" | num vídeo semanal, só título e descrição (pergunta 1); e mudança cuja janela passa de 8 dias não promove | sem ponto antes da troca não há efeito a medir |
| D-10 | item 246 | toda conferência "N dias depois" é uma entrada em `lib/conferencias.ts` | este plano **não** cria esse arquivo: as provas NP da E1 e da E2 rodam dentro do próprio cron a cada 20 minutos; as conferências manuais (K1 a K14) têm data absoluta no ledger | a lista do item 246 não cita item da E1 nem da E2; a prova embutida é mais forte que um lembrete. Se os revisores exigirem, é uma tarefa pequena a mais |
| D-11 | 4.5 | "a sincronização encontra o vídeo em `competitor_removed_items` e não o recoleta" | a tabela é criada (MG1), mas **o sync ainda não a consulta** | nada escreve nela antes da E9 (a função de apagar é de lá). Fica como obrigação escrita para o plano da E9: a consulta entra no laço da página, antes do `insert` |

**OP-15 (quem dispara a passada semanal entre as ordens 4 e 5).** Escolha: **a segunda saída do spec, chamar a passada de dentro do lote antigo, devida pelo próprio dado.** A passada roda dentro de `syncCompetitorChannel`, na mesma faixa da diária (12:00 e 18:00 de São Paulo), sem entrada nova de cron. Um vídeo semanal é devido quando não tem ponto hoje e (hoje é o dia fixo dele, **ou** o último ponto dele tem 7 dias ou mais, **ou** nunca teve ponto e está na faixa há 7 dias ou mais). Provas por teste (Tarefa 11): devido no dia fixo; não devido no dia seguinte a uma leitura; devido de novo no 7º dia mesmo fora do dia fixo; adiado pelo relógio, continua devido na faixa seguinte; em D0, só 1 em 7 é lido. Quando a E16 chegar, a tarefa `serie_semanal` chama a mesma função (`weeklyDue`), e a passada sai do lote por uma opção (`weekly: false`).

## 9. Arquivos, ordem, paralelismo e a separação da A4

**Arquivos novos**

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `supabase/migrations/<carimbo>_observatorio_a5_e1_campos_sinalizadores_raw.sql` | MG1 (Apêndice A) | 1 |
| `supabase/migrations/<carimbo>_observatorio_a5_e2_serie_faixas.sql` | MG2 (Apêndice B) | 1 |
| `apps/web/test/integration/observatorio-a5-e1-e2-migration.test.ts` | funções SQL, concorrência da cota, RLS (banco local) | 1 |
| `apps/web/src/lib/youtube/observatorio/field-catalog.ts` | o catálogo fechado de campos com histórico | 2 |
| `apps/web/src/lib/youtube/competitor-capture.ts` | puro: JSON canônico, hash, `raw`, extração da resposta, plano de versões; e a gravação (`captureItems`, `markMissing`) | 2, 3, 4 |
| `apps/web/src/lib/youtube/competitor-tiers.ts` | puro: faixa de cada vídeo, dia fixo da semana, devido, promoção, primeiras horas | 5 |
| `apps/web/src/lib/youtube/competitor-quota.ts` | dia do Pacífico e soma da cota | 9 |
| `apps/web/src/lib/youtube/competitor-health.ts` | leitura das duas provas e o veredito; a guarda de schema | 9, 12 |
| `apps/web/test/youtube/competitor-capture.test.ts`, `competitor-tiers.test.ts`, `competitor-quota.test.ts`, `competitor-health.test.ts` | testes dos módulos puros | 2 a 5, 9, 12 |
| `apps/web/test/youtube/competitor-sync-harness.ts` | o falso do banco e os auxiliares do sync, movidos do teste antigo para os dois arquivos usarem | 6 |
| `apps/web/test/youtube/competitor-sync-a5.test.ts` | testes da integração nova (o arquivo antigo já tem 850 linhas) | 6 a 11 |
| `apps/web/test/youtube/cron-competitors-prova.test.ts` | a rota: guarda de schema e a prova a cada disparo | 9, 13 |
| `apps/web/test/youtube/observatorio/serie-semanal.test.ts`, `pack-semanal.test.ts` | o motor e o pacote (Lote 2) | 16, 17 |
| `.superpowers/sdd/a5-e1-e2/progress.md` | ledger (OP-15 copiada, estados, medições, datas) | 0 |

**Arquivos modificados**

| Arquivo | O que muda | Tarefa | A A4 toca? |
|---|---|---|---|
| `apps/web/src/lib/youtube/competitor-sync.ts` | as quatro partes, a linha do vídeo, captura, ausência, cota, faixas, semanal, primeiras horas | 6 a 11 | não |
| `apps/web/src/lib/youtube/competitor-sync-batch.ts` | soma dos contadores novos, corte da semanal, sites para a prova | 13 | não |
| `apps/web/src/app/api/cron/sync-youtube/route.ts` | guarda de schema, prova, mensagem de falha | 9, 13 | não |
| `apps/web/src/lib/youtube/observatorio/rules.ts` | `RULES.series`, `RULES.promotion` | 5 | não |
| `apps/web/test/youtube/competitor-sync.test.ts` | o falso do banco e os testes que mudam de expectativa | 6, 7, 10 | não |
| `apps/web/test/youtube/competitor-sync-batch.test.ts`, `cron-competitors-invalidate.test.ts`, `cron-route.test.ts`, `competitor-backfill.test.ts`, `competitor-video-limit.test.ts`, `apps/web/test/api/cron/sync-youtube.test.ts`, `apps/web/test/integration/competitor-sync-versions.test.ts` | os falsos ganham as leituras novas | 6 a 13 | não |
| `apps/web/src/lib/youtube/observatorio/types.ts`, `series.ts`, `effect.ts`, `index.ts`, `load.ts` (só `rowsToDataset`) | faixa, faixas no tempo, série dos não observados, intervalo semanal, `weeklyRate` | 16 | não |
| `apps/web/src/lib/youtube/observatorio/load.ts`, `load-channel.ts`, `load-page.ts`, `pack.ts` | ler tudo, faixas, `PACK_VERSION` 2, saída de emergência | 17 | não |
| `apps/web/test/youtube/observatorio/load-fixture.ts`, `pack-shape.test.ts`, `pack.test.ts`, `load*.test.ts` | fixture com semanal; retrato da forma | 17 | não |

**A A4 (local, inacabada, 78 commits à frente) não toca nenhum arquivo desta lista.** Conferido em 12/10 com `git diff --name-only origin/staging..HEAD -- apps/web/src apps/web/test apps/web/e2e`: em `src` ela mexe só em `app/cms/(authed)/youtube/competitors/**`, `lib/youtube/observatorio/links.ts`, `stats.ts` e `proprio/**`; em teste, em `test/helpers/fake-supabase.ts`, `e2e/fixtures/observatorio-seed.ts` e nos testes das telas. **Dois arquivos pedem cuidado, porque este plano os usa sem mexer:** `test/helpers/fake-supabase.ts` (a A4 acrescentou 7 linhas) e `e2e/fixtures/observatorio-seed.ts`. Os testes do Lote 2 têm de passar com a versão de `origin/staging` desses dois arquivos: a prova é rodá-los numa árvore extraída do commit a enviar, como foi feito na E12. O envio segue o roteiro da E12 (`.superpowers/sdd/a5-e12/progress.md`, "Roteiro do envio separado"): remontar os commits deste plano sobre `origin/staging` por `merge-tree` e `commit-tree`, conferir a árvore por duas construções, empurrar por `bash -c 'git push origin "$0:refs/heads/staging"'`, e fazer o merge de volta. A guarda do roteiro (os commits só podem tocar os arquivos da lista acima mais este plano) é a primeira linha.

**Ordem que mantém a árvore verde.** Lote 1: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15. Cada tarefa termina com os testes dela e os vizinhos verdes e com o typecheck limpo.

**O que pode rodar em paralelo sem colidir em arquivo** (o padrão é um implementador por vez; se o controlador quiser abrir dois):

- 5 (faixas, `competitor-tiers.ts` e `rules.ts`) com 2 → 3 → 4 (`competitor-capture.ts`).
- 12 (`competitor-health.ts`, só a parte do veredito) com qualquer uma de 6 a 11 **depois** da 9, que cria o arquivo.
- **O Lote 2 inteiro (16, 17) com o Lote 1, depois da Tarefa 5:** a 16 usa `RULES.series`, que a 5 cria em `rules.ts`; fora isso os dois lotes não compartilham arquivo de código nem de teste. Só o envio (18) espera o 15.
- **Nunca em paralelo:** 6 a 11 (todas em `competitor-sync.ts` e no mesmo falso do banco).

**Interruptor e plano de volta.** O spec não dá variável de ambiente à E1 nem à E2 ("só acrescentam"); a tarefa `serie_semanal` ganha interruptor na E16. Até lá:

- **Proteção sem interruptor:** a passada semanal se corta sozinha aos 150 s do disparo; a diária vem antes; uma captura que falha não impede a série do dia.
- **Volta:** `git revert` dos commits do lote, push em `staging`, CI, promoção (cerca de 15 minutos, 4 builds). As tabelas e colunas ficam, sem uso. O código antigo convive com elas (seção 2). **O que não se desfaz:** nada. As linhas gravadas ficam (são dado verdadeiro); se a coleta voltar depois, o histórico continua de onde parou, com a janela honesta (`gap`).
- **Volta só da passada semanal** (se ela, e só ela, der problema): reverter o commit da Tarefa 11; os vídeos semanais ficam sem ponto, e a prova "semanal sem ponto há mais de 8 dias" acusa a partir de D+8, que é o aviso certo.
- **Volta do Lote 2:** reverter os commits 16 e 17; `PACK_VERSION` volta a 1 e as entradas de cache da versão 2 são ignoradas (a tela lê o banco).

---

## Lote 1: a coleta

### Task 0 (controlador): ledger

Sem código. Antes da Tarefa 1.

- [ ] **Step 1:** criar `.superpowers/sdd/a5-e1-e2/progress.md` com a tabela de tarefas (estado, commit, revisão), a linha da OP-15 copiada do spec com a escolha deste plano (seção 8), e a lista "Dívida registrada" vazia.
- [ ] **Step 2:** confirmar com o dono as três decisões da seção 1 (ou registrar "sem resposta: vale o padrão").
- [ ] **Step 3:** conferir se o arquivo da MG13 (E20) já existe em `supabase/migrations/`. Se existir e não estiver aplicado, anotar que vai no mesmo `db:push:prod`.

### Task 1: migrations MG1 e MG2, com a prova no banco local

**Files:**
- Create: `supabase/migrations/<carimbo>_observatorio_a5_e1_campos_sinalizadores_raw.sql` (Apêndice A, inteiro)
- Create: `supabase/migrations/<carimbo>_observatorio_a5_e2_serie_faixas.sql` (Apêndice B, inteiro)
- Create: `apps/web/test/integration/observatorio-a5-e1-e2-migration.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces (funções SQL, todas `service_role`):
  - `apply_competitor_field_plan(p_site_id uuid, p_channel_id uuid, p_close jsonb, p_open jsonb) returns jsonb` → `{"closed": n, "opened": n}`. `p_close`: `[{"id": number, "last_seen_at": iso | null}]`. `p_open`: `[{"video_id": uuid | null, "field", "value", "value_hash", "first_seen_at", "window_start", "precision"}]`. Lança se abrir menos do que foi pedido.
  - `apply_competitor_raw_plan(p_site_id, p_channel_id, p_close jsonb, p_open jsonb) returns jsonb`. `p_open`: `[{"video_id", "raw_sha256", "first_seen_at", "raw"}]`.
  - `competitor_mark_missing(p_channel_id uuid, p_video_ids uuid[], p_now timestamptz) returns jsonb` → `[{"id", "miss_streak", "miss_first_at", "missing_since", "last_seen_at"}]`.
  - `competitor_channel_mark_missing(p_channel_id uuid, p_now timestamptz) returns jsonb` → o mesmo objeto, ou `null`.
  - `youtube_quota_add(p_site_id uuid, p_day date, p_units integer, p_add jsonb, p_max jsonb) returns integer` (o total do dia depois da soma).
  - `competitor_capture_health(p_site_id uuid, p_now timestamptz) returns jsonb` → chaves `videos_vistos_sem_raw`, `canais_vistos_sem_raw`, `canais_vistos_dia_pacifico`, `cota_dia_pacifico`, `videos_ausentes`, `canais_ausentes`, `canais_em_erro_12h`.
  - `apply_competitor_tier_plan(p_site_id uuid, p_channel_id uuid, p_changes jsonb, p_today date) returns jsonb` → `{"changed": n}`. `p_changes`: `[{"video_id", "tier"}]`.
  - `competitor_series_health(p_site_id uuid, p_now timestamptz) returns jsonb` → chaves `hoje`, `hora_sp`, `fora_da_prova`, `sem_faixa`, `diaria_sem_ponto_hoje`, `diaria_buracos_3d`, `semanal_atrasados`, `diaria_total`, `semanal_total`.

- [ ] **Step 1: prova de compatibilidade do código ANTIGO, antes de criar qualquer arquivo.** Guarde a linha de base:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run db:status > /dev/null && cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/competitor-sync-versions.test.ts test/integration/competitor-pin-schema.test.ts test/integration/observatorio-versoes-migration.test.ts test/integration/observatorio-canais-migration.test.ts test/integration/observatorio-load.test.ts test/integration/observatorio-seed.test.ts test/integration/observatorio-load-measure.test.ts > /tmp/a5-e1-antes.txt 2>&1; tail -8 /tmp/a5-e1-antes.txt
```

Esperado: todos passam (anote o número). Dois desses arquivos inserem vídeo sem informar as contagens (`observatorio-load.test.ts:29`, `competitor-pin-schema.test.ts:20`): depois da MG1 essas linhas nascem com contagem nula em vez de 0, e é por isso que eles estão na lista. Se o banco local não estiver de pé, pare e relate (não rode `db:reset`: outros terminais usam o mesmo banco).

- [ ] **Step 2: criar os dois arquivos, nesta ordem.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run db:new observatorio_a5_e1_campos_sinalizadores_raw && npm run db:new observatorio_a5_e2_serie_faixas && ls supabase/migrations | tail -3
```

Esperado: dois arquivos novos, o da E1 com carimbo menor que o da E2. Cole o Apêndice A no primeiro e o Apêndice B no segundo, **sem mudar uma linha** (o SQL dos apêndices é o que foi provado).

- [ ] **Step 3: aplicar no banco local.** O banco local está em `20261007000005`; o comando aplica também as quatro migrations oficiais que faltam lá (`20261007000006`, `20261008000001`, `20261008000002`, `20261009000001`), o que é o esperado.

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx supabase migration up --local 2>&1 | tail -12
```

Esperado: a lista das migrations aplicadas, terminando nas duas novas, sem erro. Depois rode a mesma linha de novo: "Local database is up to date". Para provar a idempotência do SQL (e não só do controle de versão), aplique os dois arquivos mais uma vez à mão:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && for f in $(ls supabase/migrations/*observatorio_a5_e*.sql); do docker exec -i supabase_db_bythiagofigueiredo psql -U postgres -v ON_ERROR_STOP=1 -q < "$f" 2>&1 | grep -ci error; done
```

Esperado: `0` e `0`.

- [ ] **Step 4: o código antigo contra o schema novo.** Rode de novo o comando do Step 1 com saída em `/tmp/a5-e1-depois.txt`. Esperado: o mesmo número de testes passando. É a prova de que a migration pode ir a produção antes do código. Se um teste falhar por esperar 0 numa contagem que ele não informou, é o teste que dependia do padrão antigo: ajuste-o para informar a contagem (o código de produção sempre informa) e diga isso no commit. **Aviso para o controlador:** o banco local é compartilhado; a partir deste passo o terminal da A4 também passa a ver as colunas novas e a contagem nula por padrão (a semente e2e dela informa as contagens, conferido em `e2e/fixtures/observatorio-seed.ts:549` e `:617`).

- [ ] **Step 5: escrever o teste de integração.** Arquivo `apps/web/test/integration/observatorio-a5-e1-e2-migration.test.ts`. Molde de preparação e limpeza: `test/integration/competitor-pin-schema.test.ts` (use `seedSite` de `../helpers/db-seed` e apague o canal e os sites no `afterAll`). Molde do cliente `pg` com papel sem superusuário e GUC forjado: `apps/api/test/rls/blog.test.ts:144-210`. Casos, um `it` por linha (o corpo de cada um segue o roteiro SQL já provado; as asserções são as mesmas):

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const T0 = new Date(Date.now() - 20 * 86_400_000) // 20 dias atrás: nada aqui depende do relógio de parede
const at = (h: number) => new Date(T0.getTime() + h * 3_600_000).toISOString()
const spDate = (iso: string) => new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().slice(0, 10)

describe.skipIf(skipIfNoLocalDb())('A5 E1 e E2: funções das migrations (banco local)', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  let siteId = '', otherSite = '', ch = '', v1 = '', v2 = ''
  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    siteId = (await seedSite(sb)).siteId
    otherSite = (await seedSite(sb)).siteId
    ch = (await sb.from('competitor_channels').insert({ site_id: siteId, channel_id: 'UCa5e1e2', channel_name: 'A5' }).select('id').single()).data!.id
    const vids = await sb.from('competitor_videos').insert([
      { competitor_channel_id: ch, video_id: 'a5e1e2vid01', published_at: at(-2400) },
      { competitor_channel_id: ch, video_id: 'a5e1e2vid02', published_at: at(-48) },
    ]).select('id, video_id, view_count, like_count, comment_count, miss_streak')
    expect(vids.error).toBeNull()
    v1 = vids.data!.find(v => v.video_id === 'a5e1e2vid01')!.id
    v2 = vids.data!.find(v => v.video_id === 'a5e1e2vid02')!.id
    // D2: sem o default 0, contagem não informada nasce nula
    expect(vids.data!.every(v => v.view_count === null && v.like_count === null && v.comment_count === null && v.miss_streak === 0)).toBe(true)
  })
  afterAll(async () => {
    await sb.from('competitor_channels').delete().eq('site_id', siteId)
    await sb.from('youtube_quota_usage').delete().in('site_id', [siteId, otherSite])
    await sb.from('sites').delete().in('id', [siteId, otherSite])
  })
  const open = (video_id: string | null, field: string, value: unknown, hash: string, first: string, win: string | null, precision: string) =>
    ({ video_id, field, value, value_hash: hash, first_seen_at: first, window_start: win, precision })
  const current = async (video: string) => (await sb.from('competitor_field_versions').select('id').eq('video_id', video).eq('is_current', true)).data!.map(r => ({ id: r.id, last_seen_at: at(6) }))

  it('item 5: A, B, A são três versões, uma corrente, e o fecho copia a última leitura boa', async () => {
    expect((await sb.rpc('apply_competitor_field_plan', { p_site_id: siteId, p_channel_id: ch, p_close: [], p_open: [open(v1, 'tags', ['a'], 'hA', at(0), null, 'first')] })).data).toEqual({ closed: 0, opened: 1 })
    expect((await sb.rpc('apply_competitor_field_plan', { p_site_id: siteId, p_channel_id: ch, p_close: await current(v1), p_open: [open(v1, 'tags', ['b'], 'hB', at(12), at(6), '6h')] })).data).toEqual({ closed: 1, opened: 1 })
    expect((await sb.rpc('apply_competitor_field_plan', { p_site_id: siteId, p_channel_id: ch, p_close: await current(v1), p_open: [open(v1, 'tags', ['a'], 'hA', at(18), at(12), '6h')] })).error).toBeNull()
    const rows = (await sb.from('competitor_field_versions').select('value_hash, is_current, last_seen_at').eq('video_id', v1).order('id')).data!
    expect(rows.map(r => r.value_hash)).toEqual(['hA', 'hB', 'hA'])
    expect(rows.filter(r => r.is_current)).toHaveLength(1)
    expect(Date.parse(rows[0]!.last_seen_at)).toBe(Date.parse(at(6)))
  })
  it('segunda versão corrente do mesmo campo é recusada, e a chamada inteira não grava nada', async () => {
    const before = (await sb.from('competitor_field_versions').select('id', { count: 'exact', head: true }).eq('competitor_channel_id', ch)).count
    const r = await sb.rpc('apply_competitor_field_plan', { p_site_id: siteId, p_channel_id: ch, p_close: [], p_open: [open(v2, 'category_id', '22', 'h22', at(0), null, 'first'), open(v1, 'tags', ['z'], 'hZ', at(20), at(18), '6h')] })
    expect(r.error?.message).toMatch(/duplicate|unique/i)
    expect((await sb.from('competitor_field_versions').select('id', { count: 'exact', head: true }).eq('competitor_channel_id', ch)).count).toBe(before)
  })
  it('vídeo de outro canal na lista: a função lança', async () => {
    const r = await sb.rpc('apply_competitor_field_plan', { p_site_id: siteId, p_channel_id: ch, p_close: [], p_open: [open('00000000-0000-4000-8000-000000000001', 'tags', [], 'x', at(0), null, 'first')] })
    expect(r.error?.message).toMatch(/versões abertas/)
  })
  it('campo do canal (video_id nulo) e valor nulo', async () => {
    expect((await sb.rpc('apply_competitor_field_plan', { p_site_id: siteId, p_channel_id: ch, p_close: [], p_open: [open(null, 'country', null, 'hnull', at(0), null, 'first')] })).data).toEqual({ closed: 0, opened: 1 })
    expect((await sb.from('competitor_field_versions').select('value').eq('competitor_channel_id', ch).is('video_id', null).single()).data!.value).toBeNull()
  })
  it('raw: abre, troca, e uma corrente por vídeo', async () => {
    expect((await sb.rpc('apply_competitor_raw_plan', { p_site_id: siteId, p_channel_id: ch, p_close: [], p_open: [{ video_id: v1, raw_sha256: 'r1', first_seen_at: at(0), raw: { id: 'x' } }, { video_id: null, raw_sha256: 'rc', first_seen_at: at(0), raw: { id: 'UC' } }] })).data).toEqual({ closed: 0, opened: 2 })
    const cur = (await sb.from('competitor_raw').select('id').eq('video_id', v1).eq('is_current', true)).data!.map(r => ({ id: r.id, last_seen_at: at(24) }))
    expect((await sb.rpc('apply_competitor_raw_plan', { p_site_id: siteId, p_channel_id: ch, p_close: cur, p_open: [{ video_id: v1, raw_sha256: 'r2', first_seen_at: at(48), raw: { id: 'y' } }] })).data).toEqual({ closed: 1, opened: 1 })
  })
  it('item 221: 1ª falta não marca; 2ª marca com a data (São Paulo) da 1ª; vir no meio zera', async () => {
    await sb.rpc('competitor_mark_missing', { p_channel_id: ch, p_video_ids: [v1, v2], p_now: at(0) })
    let rows = (await sb.from('competitor_videos').select('id, miss_streak, missing_since, miss_first_at').in('id', [v1, v2])).data!
    expect(rows.every(r => r.miss_streak === 1 && r.missing_since === null && Date.parse(r.miss_first_at) === Date.parse(at(0)))).toBe(true)
    await sb.from('competitor_videos').update({ miss_streak: 0, miss_first_at: null, missing_since: null, last_seen_at: at(6) }).eq('id', v2) // v2 veio
    const out = (await sb.rpc('competitor_mark_missing', { p_channel_id: ch, p_video_ids: [v1], p_now: at(30) })).data as Array<{ id: string; miss_streak: number; missing_since: string | null }>
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: v1, miss_streak: 2, missing_since: spDate(at(0)) })
    rows = (await sb.from('competitor_videos').select('id, miss_streak, missing_since').eq('id', v2)).data!
    expect(rows[0]).toMatchObject({ miss_streak: 0, missing_since: null })
    await sb.rpc('competitor_mark_missing', { p_channel_id: ch, p_video_ids: [v1], p_now: at(60) })
    expect((await sb.from('competitor_videos').select('miss_streak, missing_since').eq('id', v1).single()).data).toMatchObject({ miss_streak: 3, missing_since: spDate(at(0)) })
  })
  it('item 221, canal: o mesmo', async () => {
    expect(((await sb.rpc('competitor_channel_mark_missing', { p_channel_id: ch, p_now: at(0) })).data as { miss_streak: number; missing_since: string | null })).toMatchObject({ miss_streak: 1, missing_since: null })
    expect(((await sb.rpc('competitor_channel_mark_missing', { p_channel_id: ch, p_now: at(6) })).data as { missing_since: string | null }).missing_since).toBe(spDate(at(0)))
    await sb.from('competitor_channels').update({ miss_streak: 0, miss_first_at: null, missing_since: null }).eq('id', ch)
  })
  it('item 224: 20 somas ao mesmo tempo dão a soma das 20; operations soma por chave e guarda o maior em p_max', async () => {
    const day = spDate(at(0))
    await Promise.all(Array.from({ length: 20 }, (_, i) => sb.rpc('youtube_quota_add', { p_site_id: siteId, p_day: day, p_units: 3, p_add: { competitors: 3 }, p_max: { teto_diario_cortados: i } })))
    const row = (await sb.from('youtube_quota_usage').select('units_used, operations').eq('site_id', siteId).eq('date', day).single()).data!
    expect(row.units_used).toBe(60)
    expect(row.operations).toEqual({ competitors: 60, teto_diario_cortados: 19 })
  })
  it('item 222: troca de faixa grava a linha; sem mudança não escreve; promoção e rebaixamento no mesmo dia deixam UMA linha aberta com a última faixa', async () => {
    const d0 = spDate(at(0)), d5 = spDate(at(120))
    expect((await sb.rpc('apply_competitor_tier_plan', { p_site_id: siteId, p_channel_id: ch, p_changes: [{ video_id: v1, tier: 'semanal' }, { video_id: v2, tier: 'diaria' }], p_today: d0 })).data).toEqual({ changed: 2 })
    expect((await sb.rpc('apply_competitor_tier_plan', { p_site_id: siteId, p_channel_id: ch, p_changes: [{ video_id: v1, tier: 'semanal' }], p_today: spDate(at(24)) })).data).toEqual({ changed: 0 })
    await sb.rpc('apply_competitor_tier_plan', { p_site_id: siteId, p_channel_id: ch, p_changes: [{ video_id: v1, tier: 'diaria' }], p_today: d5 })
    await sb.rpc('apply_competitor_tier_plan', { p_site_id: siteId, p_channel_id: ch, p_changes: [{ video_id: v1, tier: 'semanal' }], p_today: d5 })
    const spans = (await sb.from('competitor_video_tier_spans').select('from_date, to_date, tier').eq('video_id', v1).order('from_date')).data!
    expect(spans).toEqual([{ from_date: d0, to_date: spDate(at(96)), tier: 'semanal' }, { from_date: d5, to_date: null, tier: 'semanal' }])
    expect((await sb.from('competitor_videos').select('series_tier, series_tier_since').eq('id', v1).single()).data).toEqual({ series_tier: 'semanal', series_tier_since: d5 })
  })
  it('as duas provas respondem com todas as chaves, em números', async () => {
    const c = (await sb.rpc('competitor_capture_health', { p_site_id: siteId, p_now: at(7) })).data as Record<string, unknown>
    for (const k of ['videos_vistos_sem_raw', 'canais_vistos_sem_raw', 'canais_vistos_dia_pacifico', 'cota_dia_pacifico', 'videos_ausentes', 'canais_ausentes', 'canais_em_erro_12h']) expect(typeof c[k]).toBe('number')
    expect(c.videos_ausentes).toBe(1) // v1
    const s = (await sb.rpc('competitor_series_health', { p_site_id: siteId, p_now: at(7) })).data as Record<string, unknown>
    for (const k of ['hora_sp', 'fora_da_prova', 'sem_faixa', 'diaria_sem_ponto_hoje', 'diaria_buracos_3d', 'semanal_atrasados', 'diaria_total', 'semanal_total']) expect(typeof s[k]).toBe('number')
    expect(s.fora_da_prova).toBe(1) // v1 ausente fica fora de todas as contas
  })
  it('competitor_channel_removal_impact conta as quatro tabelas novas e mantém as chaves antigas', async () => {
    const r = (await sb.rpc('competitor_channel_removal_impact', { p_site_id: siteId, p_channel_id: ch })).data as Record<string, unknown>
    expect(r).toMatchObject({ status: 'ok', videos: 2 })
    for (const k of ['pinned', 'versions', 'daily_days', 'bookmarks', 'field_versions', 'raw', 'early', 'tier_spans']) expect(typeof r[k]).toBe('number')
  })
})
```

Acrescente, no mesmo arquivo, o bloco de RLS (item 11), com `pg` e `set local role authenticated`, no molde de `apps/api/test/rls/blog.test.ts`: (a) usuário sem vínculo com o site, **com `set_config('app.site_id', '<siteId>', true)` forjado**, lê 0 linhas de `competitor_field_versions`, `competitor_raw`, `competitor_removed_items`, `competitor_video_early` e `competitor_video_tier_spans`; (b) usuário com `site_memberships` de papel `reporter` (vê, não edita) lê `competitor_field_versions`, `competitor_video_early` e `competitor_video_tier_spans` e lê **0** de `competitor_raw` e de `competitor_removed_items`; (c) usuário com papel `editor` lê as cinco; (d) nenhum dos três consegue `insert` em nenhuma das cinco; (e) `anon` e `authenticated` recebem erro de permissão ao chamar `apply_competitor_field_plan` e `youtube_quota_add`. Antes de escrever, leia como `can_view_site` e `can_edit_site` decidem (`select pg_get_functiondef('public.can_edit_site(uuid)'::regprocedure)` no banco local) para montar os três usuários certos.

- [ ] **Step 6: rodar.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/observatorio-a5-e1-e2-migration.test.ts 2>&1 | tail -25
```

Esperado: todos passam. Rode também sem a variável (`npx vitest run test/integration/observatorio-a5-e1-e2-migration.test.ts`): tudo pulado, zero falha.

- [ ] **Step 7: as consultas de conferência.** Rode V1, V2 e V3 (seção 2) e K1 a K14 (seção 10) no banco local por `docker exec -i supabase_db_bythiagofigueiredo psql -U postgres -c "<consulta>"`. Esperado: nenhuma dá erro de SQL; V1 dá 21, 12, 5, 5, 9, `'{}'::jsonb`, 0. (Todas já foram rodadas em 12/10 pelo autor do plano; este passo garante que o arquivo de migration colado é o mesmo.)

- [ ] **Step 8: commit.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add supabase/migrations/*observatorio_a5_e1_campos_sinalizadores_raw.sql supabase/migrations/*observatorio_a5_e2_serie_faixas.sql apps/web/test/integration/observatorio-a5-e1-e2-migration.test.ts && git commit -m "feat: migrations MG1 e MG2 da A5 (campos, sinalizadores, raw, faixas da série) com a prova no banco local" -- supabase/migrations apps/web/test/integration/observatorio-a5-e1-e2-migration.test.ts
```

**Pronto quando:** os dois arquivos existem com o SQL dos apêndices; o teste de integração passa com o banco local e pula sem ele; o código antigo passa nos testes de integração contra o schema novo; nenhuma consulta de conferência dá erro.

### Task 2: catálogo de campos, JSON canônico e `raw`

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/field-catalog.ts`
- Create: `apps/web/src/lib/youtube/competitor-capture.ts`
- Test: `apps/web/test/youtube/competitor-capture.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `VIDEO_FIELDS`, `CHANNEL_FIELDS` (tuplas `as const`), `type VideoField`, `type ChannelField`, `type FieldScope = 'video' | 'canal'`, `type FieldPrecision = '6h' | '1d' | '7d' | 'gap' | 'first'`, `assertField(scope: FieldScope, field: string): void`.
  - `type Json`, `canonicalJson(v: Json): string`, `sha256Hex(s: string): string`, `fieldHash(v: Json): string` (16 hex), `RAW_MAX_BYTES = 100_000`, `interface RawCapture { sha: string; raw: Json; bytes: number }`, `rawOf(item: unknown): RawCapture`, `optCount(v: unknown): number | null`.

- [ ] **Step 1: teste que falha.** `apps/web/test/youtube/competitor-capture.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { VIDEO_FIELDS, CHANNEL_FIELDS, assertField } from '@/lib/youtube/observatorio/field-catalog'
import { canonicalJson, fieldHash, sha256Hex, rawOf, optCount, RAW_MAX_BYTES } from '@/lib/youtube/competitor-capture'

describe('catálogo de campos', () => {
  it('é o do spec (4.1), na ordem', () => {
    expect([...VIDEO_FIELDS]).toEqual(['tags', 'category_id', 'duration_seconds', 'default_language', 'default_audio_language', 'live_broadcast_content', 'comments_disabled', 'likes_hidden', 'availability'])
    expect([...CHANNEL_FIELDS]).toEqual(['name', 'custom_url', 'description', 'country', 'avatar_url', 'subscribers_hidden', 'availability'])
  })
  it('campo fora do catálogo lança; título, miniatura e descrição do vídeo NÃO estão nele (D3)', () => {
    expect(() => assertField('video', 'tags')).not.toThrow()
    for (const f of ['title', 'thumb', 'desc', 'description', 'name']) expect(() => assertField('video', f)).toThrow(/fora do catálogo/)
    expect(() => assertField('canal', 'tags')).toThrow(/fora do catálogo/)
  })
})
describe('JSON canônico e hash', () => {
  it('a ordem das chaves não muda o texto nem o hash (item 3); a ordem de uma lista muda', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, 2], c: null } })).toBe('{"a":{"c":null,"d":[1,2]},"b":1}')
    expect(fieldHash({ b: 1, a: 2 })).toBe(fieldHash({ a: 2, b: 1 }))
    expect(fieldHash(['a', 'b'])).not.toBe(fieldHash(['b', 'a']))
  })
  it('fieldHash tem 16 caracteres e é o começo do sha256 do texto canônico', () => {
    expect(fieldHash('sumiu')).toBe(sha256Hex('"sumiu"').slice(0, 16))
    expect(fieldHash(null)).toHaveLength(16)
  })
})
describe('rawOf', () => {
  const item = { kind: 'youtube#video', etag: 'e1', id: 'vid', snippet: { title: 'T', tags: ['a'] }, statistics: { viewCount: '5' }, liveStreamingDetails: { actualStartTime: '2026-01-01T00:00:00Z', concurrentViewers: '10' } }
  it('tira statistics, etag e concurrentViewers; o resto fica como veio', () => {
    expect(rawOf(item).raw).toEqual({ kind: 'youtube#video', id: 'vid', snippet: { title: 'T', tags: ['a'] }, liveStreamingDetails: { actualStartTime: '2026-01-01T00:00:00Z' } })
  })
  it('item 4: mudar só statistics, etag ou concurrentViewers não muda o hash; mudar uma tag muda', () => {
    const same = { ...item, etag: 'e2', statistics: { viewCount: '999' }, liveStreamingDetails: { ...item.liveStreamingDetails, concurrentViewers: '77' } }
    expect(rawOf(same).sha).toBe(rawOf(item).sha)
    expect(rawOf({ ...item, snippet: { title: 'T', tags: ['b'] } }).sha).not.toBe(rawOf(item).sha)
  })
  it('item 3: a ordem das chaves trocada não muda o hash', () => {
    expect(rawOf({ snippet: { tags: ['a'], title: 'T' }, id: 'vid', kind: 'youtube#video' }).sha).toBe(rawOf({ kind: 'youtube#video', id: 'vid', snippet: { title: 'T', tags: ['a'] } }).sha)
  })
  it('bytes é o tamanho do texto canônico, e o teto é 100 kB', () => {
    expect(rawOf({ id: 'é' }).bytes).toBe(Buffer.byteLength('{"id":"é"}'))
    expect(RAW_MAX_BYTES).toBe(100_000)
  })
  it('o que não é objeto vira objeto vazio (nunca lança)', () => {
    expect(rawOf(null).raw).toEqual({})
    expect(rawOf('x').raw).toEqual({})
  })
})
describe('optCount', () => {
  it('ausente, vazio e lixo viram nulo; zero de verdade fica zero', () => {
    expect([optCount(undefined), optCount(null), optCount(''), optCount('abc'), optCount('0'), optCount('12')]).toEqual([null, null, null, null, 0, 12])
  })
})
```

- [ ] **Step 2: rodar e ver falhar.**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/competitor-capture.test.ts 2>&1 | tail -8`
Expected: FAIL, "Failed to resolve import".

- [ ] **Step 3: implementar.** `apps/web/src/lib/youtube/observatorio/field-catalog.ts`:

```ts
// Observatório A5 (E1): o catálogo FECHADO dos campos com histórico em competitor_field_versions.
// Campo fora daqui não é gravado (assertField lança). Título, miniatura e descrição do vídeo não entram: continuam em
// competitor_video_versions, para a conta "Trocas" das telas e competitor_changes não mudarem (spec A5, princípio D3).
export const VIDEO_FIELDS = ['tags', 'category_id', 'duration_seconds', 'default_language', 'default_audio_language', 'live_broadcast_content', 'comments_disabled', 'likes_hidden', 'availability'] as const
export const CHANNEL_FIELDS = ['name', 'custom_url', 'description', 'country', 'avatar_url', 'subscribers_hidden', 'availability'] as const
export type VideoField = (typeof VIDEO_FIELDS)[number]
export type ChannelField = (typeof CHANNEL_FIELDS)[number]
export type FieldScope = 'video' | 'canal'
/** 'gap' = a janela da mudança é um buraco de coleta; 'first' = primeira leitura do campo (não é mudança). */
export type FieldPrecision = '6h' | '1d' | '7d' | 'gap' | 'first'
export type Availability = 'no_ar' | 'sumiu'

export function assertField(scope: FieldScope, field: string): void {
  const list: readonly string[] = scope === 'video' ? VIDEO_FIELDS : CHANNEL_FIELDS
  if (!list.includes(field)) throw new Error('campo fora do catálogo do Observatório (' + scope + '): ' + field)
}
```

`apps/web/src/lib/youtube/competitor-capture.ts` (primeira parte; as Tarefas 3 e 4 acrescentam no mesmo arquivo):

```ts
// Observatório A5 (E1): o que se guarda de cada resposta do YouTube além das contagens.
// Puro até a seção "gravação": nada aqui lê relógio nem rede.
import crypto from 'crypto'

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json }
type Obj = Record<string, unknown>
export const obj = (x: unknown): Obj | undefined => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Obj) : undefined)
export const str = (x: unknown): string | null => (typeof x === 'string' && x !== '' ? x : null)

/** A counter the API may omit (hidden likes/subscribers): null when absent or not numeric, never 0. */
export function optCount(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = parseInt(String(v), 10)
  return Number.isFinite(n) ? n : null
}

/** JSON com as chaves em ordem alfabética em todos os níveis; a ordem das listas é a que veio (reordenar tags É mudança). */
export function canonicalJson(v: Json): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']'
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(v[k] as Json)).join(',') + '}'
}
export const sha256Hex = (s: string): string => crypto.createHash('sha256').update(s).digest('hex')
/** O hash de um valor de campo: 16 caracteres, como hashValue de competitor-versions.ts. */
export const fieldHash = (v: Json): string => sha256Hex(canonicalJson(v)).slice(0, 16)

/** Acima disto a resposta de um item não é guardada (e a execução acusa): a maior descrição real tem 5 kB. */
export const RAW_MAX_BYTES = 100_000
export interface RawCapture { sha: string; raw: Json; bytes: number }
/** A resposta como veio, sem o que muda a cada leitura: statistics, etag e concurrentViewers. */
export function rawOf(item: unknown): RawCapture {
  const src = obj(item) ?? {}
  const out: Obj = {}
  for (const k of Object.keys(src)) {
    if (k === 'statistics' || k === 'etag') continue
    if (k === 'liveStreamingDetails') {
      const live = { ...(obj(src[k]) ?? {}) }
      delete live.concurrentViewers
      out[k] = live
      continue
    }
    out[k] = src[k]
  }
  const text = canonicalJson(out as Json)
  return { sha: sha256Hex(text), raw: JSON.parse(text) as Json, bytes: Buffer.byteLength(text) }
}
```

- [ ] **Step 4: rodar e ver passar.**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/competitor-capture.test.ts 2>&1 | tail -8 && npm run typecheck 2>&1 | tail -3`
Expected: PASS; typecheck sem erro.

- [ ] **Step 5: commit.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/observatorio/field-catalog.ts apps/web/src/lib/youtube/competitor-capture.ts apps/web/test/youtube/competitor-capture.test.ts && git commit -m "feat: catálogo de campos, JSON canônico e raw da coleta de concorrentes (A5 E1)" -- apps/web/src/lib/youtube/observatorio/field-catalog.ts apps/web/src/lib/youtube/competitor-capture.ts apps/web/test/youtube/competitor-capture.test.ts
```

**Pronto quando:** os testes passam; `optCount` existe aqui (a Tarefa 6 tira a cópia de `competitor-sync.ts` e reexporta).

### Task 3: o que se extrai de uma resposta (vídeo e canal)

**Files:**
- Modify: `apps/web/src/lib/youtube/competitor-capture.ts` (acrescentar)
- Test: `apps/web/test/youtube/competitor-capture.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `obj`, `str`, `optCount`, `type Json` (Tarefa 2).
- Produces:

```ts
export interface ObservedField { field: string; value: Json }
/** As colunas de competitor_videos que TODA leitura do vídeo grava. Sem last_seen_at: ele é carimbado depois da captura. */
export interface VideoRowPatch {
  last_checked_at: string
  miss_streak: 0; miss_first_at: null; missing_since: null
  removal_decision: null; removal_decided_at: null; removal_decided_by: null
  was_live: boolean; live_scheduled_start_at: string | null; live_actual_start_at: string | null; live_actual_end_at: string | null
  default_language?: string | null; default_audio_language?: string | null; live_broadcast_content?: string | null
  view_count?: number | null; like_count?: number | null; comment_count?: number | null
  views_hidden?: boolean; likes_hidden?: boolean; comments_disabled?: boolean
}
export interface VideoObserved { fields: ObservedField[]; patch: VideoRowPatch; hasViews: boolean; partsMissing: string[] }
export function videoObservedOf(item: unknown, nowIso: string, durationOf: (iso: string | undefined) => number | null): VideoObserved
export interface ChannelRowPatch {
  custom_url: string | null; description: string | null; published_at: string | null; country: string | null; subscribers_hidden: boolean
  miss_streak: 0; miss_first_at: null; missing_since: null; removal_decision: null; removal_decided_at: null; removal_decided_by: null
}
export function channelObservedOf(item: unknown): { fields: ObservedField[]; patch: ChannelRowPatch }
```

- [ ] **Step 1: testes que falham** (acrescentar ao arquivo de teste; importe `videoObservedOf`, `channelObservedOf` e, de `@/lib/youtube/competitor-sync`, `parseIsoDuration`):

```ts
describe('videoObservedOf', () => {
  const NOW = '2026-06-10T15:00:00.000Z'
  const full = { id: 'vid', snippet: { title: 'T', tags: ['b', 'a'], categoryId: '19', defaultLanguage: 'pt-BR', defaultAudioLanguage: 'pt', liveBroadcastContent: 'none' }, statistics: { viewCount: '10', likeCount: '2', commentCount: '0' }, contentDetails: { duration: 'PT1M30S' } }
  const valueOf = (o: ReturnType<typeof videoObservedOf>, f: string) => o.fields.find(x => x.field === f)?.value
  it('resposta completa: os 9 campos do catálogo, nenhum fora dele, tags na ordem da API', () => {
    const o = videoObservedOf(full, NOW, parseIsoDuration)
    expect(o.fields.map(f => f.field).sort()).toEqual([...VIDEO_FIELDS].sort())
    expect(valueOf(o, 'tags')).toEqual(['b', 'a'])
    expect(valueOf(o, 'duration_seconds')).toBe(90)
    expect(valueOf(o, 'availability')).toBe('no_ar')
    expect(o.partsMissing).toEqual([])
    expect(o.hasViews).toBe(true)
  })
  it('item 6: sem commentCount → comment_count nulo e comments_disabled true; zero de verdade continua zero', () => {
    const o = videoObservedOf({ ...full, statistics: { viewCount: '10', likeCount: '2' } }, NOW, parseIsoDuration)
    expect(o.patch).toMatchObject({ comment_count: null, comments_disabled: true, like_count: 2, likes_hidden: false, view_count: 10, views_hidden: false })
    expect(videoObservedOf(full, NOW, parseIsoDuration).patch).toMatchObject({ comment_count: 0, comments_disabled: false })
  })
  it('item 225: sem viewCount → view_count nulo, views_hidden true, hasViews false', () => {
    const o = videoObservedOf({ ...full, statistics: { likeCount: '2' } }, NOW, parseIsoDuration)
    expect(o.patch).toMatchObject({ view_count: null, views_hidden: true })
    expect(o.hasViews).toBe(false)
  })
  it('item 8: com liveStreamingDetails → was_live true e os horários; sem → was_live false (não nulo)', () => {
    const live = videoObservedOf({ ...full, liveStreamingDetails: { scheduledStartTime: '2026-06-01T10:00:00Z', actualStartTime: '2026-06-01T10:01:00Z', actualEndTime: '2026-06-01T11:00:00Z', concurrentViewers: '9' } }, NOW, parseIsoDuration)
    expect(live.patch).toMatchObject({ was_live: true, live_scheduled_start_at: '2026-06-01T10:00:00Z', live_actual_start_at: '2026-06-01T10:01:00Z', live_actual_end_at: '2026-06-01T11:00:00Z' })
    expect(videoObservedOf(full, NOW, parseIsoDuration).patch).toMatchObject({ was_live: false, live_scheduled_start_at: null, live_actual_start_at: null, live_actual_end_at: null })
  })
  it('vídeo sem tags: o valor é nulo (a API não devolveu), nunca lista vazia inventada', () => {
    const { tags: _t, ...sn } = full.snippet
    expect(valueOf(videoObservedOf({ ...full, snippet: sn }, NOW, parseIsoDuration), 'tags')).toBeNull()
  })
  it('Review Focus 1: parte inteira ausente não vira "mudou para nulo": os campos dela não saem, e partsMissing diz qual', () => {
    const noSnippet = videoObservedOf({ id: 'vid', statistics: full.statistics, contentDetails: full.contentDetails }, NOW, parseIsoDuration)
    expect(noSnippet.partsMissing).toEqual(['snippet'])
    expect(noSnippet.fields.map(f => f.field).sort()).toEqual(['availability', 'comments_disabled', 'duration_seconds', 'likes_hidden'])
    expect('default_language' in noSnippet.patch).toBe(false)
    const noStats = videoObservedOf({ id: 'vid', snippet: full.snippet, contentDetails: full.contentDetails }, NOW, parseIsoDuration)
    expect(noStats.partsMissing).toEqual(['statistics'])
    expect('view_count' in noStats.patch).toBe(false)   // a contagem gravada não é tocada
    expect('views_hidden' in noStats.patch).toBe(false)
    expect(noStats.hasViews).toBe(false)
    expect(videoObservedOf({ id: 'vid', snippet: full.snippet, statistics: full.statistics }, NOW, parseIsoDuration).partsMissing).toEqual(['contentDetails'])
  })
  it('toda leitura zera a sequência de faltas e limpa a decisão "manter" (o vídeo veio)', () => {
    expect(videoObservedOf(full, NOW, parseIsoDuration).patch).toMatchObject({ last_checked_at: NOW, miss_streak: 0, miss_first_at: null, missing_since: null, removal_decision: null, removal_decided_at: null, removal_decided_by: null })
    expect('last_seen_at' in videoObservedOf(full, NOW, parseIsoDuration).patch).toBe(false)
  })
})
describe('channelObservedOf', () => {
  const item = { id: 'UC', snippet: { title: 'Canal', customUrl: '@canal', description: 'd', publishedAt: '2015-01-01T00:00:00Z', country: 'BR', thumbnails: { default: { url: 'https://yt3/x' } } }, statistics: { subscriberCount: '10', hiddenSubscriberCount: false } }
  it('os 7 campos do catálogo e as colunas do canal', () => {
    const o = channelObservedOf(item)
    expect(o.fields.map(f => f.field).sort()).toEqual([...CHANNEL_FIELDS].sort())
    expect(o.patch).toMatchObject({ custom_url: '@canal', description: 'd', published_at: '2015-01-01T00:00:00Z', country: 'BR', subscribers_hidden: false, miss_streak: 0, missing_since: null })
  })
  it('inscritos ocultos: hiddenSubscriberCount true OU contagem ausente', () => {
    expect(channelObservedOf({ ...item, statistics: { hiddenSubscriberCount: true, subscriberCount: '0' } }).patch.subscribers_hidden).toBe(true)
    expect(channelObservedOf({ ...item, statistics: {} }).patch.subscribers_hidden).toBe(true)
  })
  it('país e handle ausentes ficam nulos', () => {
    const o = channelObservedOf({ id: 'UC', snippet: { title: 'Canal' }, statistics: { subscriberCount: '1' } })
    expect(o.patch).toMatchObject({ custom_url: null, country: null, published_at: null })
  })
})
```

- [ ] **Step 2:** `npx vitest run test/youtube/competitor-capture.test.ts 2>&1 | tail -8` → FAIL ("videoObservedOf is not a function" ou erro de importação).

- [ ] **Step 3: implementar** (acrescentar a `competitor-capture.ts`, depois de `rawOf`; as interfaces são as do bloco "Produces" acima, copiadas inteiras):

```ts
export function videoObservedOf(item: unknown, nowIso: string, durationOf: (iso: string | undefined) => number | null): VideoObserved {
  const it = obj(item) ?? {}
  const sn = obj(it.snippet), st = obj(it.statistics), cd = obj(it.contentDetails), live = obj(it.liveStreamingDetails)
  const partsMissing = [...(sn ? [] : ['snippet']), ...(st ? [] : ['statistics']), ...(cd ? [] : ['contentDetails'])]
  const fields: ObservedField[] = [{ field: 'availability', value: 'no_ar' }]
  const patch: VideoRowPatch = {
    last_checked_at: nowIso, miss_streak: 0, miss_first_at: null, missing_since: null,
    removal_decision: null, removal_decided_at: null, removal_decided_by: null,
    // liveStreamingDetails só vem para ao vivo e estreia: ausente = não foi nenhum dos dois (a parte é sempre pedida)
    was_live: live !== undefined,
    live_scheduled_start_at: str(live?.scheduledStartTime), live_actual_start_at: str(live?.actualStartTime), live_actual_end_at: str(live?.actualEndTime),
  }
  if (sn) {
    const tags: Json = Array.isArray(sn.tags) ? sn.tags.filter((t): t is string => typeof t === 'string') : null
    const lang = str(sn.defaultLanguage), audio = str(sn.defaultAudioLanguage), lbc = str(sn.liveBroadcastContent)
    fields.push({ field: 'tags', value: tags }, { field: 'category_id', value: str(sn.categoryId) }, { field: 'default_language', value: lang },
      { field: 'default_audio_language', value: audio }, { field: 'live_broadcast_content', value: lbc })
    patch.default_language = lang; patch.default_audio_language = audio; patch.live_broadcast_content = lbc
  }
  if (cd) fields.push({ field: 'duration_seconds', value: durationOf(typeof cd.duration === 'string' ? cd.duration : undefined) })
  let hasViews = false
  if (st) {
    const views = optCount(st.viewCount), likes = optCount(st.likeCount), comments = optCount(st.commentCount)
    hasViews = views !== null
    patch.view_count = views; patch.like_count = likes; patch.comment_count = comments
    patch.views_hidden = views === null; patch.likes_hidden = likes === null; patch.comments_disabled = comments === null
    fields.push({ field: 'comments_disabled', value: comments === null }, { field: 'likes_hidden', value: likes === null })
  }
  return { fields, patch, hasViews, partsMissing }
}

export function channelObservedOf(item: unknown): { fields: ObservedField[]; patch: ChannelRowPatch } {
  const it = obj(item) ?? {}, sn = obj(it.snippet) ?? {}, st = obj(it.statistics) ?? {}
  const avatar = str(obj(obj(sn.thumbnails)?.default)?.url)
  const description = typeof sn.description === 'string' ? sn.description : null
  const hidden = st.hiddenSubscriberCount === true || optCount(st.subscriberCount) === null
  const customUrl = str(sn.customUrl), country = str(sn.country)
  return {
    fields: [
      { field: 'name', value: str(sn.title) }, { field: 'custom_url', value: customUrl }, { field: 'description', value: description },
      { field: 'country', value: country }, { field: 'avatar_url', value: avatar }, { field: 'subscribers_hidden', value: hidden },
      { field: 'availability', value: 'no_ar' },
    ],
    patch: {
      custom_url: customUrl, description, published_at: str(sn.publishedAt), country, subscribers_hidden: hidden,
      miss_streak: 0, miss_first_at: null, missing_since: null, removal_decision: null, removal_decided_at: null, removal_decided_by: null,
    },
  }
}
```

- [ ] **Step 4:** `npx vitest run test/youtube/competitor-capture.test.ts 2>&1 | tail -8 && npm run typecheck 2>&1 | tail -3` → PASS, typecheck limpo. (O teste importa `parseIsoDuration` de `competitor-sync`, que já a exporta.)

- [ ] **Step 5: commit.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/competitor-capture.ts apps/web/test/youtube/competitor-capture.test.ts && git commit -m "feat: extração dos campos e sinalizadores de uma resposta do YouTube (A5 E1)" -- apps/web/src/lib/youtube/competitor-capture.ts apps/web/test/youtube/competitor-capture.test.ts
```

**Pronto quando:** os testes dos itens 6, 8 e 225 e o do Review Focus 1 passam.

### Task 4: o plano de versões e a gravação

**Files:**
- Modify: `apps/web/src/lib/youtube/competitor-capture.ts` (acrescentar)
- Test: `apps/web/test/youtube/competitor-capture.test.ts` (acrescentar)

**Interfaces:**
- Consumes: Tarefas 2 e 3; `spDateOf` de `@/lib/youtube/observatorio/time`; `assertField`, `FieldPrecision`, `FieldScope` do catálogo.
- Produces:

```ts
export interface CaptureItem {
  /** uuid de competitor_videos; null = o canal. */
  videoId: string | null
  fields: ObservedField[]
  raw: RawCapture | null
  /** Última leitura boa ANTES desta (competitor_videos.last_seen_at ou competitor_channels.last_seen_at, lido antes de regravar). */
  prevSeenAt: string | null
  /** series_tier_since quando o vídeo está em faixa semanal; null nos outros casos (inclusive canal). */
  weeklySince: string | null
  /** Só para "sumiu": o instante da 1ª leitura sem o vídeo. Ausente = nowIso. */
  firstSeenAt?: string
}
export interface StoredField { id: number; video_id: string | null; field: string; value_hash: string }
export interface StoredRaw { id: number; video_id: string | null; raw_sha256: string }
export interface PlanClose { id: number; last_seen_at: string | null }
export interface FieldOpen { video_id: string | null; field: string; value: Json; value_hash: string; first_seen_at: string; window_start: string | null; precision: FieldPrecision }
export interface RawOpen { video_id: string | null; raw_sha256: string; first_seen_at: string; raw: Json }
export function precisionOf(windowStart: string | null, firstSeen: string, weeklySince: string | null): FieldPrecision
export function planFields(scope: FieldScope, current: readonly StoredField[], items: readonly CaptureItem[], nowIso: string): { close: PlanClose[]; open: FieldOpen[] }
export function planRaw(current: readonly StoredRaw[], items: readonly CaptureItem[], nowIso: string): { close: PlanClose[]; open: RawOpen[]; tooBig: number }
export interface CaptureStats { fieldsOpened: number; fieldsClosed: number; rawOpened: number; rawClosed: number; rawTooBig: number }
export const CAPTURE_CHUNK = 50
/** Lê o estado gravado, monta o plano e grava. Quando nada mudou: duas leituras, ZERO gravações. Lança em qualquer erro do banco. */
export async function captureItems(sb: SupabaseClient, p: { siteId: string; channelId: string; scope: FieldScope; items: readonly CaptureItem[]; nowIso: string }): Promise<CaptureStats>
export interface MissedRow { id: string; miss_streak: number; miss_first_at: string | null; missing_since: string | null; last_seen_at: string | null }
/** Soma uma falta a cada vídeo e, para os que já têm missing_since, garante a versão availability = 'sumiu'. */
export async function markMissing(sb: SupabaseClient, p: { siteId: string; channelId: string; videoIds: readonly string[]; nowIso: string; weeklySinceOf: (id: string) => string | null }): Promise<{ missed: number; newlyMissing: number }>
export async function markChannelMissing(sb: SupabaseClient, p: { siteId: string; channelId: string; nowIso: string }): Promise<{ missingSince: string | null }>
```

- [ ] **Step 1: testes que falham** (acrescentar; estenda a importação de `@/lib/youtube/competitor-capture` com `precisionOf, planFields, planRaw, captureItems, markMissing, type Json, type CaptureItem, type StoredField, type StoredRaw, type MissedRow`):

```ts
describe('precisionOf (4.1, v2.3)', () => {
  const t = (h: number) => new Date(Date.UTC(2026, 5, 10, 15) + h * 3_600_000).toISOString()
  it('sem janela é buraco; até 8 h é 6h; até 36 h é 1d', () => {
    expect(precisionOf(null, t(0), null)).toBe('gap')
    expect(precisionOf(t(-8), t(0), null)).toBe('6h')
    expect(precisionOf(t(-8.1), t(0), null)).toBe('1d')
    expect(precisionOf(t(-36), t(0), null)).toBe('1d')
  })
  it('até 8 dias só é 7d se o vídeo esteve em faixa semanal a janela inteira; senão é buraco', () => {
    expect(precisionOf(t(-7 * 24), t(0), '2026-06-01')).toBe('7d')
    expect(precisionOf(t(-7 * 24), t(0), '2026-06-05')).toBe('gap') // entrou na semanal DEPOIS do começo da janela
    expect(precisionOf(t(-3 * 24), t(0), null)).toBe('gap')         // vídeo diário com 3 dias sem leitura: buraco, não semana
    expect(precisionOf(t(-9 * 24), t(0), '2026-06-01')).toBe('gap')
  })
})
describe('planFields', () => {
  const NOW = '2026-06-10T15:00:00.000Z', PREV = '2026-06-10T09:00:00.000Z'
  const it1 = (fields: Array<{ field: string; value: Json }>, over: Partial<CaptureItem> = {}): CaptureItem => ({ videoId: 'v1', fields, raw: null, prevSeenAt: PREV, weeklySince: null, ...over })
  it('primeira leitura: abre "first" sem janela e não fecha nada', () => {
    expect(planFields('video', [], [it1([{ field: 'tags', value: ['a'] }], { prevSeenAt: null })], NOW)).toEqual({ close: [], open: [{ video_id: 'v1', field: 'tags', value: ['a'], value_hash: fieldHash(['a']), first_seen_at: NOW, window_start: null, precision: 'first' }] })
  })
  it('item 223: valor igual → plano vazio (zero escritas)', () => {
    expect(planFields('video', [{ id: 7, video_id: 'v1', field: 'tags', value_hash: fieldHash(['a']) }], [it1([{ field: 'tags', value: ['a'] }])], NOW)).toEqual({ close: [], open: [] })
  })
  it('item 4: valor diferente → fecha a corrente com a última leitura boa e abre a nova com a janela', () => {
    const p = planFields('video', [{ id: 7, video_id: 'v1', field: 'tags', value_hash: fieldHash(['a']) }], [it1([{ field: 'tags', value: ['b'] }])], NOW)
    expect(p.close).toEqual([{ id: 7, last_seen_at: PREV }])
    expect(p.open[0]).toMatchObject({ field: 'tags', window_start: PREV, precision: '6h', first_seen_at: NOW })
  })
  it('a mesma lista em outra ordem é mudança', () => {
    expect(planFields('video', [{ id: 7, video_id: 'v1', field: 'tags', value_hash: fieldHash(['a', 'b']) }], [it1([{ field: 'tags', value: ['b', 'a'] }])], NOW).open).toHaveLength(1)
  })
  it('campo fora do catálogo lança, e nada é planejado', () => {
    expect(() => planFields('video', [], [it1([{ field: 'title', value: 'x' }])], NOW)).toThrow(/fora do catálogo/)
  })
  it('campo do canal usa a chave de video_id nulo', () => {
    const p = planFields('canal', [{ id: 3, video_id: null, field: 'country', value_hash: fieldHash('BR') }], [it1([{ field: 'country', value: 'PT' }], { videoId: null })], NOW)
    expect(p.close).toEqual([{ id: 3, last_seen_at: PREV }])
  })
  it('"sumiu": a versão nova nasce no instante da 1ª falta, não agora', () => {
    const p = planFields('video', [{ id: 9, video_id: 'v1', field: 'availability', value_hash: fieldHash('no_ar') }], [it1([{ field: 'availability', value: 'sumiu' }], { firstSeenAt: '2026-06-10T03:00:00.000Z', prevSeenAt: '2026-06-09T21:00:00.000Z' })], NOW)
    expect(p.open[0]).toMatchObject({ first_seen_at: '2026-06-10T03:00:00.000Z', window_start: '2026-06-09T21:00:00.000Z', precision: '6h' })
  })
})
describe('planRaw', () => {
  const NOW = '2026-06-10T15:00:00.000Z'
  const item = (sha: string, bytes = 10): CaptureItem => ({ videoId: 'v1', fields: [], raw: { sha, raw: { id: sha }, bytes }, prevSeenAt: '2026-06-10T09:00:00.000Z', weeklySince: null })
  it('igual: nada; diferente: fecha e abre; primeira: abre', () => {
    expect(planRaw([{ id: 1, video_id: 'v1', raw_sha256: 'a' }], [item('a')], NOW)).toEqual({ close: [], open: [], tooBig: 0 })
    expect(planRaw([{ id: 1, video_id: 'v1', raw_sha256: 'a' }], [item('b')], NOW)).toEqual({ close: [{ id: 1, last_seen_at: '2026-06-10T09:00:00.000Z' }], open: [{ video_id: 'v1', raw_sha256: 'b', first_seen_at: NOW, raw: { id: 'b' } }], tooBig: 0 })
    expect(planRaw([], [item('a')], NOW).open).toHaveLength(1)
  })
  it('acima de 100 kB não é guardado e é contado (nunca em silêncio)', () => {
    expect(planRaw([], [item('a', RAW_MAX_BYTES + 1)], NOW)).toEqual({ close: [], open: [], tooBig: 1 })
  })
  it('item sem raw (só campos) é ignorado', () => {
    expect(planRaw([], [{ ...item('a'), raw: null }], NOW)).toEqual({ close: [], open: [], tooBig: 0 })
  })
})
```

E os testes da gravação, com um falso mínimo no próprio arquivo (não use `test/helpers/fake-supabase.ts`):

```ts
type DbCall = { kind: 'select' | 'rpc'; name: string; args?: unknown }
function captureDb(state: { fields?: StoredField[]; raws?: StoredRaw[]; fail?: string; missed?: MissedRow[]; long?: boolean }) {
  const calls: DbCall[] = []
  const from = (table: string) => {
    const chain: Record<string, unknown> = {}
    const result = () => {
      if (state.fail === table) return { data: null, error: { message: 'boom' } }
      const rows = table === 'competitor_field_versions' ? state.fields ?? [] : state.raws ?? []
      return { data: state.long ? Array.from({ length: 1000 }, () => rows[0] ?? { id: 1, video_id: 'v1', field: 'tags', value_hash: 'x' }) : rows, error: null }
    }
    for (const m of ['select', 'eq', 'in', 'is']) chain[m] = () => chain
    chain.then = (ok: (v: unknown) => unknown) => { calls.push({ kind: 'select', name: table }); return Promise.resolve(result()).then(ok) }
    return chain
  }
  const rpc = (name: string, args: unknown) => {
    calls.push({ kind: 'rpc', name, args })
    if (state.fail === name) return Promise.resolve({ data: null, error: { message: 'boom' } })
    if (name === 'competitor_mark_missing') return Promise.resolve({ data: state.missed ?? [], error: null })
    return Promise.resolve({ data: { closed: 0, opened: 0 }, error: null })
  }
  return { sb: { from, rpc } as never, calls }
}
describe('captureItems', () => {
  const NOW = '2026-06-10T15:00:00.000Z'
  const base = { siteId: 's', channelId: 'c', scope: 'video' as const, nowIso: NOW }
  const item: CaptureItem = { videoId: 'v1', fields: [{ field: 'tags', value: ['a'] }], raw: { sha: 'r1', raw: { id: 'x' }, bytes: 10 }, prevSeenAt: null, weeklySince: null }
  it('item 223: nada mudou → duas leituras e ZERO gravações', async () => {
    const db = captureDb({ fields: [{ id: 1, video_id: 'v1', field: 'tags', value_hash: fieldHash(['a']) }], raws: [{ id: 2, video_id: 'v1', raw_sha256: 'r1' }] })
    expect(await captureItems(db.sb, { ...base, items: [item] })).toEqual({ fieldsOpened: 0, fieldsClosed: 0, rawOpened: 0, rawClosed: 0, rawTooBig: 0 })
    expect(db.calls.filter(c => c.kind === 'rpc')).toEqual([])
    expect(db.calls.filter(c => c.kind === 'select')).toHaveLength(2)
  })
  it('primeira leitura → uma gravação de campos e uma de raw, com o site e o canal', async () => {
    const db = captureDb({})
    const st = await captureItems(db.sb, { ...base, items: [item] })
    expect(st).toMatchObject({ fieldsOpened: 1, rawOpened: 1 })
    expect(db.calls.filter(c => c.kind === 'rpc').map(c => c.name)).toEqual(['apply_competitor_field_plan', 'apply_competitor_raw_plan'])
    expect(db.calls.find(c => c.name === 'apply_competitor_field_plan')!.args).toMatchObject({ p_site_id: 's', p_channel_id: 'c', p_close: [] })
  })
  it('lista vazia não lê nem grava', async () => {
    const db = captureDb({})
    await captureItems(db.sb, { ...base, items: [] })
    expect(db.calls).toEqual([])
  })
  it('mais de 50 itens numa chamada lança (quem chama divide)', async () => {
    await expect(captureItems(captureDb({}).sb, { ...base, items: Array.from({ length: 51 }, (_, i) => ({ ...item, videoId: 'v' + i })) })).rejects.toThrow(/50/)
  })
  it('erro de leitura lança com o nome da tabela; erro de gravação lança; nunca "sem mudança"', async () => {
    await expect(captureItems(captureDb({ fail: 'competitor_field_versions' }).sb, { ...base, items: [item] })).rejects.toThrow(/captura.*competitor_field_versions/)
    await expect(captureItems(captureDb({ fail: 'apply_competitor_raw_plan' }).sb, { ...base, items: [item] })).rejects.toThrow(/captura.*apply_competitor_raw_plan/)
  })
  it('leitura que bate no teto de 1.000 linhas lança (corte silencioso é proibido)', async () => {
    await expect(captureItems(captureDb({ long: true }).sb, { ...base, items: [item] })).rejects.toThrow(/1000/)
  })
  it('raw grande: vários lotes de gravação, cada um com no máximo 1 MB', async () => {
    const big = (i: number): CaptureItem => ({ ...item, videoId: 'v' + i, fields: [], raw: { sha: 'r' + i, raw: { id: 'x' }, bytes: 90_000 } })
    const db = captureDb({})
    await captureItems(db.sb, { ...base, items: Array.from({ length: 30 }, (_, i) => big(i)) })
    const sizes = db.calls.filter(c => c.name === 'apply_competitor_raw_plan').map(c => (c.args as { p_open: unknown[] }).p_open.length)
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(30)
    expect(Math.max(...sizes)).toBeLessThanOrEqual(11) // 11 × 90 kB = 990 kB
  })
})
describe('markMissing', () => {
  const NOW = '2026-06-10T15:00:00.000Z'
  it('uma falta só: soma e não abre versão', async () => {
    const db = captureDb({ missed: [{ id: 'v1', miss_streak: 1, miss_first_at: NOW, missing_since: null, last_seen_at: '2026-06-10T09:00:00.000Z' }] })
    expect(await markMissing(db.sb, { siteId: 's', channelId: 'c', videoIds: ['v1'], nowIso: NOW, weeklySinceOf: () => null })).toEqual({ missed: 1, newlyMissing: 0 })
    expect(db.calls.map(c => c.name)).toEqual(['competitor_mark_missing'])
  })
  it('segunda falta: abre availability = "sumiu" no instante da 1ª falta; a marca não apaga nada', async () => {
    const db = captureDb({ fields: [{ id: 5, video_id: 'v1', field: 'availability', value_hash: fieldHash('no_ar') }], missed: [{ id: 'v1', miss_streak: 2, miss_first_at: '2026-06-10T09:00:00.000Z', missing_since: '2026-06-10', last_seen_at: '2026-06-10T03:00:00.000Z' }] })
    expect(await markMissing(db.sb, { siteId: 's', channelId: 'c', videoIds: ['v1'], nowIso: NOW, weeklySinceOf: () => null })).toEqual({ missed: 1, newlyMissing: 1 })
    const plan = db.calls.find(c => c.name === 'apply_competitor_field_plan')!.args as { p_close: unknown[]; p_open: Array<Record<string, unknown>> }
    expect(plan.p_close).toEqual([{ id: 5, last_seen_at: '2026-06-10T03:00:00.000Z' }])
    expect(plan.p_open[0]).toMatchObject({ field: 'availability', value: 'sumiu', first_seen_at: '2026-06-10T09:00:00.000Z', window_start: '2026-06-10T03:00:00.000Z', precision: '6h' })
  })
  it('já ausente e já com a versão "sumiu": nada a gravar (conserto sozinho quando a versão faltou)', async () => {
    const db = captureDb({ fields: [{ id: 5, video_id: 'v1', field: 'availability', value_hash: fieldHash('sumiu') }], missed: [{ id: 'v1', miss_streak: 5, miss_first_at: '2026-06-09T09:00:00.000Z', missing_since: '2026-06-09', last_seen_at: null }] })
    expect(await markMissing(db.sb, { siteId: 's', channelId: 'c', videoIds: ['v1'], nowIso: NOW, weeklySinceOf: () => null })).toEqual({ missed: 1, newlyMissing: 0 })
    expect(db.calls.some(c => c.name === 'apply_competitor_field_plan')).toBe(false)
  })
  it('lista vazia não chama o banco; erro da função lança', async () => {
    const db = captureDb({})
    expect(await markMissing(db.sb, { siteId: 's', channelId: 'c', videoIds: [], nowIso: NOW, weeklySinceOf: () => null })).toEqual({ missed: 0, newlyMissing: 0 })
    expect(db.calls).toEqual([])
    await expect(markMissing(captureDb({ fail: 'competitor_mark_missing' }).sb, { siteId: 's', channelId: 'c', videoIds: ['v1'], nowIso: NOW, weeklySinceOf: () => null })).rejects.toThrow(/ausência/)
  })
})
```

- [ ] **Step 2:** rodar → FAIL (funções não existem).

- [ ] **Step 3: implementar** (acrescentar a `competitor-capture.ts`; no topo do arquivo acrescente `import type { SupabaseClient } from '@supabase/supabase-js'`, `import { spDateOf } from '@/lib/youtube/observatorio/time'` e `import { assertField, type FieldPrecision, type FieldScope } from '@/lib/youtube/observatorio/field-catalog'`):

```ts
const HOUR = 3_600_000
/** A precisão de uma mudança, pela distância entre a última leitura boa e a leitura que viu o valor novo (spec 4.1, v2.3). */
export function precisionOf(windowStart: string | null, firstSeen: string, weeklySince: string | null): FieldPrecision {
  if (!windowStart) return 'gap'
  const d = Date.parse(firstSeen) - Date.parse(windowStart)
  if (d <= 8 * HOUR) return '6h'
  if (d <= 36 * HOUR) return '1d'
  // semana só quando o vídeo esteve em faixa semanal a janela inteira; qualquer outra distância é coleta parada
  if (d <= 8 * 24 * HOUR && weeklySince != null && weeklySince <= spDateOf(Date.parse(windowStart))) return '7d'
  return 'gap'
}

const keyOf = (videoId: string | null, field: string) => (videoId ?? '') + '|' + field
export function planFields(scope: FieldScope, current: readonly StoredField[], items: readonly CaptureItem[], nowIso: string): { close: PlanClose[]; open: FieldOpen[] } {
  for (const it of items) for (const f of it.fields) assertField(scope, f.field) // antes de planejar qualquer coisa
  const cur = new Map(current.map(c => [keyOf(c.video_id, c.field), c]))
  const close: PlanClose[] = [], open: FieldOpen[] = []
  for (const it of items) {
    const first = it.firstSeenAt ?? nowIso
    for (const f of it.fields) {
      const hash = fieldHash(f.value), prev = cur.get(keyOf(it.videoId, f.field))
      if (prev && prev.value_hash === hash) continue // nada mudou: a versão corrente não é tocada (item 223)
      if (!prev) { open.push({ video_id: it.videoId, field: f.field, value: f.value, value_hash: hash, first_seen_at: first, window_start: null, precision: 'first' }); continue }
      close.push({ id: prev.id, last_seen_at: it.prevSeenAt })
      open.push({ video_id: it.videoId, field: f.field, value: f.value, value_hash: hash, first_seen_at: first, window_start: it.prevSeenAt, precision: precisionOf(it.prevSeenAt, first, it.weeklySince) })
    }
  }
  return { close, open }
}

export function planRaw(current: readonly StoredRaw[], items: readonly CaptureItem[], nowIso: string): { close: PlanClose[]; open: RawOpen[]; tooBig: number } {
  const cur = new Map(current.map(c => [c.video_id ?? '', c]))
  const close: PlanClose[] = [], open: RawOpen[] = []
  let tooBig = 0
  for (const it of items) {
    if (!it.raw) continue
    if (it.raw.bytes > RAW_MAX_BYTES) { tooBig++; continue }
    const prev = cur.get(it.videoId ?? '')
    if (prev && prev.raw_sha256 === it.raw.sha) continue
    if (prev) close.push({ id: prev.id, last_seen_at: it.prevSeenAt })
    open.push({ video_id: it.videoId, raw_sha256: it.raw.sha, first_seen_at: nowIso, raw: it.raw.raw })
  }
  return { close, open, tooBig }
}

/* ------------------------------------------------------------------ gravação */
export const CAPTURE_CHUNK = 50
/** PostgREST corta em 1.000 linhas sem avisar (supabase/config.toml, max_rows): chegar lá é erro, nunca "é só isso". */
const MAX_ROWS = 1000
/** Corpo máximo de uma gravação de raw. */
const RPC_MAX_BYTES = 1_000_000
const fail = (what: string, error: { message?: string } | null | undefined): void => {
  if (error) throw new Error('captura: ' + what + ': ' + (error.message ?? 'erro do banco'))
}

async function readCurrent<T>(sb: SupabaseClient, table: 'competitor_field_versions' | 'competitor_raw', cols: string, channelId: string, scope: FieldScope, ids: string[]): Promise<T[]> {
  const q = sb.from(table).select(cols).eq('competitor_channel_id', channelId).eq('is_current', true)
  const { data, error } = await (scope === 'canal' ? q.is('video_id', null) : q.in('video_id', ids))
  fail(table, error)
  const rows = (data ?? []) as unknown as T[]
  if (rows.length >= MAX_ROWS) throw new Error('captura: ' + table + ' devolveu ' + MAX_ROWS + ' linhas ou mais numa leitura (1000 é o teto do PostgREST): lote grande demais')
  return rows
}

export async function captureItems(sb: SupabaseClient, p: { siteId: string; channelId: string; scope: FieldScope; items: readonly CaptureItem[]; nowIso: string }): Promise<CaptureStats> {
  const stats: CaptureStats = { fieldsOpened: 0, fieldsClosed: 0, rawOpened: 0, rawClosed: 0, rawTooBig: 0 }
  if (!p.items.length) return stats
  if (p.items.length > CAPTURE_CHUNK) throw new Error('captura: no máximo ' + CAPTURE_CHUNK + ' itens por chamada (vieram ' + p.items.length + ')')
  const ids = p.items.map(i => i.videoId).filter((x): x is string => x != null)
  const curFields = await readCurrent<StoredField>(sb, 'competitor_field_versions', 'id, video_id, field, value_hash', p.channelId, p.scope, ids)
  const curRaw = await readCurrent<StoredRaw>(sb, 'competitor_raw', 'id, video_id, raw_sha256', p.channelId, p.scope, ids)
  const fp = planFields(p.scope, curFields, p.items, p.nowIso)
  if (fp.close.length || fp.open.length) {
    const { error } = await sb.rpc('apply_competitor_field_plan', { p_site_id: p.siteId, p_channel_id: p.channelId, p_close: fp.close, p_open: fp.open })
    fail('apply_competitor_field_plan', error)
    stats.fieldsOpened = fp.open.length; stats.fieldsClosed = fp.close.length
  }
  const rp = planRaw(curRaw, p.items, p.nowIso)
  stats.rawTooBig = rp.tooBig
  // lotes de até 1 MB: o fecho de um vídeo vai no mesmo lote da abertura dele (a função fecha antes de abrir)
  const prevId = new Map(curRaw.map(c => [c.video_id ?? '', c.id]))
  const bytesOf = new Map(p.items.filter(i => i.raw).map(i => [i.videoId ?? '', i.raw!.bytes]))
  let batch: RawOpen[] = [], size = 0
  const flush = async () => {
    if (!batch.length) return
    const closeIds = new Set(batch.map(o => prevId.get(o.video_id ?? '')).filter((x): x is number => x != null))
    const { error } = await sb.rpc('apply_competitor_raw_plan', { p_site_id: p.siteId, p_channel_id: p.channelId, p_close: rp.close.filter(c => closeIds.has(c.id)), p_open: batch })
    fail('apply_competitor_raw_plan', error)
    stats.rawOpened += batch.length; stats.rawClosed += closeIds.size
    batch = []; size = 0
  }
  for (const o of rp.open) {
    const b = bytesOf.get(o.video_id ?? '') ?? 0
    if (batch.length && size + b > RPC_MAX_BYTES) await flush()
    batch.push(o); size += b
  }
  await flush()
  return stats
}

export async function markMissing(sb: SupabaseClient, p: { siteId: string; channelId: string; videoIds: readonly string[]; nowIso: string; weeklySinceOf: (id: string) => string | null }): Promise<{ missed: number; newlyMissing: number }> {
  if (!p.videoIds.length) return { missed: 0, newlyMissing: 0 }
  const { data, error } = await sb.rpc('competitor_mark_missing', { p_channel_id: p.channelId, p_video_ids: [...p.videoIds], p_now: p.nowIso })
  if (error) throw new Error('ausência: ' + (error.message ?? 'erro do banco'))
  const rows = (Array.isArray(data) ? data : []) as MissedRow[]
  // estado desejado, não evento: todo vídeo com missing_since tem de ter a versão 'sumiu' (se a gravação falhou antes, conserta agora)
  const gone = rows.filter(r => r.missing_since != null)
  for (let i = 0; i < gone.length; i += CAPTURE_CHUNK) {
    await captureItems(sb, { siteId: p.siteId, channelId: p.channelId, scope: 'video', nowIso: p.nowIso, items: gone.slice(i, i + CAPTURE_CHUNK).map(r => ({
      videoId: r.id, fields: [{ field: 'availability', value: 'sumiu' }], raw: null, prevSeenAt: r.last_seen_at, weeklySince: p.weeklySinceOf(r.id), firstSeenAt: r.miss_first_at ?? p.nowIso,
    })) })
  }
  return { missed: rows.length, newlyMissing: rows.filter(r => r.miss_streak === 2).length }
}

export async function markChannelMissing(sb: SupabaseClient, p: { siteId: string; channelId: string; nowIso: string }): Promise<{ missingSince: string | null }> {
  const { data, error } = await sb.rpc('competitor_channel_mark_missing', { p_channel_id: p.channelId, p_now: p.nowIso })
  if (error) throw new Error('ausência do canal: ' + (error.message ?? 'erro do banco'))
  const r = (data ?? null) as MissedRow | null
  if (r?.missing_since) {
    await captureItems(sb, { siteId: p.siteId, channelId: p.channelId, scope: 'canal', nowIso: p.nowIso, items: [{
      videoId: null, fields: [{ field: 'availability', value: 'sumiu' }], raw: null, prevSeenAt: r.last_seen_at, weeklySince: null, firstSeenAt: r.miss_first_at ?? p.nowIso,
    }] })
  }
  return { missingSince: r?.missing_since ?? null }
}
```

Nota para o implementador: o falso do teste devolve as mesmas linhas para as duas tabelas conforme o nome; `captureItems` com escopo `'video'` e `ids` vazio (só acontece com escopo `'canal'`) nunca chama `.in('video_id', [])`.

- [ ] **Step 4:** `npx vitest run test/youtube/competitor-capture.test.ts 2>&1 | tail -8 && npm run typecheck 2>&1 | tail -3` → PASS.

- [ ] **Step 5: commit.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/competitor-capture.ts apps/web/test/youtube/competitor-capture.test.ts && git commit -m "feat: plano de versões de campo e de raw, com gravação atômica e sem regravar o que não mudou (A5 E1)" -- apps/web/src/lib/youtube/competitor-capture.ts apps/web/test/youtube/competitor-capture.test.ts
```

**Pronto quando:** os testes dos itens 3, 4, 223 passam; a gravação lança em todo erro e no teto de 1.000 linhas; nenhum caminho devolve "sem mudança" por falha de leitura.

### Task 5: as faixas da série (puro)

**Files:**
- Create: `apps/web/src/lib/youtube/competitor-tiers.ts`
- Modify: `apps/web/src/lib/youtube/observatorio/rules.ts` (duas chaves novas em `RULES`, depois de `medianMinN`)
- Test: `apps/web/test/youtube/competitor-tiers.test.ts`

**Interfaces:**
- Consumes: `RULES` (`videoLimitMax` já existe: 200).
- Produces:

```ts
export type Tier = 'diaria' | 'semanal'
export const dayNumber: (date: string) => number            // dias desde 1970 de uma data 'AAAA-MM-DD'
export const addDays: (date: string, n: number) => string
export const weekSlotOf: (ytId: string) => number           // 0 a 6, fixo por vídeo
export interface TierVideo { id: string; publishedAt: number | null; pinned: boolean; dailyUntil: string | null; tier: Tier | null }
export interface TierPlan { daily: string[]; weekly: string[]; changes: Array<{ video_id: string; tier: Tier }>; cut: number }
export function classifyTiers(videos: readonly TierVideo[], o: { videoLimit: number; nowMs: number; today: string }): TierPlan
export function weeklyDue(v: { ytId: string; lastPoint: string | null; tierSince: string | null }, today: string): boolean
export function shouldPromote(prev: { date: string; views: number } | null, cur: { views: number }, today: string): boolean
export function earlyEligible(v: { discoveredAt: string | null; publishedAt: string | null }, nowMs: number): boolean
```

`RULES` ganha: `series: { dailyAgeDays: 30, weeklyEveryDays: 7, weeklyMaxGapDays: 8, earlyHours: 72, earlyDiscoverHours: 24 }` e `promotion: { minViews: 1000, minShare: 0.05, days: 28 }`.

- [ ] **Step 1: teste que falha.** `apps/web/test/youtube/competitor-tiers.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { classifyTiers, weeklyDue, weekSlotOf, shouldPromote, earlyEligible, dayNumber, addDays, type TierVideo } from '@/lib/youtube/competitor-tiers'
import { RULES } from '@/lib/youtube/observatorio/rules'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 5, 10, 15) // 10/06/2026 12:00 de São Paulo
const TODAY = '2026-06-10'
const vid = (i: number, ageDays: number, over: Partial<TierVideo> = {}): TierVideo => ({ id: 'v' + String(i).padStart(4, '0'), publishedAt: NOW - ageDays * DAY, pinned: false, dailyUntil: null, tier: null, ...over })

describe('classifyTiers (4.3)', () => {
  it('os N mais recentes são diária (regra de hoje), o resto é semanal', () => {
    const p = classifyTiers([vid(1, 100), vid(2, 200), vid(3, 300)], { videoLimit: 2, nowMs: NOW, today: TODAY })
    expect(p.daily).toEqual(['v0001', 'v0002'])
    expect(p.weekly).toEqual(['v0003'])
    expect(p.cut).toBe(0)
  })
  it('item 14: canal com 80 vídeos em 30 dias e limite 50 → os 80 em diária', () => {
    const p = classifyTiers(Array.from({ length: 80 }, (_, i) => vid(i, i * 0.37)), { videoLimit: 50, nowMs: NOW, today: TODAY })
    expect(p.daily).toHaveLength(80)
    expect(p.weekly).toHaveLength(0)
  })
  it('fixado e promovido (daily_until >= hoje) são diária; promoção vencida ontem volta a semanal', () => {
    const p = classifyTiers([vid(1, 1), vid(2, 400, { pinned: true }), vid(3, 400, { dailyUntil: TODAY }), vid(4, 400, { dailyUntil: '2026-06-09' })], { videoLimit: 1, nowMs: NOW, today: TODAY })
    expect(p.daily.sort()).toEqual(['v0001', 'v0002', 'v0003'])
    expect(p.weekly).toEqual(['v0004'])
  })
  it('item 18: mais de 200 na regra diária → 200 em diária, os mais antigos da regra de idade para a semanal, e o corte é contado', () => {
    const p = classifyTiers(Array.from({ length: 260 }, (_, i) => vid(i, i * 0.1)), { videoLimit: 50, nowMs: NOW, today: TODAY })
    expect(p.daily).toHaveLength(RULES.videoLimitMax)
    expect(p.cut).toBe(60)
    expect(p.weekly).toHaveLength(60)
    expect(p.weekly).toContain('v0259')      // o mais antigo foi cortado
    expect(p.daily).toContain('v0000')       // os 50 mais recentes nunca são cortados
  })
  it('o teto não conta os fixados e nunca corta um dos N mais recentes', () => {
    const many = Array.from({ length: 205 }, (_, i) => vid(i, i * 0.1))
    const p = classifyTiers([...many, vid(900, 500, { pinned: true })], { videoLimit: 200, nowMs: NOW, today: TODAY })
    expect(p.daily).toHaveLength(201) // 200 + o fixado
    expect(p.cut).toBe(5)
  })
  it('só o que mudou vai para changes; sem faixa ainda (null) conta como mudança', () => {
    const p = classifyTiers([vid(1, 1, { tier: 'diaria' }), vid(2, 400, { tier: 'diaria' }), vid(3, 500, { tier: null }), vid(4, 600, { tier: 'semanal' })], { videoLimit: 1, nowMs: NOW, today: TODAY })
    expect(p.changes).toEqual([{ video_id: 'v0002', tier: 'semanal' }, { video_id: 'v0003', tier: 'semanal' }])
  })
  it('vídeo sem data de publicação: fica depois dos datados; entra nos N só se sobrar vaga', () => {
    expect(classifyTiers([vid(1, 1), vid(2, 2), { ...vid(3, 0), publishedAt: null }], { videoLimit: 2, nowMs: NOW, today: TODAY }).weekly).toEqual(['v0003'])
    expect(classifyTiers([vid(1, 400), { ...vid(3, 0), publishedAt: null }], { videoLimit: 2, nowMs: NOW, today: TODAY }).daily).toEqual(['v0001', 'v0003'])
  })
  it('lista vazia: nada', () => {
    expect(classifyTiers([], { videoLimit: 50, nowMs: NOW, today: TODAY })).toEqual({ daily: [], weekly: [], changes: [], cut: 0 })
  })
})
describe('dia fixo e devido (OP-15)', () => {
  it('o dia fixo é estável e espalha: 700 ids caem nos 7 dias, nenhum dia com menos de 60', () => {
    const count = [0, 0, 0, 0, 0, 0, 0]
    for (let i = 0; i < 700; i++) count[weekSlotOf('video' + i)]!++
    expect(weekSlotOf('abc')).toBe(weekSlotOf('abc'))
    expect(Math.min(...count)).toBeGreaterThan(60)
  })
  const slotDay = (ytId: string) => { let d = TODAY; while (dayNumber(d) % 7 !== weekSlotOf(ytId)) d = addDays(d, 1); return d }
  it('devido no dia fixo; com ponto hoje nunca é devido', () => {
    const d = slotDay('vidA')
    expect(weeklyDue({ ytId: 'vidA', lastPoint: null, tierSince: d }, d)).toBe(true)
    expect(weeklyDue({ ytId: 'vidA', lastPoint: d, tierSince: addDays(d, -30) }, d)).toBe(false)
  })
  it('D0: fora do dia fixo, recém-classificado e sem ponto, NÃO é devido (a carga se espalha por 7 dias)', () => {
    const d = addDays(slotDay('vidA'), 1)
    expect(weeklyDue({ ytId: 'vidA', lastPoint: null, tierSince: d }, d)).toBe(false)
  })
  it('lido ontem: não é devido hoje (fora do dia fixo)', () => {
    const d = addDays(slotDay('vidA'), 2)
    expect(weeklyDue({ ytId: 'vidA', lastPoint: addDays(d, -1), tierSince: addDays(d, -30) }, d)).toBe(false)
  })
  it('perdeu o dia fixo: é devido de novo quando o último ponto faz 7 dias, mesmo fora do dia fixo', () => {
    const d = addDays(slotDay('vidA'), 1)
    expect(weeklyDue({ ytId: 'vidA', lastPoint: addDays(d, -6), tierSince: addDays(d, -30) }, d)).toBe(false)
    expect(weeklyDue({ ytId: 'vidA', lastPoint: addDays(d, -7), tierSince: addDays(d, -30) }, d)).toBe(true)
  })
  it('nunca teve ponto e está na faixa há 7 dias ou mais: devido', () => {
    const d = addDays(slotDay('vidA'), 3)
    expect(weeklyDue({ ytId: 'vidA', lastPoint: null, tierSince: addDays(d, -7) }, d)).toBe(true)
    expect(weeklyDue({ ytId: 'vidA', lastPoint: null, tierSince: null }, d)).toBe(false)
  })
})
describe('promoção por ganho (item 17) e primeiras horas (item 16)', () => {
  it('1.000 views E 5% do total numa semana promove; faltando um dos dois, não', () => {
    expect(shouldPromote({ date: '2026-06-03', views: 9000 }, { views: 10_000 }, TODAY)).toBe(true)   // +1.000 e 10%
    expect(shouldPromote({ date: '2026-06-03', views: 99_000 }, { views: 100_000 }, TODAY)).toBe(false) // +1.000 mas 1%
    expect(shouldPromote({ date: '2026-06-03', views: 100 }, { views: 600 }, TODAY)).toBe(false)        // 83% mas +500
  })
  it('sem ponto anterior, ou com o anterior a mais de 8 dias (buraco), não promove', () => {
    expect(shouldPromote(null, { views: 10_000 }, TODAY)).toBe(false)
    expect(shouldPromote({ date: '2026-06-01', views: 1 }, { views: 10_000 }, TODAY)).toBe(false)
  })
  it('primeiras horas: descoberto até 24 h depois de publicado, enquanto a idade for menor que 72 h', () => {
    const iso = (ms: number) => new Date(ms).toISOString(), H = 3_600_000
    expect(earlyEligible({ discoveredAt: iso(NOW - 10 * H), publishedAt: iso(NOW - 20 * H) }, NOW)).toBe(true)
    expect(earlyEligible({ discoveredAt: iso(NOW - 10 * H), publishedAt: iso(NOW - 72 * H) }, NOW)).toBe(false) // 72 h completas
    expect(earlyEligible({ discoveredAt: iso(NOW - 10 * H), publishedAt: iso(NOW - 40 * H) }, NOW)).toBe(false) // descoberto 30 h depois
    expect(earlyEligible({ discoveredAt: null, publishedAt: iso(NOW - 2 * H) }, NOW)).toBe(false)               // linha anterior à MG1: nunca por palpite
    expect(earlyEligible({ discoveredAt: iso(NOW), publishedAt: null }, NOW)).toBe(false)
    expect(earlyEligible({ discoveredAt: iso(NOW), publishedAt: iso(NOW + H) }, NOW)).toBe(false)               // estreia agendada
  })
})
```

- [ ] **Step 2:** rodar → FAIL (importação).

- [ ] **Step 3: implementar.** Em `rules.ts`, dentro de `RULES`, depois da linha de `medianMinN: 5,`:

```ts
  // New (A5, E2; spec 4.3). Faixas da série dos concorrentes: diária até `dailyAgeDays` de idade (além dos N mais
  // recentes, dos fixados e dos promovidos); o resto é lido a cada `weeklyEveryDays` e nunca fica mais de
  // `weeklyMaxGapDays` sem ponto; as primeiras `earlyHours` de um vídeo descoberto até `earlyDiscoverHours` depois de publicado.
  series: { dailyAgeDays: 30, weeklyEveryDays: 7, weeklyMaxGapDays: 8, earlyHours: 72, earlyDiscoverHours: 24 },
  // New (A5, E2; pergunta 6 ao dono, padrão do spec). Um vídeo semanal que ganha `minViews` E `minShare` do total numa semana,
  // ou que troca de título ou descrição, vai para a diária por `days` dias.
  promotion: { minViews: 1000, minShare: 0.05, days: 28 },
```

`apps/web/src/lib/youtube/competitor-tiers.ts`:

```ts
// Observatório A5 (E2): em que faixa de série cada vídeo de um canal está, e o que é devido hoje. Puro.
import crypto from 'crypto'
import { RULES } from '@/lib/youtube/observatorio/rules'

export type Tier = 'diaria' | 'semanal'
const DAY = 86_400_000, HOUR = 3_600_000

/** Dias desde 1970 de uma data 'AAAA-MM-DD' (uma data de São Paulo já pronta: sem fuso aqui). */
export const dayNumber = (date: string): number => Math.floor(Date.parse(date.slice(0, 10) + 'T00:00:00Z') / DAY)
export const addDays = (date: string, n: number): string => new Date(Date.parse(date.slice(0, 10) + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10)
/** O dia fixo de cada vídeo no ciclo de 7 (pelo id do YouTube, que não muda): espalha a passada semanal pelos 7 dias. */
export const weekSlotOf = (ytId: string): number => crypto.createHash('sha256').update(ytId).digest().readUInt32BE(0) % 7

export interface TierVideo { id: string; publishedAt: number | null; pinned: boolean; dailyUntil: string | null; tier: Tier | null }
export interface TierPlan { daily: string[]; weekly: string[]; changes: Array<{ video_id: string; tier: Tier }>; cut: number }

type Why = 'fixado' | 'top' | 'promovido' | 'idade' | null
/** Mais recente primeiro; sem data por último; empate pelo id (a ordem é sempre a mesma). */
const byRecency = (a: TierVideo, b: TierVideo): number => {
  if (a.publishedAt == null || b.publishedAt == null) return a.publishedAt == null && b.publishedAt == null ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.publishedAt == null ? 1 : -1
  return b.publishedAt - a.publishedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

export function classifyTiers(videos: readonly TierVideo[], o: { videoLimit: number; nowMs: number; today: string }): TierPlan {
  const ordered = [...videos].sort(byRecency)
  const top = new Set(ordered.slice(0, o.videoLimit).map(v => v.id))
  const why = new Map<string, Why>(ordered.map(v => [v.id,
    v.pinned ? 'fixado'
      : top.has(v.id) ? 'top'
        : v.dailyUntil != null && v.dailyUntil >= o.today ? 'promovido'
          : v.publishedAt != null && o.nowMs - v.publishedAt <= RULES.series.dailyAgeDays * DAY ? 'idade' : null]))
  // Teto de segurança: os fixados não contam; saem primeiro os de "idade" mais antigos, depois os "promovidos" que
  // vencem antes; os N mais recentes nunca saem. Quem sai vai para a semanal, e o número é devolvido (nunca em silêncio).
  const counted = ordered.filter(v => { const w = why.get(v.id); return w != null && w !== 'fixado' })
  let over = counted.length - RULES.videoLimitMax, cut = 0
  if (over > 0) {
    const victims = [
      ...counted.filter(v => why.get(v.id) === 'idade').sort((a, b) => (a.publishedAt ?? 0) - (b.publishedAt ?? 0)),
      ...counted.filter(v => why.get(v.id) === 'promovido').sort((a, b) => (a.dailyUntil ?? '').localeCompare(b.dailyUntil ?? '')),
    ]
    for (const v of victims) { if (over <= 0) break; why.set(v.id, null); over--; cut++ }
  }
  const daily: string[] = [], weekly: string[] = [], changes: TierPlan['changes'] = []
  for (const v of ordered) {
    const tier: Tier = why.get(v.id) != null ? 'diaria' : 'semanal'
    ;(tier === 'diaria' ? daily : weekly).push(v.id)
    if (v.tier !== tier) changes.push({ video_id: v.id, tier })
  }
  return { daily, weekly, changes, cut }
}

/**
 * Um vídeo semanal é devido hoje quando ainda não tem ponto hoje E (hoje é o dia fixo dele, OU o último ponto tem 7 dias
 * ou mais, OU nunca teve ponto e está na faixa há 7 dias ou mais). `lastPoint` = a data do ponto mais recente nos últimos
 * 8 dias (null = nenhum nesse intervalo).
 */
export function weeklyDue(v: { ytId: string; lastPoint: string | null; tierSince: string | null }, today: string): boolean {
  if (v.lastPoint === today) return false
  if (dayNumber(today) % 7 === weekSlotOf(v.ytId)) return true
  const since = v.lastPoint ?? v.tierSince
  return since != null && dayNumber(today) - dayNumber(since) >= RULES.series.weeklyEveryDays
}

/** Promoção por ganho: entre dois pontos a no máximo 8 dias, ganhou `minViews` e pelo menos `minShare` do total. */
export function shouldPromote(prev: { date: string; views: number } | null, cur: { views: number }, today: string): boolean {
  if (!prev) return false
  const days = dayNumber(today) - dayNumber(prev.date)
  if (days < 1 || days > RULES.series.weeklyMaxGapDays) return false
  const gain = cur.views - prev.views
  return gain >= RULES.promotion.minViews && cur.views > 0 && gain / cur.views >= RULES.promotion.minShare
}

/** Primeiras horas: só vídeo cuja descoberta o Observatório registrou (discovered_at), até 24 h depois de publicado, com menos de 72 h. */
export function earlyEligible(v: { discoveredAt: string | null; publishedAt: string | null }, nowMs: number): boolean {
  const d = v.discoveredAt ? Date.parse(v.discoveredAt) : NaN, p = v.publishedAt ? Date.parse(v.publishedAt) : NaN
  if (!Number.isFinite(d) || !Number.isFinite(p)) return false
  return d - p <= RULES.series.earlyDiscoverHours * HOUR && nowMs >= p && nowMs - p < RULES.series.earlyHours * HOUR
}
```

- [ ] **Step 4:** `npx vitest run test/youtube/competitor-tiers.test.ts test/youtube/observatorio 2>&1 | tail -8 && npm run typecheck 2>&1 | tail -3` → PASS (a pasta `observatorio` roda junto porque `rules.ts` mudou: nenhum teste de lá pode quebrar).

- [ ] **Step 5: commit.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/competitor-tiers.ts apps/web/src/lib/youtube/observatorio/rules.ts apps/web/test/youtube/competitor-tiers.test.ts && git commit -m "feat: faixas da série dos concorrentes (diária, semanal, devido, promoção, primeiras horas), puro (A5 E2)" -- apps/web/src/lib/youtube/competitor-tiers.ts apps/web/src/lib/youtube/observatorio/rules.ts apps/web/test/youtube/competitor-tiers.test.ts
```

**Pronto quando:** itens 14 e 18 e os cinco casos da OP-15 passam; os testes do Observatório continuam verdes.

### Regra das Tarefas 6 a 11 (todas mexem em `competitor-sync.ts` e no mesmo falso do banco)

- Uma por vez, na ordem. Depois de cada uma: `cd apps/web && npx vitest run test/youtube/competitor-sync.test.ts test/youtube/competitor-sync-a5.test.ts test/youtube/competitor-backfill.test.ts test/youtube/competitor-video-limit.test.ts test/youtube/competitor-versions.test.ts 2>&1 | tail -15` e `npm run typecheck 2>&1 | tail -3`.
- **Um teste antigo que falha porque enumera todas as chamadas ao banco ou à API** é atualizado para a lista nova, no mesmo commit, e o commit diz qual. **Um teste antigo que falha porque um comportamento mudou e a mudança não está escrita na tarefa é parada:** não ajuste o teste; relate.
- O falso do banco devolve `{ data: null, error: null }` para o que não conhece. Código novo que lê `data` nulo tem de tratar como "nenhuma linha" **só onde nenhuma linha é resposta legítima**; nas provas (Tarefa 12), nulo é falha.
- Linhas citadas (`competitor-sync.ts:NNN`) são as do arquivo em `f6de92d5`; depois da primeira edição, ache o trecho pelo texto.

### Task 6: sincronização: as quatro partes, a linha do vídeo e os erros de gravação visíveis

**Files:**
- Create: `apps/web/test/youtube/competitor-sync-harness.ts` (o falso do banco e os auxiliares, movidos do teste antigo)
- Create: `apps/web/test/youtube/competitor-sync-a5.test.ts`
- Modify: `apps/web/test/youtube/competitor-sync.test.ts` (importa o que foi movido; quatro expectativas mudam)
- Modify: `apps/web/src/lib/youtube/competitor-sync.ts`

**Interfaces:**
- Consumes: `optCount`, `videoObservedOf` (Tarefas 2 e 3).
- Produces: `export const VIDEO_PARTS = 'snippet,statistics,contentDetails,liveStreamingDetails'`; `SyncResult` ganha `partsMissing?: number`; dentro de `syncCompetitorChannel`, os conjuntos `patched` e `seen` e a função `patchFetched(items, byYt)`, que as tarefas seguintes usam. Do arquivo de apoio: `fakeDb`, `setup`, `apiFetch`, `traced`, `updatesOf`, `rpcCalls`, `first`, `arg`, `rpcs`, `NOW`, `NOW_ISO`, `EARLY`, `ch`, `lockRow`, `recent`, `quiet`, `type Call`, `type SetupOpts`.

- [ ] **Step 1: mover o falso para um arquivo de apoio, sem mudar comportamento.** Crie `apps/web/test/youtube/competitor-sync-harness.ts` e mova para lá, exportando, o que hoje está em `competitor-sync.test.ts` entre as linhas 78 e 168 (`type Call`, `type Script`, `fakeDb`, `rpcs`, `first`, `arg`, `NOW`, `NOW_ISO`, `ch`, `lockRow`, `apiFetch`, `recent`, `setup`) e, de dentro do `describe` dos fixados (linhas 614 a 640), `traced`, `EARLY` e `quiet`. Acrescente dois auxiliares:

```ts
/** Os `update` gravados em competitor_videos para UMA linha (os corpos, na ordem). */
export const updatesOf = (db: { calls: Call[] }, uuid: string) => db.calls
  .filter(c => c.table === 'competitor_videos' && first(c) === 'update' && c.ops.some(o => o[0] === 'eq' && o[1][0] === 'id' && o[1][1] === uuid))
  .map(c => arg(c, 'update')!)
/** Os argumentos de cada chamada a uma função SQL, na ordem. */
export const rpcCalls = (db: { calls: Call[] }, name: string) => db.calls.filter(c => c.table === 'rpc:' + name).map(c => c.ops[0]![1][0] as Record<string, unknown>)
```

O arquivo de apoio importa `vi` de `vitest` e `getSupabaseServiceClient` de `@/lib/supabase/service` (o `vi.mock` continua em cada arquivo de teste, que é onde o Vitest o iça). Em `competitor-sync.test.ts`, troque as definições movidas por `import { … } from './competitor-sync-harness'` e, no `describe` dos fixados, `const statsOf = updatesOf`.

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run test/youtube/competitor-sync.test.ts 2>&1 | tail -6`
Expected: o mesmo número de testes de antes, todos verdes. **Commit só deste passo** (`test: falso do banco do sync de concorrentes em arquivo de apoio (sem mudança de comportamento)`), para a revisão ver a mudança de lugar separada da de conteúdo.

- [ ] **Step 2: o falso distingue a chamada da página da chamada da passada sem olhar as partes** (elas passam a ser iguais). Em `apiFetch`, no arquivo de apoio, troque o corpo por:

```ts
export function apiFetch(video: Record<string, unknown> | null, status = 200, extra: { daily?: (call: number, url: string) => Response | Record<string, unknown>[]; noUploads?: boolean; log?: FetchLog; channelItems?: unknown[] } = {}): typeof fetch {
  let dailyN = 0, pageNext = false
  return (async (input: RequestInfo | URL) => {
    const u = String(input)
    if (status !== 200) return { ok: false, status }
    if (u.includes('/channels?')) {
      return Response.json({ items: extra.channelItems ?? [{ id: 'UC_test', contentDetails: { relatedPlaylists: extra.noUploads ? {} : { uploads: 'UU' } }, snippet: { title: 'Canal' }, statistics: { subscriberCount: '10' } }] })
    }
    // a chamada de detalhes da página vem logo depois da lista de uploads (quando ela trouxe vídeo); qualquer outra videos.list é da passada
    if (u.includes('/playlistItems?')) { pageNext = video != null; return Response.json({ items: video ? [{ snippet: { resourceId: { videoId: video.id } } }] : [] }) }
    if (u.includes('/videos?') && !pageNext) {
      dailyN++
      extra.log?.dailyCalls.push(u)
      if (extra.daily) {
        const r = extra.daily(dailyN, u)
        return r instanceof Response ? r : Response.json({ items: r })
      }
      return Response.json({ items: video ? [{ ...video, statistics: { viewCount: '7' } }] : [] })
    }
    pageNext = false
    return Response.json({ items: video ? [video] : [] })
  }) as typeof fetch
}
```

- [ ] **Step 3: testes que falham.** `apps/web/test/youtube/competitor-sync-a5.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/youtube/thumb-fingerprint', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/thumb-fingerprint')>()),
  probeThumb: vi.fn(),
  archiveThumb: vi.fn(async () => 'https://blob.test/t.jpg'),
}))

import { syncCompetitorChannel, VIDEO_PARTS } from '@/lib/youtube/competitor-sync'
import { probeThumb } from '@/lib/youtube/thumb-fingerprint'
import { setup, apiFetch, traced, updatesOf, first, arg, NOW, NOW_ISO, EARLY, ch, recent, quiet } from './competitor-sync-harness'

beforeEach(() => {
  vi.mocked(probeThumb).mockReset()
  vi.mocked(probeThumb).mockResolvedValue({ etag: null, lastModified: null, dhash: null, bytes: null, url: 'u' })
})

const OLD = new Date(NOW.getTime() - 400 * 86_400_000).toISOString()
const page = (over: Record<string, unknown> = {}) => ({ id: 'vid-1', snippet: { title: 'T', description: '', publishedAt: recent(), tags: ['a'], categoryId: '19' }, statistics: { viewCount: '7', likeCount: '1', commentCount: '2' }, contentDetails: { duration: 'PT10M' }, ...over })
const ROW1 = { id: 'v-1', video_id: 'vid-1', title: 'T', description_hash: 'x', thumbnail_url: null, view_count: 1, is_short: false }
const PIN = { id: 'v-pin', video_id: 'vid-pin', title: 'Fixado', thumbnail_url: null }
const inserts = (db: ReturnType<typeof setup>) => db.calls.filter(c => c.table === 'competitor_videos' && first(c) === 'insert').map(c => arg(c, 'insert')!)

describe('A5 E1: partes pedidas e a linha do vídeo', () => {
  it('toda chamada videos.list pede as quatro partes, e nenhuma chamada é acrescentada (D1)', async () => {
    setup({ lastDaily: '2026-10-23', existing: [ROW1] })
    const t1 = traced(apiFetch(page()))
    const r1 = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: t1.f, ...quiet })
    expect(t1.api()).toEqual(['channels?part=contentDetails,snippet,statistics&id=UC_test', 'playlistItems?part=snippet&playlistId=UU&maxResults=50', 'videos?part=' + VIDEO_PARTS + '&id=vid-1', 'videos?part=' + VIDEO_PARTS + '&id=vid-1'])
    expect(r1.unitsUsed).toBe(4)
    setup({ pinned: [PIN], existing: [ROW1] })
    const t2 = traced(apiFetch(page(), 200, { daily: () => [{ id: 'vid-pin', snippet: { title: 'Fixado', publishedAt: OLD }, statistics: { viewCount: '3' } }] }))
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: t2.f, ...quiet })
    expect(t2.api().at(-1)).toBe('videos?part=' + VIDEO_PARTS + '&id=vid-pin')
  })
  it('item 6: sem commentCount → comment_count nulo e comments_disabled; nenhuma gravação de 0 vinda de ausência', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ statistics: { viewCount: '7', likeCount: '1' } })), ...quiet })
    expect(updatesOf(db, 'v-1').at(-1)).toMatchObject({ comment_count: null, comments_disabled: true, like_count: 1, likes_hidden: false, view_count: 7, views_hidden: false })
    expect(db.calls.some(c => c.table === 'competitor_videos' && (arg(c, 'update')?.comment_count === 0 || arg(c, 'insert')?.comment_count === 0))).toBe(false)
  })
  it('item 8: liveStreamingDetails vira was_live e os horários; sem ele, was_live false', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ liveStreamingDetails: { actualStartTime: '2026-10-20T10:00:00Z', actualEndTime: '2026-10-20T11:00:00Z' } })), ...quiet })
    expect(updatesOf(db, 'v-1').at(-1)).toMatchObject({ was_live: true, live_actual_start_at: '2026-10-20T10:00:00Z', live_actual_end_at: '2026-10-20T11:00:00Z', live_scheduled_start_at: null })
    const db2 = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    expect(updatesOf(db2, 'v-1').at(-1)).toMatchObject({ was_live: false })
  })
  it('vídeo novo nasce com discovered_at = agora e com os sinalizadores; vídeo que já existia nunca recebe discovered_at', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ statistics: { viewCount: '7' } })), ...quiet })
    expect(inserts(db)[0]).toMatchObject({ video_id: 'vid-1', discovered_at: EARLY.toISOString(), view_count: 7, like_count: null, likes_hidden: true, comment_count: null, comments_disabled: true, was_live: false })
    const db2 = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    expect(updatesOf(db2, 'v-1').every(u => !('discovered_at' in u))).toBe(true)
  })
  it('a passada diária regrava a linha de todo vídeo que veio, fixado ou não, e só uma vez por sincronização', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1], tracked: [{ id: 'v-1', video_id: 'vid-1', title: 'T', thumbnail_url: null }, { id: 'v-2', video_id: 'vid-2', title: 'Outro', thumbnail_url: null }] })
    const ids = (u: string) => decodeURIComponent(u.match(/[?&]id=([^&]*)/)![1]!).split(',')
    await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page(), 200, { daily: (_n, u) => ids(u).map(id => ({ id, statistics: { viewCount: '5', likeCount: '1', commentCount: '0' } })) }), ...quiet })
    expect(updatesOf(db, 'v-2')).toEqual([expect.objectContaining({ view_count: 5, comment_count: 0, comments_disabled: false, last_checked_at: NOW_ISO })])
    expect(updatesOf(db, 'v-1')).toHaveLength(1) // veio na página e de novo na passada: uma gravação só
  })
  it('falha em verde fechada: erro ao gravar a linha do vídeo lança e o canal fica em erro', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1], failUpdateOf: 'v-1' })
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })).rejects.toThrow(/update video row/)
    expect(db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')).at(-1)).toMatchObject({ sync_status: 'error' })
  })
  it('resposta sem a parte statistics: a contagem gravada não é tocada, e a execução conta a parte que faltou', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    const { statistics: _s, ...noStats } = page()
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(noStats), ...quiet })
    expect('view_count' in updatesOf(db, 'v-1').at(-1)!).toBe(false)
    expect(r.partsMissing).toBe(1)
  })
})
```

No arquivo de apoio, `setup` ganha a opção `failUpdateOf?: string`, e o roteiro ganha, **antes** das linhas de `competitor_videos`:

```ts
    if (c.table === 'competitor_videos' && first(c) === 'update' && opts.failUpdateOf && c.ops.some(o => o[0] === 'eq' && o[1][1] === opts.failUpdateOf)) return { data: null, error: { message: 'boom' } }
```

- [ ] **Step 4:** `npx vitest run test/youtube/competitor-sync-a5.test.ts 2>&1 | tail -12` → FAIL (`VIDEO_PARTS` não existe; depois, expectativas).

- [ ] **Step 5: implementar em `competitor-sync.ts`.**

(a) Importações e constantes. Apague a função `optCount` local (linhas 23 a 28) e acrescente, junto das outras importações:

```ts
import { optCount, videoObservedOf } from '@/lib/youtube/competitor-capture'
export { optCount } from '@/lib/youtube/competitor-capture'
```

e, depois de `const PAGE_DELAY_MS = 300`:

```ts
/** As partes pedidas em TODA chamada videos.list. O quadro de cota cobra 1 unidade por chamada, qualquer que seja o número de partes. */
export const VIDEO_PARTS = 'snippet,statistics,contentDetails,liveStreamingDetails'
```

(b) As três URLs: em `:426` troque `part=snippet,statistics,contentDetails` por `part=${VIDEO_PARTS}`; em `:570` e em `:619` troque `part=snippet,statistics` por `part=${VIDEO_PARTS}`.

(c) `SyncResult` ganha `/** Itens que vieram sem uma parte inteira (snippet, statistics ou contentDetails): os campos dela não foram comparados. */ partsMissing?: number`.

(d) Logo depois de `const reconciled = new Set<string>()`:

```ts
  /** A5 (E1): linhas de competitor_videos já regravadas nesta sincronização, e os vídeos que vieram do YouTube nela. */
  const patched = new Set<string>()
  const seen = new Set<string>()
  let partsMissing = 0
```

(e) Troque a função `refreshPinnedStats` inteira (e o comentário dela) por:

```ts
  /**
   * A linha do vídeo é regravada toda vez que o YouTube o devolve, em qualquer chamada (página, passada diária, fixados):
   * contagens, sinalizadores (D2: contagem ausente é nulo mais o sinalizador, nunca 0), ao vivo, e a sequência de faltas
   * zerada. Uma vez por sincronização. Erro de gravação lança: uma linha que não grava nunca é "ok".
   */
  const patchFetched = async (items: FetchedItem[], byYt: Map<string, TrackedRow>): Promise<void> => {
    for (const it of items) {
      const row = byYt.get(it.id)
      if (!row) continue
      seen.add(row.id)
      if (patched.has(row.id)) continue
      const o = videoObservedOf(it, nowIso, parseIsoDuration)
      if (o.partsMissing.length) partsMissing++
      const { error } = await supabase.from('competitor_videos').update(o.patch).eq('id', row.id)
      fail('update video row', error)
      patched.add(row.id)
    }
  }
```

e troque as duas chamadas `await refreshPinnedStats(items, byYt)` (passada diária) e `await refreshPinnedStats(fetched, byYt)` (fixados) por `await patchFetched(…)` com os mesmos argumentos.

(f) No laço da página: depois de `const durationSeconds = …`, acrescente `const observed = videoObservedOf(video, nowIso, parseIsoDuration)` e `if (observed.partsMissing.length) partsMissing++`; apague as linhas `const likeCount = …` e `const commentCount = …`. No `insert`, troque as três linhas `view_count: viewCount,`, `like_count: likeCount,` e `comment_count: commentCount,` por `...observed.patch, discovered_at: nowIso,` e capture o erro:

```ts
          const { data: inserted, error: insErr } = await supabase.from('competitor_videos').insert({
            competitor_channel_id: channelRow.id, video_id: videoId, title, description_hash: descriptionHash, thumbnail_url: thumbnailUrl,
            published_at: publishedAt, duration_seconds: durationSeconds, is_short: isShort, tags, category_id: categoryId,
            original_thumbnail_url: thumbnailUrl, ...observed.patch, discovered_at: nowIso,
          }).select('id').single()
          fail('insert video', insErr)
          videoUuid = (inserted as { id: string } | null)?.id ?? null
          if (videoUuid) { patched.add(videoUuid); seen.add(videoUuid) }
```

No `update` de "Update stats", troque o corpo por (as contagens e `last_checked_at` passam a vir de `observed.patch`):

```ts
        const { error: updErr } = await supabase
          .from('competitor_videos')
          .update({
            ...(title ? { title } : {}),
            ...(apiDescription !== undefined ? { description_hash: descriptionHash } : {}),
            thumbnail_url: thumbnailUrl, duration_seconds: durationSeconds, is_short: isShort, tags, category_id: categoryId,
            ...observed.patch,
          })
          .eq('id', existing.id)
        fail('update video row', updErr)
        patched.add(existing.id as string); seen.add(existing.id as string)
```

(g) No `return` de sucesso, acrescente `...(partsMissing ? { partsMissing } : {})`.

- [ ] **Step 6: as quatro expectativas antigas que mudam** (em `competitor-sync.test.ts`; o motivo de cada uma é o princípio D2 e a pergunta 2 da seção 1):

| Teste (nome atual) | Muda para |
|---|---|
| `sem fixados: exatamente as chamadas de hoje…` | `DETAILS` e a chamada da passada usam `'videos?part=' + VIDEO_PARTS + '&id=vid-1'` (importe `VIDEO_PARTS`) |
| `passo diário: fixado fora dos N ganha registro diário e conferência…` e `fixado com curtidas visíveis…` | `toEqual([{ … }])` vira `toEqual([expect.objectContaining({ … })])` (a linha agora leva os sinalizadores) |
| `vídeo acompanhado mas NÃO fixado, fora da página: o passo diário não grava contagem…` | renomeie para `…: o passo diário grava a contagem e os sinalizadores na linha do vídeo` e afirme `toEqual([expect.objectContaining({ view_count: 5, last_checked_at: NOW_ISO })])` |
| `fixado que o YouTube devolve SEM contagem…` | o primeiro item (sem `statistics`) continua sem `view_count` no corpo: troque a asserção por `expect('view_count' in statsOf(db, 'v-pin')[0]!).toBe(false)`; o segundo (`statistics: {}`) passa a `toMatchObject({ view_count: null, views_hidden: true, like_count: null, likes_hidden: true })`. Separe o laço em dois `it` |

Procure outras ocorrências de `part=snippet,statistics` em `apps/web/test` (`grep -rn "part=snippet,statistics" apps/web/test`) e atualize as que casam a URL.

- [ ] **Step 7:** rodar o comando da "Regra das Tarefas 6 a 11" → tudo verde; typecheck limpo.

- [ ] **Step 8: commit.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync.test.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts && git commit -m "feat: sync de concorrentes pede as quatro partes e grava sinalizadores, ao vivo e discovered_at; contagem ausente é nulo, nunca 0 (A5 E1)" -- apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube
```

**Pronto quando:** itens 6 e 8 provados na sincronização; nenhuma chamada a mais à API; um erro de gravação na linha do vídeo deixa o canal em erro; os quatro testes antigos mudaram só no que a tabela diz.

### Task 7: sincronização: captura do canal e dos vídeos (campos e `raw`)

**Files:**
- Modify: `apps/web/src/lib/youtube/competitor-sync.ts`
- Modify: `apps/web/test/youtube/competitor-sync-harness.ts`
- Test: `apps/web/test/youtube/competitor-sync-a5.test.ts`

**Interfaces:**
- Consumes: `captureItems`, `rawOf`, `channelObservedOf`, `CAPTURE_CHUNK`, `type CaptureItem` (Tarefa 4); `patched`, `seen`, `patchFetched` (Tarefa 6).
- Produces: dentro de `syncCompetitorChannel`: `rowInfo: Map<string, { lastSeenAt: string | null; weeklySince: string | null; missing: boolean }>`, `captured: Set<string>`, `captureFetched(pairs: Array<{ uuid: string; item: unknown }>): Promise<void>`, `captureFailure: Error | null`. `SyncResult` ganha `fieldsOpened?`, `rawOpened?`, `rawTooBig?`. O falso ganha as opções `fields`, `raws`, `rpcFail`, `selectFail`.

- [ ] **Step 1: o falso aprende as tabelas e funções novas.** Em `setup` (arquivo de apoio), acrescente as opções `fields?: Record<string, unknown>[]`, `raws?: Record<string, unknown>[]`, `rpcFail?: string`, `selectFail?: string`, `missed?: Record<string, unknown>[]`, `channelMissed?: Record<string, unknown> | null`, e no roteiro, **antes** do `return { data: null, error: null }` final:

```ts
    if (opts.selectFail && c.table === opts.selectFail && first(c) === 'select') return { data: null, error: { message: 'boom' } }
    if (c.table === 'competitor_field_versions' && first(c) === 'select') return { data: opts.fields ?? [] }
    if (c.table === 'competitor_raw' && first(c) === 'select') return { data: opts.raws ?? [] }
    if (c.table.startsWith('rpc:')) {
      const name = c.table.slice(4)
      if (opts.rpcFail === name) return { data: null, error: { message: 'boom' } }
      if (name === 'competitor_mark_missing') return { data: opts.missed ?? [] }
      if (name === 'competitor_channel_mark_missing') return { data: opts.channelMissed ?? null }
      if (name === 'youtube_quota_add') return { data: 1 }
      return { data: {} }
    }
```

(A linha de `rpc:apply_competitor_version_plan`, que já existe, fica antes desta.)

- [ ] **Step 2: testes que falham** (acrescentar a `competitor-sync-a5.test.ts`; importe `rpcCalls` do arquivo de apoio e `fieldHash`, `rawOf` de `@/lib/youtube/competitor-capture`):

```ts
describe('A5 E1: captura (campos e raw)', () => {
  const opened = (db: ReturnType<typeof setup>) => rpcCalls(db, 'apply_competitor_field_plan').flatMap(a => a.p_open as Array<Record<string, unknown>>)
  const rawOpened = (db: ReturnType<typeof setup>) => rpcCalls(db, 'apply_competitor_raw_plan').flatMap(a => a.p_open as Array<Record<string, unknown>>)
  it('itens 1 e 2: primeira leitura abre os 7 campos e o raw do canal, e os campos e o raw de cada vídeo, tudo "first"', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    const f = opened(db)
    expect(f.filter(x => x.video_id === null).map(x => x.field).sort()).toEqual(['availability', 'avatar_url', 'country', 'custom_url', 'description', 'name', 'subscribers_hidden'])
    expect(f.filter(x => x.video_id === 'v-1').map(x => x.field).sort()).toEqual(['availability', 'category_id', 'comments_disabled', 'default_audio_language', 'default_language', 'duration_seconds', 'likes_hidden', 'live_broadcast_content', 'tags'])
    expect(f.every(x => x.precision === 'first' && x.window_start === null)).toBe(true)
    expect(rawOpened(db).map(x => x.video_id)).toEqual([null, 'v-1'])
    expect(r).toMatchObject({ fieldsOpened: 16, rawOpened: 2 })
  })
  it('itens 3 e 223: segunda rodada sem mudança no YouTube → ZERO gravações em field_versions e em raw', async () => {
    const chItem = { id: 'UC_test', contentDetails: { relatedPlaylists: { uploads: 'UU' } }, snippet: { title: 'Canal' }, statistics: { subscriberCount: '10' } }
    const first1 = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    // o que a 1ª rodada abriu vira o estado gravado da 2ª
    const fields = opened(first1).map((o, i) => ({ id: i + 1, video_id: o.video_id, field: o.field, value_hash: o.value_hash }))
    const raws = [{ id: 1, video_id: null, raw_sha256: rawOf(chItem).sha }, { id: 2, video_id: 'v-1', raw_sha256: rawOf(page()).sha }]
    const db = setup({ lastDaily: '2026-10-24', existing: [{ ...ROW1, last_seen_at: EARLY.toISOString() }], fields, raws })
    const r = await syncCompetitorChannel(ch, 'k', { now: new Date(EARLY.getTime() + 3_600_000), fetchImpl: apiFetch(page({ statistics: { viewCount: '99999', likeCount: '50', commentCount: '9' } })), ...quiet })
    expect(rpcCalls(db, 'apply_competitor_field_plan')).toEqual([])
    expect(rpcCalls(db, 'apply_competitor_raw_plan')).toEqual([])
    expect(r.fieldsOpened ?? 0).toBe(0)
  })
  it('item 4: mudou uma tag → uma versão de tags, com a janela na leitura anterior do vídeo, e a antiga fechada com essa data', async () => {
    const prev = '2026-10-24T03:00:00.000Z'
    const db = setup({ lastDaily: '2026-10-24', existing: [{ ...ROW1, last_seen_at: prev }], fields: [{ id: 41, video_id: 'v-1', field: 'tags', value_hash: fieldHash(['a']) }] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, tags: ['b'] } })), ...quiet })
    const plan = rpcCalls(db, 'apply_competitor_field_plan').find(a => (a.p_open as Array<{ field: string }>).some(o => o.field === 'tags'))!
    expect(plan.p_close).toEqual([{ id: 41, last_seen_at: prev }])
    expect((plan.p_open as Array<Record<string, unknown>>).find(o => o.field === 'tags')).toMatchObject({ value: ['b'], window_start: prev, precision: '6h', first_seen_at: EARLY.toISOString() })
  })
  it('o "visto" só é carimbado DEPOIS da captura: se ela falha, last_seen_at não é gravado, a série do dia já foi, e o canal termina em erro', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1], rpcFail: 'apply_competitor_field_plan' })
    await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page()), ...quiet })).rejects.toThrow(/captura/)
    expect(db.calls.some(c => c.table === 'competitor_videos' && 'last_seen_at' in (arg(c, 'update') ?? {}))).toBe(false)
    expect(db.calls.some(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')).toBe(true)
    expect(db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')).at(-1)).toMatchObject({ sync_status: 'error' })
  })
  it('captura bem-sucedida carimba last_seen_at dos vídeos do lote numa gravação só, e o do canal', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    const stamps = db.calls.filter(c => c.table === 'competitor_videos' && first(c) === 'update' && Object.keys(arg(c, 'update') ?? {}).join() === 'last_seen_at')
    expect(stamps).toHaveLength(1)
    expect(stamps[0]!.ops.find(o => o[0] === 'in')![1]).toEqual(['id', ['v-1']])
    expect(db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')!).some(u => u.last_seen_at === EARLY.toISOString() && u.custom_url === null && u.subscribers_hidden === false)).toBe(true)
  })
  it('o vídeo capturado na página não é capturado de novo na passada diária', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page()), ...quiet })
    expect(opened(db).filter(x => x.video_id === 'v-1' && x.field === 'tags')).toHaveLength(1)
  })
  it('o snapshot do canal leva subscribers_hidden', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [{ id: 'UC_test', contentDetails: { relatedPlaylists: { uploads: 'UU' } }, snippet: { title: 'Canal' }, statistics: { hiddenSubscriberCount: true } }] }), ...quiet })
    expect(arg(db.calls.find(c => c.table === 'competitor_channel_snapshots')!, 'upsert')).toMatchObject({ subscribers_hidden: true, subscriber_count: null })
  })
  it('erro na trava do canal lança (antes virava "pulado" em silêncio: é o que aconteceria sem a MG1)', async () => {
    setup({ selectFail: 'competitor_channels' })
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })).rejects.toThrow(/trava do canal/)
  })
})
```

Para o último teste, o roteiro do falso precisa falhar a trava: a linha `selectFail` acima só casa `first(c) === 'select'`; a trava é um `update` com `.or(…)`. Acrescente, logo acima da linha da trava (`c.ops.some(o => o[0] === 'or')`): `if (opts.selectFail === 'competitor_channels' && c.table === 'competitor_channels' && c.ops.some(o => o[0] === 'or')) return { data: null, error: { message: 'boom' } }`.

- [ ] **Step 3:** rodar → FAIL.

- [ ] **Step 4: implementar.**

(a) Importações: `import { optCount, videoObservedOf, channelObservedOf, rawOf, captureItems, CAPTURE_CHUNK } from '@/lib/youtube/competitor-capture'`.

(b) A trava: troque `const { data: locked } = await supabase` por `const { data: locked, error: lockError } = await supabase`, acrescente `last_seen_at` ao fim da lista do `.select(…)` da trava, e logo depois da instrução:

```ts
  // Um erro aqui (coluna que não existe, banco fora) não é "outro processo está sincronizando": lança.
  if (lockError) throw new Error('trava do canal: ' + (lockError.message ?? 'erro do banco'))
```

e, junto de `prevOkAt`: `const prevChannelSeenAt = (locked[0] as { last_seen_at?: string | null }).last_seen_at ?? null`.

(c) Estado, depois de `let partsMissing = 0`:

```ts
  /** A5 (E1): o que se sabia de cada vídeo ANTES desta sincronização (a janela de uma mudança começa na última leitura boa). */
  const rowInfo = new Map<string, { lastSeenAt: string | null; weeklySince: string | null; missing: boolean }>()
  const captured = new Set<string>()
  /** A captura nunca impede a série do dia: a primeira falha é guardada e lançada no fim da sincronização. */
  let captureFailure: Error | null = null
  const cap = { fieldsOpened: 0, rawOpened: 0, rawTooBig: 0 }
  const noteRow = (r: { id?: unknown; last_seen_at?: unknown; missing_since?: unknown }): void => {
    if (typeof r.id !== 'string' || rowInfo.has(r.id)) return
    rowInfo.set(r.id, { lastSeenAt: typeof r.last_seen_at === 'string' ? r.last_seen_at : null, weeklySince: null, missing: r.missing_since != null })
  }
  /** Campos e raw dos vídeos que vieram, em lotes de 50, e só então o carimbo de "visto". */
  const captureFetched = async (pairs: Array<{ uuid: string; item: unknown }>): Promise<void> => {
    const todo = pairs.filter(p => !captured.has(p.uuid))
    for (let i = 0; i < todo.length; i += CAPTURE_CHUNK) {
      const chunk = todo.slice(i, i + CAPTURE_CHUNK)
      try {
        const st = await captureItems(supabase, {
          siteId: channelRow.site_id, channelId: channelRow.id, scope: 'video', nowIso,
          items: chunk.map(p => {
            const info = rowInfo.get(p.uuid)
            return { videoId: p.uuid, fields: videoObservedOf(p.item, nowIso, parseIsoDuration).fields, raw: rawOf(p.item), prevSeenAt: info?.lastSeenAt ?? null, weeklySince: info?.weeklySince ?? null }
          }),
        })
        cap.fieldsOpened += st.fieldsOpened; cap.rawOpened += st.rawOpened; cap.rawTooBig += st.rawTooBig
        const { error } = await supabase.from('competitor_videos').update({ last_seen_at: nowIso }).in('id', chunk.map(p => p.uuid))
        fail('stamp last_seen_at', error)
        for (const p of chunk) captured.add(p.uuid)
      } catch (e) {
        captureFailure ??= e instanceof Error ? e : new Error(String(e))
      }
    }
  }
```

(d) As leituras que alimentam `rowInfo`: acrescente `, last_seen_at, missing_since` ao `.select(…)` de `loadPinned`, de `loadTracked` e de `existingVideos` (no laço da página), e chame `noteRow` em cada linha lida (`for (const r of data ?? []) noteRow(r)` logo depois de cada `fail(…)`; no laço da página, `for (const v of existingVideos ?? []) noteRow(v)`).

(e) O canal. Depois de `const stats = channelData.items[0].statistics`:

```ts
    const chObserved = channelObservedOf(channelData.items[0])
    let channelCaptured = false
    try {
      const st = await captureItems(supabase, { siteId: channelRow.site_id, channelId: channelRow.id, scope: 'canal', nowIso,
        items: [{ videoId: null, fields: chObserved.fields, raw: rawOf(channelData.items[0]), prevSeenAt: prevChannelSeenAt, weeklySince: null }] })
      cap.fieldsOpened += st.fieldsOpened; cap.rawOpened += st.rawOpened; cap.rawTooBig += st.rawTooBig
      channelCaptured = true
    } catch (e) {
      captureFailure ??= e instanceof Error ? e : new Error(String(e))
    }
```

No `update` de `competitor_channels` que grava `channel_name`, acrescente `...chObserved.patch, ...(channelCaptured ? { last_seen_at: nowIso } : {}),` e confira o erro (`const { error: chErr } = await …; fail('update channel', chErr)`). No `upsert` de `competitor_channel_snapshots`, acrescente `subscribers_hidden: chObserved.patch.subscribers_hidden,`.

(f) Página: declare `const pagePairs: Array<{ uuid: string; item: unknown }> = []` junto de `const touchIds`; dentro do laço, logo depois de resolvido `videoUuid` (antes do `if (!existing) continue`), `if (videoUuid) pagePairs.push({ uuid: videoUuid, item: video })`; depois do bloco `if (touchIds.length) { … }`, `await captureFetched(pagePairs)`.

(g) Passada diária e fixados: logo depois de cada `await patchFetched(…)`, acrescente `await captureFetched(items.filter(it => byYt.has(it.id)).map(it => ({ uuid: byYt.get(it.id)!.id, item: it })))` (na dos fixados a lista se chama `fetched`).

(h) Fim: imediatamente antes de `// Mark completion`, `if (captureFailure) throw captureFailure`. No `return` de sucesso, acrescente `...(cap.fieldsOpened ? { fieldsOpened: cap.fieldsOpened } : {}), ...(cap.rawOpened ? { rawOpened: cap.rawOpened } : {}), ...(cap.rawTooBig ? { rawTooBig: cap.rawTooBig } : {})`, e os três campos opcionais em `SyncResult`.

- [ ] **Step 5:** rodar o comando da regra → verde. Testes antigos que enumeram chamadas ao banco passam a ver as leituras de `competitor_field_versions` e `competitor_raw`: atualize a lista.

- [ ] **Step 6: commit** (`feat: captura de campos e raw do canal e dos vídeos no sync de concorrentes; nada é regravado quando nada muda (A5 E1)`), com os mesmos caminhos da Tarefa 6.

**Pronto quando:** itens 1, 2, 3, 4 e 223 provados na sincronização; a falha de captura não perde a série do dia, não carimba o "visto" e deixa o canal em erro.

### Task 8: sincronização: o que deixou de vir do YouTube, e o que voltou

**Files:**
- Modify: `apps/web/src/lib/youtube/competitor-sync.ts`
- Test: `apps/web/test/youtube/competitor-sync-a5.test.ts`
- Modify: `apps/web/test/youtube/competitor-sync.test.ts` (um teste muda de nome e ganha uma asserção)

**Interfaces:**
- Consumes: `markMissing`, `markChannelMissing` (Tarefa 4); `seen`, `rowInfo` (Tarefas 6 e 7).
- Produces: dentro de `syncCompetitorChannel`, `asked: Set<string>`. `SyncResult` ganha `missed?`, `newlyMissing?`, `returned?`.

- [ ] **Step 1: testes que falham:**

```ts
describe('A5 E1: ausência e volta (itens 7 e 221)', () => {
  const PINROW = { ...PIN, last_seen_at: '2026-10-24T03:00:00.000Z' }
  it('vídeo pedido e não devolvido: uma chamada a competitor_mark_missing com o uuid; nada é apagado nem regravado na linha', async () => {
    const db = setup({ pinned: [PINROW], existing: [ROW1], missed: [{ id: 'v-pin', miss_streak: 1, miss_first_at: EARLY.toISOString(), missing_since: null, last_seen_at: PINROW.last_seen_at }] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { daily: () => [] }), ...quiet })
    expect(rpcCalls(db, 'competitor_mark_missing')).toEqual([{ p_channel_id: 'cc-1', p_video_ids: ['v-pin'], p_now: EARLY.toISOString() }])
    expect(r).toMatchObject({ missed: 1 })
    expect(r.newlyMissing ?? 0).toBe(0)
    expect(db.calls.some(c => c.ops.some(o => o[0] === 'delete'))).toBe(false)
    expect(updatesOf(db, 'v-pin')).toEqual([])
    expect(rpcCalls(db, 'apply_competitor_field_plan').flatMap(a => a.p_open as Array<{ field: string; value: unknown }>).some(o => o.value === 'sumiu')).toBe(false)
  })
  it('segunda leitura seguida sem o vídeo: a versão availability = "sumiu" é aberta no instante da 1ª falta', async () => {
    const firstMiss = '2026-10-24T03:00:00.000Z'
    const db = setup({ pinned: [PINROW], existing: [ROW1], fields: [{ id: 9, video_id: 'v-pin', field: 'availability', value_hash: fieldHash('no_ar') }],
      missed: [{ id: 'v-pin', miss_streak: 2, miss_first_at: firstMiss, missing_since: '2026-10-24', last_seen_at: '2026-10-23T21:00:00.000Z' }] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { daily: () => [] }), ...quiet })
    expect(r).toMatchObject({ missed: 1, newlyMissing: 1 })
    const sumiu = rpcCalls(db, 'apply_competitor_field_plan').flatMap(a => a.p_open as Array<Record<string, unknown>>).find(o => o.value === 'sumiu')!
    expect(sumiu).toMatchObject({ video_id: 'v-pin', field: 'availability', first_seen_at: firstMiss, window_start: '2026-10-23T21:00:00.000Z' })
  })
  it('Review Focus 2: pedido duas vezes na mesma sincronização e ausente nas duas → UMA falta (uma chamada, um uuid)', async () => {
    // v-1 está na página (a lista de uploads o traz) e na passada diária, e não vem em nenhuma das duas respostas
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1] })
    const f = (async (input: RequestInfo | URL) => {
      const u = String(input)
      if (u.includes('/channels?')) return Response.json({ items: [{ id: 'UC_test', contentDetails: { relatedPlaylists: { uploads: 'UU' } }, snippet: { title: 'Canal' }, statistics: { subscriberCount: '10' } }] })
      if (u.includes('/playlistItems?')) return Response.json({ items: [{ snippet: { resourceId: { videoId: 'vid-1' } } }] })
      return Response.json({ items: [] })
    }) as typeof fetch
    await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: f, ...quiet })
    expect(rpcCalls(db, 'competitor_mark_missing')).toHaveLength(1)
    expect(rpcCalls(db, 'competitor_mark_missing')[0]!.p_video_ids).toEqual(['v-1'])
  })
  it('Review Focus 3: a chamada videos.list falha (HTTP 500) → nenhum vídeo dela conta como ausente', async () => {
    const db = setup({ pinned: [PINROW], existing: [ROW1] })
    const f = apiFetch(page(), 200, { daily: () => new Response('x', { status: 500 }) })
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: f, ...quiet })).rejects.toThrow(/500/)
    expect(rpcCalls(db, 'competitor_mark_missing')).toEqual([])
  })
  it('vídeo ausente que volta: a linha zera a sequência, a decisão "manter" é limpa, abre "no_ar", e a execução conta a volta', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [{ ...ROW1, last_seen_at: '2026-10-20T03:00:00.000Z', missing_since: '2026-10-21' }], fields: [{ id: 9, video_id: 'v-1', field: 'availability', value_hash: fieldHash('sumiu') }] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })
    expect(updatesOf(db, 'v-1').some(u => u.miss_streak === 0 && u.missing_since === null && u.miss_first_at === null && u.removal_decision === null)).toBe(true)
    const plan = rpcCalls(db, 'apply_competitor_field_plan').find(a => (a.p_open as Array<{ value: unknown }>).some(o => o.value === 'no_ar'))!
    expect(plan.p_close).toEqual([{ id: 9, last_seen_at: '2026-10-20T03:00:00.000Z' }])
    expect((plan.p_open as Array<Record<string, unknown>>).find(o => o.value === 'no_ar')).toMatchObject({ precision: 'gap' }) // 4 dias sem o vídeo: a janela é buraco, não "1 dia"
    expect(r.returned).toBe(1)
  })
  it('item 221, canal: channels.list sem o canal soma a falta do canal e o sync continua terminando em erro "não encontrado"', async () => {
    const db = setup({ channelMissed: { id: 'cc-1', miss_streak: 2, miss_first_at: '2026-10-24T03:00:00.000Z', missing_since: '2026-10-24', last_seen_at: '2026-10-23T21:00:00.000Z' } })
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { channelItems: [] }), ...quiet })).rejects.toThrow(/404/)
    expect(rpcCalls(db, 'competitor_channel_mark_missing')).toEqual([{ p_channel_id: 'cc-1', p_now: EARLY.toISOString() }])
    expect(rpcCalls(db, 'apply_competitor_field_plan').flatMap(a => a.p_open as Array<Record<string, unknown>>).find(o => o.value === 'sumiu')).toMatchObject({ video_id: null, field: 'availability' })
  })
  it('a marca de ausência falhando no banco deixa o canal em erro (não some em silêncio)', async () => {
    setup({ pinned: [PINROW], existing: [ROW1], rpcFail: 'competitor_mark_missing' })
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 200, { daily: () => [] }), ...quiet })).rejects.toThrow(/ausência/)
  })
})
```

- [ ] **Step 2:** rodar → FAIL.

- [ ] **Step 3: implementar.**

(a) Importe `markMissing` e `markChannelMissing`. Estado, depois de `const captured = new Set<string>()`: `/** uuids pedidos a videos.list numa chamada que RESPONDEU (falha de rede não é sumiço). */ const asked = new Set<string>()` e `let missedStats = { missed: 0, newlyMissing: 0 }`.

(b) Canal sem item: no ramo `if (!uploadsPlaylistId) { … throw … }`, antes do `throw`, só quando a resposta veio sem o canal (`!channelData.items?.length`):

```ts
      if (!channelData.items?.length) {
        // a 2ª leitura seguida sem o canal grava missing_since e a versão 'sumiu'; a falha desta marca não esconde o 404
        try { await markChannelMissing(supabase, { siteId: channelRow.site_id, channelId: channelRow.id, nowIso }) } catch { /* o 404 abaixo já deixa o canal em erro */ }
      }
```

(c) Página: depois de `const existingMap = …`, `for (const v of existingVideos ?? []) asked.add(v.id as string)` (os vídeos que a lista de uploads trouxe e que já estão guardados foram pedidos a `videos.list`; o `throw` de `!videosRes.ok` vem antes desta linha, então uma chamada que falhou não chega aqui).

(d) Passada diária: dentro do `try`, logo depois de `const body = await res.json()`, `for (const c of chunk) asked.add(c.id)`. Fixados: o mesmo, depois de `const body = await res.json()`.

(e) Fim, imediatamente antes de `if (captureFailure) throw captureFailure`:

```ts
    // ── A5 (E1): o que foi pedido e não veio em NENHUMA chamada desta sincronização soma UMA falta ──
    const missedIds = [...asked].filter(id => !seen.has(id))
    if (missedIds.length) {
      missedStats = await markMissing(supabase, { siteId: channelRow.site_id, channelId: channelRow.id, videoIds: missedIds, nowIso, weeklySinceOf: id => rowInfo.get(id)?.weeklySince ?? null })
    }
    const returned = [...seen].filter(id => rowInfo.get(id)?.missing).length
```

No `return` de sucesso: `...(missedStats.missed ? { missed: missedStats.missed } : {}), ...(missedStats.newlyMissing ? { newlyMissing: missedStats.newlyMissing } : {}), ...(returned ? { returned } : {})`; os três campos em `SyncResult`.

- [ ] **Step 4: o teste antigo que muda.** Em `competitor-sync.test.ts`, `fixado que sumiu do YouTube (videos.list não devolve o item): nada é gravado e o sync termina ok` passa a se chamar `…: nada é apagado, a linha não é regravada, a falta é contada e o sync termina ok`, e ganha `expect(db.calls.filter(c => c.table === 'rpc:competitor_mark_missing')).toHaveLength(1)`. As outras asserções dele ficam.

- [ ] **Step 5:** rodar o comando da regra → verde. **Step 6: commit** (`feat: vídeo e canal que deixam de vir do YouTube são marcados na segunda leitura seguida, e a volta fica no histórico; nada é apagado (A5 E1)`).

**Pronto quando:** itens 7 e 221 e os Review Focus 2 e 3 passam.

### Task 9: sincronização: a cota gravada, e a guarda de schema

**Files:**
- Create: `apps/web/src/lib/youtube/competitor-quota.ts`, `apps/web/src/lib/youtube/competitor-health.ts` (só `schemaReady`; a Tarefa 12 acrescenta o resto)
- Modify: `apps/web/src/lib/youtube/competitor-sync.ts`, `apps/web/src/app/api/cron/sync-youtube/route.ts`
- Test: `apps/web/test/youtube/competitor-quota.test.ts`, `apps/web/test/youtube/competitor-health.test.ts`, `apps/web/test/youtube/competitor-sync-a5.test.ts`, `apps/web/test/youtube/cron-competitors-prova.test.ts` (novo), e os testes da rota que já existem (`test/youtube/cron-competitors-invalidate.test.ts`, `test/api/cron/sync-youtube.test.ts`, `test/youtube/cron-route.test.ts`: ganham o `vi.mock` da guarda)

**Interfaces:**
- Produces:

```ts
// competitor-quota.ts
export function pacificDate(ms: number): string                       // 'AAAA-MM-DD' no fuso America/Los_Angeles
export async function recordQuota(sb: SupabaseClient, p: { siteId: string; nowMs: number; units: number; mode: string; cut?: number }): Promise<void>  // lança em erro
// competitor-health.ts
/** null = pronto. Texto = o que falta (o cron para e fica vermelho com ele). */
export async function schemaReady(sb: SupabaseClient, need: 'e1' | 'e1e2'): Promise<string | null>
```

`SyncResult` ganha `quotaError?: true`.

- [ ] **Step 1: testes que falham.** `apps/web/test/youtube/competitor-quota.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { pacificDate, recordQuota } from '@/lib/youtube/competitor-quota'

describe('pacificDate (item 224: o dia da cota é o do Pacífico)', () => {
  it('03:30 de São Paulo ainda é o dia anterior no Pacífico, no verão e no inverno de lá', () => {
    expect(pacificDate(Date.parse('2026-06-10T06:30:00Z'))).toBe('2026-06-09') // 23:30 PDT
    expect(pacificDate(Date.parse('2026-01-10T06:30:00Z'))).toBe('2026-01-09') // 22:30 PST
  })
  it('vira o dia à meia-noite do Pacífico, não à de São Paulo nem à UTC', () => {
    expect(pacificDate(Date.parse('2026-06-10T06:59:59Z'))).toBe('2026-06-09')
    expect(pacificDate(Date.parse('2026-06-10T07:00:00Z'))).toBe('2026-06-10')
    expect(pacificDate(Date.parse('2026-01-10T07:59:59Z'))).toBe('2026-01-09')
    expect(pacificDate(Date.parse('2026-01-10T08:00:00Z'))).toBe('2026-01-10')
  })
})
describe('recordQuota', () => {
  const sbOf = (error: { message: string } | null) => { const calls: unknown[] = []; return { calls, sb: { rpc: (name: string, args: unknown) => { calls.push([name, args]); return Promise.resolve({ data: 1, error }) } } as never } }
  it('uma instrução só: a função SQL soma; o corpo leva o dia do Pacífico, as unidades e o total por modo', async () => {
    const { sb, calls } = sbOf(null)
    await recordQuota(sb, { siteId: 's', nowMs: Date.parse('2026-06-10T06:30:00Z'), units: 5, mode: 'competitors' })
    expect(calls).toEqual([['youtube_quota_add', { p_site_id: 's', p_day: '2026-06-09', p_units: 5, p_add: { competitors: 5 }, p_max: {} }]])
  })
  it('o corte do teto diário vai em p_max (o maior do dia, não a soma das quatro faixas)', async () => {
    const { sb, calls } = sbOf(null)
    await recordQuota(sb, { siteId: 's', nowMs: Date.parse('2026-06-10T15:00:00Z'), units: 4, mode: 'competitors', cut: 12 })
    expect((calls[0] as [string, { p_max: unknown }])[1].p_max).toEqual({ teto_diario_cortados: 12 })
  })
  it('zero unidades e nenhum corte: não chama o banco; erro do banco lança', async () => {
    const quiet = sbOf(null)
    await recordQuota(quiet.sb, { siteId: 's', nowMs: 0, units: 0, mode: 'competitors' })
    expect(quiet.calls).toEqual([])
    await expect(recordQuota(sbOf({ message: 'boom' }).sb, { siteId: 's', nowMs: 0, units: 1, mode: 'competitors' })).rejects.toThrow(/cota: boom/)
  })
})
```

`apps/web/test/youtube/competitor-health.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { schemaReady } from '@/lib/youtube/competitor-health'

const sbOf = (failing: Record<string, string>) => {
  const asked: string[] = []
  return { asked, sb: { from: (t: string) => ({ select: (cols: string) => ({ limit: () => { asked.push(t + ': ' + cols); return Promise.resolve(failing[t] ? { data: null, error: { message: failing[t] } } : { data: [], error: null }) } }) }) } as never }
}
describe('schemaReady (a ordem migration → código não pode falhar em verde)', () => {
  it('tudo no lugar: null, e a guarda da E1 não pergunta por tabela da MG2', async () => {
    const e1 = sbOf({})
    expect(await schemaReady(e1.sb, 'e1')).toBeNull()
    expect(e1.asked.some(a => a.includes('tier') || a.includes('early'))).toBe(false)
    expect(await schemaReady(sbOf({}).sb, 'e1e2')).toBeNull()
  })
  it('coluna da MG1 ausente: o texto diz qual migration e o erro do banco', async () => {
    expect(await schemaReady(sbOf({ competitor_videos: 'column competitor_videos.miss_streak does not exist' }).sb, 'e1')).toMatch(/MG1.*miss_streak/)
  })
  it('MG1 aplicada e MG2 não: a guarda completa acusa a MG2; a da E1 passa', async () => {
    const half = { competitor_video_tier_spans: 'relation does not exist' }
    expect(await schemaReady(sbOf(half).sb, 'e1')).toBeNull()
    expect(await schemaReady(sbOf(half).sb, 'e1e2')).toMatch(/MG2/)
  })
})
```

E em `competitor-sync-a5.test.ts`:

```ts
describe('A5 E1: cota (item 10)', () => {
  it('a sincronização grava as unidades gastas, uma vez, com o site e o modo', async () => {
    const db = setup({ lastDaily: '2026-10-23', existing: [ROW1] })
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page()), ...quiet })
    expect(rpcCalls(db, 'youtube_quota_add')).toEqual([expect.objectContaining({ p_site_id: 'site-1', p_units: r.unitsUsed, p_add: { competitors: r.unitsUsed } })])
    expect(r.unitsUsed).toBe(4)
  })
  it('a sincronização que falha também grava o que gastou', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [ROW1] })
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page(), 500), ...quiet })).rejects.toThrow()
    expect(rpcCalls(db, 'youtube_quota_add')).toEqual([expect.objectContaining({ p_units: 1 })])
  })
  it('a gravação da cota falhando não derruba a sincronização, e o resultado diz quotaError', async () => {
    setup({ lastDaily: '2026-10-24', existing: [ROW1], rpcFail: 'youtube_quota_add' })
    expect(await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page()), ...quiet })).toMatchObject({ quotaError: true })
  })
})
```

- [ ] **Step 2:** rodar os três → FAIL.

- [ ] **Step 3: implementar.** `apps/web/src/lib/youtube/competitor-quota.ts`:

```ts
// Observatório A5 (E1): as unidades da Data API gastas com os concorrentes, somadas na linha do dia.
import type { SupabaseClient } from '@supabase/supabase-js'

const PACIFIC = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' })
/** O dia em que a cota do YouTube zera: meia-noite do Pacífico (o fuso acompanha o horário de verão de lá). */
export const pacificDate = (ms: number): string => PACIFIC.format(new Date(ms))

/**
 * Soma numa instrução só (insert … on conflict do update, dentro de youtube_quota_add): dois disparos ao mesmo tempo
 * resultam na soma dos dois. Lança em erro; quem chama decide o que fazer (o sync segue e marca quotaError).
 */
export async function recordQuota(sb: SupabaseClient, p: { siteId: string; nowMs: number; units: number; mode: string; cut?: number }): Promise<void> {
  if (p.units <= 0 && !p.cut) return
  const { error } = await sb.rpc('youtube_quota_add', {
    p_site_id: p.siteId, p_day: pacificDate(p.nowMs), p_units: p.units, p_add: { [p.mode]: p.units },
    p_max: p.cut ? { teto_diario_cortados: p.cut } : {},
  })
  if (error) throw new Error('cota: ' + (error.message ?? 'erro do banco'))
}
```

`apps/web/src/lib/youtube/competitor-health.ts`:

```ts
// Observatório A5 (E1 e E2): a guarda de schema e (Tarefa 12) a prova embutida da coleta.
import type { SupabaseClient } from '@supabase/supabase-js'

const E1: Array<[string, string]> = [
  ['competitor_videos', 'miss_streak, miss_first_at, missing_since, last_seen_at, views_hidden, discovered_at'],
  ['competitor_channels', 'miss_streak, last_seen_at, custom_url'],
  ['competitor_field_versions', 'id'],
  ['competitor_raw', 'id'],
]
const E2: Array<[string, string]> = [
  ['competitor_videos', 'series_tier, series_tier_since, daily_until'],
  ['competitor_video_tier_spans', 'video_id'],
  ['competitor_video_early', 'video_id'],
]
/**
 * O código da E1 e da E2 grava colunas e tabelas novas. Sem a migration, parte dessas gravações falharia sem ninguém
 * ver; por isso o cron pergunta antes e para em vermelho. null = pronto.
 */
export async function schemaReady(sb: SupabaseClient, need: 'e1' | 'e1e2'): Promise<string | null> {
  for (const [name, list] of [['MG1', E1], ...(need === 'e1e2' ? [['MG2', E2]] : [])] as Array<[string, Array<[string, string]>]>) {
    for (const [table, cols] of list) {
      const { error } = await sb.from(table).select(cols).limit(1)
      if (error) return 'migration ' + name + ' não aplicada (' + table + '): ' + (error.message ?? 'erro do banco') + '. Nada foi gravado.'
    }
  }
  return null
}
```

Em `competitor-sync.ts`: importe `recordQuota`; `SyncResult` ganha `quotaError?: true`. Imediatamente antes do `return` de sucesso:

```ts
    let quotaError = false
    try { await recordQuota(supabase, { siteId: channelRow.site_id, nowMs, units: unitsUsed, mode: 'competitors' }) } catch { quotaError = true }
```

e `...(quotaError ? { quotaError: true as const } : {})` no objeto devolvido. No `catch (error)` do fim, antes de `throw error`: `await recordQuota(supabase, { siteId: channelRow.site_id, nowMs, units: unitsUsed, mode: 'competitors' }).catch(() => undefined)` (o canal já está em erro; a prova da Tarefa 12 acusa a linha do dia em 0).

Em `route.ts`, no ramo `if (mode === 'competitors') {`, antes de `let result: BatchResult`:

```ts
      const notReady = await schemaReady(supabase, 'e1')
      if (notReady) {
        await recordCronFailure('sync-youtube-competitors', notReady)
        return { status: 'error' as const, mode: 'competitors', error: notReady, health_written: true }
      }
```

(importe `schemaReady` de `@/lib/youtube/competitor-health`).

Os testes da rota que já existem trocam o lote inteiro por um falso; agora a rota também chama a guarda. Em `test/youtube/cron-competitors-invalidate.test.ts` (e em `cron-route.test.ts` e `test/api/cron/sync-youtube.test.ts`, se exercitarem `mode=competitors`), acrescente junto dos outros `vi.mock`:

```ts
vi.mock('@/lib/youtube/competitor-health', () => ({ schemaReady: vi.fn(async () => null), readSiteHealth: vi.fn(async () => ({ ok: true, problems: [], notes: [] })) }))
```

E crie `apps/web/test/youtube/cron-competitors-prova.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn(() => ({})) }))
vi.mock('@/lib/logger', () => ({
  withCronLock: vi.fn((_sb: unknown, _key: unknown, _runId: unknown, _job: unknown, fn: () => Promise<{ status: string; [k: string]: unknown }>) =>
    fn().then(r => { const { status, ...extra } = r; return Response.json(extra, { status: status === 'error' ? 500 : 200 }) })),
  newRunId: vi.fn(() => 'run-1'),
}))
vi.mock('@/lib/youtube/sync', () => ({ syncChannel: vi.fn(), YouTubeQuotaError: class extends Error {} }))
vi.mock('@/lib/cron-health', () => ({ recordCronSuccess: vi.fn(), recordCronFailure: vi.fn() }))
vi.mock('@/lib/youtube/competitor-sync-batch', () => ({ runCompetitorBatch: vi.fn(), batchHealth: vi.fn(() => ({ ok: true })), BATCH_BUDGET_MS: 200_000 }))
vi.mock('@/lib/youtube/competitor-health', () => ({ schemaReady: vi.fn(), readSiteHealth: vi.fn() }))

import { GET } from '@/app/api/cron/sync-youtube/route'
import { revalidateTag } from 'next/cache'
import { runCompetitorBatch, batchHealth } from '@/lib/youtube/competitor-sync-batch'
import { schemaReady, readSiteHealth } from '@/lib/youtube/competitor-health'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'

const req = () => new NextRequest('http://localhost/api/cron/sync-youtube?mode=competitors', { headers: { authorization: 'Bearer test-secret' } })

describe('cron de concorrentes: guarda de schema', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key') })
  it('migration ausente: para antes do lote, grava a falha com o texto, não invalida nada', async () => {
    vi.mocked(schemaReady).mockResolvedValue('migration MG1 não aplicada (competitor_videos): column does not exist. Nada foi gravado.')
    const res = await GET(req())
    expect(res.status).toBe(500)
    expect(vi.mocked(runCompetitorBatch)).not.toHaveBeenCalled()
    expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith('sync-youtube-competitors', 'migration MG1 não aplicada (competitor_videos): column does not exist. Nada foi gravado.')
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled()
    expect((await res.json()).error).toMatch(/MG1/)
  })
  it('a guarda pergunta pelo que a etapa em produção precisa', async () => {
    vi.mocked(schemaReady).mockResolvedValue('x')
    await GET(req())
    expect(vi.mocked(schemaReady)).toHaveBeenCalledWith(expect.anything(), 'e1') // a Tarefa 13 troca para 'e1e2'
  })
})
```

(`batchHealth` e `readSiteHealth` já são importados aqui porque a Tarefa 13 acrescenta testes a este arquivo; se o lint reclamar de importação sem uso, prefixe com `void batchHealth; void readSiteHealth` até lá.)

- [ ] **Step 4:** rodar: `npx vitest run test/youtube/competitor-quota.test.ts test/youtube/competitor-health.test.ts test/youtube/competitor-sync-a5.test.ts test/youtube/cron-competitors-invalidate.test.ts test/youtube/cron-competitors-prova.test.ts test/youtube/cron-route.test.ts test/api/cron/sync-youtube.test.ts 2>&1 | tail -12` e o comando da regra → verde.

- [ ] **Step 5: commit** (`feat: cota dos concorrentes somada na linha do dia do Pacífico, e guarda de schema no cron (A5 E1)`), com `-- apps/web/src/lib/youtube apps/web/src/app/api/cron/sync-youtube/route.ts apps/web/test`.

**Pronto quando:** item 10 e a parte unitária do 224 passam (a concorrência está na Tarefa 1); sem a migration, o cron para em vermelho e não chama o lote. **A E1 está completa aqui:** os commits das Tarefas 1 a 9 formam um conjunto que pode ir a produção só com a MG1.

### Task 10: sincronização (E2): ler todos os vídeos, classificar a faixa, e a passada diária pela faixa

**Files:**
- Modify: `apps/web/src/lib/youtube/competitor-sync.ts`, `apps/web/test/youtube/competitor-sync-harness.ts`
- Test: `apps/web/test/youtube/competitor-sync-a5.test.ts`; `apps/web/test/youtube/competitor-sync.test.ts` (quatro testes reescritos)

**Interfaces:**
- Consumes: `classifyTiers`, `type Tier` (Tarefa 5); `apply_competitor_tier_plan` (Tarefa 1).
- Produces: dentro de `syncCompetitorChannel`: `type FullRow`, `loadAll(): Promise<FullRow[]>`, `all: FullRow[]`, `tierPlan`, `byId: Map<string, FullRow>`, `outOfProof(r: FullRow): boolean`. `loadTracked` e `loadPinned` deixam de existir. `SyncResult` ganha `tierChanges?`, `cutByCap?`. O falso ganha `all?` e `allError?`.

- [ ] **Step 1: o falso responde à leitura de todos os vídeos.** Em `setup`, opções `all?: Record<string, unknown>[]`, `allPages?: Record<string, unknown>[][]`, `allError?: string` e `videoLimit?: number`. A linha da trava passa a devolver `{ data: [{ ...lockRow, video_limit: opts.videoLimit ?? lockRow.video_limit }] }` (com poucos vídeos e o limite 50, todos seriam "os N mais recentes": os testes de faixa semanal usam `videoLimit: 1`). E, **como primeira linha de `competitor_videos` no roteiro**:

```ts
    if (c.table === 'competitor_videos' && first(c) === 'select' && c.ops.some(o => o[0] === 'range')) {
      if (opts.allError) return { data: null, error: { message: opts.allError } }
      if (opts.allPages) return { data: opts.allPages[(c.ops.find(o => o[0] === 'range')![1][0] as number) / 1000] ?? [] }
      if (opts.all) return { data: opts.all }
      // sem `all`: monta o canal a partir de `tracked` (recentes, uma hora de diferença entre eles) e `pinned` (antigos), que é como os
      // testes antigos o descrevem; o que `existing` sabe da mesma linha (last_seen_at, missing_since, discovered_at) entra junto
      const known = new Map((opts.existing ?? []).map(e => [e.id, e]))
      const tr = (opts.tracked ?? [{ id: 'v-1', video_id: 'vid-1', title: null, thumbnail_url: null }]).map((r, i) => ({ published_at: new Date(NOW.getTime() - (i + 1) * 3_600_000).toISOString(), pinned_at: null, ...(known.get(r.id) ?? {}), ...r }))
      const seenIds = new Set(tr.map(r => r.id))
      const pinnedIds = new Set((opts.pinned ?? []).map(p => p.id))
      const pin = (opts.pinned ?? []).filter(p => !seenIds.has(p.id)).map(p => ({ published_at: new Date(NOW.getTime() - 400 * 86_400_000).toISOString(), pinned_at: '2026-10-01T00:00:00.000Z', ...p }))
      return { data: [...tr.map(r => (pinnedIds.has(r.id) ? { ...r, pinned_at: '2026-10-01T00:00:00.000Z' } : r)), ...pin] }
    }
```

As linhas antigas de `not` (fixados) e `limit` (acompanhados) ficam no roteiro até o fim desta tarefa e são apagadas no Step 5.

- [ ] **Step 2: testes que falham:**

```ts
describe('A5 E2: faixas da série', () => {
  const DAY = 86_400_000
  const row = (i: number, ageDays: number, over: Record<string, unknown> = {}) => ({ id: 'v-' + i, video_id: 'vid-' + i, title: 'T' + i, thumbnail_url: null, published_at: new Date(NOW.getTime() - ageDays * DAY).toISOString(), pinned_at: null, daily_until: null, series_tier: null, series_tier_since: null, last_seen_at: null, missing_since: null, views_hidden: null, live_broadcast_content: null, discovered_at: null, ...over })
  const idsOf = (u: string) => decodeURIComponent(u.match(/[?&]id=([^&]*)/)![1]!).split(',')
  const echo = (_n: number, u: string) => idsOf(u).map(id => ({ id, snippet: { title: 'T' + id.slice(4) }, statistics: { viewCount: '5', likeCount: '1', commentCount: '0' }, contentDetails: { duration: 'PT10M' } }))
  it('item 222: toda sincronização classifica o canal inteiro e grava só o que mudou, numa chamada, com a data de São Paulo', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [], all: [row(1, 1), row(2, 400, { series_tier: 'diaria' }), row(3, 500)] }) // 3 vídeos e limite 50: os três são "os N mais recentes"
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(null), ...quiet })
    expect(rpcCalls(db, 'apply_competitor_tier_plan')).toEqual([{ p_site_id: 'site-1', p_channel_id: 'cc-1', p_changes: [{ video_id: 'v-1', tier: 'diaria' }, { video_id: 'v-3', tier: 'diaria' }], p_today: '2026-10-24' }])
    expect(r.tierChanges).toBe(2)
  })
  it('nada mudou de faixa: nenhuma chamada', async () => {
    const db = setup({ lastDaily: '2026-10-24', existing: [], all: [row(1, 1, { series_tier: 'diaria' })] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(null), ...quiet })
    expect(rpcCalls(db, 'apply_competitor_tier_plan')).toEqual([])
  })
  it('item 14: a passada diária pede todos os da faixa diária, inclusive os de até 30 dias fora dos N mais recentes; os semanais não', async () => {
    const all = [...Array.from({ length: 60 }, (_, i) => row(i + 1, i * 0.4)), row(900, 400)] // 60 em 24 dias, 1 antigo
    setup({ dailyHave: [], existing: [], all })
    const log = { dailyCalls: [] as string[] }
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo, log }), ...quiet, weekly: false })
    const asked = log.dailyCalls.flatMap(idsOf)
    expect(asked).toHaveLength(60)
    expect(asked).not.toContain('vid-900')
    expect(asked[0]).toBe('vid-1') // mais recente primeiro
    expect(r.dailyRecorded).toBe(60)
  })
  it('item 18: mais de 200 na regra diária → 200 pedidos, e o corte vai para o resultado e para a linha da cota', async () => {
    const all = Array.from({ length: 230 }, (_, i) => row(i + 1, i * 0.1))
    const db = setup({ dailyHave: [], existing: [], all })
    const log = { dailyCalls: [] as string[] }
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo, log }), ...quiet, weekly: false })
    expect(log.dailyCalls.flatMap(idsOf)).toHaveLength(200)
    expect(r.cutByCap).toBe(30)
    expect(rpcCalls(db, 'youtube_quota_add')[0]).toMatchObject({ p_max: { teto_diario_cortados: 30 } })
  })
  it('itens 13 e 225: vídeo sem contagem e estreia agendada continuam sendo pedidos, mas não mantêm a passada "devida" nem ganham linha de série; o resultado diz quantos ficaram fora', async () => {
    const all = [row(1, 1), row(2, 2, { views_hidden: true }), row(3, 0, { live_broadcast_content: 'upcoming' })]
    const db = setup({ dailyHave: ['v-1'], existing: [], all })
    const noCount = (_n: number, u: string) => idsOf(u).map(id => ({ id, snippet: { title: 'x' }, statistics: {}, contentDetails: {} }))
    const r = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: noCount }), ...quiet, weekly: false })
    expect(db.calls.some(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')).toBe(false)
    expect(r.excludedNoCount).toBe(2)
    expect(updatesOf(db, 'v-2').at(-1)).toMatchObject({ views_hidden: true, view_count: null })
  })
  it('erro na leitura dos vídeos do canal lança (nunca "canal sem vídeos") e o canal fica em erro', async () => {
    const db = setup({ allError: 'boom' })
    await expect(syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(null), ...quiet })).rejects.toThrow(/load channel videos: boom/)
    expect(db.calls.filter(c => c.table === 'competitor_channels').map(c => arg(c, 'update')).at(-1)).toMatchObject({ sync_status: 'error' })
  })
  it('canal com mais de 1.000 vídeos guardados: a leitura pagina até a página curta (nenhum corte em 1.000)', async () => {
    // 1.003 vídeos: os 3 novos e os 47 antigos mais recentes são "os 50 mais recentes"; os 47 já estão em diária, os outros 953 em semanal
    const big = Array.from({ length: 1000 }, (_, i) => row(i + 1, 400 + i, { series_tier: i < 47 ? 'diaria' : 'semanal' }))
    const db = setup({ lastDaily: '2026-10-24', existing: [], allPages: [big, [row(2001, 1), row(2002, 2), row(2003, 3)]] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(null), ...quiet })
    // duas leituras do canal por sincronização (antes da página e depois dela), cada uma em duas páginas
    expect(db.calls.filter(c => c.table === 'competitor_videos' && c.ops.some(o => o[0] === 'range')).map(c => c.ops.find(o => o[0] === 'range')![1])).toEqual([[0, 999], [1000, 1999], [0, 999], [1000, 1999]])
    expect(r.tierChanges).toBe(3) // só os 3 que ainda não tinham faixa
    expect(rpcCalls(db, 'apply_competitor_tier_plan')[0]!.p_changes as unknown[]).toHaveLength(3)
  })
})
```

- [ ] **Step 3:** rodar → FAIL.

- [ ] **Step 4: implementar.**

(a) Importe `classifyTiers, type Tier` de `@/lib/youtube/competitor-tiers`. `SyncResult` ganha `tierChanges?: number`, `cutByCap?: number`, `excludedNoCount?: number`. As opções de `syncCompetitorChannel` ganham `/** false = não roda a passada semanal (testes; e a tarefa serie_semanal da E16 a chama à parte). */ weekly?: boolean`.

(b) Troque `loadPinned` e `loadTracked` (e os comentários deles) por:

```ts
  /** Tudo o que o Observatório guarda deste canal: a base da faixa de cada vídeo, do "pedido e não veio" e da janela de cada mudança. */
  type FullRow = TrackedRow & {
    published_at: string | null; pinned_at: string | null; daily_until: string | null; series_tier: Tier | null; series_tier_since: string | null
    last_seen_at: string | null; missing_since: string | null; views_hidden: boolean | null; live_broadcast_content: string | null; discovered_at: string | null
  }
  const ALL_COLS = 'id, video_id, title, thumbnail_url, published_at, pinned_at, daily_until, series_tier, series_tier_since, last_seen_at, missing_since, views_hidden, live_broadcast_content, discovered_at'
  const PAGE = 1000 // max_rows do PostgREST: uma leitura maior viria cortada sem aviso, então pagina até a página curta
  /** Lança em erro de consulta: uma leitura que falha nunca é "canal sem vídeos". */
  const loadAll = async (): Promise<FullRow[]> => {
    const out: FullRow[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from('competitor_videos').select(ALL_COLS).eq('competitor_channel_id', channelRow.id).order('id').range(from, from + PAGE - 1)
      fail('load channel videos', error)
      const page = (data ?? []) as unknown as FullRow[]
      out.push(...page)
      if (page.length < PAGE) return out
    }
  }
  /** Fora das provas de série: sem contagem de views, estreia agendada, ou ausente. Continua sendo pedido (é como se descobre que voltou). */
  const outOfProof = (r: FullRow): boolean => r.views_hidden === true || r.live_broadcast_content === 'upcoming' || r.missing_since != null
  const classify = (rows: FullRow[]) => classifyTiers(
    rows.map(r => ({ id: r.id, publishedAt: r.published_at ? Date.parse(r.published_at) : null, pinned: r.pinned_at != null, dailyUntil: r.daily_until, tier: r.series_tier })),
    { videoLimit, nowMs, today: spDate(nowMs) })
```

(c) No começo do `try`, troque as linhas de `pinned = await loadPinned()` até o fim do `if (hourOk) { … }` por:

```ts
    let all = await loadAll()
    const byId = new Map<string, FullRow>()
    const index = (): void => {
      byId.clear()
      for (const r of all) {
        byId.set(r.id, r)
        if (!rowInfo.has(r.id)) rowInfo.set(r.id, { lastSeenAt: r.last_seen_at, weeklySince: r.series_tier === 'semanal' ? r.series_tier_since : null, missing: r.missing_since != null })
      }
    }
    index()
    pinned = all.filter(r => r.pinned_at != null)
    const pinnedUuids = new Set(pinned.map(p => p.id))
    let tierPlan = classify(all)
    let dailyDue = false
    if (hourOk) {
      const proof = tierPlan.daily.map(id => byId.get(id)!).filter(r => !outOfProof(r))
      dailyDue = needsBackfill || (await missingDaily(proof.map(r => r.id), snapDate)).length > 0
    }
```

(`noteRow`, da Tarefa 7, deixa de ser chamada nas leituras que saíram; no laço da página ela fica.)

(d) Logo depois do `do { … } while (nextPageToken)` da página:

```ts
    // ── A5 (E2): a faixa de cada vídeo, recalculada a cada sincronização, com os vídeos que a página acabou de inserir ──
    all = await loadAll()
    index()
    tierPlan = classify(all)
    if (tierPlan.changes.length) {
      const { error } = await supabase.rpc('apply_competitor_tier_plan', { p_site_id: channelRow.site_id, p_channel_id: channelRow.id, p_changes: tierPlan.changes, p_today: snapDate })
      fail('apply tier plan', error)
      for (const c of tierPlan.changes) { const r = byId.get(c.video_id); if (r) { r.series_tier = c.tier; r.series_tier_since = snapDate } }
    }
```

(e) Passada diária: troque `const tracked = await loadTracked()` por `const tracked = tierPlan.daily.map(id => byId.get(id)!)` e, dentro do `try` do lote, depois de `const rows = items.filter(…)…`, conte os que vieram sem contagem: declare `let excludedNoCount = 0` junto de `let dailyFailure`, e `excludedNoCount += items.length - rows.length` logo depois de montar `rows`.

(f) Cota e resultado: na chamada de sucesso a `recordQuota`, acrescente `cut: tierPlan.cut`; no `return`, `...(tierPlan.changes.length ? { tierChanges: tierPlan.changes.length } : {}), ...(tierPlan.cut ? { cutByCap: tierPlan.cut } : {}), ...(excludedNoCount ? { excludedNoCount } : {})`. (`tierPlan` e `excludedNoCount` precisam estar declarados fora do `if (hourOk)`.)

- [ ] **Step 5: os quatro testes antigos reescritos** (em `competitor-sync.test.ts`), e a limpeza do roteiro:

| Teste antigo | Vira |
|---|---|
| `daily record is ordered by published_at desc, nulls last` (afirmava a forma da consulta) | apague: a ordem é provada no teste puro (`classifyTiers`, Tarefa 5) e no "item 14" acima |
| `a consulta de fixados responde sem dado…: vale como nenhum fixado` | `a leitura dos vídeos do canal responde sem dado: vale como canal sem vídeos guardados, e o sync termina ok` (use `all: []`) |
| `erro na consulta de fixados lança…` e `erro na consulta dos N mais recentes lança…` | um só: `erro na leitura dos vídeos do canal lança e o canal fica em erro` (já está no arquivo novo: apague os dois) |

No roteiro do falso, apague as linhas de `not` e de `limit` de `competitor_videos` e as opções `pinnedError` e `trackedError`. Os testes antigos que passam `tracked` e `pinned` continuam valendo: o roteiro monta `all` a partir deles.

- [ ] **Step 6:** rodar o comando da regra, mais `npx vitest run test/youtube/competitor-video-limit.test.ts test/youtube/competitor-backfill.test.ts` → verde. Esses dois arquivos têm falso próprio: se quebrarem por falta da leitura com `range`, acrescente a resposta no falso deles.

- [ ] **Step 7: commit** (`feat: faixa de série de cada vídeo dos concorrentes (diária ou semanal), gravada no tempo; a passada diária segue a faixa (A5 E2)`).

**Pronto quando:** itens 14, 18, 222 (a parte da sincronização) e 225 passam; os testes antigos que descrevem o canal por `tracked` e `pinned` continuam verdes sem serem tocados.

### Task 11: sincronização (E2): a passada semanal, a promoção e as primeiras horas

**Files:**
- Modify: `apps/web/src/lib/youtube/competitor-sync.ts`, `apps/web/test/youtube/competitor-sync-harness.ts`
- Test: `apps/web/test/youtube/competitor-sync-a5.test.ts`

**Interfaces:**
- Consumes: `weeklyDue`, `shouldPromote`, `earlyEligible`, `addDays` (Tarefa 5); `RULES.series`, `RULES.promotion`; `tierPlan`, `byId`, `captureFetched`, `patchFetched` (Tarefas 6, 7 e 10).
- Produces: opção `weeklyAllowed?: () => boolean` de `syncCompetitorChannel` (o lote passa o relógio; ausente = sempre). `SyncResult` ganha `weeklyRecorded?`, `weeklyDeferred?`, `earlyRecorded?`, `promoted?`, `longWindowChanges?`. O falso ganha `recentDaily?`.

- [ ] **Step 1: o falso.** Opção `recentDaily?: Record<string, unknown>[]` e, **antes** da linha `competitor_video_daily` + `select` que já existe: `if (c.table === 'competitor_video_daily' && first(c) === 'select' && c.ops.some(o => o[0] === 'gte')) return { data: opts.recentDaily ?? [] }`. E `if (c.table === 'competitor_video_early' && first(c) === 'upsert') return { data: c.ops[0]![1][0] }`.

- [ ] **Step 2: testes que falham** (dentro de um `describe('A5 E2: passada semanal, promoção e primeiras horas', …)` que reaproveita `row`, `idsOf` e `echo` do `describe` da Tarefa 10; mova os três para o topo do arquivo). `slotDate(ytId)` devolve a data, a partir de `'2026-10-24'`, em que o vídeo cai no dia fixo; `at12(date)` devolve as 12:00 de São Paulo dessa data:

```ts
  const slotDate = (ytId: string) => { let d = '2026-10-24'; while (dayNumber(d) % 7 !== weekSlotOf(ytId)) d = addDays(d, 1); return d }
  const at12 = (date: string) => new Date(date + 'T15:00:00.000Z')
  const weeklyRow = (i: number, over: Record<string, unknown> = {}) => row(i, 400 + i, { series_tier: 'semanal', series_tier_since: '2026-09-01', ...over })
  const dailyRow = row(1, 1, { series_tier: 'diaria', series_tier_since: '2026-09-01' })

  it('OP-15: no dia fixo o vídeo semanal é lido na passada das 12:00, na mesma tabela da série, com a linha, os campos e o raw', async () => {
    const day = slotDate('vid-7')
    const db = setup({ dailyHave: ['v-1'], existing: [], videoLimit: 1, all: [dailyRow, weeklyRow(7)] })
    const log = { dailyCalls: [] as string[] }
    const r = await syncCompetitorChannel(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log }), ...quiet })
    expect(log.dailyCalls.flatMap(idsOf)).toEqual(['vid-7'])
    expect(arg(db.calls.find(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')!, 'upsert')).toEqual([{ video_id: 'v-7', snap_date: day, views: 5, likes: 1, comments: 0, taken_at: at12(day).toISOString() }])
    expect(r).toMatchObject({ weeklyRecorded: 1 })
    expect(r.dailyRecorded).toBe(0) // dailyRecorded continua contando só a faixa diária
    expect(updatesOf(db, 'v-7').some(u => u.view_count === 5)).toBe(true)
    expect(rpcCalls(db, 'apply_competitor_raw_plan').flatMap(a => a.p_open as Array<{ video_id: string }>).some(o => o.video_id === 'v-7')).toBe(true)
  })
  it('OP-15: fora do dia fixo e com ponto há menos de 7 dias, não é pedido; com 7 dias ou mais, é (mesmo fora do dia fixo)', async () => {
    const day = addDays(slotDate('vid-7'), 1)
    const log1 = { dailyCalls: [] as string[] }
    setup({ dailyHave: ['v-1'], existing: [], videoLimit: 1, all: [dailyRow, weeklyRow(7)], recentDaily: [{ video_id: 'v-7', snap_date: addDays(day, -6), views: 100 }] })
    await syncCompetitorChannel(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log: log1 }), ...quiet })
    expect(log1.dailyCalls).toEqual([])
    const log2 = { dailyCalls: [] as string[] }
    setup({ dailyHave: ['v-1'], existing: [], videoLimit: 1, all: [dailyRow, weeklyRow(7)], recentDaily: [{ video_id: 'v-7', snap_date: addDays(day, -7), views: 100 }] })
    await syncCompetitorChannel(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log: log2 }), ...quiet })
    expect(log2.dailyCalls.flatMap(idsOf)).toEqual(['vid-7'])
  })
  it('OP-15, D0: de 70 vídeos recém-classificados como semanais, só os do dia fixo de hoje são lidos (a carga se espalha)', async () => {
    const all = [dailyRow, ...Array.from({ length: 70 }, (_, i) => row(100 + i, 400 + i))] // sem faixa ainda: viram semanais nesta sincronização
    setup({ dailyHave: ['v-1'], existing: [], videoLimit: 1, all })
    const log = { dailyCalls: [] as string[] }
    await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo, log }), ...quiet })
    const asked = log.dailyCalls.flatMap(idsOf)
    expect(asked).toEqual(all.slice(1).filter(r => dayNumber('2026-10-24') % 7 === weekSlotOf(r.video_id as string)).map(r => r.video_id))
    expect(asked.length).toBeLessThan(30)
  })
  it('antes das 12:00 de São Paulo a passada semanal não roda', async () => {
    setup({ existing: [], videoLimit: 1, all: [dailyRow, weeklyRow(7)] })
    const log = { dailyCalls: [] as string[] }
    await syncCompetitorChannel(ch, 'k', { now: new Date(at12(slotDate('vid-7')).getTime() - 6 * 3_600_000), fetchImpl: apiFetch(null, 200, { daily: echo, log }), ...quiet })
    expect(log.dailyCalls).toEqual([])
  })
  it('Review Focus 4 e conta de cota: 50 diários e 34 semanais devidos → 2 lotes (5 chamadas no total); com o relógio fechado, o 1º lote sai (diários) e os semanais do 2º ficam adiados e contados', async () => {
    const day = '2026-10-24'
    const daily = Array.from({ length: 50 }, (_, i) => row(i + 1, i * 0.1, { series_tier: 'diaria', series_tier_since: '2026-09-01' }))
    const weekly = Array.from({ length: 400 }, (_, i) => weeklyRow(1000 + i)).filter(r => dayNumber(day) % 7 === weekSlotOf(r.video_id as string)).slice(0, 34)
    expect(weekly).toHaveLength(34)
    setup({ dailyHave: [], existing: [], all: [...daily, ...weekly] })
    const t = traced(apiFetch(null, 200, { daily: echo }))
    const open = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: t.f, ...quiet })
    expect(t.api().filter(u => u.startsWith('videos?'))).toHaveLength(2)
    expect(open.unitsUsed).toBe(4) // canal, lista de uploads (vazia), e 2 lotes; com vídeo na página seriam 5
    expect(open).toMatchObject({ dailyRecorded: 50, weeklyRecorded: 34 })
    setup({ dailyHave: [], existing: [], all: [...daily, ...weekly] })
    const t2 = traced(apiFetch(null, 200, { daily: echo }))
    const closed = await syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: t2.f, ...quiet, weeklyAllowed: () => false })
    expect(t2.api().filter(u => u.startsWith('videos?'))).toHaveLength(1)
    expect(closed).toMatchObject({ dailyRecorded: 50, weeklyDeferred: 34 })
    expect(closed.weeklyRecorded ?? 0).toBe(0)
  })
  it('item 17 (a): semanal que ganhou 1.000 views e 5% numa semana ganha daily_until = hoje + 28', async () => {
    const day = slotDate('vid-7')
    const db = setup({ dailyHave: ['v-1'], existing: [], videoLimit: 1, all: [dailyRow, weeklyRow(7)], recentDaily: [{ video_id: 'v-7', snap_date: addDays(day, -7), views: 4000 }] })
    const up = (_n: number, u: string) => idsOf(u).map(id => ({ id, snippet: { title: 'T7' }, statistics: { viewCount: '5000' }, contentDetails: {} }))
    const r = await syncCompetitorChannel(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: up }), ...quiet })
    const promo = db.calls.find(c => c.table === 'competitor_videos' && first(c) === 'update' && 'daily_until' in (arg(c, 'update') ?? {}))!
    expect(arg(promo, 'update')).toEqual({ daily_until: addDays(day, 28) })
    expect(promo.ops.find(o => o[0] === 'in')![1]).toEqual(['id', ['v-7']])
    expect(r.promoted).toBe(1)
  })
  it('item 17 (b): troca de título num vídeo semanal promove; a miniatura do semanal NÃO é sondada', async () => {
    const day = slotDate('vid-7')
    const lastSeen = new Date(at12(day).getTime() - 7 * 86_400_000).toISOString()
    const db = setup({ dailyHave: ['v-1'], existing: [], videoLimit: 1, all: [dailyRow, weeklyRow(7)], versions: [{ id: 'tv7', video_id: 'v-7', field: 'title', value_text: 'Antigo', value_hash: hashValue('Antigo'), thumb_etag: null, thumb_dhash: null, last_seen_at: lastSeen }] })
    const r = await syncCompetitorChannel(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }), ...quiet })
    expect(r.changesDetected).toBe(1)
    expect(r.promoted).toBe(1)
    expect(vi.mocked(probeThumb)).not.toHaveBeenCalled()
  })
  it('janela longa: troca num semanal cuja última leitura tem mais de 8 dias vira versão (com a janela honesta), mas não vira aviso, nem linha de mudança, nem promoção', async () => {
    const day = slotDate('vid-7')
    const lastSeen = new Date(at12(day).getTime() - 60 * 86_400_000).toISOString()
    const db = setup({ dailyHave: ['v-1'], existing: [], videoLimit: 1, all: [dailyRow, weeklyRow(7)], versions: [{ id: 'tv7', video_id: 'v-7', field: 'title', value_text: 'Antigo', value_hash: hashValue('Antigo'), thumb_etag: null, thumb_dhash: null, last_seen_at: lastSeen }] })
    const r = await syncCompetitorChannel(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }), ...quiet })
    const plan = rpcs(db).find(p => p.p_video_id === 'v-7')!
    expect(plan.p_close).toEqual(['tv7'])
    expect(plan.p_open.find(o => o.field === 'title')).toMatchObject({ window_start: lastSeen })
    expect(plan.p_changes).toEqual([])
    expect(r).toMatchObject({ changesDetected: 0, longWindowChanges: 1 })
    expect(r.promoted ?? 0).toBe(0)
  })
  it('item 16: vídeo descoberto até 24 h depois de publicado ganha uma leitura por sincronização enquanto tiver menos de 72 h; os outros, nenhuma', async () => {
    const H = 3_600_000, iso = (ms: number) => new Date(ms).toISOString()
    const fresh = { ...ROW1, discovered_at: iso(EARLY.getTime() - 5 * H), published_at: iso(EARLY.getTime() - 10 * H) }
    const db = setup({ lastDaily: '2026-10-24', existing: [fresh] })
    const r = await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, publishedAt: fresh.published_at } })), ...quiet })
    expect(arg(db.calls.find(c => c.table === 'competitor_video_early')!, 'upsert')).toEqual([{ video_id: 'v-1', taken_at: EARLY.toISOString(), site_id: 'site-1', views: 7, likes: 1, comments: 2 }])
    expect(r.earlyRecorded).toBe(1)
    for (const late of [{ ...fresh, discovered_at: null }, { ...fresh, published_at: iso(EARLY.getTime() - 80 * H) }, { ...fresh, discovered_at: iso(EARLY.getTime() - 5 * H), published_at: iso(EARLY.getTime() - 40 * H) }]) {
      const d2 = setup({ lastDaily: '2026-10-24', existing: [late] })
      await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, publishedAt: late.published_at } })), ...quiet })
      expect(d2.calls.some(c => c.table === 'competitor_video_early')).toBe(false)
    }
  })
  it('vídeo novo, descoberto agora com 3 h de vida: a primeira leitura das primeiras horas é a da descoberta', async () => {
    const pub = new Date(EARLY.getTime() - 3 * 3_600_000).toISOString()
    const db = setup({ lastDaily: '2026-10-24', existing: [] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, publishedAt: pub } })), ...quiet })
    expect(arg(db.calls.find(c => c.table === 'competitor_video_early')!, 'upsert')).toEqual([expect.objectContaining({ video_id: 'v-new', views: 7 })])
  })
  it('primeiras horas sem contagem de views: nenhuma linha (a coluna é not null), e nada lança', async () => {
    const fresh = { ...ROW1, discovered_at: new Date(EARLY.getTime() - 3_600_000).toISOString(), published_at: new Date(EARLY.getTime() - 2 * 3_600_000).toISOString() }
    const db = setup({ lastDaily: '2026-10-24', existing: [fresh] })
    await syncCompetitorChannel(ch, 'k', { now: EARLY, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, publishedAt: fresh.published_at }, statistics: {} })), ...quiet })
    expect(db.calls.some(c => c.table === 'competitor_video_early')).toBe(false)
  })
```

(importe `dayNumber`, `addDays`, `weekSlotOf` de `@/lib/youtube/competitor-tiers`, `hashValue` de `@/lib/youtube/competitor-versions` e `rpcs` do arquivo de apoio.)

- [ ] **Step 3:** rodar → FAIL.

- [ ] **Step 4: implementar.**

(a) Importações: `weeklyDue, shouldPromote, earlyEligible, addDays` de `competitor-tiers`; `RULES` de `@/lib/youtube/observatorio/rules`. Opções: `weeklyAllowed?: () => boolean`. `SyncResult`: `weeklyRecorded?`, `weeklyDeferred?`, `earlyRecorded?`, `promoted?`, `longWindowChanges?`.

(b) Estado, junto dos outros: `const promote = new Set<string>()`, `let longWindowChanges = 0`, `let weeklyRecorded = 0, weeklyDeferred = 0, earlyRecorded = 0`, `const weeklyIds = new Set<string>()`.

(c) `reconcileVideo` ganha um último parâmetro `w: { weekly: boolean } = { weekly: false }`:
- no começo: se `w.weekly`, não sonda (`probe = null`, `action = 'skip'`): envolva o `try { probe = await probeThumb(…) }` em `if (!w.weekly) { … }`. A miniatura de vídeo semanal não é conferida nem arquivada (decisão 1 da seção 1 do plano; spec 4.2).
- depois de `const plan = dropFields(rawPlan, current, skip)`, troque `const plan` por `let plan` e acrescente:

```ts
    if (w.weekly && plan.changes.length) {
      // Um vídeo semanal é visto a cada 7 dias. Se a versão anterior foi vista há mais de 8, a coleta ficou parada (ou o vídeo
      // nunca tinha sido relido): a versão nova é gravada com a janela verdadeira, mas não é "troca desta semana": não avisa,
      // não entra em competitor_changes e não promove (sem ponto antes, não há efeito a medir).
      const floor = nowMs - RULES.series.weeklyMaxGapDays * 86_400_000
      const recent = plan.changes.filter(c => c.window_start != null && Date.parse(c.window_start) >= floor)
      longWindowChanges += plan.changes.length - recent.length
      plan = { ...plan, changes: recent }
      if (recent.length) promote.add(videoUuid)
    }
```

- `reconcileFetched` não muda de assinatura: dentro dela, a chamada passa a ser `await reconcileVideo(row.id, it.id, { … }, currentMap.get(row.id) ?? [], touch, { weekly: weeklyIds.has(row.id) })` (a função decide por vídeo).

(d) Primeiras horas, no laço da página. O `select` de `existingVideos` ganha `, discovered_at, published_at`. Declare `const earlyRows: Array<{ video_id: string; taken_at: string; site_id: string; views: number; likes: number | null; comments: number | null }> = []` junto de `pagePairs`; dentro do laço, depois de resolvido `videoUuid`:

```ts
        const discoveredAt = existing ? ((existing as { discovered_at?: string | null }).discovered_at ?? null) : nowIso
        if (videoUuid && observed.hasViews && earlyEligible({ discoveredAt, publishedAt }, nowMs)) {
          earlyRows.push({ video_id: videoUuid, taken_at: nowIso, site_id: channelRow.site_id, views: observed.patch.view_count as number, likes: observed.patch.like_count ?? null, comments: observed.patch.comment_count ?? null })
        }
```

e, antes de `await captureFetched(pagePairs)`:

```ts
      if (earlyRows.length) {
        const { error } = await supabase.from('competitor_video_early').upsert(earlyRows, { onConflict: 'video_id,taken_at', ignoreDuplicates: true })
        fail('record early views', error)
        earlyRecorded += earlyRows.length
      }
```

(e) A passada. Acrescente, junto de `missingDaily`:

```ts
  /** O ponto mais recente de cada vídeo nos últimos 8 dias. 100 ids × até 9 datas = 900 linhas: abaixo do corte de 1.000. */
  const loadRecentPoints = async (uuids: string[], today: string): Promise<Map<string, { date: string; views: number }>> => {
    const out = new Map<string, { date: string; views: number }>()
    const from = addDays(today, -RULES.series.weeklyMaxGapDays)
    for (let i = 0; i < uuids.length; i += 100) {
      const { data, error } = await supabase.from('competitor_video_daily').select('video_id, snap_date, views').in('video_id', uuids.slice(i, i + 100)).gte('snap_date', from).order('snap_date', { ascending: true })
      fail('load recent points', error)
      const rows = (data ?? []) as unknown as Array<{ video_id: string; snap_date: string; views: number }>
      if (rows.length >= 1000) throw new Error('load recent points: 1000 linhas ou mais numa leitura (corte do PostgREST)')
      for (const r of rows) out.set(r.video_id, { date: r.snap_date, views: Number(r.views) }) // ordem crescente: fica o mais recente
    }
    return out
  }
```

Dentro do `if (hourOk) {` da passada diária, troque as três linhas que montam `tracked`, `missing` e `todo` por:

```ts
      const tracked = tierPlan.daily.map(id => byId.get(id)!)
      const missing = new Set(await missingDaily(tracked.map(t => t.id), snapDate))
      const dailyTodo = tracked.filter(t => missing.has(t.id))
      // ── A5 (E2, OP-15): os semanais devidos HOJE entram nos mesmos lotes de 50, depois dos diários ──
      let weeklyTodo: FullRow[] = []
      let recentPoints = new Map<string, { date: string; views: number }>()
      if (opts.weekly !== false && tierPlan.weekly.length) {
        const weeklyRows = tierPlan.weekly.map(id => byId.get(id)!)
        recentPoints = await loadRecentPoints(weeklyRows.map(r => r.id), snapDate)
        weeklyTodo = weeklyRows.filter(r => weeklyDue({ ytId: r.video_id, lastPoint: recentPoints.get(r.id)?.date ?? null, tierSince: r.series_tier_since }, snapDate))
        for (const r of weeklyTodo) weeklyIds.add(r.id)
      }
      const todo: FullRow[] = [...dailyTodo, ...weeklyTodo]
```

No laço `for (let i = 0; i < todo.length; i += 50)`, como primeira coisa do corpo:

```ts
        const chunk = todo.slice(i, i + 50)
        // Um lote só de semanais só começa enquanto o relógio do disparo permite; o que fica é devido pelo próprio dado
        // (dia fixo ainda hoje, na faixa das 18:00; ou 7 dias desde o último ponto, amanhã) e é contado, nunca descartado em silêncio.
        if (chunk.every(c => weeklyIds.has(c.id)) && opts.weeklyAllowed && !opts.weeklyAllowed()) { weeklyDeferred += todo.length - i; break }
```

(apague a linha antiga `const chunk = todo.slice(i, i + 50)`). Depois do `upsert` que grava `rows`, troque `dailyRecorded += (inserted ?? []).length` por:

```ts
            for (const r of (inserted ?? []) as Array<{ video_id: string }>) {
              if (!weeklyIds.has(r.video_id)) { dailyRecorded++; continue }
              weeklyRecorded++
              const now = rows.find(x => x.video_id === r.video_id)
              if (now && shouldPromote(recentPoints.get(r.video_id) ?? null, { views: now.views }, snapDate)) promote.add(r.video_id)
            }
```

A chamada `await reconcileFetched(items, byYt)` fica como está. Depois do laço dos lotes, antes de `if (dailyRecorded > 0) {`:

```ts
      if (promote.size) {
        const { error } = await supabase.from('competitor_videos').update({ daily_until: addDays(snapDate, RULES.promotion.days) }).in('id', [...promote])
        fail('promote to daily', error)
      }
```

A condição `if (dailyRecorded > 0)` do começo da série passa a `if (dailyRecorded + weeklyRecorded > 0)`.

(f) Resultado: `...(weeklyRecorded ? { weeklyRecorded } : {}), ...(weeklyDeferred ? { weeklyDeferred } : {}), ...(earlyRecorded ? { earlyRecorded } : {}), ...(promote.size ? { promoted: promote.size } : {}), ...(longWindowChanges ? { longWindowChanges } : {})`. (As variáveis ficam declaradas fora do `if (hourOk)`.)

- [ ] **Step 5:** rodar o comando da regra → verde. **Step 6: commit** (`feat: passada semanal devida pelo próprio dado, promoção por 28 dias e primeiras horas na coleta de concorrentes (A5 E2, OP-15)`).

**Pronto quando:** os cinco casos da OP-15, os itens 16 e 17 e o Review Focus 4 passam; a conta de chamadas (2 lotes para 50 diários e 34 semanais) está presa por teste; nenhuma sonda de miniatura para vídeo semanal.

### Task 12: a prova embutida (o que o cron lê do banco a cada disparo)

**Files:**
- Modify: `apps/web/src/lib/youtube/competitor-health.ts`
- Test: `apps/web/test/youtube/competitor-health.test.ts`

**Interfaces:**
- Consumes: `competitor_capture_health`, `competitor_series_health` (Tarefa 1).
- Produces:

```ts
export interface CaptureHealth { videos_vistos_sem_raw: number; canais_vistos_sem_raw: number; canais_vistos_dia_pacifico: number; cota_dia_pacifico: number; videos_ausentes: number; canais_ausentes: number; canais_em_erro_12h: number }
export interface SeriesHealth { hoje: string; hora_sp: number; fora_da_prova: number; sem_faixa: number; diaria_sem_ponto_hoje: number; diaria_buracos_3d: number; semanal_atrasados: number; diaria_total: number; semanal_total: number }
export interface HealthVerdict { ok: boolean; problems: string[]; notes: string[] }
export function parseCaptureHealth(data: unknown): CaptureHealth | null
export function parseSeriesHealth(data: unknown): SeriesHealth | null
/** `slotDone` = nenhum canal ficou devido nesta faixa (só então "sem ponto hoje" pode ser cobrado). */
export function healthVerdict(c: CaptureHealth | null, s: SeriesHealth | null, o: { slotDone: boolean; e2: boolean }): HealthVerdict
export async function readSiteHealth(sb: SupabaseClient, siteId: string, nowIso: string, o: { slotDone: boolean; e2: boolean }): Promise<HealthVerdict>
```

- [ ] **Step 1: testes que falham** (acrescentar a `competitor-health.test.ts`):

```ts
import { healthVerdict, parseCaptureHealth, parseSeriesHealth, readSiteHealth, type CaptureHealth, type SeriesHealth } from '@/lib/youtube/competitor-health'

const C: CaptureHealth = { videos_vistos_sem_raw: 0, canais_vistos_sem_raw: 0, canais_vistos_dia_pacifico: 15, cota_dia_pacifico: 200, videos_ausentes: 0, canais_ausentes: 0, canais_em_erro_12h: 0 }
const S: SeriesHealth = { hoje: '2026-06-10', hora_sp: 19, fora_da_prova: 0, sem_faixa: 0, diaria_sem_ponto_hoje: 0, diaria_buracos_3d: 0, semanal_atrasados: 0, diaria_total: 674, semanal_total: 716 }
const done = { slotDone: true, e2: true }

describe('healthVerdict', () => {
  it('tudo em ordem: ok, sem problema', () => {
    expect(healthVerdict(C, S, done)).toEqual({ ok: true, problems: [], notes: [] })
  })
  it('Review Focus 5: prova que não veio (nulo) é FALHA, nunca verde', () => {
    expect(healthVerdict(null, S, done)).toMatchObject({ ok: false, problems: ['não foi possível ler a prova da captura'] })
    expect(healthVerdict(C, null, done)).toMatchObject({ ok: false, problems: ['não foi possível ler a prova da série'] })
    expect(healthVerdict(C, null, { slotDone: true, e2: false }).ok).toBe(true) // só a E1 em produção: a prova da série não é cobrada
  })
  it.each([
    [{ videos_vistos_sem_raw: 3 }, '3 vídeos lidos sem resposta guardada'],
    [{ canais_vistos_sem_raw: 1 }, '1 canal lido sem resposta guardada'],
    [{ cota_dia_pacifico: 0 }, 'cota do dia não registrada (15 canais lidos)'],
    [{ canais_em_erro_12h: 2 }, '2 canais em erro há mais de 12 h'],
  ] as Array<[Partial<CaptureHealth>, string]>)('captura %j → %s', (over, msg) => {
    expect(healthVerdict({ ...C, ...over }, S, done)).toMatchObject({ ok: false, problems: [msg] })
  })
  it('cota em 0 sem nenhum canal lido no dia do Pacífico não é falha (nada foi gasto)', () => {
    expect(healthVerdict({ ...C, canais_vistos_dia_pacifico: 0, cota_dia_pacifico: 0 }, S, done).ok).toBe(true)
  })
  it.each([
    [{ sem_faixa: 4 }, '4 vídeos sem faixa de série'],
    [{ diaria_buracos_3d: 7 }, '7 buracos na série diária nos últimos 3 dias'],
    [{ semanal_atrasados: 2 }, '2 vídeos da faixa semanal sem ponto há mais de 8 dias'],
    [{ diaria_sem_ponto_hoje: 5 }, '5 vídeos da faixa diária sem ponto hoje'],
  ] as Array<[Partial<SeriesHealth>, string]>)('série %j → %s', (over, msg) => {
    expect(healthVerdict(C, { ...S, ...over }, done)).toMatchObject({ ok: false, problems: [msg] })
  })
  it('"sem ponto hoje" só é cobrado depois das 18:00 de São Paulo E com a faixa inteira tentada', () => {
    expect(healthVerdict(C, { ...S, diaria_sem_ponto_hoje: 5, hora_sp: 17 }, done).ok).toBe(true)
    expect(healthVerdict(C, { ...S, diaria_sem_ponto_hoje: 5 }, { slotDone: false, e2: true }).ok).toBe(true)
  })
  it('ausentes e fora da prova são nota (o dono vê o número), não falha', () => {
    expect(healthVerdict({ ...C, videos_ausentes: 2, canais_ausentes: 1 }, { ...S, fora_da_prova: 3 }, done)).toEqual({ ok: true, problems: [], notes: ['2 vídeos e 1 canal não vêm mais do YouTube', '3 fora da prova de série (sem contagem, estreia agendada ou ausente)'] })
  })
})
describe('parse', () => {
  it('objeto com todas as chaves numéricas passa; chave faltando, texto no lugar de número ou negativo → null (nunca 0 por palpite)', () => {
    expect(parseCaptureHealth(C)).toEqual(C)
    expect(parseCaptureHealth({ ...C, cota_dia_pacifico: undefined })).toBeNull()
    expect(parseCaptureHealth({ ...C, videos_ausentes: '2' })).toBeNull()
    expect(parseCaptureHealth(null)).toBeNull()
    expect(parseSeriesHealth(S)).toEqual(S)
    expect(parseSeriesHealth({ ...S, semanal_atrasados: -1 })).toBeNull()
    expect(parseSeriesHealth({ ...S, hoje: 5 })).toBeNull()
  })
})
describe('readSiteHealth', () => {
  const sbOf = (answers: Record<string, { data: unknown; error: { message: string } | null }>) => ({ rpc: (name: string) => Promise.resolve(answers[name] ?? { data: null, error: null }) }) as never
  it('lê as duas provas e devolve o veredito', async () => {
    expect(await readSiteHealth(sbOf({ competitor_capture_health: { data: C, error: null }, competitor_series_health: { data: { ...S, semanal_atrasados: 1 }, error: null } }), 's', '2026-06-10T22:00:00Z', done)).toMatchObject({ ok: false, problems: ['1 vídeo da faixa semanal sem ponto há mais de 8 dias'] })
  })
  it('erro do banco ou resposta vazia (o falso devolve data nula): falha', async () => {
    expect((await readSiteHealth(sbOf({ competitor_capture_health: { data: null, error: { message: 'boom' } } }), 's', '2026-06-10T22:00:00Z', done)).ok).toBe(false)
    expect((await readSiteHealth(sbOf({}), 's', '2026-06-10T22:00:00Z', done)).problems).toEqual(['não foi possível ler a prova da captura', 'não foi possível ler a prova da série'])
  })
  it('só a E1: não chama a prova da série', async () => {
    let asked = ''
    const sb = { rpc: (name: string) => { asked += name + ' '; return Promise.resolve({ data: C, error: null }) } } as never
    expect((await readSiteHealth(sb, 's', '2026-06-10T22:00:00Z', { slotDone: true, e2: false })).ok).toBe(true)
    expect(asked.trim()).toBe('competitor_capture_health')
  })
})
```

- [ ] **Step 2:** rodar → FAIL.

- [ ] **Step 3: implementar** (acrescentar a `competitor-health.ts`):

```ts
export interface CaptureHealth { videos_vistos_sem_raw: number; canais_vistos_sem_raw: number; canais_vistos_dia_pacifico: number; cota_dia_pacifico: number; videos_ausentes: number; canais_ausentes: number; canais_em_erro_12h: number }
export interface SeriesHealth { hoje: string; hora_sp: number; fora_da_prova: number; sem_faixa: number; diaria_sem_ponto_hoje: number; diaria_buracos_3d: number; semanal_atrasados: number; diaria_total: number; semanal_total: number }
export interface HealthVerdict { ok: boolean; problems: string[]; notes: string[] }

const CAPTURE_KEYS = ['videos_vistos_sem_raw', 'canais_vistos_sem_raw', 'canais_vistos_dia_pacifico', 'cota_dia_pacifico', 'videos_ausentes', 'canais_ausentes', 'canais_em_erro_12h'] as const
const SERIES_KEYS = ['hora_sp', 'fora_da_prova', 'sem_faixa', 'diaria_sem_ponto_hoje', 'diaria_buracos_3d', 'semanal_atrasados', 'diaria_total', 'semanal_total'] as const
const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0
const rec = (x: unknown): Record<string, unknown> | null => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null)

/** null = a prova não veio inteira. Uma contagem nunca é adivinhada como 0. */
export function parseCaptureHealth(data: unknown): CaptureHealth | null {
  const d = rec(data)
  if (!d || !CAPTURE_KEYS.every(k => isCount(d[k]))) return null
  return Object.fromEntries(CAPTURE_KEYS.map(k => [k, d[k]])) as unknown as CaptureHealth
}
export function parseSeriesHealth(data: unknown): SeriesHealth | null {
  const d = rec(data)
  if (!d || typeof d.hoje !== 'string' || !SERIES_KEYS.every(k => isCount(d[k]))) return null
  return { hoje: d.hoje, ...(Object.fromEntries(SERIES_KEYS.map(k => [k, d[k]])) as unknown as Omit<SeriesHealth, 'hoje'>) }
}

const n = (count: number, one: string, many: string) => count + ' ' + (count === 1 ? one : many)

/**
 * O veredito é lido do ESTADO do banco a cada disparo: uma perda fica vermelha até ser consertada (ou, no caso do
 * buraco de um dia, por 3 dias), e não some no disparo seguinte só porque nele não havia nada a fazer.
 */
export function healthVerdict(c: CaptureHealth | null, s: SeriesHealth | null, o: { slotDone: boolean; e2: boolean }): HealthVerdict {
  const problems: string[] = [], notes: string[] = []
  if (!c) problems.push('não foi possível ler a prova da captura')
  else {
    if (c.videos_vistos_sem_raw) problems.push(n(c.videos_vistos_sem_raw, 'vídeo lido', 'vídeos lidos') + ' sem resposta guardada')
    if (c.canais_vistos_sem_raw) problems.push(n(c.canais_vistos_sem_raw, 'canal lido', 'canais lidos') + ' sem resposta guardada')
    if (c.canais_vistos_dia_pacifico > 0 && c.cota_dia_pacifico === 0) problems.push('cota do dia não registrada (' + n(c.canais_vistos_dia_pacifico, 'canal lido', 'canais lidos') + ')')
    if (c.canais_em_erro_12h) problems.push(n(c.canais_em_erro_12h, 'canal', 'canais') + ' em erro há mais de 12 h')
    if (c.videos_ausentes || c.canais_ausentes) notes.push(n(c.videos_ausentes, 'vídeo', 'vídeos') + ' e ' + n(c.canais_ausentes, 'canal', 'canais') + ' não vêm mais do YouTube')
  }
  if (o.e2) {
    if (!s) problems.push('não foi possível ler a prova da série')
    else {
      if (s.sem_faixa) problems.push(n(s.sem_faixa, 'vídeo', 'vídeos') + ' sem faixa de série')
      if (s.diaria_buracos_3d) problems.push(n(s.diaria_buracos_3d, 'buraco', 'buracos') + ' na série diária nos últimos 3 dias')
      if (s.semanal_atrasados) problems.push(n(s.semanal_atrasados, 'vídeo', 'vídeos') + ' da faixa semanal sem ponto há mais de 8 dias')
      // só depois das 18:00 de São Paulo e com todos os canais da faixa tentados: antes disso faltar ponto é o esperado
      if (s.diaria_sem_ponto_hoje && s.hora_sp >= 18 && o.slotDone) problems.push(n(s.diaria_sem_ponto_hoje, 'vídeo', 'vídeos') + ' da faixa diária sem ponto hoje')
      if (s.fora_da_prova) notes.push(s.fora_da_prova + ' fora da prova de série (sem contagem, estreia agendada ou ausente)')
    }
  }
  return { ok: problems.length === 0, problems, notes }
}

export async function readSiteHealth(sb: SupabaseClient, siteId: string, nowIso: string, o: { slotDone: boolean; e2: boolean }): Promise<HealthVerdict> {
  const cap = await sb.rpc('competitor_capture_health', { p_site_id: siteId, p_now: nowIso })
  const ser = o.e2 ? await sb.rpc('competitor_series_health', { p_site_id: siteId, p_now: nowIso }) : null
  return healthVerdict(cap.error ? null : parseCaptureHealth(cap.data), !ser || ser.error ? null : parseSeriesHealth(ser.data), o)
}
```

O teste "1 vídeo da faixa semanal…" fixa o singular: confira que `n(1, 'vídeo', 'vídeos')` dá "1 vídeo".

- [ ] **Step 4:** `npx vitest run test/youtube/competitor-health.test.ts 2>&1 | tail -8 && npm run typecheck 2>&1 | tail -3` → PASS. **Step 5: commit** (`feat: prova embutida da coleta de concorrentes: o veredito lido do banco a cada disparo (A5 E1 e E2)`).

**Pronto quando:** o Review Focus 5 passa; cada frase de falha da tabela da seção 6 tem um teste com o texto exato.

### Task 13: o lote e a rota: a prova a cada disparo, os tetos de tempo, 75 canais

**Files:**
- Modify: `apps/web/src/lib/youtube/competitor-sync-batch.ts`, `apps/web/src/app/api/cron/sync-youtube/route.ts`
- Test: `apps/web/test/youtube/competitor-sync-batch.test.ts`, `apps/web/test/youtube/cron-competitors-invalidate.test.ts`, `apps/web/test/api/cron/sync-youtube.test.ts`, `apps/web/test/youtube/cron-route.test.ts`

**Interfaces:**
- Consumes: `readSiteHealth`, `schemaReady` (Tarefas 9 e 12); os campos novos de `SyncResult`.
- Produces:

```ts
export const BATCH_BUDGET_MS = 200_000     // depois disso o lote não começa canal novo
export const WEEKLY_CUTOFF_MS = 150_000    // depois disso nenhum lote só de semanais começa
export interface BatchTotals { unitsUsed: number; dailyRecorded: number; weeklyRecorded: number; weeklyDeferred: number; earlyRecorded: number; fieldsOpened: number; rawOpened: number; rawTooBig: number; missed: number; newlyMissing: number; returned: number; tierChanges: number; cutByCap: number; excludedNoCount: number; promoted: number; longWindowChanges: number; partsMissing: number; quotaErrors: number }
// BatchResult ganha: totals: BatchTotals; healthSiteIds: string[] (todo site com canal concorrente, lido ou não neste disparo)
export const COMPETITORS_MAX_DURATION_S = 300 // o mesmo número de `export const maxDuration` da rota (teste)
```

- [ ] **Step 1: testes que falham.** Em `competitor-sync-batch.test.ts`:

```ts
describe('A5: tetos de tempo do disparo (a conta presa)', () => {
  it('a ordem dos tetos: semanal < começar canal < backfill de Shorts < duração máxima da função, com 60 s de folga para o último canal', async () => {
    const { WEEKLY_CUTOFF_MS, BATCH_BUDGET_MS, BACKFILL_DEADLINE_MS, COMPETITORS_MAX_DURATION_S } = await import('@/lib/youtube/competitor-sync-batch')
    expect(WEEKLY_CUTOFF_MS).toBeLessThan(BATCH_BUDGET_MS)
    expect(BATCH_BUDGET_MS).toBeLessThan(BACKFILL_DEADLINE_MS)
    expect(BACKFILL_DEADLINE_MS).toBeLessThan(COMPETITORS_MAX_DURATION_S * 1000)
    // o último canal começa no máximo aos 200 s; o maior medido em produção leva 27 s (12/10/2026): cabem dois e sobra
    expect(COMPETITORS_MAX_DURATION_S * 1000 - BATCH_BUDGET_MS).toBeGreaterThanOrEqual(60_000 + 30_000)
  })
  it('a rota declara a mesma duração máxima', async () => {
    const src = (await import('node:fs')).readFileSync('src/app/api/cron/sync-youtube/route.ts', 'utf8')
    expect(src).toMatch(/export const maxDuration = 300\b/)
    expect(src).toMatch(/budgetMs: BATCH_BUDGET_MS/)
  })
})
describe('A5: o lote passa o relógio à passada semanal e soma os contadores', () => {
  const rowsOf = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 'c' + i, channel_id: 'UC' + i, site_id: i % 2 ? 's2' : 's1', last_synced_at: null, sync_status: 'idle' }))
  const mockAll = (sync: (r: { id: string }, key: string, o: { weeklyAllowed?: () => boolean }) => Promise<Record<string, unknown>>, rows: unknown[]) => {
    vi.resetModules()
    vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(sync) }))
    vi.doMock('@/lib/youtube/short-guard', () => ({ runControlProbe: vi.fn(async () => undefined), warnIfProbeBlocked: vi.fn() }))
    vi.doMock('@/lib/youtube/short-backfill', () => ({ reclassifyStoredShortsRoundRobin: vi.fn(async () => undefined) }))
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
  }
  it('weeklyAllowed é verdadeiro até 150 s do disparo e falso depois', async () => {
    let clock = 0
    const seenAllowed: boolean[] = []
    mockAll(async (_r, _k, o) => { seenAllowed.push(o.weeklyAllowed!()); clock += 80_000; return {} }, rowsOf(3))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    await runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: 200_000, now: () => clock })
    expect(seenAllowed).toEqual([true, true, false]) // 0 s, 80 s, 160 s
  })
  it('totals soma o que cada canal devolveu; healthSiteIds traz todo site com canal, mesmo sem canal devido', async () => {
    mockAll(async () => ({ unitsUsed: 4, dailyRecorded: 50, weeklyRecorded: 3, weeklyDeferred: 1, fieldsOpened: 10, rawOpened: 2, missed: 1, quotaError: true }), [...rowsOf(2), { id: 'x', channel_id: 'UCx', site_id: 's3', last_synced_at: new Date(Date.UTC(2026, 9, 24, 15, 1)).toISOString(), sync_status: 'idle' }])
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: 200_000, now: () => Date.UTC(2026, 9, 24, 15, 2) })
    expect(r.totals).toMatchObject({ unitsUsed: 8, dailyRecorded: 100, weeklyRecorded: 6, weeklyDeferred: 2, fieldsOpened: 20, rawOpened: 4, missed: 2, quotaErrors: 2, earlyRecorded: 0 })
    expect(r.healthSiteIds.sort()).toEqual(['s1', 's2', 's3'])
  })
  it('item 22: 75 canais a 20 s cada → 11 por disparo, o resto fica devido, e a faixa fecha em 7 disparos (menos que os 18 de uma faixa de 6 h), cada canal uma vez', async () => {
    const slot = Date.UTC(2026, 9, 24, 15, 0) // 12:00 de São Paulo
    const rows = rowsOf(75).map(r => ({ ...r, last_synced_at: new Date(slot - 6 * 3_600_000).toISOString() as string | null }))
    const count = new Map<string, number>()
    let clock = slot
    mockAll(async r => { count.set(r.id, (count.get(r.id) ?? 0) + 1); rows.find(x => x.id === r.id)!.last_synced_at = new Date(clock).toISOString(); clock += 20_000; return { unitsUsed: 4 } }, rows)
    const { runCompetitorBatch, BATCH_BUDGET_MS } = await import('@/lib/youtube/competitor-sync-batch')
    let runs = 0, remaining = 75
    while (remaining > 0 && runs < 18) {
      clock = slot + runs * 20 * 60_000
      const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: BATCH_BUDGET_MS, now: () => clock })
      if (runs === 0) expect(r).toMatchObject({ synced: 11, remainingDue: 64, stoppedForTime: true })
      remaining = r.remainingDue
      runs++
    }
    expect(runs).toBe(7)
    expect([...count.values()].every(v => v === 1)).toBe(true)
    expect(count.size).toBe(75)
  })
})
```

Em `cron-competitors-prova.test.ts` (criado na Tarefa 9), troque `'e1'` por `'e1e2'` no segundo teste e acrescente:

```ts
describe('cron de concorrentes: a prova lida a cada disparo', () => {
  const ZERO = { unitsUsed: 0, dailyRecorded: 0, weeklyRecorded: 0, weeklyDeferred: 0, earlyRecorded: 0, fieldsOpened: 0, rawOpened: 0, rawTooBig: 0, missed: 0, newlyMissing: 0, returned: 0, tierChanges: 0, cutByCap: 0, excludedNoCount: 0, promoted: 0, longWindowChanges: 0, partsMissing: 0, quotaErrors: 0 }
  const result = (o: Record<string, unknown> = {}) => ({ synced: 0, errors: 0, skipped: 0, remainingDue: 0, stoppedForTime: false, siteIds: [], healthSiteIds: ['s1'], totals: ZERO, ...o })
  const OK = { ok: true, problems: [], notes: [] }
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key')
    vi.mocked(schemaReady).mockResolvedValue(null)
    vi.mocked(batchHealth).mockReturnValue({ ok: true })
    vi.mocked(readSiteHealth).mockResolvedValue(OK)
  })
  it('sem nenhum canal devido a prova é lida do mesmo jeito, e um problema deixa o cron vermelho com o texto', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(result() as never)
    vi.mocked(readSiteHealth).mockResolvedValue({ ok: false, problems: ['2 vídeos da faixa semanal sem ponto há mais de 8 dias'], notes: ['3 fora da prova de série (sem contagem, estreia agendada ou ausente)'] })
    const body = await (await GET(req())).json()
    expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith('sync-youtube-competitors', 'série e captura: 2 vídeos da faixa semanal sem ponto há mais de 8 dias')
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
    expect(body.prova).toEqual({ ok: false, problems: ['2 vídeos da faixa semanal sem ponto há mais de 8 dias'], notes: ['3 fora da prova de série (sem contagem, estreia agendada ou ausente)'] })
    expect('healthSiteIds' in body).toBe(false)
    expect('siteIds' in body).toBe(false)
  })
  it('lote e prova em ordem: sucesso gravado, e a resposta traz os totais', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(result({ synced: 2, siteIds: ['s1'], totals: { ...ZERO, unitsUsed: 8, weeklyRecorded: 3 } }) as never)
    const body = await (await GET(req())).json()
    expect(vi.mocked(recordCronSuccess)).toHaveBeenCalledWith('sync-youtube-competitors', 'info')
    expect(vi.mocked(recordCronFailure)).not.toHaveBeenCalled()
    expect(body).toMatchObject({ mode: 'competitors', synced: 2, totals: { unitsUsed: 8, weeklyRecorded: 3 }, prova: { ok: true } })
  })
  it('uma prova por site com canal; "faixa inteira tentada" só quando não sobrou canal devido', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(result({ healthSiteIds: ['s1', 's2'], remainingDue: 4, stoppedForTime: true }) as never)
    await GET(req())
    expect(vi.mocked(readSiteHealth).mock.calls.map(c => [c[1], c[3]])).toEqual([['s1', { slotDone: false, e2: true }], ['s2', { slotDone: false, e2: true }]])
    vi.mocked(readSiteHealth).mockClear()
    vi.mocked(runCompetitorBatch).mockResolvedValue(result() as never)
    await GET(req())
    expect(vi.mocked(readSiteHealth).mock.calls[0]![3]).toEqual({ slotDone: true, e2: true })
  })
  it('lote com metade dos canais em erro E prova com problema: uma falha só, com os dois textos', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(result({ synced: 1, errors: 14 }) as never)
    vi.mocked(batchHealth).mockReturnValue({ ok: false, message: '14 of 15 channels failed' })
    vi.mocked(readSiteHealth).mockResolvedValue({ ok: false, problems: ['cota do dia não registrada (15 canais lidos)'], notes: [] })
    await GET(req())
    expect(vi.mocked(recordCronFailure).mock.calls).toEqual([['sync-youtube-competitors', '14 of 15 channels failed | série e captura: cota do dia não registrada (15 canais lidos)']])
  })
  it('a mensagem gravada nunca passa de 480 caracteres (cron_health corta em 500)', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(result() as never)
    vi.mocked(readSiteHealth).mockResolvedValue({ ok: false, problems: Array.from({ length: 40 }, (_, i) => 'problema número ' + i + ' com texto comprido'), notes: [] })
    await GET(req())
    const msg = vi.mocked(recordCronFailure).mock.calls[0]![1] as string
    expect(msg.length).toBe(480)
    expect(msg.endsWith('…')).toBe(true)
  })
  it('a prova que lança (banco fora) não vira verde: o cron falha', async () => {
    vi.mocked(runCompetitorBatch).mockResolvedValue(result() as never)
    vi.mocked(readSiteHealth).mockRejectedValue(new Error('rede'))
    await GET(req())
    expect(vi.mocked(recordCronSuccess)).not.toHaveBeenCalled()
    expect(vi.mocked(recordCronFailure)).toHaveBeenCalledWith('sync-youtube-competitors', expect.stringMatching(/não foi possível ler a prova/))
  })
})
```

Em `cron-competitors-invalidate.test.ts`, o auxiliar `result` ganha `healthSiteIds: []` e `totals` (o mesmo `ZERO`), e o `vi.mock` do lote ganha `BATCH_BUDGET_MS: 200_000`.

- [ ] **Step 2:** rodar → FAIL.

- [ ] **Step 3: implementar.** Em `competitor-sync-batch.ts`:

```ts
/** Depois disso o lote não começa canal novo. (Era o literal 200_000 da rota.) */
export const BATCH_BUDGET_MS = 200_000
/** Depois disso nenhum lote só de vídeos semanais começa: a série diária tem a preferência do relógio. */
export const WEEKLY_CUTOFF_MS = 150_000
/** A duração máxima da função do cron (`export const maxDuration` da rota). Um teste confere os dois. */
export const COMPETITORS_MAX_DURATION_S = 300

export interface BatchTotals { unitsUsed: number; dailyRecorded: number; weeklyRecorded: number; weeklyDeferred: number; earlyRecorded: number; fieldsOpened: number; rawOpened: number; rawTooBig: number; missed: number; newlyMissing: number; returned: number; tierChanges: number; cutByCap: number; excludedNoCount: number; promoted: number; longWindowChanges: number; partsMissing: number; quotaErrors: number }
const ZERO: BatchTotals = { unitsUsed: 0, dailyRecorded: 0, weeklyRecorded: 0, weeklyDeferred: 0, earlyRecorded: 0, fieldsOpened: 0, rawOpened: 0, rawTooBig: 0, missed: 0, newlyMissing: 0, returned: 0, tierChanges: 0, cutByCap: 0, excludedNoCount: 0, promoted: 0, longWindowChanges: 0, partsMissing: 0, quotaErrors: 0 }
```

`BatchResult` ganha `totals: BatchTotals` e `/** Todo site com canal concorrente, sincronizado ou não neste disparo: a prova é lida para todos. */ healthSiteIds: string[]`. Em `runCompetitorBatch`: `res` nasce com `totals: { ...ZERO }, healthSiteIds: [...new Set((data ?? []).map(r => r.site_id))]`; a chamada vira `syncCompetitorChannel(row, opts.apiKey, { probeBudget, deferBackfill: true, weeklyAllowed: () => now() - started < WEEKLY_CUTOFF_MS })`; e, no ramo que não é `skipped`:

```ts
        const t = res.totals, rr = r as Partial<Record<keyof BatchTotals, number>> & { quotaError?: boolean }
        for (const k of Object.keys(ZERO) as Array<keyof BatchTotals>) if (k !== 'quotaErrors' && typeof rr[k] === 'number') t[k] += rr[k]!
        if (rr.quotaError) t.quotaErrors++
```

(`cutByCap` é somado entre canais: é "vídeos cortados neste disparo", o que a resposta do cron mostra; o maior do dia fica na linha da cota.)

Em `route.ts`, no ramo `competitors`: a guarda vira `schemaReady(supabase, 'e1e2')`; `budgetMs: BATCH_BUDGET_MS` (importe); e, depois de `const health = batchHealth(result)`, troque o bloco que grava sucesso ou falha por:

```ts
      // A prova é lida do banco a CADA disparo (mesmo sem canal devido): uma perda fica vermelha até ser consertada.
      const nowIso = new Date().toISOString()
      const unread = { ok: false, problems: ['não foi possível ler a prova da captura e da série'], notes: [] as string[] }
      const verdicts = await Promise.all(result.healthSiteIds.map(siteId => readSiteHealth(supabase, siteId, nowIso, { slotDone: result.remainingDue === 0 && !result.stoppedForTime, e2: true }).catch(() => unread)))
      const prova = { ok: verdicts.every(v => v.ok), problems: verdicts.flatMap(v => v.problems), notes: verdicts.flatMap(v => v.notes) }
      const parts = [...(health.ok ? [] : [health.message ?? 'batch failed']), ...(prova.ok ? [] : ['série e captura: ' + prova.problems.join('; ')])]
      if (parts.length) {
        const msg = parts.join(' | ')
        await recordCronFailure('sync-youtube-competitors', msg.length > 480 ? msg.slice(0, 479) + '…' : msg)
      } else {
        await recordCronSuccess('sync-youtube-competitors', 'info')
      }
```

e, no `return`, tire `healthSiteIds` da resposta junto de `siteIds` (`const { siteIds, healthSiteIds: _h, ...summary } = result`) e acrescente `prova`. (`cron_health.last_error` é cortado em 500 caracteres mais adiante; por isso os 480.)

- [ ] **Step 4:** rodar: `npx vitest run test/youtube/competitor-sync-batch.test.ts test/youtube/cron-competitors-invalidate.test.ts test/youtube/cron-route.test.ts test/api/cron/sync-youtube.test.ts 2>&1 | tail -12` → verde. Os testes antigos do lote que comparam `BatchResult` inteiro com `toEqual` ganham `totals` e `healthSiteIds`.

- [ ] **Step 5: a suíte inteira, uma vez** (cerca de 160 s; saída para arquivo):

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run > /tmp/a5-e1e2-suite.txt 2>&1; grep -E "Test Files|Tests |FAIL" /tmp/a5-e1e2-suite.txt | head -20
```

Esperado: nenhuma falha que este plano tenha criado. Se houver falha em arquivo da A4 (`proprio-*`, `canal-*`), anote no ledger e não conserte aqui.

- [ ] **Step 6: commit** (`feat: cron de concorrentes lê a prova da coleta a cada disparo, corta a passada semanal pelo relógio e devolve os totais (A5 E1 e E2)`).

**Pronto quando:** item 22 e a conta de tempo estão presos por teste; a prova roda mesmo sem canal devido; a mensagem de falha cabe em `cron_health`.

### Task 14: ensaio local com a API real (nada medido só no falso)

Sem código de produção. Mede, com a API verdadeira do YouTube e o banco **local**, o que as Tarefas 6 a 11 custam, antes de qualquer push. Custo de cota: cerca de 12 unidades. **Nada aqui toca produção.**

**Files:**
- Create: `apps/web/scripts/a5-ensaio-sync.ts` (apagado no fim da tarefa; não é commitado)

- [ ] **Step 1: garantias antes de rodar.** O script roda com as variáveis do banco **local** (`npm run db:env` mostra quais; confira que `NEXT_PUBLIC_SUPABASE_URL` aponta para `127.0.0.1` ou `localhost`, e **aborte se não apontar**) e com `BLOB_READ_WRITE_TOKEN` **vazio** (o arquivamento de miniatura falha em silêncio e nada vai para o Blob de produção). A `YOUTUBE_API_KEY` é a de `.env.local` (só leitura da API).

- [ ] **Step 2: o script.** Faz, em ordem: (1) recusa rodar se a URL do banco não for local; (2) cria no banco local um site de teste e um canal concorrente com o `channel_id` do maior canal em produção (leia-o com `npx supabase db query --linked "select channel_id from competitor_channels order by (select count(*) from competitor_videos v where v.competitor_channel_id = competitor_channels.id) desc limit 1"`), `sync_mode = 'full'`, `video_limit = 50`; (3) roda `syncCompetitorChannel` uma vez às 06:00 de São Paulo simuladas (`opts.now`) para encher o catálogo (modo `full`, até 2.000 vídeos: é o custo de entrada, não é o que se mede); (4) roda de novo com `opts.now` às 12:00 de São Paulo do mesmo dia (D0: classifica, passada diária, semanais do dia fixo) medindo o tempo de parede, o número de chamadas à API e o número de idas ao banco (embrulhe `fetch` do cliente Supabase num contador: `createClient(url, key, { global: { fetch: contado } })` e injete com `vi`-less: exporte o cliente por variável de ambiente como os outros scripts do repositório fazem; se não houver jeito limpo, conte as requisições pelo log do PostgREST local: `docker logs --since 2m supabase_rest_bythiagofigueiredo | grep -c '"POST\|"GET\|"PATCH'`); (5) roda uma terceira vez às 18:00 simuladas (nada mudou: mede o regime) e (6) imprime, para cada rodada: segundos, chamadas à API, idas ao banco, e as contagens de `competitor_raw`, `competitor_field_versions`, `competitor_video_tier_spans`, `competitor_video_daily`; (7) apaga o site de teste (cascata).

- [ ] **Step 3: rodar, com saída em arquivo e sem esperar mais de 4 minutos** (se a rodada de enchimento do passo 3 passar disso, rode-a em segundo plano com saída em arquivo e volte ao controlador).

- [ ] **Step 4: escrever no ledger** (`.superpowers/sdd/a5-e1-e2/progress.md`, seção "Ensaio"): os três tempos; as idas ao banco da rodada das 12:00 e da de regime; **a estimativa para produção** = (tempo da API medido) + (idas ao banco × latência de produção), onde a latência de produção sai da calibração: a mesma rodada de regime com o código **antigo** leva 21 s em produção (medido) e X s no ensaio; a diferença dividida pelas idas ao banco do código antigo é a latência por ida. Compare com a tabela da seção 5 do plano. **Critério:** se o maior canal passar de 45 s na rodada das 12:00 estimada para produção, pare e volte ao controlador antes do push (a faixa passaria de 2 para 3 disparos com 15 canais; não perde dado, mas muda a conta que o dono leu). Confirme também: zero linha nova em `competitor_raw` e em `competitor_field_versions` na terceira rodada (item 223, agora com resposta real: é aqui que aparece um campo da resposta que muda sozinho a cada leitura; se aparecer, o nome do campo vai para o ledger e a exclusão dele em `rawOf` vira uma tarefa de conserto antes do push).

- [ ] **Step 5:** apagar o script (`rm apps/web/scripts/a5-ensaio-sync.ts`) e conferir `git status --short apps/web/scripts` vazio.

**Pronto quando:** o ledger tem os números, a estimativa para produção e a resposta à pergunta "o `raw` real é estável entre duas leituras?".

### Task 15 (controlador): o envio do Lote 1 e as conferências

Sem código. Só o controlador executa; nenhum comando do dono além do que a seção 2 lista.

- [ ] **Step 1: revisão final do lote** pelos dois especialistas (`revisor-engenharia-dados-senior` e `revisor-engenharia-software-senior`), com o diff do lote em arquivo, até o acordo (regra do dono, decisão 38).
- [ ] **Step 2: o retrato "antes" (item 247).** Com `D` = véspera do dia do deploy e o corte em `D 23:59:59` de São Paulo (`<D+1>T02:59:59Z`), rode R1 (seção 10) em produção e grave o resultado em `.superpowers/sdd/a5/retratos/e1-e2-antes.json`, com o instante da leitura e o corte.
- [ ] **Step 3: o dono aplica as migrations** (seção 2, passos 3 e 4). Rode V1, V2 e V3 em produção e cole no ledger. **Não siga sem V1 = 21, 12, 5, 5, 9, `'{}'::jsonb`, 0.**
- [ ] **Step 4: o envio separado da A4**, pelo roteiro da E12 (seção 9). Antes do push: extrair a árvore a enviar para uma pasta fora do repositório e rodar lá `npx vitest run test/youtube test/api/cron test/unit/test-hygiene.test.ts` e `npm run typecheck -w apps/web`.
- [ ] **Step 5:** push em `staging`, CI verde, promoção a `main`. **Anote no ledger a hora da promoção e as datas absolutas de D0, D+1, D+3, D+7 e D+8.** Regra operacional do D0: não disparar o cron à mão.
- [ ] **Step 6: D0, depois do primeiro disparo que sincronizar canal** (o das 12:00 ou o das 18:00 de São Paulo, o que vier primeiro): K3 (a linha da cota existe e `operations.competitors` > 0), K5 (as duas provas), K12 (a duração por canal: compare com 21 s), K9 e K14 (as faixas: cerca de 674 diária e 716 semanal, uma linha aberta por vídeo), K13. E `select * from cron_health where cron_name = 'sync-youtube-competitors'` (sem falha).
- [ ] **Step 7: D+1 e D+3:** K1, K2, K4 (com a hora da promoção), K5, K6 (o `raw` fechado tem de ser uma fração pequena: se passar de 5% dos correntes em D+3, um campo está mudando sozinho: investigue com K7 e com a diferença entre duas respostas guardadas do mesmo vídeo), K8 (em D+3), K11.
- [ ] **Step 8: D+7 e D+8:** K5 (agora com `semanal_atrasados` valendo), K9 (promovidos), K10, K11 (o tamanho real das tabelas novas: corrige a seção 5 do plano e a 9.6 do spec), e o retrato "depois": R1 com o mesmo corte do Step 2, gravado em `e1-e2-depois.json`; **os dois arquivos têm de ser iguais** (itens 9 e 20: o código do leitor não mudou no Lote 1, e a série e as versões até o corte não podem ter mudado).
- [ ] **Step 9:** cada conferência feita ganha a data no ledger. Conferência vencida sem data é pendência aberta do controlador na conversa seguinte com o dono.

---

## Lote 2: o leitor (motor, carregador e pacote)

Não perde dado por esperar: pode ser feito em paralelo ao Lote 1 e enviado depois dele. **Regra do lote: nenhum campo que as telas leem hoje muda.** A série dos vídeos não observados entra em campos novos (`unobservedSeries`, `tier`, `tierSpans`); quem liga a leitura nas telas é a E4 e a E5, com mockup.

### Task 16: o motor aceita intervalo semanal pela faixa gravada, e o conjunto de dados ganha os campos novos

**Files:**
- Modify: `apps/web/src/lib/youtube/observatorio/types.ts`, `load.ts` (só `rowsToDataset` e as formas de linha), `series.ts`, `effect.ts`, `index.ts`
- Test: `apps/web/test/youtube/observatorio/serie-semanal.test.ts` (novo)

**Interfaces:**
- Consumes: `RULES.series.weeklyMaxGapDays` (Tarefa 5).
- Produces:

```ts
// types.ts
export type SeriesTier = 'diaria' | 'semanal'
/** Dias (índices de dia do motor, inclusive) em que o vídeo esteve numa faixa. `to` null = em vigor. */
export interface TierSpan { from: number; to: number | null; tier: SeriesTier }
// ObsVideo ganha (todos opcionais: um conjunto de dados antigo, o oráculo e os canais próprios não os têm):
//   tier?: SeriesTier | null
//   tierSpans?: TierSpan[]
//   unobservedSeries?: SeriesPoint[]
// ObsChannel ganha: weeklyOmitted?: boolean
// load.ts
export interface SpanRow { video_id: string; from_date: string; to_date: string | null; tier: string }
// VideoRow ganha series_tier?: string | null; ObservatoryRows ganha spans?: SpanRow[] e weeklyOmitted?: string[]
// series.ts
export type IntervalKind = 'diario' | 'semanal'
export interface Interval { a: number; b: number; vpd: number; idxTo: number; kind: IntervalKind }
export function weeklyThroughout(v: Pick<ObsVideo, 'tierSpans'>, from: number, to: number): boolean
export function intervalsOf(ctx: EngineCtx, v: ObsVideo, opts?: { weekly?: boolean }): Interval[]
export interface WeeklyRate extends PeriodRate { weekly: boolean }
export function weeklyRate(ctx: EngineCtx, videoId: string, fromMs: number, toMs: number): WeeklyRate
// index.ts: Observatory ganha weeklyRate(id: string, fromMs: number, toMs: number): WeeklyRate
```

- [ ] **Step 1: teste que falha.** `apps/web/test/youtube/observatorio/serie-semanal.test.ts` (o molde de fixture é o de `pinned-engine.test.ts`; copie de lá `rows`, `channel`, `video`, `version`, `iso`, `sp`, e as constantes):

```ts
// @vitest-environment node
// A5 (E2): intervalo semanal só existe onde a faixa gravada diz "semanal"; buraco continua buraco; nada do que as telas leem muda.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { rowsToDataset, type ObservatoryRows, type ChannelRow, type VideoRow, type VersionRow, type DailyRow, type SpanRow } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'

const DAY = 864e5, H = 36e5
const sp = (s: string) => Date.parse(s + '-03:00')
const iso = (ms: number) => new Date(ms).toISOString()
const NOW = sp('2026-10-24T15:02:00') // entregue ao motor como parâmetro; nunca comparado com o relógio de parede
const SERIES = '2026-10-05T09:00:00-03:00'
const D = (day: number) => '2026-10-' + String(day).padStart(2, '0')
const noon = (day: number) => sp(D(day) + 'T12:00:00')

function rows(o: Partial<ObservatoryRows> = {}): ObservatoryRows {
  return { settings: { series_started_at: SERIES, channel_limit: 75 }, channels: [], ownChannels: [], videos: [], ownVideos: [], versions: [], legacyChanges: [], daily: [], snapshots: [], readings: [], tasks: [], heartbeat: null, ...o }
}
const channel = (o: Partial<ChannelRow> = {}): ChannelRow => ({
  id: 'ch1', channel_id: 'UC1', channel_name: 'Canal Um', thumbnail_url: null, subscriber_count: 1000, niche: 'viagem', video_limit: 1,
  youtube_video_count: 300, sync_status: 'idle', sync_error: null, sync_error_since: null, last_ok_synced_at: iso(NOW - 2 * H), last_synced_at: iso(NOW - 2 * H),
  full_sync_completed_at: null, added_at: iso(sp('2026-09-01T10:00:00')), ...o,
})
const video = (id: string, ageDays: number, o: Partial<VideoRow> = {}): VideoRow => ({
  id, competitor_channel_id: 'ch1', video_id: 'yt-' + id, title: 'Título ' + id, view_count: 1000, like_count: 10, comment_count: 1, duration_seconds: 600,
  published_at: iso(NOW - ageDays * DAY), is_short: false, last_checked_at: iso(NOW - 2 * H), tags: null, thumbnail_url: null, pinned_at: null, ...o,
})
const version = (o: Partial<VersionRow>): VersionRow => ({
  id: 'ver', video_id: 'w', field: 'title', value_text: 'Um', value_hash: 'h1', has_text: true, thumb_blob_url: null,
  first_seen_at: iso(sp('2026-10-06T09:00:00')), last_seen_at: iso(NOW - 2 * H), window_start: null, precision: 'first', is_current: true, ...o,
})
const pt = (video_id: string, day: number, views: number): DailyRow => ({ video_id, snap_date: D(day), views, likes: null, comments: null, taken_at: D(day) + 'T15:00:00Z' })
const span = (video_id: string, from: number, to: number | null, tier: string): SpanRow => ({ video_id, from_date: D(from), to_date: to == null ? null : D(to), tier })
const days = (video_id: string, from: number, to: number, perDay: number) => Array.from({ length: to - from + 1 }, (_, i) => pt(video_id, from + i, 10_000 + i * perDay))

// Canal com limite 1: `a` (10 dias) é o acompanhado; os outros têm 400 dias e não são observados.
const A_DAILY = days('a', 15, 24, 100)
const base = (extra: { videos?: VideoRow[]; daily?: DailyRow[]; spans?: SpanRow[]; versions?: VersionRow[] }) => rows({
  channels: [channel()], videos: [video('a', 10, { series_tier: 'diaria' }), ...(extra.videos ?? [])],
  daily: [...A_DAILY, ...(extra.daily ?? [])], spans: [span('a', 5, null, 'diaria'), ...(extra.spans ?? [])], versions: extra.versions ?? [],
})
const obsOf = (r: ObservatoryRows) => createObservatory(rowsToDataset(r, NOW))

describe('intervalo semanal (itens 19 e 222)', () => {
  it('vídeo em faixa semanal com 7 dias entre dois pontos: intervalo semanal, taxa = média da semana, e a frase diz isso', () => {
    const obs = obsOf(base({ videos: [video('w', 400, { series_tier: 'semanal' })], daily: [pt('w', 17, 50_000), pt('w', 24, 57_000)], spans: [span('w', 10, null, 'semanal')] }))
    const r = obs.weeklyRate('w', noon(17), noon(24))
    expect(r.weekly).toBe(true)
    expect(r.vpd).toBeCloseTo(1000, 5)
    expect(r.text).toContain('taxa média da semana')
  })
  it('vídeo SEM nenhuma linha de faixa nunca tem intervalo semanal (anterior à MG2)', () => {
    const obs = obsOf(base({ videos: [video('w', 400)], daily: [pt('w', 17, 50_000), pt('w', 24, 57_000)] }))
    expect(obs.weeklyRate('w', noon(17), noon(24))).toMatchObject({ vpd: null, weekly: false })
  })
  it('buraco não vira semana: vídeo em faixa DIÁRIA com 3 dias sem leitura → o intervalo é recusado', () => {
    const holed = A_DAILY.filter(p => p.snap_date < D(19) || p.snap_date > D(21)) // faltam 19, 20 e 21
    const r = rows({ channels: [channel()], videos: [video('a', 10, { series_tier: 'diaria' })], daily: holed, spans: [span('a', 5, null, 'diaria')] })
    const obs = obsOf(r)
    expect(obs.weeklyRate('a', noon(19), noon(21))).toMatchObject({ vpd: null, weekly: false }) // período inteiro dentro do buraco: nada
    expect(obs.periodRate('a', noon(19), noon(21)).vpd).toBeNull()                              // e o que as telas leem continua recusando, como hoje
    // os mesmos pontos, com a faixa dizendo "semanal" nos dias sem leitura: aí sim é intervalo (quem decide é a faixa, não a distância)
    const weekly = obsOf({ ...r, spans: [span('a', 5, 18, 'diaria'), span('a', 19, null, 'semanal')] })
    expect(weekly.weeklyRate('a', noon(19), noon(21))).toMatchObject({ weekly: true })
  })
  it('rebaixado ontem: do último ponto diário ao primeiro semanal é intervalo aceito', () => {
    const obs = obsOf(base({ videos: [video('d', 400, { series_tier: 'semanal' })], daily: [...days('d', 15, 20, 500), pt('d', 24, 14_000)], spans: [span('d', 5, 20, 'diaria'), span('d', 21, null, 'semanal')] }))
    const r = obs.weeklyRate('d', noon(20), noon(24))
    expect(r.weekly).toBe(true)
    expect(r.vpd).toBeCloseTo((14_000 - 12_500) / 4, 5)
  })
  it('promovido: do último ponto semanal ao primeiro diário é intervalo aceito', () => {
    const obs = obsOf(base({ videos: [video('p', 400, { series_tier: 'diaria' })], daily: [pt('p', 15, 1000), pt('p', 20, 6000), pt('p', 21, 7000)], spans: [span('p', 5, 19, 'semanal'), span('p', 20, null, 'diaria')] }))
    expect(obs.weeklyRate('p', noon(15), noon(20))).toMatchObject({ weekly: true })
    expect(obs.weeklyRate('p', noon(15), noon(20)).vpd).toBeCloseTo(1000, 5)
  })
  it('9 dias entre dois pontos é buraco mesmo em faixa semanal', () => {
    const obs = obsOf(base({ videos: [video('w', 400, { series_tier: 'semanal' })], daily: [pt('w', 15, 50_000), pt('w', 24, 59_000)], spans: [span('w', 10, null, 'semanal')] }))
    expect(obs.weeklyRate('w', noon(15), noon(24))).toMatchObject({ vpd: null, weekly: false })
  })
  it('sobre uma série só diária, weeklyRate dá o mesmo número de periodRate', () => {
    const obs = obsOf(base({}))
    expect(obs.weeklyRate('a', noon(16), noon(23)).vpd).toBe(obs.periodRate('a', noon(16), noon(23)).vpd)
    expect(obs.weeklyRate('a', noon(16), noon(23)).weekly).toBe(false)
  })
})

describe('efeito de troca e múltiplo sobre série semanal (item 19)', () => {
  const CHANGE = [
    version({ id: 'w1', value_text: 'Um', is_current: false }),
    version({ id: 'w2', value_text: 'Dois', value_hash: 'h2', first_seen_at: iso(sp('2026-10-18T09:00:00')), window_start: iso(sp('2026-10-11T09:00:00')), precision: '1d' }),
  ]
  const withWeekly = base({ videos: [video('w', 400, { series_tier: 'semanal' })], daily: [pt('w', 17, 50_000), pt('w', 24, 57_000)], spans: [span('w', 10, null, 'semanal')], versions: CHANGE })
  it('troca num vídeo semanal: o motivo é "inconclusivo: série semanal"; o estado e o rótulo continuam os de hoje (as contagens das telas não se mexem)', () => {
    const obs = obsOf(withWeekly)
    expect(obs.effect(obs.changes.find(x => x.video === 'w')!.id)).toMatchObject({ status: 'sem-serie', label: 'sem série', reason: 'inconclusivo: série semanal' })
  })
  it('troca num vídeo não observado SEM ponto nenhum: a frase de hoje', () => {
    const obs = obsOf(base({ videos: [video('w', 400)], versions: CHANGE }))
    expect(obs.effect(obs.changes.find(x => x.video === 'w')!.id)).toMatchObject({ status: 'sem-serie', reason: 'Fora dos vídeos acompanhados: sem série diária de views.' })
  })
  it('o múltiplo de um vídeo semanal nunca usa o método "mesmo dia de vida"', () => {
    expect(obsOf(withWeekly).multiplier('w').method).not.toBe('mesmo dia de vida')
  })
})

describe('item 20: nada do que as telas leem hoje muda', () => {
  // o que o carregador de hoje entrega (só os observados têm série; sem faixa) × o que o novo entrega (tudo)
  const extraVideos = [video('w', 400), video('x', 200)]
  const before = rows({ channels: [channel()], videos: [video('a', 10), ...extraVideos], daily: A_DAILY })
  const after = rows({ channels: [channel()], videos: [video('a', 10, { series_tier: 'diaria' }), ...extraVideos.map(v => ({ ...v, series_tier: 'semanal' }))],
    daily: [...A_DAILY, pt('w', 17, 50_000), pt('w', 24, 57_000), ...days('x', 15, 24, 9_999)], spans: [span('a', 5, null, 'diaria'), span('w', 10, null, 'semanal'), span('x', 10, null, 'semanal')] })
  const strip = (ds: ReturnType<typeof rowsToDataset>) => ({ ...ds, videos: ds.videos.map(({ tier: _t, tierSpans: _s, unobservedSeries: _u, ...v }) => v) })
  it('o conjunto de dados, sem os três campos novos, é idêntico (logo, todo número calculado dele também)', () => {
    expect(strip(rowsToDataset(after, NOW))).toEqual(strip(rowsToDataset(before, NOW)))
  })
  it('o vídeo não observado guarda os pontos em unobservedSeries, e `series` continua vazia; o índice do último dia do canal vem só dos observados', () => {
    const ds = rowsToDataset(after, NOW)
    expect(ds.videos.find(v => v.id === 'w')).toMatchObject({ series: [], firstIdx: null, tier: 'semanal' })
    expect(ds.videos.find(v => v.id === 'w')!.unobservedSeries).toHaveLength(2)
    expect(ds.videos.find(v => v.id === 'a')!.unobservedSeries).toBeUndefined()
    expect(ds.channels[0]!.lastIdx).toBe(rowsToDataset(before, NOW).channels[0]!.lastIdx)
  })
  it('views por dia, múltiplo e mediana do canal: iguais com e sem os dados novos', () => {
    const a = createObservatory(rowsToDataset(before, NOW)), b = createObservatory(rowsToDataset(after, NOW))
    expect(b.channelStats('ch1')).toEqual(a.channelStats('ch1'))
    for (const id of ['a', 'w', 'x']) {
      expect(b.video(id)!.vpd).toBe(a.video(id)!.vpd)
      expect(b.video(id)!.vpd7).toBe(a.video(id)!.vpd7)
      expect(b.multiplier(id)).toEqual(a.multiplier(id))
    }
  })
  it('os campos novos só são lidos onde este plano diz: nenhuma tela e nenhum outro módulo do motor os toca', () => {
    const root = 'src', hits: string[] = []
    const walk = (dir: string): void => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name) && /unobservedSeries|tierSpans/.test(readFileSync(p, 'utf8'))) hits.push(p.replace(/\\/g, '/')) } }
    walk(root)
    expect(hits.sort()).toEqual(['src/lib/youtube/observatorio/effect.ts', 'src/lib/youtube/observatorio/load.ts', 'src/lib/youtube/observatorio/series.ts', 'src/lib/youtube/observatorio/types.ts'])
  })
})
```

- [ ] **Step 2:** `cd apps/web && npx vitest run test/youtube/observatorio/serie-semanal.test.ts 2>&1 | tail -12` → FAIL (`SpanRow` não existe; `weeklyRate` não é função).

- [ ] **Step 3: implementar.**

`types.ts`: acrescente `SeriesTier` e `TierSpan` (bloco "Produces"); em `ObsVideo`, depois de `truncated?`:

```ts
  /** A5 (E2). competitor_videos.series_tier. Ausente = ainda não classificado, conjunto antigo, ou canal próprio. */
  tier?: SeriesTier | null
  /** A5 (E2). A faixa no tempo (competitor_video_tier_spans). Ausente ou vazio = nenhuma gravada: o vídeo NUNCA tem intervalo semanal. */
  tierSpans?: TierSpan[]
  /**
   * A5 (E2). Os pontos guardados de um vídeo que NÃO é observado (fora dos N mais recentes e não fixado): semanais, ou os
   * diários de um vídeo promovido ou de até 30 dias. `series` continua vazia para ele: tudo o que as telas leem hoje fica
   * igual. Quem lê é series.ts (weeklyRate) e o motivo do efeito; as telas, só na E5.
   */
  unobservedSeries?: SeriesPoint[]
```

e em `ObsChannel`: `/** A5 (E2). A série dos não observados não coube no pacote em cache e ficou de fora (pack.ts). */ weeklyOmitted?: boolean`.

`load.ts`: `VideoRow` ganha `series_tier?: string | null`; acrescente `export interface SpanRow { video_id: string; from_date: string; to_date: string | null; tier: string }`; `ObservatoryRows` ganha `/** As faixas no tempo. Ausente = nenhuma lida. */ spans?: SpanRow[]` e `/** Canais cujo pacote ficou sem a série dos não observados. */ weeklyOmitted?: string[]`. Importe `SeriesTier` e `TierSpan` de `./types`. Em `rowsToDataset`, depois de `const snapsBy = …`: `const spansBy = groupBy(rows.spans ?? [], s => s.video_id), omitted = new Set(rows.weeklyOmitted ?? [])`. Dentro de `vs.forEach(({ v, pub }, k) => {`, troque o trecho que monta `series` e atualiza `lastIdx` por:

```ts
      const observed = k < nTracked || v.pinned_at != null // o mesmo que isObserved: acompanhado ou fixado
      const points: SeriesPoint[] = (dailyBy.get(v.id) ?? []).map(d => {
        const idx = dayIndex(d.snap_date), nominal = snap0 + idx * DAY
        return { idx, t: realReadAt(d, spDateStart(d.snap_date)) ?? nominal, views: Number(d.views) }
      })
        .sort((a, b) => a.idx - b.idx)
      // Só o vídeo observado tem `series` (como sempre). Os pontos dos outros vão para um campo à parte: nada que as telas leem muda.
      const series: SeriesPoint[] = observed ? points : []
      for (const p of series) if (lastIdx == null || p.idx > lastIdx) lastIdx = p.idx
      const tier: SeriesTier | null = v.series_tier === 'diaria' || v.series_tier === 'semanal' ? v.series_tier : null
      const tierSpans: TierSpan[] = (spansBy.get(v.id) ?? [])
        .filter((s): s is SpanRow & { tier: SeriesTier } => s.tier === 'diaria' || s.tier === 'semanal')
        .map(s => ({ from: dayIndex(s.from_date), to: s.to_date ? dayIndex(s.to_date) : null, tier: s.tier }))
        .sort((a, b) => a.from - b.from)
```

(mantenha o comentário sobre `taken_at` que já está acima do trecho) e, no `videos.push({ … })`, depois de `series, firstIdx: …, titles, thumbs, descs,`: `...(tier ? { tier } : {}), ...(tierSpans.length ? { tierSpans } : {}), ...(!observed && points.length ? { unobservedSeries: points } : {}),`. No `channels.push({ … })` do concorrente: `...(omitted.has(c.id) ? { weeklyOmitted: true } : {}),`.

`series.ts`: troque `interface Interval` e `function intervalsOf` (hoje privados) por:

```ts
export type IntervalKind = 'diario' | 'semanal'
export interface Interval { a: number; b: number; vpd: number; idxTo: number; kind: IntervalKind }

/** Todos os dias de `from` a `to` (índices de dia, inclusive) estavam em faixa semanal? Dia sem faixa gravada: não. */
export function weeklyThroughout(v: Pick<ObsVideo, 'tierSpans'>, from: number, to: number): boolean {
  const spans = v.tierSpans ?? []
  if (!spans.length || from > to) return false
  for (let d = from; d <= to; d++) {
    const s = spans.find(x => x.from <= d && (x.to == null || x.to >= d))
    if (!s || s.tier !== 'semanal') return false
  }
  return true
}

/**
 * Os intervalos entre pontos seguidos. Sem `weekly` é exatamente o de sempre: só dias vizinhos; um dia sem ponto é
 * buraco. Com `weekly`, um salto de 2 a 8 dias de calendário vale como "taxa média da semana" SE todos os dias sem
 * leitura estavam em faixa semanal (a faixa gravada no tempo, não a distância: um cron parado por 3 dias num vídeo
 * diário continua sendo buraco). Vídeo sem faixa gravada nunca tem intervalo semanal.
 */
export function intervalsOf(ctx: EngineCtx, v: ObsVideo, opts: { weekly?: boolean } = {}): Interval[] {
  if (!v.series.length) return []
  const out: Interval[] = [], a0 = earliestIdx(v, ctx.ds.seriesStart), last = lastIdxOf(v)
  for (let i = a0; i < last; i++) {
    const ya = pointViews(ctx, v, i)
    if (ya == null) continue
    const yb = pointViews(ctx, v, i + 1)
    if (yb != null) {
      const ta = pointTime(ctx, v, i), tb = pointTime(ctx, v, i + 1)
      const r = ratePerDay(yb - ya, tb - ta)
      if (r == null) continue // too short (or non-positive) an interval: no average rather than a wild or negative one
      out.push({ a: ta, b: tb, vpd: r, idxTo: i + 1, kind: 'diario' })
      continue
    }
    if (!opts.weekly) continue // a hole: no interval across a missing day
    const max = Math.min(last, i + RULES.series.weeklyMaxGapDays)
    let j = i + 2
    while (j <= max && viewsAtIdx(v, j) == null) j++
    if (j > max) continue                            // nenhum ponto em até 8 dias: buraco
    if (!weeklyThroughout(v, i + 1, j - 1)) continue  // os dias sem leitura não estavam em faixa semanal: buraco
    const ta = pointTime(ctx, v, i), tb = pointTime(ctx, v, j)
    const r = ratePerDay(viewsAtIdx(v, j)! - ya, tb - ta)
    if (r == null) continue
    out.push({ a: ta, b: tb, vpd: r, idxTo: j, kind: 'semanal' })
  }
  return out
}

/** A série que se lê de um vídeo: a dele; ou, se não é observado, os pontos guardados à parte. */
const withUnobserved = <T extends ObsVideo>(v: T): T =>
  v.series.length || !v.unobservedSeries?.length ? v : { ...v, series: v.unobservedSeries, firstIdx: v.unobservedSeries[0]!.idx }

export interface WeeklyRate extends PeriodRate { weekly: boolean }
/**
 * Como periodRate, aceitando intervalo semanal e a série de um vídeo não observado. `weekly` = pelo menos um intervalo
 * semanal entrou na conta, e então o número é a TAXA MÉDIA DA SEMANA (a frase diz). NENHUMA tela chama isto ainda (E5).
 */
export function weeklyRate(ctx: EngineCtx, videoId: string, fromMs: number, toMs: number): WeeklyRate {
  const stored = ctx.V.get(videoId)
  if (!stored) throw new Error('weeklyRate: unknown video ' + videoId)
  const none = (text: string): WeeklyRate => ({ vpd: null, sharedDay: false, onlySinceDays: null, coveredHours: 0, text, weekly: false })
  if (toMs - fromMs < DAY) return none('menos de 1 dia no ar, sem média')
  const iv = intervalsOf(ctx, withUnobserved(stored), { weekly: true })
  let s = 0, w = 0, weekly = false
  for (const x of iv) { const o = Math.min(toMs, x.b) - Math.max(fromMs, x.a); if (o > 0) { s += x.vpd * o; w += o; if (x.kind === 'semanal') weekly = true } }
  if (w < DAY) return none('sem registro no período')
  const vpd = s / w
  return { vpd, sharedDay: false, onlySinceDays: null, coveredHours: w / H, weekly, text: '≈ ' + ctx.fmt.num(vpd) + (weekly ? ' (taxa média da semana)' : '') }
}
```

`periodRate` e `expectedCurve` continuam chamando `intervalsOf(ctx, v)` sem opção: não mudam uma linha.

`effect.ts`: troque a linha do `if (!isObserved(v)) return done({ … })` por:

```ts
  // R37 + R119: the daily record is read only for observed videos (tracked ∪ pinned). A5 (E2): um vídeo não observado em faixa
  // semanal TEM pontos, mas semanais: o efeito de troca exige pontos diários. O estado continua 'sem-serie' (as telas contam
  // os 'inconclusivo'); a frase é a do spec.
  if (!isObserved(v)) return done({ status: 'sem-serie', label: 'sem série', reason: v.tier === 'semanal' && v.unobservedSeries?.length ? 'inconclusivo: série semanal' : 'Fora dos vídeos acompanhados: sem série diária de views.' })
```

`index.ts`: importe `weeklyRate, type WeeklyRate` de `./series`; na interface `Observatory`, ao lado de `periodRate`: `weeklyRate(id: string, fromMs: number, toMs: number): WeeklyRate`; no objeto devolvido, ao lado de `periodRate: …`: `weeklyRate: (id, f, t) => weeklyRate(ctx, id, f, t),`.

- [ ] **Step 4:** `npx vitest run test/youtube/observatorio 2>&1 | tail -15 && npm run typecheck 2>&1 | tail -3` → o arquivo novo passa e **nenhum** teste antigo do Observatório quebra (os de paridade com o oráculo são a prova de que `intervalsOf` sem opção é o de sempre). Se um teste antigo quebrar porque dava linha diária a um vídeo não observado e esperava `series` preenchida, pare e relate: é o único comportamento de `rowsToDataset` que mudou.

- [ ] **Step 5: commit.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/observatorio/types.ts apps/web/src/lib/youtube/observatorio/load.ts apps/web/src/lib/youtube/observatorio/series.ts apps/web/src/lib/youtube/observatorio/effect.ts apps/web/src/lib/youtube/observatorio/index.ts apps/web/test/youtube/observatorio/serie-semanal.test.ts && git commit -m "feat: o motor do Observatório aceita intervalo semanal pela faixa gravada no tempo; buraco continua buraco; os campos que as telas leem não mudam (A5 E2)" -- apps/web/src/lib/youtube/observatorio apps/web/test/youtube/observatorio/serie-semanal.test.ts
```

**Pronto quando:** itens 19, 20 (em teste) e 222 (a parte do motor) passam; os testes de paridade continuam verdes; o teste de busca garante que nenhuma tela lê os campos novos.

### Task 17: o carregador lê a série de todo vídeo e as faixas; o pacote em cache sobe de versão e tem saída de emergência

**Files:**
- Modify: `apps/web/src/lib/youtube/observatorio/load.ts` (`VIDEO_COLS`, `loadRows`), `load-channel.ts`, `load-page.ts`, `pack.ts`
- Modify: `apps/web/test/youtube/observatorio/load-fixture.ts`, `pack-shape.test.ts`, e os testes de carga que conferem o número de leituras
- Test: `apps/web/test/youtube/observatorio/pack-semanal.test.ts` (novo)

**Interfaces:**
- Consumes: `SpanRow`, `ObservatoryRows.spans`, `ObservatoryRows.weeklyOmitted` (Tarefa 16); `observedVideoIds` (já existe).
- Produces:

```ts
// pack.ts
export const PACK_VERSION = 2
export interface ChannelRows { videos: VideoRow[]; versions: VersionRow[]; daily: DailyRow[]; snapshots: SnapshotRow[]; spans: SpanRow[]; /** a série dos não observados e as faixas ficaram de fora (não coube) */ weeklyOmitted?: boolean }
/** Empacota; se passar de PACK_BUDGET, refaz só com a série dos observados e marca. O pacote que ainda assim passar é devolvido (quem chama avisa, como hoje). */
export function packWithinBudget(rows: ChannelRows, observedIds: ReadonlySet<string>): { packed: string; weeklyOmitted: boolean }
// load.ts
export function datedVideoIds(videos: readonly Pick<VideoRow, 'id' | 'published_at'>[]): string[]
export const SPAN_COLS = 'video_id, from_date, to_date, tier'
```

- [ ] **Step 1: testes que falham.** `apps/web/test/youtube/observatorio/pack-semanal.test.ts`:

```ts
// @vitest-environment node
// A5 (E2, item 21): o pacote do maior canal com um ano de série cabe com a semanal; no teto, a semanal fica de fora e o pacote diz.
import { describe, it, expect } from 'vitest'
import { gzipSync } from 'node:zlib'
import { packChannel, unpackChannel, packWithinBudget, PACK_BUDGET, PACK_VERSION, type ChannelRows } from '@/lib/youtube/observatorio/pack'

const DAY = 864e5, NOW = Date.now()
const spDate = (ms: number) => new Date(ms - 3 * 36e5).toISOString().slice(0, 10)
/** Gerador determinístico (o tamanho do pacote depende de quão aleatório é o dado: com Math.random o teste variaria). */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32 } }
const hex = (r: () => number, n: number) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join('')
const uuid = (r: () => number) => [hex(r, 8), hex(r, 4), hex(r, 4), hex(r, 4), hex(r, 12)].join('-')

/** Um canal com `nDaily` vídeos em faixa diária (um ponto por dia por 365 dias) e o resto em semanal (um ponto por semana). */
function year(nVideos: number, nDaily: number): { rows: ChannelRows; observed: Set<string> } {
  const r = rng(nVideos * 1000 + nDaily), rows: ChannelRows = { videos: [], versions: [], daily: [], snapshots: [], spans: [] }, observed = new Set<string>()
  for (let i = 0; i < nVideos; i++) {
    const id = uuid(r), isDaily = i < nDaily
    if (isDaily) observed.add(id)
    rows.videos.push({ id, competitor_channel_id: 'c', video_id: hex(r, 11), title: 'Um título de vídeo com tamanho médio de sessenta caracteres ' + i, view_count: 100_000 + i, like_count: 3000, comment_count: 120, duration_seconds: 900,
      published_at: new Date(NOW - i * 3 * DAY).toISOString(), is_short: i % 3 === 0, last_checked_at: new Date(NOW).toISOString(), tags: ['viagem', 'asia', 'vlog', 'tag' + i], thumbnail_url: 'https://i.ytimg.com/vi/' + hex(r, 11) + '/maxresdefault.jpg', pinned_at: null, series_tier: isDaily ? 'diaria' : 'semanal' })
    for (const field of ['title', 'thumb', 'desc']) rows.versions.push({ id: uuid(r), video_id: id, field, value_text: field === 'title' ? 'Um título de vídeo ' + i : null, value_hash: hex(r, 16), has_text: field !== 'thumb', thumb_blob_url: field === 'thumb' ? 'https://x.public.blob.vercel-storage.com/observatorio/thumbs/' + id + '/' + hex(r, 16) + '.jpg' : null,
      first_seen_at: new Date(NOW - 300 * DAY).toISOString(), last_seen_at: new Date(NOW).toISOString(), window_start: null, precision: 'first', is_current: true })
    let views = Math.floor(r() * 500_000)
    for (let d = 365; d >= 0; d -= isDaily ? 1 : 7) {
      views += Math.floor(r() * (isDaily ? 3000 : 400))
      const t = NOW - d * DAY + Math.floor(r() * 1200) * 1000
      rows.daily.push({ video_id: id, snap_date: spDate(t), views, taken_at: new Date(t).toISOString() })
    }
    rows.spans.push({ video_id: id, from_date: spDate(NOW - 365 * DAY), to_date: null, tier: isDaily ? 'diaria' : 'semanal' })
  }
  return { rows, observed }
}

describe('pacote com a série semanal (item 21)', () => {
  it('PACK_VERSION subiu, e o pacote leva e devolve as faixas', () => {
    expect(PACK_VERSION).toBe(2)
    const { rows } = year(4, 2)
    expect(unpackChannel(packChannel(rows))).toEqual(rows)
  })
  it('um pacote da versão 1 (sem `spans`) não é aceito: a tela lê o banco', () => {
    const { rows } = year(2, 1)
    const v1 = gzipSync(JSON.stringify({ v: 1, videos: rows.videos, versions: rows.versions, daily: rows.daily, snapshots: [] })).toString('base64')
    expect(unpackChannel(v1)).toBeNull()
  })
  it('o maior canal de hoje (285 vídeos, 50 diários) com um ano de série, diária E semanal, cabe com folga', () => {
    const { rows, observed } = year(285, 50)
    const out = packWithinBudget(rows, observed)
    console.info('[medicao] pacote 285/50 com semanal:', out.packed.length, 'caracteres de', PACK_BUDGET)
    expect(out.weeklyOmitted).toBe(false)
    expect(out.packed.length).toBeLessThan(PACK_BUDGET * 0.6)
    expect(unpackChannel(out.packed)!.daily).toHaveLength(rows.daily.length)
  })
  it('no teto (200 diários e 800 semanais, um ano) não cabe com a semanal: ela fica de fora, o pacote diz, e cabe', () => {
    const { rows, observed } = year(1000, 200)
    expect(packChannel(rows).length).toBeGreaterThan(PACK_BUDGET) // a premissa do teste: com tudo, passa
    const out = packWithinBudget(rows, observed)
    console.info('[medicao] pacote 1000/200 sem semanal:', out.packed.length, 'caracteres de', PACK_BUDGET)
    expect(out.weeklyOmitted).toBe(true)
    expect(out.packed.length).toBeLessThanOrEqual(PACK_BUDGET)
    const back = unpackChannel(out.packed)!
    expect(back.weeklyOmitted).toBe(true)
    expect(back.spans).toEqual([])
    expect(back.daily.every(d => observed.has(d.video_id))).toBe(true)
    expect(back.daily).toHaveLength(200 * 366)
    expect(back.videos).toHaveLength(1000) // os vídeos ficam todos: só a série dos não observados sai
  })
})
```

E acrescente a `load-channel.test.ts` (o arquivo que mantém `loadRows` e `loadChannelRows` iguais), usando a fixture com a opção nova `weekly: true`:

```ts
  it('A5: os dois carregadores leem a série de TODO vídeo datado e as faixas, e dão o mesmo conjunto', async () => {
    const db = fakeSupabase(buildTables({ siteId: 'a', now: NOW, channels: 1, videosPerChannel: 6, limit: 2, days: 14, weekly: true }))
    const site = await loadRows({ siteId: 'a', now: NOW, supabase: db.client })
    const one = await loadChannelRows(db.client, { channelId: ids.channel('a', 0), videoLimit: 2, seriesStart: NOW - 14 * 864e5, now: NOW })
    const untracked = ids.video('a', 0, 5)
    expect(site.daily.some(d => d.video_id === untracked)).toBe(true)
    expect(one.daily.map(d => d.video_id + d.snap_date).sort()).toEqual(site.daily.map(d => d.video_id + d.snap_date).sort())
    expect(one.spans).toHaveLength(6)
    expect([...site.spans!].sort((x, y) => x.video_id.localeCompare(y.video_id))).toEqual([...one.spans].sort((x, y) => x.video_id.localeCompare(y.video_id)))
    const ds = rowsToDataset(site, NOW)
    expect(ds.videos.find(v => v.id === untracked)).toMatchObject({ series: [], tier: 'semanal' })
    expect(ds.videos.find(v => v.id === untracked)!.unobservedSeries!.length).toBeGreaterThan(0)
  })
```

- [ ] **Step 2:** rodar os dois → FAIL.

- [ ] **Step 3: implementar.**

`load-fixture.ts`: `FixtureOpts` ganha `/** true = os vídeos fora de `limit` têm faixa semanal, um ponto por semana, e todo vídeo tem a linha de faixa. */ weekly?: boolean`; `buildTables` cria sempre a chave `competitor_video_tier_spans: []` e põe `series_tier` em cada vídeo (`'diaria'` nos `limit` mais recentes, `'semanal'` nos outros, `null` quando `weekly` não foi pedido); com `weekly`, acrescenta para cada vídeo fora de `limit` uma linha em `competitor_video_daily` a cada 7 dias dentro de `days`, e para todo vídeo uma linha de faixa aberta desde `spDate(now - days * DAY)`. Nada muda para quem não passa `weekly`.

`load.ts`: `VIDEO_COLS` ganha `, series_tier` no fim; acrescente

```ts
export const SPAN_COLS = 'video_id, from_date, to_date, tier'
/** Os vídeos cuja série é lida: todos os que têm data de publicação (um vídeo sem data não entra no conjunto de dados). */
export function datedVideoIds(videos: readonly Pick<VideoRow, 'id' | 'published_at'>[]): string[] {
  return videos.filter(v => ms(v.published_at) != null).map(v => v.id)
}
```

e, em `loadRows`, troque `const dailyIds = observedVideoIds(channels, videos), …` por `const dailyIds = datedVideoIds(videos), …`, acrescente a leitura das faixas ao `Promise.all` (`readIn<SpanRow>('competitor_video_tier_spans', dailyIds, ids => sb.from('competitor_video_tier_spans').select(SPAN_COLS).in('video_id', ids).order('video_id').order('from_date'))`) e devolva `{ ...live, videos, versions, daily, snapshots, spans }`. Atualize o comentário da linha ("daily points only for OBSERVED videos…") para dizer que a série é lida de todo vídeo datado e que `rowsToDataset` separa observados de não observados.

`load-channel.ts`: `dailyIds` vira `datedVideoIds(videos)`; acrescente a mesma leitura de faixas ao `Promise.all`; devolva `{ videos, versions: [...plain, ...descs], daily, snapshots, spans }`. Em `assembleRows`: `spans: parts.flatMap(p => p.spans)`, e `weeklyOmitted: parts.flatMap((p, i) => (p.weeklyOmitted ? [live.channels[i]!.id] : []))` (as partes vêm na ordem de `live.channels`: confira em `loadPageRows` e em `loadChannelDataset`).

`pack.ts`:

```ts
export const PACK_VERSION = 2
export interface ChannelRows { videos: VideoRow[]; versions: VersionRow[]; daily: DailyRow[]; snapshots: SnapshotRow[]; spans: SpanRow[]; weeklyOmitted?: boolean }

export function packChannel(rows: ChannelRows): string {
  return gzipSync(JSON.stringify({ v: PACK_VERSION, videos: rows.videos, versions: rows.versions, daily: rows.daily, snapshots: rows.snapshots, spans: rows.spans, ...(rows.weeklyOmitted ? { weeklyOmitted: true } : {}) })).toString('base64')
}

/**
 * A5 (E2, spec 4.3 efeito 3). Um ano de série diária E semanal do maior canal de hoje ocupa cerca de um terço do orçamento;
 * um canal no teto (200 diários e centenas de semanais) passa. Aí o pacote é refeito só com a série dos OBSERVADOS (o que as
 * telas leem hoje) e leva a marca: quem lê sabe que a série semanal daquele canal não veio, em vez de receber um pacote que
 * o cache recusaria em silêncio.
 */
export function packWithinBudget(rows: ChannelRows, observedIds: ReadonlySet<string>): { packed: string; weeklyOmitted: boolean } {
  const full = packChannel(rows)
  if (full.length <= PACK_BUDGET) return { packed: full, weeklyOmitted: false }
  return { packed: packChannel({ ...rows, daily: rows.daily.filter(d => observedIds.has(d.video_id)), spans: [], weeklyOmitted: true }), weeklyOmitted: true }
}
```

e em `unpackChannel`: exija também `Array.isArray(p.spans)` e devolva `spans: p.spans as SpanRow[], ...(p.weeklyOmitted === true ? { weeklyOmitted: true } : {})` (acrescente `spans?: unknown; weeklyOmitted?: unknown` ao tipo de `p`). Atualize o comentário de `PACK_VERSION` com "2 = A5 (E2): `series_tier` nos vídeos, a lista `spans`, e a série de todo vídeo datado".

`load-page.ts`, em `buildPack`: troque a linha que empacota por

```ts
  const rows = await loadChannelRows(getSupabaseServiceClient(), { channelId, videoLimit, seriesStart, now: observatoryNow() })
  const { packed, weeklyOmitted } = packWithinBudget(rows, new Set(observedVideoIds([{ id: channelId, video_limit: videoLimit }], rows.videos)))
  if (weeklyOmitted) warn('observatório: a série semanal do canal ' + channelId + ' não coube no pacote do cache e ficou de fora', { siteId, channelId, size: packed.length })
```

(importe `packWithinBudget` e `observedVideoIds`; o aviso de "passou do orçamento" que já existe continua valendo para o pacote refeito). Em `readChannel`, o caminho `direct()` devolve as linhas como vêm do banco (com a semanal): não precisa de marca.

- [ ] **Step 4: o retrato da forma** (`pack-shape.test.ts`): `version: 2`; em `selects`, a linha de `competitor_videos` ganha `, series_tier`, e entra `'competitor_video_tier_spans: video_id, from_date, to_date, tier'` na posição em que o teste mostrar; `envelope: ['daily', 'snapshots', 'spans', 'v', 'versions', 'videos']`; `rows.videos` ganha `'series_tier'`; `rows.spans: ['from_date', 'tier', 'to_date', 'video_id']` (use a fixture com `weekly: true` para a lista não vir vazia). Reescreva o retrato com o que o teste mostrar como recebido, **conferindo cada diferença contra esta lista**: uma diferença que não está aqui é parada.

- [ ] **Step 5: os testes de carga que contam leituras.** `load-measure.test.ts`, `load-page.test.ts`, `load.test.ts`, `load-live.test.ts`: há uma leitura a mais por canal (as faixas) e a de série passa a levar todos os ids. Onde um teste afirma um número exato de idas ao banco (`toBe(9)` em `load-measure.test.ts:43`, e os que usam `heavyTrips`), rode, veja o número novo, **confirme que a diferença é exatamente uma leitura de `competitor_video_tier_spans` por canal (ou por lote de 150 ids)** e atualize; acrescente `'competitor_video_tier_spans'` a `HEAVY_TABLES` em `load-fixture.ts`.

- [ ] **Step 6:** `npx vitest run test/youtube/observatorio 2>&1 | tail -15 && npm run typecheck 2>&1 | tail -3` → verde. Depois a suíte inteira com saída em arquivo (como na Tarefa 13, Step 5).

- [ ] **Step 7: commit** (`feat: carregador do Observatório lê a série de todo vídeo e as faixas; pacote em cache na versão 2, com a série semanal fora quando não cabe (A5 E2)`), com `-- apps/web/src/lib/youtube/observatorio apps/web/test/youtube/observatorio`.

**Pronto quando:** item 21 está provado por medição determinística (os dois números ficam no ledger); `pack-shape.test.ts` passa com a versão 2; `loadRows` e `loadChannelRows` continuam dando o mesmo conjunto.

### Task 18 (controlador): o envio do Lote 2

- [ ] **Step 1:** só depois de o Lote 1 estar em `main` e de D+1 conferido (as tabelas da MG2 existem e têm linha).
- [ ] **Step 2:** revisão final do lote pelos dois especialistas, até o acordo.
- [ ] **Step 3: o retrato pelo motor, antes** (item 247): um script descartável (`apps/web/scripts/a5-retrato.ts`, não commitado) que lê produção **só com `select`** pelo cliente de serviço, monta o conjunto de dados com `loadRows` e um corte (`now` = véspera do deploy, 23:59 de São Paulo; série e versões até o corte) e grava, por canal, `{ trocas, vpdMedian, vpd7Median, vpdN }` de `channelStats` e, por vídeo observado, `vpd`, `vpd7` e o múltiplo, em `.superpowers/sdd/a5/retratos/e2-leitor-antes.json`. Rode com o código de `origin/staging` (antes do lote).
- [ ] **Step 4:** envio separado da A4 (roteiro da E12), provado em árvore extraída com a versão de `origin/staging` de `test/helpers/fake-supabase.ts`: `npx vitest run test/youtube/observatorio test/unit/test-hygiene.test.ts` e o typecheck.
- [ ] **Step 5:** push, CI, promoção. O cache antigo (versão 1) é ignorado sozinho: a primeira abertura de cada canal lê o banco e grava a versão 2.
- [ ] **Step 6: o retrato depois:** o mesmo script, o mesmo corte, com o código novo, em `e2-leitor-depois.json`. **Os dois arquivos têm de ser iguais.** Se não forem, reverta os commits 16 e 17 e relate a primeira diferença.
- [ ] **Step 7:** abra a lista de canais e a página do maior canal (um subagente Sonnet com o navegador, no CMS autenticado: `docs/ops/runbook-cms-e2e-local.md`), e confira no Sentry que não há o aviso "não coube no pacote" nem "passou do orçamento" para nenhum canal.

---

## 10. Consultas de conferência (todas testadas em 12/10/2026 no banco local com as migrations aplicadas; R1 também em produção)

Rodar com `npx supabase db query --linked "<consulta>"`. Só `select`.

**K1** (item 1). Vídeo que veio nas últimas 24 h sem resposta guardada. Esperado: 0.

```sql
select count(*) as videos_vistos_sem_raw from competitor_videos v where v.last_seen_at > now() - interval '1 day' and not exists (select 1 from competitor_raw r where r.video_id = v.id and r.is_current);
```

**K2** (itens 2 e 12). Canais sem resposta guardada, sem handle, sem data de criação, nunca vistos. Esperado depois da primeira faixa: `sem_raw = 0` e `nunca_vistos = 0`; `sem_handle` e `sem_criacao` só onde a resposta não trouxe (conferir no `raw`).

```sql
select count(*) as canais, count(*) filter (where not exists (select 1 from competitor_raw r where r.competitor_channel_id = c.id and r.video_id is null and r.is_current)) as sem_raw, count(*) filter (where c.custom_url is null) as sem_handle, count(*) filter (where c.published_at is null) as sem_criacao, count(*) filter (where c.last_seen_at is null) as nunca_vistos from competitor_channels c;
```

**K3** (itens 10 e 224). As últimas linhas da cota. Esperado: uma linha por dia do Pacífico, `units_used` perto de 203, `operations` com a chave `competitors`.

```sql
select date, units_used, operations, to_char(updated_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as atualizado_sp from youtube_quota_usage order by date desc limit 5;
```

**K4** (item 12). Vídeo publicado depois do deploy sem `discovered_at`. **Troque a data pela hora da promoção.** Esperado: 0.

```sql
select count(*) as novos_sem_discovered from competitor_videos where discovered_at is null and published_at > '2026-10-13T18:00:00Z';
```

**K5** (itens 13, 15, 23 e 222). As duas provas, como o cron as lê. Esperado: `videos_vistos_sem_raw`, `canais_vistos_sem_raw`, `canais_em_erro_12h`, `sem_faixa`, `diaria_buracos_3d` e `semanal_atrasados` em 0; depois das 18:00 de São Paulo, `diaria_sem_ponto_hoje` em 0.

```sql
select public.competitor_capture_health(s.id, now()) as captura, public.competitor_series_health(s.id, now()) as serie from (select distinct site_id as id from competitor_channels) s;
```

**K6** (risco 1). O `raw`: quantas respostas correntes e quantas fechadas, e o tamanho. Esperado em D+3: `fechadas` abaixo de 5% de `correntes`; `maior_bytes` muito abaixo de 100.000.

```sql
select count(*) filter (where is_current) as correntes, count(*) filter (where not is_current) as fechadas, max(pg_column_size(raw)) as maior_bytes, avg(pg_column_size(raw))::int as media_bytes, pg_total_relation_size('public.competitor_raw') as tabela_bytes from competitor_raw;
```

**K7** (volume). Histórico de campo por campo: linhas, mudanças de verdade e mudanças em buraco.

```sql
select field, (video_id is null) as do_canal, count(*) as linhas, count(*) filter (where precision <> 'first') as mudancas, count(*) filter (where precision = 'gap') as em_buraco from competitor_field_versions group by 1, 2 order by 4 desc, 1;
```

**K8** (item 16). Vídeo descoberto em até 24 h, já com 72 h, com menos de 8 leituras das primeiras horas. Esperado: vazio (tolerância: 1 faixa perdida dá 7; menos que isso é falha).

```sql
select v.video_id, to_char(v.published_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as publicado_sp, to_char(v.discovered_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as descoberto_sp, count(e.taken_at) as leituras from competitor_videos v left join competitor_video_early e on e.video_id = v.id where v.discovered_at is not null and v.discovered_at - v.published_at <= interval '24 hours' and v.published_at < now() - interval '72 hours' and coalesce(v.views_hidden, false) = false and v.missing_since is null group by v.id having count(e.taken_at) < 8 order by 2;
```

**K9** (item 23). Vídeos por faixa, e quantos estão promovidos. Esperado em D0: cerca de 674 em diária e 716 em semanal, nenhum sem faixa.

```sql
select coalesce(series_tier, '(sem faixa)') as faixa, count(*) as videos, count(*) filter (where daily_until >= (now() at time zone 'America/Sao_Paulo')::date) as promovidos from competitor_videos where missing_since is null group by 1 order by 1;
```

**K10** (item 23). Por canal: quantos em cada faixa e quantos têm ponto hoje.

```sql
select c.channel_name, count(*) filter (where v.series_tier = 'diaria') as diaria, count(*) filter (where v.series_tier = 'semanal') as semanal, count(*) filter (where d.video_id is not null) as com_ponto_hoje from competitor_channels c join competitor_videos v on v.competitor_channel_id = c.id left join competitor_video_daily d on d.video_id = v.id and d.snap_date = (now() at time zone 'America/Sao_Paulo')::date group by c.id order by 1;
```

**K11** (volume). O tamanho real das tabelas novas (corrige a seção 5).

```sql
select t.relname as tabela, pg_total_relation_size(t.oid) as bytes, (select reltuples::bigint from pg_class where oid = t.oid) as linhas_est from pg_class t join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public' and t.relname in ('competitor_field_versions', 'competitor_raw', 'competitor_video_early', 'competitor_video_tier_spans', 'competitor_video_daily', 'competitor_videos', 'competitor_removed_items') order by 2 desc;
```

**K12** (tempo). Quanto cada canal levou na última sincronização (a diferença até o início do seguinte, dentro do mesmo disparo). Compare com 21 s.

```sql
select left(channel_name, 22) as canal, to_char(last_ok_synced_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI:SS') as inicio_sp, round(extract(epoch from lead(last_ok_synced_at) over (order by last_ok_synced_at) - last_ok_synced_at)) as segundos_ate_o_proximo, sync_status from competitor_channels order by last_ok_synced_at;
```

**K13** (itens 6, 7, 8 e 225). Os sinalizadores: uma falta, ausentes, sem contagem, comentários desligados, curtidas ocultas, ao vivo, e quantos `comment_count = 0` restam (eram 64).

```sql
select count(*) filter (where miss_streak = 1) as uma_falta, count(*) filter (where missing_since is not null) as ausentes, count(*) filter (where views_hidden) as sem_contagem, count(*) filter (where comments_disabled) as comentarios_desligados, count(*) filter (where likes_hidden) as curtidas_ocultas, count(*) filter (where was_live) as ao_vivo_ou_estreia, count(*) filter (where comment_count = 0) as comentarios_zero from competitor_videos;
```

**K14** (item 222). As faixas no tempo: linhas, abertas, primeira e última data.

```sql
select tier, count(*) as linhas, count(*) filter (where to_date is null) as abertas, min(from_date) as primeira, max(from_date) as ultima from competitor_video_tier_spans group by 1 order by 1;
```

**R1** (item 247). O retrato por canal, com corte fixo. **Troque as duas datas pelo corte** (`<D+1>T02:59:59Z` e `D`). Rodar antes do deploy e em D+8, com o mesmo corte: os dois resultados têm de ser iguais.

```sql
select c.channel_name, count(*) filter (where x.field in ('title', 'thumb') and x.precision <> 'first' and x.first_seen_at <= '2026-10-12T02:59:59Z') as trocas_ate_o_corte, (select count(*) from competitor_video_daily d join competitor_videos v2 on v2.id = d.video_id where v2.competitor_channel_id = c.id and d.snap_date <= '2026-10-11') as linhas_serie, (select coalesce(sum(d.views), 0) from competitor_video_daily d join competitor_videos v2 on v2.id = d.video_id where v2.competitor_channel_id = c.id and d.snap_date <= '2026-10-11') as soma_views, (select count(*) from competitor_changes g join competitor_videos v3 on v3.id = g.video_id where v3.competitor_channel_id = c.id and g.detected_at <= '2026-10-12T02:59:59Z') as mudancas from competitor_channels c left join competitor_videos v on v.competitor_channel_id = c.id left join competitor_video_versions x on x.video_id = v.id group by c.id order by 1;
```


## 11. Onde está cada item de aceite

| Item | Onde é provado |
|---|---|
| 1, 2 | Tarefa 7 (teste); em produção: K1, K2 e a prova embutida (`videos_vistos_sem_raw`, `canais_vistos_sem_raw`) |
| 3, 4, 5 | Tarefas 2 e 4 (JSON canônico, plano); Tarefa 7 (segunda rodada); Tarefa 1 (A, B, A no banco) |
| 6 | Tarefas 3 e 6 |
| 7 | Tarefas 4 e 8; Tarefa 1 (a função no banco) |
| 8 | Tarefas 3 e 6 |
| 9 | Tarefa 15, Step 8 (retrato R1 antes e depois); D3 cumprido por construção (nenhum tipo novo em `competitor_video_versions.field`); o corpo de `competitors/changes` não muda porque nenhum arquivo de `lib/pipeline` é tocado |
| 10 | Tarefa 9; K3 |
| 11 | Tarefa 1 (bloco de RLS) |
| 12 | K2 e K4 (com a hora da promoção); a parte "todo canal visto tem `raw`" também na prova embutida |
| 13 | Tarefa 10 (exclusões); a prova embutida (`diaria_sem_ponto_hoje`), Tarefas 12 e 13 |
| 14 | Tarefas 5 e 10 |
| 15 | a prova embutida (`semanal_atrasados`) a partir de D+8; K5 |
| 16 | Tarefa 11; K8 em D+3. **Com a E15 o número passa de 8 para 60 leituras** (emenda v2.1): fica para o plano da E15 |
| 17 | Tarefas 5 e 11 (promoção por ganho e por troca); a volta a semanal no dia 29 é a regra `daily_until >= hoje` (Tarefa 5), sem apagar linha |
| 18 | Tarefas 5 e 10; `operations.teto_diario_cortados` (Tarefa 9) |
| 19 | Tarefa 16 |
| 20 | Tarefa 16 (conjunto de dados idêntico nos campos antigos); Tarefa 18 (retrato pelo motor) |
| 21 | Tarefa 17 |
| 22 | Tarefa 13 |
| 23 | K9, K10 e a prova embutida (`semanal_atrasados`, que é a consulta corrigida do item) |
| 221 | Tarefas 1 e 8 |
| 222 | Tarefa 1 (a função, inclusive duas trocas no mesmo dia); Tarefa 10 (a sincronização); Tarefa 16 (o motor); `sem_faixa` na prova embutida (a consulta do item) |
| 223 | Tarefas 4 e 7; Tarefa 14 (com resposta real) |
| 224 | Tarefa 1 (concorrência no banco); Tarefa 9 (dia do Pacífico, total por modo) |
| 225 | Tarefas 3 e 10; `fora_da_prova` na resposta do cron |
| 245 | não se aplica: este plano não cria variável de ambiente |
| 246 | desvio D-10: provas dentro do cron; datas absolutas no ledger (Tarefa 15, Step 5) |
| 247 | Tarefa 15 (R1) e Tarefa 18 (retrato pelo motor) |
| OP-15 | seção 8 e Tarefa 11 |

**O que este plano não faz, por ser de outra etapa:** a fila "Saíram do YouTube" e a função de apagar (E9; a tabela `competitor_removed_items` já nasce na MG1); as medidas M1 a M10 e as marcas (E4); qualquer tela (E5); a leitura de hora em hora (E15) e a agenda (E16); o `campos=todos` do Cowork (E7).

## 12. Riscos que ficam, ditos sem suavizar

1. **O `raw` real pode mudar sozinho entre duas leituras** (um campo da resposta que o YouTube varia sem o criador mexer). Não dá para saber sem ler a API: a Tarefa 14 testa num canal antes do push, e K6 acompanha em D+1 e D+3. Se acontecer em produção, o custo é volume (cerca de 3 kB por vídeo por leitura), não perda; o conserto é excluir o campo em `rawOf`.
2. **O tempo por canal é estimativa até a Tarefa 14 e o D0.** A faixa das 12:00 já usa dois disparos hoje. Se o acréscimo for o dobro do estimado, continua em dois disparos com 15 canais e passa a três com 17 ou mais; a série diária é protegida pelo corte dos 150 s.
3. **A primeira semana grava de 8 a 10 MB**, e o plano gratuito tem 500 MB (hoje 179). Não muda o mês em que o banco enche de forma relevante (cerca de 2 semanas de crescimento normal), mas é um degrau visível.
4. **Um canal que fique em erro para sempre deixa o cron vermelho para sempre** (a prova "canais em erro há mais de 12 h"). É de propósito: hoje isso fica verde. O fim é o dono remover o canal, ou o canal sumir duas vezes seguidas (aí é "ausente" e sai da prova).
5. **A miniatura dos vídeos antigos continua sem conferência** (pergunta 1), e as trocas de título anteriores ao deploy em vídeos nunca conferidos não aparecem (não há com o que comparar).
6. **O Lote 2 muda `rowsToDataset`**: é a função por onde todas as telas do Observatório passam. A proteção é o teste de igualdade do conjunto de dados, os testes de paridade com o oráculo e o retrato pelo motor antes e depois; ainda assim é o ponto de maior raio de alcance do plano, e por isso vai em envio separado.
7. **As 64 linhas com `comment_count = 0` de hoje** só são corrigidas quando cada vídeo for relido: os 716 semanais, ao longo dos 7 primeiros dias.

## Apêndice A: MG1 (`npm run db:new observatorio_a5_e1_campos_sinalizadores_raw`)

Provada em 12/10/2026 no banco local: aplicada duas vezes seguidas sem erro, com o roteiro de asserções da Tarefa 1, dentro de transação desfeita.

```sql
-- =============================================================================
-- MIGRATION MG1: observatorio_a5_e1_campos_sinalizadores_raw
-- =============================================================================
-- Fase A5 do Observatório, etapa E1 (spec v2.3, arquivo 01, seção 4.1; tabela da E9, seção 4.5).
-- O que traz: colunas de estado e sinalizadores em competitor_videos e competitor_channels; histórico de
-- campo (competitor_field_versions); resposta crua só quando muda (competitor_raw); o registro do que foi
-- apagado (competitor_removed_items, usado pela E9); a soma atômica da cota (youtube_quota_add); a marcação
-- de ausência em duas leituras (competitor_mark_missing, competitor_channel_mark_missing); a prova embutida
-- da captura (competitor_capture_health); e competitor_channel_removal_impact contando as tabelas novas.
--
-- Idempotência: add column if not exists, create table/index if not exists, create or replace function,
-- drop policy if exists antes de create policy, drop default (não falha sem default). Reexecutar é seguro.
-- Compatibilidade com o código em produção ANTES do deploy da E1: só acrescenta. Nenhuma coluna existente
-- muda de tipo nem ganha NOT NULL; o único escritor de competitor_videos (competitor-sync.ts) já manda os
-- três contadores no insert, então tirar o default 0 não muda o que ele grava; youtube_quota_usage tem 0
-- linhas e nenhum escritor; competitor_channel_removal_impact só ganha chaves (o leitor ignora as extras).
-- Segurança: funções security invoker, search_path vazio, nomes qualificados; execute só para service_role.

-- 1. Estado atual do vídeo (nulo = a API não devolveu / ainda não lido pelo código novo)
alter table public.competitor_videos
  add column if not exists discovered_at timestamptz,
  add column if not exists default_language text,
  add column if not exists default_audio_language text,
  add column if not exists live_broadcast_content text,
  add column if not exists live_scheduled_start_at timestamptz,
  add column if not exists live_actual_start_at timestamptz,
  add column if not exists live_actual_end_at timestamptz,
  add column if not exists was_live boolean,
  add column if not exists comments_disabled boolean,
  add column if not exists likes_hidden boolean,
  add column if not exists views_hidden boolean,
  add column if not exists miss_streak smallint not null default 0,
  add column if not exists miss_first_at timestamptz,
  add column if not exists missing_since date,
  add column if not exists last_seen_at timestamptz,
  add column if not exists removal_decision text check (removal_decision in ('manter')),
  add column if not exists removal_decided_at timestamptz,
  add column if not exists removal_decided_by uuid;
alter table public.competitor_videos alter column view_count drop default;
alter table public.competitor_videos alter column like_count drop default;
alter table public.competitor_videos alter column comment_count drop default;

comment on column public.competitor_videos.discovered_at is 'Instante da 1ª leitura do vídeo pelo Observatório. Nulo nas linhas anteriores à MG1: nunca preenchido por palpite.';
comment on column public.competitor_videos.miss_streak is 'Leituras SEGUIDAS em que o vídeo foi pedido a videos.list e não veio. Zera quando ele vem. Teto 32000.';
comment on column public.competitor_videos.miss_first_at is 'Instante da 1ª leitura sem o vídeo da sequência atual (miss_streak >= 1). Nulo quando o vídeo veio. É de onde sai a data de missing_since.';
comment on column public.competitor_videos.missing_since is 'Data (São Paulo) da 1ª das duas leituras seguidas sem o vídeo. Nulo = veio, ou faltou uma vez só.';
comment on column public.competitor_videos.last_seen_at is 'Última leitura em que o vídeo VEIO. Só o código da E1 em diante escreve.';
comment on column public.competitor_videos.views_hidden is 'A última resposta veio sem viewCount (estatística oculta ou estreia agendada). Vídeo assim fica fora das provas de série.';

-- 2. Estado atual do canal
alter table public.competitor_channels
  add column if not exists custom_url text,
  add column if not exists description text,
  add column if not exists published_at timestamptz,
  add column if not exists country text,
  add column if not exists subscribers_hidden boolean,
  add column if not exists miss_streak smallint not null default 0,
  add column if not exists miss_first_at timestamptz,
  add column if not exists missing_since date,
  add column if not exists last_seen_at timestamptz,
  add column if not exists removal_decision text check (removal_decision in ('manter')),
  add column if not exists removal_decided_at timestamptz,
  add column if not exists removal_decided_by uuid;
alter table public.competitor_channel_snapshots
  add column if not exists subscribers_hidden boolean;

-- 3. Histórico de campo: uma linha por valor, com início, fim e precisão
create table if not exists public.competitor_field_versions (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  video_id uuid references public.competitor_videos(id) on delete cascade,
  field text not null,
  value jsonb,
  value_hash text not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  window_start timestamptz,
  precision text not null check (precision in ('6h', '1d', '7d', 'gap', 'first')),
  is_current boolean not null default true
);
create unique index if not exists idx_cfv_one_current_video
  on public.competitor_field_versions (video_id, field) where is_current and video_id is not null;
create unique index if not exists idx_cfv_one_current_channel
  on public.competitor_field_versions (competitor_channel_id, field) where is_current and video_id is null;
create index if not exists idx_cfv_channel_seen
  on public.competitor_field_versions (competitor_channel_id, first_seen_at);
alter table public.competitor_field_versions enable row level security;
drop policy if exists "competitor_field_versions_select" on public.competitor_field_versions;
create policy "competitor_field_versions_select" on public.competitor_field_versions
  for select using (public.can_view_site(site_id));

-- 4. Resposta das partes pedidas, só quando muda
create table if not exists public.competitor_raw (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  video_id uuid references public.competitor_videos(id) on delete cascade,
  raw_sha256 text not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  is_current boolean not null default true,
  raw jsonb not null
);
create unique index if not exists idx_craw_one_current_video
  on public.competitor_raw (video_id) where is_current and video_id is not null;
create unique index if not exists idx_craw_one_current_channel
  on public.competitor_raw (competitor_channel_id) where is_current and video_id is null;
alter table public.competitor_raw enable row level security;
drop policy if exists "competitor_raw_select" on public.competitor_raw;
create policy "competitor_raw_select" on public.competitor_raw
  for select using (public.can_edit_site(site_id));

-- 5. O que sobra depois de "apagar" (E9): uma linha sem conteúdo
create table if not exists public.competitor_removed_items (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  kind text not null check (kind in ('video', 'canal', 'comentario')),
  youtube_id text not null,
  competitor_channel_id uuid,
  missing_since date,
  decided_at timestamptz not null default now(),
  decided_by uuid not null,
  rows_deleted jsonb not null,
  blobs_pending text[] not null default '{}',
  archive_pending boolean not null default false,
  purge_count smallint not null default 1,
  returned_seen_at timestamptz,
  return_decision text check (return_decision in ('voltar', 'ignorar')),
  return_decided_at timestamptz,
  unique (site_id, kind, youtube_id)
);
alter table public.competitor_removed_items enable row level security;
drop policy if exists "competitor_removed_items_select" on public.competitor_removed_items;
create policy "competitor_removed_items_select" on public.competitor_removed_items
  for select using (public.can_edit_site(site_id));

-- 6. Escrita atômica do histórico de campo de UM canal (o canal e os vídeos dele), várias linhas por chamada.
--    p_close: [{"id": 123, "last_seen_at": "<última leitura boa do vídeo ou do canal>"}]
--    p_open:  [{"video_id": "<uuid>" | null, "field": "...", "value": <json>, "value_hash": "...",
--               "first_seen_at": "...", "window_start": "..." | null, "precision": "6h|1d|7d|gap|first"}]
create or replace function public.apply_competitor_field_plan(
  p_site_id uuid, p_channel_id uuid, p_close jsonb, p_open jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_closed integer := 0;
  v_opened integer := 0;
  v_asked integer := jsonb_array_length(coalesce(p_open, '[]'::jsonb));
begin
  update public.competitor_field_versions f
     set is_current = false,
         last_seen_at = greatest(f.last_seen_at, coalesce(c.seen, f.last_seen_at))
    from (select (x ->> 'id')::bigint as id, (x ->> 'last_seen_at')::timestamptz as seen
            from jsonb_array_elements(coalesce(p_close, '[]'::jsonb)) x) c
   where f.id = c.id and f.competitor_channel_id = p_channel_id and f.site_id = p_site_id and f.is_current;
  get diagnostics v_closed = row_count;

  insert into public.competitor_field_versions
    (site_id, competitor_channel_id, video_id, field, value, value_hash, first_seen_at, last_seen_at, window_start, precision, is_current)
  select p_site_id, p_channel_id, o.video_id, o.field, o.value, o.value_hash, o.first_seen_at, o.first_seen_at, o.window_start, o.precision, true
    from jsonb_to_recordset(coalesce(p_open, '[]'::jsonb)) as o(
      video_id uuid, field text, value jsonb, value_hash text, first_seen_at timestamptz, window_start timestamptz, precision text)
   where o.video_id is null
      or exists (select 1 from public.competitor_videos v where v.id = o.video_id and v.competitor_channel_id = p_channel_id);
  get diagnostics v_opened = row_count;

  if v_opened <> v_asked then
    raise exception 'apply_competitor_field_plan: % de % versões abertas (vídeo de outro canal?)', v_opened, v_asked;
  end if;
  return jsonb_build_object('closed', v_closed, 'opened', v_opened);
end $$;

-- 7. O mesmo molde para o raw.
--    p_close: [{"id": 123, "last_seen_at": "..."}]
--    p_open:  [{"video_id": "<uuid>" | null, "raw_sha256": "...", "first_seen_at": "...", "raw": {...}}]
create or replace function public.apply_competitor_raw_plan(
  p_site_id uuid, p_channel_id uuid, p_close jsonb, p_open jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_closed integer := 0;
  v_opened integer := 0;
  v_asked integer := jsonb_array_length(coalesce(p_open, '[]'::jsonb));
begin
  update public.competitor_raw r
     set is_current = false,
         last_seen_at = greatest(r.last_seen_at, coalesce(c.seen, r.last_seen_at))
    from (select (x ->> 'id')::bigint as id, (x ->> 'last_seen_at')::timestamptz as seen
            from jsonb_array_elements(coalesce(p_close, '[]'::jsonb)) x) c
   where r.id = c.id and r.competitor_channel_id = p_channel_id and r.site_id = p_site_id and r.is_current;
  get diagnostics v_closed = row_count;

  insert into public.competitor_raw
    (site_id, competitor_channel_id, video_id, raw_sha256, first_seen_at, last_seen_at, is_current, raw)
  select p_site_id, p_channel_id, o.video_id, o.raw_sha256, o.first_seen_at, o.first_seen_at, true, o.raw
    from jsonb_to_recordset(coalesce(p_open, '[]'::jsonb)) as o(
      video_id uuid, raw_sha256 text, first_seen_at timestamptz, raw jsonb)
   where o.video_id is null
      or exists (select 1 from public.competitor_videos v where v.id = o.video_id and v.competitor_channel_id = p_channel_id);
  get diagnostics v_opened = row_count;

  if v_opened <> v_asked then
    raise exception 'apply_competitor_raw_plan: % de % linhas abertas (vídeo de outro canal?)', v_opened, v_asked;
  end if;
  return jsonb_build_object('closed', v_closed, 'opened', v_opened);
end $$;

-- 8. Ausência: soma 1 na sequência de cada vídeo pedido e não devolvido; na 2ª leitura seguida grava
--    missing_since com a data (São Paulo) da PRIMEIRA. Uma instrução só: duas execuções não se atropelam.
--    Devolve o estado de cada vídeo depois da marca (o chamador abre a versão availability = 'sumiu').
create or replace function public.competitor_mark_missing(
  p_channel_id uuid, p_video_ids uuid[], p_now timestamptz
) returns jsonb
language sql security invoker set search_path = '' as $$
  with u as (
    update public.competitor_videos v
       set miss_streak = least(v.miss_streak + 1, 32000),
           miss_first_at = coalesce(v.miss_first_at, p_now),
           missing_since = case
             when v.missing_since is not null then v.missing_since
             when v.miss_streak + 1 >= 2 then (coalesce(v.miss_first_at, p_now) at time zone 'America/Sao_Paulo')::date
             else null end
     where v.id = any(coalesce(p_video_ids, '{}'::uuid[])) and v.competitor_channel_id = p_channel_id
    returning v.id, v.miss_streak, v.miss_first_at, v.missing_since, v.last_seen_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id, 'miss_streak', u.miss_streak, 'miss_first_at', u.miss_first_at,
    'missing_since', u.missing_since, 'last_seen_at', u.last_seen_at)), '[]'::jsonb)
  from u;
$$;

create or replace function public.competitor_channel_mark_missing(
  p_channel_id uuid, p_now timestamptz
) returns jsonb
language sql security invoker set search_path = '' as $$
  with u as (
    update public.competitor_channels c
       set miss_streak = least(c.miss_streak + 1, 32000),
           miss_first_at = coalesce(c.miss_first_at, p_now),
           missing_since = case
             when c.missing_since is not null then c.missing_since
             when c.miss_streak + 1 >= 2 then (coalesce(c.miss_first_at, p_now) at time zone 'America/Sao_Paulo')::date
             else null end
     where c.id = p_channel_id
    returning c.id, c.miss_streak, c.miss_first_at, c.missing_since, c.last_seen_at
  )
  select coalesce((select jsonb_build_object(
    'id', u.id, 'miss_streak', u.miss_streak, 'miss_first_at', u.miss_first_at,
    'missing_since', u.missing_since, 'last_seen_at', u.last_seen_at) from u), 'null'::jsonb);
$$;

-- 9. Cota: soma atômica na linha do dia (o dia é o do Pacífico, calculado por quem chama).
--    p_add: chaves somadas ({"competitors": 12}); p_max: chaves que guardam o maior valor do dia.
alter table public.youtube_quota_usage alter column operations set default '{}'::jsonb;

create or replace function public.jsonb_num_merge(p_base jsonb, p_add jsonb, p_max jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(k.key,
    case when coalesce(p_max, '{}'::jsonb) ? k.key
      then greatest(coalesce((b.o ->> k.key)::numeric, 0), (p_max ->> k.key)::numeric)
      else coalesce((b.o ->> k.key)::numeric, 0) + coalesce((coalesce(p_add, '{}'::jsonb) ->> k.key)::numeric, 0)
    end), '{}'::jsonb)
  from (select case when jsonb_typeof(p_base) = 'object' then p_base else '{}'::jsonb end as o) b,
       lateral (
         select jsonb_object_keys(b.o) as key
         union select jsonb_object_keys(coalesce(p_add, '{}'::jsonb))
         union select jsonb_object_keys(coalesce(p_max, '{}'::jsonb))
       ) k;
$$;

create or replace function public.youtube_quota_add(
  p_site_id uuid, p_day date, p_units integer, p_add jsonb default '{}'::jsonb, p_max jsonb default '{}'::jsonb
) returns integer
language sql security invoker set search_path = '' as $$
  insert into public.youtube_quota_usage as q (site_id, date, units_used, operations, updated_at)
  values (p_site_id, p_day, greatest(coalesce(p_units, 0), 0), public.jsonb_num_merge('{}'::jsonb, p_add, p_max), now())
  on conflict (site_id, date) do update
    set units_used = q.units_used + excluded.units_used,
        operations = public.jsonb_num_merge(q.operations, p_add, p_max),
        updated_at = now()
  returning units_used;
$$;

-- 10. Prova embutida da captura (itens de aceite 1, 2, 10 e 12): o cron lê a cada execução. Só leitura.
--     'canais_em_erro_12h' não conta canal ausente (missing_since): esse está na fila da E9, não é falha de coleta.
create or replace function public.competitor_capture_health(p_site_id uuid, p_now timestamptz)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'videos_vistos_sem_raw', (
      select count(*) from public.competitor_videos v
        join public.competitor_channels c on c.id = v.competitor_channel_id
       where c.site_id = p_site_id and v.last_seen_at > p_now - interval '1 day'
         and not exists (select 1 from public.competitor_raw r where r.video_id = v.id and r.is_current)),
    'canais_vistos_sem_raw', (
      select count(*) from public.competitor_channels c
       where c.site_id = p_site_id and c.last_seen_at > p_now - interval '1 day'
         and not exists (select 1 from public.competitor_raw r
                          where r.competitor_channel_id = c.id and r.video_id is null and r.is_current)),
    'canais_vistos_dia_pacifico', (
      select count(*) from public.competitor_channels c
       where c.site_id = p_site_id
         and c.last_seen_at >= ((p_now at time zone 'America/Los_Angeles')::date)::timestamp at time zone 'America/Los_Angeles'),
    'cota_dia_pacifico', (
      select coalesce(max(q.units_used), 0) from public.youtube_quota_usage q
       where q.site_id = p_site_id and q.date = (p_now at time zone 'America/Los_Angeles')::date),
    'videos_ausentes', (
      select count(*) from public.competitor_videos v
        join public.competitor_channels c on c.id = v.competitor_channel_id
       where c.site_id = p_site_id and v.missing_since is not null),
    'canais_ausentes', (
      select count(*) from public.competitor_channels c where c.site_id = p_site_id and c.missing_since is not null),
    'canais_em_erro_12h', (
      select count(*) from public.competitor_channels c
       where c.site_id = p_site_id and c.sync_status = 'error' and c.missing_since is null
         and c.sync_error_since < p_now - interval '12 hours')
  );
$$;

-- 11. O que a remoção de um canal apagaria: as mesmas chaves de antes, mais as duas tabelas novas.
create or replace function public.competitor_channel_removal_impact(p_site_id uuid, p_channel_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_name text;
begin
  select c.channel_name into v_name from public.competitor_channels c where c.id = p_channel_id and c.site_id = p_site_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'name', v_name,
    'videos', (select count(*) from public.competitor_videos v where v.competitor_channel_id = p_channel_id),
    'pinned', (select count(*) from public.competitor_videos v where v.competitor_channel_id = p_channel_id and v.pinned_at is not null),
    'versions', (select count(*) from public.competitor_video_versions x
                 join public.competitor_videos v on v.id = x.video_id where v.competitor_channel_id = p_channel_id),
    'daily_days', (select count(distinct d.snap_date) from public.competitor_video_daily d
                   join public.competitor_videos v on v.id = d.video_id where v.competitor_channel_id = p_channel_id),
    'bookmarks', (select count(*) from public.competitor_changes g
                  join public.competitor_videos v on v.id = g.video_id where v.competitor_channel_id = p_channel_id and g.bookmarked is true),
    'field_versions', (select count(*) from public.competitor_field_versions f where f.competitor_channel_id = p_channel_id),
    'raw', (select count(*) from public.competitor_raw r where r.competitor_channel_id = p_channel_id)
  );
end $$;

-- 12. Quem executa
revoke all on function public.apply_competitor_field_plan(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.apply_competitor_raw_plan(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.competitor_mark_missing(uuid, uuid[], timestamptz) from public, anon, authenticated;
revoke all on function public.competitor_channel_mark_missing(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.youtube_quota_add(uuid, date, integer, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.jsonb_num_merge(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.competitor_capture_health(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.competitor_channel_removal_impact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_competitor_field_plan(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.apply_competitor_raw_plan(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.competitor_mark_missing(uuid, uuid[], timestamptz) to service_role;
grant execute on function public.competitor_channel_mark_missing(uuid, timestamptz) to service_role;
grant execute on function public.youtube_quota_add(uuid, date, integer, jsonb, jsonb) to service_role;
grant execute on function public.jsonb_num_merge(jsonb, jsonb, jsonb) to service_role;
grant execute on function public.competitor_capture_health(uuid, timestamptz) to service_role;
grant execute on function public.competitor_channel_removal_impact(uuid, uuid) to service_role;
```

## Apêndice B: MG2 (`npm run db:new observatorio_a5_e2_serie_faixas`)

Provada junto com a MG1, nas mesmas condições. **Só depois da MG1.**

```sql
-- =============================================================================
-- MIGRATION MG2: observatorio_a5_e2_serie_faixas
-- =============================================================================
-- Fase A5 do Observatório, etapa E2 (spec v2.3, arquivo 01, seção 4.3). DEPENDE da MG1 (usa views_hidden,
-- missing_since, live_broadcast_content e as tabelas competitor_field_versions e competitor_raw).
-- O que traz: a faixa de série de cada vídeo (diária ou semanal) e a promoção por 28 dias; as primeiras
-- horas (competitor_video_early); a faixa em vigor NO TEMPO (competitor_video_tier_spans), sem a qual um
-- buraco de dias seria lido como "intervalo semanal"; a troca de faixa atômica (apply_competitor_tier_plan);
-- a prova embutida da série (competitor_series_health); e a contagem de remoção com as duas tabelas novas.
--
-- Idempotência e compatibilidade: como a MG1. competitor_video_daily NÃO muda de forma.

alter table public.competitor_videos
  add column if not exists series_tier text check (series_tier in ('diaria', 'semanal')),
  add column if not exists series_tier_since date,
  add column if not exists daily_until date;

create table if not exists public.competitor_video_early (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  taken_at timestamptz not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  views bigint not null,
  likes bigint,
  comments bigint,
  primary key (video_id, taken_at)
);
alter table public.competitor_video_early enable row level security;
drop policy if exists "competitor_video_early_select" on public.competitor_video_early;
create policy "competitor_video_early_select" on public.competitor_video_early
  for select using (public.can_view_site(site_id));

create table if not exists public.competitor_video_tier_spans (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  from_date date not null,
  to_date date,
  tier text not null check (tier in ('diaria', 'semanal')),
  site_id uuid not null references public.sites(id) on delete cascade,
  primary key (video_id, from_date),
  check (to_date is null or to_date >= from_date)
);
create unique index if not exists idx_cvts_one_open
  on public.competitor_video_tier_spans (video_id) where to_date is null;
alter table public.competitor_video_tier_spans enable row level security;
drop policy if exists "competitor_video_tier_spans_select" on public.competitor_video_tier_spans;
create policy "competitor_video_tier_spans_select" on public.competitor_video_tier_spans
  for select using (public.can_view_site(site_id));

-- Troca de faixa de vários vídeos de UM canal, numa transação: fecha a faixa anterior no dia de ontem,
-- abre a nova hoje e grava o estado no vídeo. A 2ª troca do mesmo dia troca a faixa da linha aberta de
-- hoje (sem fechar nem abrir linha): o dia vale pela faixa em que terminou.
--   p_changes: [{"video_id": "<uuid>", "tier": "diaria" | "semanal"}]
create or replace function public.apply_competitor_tier_plan(
  p_site_id uuid, p_channel_id uuid, p_changes jsonb, p_today date
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  r record;
  v_changed integer := 0;
begin
  for r in
    select x.video_id, x.tier
      from jsonb_to_recordset(coalesce(p_changes, '[]'::jsonb)) as x(video_id uuid, tier text)
      join public.competitor_videos v on v.id = x.video_id and v.competitor_channel_id = p_channel_id
     where v.series_tier is distinct from x.tier
     order by x.video_id
  loop
    update public.competitor_video_tier_spans s
       set tier = r.tier
     where s.video_id = r.video_id and s.from_date = p_today and s.to_date is null;
    if not found then
      update public.competitor_video_tier_spans s
         set to_date = p_today - 1
       where s.video_id = r.video_id and s.to_date is null and s.from_date < p_today;
      insert into public.competitor_video_tier_spans (video_id, from_date, to_date, tier, site_id)
      values (r.video_id, p_today, null, r.tier, p_site_id);
    end if;
    update public.competitor_videos
       set series_tier = r.tier, series_tier_since = p_today
     where id = r.video_id;
    v_changed := v_changed + 1;
  end loop;
  return jsonb_build_object('changed', v_changed);
end $$;

-- Prova embutida da série (itens de aceite 13, 15, 23 e 222): o cron lê a cada execução. Só leitura.
-- Ficam FORA de todas as contas: vídeo sem contagem de views (views_hidden), estreia agendada, vídeo
-- ausente (missing_since) e vídeo de canal ausente. 'fora_da_prova' diz quantos são.
create or replace function public.competitor_series_health(p_site_id uuid, p_now timestamptz)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with hoje as (select (p_now at time zone 'America/Sao_Paulo')::date as d),
  vid as (
    select v.id, v.series_tier,
           (coalesce(v.views_hidden, false) or coalesce(v.live_broadcast_content, 'none') = 'upcoming'
            or v.missing_since is not null or c.missing_since is not null) as fora,
           -- o canal já foi lido pelo código da E2 e terminou uma sincronização boa nas últimas 24 h
           (c.last_seen_at is not null and c.last_ok_synced_at > p_now - interval '1 day') as canal_em_dia
      from public.competitor_videos v
      join public.competitor_channels c on c.id = v.competitor_channel_id
     where c.site_id = p_site_id
  )
  select jsonb_build_object(
    'hoje', (select d from hoje),
    'hora_sp', extract(hour from p_now at time zone 'America/Sao_Paulo')::int,
    'fora_da_prova', (select count(*) from vid where fora),
    'sem_faixa', (
      select count(*) from vid
       where not fora and (
         (series_tier is null and canal_em_dia)
         or (series_tier is not null and not exists (
           select 1 from public.competitor_video_tier_spans s
            where s.video_id = vid.id and s.to_date is null and s.tier = vid.series_tier)))),
    'diaria_sem_ponto_hoje', (
      select count(*) from vid, hoje
       where not fora and series_tier = 'diaria'
         and not exists (select 1 from public.competitor_video_daily d where d.video_id = vid.id and d.snap_date = hoje.d)),
    'diaria_buracos_3d', (
      select count(*) from vid, hoje, generate_series(1, 3) g
        join lateral (select (hoje.d - g)::date as dia) x on true
       where not fora
         and exists (select 1 from public.competitor_video_tier_spans s
                      where s.video_id = vid.id and s.tier = 'diaria'
                        and s.from_date <= x.dia and (s.to_date is null or s.to_date >= x.dia))
         and not exists (select 1 from public.competitor_video_daily d where d.video_id = vid.id and d.snap_date = x.dia)),
    'semanal_atrasados', (
      select count(*) from vid, hoje
       where not fora and series_tier = 'semanal'
         and exists (select 1 from public.competitor_video_tier_spans s
                      where s.video_id = vid.id and s.to_date is null and s.tier = 'semanal' and s.from_date <= hoje.d - 8)
         and not exists (select 1 from public.competitor_video_daily d where d.video_id = vid.id and d.snap_date > hoje.d - 8)),
    'diaria_total', (select count(*) from vid where not fora and series_tier = 'diaria'),
    'semanal_total', (select count(*) from vid where not fora and series_tier = 'semanal')
  );
$$;

create or replace function public.competitor_channel_removal_impact(p_site_id uuid, p_channel_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_name text;
begin
  select c.channel_name into v_name from public.competitor_channels c where c.id = p_channel_id and c.site_id = p_site_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'name', v_name,
    'videos', (select count(*) from public.competitor_videos v where v.competitor_channel_id = p_channel_id),
    'pinned', (select count(*) from public.competitor_videos v where v.competitor_channel_id = p_channel_id and v.pinned_at is not null),
    'versions', (select count(*) from public.competitor_video_versions x
                 join public.competitor_videos v on v.id = x.video_id where v.competitor_channel_id = p_channel_id),
    'daily_days', (select count(distinct d.snap_date) from public.competitor_video_daily d
                   join public.competitor_videos v on v.id = d.video_id where v.competitor_channel_id = p_channel_id),
    'bookmarks', (select count(*) from public.competitor_changes g
                  join public.competitor_videos v on v.id = g.video_id where v.competitor_channel_id = p_channel_id and g.bookmarked is true),
    'field_versions', (select count(*) from public.competitor_field_versions f where f.competitor_channel_id = p_channel_id),
    'raw', (select count(*) from public.competitor_raw r where r.competitor_channel_id = p_channel_id),
    'early', (select count(*) from public.competitor_video_early e
              join public.competitor_videos v on v.id = e.video_id where v.competitor_channel_id = p_channel_id),
    'tier_spans', (select count(*) from public.competitor_video_tier_spans s
                   join public.competitor_videos v on v.id = s.video_id where v.competitor_channel_id = p_channel_id)
  );
end $$;

revoke all on function public.apply_competitor_tier_plan(uuid, uuid, jsonb, date) from public, anon, authenticated;
revoke all on function public.competitor_series_health(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.competitor_channel_removal_impact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_competitor_tier_plan(uuid, uuid, jsonb, date) to service_role;
grant execute on function public.competitor_series_health(uuid, timestamptz) to service_role;
grant execute on function public.competitor_channel_removal_impact(uuid, uuid) to service_role;
```
