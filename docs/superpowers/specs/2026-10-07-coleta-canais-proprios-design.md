# Coleta dos canais próprios do YouTube

Data: 07/10/2026 · Estado: rascunho v5 · Base: `main` c20b6ff2, `staging` 6dd468ae (conferir com
`git rev-parse` antes de começar). Specs irmãos: `2026-10-07-ab-lab-honesto-design.md` (A/B Lab) e `2026-10-07-observatorio-canal-video-ui-design.md` (telas do Observatório).

## Por que

Não guardamos retenção, percentual assistido, impressões nem CTR dos canais próprios (2 canais, 35
vídeos). Em produção, `youtube_video_analytics` tem 463 linhas com `impressions = 0` e `ctr = 0` em
todas: zeros que nunca foram medidos. Impressões e CTR só existem em relatórios em lote que começam a
contar quando o job é criado; o que não for pedido agora não volta.

## Decisões do dono (07/10)

1. Prioridade: coleta e preparação de dados. Telas depois.
2. Coletar tudo que for possível dos canais próprios, pensando num produto futuro. Só o que a política
   do YouTube permitir.
3. Nenhum cron novo, nem na Vercel nem no pg_cron: tudo entra em `sync-analytics-metrics`.
4. Migrations: quantas forem precisas, criadas com `npm run db:new`. Quem aplica em produção é o dono.
5. Rótulos e mensagens novas em pt-BR.

## Visão geral

Tudo roda dentro de `apps/web/src/app/api/cron/sync-analytics-metrics/route.ts` (12:00 UTC), como
passos separados. Nenhuma variável de ambiente nova. Nada em `packages/`, então `build:packages` não
se aplica. Pipeline Integrity não é tocada nesta fase.

## 0. Lotes de entrega

O princípio de ordem é: **o que não se recupera depois vem primeiro.** Só três coisas não voltam:
impressões e CTR (existem a partir da criação do job, e o histórico inicial some em 30 dias), e o que
estava no ar em cada dia (título, thumbnail, variante). Views, percentual assistido, retenção, tráfego
e números de canal podem ser buscados para trás a qualquer momento pela Analytics API.

| Lote | Conteúdo | Verificação em produção |
|---|---|---|
| L1a | Migration aditiva (`yt_reporting_jobs`, `yt_reporting_reports`, `yt_reporting_report_blobs`, `yt_own_video_meta_daily`, `yt_own_collection_attempts`, a função `yt_own_attempt_record`); passo de metadados sem `privacy_status` nem `is_short`; passo 1A; passo 1C **só listando e baixando o bruto**; veredito único e relógio global | no dia seguinte, `select report_type_id, status from yt_reporting_jobs`; em 3 dias, relatórios `baixado` |
| L1b | Migration: colunas de `youtube_channels`, chave `on delete restrict` e a RPC de remover canal (seção 2); estado `reautorizar` e o retorno pelo OAuth; cliente `videos.list` com `privacy_status` e `is_short` | canal revogado de teste vira `reautorizar` e volta a `ok` |
| L2 | Migration aditiva (`yt_own_video_daily`, `yt_own_video_reach_daily`); normalização do alcance a partir do bruto; diário por vídeo | aceite 9 |
| L3 | Leitores tolerantes a nulo → migration dos zeros falsos → métricas estendidas da consulta de janela e curva de retenção `vida` | aceite 10 |
| L4 | Passo 1D (pacotes da forja). Independente, entra a qualquer hora | teste |
| L5 | Enriquecimento, tudo recuperável para trás: tráfego por fonte, diário por canal, retenção dos primeiros 7 dias e por inscritos, demais tipos de relatório | spec curto próprio quando chegar a hora |

**Ordem de push.** Cada lote tem dois pushes em `staging`, exceção declarada à regra de um push por
lote, porque a migration precisa estar aplicada antes de o código chegar a `main`:
1. commit da migration: `npm run db:new <nome>`, editar o SQL, `npm run db:start && npm run db:reset`,
   reaplicar só o arquivo novo com
   `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f <arquivo>` (prova de que roda duas
   vezes: `create table if not exists`, `add column if not exists`, `create or replace function`,
   `drop policy if exists`), `npm run db:types`, e
   commitar por caminho a migration e `apps/web/src/types/database.types.ts`. Se o diff dos tipos
   mexer em tabelas não relacionadas, a versão do CLI divergiu: parar e perguntar. O dono aplica com
   `npm run db:push:prod` e confirma com um `select` na tabela nova;
2. commit do código.

A promoção `staging → main` nunca leva o código de um lote sem a migration dele aplicada. Se isso
falhar, a regra de `schema_ausente` (seção 1) mantém a produção íntegra e a falha visível.
L1a, L1b e L2 só criam; o código antigo não os percebe. Onde este spec diz "L1" sem letra, vale para os
dois. Em L1a, `channel_id` das tabelas novas é referência simples, sem `on delete restrict`: a
restrição entra em L1b junto com a RPC que sabe lidar com ela. L3 tem três pushes: (a) leitores que aceitam nulo,
sem gravar nada novo; (b) a migration; (c) o código que grava as colunas novas, só depois de o dono
confirmar `select avg_view_percentage from youtube_video_analytics limit 1`.

**L2 só começa depois de o dono exportar um CSV real** de cada tipo de alcance do bruto de L1 para
`apps/web/test/fixtures/yt-reporting/` (comando no runbook). Fixture sintética não vale: o
normalizador é escrito contra o cabeçalho real.

**Pré-requisitos do dono antes do L1:**
1. Ativar "YouTube Reporting API" no projeto do Google Cloud usado pelo OAuth (é uma API separada da
   Analytics API; a confirmar no console). A primeira execução verifica: 403 `accessNotConfigured`
   vira `api_nao_ativada` com aviso.
2. Conferir o limite de duração de função do plano na Vercel e anotar no ledger. Hoje a rota tem
   `maxDuration = 120` (constante em `route.ts:26`; não há bloco `functions` no `vercel.json`). O L1
   muda a constante para 300 e usa relógio global de 270 s. Se o plano não permitir 300 s, o L1 não
   começa: parar e perguntar ao dono.

## 1. Convenções

- **Dia.** As duas fontes não documentam o mesmo dia. A Analytics API usa o Pacífico com horário de
  verão (UTC-7 ou UTC-8); a Reporting API documenta UTC-8 fixo. Cada tabela guarda `day_pt` **como veio
  da sua fonte** e nunca converte. Para os relatórios, a verdade do intervalo é
  `yt_reporting_reports.start_time` e `end_time`. Nenhuma consulta junta dias de fontes diferentes sem
  declarar a incerteza de até 1 hora. Datas calculadas pelo código ("hoje", "ontem" no Pacífico) usam
  `Intl.DateTimeFormat` com `America/Los_Angeles`, nunca deslocamento fixo nem `toISOString()`.
  `attempt_day` é a data UTC da execução e nunca se junta a `day_pt`.
- **Nulo, nunca zero.** Métrica não medida é `NULL`. O motivo mora em `yt_own_collection_attempts`.
  Sem linha de tentativa = nunca tentado; tentativa com resultado diferente de `ok` = tentado e sem dado.
- **Colunas comuns.** Toda tabela nova tem `site_id uuid not null`. As tabelas de métrica
  (`yt_own_video_daily`, `yt_own_video_reach_daily`, `yt_own_video_retention`) têm também `source`
  (`analytics_api` ou `reporting_api`), `collected_at` e `metric_version`. `metric_version` deriva do
  `day_pt` da linha por uma tabela de cortes em código, com cortes iniciais `2025-03-31` e
  `2026-08-27`; se o histórico de revisões da API discordar, o implementador para e pergunta.
  `yt_own_video_meta_daily` é exceção: não tem `source` nem `metric_version`.
- **Identificação.** Nas tabelas novas por vídeo, a chave usa `youtube_video_id text`: o id de 11
  caracteres do YouTube. Elas guardam também `video_id` (uuid de `youtube_videos.id`, nulo se o vídeo
  for apagado) e `channel_id` (`youtube_channels.id`). Cuidado: em `youtube_video_analytics` e em
  `ab_tests` a coluna de mesmo nome, `youtube_video_id`, é o **uuid** de `youtube_videos.id`. Nunca
  juntar pelo nome; o join com as tabelas antigas é por `video_id`. O casamento com relatórios é pelo
  id do YouTube.
- **Acesso.** RLS `select using (public.can_edit_site(site_id))`, escrita só por service role,
  `drop policy if exists` antes de `create policy`. `yt_reporting_report_blobs` não tem policy de
  leitura: só service role.
- **Rede.** Toda chamada às APIs do Google leva `AbortSignal.timeout(15_000)`; estouro vira tentativa
  `erro_http` com `http_status` nulo. Até 4 chamadas em paralelo. Respostas de `reports.query` são
  lidas por `columnHeaders[].name`, nunca por posição.
- **Escrita.** Todo `upsert` e `update` da rota confere `error`, inclusive os da parte antiga
  (`route.ts:144-161`), que hoje não conferem. Código `42P01`, `42703`, `PGRST204`
  ou `PGRST205` vira tentativa `schema_ausente` e falha crítica; nenhuma escrita é descartada em silêncio.
- **Avisos.** Entrega por `fanOutToSiteAdmins` com `buildNotification` (o que a rota já usa), domínio
  `youtube`. `getSiteOwners(client, siteId)` serve só para detectar lista vazia, que vira
  `SEM_DESTINATARIO` e falha crítica (seção 9). Deduplicação com `lib/ops/alert-state.ts`, chave
  `sync-analytics:<youtube_channels.id>:<motivo>`: entrada e lembrete = `claimAlert(supabase, key,
  '7 days')` (verdadeiro = avisar); saída = `readAlertStamp` não nulo → avisa e `releaseAlert`.
  `ops_alert_state` é carimbo de aviso, nunca contador. Textos:
  - `reautorizar`: "O canal <nome> perdeu a autorização do YouTube. A coleta parou. Reconecte o canal em Configurações."
  - `api_nao_ativada`: "A YouTube Reporting API não está ativada no projeto do Google. Impressões e CTR não estão sendo coletados."
  - `sem_acesso`: "O YouTube recusou o acesso aos relatórios do canal <nome>. Impressões e CTR não estão sendo coletados."
  - `tipo_indisponivel`: "O YouTube não oferece o relatório de alcance para o canal <nome>."
  - saída: "A coleta do canal <nome> voltou ao normal."

## 2. Tabelas

**L1**

| Tabela | Chave | Colunas |
|---|---|---|
| `yt_reporting_jobs` | `(channel_id, report_type_id)` | `job_id`, `job_create_time` (o `createTime` do Google), `status` (`ativo`, `desativado`, `sem_acesso`, `api_nao_ativada`, `tipo_indisponivel`, `erro`), `error`, `created_at`, `last_listed_at`, `last_create_time` |
| `yt_reporting_reports` | `report_id` | `job_id`, `channel_id`, `report_type_id`, `start_time`, `end_time`, `create_time`, `job_expire_time`, `download_url`, `is_backfill`, `status` (`listado`, `baixado`, `vazio`, `erro`, `expirado_sem_baixar`), `error`, `row_count`, `bytes`, `sha256`, `unmatched_video_ids jsonb`, `downloaded_at`, `normalized_at` |
| `yt_reporting_report_blobs` | `report_id` | `csv_gz bytea` (o CSV bruto comprimido, gravado como `\x` + hex). Fica fora de qualquer `select *` |
| `yt_own_video_meta_daily` | `(youtube_video_id, day_pt)` | `title`, `thumbnail_sha256`, `thumbnail_dhash`, `thumbnail_blob_url`, `title_at_capture`, `thumbnail_sha256_at_capture`, `description_sha256`, `description_text`, `tags_sha256`, `tags text[]`, `duration_seconds`, `is_short`, `privacy_status`, `ab_test_id`, `ab_variant_id`, `seconds_on_air_analytics`, `seconds_other_analytics`, `seconds_on_air_reporting`, `seconds_other_reporting`, `captured_at` |
| `yt_own_collection_attempts` | `(scope_type, scope_id, kind, attempt_day)` | `scope_type` em (`video`, `canal`, `job`); `scope_id text`; `kind` em (`sondagem`, `meta`, `thumbnail`, `relatorio`, `diario`, `retencao_vida`); `outcome` em (`ok`, `sem_dado_na_janela`, `video_novo`, `sem_conexao`, `sem_autorizacao`, `erro_http`, `nao_alcancado_orcamento`, `schema_ausente`); `http_status`, `error`, `attempts`, `last_attempt_at`, `channel_id` |

`youtube_channels` ganha `authorization_verified_at` e `collection_status` (`ok`, `reautorizar`; padrão `ok`).

**L2** (todas as métricas são nulas)

| Tabela | Chave | Colunas |
|---|---|---|
| `yt_own_video_daily` | `(youtube_video_id, day_pt)` | `views`, `engaged_views`, `watch_time_minutes`, `avg_view_duration_seconds`, `avg_view_percentage`, `likes`, `comments`, `shares`, `subscribers_gained`, `subscribers_lost`, `card_impressions`, `card_click_rate` |
| `yt_own_video_reach_daily` | `(youtube_video_id, day_pt)` | `thumbnail_impressions`, `thumbnail_ctr numeric` (na unidade em que veio; o runbook anota se é 0–1 ou 0–100), `source_report_id`, `report_create_time` |

`yt_own_video_daily` é gravada **só pela Analytics API**. O relatório `channel_basic_a3` fica só no bruto.

**L3**

| Tabela | Chave | Colunas |
|---|---|---|
| `yt_own_video_retention` | `(youtube_video_id, window_kind, segment, window_end)` | `window_kind` (`vida`; outros no L5); `segment` (`all`; outros no L5); `window_start`; `audience_type`; `metrics_returned text[]`; `points jsonb` (itens com `ratio`, `relative`, `started`, `stopped`, `segment_impressions`); `point_count` |

Na migration de L3, `youtube_video_analytics.impressions` e `ctr` perdem `NOT NULL DEFAULT 0`, e as
linhas com `impressions = 0 and ctr = 0` vão a `NULL` (nunca foram medidas; hoje são todas as 463). A
tabela ganha `avg_view_percentage` e `engaged_views`, nulas, e continua sendo o **total da janela de
90 dias na data da coleta**. Linha anterior ao L3 fica com as duas nulas: "sem dado".

Leitores de `impressions` e `ctr` dessa tabela, a tornar tolerantes a nulo no push (a) de L3:
`lib/youtube/scoring.ts`, `scoring-types.ts`, `rolling-window.ts`, `analytics-window.ts`, o cron
`weekly-grade-snapshot`, `ab-lab/queries.ts`, `lib/pipeline/services/youtube.ts`,
`youtube/analytics/actions.ts` e `youtube/_actions/youtube-prompt-actions.ts`. A lista fecha com
`grep -rnE "impressions|\bctr\b" apps/web/src apps/web/lib` filtrado pelos que leem
`youtube_video_analytics`. (`youtube_videos.ctr` e `.impressions` são outra tabela e não mudam.)

`database.types.ts` é regenerado e commitado com cada migration. As colunas `retention_curve`,
`traffic_sources`, `ctr`, `impressions` e `avg_view_percentage` de `youtube_videos` não são
preenchidas por este spec e saem depois.

**Tipos, chaves e índices.** Contagens são `bigint`; taxas e percentuais, `numeric`; `*_time` e `*_at`,
`timestamptz`; `day_pt` e `attempt_day`, `date`; estados, `text` com `check`. `site_id` referencia
`sites(id) on delete cascade`. Nas tabelas por vídeo, `video_id uuid null references
youtube_videos(id) on delete set null` e `channel_id uuid not null references youtube_channels(id) on
delete restrict`: apagar um vídeo não apaga o histórico dele. Índices: `(channel_id, day_pt)` em cada
tabela por vídeo; `yt_reporting_reports (status, report_type_id, create_time)` e `(job_id, create_time)`;
`yt_own_collection_attempts (kind, outcome, attempt_day)` e `(channel_id, attempt_day)`.

**Escopo das tentativas.** `scope_id`: para `video`, o id do YouTube; para `canal`,
`youtube_channels.id`; para `job`, `<youtube_channels.id>:<report_type_id>`. Todo passo grava a
tentativa também quando o resultado é `ok`: uma linha por escopo, `kind` e dia; reexecução no mesmo dia
sobrescreve e soma `attempts`.

**Remover canal.** Com `channel_id ... on delete restrict`, a RPC `youtube_channel_remove`
(`20261003000007_youtube_channel_remove.sql`) passaria a falhar com erro de chave estrangeira. A
migration de L1b recria as duas funções por inteiro (`create or replace`): `youtube_channel_remove`
devolve `status: 'serie_coletada'` com o impacto, depois de `not_found` e `slug_mismatch` e antes de
`blocked`; `youtube_channel_removal_impact` ganha a chave `serie_coletada` (soma das linhas `yt_own_*`
e `yt_reporting_*`). No commit de código de L1b: `'serie_coletada'` entra no `z.enum` e no tipo
`RemovalRpc` de `lib/youtube/channel-registry.ts`; texto em `CHANNEL_TEXT` ("Este canal tem série
coletada. Apagar a série é um passo manual, descrito no runbook."); ramo em
`youtube/_actions/channels.ts`; e os testes `integration/youtube-channel-remove.test.ts` (que compara
a lista exata de chaves) e `channel-registry-actions.test.ts`. Apagar a série de um canal continua sendo passo manual do dono, no runbook.

**Decisões de `create table` que faltavam.**
- `ab_test_id` e `ab_variant_id` em `yt_own_video_meta_daily`: `uuid` sem chave estrangeira (testes
  são apagados, e a linha do dia tem de sobreviver).
- `yt_reporting_report_blobs.report_id`: `references yt_reporting_reports(report_id) on delete cascade`.
- `yt_reporting_reports`: `channel_id` e `report_type_id` não nulos; sem chave estrangeira para
  `yt_reporting_jobs` (o `job_id` muda quando o job é recriado).
- `channel_id`: não nulo em `yt_reporting_jobs` e `yt_reporting_reports`; nulo permitido em
  `yt_own_collection_attempts`. Em L1b todos passam a `on delete restrict`.
- `yt_reporting_jobs.job_id`: nulo permitido (não existe em `sem_acesso`, `api_nao_ativada`,
  `tipo_indisponivel`, `desativado`). `last_create_time` = o maior `createTime` já listado para o job.
- `attempts int not null default 1`. O PostgREST não soma num `upsert`: a migration cria
  `public.yt_own_attempt_record(...)` (`insert … on conflict do update set attempts = t.attempts + 1`,
  só service role), e o código chama essa função.
- `youtube_channels.collection_status text not null default 'ok' check (collection_status in ('ok', 'reautorizar'))`.
- `metric_version text not null`; valores: `views_ate_2025-03-30`, `views_2025-03-31_a_2026-08-26`,
  `views_desde_2026-08-27`.

## 3. Passo de metadados (L1)

Todo dia, para todo vídeo de todo canal em `youtube_channels` — independente de `sync_enabled`, de
conexão e de `collection_status` —, grava o **dia fechado** (`day_pt` = ontem em
`America/Los_Angeles`). O passo lê `youtube_videos` e `i.ytimg.com`; só `privacy_status` precisa de token.

**Captura** (o estado no instante `captured_at`, cerca de 5 horas depois do fim do dia):
- `title_at_capture`, `duration_seconds`, descrição e tags vêm da mesma chamada `videos.list` do item
  seguinte quando há token (L1b); sem token, e em L1a, de `youtube_videos` (tão frescos quanto o
  último sync). A fonte pode mudar de um dia para o outro; se o hash diferir só por isso, grava-se o
  texto de novo, o que é aceito. Os hashes de descrição
  e tags são gravados sempre. `description_text` e `tags` são gravados no primeiro dia e quando o hash
  difere do último gravado. "Último gravado" é a linha de maior `day_pt` **estritamente menor** que o
  dia em gravação. No upsert, `description_text`, `tags` e `thumbnail_blob_url` nunca passam de não
  nulo a nulo (uma segunda execução no mesmo dia não apaga nada).
- `privacy_status` (L1b): cliente novo `lib/youtube/coleta/videos-list.ts`, com o token do canal dono
  (nunca a `YOUTUBE_API_KEY`; o cliente que existe, `fetchVideoDetails`, usa a chave pública),
  `part=snippet,contentDetails,status`, 50 ids por chamada, 1 unidade de cota cada, reaproveitando
  `parseDuration` de `api-client.ts`. Sem token ou com falha: nulo. Id ausente da resposta (vídeo
  privado para o token, ou apagado): `privacy_status` nulo e tentativa `meta` com `erro_http`.
- `is_short`: `classifyShort({durationSeconds, title, probe})` de `lib/youtube/short-classifier.ts`.
  `duration_seconds = 0` → nulo. Duração de 61 a 180 s usa `probeShortsBatch` com um `newProbeBudget()` por
  execução. Entra em L1b; em L1a a coluna fica nula. Resultado com `confirmed = false` → nulo.
- Thumbnail: `probeThumb(youtube_video_id, null)` (`lib/youtube/thumb-fingerprint.ts`; baixa a
  `hqdefault` de `i.ytimg.com`), dentro de `try`. Exceção, `dhash` nulo (o HEAD ou o GET falhou sem lançar) ou `archiveThumb`
  devolvendo nulo viram tentativa `thumbnail` com `erro_http`; a linha é gravada com os campos de
  thumbnail nulos e `thumbnail_blob_url` repetindo a última. `probeThumb` tem tempos fixos de 10 e
  15 s: passa-se a ele, no terceiro parâmetro, um `fetch` que aplica o tempo que resta ao passo;
  `archiveThumb` roda dentro de `Promise.race` com o mesmo limite. Grava `thumbnail_dhash` e
  `thumbnail_sha256_at_capture` (sha256 dos bytes; é só registro). **A thumbnail "mudou" quando a
  distância de Hamming entre o dHash e o último gravado passa de `DHASH_MAX_SAME`**, a regra que o
  projeto já usa. Quando muda, ou quando não há linha anterior, a imagem é arquivada com `archiveThumb`; `thumbnail_blob_url` é sempre
  preenchida, repetindo a última quando não mudou. A URL do YouTube não serve de identidade: não muda
  quando a imagem muda.

**O que vale para o dia** (`title`, `thumbnail_sha256`):
- **Sem ciclo de teste A/B no dia:** copia a captura. O valor pode ter mudado nas 5 horas depois do
  fim do dia; esse erro é aceito e está declarado aqui.
- **Com ciclo de teste no dia:** calcula os segundos de cada variante dentro do dia a partir de
  `ab_test_cycles.started_at` e `ended_at`, duas vezes: com o dia do Pacífico com horário de verão
  (`seconds_on_air_analytics`, `seconds_other_analytics`) e com o dia em UTC-8 fixo (par `_reporting`).
  - Ciclo aberto só conta até o fim do dia se `ab_tests.status = 'active'`. Em qualquer outro estado
    ele termina em `ab_tests.paused_at` (teste `paused`) ou `completed_at` (`completed`, `archived`);
    com as duas nulas, em `started_at`. (A pausa automática de hoje não fecha o ciclo:
    `ab-rotate-phases.ts:243-272`.)
  - `ab_variant_id` é a variante de mais segundos no cálculo `_analytics`; `on_air` é dela e `other`
    é a soma das demais variantes.
  - Se o tempo fora de qualquer ciclo naquele dia for maior que `on_air` (teste que começou ou acabou
    no meio do dia), se houver ciclos de mais de um teste no dia, se o teste tiver mais de um
    ciclo aberto ou um ciclo aberto com outro de `started_at` posterior (retomar não fecha o ciclo
    antigo), ou se a soma dos segundos dos ciclos passar da duração real do dia naquele cálculo (fim
    menos início: 23, 24 ou 25 horas no Pacífico): `ab_variant_id`, `title` e
    `thumbnail_sha256` ficam nulos; `ab_test_id` continua preenchido.
  - `title` = `applied_metadata.title_set` do ciclo dessa variante; se ausente, `ab_tests.original_title`;
    se ausente, `title_at_capture`.
  - `applied_metadata` não guarda identidade de imagem (só `thumbnail_set` e `youtube_thumbnail_url`,
    `ab-types.ts:99-105`). A identidade da thumbnail do dia é o `ab_variant_id` (a imagem está em
    `ab_test_variants.blob_url`). `thumbnail_sha256` copia a captura só quando a variante do ciclo
    aberto em `captured_at` é a mesma `ab_variant_id`; senão fica nulo.
  - `started_at` é a hora em que o servidor gravou o ciclo, não uma confirmação do YouTube.

Dia sem linha nesta tabela = não medido. Dias anteriores ao L1 nunca terão linha.

O passo grava linha só para vídeos com `youtube_videos.published_at` anterior ao fim do `day_pt`; é
esse o conjunto esperado pelos critérios da seção 9.

## 4. Passo 1A — Sondagem e jobs (L1)

Em toda execução, para cada canal com `sync_enabled` e conexão viva que ainda não tem job `ativo` para
todos os tipos habilitados:
1. `reportTypes.list` e `jobs.list`.
2. Tipos habilitados são a constante `REPORT_TYPES_ENABLED` em `lib/youtube/reporting/types.ts`:
   `channel_reach_basic_a1`, `channel_reach_combined_a1`, `channel_traffic_source_a3`,
   `channel_basic_a3`. Para cada um sem job: `jobs.create`. Resposta 409 → `jobs.list` de novo e adota
   o job existente. Grava `ativo`.
3. Tipo que a lista devolve e não está habilitado: linha `desativado`, sem chamada. Habilitar é um
   commit de uma linha.
4. Tipo habilitado ausente da lista: linha `tipo_indisponivel`.

Erros:
- 403 com `reason = accessNotConfigured`: `api_nao_ativada`.
- 401, ou 403 `insufficientPermissions`, **da Reporting API**: `sem_acesso` no job, e só isso.
- Os dois são tentados de novo a cada execução (custa uma chamada) e saem sozinhos quando a chamada passa.
- Erro da Reporting API afeta só os passos 1A e 1C. **Nunca** para os passos da Analytics API.

As chamadas do 1A correm em paralelo (até 4), cada uma dentro do que resta do teto. Se
`reportTypes.list` falhar, grava-se uma linha por tipo de `REPORT_TYPES_ENABLED` com o estado.
Cada canal recebe uma tentativa `sondagem` (com `erro_http` e `http_status` quando falha). O resultado da primeira execução — tipos oferecidos e
estado por canal — é anotado no ledger.

## 5. Passo 1C — Relatórios em lote

**Listar e baixar (L1).** Para cada job `ativo`: `reports.list` (sem `createdAfter` na primeira vez;
depois `createdAfter = last_create_time − 1 dia`), percorrendo `nextPageToken`. `reports.list` com 404
(job removido do lado do Google): o job vira `erro` e o 1A o recria. Cada relatório novo entra como
`listado`, com `download_url` e `job_expire_time`, por inserção com `onConflict: 'report_id',
ignoreDuplicates: true`: a listagem nunca altera uma linha que já existe.
`is_backfill = start_time < yt_reporting_jobs.job_create_time`.

O cliente é novo: `lib/youtube/reporting/client.ts`, base `https://youtubereporting.googleapis.com/v1`,
com `reportTypesList`, `jobsList`, `jobsCreate({reportTypeId, name})`,
`reportsList(jobId, {createdAfter, pageToken})` e `download(downloadUrl)`, todos com
`Authorization: Bearer` do canal. `download` usa o `downloadUrl` do relatório como veio, com o mesmo
token e `Accept-Encoding: gzip`, e lê `arrayBuffer`. Se os dois primeiros bytes forem `1f 8b`, guarda
como veio; senão comprime com `zlib.gzipSync`: `csv_gz` é **sempre** gzip. Gravação pelo PostgREST como
a string `'\\x' + buf.toString('hex')`; a leitura devolve a mesma forma e decodifica com
`Buffer.from(s.slice(2), 'hex')`. `sha256` é do CSV descomprimido; `bytes` e o limite valem para o gzip.

No máximo 40 downloads por execução, um de cada vez na gravação (o buffer é liberado antes do
próximo); o resto fica `listado` e conta em `pendentes`. O download usa o `download_url` gravado na
listagem; se devolver 401 ou 403, chama `reportsList` sem `createdAfter` uma vez e renova as URLs com um
`update download_url … where status = 'listado'`, à parte da inserção.
`expirado_sem_baixar` = relatório `listado` com `create_time` há mais de 60 dias (30 se `is_backfill`),
ou download que devolve 404 ou 410.

Download por prioridade: alcance básico → alcance combinado → tráfego → `channel_basic_a3`; dentro do
tipo, `create_time` crescente. O CSV comprimido vai para `yt_reporting_report_blobs`, com `bytes` e
`sha256` em `yt_reporting_reports`. Acima de 2 MB comprimido: `erro`, `error = 'grande_demais'`.
`row_count = 0`: `vazio`. O bruto de relatório normalizado há mais de 90 dias é apagado pelo próprio
passo, ficando o `sha256`. Tipo sem normalizador neste spec (`channel_reach_combined_a1`,
`channel_traffic_source_a3`, `channel_basic_a3`) tem o bruto apagado 180 dias depois de `downloaded_at`.
O bruto do alcance básico nunca é apagado antes de normalizado.

**Normalizar o alcance básico (L2).** Pode ser refeito a partir do bruto; `normalized_at` marca a última vez.
- O cabeçalho é validado contra as colunas esperadas. Diferente: `erro`,
  `error = 'cabecalho_inesperado'`, nada normalizado.
- Grava `yt_own_video_reach_daily`. Só sobrescreve se o `report_create_time` novo for maior.
- Mais de uma linha por vídeo e dia no CSV: impressões = soma; CTR = média ponderada pelas impressões;
  as dimensões descartadas vão no runbook. Se o CSV real não permitir a ponderação, parar e perguntar.
- `video_id` do relatório sem par em `youtube_videos`: vai para `unmatched_video_ids`, com contagem.

## 6. Passo 1B — Analytics API

**Diário por vídeo (L2).** `dimensions=day`, `filters=video==<id>`, as doze métricas de
`yt_own_video_daily`.
- Primeira vez (nenhuma tentativa `diario` com `ok` para o vídeo): da publicação até hoje.
- Depois: de `min(hoje − 10 dias, último day_pt gravado do vídeo)` até hoje. Isso reprocessa os
  números que o YouTube corrige e fecha qualquer buraco deixado por dias sem coleta.
- Grava o que vier. Dia da janela sem linha na resposta não é gravado (sem atividade não é zero nem
  erro) e a tentativa é `ok`. Resposta sem linha nenhuma: `sem_dado_na_janela`, ou `video_novo` se o vídeo
  foi publicado há menos de 3 dias. A chamada é feita sempre.
- Upsert por `(youtube_video_id, day_pt)`.

**Consulta de janela (L3, a que já existe).** Acrescenta `averageViewPercentage`, `engagedViews`,
`subscribersLost`. Se a API recusar a lista estendida (400), repete com a lista atual e registra
`metricas_estendidas = 'recusadas'` na resposta e no Sentry. Grava `avg_view_percentage` e
`engaged_views` em `youtube_video_analytics`. No mesmo push, `analytics-window.ts` deixa de usar
`Number(env ?? '90')` (que dá 0 com variável vazia e `NaN` com texto) e passa a
`const n = Number.parseInt(process.env.YT_ANALYTICS_SYNC_WINDOW_DAYS ?? '', 10)`, valendo `n` se for
finito e maior que zero, e 90 caso contrário. O percentual médio de um vídeo, para a tela de retenção, é este —
nunca a média dos dias.

**Curva de retenção `vida` (L3).** `dimensions=elapsedVideoTimeRatio`,
`filters=video==<id>;audienceType==ORGANIC`, da publicação até hoje, métricas `audienceWatchRatio`,
`relativeRetentionPerformance`, `startedWatching`, `stoppedWatching`, `totalSegmentImpressions`.
- Um vídeo vence 7 dias depois da sua última linha `vida` ou da sua última tentativa `retencao_vida`,
  o que for mais recente (ou já, se não tem nenhuma das duas). Cada coleta é
  uma linha nova: o histórico da curva. Para espalhar a primeira leva, no primeiro ciclo cada vídeo só
  é tentado no dia da semana UTC igual a `(primeiros 4 bytes do sha256 do uuid, big-endian) mod 7`.
- Resposta com ao menos 1 ponto: grava, com `point_count` real. Resposta vazia: tentativa
  `sem_dado_na_janela`; tenta de novo por 3 dias e depois só no vencimento seguinte.
- Se a API recusar métrica ou filtro, repete só com `audienceWatchRatio` e
  `relativeRetentionPerformance`; `metrics_returned` diz o que veio.

**Autorização (L1b).** Toda chamada autenticada bem-sucedida grava `authorization_verified_at`.
- Vira `collection_status = 'reautorizar'`: `TokenRevokedError` de `ensureFreshToken`; 401 da Analytics
  API ou da Data API; 403 `insufficientPermissions` da Analytics API; e `NoActiveConnectionError` quando existe
  linha em `social_connections` (`site_id`, `provider = 'youtube'`, `account_id = channel_id`) com
  `revoked_at` não nulo. Este último é o caso comum: o token revogado marca a conexão antes de lançar
  (`token-refresh.ts:358-359`), e dali em diante só aparece "sem conexão". Nesse estado a coleta por
  token do canal para, nada é apagado, o dono é avisado, e os passos gravam `sem_autorizacao`.
- `NoActiveConnectionError` sem conexão revogada: pulo legítimo, como hoje; os passos gravam `sem_conexao`.
- Qualquer outro erro (rede, 5xx, `AmbiguousConnectionError`): falha do passo, estado inalterado.
- Volta a `ok`: em `api/social/oauth/[provider]/callback/route.ts`, no `case 'google'` (que grava
  `provider: 'youtube'`), depois do upsert em `social_connections`, atualiza `youtube_channels` com o
  `site_id` do fluxo e `channel_id = channel.channelId`. Zero linhas atualizadas não é erro.
- Os passos continuam chamando `ensureFreshToken` num canal em `reautorizar`; se a chamada passar, o
  estado volta a `ok` sozinho, sem esperar o OAuth.
- No dia da revogação a parte antiga da rota também veria "sem conexão" e avisaria pelo caminho dela
  (`route.ts:186-192`): quando o canal está em `reautorizar`, esse aviso antigo não é enviado.
- Apagar a série de um canal revogado é passo manual do dono, no runbook.

## 7. Ordem, relógio e orçamento

Ordem: metadados → 1A → o que o cron já faz → 1C → diário por vídeo → retenção.

Há um relógio global (270 s, ou o do pré-requisito 2). Cada passo novo recebe
`min(teto do passo, relógio global − decorrido)`; os tetos valem para o passo inteiro, todos os
canais: metadados 30 s, 1A 20 s, 1C 60 s, diário por vídeo 50 s, retenção 40 s (200 s no total). O
que o cron já faz não é cortado pelos passos novos; a sua duração é medida e sai na resposta como
`ms_existente`. Passo que recebe 0 s grava uma tentativa `nao_alcancado_orcamento` de escopo `canal`
(e, no passo de metadados, também uma por vídeo, para o critério da seção 9 reconhecer).
Dentro do teto, vem primeiro quem tem a coleta mais antiga (nunca coletado primeiro); o que não coube
grava `nao_alcancado_orcamento`. O teto de 40 downloads e a fila de relatórios `listado` **não** contam
como `nao_alcancado_orcamento`: só o relógio conta.

Estimativa com 35 vídeos e 2 canais: metadados 35 downloads de thumbnail e 1 chamada; diário ~35
chamadas; retenção 35 chamadas na primeira semana e ~5 por dia depois; relatórios, 4 tipos por canal
com ~30 de histórico cada, ~240 downloads iniciais, que assentam em poucos dias com o alcance primeiro.

**Como os passos encaixam na rota.** A rota hoje é um laço por canal, com o token obtido dentro do
`try` (`route.ts:67-69`). Esse laço não é refatorado. Os passos novos vivem em `lib/youtube/coleta/`,
atrás de `rodarColeta(ctx)` (`lib/youtube/coleta/index.ts`); cada passo é uma função que recebe
`{supabase, channels, deadline, falhas, tentativas}` e percorre os canais sozinha, chamando
`ensureFreshToken(channel.site_id, 'youtube', channel.channel_id)` para cada um (a chamada é barata e
idempotente). A parte antiga passa a rodar inteira dentro de um `try`: exceção vira item de `falhas[]`
e os passos seguintes rodam. Os `fetch` da parte antiga também ganham o timeout. O timeout de cada
chamada é `min(15 s, tempo que resta ao passo)`.

**Lista de canais.** `rodarColeta` faz a sua própria leitura, sem filtro:
`select id, channel_id, site_id, name, sync_enabled, collection_status from youtube_channels`. A leitura
da rota (`sync_enabled = true`) fica como está e só serve à parte antiga. O passo de metadados usa
todos os canais; 1A, 1C, diário e retenção filtram `sync_enabled` em código. Erro nessa leitura entra
em `falhas[]` e nenhum passo novo roda.

## 8. Passo 1D — Preparação dos pacotes da forja (L4)

Achados nos 14 pacotes reais (`~/Workspace/forja/observatorio/LEIAME.md`): o worker corta a tabela em
120 linhas e os vereditos por fórmula são as últimas; o corte privilegia os mais recentes, não os
outliers. Mudança só no site (`lib/youtube/observatorio/forja/sent.ts`, `outlierPack`): as linhas
`fórmula` vêm primeiro; depois os outliers por múltiplo decrescente; depois os demais por data. `text`,
`ids`, `numbers` e `base` não mudam. Testes: num pacote de 200 vídeos as linhas `fórmula` estão entre
as 120 primeiras; pacote sem nenhuma `fórmula` mantém a ordem outliers → demais. Datas na tabela e o
código da thumbnail ficam para o kit, que é do dono.

## 9. Como alguém percebe que parou

**Um único veredito, na última linha da rota.** Hoje a rota chama `recordCronSuccess` quando a parte
antiga dá certo, e isso zeraria a falha de qualquer passo novo. Passa a ser: a parte antiga e os passos
novos só acumulam `falhas[]`; no fim, `falhas.length > 0` → **uma** chamada
`recordCronFailure('sync-analytics-metrics', joinNotes(falhas))`; senão `recordCronSuccess`.
Mapeamento em `route.ts`:
- erro ao ler os canais (l.45-50): continua chamando `recordCronFailure` e respondendo 500, porque
  nenhum passo rodou. É o único registro fora do veredito;
- `no_channels` (l.52-55): com a leitura da rota vazia, a rota ainda chama `rodarColeta` (que lê
  todos os canais) e só responde `no_channels` depois do veredito;
- `errors > 0` (l.336) vira `falhas.push(joinNotes(errorDetails))`;
- "todos os canais vazios" (l.338-347) vira `falhas.push` com a mesma mensagem;
- o ramo de sucesso só roda com `falhas` vazia.

A resposta traz, por passo: gravados, tentativas por resultado e `pendentes`.

Entram em `falhas[]` (classe crítica; deixa o `/api/health` degradado):
- exceção num passo, ou `schema_ausente`;
- vídeos com linha em `yt_own_video_meta_daily` para o `day_pt` em menor número que os vídeos do canal,
  sem contar os que tiveram tentativa `meta` `nao_alcancado_orcamento` no dia (esses caem na regra das
  3 tentativas);
- `dias_sem_meta` maior que 0: por canal, calculado **antes** da gravação do dia, é o número de dias
  entre o último `day_pt` gravado e ontem; sem linha anterior vale 0. Sai na resposta e entra em
  `falhas[]` uma vez;
- tentativa `thumbnail` falhando em metade ou mais dos vídeos por 2 dias, sem contar vídeos privados
  ou ausentes de `videos.list`;
- relatório de alcance em `erro`, ou `vazio` em 4 `create_time` seguidos; job em `erro` por 3 dias;
- relatório `listado` há mais de 14 dias, ou `expirado_sem_baixar`;
- os dois itens acima contam só relatórios com `create_time` nos últimos 14 dias: depois disso o
  relatório sai de `falhas[]` e fica na resposta como `perdidos` (é um estado sem conserto, e manter o
  vermelho para sempre esconderia as falhas novas);
- job de alcance `ativo` há mais de 6 dias (contados de `job_create_time`) sem relatório novo, em canal
  com vídeo publicado nos últimos 90 dias; a partir
  do L2, sem linha nova em `yt_own_video_reach_daily` há 4 dias;
- o mesmo escopo e `kind` com `nao_alcancado_orcamento` nas 3 últimas tentativas registradas — exceto
  a retenção enquanto houver relatório `listado` por baixar;
- a partir do L2: canal com 5 ou mais vídeos e nenhum com tentativa `diario` `ok` nas 3 últimas
  execuções em que o canal tinha conexão viva e `collection_status = 'ok'`;
- a partir do L3: vídeo com linha em `yt_own_video_daily` e sem curva `vida` há mais de 21 dias, exceto
  aquele cuja última tentativa `retencao_vida` foi `sem_dado_na_janela` (sai na resposta como `sem_retencao`);
- aviso que não pôde ser entregue: `SEM_DESTINATARIO` ou exceção no envio.

Não entram em `falhas[]` (classe "ação do dono": aviso pela regra da seção 1 e campo `acao_do_dono`
na resposta): `reautorizar`, `api_nao_ativada`, `sem_acesso`. `tipo_indisponivel` avisa uma vez e fica
na resposta. Isso evita um `/api/health` degradado para sempre por algo que só o dono resolve; se o
aviso não puder ser entregue, vira falha crítica (último item acima).

Canal sem conexão viva e sem conexão revogada é pulado nos passos que usam token, como hoje. Canal com
0 vídeos fica fora dos critérios por vídeo.

## 10. Rollback e documentação

Por lote. L1: antes de tudo, o dono exporta `yt_reporting_report_blobs` e
`yt_own_video_meta_daily` (comando no runbook), porque esse dado não volta; depois `jobs.delete` por job criado; a migration de rollback de L1b restaura primeiro a versão original
das duas funções de remover canal (`20261003000007`) e só então apaga colunas e tabelas; reverter o código, migration que apaga as cinco tabelas e
as duas colunas. L2: reverter o código e apagar as duas tabelas. L3: reverter o código; a troca de
zero por nulo não se desfaz (os zeros eram falsos), e os leitores tolerantes a nulo ficam. L4: reverter.

A entrega de L1 inclui `docs/ops/youtube-coleta-canais-proprios-runbook.md`: ler a resposta do cron e
as tabelas de jobs e tentativas; ativar a API; reconectar canal; exportar um CSV do bruto para fixture;
re-normalizar um relatório; apagar a série de um canal revogado; desligar um passo ou um tipo. Cada
lote ganha uma entrada no ledger (`.superpowers/sdd/2026-10-07-coleta-canais-proprios-plan/progress.md`).

## 11. Aceite

0. Os dois testes que já existem (`apps/web/test/cron/sync-analytics-metrics.test.ts` e
   `apps/web/test/api/cron/sync-analytics-metrics.test.ts`) são editados no commit que introduz os passos novos:
   cada um ganha `vi.mock('@/lib/youtube/coleta', ...)` com `rodarColeta` devolvendo
   `{falhas: [], resumo: {}}`, e continuam verdes. Os testes abaixo
   chamam `rodarColeta` e os passos diretamente, com cliente Supabase próprio. Datas fixas com
   `vi.useFakeTimers`; avisos com `vi.mock('@/lib/ops/alert-state')`.
1. Cada migration roda duas vezes sem erro em banco local.
2. Teste do veredito, partindo de `consecutive_failures = 0`: passo novo falha e a parte antiga dá certo → depois de a rota responder,
   o mock de `recordCronFailure` foi chamado uma vez e o de `recordCronSuccess` nenhuma.
3. Teste: tabela ausente (`42P01`) e coluna ausente (`PGRST204`) → `schema_ausente`, falha crítica, os
   demais passos rodam, a rota responde 200 e a escrita antiga não é perdida.
4. Teste: `reportTypes.list` com 403 `accessNotConfigured` → `api_nao_ativada`; com 401 → `sem_acesso`;
   nos dois a coleta da Analytics API continua, não há falha crítica e sai um só aviso em duas execuções. Sem destinatário → falha crítica.
4b. Testes de autorização (L1b): `TokenRevokedError` → `reautorizar` e um aviso; `NoActiveConnectionError`
   com conexão revogada → `sem_autorizacao`; sem conexão revogada → `sem_conexao` e nenhum aviso;
   `ensureFreshToken` voltando a passar → `ok`; callback de OAuth → `ok`; 401 da Reporting API não muda
   `collection_status`; remover canal com série → `serie_coletada` na tela.
5. Teste: `jobs.create` com 409 → adota o job existente. Relatório `expirado_sem_baixar` há 15 dias
   sai de `falhas[]` e aparece em `perdidos`. `dias_sem_meta` no primeiro dia é 0. `reports.list` com 404 → job `erro`. Relistar
   um relatório já `baixado` não muda a linha. 100 relatórios listados → 40 baixados, e os 60 restantes
   baixam nos dias seguintes pelo `download_url` gravado; URL que devolve 403 é renovada.
6. Teste do passo de metadados: rotação às 08:00 UTC num dia de horário de verão →
   `seconds_other_analytics = 3600` e `seconds_other_reporting = 0`; dias 31/10, 01/11 (25 horas), 02/11 e 08/03 (23 horas),
   com teste no ar o dia inteiro, gravam a variante certa; pausar e retomar no mesmo dia → campos de
   variante nulos; thumbnail que não baixa → linha gravada com campos nulos e tentativa `thumbnail`;
   descrição que não mudou → `description_text` nulo; segunda execução no mesmo dia mantém o
   `description_text` gravado; teste só de thumbnail com `applied_metadata` nulo → `title` é o original
   e `ab_variant_id` preenchido; ciclo aberto de teste pausado não conta; teste iniciado às 23:00 do Pacífico →
   campos de variante nulos; canal sem conexão → linha gravada com `privacy_status` nulo; ida e volta
   de um `csv_gz` com bytes `0x00` e `0xff`.
7. Teste: relógio global estourado → `nao_alcancado_orcamento`, `pendentes > 0`, e o passo de
   metadados rodou. `fetch` que nunca responde → `erro_http` em 15 s.
8. Produção, 72 h depois de L1: cada canal com conexão viva tem, para cada tipo de alcance, ou um
   relatório `baixado`, ou um estado explícito em `yt_reporting_jobs` com a ação do dono anotada no
   ledger. Sem uma das duas, o aceite falha. `yt_own_video_meta_daily` tem uma linha por vídeo por dia.
9. L2: teste do normalizador com o CSV real exportado de produção; cabeçalho inesperado → `erro`;
   relatório mais antigo não sobrescreve. Teste do diário: resposta com colunas em outra ordem grava
   cada valor na coluna certa; sem `averageViewPercentage` → `NULL`, nunca 0; sem linhas →
   `sem_dado_na_janela`; duas execuções no mesmo dia → mesmas linhas; vídeo parado 20 dias → a janela
   seguinte começa no último `day_pt` gravado. Produção, 48 h depois:
   `select count(*), count(views) from yt_own_video_daily` com pelo menos 80% preenchido.
10. L3: teste por leitor com `impressions = NULL` → "sem dado", nunca 0; 400 na lista estendida →
    repete com a atual e registra `recusadas`; `YT_ANALYTICS_SYNC_WINDOW_DAYS` apagada (com
    `vi.resetModules()` antes do import), vazia e não numérica → 90 dias. Produção, 8 dias depois: uma
    curva `vida` por vídeo que tem linha em `yt_own_video_daily`.
11. Suíte inteira (`npx vitest run`) verde antes de cada push.
