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
| **Quais dias do diário foram coletados** (A5 E6): `yt_own_video_coverage`, um intervalo `covered_from` a `covered_to` por vídeo e por conjunto de métricas (`base`, `estendidas`; os demais conjuntos são de outras etapas) | `yt_own_video_coverage` | Sim: o diário volta a ser pedido da última data coberta (ou da publicação, sem cobertura) |
| Impressões e CTR de miniatura por vídeo e dia (L2), normalizados do CSV de `channel_reach_basic_a1` | `yt_own_video_reach_daily` | Sim: o bruto fica guardado (MG13, E20); nenhuma rotina o apaga por prazo (seção 8) |

Tipos de relatório habilitados (`REPORT_TYPES_ENABLED`): os 4 de sempre (`channel_reach_basic_a1`, `channel_reach_combined_a1`, `channel_traffic_source_a3`, `channel_basic_a3`) e, desde a E12 da A5, mais 9 que **só guardam o bruto** (sem normalizador e sem tela): `channel_combined_a3`, `channel_device_os_a3`, `channel_playback_location_a3`, `channel_province_a3`, `channel_demographics_a1`, `channel_subtitles_a3`, `channel_cards_a1`, `channel_end_screens_a1`, `channel_sharing_service_a1`. Os dois primeiros da lista são os "de alcance". Ficam fora de propósito `channel_annotations_a1` (recurso extinto) e os `playlist_*`. A ordem da lista só desempata a fila de download.

Os 12 tipos que não são `channel_reach_basic_a1` guardam só o bruto, e o bruto **não é mais apagado por prazo** (MG13, E20). **Os 9 tipos novos só valem a partir do deploy**: o YouTube gera apenas os 30 dias anteriores à criação do job, então cada dia de atraso no deploy perde um dia de histórico deles. Se um desses tipos for gerado vazio ou nunca for gerado para o canal, ver "Conferência de D+3 e D+7" na seção 10.

**O que se perde de vez e o que não.** Impressões e CTR de miniatura só existem a partir da criação do job: o Google guarda o histórico de cada job por 30 dias e os relatórios diários por 60. A linha diária de metadados de um dia em que o cron não rodou nunca é escrita (aparece como `dias_sem_meta`). Todo o resto pode ser buscado de novo depois.

Ainda **não** existe: a retenção (lote L3).

**O que o L2 grava, e o que o dado ausente quer dizer.**

- **A dieta do diário (A5 E6): `yt_own_video_daily` guarda só o dia com atividade, e a cobertura diz quais dias foram coletados.** Dia sem linha e DENTRO de um intervalo de `yt_own_video_coverage` (conjunto `base`) = **zero medido** (o YouTube respondeu e o vídeo não teve view). Dia sem linha e FORA de todo intervalo = **não medido** (nunca perguntado, ou a API não devolveu). Quem grava é a função `yt_own_daily_apply`, numa só transação: as linhas com atividade, o apagamento do dia que o YouTube revisou para zero e a extensão da cobertura. O leitor do canal próprio (`proprio/ler.ts` + `proprio/cobertura-leitor.ts`) devolve os zeros apagados a partir da cobertura, então as telas recebem as mesmas linhas antes e depois da dieta. **Não apague linhas de `yt_own_video_coverage` à mão**: sem cobertura o vídeo volta a ser pedido desde a publicação, e se a API deixar de devolvê-lo os dias que eram zero medido viram "não medido" na tela.
- As duas tabelas novas têm a mesma chave: `(youtube_video_id, day_pt)`. `youtube_video_id` é o id de 11 caracteres do YouTube, **não** o uuid de `youtube_videos.id`. `day_pt` é o dia como veio da fonte; as duas fontes não documentam o mesmo dia, então nunca junte `yt_own_video_daily` a `yt_own_video_reach_daily` por `day_pt` sem saber disso.
- **Nulo nunca é zero.** Métrica que a API não trouxe fica nula na linha. Dia sem atividade **não tem linha**: a ausência de linha é "sem atividade ou não medido", nunca um zero gravado. Para separar os dois casos use `yt_own_collection_attempts` (seção 4): tentativa `sem_dado_na_janela` = a API respondeu e não havia nada; sem tentativa = nunca perguntado.
- **`yt_own_video_daily.views` é a contagem do DIA.** `youtube_video_analytics.views` (a parte antiga do cron) é o total da janela de 90 dias, não a contagem do dia. Não compare nem some um com o outro.
- Alcance: o relatório traz uma linha por vídeo e dia, só para vídeo com impressão. Vídeo sem impressão no dia **não aparece** e dia sem impressão vem como relatório `vazio` (só cabeçalho): nos dois casos não há linha em `yt_own_video_reach_daily`, e isso não é zero medido. `thumbnail_ctr` fica na unidade do relatório (0–1). **Cliques não são gravados**: o CSV não tem a coluna; impressões × CTR reconstroem o número.
- Só `channel_reach_basic_a1` é normalizado. Os outros 12 tipos habilitados (`channel_reach_combined_a1`, `channel_traffic_source_a3`, `channel_basic_a3` e os 9 da E12) ficam só como bruto.
- Relatório mais novo (`create_time` maior) **substitui a linha de alcance por inteiro**, inclusive levando o CTR de não nulo a nulo. Relatório mais velho que a linha gravada não sobrescreve nada; o mesmo relatório pode regravar as suas linhas (seção 8).
- Linha de alcance de vídeo que não está em `youtube_videos` é gravada com `video_id` nulo, e o id vai para `yt_reporting_reports.unmatched_video_ids` (`{ count, ids }`; nulo quando todos têm par).
- `metric_version` (nas duas tabelas) deriva de `day_pt`: `views_ate_2025-03-30` até 30/03/2025, `views_2025-03-31_a_2026-08-26` até 26/08/2026 e `views_desde_2026-08-27` depois.

`privacy_status` vem da `videos.list` com o token do canal dono: sem token, com a chamada falhando, ou para um vídeo que a resposta não trouxe, fica nulo. `is_short` fica nulo quando a duração é desconhecida ou quando um vídeo de 61 a 180 s ainda não teve a sonda de Shorts confirmada.

## 2. Orçamento e tetos

- Relógio global do pedido: 270 s (`maxDuration` = 300 s). Cada passo recebe `min(teto, o que resta do relógio)`.
- Tetos: metadados 30 s, jobs 20 s, **relatórios 120 s**, alcance 20 s, diário 50 s. Cada chamada ao Google tem no máximo 15 s; até 4 em paralelo.
- A soma dos tetos é 240 s; com 30 s de reserva para a parte antiga (medida: 20 a 24 s) fecha os 270 s. `clock.test.ts` trava essa conta: mexer num teto quebra o teste até a conta ser refeita.
- Ordem: metadados, jobs (fase "antes"), a parte antiga (analytics por janela), **contagem de abertura dos brutos**, relatórios, **conferência da guarda do bruto**, **alcance**, critérios de relatórios, **diário**, critérios do L2 e demais critérios (fase "depois"). A guarda (MG13, E20) tem prazo próprio, fora dos tetos dos passos: a contagem de abertura corta em 3 s e a conferência do fim em 8 s; no caso normal o tempo dela sai da folga do alcance e do diário, e só soma ao total se o relógio já estiver no fim (pior caso: 270 s + 3 s + 8 s antes da cauda dos critérios; o tempo real fica em `ms_passos.guarda`, abertura mais fim: conferir depois do envio). O alcance roda antes dos critérios de relatórios de propósito: um cabeçalho inesperado achado hoje já deixa o cron vermelho hoje.
- No máximo **100 downloads de relatório por execução**, um por vez. Medida de produção (09 a 12/10/2026): até 0,90 s por download; 100 downloads mais a listagem de 26 jobs cabem nos 120 s (`reports-step.test.ts` trava a conta). Bater nesse teto é normal e **não é falha** enquanto a fila estiver caindo: `coleta.relatorios.pendentes` diz quantos ficaram e `coleta.relatorios.vence_primeiro_em_dias` diz em quantos dias vence o primeiro deles (`null` = nada ficou para trás). `ms_listar` e `ms_baixar` dão o tempo de cada parte. A fila dos 9 tipos novos (cerca de 558 relatórios de histórico) esvazia em cerca de 9 execuções.
- **Ordem da fila** (`coleta/fila-relatorios.ts`): primeiro o que vence na origem em até 7 dias, de qualquer tipo; depois os de alcance; depois o resto, pelo vencimento. O arquivo vence 60 dias depois de gerado, ou 30 se for de histórico (`is_backfill`).
- Só o **relógio** produz `nao_alcancado_orcamento`. O teto de 100 não. Três execuções seguidas sem alcançar um canal viram a nota `orçamento: N escopo(s) de relatorio sem alcançar nas 3 últimas tentativas`; aí a conta do teto de downloads precisa ser refeita (o teste obriga).
- No máximo **200 relatórios normalizados por execução** (passo `alcance`, do mais velho para o mais novo). O que passa disso fica para o dia seguinte e aparece em `coleta.alcance.pendentes`.
- O diário faz **uma chamada à Analytics API por vídeo** (duas quando a API recusa as métricas estendidas) e lê no máximo 1000 vídeos por execução. Sem tempo, os vídeos que sobram viram `nao_alcancado_orcamento` e entram em `coleta.diario.pendentes`; os mais antigos de coletar vão primeiro no dia seguinte.
- O passo `alcance` **não registra tentativas** (não há `kind` para ele). Sem tempo ele devolve `sem_tempo: true` com `pendentes: 0`: o zero ali é "não olhou", não "nada pendente". O estado de cada relatório mora na própria linha de `yt_reporting_reports` (`normalized_at`, `status`, `error`), e o sinal de um normalizador parado é a nota "baixado(s) há mais de 2 dias sem normalizar" (seção 6).
- **Teto de tamanho do bruto, duas constantes** (`apps/web/src/lib/youtube/reporting/client.ts`):
  - `MAX_GZ_BYTES` = **2 MB** (era 10 MB até 12/10/2026: ninguém provou que o banco grava um bruto de 10 MB, que vira 20 MB em hex no upsert; o maior relatório real tem 564 bytes). Mede os **bytes lidos do corpo da resposta**, e o que isso é depende do servidor: com `Content-Encoding: gzip` (gzip de **transporte**) o fetch descomprime sozinho e a leitura mede o CSV já puro; o `Content-Length` é sempre o tamanho no fio. Sem gzip de transporte, é o que veio no fio.
  - `MAX_CSV_BYTES` = **64 MB**, o CSV descomprimido de um corpo que é um `.gz` de verdade (o gzip do próprio relatório). Memória medida em 12/10/2026 (Node 25, CSV de 64 MB): o pico sobe cerca de 69 MB com qualquer tamanho de linha (o código conta as linhas no Buffer); a contagem antiga por `split` chegava a +759 MB com linhas de 9 bytes.
  - Acima de qualquer um dos dois o relatório vira `erro` com `error = 'grande_demais'`, **o bruto não é guardado** e o cron fica vermelho na hora e por 14 dias. Acima de metade de `MAX_GZ_BYTES` (1.048.576 bytes **lidos do corpo**, a mesma unidade da recusa) o bruto é guardado e a execução avisa, antes de perder. A coluna `yt_reporting_reports.bytes` e `csv_gz` são outra grandeza: o **gzip guardado**, bem menor que o corpo lido quando há gzip de transporte; **não compare `bytes` com o teto**. `coleta.relatorios.maior_bytes` é o maior corpo **lido** da execução; `maior_lido_por_tipo` traz, por tipo, `{ bytes, gz }` (o maior corpo lido e se ele era um `.gz` de verdade; `gz: null` = recusado antes de examinar) e `corpos_gz` conta os corpos que vieram como `.gz` (os demais vieram como CSV puro, depois do gzip de transporte). É essa a resposta ao `Content-Encoding` real e ao tamanho real dos 9 tipos novos: leia na conferência de D+3.
  - A recusa antes de ler o corpo (Content-Length) e a recusa de bomba de descompressão **não gravam `sha256` nem `row_count`** (o conteúdo não foi lido por inteiro); só `bytes`.
  - Os três textos da nota (ver seção 6) dizem qual teto estourou; subir só `MAX_GZ_BYTES` **não** resolve uma recusa "descomprimem a mais de".

### Retenção da curva (A5 E8): teto de fim, ordem e a cauda

- A retenção é um passo de **teto de fim** (`TETOS_DE_FIM_MS.retencao` = 20 s): não entra na soma dos 240 s de `TETOS_MS` e só gasta o que sobrar dos 270 s do relógio (`relogio.prazo` o corta no fim). Sem tempo, o passo não roda, grava `nao_alcancado_orcamento` de `kind retencao_vida` por canal ligado e o resumo diz `sem_tempo: true`; o que ficou espera um dia (o critério de orçamento avisa se isso durar 3 execuções).
- **Ordem na fase "depois"** (a mesma dos três planos da A5): relatórios → guarda → alcance → critérios de relatórios → diário → [dimensões, normalizadores] → critérios do L2 → [critério de cobertura, lote E6-P2] → critérios da E11 → **retenção → critério da retenção** → nota de nome desconhecido em `YT_OWN_STEPS_OFF` → critério de passos desligados → critério de metadados → orçamento → conferências com data (sempre a última nota).
- **A cauda.** Os critérios depois do relógio rodam entre 270 s e 296 s (a função morre aos 300 s). Os da retenção (3 s) e dos desligados (1 s) usam `prazoDoCriterio`: o prazo próprio **ou** os 296 s da função, o que vier primeiro; sem tempo, a nota vermelha é `critérios: não foi possível avaliar <o quê> (sem tempo)`, nunca verde. Quem roda mais tarde perde primeiro (desligados). O tempo real da cauda está em `ms_passos.cauda` (= `max(0, agora − fim do relógio)` lido no fim da fase) e o do passo em `ms_passos.retencao`. **Conferência `e8-tempo-real` (R + 3):** se o maior total das 3 primeiras execuções passar de 250 s, cortar os prazos dos três critérios para 2 s, 2 s e 1 s e o teto de fim da retenção para 10 s antes do envio do lote seguinte.

## 3. Ler a resposta do cron

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/cron/sync-analytics-metrics
```

Rodar à mão é seguro: os passos são idempotentes no dia (a segunda execução sobrescreve e soma `attempts`; o diário regrava as mesmas linhas por upsert e o alcance só pega relatório com `normalized_at` nulo). Cada execução do diário repete as chamadas à Analytics API, uma por vídeo. O Vercel dispara sozinho às 09:00 de São Paulo.

| Campo | O que diz |
|---|---|
| `synced`, `errors`, `emptyReports`, `skipped_no_connection`, `errorDetails` | a parte antiga (analytics por janela), como sempre |
| `sem_autorizacao` | canais pulados pela parte antiga porque perderam a autorização do YouTube (seção 5, `reautorizar`). Não é erro |
| `ms_existente` | quanto a parte antiga levou, em ms. O relógio global é de 270 s |
| `coleta.metadados` | `gravados`, `tentativas` por resultado, `pendentes`, `day_pt`, `dias_sem_meta` por canal (chave ausente = a leitura falhou, não é zero). `sem_tempo: true` = o passo recebeu 0 s. Desde o L1b: `sem_privacidade` (linhas gravadas sem `privacy_status`) e `sem_is_short` (linhas com `is_short` nulo). **`sem_privacidade` igual a `gravados` num canal com conexão viva é falha em verde: olhe a tentativa `meta` de escopo `canal`** |
| `coleta.ms` | milissegundos de cada passo (`metadados`, `jobs`, `relatorios`, `alcance`, `diario`). Os tetos são 30 000, 20 000, 120 000, 20 000 e 50 000 |
| `coleta.reautorizar` | `youtube_channels.id` dos canais em `reautorizar` |
| `coleta.autorizados`, `coleta.negados` | `youtube_channels.id` dos canais que tiveram, nesta execução, uma chamada autenticada bem-sucedida / uma negação de autorização. É com esses dois conjuntos que o cron decide, no fim, quem sai de `reautorizar` |
| `coleta.jobs` | `estados` por canal e tipo, `tipo_indisponivel`, `acao_do_dono`, `pendentes` |
| `coleta.relatorios` | `vistos`, `baixados`, `vazios`, `expirados`, `erros_download`, `bruto_apagado`, `pendentes`, `perdidos`, `atrasados`; desde a E12 também `maior_bytes` (bytes lidos do corpo), `maior_lido_por_tipo`, `corpos_gz`, `expirados_por_tipo`, `vence_primeiro_em_dias` (`null` = nada ficou para trás) e `ms_listar` / `ms_baixar` |
| `coleta.guarda` | conferido em toda execução (MG13, E20): `blobs_guardados` (brutos no banco no FIM da execução, depois dos downloads do dia; é a base da execução seguinte; `null` = não conferido, e aí há nota em `falhas`), `blobs_guardados_ao_abrir` (brutos na ABERTURA da fase, antes do passo de relatórios; é este que se compara com a base, e `blobs_guardados - blobs_guardados_ao_abrir` é a entrada do dia; `null` = a contagem de abertura não veio, com nota, e a comparação cai para o total do fim), `blobs_guardados_antes` (o `blobs_guardados` da última execução que tem número; `null` na primeira), `baixados_sem_bruto` (maior que 0 é falha enquanto durar), `brutos_sem_baixado` (bruto cujo relatório não está como baixado; visível, não é falha), `perdas_reconhecidas` (relatórios com `blob_lost_at`; fica no resumo para sempre, sem vermelho) e `expirados_sem_registro`. **Roda em toda execução da fase `depois`**, também com o passo de relatórios sem tempo, desligado ou lançando (fica em `coleta/index.ts`, fora do passo), com prazo próprio de 8 s. Ausente do resumo só nas duas saídas antecipadas de `rodarColeta`, ambas já vermelhas: a leitura de `youtube_channels` falhou (`erro de banco ao ler youtube_channels`) ou a rede de segurança pegou uma exceção (`coleta: …`). Na rota há mais duas saídas sem a guarda, também vermelhas: a leitura de canais da própria rota falha (resposta 500, `database error listing the YouTube channels`) e a função morta pela plataforma (sem veredito; o vigia acusa por atraso). O tempo da guarda (abertura mais fim) fica em `ms_passos.guarda` da linha de `yt_own_collection_runs`. Qualquer campo `null` vem com uma nota em `falhas`: `null` é "não conferido", nunca zero |
| `coleta.conferencias_vencidas` | conferências com data (`apps/web/src/lib/conferencias.ts`, item 246 da A5) cuja data passou e que não têm `feitaEm`, no formato `id (etapa, data, responsável)`. Lista vazia = nenhuma vencida. **Até 7 dias de atraso fica só aqui; vencida há 8 dias ou mais entra também em `falhas` e deixa o cron vermelho** (seção 6, "Conferências com data"). Só na fase `depois` da coleta |
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

Zero medido × não medido (A5 E6). Um dia de um vídeo é **zero medido** quando não tem linha em `yt_own_video_daily` mas está dentro de um intervalo `base` de `yt_own_video_coverage`; é **não medido** quando está fora de todos. Troque `<ID DE 11 CARACTERES>`; a consulta lista os intervalos cobertos (mais de um intervalo = há buraco, e o dia do buraco é "não medido"):

```bash
npx supabase db query --linked "select metric_set, covered_from, covered_to, collected_at from yt_own_video_coverage where youtube_video_id = '<ID DE 11 CARACTERES>' order by metric_set, covered_from limit 20"
```

Os dias de um vídeo, cada um classificado como `com atividade`, `zero medido` ou `nao medido` (últimos 30 dias de um vídeo; a janela do `generate_series` é de quem lê):

```bash
npx supabase db query --linked "select g.dia::date as dia, case when d.youtube_video_id is not null then 'com atividade' when exists (select 1 from yt_own_video_coverage c where c.youtube_video_id = '<ID DE 11 CARACTERES>' and c.metric_set = 'base' and g.dia::date between c.covered_from and c.covered_to) then 'zero medido' else 'nao medido' end as situacao, d.views from generate_series(current_date - 30, current_date, interval '1 day') g(dia) left join yt_own_video_daily d on d.youtube_video_id = '<ID DE 11 CARACTERES>' and d.day_pt = g.dia::date order by 1 desc limit 40"
```

Cobertura de todos os vídeos do canal de uma vez (a data mais recente de cada vídeo; vídeo que não aparece aqui não tem cobertura nenhuma e o critério de cobertura o acusa se tiver 5 dias ou mais):

```bash
npx supabase db query --linked "select v.youtube_video_id, v.published_at::date as publicado, max(c.covered_to) as coberto_ate, count(c.*) as intervalos from youtube_videos v left join yt_own_video_coverage c on c.youtube_video_id = v.youtube_video_id and c.metric_set = 'base' where v.published_at is not null group by 1, 2 order by coberto_ate nulls first limit 60"
```

Vídeos publicados sem nenhuma linha de diário (depois da dieta, vídeo sem atividade **também** aparece aqui sem estar errado: confira a cobertura acima; a lista de quem não teve atividade ou ainda não foi coletado; vídeo sem linha é pedido de novo desde a publicação a cada execução):

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

### Retenção da curva (A5 E8)

Tabela `yt_own_video_retention` (migration MG5): uma linha por vídeo, janela (`window_kind`: `vida`, `primeiros_7_dias`, `primeiros_30_dias`), segmento (`organico`) e fim da janela (`window_end`); a chave é essa, então regravar a mesma janela é idempotente e o histórico da curva fica (cada semana nova da vida é outra linha). `points` é a lista de pontos `{t, ratio, relative, segment_impressions}` (`t` = fração do vídeo; `ratio` = fração da audiência, **pode passar de 1**; campo que não veio é nulo, nunca 0); `point_count` é quantos **vieram** (pode ser menos de 100). A função `yt_own_retention_facts(canal, hoje_utc)` é a que o passo e o critério leem: um fato por vídeo do canal com `published_at`.

**Ler a curva da vida de cada vídeo (a mais recente):**

```bash
npx supabase db query --linked "select distinct on (r.youtube_video_id) r.youtube_video_id, r.window_end, r.point_count, r.views_at_read, r.collected_at from yt_own_video_retention r where r.window_kind = 'vida' order by r.youtube_video_id, r.window_end desc limit 100"
```

**Quem nunca teve curva e por quê** (as tentativas de `kind retencao_vida` são por **canal**; a de cada vídeo vem do `outcome` da leitura):

```bash
npx supabase db query --linked "select v.youtube_video_id, v.published_at, (select count(*) from yt_own_video_retention r where r.youtube_video_id = v.youtube_video_id and r.window_kind = 'vida') as linhas_da_vida from youtube_videos v join youtube_channels c on c.id = v.channel_id where c.sync_enabled and v.published_at is not null order by 3, v.published_at limit 100"
```

```bash
npx supabase db query --linked "select scope_type, scope_id, kind, attempt_day, outcome, http_status, error, attempts from yt_own_collection_attempts where kind in ('retencao_vida', 'retencao_7d', 'retencao_30d') order by attempt_day desc, kind limit 60"
```

Como ler: `outcome = ok` com linha gravada; `sem_dado_na_janela` = a API respondeu e **não trouxe curva** (vídeo curto demais, ou sem audiência na janela): não é zero e não é erro, e o passo só relê quando o vídeo teve view depois da resposta e 7 dias passaram. O `error` de uma tentativa `erro_http` é sempre um **código** do catálogo (`http_500`, `http_403_quotaExceeded`, `forma_inesperada`, `erro_de_banco`…), nunca texto do Google nem do Postgres. Um `ratio` acima de 1 é dado real (a mesma pessoa revê o trecho), não defeito.

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
Texto do aviso: "O YouTube não oferece o relatório <tipo> para o canal <nome>."
O YouTube não oferece aquele tipo para o canal. Avisa uma vez **por tipo** (o nome do tipo vai no texto). Não há o que fazer; o estado fica em `coleta.jobs.tipo_indisponivel`. Anote no ledger quais tipos faltam.
Quais tipos o canal recebe só a primeira execução responde; anote aqui: (preencher depois da primeira execução em produção).

### `<canal>: <tipo> tem data de descontinuação no YouTube (<data>)`
Entra em `acao_do_dono` (nunca em falha) na execução em que o passo de jobs sonda os tipos (quando falta job para algum). Se a data já passou, o texto acrescenta ", que já passou". O job é criado mesmo assim. Anote a data no ledger: quando o YouTube desligar o tipo, a versão nova precisa entrar em `REPORT_TYPES_ENABLED`.

### `<canal>: <tipo> nunca gerou relatório desde <AAAA-MM-DD>; confira se o YouTube gera esse tipo para este canal`
Entra em `acao_do_dono` a cada execução, **não** em falha. É um tipo que só guarda bruto, com job ativo há mais de 6 dias e nenhum relatório chegou desde a criação (`yt_reporting_jobs.last_create_time` nulo). A premissa "o YouTube gera relatório todo dia" só foi medida nos 4 tipos antigos; para estes ninguém sabe se o YouTube gera algo para o canal. Faça a conferência de D+3 e D+7 (seção 10). Se o tipo não existe para o canal, tire-o de `REPORT_TYPES_ENABLED` (seção 10) e apague o job do lado do Google (seção 9).

### `<canal> tem N tipo(s) de relatório habilitado(s) sem job: ... (o canal precisa ser reconectado)`
Mesma nota da seção 6 (`jobs: ...`), mas em `acao_do_dono` quando o canal está em `reautorizar`: o canal perdeu a autorização e o job desses tipos não pôde ser criado. Reconecte o canal: o job é criado na execução seguinte. Cada dia sem job é um dia de histórico que não volta.

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
| `jobs: <canal> não consegue baixar o relatório <tipo> há 3 dias (último erro: …)` | o job está ativo mas o download falha todo dia. O `último erro` diz a causa: `HTTP 5xx`, `gzip_invalido` (o arquivo chega e não abre: download cortado; o relatório continua `listado` e é tentado de novo todo dia), `HTTP 200 corpo_vazio` (a resposta veio com 0 byte: resposta cortada, **não** é relatório vazio) ou `erro_gravacao: <tipo>, <bytes> bytes, <erro do banco>` (o download deu certo e o banco recusou gravar o bruto) | ver as tentativas `kind = 'relatorio'` do escopo `job`. `gzip_invalido` e `corpo_vazio` por 3 dias: exportar a URL e tentar à mão; se o arquivo da origem estiver mesmo corrompido, ele vence e vira `perdidos`. `erro_gravacao`: ver a nota `a GRAVAÇÃO do bruto` abaixo |
| `jobs: <canal> tem N tipo(s) de relatório habilitado(s) sem job: <tipos>` | a linha do tipo segue `desativado` (ou não existe): o passo de jobs não passou pelo canal (sem conexão, sem tempo ou exceção). Com o canal em `reautorizar` a nota vai para `acao_do_dono` (seção 5) | ver as tentativas `sondagem` do canal; resolvido, o job nasce na execução seguinte |
| `jobs: <canal>: o tipo <tipo> sumiu da lista do YouTube; se repetir, foi descontinuado` | o job do tipo já funcionava e a lista de tipos da API não o trouxe. Nada é gravado (o job fica `ativo`): uma lista parcial e um tipo descontinuado não se distinguem numa execução só | se repetir por dias, o tipo foi descontinuado: tire-o de `REPORT_TYPES_ENABLED` (seção 10). O critério dos 6 dias sem relatório novo também acusa |
| `jobs: <canal>: o YouTube não devolveu a lista de tipos de relatório` | a lista de tipos veio vazia ou sem nenhum tipo habilitado. É "o dado não existe": nenhuma linha vira `tipo_indisponivel`, nenhum aviso é mandado e a próxima execução tenta de novo | transitório; se repetir por 3 dias, ver a resposta de `reportTypes.list` à mão |
| `jobs: <canal>: a lista reportTypes passou de 20 páginas; a resposta do YouTube está incompleta` (ou `jobs`) | a lista passou do limite de páginas e foi recusada inteira, em vez de usada pela metade | Sentry; só acontece se a API mudar de comportamento |

### Relatórios (passo 1C e critérios)

| Nota | Significa | O que fazer |
|---|---|---|
| `relatórios: <canal> tem relatório de alcance <tipo> em erro` | relatório de alcance de até 14 dias em `erro`. Do passo de relatórios: `url_inesperada` ou `grande_demais` (a nota sai sozinha em 14 dias e passa a contar em `perdidos`; `grande_demais` dentro do prazo da origem tem conserto, seção 8). Gzip que não abre no download **não** é mais `erro`: o relatório fica `listado` e é tentado de novo. **Do passo `alcance` (L2):** `cabecalho_inesperado` (o Google mudou as colunas do CSV), `linha_invalida` (uma linha que não se lê, **CTR fora de 0–1** ou data que não existe no calendário), `canal_inesperado` (o CSV traz `channel_id` de outro canal), `bruto_ausente` (relatório `baixado` sem bruto) e `gzip_invalido` | ver `error` em `yt_reporting_reports` (seção 4). O bruto fica guardado. `cabecalho_inesperado` e `linha_invalida`: corrija o leitor (`reach-csv.ts`) e a seção 8 devolve o relatório à fila. `canal_inesperado`: confira `youtube_channels.channel_id` do canal antes de devolver à fila. `bruto_ausente` e `gzip_invalido` do `alcance`: sem bruto legível não há o que normalizar. Em todos esses casos nenhuma linha de alcance do relatório foi gravada |
| `relatórios: <canal> recebeu 4 relatórios <tipo> vazios seguidos` | alcance vindo sem linhas 4 vezes seguidas, **em canal que publicou nos últimos 90 dias**. Canal sem publicação nesse prazo não gera esta nota: aparece em `coleta.vazios_sem_publicacao` (o spec, seção 9, não trazia esse filtro; a divergência é deliberada) | conferir no Studio se o canal teve visualizações |
| `critérios: não foi possível avaliar vídeos recentes do canal <canal> (youtube_videos)` | a contagem de publicações dos últimos 90 dias falhou; sem ela o cron não decide se "vazios seguidos" ou "sem relatório novo" é falha | resolva a nota `erro de banco ao ler youtube_videos` que vem junto |
| `relatórios: <canal> tem relatório <tipo> expirado sem baixar` | o download devolveu 404/410 (a origem recusou). Dura 14 dias a partir da detecção, o `expired_at` gravado desde a MG13, qualquer que seja a idade do relatório. O vencimento por idade (a origem não respondeu nada, sem `expired_at`) não gera esta nota: aparece na nota `venceram sem baixar nos últimos 14 dias` abaixo | nada; sai em 14 dias e vira `perdidos` |
| `relatórios: N relatório(s) venceram sem baixar nesta execução (<tipo>: n, ...)` | nesta execução, N relatórios de tipo habilitado passaram do prazo da origem (30 dias de histórico, 60 dos demais) e nenhum critério persistente os cobre; na prática, vencimento por idade com atraso de mais de 14 dias (cron parado). Também aparece, só naquele dia, quando o 404/410 chegou mas a gravação de `expired_at` falhou (junto vem `erro de banco ao gravar yt_reporting_reports`; no dia seguinte o 404 se repete e grava). **O dado não volta** | ver por que a fila não andou: `pendentes`, `ms_baixar`, tentativas `relatorio`. Anote no ledger o tipo e o período perdido |
| `relatórios: N relatório(s) venceram sem baixar nos últimos 14 dias (<tipo>: n; ...)` | a mesma perda, vista pelos critérios nos 14 dias seguintes ao vencimento (relatório vencido por idade). O vermelho dura 14 dias do vencimento. **O dado não volta** | idem. Depois dos 14 dias só conta em `perdidos` |
| `relatórios: <canal> tem relatório <tipo> em erro (<motivo>)` | relatório de até 14 dias em `erro`, de tipo que só guarda bruto. Motivos: `grande_demais`, `url_inesperada` | `grande_demais`: subir o teto certo (próxima linha) e recolocar na fila (seção 8) enquanto o arquivo existe na origem; `url_inesperada`: não tem conserto |
| `relatórios: <canal>: <tipo> recusado por tamanho (Content-Length de N bytes (tamanho no fio); teto M bytes lidos do corpo): o bruto NÃO foi guardado; vence na origem em DD/MM (UTC)` | o servidor declarou, antes de qualquer leitura, mais que `MAX_GZ_BYTES` no fio | subir `MAX_GZ_BYTES` **com prova de que o banco grava o novo tamanho** (o bruto vira hex: o dobro em memória no upsert), deploy, e recolocar na fila (seção 8) **antes da data DD/MM**; depois dela o arquivo some na origem |
| `relatórios: <canal>: <tipo> recusado por tamanho (mais de M bytes lidos do corpo, já depois do gzip de transporte se houver (parou em N); teto M): o bruto NÃO foi guardado; vence na origem em DD/MM (UTC)` | a leitura do corpo passou de `MAX_GZ_BYTES` (com gzip de transporte, é o CSV já descomprimido) | idem: `MAX_GZ_BYTES` |
| `relatórios: <canal>: <tipo> recusado por tamanho (N bytes de .gz descomprimem a mais de M bytes; teto M descomprimido): o bruto NÃO foi guardado; vence na origem em DD/MM (UTC)` | o corpo é um `.gz` de verdade que descomprime acima de `MAX_CSV_BYTES` (64 MB). Pode ser bomba de descompressão ou relatório realmente enorme | subir só `MAX_GZ_BYTES` **não resolve**: é `MAX_CSV_BYTES`, e só depois de medir a memória (a conta está na seção 2). Se o prazo for `prazo na origem desconhecido`, o `create_time` do relatório está ilegível: conferir a linha no banco |
| `relatórios: <canal>: <tipo> recusado por tamanho (N bytes lidos do corpo; teto M): o bruto NÃO foi guardado; ...` | rede de segurança do passo: o corpo foi lido por inteiro e passou de `MAX_GZ_BYTES` depois do cliente (não deve acontecer; neste caso `sha256` e `row_count` foram gravados na linha) | idem: `MAX_GZ_BYTES` |
| `relatórios: <tipo> chegou a <bytes> bytes lidos do corpo, mais da metade do teto de <teto> bytes lidos` | o bruto **foi** guardado; aviso para subir o teto antes de perder | subir `MAX_GZ_BYTES` (com a prova de gravação) |
| `relatórios: <canal>: a GRAVAÇÃO do bruto de <tipo> falhou (N bytes comprimidos; banco: <código>); o relatório continua na fila` | o download deu certo e o `upsert` em `yt_reporting_report_blobs` foi recusado. O relatório fica `listado` e é tentado todo dia; cada dia grava uma tentativa `erro_http` com `error = 'erro_gravacao: <tipo>, <bytes> bytes, <código>'`, e no 3º dia seguido sai a nota `jobs: … não consegue baixar … (último erro: erro_gravacao: …)` | o código do Postgres está na nota (ex.: `57014` = timeout) e o texto completo do erro está no Sentry; ver também o log do Supabase (timeout? tamanho do corpo? disco?). Se o tamanho for a causa, baixar `MAX_GZ_BYTES`. Enquanto o arquivo existir na origem nada se perde; depois vence |
| `relatórios: fila de download cortada em N relatórios (ficaram de fora M); a ordem por vencimento não cobre o que ficou de fora` (ou, no lugar do parêntese, `contagem indisponível: pode haver mais`) | a fila de `listado` é lida em até 5 páginas de 1000 (corte em 5.000); passou disso, ou o banco não devolveu a contagem e a última página veio cheia. A fila real do deploy dos 13 tipos tem menos de 700 no pior caso, então esta nota quase certamente é problema novo (cron parado há semanas?) | conferir o que vence primeiro pela consulta da seção 4, ver por que a fila não andou (`pendentes`, `ms_baixar`, tentativas `relatorio`) e baixar a fila |
| `relatórios: N relatório(s) listado(s) há mais de 14 dias sem baixar` | downloads falhando ou a fila não anda | ver tentativas `relatorio` com `erro_http` |
| `relatórios: <canal> está sem relatório novo de <tipo> há mais de 6 dias` | (a) job de alcance ativo, canal que publicou nos últimos 90 dias, sem relatório novo; ou (b) tipo que só guarda bruto que **já gerou** relatório (`yt_reporting_jobs.last_create_time` preenchido) e parou há mais de 6 dias. Para (b) vale a marca do job e **não há** o filtro de publicação. Job de tipo bruto que **nunca** gerou (`last_create_time` nulo) **não** vem para cá: vai para `acao_do_dono` (seção 5, "nunca gerou relatório") | ver `yt_reporting_jobs`; se preciso, recriar o job (seção 9). Para (b), se o YouTube parou de gerar o tipo, tirá-lo de `REPORT_TYPES_ENABLED` |
| `relatórios: listagem truncada em 50 páginas (<canal>: <tipo>)` | `reports.list` devolveu mais de 50 páginas; a marca do job não avança, a listagem recomeça no dia seguinte | nada, a menos que repita por muitos dias |
| `relatórios: <canal>: <causa>` | exceção ao listar os relatórios de um canal | Sentry |
| `relatórios: <causa>` | exceção ao baixar um relatório (extra `report`) | Sentry |
| `relatórios: a limpeza apagou N bruto(s) nesta execução; desde a MG13 o esperado é 0 (…)` | a função `yt_reporting_blobs_purge` voltou a ter o corpo que apaga | não recriar o corpo antigo. **O reparo é do dono** (a migration já está registrada como aplicada, então `db:push:prod` não a roda de novo): abrir `supabase/migrations/20261012000001_observatorio_guarda_do_bruto.sql`, copiar o arquivo inteiro (é idempotente: `create or replace`, `add column if not exists`) e colar no SQL Editor do Supabase, uma execução. Os brutos que a limpeza apagou aparecem **na mesma execução** como `baixados_sem_bruto` e como queda de `blobs_guardados` (a guarda roda depois do passo): seção 13, "Bruto que falta" |
| `relatórios: N relatório(s) baixado(s) estão sem o bruto guardado (…)` | há relatório com `downloaded_at`, sem bruto e sem perda reconhecida. Fica vermelho todo dia até uma das duas saídas | seção 13, "Bruto que falta: as duas saídas" |
| `relatórios: os brutos guardados caíram de N para M desde a última execução conferida: …` | o número de brutos diminuiu. **N é o total do fim da execução anterior; M é a contagem da abertura desta (antes dos downloads de hoje)**, ou o total do fim se a abertura não veio; também acusa queda dentro da própria execução. Dura até uma execução gravar o número novo. Esperado quando você remove um canal próprio (a cascata leva relatório e bruto); fora disso é perda | se você não removeu canal: (1) ver quanto e de quais canais, com a consulta de relatórios por canal, tipo e estado (seção 4) comparada com a de ontem no ledger; (2) rodar a consulta do topo (seção 13); (3) levar ao controlador no mesmo dia. **Só se sabe quanto sumiu, não o quê**: o relatório e o bruto saem juntos na cascata e nenhuma lista guarda os ids antigos. Um relatório que aparece em `baixados_sem_bruto` é outra coisa (o relatório ficou e o bruto sumiu: tem saída, seção 13) |
| `relatórios: guarda do bruto não conferida (…)` | a função de conferência não devolveu número (`o banco não devolveu a contagem`), passou do prazo próprio de 8 s (`passou do prazo de 8000 ms`) ou lançou (`a conferência lançou`). Os campos de `coleta.guarda` ficam `null` | resolver a nota de banco que vem junto; se vier sozinha dois dias seguidos, Sentry (tag `passo: guarda do bruto`, quando lançou) ou a lentidão do banco (quando passou do prazo) |
| `relatórios: expirados sem registro de vencimento não contados (…)` | o banco não devolveu a contagem de `expirado_sem_baixar` sem `expired_at`; `guarda.expirados_sem_registro` fica `null` | informativo: some quando o banco volta a contar; não esconde perda |
| `schema_ausente: yt_reporting_guarda_conferir` | o código novo está no ar sem a MG13 | **do dono.** Se a MG13 ainda não consta como aplicada: `npm run db:push:prod` (fora de 11:55 a 12:15 UTC). Se consta como aplicada e a função sumiu (a MG13 foi aplicada em 12/10/2026), `db:push:prod` não faz nada: colar o arquivo `supabase/migrations/20261012000001_observatorio_guarda_do_bruto.sql` inteiro no SQL Editor do Supabase (é idempotente) |

### Conferências com data (item 246 da A5)

| Nota | Significa | O que fazer |
|---|---|---|
| `conferências vencidas há mais de 7 dias: N (<id>, devida em AAAA-MM-DD; ...): …` | há conferência em `apps/web/src/lib/conferencias.ts` cuja data passou há 8 dias ou mais e ainda não tem `feitaEm`. Até 7 dias de atraso ela só aparece em `coleta.conferencias_vencidas`, sem vermelho. **Fica vermelho todo dia até alguém marcar a conferência como feita: é intencional** (conferência esquecida não pode ficar muda) | marcar como feita (abaixo) |

**Regra: uma conferência vencida não pode ficar mais de um dia sem ser marcada ou feita.** Ela deixa o cron vermelho a partir do 8º dia, e o aviso do vigia (`cron-watchdog`) deduplica pelo **estado** do cron, não pelo texto: com a coleta já vermelha por conferência, uma falha real nova do mesmo cron não muda o estado e **não gera outro aviso**. Para não depender disso: (1) a nota de conferência é sempre a **última** das notas da fase `depois` da coleta (um teste trava a ordem; só as notas da gravação da própria execução, `registro da execução: …` ou `erro de banco ao gravar yt_own_collection_runs`, podem vir depois dela), então as falhas reais vêm antes dela em `cron_health.last_error` (que corta em 500 caracteres) e em `yt_own_collection_runs.falhas`; (2) **vermelho só por conferência** = `falhas` com uma única nota, a que começa por `conferências vencidas`; qualquer outra nota é falha real: leia `last_error` inteiro e `yt_own_collection_runs.falhas`; (3) marcar como feita no envio seguinte, sem esperar o 8º dia (os 7 dias de tolerância servem para agrupar a marcação com o próximo envio, não para esquecer). Marcar custa um commit, o envio, o CI e a promoção.

**Marcar uma conferência como feita** é uma edição de código, commitada:

1. Rodar a consulta que a entrada indica em `onde` (o plano da etapa, seção "Conferências depois do envio", ou o ledger) e anotar o resultado no ledger da etapa (`.superpowers/sdd/<etapa>/progress.md`).
2. Em `apps/web/src/lib/conferencias.ts`, trocar `feitaEm: null` por o dia de hoje (AAAA-MM-DD, dia de São Paulo) na entrada daquela conferência. Marcar a linha também em `.superpowers/sdd/a5/conferencias-com-data.md` (coluna "Feita em").
3. `git commit -m "chore: conferência <id> feita (<etapa>)" -- apps/web/src/lib/conferencias.ts`, e subir como qualquer outro commit. A linha some do resumo e do vermelho **no deploy seguinte**: até lá o cron continua mostrando a conferência (por isso o vermelho só começa no oitavo dia: dá o tempo de a marcação chegar a produção).

**Criar uma conferência nova** (qualquer etapa): acrescentar uma entrada à lista `CONFERENCIAS` no commit do deploy da etapa, com a data absoluta (nunca "D+N"), `responsavel`, `onde` e `feitaEm: null`. O cron não muda. Se a data da conferência mudar (deploy atrasou), corrigir a data na entrada e no `.md`.

### Alcance normalizado (L2)

| Nota | Significa | O que fazer |
|---|---|---|
| `alcance: <canal> recebeu relatório com dado nos últimos 4 dias e não tem linha nova de alcance` | job básico de alcance ativo há 6 dias ou mais, canal que publicou nos últimos 90 dias, relatório `baixado` (com dado) nos últimos 4 dias e nenhuma linha de `yt_own_video_reach_daily` com `collected_at` nesses 4 dias. **Só acusa quando chegou dado**: relatório `vazio` (dia sem impressão) ou canal fora do filtro de 90 dias não geram a nota, e isso é correto (sem relatório com dado, o silêncio é legítimo) | ver os relatórios do canal (seção 4) e `error`/`normalized_at`; um relatório mais velho que as linhas já gravadas não sobrescreve nada e pode causar esta nota em falso: confira com `report_create_time` em `yt_own_video_reach_daily` |
| `alcance: N relatório(s) baixado(s) há mais de 2 dias sem normalizar` | relatório `baixado` ou `vazio` de `channel_reach_basic_a1`, baixado há mais de 2 dias, ainda sem `normalized_at`: o normalizador está parado ou atrasado (é a falha em verde do passo `alcance`). Relatório em `erro` não conta aqui (a nota de relatório em erro cuida) | ver `coleta.alcance` (`pendentes`, `sem_tempo`) e `falhas`; se for fila grande (mais de 200), cai sozinha nos dias seguintes |
| `alcance: vídeos do canal <canal> lidos até o limite de 1000 — a leitura pode estar truncada` | o canal tem 1000 vídeos ou mais em `youtube_videos`; o mapa de ids ficou parcial e os relatórios do canal esperam, sem normalizar | com 35 vídeos não acontece; abra o Sentry (veja "Limites conhecidos") |
| `critérios: não foi possível avaliar alcance de <canal> (<tabela>)` (e `… idade do job ausente`, `… contagem ausente`) | a leitura de um critério do alcance falhou; o cron não afirma verde sem ter olhado | resolva a nota `erro de banco ao ler …` que vem junto |
| `critérios: não foi possível avaliar relatórios sem normalizar (yt_reporting_reports)` | o critério de "sem normalizar" não conseguiu contar | idem |
| `alcance: relatório <id> de <canal> não pôde ser normalizado (<motivo>)` | o normalizador acabou de marcar o relatório como `erro` (`<motivo>`: `cabecalho_inesperado`, `linha_invalida`, `canal_inesperado`, `bruto_ausente` ou `gzip_invalido`). Sai **na execução em que o erro acontece, qualquer que seja o `create_time`** (relatório de mais de 14 dias também deixa o cron vermelho nesse dia). Nos dias seguintes quem avisa é a nota `relatórios: <canal> tem relatório de alcance <tipo> em erro`, e só enquanto o relatório tiver até 14 dias; as duas não saem juntas para o mesmo relatório | mesma ação da nota `… em erro` da tabela de relatórios (seção 4 para ver `error`; seção 8 para devolver à fila) |
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
| `diário: <canal>: N de M vídeos sem cobertura até dd/mm (<até 5 ids>, com "nunca coberto" ou "coberto até dd/mm")` (com `; metade ou mais do canal: é pane da coleta, não dos vídeos` quando for o caso) | **critério de cobertura (A5 E6)**: o vídeo tem 5 dias ou mais e a cobertura `base` dele acaba antes de hoje − 5 (ou não existe). O diário parou de olhar para ele, e isso não aparece em nenhuma linha. **Cobertura vazia não é "primeiro dia"**: com a tabela vazia todo vídeo elegível fica vermelho. Vermelho **por 3 dias**; depois, se o YouTube não devolve o vídeo (4 dias seguidos de `sem_dado_na_janela` ou `erro_http` 403, 404 ou 410 que não seja de cota), ele sai do vermelho e vira ação do dono (abaixo). Erro nosso (banco, forma inesperada), 500, 429 e cota **não** tiram o vídeo do vermelho; metade ou mais do canal nessa situação é pane e fica vermelho | tentativas `diario` do vídeo (seção 4) e a nota `diário: … N de M vídeos com erro` dos dias anteriores; a consulta de cobertura por vídeo (seção 4) |
| `critérios: não foi possível avaliar cobertura de <canal>` (com ` (sem tempo)`, ` (mais de 1000 vídeos)`, ` (youtube_videos)`, ` (yt_own_video_coverage)`, ` (yt_own_collection_attempts)` ou ` (youtube_videos: dado ilegível)`) | o critério de cobertura não conseguiu ler ou terminar. **Nunca é "nada de errado"** | a nota anterior (`erro de banco ao ler …` ou `schema_ausente: …`) diz qual tabela; sem tempo repetido = a cauda está apertada (seção 2) |
| `diário: <canal>: estendidas ausentes na resposta de N vídeo(s)` | a resposta veio sem `engaged_views` em algum dia: só o conjunto `base` foi gravado para o vídeo (a cobertura `estendidas` não avança e as colunas estendidas ficam nulas, nunca zero) | se repetir por dias, defeito de contrato com a API; Sentry |
| `schema_ausente: yt_own_video_coverage` ou `schema_ausente: yt_own_daily_apply` | o código da dieta está no ar e a MG14 não foi aplicada em produção. O passo do diário **para** e nunca grava pelo caminho antigo | aplicar a MG14 (o dono: `npm run db:push:prod`) |
| `critérios de cobertura: <causa>` | exceção não prevista dentro do critério de cobertura | Sentry (tag `passo: critérios de cobertura`) |

**Ação do dono** (resumo, nunca `falhas`): `diário: <canal>: o YouTube não devolve mais o vídeo <id> (última situação conhecida: <público, não listado, privado ou desconhecida>; coberto até dd/mm). Se foi apagado, tire-o da lista (runbook, seção 6)`. O vídeo ficou 3 dias vermelho (com o id), o YouTube não o devolve mais e o vermelho acabou. Quase sempre é um vídeo **apagado no YouTube** (ou privado). Nenhum código tira um vídeo de `youtube_videos`: **tirá-lo da lista é ato do dono, por SQL, em produção** (o agente não escreve em produção). Primeiro confirme no Studio e leia o que vai sair:

```bash
npx supabase db query --linked "select id, youtube_video_id, title, published_at from youtube_videos where youtube_video_id = '<ID DE 11 CARACTERES>' limit 2"
```

Depois o dono apaga a linha (as tabelas `yt_own_*` que apontam para ela por `video_id` ficam com `video_id` nulo e guardam o histórico pelo id de 11 caracteres; a cobertura do vídeo fica como está):

```bash
npx supabase db query --linked "delete from youtube_videos where youtube_video_id = '<ID DE 11 CARACTERES>' returning id, youtube_video_id"
```

**Cuidado com a cobertura**: um vídeo que perde a cobertura (alguém a apagou) é pedido de novo desde a publicação na execução seguinte, e a função apaga as linhas de zero dos dias devolvidos; se a API não o devolver mais, os dias que eram zero medido passam a ser "não medido" na tela. Não apague cobertura à mão.

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
| `aviso de canal sem conexão: <causa>` | o aviso da parte antiga não saiu | Sentry |
| `parte existente: <causa>` | exceção não prevista na parte antiga | Sentry (fase `existente`) |
| `coleta (antes\|depois): <causa>` / `coleta: <causa>` | exceção não prevista na coleta inteira | Sentry (tag `passo: coleta`) |
| `metadados: <causa>` / `jobs: <causa>` / `relatorios: <causa>` / `alcance: <causa>` / `diario: <causa>` / `orçamento: <causa>` | exceção não prevista dentro de um passo ou critério (o prefixo é o nome do passo, escrito `relatorios` e `diario` sem acento e `orçamento` com) | Sentry (tag `passo`) |

### Retenção (A5 E8)

Passo `retencao` e critério da retenção. Canal em `reautorizar` não é servido e **não gera nota nenhuma** aqui (já há o e-mail próprio).

| Nota | Significa | O que fazer |
|---|---|---|
| `retenção: <canal>: N de M leituras com erro (<causa>)` | a Analytics API (ou o banco) falhou em N das M leituras do dia; `<causa>` é a da primeira (cota, "erro do YouTube (500)", "erro de banco"…). As outras foram gravadas | transitório; some na execução seguinte. Cota: painel da YouTube Analytics API (a retenção só pede o que sobra: o diário tem a vez antes) |
| `retenção: <canal>: N vídeo(s) sem diário em dia; a curva espera o diário (<até 5 ids>)` (com `; metade ou mais do canal: é pane da coleta` quando for o caso) | o vídeo tem 5 dias ou mais e a fonte do diário está parada há mais de 7 dias: **a curva não é lida** (o fim da janela não seria confiável). Vermelho **por 3 dias**; depois, se o YouTube não devolve o vídeo (4 dias seguidos de `sem_dado_na_janela` ou `erro_http` 403, 404 ou 410 que não seja de cota), ele vira ação do dono. Erro nosso (banco, forma inesperada) e 500, 429 ou cota **não** tiram o vídeo do vermelho; metade ou mais do canal nessa situação é pane e fica vermelho | olhe o diário do vídeo (tentativas `diario`, seção 4) e o conserto do diário; se o vídeo foi apagado, veja a ação do dono abaixo |
| `retenção: <canal>: <causa>` (`a resposta veio em forma inesperada`, `fatos em forma inesperada`) | a lista de fatos ou a resposta da API veio fora da forma | Sentry; defeito de contrato: precisa de commit |
| `retenção: <canal>: N vídeo(s) com leitura da curva vencida há mais de 8 dias (<ids>)` | **critério da retenção**: o passo roda todo dia e um vídeo com diário em dia continua sem leitura há mais de 8 dias (o passo deixou de fazê-lo) | tentativas `retencao_vida` do vídeo (seção 4); a causa costuma ser uma nota `retenção: … leituras com erro` dos dias anteriores |
| `critérios: não foi possível avaliar retenção de <canal>` | a leitura dos fatos falhou, veio em forma inesperada ou a contagem dos vídeos não veio. **Nunca é "nada de errado"** | a nota anterior (`erro de banco ao ler yt_own_retention_facts` ou `youtube_videos`) diz qual; Sentry |
| `critérios: não foi possível avaliar retenção de <canal> (sem tempo)` | o relógio (296 s da função) acabou antes de o critério ler. Sem tempo é vermelho, não verde | se repetir, a cauda está apertada: conferência `e8-tempo-real` (seção 2) |
| `critérios: não foi possível avaliar retenção de <canal> (migration MG5 não aplicada: falta a função yt_own_retention_facts)` com `schema_ausente: yt_own_retention_facts` | o código está no ar e a migration MG5 não foi aplicada em produção. O resto da coleta segue igual; o vermelho a mais é só esse | aplicar a MG5 (o dono: `npm run db:push:prod`) |
| `critérios: não foi possível avaliar retenção de <canal> (lista vazia, mas o canal tem N vídeos)` | a função devolveu lista vazia para um canal que tem vídeo: defeito da função, não "tabela vazia" | log do Supabase; conferir `yt_own_retention_facts` na mão |
| `critérios da retenção: <causa>` | exceção não prevista dentro do critério | Sentry (tag `passo: critérios da retenção`) |
| `retencao: <causa>` (sem acento) | exceção não prevista no passo inteiro | Sentry (tag `passo: retencao`) |

**Ação do dono** (resumo, nunca `falhas`): `retenção: <canal>: N vídeo(s) que o YouTube não devolve mais (<ids>); a curva não é lida`. O vídeo ficou 3 dias vermelho (com o id), o YouTube não o devolve mais e o vermelho acabou. Quase sempre é um vídeo **apagado no YouTube**. Nenhum código tira um vídeo seu de `youtube_videos`: **tirá-lo da lista é ato do dono, por SQL, em produção** (o agente não escreve em produção). Primeiro confirme no Studio que o vídeo não existe mais e leia o que vai sair:

```bash
npx supabase db query --linked "select id, youtube_video_id, title, published_at from youtube_videos where youtube_video_id = '<ID DE 11 CARACTERES>' limit 2"
```

Depois o dono apaga a linha (as tabelas `yt_own_*` que apontam para ela por `video_id` ficam com `video_id` nulo — `on delete set null` — e **guardam o histórico pelo id de 11 caracteres**; se outra tabela impedir o apagamento, o banco recusa e nada muda):

```bash
npx supabase db query --linked "delete from youtube_videos where youtube_video_id = '<ID DE 11 CARACTERES>' returning id, youtube_video_id"
```

Um vídeo apagado que a API responda com **outro** status (400, ou 500 persistente) fica vermelho até ser tirado da lista: é o lado seguro. Canal de 1 vídeo com o vídeo apagado fica vermelho para sempre (1 de 1 é "metade ou mais").

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

**Antes: confira que o bruto ainda existe** (leitura). Desde a MG13 o bruto não é apagado por prazo; se mesmo assim faltar, o relatório volta a `erro` com `bruto_ausente` e o cron fica vermelho **na execução em que isso acontece** (nota `alcance: relatório <id> de <canal> não pôde ser normalizado (bruto_ausente)`, qualquer que seja a idade do relatório). Nos dias seguintes só continua vermelho se o `create_time` tiver até 14 dias; passado isso o erro sai de `falhas` e conta em `perdidos`:

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
- O estado `erro` por `bruto_ausente`, `gzip_invalido` (do passo `alcance`) ou `url_inesperada` não se resolve com estes `update`: não há bruto legível. A exceção é `grande_demais`, logo abaixo.
- Relatório `vazio` também é conferido: devolvê-lo à fila só confere o cabeçalho de novo e remarca `normalized_at`, sem gravar linha.

**Exceção: `grande_demais` dentro do prazo da origem.** O bruto não foi guardado, mas o relatório ainda existe no YouTube até `create_time` + 30 dias (histórico) ou + 60 dias. Primeiro veja o canal, o tamanho e o prazo (leitura):

```bash
npx supabase db query --linked "select c.name, r.report_type_id, r.report_id, r.bytes, r.create_time, r.create_time + (case when r.is_backfill then interval '30 days' else interval '60 days' end) as vence_na_origem from yt_reporting_reports r join youtube_channels c on c.id = r.channel_id where r.status = 'erro' and r.error = 'grande_demais' order by vence_na_origem limit 50"
```

Depois suba a constante certa (`MAX_GZ_BYTES` ou `MAX_CSV_BYTES`, ver a seção 2 e a nota que acusou), com a prova de gravação e de memória, faça o deploy e, **só então**, recoloque na fila. Escrita em produção, **é do dono**, uma por vez:

```sql
update yt_reporting_reports set status = 'listado', error = null where status = 'erro' and error = 'grande_demais';
```

`download_url` e `bytes` ficam na linha; se a URL tiver vencido, o passo de relatórios a renova sozinho na execução seguinte. Se o arquivo continuar acima do novo teto, ele volta a `erro` no dia seguinte. Passado o `vence_na_origem`, o arquivo não existe mais: o `update` devolve à fila um relatório que o YouTube responde com 404 e ele vira `expirado_sem_baixar`.

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
- **Habilitar um tipo:** acrescentar a linha em `REPORT_TYPES_ENABLED`. A posição na lista só desempata a fila. **Antes** de habilitar, refaça a conta da seção 2: cada tipo novo traz cerca de 62 relatórios de histórico (2 canais) que vencem em 30 dias.
- **Orçamento apertado:** os tetos estão em `apps/web/src/lib/youtube/coleta/clock.ts` (`TETOS_MS`, `RELOGIO_GLOBAL_MS`). Mexer neles exige refazer a conta com `maxDuration` da rota.

Desligar `metadados` custa caro: cada dia sem linha não volta.

### Conferência de D+3 e D+7 depois do deploy dos tipos novos

Os 9 tipos da E12 só guardam bruto, e nada garante que o YouTube gere os 9 para estes canais (a premissa "gera todo dia" só foi medida nos 4 antigos). D = dia da primeira execução do cron com o deploy no ar. Faça a conferência em **D+3** e em **D+7**; é só leitura:

```bash
npx supabase db query --linked "select j.report_type_id, count(*) filter (where j.status = 'ativo') as ativos, count(*) filter (where j.status = 'ativo' and j.last_create_time is null) as ativos_sem_relatorio, max(j.last_create_time) as ultimo_relatorio, string_agg(distinct j.status, ', ') as estados from yt_reporting_jobs j where j.report_type_id not in ('channel_reach_basic_a1', 'channel_reach_combined_a1', 'channel_traffic_source_a3', 'channel_basic_a3', 'channel_annotations_a1') group by 1 order by 1 limit 20"
```

Por canal e tipo (`last_create_time` nulo = **nunca** chegou relatório):

```bash
npx supabase db query --linked "select c.name, j.report_type_id, j.status, j.job_create_time, j.last_create_time, now() - coalesce(j.job_create_time, j.created_at) as idade_do_job from yt_reporting_jobs j join youtube_channels c on c.id = j.channel_id where j.report_type_id not in ('channel_reach_basic_a1', 'channel_reach_combined_a1', 'channel_traffic_source_a3', 'channel_basic_a3', 'channel_annotations_a1') order by j.report_type_id, c.name limit 100"
```

E o que de fato foi baixado, por tipo e estado (`vazio` = o YouTube gerou o arquivo só com cabeçalho):

```bash
npx supabase db query --linked "select report_type_id, status, count(*) as relatorios, min(create_time) as primeiro, max(create_time) as ultimo, round(avg(bytes)) as bytes_medio, max(bytes) as maior from yt_reporting_reports where report_type_id not in ('channel_reach_basic_a1', 'channel_reach_combined_a1', 'channel_traffic_source_a3', 'channel_basic_a3') group by 1, 2 order by 1, 2 limit 100"
```

Como ler:
- **D+3:** o histórico dos 30 dias anteriores aparece até D+2 e a fila esvazia em cerca de 9 execuções. Um tipo com job `ativo` e `ativos_sem_relatorio` igual ao nº de canais ainda pode estar só atrasado. Tipo em `tipo_indisponivel`: o YouTube não o oferece ao canal (já avisou uma vez; anote no ledger).
- **D+7:** tipo ativo com `last_create_time` nulo em todos os canais **nunca gera** relatório para o canal. A partir do 6º dia o cron já o põe em `acao_do_dono` ("nunca gerou relatório desde ..."). Decisão: tirá-lo de `REPORT_TYPES_ENABLED` (acima) e apagar o job (seção 9), ou deixá-lo ligado e anotar que não gera. Tipo que gerou e parou vira falha (`está sem relatório novo ... há mais de 6 dias`).
- Relatório `vazio` em tipo que só guarda bruto é normal para canal pequeno; não é falha.
- **Cerca de D+9: um tipo gerou o histórico e não gera o relatório diário.** É o caso de um canal parado: o YouTube entrega os 30 dias anteriores à criação do job (por isso `last_create_time` fica preenchido) e depois nada. O cron fica **vermelho todo dia**, com `relatórios: <canal> está sem relatório novo de <tipo> há mais de 6 dias`, até o dono agir. A saída é tirar o tipo da lista; não há outra, e esperar não resolve.
  1. Confirme na consulta por canal e tipo (acima) que `last_create_time` não anda há mais de 6 dias para o tipo, e que não é falha do cron (o resto do resumo está normal, `pendentes` caindo).
  2. Decida o tipo e **tire a linha** de `REPORT_TYPES_ENABLED` em `apps/web/src/lib/youtube/reporting/types.ts` (a lista `SEM_NORMALIZADOR` é derivada; não precisa mexer nela). Rode `npx vitest run test/youtube/coleta` antes do push: o teste que falhar por causa do número de tipos mostra o que ajustar.
  3. Deploy. Na execução seguinte a linha vira `desativado` (só no banco), o tipo sai da listagem, do download e dos critérios, e o cron volta a verde. O bruto que já foi baixado continua guardado (desde a MG13 nenhuma limpeza por prazo vale para ele).
  4. O job continua gerando relatório no Google. Para parar, apague-o (`jobs.delete`, seção 9); o dono faz isso, escreve no Google. Se o tipo for religado depois, a sondagem adota o job que ficou.
  5. Anote no ledger o tipo, o canal, a data e que o YouTube só gerou o histórico.
- Anote no ledger quais dos 9 tipos o YouTube gera de fato. Para o tamanho, **não use `maior`/`bytes_medio` desta consulta como medida do teto**: são do gzip guardado. A medida que justifica manter ou mudar os tetos da seção 2 é `maior_lido_por_tipo` (e `corpos_gz`) do resumo do cron, lido na conferência de D+3 (consulta B do plano, `resumo->'relatorios'`); `maior`/`bytes_medio` só dizem quanto ocupa o banco.

### Desligar a retenção (e os passos novos) pela variável YT_OWN_STEPS_OFF (A5 E8)

> **Estado em produção desde 14/10/2026:** a variável vale `dimensoes,normalizadores` (a E11 foi a `main` desligada, à espera do ensaio com a API real). Ela é uma lista: gravar só `retencao` RELIGA a E11. Para desligar a retenção enquanto a E11 estiver desligada, o valor é `retencao,dimensoes,normalizadores`. A variável só vale depois de um novo deploy.

A retenção, as dimensões, as versões e os normalizadores têm interruptor próprio: a variável **`YT_OWN_STEPS_OFF`** na Vercel, com os nomes separados por vírgula (`retencao,dimensoes,versoes,normalizadores`; espaços e maiúsculas tolerados). Os cinco passos de `PASSOS_LIGADOS` continuam sendo desligados por commit (acima).

- **Sem commit, mas a variável só vale no deploy seguinte**: depois de salvar a variável é preciso um **redeploy** (a Vercel lê o ambiente no deploy). Religar é o mesmo caminho: tirar o nome e fazer outro deploy.
- Desligada a retenção: o passo não roda e **não chama nada** (nem `yt_own_retention_facts`), o critério da retenção **não é avaliado**, `resumo.retencao` vira `{ "desligado": true }` e nenhuma tentativa `retencao_*` é gravada.
- **Um passo desligado nunca some.** Até a 7ª execução seguida a nota `retencao: passo desligado por YT_OWN_STEPS_OFF (há N execuções)` fica em `acao_do_dono`. Na **8ª execução seguida o cron fica vermelho** (`retencao: passo desligado há 8 execuções ou mais por YT_OWN_STEPS_OFF; religue…`), e continua até religar ou tirar o passo por commit. O critério conta as execuções lendo `resumo.<passo>.desligado` em `yt_own_collection_runs`; se a leitura falhar, a nota é `critérios: não foi possível avaliar há quanto tempo o passo retencao está desligado (…)` em `falhas`.
- **Nome desconhecido** na variável (erro de digitação) não desliga nada: `YT_OWN_STEPS_OFF tem nome desconhecido: <nome>` em `falhas`, uma vez só.
- Antes de a MG5 existir em produção o passo e o critério dão `schema_ausente` com o nome da migration (seção 6, "Retenção"): se isso incomodar enquanto a MG5 espera, desligar a retenção pela variável é o caminho, e a 8ª execução desligada lembra de religar.

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
drop function if exists public.yt_reporting_guarda_conferir();   -- criada pela MG13 (E20); sai antes das tabelas que ela lê
drop function if exists public.yt_reporting_blobs_purge(text[]);   -- a MG13 a recriou (corpo `return 0`): ver a seção 13
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

### Rollback da dieta do diário (A5 E6)

**Reverte-se SÓ O COLETOR** (os commits do diário pela função e da integração do critério de cobertura no cron; a leitura da cobertura pode ficar, só lê). **O leitor tolerante (`proprio/ler.ts` e `proprio/cobertura-leitor.ts`) fica, e fica para sempre**: ele lê certo nos dois estados do banco, e é para isso que existe. Reverter o lote inteiro não funciona depois de alguns dias de dieta: os zeros já apagados não voltam sozinhos. A janela anda um dia por execução, então os zeros apagados vão do último dia coberto antes da dieta até hoje − 3, e o coletor antigo recomeça de `min(hoje − 10, a última LINHA do vídeo)`; com o leitor antigo de volta, num vídeo com view recente ficam dias sem linha entre esses dois pontos, lidos como "não medido" numa janela que está na tela.

**O que acontece ao reverter só o coletor:** o coletor antigo volta a gravar linha em todo dia que pedir, zeros inclusive. Para os vídeos parados ele **repede a vida inteira** (a última linha deles é antiga), como no dia da carga inicial: o passo pode bater o teto de 50 s e deixar vídeos para o dia seguinte, então a volta pode levar **dois dias** para fechar, com a nota de orçamento do diário nesse intervalo. A cobertura fica parada e o leitor tolerante usa o maior entre ela e a última linha: as telas não mudam de número.

**Se algum dia for preciso reverter também o leitor**, o caminho é do dono e não está neste runbook: uma consulta que recria as linhas de zero a partir da cobertura (para cada dia coberto sem linha, uma linha com as contagens em zero).

## 13. Limites conhecidos

- **O bruto não é apagado por prazo (MG13, E20).** `yt_reporting_blobs_purge` devolve 0. Sinais: `relatorios.bruto_apagado` tem de ser 0 e `guarda.baixados_sem_bruto` tem de ser 0; qualquer outro valor deixa o cron vermelho, e uma queda dos brutos deixa vermelho até uma execução gravar o número novo: a comparação é `guarda.blobs_guardados_ao_abrir` (contado antes dos downloads do dia) contra a base `guarda.blobs_guardados_antes` (o total do fim da execução anterior), então perda menor que a entrada do dia também aparece (a primeira versão comparava depois dos downloads e deixava passar). Limites que restam: **sem base não há comparação** (a primeira execução depois do envio tem `blobs_guardados_antes = null`; no D0 a conta exata é à mão: `blobs_guardados_ao_abrir` igual ao total medido no deploy, 160, e `blobs_guardados = ao_abrir + baixados + vazios` do dia) e **só se sabe quanto sumiu, não o quê** (cascata). Conferências com data: as da E12 (16/10 a 13/11/2026), as da E19 (13/10 a 11/11/2026), `e20-segundo-cron` (14/10), 21/10/2026 e 12/11/2026 (tamanho), 09/01/2027 e 09/04/2027 (as datas em que a limpeza antiga apagaria); elas estão em `apps/web/src/lib/conferencias.ts` (o cron as lista em `coleta.conferencias_vencidas` quando vencem, e **deixa o cron vermelho quando vencida há mais de 7 dias**; como marcar como feita: seção 6, "Conferências com data") e em `.superpowers/sdd/a5/conferencias-com-data.md`; as consultas, na seção "Conferências depois do envio" do plano `docs/superpowers/plans/2026-10-12-a5-e20-guarda-do-bruto-plan.md`. A conferência (`coleta/guarda.ts`) roda em toda execução da fase `depois`, não só quando o passo de relatórios roda, e tem prazo próprio de 8 s dentro dos 30 s de reserva do relógio de 270 s: o estouro vira nota, não exceção. Recriar o corpo antigo da função é o que apaga: não fazer.
  - **O que continua sendo apagado:** tudo de um canal próprio removido (`youtube_channel_remove`, pelo dono, com o slug digitado: o relatório leva o bruto por cascata, sem export nesta fase); tudo de um site apagado (cascata); linhas de `yt_own_collection_runs` com mais de 90 dias; linha de `ops_alert_state` de alerta resolvido. O arquivo **na origem** (YouTube) some 60 dias depois de gerado (30 no histórico): é por isso que o bruto fica aqui. O reenvio de um relatório à fila troca o bruto pelo arquivo novo (substituição, não apagamento).
  - **Consulta que confere (leitura; qualquer um roda).** Depois da MG13 o esperado é `colunas_mg13 = 4`, `purge_desligado = true`, `funcao_guarda = 1`, `baixados_sem_bruto = 0`, `brutos_sem_baixado = 0`:

```bash
npx supabase db query --linked "select (select count(*) from information_schema.columns where table_schema='public' and table_name='yt_reporting_reports' and column_name in ('expired_at','download_attempts','last_error_at','blob_lost_at')) as colunas_mg13, (select prosrc not like '%delete from%' from pg_proc where pronamespace='public'::regnamespace and proname='yt_reporting_blobs_purge') as purge_desligado, (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='yt_reporting_guarda_conferir') as funcao_guarda, (select count(*) from yt_reporting_report_blobs) as blobs, (select count(*) from yt_reporting_reports r where r.downloaded_at is not null and not exists (select 1 from yt_reporting_report_blobs b where b.report_id = r.report_id)) as baixados_sem_bruto, (select count(*) from yt_reporting_report_blobs b where not exists (select 1 from yt_reporting_reports r where r.report_id = b.report_id and r.downloaded_at is not null)) as brutos_sem_baixado"
```

```bash
npx supabase db query --linked "select * from public.yt_reporting_guarda_conferir()"
```

- **Bruto que falta: as duas saídas.** Se o cron ficar vermelho com `baixados_sem_bruto` maior que 0, a saída é sua. Lista de quais são (leitura):

```bash
npx supabase db query --linked "select r.report_id, r.report_type_id, r.channel_id, r.create_time, r.downloaded_at, (r.create_time + case when r.is_backfill then interval '30 days' else interval '60 days' end) as some_da_origem_em, (r.create_time + case when r.is_backfill then interval '30 days' else interval '60 days' end) > now() as origem_ainda_tem from yt_reporting_reports r where r.downloaded_at is not null and r.blob_lost_at is null and not exists (select 1 from yt_reporting_report_blobs b where b.report_id = r.report_id) order by r.create_time"
```

  Para cada linha, um dos dois. **Os dois comandos são seus. Nenhum agente os roda.** No SQL Editor do Supabase, um por vez:

  - `origem_ainda_tem = true`: devolver à fila. O cron do dia seguinte baixa de novo e a nota some.

```sql
update public.yt_reporting_reports set status = 'listado', downloaded_at = null, error = null where report_id = '<REPORT_ID>' and downloaded_at is not null and blob_lost_at is null;
```

  - `origem_ainda_tem = false`: reconhecer a perda. O relatório sai do alarme e passa a contar em `perdas_reconhecidas`, que fica no resumo do cron para sempre (visível, sem vermelho).

```sql
update public.yt_reporting_reports set blob_lost_at = now() where report_id = '<REPORT_ID>' and downloaded_at is not null and blob_lost_at is null;
```

  Perdas já reconhecidas (leitura):

```bash
npx supabase db query --linked "select report_id, report_type_id, create_time, downloaded_at, blob_lost_at from yt_reporting_reports where blob_lost_at is not null order by blob_lost_at"
```

- **`brutos_sem_baixado` maior que 0 (visível, não é falha).** É bruto guardado cujo relatório não está como baixado: o resíduo conhecido da E12, em que duas execuções sobrepostas fazem uma marcar o 404 (`expirado_sem_baixar`) e a outra gravar o bruto (o `update` de `downloaded_at` só atinge `listado` e não acha a linha). O dado existe; falta o estado. **Não há pressa e nada deixa o cron vermelho.** Hoje é 0 (medido em 12/10/2026). Lista (leitura):

```bash
npx supabase db query --linked "select r.report_id, r.report_type_id, r.channel_id, r.status, r.expired_at, r.downloaded_at, r.error, octet_length(b.csv_gz) as bytes_gz from yt_reporting_report_blobs b join yt_reporting_reports r on r.report_id = b.report_id where r.downloaded_at is null order by r.create_time"
```

  Para tirar uma linha da lista, o dono marca o relatório como baixado (o bruto é o arquivo da origem; se o tipo é o de alcance, o passo `alcance` o normaliza na execução seguinte). **O comando é seu; nenhum agente o roda; um por linha; ainda não foi exercitado em produção, confira uma linha antes (`select` acima) e rode para um `report_id` por vez.** No SQL Editor do Supabase:

```sql
update public.yt_reporting_reports set status = 'baixado', downloaded_at = now(), expired_at = null, error = null where report_id = '<REPORT_ID>' and status = 'expirado_sem_baixar' and downloaded_at is null and exists (select 1 from public.yt_reporting_report_blobs b where b.report_id = '<REPORT_ID>');
```

  Se o `status` não for `expirado_sem_baixar` (por exemplo `listado`), o resíduo é de outra origem: não use o comando; leve ao controlador.

- **Morte da função pela plataforma não deixa rastro.** Se o Vercel mata a função (passou de 300 s, falta de memória), nenhum registro de saúde é escrito e o cron só é notado cerca de 12 horas depois, pela checagem de "atrasado". O relógio de 270 s existe para isso não acontecer.
- **Os critérios supõem poucos canais.** Cada leitura de critério é cortada em 1000 linhas. Acima de uns 25 canais, uma das leituras pode bater no corte e a nota vira `… leitura cortada em 1000` (falha, não verde).
- **Gzip que não abre no download é tentado de novo, todo dia.** Um download cortado chega assim, e o relatório continua `listado` (com tentativa `erro_http` `gzip_invalido`); se o arquivo da origem estiver mesmo corrompido, ele vence e vira `perdidos`. Só o passo `alcance` marca `erro` por `gzip_invalido` (bruto já guardado que não abre), e esse é definitivo.
- **Relatório que venceu por idade com mais de 14 dias de vencido** só conta em `perdidos`: a nota `venceram sem baixar` dura 14 dias. O 404/410 grava `expired_at` (MG13, E20; aplicada em produção pelo dono em 12/10/2026): num relatório criado há mais de 14 dias a nota `<canal> tem relatório <tipo> expirado sem baixar` dura 14 dias a partir desse instante, todo dia da janela, e acaba sozinha; a nota agregada pula quem tem `expired_at`, para a mesma perda não voltar a alarmar quando o prazo da origem passar. **Vencido por idade não ganha `expired_at`** (a origem não respondeu nada). Relatório que expirou antes da MG13 tem `expired_at` nulo = "sem registro de vencimento": nenhuma nota nova é inventada para ele (continua nas duas portas antigas). O passo também grava, por relatório, `download_attempts` (tentativas com resposta da origem ou falha de gravação; o prazo do passo esgotado não conta) e `last_error_at` (a última falha); duas execuções sobrepostas podem contar uma tentativa só. `blob_lost_at` é do dono, o código nunca o grava.
- **Defeito corrigido pela retirada (fase de fadiga removida em 10/2026, A/B Lab P1).** `youtube_fatigue_alerts.expected_ctr` e `actual_ctr` eram `numeric(6,4)` e a rota gravava contagens de visualizações neles; no dia em que um vídeo "fadigasse" o insert falharia e o cron ficaria vermelho. A fase foi removida, então nada mais grava na tabela; as colunas seguem como estão até a migration de limpeza da P3.
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
- **Depois do diário rodam sem prazo próprio** os critérios do L2, o de metadados, o de orçamento e o fechamento da rota. O diário pode usar até o fim do relógio global (270 s de 300 s): confira `ms_passos` em `yt_own_collection_runs` nas primeiras semanas.
- **"Não consegue baixar há 3 dias" dispara no 4º dia.** O critério `jobs: <canal> não consegue baixar o relatório <tipo> há 3 dias` (e o de job em erro há 3 dias) roda na primeira fase, antes das tentativas de download do dia. No 3º dia de falha ele ainda só vê duas datas com tentativa; a nota aparece na execução do 4º dia.
- **Quem silenciou o domínio `youtube` nas notificações não recebe o aviso de `api_nao_ativada` / `sem_acesso` / `reautorizar`.** Uma notificação suprimida pela preferência do usuário conta como entregue: não há nota `sem_destinatario` e o cron fica verde. Nesse caso o estado só aparece em `acao_do_dono`, na resposta do cron.
