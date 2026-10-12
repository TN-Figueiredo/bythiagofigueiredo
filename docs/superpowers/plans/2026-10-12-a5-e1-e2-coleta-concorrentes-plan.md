# A5 · E1 e E2: coleta dos concorrentes (campos, sinalizadores, `raw`, o que saiu do YouTube, série com faixas no tempo) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Escrito em 12/10/2026 sobre `staging` local em `f6de92d5` (78 commits à frente de `origin/staging` `4843caef`; a diferença é a A4, docs e duplicatas da E12). Produção: `main` `9478979d`, última migration aplicada `20261009000001`. Nenhuma migration deste plano existe ainda como arquivo.

> **Emenda do portão de fim de plano (12/10/2026, fim da tarde).** Os dois revisores sêniores aprovaram com ressalvas e nenhum deixou o plano ser executado como estava: `.superpowers/sdd/a5/revisao-plano-e1-e2-dados.md` (6 importantes, 12 menores) e `.superpowers/sdd/a5/revisao-plano-e1-e2-software.md` (10 importantes, 14 menores). Os 42 achados foram aceitos; a resposta, uma linha por achado, está em `.superpowers/sdd/a5/resposta-revisao-plano-e1-e2.md`, e o texto novo de cada um, para conferência, em `.superpowers/sdd/a5/plano-e1-e2-emenda-relatorio.md`. Todo trecho mexido leva a marca *(emenda do portão: id)*, com o id da resposta (`D-` dados, `S-` software, `CTRL-` decisão do controlador). **As Tarefas 1, 6, 11 e 14 foram divididas e reescritas** (1a e 1b; 6a e 6b; 11a, 11b e 11c; 14a e 14b), e o Lote 2 ganhou a 17b.

**Como ler os números de tarefa depois da divisão.** Onde um trecho anterior à emenda diz "Tarefa 1", leia 1a (as funções) ou 1b (RLS); "Tarefa 6", 6b; "Tarefa 11", 11a (primeiras horas), 11b (a leitura semanal) ou 11c (a promoção); "Tarefa 14", 14a (integração) ou 14b (API real).

**O que mudou nesta emenda, em dez linhas.**

1. **MG1 e MG2 estão no texto definitivo** (Apêndices A e B): três índices, a guarda de site nas três funções de plano, a 2ª falta só depois de 3 horas, a prova da captura por `last_checked_at`, `canais_em_erro_3d`, `competitor_channels.weekly_pass_date`, a condição a mais em `diaria_buracos_3d` e três chaves novas na prova da série. Aplicadas duas vezes seguidas no banco local, numa transação desfeita, com 35 asserções.
2. **A passada semanal virou uma fase própria do disparo** (D-I3 e S-I1, uma solução só): a dívida fica no dado, o canal em dívida é lido primeiro, e nada depende da posição do canal nem da duração da faixa das 18:00. O corte de 150 s saiu.
3. **A miniatura dos vídeos de leitura semanal passa a ser coletada** (regra permanente do dono; pergunta 1, com o padrão "coletar").
4. **Canal em erro permanente:** vermelho por 3 dias; depois, nota em `acao_do_dono` a cada execução, sem calar os outros crons.
5. **A série do dia vem antes de toda gravação nova:** as falhas novas são guardadas e lançadas no fim; a promoção a `main` só entre 12:25 e 17:30 de São Paulo.
6. **A promoção de semanal para diária é decidida pelo estado gravado**, não pelo evento.
7. **A junção TypeScript × SQL tem teste de integração commitado** (Tarefa 14a); o ensaio com a API real só roda contra o banco local, com a guarda em código (Tarefa 14b).
8. **Lote 2:** teste de regressão por consumidor de `rowsToDataset` e `loadRows` (cada tela, o Cowork, a fila da forja) com a semente de e2e; retrato sobre linhas congeladas; **nenhum texto de tela muda**; não vai sem o Lote 1 e a MG2.
9. **Zero `as unknown as` novo em `src`**, e todo `git commit` do plano lista arquivos, nunca pastas.
10. **As conferências com data** estão em `.superpowers/sdd/a5/conferencias-com-data.md` (seção "E1 e E2") e, onde dá, dentro do cron; a Tarefa 15 as passa para `lib/conferencias.ts`, que a Tarefa 6 do plano da E20 cria.

**O que já foi executado ao escrever este plano, e o que não foi** (para o portão de fim de plano saber em que confiar):

| O quê | Como | Resultado |
|---|---|---|
| SQL da MG1 e da MG2 (Apêndices A e B) | banco **local**, dentro de transação com `rollback`; aplicado duas vezes seguidas; roteiro de asserções (A, B, A; segunda corrente recusada; ausência em duas leituras com a data de São Paulo; cota somada e `operations` por chave; duas trocas de faixa no mesmo dia; cascata; quem executa) | passou; o banco local ficou como estava (conferido: 0 tabelas e 0 colunas novas depois) |
| V1 a V3, K1 a K14 e R1 | banco local com as migrations (transação desfeita); V1 e R1 também em produção, só leitura | nenhuma dá erro de SQL |
| Código dos módulos puros (Tarefas 2, 3, 4, 5, a parte de 9 e a 12), extraído **do texto deste plano** | compilado com `strict` e `noUncheckedIndexedAccess`, e os testes do plano rodados, numa pasta fora do repositório | 0 erro de tipo; **85 de 85 testes passam** |
| Edições da Tarefa 16 (motor) aplicadas, como o plano descreve, a uma **cópia** de `src/lib` | os 14 testes novos e a pasta `test/youtube/observatorio` inteira, antes e depois | 14 de 14; os 5.266 testes que rodam na cópia continuam passando, e o conjunto de falhas é idêntico ao de antes (110, todas por arquivo de tela que a cópia não tem) |
| Funções de pacote da Tarefa 17 | o teste de medição do plano, na mesma cópia | maior canal com um ano de série diária e semanal: **665.900** caracteres de 2.000.000; no teto, sem a semanal: 1.641.404 |
| **Não executado** | o código das Tarefas 6 a 11 e 13 (escrito contra o arquivo lido linha a linha, mas não rodado: é onde a revisão por tarefa mais rende); as edições do carregador e da fixture da Tarefa 17; o bloco de RLS da Tarefa 1; a Tarefa 14 (ensaio com a API real) | — |
| *(emenda do portão)* SQL **final** da MG1 e da MG2 | banco local, **uma** transação com `rollback`: MG1, MG2, MG1, MG2 (duas vezes seguidas), V1, V3 e 35 asserções (guarda de site nas três funções; A, B, A; 2ª falta aos 20 minutos não conta e às 6 horas conta, vídeo e canal; a prova da captura nos cinco casos de S-I4; canal em erro às 13 h e aos 4 dias; estreia agendada sem ponto = 0 buracos e buraco de verdade = 2; semanal aos 7, 8 e 9 dias; dia fixo; miniatura) | passou. V1 = 21, 13, 5, 5, 9, 9, `'{}'::jsonb`, 0. Depois do `rollback`: 0 coluna e 0 tabela nova, 4 vídeos e 4 canais como antes, `default 0` de `view_count` intacto, `lock_timeout` em 0 |
| *(emenda do portão)* o dia fixo em SQL × em TypeScript | seis ids no `node` (`sha256`, 4 bytes, módulo 7) e no banco local (a expressão de `competitor_series_health`) | iguais nos seis |
| *(emenda do portão)* consultas de conferência alteradas ou novas que não dependem das migrations | produção, só `select`, uma por comando: V1 (texto novo), K12, K15b, K16 | V1: 0, 0, 0, 0, 0, 0, `'[]'::jsonb`, 3 (antes de aplicar, como esperado). K12, às 16:57 de São Paulo: ainda a faixa das 12:00 (11 canais no primeiro disparo, o 11º aos 197 s). K15b: de 87 a 118 vídeos por dia fixo, de 6 a 9 canais, maior canal de 30 a 45. K16: 1.390 vídeos, 687 sem versão de miniatura, 703 cópias correntes, 0 sem cópia, 5 trocas |
| *(emenda do portão)* **Não executado nesta emenda** | o código novo ou alterado das Tarefas 2, 3, 4, 9, 12 e 13 e o das Tarefas 1b, 6b, 11a, 11b, 11c, 14a, 14b e 17b: os "85 de 85 testes" da linha acima são do texto **anterior** à emenda. As consultas que dependem das migrations (V2, K1, K5, K15, K17) rodaram só no banco local. A medição K12 da faixa das 18:00 (depois das 18:45 de São Paulo) ficou como passo da Tarefa 0: a emenda foi fechada às 17:00 | — |

## 1. Perguntas que só o dono responde

*(emenda do portão: CTRL-a, CTRL-i)* Nenhuma trava o início. Pela regra dele (decisão 44), onde o spec tem padrão vale o padrão; as seis abaixo são decisões que este plano tomou onde o spec não fecha, e que ele pode vetar. Cada uma tem a recomendação e o padrão que vale se ele não responder.

1. **Miniatura dos vídeos de leitura semanal: passa a ser conferida, e a cópia é guardada quando muda.** *(era "não é conferida"; mudou pela regra permanente dele, "coletar mais dado do que as telas usam, com prioridade ao que a origem sobrescreve", e pelo achado D-I4.)* A miniatura é o único dado deste plano que o YouTube sobrescreve: trocou, a imagem antiga some lá, e o endereço não muda. Medido em produção em 12/10: 703 vídeos têm cópia guardada, **687 não têm nenhuma**; nas cópias de hoje, 0 falha de arquivo; em 10 dias, 5 trocas de miniatura. **Como fica:** toda leitura semanal pergunta ao endereço da imagem se ela mudou (uma requisição de cabeçalho, sem custo de cota: não é a Data API) e só baixa a imagem quando o indício muda, como já é feito nos vídeos diários; a primeira leitura de cada um dos 687 guarda a imagem atual. **A conta:** cota, 0 unidade; Blob, 687 arquivos uma vez, cerca de 26 MB (as cópias de hoje têm 38 kB em média, amostra de 12, de 8 a 126 kB; no pior caso, 87 MB), e depois só as trocas; tempo, cerca de 100 s por dia nos sete primeiros dias e cerca de 30 s por dia depois, gastos na fase semanal, que roda nos disparos sem canal devido (não disputa tempo com a faixa das 12:00). **Recomendação e padrão: coletar.** O custo não é desproporcional, então não há meio-termo a propor. Se ele vetar: a fase semanal passa a rodar sem a sonda (opção `thumbs: false`, uma linha na Tarefa 13) e a Tarefa 12 deixa de cobrar `sem_miniatura_9d` (uma linha). Não verificado: a folga do plano do Blob (a conta do Blob não está no banco).
2. **Contagem que o YouTube deixa de devolver passa a ser gravada como "não medido" também nos vídeos fixados.** Hoje, só para vídeo fixado, a contagem antiga é mantida quando o YouTube esconde o contador (decisão da fase de fixar vídeo). O spec aprovado (princípio D2 e item 6) manda nulo mais o sinalizador para todos. O plano segue o spec: a tela passa a dizer "não medido" em vez de mostrar um número velho sem data. Três testes mudam por isso (Tarefa 6b). **Padrão: como está aqui** (os dois revisores aceitaram; o último valor medido continua na série, com a data).
3. **Um envio para a coleta (E1 e E2 juntas) e outro, depois, para o leitor.** O spec põe a E1 e a E2 em ordens seguidas (3 e 4) e permite aplicar a MG1 e a MG2 juntas. Cada push custa 4 builds da Vercel. O plano entrega em dois lotes: **Lote 1** (a coleta inteira: é o que para de perder dado) e **Lote 2** (o motor e o carregador passam a saber ler a série semanal; não perde dado por esperar). **Padrão: dois envios** (os dois revisores aceitaram). *(emenda do portão: S-I8)* O Lote 2 **não vai** sem o Lote 1 em `main` e sem a MG2 aplicada: o carregador novo lê `series_tier`, e sem a coluna todas as telas, o Cowork e a fila da forja cairiam. Promover só a E1 continua possível, mas trava o Lote 2 até a MG2.
4. **Troca de título, descrição ou miniatura num vídeo antigo, vista com até uma semana de atraso: aparece em "Trocas" como qualquer outra, com a janela escrita ("entre dd/mm e dd/mm").** *(emenda do portão: S-M8)* E a troca cuja janela passa de 8 dias (o vídeo ficou mais de uma semana sem ser conferido, o que só acontece nos 29 vídeos antigos que têm versão guardada de antes, ou depois de uma parada da coleta): **também aparece, na tela e no Cowork, com a janela verdadeira, sem aviso e sem promover o vídeo.** O plano original a mostrava na tela e a escondia do Cowork; os dois lugares dariam números diferentes (contra o princípio D3). **Recomendação e padrão: aparece nos dois, com a janela.** A alternativa, esconder dos dois, pede mexer no leitor das telas e fica para a E5 se ele preferir.
5. **A frase "inconclusivo: série semanal" não aparece na tela agora.** *(emenda do portão: S-I8, D-6)* O plano original trocava o motivo do efeito de uma troca num vídeo semanal para essa frase, ao lado do rótulo "sem série", sem mockup. Pela regra dele (aprovação visual antes de código), **nenhum texto de tela muda no Lote 2**: o motivo continua o de hoje, e o motor só guarda o fato num campo novo que nenhuma tela lê (`weeklySeries`). A frase entra com o mockup da E5. **Padrão: não aparece.**
6. **Canal em erro há mais de 12 horas deixa o cron vermelho por 3 dias; depois vira nota.** *(emenda do portão: D-I1, S-M14, CTRL-d)* Hoje isso fica verde. O plano original deixava vermelho para sempre, o que dá 4 avisos por dia sem fim e, como o vigia não repete aviso enquanto o estado é o mesmo, **cala a falha de outro cron** no período. Fica assim: vermelho do 12º hora ao 3º dia; do 3º dia em diante o cron volta a verde e a resposta de **toda execução** traz, em `acao_do_dono`, "canal X em erro desde dd/mm: <motivo>"; o canal segue marcado "erro" na lista de canais. **Sai desse estado** quando o canal sincroniza bem (inclusive por "sincronizar agora"), quando o YouTube deixa de devolvê-lo em duas leituras (vira "ausente", fila da E9), ou quando ele o remove. **Padrão: como está aqui.**

Aviso (não é pergunta): **a primeira semana grava cerca de 8 a 10 MB de uma vez no banco** (a primeira resposta guardada de cada um dos 1.390 vídeos e o primeiro valor de cada campo) **e cerca de 26 MB no Blob** (as 687 miniaturas, pergunta 1). O banco vai de 179 para cerca de 189 MB. Conta na seção 5.

## 2. O que é do dono

**Uma coisa só: aplicar as duas migrations, antes do código.** Nenhum agente roda `db:push:prod`. *(emenda do portão: CTRL)* **O SQL dos Apêndices A e B é o texto definitivo**, saído do acordo dos dois revisores (regra dele, decisão 45): ele aplica uma vez e não mexe depois.

| Passo | Quem | O quê |
|---|---|---|
| 1 | agente (Tarefa 1a) | `npm run db:new observatorio_a5_e1_campos_sinalizadores_raw` e cola o Apêndice A; depois `npm run db:new observatorio_a5_e2_serie_faixas` e cola o Apêndice B. **Nesta ordem** (a MG2 usa colunas e tabelas da MG1; o carimbo de hora do segundo arquivo tem de ser maior). Commit local |
| 2 | agente | prova no banco local (Tarefas 1a e 1b) e as consultas V1 a V3 abaixo rodadas no banco local |
| 3 | **dono** | `npm run db:push:prod` (digita `YES`). Aplica as duas no mesmo comando. *(emenda do portão: S-M12)* O arquivo da MG13 (etapa E20) **já existe** (`20261012000001_observatorio_guarda_do_bruto.sql`); o `db:new` dá às duas daqui um carimbo posterior. Se a MG13 ainda não tiver sido aplicada, vai no mesmo comando, antes delas, e está certo assim (lote A do spec) |
| 4 | agente | roda V1, V2 e V3 em produção (só leitura) e cola o resultado no ledger |
| 5 | agente | só então o push do código (seção 9), e a promoção a `main` **só entre 12:25 e 17:30 de São Paulo** (Tarefa 15) |

*(emenda do portão: D-m12)* **Quando aplicar.** O cron dos concorrentes dispara nos minutos 00, 20 e 40 de toda hora e escreve em `competitor_videos` e `competitor_channels` por até 5 minutos; nas faixas das 00:00, 06:00, 12:00 e 18:00 de São Paulo escreve mais (até o minuto 25). As duas migrations pedem trava exclusiva nessas duas tabelas por milissegundos. **Janela: qualquer hora, nos minutos 07 a 18, 27 a 38 ou 47 a 58, fora das faixas 12:00 a 12:25 e 18:00 a 18:25 de São Paulo.** Se ainda assim houver sessão presa, a primeira linha de cada arquivo (`set lock_timeout = '5s'`) faz o comando falhar em 5 segundos em vez de esperar: é só rodar de novo (os dois arquivos são idempotentes).

**Compatibilidade, nos dois sentidos.**

- **Migration aplicada, código antigo ainda em `main`** (é o estado normal entre os passos 3 e 5, e pode durar dias): nada quebra. As duas migrations só acrescentam: coluna anulável ou com padrão, tabela nova, função nova. As três exceções, conferidas uma a uma: (a) tirar o `default 0` de `view_count`, `like_count` e `comment_count` não muda o que o código antigo grava, porque o único `insert` em `competitor_videos` (`competitor-sync.ts:484`) manda os três campos (lido no código; as três colunas já são anuláveis em produção, medido); (b) o padrão de `youtube_quota_usage.operations` passa de `'[]'` para `'{}'`: a tabela tem 0 linhas e nenhum escritor (medido e lido); (c) `competitor_channel_removal_impact` é recriada com as mesmas chaves e mais quatro: o leitor (`competitor-removal-impact.ts`) confere só as cinco que usa e ignora o resto (lido). A Tarefa 1 prova isso rodando os testes de integração do código **antigo** contra o schema novo, antes de qualquer mudança de código.
- **Código novo sem a migration** (ordem invertida por engano): o cron de concorrentes **para em vermelho na primeira linha e não grava nada**, com a mensagem "migrations MG1/MG2 não aplicadas" (guarda `schemaReady`, Tarefas 9 e 13, com teste). O código antigo faria `update` com coluna inexistente e seguiria em verde; por isso a guarda existe.

**V1: a migration entrou inteira?** *(emenda do portão: a consulta ganhou a coluna `weekly_pass_date` e a contagem dos nove índices)* (testada em 12/10 no banco local com as duas aplicadas, e em produção antes de aplicar: lá deu 0, 0, 0, 0, 0, 0, `'[]'::jsonb`, 3.) Depois de aplicada tem de dar **21, 13, 5, 5, 9, 9, `'{}'::jsonb`, 0**.

```sql
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'competitor_videos' and column_name in ('discovered_at', 'default_language', 'default_audio_language', 'live_broadcast_content', 'live_scheduled_start_at', 'live_actual_start_at', 'live_actual_end_at', 'was_live', 'comments_disabled', 'likes_hidden', 'views_hidden', 'miss_streak', 'miss_first_at', 'missing_since', 'last_seen_at', 'removal_decision', 'removal_decided_at', 'removal_decided_by', 'series_tier', 'series_tier_since', 'daily_until')) as colunas_video_de_21, (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'competitor_channels' and column_name in ('custom_url', 'description', 'published_at', 'country', 'subscribers_hidden', 'miss_streak', 'miss_first_at', 'missing_since', 'last_seen_at', 'removal_decision', 'removal_decided_at', 'removal_decided_by', 'weekly_pass_date')) as colunas_canal_de_13, (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relname in ('competitor_field_versions', 'competitor_raw', 'competitor_removed_items', 'competitor_video_early', 'competitor_video_tier_spans')) as tabelas_com_rls_de_5, (select count(*) from pg_policies where schemaname = 'public' and tablename in ('competitor_field_versions', 'competitor_raw', 'competitor_removed_items', 'competitor_video_early', 'competitor_video_tier_spans')) as policies_de_5, (select count(distinct p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('apply_competitor_field_plan', 'apply_competitor_raw_plan', 'competitor_mark_missing', 'competitor_channel_mark_missing', 'youtube_quota_add', 'jsonb_num_merge', 'competitor_capture_health', 'apply_competitor_tier_plan', 'competitor_series_health')) as funcoes_de_9, (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('idx_cfv_one_current_video', 'idx_cfv_one_current_channel', 'idx_cfv_channel_seen', 'idx_cfv_video_seen', 'idx_craw_one_current_video', 'idx_craw_one_current_channel', 'idx_craw_channel', 'idx_craw_video', 'idx_cvts_one_open')) as indices_de_9, (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'youtube_quota_usage' and column_name = 'operations') as padrao_operations, (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'competitor_videos' and column_name in ('view_count', 'like_count', 'comment_count') and column_default is not null) as contadores_com_padrao;
```

**V2: nada foi tocado nos dados?** Esperado, enquanto o código antigo estiver em `main`: `videos = videos_intactos` (1.390 em 12/10), `canais_intactos = 15`, `linhas_nas_5_tabelas_novas = 0`.

```sql
select (select count(*) from competitor_videos) as videos, (select count(*) from competitor_videos where miss_streak = 0 and missing_since is null and series_tier is null and last_seen_at is null) as videos_intactos, (select count(*) from competitor_channels where miss_streak = 0 and last_seen_at is null and weekly_pass_date is null) as canais_intactos, (select count(*) from competitor_field_versions) + (select count(*) from competitor_raw) + (select count(*) from competitor_video_early) + (select count(*) from competitor_video_tier_spans) + (select count(*) from competitor_removed_items) as linhas_nas_5_tabelas_novas;
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
- *(emenda do portão: S-I2)* **Todo `git commit` lista ARQUIVOS, nunca pastas.** `git commit -- <pasta>` leva todo arquivo rastreado e modificado debaixo dela, mesmo sem `git add`, e a A4 (local, inacabada) tem arquivos modificados em `apps/web/test/youtube/observatorio/` e em `apps/web/src/lib/youtube/observatorio/`. Antes de todo commit: `git diff --cached --name-only` tem de mostrar **só** arquivos da lista da seção 9; e o commit usa a mesma lista do `git add`. Um arquivo fora da lista é parada: não commite, relate.
- *(emenda do portão: S-I3)* **Nenhum `as unknown as` novo em `apps/web/src`.** A trava `scripts/check-type-debt.sh` roda no pre-push e na CI e falha se a contagem subir (baseline 148). Leitura do banco com forma conhecida passa por `rowsAs` (Tarefa 4), que confere a forma em vez de afirmar. As Tarefas 4, 10, 11b e 12 rodam `bash scripts/check-type-debt.sh` na verificação. Em arquivo de teste o cast continua livre (a trava não os conta).
- **Nada escreve em produção.** Migration é do dono. Leitura de produção só por `npx supabase db query --linked "<select>"`.
- *(emenda do portão: S-I7, CTRL-f)* **`apps/web/.env.local` aponta para PRODUÇÃO** (`NEXT_PUBLIC_SUPABASE_URL` e a chave de serviço). Nenhum script deste plano roda com esse arquivo carregado sem a guarda em código que aborta fora de `127.0.0.1` ou `localhost` (Tarefa 14b). Os testes com banco usam `HAS_LOCAL_DB=1` e o ambiente de teste, como o resto do projeto.
- *(emenda do portão: D-m11)* O TypeScript calcula o dia de São Paulo com deslocamento fixo de 3 horas (`spDate`, que já existe) e o SQL usa `America/Sao_Paulo`: dão o mesmo dia enquanto o Brasil não tiver horário de verão (não tem desde 2019). Comportamento que já existe; não é mudado aqui.
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
4. *(emenda do portão: D-I3, S-I1)* **O relógio do disparo acaba no meio da fase semanal, e a ordem dos canais é a mesma todo dia.** Esperado: o vídeo que não chegou a ser conferido não ganha o ponto do dia (o ponto é o recibo), o canal não é carimbado em `weekly_pass_date`, e no disparo seguinte ele é o primeiro da fase. Nenhum canal fica sem a passada do dia por causa da posição. Testes nas Tarefas 11b (o recibo) e 13 (as duas faixas, 15 canais na ordem estável).
5. **A função de prova devolve nulo ou uma forma inesperada** (função ausente, erro de rede). Esperado: o cron fica vermelho com "não foi possível ler a prova"; nunca verde. Teste na Tarefa 12.

---

## 3. Fatos medidos em produção em 12/10/2026 (só `select`, por `npx supabase db query --linked`)

| Fato | Valor | Para que serve |
|---|---|---|
| Canais concorrentes, sites | 15, 1 | todas as contas |
| Vídeos guardados | 1.390 (0 sem `published_at`, 0 fixados, 0 com `view_count` nulo) | volume, faixas |
| Com linha de série no último dia (12/10) | 674 | conjunto diário de hoje |
| Fora da série (viram faixa semanal) | 716; por canal: 235, 223, 88, 85, 45, 22, 7, 6, 2, 2, 1 e quatro canais com 0 *(emenda do portão: D-m6; recontado em produção, soma 716)* | cota e tempo da passada semanal |
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
| *(emenda do portão: S-I1)* **A ordem dos canais na faixa das 12:00 é a mesma todo dia** | medido pelo revisor de software em 10, 11 e 12/10, ao segundo: a posição 7 começa às 12:02:47 (167 s do disparo), a 11 às 12:04:06. As posições 7 a 11 somam 376 dos 716 vídeos semanais (53%) | por que o corte fixo de 150 s do plano original nunca deixaria esses canais lerem os semanais |
| *(emenda do portão)* Disparos com canal devido, por dia | 8 dos 72: dois por faixa (o da hora cheia e o dos 20 minutos). Entre 12:00 e 23:40 de São Paulo, 4 de 36 | a fase semanal tem 32 disparos por dia sem nenhum canal devido |
| *(emenda do portão: D-I3)* Vídeos semanais por dia fixo (K15b, em produção) | 118, 99, 116, 92, 87, 99, 105 (soma 716); de 6 a 9 canais com vídeo devido por dia; no maior canal, de 30 a 45 por dia | o trabalho de um dia da fase semanal |
| *(emenda do portão: D-I4)* Miniaturas (K16, em produção) | 708 versões, 703 correntes, **0 sem cópia no Blob**, 5 trocas em 10 dias; 687 vídeos sem versão nenhuma. Cópias guardadas: média de 38 kB (amostra de 12 por `HEAD`: de 8 a 126 kB) | pergunta 1; a conta do Blob |

**Não medido, declarado estimativa onde aparecer:** *(emenda do portão)* a duração por canal na faixa das 18:00 (K12 só guarda a última faixa; medir depois das 18:45 de São Paulo é o Step 4 da Tarefa 0, e o desenho da fase semanal **não depende** desse número); o tempo de uma sonda de miniatura com arquivo (suposto 1 s; a sonda sem arquivo é ≈ 0,3 s, deduzida dos 15 s que ela pesa hoje nos 50 vídeos de um canal); a folga do Blob; o tempo de ida e volta ao banco a partir da Vercel (suposto 50 ms; a Tarefa 14 mede); o tamanho real de uma resposta `videos.list` com as quatro partes (o banco não guarda nenhuma hoje); quantos vídeos antigos trocaram de título desde a última vez que foram vistos; o atraso do disparo da Vercel na hora cheia (o primeiro canal começa 49 s depois das 12:00: inclui o atraso e a sonda de controle; é a conferência C0.5, da E16).

**Medido no banco local, com dado sintético** (1.000 vídeos, resposta de 3,9 kB com descrição repetitiva; transação desfeita): `competitor_field_versions` **296 B por linha** com os três índices; `competitor_raw` **1.507 B por linha** (a descrição sintética comprime melhor que a real: o real fica entre 2 e 3 kB, estimativa); `competitor_video_tier_spans` 246 B; `competitor_video_early` 156 B.

**Medido por simulação determinística** (o teste da Tarefa 17, rodado em 12/10 numa cópia do motor; dado sintético com a forma do pacote): o pacote em cache do maior canal (285 vídeos, 50 diários) com um ano de série diária **e semanal** tem **665.900 caracteres (33% do teto de 2 milhões)**; só com a diária, cerca de 431 mil. No teto de 200 diários mais 800 semanais não cabe (cerca de 2,5 milhões); sem a semanal, 1.641.404 (82%). Por isso a Tarefa 17 leva a série semanal no pacote e tem a saída de emergência do spec, com teste.

## 4. A conta: cota

A Data API cobra 1 unidade por chamada `videos.list`, `channels.list` e `playlistItems.list`, qualquer que seja o número de partes (documentação oficial; inventário 2.3). Pedir `liveStreamingDetails` não custa nada.

| Parcela | Por canal por dia | 15 canais | 20 canais | Base |
|---|---|---|---|---|
| Sincronização de hoje: 4 faixas × (canal + página de uploads + detalhes) | 12 | 180 | 240 | lido no código (`video_limit` 50 dá 1 página) |
| Passada diária: uma chamada por 50 vídeos da faixa diária | 1 | 15 | 20 | 674 vídeos em 15 canais, no máximo 50 por canal |
| **E1** (partes novas nas mesmas chamadas) | 0 | 0 | 0 | D1 |
| **E2, fase semanal** *(emenda do portão: D-I3)*: uma chamada `videos.list` por 50 vídeos devidos de cada canal, numa fase própria do disparo | 0 a 1 | **≈ 8** | ≈ 13 | medido (K15b): de 6 a 9 canais têm vídeo devido por dia, e o maior tem de 30 a 45 (cabe numa chamada). A conta não mudou com a emenda: antes era "1 chamada a mais no canal", agora é "1 chamada do canal na fase" |
| *(emenda do portão: D-I4)* **Miniatura dos semanais** (requisição ao endereço da imagem, `i.ytimg.com`) | 0 | 0 | 0 | não é a Data API: não gasta cota |
| **E2, primeiras horas** (reaproveita a página de uploads) | 0 | 0 | 0 | 4.3, ponto 4 |
| **Total** | | **≈ 203 (2,0% de 10.000)** | **≈ 273 (2,7%)** | |

- **Pior caso por canal:** um canal em modo `full` com 2.000 vídeos guardados tem 1.950 semanais, 279 por dia, 6 chamadas. Com 75 canais do tamanho de hoje: ≈ 1.050 por dia (10,5%).
- A cota é a mesma do A/B Lab, do envio de vídeos e da busca de canais (fato 13 do spec). **O que a E1 passa a registrar em `youtube_quota_usage` é só a parte dos concorrentes** (chave `competitors`); a soma do projeto inteiro continua sem registro. Dito para não se ler a linha do dia como "a cota do dia".
- *(emenda do portão)* A conta é presa por teste: a Tarefa 10 afirma o número de chamadas de uma sincronização com 50 diários (4: canal, página, detalhes e 1 lote da passada diária); a Tarefa 11b afirma que a fase semanal de um canal com 34 devidos faz **uma** chamada e a de um canal com 120 devidos faz três; e a Tarefa 9 afirma que o número gasto é o que vai para a linha do dia (a fase semanal soma na mesma linha, na chave `competitors_semanal`).

## 5. A conta: tempo de função e volume

**Tempo.** Limites de hoje, lidos no código: `maxDuration` 300 s; o lote para de começar canal aos 200 s (`budgetMs`), até 15 canais por disparo, cron a cada 20 minutos, faixas de 6 horas (18 disparos por faixa).

| | Hoje (medido) | Depois, semana 1 (estimativa) | Depois, em regime (estimativa) |
|---|---|---|---|
| Canal típico, faixa das 12:00 | 21 s | ≈ 22 s | ≈ 21,5 s |
| Maior canal (285 vídeos, 34 semanais devidos por dia) | 21 s | ≈ 27 s | ≈ 25 s |
| Soma da faixa das 12:00, 15 canais | ≈ 305 s, **2 disparos** | ≈ 335 s, 2 disparos | ≈ 325 s, 2 disparos |
| 20 canais | ≈ 410 s, 3 disparos | ≈ 465 s, 3 disparos | ≈ 450 s, 3 disparos |
| 75 canais | ≈ 1.540 s, 8 disparos (2 h 40) | ≈ 1.700 s, 9 disparos (3 h) | idem |

*(emenda do portão: D-I3, S-I1, D-I4. A tabela acima vale para a sincronização dos canais devidos; a leitura dos semanais saiu dela e tem conta própria, abaixo.)*

De onde vem o acréscimo na sincronização de um canal (suposição: 50 ms por ida ao banco, a medir na Tarefa 14b e em D0): cerca de 7 idas a mais (captura do canal, captura da página, carimbo de "visto", cota, leitura de todos os vídeos) ≈ 0,35 s. Os vídeos semanais **não** são mais lidos aqui: a linha "maior canal" da tabela fica em ≈ 21,5 s, e a soma da faixa das 12:00 fica em ≈ 310 s com 15 canais (2 disparos, como hoje).

**A fase semanal, que roda depois dos canais devidos, em todo disparo a partir das 12:00 de São Paulo.**

| | Regime (estimativa) | Semana 1 (estimativa) | Base |
|---|---|---|---|
| Vídeos devidos por dia | 87 a 118 | idem | K15b, medido |
| Por vídeo: linha do vídeo, sonda da miniatura sem troca, versões | ≈ 0,35 s | ≈ 1,05 s (a sonda baixa e arquiva a imagem dos 687 que não têm cópia; linha de base de título e descrição) | sonda de hoje: cerca de 15 s por 50 vídeos (0,3 s cada); arquivo: suposto 0,7 s a mais |
| Por canal visitado: leituras do estado, uma chamada à API por 50 devidos, captura, pontos | ≈ 0,8 s | idem | 6 idas ao banco e 1 à API |
| **Total do dia** | **≈ 45 s** | **≈ 115 s** | 102 × 0,35 + 9 × 0,8; 102 × 1,05 + 9 × 0,8 |
| Maior canal num dia (45 devidos) | ≈ 17 s | ≈ 48 s | dentro do orçamento de 60 s por visita |
| Canal `full` de 2.000 vídeos (279 devidos por dia) | ≈ 100 s (2 visitas) | ≈ 295 s (5 visitas) | o que passa do orçamento da visita continua no disparo seguinte |

**De quanto tempo a fase dispõe** (medido: quais disparos têm canal devido): dos 36 disparos entre 12:00 e 23:40, o das 12:00 usa os 200 s com os canais (a fase não começa); o das 12:20 termina os 4 canais restantes aos ≈ 70 s e deixa ≈ 140 s; **os 16 seguintes, até as 17:40, não têm canal devido e começam com 210 s inteiros**; o mesmo depois das 18:20. Em regime, a fase termina no disparo das 12:20; na semana 1, no das 12:40. Com 75 canais (9 disparos por faixa só para os canais), sobram 9 disparos livres por faixa: 1.890 s, contra ≈ 250 s de trabalho semanal.

**O que protege se a estimativa estiver errada** (preso por teste na Tarefa 13): a série diária vem sempre antes (a fase só começa depois do último canal devido do disparo); a fase para de começar vídeo aos 210 s e nenhuma visita a um canal passa de 60 s; o que o relógio cortou **continua devido pelo próprio dado** (o vídeo sem ponto hoje, o canal com `weekly_pass_date` diferente de hoje) e é o primeiro do disparo seguinte. Não há mais corte que dependa da posição do canal. A ordem dos tetos é `210 s (semanal) < 230 s (backfill de Shorts) < 300 s (função)`, com `200 s` para começar canal.

**Volume, uma vez** (do D0 ao D+6, à medida que cada vídeo é lido pela primeira vez):

| O quê | Linhas | Tamanho | Base |
|---|---|---|---|
| Primeiro valor de cada campo (10 por vídeo, 7 por canal) | 14.005 | ≈ 4,1 MB | 296 B por linha, medido local. *(emenda do portão: D-m5, D-m8)* O catálogo tinha 9 campos de vídeo quando a conta foi escrita com 10; com `views_hidden` no catálogo são 10 de fato |
| Primeira resposta guardada (`raw`) | 1.405 | 2,1 a 4,2 MB | 1,5 kB medido com texto sintético; 3 kB é o teto estimado |
| Faixa inicial de cada vídeo | 1.390 | 0,34 MB | 246 B, medido local |
| Linha de base de título, descrição e miniatura dos 687 nunca conferidos | 2.061 *(emenda do portão: D-I4; eram 1.374 sem a miniatura)* | ≈ 2,1 MB | 1.010 B por versão, medido em produção |
| Os três índices da emenda (D-I5a) | | ≈ 0,6 MB | estimativa do revisor de dados |
| **Total no banco** | | **≈ 9 a 11 MB** (o banco vai de 179 para ≈ 190 MB) | |
| *(emenda do portão: D-I4)* **No Blob:** a miniatura atual dos 687 sem cópia | 687 arquivos (hoje são 708) | ≈ 26 MB (até 87 MB) | 38 kB em média nas cópias de hoje (amostra de 12; a maior, 126 kB) |

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
| Uma parte inteira da resposta não vem | os campos são sobrescritos com vazio | os campos daquela parte não são comparados **nem regravados na linha do vídeo** (S-M2); o número do dia fica em `youtube_quota_usage.operations.partes_ausentes` | *(emenda do portão: D-I5b)* a linha da cota (K3), que é durável; a resposta do cron ninguém guarda | — |
| O vídeo deixa de vir de `videos.list` | a linha fica congelada, sem marca | 1ª leitura: `miss_streak = 1`; 2ª seguida: `missing_since` com a data da 1ª e versão `availability = 'sumiu'`. Nada é apagado | `videos_ausentes` na resposta do cron; a fila na tela é a E9 | sai quando volta (abre `no_ar`) ou quando o dono decidir (E9) |
| A chamada `videos.list` falha (HTTP 500, tempo) | o canal fica em erro | igual, **e nenhum vídeo daquela chamada conta como ausente** | o canal aparece em "erro" na lista de canais | na sincronização seguinte |
| `channels.list` vem sem o canal | o canal fica em erro "não encontrado" | igual, mais `miss_streak`; na 2ª, `missing_since` | "erro" na lista; `canais_ausentes` na resposta | quando voltar ou na E9 |
| Um canal fica em erro por mais de 12 horas (duas faixas) | **verde** (o disparo seguinte, sem nada devido, grava sucesso) | *(emenda do portão: D-I1, CTRL-d)* **vermelho por 3 dias**: "N canais em erro há mais de 12 h"; do 3º dia em diante o cron volta a verde e toda execução devolve em `acao_do_dono`: "canal X em erro desde dd/mm: motivo" | vigia (3 dias); depois, `acao_do_dono` na resposta de toda execução e o canal marcado "erro" na lista | **sim**: o vermelho acaba no 3º dia. A nota acaba quando o canal sincroniza bem, quando some do YouTube em duas leituras (vira "ausente") ou quando o dono o remove |
| A gravação do histórico de campo ou do `raw` falha | — | a série do dia já foi gravada antes; o canal termina em erro ("não foi possível guardar o histórico de campos: …"); o "visto" não é carimbado, então a janela da próxima mudança continua certa | "erro" na lista; vermelho se metade dos canais falhar; *(emenda do portão: S-I4)* e **vermelho no disparo seguinte**: "N vídeos lidos sem resposta guardada" (a prova agora conta por `last_checked_at`, que é carimbado mesmo quando a captura falha) | na sincronização seguinte (o plano é refeito do zero) |
| *(emenda do portão: S-I5)* Qualquer outra gravação nova falha (linha do vídeo, linha do canal, primeiras horas, troca de faixa, promoção) | os erros de `insert` e `update` do vídeo são ignorados | o erro é guardado, **a passada diária roda assim mesmo**, e o canal termina em erro com a frase em português | "erro" na lista; vermelho se metade dos canais falhar, ou depois de 12 h | na sincronização seguinte |
| A resposta de um vídeo passa de 100 kB | — | não é guardada; `rawTooBig` | **vermelho**: "N vídeos lidos sem resposta guardada" | só subindo o teto (uma constante); nunca visto: a descrição máxima é 5 kB |
| A cota não é gravada | nunca é gravada (0 linhas) | a sincronização segue; *(emenda do portão: D-I5b)* o lote tenta de novo no fim do disparo, com a soma do que faltou e a chave `erros_cota`; se falhar de novo, o disparo fica vermelho ("cota não gravada: N unidades"); e **vermelho** se houve canal lido no dia do Pacífico e a linha do dia está em 0 | vigia | quando a gravação voltar |
| *(emenda do portão: S-M3)* A função morre por tempo (300 s) no meio de um canal | — | **a cota daquele canal não é gravada** (a gravação é no fim da sincronização); o canal fica `syncing` e é retomado na faixa seguinte | não se vê na linha da cota; a prova "cota em 0 com canal lido" só pega se nada foi gravado no dia. Risco declarado (seção 12, item 8) | na faixa seguinte |
| Mais de 200 vídeos na regra diária | (não existe) | os mais antigos da regra de idade vão para a semanal; o número fica em `operations.teto_diario_cortados` e na resposta | resposta do cron e linha da cota | — |
| A passada diária falha para um canal | o canal fica em erro; a sincronização seguinte completa | igual; **e** depois das 18:00, com a faixa inteira tentada: vermelho "N vídeos da faixa diária sem ponto hoje" | vigia | no dia seguinte vira a linha de baixo |
| Ficou um dia sem ponto na faixa diária | **verde**, e o motor recusa o intervalo | **vermelho por 3 dias**: "N buracos na série diária nos últimos 3 dias" | vigia | sai sozinho no 4º dia (o ponto não volta; o aviso não é eterno) |
| *(emenda do portão: D-I3, D-m1)* Depois das 19:00 ainda há vídeo semanal do dia sem ponto | (não existe) | **vermelho**: "N vídeos da faixa semanal devidos hoje e ainda sem ponto" (`semanal_devidos_hoje`, só cobrado depois das 19:00 de São Paulo e com a faixa inteira tentada) | vigia | no disparo seguinte (20 minutos) que conseguir ler; à meia-noite vira a linha de baixo |
| Um vídeo semanal chega ao 8º dia sem ponto | (não existe) | antes das 19:00 é nota (lido hoje, o intervalo de 8 dias ainda vale); depois das 19:00, **vermelho**: "N vídeos da faixa semanal no 8º dia sem ponto" (`semanal_atrasados`) | vigia | quando for lido; vídeo ausente ou sem contagem fica fora |
| Um vídeo semanal passa de 8 dias sem ponto (9 ou mais) | (não existe) | **vermelho a qualquer hora**: "N vídeos da faixa semanal sem ponto há 9 dias ou mais (intervalo perdido)" (`semanal_atrasados_9d`) | vigia | quando for lido: o ponto volta, o intervalo perdido não (o motor o recusa, como recusa um buraco) |
| O relógio do disparo acaba no meio da fase semanal | (não existe) | o vídeo não conferido não ganha ponto; o canal fica com `weekly_pass_date` de ontem e é o primeiro do disparo seguinte; o número do dia fica em `operations.semanais_adiados` | linha da cota (K3) e K17; se durar até as 19:00, a primeira linha deste bloco | 20 minutos depois |
| A fase semanal falha num canal (erro do banco ou da API) | (não existe) | o canal **não** vai para "erro" (a sincronização dele deu certo); `weekly_pass_date` não é carimbado; nova tentativa no disparo seguinte; o erro vai ao Sentry e o número a `operations.erros_semanal` | linha da cota; depois das 19:00, `semanal_devidos_hoje` | quando a causa passar |
| *(emenda do portão: D-I4)* Vídeo com faixa há 9 dias ou mais e nenhuma versão de miniatura guardada | **verde**: 687 vídeos estão assim hoje | **vermelho**: "N vídeos sem cópia da miniatura depois de 9 dias" (`sem_miniatura_9d`) | vigia | quando a leitura seguinte (no máximo 7 dias) guardar a cópia |
| Vídeo com `series_tier` sem linha de faixa correspondente, ou sem faixa depois de o canal sincronizar | (não existe) | **vermelho**: "N vídeos sem faixa de série" | vigia | na sincronização seguinte do canal. *(emenda do portão: D-m2)* **Um caso não some sozinho:** `series_tier` gravado e nenhuma linha de faixa aberta (só nasce de edição manual no banco): a função de troca não vê diferença e não reabre. Conserto, do dono: `update competitor_videos set series_tier = null, series_tier_since = null where id in (<ids que a K9b devolve>);` e a sincronização seguinte reabre a faixa |
| A função de prova não responde, ou responde outra forma | (não existe) | **vermelho**: "não foi possível ler a prova" | vigia | quando responder |
| As migrations não foram aplicadas | (não se aplica) | o cron para antes de qualquer gravação: "migration MG1 (ou MG2) não aplicada". *(emenda do portão: S-M4)* Erro de rede ou banco fora na conferência do schema tem outra frase ("não foi possível conferir o schema: …"), para não mandar o dono aplicar o que já está aplicado | vigia | quando o dono aplicar, ou o banco voltar |
| *(emenda do portão: D-I6, CTRL-h)* Uma conferência com data venceu e ninguém fez | (não existe) | o cron diário da coleta lista as vencidas em `coleta.conferencias_vencidas` (Tarefa 6 do plano da E20); vencida há mais de 7 dias deixa esse cron vermelho, pela regra adotada lá | resposta do cron da coleta; vermelho ao 8º dia | quando a conferência é feita e `feitaEm` é preenchido |
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
4. Se a faixa for a das 12:00 ou a das 18:00: a passada diária como hoje (os vídeos já capturados no passo 2 não são capturados de novo).
5. A linha do dia em `youtube_quota_usage` nasce, com `operations = {"competitors": N}`.

*(emenda do portão: D-I3, D-I4)* **Depois dos canais devidos, no mesmo disparo e nos seguintes (hora de São Paulo ≥ 12): a fase semanal.** Para cada canal com `weekly_pass_date` diferente de hoje, o mais antigo primeiro: os semanais cujo dia fixo é hoje (cerca de 1 em 7) são pedidos numa chamada por 50; cada um tem a linha regravada, os campos e o `raw` capturados, o título, a descrição **e a miniatura** conferidos (a primeira leitura abre a linha de base e guarda a imagem no Blob), e por último o ponto na série. Canal sem semanal devido é carimbado na hora. No D0 isso acontece, para cada canal, no primeiro disparo depois da primeira sincronização dele com o código novo (é ela que grava as faixas).

Se a promoção for depois das 12:21 de São Paulo, os canais já foram lidos pelo código antigo nessa faixa: o primeiro contato do código novo é a faixa das 18:00 (que também passa das 12:00, então a diária e a semanal do dia rodam lá; a diária já tem os pontos de hoje e não regrava).

| | O que roda | O que grava (15 canais) | O que aparece em falha |
|---|---|---|---|
| **D0** | o descrito acima | `raw`: 15 + ≈ 776 (674 diários, ≈ 102 semanais); campos: 105 + ≈ 7.760; faixas: 1.390; série: os 674 de sempre mais ≈ 102; versões de título, descrição e miniatura: ≈ 294; ≈ 98 imagens no Blob; cota: 1 linha | nada esperado. Se vier: "N vídeos lidos sem resposta guardada" (captura falhou), "cota do dia não registrada", "N vídeos sem faixa". Depois das 19:00: "N vídeos da faixa semanal devidos hoje e ainda sem ponto" se a fase não tiver rodado. "Buracos" e "semanal atrasado" não podem aparecer: as faixas começam hoje |
| **D+1 a D+6** | cada dia, mais ≈ 102 semanais ganham o primeiro ponto, a primeira resposta, a linha de base e a cópia da miniatura | por dia: ≈ 102 `raw`, ≈ 1.020 campos, ≈ 102 pontos, ≈ 294 versões, ≈ 98 imagens no Blob; quase nada nos 674 diários (só o que mudou) | um dia de diária perdido deixa "buracos" por 3 dias |
| **D+3** | primeiro vídeo descoberto depois do deploy completa 72 horas | — | consulta K8 (item 16): tem de voltar vazia |
| **D+6** | — | todos os 1.390 têm `raw`, campos e pelo menos um ponto | K1 = 0 |
| **D+7** | os semanais do dia fixo de D0 ganham o **segundo** ponto: primeira vez em que a promoção por ganho (1.000 views e 5%) pode disparar, e primeira vez em que uma troca de título num semanal pode ser detectada | pontos; `daily_until` em quem for promovido | — |
| **D+8** | a prova "8º dia sem ponto" passa a valer (antes, nenhuma faixa tinha 8 dias) | — | *(emenda do portão: D-m1)* "N vídeos da faixa semanal no 8º dia sem ponto", depois das 19:00, se a fase semanal não tiver lido um vídeo no dia fixo dele nem hoje |
| **D+9** | as provas "9 dias ou mais sem ponto" e "sem cópia da miniatura depois de 9 dias" passam a valer | — | as duas têm de estar em 0: é a conferência de que os 716 foram lidos e os 687 ganharam cópia (K16) |

**O que não acontece em D0, para ninguém procurar:** nenhuma "troca" falsa em massa (687 dos 716 antigos não têm versão: a primeira leitura abre linha de base); nenhuma notificação em rajada (*(emenda do portão: S-M8)* mudança com janela de mais de 8 dias é gravada como versão e como linha de `competitor_changes`, com a janela verdadeira, mas **não vira aviso** e não promove: Tarefa 11b; em produção há no máximo 29 vídeos antigos em que isso pode acontecer). **O que passa a acontecer e não acontecia** *(emenda do portão: D-I4)*: cerca de 102 sondas de miniatura a mais por dia, e cerca de 98 arquivos novos no Blob por dia nos sete primeiros dias.

## 8. Desvios declarados do texto do spec (para os revisores)

O spec é a referência; onde o plano faz diferente, é aqui, com o motivo.

| # | Onde | O spec diz | O plano faz | Por quê |
|---|---|---|---|---|
| D-1 | MG1 | `miss_streak`, `missing_since`, `last_seen_at` | mais uma coluna, `miss_first_at`, no vídeo e no canal | "`missing_since` recebe a data da **primeira** das duas leituras" não tem de onde sair: `last_seen_at` é a última vez que veio, não a primeira que faltou. Num vídeo semanal as duas podem distar 7 dias |
| D-2 | 4.1 | `apply_competitor_field_plan(p_channel, p_video, p_close bigint[], p_open jsonb)`, uma chamada por vídeo | `(p_site_id, p_channel_id, p_close jsonb, p_open jsonb)`, uma chamada por lote de até 50 vídeos; `p_close` leva `{id, last_seen_at}` | em D0 seriam 776 chamadas, cerca de 40 s a mais numa faixa que já usa os 200 s; e a data de fecho (item 223) vem de quem leu o vídeo antes de regravá-lo |
| D-3 | 4.1 | `value_hash` = sha256 do JSON canônico | os 16 primeiros caracteres hexadecimais (o mesmo corte de `hashValue`, em `competitor-versions.ts`); o `raw` usa o sha256 inteiro | 49 bytes a menos por linha em 14 mil linhas; a chave é a identidade, não o hash (A, B, A não colide) |
| D-4 | 4.1 | "a primeira linha de cada campo tem `precision = 'first'`" | vale também para `availability` (uma linha `no_ar` por vídeo) | uma regra só: "sumiu" e "voltou" são trocas de um campo como outro qualquer, e uma falha no meio se conserta sozinha |
| D-5 | 4.3 | faixa do intervalo por horas: até 36 h diário, até 8 dias semanal | diário = dois dias seguidos (como o motor faz hoje); semanal = de 2 a 8 dias **de calendário** de São Paulo, com todos os dias do meio em faixa semanal | pela conta em horas, um intervalo que o motor aceita hoje (publicação às 20:00, primeiro ponto 40 h depois) seria recusado e os números das telas mudariam (item 20); e uma leitura às 12:02 oito dias depois de uma às 12:00 cairia fora por 2 minutos |
| D-6 | 4.3, efeito 1 e item 19 | efeito de troca sobre série semanal responde "inconclusivo: série semanal" | *(emenda do portão: S-I8, pergunta 5)* o estado, o rótulo **e o motivo** continuam os de hoje; o efeito ganha um campo novo, `weeklySeries: true`, que nenhuma tela lê | as telas contam os `inconclusivo` e indexam uma tabela pelo tipo; estado novo mudaria contadores, e frase nova é texto de tela sem mockup (as duas coisas são da E5) |
| D-7 | 4.3, efeito 2 | `load.ts` lê a série dos observados e dos que têm linha | lê, e põe a dos **não observados** num campo novo (`unobservedSeries`); `series` continua vazia para eles | nenhum campo que as telas leem hoje muda: o item 20 vira consequência da forma do dado, provada por teste, e a E4 e a E5 ligam a leitura com mockup |
| D-8 | 4.1 | o `comment_count` deixa de receber 0; "as 64 linhas com 0 ficam até a próxima leitura" | idem; **e** os 716 vídeos fora da série só são relidos na semana do deploy | consequência da cadência semanal: parte dos 64 zeros só se corrige até D+6 |
| D-9 | 4.3 | promoção quando "foi detectada mudança de título, miniatura ou descrição" | *(emenda do portão: D-I4)* igual ao spec: título, miniatura ou descrição (a miniatura dos semanais passou a ser conferida). Fica o desvio: mudança cuja janela passa de 8 dias não promove | sem ponto antes da troca não há efeito a medir |
| D-10 | item 246 | toda conferência "N dias depois" é uma entrada em `lib/conferencias.ts` | *(emenda do portão: D-I6, CTRL-h)* este plano **não cria** esse arquivo e **depende** dele: quem cria é a Tarefa 6 do plano da E20 (`docs/superpowers/plans/2026-10-12-a5-e20-guarda-do-bruto-plan.md`). As conferências deste plano que a prova embutida não cobre (K6, K8, K11, K12, K16, o retrato R1 de D+8) estão desde já, com data relativa a D0, em `.superpowers/sdd/a5/conferencias-com-data.md`, seção "E1 e E2"; no commit do deploy (Tarefa 15, Step 5b) ganham data absoluta lá e, **se `lib/conferencias.ts` já existir em `staging`, viram entradas dele no mesmo commit**; se ainda não existir, a etapa que o criar as importa (está escrito no arquivo de conferências) | não duplicar o mecanismo; a regra "vencida há mais de 7 dias deixa o cron vermelho" é a adotada na E20 |
| D-11 | 4.5 | "a sincronização encontra o vídeo em `competitor_removed_items` e não o recoleta" | a tabela é criada (MG1), mas **o sync ainda não a consulta** | nada escreve nela antes da E9 (a função de apagar é de lá). Fica como obrigação escrita para o plano da E9: a consulta entra no laço da página, antes do `insert`. *(emenda do portão: D-m10)* A obrigação está também em `conferencias-com-data.md`, "Pendências sem data" |
| D-12 *(emenda do portão: S-M8)* | 4.1 e D3 | (o spec não trata) | a troca de título, descrição ou miniatura vista num vídeo semanal é gravada em `competitor_video_versions` e em `competitor_changes` com `precision = '1d'` e a janela verdadeira em `window_start` e `window_end` (até 8 dias, ou mais na janela longa) | o `check` das duas tabelas só aceita `min`, `6h`, `1d` (e `first`), e o leitor das telas devolve nulo para valor desconhecido. `'1d'` já significa hoje "mais de uma faixa de 6 horas; a janela diz quanto" (é o que um canal que ficou em erro por dias grava). Mudar o `check` mexeria em tabela que as telas leem; fica para a E5, com mockup (pergunta 4) |
| D-13 *(emenda do portão: D-I3, S-I1)* | 4.3 e OP-15 | a passada semanal roda "de dentro do lote antigo" | roda como **fase do disparo**, depois dos canais devidos, com a dívida gravada em `competitor_channels.weekly_pass_date` (coluna que o spec não tem) | dentro da sincronização de cada canal, a posição do canal na fila decidia se ele lia os semanais, e a ordem é a mesma todo dia (medido): 53% dos vídeos semanais podiam nunca ser lidos |
| D-14 *(emenda do portão: D-m4)* | 4.5, item 221 | "ausente em duas leituras seguidas" | a 2ª falta só conta 3 horas depois da 1ª | o "sincronizar agora" logo depois do cron não é uma segunda leitura independente; as faixas do cron distam 6 horas, então o comportamento normal não muda |
| D-15 *(emenda do portão: S-I4)* | item 1 | `last_checked_at > now() - interval '1 day'` sem resposta corrente = 0 | a mesma consulta, contando só o que foi lido **depois** da primeira resposta guardada do site | no dia do deploy, os cerca de 750 vídeos que o código antigo conferiu na faixa anterior não têm resposta guardada: sem o corte, o cron nasceria vermelho por até 6 horas sem perda nenhuma |

**OP-15 (quem dispara a passada semanal entre as ordens 4 e 5).** *(emenda do portão: D-I3, S-I1, S-M9, CTRL-e; reescrito.)* Escolha: **a segunda saída do spec, chamar a passada de dentro do lote antigo, devida pelo próprio dado**, mas como **fase própria do disparo**, não dentro da sincronização de cada canal (desvio D-13).

- **O que é devido.** Um vídeo semanal é devido quando não tem ponto hoje e (hoje é o dia fixo dele, **ou** o último ponto dele tem 7 dias ou mais, **ou** nunca teve ponto e está na faixa há 7 dias ou mais): a função pura `weeklyDue` (Tarefa 5), que não mudou.
- **Quem lê.** `syncCompetitorWeekly(canal)` (Tarefa 11b), função exportada, com parâmetros explícitos: lê os vídeos semanais do canal, acha os devidos, pede ao YouTube em lotes de 50 e, para cada um, grava a linha, os campos, o `raw`, as versões (título, descrição, miniatura) e **por último** o ponto. É a função que a tarefa `serie_semanal` da E16 vai chamar.
- **Quem dispara.** `runCompetitorBatch` (Tarefa 13), depois do laço dos canais devidos, quando a hora de São Paulo é 12 ou mais: visita os canais com `weekly_pass_date` diferente de hoje, do mais antigo para o mais novo (nulo primeiro), com até 60 s por visita, em rodízio, enquanto o disparo tem menos de 210 s. O canal cuja passada termina sem nada adiado é carimbado com a data de hoje e sai da fila do dia.
- **Por que é correto por construção.** (1) A dívida não é memória de uma execução: é o dado (`weekly_pass_date` do canal, e a falta do ponto de hoje no vídeo). (2) A prioridade é da dívida mais antiga, não da posição na fila dos canais. (3) O orçamento é por canal: um canal grande não tira a vez dos outros, e o que sobra dele continua no disparo seguinte. (4) O tempo não depende da faixa das 18:00: 32 dos 36 disparos entre 12:00 e 23:40 não têm canal devido (medido) e começam com o relógio inteiro.
- **O limite, provado por teste (Tarefa 13).** Com 15 canais a 21 s na ordem estável, as duas faixas simuladas (12:00, 12:20, 12:40 e 18:00, 18:20, 18:40) e o trabalho semanal da semana 1: todo canal tem a passada completa até o disparo das 12:40. No caso duro (os disparos com canal devido não deixam tempo nenhum para a fase): todos completos no primeiro disparo sem canal devido. **Todo vídeo devido no dia D é lido em D.** Se D inteiro se perder (cron parado das 12:00 às 23:40), o vídeo é devido de novo em D+1 pela regra dos 7 dias e o intervalo fica em 8 dias de calendário, que o motor ainda aceita. Só há perda no 9º dia, e ela é vermelha (`semanal_atrasados_9d`).
- **Provas embutidas** (Tarefa 12): `semanal_devidos_hoje` (a consulta K15 do revisor de dados, dentro do cron; vermelha depois das 19:00), `semanal_atrasados` (8º dia; vermelha depois das 19:00) e `semanal_atrasados_9d` (vermelha sempre).
- **Provas por teste do "devido"** (Tarefas 5 e 11b): devido no dia fixo; não devido no dia seguinte a uma leitura; devido de novo no 7º dia mesmo fora do dia fixo; cortado pelo relógio, continua devido e sem ponto; em D0, só 1 em 7 é lido.

## 9. Arquivos, ordem, paralelismo e a separação da A4

**Arquivos novos**

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `supabase/migrations/<carimbo>_observatorio_a5_e1_campos_sinalizadores_raw.sql` | MG1 (Apêndice A) | 1 |
| `supabase/migrations/<carimbo>_observatorio_a5_e2_serie_faixas.sql` | MG2 (Apêndice B) | 1 |
| `apps/web/test/integration/observatorio-a5-e1-e2-migration.test.ts` | funções SQL, concorrência da cota (banco local) | 1a |
| `apps/web/test/integration/observatorio-a5-e1-e2-rls.test.ts` *(emenda do portão: S-I10)* | RLS das cinco tabelas novas com GUC forjado, e quem executa as funções (banco local) | 1b |
| `apps/web/test/integration/competitor-sync-a5.test.ts` *(emenda do portão: S-I7)* | `syncCompetitorChannel` e `syncCompetitorWeekly` de verdade contra o banco local, com `fetch` fixo: a junção TypeScript × SQL | 14a |
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
| `apps/web/test/youtube/observatorio/consumidores-semanal.test.ts` *(emenda do portão: S-I8)* | regressão por consumidor de `rowsToDataset` e `loadRows` (telas, Cowork, fila da forja), com a semente de e2e | 17b |
| `.superpowers/sdd/a5-e1-e2/progress.md` | ledger (OP-15 copiada, estados, medições, datas) | 0 |

**Arquivos modificados**

| Arquivo | O que muda | Tarefa | A A4 toca? |
|---|---|---|---|
| `apps/web/src/lib/youtube/competitor-sync.ts` | as quatro partes, a linha do vídeo, captura, ausência, cota, faixas, primeiras horas, e a função `syncCompetitorWeekly` | 6b a 11c | não |
| `apps/web/src/lib/youtube/competitor-sync-batch.ts` | soma dos contadores novos, a fase semanal do disparo, `acao_do_dono`, sites para a prova | 13 | não |
| `apps/web/src/app/api/cron/sync-youtube/route.ts` | guarda de schema, prova, mensagem de falha | 9, 13 | não |
| `apps/web/src/lib/youtube/observatorio/rules.ts` | `RULES.series`, `RULES.promotion` | 5 | não |
| `apps/web/test/youtube/competitor-sync.test.ts` | o falso do banco e os testes que mudam de expectativa | 6, 7, 10 | não |
| `apps/web/test/youtube/competitor-sync-batch.test.ts`, `cron-competitors-invalidate.test.ts`, `cron-route.test.ts`, `competitor-backfill.test.ts`, `competitor-video-limit.test.ts`, `apps/web/test/api/cron/sync-youtube.test.ts`, `apps/web/test/integration/competitor-sync-versions.test.ts` | os falsos ganham as leituras novas | 6 a 13 | não |
| `apps/web/src/lib/youtube/observatorio/types.ts`, `series.ts`, `effect.ts`, `index.ts`, `load.ts` (só `rowsToDataset`) | faixa, faixas no tempo, série dos não observados, intervalo semanal, `weeklyRate` | 16 | não |
| `apps/web/src/lib/youtube/observatorio/load.ts`, `load-channel.ts`, `load-page.ts`, `pack.ts` | ler tudo, faixas, `PACK_VERSION` 2, saída de emergência | 17 | não |
| `apps/web/test/youtube/observatorio/load-fixture.ts`, `pack-shape.test.ts`, `pack.test.ts`, `load*.test.ts` | fixture com semanal; retrato da forma | 17 | não |

**A A4 (local, inacabada, 78 commits à frente) não toca nenhum arquivo desta lista.** Conferido em 12/10 com `git diff --name-only origin/staging..HEAD -- apps/web/src apps/web/test apps/web/e2e`: em `src` ela mexe só em `app/cms/(authed)/youtube/competitors/**`, `lib/youtube/observatorio/links.ts`, `stats.ts` e `proprio/**`; em teste, em `test/helpers/fake-supabase.ts`, `e2e/fixtures/observatorio-seed.ts` e nos testes das telas. **Dois arquivos pedem cuidado, porque este plano os usa sem mexer:** `test/helpers/fake-supabase.ts` (a A4 acrescentou 7 linhas) e `e2e/fixtures/observatorio-seed.ts`. Os testes do Lote 2 têm de passar com a versão de `origin/staging` desses dois arquivos: a prova é rodá-los numa árvore extraída do commit a enviar, como foi feito na E12. O envio segue o roteiro da E12 (`.superpowers/sdd/a5-e12/progress.md`, "Roteiro do envio separado"): remontar os commits deste plano sobre `origin/staging` por `merge-tree` e `commit-tree`, conferir a árvore por duas construções, empurrar por `bash -c 'git push origin "$0:refs/heads/staging"'`, e fazer o merge de volta. A guarda do roteiro (os commits só podem tocar os arquivos da lista acima mais este plano) é a primeira linha.

**Ordem que mantém a árvore verde.** *(emenda do portão: S-I10)* Lote 1: 1a → 1b → 2 → 3 → 4 → 5 → 6a → 6b → 7 → 8 → 9 → 10 → 11a → 11b → 11c → 12 → 13 → 14a → 14b → 15. Lote 2: 16 → 17 → 17b → 18. Cada tarefa termina com os testes dela e os vizinhos verdes e com o typecheck limpo. As Tarefas 0, 2, 3 e 5 podem começar já; a 1a e a 1b usam o SQL final dos apêndices e também podem; **nenhuma tarefa escreve em produção, e o push espera a Tarefa 15**.

**O que pode rodar em paralelo sem colidir em arquivo** (o padrão é um implementador por vez; se o controlador quiser abrir dois):

- 5 (faixas, `competitor-tiers.ts` e `rules.ts`) com 2 → 3 → 4 (`competitor-capture.ts`).
- 12 (`competitor-health.ts`, só a parte do veredito) com qualquer uma de 6 a 11 **depois** da 9, que cria o arquivo.
- **O Lote 2 inteiro (16, 17) com o Lote 1, depois da Tarefa 5:** a 16 usa `RULES.series`, que a 5 cria em `rules.ts`; fora isso os dois lotes não compartilham arquivo de código nem de teste. Só o envio (18) espera o 15.
- **Nunca em paralelo:** 6a a 11c (todas em `competitor-sync.ts` e no mesmo falso do banco).

**Interruptor e plano de volta.** O spec não dá variável de ambiente à E1 nem à E2 ("só acrescentam"); a tarefa `serie_semanal` ganha interruptor na E16. Até lá:

- **Proteção sem interruptor:** *(emenda do portão: D-I3, S-I5)* a fase semanal só começa depois do último canal devido do disparo e para aos 210 s; nenhuma gravação nova fica na frente da passada diária (as falhas novas são guardadas e lançadas no fim).
- **Volta:** `git revert` dos commits do lote, push em `staging`, CI, promoção (cerca de 15 minutos, 4 builds). As tabelas e colunas ficam, sem uso. O código antigo convive com elas (seção 2). **O que não se desfaz:** nada. As linhas gravadas ficam (são dado verdadeiro); se a coleta voltar depois, o histórico continua de onde parou, com a janela honesta (`gap`).
- **Volta só da fase semanal** *(emenda do portão: S-I10)* (se ela, e só ela, der problema): um commit de uma linha na rota, `weekly: true` → `weekly: false` na chamada a `runCompetitorBatch` (Tarefa 13). **As primeiras horas não são tocadas** (são da Tarefa 11a, em outro commit e em outro trecho). Os vídeos semanais ficam sem ponto, e a prova "devidos hoje e ainda sem ponto" acusa na mesma noite, que é o aviso certo.
- **Volta do Lote 2:** reverter os commits 16 e 17; `PACK_VERSION` volta a 1 e as entradas de cache da versão 2 são ignoradas (a tela lê o banco).

---

## Lote 1: a coleta

### Task 0 (controlador): ledger

Sem código. Antes da Tarefa 1.

- [ ] **Step 1:** criar `.superpowers/sdd/a5-e1-e2/progress.md` com a tabela de tarefas (estado, commit, revisão), a linha da OP-15 copiada do spec com a escolha deste plano (seção 8), e a lista "Dívida registrada" vazia.
- [ ] **Step 2:** *(emenda do portão: CTRL-i)* registrar no ledger as seis perguntas da seção 1 com o padrão de cada uma e, quando o dono responder, a resposta (ou "sem resposta: vale o padrão"). Copiá-las para `.superpowers/sdd/a5/perguntas-para-o-dono.md`.
- [ ] **Step 3:** *(emenda do portão: S-M12)* o arquivo da MG13 (E20) já existe (`supabase/migrations/20261012000001_observatorio_guarda_do_bruto.sql`). Conferir em produção se foi aplicada (`npx supabase db query --linked "select max(version) from supabase_migrations.schema_migrations"`) e anotar: se ainda não, vai no mesmo `db:push:prod`, antes da MG1 (o carimbo dela é menor). **Não criar a MG1 e a MG2 com carimbo anterior ao dela** (o `db:new` já garante).
- [ ] **Step 4:** *(emenda do portão: D-I3, CTRL-e)* **medir a faixa das 18:00, antes de qualquer execução.** Entre 18:45 e 23:59 de São Paulo (21:45 a 02:59 UTC), rodar a K12 (seção 10) em produção e gravar a saída no ledger: a posição e o segundo em que cada canal começou. O desenho da fase semanal **não depende** desse número (seção 8, OP-15); ele entra na tabela de tempo da seção 5 e diz quanto do disparo das 18:00 sobra para a fase. *(Em 12/10, às 16:57 de São Paulo, a K12 ainda mostrava a faixa das 12:00: a emenda foi fechada antes das 18:45.)*
- [ ] **Step 5:** *(emenda do portão: S-M11)* avisar o terminal da A4 de que a Tarefa 1a aplica migrations no banco local compartilhado (`migration up --local` leva também o que estiver em `supabase/migrations`, inclusive rascunho de outro terminal) e de que, a partir dela, contagem de vídeo não informada nasce nula no banco local.

*(emenda do portão: S-I10. A Tarefa 1 foi dividida: 1a, as migrations e as funções; 1b, o bloco de RLS, que era um parágrafo e é a única prova do item 11.)*

### Task 1a: migrations MG1 e MG2, com a prova das funções no banco local

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
  - `competitor_capture_health(p_site_id uuid, p_now timestamptz) returns jsonb` → chaves `videos_vistos_sem_raw`, `canais_vistos_sem_raw`, `canais_vistos_dia_pacifico`, `cota_dia_pacifico`, `videos_ausentes`, `canais_ausentes`, `canais_em_erro_12h`, `canais_em_erro_3d` *(emenda do portão: D-I1)*.
  - `apply_competitor_tier_plan(p_site_id uuid, p_channel_id uuid, p_changes jsonb, p_today date) returns jsonb` → `{"changed": n}`. `p_changes`: `[{"video_id", "tier"}]`.
  - `competitor_series_health(p_site_id uuid, p_now timestamptz) returns jsonb` → chaves `hoje`, `hora_sp`, `fora_da_prova`, `sem_faixa`, `diaria_sem_ponto_hoje`, `diaria_buracos_3d`, `semanal_atrasados`, `semanal_atrasados_9d`, `semanal_devidos_hoje`, `sem_miniatura_9d` *(emenda do portão: D-I3, D-I4)*, `diaria_total`, `semanal_total`.
  - *(emenda do portão)* As três funções de plano lançam "canal … não é do site …" quando `p_channel_id` não pertence a `p_site_id` (D-m3). `competitor_channels` ganha `weekly_pass_date date` (D-I3).

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

*(emenda do portão: S-M11)* **Antes de rodar:** `ls supabase/migrations | tail -6` e `git status --short supabase/migrations`. Se houver arquivo que não é deste plano nem está em `origin/staging` (rascunho de outro terminal), **pare e relate**: o comando o aplicaria no banco compartilhado. A MG13 (`20261012000001`) é oficial e pode ir.

Esperado: a lista das migrations aplicadas, terminando nas duas novas, sem erro. Depois rode a mesma linha de novo: "Local database is up to date". Para provar a idempotência do SQL (e não só do controle de versão), aplique os dois arquivos mais uma vez à mão:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && for f in $(ls supabase/migrations/*observatorio_a5_e*.sql); do docker exec -i supabase_db_bythiagofigueiredo psql -U postgres -v ON_ERROR_STOP=1 -q < "$f" 2>&1 | grep -ci error; done
```

Esperado: `0` e `0`.

- [ ] **Step 4: o código antigo contra o schema novo.** Rode de novo o comando do Step 1 com saída em `/tmp/a5-e1-depois.txt`. Esperado: o mesmo número de testes passando. É a prova de que a migration pode ir a produção antes do código. Se um teste falhar por esperar 0 numa contagem que ele não informou, é o teste que dependia do padrão antigo: ajuste-o para informar a contagem (o código de produção sempre informa) e diga isso no commit. *(emenda do portão: S-M11)* Os únicos testes que podem precisar disso são `test/integration/observatorio-load.test.ts` e `test/integration/competitor-pin-schema.test.ts` (os dois que inserem vídeo sem contagem); se outro falhar, é parada. O arquivo ajustado entra na lista do `git add` e do `git commit` do Step 8, pelo nome. **Aviso para o controlador:** o banco local é compartilhado; a partir deste passo o terminal da A4 também passa a ver as colunas novas e a contagem nula por padrão (a semente e2e dela informa as contagens, conferido em `e2e/fixtures/observatorio-seed.ts:549` e `:617`).

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
    for (const k of ['videos_vistos_sem_raw', 'canais_vistos_sem_raw', 'canais_vistos_dia_pacifico', 'cota_dia_pacifico', 'videos_ausentes', 'canais_ausentes', 'canais_em_erro_12h', 'canais_em_erro_3d']) expect(typeof c[k]).toBe('number')
    expect(Object.keys(c)).toHaveLength(8)
    expect(c.videos_ausentes).toBe(1) // v1
    const s = (await sb.rpc('competitor_series_health', { p_site_id: siteId, p_now: at(7) })).data as Record<string, unknown>
    for (const k of ['hora_sp', 'fora_da_prova', 'sem_faixa', 'diaria_sem_ponto_hoje', 'diaria_buracos_3d', 'semanal_atrasados', 'semanal_atrasados_9d', 'semanal_devidos_hoje', 'sem_miniatura_9d', 'diaria_total', 'semanal_total']) expect(typeof s[k]).toBe('number')
    expect(Object.keys(s)).toHaveLength(12)
    expect(s.fora_da_prova).toBe(1) // v1 ausente fica fora de todas as contas
  })
  it('competitor_channel_removal_impact conta as quatro tabelas novas e mantém as chaves antigas', async () => {
    const r = (await sb.rpc('competitor_channel_removal_impact', { p_site_id: siteId, p_channel_id: ch })).data as Record<string, unknown>
    expect(r).toMatchObject({ status: 'ok', videos: 2 })
    for (const k of ['pinned', 'versions', 'daily_days', 'bookmarks', 'field_versions', 'raw', 'early', 'tier_spans']) expect(typeof r[k]).toBe('number')
  })
})
```

*(emenda do portão: D-I1, D-I2, D-I3, D-I4, D-m3, D-m4, S-I4, S-M1.)* **Acrescente os casos abaixo ao mesmo `describe`.** São os do roteiro `.superpowers/sdd/a5/plano-e1-e2-emenda-prova.sql`, que o autor rodou em 12/10 no banco local contra o SQL final (35 asserções, todas passaram): o corpo de cada `it` é a tradução direta do trecho do roteiro com o mesmo rótulo. Use um canal e vídeos **próprios de cada caso** (crie no começo do `it` e apague no fim), para um caso não mudar a conta do outro; as provas contam o site inteiro, então o `siteId` semeado no `beforeAll` tem de ser só deste arquivo.

| `it` | O que afirma |
|---|---|
| `D-m3: as três funções de plano recusam canal de outro site` | `apply_competitor_field_plan`, `apply_competitor_raw_plan` e `apply_competitor_tier_plan` com `p_site_id: otherSite` e o canal de `siteId`: `error.message` casa `/não é do site/`, e nenhuma linha é gravada |
| `D-m4: a 2ª falta 20 minutos depois não conta; 6 horas depois conta, com a data da 1ª` | `competitor_mark_missing` em `at(0)`, `at(0.33)` e `at(6)`: depois da segunda, `miss_streak = 1` e `missing_since` nulo; depois da terceira, `miss_streak = 2` e `missing_since = spDate(at(0))`. O mesmo com `competitor_channel_mark_missing` (10 minutos e 6 horas) |
| `S-M1: marcar ausência não apaga nada` | conte as linhas do vídeo em `competitor_videos`, `competitor_video_daily`, `competitor_video_versions`, `competitor_field_versions` e `competitor_raw` antes e depois de duas marcas: as cinco contagens são iguais |
| `S-I4: a prova da captura enxerga a captura que falhou, e só o que foi lido depois do começo da E1` | cinco passos, com `p_now = agora`: (a) nenhuma resposta guardada no site e vídeo com `last_checked_at` de 1 hora atrás → `videos_vistos_sem_raw = 0`; (b) grave a resposta do canal com `first_seen_at` de 30 minutos atrás → continua 0 (o vídeo foi conferido antes); (c) ponha `last_checked_at` de um vídeo em 5 minutos atrás, **sem** `last_seen_at` → 1; (d) grave a resposta desse vídeo → 0; (e) um segundo canal com `last_ok_synced_at` de 5 minutos atrás e sem resposta → `canais_vistos_sem_raw = 1` |
| `D-I1: canal em erro há 13 horas conta em 12h e não em 3d; há 4 dias, nos dois; ausente, em nenhum` | `sync_status = 'error'` e `sync_error_since` em 13 horas, depois em 4 dias, depois com `missing_since` preenchido: (1, 0), (1, 1), (0, 0) |
| `D-I2: estreia agendada sem ponto não é buraco; dia sem ponto depois de um ponto é` | vídeo em faixa diária aberta há 3 dias e nenhum ponto → `diaria_buracos_3d = 0` e `diaria_sem_ponto_hoje = 1`; com um ponto há 3 dias e nada depois → `diaria_buracos_3d = 2` |
| `D-I3: semanal aos 7, 8 e 9 dias, e o dia fixo` | vídeo em faixa semanal há 20 dias: último ponto há 7 dias → (`semanal_devidos_hoje`, `semanal_atrasados`, `semanal_atrasados_9d`) = (1, 0, 0); há 8 → (1, 1, 0); há 9 → (1, 1, 1); com ponto hoje → (0, 0, 0). Com ponto há 3 dias: devido só se hoje for o dia fixo do `video_id` (use `weekSlotOf` e `dayNumber` de `@/lib/youtube/competitor-tiers` para escolher um id que cai hoje e outro que não cai: **é a prova de que o SQL e o TypeScript calculam o mesmo dia fixo**). Com `views_hidden = true`: sai das três e entra em `fora_da_prova` |
| `D-I4: vídeo com faixa há 9 dias e sem versão de miniatura` | `sem_miniatura_9d = 1`; depois de inserir uma linha `field = 'thumb'` em `competitor_video_versions`, 0; vídeo com faixa há 3 dias não conta |
| `D-I3: weekly_pass_date nasce nula e aceita data` | `select weekly_pass_date` do canal recém-criado é nulo; `update … set weekly_pass_date = <hoje>` passa |

- [ ] **Step 6: rodar.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/observatorio-a5-e1-e2-migration.test.ts 2>&1 | tail -25
```

Esperado: todos passam. Rode também sem a variável (`npx vitest run test/integration/observatorio-a5-e1-e2-migration.test.ts`): tudo pulado, zero falha.

- [ ] **Step 7: as consultas de conferência.** Rode V1, V2 e V3 (seção 2) e K1 a K17 (seção 10) no banco local por `docker exec -i supabase_db_bythiagofigueiredo psql -U postgres -c "<consulta>"`. Esperado: nenhuma dá erro de SQL; V1 dá *(emenda do portão)* 21, 13, 5, 5, 9, 9, `'{}'::jsonb`, 0. (Todas já foram rodadas em 12/10 pelo autor do plano; este passo garante que o arquivo de migration colado é o mesmo.)

- [ ] **Step 8: commit.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && MG1=$(ls supabase/migrations/*_observatorio_a5_e1_campos_sinalizadores_raw.sql) && MG2=$(ls supabase/migrations/*_observatorio_a5_e2_serie_faixas.sql) && T=apps/web/test/integration/observatorio-a5-e1-e2-migration.test.ts && git add "$MG1" "$MG2" "$T" && git diff --cached --name-only && git commit -m "feat: migrations MG1 e MG2 da A5 (campos, sinalizadores, raw, faixas da série) com a prova no banco local" -- "$MG1" "$MG2" "$T"
```

*(emenda do portão: S-I2)* O commit lista os três arquivos pelo nome (o original passava a pasta `supabase/migrations`, que levaria qualquer migration modificada de outro terminal). `git diff --cached --name-only` tem de mostrar exatamente os três. Se o Step 4 ajustou um teste antigo, acrescente o arquivo dele às duas listas.

**Pronto quando:** os dois arquivos existem com o SQL dos apêndices; o teste de integração passa com o banco local e pula sem ele; o código antigo passa nos testes de integração contra o schema novo; nenhuma consulta de conferência dá erro.

### Task 1b: RLS das cinco tabelas novas e quem executa as funções (item 11)

*(emenda do portão: S-I10. Tarefa nova: era um parágrafo dentro da Tarefa 1, e ninguém o executou. É a única prova do item 11.)*

**Files:**
- Create: `apps/web/test/integration/observatorio-a5-e1-e2-rls.test.ts`

**Interfaces:**
- Consumes: as tabelas e funções da Tarefa 1a (já aplicadas no banco local); `seedSite` de `../helpers/db-seed`; o molde do cliente `pg` com papel sem superusuário de `apps/api/test/rls/blog.test.ts:144-210`.
- Produces: nada além do teste.

**Como as policies decidem** (lido no banco local em 12/10 com `pg_get_functiondef`): `can_view_site(site)` = super admin, **ou** admin da organização do site, **ou** qualquer linha em `site_memberships` para o site e o usuário; `can_edit_site(site)` = super admin, **ou** admin da organização, **ou** `site_memberships` com `role = 'editor'`. Nenhuma das duas lê o GUC `app.site_id`: o caso "GUC forjado" prova exatamente isso (o padrão `reference_rls_guc_spoof_pattern` da memória do projeto).

**Os três usuários:** `fora` (em `auth.users`, sem nenhum vínculo), `leitor` (`site_memberships` com `role = 'reporter'`) e `editor` (`site_memberships` com `role = 'editor'`). Nenhum é super admin nem admin da organização.

**A tabela dos casos** (cada célula é uma asserção; 0 = lê zero linhas, N = lê as linhas semeadas, erro = `permission denied` ou violação de policy):

| Quem (com `app.site_id` forjado para o site) | `competitor_field_versions` | `competitor_video_early` | `competitor_video_tier_spans` | `competitor_raw` | `competitor_removed_items` | `insert` em qualquer uma das cinco | `apply_competitor_field_plan`, `youtube_quota_add` |
|---|---|---|---|---|---|---|---|
| `anon` | 0 | 0 | 0 | 0 | 0 | erro | erro |
| `fora` (`authenticated`) | 0 | 0 | 0 | 0 | 0 | erro | erro |
| `leitor` | N | N | N | **0** | **0** | erro | erro |
| `editor` | N | N | N | N | N | erro | erro |

São 4 × 5 leituras, 4 × 5 escritas e 4 × 2 funções: 48 asserções. `insert` tem de falhar para todos porque nenhuma das cinco tabelas tem policy de escrita (só o `service_role`, que ignora RLS, escreve).

- [ ] **Step 1: escrever o teste.**

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const READ = ['competitor_field_versions', 'competitor_video_early', 'competitor_video_tier_spans'] as const
const EDIT = ['competitor_raw', 'competitor_removed_items'] as const
const ALL = [...READ, ...EDIT]
type Who = 'anon' | 'fora' | 'leitor' | 'editor'

describe.skipIf(skipIfNoLocalDb())('A5 E1 e E2: RLS das tabelas novas com GUC forjado (item 11)', () => {
  const sb = getSupabaseServiceClient()
  const users: Record<Exclude<Who, 'anon'>, string> = { fora: randomUUID(), leitor: randomUUID(), editor: randomUUID() }
  let pg: Client, siteId = '', ch = '', vid = ''
  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    siteId = (await seedSite(sb)).siteId
    // os três usuários e os dois vínculos, direto no banco (o cliente pg conecta como postgres)
    for (const id of Object.values(users)) await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [id, id + '@a5.test'])
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'reporter'), ($1, $3, 'editor')`, [siteId, users.leitor, users.editor])
    ch = (await sb.from('competitor_channels').insert({ site_id: siteId, channel_id: 'UCa5rls', channel_name: 'RLS' }).select('id').single()).data!.id
    vid = (await sb.from('competitor_videos').insert({ competitor_channel_id: ch, video_id: 'a5rlsvid001' }).select('id').single()).data!.id
    const now = new Date().toISOString(), today = now.slice(0, 10)
    // uma linha em cada uma das cinco tabelas, pelo cliente de serviço
    expect((await sb.rpc('apply_competitor_field_plan', { p_site_id: siteId, p_channel_id: ch, p_close: [], p_open: [{ video_id: vid, field: 'tags', value: [], value_hash: 'h', first_seen_at: now, window_start: null, precision: 'first' }] })).error).toBeNull()
    expect((await sb.rpc('apply_competitor_raw_plan', { p_site_id: siteId, p_channel_id: ch, p_close: [], p_open: [{ video_id: vid, raw_sha256: 'r', first_seen_at: now, raw: { id: 'x' } }] })).error).toBeNull()
    expect((await sb.rpc('apply_competitor_tier_plan', { p_site_id: siteId, p_channel_id: ch, p_changes: [{ video_id: vid, tier: 'diaria' }], p_today: today })).error).toBeNull()
    expect((await sb.from('competitor_video_early').insert({ video_id: vid, taken_at: now, site_id: siteId, views: 1 })).error).toBeNull()
    expect((await sb.from('competitor_removed_items').insert({ site_id: siteId, kind: 'video', youtube_id: 'a5rlsgone01', decided_by: users.editor, rows_deleted: {} })).error).toBeNull()
  })
  afterAll(async () => {
    await sb.from('competitor_removed_items').delete().eq('site_id', siteId)
    await sb.from('competitor_channels').delete().eq('site_id', siteId)
    await pg.query('delete from public.site_memberships where site_id = $1', [siteId])
    await pg.query('delete from auth.users where id = any($1)', [Object.values(users)])
    await sb.from('sites').delete().eq('id', siteId)
    await pg.end()
  })

  /** Roda `sql` como `who`, com o GUC app.site_id FORJADO para o site, numa transação desfeita. Devolve as linhas ou o erro. */
  async function as(who: Who, sql: string, params: unknown[] = []): Promise<{ rows: number; error: string | null }> {
    await pg.query('begin')
    try {
      if (who !== 'anon') await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: users[who], role: 'authenticated' })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [siteId])
      await pg.query(who === 'anon' ? 'set local role anon' : 'set local role authenticated')
      const r = await pg.query(sql, params)
      return { rows: r.rowCount ?? 0, error: null }
    } catch (e) {
      return { rows: 0, error: e instanceof Error ? e.message : String(e) }
    } finally {
      await pg.query('rollback')
    }
  }
  const sees = (who: Who, table: string): boolean => (who === 'editor') || (who === 'leitor' && (READ as readonly string[]).includes(table))

  for (const who of ['anon', 'fora', 'leitor', 'editor'] as const) {
    for (const table of ALL) {
      it(`${who} lê ${table}: ${sees(who, table) ? 'a linha do site' : 'nada'}`, async () => {
        const r = await as(who, `select 1 from public.${table} where site_id = $1`, [siteId])
        // anon pode receber "permission denied" (sem grant) em vez de zero linhas: os dois são "não lê"
        if (sees(who, table)) expect(r).toEqual({ rows: 1, error: null })
        else expect(r.rows).toBe(0)
      })
      it(`${who} não insere em ${table}`, async () => {
        const direct = table === 'competitor_video_early'
          ? await as(who, `insert into public.competitor_video_early (video_id, taken_at, site_id, views) values ($1, now() + interval '1 second', $2, 1)`, [vid, siteId])
          : table === 'competitor_video_tier_spans'
            ? await as(who, `insert into public.competitor_video_tier_spans (video_id, from_date, tier, site_id) values ($1, current_date + 400, 'diaria', $2)`, [vid, siteId])
            : table === 'competitor_removed_items'
              ? await as(who, `insert into public.competitor_removed_items (site_id, kind, youtube_id, decided_by, rows_deleted) values ($1, 'video', 'a5rlsnew0001', $2, '{}')`, [siteId, randomUUID()])
              : table === 'competitor_raw'
                ? await as(who, `insert into public.competitor_raw (site_id, competitor_channel_id, raw_sha256, first_seen_at, last_seen_at, is_current, raw) values ($1, $2, 'z', now(), now(), false, '{}')`, [siteId, ch])
                : await as(who, `insert into public.competitor_field_versions (site_id, competitor_channel_id, field, value_hash, first_seen_at, last_seen_at, precision, is_current) values ($1, $2, 'name', 'z', now(), now(), 'first', false)`, [siteId, ch])
        expect(direct.error, 'insert direto tinha de falhar').not.toBeNull()
      })
    }
    it(`${who} não executa as funções de escrita`, async () => {
      expect((await as(who, `select public.apply_competitor_field_plan($1, $2, '[]'::jsonb, '[]'::jsonb)`, [siteId, ch])).error).toMatch(/permission denied/)
      expect((await as(who, `select public.youtube_quota_add($1, current_date, 1)`, [siteId])).error).toMatch(/permission denied/)
    })
  }
})
```

Notas para o implementador: (1) confira o nome e as colunas obrigatórias de `site_memberships` e de `auth.users` no banco local antes de rodar (`\d public.site_memberships`); se o `insert` em `auth.users` pedir mais colunas, copie as de `test/helpers/db-seed.ts:33`. (2) Se `seedSite` já criar usuário e vínculo de admin da organização, **não** reaproveite esse usuário: admin da organização passa nas duas funções e esconderia a diferença entre `leitor` e `editor`.

- [ ] **Step 2: rodar.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/observatorio-a5-e1-e2-rls.test.ts > /tmp/a5-rls.txt 2>&1; grep -E "✓|×|Test Files|Tests " /tmp/a5-rls.txt | tail -60
```

Esperado: 44 testes (4 × 5 leituras, 4 × 5 escritas, 4 de funções), todos passam. Sem a variável: tudo pulado. **Um `leitor` que leia `competitor_raw` ou `competitor_removed_items` é falha da policy, não do teste: pare e relate** (a migration não vai ao dono assim).

- [ ] **Step 3: commit.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/test/integration/observatorio-a5-e1-e2-rls.test.ts && git diff --cached --name-only && git commit -m "test: RLS das cinco tabelas novas da A5 com GUC forjado, e funções de escrita só para o serviço (item 11)" -- apps/web/test/integration/observatorio-a5-e1-e2-rls.test.ts
```

**Pronto quando:** as 44 passam com o banco local; o resultado (número de testes) está no ledger. **É condição para a MG1 e a MG2 irem ao dono** (Tarefa 15, Step 3).

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
    expect([...VIDEO_FIELDS]).toEqual(['tags', 'category_id', 'duration_seconds', 'default_language', 'default_audio_language', 'live_broadcast_content', 'comments_disabled', 'likes_hidden', 'views_hidden', 'availability']) // (emenda do portão: D-m8)
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
// (emenda do portão: D-m8) views_hidden entra no catálogo: sem ele, a data em que a contagem foi ocultada só se deduzia da série.
export const VIDEO_FIELDS = ['tags', 'category_id', 'duration_seconds', 'default_language', 'default_audio_language', 'live_broadcast_content', 'comments_disabled', 'likes_hidden', 'views_hidden', 'availability'] as const
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
  // (emenda do portão: S-M2) o estado atual que o histórico compara também vai para a linha, e SÓ quando a parte veio:
  // snippet → tags, category_id, thumbnail_url; contentDetails → duration_seconds. Parte ausente não apaga a coluna.
  tags?: string[]; category_id?: string | null; thumbnail_url?: string | null; duration_seconds?: number | null
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
    expect(noSnippet.fields.map(f => f.field).sort()).toEqual(['availability', 'comments_disabled', 'duration_seconds', 'likes_hidden', 'views_hidden'])
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
    // (emenda do portão: S-M2) as mesmas regras que o laço da página usava: sem tags = lista vazia; miniatura = maxres, senão high
    const th = obj(sn.thumbnails)
    patch.tags = Array.isArray(sn.tags) ? sn.tags.filter((t): t is string => typeof t === 'string') : []
    patch.category_id = str(sn.categoryId)
    patch.thumbnail_url = str(obj(th?.maxres)?.url) ?? str(obj(th?.high)?.url)
  }
  if (cd) {
    const dur = durationOf(typeof cd.duration === 'string' ? cd.duration : undefined)
    fields.push({ field: 'duration_seconds', value: dur })
    patch.duration_seconds = dur
  }
  let hasViews = false
  if (st) {
    const views = optCount(st.viewCount), likes = optCount(st.likeCount), comments = optCount(st.commentCount)
    hasViews = views !== null
    patch.view_count = views; patch.like_count = likes; patch.comment_count = comments
    patch.views_hidden = views === null; patch.likes_hidden = likes === null; patch.comments_disabled = comments === null
    fields.push({ field: 'comments_disabled', value: comments === null }, { field: 'likes_hidden', value: likes === null }, { field: 'views_hidden', value: views === null })
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

*(emenda do portão: S-M2, D-m8)* Acrescente ao Step 1 dois testes: (1) `a linha do vídeo leva tags, categoria, miniatura e duração só quando a parte veio`: com o item completo, `patch` casa `{ tags: [...], category_id: '22', duration_seconds: <n>, thumbnail_url: <a maxres> }`; sem `snippet`, `'tags' in patch`, `'category_id' in patch` e `'thumbnail_url' in patch` são falsos; sem `contentDetails`, `'duration_seconds' in patch` é falso; com `snippet` sem `tags`, `patch.tags` é `[]`. (2) `views_hidden entra no histórico`: com `statistics: {}`, `fields` contém `{ field: 'views_hidden', value: true }`; sem `statistics`, não contém o campo. Se `str` devolver `undefined` para ausente (confira na Tarefa 2), troque o `??` da miniatura por um `||` com `null` no fim, para a coluna receber `null` e não `undefined`.

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

// (emenda do portão: S-I3) Nenhum `as unknown as`: a forma de cada linha lida é CONFERIDA, não afirmada.
/** As linhas de uma resposta do banco, cada uma conferida pela guarda. Resposta nula = nenhuma linha. Lança na primeira linha fora da forma. */
export function rowsAs<T>(data: unknown, guard: (x: unknown) => x is T, what: string): T[] {
  if (data == null) return []
  if (!Array.isArray(data)) throw new Error(what + ': a resposta do banco não é uma lista')
  const out: T[] = []
  for (const x of data) {
    if (!guard(x)) throw new Error(what + ': linha fora da forma esperada')
    out.push(x)
  }
  return out
}
export const isRec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const idOk = (x: Record<string, unknown>): boolean => typeof x.id === 'number' && (x.video_id === null || typeof x.video_id === 'string')
const isStoredField = (x: unknown): x is StoredField => isRec(x) && idOk(x) && typeof x.field === 'string' && typeof x.value_hash === 'string'
const isStoredRaw = (x: unknown): x is StoredRaw => isRec(x) && idOk(x) && typeof x.raw_sha256 === 'string'

async function readCurrent<T>(sb: SupabaseClient, table: 'competitor_field_versions' | 'competitor_raw', cols: string, channelId: string, scope: FieldScope, ids: string[], guard: (x: unknown) => x is T): Promise<T[]> {
  const q = sb.from(table).select(cols).eq('competitor_channel_id', channelId).eq('is_current', true)
  const { data, error } = await (scope === 'canal' ? q.is('video_id', null) : q.in('video_id', ids))
  fail(table, error)
  const rows = rowsAs(data, guard, 'captura: ' + table)
  if (rows.length >= MAX_ROWS) throw new Error('captura: ' + table + ' devolveu ' + MAX_ROWS + ' linhas ou mais numa leitura (1000 é o teto do PostgREST): lote grande demais')
  return rows
}

export async function captureItems(sb: SupabaseClient, p: { siteId: string; channelId: string; scope: FieldScope; items: readonly CaptureItem[]; nowIso: string }): Promise<CaptureStats> {
  const stats: CaptureStats = { fieldsOpened: 0, fieldsClosed: 0, rawOpened: 0, rawClosed: 0, rawTooBig: 0 }
  if (!p.items.length) return stats
  if (p.items.length > CAPTURE_CHUNK) throw new Error('captura: no máximo ' + CAPTURE_CHUNK + ' itens por chamada (vieram ' + p.items.length + ')')
  const ids = p.items.map(i => i.videoId).filter((x): x is string => x != null)
  const curFields = await readCurrent(sb, 'competitor_field_versions', 'id, video_id, field, value_hash', p.channelId, p.scope, ids, isStoredField)
  const curRaw = await readCurrent(sb, 'competitor_raw', 'id, video_id, raw_sha256', p.channelId, p.scope, ids, isStoredRaw)
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

const isMissedRow = (x: unknown): x is MissedRow => isRec(x) && typeof x.id === 'string' && typeof x.miss_streak === 'number'

export async function markMissing(sb: SupabaseClient, p: { siteId: string; channelId: string; videoIds: readonly string[]; nowIso: string; weeklySinceOf: (id: string) => string | null }): Promise<{ missed: number; newlyMissing: number }> {
  if (!p.videoIds.length) return { missed: 0, newlyMissing: 0 }
  const { data, error } = await sb.rpc('competitor_mark_missing', { p_channel_id: p.channelId, p_video_ids: [...p.videoIds], p_now: p.nowIso })
  if (error) throw new Error('ausência: ' + (error.message ?? 'erro do banco'))
  const rows = rowsAs(data, isMissedRow, 'ausência')
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
  const r = isMissedRow(data) ? data : null
  if (r?.missing_since) {
    await captureItems(sb, { siteId: p.siteId, channelId: p.channelId, scope: 'canal', nowIso: p.nowIso, items: [{
      videoId: null, fields: [{ field: 'availability', value: 'sumiu' }], raw: null, prevSeenAt: r.last_seen_at, weeklySince: null, firstSeenAt: r.miss_first_at ?? p.nowIso,
    }] })
  }
  return { missingSince: r?.missing_since ?? null }
}
```

Nota para o implementador: o falso do teste devolve as mesmas linhas para as duas tabelas conforme o nome; `captureItems` com escopo `'video'` e `ids` vazio (só acontece com escopo `'canal'`) nunca chama `.in('video_id', [])`.

*(emenda do portão: S-I3)* Acrescente ao Step 1 o teste de `rowsAs`: resposta nula dá lista vazia; lista com todas as linhas na forma devolve as mesmas linhas; uma linha fora da forma lança `/fora da forma esperada/`; resposta que não é lista lança. E um de `captureItems`: o falso devolvendo `[{ id: 'x' }]` (id que não é número) para `competitor_field_versions` faz a captura lançar em vez de planejar sobre lixo.

- [ ] **Step 4:** `npx vitest run test/youtube/competitor-capture.test.ts 2>&1 | tail -8 && npm run typecheck 2>&1 | tail -3 && bash ../../scripts/check-type-debt.sh | tail -1` → PASS, e a trava de dívida de tipos diz "estável: 148" *(emenda do portão: S-I3)*.

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
- *(emenda do portão: S-I5)* **Nenhuma gravação nova fica na frente da série do dia.** A série diária só existe hoje (a API dá o valor de agora); um defeito no código novo não pode custá-la. Regra: só lança na hora o que é **pré-requisito** da passada diária (a trava do canal, `channels.list`, a página de uploads, a leitura de todos os vídeos). Toda outra gravação nova (inserir o vídeo, regravar a linha do vídeo, a linha do canal, as primeiras horas, a troca de faixa, a promoção, a captura) usa `late`, que guarda o **primeiro** erro e deixa seguir; o erro guardado é lançado **no fim**, depois da passada diária, dos fixados e da marca de ausência, e antes de "Mark completion" (o canal termina em erro e não carimba `last_ok_synced_at`). A Tarefa 6b cria o auxiliar, logo depois de `fail`:

```ts
  /** (A5) O primeiro erro de uma gravação que NÃO é pré-requisito da série do dia: guardado aqui e lançado no fim. */
  let lateFailure: Error | null = null
  const late = (what: string, error: { message?: string } | null | undefined): boolean => {
    if (!error) return false
    lateFailure ??= new Error(what + ': ' + (error.message ?? 'erro do banco'))
    return true
  }
```

  e, imediatamente antes de `// Mark completion`, `if (lateFailure) throw lateFailure`. A `captureFailure` da Tarefa 7 passa a ser a mesma variável (`lateFailure ??= …` nos dois `catch`). **O bloco de notificações sobe para antes desse `throw`**: uma troca já gravada é verdadeira e é avisada mesmo que o canal termine em erro. A Tarefa 11a acrescenta o teste que prende a regra ("cada gravação nova falhando: a série do dia é gravada e o canal termina em erro").
- *(emenda do portão: S-M6)* **O texto do erro é o que o dono lê na lista de canais** (`humanizeSyncError` devolve a mensagem como veio). Os rótulos novos de `late` e de `fail` são frases em português, sem nome de função SQL na frente: `'não foi possível gravar o vídeo novo'`, `'não foi possível atualizar a linha do vídeo'`, `'não foi possível atualizar a linha do canal'`, `'não foi possível gravar as primeiras horas'`, `'não foi possível gravar a faixa da série'`, `'não foi possível promover o vídeo à leitura diária'`, `'não foi possível ler os vídeos do canal'`; em `competitor-capture.ts`, o prefixo `'captura: '` vira `'não foi possível guardar o histórico de campos: '`. Onde o plano escreve `fail('update video row', …)` e semelhantes nas Tarefas 6b a 11c, use o rótulo desta lista. Os rótulos antigos (em inglês) não são mexidos.
- *(emenda do portão: S-I2)* **Commit: sempre a lista de arquivos, nunca a pasta.** Os arquivos que estas tarefas podem tocar são: `apps/web/src/lib/youtube/competitor-sync.ts`, `apps/web/test/youtube/competitor-sync.test.ts`, `apps/web/test/youtube/competitor-sync-a5.test.ts`, `apps/web/test/youtube/competitor-sync-harness.ts` e, só se o falso próprio deles precisar da leitura nova, `apps/web/test/youtube/competitor-video-limit.test.ts`, `apps/web/test/youtube/competitor-backfill.test.ts` e `apps/web/test/integration/competitor-sync-versions.test.ts`. Cada tarefa abaixo diz os dela. Antes do commit: `git diff --cached --name-only`; arquivo fora da lista é parada.

*(emenda do portão: S-I10. A Tarefa 6 foi dividida: 6a, mover o falso do banco (um arquivo de 854 linhas muda de lugar: revisão própria); 6b, o comportamento.)*

### Task 6a: o falso do banco do sync de concorrentes vai para um arquivo de apoio (sem mudança de comportamento)

**Files:**
- Create: `apps/web/test/youtube/competitor-sync-harness.ts` (o falso do banco e os auxiliares, movidos do teste antigo)
- Modify: `apps/web/test/youtube/competitor-sync.test.ts` (importa o que foi movido; nenhuma asserção muda)

**Interfaces:**
- Consumes: nada.
- Produces (do arquivo de apoio): `fakeDb`, `setup`, `apiFetch`, `traced`, `updatesOf`, `rpcCalls`, `first`, `arg`, `rpcs`, `NOW`, `NOW_ISO`, `EARLY`, `ch`, `lockRow`, `recent`, `quiet`, `type Call`, `type SetupOpts`.

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
Expected: o mesmo número de testes de antes, todos verdes (anote o número antes de mover e compare). `git diff --stat` do arquivo de teste antigo tem de mostrar só linhas removidas e a linha de importação.

- [ ] **Step 2: commit.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/test/youtube/competitor-sync-harness.ts apps/web/test/youtube/competitor-sync.test.ts && git diff --cached --name-only && git commit -m "test: falso do banco do sync de concorrentes em arquivo de apoio (sem mudança de comportamento)" -- apps/web/test/youtube/competitor-sync-harness.ts apps/web/test/youtube/competitor-sync.test.ts
```

**Pronto quando:** o arquivo antigo passa com o mesmo número de testes; nenhuma asserção foi tocada; o commit tem os dois arquivos e mais nenhum.

### Task 6b: sincronização: as quatro partes, a linha do vídeo e os erros de gravação visíveis

**Files:**
- Create: `apps/web/test/youtube/competitor-sync-a5.test.ts`
- Modify: `apps/web/test/youtube/competitor-sync-harness.ts` (`apiFetch`), `apps/web/test/youtube/competitor-sync.test.ts` (quatro expectativas mudam)
- Modify: `apps/web/src/lib/youtube/competitor-sync.ts`

**Interfaces:**
- Consumes: `optCount`, `videoObservedOf` (Tarefas 2 e 3); o arquivo de apoio (Tarefa 6a).
- Produces: `export const VIDEO_PARTS = 'snippet,statistics,contentDetails,liveStreamingDetails'`; `SyncResult` ganha `partsMissing?: number`; dentro de `syncCompetitorChannel`, os conjuntos `patched` e `seen`, a função `patchFetched(items, byYt)` e *(emenda do portão: S-I5)* `late` e `lateFailure` (o texto está na "Regra das Tarefas 6 a 11"), que as tarefas seguintes usam.

*(Os passos abaixo mantêm a numeração original, de 2 a 8.)*

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
   * zerada. Uma vez por sincronização. Erro de gravação nunca é "ok": é guardado (late) e o canal termina em erro, depois da série do dia.
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
      // (emenda do portão: S-I5) não lança: a série do dia vem antes; o erro é guardado e o canal termina em erro
      if (late('não foi possível atualizar a linha do vídeo', error)) continue
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
          // (emenda do portão: S-I5) um vídeo que não grava não derruba os outros 49 nem a série do dia
          if (late('não foi possível gravar o vídeo novo', insErr)) continue
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
            is_short: isShort,
            // (emenda do portão: S-M2) tags, category_id, thumbnail_url e duration_seconds vêm de observed.patch, só quando a parte veio
            ...observed.patch,
          })
          .eq('id', existing.id)
        seen.add(existing.id as string)
        if (!late('não foi possível atualizar a linha do vídeo', updErr)) patched.add(existing.id as string)
```

(g) No `return` de sucesso, acrescente `...(partsMissing ? { partsMissing } : {})`.

(h) *(emenda do portão: S-I5)* Crie `late` e `lateFailure` (texto na "Regra das Tarefas 6 a 11"), o `if (lateFailure) throw lateFailure` antes de `// Mark completion`, e suba o bloco de notificações para antes dele.

*(emenda do portão: S-I5, S-M2)* Dois testes a mais no Step 3: (1) `erro ao regravar a linha de um vídeo: os outros são regravados, a série do dia é gravada, e o canal termina em erro com a frase em português` (o falso devolve erro no `update` de `competitor_videos` para um uuid; afirme `dailyRecorded` no que foi gravado em `competitor_video_daily` e `rejects.toThrow(/não foi possível atualizar a linha do vídeo/)`); (2) `resposta sem snippet: a linha do vídeo não perde tags, categoria nem miniatura` (o corpo do `update` não tem as chaves `tags`, `category_id` nem `thumbnail_url`; com `snippet`, tem as três).

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
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync.test.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts && git diff --cached --name-only && git commit -m "feat: sync de concorrentes pede as quatro partes e grava sinalizadores, ao vivo e discovered_at; contagem ausente é nulo, nunca 0 (A5 E1)" -- apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync.test.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts
```

*(emenda do portão: S-I2)* O original terminava em `-- … apps/web/test/youtube`, uma pasta: levaria os testes modificados da A4 que estão debaixo dela. Se o `grep` do Step 6 mudou outro arquivo de teste, acrescente-o pelo nome às duas listas.

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
    expect(f.filter(x => x.video_id === 'v-1').map(x => x.field).sort()).toEqual(['availability', 'category_id', 'comments_disabled', 'default_audio_language', 'default_language', 'duration_seconds', 'likes_hidden', 'live_broadcast_content', 'tags', 'views_hidden'])
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
  // (emenda do portão: S-I5) a captura nunca impede a série do dia: a falha vai para a mesma `lateFailure` da Tarefa 6b
  // (onde este texto escreve `captureFailure ??= …`, escreva `lateFailure ??= …`; não há segunda variável)
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

No `update` de `competitor_channels` que grava `channel_name`, acrescente `...chObserved.patch, ...(channelCaptured ? { last_seen_at: nowIso } : {}),` e confira o erro *(emenda do portão: S-I5)* sem lançar (`const { error: chErr } = await …; late('não foi possível atualizar a linha do canal', chErr)`). No `upsert` de `competitor_channel_snapshots`, acrescente `subscribers_hidden: chObserved.patch.subscribers_hidden,`.

(f) Página: declare `const pagePairs: Array<{ uuid: string; item: unknown }> = []` junto de `const touchIds`; dentro do laço, logo depois de resolvido `videoUuid` (antes do `if (!existing) continue`), `if (videoUuid) pagePairs.push({ uuid: videoUuid, item: video })`; depois do bloco `if (touchIds.length) { … }`, `await captureFetched(pagePairs)`.

(g) Passada diária e fixados: logo depois de cada `await patchFetched(…)`, acrescente `await captureFetched(items.filter(it => byYt.has(it.id)).map(it => ({ uuid: byYt.get(it.id)!.id, item: it })))` (na dos fixados a lista se chama `fetched`).

(h) Fim: o `if (lateFailure) throw lateFailure` da Tarefa 6b já cobre a captura (não acrescente outro `throw`). No `return` de sucesso, acrescente `...(cap.fieldsOpened ? { fieldsOpened: cap.fieldsOpened } : {}), ...(cap.rawOpened ? { rawOpened: cap.rawOpened } : {}), ...(cap.rawTooBig ? { rawTooBig: cap.rawTooBig } : {})`, e os três campos opcionais em `SyncResult`.

- [ ] **Step 5:** rodar o comando da regra → verde. Testes antigos que enumeram chamadas ao banco passam a ver as leituras de `competitor_field_versions` e `competitor_raw`: atualize a lista.

- [ ] **Step 6: commit.** *(emenda do portão: S-I2)*

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync.test.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts && git diff --cached --name-only && git commit -m "feat: captura de campos e raw do canal e dos vídeos no sync de concorrentes; nada é regravado quando nada muda (A5 E1)" -- apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync.test.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts
```

**Pronto quando:** itens 1, 2, 3, 4 e 223 provados na sincronização; a falha de captura não perde a série do dia, não carimba o "visto" e deixa o canal em erro. *(emenda do portão: S-I4)* O teste "a captura falha" afirma também que a linha do vídeo foi regravada com `last_checked_at` (é por esse carimbo que a prova embutida enxerga a falha no disparo seguinte).

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
        // (emenda do portão: S-M5) a marca que falha não some: vai ao Sentry e entra no texto do erro do canal
        try { await markChannelMissing(supabase, { siteId: channelRow.site_id, channelId: channelRow.id, nowIso }) } catch (e) {
          Sentry.captureException(e, { tags: { component: 'sync-youtube', mode: 'competitors-missing' }, extra: { channelId: channelRow.channel_id } })
          throw new Error(`YouTube API 404 for channel ${channelRow.channel_id} (e a falta não foi registrada: ${e instanceof Error ? e.message : String(e)})`)
        }
      }
```

(O arquivo já importa `Sentry`? Se não, `import * as Sentry from '@sentry/nextjs'`; os testes já o trocam por falso.) Teste a mais: `a marca de ausência do canal falhando: o erro do canal continua sendo o 404 e traz "a falta não foi registrada"` (com `rpcFail: 'competitor_channel_mark_missing'` e `channelItems: []`).

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

- [ ] **Step 5:** rodar o comando da regra → verde.

- [ ] **Step 6: commit.** *(emenda do portão: S-I2)*

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync.test.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts && git diff --cached --name-only && git commit -m "feat: vídeo e canal que deixam de vir do YouTube são marcados na segunda leitura seguida, e a volta fica no histórico; nada é apagado (A5 E1)" -- apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync.test.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts
```

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
// (emenda do portão: D-I5b) `extra` = contadores do dia somados em operations (partes_ausentes, mudancas_janela_longa, erros_cota…);
// `max` = chaves que guardam o maior valor do dia (teto_diario_cortados, semanais_adiados)
export async function recordQuota(sb: SupabaseClient, p: { siteId: string; nowMs: number; units: number; mode: string; cut?: number; extra?: Record<string, number>; max?: Record<string, number> }): Promise<void>  // lança em erro
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
export async function recordQuota(sb: SupabaseClient, p: { siteId: string; nowMs: number; units: number; mode: string; cut?: number; extra?: Record<string, number>; max?: Record<string, number> }): Promise<void> {
  // (emenda do portão: D-I5b) os contadores que só existiam na resposta do cron (que ninguém guarda) vão para a linha do dia
  const extra = Object.fromEntries(Object.entries(p.extra ?? {}).filter(([, v]) => v > 0))
  const max = { ...(p.cut ? { teto_diario_cortados: p.cut } : {}), ...Object.fromEntries(Object.entries(p.max ?? {}).filter(([, v]) => v > 0)) }
  if (p.units <= 0 && !Object.keys(extra).length && !Object.keys(max).length) return
  const { error } = await sb.rpc('youtube_quota_add', {
    p_site_id: p.siteId, p_day: pacificDate(p.nowMs), p_units: Math.max(p.units, 0), p_add: { ...(p.units > 0 ? { [p.mode]: p.units } : {}), ...extra },
    p_max: max,
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
  ['competitor_channels', 'weekly_pass_date'], // (emenda do portão: D-I3)
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
      if (!error) continue
      // (emenda do portão: S-M4) só "coluna ou tabela que não existe" é migration ausente: 42703 e 42P01 (Postgres),
      // PGRST204 e PGRST205 (o PostgREST não acha a coluna ou a tabela). Rede ou banco fora têm outra frase.
      const code = (error as { code?: string }).code ?? ''
      if (['42703', '42P01', 'PGRST204', 'PGRST205'].includes(code)) return 'migration ' + name + ' não aplicada (' + table + '): ' + (error.message ?? code) + '. Nada foi gravado.'
      return 'não foi possível conferir o schema (' + table + '): ' + (error.message ?? 'erro do banco') + '. Nada foi gravado.'
    }
  }
  return null
}
```

Em `competitor-sync.ts`: importe `recordQuota`; `SyncResult` ganha `quotaError?: true`. Imediatamente antes do `return` de sucesso:

```ts
    let quotaError = false
    // (emenda do portão: D-I5b) partes_ausentes vai junto: é o único lugar durável desse número
    try { await recordQuota(supabase, { siteId: channelRow.site_id, nowMs, units: unitsUsed, mode: 'competitors', extra: { partes_ausentes: partsMissing } }) } catch { quotaError = true }
```

*(emenda do portão: D-I5b)* `SyncResult` ganha também `quotaUnitsLost?: number` (= `unitsUsed` quando `quotaError`): o lote soma o que não foi gravado e tenta uma vez no fim do disparo (Tarefa 13). Dois testes a mais em `competitor-quota.test.ts`: `extra e max vão para p_add e p_max; chave com 0 não vai` e `units 0 com extra ainda grava (soma 0 unidades)`; e em `competitor-health.test.ts`: `erro com código 42703 diz "migration … não aplicada"; erro sem código (rede) diz "não foi possível conferir o schema"`.

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

- [ ] **Step 5: commit.** *(emenda do portão: S-I2; o original passava `apps/web/src/lib/youtube` e `apps/web/test`, duas pastas onde a A4 tem arquivo modificado.)*

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/competitor-quota.ts apps/web/src/lib/youtube/competitor-health.ts apps/web/src/lib/youtube/competitor-sync.ts apps/web/src/app/api/cron/sync-youtube/route.ts apps/web/test/youtube/competitor-quota.test.ts apps/web/test/youtube/competitor-health.test.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts apps/web/test/youtube/cron-competitors-prova.test.ts apps/web/test/youtube/cron-competitors-invalidate.test.ts apps/web/test/youtube/cron-route.test.ts apps/web/test/api/cron/sync-youtube.test.ts && git diff --cached --name-only && git commit -m "feat: cota dos concorrentes somada na linha do dia do Pacífico, e guarda de schema no cron (A5 E1)" -- apps/web/src/lib/youtube/competitor-quota.ts apps/web/src/lib/youtube/competitor-health.ts apps/web/src/lib/youtube/competitor-sync.ts apps/web/src/app/api/cron/sync-youtube/route.ts apps/web/test/youtube/competitor-quota.test.ts apps/web/test/youtube/competitor-health.test.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts apps/web/test/youtube/cron-competitors-prova.test.ts apps/web/test/youtube/cron-competitors-invalidate.test.ts apps/web/test/youtube/cron-route.test.ts apps/web/test/api/cron/sync-youtube.test.ts
```

(Um arquivo da lista que não mudou simplesmente não entra no commit: a lista pode ficar inteira.)

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

(a) Importe `classifyTiers, type Tier` de `@/lib/youtube/competitor-tiers` e *(emenda do portão: S-I3)* `rowsAs, isRec` de `@/lib/youtube/competitor-capture`. `SyncResult` ganha `tierChanges?: number`, `cutByCap?: number`, `excludedNoCount?: number`. *(emenda do portão: D-I3)* A opção `weekly?: boolean` do texto original **não existe mais**: a sincronização do canal nunca lê os semanais; quem lê é `syncCompetitorWeekly` (Tarefa 11b).

(b) Troque `loadPinned` e `loadTracked` (e os comentários deles) por:

```ts
  /** Tudo o que o Observatório guarda deste canal: a base da faixa de cada vídeo, do "pedido e não veio" e da janela de cada mudança. */
  type FullRow = TrackedRow & {
    published_at: string | null; pinned_at: string | null; daily_until: string | null; series_tier: Tier | null; series_tier_since: string | null
    last_seen_at: string | null; missing_since: string | null; views_hidden: boolean | null; live_broadcast_content: string | null; discovered_at: string | null
  }
  const ALL_COLS = 'id, video_id, title, thumbnail_url, published_at, pinned_at, daily_until, series_tier, series_tier_since, last_seen_at, missing_since, views_hidden, live_broadcast_content, discovered_at'
  const PAGE = 1000 // max_rows do PostgREST: uma leitura maior viria cortada sem aviso, então pagina até a página curta
  // (emenda do portão: S-I3) a guarda confere as duas chaves de que tudo depende (os dois ids); as outras colunas são anuláveis
  // e chegam como o banco manda. Uma linha sem id é erro, nunca "canal sem vídeos".
  const isFullRow = (x: unknown): x is FullRow => isRec(x) && typeof x.id === 'string' && typeof x.video_id === 'string'
  /** Lança em erro de consulta: uma leitura que falha nunca é "canal sem vídeos". */
  const loadAll = async (): Promise<FullRow[]> => {
    const out: FullRow[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from('competitor_videos').select(ALL_COLS).eq('competitor_channel_id', channelRow.id).order('id').range(from, from + PAGE - 1)
      fail('não foi possível ler os vídeos do canal', error)
      const page = rowsAs(data, isFullRow, 'vídeos do canal') // (emenda do portão: S-I3) sem cast
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
      // (emenda do portão: S-I5) a faixa que não grava não impede a passada diária, que usa o plano em memória; o canal termina em erro
      if (!late('não foi possível gravar a faixa da série', error)) {
        for (const c of tierPlan.changes) { const r = byId.get(c.video_id); if (r) { r.series_tier = c.tier; r.series_tier_since = snapDate } }
      }
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

*(emenda do portão: S-I5, S-I3)* Dois testes a mais: `a troca de faixa falhando no banco: a passada diária grava os pontos e o canal termina em erro` (`rpcFail: 'apply_competitor_tier_plan'`: afirme o `upsert` em `competitor_video_daily` e `rejects.toThrow(/faixa da série/)`); e `uma sincronização às 12:00 com 50 vídeos diários faz 4 chamadas à API (canal, página, detalhes, 1 lote da passada) e NENHUMA para os semanais` (a conta da seção 4). Verificação a mais deste passo: `bash ../../scripts/check-type-debt.sh | tail -1` → "estável".

- [ ] **Step 7: commit.** *(emenda do portão: S-I2)* Se o Step 6 mexeu no falso de `competitor-video-limit.test.ts` ou de `competitor-backfill.test.ts`, eles entram pelo nome.

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync.test.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts apps/web/test/youtube/competitor-video-limit.test.ts apps/web/test/youtube/competitor-backfill.test.ts && git diff --cached --name-only && git commit -m "feat: faixa de série de cada vídeo dos concorrentes (diária ou semanal), gravada no tempo; a passada diária segue a faixa (A5 E2)" -- apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync.test.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts apps/web/test/youtube/competitor-video-limit.test.ts apps/web/test/youtube/competitor-backfill.test.ts
```

**Pronto quando:** itens 14, 18, 222 (a parte da sincronização) e 225 passam; os testes antigos que descrevem o canal por `tracked` e `pinned` continuam verdes sem serem tocados.

*(emenda do portão: S-I10, D-I3, S-I1, S-I6, S-M8, S-M9, D-I4. A Tarefa 11 foi dividida em três, cada uma com o seu commit, e a passada semanal foi redesenhada: 11a, as primeiras horas (perdem dado todo dia: vão primeiro e sozinhas); 11b, a leitura semanal como função própria, `syncCompetitorWeekly`, com a miniatura; 11c, a promoção decidida pelo estado gravado.)*

### Task 11a: sincronização (E2): as primeiras horas, e o teste que prende "a série do dia vem antes"

**Files:**
- Modify: `apps/web/src/lib/youtube/competitor-sync.ts`, `apps/web/test/youtube/competitor-sync-harness.ts`
- Test: `apps/web/test/youtube/competitor-sync-a5.test.ts`

**Interfaces:**
- Consumes: `earlyEligible` (Tarefa 5); `late` (Tarefa 6b); `pagePairs`, `observed` (Tarefas 6b e 7).
- Produces: `SyncResult` ganha `earlyRecorded?: number`. O falso ganha a resposta de `competitor_video_early`.

- [ ] **Step 1: o falso.** No roteiro de `setup`: `if (c.table === 'competitor_video_early' && first(c) === 'upsert') return { data: c.ops[0]![1][0] }`. E uma opção `failWrite?: string` (nome de tabela ou `'rpc:<função>'`): a primeira gravação (`insert`, `update`, `upsert` ou a função) nessa tabela devolve `{ data: null, error: { message: 'boom' } }`.

- [ ] **Step 2: testes que falham** (num `describe('A5 E2: primeiras horas', …)`; `ROW1`, `page`, `EARLY` são os das tarefas anteriores):

```ts
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
  // (emenda do portão: S-I5) a regra "nenhuma gravação nova na frente da série do dia", presa para as SEIS gravações novas
  it.each([
    ['competitor_video_early', /primeiras horas/],
    ['rpc:apply_competitor_tier_plan', /faixa da série/],
    ['rpc:apply_competitor_field_plan', /histórico de campos/],
    ['rpc:apply_competitor_raw_plan', /histórico de campos/],
    ['competitor_channels:patch', /linha do canal/],
    ['competitor_videos:update', /linha do vídeo/],
  ] as Array<[string, RegExp]>)('gravação nova falhando (%s): a série do dia é gravada inteira e o canal termina em erro', async (failWrite, msg) => {
    const fresh = { ...ROW1, discovered_at: new Date(NOW.getTime() - 3_600_000).toISOString(), published_at: new Date(NOW.getTime() - 2 * 3_600_000).toISOString() }
    const db = setup({ lastDaily: '2026-10-23', existing: [fresh], failWrite })
    await expect(syncCompetitorChannel(ch, 'k', { now: NOW, fetchImpl: apiFetch(page({ snippet: { ...page().snippet, publishedAt: fresh.published_at } })), ...quiet })).rejects.toThrow(msg)
    // a passada diária rodou e gravou o ponto de hoje, apesar da falha
    const up = db.calls.find(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')
    expect(up, 'a série do dia não foi gravada').toBeDefined()
    expect((arg(up!, 'upsert') as unknown[]).length).toBeGreaterThan(0)
    // e o canal não foi marcado como sincronizado com sucesso
    expect(db.calls.some(c => c.table === 'competitor_channels' && first(c) === 'update' && 'last_ok_synced_at' in (arg(c, 'update') ?? {}))).toBe(false)
  })
```

(`'competitor_channels:patch'` é o `update` do canal que leva `custom_url`; `'competitor_videos:update'` é o primeiro `update` de `competitor_videos`: escreva `failWrite` no falso de modo a distinguir esses dois sufixos. `NOW` é 12:00 de São Paulo, então a passada diária é devida.)

- [ ] **Step 3:** rodar → FAIL.

- [ ] **Step 4: implementar.** Importe `earlyEligible` de `@/lib/youtube/competitor-tiers`; `SyncResult` ganha `earlyRecorded?`; declare `let earlyRecorded = 0` junto dos outros contadores, fora do `try`.

(a) No laço da página. O `select` de `existingVideos` ganha `, discovered_at, published_at`. Declare `const earlyRows: Array<{ video_id: string; taken_at: string; site_id: string; views: number; likes: number | null; comments: number | null }> = []` junto de `pagePairs`; dentro do laço, depois de resolvido `videoUuid`:

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
        // (emenda do portão: S-I5) não lança: as primeiras horas não ficam na frente da série do dia
        if (!late('não foi possível gravar as primeiras horas', error)) earlyRecorded += earlyRows.length
      }
```

(b) No `return` de sucesso: `...(earlyRecorded ? { earlyRecorded } : {})`.

- [ ] **Step 5:** rodar o comando da regra → verde, com os seis casos do `it.each`. Se um deles falhar porque a gravação lança na hora, é o `fail` que tinha de ser `late`: conserte no código, não no teste.

- [ ] **Step 6: commit.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts && git diff --cached --name-only && git commit -m "feat: primeiras horas dos vídeos novos na coleta de concorrentes; nenhuma gravação nova fica na frente da série do dia (A5 E2)" -- apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts
```

**Pronto quando:** o item 16 passa; os seis casos de "gravação nova falhando" passam; este commit pode ir a produção sem a 11b e sem a 11c.

### Task 11b: a leitura semanal como função própria (`syncCompetitorWeekly`), com a miniatura

**Files:**
- Modify: `apps/web/src/lib/youtube/competitor-sync.ts`, `apps/web/test/youtube/competitor-sync-harness.ts`
- Test: `apps/web/test/youtube/competitor-sync-a5.test.ts`

**Interfaces:**
- Consumes: `weeklyDue`, `addDays` (Tarefa 5); `RULES.series`; `rowsAs`, `isRec` (Tarefa 4); `recordQuota` (Tarefa 9); `loadAll`, `FullRow`, `outOfProof`, `rowInfo`, `patchFetched`, `captureFetched`, `asked`, `seen`, `late` (Tarefas 6b a 10).
- Produces:

```ts
export interface WeeklyResult {
  /** vídeos semanais devidos hoje neste canal */
  due: number
  /** pontos gravados na série nesta visita */
  recorded: number
  /** devidos que o relógio não deixou conferir: continuam devidos pelo dado */
  deferred: number
  promoted: number
  unitsUsed: number
  changesDetected: number
  longWindowChanges: number
  /** true = nada ficou adiado; o canal foi carimbado com weekly_pass_date = hoje */
  complete: boolean
  /** o canal está sendo sincronizado agora por outro processo: nada foi feito */
  skipped?: boolean
}
/**
 * A leitura semanal de UM canal (A5 E2, OP-15): os vídeos em faixa semanal que são devidos hoje. Chamada pela fase semanal do
 * lote (Tarefa 13) e, na E16, pela tarefa serie_semanal. Não faz channels.list nem lê a página de uploads, não mexe em
 * last_synced_at nem em sync_status, e não põe o canal em erro: se lançar, quem chama conta o erro e tenta no disparo seguinte.
 */
export async function syncCompetitorWeekly(
  channelRow: { id: string; channel_id: string; site_id: string },
  apiKey: string,
  opts?: { now?: Date; fetchImpl?: typeof fetch; /** true = pare de começar vídeo novo */ deadline?: () => boolean; /** false = não confere a miniatura (pergunta 1 da seção 1) */ thumbs?: boolean },
): Promise<WeeklyResult>
```

**Como se encaixa no arquivo (S-M9).** `syncCompetitorChannel` tem hoje os auxiliares dentro dela, fechados sobre `supabase`, `nowIso`, `api` e os conjuntos da sincronização. Para a leitura semanal usar **os mesmos** auxiliares (`reconcileVideo`, `patchFetched`, `captureFetched`, a marca de ausência), o corpo vira uma função interna com o modo como parâmetro, e as duas exportadas a chamam:

```ts
type RunMode = 'slot' | 'weekly'
type RunOpts = { now?: Date; fetchImpl?: typeof fetch; probeBudget?: ProbeBudget; deferBackfill?: boolean; deadline?: () => boolean; thumbs?: boolean }
export async function syncCompetitorChannel(channelRow: ChannelRef, apiKey: string, opts: RunOpts = {}): Promise<SyncResult> {
  const r = await runChannel(channelRow, apiKey, opts, 'slot')
  if (r.kind !== 'slot') throw new Error('runChannel: modo trocado')
  return r.result
}
export async function syncCompetitorWeekly(channelRow: ChannelRef, apiKey: string, opts: RunOpts = {}): Promise<WeeklyResult> {
  const r = await runChannel(channelRow, apiKey, opts, 'weekly')
  if (r.kind !== 'weekly') throw new Error('runChannel: modo trocado')
  return r.result
}
type ChannelRef = { id: string; channel_id: string; site_id: string }
async function runChannel(channelRow: ChannelRef, apiKey: string, opts: RunOpts, mode: RunMode): Promise<{ kind: 'slot'; result: SyncResult } | { kind: 'weekly'; result: WeeklyResult }> {
  // … o corpo de hoje. Três diferenças no modo 'weekly', marcadas abaixo.
}
```

É uma mudança de embrulho: no modo `'slot'` nada do comportamento muda (os testes das Tarefas 6b a 11a continuam verdes **sem serem tocados**: é a prova). O resto da função (cerca de 900 linhas com conjuntos compartilhados) fica como dívida registrada no ledger, com destino na E16.

- [ ] **Step 1: o falso.** Em `setup`: (1) opção `recentDaily?: Record<string, unknown>[]` e, **antes** da linha `competitor_video_daily` + `select` que já existe, `if (c.table === 'competitor_video_daily' && first(c) === 'select' && c.ops.some(o => o[0] === 'gte')) return { data: opts.recentDaily ?? [] }`; (2) a leitura do estado do canal no modo semanal: `if (c.table === 'competitor_channels' && first(c) === 'select') return { data: [{ ...lockRow, sync_status: opts.channelStatus ?? 'idle', sync_started_at: opts.channelStartedAt ?? null, video_limit: opts.videoLimit ?? lockRow.video_limit }] }` (opções novas `channelStatus?`, `channelStartedAt?`); (3) opção `recentChanges?: Record<string, unknown>[]`, devolvida para `competitor_video_versions` + `select` com um filtro `gte` em `first_seen_at` (a 11c usa).

- [ ] **Step 2: testes que falham** (num `describe('A5 E2: leitura semanal (syncCompetitorWeekly)', …)` que reaproveita `row`, `idsOf` e `echo` do `describe` da Tarefa 10; mova os três para o topo do arquivo; importe `syncCompetitorWeekly`, e `dayNumber`, `addDays`, `weekSlotOf` de `@/lib/youtube/competitor-tiers`, `hashValue` de `@/lib/youtube/competitor-versions`, `rpcs` do arquivo de apoio):

```ts
  const slotDate = (ytId: string) => { let d = '2026-10-24'; while (dayNumber(d) % 7 !== weekSlotOf(ytId)) d = addDays(d, 1); return d }
  const at12 = (date: string) => new Date(date + 'T15:00:00.000Z')
  const weeklyRow = (i: number, over: Record<string, unknown> = {}) => row(i, 400 + i, { series_tier: 'semanal', series_tier_since: '2026-09-01', ...over })
  const dailyRow = row(1, 1, { series_tier: 'diaria', series_tier_since: '2026-09-01' })
  const stamp = (db: { calls: Call[] }) => db.calls.filter(c => c.table === 'competitor_channels' && first(c) === 'update' && 'weekly_pass_date' in (arg(c, 'update') ?? {})).map(c => arg(c, 'update'))
  const pointsOf = (db: { calls: Call[] }) => db.calls.filter(c => c.table === 'competitor_video_daily' && first(c) === 'upsert').flatMap(c => arg(c, 'upsert') as Array<{ video_id: string }>).map(p => p.video_id)

  it('OP-15: no dia fixo o vídeo semanal é lido: uma chamada, a linha, os campos, o raw, a miniatura conferida, o ponto, e o canal carimbado', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [dailyRow, weeklyRow(7)] })
    const log = { dailyCalls: [] as string[] }
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log }) })
    expect(log.dailyCalls.flatMap(idsOf)).toEqual(['vid-7'])                // só o semanal: o diário não é desta função
    expect(arg(db.calls.find(c => c.table === 'competitor_video_daily' && first(c) === 'upsert')!, 'upsert')).toEqual([{ video_id: 'v-7', snap_date: day, views: 5, likes: 1, comments: 0, taken_at: at12(day).toISOString() }])
    expect(r).toMatchObject({ due: 1, recorded: 1, deferred: 0, complete: true, unitsUsed: 1 })
    expect(updatesOf(db, 'v-7').some(u => u.view_count === 5)).toBe(true)
    expect(rpcCalls(db, 'apply_competitor_raw_plan').flatMap(a => a.p_open as Array<{ video_id: string }>).some(o => o.video_id === 'v-7')).toBe(true)
    expect(vi.mocked(probeThumb)).toHaveBeenCalledWith('vid-7', null, expect.anything())   // D-I4: a miniatura do semanal É conferida
    expect(stamp(db)).toEqual([{ weekly_pass_date: day }])
    // não é uma sincronização do canal: nem channels.list, nem página, nem cursor, nem estado
    expect(db.calls.some(c => c.table === 'competitor_channels' && first(c) === 'update' && ('last_synced_at' in (arg(c, 'update') ?? {}) || 'sync_status' in (arg(c, 'update') ?? {})))).toBe(false)
  })
  it('D-I4: a primeira leitura de um vídeo sem versão de miniatura abre a linha de base e guarda a cópia; thumbs: false não sonda', async () => {
    const day = slotDate('vid-7')
    vi.mocked(probeThumb).mockResolvedValue({ etag: '"e1"', lastModified: null, dhash: 'abcd', bytes: Buffer.from('x'), url: 'https://i.ytimg.com/vi/vid-7/hqdefault.jpg' })
    const db = setup({ all: [weeklyRow(7)] })
    await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    const open = rpcs(db).find(p => p.p_video_id === 'v-7')!.p_open.find(o => o.field === 'thumb')!
    expect(open).toMatchObject({ precision: 'first', thumb_dhash: 'abcd', thumb_blob_url: 'https://blob.test/t.jpg' })
    expect(vi.mocked(archiveThumb)).toHaveBeenCalledTimes(1)
    vi.mocked(probeThumb).mockClear()
    setup({ all: [weeklyRow(7)] })
    await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }), thumbs: false })
    expect(vi.mocked(probeThumb)).not.toHaveBeenCalled()
  })
  it('OP-15: fora do dia fixo e com ponto há menos de 7 dias, não é pedido (e o canal é carimbado na hora); com 7 dias ou mais, é', async () => {
    const day = addDays(slotDate('vid-7'), 1)
    const log1 = { dailyCalls: [] as string[] }
    const db1 = setup({ all: [dailyRow, weeklyRow(7)], recentDaily: [{ video_id: 'v-7', snap_date: addDays(day, -6), views: 100 }] })
    const r1 = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log: log1 }) })
    expect(log1.dailyCalls).toEqual([])
    expect(r1).toMatchObject({ due: 0, complete: true, unitsUsed: 0 })
    expect(stamp(db1)).toEqual([{ weekly_pass_date: day }])
    const log2 = { dailyCalls: [] as string[] }
    setup({ all: [dailyRow, weeklyRow(7)], recentDaily: [{ video_id: 'v-7', snap_date: addDays(day, -7), views: 100 }] })
    await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log: log2 }) })
    expect(log2.dailyCalls.flatMap(idsOf)).toEqual(['vid-7'])
  })
  it('OP-15, D0: de 70 semanais, só os do dia fixo de hoje são lidos (a carga se espalha)', async () => {
    const all = Array.from({ length: 70 }, (_, i) => weeklyRow(100 + i, { series_tier_since: '2026-10-24' }))
    setup({ all })
    const log = { dailyCalls: [] as string[] }
    await syncCompetitorWeekly(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo, log }) })
    const got = log.dailyCalls.flatMap(idsOf)
    expect(got).toEqual(all.filter(r => dayNumber('2026-10-24') % 7 === weekSlotOf(r.video_id as string)).map(r => r.video_id))
    expect(got.length).toBeLessThan(30)
  })
  it('a conta de cota: 34 devidos = 1 chamada; 120 devidos = 3 chamadas', async () => {
    const day = '2026-10-24'
    const dueRows = (n: number) => Array.from({ length: 2000 }, (_, i) => weeklyRow(1000 + i)).filter(r => dayNumber(day) % 7 === weekSlotOf(r.video_id as string)).slice(0, n)
    for (const [n, calls] of [[34, 1], [120, 3]] as const) {
      setup({ all: dueRows(n) })
      const r = await syncCompetitorWeekly(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo }) })
      expect(r).toMatchObject({ due: n, recorded: n, unitsUsed: calls, complete: true })
    }
  })
  it('Review Focus 4: o relógio acaba no meio: o vídeo NÃO conferido não ganha ponto (o ponto é o recibo), o canal NÃO é carimbado, e os adiados são contados', async () => {
    const day = '2026-10-24'
    const due = Array.from({ length: 2000 }, (_, i) => weeklyRow(1000 + i)).filter(r => dayNumber(day) % 7 === weekSlotOf(r.video_id as string)).slice(0, 34)
    const db = setup({ all: due })
    let checked = 0
    vi.mocked(probeThumb).mockImplementation(async () => { checked++; return { etag: null, lastModified: null, dhash: null, bytes: null, url: '' } })
    const r = await syncCompetitorWeekly(ch, 'k', { now: NOW, fetchImpl: apiFetch(null, 200, { daily: echo }), deadline: () => checked >= 10 })
    expect(r).toMatchObject({ due: 34, recorded: 10, deferred: 24, complete: false })
    expect(pointsOf(db)).toEqual(due.slice(0, 10).map(x => x.id))        // só os 10 conferidos têm ponto
    expect(stamp(db)).toEqual([])
    // os 24 que vieram do YouTube e não foram conferidos NÃO contam como ausentes
    expect(rpcCalls(db, 'competitor_mark_missing')).toEqual([])
  })
  it('relógio fechado desde o começo: nenhuma chamada à API, tudo adiado', async () => {
    const day = slotDate('vid-7')
    setup({ all: [weeklyRow(7)] })
    const log = { dailyCalls: [] as string[] }
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log }), deadline: () => true })
    expect(log.dailyCalls).toEqual([])
    expect(r).toMatchObject({ due: 1, recorded: 0, deferred: 1, complete: false, unitsUsed: 0 })
  })
  it('o canal está sendo sincronizado agora (syncing há menos de 10 minutos): não faz nada e diz skipped', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7)], channelStatus: 'syncing', channelStartedAt: new Date(at12(day).getTime() - 60_000).toISOString() })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    expect(r).toMatchObject({ skipped: true, complete: false })
    expect(db.calls.some(c => first(c) === 'upsert' || c.table.startsWith('rpc:'))).toBe(false)
  })
  it('vídeo semanal pedido e não devolvido: uma falta (é assim que se descobre que saiu do ar); o canal é carimbado (ele foi PEDIDO)', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7)], missed: [{ id: 'v-7', miss_streak: 1, miss_first_at: at12(day).toISOString(), missing_since: null, last_seen_at: null }] })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: () => [] }) })
    expect(rpcCalls(db, 'competitor_mark_missing')[0]!.p_video_ids).toEqual(['v-7'])
    expect(r).toMatchObject({ due: 1, recorded: 0, deferred: 0, complete: true })
  })
  it('a API falha (HTTP 500): lança, o canal NÃO vai para erro, NÃO é carimbado, e nenhum vídeo conta como ausente', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7)] })
    await expect(syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: () => new Response('x', { status: 500 }) }) })).rejects.toThrow(/500/)
    expect(db.calls.some(c => c.table === 'competitor_channels' && first(c) === 'update')).toBe(false)
    expect(rpcCalls(db, 'competitor_mark_missing')).toEqual([])
  })
  it('S-M8: troca de título vista num semanal com a janela de 7 dias: versão, linha de mudança com a janela, e conta para o aviso', async () => {
    const day = slotDate('vid-7')
    const lastSeen = new Date(at12(day).getTime() - 7 * 86_400_000).toISOString()
    const db = setup({ all: [weeklyRow(7)], versions: [{ id: 'tv7', video_id: 'v-7', field: 'title', value_text: 'Antigo', value_hash: hashValue('Antigo'), thumb_etag: null, thumb_dhash: null, last_seen_at: lastSeen }] })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    const plan = rpcs(db).find(p => p.p_video_id === 'v-7')!
    expect(plan.p_changes).toHaveLength(1)
    expect(plan.p_changes[0]).toMatchObject({ window_start: lastSeen, window_end: at12(day).toISOString(), precision: '1d' }) // desvio D-12
    expect(r).toMatchObject({ changesDetected: 1, longWindowChanges: 0 })
  })
  it('S-M8, janela longa (60 dias): a versão E a linha de mudança são gravadas com a janela verdadeira (tela e Cowork contam igual), mas não conta para o aviso', async () => {
    const day = slotDate('vid-7')
    const lastSeen = new Date(at12(day).getTime() - 60 * 86_400_000).toISOString()
    const db = setup({ all: [weeklyRow(7)], versions: [{ id: 'tv7', video_id: 'v-7', field: 'title', value_text: 'Antigo', value_hash: hashValue('Antigo'), thumb_etag: null, thumb_dhash: null, last_seen_at: lastSeen }] })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    const plan = rpcs(db).find(p => p.p_video_id === 'v-7')!
    expect(plan.p_open.find(o => o.field === 'title')).toMatchObject({ window_start: lastSeen })
    expect(plan.p_changes).toHaveLength(1)
    expect(plan.p_changes[0]).toMatchObject({ window_start: lastSeen })
    expect(r).toMatchObject({ changesDetected: 0, longWindowChanges: 1 })
    expect(vi.mocked(createNotification)).not.toHaveBeenCalled()
  })
  it('a cota da leitura semanal vai para a linha do dia, na chave competitors_semanal, com os adiados e as mudanças de janela longa', async () => {
    const day = slotDate('vid-7')
    const db = setup({ all: [weeklyRow(7)] })
    await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    expect(rpcCalls(db, 'youtube_quota_add').at(-1)).toMatchObject({ p_units: 1, p_add: { competitors_semanal: 1 } })
  })
```

- [ ] **Step 3:** rodar → FAIL (`syncCompetitorWeekly` não existe).

- [ ] **Step 4: implementar.**

(a) O embrulho: `runChannel`, `syncCompetitorChannel` e `syncCompetitorWeekly`, como no bloco "Como se encaixa" acima. No fim do corpo, o `return` de sucesso de hoje vira `return { kind: 'slot', result: { … } }`; os dois `return` de `skipped` também.

(b) **Diferença 1 do modo semanal: a trava.** Logo no começo, antes do CAS:

```ts
  if (mode === 'weekly') {
    // Não toma a trava do canal nem mexe no cursor: só não entra enquanto outro processo o sincroniza (o conjunto de vídeos
    // é disjunto do da sincronização: lá, a faixa diária e a página; aqui, só a faixa semanal).
    const { data, error } = await supabase.from('competitor_channels').select('sync_status, sync_started_at, video_limit, last_ok_synced_at').eq('id', channelRow.id)
    if (error) throw new Error('leitura semanal: ' + (error.message ?? 'erro do banco'))
    const st = rowsAs(data, isRec, 'leitura semanal: canal')[0]
    if (!st) throw new Error('leitura semanal: canal não encontrado')
    const busy = st.sync_status === 'syncing' && typeof st.sync_started_at === 'string' && Date.parse(st.sync_started_at) > nowMs - 10 * 60_000
    if (busy) return { kind: 'weekly', result: { due: 0, recorded: 0, deferred: 0, promoted: 0, unitsUsed: 0, changesDetected: 0, longWindowChanges: 0, complete: false, skipped: true } }
  }
```

O CAS de hoje fica dentro de `if (mode === 'slot') { … }`; as variáveis que saem dele (`prevOkAt`, `videoLimit`, `syncMode`, `fullSyncDone`, `prevChannelSeenAt`) passam a `let` com os valores do modo semanal: `prevOkAt` = `last_ok_synced_at` lido acima; `videoLimit` = `video_limit ?? 50`; as outras, os valores neutros (`'incremental'`, `null`, `null`). A contagem `syncedCount` e `needsBackfill` só no modo `'slot'`.

(c) `reconcileVideo` ganha um último parâmetro `w: { weekly: boolean } = { weekly: false }`:
- **a miniatura é conferida também no semanal** (D-I4): o `try { probe = await probeThumb(…) }` fica como está, envolvido só por `if (opts.thumbs !== false || !w.weekly) { … }` (com `thumbs: false`, o semanal não sonda: `probe = null`, `action = 'skip'`).
- depois de `const plan = dropFields(rawPlan, current, skip)`:

```ts
    // (emenda do portão: S-M8) Um vídeo semanal é visto a cada 7 dias. Se a versão anterior foi vista há mais de 8, a coleta
    // ficou parada (ou o vídeo nunca tinha sido relido): a versão e a linha de mudança são gravadas com a janela verdadeira,
    // como qualquer outra (a tela e o Cowork contam igual, D3), mas isso não é "troca desta semana": não entra na conta do aviso.
    let longHere = 0
    if (w.weekly && plan.changes.length) {
      const floor = nowMs - RULES.series.weeklyMaxGapDays * 86_400_000
      longHere = plan.changes.filter(c => c.window_start == null || Date.parse(c.window_start) < floor).length
      longWindowChanges += longHere
    }
```

- e, onde hoje está `changesDetected += (data as { changes?: number } | null)?.changes ?? 0`, desconte: `changesDetected += Math.max(0, ((data as { changes?: number } | null)?.changes ?? 0) - longHere)`. (`let longWindowChanges = 0` junto dos outros contadores.)

(d) `reconcileFetched` ganha um terceiro parâmetro e devolve o que conferiu: `(items, byYt, o: { weekly?: boolean; stop?: () => boolean } = {}): Promise<FetchedItem[]>`. No laço, como primeira linha: `if (o.stop?.()) break`; a chamada vira `await reconcileVideo(row.id, it.id, { … }, currentMap.get(row.id) ?? [], touch, { weekly: o.weekly === true })`; cada item conferido entra numa lista `done`, que é o retorno (o `touch` é gravado como hoje, para os conferidos). As duas chamadas que já existem (passada diária e fixados) não passam o terceiro parâmetro e ignoram o retorno.

(e) Os pontos recentes, junto de `missingDaily`:

```ts
  type Point = { date: string; views: number }
  const isPointRow = (x: unknown): x is { video_id: string; snap_date: string; views: number | string } =>
    isRec(x) && typeof x.video_id === 'string' && typeof x.snap_date === 'string' && (typeof x.views === 'number' || typeof x.views === 'string')
  /** Os dois pontos mais recentes de cada vídeo nos últimos 8 dias. 100 ids × até 9 datas = 900 linhas: abaixo do corte de 1.000. */
  const loadRecentPoints = async (uuids: string[], today: string): Promise<Map<string, { last: Point; prev: Point | null }>> => {
    const out = new Map<string, { last: Point; prev: Point | null }>()
    const from = addDays(today, -RULES.series.weeklyMaxGapDays)
    for (let i = 0; i < uuids.length; i += 100) {
      const { data, error } = await supabase.from('competitor_video_daily').select('video_id, snap_date, views').in('video_id', uuids.slice(i, i + 100)).gte('snap_date', from).order('snap_date', { ascending: true })
      fail('load recent points', error)
      const rows = rowsAs(data, isPointRow, 'pontos recentes') // (emenda do portão: S-I3) sem cast
      if (rows.length >= 1000) throw new Error('load recent points: 1000 linhas ou mais numa leitura (corte do PostgREST)')
      for (const r of rows) { // ordem crescente: o último visto é o mais recente, e o anterior a ele fica em prev
        const p = { date: r.snap_date, views: Number(r.views) }
        out.set(r.video_id, { last: p, prev: out.get(r.video_id)?.last ?? null })
      }
    }
    return out
  }
```

(f) **Diferença 2 do modo semanal: o corpo.** Imediatamente antes do `try {` grande da sincronização:

```ts
  if (mode === 'weekly') {
    const today = spDate(nowMs)
    const stop = (): boolean => opts.deadline?.() === true
    const all = await loadAll()
    for (const r of all) if (!rowInfo.has(r.id)) rowInfo.set(r.id, { lastSeenAt: r.last_seen_at, weeklySince: r.series_tier === 'semanal' ? r.series_tier_since : null, missing: r.missing_since != null })
    const weeklyRows = all.filter(r => r.series_tier === 'semanal')
    const points = await loadRecentPoints(weeklyRows.map(r => r.id), today)
    const due = weeklyRows.filter(r => weeklyDue({ ytId: r.video_id, lastPoint: points.get(r.id)?.last.date ?? null, tierSince: r.series_tier_since }, today))
    let recorded = 0, deferred = 0
    for (let i = 0; i < due.length; i += 50) {
      if (stop()) { deferred += due.length - i; break }
      const chunk = due.slice(i, i + 50)
      const res = await api(`${YOUTUBE_API_BASE}/videos?part=${VIDEO_PARTS}&id=${chunk.map(c => c.video_id).join(',')}&key=${apiKey}`)
      if (!res.ok) throw new Error(`YouTube API ${res.status} for weekly statistics`)
      const body = await res.json()
      const byYt = new Map(chunk.map(c => [c.video_id, c]))
      const items = ((body.items ?? []) as FetchedItem[]).filter(it => byYt.has(it.id))
      // pedido e devolvido: nunca conta como ausente, mesmo que o relógio não deixe conferir
      for (const c of chunk) asked.add(c.id)
      for (const it of items) seen.add(byYt.get(it.id)!.id)
      // um vídeo por vez, com o relógio conferido antes de cada um (título, descrição e miniatura)
      const done = await reconcileFetched(items, byYt, { weekly: true, stop })
      await patchFetched(done, byYt)
      await captureFetched(done.map(it => ({ uuid: byYt.get(it.id)!.id, item: it })))
      // O PONTO É O RECIBO: só o vídeo conferido ganha o ponto de hoje. O que o relógio cortou continua "sem ponto hoje",
      // logo devido, e é lido no disparo seguinte.
      const rows = done.filter(it => it.statistics?.viewCount !== undefined).map(it => ({
        video_id: byYt.get(it.id)!.id, snap_date: today, views: parseInt(it.statistics!.viewCount!, 10),
        likes: it.statistics!.likeCount !== undefined ? parseInt(it.statistics!.likeCount, 10) : null,
        comments: it.statistics!.commentCount !== undefined ? parseInt(it.statistics!.commentCount, 10) : null,
        taken_at: nowIso,
      }))
      if (rows.length) {
        const { data: inserted, error } = await supabase.from('competitor_video_daily').upsert(rows, { onConflict: 'video_id,snap_date', ignoreDuplicates: true }).select('video_id')
        fail('record weekly views', error)
        recorded += (inserted ?? []).length
      }
      const cut = items.length - done.length
      if (cut > 0) { deferred += cut + Math.max(0, due.length - i - chunk.length); break }
    }
    // pedido e NÃO devolvido em nenhuma chamada: uma falta (a mesma regra da sincronização, Tarefa 8)
    const missedIds = [...asked].filter(id => !seen.has(id))
    if (missedIds.length) await markMissing(supabase, { siteId: channelRow.site_id, channelId: channelRow.id, videoIds: missedIds, nowIso, weeklySinceOf: id => rowInfo.get(id)?.weeklySince ?? null })
    const promoted = 0 // a Tarefa 11c troca esta linha pela promoção por estado
    if (lateFailure) throw lateFailure // linha do vídeo ou captura que não gravou: não carimba; o disparo seguinte refaz
    const complete = deferred === 0
    if (complete) {
      const { error } = await supabase.from('competitor_channels').update({ weekly_pass_date: today }).eq('id', channelRow.id)
      fail('stamp weekly pass', error)
    }
    try {
      await recordQuota(supabase, { siteId: channelRow.site_id, nowMs, units: unitsUsed, mode: 'competitors_semanal', extra: { mudancas_janela_longa: longWindowChanges }, max: { semanais_adiados: deferred } })
    } catch (e) { Sentry.captureException(e, { tags: { component: 'sync-youtube', mode: 'competitors-weekly-quota' } }) }
    return { kind: 'weekly', result: { due: due.length, recorded, deferred, promoted, unitsUsed, changesDetected, longWindowChanges, complete } }
  }
```

**Diferença 3:** o `catch (error)` grande da sincronização (que grava `sync_status: 'error'`) não é alcançado pelo modo semanal, porque este bloco está antes do `try`: um erro aqui sobe a quem chamou, sem tocar no estado do canal. É de propósito (seção 6: "a fase semanal falha num canal").

Notas: (1) o aviso de trocas (`createNotification`) continua só na sincronização do canal; a troca vista na leitura semanal aparece em "Trocas" e no Cowork, e o aviso dela sai na sincronização seguinte do canal **se** a tarefa da E5 o quiser (hoje não sai: registrar no ledger como dívida "aviso de troca em vídeo semanal", destino E5). (2) `captureFetched` e `patchFetched` já usam `late`: por isso o `if (lateFailure) throw` antes do carimbo.

- [ ] **Step 5:** rodar o comando da regra → verde; **os testes das Tarefas 6b a 11a passam sem terem sido tocados** (se algum precisar mudar, o embrulho mudou comportamento: pare e relate). `bash ../../scripts/check-type-debt.sh | tail -1` → "estável".

- [ ] **Step 6: commit.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts && git diff --cached --name-only && git commit -m "feat: leitura semanal dos concorrentes como função própria, devida pelo próprio dado, com a miniatura conferida e o ponto como recibo (A5 E2, OP-15)" -- apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts
```

**Pronto quando:** os casos da OP-15, o Review Focus 4 e a conta de chamadas (1 para 34, 3 para 120) passam; a miniatura do semanal é conferida e arquivada; nenhum teste anterior foi tocado.

### Task 11c: a promoção de semanal para diária, decidida pelo estado gravado

*(emenda do portão: S-I6. No texto original a promoção era um evento: decidida a partir das linhas inseridas **agora** e das trocas detectadas **agora**, e gravada num `update` separado no fim. Se a função morresse entre o ponto e o `update`, nada voltava a pedi-la. Agora ela é recalculada a cada visita a partir do que está gravado.)*

**Files:**
- Modify: `apps/web/src/lib/youtube/competitor-sync.ts`
- Test: `apps/web/test/youtube/competitor-sync-a5.test.ts`

**Interfaces:**
- Consumes: `shouldPromote`, `addDays` (Tarefa 5); `RULES.promotion`, `RULES.series`; `loadRecentPoints` (Tarefa 11b).
- Produces: dentro de `runChannel`, `promoteByState(weeklyRows: FullRow[], today: string): Promise<number>`; `WeeklyResult.promoted` passa a ser o número real.

**A regra, pelo estado.** Um vídeo em faixa semanal, dentro da prova (com contagem, no ar), com `daily_until` nulo ou vencido, **que tem ponto hoje**, é promovido (`daily_until = hoje + 28`) quando: (a) os dois últimos pontos gravados dele satisfazem `shouldPromote` (1.000 views e 5% do total, a no máximo 8 dias um do outro); **ou** (b) existe uma versão de título, descrição ou miniatura dele que não é linha de base (`precision <> 'first'`), vista pela primeira vez nos últimos 7 dias, e cuja janela tem no máximo 8 dias (a de janela longa não promove: desvio D-9). Tudo isso é lido do banco: se a visita anterior morreu depois de gravar o ponto, esta chega à mesma conclusão.

- [ ] **Step 1: testes que falham** (no `describe` da leitura semanal):

```ts
  const promoOf = (db: { calls: Call[] }) => db.calls.filter(c => c.table === 'competitor_videos' && first(c) === 'update' && 'daily_until' in (arg(c, 'update') ?? {}))
  it('item 17 (a): semanal que ganhou 1.000 views e 5% numa semana ganha daily_until = hoje + 28', async () => {
    const day = slotDate('vid-7')
    // depois do upsert desta visita, a leitura dos pontos devolve o de hoje e o de 7 dias atrás
    const db = setup({ all: [weeklyRow(7)], recentDaily: [{ video_id: 'v-7', snap_date: addDays(day, -7), views: 4000 }], recentDailyAfter: [{ video_id: 'v-7', snap_date: addDays(day, -7), views: 4000 }, { video_id: 'v-7', snap_date: day, views: 5000 }] })
    const up = (_n: number, u: string) => idsOf(u).map(id => ({ id, snippet: { title: 'T7' }, statistics: { viewCount: '5000' }, contentDetails: {} }))
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: up }) })
    expect(promoOf(db).map(c => arg(c, 'update'))).toEqual([{ daily_until: addDays(day, 28) }])
    expect(promoOf(db)[0]!.ops.find(o => o[0] === 'in')![1]).toEqual(['id', ['v-7']])
    expect(r.promoted).toBe(1)
  })
  it('S-I6: a visita anterior MORREU depois do ponto (o vídeo já tem ponto hoje e não é mais devido): esta visita promove assim mesmo', async () => {
    const day = slotDate('vid-7')
    const pts = [{ video_id: 'v-7', snap_date: addDays(day, -7), views: 4000 }, { video_id: 'v-7', snap_date: day, views: 5000 }]
    const db = setup({ all: [weeklyRow(7)], recentDaily: pts, recentDailyAfter: pts })
    const log = { dailyCalls: [] as string[] }
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo, log }) })
    expect(log.dailyCalls).toEqual([])                       // nada devido: nenhuma chamada à API
    expect(promoOf(db)).toHaveLength(1)                       // e mesmo assim a promoção sai, pelo estado
    expect(r).toMatchObject({ due: 0, promoted: 1, complete: true })
  })
  it('item 17 (b): troca de título, descrição ou miniatura vista nos últimos 7 dias, com janela de até 8, promove; a de janela longa não', async () => {
    const day = slotDate('vid-7'), now = at12(day).getTime()
    const pts = [{ video_id: 'v-7', snap_date: day, views: 10 }, { video_id: 'v-8', snap_date: day, views: 10 }]
    const iso = (ms: number) => new Date(ms).toISOString()
    const db = setup({ all: [weeklyRow(7), weeklyRow(8)], recentDaily: pts, recentDailyAfter: pts, recentChanges: [
      { video_id: 'v-7', field: 'thumb', precision: '1d', first_seen_at: iso(now - 3_600_000), window_start: iso(now - 7 * 86_400_000) },
      { video_id: 'v-8', field: 'title', precision: '1d', first_seen_at: iso(now - 3_600_000), window_start: iso(now - 60 * 86_400_000) },
    ] })
    const r = await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
    expect(promoOf(db)[0]!.ops.find(o => o[0] === 'in')![1]).toEqual(['id', ['v-7']])
    expect(r.promoted).toBe(1)
  })
  it('já promovido (daily_until no futuro), sem ponto hoje, ou fora da prova: não é promovido de novo', async () => {
    const day = slotDate('vid-7')
    const pts = [{ video_id: 'v-7', snap_date: addDays(day, -7), views: 1 }, { video_id: 'v-7', snap_date: day, views: 100_000 }]
    for (const over of [{ daily_until: addDays(day, 5) }, { views_hidden: true }]) {
      const db = setup({ all: [weeklyRow(7, over)], recentDaily: pts, recentDailyAfter: pts })
      await syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })
      expect(promoOf(db)).toEqual([])
    }
  })
  it('a promoção falhando no banco: a visita lança, o canal não é carimbado (a próxima visita refaz)', async () => {
    const day = slotDate('vid-7')
    const pts = [{ video_id: 'v-7', snap_date: addDays(day, -7), views: 4000 }, { video_id: 'v-7', snap_date: day, views: 5000 }]
    const db = setup({ all: [weeklyRow(7)], recentDaily: pts, recentDailyAfter: pts, failWrite: 'competitor_videos:daily_until' })
    await expect(syncCompetitorWeekly(ch, 'k', { now: at12(day), fetchImpl: apiFetch(null, 200, { daily: echo }) })).rejects.toThrow(/promover/)
    expect(stamp(db)).toEqual([])
  })
```

O falso ganha `recentDailyAfter?`: a **segunda** leitura de `competitor_video_daily` com `gte` (a da promoção, depois dos pontos) devolve essa lista; a primeira continua devolvendo `recentDaily`. E `failWrite: 'competitor_videos:daily_until'` falha o `update` que leva `daily_until`.

- [ ] **Step 2:** rodar → FAIL.

- [ ] **Step 3: implementar.** Importe `shouldPromote`. Junto de `loadRecentPoints`:

```ts
  const isChangeRow = (x: unknown): x is { video_id: string; first_seen_at: string; window_start: string | null } =>
    isRec(x) && typeof x.video_id === 'string' && typeof x.first_seen_at === 'string' && (x.window_start === null || typeof x.window_start === 'string')
  /** A promoção é decidida pelo que está GRAVADO (dois últimos pontos; versão aberta na última semana), não pelo que esta visita fez. */
  const promoteByState = async (weeklyRows: FullRow[], today: string): Promise<number> => {
    const cand = weeklyRows.filter(r => !outOfProof(r) && (r.daily_until == null || r.daily_until < today))
    if (!cand.length) return 0
    const pts = await loadRecentPoints(cand.map(r => r.id), today)
    const withToday = cand.filter(r => pts.get(r.id)?.last.date === today)
    if (!withToday.length) return 0
    const ids = new Set<string>()
    for (const r of withToday) {
      const p = pts.get(r.id)!
      if (shouldPromote(p.prev, { views: p.last.views }, today)) ids.add(r.id)
    }
    const since = new Date(nowMs - RULES.series.weeklyEveryDays * 86_400_000).toISOString()
    const maxWindow = RULES.series.weeklyMaxGapDays * 86_400_000
    const rest = withToday.map(r => r.id).filter(id => !ids.has(id))
    for (let i = 0; i < rest.length; i += 100) {
      const { data, error } = await supabase.from('competitor_video_versions').select('video_id, first_seen_at, window_start')
        .in('video_id', rest.slice(i, i + 100)).gte('first_seen_at', since).neq('precision', 'first')
      fail('load recent changes', error)
      for (const c of rowsAs(data, isChangeRow, 'trocas recentes')) {
        if (c.window_start != null && Date.parse(c.first_seen_at) - Date.parse(c.window_start) <= maxWindow) ids.add(c.video_id)
      }
    }
    if (!ids.size) return 0
    const { error } = await supabase.from('competitor_videos').update({ daily_until: addDays(today, RULES.promotion.days) }).in('id', [...ids])
    fail('não foi possível promover o vídeo à leitura diária', error)
    return ids.size
  }
```

No bloco do modo semanal (Tarefa 11b, (f)), troque `const promoted = 0 …` por `const promoted = await promoteByState(weeklyRows, today)`. A promoção vem **depois** dos pontos e **antes** do carimbo: se ela lança, o canal não é carimbado e a visita seguinte a refaz (por isso é `fail`, não `late`: aqui não há série do dia a proteger). O vídeo promovido passa a faixa diária na sincronização seguinte do canal (`classifyTiers`, `daily_until >= hoje`), e volta a semanal no 29º dia, sem apagar linha.

- [ ] **Step 4:** rodar o comando da regra → verde; `bash ../../scripts/check-type-debt.sh | tail -1` → "estável".

- [ ] **Step 5: commit.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts && git diff --cached --name-only && git commit -m "feat: promoção de semanal para diária decidida pelo estado gravado (dois últimos pontos, troca na última semana) (A5 E2, item 17)" -- apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync-a5.test.ts apps/web/test/youtube/competitor-sync-harness.ts
```

**Pronto quando:** o item 17 passa nos dois caminhos; o caso "morreu depois do ponto" promove; a promoção que falha não carimba o canal.

### Task 12: a prova embutida (o que o cron lê do banco a cada disparo)

**Files:**
- Modify: `apps/web/src/lib/youtube/competitor-health.ts`
- Test: `apps/web/test/youtube/competitor-health.test.ts`

**Interfaces:**
- Consumes: `competitor_capture_health`, `competitor_series_health` (Tarefa 1).
- Produces:

```ts
export interface CaptureHealth { videos_vistos_sem_raw: number; canais_vistos_sem_raw: number; canais_vistos_dia_pacifico: number; cota_dia_pacifico: number; videos_ausentes: number; canais_ausentes: number; canais_em_erro_12h: number; canais_em_erro_3d: number }
export interface SeriesHealth { hoje: string; hora_sp: number; fora_da_prova: number; sem_faixa: number; diaria_sem_ponto_hoje: number; diaria_buracos_3d: number; semanal_atrasados: number; semanal_atrasados_9d: number; semanal_devidos_hoje: number; sem_miniatura_9d: number; diaria_total: number; semanal_total: number }
export interface HealthVerdict { ok: boolean; problems: string[]; notes: string[] }
export function parseCaptureHealth(data: unknown): CaptureHealth | null
export function parseSeriesHealth(data: unknown): SeriesHealth | null
/** `slotDone` = nenhum canal ficou devido nesta faixa (só então "sem ponto hoje" pode ser cobrado). `thumbs: false` = a miniatura dos semanais não é coletada (pergunta 1): `sem_miniatura_9d` não é cobrado. */
export interface VerdictOpts { slotDone: boolean; e2: boolean; thumbs?: boolean }
export function healthVerdict(c: CaptureHealth | null, s: SeriesHealth | null, o: VerdictOpts): HealthVerdict
export async function readSiteHealth(sb: SupabaseClient, siteId: string, nowIso: string, o: VerdictOpts): Promise<HealthVerdict>
```

*(emenda do portão: D-I1, D-I3, D-I4, D-m1, S-I3. O que muda nesta tarefa: uma chave nova na prova da captura e três na da série; o canal em erro tem fim; o 8º dia do semanal só é vermelho depois das 19:00; o 9º é sempre; a leitura da prova não usa cast.)*

**A tabela do veredito** (cada linha tem um teste com o texto exato):

| Chave | Quando é vermelho | Frase | Quando é nota |
|---|---|---|---|
| `canais_em_erro_12h` e `canais_em_erro_3d` | enquanto `12h − 3d > 0` (canal em erro entre 12 horas e 3 dias) | "N canais em erro há mais de 12 h" | `3d > 0`: "N canais em erro há mais de 3 dias (ver acao_do_dono)" |
| `semanal_atrasados_9d` | sempre que > 0 | "N vídeos da faixa semanal sem ponto há 9 dias ou mais (intervalo perdido)" | — |
| `semanal_atrasados` (menos os do 9º dia) | depois das 19:00 de São Paulo, com a faixa inteira tentada | "N vídeos da faixa semanal no 8º dia sem ponto" | antes disso (lido hoje, o intervalo ainda vale) |
| `semanal_devidos_hoje` | depois das 19:00 de São Paulo, com a faixa inteira tentada | "N vídeos da faixa semanal devidos hoje e ainda sem ponto" | — (antes das 19:00 é o esperado: nem nota) |
| `sem_miniatura_9d` | sempre que > 0 (salvo `thumbs: false`) | "N vídeos sem cópia da miniatura depois de 9 dias" | — |

Por que 19:00: a faixa das 18:00 termina os canais devidos no disparo das 18:20, e os das 18:40 em diante começam com o relógio inteiro para a fase semanal; às 19:00 já houve pelo menos dois disparos livres desde as 12:40.

- [ ] **Step 1: testes que falham** (acrescentar a `competitor-health.test.ts`):

```ts
import { healthVerdict, parseCaptureHealth, parseSeriesHealth, readSiteHealth, type CaptureHealth, type SeriesHealth } from '@/lib/youtube/competitor-health'

const C: CaptureHealth = { videos_vistos_sem_raw: 0, canais_vistos_sem_raw: 0, canais_vistos_dia_pacifico: 15, cota_dia_pacifico: 200, videos_ausentes: 0, canais_ausentes: 0, canais_em_erro_12h: 0, canais_em_erro_3d: 0 }
const S: SeriesHealth = { hoje: '2026-06-10', hora_sp: 19, fora_da_prova: 0, sem_faixa: 0, diaria_sem_ponto_hoje: 0, diaria_buracos_3d: 0, semanal_atrasados: 0, semanal_atrasados_9d: 0, semanal_devidos_hoje: 0, sem_miniatura_9d: 0, diaria_total: 674, semanal_total: 716 }
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
    [{ semanal_atrasados: 2 }, '2 vídeos da faixa semanal no 8º dia sem ponto'],
    [{ semanal_atrasados: 3, semanal_atrasados_9d: 3 }, '3 vídeos da faixa semanal sem ponto há 9 dias ou mais (intervalo perdido)'],
    [{ semanal_devidos_hoje: 4 }, '4 vídeos da faixa semanal devidos hoje e ainda sem ponto'],
    [{ sem_miniatura_9d: 6 }, '6 vídeos sem cópia da miniatura depois de 9 dias'],
    [{ diaria_sem_ponto_hoje: 5 }, '5 vídeos da faixa diária sem ponto hoje'],
  ] as Array<[Partial<SeriesHealth>, string]>)('série %j → %s', (over, msg) => {
    expect(healthVerdict(C, { ...S, ...over }, done)).toMatchObject({ ok: false, problems: [msg] })
  })
  it('"sem ponto hoje" só é cobrado depois das 18:00 de São Paulo E com a faixa inteira tentada', () => {
    expect(healthVerdict(C, { ...S, diaria_sem_ponto_hoje: 5, hora_sp: 17 }, done).ok).toBe(true)
    expect(healthVerdict(C, { ...S, diaria_sem_ponto_hoje: 5 }, { slotDone: false, e2: true }).ok).toBe(true)
  })
  // (emenda do portão: D-I1, CTRL-d) o vermelho do canal em erro tem fim
  it('canal em erro: vermelho das 12 horas aos 3 dias; depois é nota e o cron volta a verde', () => {
    expect(healthVerdict({ ...C, canais_em_erro_12h: 2, canais_em_erro_3d: 0 }, S, done)).toMatchObject({ ok: false, problems: ['2 canais em erro há mais de 12 h'], notes: [] })
    expect(healthVerdict({ ...C, canais_em_erro_12h: 2, canais_em_erro_3d: 1 }, S, done)).toMatchObject({ ok: false, problems: ['1 canal em erro há mais de 12 h'], notes: ['1 canal em erro há mais de 3 dias (ver acao_do_dono)'] })
    expect(healthVerdict({ ...C, canais_em_erro_12h: 2, canais_em_erro_3d: 2 }, S, done)).toEqual({ ok: true, problems: [], notes: ['2 canais em erro há mais de 3 dias (ver acao_do_dono)'] })
  })
  // (emenda do portão: D-m1, D-I3) antes das 19:00 o 8º dia e os devidos de hoje não são falha; o 9º dia é sempre
  it('semanal: antes das 19:00 (ou com a faixa incompleta) o 8º dia é nota e os devidos de hoje não aparecem; o 9º dia é vermelho a qualquer hora', () => {
    const early = { ...S, hora_sp: 13 }
    expect(healthVerdict(C, { ...early, semanal_atrasados: 2, semanal_devidos_hoje: 30 }, done)).toEqual({ ok: true, problems: [], notes: ['2 vídeos da faixa semanal no 8º dia sem ponto'] })
    expect(healthVerdict(C, { ...S, semanal_atrasados: 2, semanal_devidos_hoje: 30 }, { slotDone: false, e2: true }).ok).toBe(true)
    expect(healthVerdict(C, { ...early, semanal_atrasados: 5, semanal_atrasados_9d: 3 }, done)).toEqual({ ok: false, problems: ['3 vídeos da faixa semanal sem ponto há 9 dias ou mais (intervalo perdido)'], notes: ['2 vídeos da faixa semanal no 8º dia sem ponto'] })
  })
  it('thumbs: false (pergunta 1 vetada): a falta de cópia da miniatura não é cobrada', () => {
    expect(healthVerdict(C, { ...S, sem_miniatura_9d: 687 }, { ...done, thumbs: false }).ok).toBe(true)
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
    expect(await readSiteHealth(sbOf({ competitor_capture_health: { data: C, error: null }, competitor_series_health: { data: { ...S, semanal_atrasados: 1 }, error: null } }), 's', '2026-06-10T22:00:00Z', done)).toMatchObject({ ok: false, problems: ['1 vídeo da faixa semanal no 8º dia sem ponto'] })
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
export interface CaptureHealth { videos_vistos_sem_raw: number; canais_vistos_sem_raw: number; canais_vistos_dia_pacifico: number; cota_dia_pacifico: number; videos_ausentes: number; canais_ausentes: number; canais_em_erro_12h: number; canais_em_erro_3d: number }
export interface SeriesHealth { hoje: string; hora_sp: number; fora_da_prova: number; sem_faixa: number; diaria_sem_ponto_hoje: number; diaria_buracos_3d: number; semanal_atrasados: number; semanal_atrasados_9d: number; semanal_devidos_hoje: number; sem_miniatura_9d: number; diaria_total: number; semanal_total: number }
export interface HealthVerdict { ok: boolean; problems: string[]; notes: string[] }

const CAPTURE_KEYS = ['videos_vistos_sem_raw', 'canais_vistos_sem_raw', 'canais_vistos_dia_pacifico', 'cota_dia_pacifico', 'videos_ausentes', 'canais_ausentes', 'canais_em_erro_12h', 'canais_em_erro_3d'] as const
const SERIES_KEYS = ['hora_sp', 'fora_da_prova', 'sem_faixa', 'diaria_sem_ponto_hoje', 'diaria_buracos_3d', 'semanal_atrasados', 'semanal_atrasados_9d', 'semanal_devidos_hoje', 'sem_miniatura_9d', 'diaria_total', 'semanal_total'] as const
const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0
const rec = (x: unknown): Record<string, unknown> | null => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null)

// (emenda do portão: S-I3) sem `as unknown as`: o objeto é montado chave a chave, com cada valor conferido.
/** As contagens de `keys`, todas conferidas. null se faltar uma ou se uma não for inteiro ≥ 0. */
function counts<K extends string>(d: Record<string, unknown>, keys: readonly K[]): Record<K, number> | null {
  const out: Partial<Record<K, number>> = {}
  for (const k of keys) {
    const v = d[k]
    if (!isCount(v)) return null
    out[k] = v
  }
  return out as Record<K, number> // todas as chaves foram preenchidas no laço acima
}

/** null = a prova não veio inteira. Uma contagem nunca é adivinhada como 0. */
export function parseCaptureHealth(data: unknown): CaptureHealth | null {
  const d = rec(data)
  return d ? counts(d, CAPTURE_KEYS) : null
}
export function parseSeriesHealth(data: unknown): SeriesHealth | null {
  const d = rec(data)
  if (!d || typeof d.hoje !== 'string') return null
  const c = counts(d, SERIES_KEYS)
  return c ? { hoje: d.hoje, ...c } : null
}

const n = (count: number, one: string, many: string) => count + ' ' + (count === 1 ? one : many)

/**
 * O veredito é lido do ESTADO do banco a cada disparo: uma perda fica vermelha até ser consertada (ou, no caso do
 * buraco de um dia, por 3 dias), e não some no disparo seguinte só porque nele não havia nada a fazer.
 */
export interface VerdictOpts { slotDone: boolean; e2: boolean; thumbs?: boolean }
export function healthVerdict(c: CaptureHealth | null, s: SeriesHealth | null, o: VerdictOpts): HealthVerdict {
  const problems: string[] = [], notes: string[] = []
  if (!c) problems.push('não foi possível ler a prova da captura')
  else {
    if (c.videos_vistos_sem_raw) problems.push(n(c.videos_vistos_sem_raw, 'vídeo lido', 'vídeos lidos') + ' sem resposta guardada')
    if (c.canais_vistos_sem_raw) problems.push(n(c.canais_vistos_sem_raw, 'canal lido', 'canais lidos') + ' sem resposta guardada')
    if (c.canais_vistos_dia_pacifico > 0 && c.cota_dia_pacifico === 0) problems.push('cota do dia não registrada (' + n(c.canais_vistos_dia_pacifico, 'canal lido', 'canais lidos') + ')')
    // (emenda do portão: D-I1, CTRL-d) o vermelho tem fim: do 3º dia em diante é nota, e a rota põe o nome do canal em acao_do_dono
    const errNew = Math.max(0, c.canais_em_erro_12h - c.canais_em_erro_3d)
    if (errNew) problems.push(n(errNew, 'canal', 'canais') + ' em erro há mais de 12 h')
    if (c.canais_em_erro_3d) notes.push(n(c.canais_em_erro_3d, 'canal', 'canais') + ' em erro há mais de 3 dias (ver acao_do_dono)')
    if (c.videos_ausentes || c.canais_ausentes) notes.push(n(c.videos_ausentes, 'vídeo', 'vídeos') + ' e ' + n(c.canais_ausentes, 'canal', 'canais') + ' não vêm mais do YouTube')
  }
  if (o.e2) {
    if (!s) problems.push('não foi possível ler a prova da série')
    else {
      if (s.sem_faixa) problems.push(n(s.sem_faixa, 'vídeo', 'vídeos') + ' sem faixa de série')
      if (s.diaria_buracos_3d) problems.push(n(s.diaria_buracos_3d, 'buraco', 'buracos') + ' na série diária nos últimos 3 dias')
      // (emenda do portão: D-I3, D-m1) a faixa semanal. O 9º dia é perda e é vermelho a qualquer hora. O 8º dia e os devidos
      // de hoje só são falha depois das 19:00 de São Paulo com a faixa inteira tentada: antes disso a fase semanal ainda vai ler.
      const weeklyLate = s.hora_sp >= 19 && o.slotDone
      if (s.semanal_atrasados_9d) problems.push(n(s.semanal_atrasados_9d, 'vídeo', 'vídeos') + ' da faixa semanal sem ponto há 9 dias ou mais (intervalo perdido)')
      const eighth = Math.max(0, s.semanal_atrasados - s.semanal_atrasados_9d)
      if (eighth) (weeklyLate ? problems : notes).push(n(eighth, 'vídeo', 'vídeos') + ' da faixa semanal no 8º dia sem ponto')
      if (s.semanal_devidos_hoje && weeklyLate) problems.push(n(s.semanal_devidos_hoje, 'vídeo', 'vídeos') + ' da faixa semanal devidos hoje e ainda sem ponto')
      // (emenda do portão: D-I4) a imagem que a origem sobrescreve: toda leitura confere a miniatura, então 9 dias sem cópia é falha
      if (s.sem_miniatura_9d && o.thumbs !== false) problems.push(n(s.sem_miniatura_9d, 'vídeo', 'vídeos') + ' sem cópia da miniatura depois de 9 dias')
      // só depois das 18:00 de São Paulo e com todos os canais da faixa tentados: antes disso faltar ponto é o esperado
      if (s.diaria_sem_ponto_hoje && s.hora_sp >= 18 && o.slotDone) problems.push(n(s.diaria_sem_ponto_hoje, 'vídeo', 'vídeos') + ' da faixa diária sem ponto hoje')
      if (s.fora_da_prova) notes.push(s.fora_da_prova + ' fora da prova de série (sem contagem, estreia agendada ou ausente)')
    }
  }
  return { ok: problems.length === 0, problems, notes }
}

export async function readSiteHealth(sb: SupabaseClient, siteId: string, nowIso: string, o: VerdictOpts): Promise<HealthVerdict> {
  const cap = await sb.rpc('competitor_capture_health', { p_site_id: siteId, p_now: nowIso })
  const ser = o.e2 ? await sb.rpc('competitor_series_health', { p_site_id: siteId, p_now: nowIso }) : null
  return healthVerdict(cap.error ? null : parseCaptureHealth(cap.data), !ser || ser.error ? null : parseSeriesHealth(ser.data), o)
}
```

O teste "1 vídeo da faixa semanal…" fixa o singular: confira que `n(1, 'vídeo', 'vídeos')` dá "1 vídeo".

- [ ] **Step 4:** `npx vitest run test/youtube/competitor-health.test.ts 2>&1 | tail -8 && npm run typecheck 2>&1 | tail -3 && bash ../../scripts/check-type-debt.sh | tail -1` → PASS, e a trava diz "estável" *(emenda do portão: S-I3)*. O teste `it.each` de série que usava "sem ponto há mais de 8 dias" passa a usar as frases da tabela do veredito; o caso `{ semanal_atrasados: 3, semanal_atrasados_9d: 3 }` espera **uma** frase (a do 9º dia), porque os três já estão contados nela.

- [ ] **Step 5: commit.** *(emenda do portão: S-I2)*

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/competitor-health.ts apps/web/test/youtube/competitor-health.test.ts && git diff --cached --name-only && git commit -m "feat: prova embutida da coleta de concorrentes: o veredito lido do banco a cada disparo, com fim para o canal em erro (A5 E1 e E2)" -- apps/web/src/lib/youtube/competitor-health.ts apps/web/test/youtube/competitor-health.test.ts
```

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
// (emenda do portão: D-I3, S-I1) o corte fixo de 150 s (WEEKLY_CUTOFF_MS) NÃO existe mais
export const WEEKLY_DEADLINE_MS = 210_000        // depois disso a fase semanal não começa vídeo novo
export const WEEKLY_CHANNEL_BUDGET_MS = 60_000   // o máximo de uma visita da fase semanal a um canal
export interface WeeklyPhaseResult { ran: boolean; visited: number; complete: number; pending: number; recorded: number; deferred: number; promoted: number; errors: number; unitsUsed: number }
export async function runWeeklyPhase(rows: BatchRow[], o: { apiKey: string; started: number; now: () => number; thumbs?: boolean }): Promise<WeeklyPhaseResult>
// runCompetitorBatch ganha as opções `weekly?: boolean` (padrão false; a rota passa true) e `thumbs?: boolean`
// BatchResult ganha: weekly: WeeklyPhaseResult; acao_do_dono: string[]
export interface BatchTotals { unitsUsed: number; dailyRecorded: number; weeklyRecorded: number; weeklyDeferred: number; earlyRecorded: number; fieldsOpened: number; rawOpened: number; rawTooBig: number; missed: number; newlyMissing: number; returned: number; tierChanges: number; cutByCap: number; excludedNoCount: number; promoted: number; longWindowChanges: number; partsMissing: number; quotaErrors: number }
// BatchResult ganha: totals: BatchTotals; healthSiteIds: string[] (todo site com canal concorrente, lido ou não neste disparo)
export const COMPETITORS_MAX_DURATION_S = 300 // o mesmo número de `export const maxDuration` da rota (teste)
```

- [ ] **Step 1: testes que falham.** Em `competitor-sync-batch.test.ts`:

```ts
describe('A5: tetos de tempo do disparo (a conta presa)', () => {
  it('a ordem dos tetos: semanal < começar canal < backfill de Shorts < duração máxima da função, com 60 s de folga para o último canal', async () => {
    const { WEEKLY_DEADLINE_MS, WEEKLY_CHANNEL_BUDGET_MS, BATCH_BUDGET_MS, BACKFILL_DEADLINE_MS, COMPETITORS_MAX_DURATION_S } = await import('@/lib/youtube/competitor-sync-batch')
    // (emenda do portão: D-I3) começar canal < fase semanal < backfill de Shorts < função; e uma visita cabe com folga no que sobra
    expect(BATCH_BUDGET_MS).toBeLessThan(WEEKLY_DEADLINE_MS)
    expect(WEEKLY_DEADLINE_MS).toBeLessThan(BACKFILL_DEADLINE_MS)
    expect(WEEKLY_CHANNEL_BUDGET_MS).toBeLessThan(WEEKLY_DEADLINE_MS)
    // o último vídeo da fase começa no máximo aos 210 s; o pior caso de uma sonda com arquivo são 55 s de tempos de espera somados
    expect(COMPETITORS_MAX_DURATION_S * 1000 - WEEKLY_DEADLINE_MS).toBeGreaterThanOrEqual(55_000 + 30_000)
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
  const mockAll = (sync: (r: { id: string }, key: string, o: Record<string, unknown>) => Promise<Record<string, unknown>>, rows: unknown[]) => {
    vi.resetModules()
    vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(sync) }))
    vi.doMock('@/lib/youtube/short-guard', () => ({ runControlProbe: vi.fn(async () => undefined), warnIfProbeBlocked: vi.fn() }))
    vi.doMock('@/lib/youtube/short-backfill', () => ({ reclassifyStoredShortsRoundRobin: vi.fn(async () => undefined) }))
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
  }
  // (emenda do portão: D-I3, S-I1) o teste "weeklyAllowed é verdadeiro até 150 s" saiu com o corte fixo; a fase semanal tem o describe próprio, abaixo
  it('a sincronização de um canal não recebe relógio de semanal nenhum (a leitura semanal não é dela)', async () => {
    const seen: string[][] = []
    mockAll(async (_r, _k, o) => { seen.push(Object.keys(o).sort()); return {} }, rowsOf(2))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    await runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: 200_000, now: () => 0 })
    expect(seen).toEqual([['deferBackfill', 'probeBudget'], ['deferBackfill', 'probeBudget']])
  })
  it('totals soma o que cada canal devolveu; healthSiteIds traz todo site com canal, mesmo sem canal devido', async () => {
    mockAll(async () => ({ unitsUsed: 4, dailyRecorded: 50, fieldsOpened: 10, rawOpened: 2, missed: 1, quotaError: true }), [...rowsOf(2), { id: 'x', channel_id: 'UCx', site_id: 's3', last_synced_at: new Date(Date.UTC(2026, 9, 24, 15, 1)).toISOString(), sync_status: 'idle' }])
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: 200_000, now: () => Date.UTC(2026, 9, 24, 15, 2) })
    expect(r.totals).toMatchObject({ unitsUsed: 8, dailyRecorded: 100, weeklyRecorded: 0, weeklyDeferred: 0, fieldsOpened: 20, rawOpened: 4, missed: 2, quotaErrors: 2, earlyRecorded: 0 })
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

*(emenda do portão: D-I3, S-I1, CTRL-e.)* **O teste que prova a fase semanal por construção.** No mesmo arquivo (`competitor-sync-batch.test.ts`), um mundo simulado: canais na ordem estável, um relógio só, a sincronização de um canal custa `syncMs`, conferir um vídeo semanal custa `videoMs`, e os disparos são chamadas seguidas a `runCompetitorBatch` com o relógio posto na hora do disparo. As duas funções de sincronização são falsas e **obedecem ao relógio que o lote lhes passa**: é o lote que está sendo provado.

```ts
describe('A5: a fase semanal não depende da posição do canal nem da faixa das 18:00 (D-I3, S-I1)', () => {
  const SP = 3 * 3_600_000
  const at = (day: string, hhmm: string) => Date.parse(day + 'T' + hhmm + ':00.000Z') + SP        // hora de São Paulo → UTC
  const DAY = '2026-10-24'
  type Row = { id: string; channel_id: string; channel_name: string; site_id: string; last_synced_at: string | null; sync_status: string; sync_error: string | null; sync_error_since: string | null; missing_since: string | null; weekly_pass_date: string | null }
  /** `due[i]` = vídeos semanais devidos hoje no canal da posição i (a ordem de last_synced_at é a ordem do índice, estável). */
  const world = (o: { syncMs: number; videoMs: number; due: number[]; failWeeklyUntil?: number }) => {
    let clock = 0
    const rows: Row[] = o.due.map((_, i) => ({ id: 'c' + String(i).padStart(2, '0'), channel_id: 'UC' + i, channel_name: 'Canal ' + i, site_id: 's1', last_synced_at: new Date(at(DAY, '06:00') + i * 1000).toISOString(), sync_status: 'idle', sync_error: null, sync_error_since: null, missing_since: null, weekly_pass_date: null }))
    const left = new Map(rows.map((r, i) => [r.id, o.due[i]!]))
    const order: string[] = []
    vi.resetModules()
    vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
    vi.doMock('@/lib/youtube/short-guard', () => ({ runControlProbe: vi.fn(async () => undefined), warnIfProbeBlocked: vi.fn() }))
    vi.doMock('@/lib/youtube/short-backfill', () => ({ reclassifyStoredShortsRoundRobin: vi.fn(async () => undefined) }))
    vi.doMock('@/lib/youtube/competitor-quota', () => ({ recordQuota: vi.fn(async () => undefined), pacificDate: () => DAY }))
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [...rows].sort((a, b) => (a.last_synced_at ?? '').localeCompare(b.last_synced_at ?? '')), error: null }) }) }) }) }))
    vi.doMock('@/lib/youtube/competitor-sync', () => ({
      syncCompetitorChannel: vi.fn(async (r: { id: string }) => { rows.find(x => x.id === r.id)!.last_synced_at = new Date(clock).toISOString(); clock += o.syncMs; return { unitsUsed: 3 } }),
      syncCompetitorWeekly: vi.fn(async (r: { id: string }, _k: string, w: { deadline?: () => boolean }) => {
        order.push(r.id)
        if (o.failWeeklyUntil != null && clock < o.failWeeklyUntil) { clock += 2_000; throw new Error('boom') }
        let n = left.get(r.id)!, recorded = 0
        while (n > 0 && !w.deadline?.()) { clock += o.videoMs; n--; recorded++ }
        left.set(r.id, n)
        if (n === 0) rows.find(x => x.id === r.id)!.weekly_pass_date = DAY
        return { due: n + recorded, recorded, deferred: n, promoted: 0, unitsUsed: recorded ? 1 : 0, changesDetected: 0, longWindowChanges: 0, complete: n === 0 }
      }),
    }))
    const fire = async (hhmm: string, weekly = true) => {
      clock = at(DAY, hhmm)
      const { runCompetitorBatch, BATCH_BUDGET_MS } = await import('@/lib/youtube/competitor-sync-batch')
      return runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: BATCH_BUDGET_MS, now: () => clock, ...(weekly ? { weekly: true } : {}) })
    }
    const pending = () => rows.filter(r => r.weekly_pass_date !== DAY).map(r => r.id)
    return { rows, left, order, fire, pending }
  }
  // o que foi medido em produção em 12/10: 15 canais a 21 s; devidos por canal num dia da semana 1 (K15b: 87 a 118 no total)
  const MEASURED = [1, 13, 0, 34, 1, 0, 32, 7, 12, 3, 1, 0, 0, 0, 0]

  it('antes das 12:00 de São Paulo a fase não roda', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: MEASURED })
    const r = await w.fire('06:00')
    expect(r.weekly).toMatchObject({ ran: false, visited: 0 })
    expect(w.order).toEqual([])
  })
  it('as duas faixas, ordem estável, 15 canais a 21 s, trabalho da semana 1: TODO canal tem a passada completa até o disparo das 12:40, inclusive as posições 7 a 11', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: MEASURED })
    const r1 = await w.fire('12:00')                    // 10 canais (210 s): não sobra tempo para a fase
    expect(r1.synced).toBe(10)
    expect(r1.weekly.visited).toBe(0)
    await w.fire('12:20')                               // os 5 restantes (105 s) e a fase até os 210 s
    await w.fire('12:40')                               // nenhum canal devido: a fase tem o disparo inteiro
    expect(w.pending()).toEqual([])
    expect([...w.left.values()].every(n => n === 0)).toBe(true)
    // a faixa das 18:00 não tem nada a fazer na fase (e não precisa ser mais rápida para o desenho estar certo)
    const r4 = await w.fire('18:00')
    expect(r4.weekly).toMatchObject({ visited: 0, pending: 0 })
  })
  it('caso duro: os disparos com canal devido não deixam tempo NENHUM (45 s por canal): tudo completo no primeiro disparo sem canal devido', async () => {
    const w = world({ syncMs: 45_000, videoMs: 1_050, due: MEASURED })
    for (const t of ['12:00', '12:20', '12:40']) { const r = await w.fire(t); expect(r.synced).toBe(5); expect(r.weekly.recorded).toBe(0) }   // 5 canais por disparo, 225 s: passa dos 210 s da fase
    expect(w.pending()).toHaveLength(15)
    const r = await w.fire('13:00')                     // 104 vídeos × 1,05 s = 109 s, num disparo de 210 s
    expect(w.pending()).toEqual([])
    expect(r.weekly).toMatchObject({ complete: 15, pending: 0, errors: 0 })
  })
  it('a dívida mais antiga é lida primeiro: quem ficou sem a passada de ontem vai antes de quem a teve', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [5, 5, 5, 5] })
    w.rows[0]!.weekly_pass_date = '2026-10-23'; w.rows[1]!.weekly_pass_date = '2026-10-23'
    w.rows[2]!.weekly_pass_date = '2026-10-22'          // anteontem: o mais antigo
    w.rows[3]!.weekly_pass_date = null                  // nunca: antes de todos
    await w.fire('12:40')
    expect(w.order.slice(0, 4)).toEqual(['c03', 'c02', 'c00', 'c01'])
  })
  it('orçamento por canal: um canal com 279 devidos não tira a vez dos outros, e o que sobra dele continua no disparo seguinte', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [279, 3, 3, 3] })
    w.rows[0]!.weekly_pass_date = null
    const r = await w.fire('12:40')
    expect(w.pending()).toEqual(['c00'])                // os três pequenos terminaram no mesmo disparo
    expect(w.left.get('c00')).toBeGreaterThan(0)
    expect(r.weekly.deferred).toBeGreaterThan(0)
    await w.fire('13:00')
    expect(w.pending()).toEqual([])                     // 279 × 1,05 s = 293 s: cabe em dois disparos
  })
  it('a fase semanal falhando num canal não derruba o disparo nem os outros canais, e o canal é tentado de novo no disparo seguinte', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [2, 2], failWeeklyUntil: at(DAY, '12:50') })
    const r = await w.fire('12:40')
    expect(r.weekly).toMatchObject({ errors: 2, complete: 0, pending: 2 })
    expect(r.errors).toBe(0)                            // erro de fase semanal não é canal em erro
    const r2 = await w.fire('13:00')
    expect(r2.weekly).toMatchObject({ errors: 0, complete: 2, pending: 0 })
  })
  it('weekly: false (a volta de uma linha): a fase não roda', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [2] })
    expect((await w.fire('12:40', false)).weekly).toMatchObject({ ran: false, visited: 0 })
    expect(w.order).toEqual([])
  })
  it('D-I1: canal em erro há mais de 3 dias vai para acao_do_dono, com o nome, a data e o motivo; com menos, não', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [0, 0, 0] })
    const ago = (d: number) => new Date(at(DAY, '12:40') - d * 86_400_000).toISOString()
    Object.assign(w.rows[0]!, { sync_status: 'error', sync_error: 'YouTube API 404 for channel UC0', sync_error_since: ago(4) })
    Object.assign(w.rows[1]!, { sync_status: 'error', sync_error: 'boom', sync_error_since: ago(1) })
    Object.assign(w.rows[2]!, { sync_status: 'error', sync_error: 'boom', sync_error_since: ago(9), missing_since: '2026-10-16' })   // ausente: é da fila da E9
    const r = await w.fire('12:40')
    expect(r.acao_do_dono).toEqual(['canal Canal 0 em erro desde 20/10 (há 4 dias): YouTube API 404 for channel UC0'])
  })
})
```

**O que este teste prova, em uma frase:** com a ordem dos canais igual todo dia e o disparo das 12:00 cheio, todo vídeo semanal devido no dia é lido no mesmo dia, e o resultado não muda se a faixa das 18:00 for tão lenta quanto a das 12:00. **O que ele não prova** (e por isso está nas Tarefas 11b e 14a): que `syncCompetitorWeekly` de verdade obedece ao relógio e grava o que diz.

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
// (emenda do portão: D-I3, S-I1) O corte fixo de 150 s saiu: ele era contado do início do disparo, e a ordem dos canais é a
// mesma todo dia, então os canais das posições 7 a 11 nunca leriam os semanais. A leitura semanal é uma FASE do disparo.
/** Depois disso a fase semanal não começa vídeo novo. Fica entre "começar canal" (200 s) e o backfill de Shorts (230 s). */
export const WEEKLY_DEADLINE_MS = 210_000
/** O máximo de uma visita da fase semanal a um canal: um canal grande não tira a vez dos outros. */
export const WEEKLY_CHANNEL_BUDGET_MS = 60_000
/** A duração máxima da função do cron (`export const maxDuration` da rota). Um teste confere os dois. */
export const COMPETITORS_MAX_DURATION_S = 300

export interface BatchTotals { unitsUsed: number; dailyRecorded: number; weeklyRecorded: number; weeklyDeferred: number; earlyRecorded: number; fieldsOpened: number; rawOpened: number; rawTooBig: number; missed: number; newlyMissing: number; returned: number; tierChanges: number; cutByCap: number; excludedNoCount: number; promoted: number; longWindowChanges: number; partsMissing: number; quotaErrors: number }
const ZERO: BatchTotals = { unitsUsed: 0, dailyRecorded: 0, weeklyRecorded: 0, weeklyDeferred: 0, earlyRecorded: 0, fieldsOpened: 0, rawOpened: 0, rawTooBig: 0, missed: 0, newlyMissing: 0, returned: 0, tierChanges: 0, cutByCap: 0, excludedNoCount: 0, promoted: 0, longWindowChanges: 0, partsMissing: 0, quotaErrors: 0 }
```

`BatchResult` ganha `totals: BatchTotals` e `/** Todo site com canal concorrente, sincronizado ou não neste disparo: a prova é lida para todos. */ healthSiteIds: string[]`. Em `runCompetitorBatch`: `res` nasce com `totals: { ...ZERO }, healthSiteIds: [...new Set((data ?? []).map(r => r.site_id))]`; *(emenda do portão: D-I3)* a chamada **não muda** (`syncCompetitorChannel(row, opts.apiKey, { probeBudget, deferBackfill: true })`: a sincronização do canal não lê semanais); e, no ramo que não é `skipped`:

```ts
        const t = res.totals, rr = r as Partial<Record<keyof BatchTotals, number>> & { quotaError?: boolean }
        for (const k of Object.keys(ZERO) as Array<keyof BatchTotals>) if (k !== 'quotaErrors' && typeof rr[k] === 'number') t[k] += rr[k]!
        if (rr.quotaError) t.quotaErrors++
```

(`cutByCap` é somado entre canais: é "vídeos cortados neste disparo", o que a resposta do cron mostra; o maior do dia fica na linha da cota.)

*(emenda do portão: D-I3, S-I1, D-I1, D-I5b. O que entra a mais em `competitor-sync-batch.ts`.)*

(1) A leitura dos canais ganha as colunas de que a fase e a nota precisam: `.select('id, channel_id, channel_name, site_id, last_synced_at, sync_status, sync_error, sync_error_since, missing_since, weekly_pass_date')`, e o tipo da linha ganha nome: `export type BatchRow = { id: string; channel_id: string; channel_name: string | null; site_id: string; last_synced_at: string | null; sync_status: string | null; sync_error: string | null; sync_error_since: string | null; missing_since: string | null; weekly_pass_date: string | null }` (use `rowsAs` com uma guarda que confere `id`, `channel_id` e `site_id`; nenhum cast).

(2) A fase semanal:

```ts
import { syncCompetitorChannel, syncCompetitorWeekly, spDate } from '@/lib/youtube/competitor-sync'
import { recordQuota } from '@/lib/youtube/competitor-quota'

export interface WeeklyPhaseResult { ran: boolean; visited: number; complete: number; pending: number; recorded: number; deferred: number; promoted: number; errors: number; unitsUsed: number }
const spHour = (ms: number): number => new Date(ms - SP_OFFSET).getUTCHours()

/**
 * A fase semanal do disparo (A5 E2, OP-15). Roda DEPOIS dos canais devidos, a partir das 12:00 de São Paulo. Visita os canais
 * cuja passada semanal de hoje ainda não está completa (weekly_pass_date diferente de hoje), a dívida mais antiga primeiro,
 * com até WEEKLY_CHANNEL_BUDGET_MS por visita, em rodízio, enquanto o disparo tem menos de WEEKLY_DEADLINE_MS.
 * Nada aqui depende da posição do canal na fila da sincronização nem de qual faixa é: o que não coube continua devido pelo
 * dado e é o primeiro do disparo seguinte.
 */
export async function runWeeklyPhase(rows: BatchRow[], o: { apiKey: string; started: number; now: () => number; thumbs?: boolean }): Promise<WeeklyPhaseResult> {
  const out: WeeklyPhaseResult = { ran: false, visited: 0, complete: 0, pending: 0, recorded: 0, deferred: 0, promoted: 0, errors: 0, unitsUsed: 0 }
  const today = spDate(o.now())
  const eligible = rows.filter(r => r.missing_since == null)
  const doneToday = new Set(eligible.filter(r => r.weekly_pass_date === today).map(r => r.id))
  out.pending = eligible.length - doneToday.size
  if (spHour(o.now()) < 12) return out
  out.ran = true
  const key = (r: BatchRow): string => r.weekly_pass_date ?? ''   // nulo (nunca) antes de qualquer data
  let queue = eligible.filter(r => !doneToday.has(r.id)).sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const overall = (): boolean => o.now() - o.started >= WEEKLY_DEADLINE_MS
  const lastDeferred = new Map<string, number>()
  while (queue.length && !overall()) {
    const again: BatchRow[] = []
    let progressed = false
    for (const row of queue) {
      if (overall()) { again.push(row); continue }
      const visitStart = o.now()
      try {
        const r = await syncCompetitorWeekly(row, o.apiKey, { thumbs: o.thumbs, deadline: () => overall() || o.now() - visitStart >= WEEKLY_CHANNEL_BUDGET_MS })
        out.visited++
        out.recorded += r.recorded; out.promoted += r.promoted; out.unitsUsed += r.unitsUsed
        if (r.skipped) continue                       // sendo sincronizado agora: fica para o disparo seguinte
        if (r.complete) { doneToday.add(row.id); out.complete++; lastDeferred.delete(row.id); continue }
        lastDeferred.set(row.id, r.deferred)
        again.push(row)
        if (r.recorded > 0) progressed = true
      } catch (err) {
        // erro da fase semanal NÃO põe o canal em erro (a sincronização dele deu certo) e não volta à fila neste disparo
        out.errors++
        Sentry.captureException(err, { tags: { component: 'sync-youtube', mode: 'competitors-weekly' }, extra: { channelId: row.channel_id, siteId: row.site_id } })
      }
    }
    queue = again
    if (!progressed) break                            // ninguém andou nesta volta: não gira em falso
  }
  out.deferred = [...lastDeferred.values()].reduce((a, b) => a + b, 0)
  out.pending = eligible.length - doneToday.size
  return out
}
```

Em `runCompetitorBatch`: as opções ganham `weekly?: boolean` e `thumbs?: boolean`; **depois do laço dos canais devidos e antes do backfill de Shorts**:

```ts
  // ── A5 (E2): a fase semanal. Depois dos canais devidos (a série diária vem sempre antes), antes do backfill de Shorts. ──
  res.weekly = opts.weekly === true
    ? await runWeeklyPhase(rows, { apiKey: opts.apiKey, started, now, thumbs: opts.thumbs })
    : { ran: false, visited: 0, complete: 0, pending: 0, recorded: 0, deferred: 0, promoted: 0, errors: 0, unitsUsed: 0 }
  res.totals.weeklyRecorded += res.weekly.recorded; res.totals.weeklyDeferred += res.weekly.deferred
  res.totals.promoted += res.weekly.promoted; res.totals.unitsUsed += res.weekly.unitsUsed
  if (res.weekly.errors) {
    // (D-I5b) o número de erros da fase fica na linha da cota do dia, que é durável; a resposta do cron ninguém guarda
    for (const siteId of res.healthSiteIds) await recordQuota(sb, { siteId, nowMs: now(), units: 0, mode: 'competitors_semanal', extra: { erros_semanal: res.weekly.errors } }).catch(() => undefined)
  }
```

(`rows` é a lista inteira lida no começo, não só os devidos. `res` nasce com `weekly` zerado e `acao_do_dono: []`.) O padrão de `weekly` é **falso** para que os testes antigos do lote, que não conhecem a fase, não mudem; quem liga é a rota.

(3) *(D-I1, CTRL-d)* A nota do canal em erro há mais de 3 dias, logo depois de ler os canais:

```ts
  const DAY_MS = 86_400_000
  const dm = (iso: string): string => { const d = new Date(Date.parse(iso) - SP_OFFSET); return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') }
  res.acao_do_dono = rows
    .filter(r => r.sync_status === 'error' && r.missing_since == null && r.sync_error_since != null && started - Date.parse(r.sync_error_since) > 3 * DAY_MS)
    .map(r => 'canal ' + (r.channel_name ?? r.channel_id) + ' em erro desde ' + dm(r.sync_error_since!) + ' (há ' + Math.floor((started - Date.parse(r.sync_error_since!)) / DAY_MS) + ' dias): ' + (r.sync_error ?? 'sem mensagem registrada').slice(0, 160))
```

A nota é recalculada do banco **a cada execução** (não é memória de um disparo), e some sozinha quando o canal deixa de estar em erro.

(4) *(D-I5b)* A cota que um canal não conseguiu gravar: some `quotaUnitsLost` de cada resultado em `lostBySite: Map<string, number>` e, depois do laço, uma tentativa por site: `await recordQuota(sb, { siteId, nowMs: now(), units: lost, mode: 'competitors', extra: { erros_cota: n } })`; se **essa** falhar, `res.quotaLost = (res.quotaLost ?? 0) + lost` (campo novo em `BatchResult`), e a rota põe "cota não gravada: N unidades" na mensagem de falha do disparo. Teste: `a gravação da cota falha num canal e passa na nova tentativa: quotaLost fica indefinido e a linha leva erros_cota: 1`.

Em `route.ts`, no ramo `competitors`: a guarda vira `schemaReady(supabase, 'e1e2')`; `budgetMs: BATCH_BUDGET_MS` (importe); *(emenda do portão: D-I3)* a chamada ganha `weekly: true` (**é esta a linha da "volta só da fase semanal"**: trocar por `false` desliga a fase sem tocar em mais nada); e, depois de `const health = batchHealth(result)`, troque o bloco que grava sucesso ou falha por:

```ts
      // A prova é lida do banco a CADA disparo (mesmo sem canal devido): uma perda fica vermelha até ser consertada.
      const nowIso = new Date().toISOString()
      const unread = { ok: false, problems: ['não foi possível ler a prova da captura e da série'], notes: [] as string[] }
      // (emenda do portão: S-M10) a prova tem teto de tempo: se a consulta demorar, o disparo grava a FALHA em vez de morrer mudo aos 300 s
      const PROOF_TIMEOUT_MS = 20_000
      const slow = { ok: false, problems: ['não foi possível ler a prova da captura e da série (passou de 20 s)'], notes: [] as string[] }
      const withTimeout = (p: Promise<HealthVerdict>): Promise<HealthVerdict> => Promise.race([p, new Promise<HealthVerdict>(resolve => setTimeout(() => resolve(slow), PROOF_TIMEOUT_MS))])
      const verdicts = await Promise.all(result.healthSiteIds.map(siteId => withTimeout(readSiteHealth(supabase, siteId, nowIso, { slotDone: result.remainingDue === 0 && !result.stoppedForTime, e2: true })).catch(() => unread)))
      const prova = { ok: verdicts.every(v => v.ok), problems: verdicts.flatMap(v => v.problems), notes: verdicts.flatMap(v => v.notes) }
      const parts = [
        ...(health.ok ? [] : [health.message ?? 'batch failed']),
        ...(prova.ok ? [] : ['série e captura: ' + prova.problems.join('; ')]),
        ...(result.quotaLost ? ['cota não gravada: ' + result.quotaLost + ' unidades'] : []), // (emenda do portão: D-I5b)
      ]
      if (parts.length) {
        const msg = parts.join(' | ')
        await recordCronFailure('sync-youtube-competitors', msg.length > 480 ? msg.slice(0, 479) + '…' : msg)
      } else {
        await recordCronSuccess('sync-youtube-competitors', 'info')
      }
```

e, no `return`, tire `healthSiteIds` da resposta junto de `siteIds` (`const { siteIds, healthSiteIds: _h, ...summary } = result`) e acrescente `prova`. (`cron_health.last_error` é cortado em 500 caracteres mais adiante; por isso os 480.) *(emenda do portão: D-I1, CTRL-d)* `acao_do_dono` e `weekly` já estão em `summary` e saem na resposta de toda execução, no nome de campo que o cron da coleta já usa (`acao_do_dono`). Importe o tipo `HealthVerdict`.

*(emenda do portão)* Quatro testes a mais em `cron-competitors-prova.test.ts` (o auxiliar `result` ganha `weekly` zerado e `acao_do_dono: []`): (1) `a rota liga a fase semanal`: `runCompetitorBatch` é chamado com `expect.objectContaining({ weekly: true })`; (2) `canal em erro há mais de 3 dias: o cron fica VERDE e a resposta traz acao_do_dono`: o lote devolve `acao_do_dono: ['canal X em erro desde 08/10 (há 4 dias): boom']` e a prova `{ ok: true, problems: [], notes: ['1 canal em erro há mais de 3 dias (ver acao_do_dono)'] }` → `recordCronSuccess` chamado, `recordCronFailure` não, e `body.acao_do_dono` igual à lista; (3) `a prova que demora mais de 20 s: falha gravada com "passou de 20 s"` (com `vi.useFakeTimers()` e `readSiteHealth` que nunca resolve; avance 20 s); (4) `cota não gravada depois da nova tentativa: falha com "cota não gravada: 12 unidades"` (o lote devolve `quotaLost: 12`).

- [ ] **Step 4:** rodar: `npx vitest run test/youtube/competitor-sync-batch.test.ts test/youtube/cron-competitors-invalidate.test.ts test/youtube/cron-route.test.ts test/api/cron/sync-youtube.test.ts 2>&1 | tail -12` → verde. Os testes antigos do lote que comparam `BatchResult` inteiro com `toEqual` ganham `totals` e `healthSiteIds`.

- [ ] **Step 5: a suíte inteira, uma vez** (cerca de 160 s; saída para arquivo):

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run > /tmp/a5-e1e2-suite.txt 2>&1; grep -E "Test Files|Tests |FAIL" /tmp/a5-e1e2-suite.txt | head -20
```

Esperado: nenhuma falha que este plano tenha criado. Se houver falha em arquivo da A4 (`proprio-*`, `canal-*`), anote no ledger e não conserte aqui.

- [ ] **Step 6: commit.** *(emenda do portão: S-I2)*

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/competitor-sync-batch.ts apps/web/src/app/api/cron/sync-youtube/route.ts apps/web/test/youtube/competitor-sync-batch.test.ts apps/web/test/youtube/cron-competitors-prova.test.ts apps/web/test/youtube/cron-competitors-invalidate.test.ts apps/web/test/youtube/cron-route.test.ts apps/web/test/api/cron/sync-youtube.test.ts && git diff --cached --name-only && git commit -m "feat: cron de concorrentes lê a prova da coleta a cada disparo, roda a fase semanal pela dívida mais antiga e devolve os totais e a ação do dono (A5 E1 e E2)" -- apps/web/src/lib/youtube/competitor-sync-batch.ts apps/web/src/app/api/cron/sync-youtube/route.ts apps/web/test/youtube/competitor-sync-batch.test.ts apps/web/test/youtube/cron-competitors-prova.test.ts apps/web/test/youtube/cron-competitors-invalidate.test.ts apps/web/test/youtube/cron-route.test.ts apps/web/test/api/cron/sync-youtube.test.ts
```

**Pronto quando:** item 22 e a conta de tempo estão presos por teste; a prova roda mesmo sem canal devido e tem teto de tempo; a mensagem de falha cabe em `cron_health`; *(emenda do portão)* os oito testes da fase semanal passam (as duas faixas, o caso duro, a prioridade da dívida, o orçamento por canal, a falha isolada, a volta de uma linha, antes das 12:00, `acao_do_dono`).

*(emenda do portão: S-I7, CTRL-f. A Tarefa 14 foi dividida e reescrita. O texto original era um script em prosa, não commitado, com a guarda "aborte se não for local" também em prosa, ao lado de um `.env.local` que aponta para produção, e fazia uma sincronização `full` de até 2.000 vídeos. 14a: o teste de integração commitado, que é a prova durável da junção TypeScript × SQL. 14b: o ensaio com a API real, só contra o banco local, com a guarda em código.)*

### Task 14a: teste de integração do sync contra o banco local (a junção TypeScript × SQL)

O falso do banco das Tarefas 6b a 11c é um roteiro por tabela: não executa filtro, não guarda estado e devolve `{}` para função desconhecida. O teste de banco da Tarefa 1a chama as funções com argumentos montados à mão. **Os nomes dos parâmetros, a forma dos `jsonb`, o `upsert … ignoreDuplicates … select` (de que dependem os pontos e a promoção) e a trava com `.or()` só se encontram aqui.** É a lição da E12 ("gravação nunca verificada"): este arquivo fica no repositório e roda sempre que alguém tiver o banco local de pé.

**Files:**
- Create: `apps/web/test/integration/competitor-sync-a5.test.ts`

**Interfaces:**
- Consumes: `syncCompetitorChannel`, `syncCompetitorWeekly` (Tarefas 6b a 11c); `readSiteHealth` (Tarefa 12); as migrations da Tarefa 1a no banco local; o molde de `test/integration/competitor-sync-versions.test.ts` (que já roda `syncCompetitorChannel` de verdade contra o banco local com `fetch` fixo: copie dele a preparação, o `vi.mock` da sonda de miniatura e do Blob, e a limpeza).
- Produces: nada além do teste.

- [ ] **Step 1: escrever o teste.** `describe.skipIf(skipIfNoLocalDb())`. Um site semeado (`seedSite`), um canal, e um `fetch` fixo que responde `channels`, `playlistItems` e `videos` a partir de uma lista de vídeos em memória (cada teste muda a lista). A sonda de miniatura (`probeThumb`) e o arquivo (`archiveThumb`) são falsos, como no molde: **nenhuma requisição sai da máquina**. O relógio é `opts.now`. Sete passos, na ordem, no mesmo canal (o estado de um é a entrada do seguinte: é de propósito):

| # | Passo | O que se lê **nas tabelas** depois (não no retorno) |
|---|---|---|
| 1 | Primeira sincronização às 12:00 de São Paulo, canal com 3 vídeos na página e `video_limit = 2` | 3 linhas em `competitor_videos` com `discovered_at`, `last_checked_at`, `last_seen_at`, `series_tier` (2 `diaria`, 1 `semanal`); 3 linhas abertas em `competitor_video_tier_spans`; uma linha corrente em `competitor_raw` por vídeo e uma do canal; os 10 campos `first` de cada vídeo e os 7 do canal em `competitor_field_versions`; 2 pontos em `competitor_video_daily` (os diários); `youtube_quota_usage` com `operations.competitors` = unidades gastas; o canal com `sync_status = 'idle'` e `last_ok_synced_at` |
| 2 | Segunda sincronização, 6 horas depois, **nada mudou** | **zero linha nova** em `competitor_raw`, `competitor_field_versions`, `competitor_video_tier_spans` e `competitor_video_versions` (contagens iguais às do passo 1; item 223); `last_seen_at` dos vídeos avançou |
| 3 | Uma tag muda num vídeo | uma versão fechada e uma aberta de `tags` (`precision = '6h'`, `window_start` = o `last_seen_at` anterior), uma resposta fechada e uma corrente em `competitor_raw` desse vídeo; nos outros, nada |
| 4 | Um vídeo deixa de vir, em duas sincronizações com 6 horas de distância | depois da 1ª: `miss_streak = 1`, `missing_since` nulo; depois da 2ª: `missing_since` com a data de São Paulo da 1ª e a versão `availability = 'sumiu'`; **nenhuma linha apagada** (contagens de `competitor_videos`, `competitor_video_daily` e `competitor_raw` iguais). Volta a vir: `miss_streak = 0`, `missing_since` nulo, versão `no_ar` aberta |
| 5 | `syncCompetitorWeekly` no dia fixo do vídeo semanal (escolha o `now` com `weekSlotOf` e `dayNumber`), às 12:40 | 1 ponto do semanal em `competitor_video_daily` com `snap_date` = hoje; versões `first` de título, descrição **e miniatura** em `competitor_video_versions` (com `thumb_blob_url`); `competitor_channels.weekly_pass_date` = hoje; `operations.competitors_semanal` na linha da cota; `sync_status` e `last_synced_at` do canal **iguais** aos de antes |
| 6 | `syncCompetitorWeekly` de novo no mesmo dia; depois, 7 dias mais tarde com views 5.000 a mais (de 4.000 para 9.000) | no mesmo dia: nenhuma chamada a `videos` (conte no `fetch` fixo), nenhuma linha nova. Sete dias depois: segundo ponto, e `daily_until` = hoje + 28 (promoção pelo estado) |
| 7 | As duas provas, lidas por `readSiteHealth(sb, siteId, now, { slotDone: true, e2: true })` às 19:30 de São Paulo do último dia | `ok: true`, sem problema: é a prova de que o que o código grava é o que o SQL das provas espera encontrar |

Dois casos à parte, em canais próprios: (8) `com o relógio fechado a meio (deadline verdadeiro depois do 1º vídeo), só o vídeo conferido tem ponto, weekly_pass_date continua nulo, e a visita seguinte lê o resto`; (9) `canal de outro site passado às funções de plano: o sync lança "não é do site" e nada é gravado` (chame `captureItems` com `siteId` trocado).

Limpeza no `afterAll`: `delete` do canal (cascata), de `youtube_quota_usage` do site e do site. **O teste nunca escreve fora do site que semeou.**

- [ ] **Step 2: rodar.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/competitor-sync-a5.test.ts > /tmp/a5-integra.txt 2>&1; grep -E "✓|×|Test Files|Tests " /tmp/a5-integra.txt | tail -20
```

Esperado: 9 testes passam. Sem a variável: tudo pulado, zero falha. **Um passo que falha aqui e passa no falso é um defeito de junção (nome de parâmetro, forma do `jsonb`, filtro): conserte no código da tarefa dona e acrescente o caso ao falso dela.**

- [ ] **Step 3: commit.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/test/integration/competitor-sync-a5.test.ts && git diff --cached --name-only && git commit -m "test: sync e leitura semanal dos concorrentes contra o banco local, do primeiro contato à promoção (A5 E1 e E2)" -- apps/web/test/integration/competitor-sync-a5.test.ts
```

**Pronto quando:** os 9 passam com o banco local; o ledger registra o número. **É condição do envio (Tarefa 15, Step 4).**

### Task 14b: ensaio com a API real, contra o banco LOCAL (o que só a API de verdade diz)

Sem código de produção. Responde a três perguntas que nenhum falso responde: o `raw` real é estável entre duas leituras? Quanto tempo leva de verdade? A estreia agendada vem mesmo sem `viewCount`? **Nunca contra produção.**

**Quem roda:** o implementador da tarefa (Sonnet), no terminal; o controlador confere o ledger. **Custo de cota, declarado certo** *(o original dizia 12)*: cada rodada faz 1 `channels.list`, 1 `playlistItems.list` e 1 `videos.list` da página, mais 1 `videos.list` por 50 vídeos da passada diária e da leitura semanal. Com os 285 vídeos do maior canal semeados: rodada das 06:00, 3 unidades; das 12:00, 4; leitura semanal, 1 a 5 (os devidos do dia; se todos os 235 semanais fossem devidos, 5); regime, 3 e 1; a rodada do código antigo, 4. **Total: de 16 a 20 unidades** (0,2% da cota do dia), saindo do IP da casa do dono. As sondas de miniatura não gastam cota; são cerca de 60 requisições a `i.ytimg.com`.

**Files:**
- Create: `apps/web/scripts/a5-ensaio-sync.ts` (apagado no fim da tarefa; **não é commitado**: a prova durável é a Tarefa 14a)

- [ ] **Step 1: a guarda, em código, nas primeiras linhas do script.** Antes de importar qualquer módulo do aplicativo:

```ts
// a5-ensaio-sync.ts: SÓ contra o banco local. apps/web/.env.local aponta para PRODUÇÃO: este script não o lê.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const host = (() => { try { return new URL(url).hostname } catch { return '' } })()
if (host !== '127.0.0.1' && host !== 'localhost') {
  console.error('a5-ensaio: recusando rodar: NEXT_PUBLIC_SUPABASE_URL não é local (' + (host || 'vazia') + ')')
  process.exit(1)
}
if (process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('a5-ensaio: recusando rodar: BLOB_READ_WRITE_TOKEN está definido (o ensaio não pode escrever no Blob de produção)')
  process.exit(1)
}
if (!process.env.YOUTUBE_API_KEY) { console.error('a5-ensaio: falta YOUTUBE_API_KEY'); process.exit(1) }
```

É a mesma regra de `assertLocal`, de `apps/web/e2e/fixtures/observatorio-seed.ts:197`; chame-a também, depois de importar, sobre a URL do cliente (`assertLocal(url)`), para o caso de alguém mudar o cliente de serviço. O script roda com as variáveis do banco local **passadas na linha de comando** (não por `.env.local`):

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && eval "$(cd ../.. && npm run -s db:env 2>/dev/null | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')" && NEXT_PUBLIC_SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" BLOB_READ_WRITE_TOKEN= YOUTUBE_API_KEY="$(grep '^YOUTUBE_API_KEY=' .env.local | cut -d= -f2-)" npx tsx scripts/a5-ensaio-sync.ts > /tmp/a5-ensaio.txt 2>&1; tail -40 /tmp/a5-ensaio.txt
```

(Confira antes, com `npm run db:env`, os nomes exatos das duas variáveis que o comando imprime e ajuste o `grep`; a única coisa lida de `.env.local` é a chave do YouTube, que só lê a API.) **Prova da guarda, antes de tudo:** rode uma vez com `NEXT_PUBLIC_SUPABASE_URL=https://exemplo.supabase.co` e confira que sai com "recusando rodar" e código 1.

- [ ] **Step 2: o script.** Em ordem:

1. A guarda acima.
2. Cria no banco local um site de teste (`seedSite`) e um canal concorrente com o `channel_id` do maior canal de produção, `sync_mode` incremental (**nunca `full`**), `video_limit = 50`. O `channel_id` e os ids dos vídeos vêm de **uma leitura de produção, só `select`, feita à mão antes**, pelo caminho permitido: `npx supabase db query --linked "select c.channel_id, v.video_id, v.published_at from competitor_videos v join competitor_channels c on c.id = v.competitor_channel_id where c.id = (select competitor_channel_id from competitor_videos group by 1 order by count(*) desc limit 1)"`, gravada em `/tmp/a5-ensaio-ids.json`. O script insere essas 285 linhas em `competitor_videos` do banco local (só `video_id` e `published_at`): o catálogo nasce semeado, sem chamar a API.
3. **Rodada A (código antigo, para calibrar):** o código antigo vem de uma **cópia** do arquivo de `origin/staging`, nunca de `git stash` nem de troca de branch (proibidos): `git show origin/staging:apps/web/src/lib/youtube/competitor-sync.ts > apps/web/scripts/a5-sync-antigo.ts` (dentro de `apps/web`, para os caminhos `@/` resolverem; apagado no Step 5) e o script importa `syncCompetitorChannel` dele. Uma sincronização às 12:00 de São Paulo simuladas (`opts.now`), `probeBudget: { remaining: 0 }` (sem sonda de Shorts): tempo de parede e idas ao banco. É o que em produção leva 21 s.
4. **Rodada B (código novo, 06:00 simuladas):** primeira sincronização: classifica as faixas, captura a página.
5. **Rodada C (código novo, 12:00):** a passada diária. Tempo, chamadas à API, idas ao banco.
6. **Rodada D (`syncCompetitorWeekly`, 12:40):** a leitura semanal do dia. Tempo, chamadas, quantos devidos, quantos pontos, quantas miniaturas conferidas.
7. **Rodada E (regime):** C e D de novo com o relógio 6 horas adiante e nada mudado.
8. Imprime, por rodada: segundos, chamadas à API, idas ao banco, e as contagens de `competitor_raw`, `competitor_field_versions`, `competitor_video_tier_spans`, `competitor_video_daily`, `competitor_video_versions`; e o veredito de `readSiteHealth`.
9. Apaga o site de teste (cascata).

As idas ao banco: conte pelo log do PostgREST local (`docker logs --since 3m supabase_rest_bythiagofigueiredo 2>&1 | grep -c '"POST\|"GET\|"PATCH'`) entre uma rodada e outra.

- [ ] **Step 3: rodar, com saída em arquivo e sem esperar mais de 4 minutos.** Se a soma das rodadas passar disso, rode em segundo plano com saída em arquivo e volte ao controlador.

- [ ] **Step 4: o critério, completo** *(o original só olhava o tempo)*. Escrever no ledger (`.superpowers/sdd/a5-e1-e2/progress.md`, seção "Ensaio") e **parar e voltar ao controlador se qualquer linha falhar**:

| O quê | Esperado |
|---|---|
| Canal em erro em alguma rodada | 0 |
| Pontos gravados na rodada C | igual ao tamanho da faixa diária (50, menos os que vieram sem contagem, listados) |
| Linhas de faixa | uma aberta por vídeo (285) |
| Rodada D | `recorded` = devidos menos os sem contagem; `complete: true`; `weekly_pass_date` = o dia simulado |
| Rodada E | **zero** linha nova em `competitor_raw` e em `competitor_field_versions` (item 223 com resposta real). Se houver, o nome do campo que mudou sozinho vai para o ledger, e excluí-lo em `rawOf` é tarefa de conserto **antes** do push |
| `readSiteHealth` depois da rodada E | `ok: true` |
| Estreia agendada (se o canal tiver uma; senão, "não observado") | vem sem `viewCount`? (premissa do achado D-I2) |
| Tempo estimado para produção | a latência por ida = (21 s de produção − tempo da rodada A no ensaio) ÷ idas ao banco da rodada A; estimativa = tempo da API medido + idas × latência. **Se o maior canal passar de 45 s na rodada C, ou a rodada D passar de 60 s, pare** (a faixa passaria de 2 para 3 disparos; não perde dado, mas muda a conta que o dono leu) |

- [ ] **Step 5:** apagar o script e os arquivos de apoio (`rm apps/web/scripts/a5-ensaio-sync.ts apps/web/scripts/a5-sync-antigo.ts /tmp/a5-ensaio-ids.json`) e conferir `git status --short apps/web/scripts` vazio.

**Pronto quando:** o ledger tem a tabela do critério preenchida, a estimativa para produção e a resposta à pergunta "o `raw` real é estável entre duas leituras?". Nenhuma linha de produção foi escrita (a guarda foi provada no Step 1).

### Task 15 (controlador): o envio do Lote 1 e as conferências

Sem código. Só o controlador executa; nenhum comando do dono além do que a seção 2 lista.

- [ ] **Step 1: revisão final do lote** pelos dois especialistas (`revisor-engenharia-dados-senior` e `revisor-engenharia-software-senior`), com o diff do lote em arquivo, até o acordo (regra do dono, decisão 38).
- [ ] **Step 2: o retrato "antes" (item 247).** Com `D` = véspera do dia do deploy e o corte em `D 23:59:59` de São Paulo (`<D+1>T02:59:59Z`), rode R1 (seção 10) em produção e grave o resultado em `.superpowers/sdd/a5/retratos/e1-e2-antes.json`, com o instante da leitura e o corte.
- [ ] **Step 3: o dono aplica as migrations** (seção 2, passos 3 e 4). *(emenda do portão)* **Condições para pedir a ele:** a Tarefa 1a e a 1b (RLS, 44 testes) verdes no banco local, e o SQL dos dois arquivos idêntico aos Apêndices A e B (`diff` do arquivo contra o bloco do plano: vazio). Diga a ele a janela (seção 2: minutos 07 a 18, 27 a 38 ou 47 a 58, fora de 12:00 a 12:25 e 18:00 a 18:25 de São Paulo). Depois, rode V1, V2 e V3 em produção e cole no ledger. **Não siga sem V1 = 21, 13, 5, 5, 9, 9, `'{}'::jsonb`, 0.**
- [ ] **Step 4: o envio separado da A4**, pelo roteiro da E12 (seção 9). *(emenda do portão: S-I7, S-I3)* Antes do push: (a) a Tarefa 14a verde no banco local **com o código a enviar** e a 14b com a tabela do critério preenchida; (b) extrair a árvore a enviar para uma pasta fora do repositório e rodar lá `npx vitest run test/youtube test/api/cron test/unit/test-hygiene.test.ts`, `npm run typecheck -w apps/web` e `bash scripts/check-type-debt.sh` (tem de dizer "estável: 148"); (c) `git log --name-only` dos commits a enviar: só arquivos da lista da seção 9.
- [ ] **Step 5:** push em `staging`, CI verde, promoção a `main`. *(emenda do portão: S-I5)* **A promoção a `main` só entre 12:25 e 17:30 de São Paulo.** Motivo: nessa janela o código antigo já gravou a série do dia (a faixa das 12:00 termina às 12:21, medido), e o código novo estreia na faixa das 18:00, em que a passada diária não tem ponto novo a gravar: um defeito no código novo aparece (canal em erro, prova vermelha) sem custar a série de dia nenhum, e ainda há o resto da tarde para reverter. Fora da janela, espere o dia seguinte. **Anote no ledger a hora da promoção e as datas absolutas de D0, D+1, D+3, D+7, D+8 e D+9.** Regra operacional do D0: não disparar o cron à mão.
- [ ] **Step 5b: as conferências com data, no commit do deploy** *(emenda do portão: D-I6, CTRL-h)*. Em `.superpowers/sdd/a5/conferencias-com-data.md`, seção "E1 e E2", troque cada "D+N" pela data absoluta. **Se `apps/web/src/lib/conferencias.ts` já existir em `staging`** (Tarefa 6 do plano da E20), acrescente no mesmo envio uma entrada por linha da seção que tem id (`e1e2-d1`, `e1e2-d3`, `e1e2-d8`, `e1e2-d9`, `e1e2-30d`), com `etapa: 'E1+E2'`, a data, `responsavel: 'agente'` e `onde` apontando para a seção 10 deste plano; o arquivo é da E20, a mudança é só acrescentar entradas ao fim de `CONFERENCIAS`, e ele entra na lista do commit pelo nome. **Se ainda não existir**, registre no ledger "conferências da E1 e E2 a importar quando `lib/conferencias.ts` existir" (a pendência já está escrita no arquivo de conferências).
- [ ] **Step 6: D0, depois do primeiro disparo que sincronizar canal** (o das 12:00 ou o das 18:00 de São Paulo, o que vier primeiro): K3 (a linha da cota existe e `operations.competitors` > 0), K5 (as duas provas), K12 (a duração por canal: compare com 21 s), K9 e K14 (as faixas: cerca de 674 diária e 716 semanal, uma linha aberta por vídeo), K13. E `select * from cron_health where cron_name = 'sync-youtube-competitors'` (sem falha). *(emenda do portão: D-I3)* **Depois das 19:00 de São Paulo do D0: K15 (esperado: vazia) e K17 (todo canal com `completa_hoje` verdadeiro).** Se a K15 trouxer linha, a fase semanal não leu: é a conferência que a prova embutida `semanal_devidos_hoje` também faz, a cada disparo.
- [ ] **Step 7: D+1 e D+3:** K1, K2, K4 (com a hora da promoção), K5, K6 (o `raw` fechado tem de ser uma fração pequena: se passar de 5% dos correntes em D+3, um campo está mudando sozinho: investigue com K7 e com a diferença entre duas respostas guardadas do mesmo vídeo), K8 (em D+3), K11, *(emenda do portão)* K15 e K17 (depois das 19:00), K16 (os vídeos sem versão de miniatura caem cerca de 98 por dia: 687 no D0, perto de 590 em D+1).
- [ ] **Step 8: D+7, D+8 e D+9:** K5 (agora com `semanal_atrasados` valendo; em D+9, `semanal_atrasados_9d` e `sem_miniatura_9d` em 0), K9 (promovidos), K10, K11 (o tamanho real das tabelas novas: corrige a seção 5 do plano e a 9.6 do spec), *(emenda do portão: D-I4)* **K16 em D+9: `videos_sem_versao_de_miniatura` só pode contar vídeo ausente ou sem contagem, e `correntes_sem_copia` = 0**, e o retrato "depois": R1 com o mesmo corte do Step 2, gravado em `e1-e2-depois.json`; **os dois arquivos têm de ser iguais** (itens 9 e 20: o código do leitor não mudou no Lote 1, e a série e as versões até o corte não podem ter mudado).
- [ ] **Step 9:** cada conferência feita ganha a data no ledger. Conferência vencida sem data é pendência aberta do controlador na conversa seguinte com o dono.

---

## Lote 2: o leitor (motor, carregador e pacote)

Não perde dado por esperar: pode ser feito em paralelo ao Lote 1 e enviado depois dele. **Regra do lote: nenhum campo que as telas leem hoje muda**, *(emenda do portão: S-I8)* **nenhum texto de tela muda, e a regra vale para todo consumidor de `rowsToDataset` e `loadRows`, não só para as telas**: os serviços do Cowork (`lib/pipeline/services/competitors.ts:280`), a fila da forja (`lib/pipeline/services/forja-queue.ts:188` e `:328`, que monta o pacote enviado ao modelo), o "sincronizar agora" (`competitors/actions.ts:377`) e `forja-actions.ts:76`. A Tarefa 17b prova isso consumidor por consumidor. **O Lote 2 não vai sem o Lote 1 em `main` e sem a MG2 aplicada** (o carregador novo lê `series_tier`: sem a coluna, todos esses consumidores cairiam). A série dos vídeos não observados entra em campos novos (`unobservedSeries`, `tier`, `tierSpans`); quem liga a leitura nas telas é a E4 e a E5, com mockup.

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
  // (emenda do portão: S-I8, pergunta 5) nenhum texto de tela muda: o estado, o rótulo E o motivo são os de hoje; o fato novo vai num campo que nenhuma tela lê
  it('troca num vídeo semanal: o estado, o rótulo e o motivo continuam os de hoje; o efeito ganha weeklySeries: true', () => {
    const obs = obsOf(withWeekly)
    expect(obs.effect(obs.changes.find(x => x.video === 'w')!.id)).toMatchObject({ status: 'sem-serie', label: 'sem série', reason: 'Fora dos vídeos acompanhados: sem série diária de views.', weeklySeries: true })
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
  if (!isObserved(v)) return done({ status: 'sem-serie', label: 'sem série', reason: 'Fora dos vídeos acompanhados: sem série diária de views.', ...(v.tier === 'semanal' && v.unobservedSeries?.length ? { weeklySeries: true as const } : {}) })
  // (emenda do portão: S-I8, pergunta 5) o motivo NÃO muda: a frase "inconclusivo: série semanal" é texto de tela e entra com o mockup
  // da E5. O tipo do efeito (types.ts) ganha o campo opcional `weeklySeries?: true`, que nenhuma tela lê.
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

- [ ] **Step 7: commit.** *(emenda do portão: S-I2; o original passava as duas pastas `observatorio`, exatamente onde a A4 tem arquivos modificados.)* Liste os arquivos que **esta** tarefa mudou, pelo nome. O conjunto máximo é o abaixo; tire os de teste de carga que não precisaram mudar, e não acrescente nenhum outro:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/src/lib/youtube/observatorio/load.ts apps/web/src/lib/youtube/observatorio/load-channel.ts apps/web/src/lib/youtube/observatorio/load-page.ts apps/web/src/lib/youtube/observatorio/pack.ts apps/web/test/youtube/observatorio/load-fixture.ts apps/web/test/youtube/observatorio/pack-shape.test.ts apps/web/test/youtube/observatorio/pack-semanal.test.ts apps/web/test/youtube/observatorio/pack.test.ts apps/web/test/youtube/observatorio/load-measure.test.ts apps/web/test/youtube/observatorio/load-page.test.ts apps/web/test/youtube/observatorio/load.test.ts apps/web/test/youtube/observatorio/load-live.test.ts && git diff --cached --name-only && git commit -m "feat: carregador do Observatório lê a série de todo vídeo e as faixas; pacote em cache na versão 2, com a série semanal fora quando não cabe (A5 E2)" -- apps/web/src/lib/youtube/observatorio/load.ts apps/web/src/lib/youtube/observatorio/load-channel.ts apps/web/src/lib/youtube/observatorio/load-page.ts apps/web/src/lib/youtube/observatorio/pack.ts apps/web/test/youtube/observatorio/load-fixture.ts apps/web/test/youtube/observatorio/pack-shape.test.ts apps/web/test/youtube/observatorio/pack-semanal.test.ts apps/web/test/youtube/observatorio/pack.test.ts apps/web/test/youtube/observatorio/load-measure.test.ts apps/web/test/youtube/observatorio/load-page.test.ts apps/web/test/youtube/observatorio/load.test.ts apps/web/test/youtube/observatorio/load-live.test.ts
```

Antes do commit, `git status --short apps/web/test/youtube/observatorio/ apps/web/src/lib/youtube/observatorio/` vai mostrar também os arquivos da A4 (`proprio-*`, `links.ts`, `stats.ts`): **eles não entram**. `git diff --cached --name-only` tem de mostrar só os da lista.

**Pronto quando:** item 21 está provado por medição determinística (os dois números ficam no ledger); `pack-shape.test.ts` passa com a versão 2; `loadRows` e `loadChannelRows` continuam dando o mesmo conjunto.

### Task 17b: regressão por consumidor de `rowsToDataset` e `loadRows` (telas, Cowork, fila da forja)

*(emenda do portão: S-I8, S-I9, CTRL-g. Tarefa nova. A prova de "nada muda" do texto original era a igualdade do conjunto de dados numa fixture de 3 vídeos, sem fixado não observado, sem canal próprio e sem troca legada, e nenhum teste olhava o que cada consumidor entrega.)*

**Files:**
- Create: `apps/web/test/youtube/observatorio/consumidores-semanal.test.ts`

**Interfaces:**
- Consumes: `rowsToDataset`, `createObservatory` (ou o nome que `index.ts` exporta) e as funções de tela; a semente de e2e `apps/web/e2e/fixtures/observatorio-seed.ts` (**só leitura: este plano não a edita**; o teste importa a função que monta as linhas a partir do oráculo, a mesma que a semente grava no banco); `buildTables` de `load-fixture.ts` (Tarefa 17, com e sem `weekly`); os serviços de `lib/pipeline/services/competitors.ts` e `buildSent` de `forja-queue.ts`.
- Produces: nada além do teste.

**A ideia.** Duas entradas com os **mesmos** vídeos, versões e série diária: `A`, as linhas como são hoje; `B`, as mesmas linhas **mais** o que o Lote 1 passa a gravar (faixa de cada vídeo, faixas no tempo, pontos semanais para todos os não observados, `series_tier` nas linhas). Cada consumidor é rodado sobre `A` e sobre `B`, e a saída tem de ser **idêntica**: o que o Lote 1 grava não pode mudar nada do que já é mostrado ou enviado. E `B` roda no motor de `origin/staging` e no motor novo? Não: o motor antigo não conhece as colunas novas; a comparação é `A` × `B` **no motor novo** (mais o retrato da Tarefa 18, que compara motor antigo × novo sobre linhas congeladas de produção).

- [ ] **Step 1: as duas entradas.** (1) A semente de e2e inteira (todos os canais do oráculo, com canal próprio, fixados e trocas legadas: é o que o item 247 manda); (2) `buildTables` grande (o maior canal sintético da Tarefa 17). Para cada uma, `B` = `A` + `spans` (uma faixa aberta por vídeo: `diaria` para os observados, `semanal` para os outros, desde 30 dias antes do relógio) + pontos semanais (um a cada 7 dias, 8 por vídeo não observado) + `series_tier`. Um auxiliar `withWeekly(rows)` no próprio arquivo de teste (não em `load-fixture.ts`, que a Tarefa 17 já mexe).

- [ ] **Step 2: o teste, um `it` por consumidor.** A lista de consumidores vem do `grep` (rode e confira que não apareceu um novo: `grep -rn "loadRows\|loadDataset\|rowsToDataset\|loadChannelRows" apps/web/src --include=*.ts --include=*.tsx -l`):

| Consumidor | O que é comparado entre `A` e `B` (`toEqual`) |
|---|---|
| O conjunto de dados (`rowsToDataset`) | tudo, tirando só os três campos novos (`tier`, `tierSpans`, `unobservedSeries`) e `weeklyOmitted` |
| Lista de canais (`obs.channels`, `channelStats` de cada canal) | tudo: `trocas`, `vpdMedian`, `vpd7Median`, `vpdN`, o estado de sincronização |
| Trocas (`obs.changes`) e o efeito de **toda** troca (`obs.effect(id)`) | tudo, tirando `weeklySeries`. Em especial `status`, `label` e `reason` (nenhum texto muda) |
| Página do canal: `multiplier` e `vpd` de **todo** vídeo, `outliers` | tudo |
| Página do vídeo: a série e as marcas do vídeo observado; para o não observado, o que a tela recebe hoje (série vazia) | tudo: `series` de um não observado continua `[]` em `B` |
| Cowork: o corpo de `competitors/changes`, de `outliers` e dos demais serviços de `lib/pipeline/services/competitors.ts` que passam por `loadRows` | o objeto devolvido pelo serviço, inteiro (item 9) |
| Fila da forja: `buildSent` (o pacote enviado ao modelo) | o pacote inteiro, **e o tamanho em caracteres** (`JSON.stringify(...).length` igual: o campo novo não pode viajar para o modelo) |
| O que as páginas mandam ao cliente | para cada objeto que uma página servidor passa a um componente `'use client'` (ache por `grep -rn "unobservedSeries\|tierSpans" apps/web/src` → tem de dar só `lib/youtube/observatorio/`), `JSON.stringify(...).length` em `B` ≤ em `A` + 2% |

Os serviços do Cowork e `buildSent` leem do banco por `loadRows`: troque o cliente pelo falso de `test/helpers/fake-supabase.ts` **na versão de `origin/staging`** (o teste tem de passar com ela: a A4 acrescentou 7 linhas a esse arquivo e este plano não depende delas), alimentado com as linhas de `A` e de `B`.

Um teste a mais, o do `grep` como asserção: `nenhum arquivo fora de lib/youtube/observatorio lê unobservedSeries, tierSpans ou weeklySeries` (leia a árvore `apps/web/src` com `node:fs` e falhe se achar; quando a E4 ou a E5 ligarem a leitura, é este teste que elas mudam, de propósito).

- [ ] **Step 3: rodar.** `cd apps/web && npx vitest run test/youtube/observatorio/consumidores-semanal.test.ts > /tmp/a5-consumidores.txt 2>&1; grep -E "✓|×|Test Files|Tests " /tmp/a5-consumidores.txt | tail -20` → todos passam. **Uma diferença entre `A` e `B` em qualquer consumidor é parada:** não ajuste a expectativa; o campo novo vazou para um caminho que as telas leem.

- [ ] **Step 4: commit.**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add apps/web/test/youtube/observatorio/consumidores-semanal.test.ts && git diff --cached --name-only && git commit -m "test: o que o Lote 1 grava não muda nada do que as telas, o Cowork e a fila da forja entregam (A5 E2, itens 9, 20 e 247)" -- apps/web/test/youtube/observatorio/consumidores-semanal.test.ts
```

**Pronto quando:** um `it` por consumidor da tabela, todos verdes, com a semente de e2e e com a fixture grande; o teste do `grep` passa.

### Task 18 (controlador): o envio do Lote 2

- [ ] **Step 1:** só depois de o Lote 1 estar em `main` e de D+1 conferido (as tabelas da MG2 existem e têm linha). *(emenda do portão: S-I8)* **Condição escrita, conferida na hora: V1 em produção dá 21 colunas de vídeo** (a MG2 está aplicada). Sem isso, não envie: o carregador novo lê `series_tier` e derrubaria as telas, o Cowork e a fila da forja.
- [ ] **Step 2:** revisão final do lote pelos dois especialistas, até o acordo.
- [ ] **Step 3: o retrato pelo motor, sobre linhas congeladas** *(emenda do portão: S-I9; reescrito. O original lia produção duas vezes pelo cliente de serviço, o que contraria a regra "leitura de produção só por `db query --linked`" e não é determinístico: entre o "antes" e o "depois" um canal publica, `view_count` e o conjunto dos 50 mais recentes mudam, e os arquivos difeririam por um falso positivo.)* **Uma** leitura de produção, pelo caminho permitido, congela as linhas num arquivo: para cada uma das tabelas que `loadRows` lê (`competitor_channels`, `competitor_videos`, `competitor_video_versions`, `competitor_video_daily`, `competitor_channel_snapshots`, `competitor_changes`, `competitor_video_tier_spans`), um `npx supabase db query --linked "select … from <tabela> order by <chave>"` com as colunas que o carregador pede, gravado em `.superpowers/sdd/a5/retratos/e2-linhas/<tabela>.json` (são cerca de 12 mil linhas ao todo; pagine com `limit` e `offset` de 1.000, e confira a contagem contra `select count(*)`). **A partir daí nada mais lê produção.** Um script descartável (`apps/web/scripts/a5-retrato.ts`, não commitado) carrega esses arquivos, fixa o relógio no instante da leitura, e roda **localmente** o motor duas vezes sobre as mesmas linhas: com o código de `origin/staging` (extraído para uma pasta fora do repositório) → `e2-leitor-antes.json`; com o código do lote → `e2-leitor-depois.json`. O retrato tem, por canal, `{ trocas, vpdMedian, vpd7Median, vpdN }` de `channelStats`; por vídeo observado, `vpd`, `vpd7` e o múltiplo; **o corpo de `competitors/changes` e o de `outliers`** (item 9); e, por vídeo, a data da primeira versão de título (S-M13: os 687 que ganharam linha de base entre D0 e D+6 não podem mudar nenhum "título desde" que uma tela mostre).
- [ ] **Step 4:** envio separado da A4 (roteiro da E12), provado em árvore extraída com a versão de `origin/staging` de `test/helpers/fake-supabase.ts`: `npx vitest run test/youtube/observatorio test/unit/test-hygiene.test.ts` e o typecheck.
- [ ] **Step 5:** push, CI, promoção. O cache antigo (versão 1) é ignorado sozinho: a primeira abertura de cada canal lê o banco e grava a versão 2.
- [ ] **Step 6: comparar os dois retratos** *(emenda do portão: S-I9; passa a ser feito **antes** do push, no Step 3, porque não depende mais do deploy)*: `diff e2-leitor-antes.json e2-leitor-depois.json` vazio. Se não for, **não envie** e relate a primeira diferença (não há o que reverter em produção: nada foi enviado). Depois do deploy, este passo é só a conferência de que o que está em produção é o commit do retrato.
- [ ] **Step 7:** abra a lista de canais e a página do maior canal (um subagente Sonnet com o navegador, no CMS autenticado: `docs/ops/runbook-cms-e2e-local.md`), e confira no Sentry que não há o aviso "não coube no pacote" nem "passou do orçamento" para nenhum canal.

---

## 10. Consultas de conferência (todas testadas em 12/10/2026 no banco local com as migrations aplicadas; R1 também em produção)

Rodar com `npx supabase db query --linked "<consulta>"`. Só `select`. *(emenda do portão)* Alteradas: K1, K5 (o esperado), K6. Novas: K9b, K15, K15b, K16, K17. As que não dependem das migrations (K12, K15b, K16) foram rodadas em produção em 12/10; as outras, no banco local com o SQL final.

**K1** (item 1). *(emenda do portão: S-I4)* Vídeo **conferido** nas últimas 24 h (e depois da primeira resposta guardada do site) sem resposta guardada. Esperado: 0. É a mesma conta de `videos_vistos_sem_raw` da prova embutida.

```sql
select count(*) as videos_lidos_sem_raw from competitor_videos v join competitor_channels c on c.id = v.competitor_channel_id where v.last_checked_at > greatest(now() - interval '1 day', (select min(r.first_seen_at) from competitor_raw r where r.site_id = c.site_id)) and exists (select 1 from competitor_raw r0 where r0.site_id = c.site_id) and not exists (select 1 from competitor_raw r where r.video_id = v.id and r.is_current);
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

**K5** (itens 13, 15, 23 e 222). As duas provas, como o cron as lê. Esperado: `videos_vistos_sem_raw`, `canais_vistos_sem_raw`, `canais_em_erro_12h`, `sem_faixa`, `diaria_buracos_3d`, `semanal_atrasados_9d` e `sem_miniatura_9d` em 0; depois das 18:00 de São Paulo, `diaria_sem_ponto_hoje` em 0; *(emenda do portão)* depois das 19:00, `semanal_devidos_hoje` e `semanal_atrasados` em 0 (antes das 12:00, `semanal_devidos_hoje` é a carga do dia, de 87 a 118).

```sql
select public.competitor_capture_health(s.id, now()) as captura, public.competitor_series_health(s.id, now()) as serie from (select distinct site_id as id from competitor_channels) s;
```

**K6** (risco 1). O `raw`: quantas respostas correntes e quantas fechadas, e o tamanho. Esperado em D+3: `fechadas` abaixo de 5% de `correntes`; `maior_texto_bytes` muito abaixo de 100.000. *(emenda do portão: D-m7)* `maior_bytes` é o tamanho **comprimido** no banco; o teto de 100.000 do código é sobre o texto, que é `maior_texto_bytes`.

```sql
select count(*) filter (where is_current) as correntes, count(*) filter (where not is_current) as fechadas, max(pg_column_size(raw)) as maior_bytes, max(octet_length(raw::text)) as maior_texto_bytes, avg(pg_column_size(raw))::int as media_bytes, pg_total_relation_size('public.competitor_raw') as tabela_bytes from competitor_raw;
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

**K9b** *(emenda do portão: D-m2)*. Vídeo com `series_tier` gravado e nenhuma linha de faixa aberta com essa faixa (o caso que não se conserta sozinho; seção 6). Esperado: vazia.

```sql
select v.id, v.video_id, v.series_tier, left(c.channel_name, 22) as canal from competitor_videos v join competitor_channels c on c.id = v.competitor_channel_id where v.series_tier is not null and not exists (select 1 from competitor_video_tier_spans s where s.video_id = v.id and s.to_date is null and s.tier = v.series_tier) order by 4, 2;
```

**K10** (item 23). Por canal: quantos em cada faixa e quantos têm ponto hoje.

```sql
select c.channel_name, count(*) filter (where v.series_tier = 'diaria') as diaria, count(*) filter (where v.series_tier = 'semanal') as semanal, count(*) filter (where d.video_id is not null) as com_ponto_hoje from competitor_channels c join competitor_videos v on v.competitor_channel_id = c.id left join competitor_video_daily d on d.video_id = v.id and d.snap_date = (now() at time zone 'America/Sao_Paulo')::date group by c.id order by 1;
```

**K11** (volume). O tamanho real das tabelas novas (corrige a seção 5).

```sql
select t.relname as tabela, pg_total_relation_size(t.oid) as bytes, (select reltuples::bigint from pg_class where oid = t.oid) as linhas_est from pg_class t join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public' and t.relname in ('competitor_field_versions', 'competitor_raw', 'competitor_video_early', 'competitor_video_tier_spans', 'competitor_video_daily', 'competitor_videos', 'competitor_removed_items') order by 2 desc;
```

**K12** (tempo). Quanto cada canal levou na última sincronização (a diferença até o início do seguinte, dentro do mesmo disparo), **com a posição na fila**. Compare com 21 s. *(emenda do portão: D-I3)* Só guarda a última faixa: para medir a das 18:00, rodar entre 18:45 e 23:59 de São Paulo (Tarefa 0, Step 4). Rodada em produção em 12/10 às 16:57: a faixa das 12:00, 11 canais no primeiro disparo (o 11º aos 197 s), 4 no das 12:20.

```sql
select row_number() over (order by last_synced_at) as pos, left(channel_name, 22) as canal, to_char(last_synced_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI:SS') as tentativa_sp, to_char(last_ok_synced_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI:SS') as fim_bom_sp, round(extract(epoch from lead(last_synced_at) over (order by last_synced_at) - last_synced_at)) as segundos_ate_o_proximo, sync_status from competitor_channels order by last_synced_at;
```

**K13** (itens 6, 7, 8 e 225). Os sinalizadores: uma falta, ausentes, sem contagem, comentários desligados, curtidas ocultas, ao vivo, e quantos `comment_count = 0` restam (eram 64).

```sql
select count(*) filter (where miss_streak = 1) as uma_falta, count(*) filter (where missing_since is not null) as ausentes, count(*) filter (where views_hidden) as sem_contagem, count(*) filter (where comments_disabled) as comentarios_desligados, count(*) filter (where likes_hidden) as curtidas_ocultas, count(*) filter (where was_live) as ao_vivo_ou_estreia, count(*) filter (where comment_count = 0) as comentarios_zero from competitor_videos;
```

**K14** (item 222). As faixas no tempo: linhas, abertas, primeira e última data.

```sql
select tier, count(*) as linhas, count(*) filter (where to_date is null) as abertas, min(from_date) as primeira, max(from_date) as ultima from competitor_video_tier_spans group by 1 order by 1;
```

**K15** *(emenda do portão: D-I3; a consulta do revisor de dados)*. Vídeos semanais cujo dia fixo é hoje e que ainda não têm ponto hoje, por canal. **Esperado depois das 19:00 de São Paulo: vazia.** Antes das 12:00 é a carga do dia. A prova embutida `semanal_devidos_hoje` faz esta conta (mais os atrasados de 7 dias) a cada disparo.

```sql
select c.channel_name, count(*) as devidos_sem_ponto from competitor_videos v join competitor_channels c on c.id = v.competitor_channel_id where v.series_tier = 'semanal' and v.missing_since is null and coalesce(v.views_hidden, false) = false and (('x' || substr(encode(sha256(convert_to(v.video_id, 'UTF8')), 'hex'), 1, 8))::bit(32)::bigint % 7) = (((now() at time zone 'America/Sao_Paulo')::date - date '1970-01-01') % 7) and not exists (select 1 from competitor_video_daily d where d.video_id = v.id and d.snap_date = (now() at time zone 'America/Sao_Paulo')::date) group by 1 order by 2 desc;
```

**K15b** *(emenda do portão; não depende das migrations)*. A carga da fase semanal por dia fixo, antes do deploy: os vídeos que hoje estão fora da série, pelo dia do ciclo em que cairão. Em produção em 12/10: 118, 99, 116, 92, 87, 99, 105 (soma 716); de 6 a 9 canais por dia; no maior canal, de 30 a 45.

```sql
select (('x' || substr(encode(sha256(convert_to(v.video_id, 'UTF8')), 'hex'), 1, 8))::bit(32)::bigint % 7) as dia_fixo, (((now() at time zone 'America/Sao_Paulo')::date - date '1970-01-01') % 7) as dia_fixo_de_hoje, count(*) as videos_fora_da_serie, count(distinct v.competitor_channel_id) as canais from competitor_videos v where not exists (select 1 from competitor_video_daily d where d.video_id = v.id and d.snap_date = (select max(snap_date) from competitor_video_daily)) group by 1 order by 1;
```

**K16** *(emenda do portão: D-I4; não depende das migrations)*. As miniaturas: vídeos sem nenhuma versão guardada, cópias correntes, cópias que faltam no Blob, trocas. Em produção em 12/10: 1.390 vídeos, **687 sem versão**, 703 correntes, 0 sem cópia, 5 trocas. **Esperado em D+9: `videos_sem_versao_de_miniatura` só conta vídeo ausente ou sem contagem; `correntes_sem_copia` = 0** (se não for 0, o arquivo no Blob falhou e a versão ficou sem cópia: registrar como dívida, porque o código não tenta de novo).

```sql
select (select count(*) from competitor_videos) as videos, (select count(*) from competitor_videos v where not exists (select 1 from competitor_video_versions x where x.video_id = v.id and x.field = 'thumb')) as videos_sem_versao_de_miniatura, count(*) filter (where is_current) as miniaturas_correntes, count(*) filter (where is_current and thumb_blob_url is null) as correntes_sem_copia, count(*) filter (where precision <> 'first') as trocas_de_miniatura from competitor_video_versions where field = 'thumb';
```

**K17** *(emenda do portão: D-I3)*. A passada semanal por canal: o dia da última completa, e se a de hoje já foi. **Esperado depois das 19:00 de São Paulo: `completa_hoje` verdadeiro em todo canal.** O canal no topo é o próximo a ser lido.

```sql
select left(c.channel_name, 22) as canal, c.weekly_pass_date, (c.weekly_pass_date = (now() at time zone 'America/Sao_Paulo')::date) as completa_hoje, (select count(*) from competitor_videos v where v.competitor_channel_id = c.id and v.series_tier = 'semanal') as semanais from competitor_channels c where c.missing_since is null order by c.weekly_pass_date nulls first, 1;
```

**R1** (item 247). O retrato por canal, com corte fixo. **Troque as duas datas pelo corte** (`<D+1>T02:59:59Z` e `D`). Rodar antes do deploy e em D+8, com o mesmo corte: os dois resultados têm de ser iguais.

```sql
select c.channel_name, count(*) filter (where x.field in ('title', 'thumb') and x.precision <> 'first' and x.first_seen_at <= '2026-10-12T02:59:59Z') as trocas_ate_o_corte, (select count(*) from competitor_video_daily d join competitor_videos v2 on v2.id = d.video_id where v2.competitor_channel_id = c.id and d.snap_date <= '2026-10-11') as linhas_serie, (select coalesce(sum(d.views), 0) from competitor_video_daily d join competitor_videos v2 on v2.id = d.video_id where v2.competitor_channel_id = c.id and d.snap_date <= '2026-10-11') as soma_views, (select count(*) from competitor_changes g join competitor_videos v3 on v3.id = g.video_id where v3.competitor_channel_id = c.id and g.detected_at <= '2026-10-12T02:59:59Z') as mudancas from competitor_channels c left join competitor_videos v on v.competitor_channel_id = c.id left join competitor_video_versions x on x.video_id = v.id group by c.id order by 1;
```


## 11. Onde está cada item de aceite

| Item | Onde é provado |
|---|---|
| 1, 2 | Tarefa 7 (teste); Tarefa 14a (com o banco de verdade); em produção: K1, K2 e a prova embutida (`videos_vistos_sem_raw`, `canais_vistos_sem_raw`), *(emenda do portão: S-I4)* que agora conta por `last_checked_at`, como o texto do item, e enxerga a captura que falhou |
| 3, 4, 5 | Tarefas 2 e 4 (JSON canônico, plano); Tarefa 7 (segunda rodada); Tarefa 1 (A, B, A no banco) |
| 6 | Tarefas 3 e 6 |
| 7 | Tarefas 4 e 8; Tarefa 1 (a função no banco) |
| 8 | Tarefas 3 e 6 |
| 9 | Tarefa 15, Step 8 (retrato R1 antes e depois); D3 cumprido por construção (nenhum tipo novo em `competitor_video_versions.field`); *(emenda do portão: S-I8)* no Lote 1 o corpo de `competitors/changes` não muda porque nenhum arquivo de `lib/pipeline` é tocado; no Lote 2, que muda `loadRows` (e o serviço do Cowork o chama), a prova é a Tarefa 17b (o corpo do serviço igual com e sem o dado novo) e o retrato da Tarefa 18 (o corpo sobre linhas congeladas de produção) |
| 10 | Tarefa 9; K3 |
| 11 | *(emenda do portão: S-I10)* Tarefa 1b (48 asserções em 44 testes: quatro papéis × cinco tabelas, leitura e escrita, com o GUC forjado, e as funções de escrita) |
| 12 | K2 e K4 (com a hora da promoção); a parte "todo canal visto tem `raw`" também na prova embutida |
| 13 | Tarefa 10 (exclusões); a prova embutida (`diaria_sem_ponto_hoje`), Tarefas 12 e 13 |
| 14 | Tarefas 5 e 10 |
| 15 | *(emenda do portão: D-I3, D-m1)* por construção e por teste: a fase semanal lê todo devido no dia (Tarefas 11b e 13); em produção, as provas embutidas `semanal_devidos_hoje` (desde o D0), `semanal_atrasados` (a partir de D+8) e `semanal_atrasados_9d` (a partir de D+9); K5, K15, K17 |
| 16 | Tarefa 11a; K8 em D+3. **Com a E15 o número passa de 8 para 60 leituras** (emenda v2.1): fica para o plano da E15 |
| 17 | Tarefas 5 e 11c (promoção por ganho e por troca, *(emenda do portão: S-I6)* decidida pelo estado gravado: o teste "morreu depois do ponto" promove na visita seguinte); Tarefa 14a (a promoção com o banco de verdade); a volta a semanal no dia 29 é a regra `daily_until >= hoje` (Tarefa 5), sem apagar linha |
| 18 | Tarefas 5 e 10; `operations.teto_diario_cortados` (Tarefa 9) |
| 19 | Tarefa 16 |
| 20 | Tarefa 16 (conjunto de dados idêntico nos campos antigos); *(emenda do portão: S-I8, S-I9)* Tarefa 17b (um teste por consumidor, com a semente de e2e); Tarefa 18 (retrato pelo motor antigo e pelo novo sobre as mesmas linhas congeladas) |
| 21 | Tarefa 17 |
| 22 | Tarefa 13 |
| 23 | K9, K10, K15, K17 e a prova embutida (`semanal_atrasados`, que é a consulta corrigida do item, mais `semanal_devidos_hoje` e `semanal_atrasados_9d`) |
| 221 | Tarefas 1 e 8 |
| 222 | Tarefa 1 (a função, inclusive duas trocas no mesmo dia); Tarefa 10 (a sincronização); Tarefa 16 (o motor); `sem_faixa` na prova embutida (a consulta do item) |
| 223 | Tarefas 4 e 7; Tarefa 14a (segunda rodada sem mudança = zero linha nova, no banco de verdade); Tarefa 14b (com resposta real da API) |
| 224 | Tarefa 1 (concorrência no banco); Tarefa 9 (dia do Pacífico, total por modo) |
| 225 | Tarefas 3 e 10; `fora_da_prova` na resposta do cron |
| 245 | não se aplica: este plano não cria variável de ambiente |
| 246 | *(emenda do portão: D-I6, CTRL-h)* desvio D-10: provas dentro do cron; o que elas não cobrem, em `.superpowers/sdd/a5/conferencias-com-data.md` (seção "E1 e E2") e, na Tarefa 15 (Step 5b), em `lib/conferencias.ts` (dependência declarada da Tarefa 6 do plano da E20) |
| 247 | Tarefa 15 (R1); Tarefa 17b (em teste, com a semente de e2e); Tarefa 18 (retrato pelo motor sobre linhas congeladas) |
| OP-15 | seção 8; Tarefa 11b (a função e o "devido"); Tarefa 13 (a fase e o teste das duas faixas) |

**O que este plano não faz, por ser de outra etapa:** a fila "Saíram do YouTube" e a função de apagar (E9; a tabela `competitor_removed_items` já nasce na MG1); as medidas M1 a M10 e as marcas (E4); qualquer tela (E5); a leitura de hora em hora (E15) e a agenda (E16); o `campos=todos` do Cowork (E7).

## 12. Riscos que ficam, ditos sem suavizar

1. **O `raw` real pode mudar sozinho entre duas leituras** (um campo da resposta que o YouTube varia sem o criador mexer). Não dá para saber sem ler a API: a Tarefa 14 testa num canal antes do push, e K6 acompanha em D+1 e D+3. Se acontecer em produção, o custo é volume (cerca de 3 kB por vídeo por leitura), não perda; o conserto é excluir o campo em `rawOf`.
2. **O tempo por canal é estimativa até a Tarefa 14b e o D0.** A faixa das 12:00 já usa dois disparos hoje. Se o acréscimo for o dobro do estimado, continua em dois disparos com 15 canais e passa a três com 17 ou mais. *(emenda do portão: D-I3)* A série diária não disputa mais tempo com a semanal: a fase semanal só começa depois do último canal devido do disparo. **A duração da faixa das 18:00 continua sem medida** (Tarefa 0, Step 4), e o desenho não depende dela.
3. **A primeira semana grava de 8 a 10 MB**, e o plano gratuito tem 500 MB (hoje 179). Não muda o mês em que o banco enche de forma relevante (cerca de 2 semanas de crescimento normal), mas é um degrau visível.
4. *(emenda do portão: D-I1, CTRL-d)* **Um canal que fique em erro para sempre deixa o cron vermelho por 3 dias e depois vira nota** (`acao_do_dono` em toda execução, e "erro" na lista de canais). A nota só existe na resposta do cron, que ninguém guarda: quem não olhar a resposta nem a lista de canais não a vê. É a troca escolhida: um vermelho sem fim cala a falha dos outros crons.
5. *(emenda do portão: D-I4)* **A miniatura dos vídeos antigos passa a ser conferida, mas só uma vez por semana**: duas trocas na mesma semana aparecem como uma (a imagem do meio se perde). E a cópia que falhar ao ser gravada no Blob deixa a versão sem imagem e **o código não tenta de novo** (em produção hoje: 0 em 708; a K16 confere em D+9). As trocas de título e de miniatura anteriores ao deploy em vídeos nunca conferidos não aparecem (não há com o que comparar).
6. **O Lote 2 muda `rowsToDataset`**: é a função por onde todas as telas do Observatório passam. A proteção é o teste de igualdade do conjunto de dados, os testes de paridade com o oráculo e o retrato pelo motor antes e depois; ainda assim é o ponto de maior raio de alcance do plano, e por isso vai em envio separado.
7. **As 64 linhas com `comment_count = 0` de hoje** só são corrigidas quando cada vídeo for relido: os 716 semanais, ao longo dos 7 primeiros dias.
8. *(emenda do portão: S-M3)* **A cota de um disparo morto por tempo (300 s) não é gravada**: a gravação é no fim da sincronização de cada canal. A linha do dia fica abaixo do gasto real nesse caso, sem aviso (a prova só acusa a linha em 0). Aceito como risco: a função nunca morreu por tempo neste cron, e a cota dos concorrentes é 2% do dia.
9. *(emenda do portão)* **O código novo desta emenda não foi executado** (Tarefas 1b, 6b, 11a, 11b, 11c, 13, 14a, 17b, e as mudanças nas Tarefas 2, 3, 4, 9, 10 e 12): foi escrito contra os arquivos lidos, e o que foi rodado é o SQL. O embrulho `runChannel` da Tarefa 11b mexe na função mais sensível do plano; a proteção é a regra "os testes das Tarefas 6b a 11a passam sem serem tocados" e a Tarefa 14a.
10. *(emenda do portão: D-I3)* **A regra do "devido" existe em dois lugares**: em TypeScript (`weeklyDue`, que decide o que é lido) e em SQL (`semanal_devidos_hoje`, que só confere). Se divergirem, a leitura continua certa e a prova erra para um lado. O teste da Tarefa 1a ("o dia fixo") e o passo 7 da Tarefa 14a prendem as duas uma à outra.
11. *(emenda do portão: S-M8)* **A troca vista num vídeo semanal não gera aviso** (o aviso é da sincronização do canal, e a leitura semanal é outra função): ela aparece em "Trocas" e no Cowork. Dívida registrada, destino E5.

## Apêndice A: MG1 (`npm run db:new observatorio_a5_e1_campos_sinalizadores_raw`)

*(emenda do portão)* **Este é o texto DEFINITIVO, saído do acordo dos dois revisores: o dono aplica uma vez.** Mudou em relação ao texto anterior à emenda: `set lock_timeout` no começo e `reset` no fim (D-m12); `idx_cfv_video_seen`, `idx_craw_channel` e `idx_craw_video` (D-I5a); a guarda de site em `apply_competitor_field_plan` e `apply_competitor_raw_plan` (D-m3); a 2ª falta só 3 horas depois da 1ª, no vídeo e no canal (D-m4); `competitor_capture_health` conta por `last_checked_at` e `last_ok_synced_at`, só depois da primeira resposta guardada do site (S-I4), e devolve `canais_em_erro_3d` (D-I1). O resto é o texto que os revisores leram.

Provada em 12/10/2026 no banco local, **com este texto**: MG1, MG2, MG1, MG2 numa única transação desfeita, sem erro, com as 35 asserções de `.superpowers/sdd/a5/plano-e1-e2-emenda-prova.sql`.

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
-- Emenda do portão de fim de plano (12/10/2026): três índices (cascata e histórico por vídeo e por canal), guarda
-- de site nas duas funções de plano, a 2ª falta só conta 3 horas depois da 1ª, a prova usa last_checked_at e o
-- começo da E1 no site, e a chave canais_em_erro_3d.

-- Falha rápido se houver sessão presa segurando competitor_videos (o alter table pede trava exclusiva por
-- milissegundos); reexecutar é seguro. Devolvido ao padrão na última linha.
set lock_timeout = '5s';

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
-- histórico de UM vídeo (leitor da E5) e a cascata de apagar vídeo (E9): sem este índice, uma varredura por vídeo
create index if not exists idx_cfv_video_seen
  on public.competitor_field_versions (video_id, first_seen_at) where video_id is not null;
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
-- as respostas fechadas não estão nos índices parciais acima: a cascata de apagar canal ou vídeo precisa destes dois
create index if not exists idx_craw_channel on public.competitor_raw (competitor_channel_id);
create index if not exists idx_craw_video on public.competitor_raw (video_id) where video_id is not null;
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
  -- o canal tem de ser do site informado: as linhas levam p_site_id, e a RLS destas tabelas é por site_id
  if not exists (select 1 from public.competitor_channels c where c.id = p_channel_id and c.site_id = p_site_id) then
    raise exception '%: canal % não é do site %', 'apply_competitor_field_plan', p_channel_id, p_site_id;
  end if;

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
  -- o canal tem de ser do site informado: as linhas levam p_site_id, e a RLS destas tabelas é por site_id
  if not exists (select 1 from public.competitor_channels c where c.id = p_channel_id and c.site_id = p_site_id) then
    raise exception '%: canal % não é do site %', 'apply_competitor_raw_plan', p_channel_id, p_site_id;
  end if;

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
--    A 2ª falta só conta 3 HORAS depois da 1ª: o "sincronizar agora" logo depois do cron, ou uma nova tentativa
--    minutos depois, não são uma segunda leitura independente (as faixas do cron distam 6 horas).
create or replace function public.competitor_mark_missing(
  p_channel_id uuid, p_video_ids uuid[], p_now timestamptz
) returns jsonb
language sql security invoker set search_path = '' as $$
  with u as (
    update public.competitor_videos v
       set miss_streak = case when v.miss_first_at is not null and p_now - v.miss_first_at < interval '3 hours'
                              then v.miss_streak else least(v.miss_streak + 1, 32000) end,
           miss_first_at = coalesce(v.miss_first_at, p_now),
           missing_since = case
             when v.missing_since is not null then v.missing_since
             when v.miss_first_at is not null and p_now - v.miss_first_at >= interval '3 hours'
               then (v.miss_first_at at time zone 'America/Sao_Paulo')::date
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
       set miss_streak = case when c.miss_first_at is not null and p_now - c.miss_first_at < interval '3 hours'
                              then c.miss_streak else least(c.miss_streak + 1, 32000) end,
           miss_first_at = coalesce(c.miss_first_at, p_now),
           missing_since = case
             when c.missing_since is not null then c.missing_since
             when c.miss_first_at is not null and p_now - c.miss_first_at >= interval '3 hours'
               then (c.miss_first_at at time zone 'America/Sao_Paulo')::date
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
--     'videos_vistos_sem_raw' usa last_checked_at (carimbado em TODA leitura do vídeo, com ou sem captura), como o
--     item 1 do spec; last_seen_at só é carimbado quando a captura dá certo e deixaria a prova cega justamente na
--     falha. 'canais_vistos_sem_raw' usa last_ok_synced_at pelo mesmo motivo. As duas só contam o que foi lido
--     DEPOIS da primeira resposta guardada do site (e1.desde): o que o código anterior à E1 leu no dia do deploy
--     não tem resposta guardada e não é falha. Sem nenhuma resposta guardada no site as duas dão 0 (a captura
--     falhando para tudo deixa todo canal em erro, que é outro alarme).
--     'canais_em_erro_12h' não conta canal ausente (missing_since): esse está na fila da E9, não é falha de coleta.
--     'canais_em_erro_3d' é o fim do vermelho: quem lê fica vermelho enquanto 12h > 3d e depois vira nota.
create or replace function public.competitor_capture_health(p_site_id uuid, p_now timestamptz)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with e1 as (select min(r.first_seen_at) as desde from public.competitor_raw r where r.site_id = p_site_id)
  select jsonb_build_object(
    'videos_vistos_sem_raw', (
      select count(*) from public.competitor_videos v
        join public.competitor_channels c on c.id = v.competitor_channel_id
        cross join e1
       where c.site_id = p_site_id and e1.desde is not null
         and v.last_checked_at > greatest(p_now - interval '1 day', e1.desde)
         and not exists (select 1 from public.competitor_raw r where r.video_id = v.id and r.is_current)),
    'canais_vistos_sem_raw', (
      select count(*) from public.competitor_channels c cross join e1
       where c.site_id = p_site_id and e1.desde is not null
         and c.last_ok_synced_at > greatest(p_now - interval '1 day', e1.desde)
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
         and c.sync_error_since < p_now - interval '12 hours'),
    'canais_em_erro_3d', (
      select count(*) from public.competitor_channels c
       where c.site_id = p_site_id and c.sync_status = 'error' and c.missing_since is null
         and c.sync_error_since < p_now - interval '3 days')
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

reset lock_timeout;
```

## Apêndice B: MG2 (`npm run db:new observatorio_a5_e2_serie_faixas`)

*(emenda do portão)* **Texto DEFINITIVO.** Mudou em relação ao texto anterior à emenda: `set lock_timeout` e `reset` (D-m12); `competitor_channels.weekly_pass_date` (D-I3, S-I1); a guarda de site em `apply_competitor_tier_plan` (D-m3); em `competitor_series_health`, a condição a mais de `diaria_buracos_3d` (D-I2, o texto do revisor de dados) e três chaves novas, `semanal_atrasados_9d`, `semanal_devidos_hoje` (D-I3) e `sem_miniatura_9d` (D-I4). `semanal_atrasados` não mudou (D-m1: muda a leitura dela, na Tarefa 12).

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
-- Emenda do portão de fim de plano (12/10/2026): competitor_channels.weekly_pass_date (a dívida da passada
-- semanal fica no dado, e o canal em dívida é lido primeiro no disparo seguinte), guarda de site na troca de
-- faixa, a condição a mais em diaria_buracos_3d (estreia agendada não é buraco) e três chaves novas na prova:
-- semanal_devidos_hoje, semanal_atrasados_9d e sem_miniatura_9d.

set lock_timeout = '5s';

alter table public.competitor_videos
  add column if not exists series_tier text check (series_tier in ('diaria', 'semanal')),
  add column if not exists series_tier_since date,
  add column if not exists daily_until date;

alter table public.competitor_channels
  add column if not exists weekly_pass_date date;
comment on column public.competitor_channels.weekly_pass_date is 'Dia (São Paulo) da última passada semanal COMPLETA do canal: todo vídeo semanal devido naquele dia foi pedido ao YouTube. Diferente de hoje = há passada a fazer; o mais antigo é lido primeiro. Nulo = nunca.';

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
  if not exists (select 1 from public.competitor_channels c where c.id = p_channel_id and c.site_id = p_site_id) then
    raise exception 'apply_competitor_tier_plan: canal % não é do site %', p_channel_id, p_site_id;
  end if;

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
-- 'diaria_buracos_3d': só é buraco o dia POSTERIOR a um ponto que já existe (uma estreia agendada ganha faixa
--   diária no dia em que é descoberta e só tem ponto quando estreia: os dias de espera não são perda).
-- 'semanal_devidos_hoje': os vídeos semanais que a passada de hoje tem de ler e ainda não leu. É a regra de
--   weeklyDue (competitor-tiers.ts) escrita em SQL: sem ponto hoje E (hoje é o dia fixo do vídeo, OU o último
--   ponto tem 7 ou 8 dias, OU não há ponto nos últimos 8 dias e a faixa tem 7 dias ou mais). O dia fixo é o
--   mesmo de weekSlotOf: os 4 primeiros bytes do sha256 do id do YouTube, módulo 7, contra o dia desde 1970.
-- 'semanal_atrasados': 8º dia sem ponto (lido hoje, o intervalo de 8 dias ainda vale).
-- 'semanal_atrasados_9d': 9 dias ou mais sem ponto: o intervalo já não é mais "semanal" (perda).
-- 'sem_miniatura_9d': vídeo com faixa há 9 dias ou mais e NENHUMA versão de miniatura guardada (a imagem que
--   a origem sobrescreve: toda leitura, diária ou semanal, confere a miniatura).
create or replace function public.competitor_series_health(p_site_id uuid, p_now timestamptz)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with hoje as (select (p_now at time zone 'America/Sao_Paulo')::date as d),
  vid as (
    select v.id, v.series_tier, v.series_tier_since,
           (('x' || substr(encode(sha256(convert_to(v.video_id, 'UTF8')), 'hex'), 1, 8))::bit(32)::bigint % 7) as dia_fixo,
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
         and not exists (select 1 from public.competitor_video_daily d where d.video_id = vid.id and d.snap_date = x.dia)
         and exists (select 1 from public.competitor_video_daily d0 where d0.video_id = vid.id and d0.snap_date < x.dia)),
    'semanal_atrasados', (
      select count(*) from vid, hoje
       where not fora and series_tier = 'semanal'
         and exists (select 1 from public.competitor_video_tier_spans s
                      where s.video_id = vid.id and s.to_date is null and s.tier = 'semanal' and s.from_date <= hoje.d - 8)
         and not exists (select 1 from public.competitor_video_daily d where d.video_id = vid.id and d.snap_date > hoje.d - 8)),
    'semanal_atrasados_9d', (
      select count(*) from vid, hoje
       where not fora and series_tier = 'semanal'
         and exists (select 1 from public.competitor_video_tier_spans s
                      where s.video_id = vid.id and s.to_date is null and s.tier = 'semanal' and s.from_date <= hoje.d - 9)
         and not exists (select 1 from public.competitor_video_daily d where d.video_id = vid.id and d.snap_date > hoje.d - 9)),
    'semanal_devidos_hoje', (
      select count(*) from vid, hoje
       where not fora and series_tier = 'semanal'
         and not exists (select 1 from public.competitor_video_daily d where d.video_id = vid.id and d.snap_date = hoje.d)
         and (
           vid.dia_fixo = ((hoje.d - date '1970-01-01') % 7)
           or (not exists (select 1 from public.competitor_video_daily d
                            where d.video_id = vid.id and d.snap_date > hoje.d - 7)
               and (exists (select 1 from public.competitor_video_daily d
                             where d.video_id = vid.id and d.snap_date between hoje.d - 8 and hoje.d - 7)
                    or vid.series_tier_since <= hoje.d - 7)))),
    'sem_miniatura_9d', (
      select count(*) from vid, hoje
       where not fora
         and exists (select 1 from public.competitor_video_tier_spans s where s.video_id = vid.id and s.from_date <= hoje.d - 9)
         and not exists (select 1 from public.competitor_video_versions x where x.video_id = vid.id and x.field = 'thumb')),
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

reset lock_timeout;
```
