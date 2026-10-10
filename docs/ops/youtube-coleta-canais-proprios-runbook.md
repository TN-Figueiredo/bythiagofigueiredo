# Coleta dos canais próprios do YouTube — runbook (lotes L1a, L1b e L2)

Spec: `docs/superpowers/specs/2026-10-07-coleta-canais-proprios-design.md`. Planos: `docs/superpowers/plans/2026-10-07-coleta-l1a-plan.md`, `docs/superpowers/plans/2026-10-08-coleta-l1b-plan.md` e `docs/superpowers/plans/2026-10-09-coleta-l2-plan.md`.
Ledgers: `.superpowers/sdd/2026-10-07-coleta-l1a-plan/progress.md`, `.superpowers/sdd/2026-10-08-coleta-l1b-plan/progress.md` e `.superpowers/sdd/2026-10-09-coleta-l2-plan/progress.md`.

Em produção desde: a data da promoção entra no ledger, não aqui. O L2 depende da migration `20261009000001`; se ela ainda não foi aplicada, o cron fica vermelho com `schema_ausente` (seção 6) até o dono rodar `npm run db:push:prod`.

Tudo roda dentro do cron `sync-analytics-metrics`, uma vez por dia às 12:00 UTC (09:00 em São Paulo). Não há cron novo nem variável de ambiente nova.

**Este sistema falha em verde.** Um passo sem dado termina sem erro. Ao investigar, olhe primeiro se a linha existe, depois se houve erro.

**Regra deste arquivo:** comando de leitura em produção é `npx supabase db query --linked "<SELECT … LIMIT n>"`. Todo comando que escreve em produção ou no Google tem "(você roda)" e vai um por linha, nunca encadeado.

## 1. O que a coleta guarda

| O quê | Onde fica | Volta se perder? |
|---|---|---|
| Título, thumbnail e variante de A/B no ar em cada dia, por vídeo | `yt_own_video_meta_daily` (uma linha por vídeo por dia do Pacífico) | Não |
| Relatórios em lote da Reporting API (impressões, CTR, tráfego), CSV bruto | `yt_reporting_reports` + `yt_reporting_report_blobs.csv_gz` (bytea, gzip; não é Vercel Blob) | Em parte: ver abaixo |
| Jobs da Reporting API por canal e tipo | `yt_reporting_jobs` | Sim, mas a contagem recomeça do zero |
| O que foi tentado e o que aconteceu | `yt_own_collection_attempts` | — |
| `privacy_status` e `is_short` de cada vídeo em cada dia (L1b) | colunas de `yt_own_video_meta_daily` | Não |
| Estado de autorização de cada canal (L1b) | `youtube_channels.collection_status` (`ok` ou `reautorizar`) e `authorization_verified_at` | — |
| Cada execução do cron: tempos por passo, falhas, ação do dono, resumo (L1b) | `yt_own_collection_runs` (90 dias; só service role) | — |
| Diário real por vídeo da Analytics API (L2): `views`, `engaged_views`, `watch_time_minutes`, `avg_view_duration_seconds`, `avg_view_percentage`, `likes`, `comments`, `shares`, `subscribers_gained`, `subscribers_lost`, `card_impressions`, `card_click_rate` | `yt_own_video_daily` (uma linha por vídeo por dia do Pacífico **em que houve atividade**) | Sim: a Analytics API serve o passado. Sem linha para o vídeo, a execução seguinte pede tudo de novo desde a publicação |
| Impressões e CTR de miniatura por vídeo e dia (L2), normalizados do CSV de `channel_reach_basic_a1` | `yt_own_video_reach_daily` | Em parte: só enquanto o bruto existir. O bruto de um relatório normalizado é apagado 90 dias depois (seção 8) |

Tipos de relatório habilitados (`REPORT_TYPES_ENABLED`, a ordem é a prioridade de download): `channel_reach_basic_a1`, `channel_reach_combined_a1`, `channel_traffic_source_a3`, `channel_basic_a3`. Os dois primeiros são os "de alcance".

**O que se perde de vez e o que não.** Impressões e CTR de miniatura só existem a partir da criação do job: o Google guarda o histórico de cada job por 30 dias e os relatórios diários por 60. A linha diária de metadados de um dia em que o cron não rodou nunca é escrita (aparece como `dias_sem_meta`). Todo o resto pode ser buscado de novo depois.

Ainda **não** existe: a retenção (lote L3).

**O que o L2 grava, e o que o dado ausente quer dizer.**

- As duas tabelas novas têm a mesma chave: `(youtube_video_id, day_pt)`. `youtube_video_id` é o id de 11 caracteres do YouTube, **não** o uuid de `youtube_videos.id`. `day_pt` é o dia como veio da fonte; as duas fontes não documentam o mesmo dia, então nunca junte `yt_own_video_daily` a `yt_own_video_reach_daily` por `day_pt` sem saber disso.
- **Nulo nunca é zero.** Métrica que a API não trouxe fica nula na linha. Dia sem atividade **não tem linha**: a ausência de linha é "sem atividade ou não medido", nunca um zero gravado. Para separar os dois casos use `yt_own_collection_attempts` (seção 4): tentativa `sem_dado_na_janela` = a API respondeu e não havia nada; sem tentativa = nunca perguntado.
- **`yt_own_video_daily.views` é a contagem do DIA.** `youtube_video_analytics.views` (a parte antiga do cron) é o total da janela de 90 dias, não a contagem do dia. Não compare nem some um com o outro.
- Alcance: o relatório traz uma linha por vídeo e dia, só para vídeo com impressão. Vídeo sem impressão no dia **não aparece** e dia sem impressão vem como relatório `vazio` (só cabeçalho): nos dois casos não há linha em `yt_own_video_reach_daily`, e isso não é zero medido. `thumbnail_ctr` fica na unidade do relatório (0–1). **Cliques não são gravados**: o CSV não tem a coluna; impressões × CTR reconstroem o número.
- Só `channel_reach_basic_a1` é normalizado. `channel_reach_combined_a1`, `channel_traffic_source_a3` e `channel_basic_a3` ficam só como bruto.
- Relatório mais novo (`create_time` maior) **substitui a linha de alcance por inteiro**, inclusive levando o CTR de não nulo a nulo. Relatório mais velho que a linha gravada não sobrescreve nada; o mesmo relatório pode regravar as suas linhas (seção 8).
- Linha de alcance de vídeo que não está em `youtube_videos` é gravada com `video_id` nulo, e o id vai para `yt_reporting_reports.unmatched_video_ids` (`{ count, ids }`; nulo quando todos têm par).
- `metric_version` (nas duas tabelas) deriva de `day_pt`: `views_ate_2025-03-30` até 30/03/2025, `views_2025-03-31_a_2026-08-26` até 26/08/2026 e `views_desde_2026-08-27` depois.

`privacy_status` vem da `videos.list` com o token do canal dono: sem token, com a chamada falhando, ou para um vídeo que a resposta não trouxe, fica nulo. `is_short` fica nulo quando a duração é desconhecida ou quando um vídeo de 61 a 180 s ainda não teve a sonda de Shorts confirmada.

## 2. Orçamento e tetos

- Relógio global do pedido: 270 s (`maxDuration` = 300 s). Cada passo recebe `min(teto, o que resta do relógio)`.
- Tetos: metadados 30 s, jobs 20 s, relatórios 60 s, **alcance 20 s, diário 50 s**. Cada chamada ao Google tem no máximo 15 s; até 4 em paralelo.
- Ordem: metadados, jobs (fase "antes"), a parte antiga (analytics por janela), relatórios, **alcance**, critérios de relatórios, **diário**, critérios do L2 e demais critérios (fase "depois"). O alcance roda antes dos critérios de relatórios de propósito: um cabeçalho inesperado achado hoje já deixa o cron vermelho hoje.
- No máximo **40 downloads de relatório por execução**. Bater nesse teto é normal e **não é falha**: na primeira semana a fila inicial tem cerca de 240 relatórios de histórico, ou seja, uns 6 dias para esvaziar. `pendentes` em `coleta.relatorios` vai caindo.
- Só o **relógio** produz `nao_alcancado_orcamento`. O teto de 40 não.
- No máximo **200 relatórios normalizados por execução** (passo `alcance`, do mais velho para o mais novo). O que passa disso fica para o dia seguinte e aparece em `coleta.alcance.pendentes`.
- O diário faz **uma chamada à Analytics API por vídeo** (duas quando a API recusa as métricas estendidas) e lê no máximo 1000 vídeos por execução. Sem tempo, os vídeos que sobram viram `nao_alcancado_orcamento` e entram em `coleta.diario.pendentes`; os mais antigos de coletar vão primeiro no dia seguinte.
- O passo `alcance` **não registra tentativas** (não há `kind` para ele). Sem tempo ele devolve `sem_tempo: true` com `pendentes: 0`: o zero ali é "não olhou", não "nada pendente". O estado de cada relatório mora na própria linha de `yt_reporting_reports` (`normalized_at`, `status`, `error`), e o sinal de um normalizador parado é a nota "baixado(s) há mais de 2 dias sem normalizar" (seção 6).
- Bruto comprimido acima de 2 MB vira relatório em `erro` com `error = 'grande_demais'`.

## 3. Ler a resposta do cron

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/cron/sync-analytics-metrics
```

Rodar à mão é seguro: os passos são idempotentes no dia (a segunda execução sobrescreve e soma `attempts`; o diário regrava as mesmas linhas por upsert e o alcance só pega relatório com `normalized_at` nulo). Cada execução do diário repete as chamadas à Analytics API, uma por vídeo. O Vercel dispara sozinho às 09:00 de São Paulo.

| Campo | O que diz |
|---|---|
| `synced`, `errors`, `emptyReports`, `skipped_no_connection`, `notifications`, `fatigueAlerts`, `errorDetails` | a parte antiga (analytics por janela), como sempre |
| `sem_autorizacao` | canais pulados pela parte antiga porque perderam a autorização do YouTube (seção 5, `reautorizar`). Não é erro |
| `ms_existente` | quanto a parte antiga levou, em ms. O relógio global é de 270 s |
| `coleta.metadados` | `gravados`, `tentativas` por resultado, `pendentes`, `day_pt`, `dias_sem_meta` por canal (chave ausente = a leitura falhou, não é zero). `sem_tempo: true` = o passo recebeu 0 s. Desde o L1b: `sem_privacidade` (linhas gravadas sem `privacy_status`) e `sem_is_short` (linhas com `is_short` nulo). **`sem_privacidade` igual a `gravados` num canal com conexão viva é falha em verde: olhe a tentativa `meta` de escopo `canal`** |
| `coleta.ms` | milissegundos de cada passo (`metadados`, `jobs`, `relatorios`, `alcance`, `diario`). Os tetos são 30 000, 20 000, 60 000, 20 000 e 50 000 |
| `coleta.reautorizar` | `youtube_channels.id` dos canais em `reautorizar` |
| `coleta.autorizados`, `coleta.negados` | `youtube_channels.id` dos canais que tiveram, nesta execução, uma chamada autenticada bem-sucedida / uma negação de autorização. É com esses dois conjuntos que o cron decide, no fim, quem sai de `reautorizar` |
| `coleta.jobs` | `estados` por canal e tipo, `tipo_indisponivel`, `acao_do_dono`, `pendentes` |
| `coleta.relatorios` | `vistos`, `baixados`, `vazios`, `expirados`, `erros_download`, `bruto_apagado`, `pendentes`, `perdidos`, `atrasados` |
| `coleta.alcance` | o passo que normaliza o bruto de `channel_reach_basic_a1`: `normalizados` (relatórios com dado), `vazios` (relatórios `vazio` conferidos e marcados), `erros` (viraram `erro` nesta execução), `sem_par` (vídeos sem par em `youtube_videos`), `gravados` (linhas inseridas ou sobrescritas em `yt_own_video_reach_daily`), `pendentes` (ficam para amanhã; fila com mais de 200 soma 1 a mais, o número exato não é conhecido), `tentativas` (sempre vazio: o passo não registra tentativas). `sem_tempo: true` = o passo recebeu 0 s (e `pendentes` fica em 0: ver seção 2). Chave `alcance` ausente = o passo lançou exceção (veja `falhas`) ou está desligado (seção 10). **`normalizados` pode subir com `gravados: 0`**: o relatório era mais velho que as linhas já gravadas e a função do banco não sobrescreve |
| `coleta.diario` | o passo do diário por vídeo: `gravados` (linhas de dia gravadas em `yt_own_video_daily`), `tentativas` por resultado (conta as tentativas de vídeo **e** a de canal de `kind = 'diario'`: um canal com 35 vídeos mostra uns 36 ao todo), `pendentes` (vídeos que o relógio deixou para amanhã), `ate` (o "hoje" do Pacífico usado como fim da janela), `estendidas_recusadas` (vídeos cuja resposta veio sem as métricas estendidas) e `sem_tempo`. `gravados: 0` com `tentativas.sem_dado_na_janela` alto = a API respondeu vazio para os vídeos: sem atividade na janela, **não** zero. Chave `diario` ausente = o passo lançou exceção ou está desligado |
| `coleta.perdidos`, `coleta.atrasados` | os mesmos dois números, no nível de cima. `perdidos` = sem conserto; `atrasados` = `listado` há mais de 14 dias (esses viram falha) |
| `coleta.vazios_sem_publicacao` | nomes dos canais cujos 4 relatórios de alcance mais recentes vieram vazios e que **não publicaram nos últimos 90 dias**. É informação, **não** falha (canal sem vídeo recebe relatório só com cabeçalho todo dia). Lista vazia = ninguém nessa situação |
| `coleta.desconhecido` | nomes de canais cujo `dias_sem_meta` não pôde ser lido. Nunca é contado como zero |
| `acao_do_dono` | o que só você resolve (seção 5). **Não** deixa o cron vermelho |
| `falhas` | o que deixou o cron vermelho (seção 6). Presente só quando há falha |

A resposta não precisa mais ser guardada à mão: cada execução que chega ao veredito grava uma linha em `yt_own_collection_runs`.

```bash
npx supabase db query --linked "select ran_at, ms_total, ms_existente, ms_passos, falhas, acao_do_dono from yt_own_collection_runs order by ran_at desc limit 5"
```

Para o resumo inteiro de uma execução, troque as colunas por `resumo`. As linhas de mais de 90 dias são apagadas pelo próprio cron.

Com zero canais cadastrados a resposta traz `status: "no_channels"` e os campos de coleta mesmo assim.

O veredito é um só, no fim: `falhas` vazio grava sucesso em `cron_health`; qualquer nota grava falha, e o `/api/health` fica degradado.

## 4. Ler as tabelas

Todos os comandos são de leitura.

```bash
npx supabase db query --linked "select c.name, j.report_type_id, j.status, j.job_id is not null as tem_job, j.job_create_time, j.last_listed_at, j.error from yt_reporting_jobs j join youtube_channels c on c.id = j.channel_id order by 1, 2 limit 100"
```

```bash
npx supabase db query --linked "select c.name, r.report_type_id, r.status, count(*), min(r.create_time), max(r.create_time) from yt_reporting_reports r join youtube_channels c on c.id = r.channel_id group by 1, 2, 3 order by 1, 2, 3 limit 100"
```

Tamanho do bruto guardado (nunca faça `select *` em `yt_reporting_report_blobs`):

```bash
npx supabase db query --linked "select count(*), pg_size_pretty(coalesce(sum(octet_length(csv_gz)), 0)::bigint) as tamanho from yt_reporting_report_blobs"
```

```bash
npx supabase db query --linked "select day_pt, count(*) as linhas, count(thumbnail_dhash) as com_thumbnail, count(ab_test_id) as com_teste, count(ab_variant_id) as com_variante from yt_own_video_meta_daily group by 1 order by 1 desc limit 14"
```

```bash
npx supabase db query --linked "select attempt_day, kind, outcome, count(*), sum(attempts) as execucoes from yt_own_collection_attempts group by 1, 2, 3 order by 1 desc, 2, 3 limit 80"
```

O diário por vídeo (L2). Tudo é leitura. Cuidado com o que o resultado vazio quer dizer em cada uma:

```bash
npx supabase db query --linked "select c.name, count(*) as linhas, count(distinct d.youtube_video_id) as videos, min(d.day_pt) as primeiro_dia, max(d.day_pt) as ultimo_dia, max(d.collected_at) as ultima_coleta from yt_own_video_daily d join youtube_channels c on c.id = d.channel_id group by 1 order by 1 limit 20"
```

Canal que não aparece aqui não tem **nenhuma** linha de diário (sem atividade ou nunca coletado: veja as tentativas `diario` abaixo). Por dia, comparando `linhas` com `com_views`: `count(views)` menor que `linhas` quer dizer que há linha com `views` nulo (a API não trouxe a métrica), que é diferente de zero:

```bash
npx supabase db query --linked "select day_pt, count(*) as linhas, count(views) as com_views, sum(views) as views, count(engaged_views) as com_engaged, count(card_impressions) as com_cartoes from yt_own_video_daily group by 1 order by 1 desc limit 14"
```

Vídeos publicados sem nenhuma linha de diário (a lista de quem não teve atividade ou ainda não foi coletado; vídeo sem linha é pedido de novo desde a publicação a cada execução):

```bash
npx supabase db query --linked "select c.name, v.youtube_video_id, v.title, v.published_at from youtube_videos v join youtube_channels c on c.id = v.channel_id where v.published_at is not null and not exists (select 1 from yt_own_video_daily d where d.youtube_video_id = v.youtube_video_id) order by v.published_at desc limit 20"
```

Tentativas de vídeo do diário que **não** deram certo (`sem_dado_na_janela` e `video_novo` ficam de fora de propósito: são respostas vazias, não falhas):

```bash
npx supabase db query --linked "select attempt_day, scope_id as youtube_video_id, outcome, http_status, error, attempts from yt_own_collection_attempts where kind = 'diario' and scope_type = 'video' and outcome in ('erro_http', 'sem_autorizacao', 'nao_alcancado_orcamento', 'schema_ausente') order by attempt_day desc, last_attempt_at desc limit 20"
```

O alcance normalizado (L2). Dia sem linha aqui = vídeo sem impressão naquele dia ou relatório `vazio`; **não** é zero medido:

```bash
npx supabase db query --linked "select day_pt, count(*) as linhas, sum(thumbnail_impressions) as impressoes, count(thumbnail_ctr) as com_ctr, count(video_id) as com_video, max(report_create_time) as relatorio_mais_novo from yt_own_video_reach_daily group by 1 order by 1 desc limit 14"
```

O estado da fila de normalização (o passo `alcance` não grava tentativa; o estado mora no relatório). `normalizados` = relatórios com `normalized_at`; `baixado` com `normalizados` menor que `qtd` = fila ainda por fazer; `erro` = o motivo está em `error` (próxima consulta):

```bash
npx supabase db query --linked "select status, count(*) as qtd, count(normalized_at) as normalizados, min(create_time) as mais_velho, max(create_time) as mais_novo from yt_reporting_reports where report_type_id = 'channel_reach_basic_a1' group by 1 order by 1 limit 10"
```

```bash
npx supabase db query --linked "select r.report_id, c.name, r.create_time, r.error, r.unmatched_video_ids from yt_reporting_reports r join youtube_channels c on c.id = r.channel_id where r.report_type_id = 'channel_reach_basic_a1' and (r.status = 'erro' or r.unmatched_video_ids is not null) order by r.create_time desc limit 20"
```

```bash
npx supabase db query --linked "select last_success_at, last_failure_at, consecutive_failures, last_error from cron_health where cron_name = 'sync-analytics-metrics' limit 1"
```

Como ler `yt_own_collection_attempts`: sem linha = nunca tentado; linha com resultado diferente de `ok` = tentado e sem dado. `attempt_day` é a data **UTC** da execução; `day_pt` é o dia do **YouTube (Pacífico)**, nunca convertido. Nunca junte um ao outro.

| `outcome` | Significa |
|---|---|
| `ok` | gravou |
| `sem_dado_na_janela` | `kind = 'diario'`: a Analytics API respondeu para o vídeo e **não trouxe nenhum dia** na janela. Nada foi gravado e nada é zero: vídeo sem atividade (ou ainda não medido) |
| `video_novo` | o mesmo, para vídeo publicado há menos de 3 dias (a Analytics API costuma demorar a ter dado). Também não grava nada |
| `sem_conexao` | o canal nunca teve conexão OAuth (ou ela foi apagada sem ser revogada). Não muda o estado do canal |
| `sem_autorizacao` | o canal perdeu a autorização do YouTube e está em `reautorizar` (seção 5): a coleta por token foi pulada. No diário, uma negação no meio do canal marca `reautorizar` e os vídeos que faltavam também ficam `sem_autorizacao`, sem chamar a API |
| `erro_http` | a chamada falhou. `http_status` nulo = timeout de 15 s ou erro de banco (`error` diz qual) |
| `nao_alcancado_orcamento` | o relógio acabou antes. Três tentativas seguidas no mesmo escopo viram falha. Com `kind = 'thumbnail'`: o prazo acabou no meio da captura da thumbnail; a linha do dia **foi gravada** (título e A/B), só sem os campos de thumbnail |
| `schema_ausente` | a migration não está aplicada em produção |

`kind`: `sondagem` (passo de jobs), `meta`, `thumbnail`, `relatorio`, `diario` (L2). O outro (`retencao_vida`) é do lote L3.

`kind = 'diario'` tem dois escopos: `scope_type = 'video'` (`scope_id` = id de 11 caracteres do YouTube) e `scope_type = 'canal'` (`scope_id` = `youtube_channels.id`). A tentativa de **canal** é `ok` quando o canal foi atendido sem negação nem falta de tempo, **mesmo que alguns vídeos tenham dado `erro_http`** (isso vai para `falhas`, não para a tentativa do canal). Para saber se o diário de um vídeo entrou, olhe a tentativa do vídeo, não a do canal.

## 5. Ação do dono (não é falha crítica)

Estes estados **não** entram em `falhas` e não deixam o cron vermelho. Você os vê em dois lugares: no campo `acao_do_dono` da resposta (lista de textos como `<canal>: api_nao_ativada` ou `<canal>: <tipo> em sem_acesso`) e numa notificação do CMS para os admins do site (link para `/cms/youtube`). A notificação repete a cada 7 dias enquanto o problema durar, exceto `tipo_indisponivel`, que avisa uma vez só. Quando a chamada volta a passar, chega "A coleta do canal <nome> voltou ao normal." (só para `api_nao_ativada` e `sem_acesso`).

### `api_nao_ativada`
Texto do aviso: "A YouTube Reporting API não está ativada no projeto do Google. Impressões e CTR não estão sendo coletados."
A YouTube Reporting API é **separada** da YouTube Analytics API e precisa estar ativada no projeto do Google Cloud usado pelo OAuth do site.
1. Abra https://console.cloud.google.com/apis/library/youtubereporting.googleapis.com?project=63502769279 e clique em Ativar.
2. Não precisa reconectar o canal. A execução seguinte do cron cria os jobs e manda o aviso de volta ao normal.

### `sem_acesso`
Texto do aviso: "O YouTube recusou o acesso aos relatórios do canal <nome>. Impressões e CTR não estão sendo coletados."
O Google recusou o token na Reporting API (401, ou 403 `insufficientPermissions`). O escopo necessário é `https://www.googleapis.com/auth/yt-analytics.readonly`.
1. Em `/cms/youtube`, reconecte o canal.
2. A execução seguinte tenta de novo sozinha.

### `tipo_indisponivel`
Texto do aviso: "O YouTube não oferece o relatório de alcance para o canal <nome>."
O YouTube não oferece aquele tipo para o canal. Avisa uma vez. Não há o que fazer; o estado fica em `coleta.jobs.tipo_indisponivel`. Anote no ledger quais tipos faltam.
Quais tipos o canal recebe só a primeira execução responde; anote aqui: (preencher depois da primeira execução em produção).

### `<canal>: reautorizar`
Texto do aviso: "O canal <nome> perdeu a autorização do YouTube. A coleta parou. Reconecte o canal em Configurações."
O canal perdeu a autorização: token revogado, 401 da Analytics API ou da Data API, 403 por permissão insuficiente, ou "sem conexão" com uma conexão revogada desse canal. `youtube_channels.collection_status` vira `reautorizar`. Enquanto o token não funciona, a coleta por token fica parada para ele (sem `privacy_status`, sem jobs novos, sem relatórios, sem analytics por janela, sem diário por vídeo; o alcance só lê o banco e segue normalizando o bruto que já foi baixado). O cron continua tentando todo dia: se o token renova, as chamadas são feitas, e é assim que o canal pode voltar sozinho (item 2). O passo de metadados grava a linha do dia de qualquer jeito, com o que há em `youtube_videos`. Nada é apagado. Um 401 **da Reporting API** não entra aqui: é `sem_acesso`.
1. Reconecte o canal em `/cms/social/accounts` (botão do YouTube, escolhendo a conta dona do canal). Ao voltar do Google o canal volta a `ok` na hora e o aviso é liberado.
2. Sem reconectar, o canal só volta a `ok` no fim de uma execução do cron em que teve pelo menos uma chamada autenticada bem-sucedida (`videos.list` ou Analytics API) e **nenhuma** negação de autorização; aí chega "A coleta do canal <nome> voltou ao normal." O token voltar a renovar, sozinho, não basta: evita que o estado oscile no mesmo dia quando o refresh passa e a API nega.
3. Um canal em `reautorizar` cuja conexão foi apagada continua em `reautorizar` até ser reconectado.

```bash
npx supabase db query --linked "select name, collection_status, authorization_verified_at from youtube_channels order by 1 limit 10"
```

Você recebe um aviso na entrada e um lembrete a cada 7 dias enquanto alguma chamada continuar sendo negada. No dia em que o canal volta a `ok`, `acao_do_dono` já não traz a nota dele. Enquanto o canal está em `reautorizar`, o aviso antigo "Canal do YouTube sem conexão" não é enviado para ele.

### Canal sem conexão (nunca conectado)
Canal cadastrado que nunca teve conexão OAuth (ou cuja conexão foi apagada, não revogada): é pulado nos passos que precisam de token, com tentativa `sem_conexao`. Não muda `collection_status`.
- A parte antiga manda a notificação "Canal do YouTube sem conexão" (uma por site por dia) e `skipped_no_connection` sobe na resposta.
- Se o canal tem job de alcance ativo há mais de 6 dias e nenhum relatório novo, `acao_do_dono` ganha `<canal>: sem conexão com o YouTube` (em vez de uma falha de "sem relatório novo").
- O que fazer: conecte em `/cms/social/accounts`; a execução seguinte volta a coletar.

### `<canal>: o YouTube informa N vídeo(s) e nenhum está cadastrado`
O sync de vídeos desse canal nunca gravou nada, embora o YouTube diga que o canal tem vídeos. Não é da coleta: olhe o cron `youtube-sync` e a tabela `youtube_sync_log`. Canal vazio de verdade (0 vídeos no YouTube) não gera esta nota.

## 6. Falhas críticas (`falhas`)

Cada nota vira texto em `cron_health.last_error` (juntas, até 500 caracteres) e a resposta lista todas em `falhas`. `<canal>` é só o **nome** do canal nas notas da coleta (metadados, jobs, relatórios, critérios e avisos); só as notas da parte antiga (analytics por janela) trazem `Nome (UC…)`. `<causa>` é uma frase curta derivada do tipo do erro, nunca o texto cru do Postgres: `database error`, `request timed out`, `Google token refresh failed (HTTP nnn)`, `token revoked by Google — the channel must be reconnected`, `unexpected error (NomeDoErro)`; o detalhe completo está no Sentry (tag `cron: sync-analytics-metrics`).

### Banco (valem para qualquer passo)

| Nota | Significa | O que fazer |
|---|---|---|
| `schema_ausente: youtube_channels` | o código do L1b está no ar sem a migration `20261008000002`: o cron segue rodando (parte antiga e linha de metadados do dia), mas sem estado de autorização | `npm run db:push:prod` (você roda) |
| `schema_ausente: <tabela ou função>` | o código está no ar sem a migration `20261007000006` (L1a), `20261008000002` (L1b: `youtube_channels`, `yt_own_collection_runs`) ou `20261009000001` (L2: `yt_own_video_daily`, `yt_own_video_reach_daily`, `yt_own_reach_apply`). Com o L2 sem migration: o diário registra a tentativa `schema_ausente` por canal e para sem chamar a API, o alcance para na primeira escrita e o relatório fica na fila | `npm run db:push:prod` (você roda) |
| `registro da execução: <causa>` | a linha de `yt_own_collection_runs` não foi gravada (a execução em si rodou) | ver o Sentry; se vier com `schema_ausente`, é a migration do L1b |
| `erro de banco ao ler social_connections` | a coleta não conseguiu saber se o canal sem conexão foi revogado; o canal vira erro do passo nesse dia, sem mudar de estado | transitório; se repetir, olhe o log do Supabase |
| `metadados: <canal>: videos.list falhou (HTTP nnn \| <causa>)` | a Data API não respondeu para o canal: as linhas do dia foram gravadas, mas sem `privacy_status` | transitório; some na execução seguinte. 403 por cota: ver o painel de cotas da YouTube Data API |
| `metadados: <canal>: videos.list não devolveu nenhum dos N vídeos` | a Data API respondeu, mas sem nenhum vídeo do canal: token de outra conta, ou os vídeos cadastrados não existem mais no YouTube. As linhas do dia foram gravadas sem `privacy_status` | conferir em `/cms/social/accounts` se a conexão é a da conta dona do canal; reconectar com a conta certa |
| `metadados: <canal>: videos.list não trouxe privacy_status de nenhum dos N vídeos` | a resposta veio sem o campo de privacidade em todos os vídeos | ver o Sentry; se repetir, a API mudou e o cliente `videos-list.ts` precisa de ajuste |
| `metadados: <canal>: a captura pela videos.list não coube em 8 s` | a Data API (ou a renovação do token) demorou além do teto da captura; as linhas do dia foram gravadas, sem `privacy_status` | transitório; se repetir 3 dias, olhe `ms_passos.metadados` em `yt_own_collection_runs` |
| `canais: <causa>` | a conferência de "canal com vídeos no YouTube e nenhum cadastrado" lançou exceção | Sentry (tag `passo: canais`) |
| `metadados: privacy_status desconhecido "<valor>"` | o YouTube devolveu um valor de privacidade fora de `public`, `unlisted`, `private`; a linha foi gravada sem o campo | migration alargando o `check` de `yt_own_video_meta_daily.privacy_status` e a lista `PRIVACIDADES` em `meta-step.ts` |
| `database error listing the YouTube channels` (só em `cron_health.last_error`; a resposta é 500) | a rota não conseguiu ler `youtube_channels` nem na segunda tentativa: nenhum passo rodou, nem a linha de metadados do dia | ver o Sentry e o log do Supabase; rode o cron à mão (seção 3) assim que o banco voltar, ainda no mesmo dia |
| `critérios: não foi possível avaliar canais sem vídeos cadastrados (youtube_videos): contagem ausente` | a contagem de vídeos de um canal veio sem número | transitório; se repetir, Sentry |
| `erro de banco ao ler <onde>` / `erro de banco ao gravar <onde>` | a leitura ou a escrita foi recusada (não é tabela ausente) | ver o Sentry; costuma ser transitório. Se repetir 2 dias, olhe `cron_health` e o log do Supabase |
| `critérios: não foi possível avaliar <critério> (<tabela>)` | a leitura de um critério falhou; o cron não afirma verde sem ter olhado | resolva a nota `erro de banco …` que vem junto |
| `critérios: … leitura cortada em 1000` ou `… contagem ausente` | a leitura bateu no corte de 1000 linhas (veja "Limites conhecidos") | com poucos canais não deve acontecer; abra o Sentry |

### Metadados

| Nota | Significa | O que fazer |
|---|---|---|
| `metadados: <canal> tem X de Y vídeos com linha em <dia>` | a escrita foi recusada ou deu exceção para alguns vídeos | olhe hoje em `yt_own_collection_attempts` com `kind = 'meta'` e `outcome <> 'ok'`; rodar o cron de novo no mesmo dia completa |
| `metadados: <canal> ficou N dia(s) sem linha antes de <dia>` | o cron não rodou ou não gravou por N dias. **Esse dado não volta** | anote os dias perdidos no ledger |
| `metadados: <canal>: <causa>` | exceção ao gravar um vídeo | Sentry (extra `video`) |
| `metadados: thumbnail falhou em metade ou mais dos vídeos de <canal> por 2 dias` | `i.ytimg.com` ou o Vercel Blob fora do ar | conferir `BLOB_READ_WRITE_TOKEN`; ver `error` das tentativas `kind = 'thumbnail'` |
| `metadados: N vídeos lidos — a leitura pode estar truncada em 1000` | o passo leu 1000 vídeos ou mais e pode ter deixado vídeos de fora | com poucos vídeos não acontece; abra o Sentry (veja "Limites conhecidos") |
| `metadados: testes de A/B lidos até o limite de 1000 — a leitura pode estar truncada` | mesmo corte na leitura de `ab_tests`; nenhum vídeo ganha variante calculada com dado parcial, as colunas de A/B ficam nulas no dia | idem |
| `metadados: ciclos de A/B lidos até o limite de 1000 — a leitura pode estar truncada` | mesmo corte nos ciclos de teste A/B; as colunas de A/B ficam nulas no dia | idem |

### Jobs (passo 1A)

| Nota | Significa | O que fazer |
|---|---|---|
| `jobs: <canal>: <causa>` | exceção ao sondar ou criar jobs de um canal | Sentry (extra `canal`, `tipo`) |
| `jobs: <canal> está com o job <tipo> em erro há 3 dias` | erro persistente na Reporting API | ver `error` em `yt_reporting_jobs`; se foi `job_removido`, a execução seguinte recria sozinha |
| `jobs: <canal> não consegue baixar o relatório <tipo> há 3 dias (último erro: …)` | o job está ativo mas o download falha todo dia | ver as tentativas `kind = 'relatorio'` do escopo `job` |

### Relatórios (passo 1C e critérios)

| Nota | Significa | O que fazer |
|---|---|---|
| `relatórios: <canal> tem relatório de alcance <tipo> em erro` | relatório de alcance de até 14 dias em `erro`. Do passo de relatórios: `url_inesperada`, `gzip_invalido` ou `grande_demais` (não tem conserto: a nota sai sozinha em 14 dias e passa a contar em `perdidos`). Do passo `alcance` (L2): `cabecalho_inesperado` (o Google mudou as colunas do CSV), `linha_invalida` (uma linha que não se lê, **CTR fora de 0–1** ou data que não existe no calendário), `canal_inesperado` (o CSV traz `channel_id` de outro canal), `bruto_ausente` (relatório `baixado` sem bruto) e `gzip_invalido` | ver `error` em `yt_reporting_reports` (seção 4). O bruto fica guardado. `cabecalho_inesperado` e `linha_invalida`: corrija o leitor (`reach-csv.ts`) e a seção 8 devolve o relatório à fila. `canal_inesperado`: confira `youtube_channels.channel_id` do canal antes de devolver à fila. `bruto_ausente` e `gzip_invalido` do `alcance`: sem bruto legível não há o que normalizar. Em todos esses casos nenhuma linha de alcance do relatório foi gravada |
| `relatórios: <canal> recebeu 4 relatórios <tipo> vazios seguidos` | alcance vindo sem linhas 4 vezes seguidas, **em canal que publicou nos últimos 90 dias**. Canal sem publicação nesse prazo não gera esta nota: aparece em `coleta.vazios_sem_publicacao` (o spec, seção 9, não trazia esse filtro; a divergência é deliberada) | conferir no Studio se o canal teve visualizações |
| `critérios: não foi possível avaliar vídeos recentes do canal <canal> (youtube_videos)` | a contagem de publicações dos últimos 90 dias falhou; sem ela o cron não decide se "vazios seguidos" ou "sem relatório novo" é falha | resolva a nota `erro de banco ao ler youtube_videos` que vem junto |
| `relatórios: <canal> tem relatório <tipo> expirado sem baixar` | passou do prazo (60 dias; 30 se for histórico) ou o download devolveu 404/410 | nada; sai em 14 dias e vira `perdidos` |
| `relatórios: N relatório(s) listado(s) há mais de 14 dias sem baixar` | downloads falhando ou a fila não anda | ver tentativas `relatorio` com `erro_http` |
| `relatórios: <canal> está sem relatório novo de <tipo> há mais de 6 dias` | job de alcance ativo, canal que publicou nos últimos 90 dias, sem relatório novo | ver `yt_reporting_jobs`; se preciso, recriar o job (seção 9) |
| `relatórios: listagem truncada em 50 páginas (<canal>: <tipo>)` | `reports.list` devolveu mais de 50 páginas; a marca do job não avança, a listagem recomeça no dia seguinte | nada, a menos que repita por muitos dias |
| `relatórios: <canal>: <causa>` | exceção ao listar os relatórios de um canal | Sentry |
| `relatórios: <causa>` | exceção ao baixar um relatório (extra `report`) | Sentry |

### Alcance normalizado (L2)

| Nota | Significa | O que fazer |
|---|---|---|
| `alcance: <canal> recebeu relatório com dado nos últimos 4 dias e não tem linha nova de alcance` | job básico de alcance ativo há 6 dias ou mais, canal que publicou nos últimos 90 dias, relatório `baixado` (com dado) nos últimos 4 dias e nenhuma linha de `yt_own_video_reach_daily` com `collected_at` nesses 4 dias. **Só acusa quando chegou dado**: relatório `vazio` (dia sem impressão) ou canal fora do filtro de 90 dias não geram a nota, e isso é correto (sem relatório com dado, o silêncio é legítimo) | ver os relatórios do canal (seção 4) e `error`/`normalized_at`; um relatório mais velho que as linhas já gravadas não sobrescreve nada e pode causar esta nota em falso: confira com `report_create_time` em `yt_own_video_reach_daily` |
| `alcance: N relatório(s) baixado(s) há mais de 2 dias sem normalizar` | relatório `baixado` ou `vazio` de `channel_reach_basic_a1`, baixado há mais de 2 dias, ainda sem `normalized_at`: o normalizador está parado ou atrasado (é a falha em verde do passo `alcance`). Relatório em `erro` não conta aqui (a nota de relatório em erro cuida) | ver `coleta.alcance` (`pendentes`, `sem_tempo`) e `falhas`; se for fila grande (mais de 200), cai sozinha nos dias seguintes |
| `alcance: vídeos do canal <canal> lidos até o limite de 1000 — a leitura pode estar truncada` | o canal tem 1000 vídeos ou mais em `youtube_videos`; o mapa de ids ficou parcial e os relatórios do canal esperam, sem normalizar | com 35 vídeos não acontece; abra o Sentry (veja "Limites conhecidos") |
| `critérios: não foi possível avaliar alcance de <canal> (<tabela>)` (e `… idade do job ausente`, `… contagem ausente`) | a leitura de um critério do alcance falhou; o cron não afirma verde sem ter olhado | resolva a nota `erro de banco ao ler …` que vem junto |
| `critérios: não foi possível avaliar relatórios sem normalizar (yt_reporting_reports)` | o critério de "sem normalizar" não conseguiu contar | idem |
| `alcance: <causa>` | exceção não prevista ao normalizar um relatório (extra `report`) | Sentry (tag `passo: alcance`) |

### Diário por vídeo (L2)

| Nota | Significa | O que fazer |
|---|---|---|
| `diário: <canal> não tem nenhum vídeo com diário ok nas 3 últimas execuções` | canal com 5 vídeos publicados ou mais, 3 dias de execução do passo (tentativa de canal `ok`) e nenhuma tentativa de vídeo `ok` nesses dias. Tentativa `sem_dado_na_janela` e `video_novo` **não** contam como `ok`. Menos de 3 dias de execução: ainda cedo, sem nota | olhe as tentativas de vídeo `diario` (seção 4): tudo `sem_dado_na_janela` pode ser legítimo (nenhum vídeo teve atividade); confira no Studio. `erro_http` ou `sem_autorizacao` têm nota própria |
| `diário: <canal>: N de M vídeos com erro (<causa>)` | a Analytics API falhou para N vídeos do canal (`<causa>` é a do primeiro: `HTTP 403 quotaExceeded`, `HTTP 5xx`, `erro de banco`, `request timed out`…). Os outros vídeos foram gravados normalmente | transitório; some na execução seguinte. 403 por cota: painel de cotas da YouTube Analytics API. O que não entrou volta sozinho: a janela seguinte começa no último dia gravado |
| `diário: <canal>: a Analytics API recusou as métricas estendidas` | a API deu 400 para `engagedViews`, `cardImpressions` ou `cardClickRate`; o passo repetiu só com as nove métricas de base e gravou isso (as três estendidas ficam nulas, **não** zero). Vermelho até um commit tirar a métrica recusada | Sentry (mensagem `diário: a Analytics API recusou as métricas estendidas`); defeito de contrato com a API, precisa de commit em `analytics-diario.ts` |
| `diário: <canal>: <causa>` | exceção ao obter o token do canal (renovação, banco) | Sentry (tag `passo: diario`, extra `canal`) |
| `diário: 1000 vídeos lidos — a leitura pode estar truncada em 1000` | a leitura dos vídeos do diário (todos os canais juntos) bateu em 1000 | com 35 vídeos não acontece; Sentry |
| `erro de banco ao ler yt_own_video_daily` / `erro de banco ao gravar yt_own_video_daily` | a leitura do último dia gravado, ou o upsert das linhas, foi recusado. O diário grava em trechos contíguos por dia e **para na primeira falha**: o que ficou gravado é sempre um prefixo, e a janela seguinte cobre o resto | ver o Sentry; transitório. Se repetir 2 dias, log do Supabase |
| `diario: <causa>` (sem acento) | exceção não prevista no passo inteiro | Sentry (tag `passo: diario`) |
| `critérios do L2: <causa>` | exceção não prevista dentro dos critérios do alcance e do diário | Sentry (tag `passo: critérios do L2`) |

### Orçamento

| Nota | Significa | O que fazer |
|---|---|---|
| `orçamento: N escopo(s) de <kind> sem alcançar nas 3 últimas tentativas` | por três tentativas seguidas o relógio acabou antes de o escopo ser atendido (`kind` é `meta`, `thumbnail`, `sondagem`, `relatorio` ou `diario`) | ver `ms_existente`; se a parte antiga cresceu, o orçamento está apertado (seção 10) |

### Avisos ao dono

| Nota | Significa | O que fazer |
|---|---|---|
| `aviso <motivo> (<canal>): sem_destinatario` | o aviso não tem para quem ir; `motivo` é `api_nao_ativada`, `sem_acesso`, `tipo_indisponivel`, `reautorizar` ou `saida` | cadastrar o dono como `org_admin` da organização do site |
| `aviso <motivo> (<canal>): falha no envio` | o carimbo ou a entrega do aviso lançou exceção | Sentry (tag `aviso`); a execução seguinte tenta de novo |

### Parte antiga e envelope

| Nota | Significa | O que fazer |
|---|---|---|
| `<Nome (UC…)>: <causa>` ou `YouTube API nnn …` | a chamada do analytics por janela de um canal falhou | Sentry; `errorDetails` repete a nota |
| `all N channel(s) returned an empty analytics report for the <N>-day window` (N = `YT_ANALYTICS_SYNC_WINDOW_DAYS`, padrão 90) | todos os canais voltaram vazios, sem erro HTTP | suspeitar de perda de escopo OAuth ou mudança na API |
| `aviso de vídeo em alta: <causa>` / `aviso de canal sem conexão: <causa>` | o aviso da parte antiga não saiu | Sentry |
| `fadiga: <causa>` | exceção no bloco de fadiga. Veja "Limites conhecidos": há um bug dormente aqui | Sentry |
| `parte existente: <causa>` | exceção não prevista na parte antiga | Sentry (fase `existente`) |
| `coleta (antes\|depois): <causa>` / `coleta: <causa>` | exceção não prevista na coleta inteira | Sentry (tag `passo: coleta`) |
| `metadados: <causa>` / `jobs: <causa>` / `relatorios: <causa>` / `alcance: <causa>` / `diario: <causa>` / `orçamento: <causa>` | exceção não prevista dentro de um passo ou critério (o prefixo é o nome do passo, escrito `relatorios` e `diario` sem acento e `orçamento` com) | Sentry (tag `passo`) |

## 7. Exportar um CSV do bruto para fixture

O L2 foi escrito contra CSVs **reais** em `apps/web/test/fixtures/yt-reporting/` (lidos de produção em 09/10/2026: `channel_reach_basic_a1.csv`, `channel_reach_basic_a1-2026-09-30.csv` e `channel_reach_basic_a1-vazio.csv`). Este procedimento serve para refazer a fixture se o Google mudar o formato (a nota `cabecalho_inesperado`, seção 6). O bruto está em `yt_reporting_report_blobs.csv_gz`; a leitura de bytea por `db query` sai em hexadecimal e um `python3` desfaz o hex e o gzip.

1. Escolha um relatório baixado (leitura):

```bash
npx supabase db query --linked "select report_id, report_type_id, row_count, bytes, start_time from yt_reporting_reports where status = 'baixado' and report_type_id in ('channel_reach_basic_a1', 'channel_reach_combined_a1') order by row_count desc limit 10"
```

2. Crie a pasta (você roda):

```bash
mkdir -p apps/web/test/fixtures/yt-reporting
```

3. Exporte, trocando `<REPORT_ID>` e `<TIPO>` (você roda; escreve só o arquivo local):

```bash
npx supabase db query --linked "select encode(csv_gz, 'hex') as h from yt_reporting_report_blobs where report_id = '<REPORT_ID>' limit 1" 2>/dev/null | python3 -I -c "import sys,json,gzip;s=sys.stdin.read();j=json.loads(s[s.index('{'):s.rindex('}')+1]);sys.stdout.buffer.write(gzip.decompress(bytes.fromhex(j['rows'][0]['h'])))" > apps/web/test/fixtures/yt-reporting/<TIPO>.csv
```

```bash
head -3 apps/web/test/fixtures/yt-reporting/<TIPO>.csv
```

Verificação honesta: a parte do `python3` foi testada de ponta a ponta com um hex gerado na hora (gzip de um CSV pequeno), passando por `supabase db query --linked` com um `select '<hex>'::text`, e devolveu o CSV certo. O mesmo procedimento, sobre `yt_reporting_report_blobs` de verdade, gerou as três fixtures de 09/10/2026 (leitura em produção, escrita só do arquivo local). Se `rows[0]` vier vazio, o `report_id` está errado ou o bruto já foi apagado (90 dias depois de normalizado).

Confira o cabeçalho e a unidade do CTR (0–1 ou 0–100). O que foi lido em produção em 09/10/2026:

- `channel_reach_basic_a1`: colunas = `date,channel_id,video_id,video_thumbnail_impressions,video_thumbnail_impressions_ctr` · `date` em `AAAAMMDD` · unidade do CTR = **0–1** (3 impressões com 1 clique saem como `0.33333333333333331`) · uma linha por vídeo e dia, **sem coluna de cliques**. Vídeo sem impressão no dia não aparece; dia sem impressão vem só com o cabeçalho (`status = 'vazio'`). Das 40 que estavam baixadas, 11 tinham dado e 29 eram `vazio`.
- `channel_reach_combined_a1`: colunas = (não lidas: o L2 não normaliza este tipo; preencher se um dia houver normalizador)

Se a unidade do CTR mudar para percentual (valor acima de 1), o relatório vira `erro` por `linha_invalida` em vez de gravar 33.3 como se fosse 0–1.

O CSV traz ids de vídeo e números do próprio canal; não traz dado pessoal. Pode ser commitado.

## 8. Re-normalizar um relatório

Só vale para `channel_reach_basic_a1` (os outros tipos não têm normalizador). O passo `alcance` pega todo relatório `baixado` ou `vazio` com `normalized_at` nulo, do mais velho para o mais novo, 200 por execução. Re-normalizar é devolver o relatório a essa fila. **Você roda** os `update` (escrevem em produção), um por vez, no SQL Editor do Supabase.

**Antes: confira que o bruto ainda existe** (leitura). O bruto de um relatório normalizado é apagado 90 dias depois; sem ele o relatório volta a `erro` com `bruto_ausente` e o cron fica vermelho:

```bash
npx supabase db query --linked "select r.report_id, r.status, r.row_count, r.normalized_at, r.error, b.report_id is not null as tem_bruto from yt_reporting_reports r left join yt_reporting_report_blobs b using (report_id) where r.report_id = '<REPORT_ID>' limit 1"
```

**Refazer um relatório já normalizado** (por exemplo, depois de corrigir o leitor). O mesmo relatório pode regravar as suas próprias linhas; ele **não** sobrescreve linha que veio de um relatório mais novo (você pode ver `gravados: 0` no resumo):

```sql
update yt_reporting_reports set normalized_at = null where report_id = '<REPORT_ID>';
```

**Devolver à fila um relatório em `erro`** por `cabecalho_inesperado`, `linha_invalida` ou `canal_inesperado`. Só depois de o código estar corrigido e no ar; senão o cron o marca `erro` de novo na execução seguinte:

```sql
update yt_reporting_reports set status = 'baixado', error = null where report_id = '<REPORT_ID>';
```

Se a consulta acima mostrou `row_count = 0` (o relatório era só cabeçalho), devolva-o como `vazio`, não como `baixado`: o critério de "chegou dado e nenhuma linha entrou" (seção 6) conta por `status = 'baixado'`.

```sql
update yt_reporting_reports set status = 'vazio', error = null where report_id = '<REPORT_ID>';
```

Depois, rode o cron (seção 3) ou espere as 09:00. Confira com a consulta de fila da seção 4 (`normalizados` sobe, o `erro` some) e com `coleta.alcance` (`normalizados` ou `vazios` maior que 0).

Cuidados:
- Um relatório devolvido à fila que já tinha sido baixado há mais de 2 dias fica "baixado há mais de 2 dias sem normalizar" até ser refeito. O passo `alcance` roda antes desse critério na mesma execução, então um ou dois relatórios saem verdes no mesmo dia. Devolver **muitos** de uma vez passa do teto de 200 por execução e deixa o cron vermelho até a fila esvaziar: devolva poucos por dia.
- O estado `erro` por `bruto_ausente`, `gzip_invalido`, `url_inesperada` ou `grande_demais` não se resolve com estes `update`: não há bruto legível.
- Relatório `vazio` também é conferido: devolvê-lo à fila só confere o cabeçalho de novo e remarca `normalized_at`, sem gravar linha.

## 9. Recriar um job

**O que o passo faz sozinho.** Quando `reports.list` devolve 404 (o job não existe mais do lado do Google), a linha vira `erro` (`job_removido`). Na execução seguinte o passo de jobs lista os jobs do canal (`jobs.list`): se **não** encontra um job daquele tipo, chama `jobs.create`; se encontra, **adota** o que existe, com o mesmo `job_id`.

**Pôr a linha em `erro` à mão não recria nada.** Com o job ainda vivo no Google, a execução seguinte o encontra em `jobs.list` e o adota de novo, com o mesmo `job_id`: a linha volta a `ativo` e nada mudou. `jobs.create` só roda quando o job já não existe do lado do Google.

Para recriar de verdade é preciso **apagar o job no Google primeiro**. Só o dono; escreve no Google.

**Antes de apagar:** apagar um job descarta o histórico que o Google guarda para ele. Os relatórios ainda não baixados desse job deixam de poder ser baixados, e o job novo só tem dados a partir da criação (mais os 30 dias de histórico que o Google gera). Confira antes quantos estão por baixar (leitura):

```bash
npx supabase db query --linked "select status, count(*) from yt_reporting_reports where channel_id = '<UUID_DO_CANAL>' and report_type_id = '<TIPO>' group by 1 limit 10"
```

1. Pegue o `job_id` (leitura):

```bash
npx supabase db query --linked "select job_id, status, job_create_time from yt_reporting_jobs where channel_id = '<UUID_DO_CANAL>' and report_type_id = '<TIPO>' limit 1"
```

2. Apague o job no Google (`jobs.delete`), com um access token do canal (OAuth Playground, escopo `yt-analytics.readonly`) (você roda):

```bash
curl -X DELETE -H "Authorization: Bearer $ACCESS_TOKEN" "https://youtubereporting.googleapis.com/v1/jobs/<JOB_ID>"
```

3. Não precisa mexer no banco. Na execução seguinte do cron `reports.list` devolve 404 e a linha vira `erro` (`job_removido`); na execução depois dessa o passo de jobs cria o job novo. Para ganhar um dia, marque a linha você mesmo no SQL Editor do Supabase (você roda) — agora sim tem efeito, porque o job não existe mais no Google:

```sql
update yt_reporting_jobs set status = 'erro', error = 'recriar (manual)' where channel_id = '<UUID_DO_CANAL>' and report_type_id = '<TIPO>';
```

Um job novo começa a contar do zero: impressões e CTR anteriores à criação só existem nos 30 dias de histórico que o Google gera.

## 10. Desligar um passo ou um tipo

Não há variável de ambiente. É um commit de uma linha, seguido de deploy:

- **Um passo:** `apps/web/src/lib/youtube/coleta/index.ts`, constante `PASSOS_LIGADOS` (`metadados`, `jobs`, `relatorios`, `alcance`, `diario`) para `false`.
  - `alcance` desligado: os relatórios continuam sendo baixados e ficam sem `normalized_at`. Se o `diario` estiver ligado, os critérios do L2 seguem rodando: em 2 dias chega a nota "baixado(s) há mais de 2 dias sem normalizar" e o cron fica vermelho (de propósito). O bruto de um relatório não normalizado **não** é apagado pela limpeza dos 90 dias. Religar normaliza a fila, 200 por execução.
  - `diario` desligado: **não deixa o cron vermelho**. As tentativas `diario` param, e em até 14 dias (quando as últimas tentativas `ok` saem da janela do critério) ele passa a dizer "ainda cedo". O dado simplesmente para de entrar (falha em verde): anote a data no ledger. Religar pede de novo, a partir do último dia gravado de cada vídeo.
  - Os dois (`alcance` e `diario`) desligados: os critérios do L2 deixam de rodar por inteiro.
- **Um tipo de relatório:** `apps/web/src/lib/youtube/reporting/types.ts`, tirar a linha de `REPORT_TYPES_ENABLED`. A partir do deploy, na execução seguinte:
  - o passo de relatórios **não lista nem baixa** mais esse tipo (ele só olha jobs `ativo` de tipos da lista);
  - o passo de jobs marca a linha desse tipo em `yt_reporting_jobs` como `desativado`, qualquer que fosse o estado dela (`ativo`, `erro`, `api_nao_ativada`…). Isso é feito só no banco, **sem token e sem chamada ao Google**, então vale também para canal sem conexão;
  - o job **continua existindo do lado do Google** e gerando relatórios lá; para parar isso também, apague-o (`jobs.delete`, seção 9);
  - os relatórios desse tipo que já estavam `listado` ficam como estão: não são baixados, não contam em `pendentes` nem em `atrasados`, e não geram nota de "listado há mais de 14 dias" nem de "expirado sem baixar". Passado o prazo (60 dias; 30 se histórico) viram `expirado_sem_baixar` e contam em `perdidos`. O que já foi baixado continua guardado;
  - religar o tipo (repor a linha na lista) faz a sondagem seguinte adotar o job que ficou no Google, com o mesmo `job_id`, e os `listado` que ainda não expiraram voltam para a fila.
- **Habilitar um tipo:** acrescentar a linha em `REPORT_TYPES_ENABLED`. A posição na lista é a prioridade de download.
- **Orçamento apertado:** os tetos estão em `apps/web/src/lib/youtube/coleta/clock.ts` (`TETOS_MS`, `RELOGIO_GLOBAL_MS`). Mexer neles exige refazer a conta com `maxDuration` da rota.

Desligar `metadados` custa caro: cada dia sem linha não volta.

## 11. Apagar a série de um canal

Passo manual, só do dono, sem volta. Antes, exporte (seção 12, passo 1; as duas tabelas do L2 estão no passo 1 do "Rollback do L2"). No SQL Editor do Supabase (você roda), um por vez. Os dois primeiros são as tabelas do L2; entre elas e as demais não há dependência de chave estrangeira (as duas têm `channel_id` com `on delete restrict` e `video_id` com `on delete set null`). A única ordem que importa é o bruto antes do relatório (o bruto também sai por cascata, o `delete` explícito só deixa isso à vista):

```sql
delete from yt_own_video_daily where channel_id = '<UUID_DO_CANAL>';
```

```sql
delete from yt_own_video_reach_daily where channel_id = '<UUID_DO_CANAL>';
```

```sql
delete from yt_reporting_report_blobs where report_id in (select report_id from yt_reporting_reports where channel_id = '<UUID_DO_CANAL>');
```

```sql
delete from yt_reporting_reports where channel_id = '<UUID_DO_CANAL>';
```

```sql
delete from yt_reporting_jobs where channel_id = '<UUID_DO_CANAL>';
```

```sql
delete from yt_own_video_meta_daily where channel_id = '<UUID_DO_CANAL>';
```

```sql
delete from yt_own_collection_attempts where channel_id = '<UUID_DO_CANAL>';
```

Desde o L1b o `channel_id` destas tabelas é chave estrangeira (`on delete restrict`). Remover o canal pela tela responde "Este canal tem série coletada. Apagar a série é um passo manual, descrito no runbook." enquanto houver qualquer linha aqui, **inclusive tentativas, jobs e, desde o L2, o diário e o alcance** — na prática, todo canal que passou por uma execução do cron. Para remover um canal: exporte (seção 12, passo 1), rode os sete `delete` acima e remova pela tela em seguida. Se o cron das 09:00 rodar no meio, ele recria tentativas e jobs e a tela volta a recusar.

## 12. Rollback do L1a

Na ordem; cada comando é seu (você roda), um por linha.

1. **Exportar o que não volta** (`yt_own_video_meta_daily` e `yt_reporting_report_blobs`; o resto se reconstrói). Com a connection string de produção (Supabase Dashboard, Project Settings, Database):

```bash
psql "$PROD_DB_URL" -c "\copy (select * from yt_own_video_meta_daily) to 'yt_own_video_meta_daily.csv' csv header"
```

```bash
psql "$PROD_DB_URL" -c "\copy (select r.*, encode(b.csv_gz, 'base64') as csv_gz_b64 from yt_reporting_reports r left join yt_reporting_report_blobs b using (report_id)) to 'yt_reporting_reports.csv' csv header"
```

```bash
psql "$PROD_DB_URL" -c "\copy (select * from yt_reporting_jobs) to 'yt_reporting_jobs.csv' csv header"
```

2. **Apagar os jobs do lado do Google** (`jobs.delete`), um por job de `yt_reporting_jobs.csv`, com um access token do canal (OAuth Playground, escopo `yt-analytics.readonly`):

```bash
curl -X DELETE -H "Authorization: Bearer $ACCESS_TOKEN" "https://youtubereporting.googleapis.com/v1/jobs/<JOB_ID>"
```

3. **Reverter o código:** `git revert` dos commits de código do L1a (lista no ledger), do mais novo para o mais velho; push; promoção.

4. **Apagar as tabelas:** crie a migration com o comando abaixo, cole o SQL no arquivo gerado e aplique.

```bash
npm run db:new coleta_canais_proprios_l1a_rollback
```

```sql
drop function if exists public.yt_reporting_blobs_purge(text[]);
drop function if exists public.yt_own_attempt_record(uuid, text, text, text, text, integer, text, uuid);
drop table if exists public.yt_reporting_report_blobs;
drop table if exists public.yt_reporting_reports;
drop table if exists public.yt_reporting_jobs;
drop table if exists public.yt_own_video_meta_daily;
drop table if exists public.yt_own_collection_attempts;
```

```bash
npm run db:push:prod
```

A ordem 3 antes de 4 importa só para não ficar vermelho: se a tabela sumir com o código no ar, o cron registra `schema_ausente` e a parte antiga continua funcionando.

### Se a migration do L1b abortar por série órfã

A migration `20261008000002` para com "há série de canal que não existe mais" quando um canal foi removido pela tela enquanto o `channel_id` ainda não era chave estrangeira. Nada é apagado. Para achar os canais:

```bash
npx supabase db query --linked "select 'jobs' as onde, channel_id, count(*) from yt_reporting_jobs j where not exists (select 1 from youtube_channels c where c.id = j.channel_id) group by 2 union all select 'relatorios', channel_id, count(*) from yt_reporting_reports r where not exists (select 1 from youtube_channels c where c.id = r.channel_id) group by 2 union all select 'metadados', channel_id, count(*) from yt_own_video_meta_daily m where not exists (select 1 from youtube_channels c where c.id = m.channel_id) group by 2 limit 50"
```

Exporte (passo 1 acima), rode os `delete` da seção 11 para cada `channel_id` listado e aplique a migration de novo.

### Rollback do L1b

Só o L1b, mantendo o L1a. Na ordem:

1. **Reverter o código:** `git revert` dos commits de código do L1b (lista no ledger do L1b), do mais novo para o mais velho; push; promoção. Com o código do L1a de volta, as colunas e a tabela novas ficam sem uso e não atrapalham.
2. **Só se precisar desfazer o banco:** crie a migration com `npm run db:new coleta_l1b_rollback` e, nessa ordem dentro do arquivo: (a) recrie `youtube_channel_removal_impact` e `youtube_channel_remove` com o corpo de `supabase/migrations/20261003000007_youtube_channel_remove.sql` (copie de lá, com os `revoke`/`grant`); (b) remova as quatro constraints `yt_reporting_jobs_channel_id_fkey`, `yt_reporting_reports_channel_id_fkey`, `yt_own_video_meta_daily_channel_id_fkey` e `yt_own_collection_attempts_channel_id_fkey` com `alter table … drop constraint if exists`; (c) `drop table if exists public.yt_own_collection_runs`; (d) `alter table public.youtube_channels drop column if exists collection_status, drop column if exists authorization_verified_at`. Aplique com `npm run db:push:prod` (você roda).

### Rollback do L2

Só o L2, mantendo o L1a e o L1b. Na ordem; cada comando é seu (você roda), um por linha.

1. **Exportar o que pode não voltar** (o diário volta pela Analytics API; o alcance só volta enquanto o bruto existir). Com a connection string de produção:

```bash
psql "$PROD_DB_URL" -c "\copy (select * from yt_own_video_daily) to 'yt_own_video_daily.csv' csv header"
```

```bash
psql "$PROD_DB_URL" -c "\copy (select * from yt_own_video_reach_daily) to 'yt_own_video_reach_daily.csv' csv header"
```

2. **Reverter o código:** `git revert` dos commits de código do L2 (lista no ledger do L2), do mais novo para o mais velho; push; promoção. **Mantenha o arquivo da migration `20261009000001` no repositório** se ela já foi aplicada em produção: sem o arquivo local, o `db:push:prod` estranha uma migration remota que não existe no diretório. Com o código do L1b de volta, as tabelas e a função novas ficam sem uso e não atrapalham. A função de impacto de remoção mora no banco, não no código: ela continua contando as duas tabelas como série até a recriação do passo 3, então remover um canal com linhas nelas ainda pede os sete `delete` da seção 11.
3. **Só se precisar desfazer o banco:** crie a migration com `npm run db:new coleta_l2_rollback` e, nessa ordem dentro do arquivo: (a) recrie `youtube_channel_removal_impact` com o corpo de `supabase/migrations/20261008000002_*.sql` (copie de lá, com os `revoke`/`grant`; `youtube_channel_remove` não muda); (b) `drop function if exists public.yt_own_reach_apply(jsonb)`; (c) `drop table if exists public.yt_own_video_reach_daily` e `drop table if exists public.yt_own_video_daily`. Aplique com `npm run db:push:prod` (você roda). Depois disso os relatórios já normalizados continuam com `normalized_at` preenchido: para normalizar de novo no futuro, a seção 8.

A ordem 2 antes de 3 importa só para não ficar vermelho: se a tabela sumir com o código do L2 no ar, o cron registra `schema_ausente` (seção 6).

## 13. Limites conhecidos

- **Morte da função pela plataforma não deixa rastro.** Se o Vercel mata a função (passou de 300 s, falta de memória), nenhum registro de saúde é escrito e o cron só é notado cerca de 12 horas depois, pela checagem de "atrasado". O relógio de 270 s existe para isso não acontecer.
- **Os critérios supõem poucos canais.** Cada leitura de critério é cortada em 1000 linhas. Acima de uns 25 canais, uma das leituras pode bater no corte e a nota vira `… leitura cortada em 1000` (falha, não verde).
- **Gzip corrompido é definitivo.** Um relatório cujo gzip não abre vira `erro` (`gzip_invalido`) e nunca é baixado de novo.
- **Bug dormente na fadiga.** `youtube_fatigue_alerts.expected_ctr` e `actual_ctr` são `numeric(6,4)` e a rota grava contagens de visualizações neles. No dia em que um vídeo "fadigar" o insert vai falhar e este cron fica vermelho (`erro de banco ao gravar youtube_fatigue_alerts`), até uma migration corrigir as colunas. Não é do L1a, mas aparece nele.
- **O critério de thumbnail só sabe quem é privado hoje.** Vídeo privado, ou ausente da `videos.list`, sai da conta de "metade ou mais" do dia; as tentativas de ontem entram todas, porque ontem não se guardou quem era privado.
- **`is_short` de vídeo de 61 a 180 s depende de uma sonda** a `youtube.com/shorts/<id>`, feita depois de todas as linhas do dia gravadas. Sem confirmação fica nulo e o vídeo é sondado de novo no dia seguinte; uma vez confirmado, não é sondado mais.
- **`authorization_verified_at` é carimbado duas vezes por dia** (passo de metadados e parte antiga), não a cada chamada. Os passos da Reporting API não o carimbam.
- **Remover um canal exige apagar a série à mão** (seção 11, sete `delete`).
- **`maxResults` não é enviado à Analytics API.** A documentação do Google não dá padrão nem teto. Se houver um corte silencioso no primeiro carregamento de um vídeo antigo, a janela seguinte (que começa no último dia gravado) continua dali se o corte cair nos dias mais novos; confira o primeiro dia gravado de um vídeo antigo (`min(day_pt)` na seção 4) contra a data de publicação.
- **A janela do diário reabre os últimos 10 dias** a cada execução (começa no mais antigo entre 10 dias atrás e o último dia gravado), e o fim é o "hoje" do Pacífico. O valor de um dia recente é regravado por upsert enquanto estiver nessa janela. Vídeo sem nenhuma atividade desde a publicação é pedido todo dia desde a publicação (é uma chamada de qualquer jeito).
- **Cliques não são gravados** (o CSV não tem a coluna); `impressões × CTR` reconstrói o número.
- **`metric_version` do alcance usa os mesmos cortes do diário** (31/03/2025 e 27/08/2026), derivados de `day_pt`. O Google diz que a Analytics API só passou a refletir a mudança de Shorts em 30/04/2025; o canal não tem Shorts (0 vídeos em 09/10/2026), então o rótulo de 31/03 a 29/04/2025 pode estar impreciso para um canal que tenha. Corrige-se com um `update` da coluna.
- **O dia do alcance está deslocado 1 hora do que o código supõe enquanto durar o horário de verão.** Os relatórios da Reporting API têm `start_time` às 07:00 UTC (meia-noite do Pacífico com horário de verão), e `boundsReporting` e as colunas `seconds_*_reporting` de `yt_own_video_meta_daily` supõem 08:00 UTC. Não há dado errado gravado (nenhum dia teve teste A/B). O `day_pt` do alcance vem direto do CSV e não é afetado. Medir relatórios posteriores a 01/11/2026 antes de corrigir (emenda 9 do spec).
- **O passo `alcance` sem tempo não conta o que deixou por fazer** (`pendentes: 0`, `sem_tempo: true`). Quem denuncia o atraso é a nota de "sem normalizar há mais de 2 dias".
- **O critério de "relatório com dado e nenhuma linha nova" pode acusar em falso** se todo relatório recente for mais velho que as linhas já gravadas (a função do banco não sobrescreve com relatório mais velho, e `collected_at` não anda). Confira `report_create_time` em `yt_own_video_reach_daily` antes de agir.
- **A tentativa de canal `ok` do diário não garante todos os vídeos** (veja a seção 4). Quem diz se um vídeo entrou é a tentativa do vídeo.
- **Depois do diário rodam sem prazo próprio** os critérios do L2, o de metadados, o de orçamento e o fechamento da rota. O diário pode usar até o fim do relógio global (270 s de 300 s): confira `ms` em `yt_own_collection_runs` nas primeiras semanas.
- **"Não consegue baixar há 3 dias" dispara no 4º dia.** O critério `jobs: <canal> não consegue baixar o relatório <tipo> há 3 dias` (e o de job em erro há 3 dias) roda na primeira fase, antes das tentativas de download do dia. No 3º dia de falha ele ainda só vê duas datas com tentativa; a nota aparece na execução do 4º dia.
- **Quem silenciou o domínio `youtube` nas notificações não recebe o aviso de `api_nao_ativada` / `sem_acesso` / `reautorizar`.** Uma notificação suprimida pela preferência do usuário conta como entregue: não há nota `sem_destinatario` e o cron fica verde. Nesse caso o estado só aparece em `acao_do_dono`, na resposta do cron.
