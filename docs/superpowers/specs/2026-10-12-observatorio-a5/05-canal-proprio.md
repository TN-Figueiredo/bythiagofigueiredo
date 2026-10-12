# Observatório, fase A5 (spec v2.2), parte 05: canal próprio

> Parte do spec da A5 v2.2, dividido em 12/10/2026 só movendo texto (nenhuma frase mudou; a numeração de seções, etapas, migrations, perguntas e itens de aceite é a do original). Índice, cabeçalho "O que mudou" e tabela "onde está cada seção": [`../2026-10-12-observatorio-a5-concorrentes-design.md`](../2026-10-12-observatorio-a5-concorrentes-design.md).

## 7. Canal próprio: dieta do diário (E6), curva de retenção (E8) e origem das views em tabelas (E11)

### 7.1 Dieta do diário (etapa E6)

**O que é, em uma frase.** Hoje o banco guarda uma linha por vídeo por dia desde a publicação, mesmo nos dias sem nenhuma view; a dieta passa a guardar só os dias em que houve alguma atividade, mais uma tabela pequena que registra quais dias foram coletados, de modo que nada se perde e "zero medido" continua diferente de "não medido". O "lixo" é a forma de guardar (97,5% de linhas vazias), não a informação: a mesma informação cabe em menos de 1 MB.

**Problema.** `yt_own_video_daily` grava uma linha por vídeo e dia desde a publicação, e 97,5% delas são um dia sem nada (fato 11). O volume cresce com vídeos × dias de vida, para sempre.

**Desenho.**

- **D8. A tabela guarda só dia com atividade.** Atividade = pelo menos uma destas colunas diferente de zero (negativo conta): `views`, `engaged_views`, `watch_time_minutes`, `likes`, `comments`, `shares`, `subscribers_gained`, `subscribers_lost`, `card_impressions`. Conferido: nenhuma linha sem atividade tem `avg_view_*` ou `card_click_rate` preenchido; as 22 linhas com views 0 e outra atividade **ficam**.
- **D9. Uma tabela de cobertura diz "o dia D foi coletado para o vídeo V"**, por intervalo (não por dia: uma linha por dia teria as mesmas 96.892 linhas):

```sql
create table if not exists public.yt_own_video_coverage (
  youtube_video_id text not null,
  metric_set text not null check (metric_set in ('base', 'estendidas',     -- METRICAS_BASE × METRICAS_ESTENDIDAS (analytics-diario.ts:12-17)
    'trafego', 'dispositivo', 'pais', 'inscrito', 'detalhe', 'alcance_dim')),   -- conjuntos da E11 (7.3); já entram no check para não haver segunda migration
  covered_from date not null,          -- dia do YouTube, inclusive
  covered_to date not null,            -- idem; o último dia que a fonte DEVOLVEU, não "hoje"
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  source text not null default 'analytics_api' check (source in ('analytics_api', 'reporting_api')),
  collected_at timestamptz not null default now(),
  primary key (youtube_video_id, metric_set, covered_from),
  check (covered_to >= covered_from)
);
create index if not exists idx_yt_own_video_coverage_channel on public.yt_own_video_coverage (channel_id, covered_to);
alter table public.yt_own_video_coverage enable row level security;
drop policy if exists "yt_own_video_coverage_select" on public.yt_own_video_coverage;
create policy "yt_own_video_coverage_select" on public.yt_own_video_coverage
  for select using (public.can_edit_site(site_id));
```

- **D10. Leitura:** para uma métrica do conjunto S, o dia D do vídeo V é **zero medido** se existe intervalo de (V, S) que contém D e não há linha; é **o valor da linha** se há linha (coluna nula na linha continua "não medido" daquela métrica); é **não medido** se nenhum intervalo contém D. Dia que a fonte não devolveu dentro de uma janela pedida **parte o intervalo** (hoje não há nenhum caso; a forma existe para não mentir se houver). Há dois conjuntos porque as métricas estendidas podem ser recusadas pela API (`estendidas: 'recusadas'`): sem isso, um dia sem linha diria "0 impressões de cartão" de um dia em que elas nem foram pedidas.
- **D11. Escrita atômica.** Função `yt_own_daily_apply(p_video text, p_ids jsonb, p_rows jsonb, p_days_returned date[], p_sets text[])`, no molde de `yt_own_reach_apply` (`execute` só para `service_role`): na mesma transação (1) grava as linhas com atividade, sem deixar valor ausente no envio apagar valor gravado; (2) **apaga** a linha de um dia devolvido que agora não tem atividade (o YouTube revisa os últimos dias); (3) estende ou parte os intervalos de cobertura com os dias devolvidos, fundindo vizinhos.
- **D12. Efeito na coleta** (`coleta/diario-step.ts`): o "último dia gravado" de cada vídeo (`:105-110`, hoje `max(day_pt)` do diário) passa a ser `max(covered_to)` do conjunto `base`. Sem isso, num canal parado a janela recomeçaria no último dia **com view**, anos atrás, todo dia. O envio em lotes de mesma assinatura (`:186-212`) é substituído pela função.
- **D13. Efeito nos leitores da A4** (`lib/proprio/`): a mudança fica **inteira dentro de `ler.ts`**. `lerDiario` lê também os intervalos da janela e **devolve as mesmas `DiarioLinha`**, materializando `views: 0` para dia coberto sem linha; `ultimoDia` passa a ser o `max(covered_to)`. `tipos.ts`, `vpd.ts`, `dias.ts` e os modelos de tela não mudam: para eles "zero é linha, falta de linha é não medido" continua verdade, agora na fronteira do leitor. O leitor tolera os dois estados do banco (antes e depois da dieta), o que permite publicar o código antes de apagar qualquer coisa. A Tarefa 2 da A4 (`avg_view_percentage`, `avg_view_duration_seconds`) não é afetada: esses valores só existem em dia com view.
- **D14. Outros pontos tocados:** `youtube_channel_removal_impact` recriada com a tabela nova em `serie_coletada`, e `youtube_channel_remove` conferida (a cobertura tem `on delete restrict` no canal, como o diário); a semente e2e (`e2e/fixtures/observatorio-seed.ts:292`, `:412`) passa a semear cobertura e a limpar a tabela nova; `database.types.ts` regenerado.

**Migração dos dados existentes: destrutiva, só com o dono, em quatro passos separados por conferência.**

| Passo | O que | Reversível? |
|---|---|---|
| **P1** (migration aditiva) | cria `yt_own_video_coverage` e `yt_own_daily_apply`; preenche a cobertura a partir das linhas existentes (ilhas de dias seguidos por vídeo, um conjunto para `views is not null`, outro para `engaged_views is not null`); recria a função de impacto. **Não apaga nada** | sim (`drop table`) |
| **P2** (código) | leitor tolerante (D13) e coleta pela função (D11, D12) em produção; observar **3 execuções** do cron das 12:00 UTC | sim (reverter o commit) |
| **P3** (com o dono, fora da janela 11:30 a 13:00 UTC) | (i) cópia fora do banco: `\copy (select * from yt_own_video_daily order by youtube_video_id, day_pt) to 'yt_own_video_daily-AAAAMMDD.csv' csv header`, guardada pelo dono; (ii) contagens "antes" (abaixo) anotadas; (iii) migration: `create table if not exists yt_own_video_daily_zeros_bkp as select …` das linhas sem atividade **e cobertas**, com RLS ligada, sem policy e `revoke all from anon, authenticated`; `delete` das mesmas linhas; (iv) contagens "depois"; (v) `vacuum full public.yt_own_video_daily` (comando à parte: não roda dentro de migration; trava a tabela por segundos) | sim: `insert into yt_own_video_daily select * from yt_own_video_daily_zeros_bkp on conflict do nothing` |
| **P4** (com o dono, 14 dias ou mais depois) | `drop table yt_own_video_daily_zeros_bkp` | só pelo CSV, ou pedindo de novo à Analytics API (ela devolveu a vida inteira dos vídeos em 35 chamadas; não é garantia documentada) |

**Conferência de contagem (invariantes; os números mudam todo dia, as igualdades não).** Antes de P3: `T` = linhas do diário; `A` = linhas com atividade; `Z = T − A`; `S` = soma de `views`; `C` = soma de `(covered_to − covered_from + 1)` do conjunto `base`. Exigido antes: `C = T`. Exigido depois: linhas = `A`; soma de `views` = `S`; linhas no backup = `Z`; `C` inalterado; para cada vídeo, dias cobertos sem linha = linhas dele no backup. Em 12/10: `T` = 96.892, `A` = 2.455, `Z` = 94.437.

**Plano de volta.** Até P4, o comando da tabela acima mais reverter o código de P2 (o leitor tolerante funciona nos dois estados, então a ordem não importa). O que não volta: o espaço, que o `vacuum full` devolveu.

**Ganho.** Tabela de 72 MB para menos de 1 MB (2.455 linhas); backup temporário de cerca de 23 MB até P4; depois, 71 MB livres. A regravação diária de 350 linhas (35 vídeos × 10 dias) some: é ela que inflou a tabela a três vezes o tamanho dos dados.

### 7.2 Curva de retenção do vídeo próprio (etapa E8)

**Decisão do dono (12/10):** "eu quero a curva de retenção sim… quero curva de retenção no site sim". É o equivalente, para os vídeos dele, aos "momentos mais vistos". É dado **autorizado** de Analytics: pode ser guardado por mais de 30 dias (fato 16), com a conferência de autorização que a coleta já faz a cada chamada (`authorization_verified_at`).

**Unidade (escrita na tela).** Cada ponto da curva é um par: **fração do vídeo** (`t`, de 0,01 a 1,00: cem posições, cada uma 1% da duração) × **fração da audiência** (`ratio`, o `audienceWatchRatio` do YouTube: quantas reproduções passavam por aquele trecho, divididas pelas views do vídeo). `ratio` **pode passar de 1** (trecho revisto, ou início de Short em repetição); nunca é cortado em 1. Minuto e segundo são derivados (`t` × duração), não gravados.

**Primeiro passo da etapa, antes de qualquer migration: uma conferência de leitura.** O inventário deixou não confirmado se a consulta respeita o período pedido. A conferência é uma só, sem gravar nada: para **um** vídeo com views recentes, pedir `reports.query` com `dimensions=elapsedVideoTimeRatio`, `metrics=audienceWatchRatio`, `filters=video==<id>;audienceType==ORGANIC` **duas vezes**: da publicação até hoje, e só os últimos 28 dias. Curvas diferentes = a API aceita período (caso A). Curvas idênticas ponto a ponto = só existe o acumulado (caso B). Erro na segunda = caso B, com o erro anotado. O resultado vai para o ledger, com as duas respostas guardadas como fixture de teste. Feita com o acesso do canal que o site já tem; é leitura.

| | **Caso A: a API aceita período** | **Caso B: só o acumulado** |
|---|---|---|
| O que se coleta | `vida` (publicação até hoje), relida quando o vídeo teve views novas e no máximo uma vez por semana; mais `primeiros_7_dias` e `primeiros_30_dias`, **uma vez** cada, quando a janela fecha | só `vida`, com a mesma regra de releitura |
| O que dá para retroagir | **tudo**: as três janelas dos 35 vídeos, numa leva (cerca de 105 consultas, espalhadas em 7 dias) | **só a curva acumulada de hoje.** Como a curva de 2019 de um vídeo de 2015 era diferente, e ninguém a guardou, a evolução **começa no dia do deploy**: cada semana sem coletar é uma leitura que não volta |
| Urgência | baixa: o passado é recuperável | **alta**: a E8 sobe para o começo da sequência (seção 14) |
| O que a tela diz | "primeiros 7 dias", "primeiros 30 dias" e "vida inteira", com seletor | "vida inteira, lida em dd/mm" e, havendo duas leituras ou mais, "como a curva mudou desde dd/mm" |

Nos dois casos a tabela é a mesma; no caso B a coluna `window_kind` só recebe `'vida'`.

**DDL proposto (migration MG5).**

```sql
create table if not exists public.yt_own_video_retention (
  youtube_video_id text not null,           -- id de 11 caracteres (NÃO o uuid), como nas outras yt_own_*
  window_kind text not null check (window_kind in ('vida', 'primeiros_7_dias', 'primeiros_30_dias')),
  segment text not null default 'organico' check (segment in ('organico')),   -- audienceType==ORGANIC; outros segmentos só com nova decisão
  window_end date not null,                 -- último dia (dia do YouTube) coberto pela leitura
  window_start date not null,               -- dia da publicação, ou o início da janela
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  points jsonb not null,                    -- lista ordenada por t: {t, ratio, relative, started, stopped, segment_impressions}
                                            --   t = fração do vídeo (0,01 a 1,00); ratio = fração da audiência (pode passar de 1)
                                            --   relative = relativeRetentionPerformance (0 a 1; 0,5 = mediana de vídeos de duração parecida)
                                            --   campo que a API não devolveu fica nulo, nunca 0
  point_count integer not null check (point_count > 0),   -- pontos que VIERAM (pode ser menos de 100)
  metrics_returned text[] not null,         -- as métricas que a API aceitou nesta leitura
  views_at_read bigint,                     -- views do vídeo na leitura: decide se vale reler
  source text not null default 'analytics_api' check (source in ('analytics_api')),
  collected_at timestamptz not null default now(),
  metric_version text not null,             -- mesma lista de valores do diário (regra de contagem de views vigente)
  primary key (youtube_video_id, window_kind, segment, window_end)
);
create index if not exists idx_yt_own_video_retention_channel on public.yt_own_video_retention (channel_id, window_end);
alter table public.yt_own_video_retention enable row level security;
drop policy if exists "yt_own_video_retention_select" on public.yt_own_video_retention;
create policy "yt_own_video_retention_select" on public.yt_own_video_retention
  for select using (public.can_edit_site(site_id));    -- padrão das yt_own_*: dado privado do canal; escrita só por service role
```

- **Chave.** Uma linha por vídeo, janela, segmento e data de leitura: reler na semana seguinte cria linha nova (é o histórico da curva); reler no mesmo dia regrava a mesma. `youtube_channel_removal_impact` é recriada contando a tabela nova, e `youtube_channel_remove` conferida (`on delete restrict`, como o diário).
- **Coleta.** É o passo "retenção" já previsto no spec de coleta (seção 6, lote L3, e seção 7: último da ordem, teto de 40 s): `dimensions=elapsedVideoTimeRatio`, `filters=video==<id>;audienceType==ORGANIC`, métricas `audienceWatchRatio`, `relativeRetentionPerformance`, `startedWatching`, `stoppedWatching`, `totalSegmentImpressions`; se a API recusar métrica, repete só com as duas primeiras e `metrics_returned` diz o que veio. Um vídeo vence 7 dias depois da última linha ou tentativa; **e só é relido se `views` do diário cresceu desde `views_at_read`** (regra nova: num canal com 36 views em 90 dias, quase nenhum vídeo vence). Primeira leva espalhada por `sha256(uuid) mod 7`. Cota: uma consulta da Analytics API por vídeo e leitura; não toca a cota da Data API.
- **Zero × não medido.** Sem linha = "não coletada". Resposta sem ponto = tentativa `sem_dado_na_janela` em `yt_own_collection_attempts`, e a tela diz "o YouTube não devolveu curva para este vídeo (poucas views)". Ponto com campo ausente = nulo. Nunca curva inventada, nunca reta em zero.
- **Volume.** Cerca de 1,5 kB por linha (comprimida). Com a regra de views novas: da ordem de 1,5 MB por canal por ano; pior caso (todos os vídeos toda semana) 3 a 7 MB. Entra no ciclo de vida (9.2): a leitura mais recente de cada vídeo e janela nunca sai do online; as anteriores seguem a idade de corte.
- **Leitor e tela.** Leitor novo em `lib/proprio/` que devolve, por vídeo, a curva mais recente e a lista das datas de leitura; modelo com: o ponto em que a curva cruza 0,5 ("metade das pessoas já saiu aos m:ss"; se nunca cruza, "mais da metade fica até o fim"); as maiores quedas entre pontos vizinhos; os trechos em que `ratio` sobe (revistos); e `relative` como faixa ("acima / na média / abaixo de vídeos de duração parecida", cálculo do YouTube, dito assim). A seção fica na **página do vídeo próprio**; o canal não ganha tela própria da curva. O mockup de exemplo já existe; o definitivo é refeito com o dado real (6.5, mockup 11).
- **Quem não lê.** Nenhum pacote da forja (o escopo da fase 2a dela exclui retenção) e nenhum endpoint do Cowork nesta fase.
- **Relação com a A4.** A lacuna P2-3 da `REVISAO.md` ("a curva espera o lote L3, que tem migration") é esta etapa. A seção "Retenção: não coletada" das Tarefas 12 e 13 da A4 continua valendo até a E8 entregar.

### 7.3 Canal próprio em tabelas: origem de tráfego, termos de pesquisa, dispositivo, país, inscrito (etapa E11)

**Decisão do dono (12/10).** O canal próprio entra de uma vez, já em tabelas, com coleta diária e retroação: "vamos preparar para já colocar tudo de uma vez". É a etapa E3 do inventário. Vem **depois** da E12 (7.4), que liga os relatórios em lote e guarda o bruto, e por isso pode normalizar também o bruto que já estiver guardado. Continuam **fora**: o diário ampliado e a demografia em tabela (12.1).

**Cinco famílias, três tabelas, uma fonte por tabela** (duas fontes na mesma tabela obrigariam a conciliar dias e limiares diferentes; o spec de coleta já registra que as duas fontes não documentam o mesmo "dia").

| Família | Tabela | De onde vem | Até onde retroage | Unidade |
|---|---|---|---|---|
| **Origem de tráfego** (pesquisa, sugeridos, navegação, externo, Shorts, playlist…) por vídeo e dia | `yt_own_video_dim_daily`, `dim_kind = 'traffic_source'` | **Analytics API**, `dimensions=day,insightTrafficSourceType`, uma consulta por vídeo | até a publicação de cada vídeo (a API devolve para trás; empírico no diário: desde 2015) | views; minutos assistidos |
| **Dispositivo e sistema** | idem, `'device_os'` (valor `MOBILE\|ANDROID`) | Analytics API, `day,deviceType,operatingSystem` | idem | idem |
| **País** | idem, `'country'` (ISO de duas letras; `ZZ` = não identificado) | Analytics API. **NC se `day,country` é aceito numa consulta só** (conferência 1, abaixo). Se não for: daqui para a frente, uma consulta por vídeo com `startDate = endDate`; para trás, por mês de calendário | por dia, ou por mês se a conferência disser que não (a linha de mês leva `period_days` e a tela diz "no mês") | idem |
| **Inscrito × não inscrito** | idem, `'subscribed_status'` | Analytics API, `day,subscribedStatus` (vem sem custo: mais uma consulta por vídeo) | desde 15/12/2015 (limite da API) | idem |
| **Termos de pesquisa e sites externos** (o detalhe da origem), por vídeo e dia | `yt_own_video_traffic_detail_daily` | **relatório em lote** `channel_traffic_source_a3` (job **já ligado** desde 08/10). A Analytics API só dá os 25 maiores de um período, sem dia. **NC se o CSV traz o termo em `traffic_source_detail`** (conferência 2) | **só desde 08/09/2026**, e só se os relatórios forem baixados a tempo (abaixo). Antes disso: os 25 maiores por ano, pela Analytics API, em tabela de período (NC até onde: conferência 3) | views; minutos |
| **Impressões e taxa de clique por origem e por dispositivo** | `yt_own_video_reach_dim_daily` | **relatório em lote** `channel_reach_combined_a1` (já ligado; 21 baixados). Só existe em lote | só desde 08/09/2026 | impressões; taxa de clique de 0 a 1 |

**Nenhuma destas famílias espera um job novo:** as duas que dependem de lote usam tipos que já estão ativos. O que falta é o **normalizador** (hoje só `channel_reach_basic_a1` tem; fato 17). Com a E12, os relatórios de dispositivo, país e inscrito também passam a existir em bruto, por vídeo e dia e sem o limiar da Analytics API: ficam como conferência e como fonte de troca futura, mas **a tabela continua com uma fonte só** (a Analytics API, que é a que retroage).

**Conferências de leitura, antes da migration** (sem gravar nada; resultado no ledger): (1) `reports.query` com `dimensions=day,country` e filtro de um vídeo: aceita ou dá 400; (2) abrir um CSV real de `channel_traffic_source_a3` já baixado e ver se `traffic_source_detail` traz termos de pesquisa e URLs; (3) pedir o detalhe (`insightTrafficSourceDetail`, `YT_SEARCH`) de um vídeo antigo para 2019 e ver se volta dado; (4) a cota diária da Analytics API no console do Google (o inventário não a confirmou).

**DDL proposto (migration MG7).**

```sql
-- 1. Uma linha por vídeo × dia × valor da dimensão. ESPARSA: só existe linha onde houve atividade.
create table if not exists public.yt_own_video_dim_daily (
  youtube_video_id text not null,
  day_pt date not null,                          -- dia do YouTube, como no diário
  dim_kind text not null check (dim_kind in ('traffic_source', 'device_os', 'country', 'subscribed_status')),
  dim_value text not null,                       -- o código da API, sem tradução: 'YT_SEARCH', 'MOBILE|ANDROID', 'BR', 'SUBSCRIBED'
  period_days smallint not null default 1 check (period_days >= 1),   -- 1 = dia; mais de 1 só na retroação de país por mês (day_pt = 1º dia)
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  views bigint,
  engaged_views bigint,
  watch_time_minutes numeric,
  source text not null default 'analytics_api' check (source in ('analytics_api')),
  collected_at timestamptz not null default now(),
  metric_version text not null,
  primary key (youtube_video_id, day_pt, dim_kind, dim_value)
);
create index if not exists idx_yt_own_video_dim_daily_channel on public.yt_own_video_dim_daily (channel_id, dim_kind, day_pt);

-- 2. O detalhe da origem: termo pesquisado, site externo, vídeo ou canal que sugeriu.
create table if not exists public.yt_own_video_traffic_detail_daily (
  youtube_video_id text not null,
  day_pt date not null,
  source_type text not null,                     -- 'YT_SEARCH', 'EXT_URL', 'RELATED_VIDEO', 'YT_CHANNEL', 'PLAYLIST'…
  detail text not null,                          -- termo como veio; URL SEM query string e sem fragmento; id de vídeo ou canal. Máximo de 300 caracteres
  period_days smallint not null default 1 check (period_days >= 1),   -- mais de 1 = "os 25 maiores do ano" da retroação
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  views bigint,
  watch_time_minutes numeric,
  source text not null check (source in ('reporting_api', 'analytics_api')),   -- lote = por dia; Analytics = só a retroação por ano
  source_report_id text,
  report_create_time timestamptz,
  collected_at timestamptz not null default now(),
  metric_version text not null,
  primary key (youtube_video_id, day_pt, source_type, detail)
);
create index if not exists idx_yt_own_traffic_detail_channel on public.yt_own_video_traffic_detail_daily (channel_id, source_type, day_pt);

-- 3. Impressões por origem e por dispositivo (só existe em lote).
create table if not exists public.yt_own_video_reach_dim_daily (
  youtube_video_id text not null,
  day_pt date not null,
  traffic_source_type text not null,
  device_type text not null,
  operating_system text not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  thumbnail_impressions bigint,
  thumbnail_ctr numeric,                         -- 0 a 1, como veio (igual a yt_own_video_reach_daily)
  source_report_id text not null,
  report_create_time timestamptz not null,
  collected_at timestamptz not null default now(),
  metric_version text not null,
  primary key (youtube_video_id, day_pt, traffic_source_type, device_type, operating_system)
);
-- RLS nas três, no padrão das yt_own_*: enable row level security; drop policy if exists; select por can_edit_site(site_id); escrita só service role.
-- A cobertura reaproveita yt_own_video_coverage (7.1): o check de metric_set ganha
--   'trafego', 'dispositivo', 'pais', 'inscrito', 'detalhe', 'alcance_dim'.
```

- **Gravação esparsa, no padrão da dieta.** Só existe linha onde houve atividade (alguma métrica diferente de zero). `yt_own_video_coverage` diz, por vídeo e conjunto, quais dias foram coletados. Leitura: dia coberto sem linha para um valor = **zero medido** naquele valor; dia fora da cobertura = **não medido**. Vídeo sem view no diário na janela não gera consulta de dimensão: a cobertura dele avança sozinha (zero views não têm origem), e isso é o que mantém a coleta barata num canal parado.
- **Escrita atômica.** `yt_own_dim_apply` (linhas, dias devolvidos, conjunto), no molde de `yt_own_daily_apply`: grava, apaga a linha de um dia revisado para zero, estende a cobertura. Para as duas tabelas de lote, o molde é `yt_own_reach_apply`: **relatório de `create_time` maior substitui; mais velho nunca passa por cima**.
- **Normalizadores de lote** (`channel_traffic_source_a3`, `channel_reach_combined_a1`): validam o cabeçalho contra um CSV **real** exportado, como `reach-csv.ts` (fixture sintética não vale, runbook de coleta seção 7). Cabeçalho diferente do esperado = erro e nenhuma linha.
- **Limiar do YouTube, dito na tela.** A API omite valores pequenos ("search terms and URLs that lead very small numbers of views will not appear"; o mesmo para origens). A soma das linhas de um dia pode ficar **abaixo** das views do diário: a tela mostra a diferença como "omitido pelo YouTube", nunca a redistribui.
- **Coleta diária.** Passo novo "dimensões", depois do diário e antes da retenção, com teto próprio dentro do relógio do cron (o plano refaz a soma dos tetos, hoje 200 s de 270 s); janela de 10 dias como o diário (o YouTube revisa os últimos dias); até quatro consultas por vídeo **com view na janela**; o que não couber grava `nao_alcancado_orcamento` e entra primeiro na execução seguinte. Os lotes entram pelo passo de relatórios que já existe.
- **Retroação.** Uma leva, espalhada por dias (`sha256 mod 7`), vídeo a vídeo, da publicação até hoje: para os 35 vídeos, cerca de 140 consultas de dimensão (mais as de país por mês, se a conferência 1 der "não": cerca de 2.500, espalhadas em duas semanas). Roda fora do cron diário, por um comando com retomada.
- **Termos de pesquisa e sites externos: acesso restrito.** Só quem **edita** o site lê, pelo mesmo token de edição da A4 (`EdicaoDoSite`, `lib/proprio/edicao.ts`): o leitor exige o token, não um booleano. **Não entram em nenhum pacote da forja nem em nenhum endpoint do Cowork.** A URL externa é gravada **sem a query string e sem o fragmento** (é ali que costumam vir e-mail, token e identificador de campanha), cortada na escrita, com teste. Um termo de pesquisa pode ser o nome de uma pessoa: por isso fica do lado privado e nunca é agregado numa tela que um usuário só de leitura veja.
- **Volume.** Retroação: o canal de hoje tem 2.455 dias de vídeo com atividade em 11 anos; a cerca de 12 linhas por dia ativo e 250 B por linha, **cerca de 7 MB uma vez**. Daqui para a frente, no ritmo de hoje (cerca de 220 dias de vídeo ativos por ano): **cerca de 1 MB por ano**. Se o canal crescer até o modelo do inventário (40 vídeos, 30% dos dias com view): 13 MB de dimensões, 3 MB de detalhe e 3 MB de alcance por dimensão, **cerca de 19 MB por canal por ano**. A tabela cresce com as views, não com o calendário. Entra na conta de 9.3.
- **Telas** (todas com mockup antes; 6.2 e 6.5): na página do vídeo próprio e na do canal próprio, "De onde vêm as views", "O que pesquisaram e de que sites vieram", "Em que aparelho", "De que país", "Inscritos e não inscritos"; o cartão "Só o seu canal mede" ganha as linhas correspondentes.
- **Outros pontos tocados:** `youtube_channel_removal_impact` recriada com as três tabelas; semente e2e; `database.types.ts`.

### 7.4 Ligar os relatórios em lote e guardar o bruto (etapa E12: a primeira do canal próprio)

**Decisão do dono (12/10, a que vale):** "vamos fazer como você recomendou e salvar os brutos de uma vez". É a primeira etapa do canal próprio porque é a única em que esperar custa dado: um relatório em lote só existe para os dias em que o job existia (ao ser ligado, cada tipo traz os 30 dias anteriores e mais nada).

**O que "ligar" exige, conferido no código (VERIFICADO; nenhuma migration).**

| O quê | Onde | Hoje | Passa a |
|---|---|---|---|
| A lista de tipos pedidos | `REPORT_TYPES_ENABLED`, `lib/youtube/reporting/types.ts:4-9` ("habilitar um tipo é um commit de uma linha") | 4 tipos | mais 10: `channel_combined_a3`, `channel_device_os_a3`, `channel_playback_location_a3`, `channel_province_a3`, `channel_demographics_a1`, `channel_subtitles_a3`, `channel_cards_a1`, `channel_end_screens_a1`, `channel_sharing_service_a1`, na versão que `reportTypes.list` devolver sem `deprecateTime` (NC qual é a corrente: a documentação cita `_a2` para dois deles). Anotações (descontinuadas) e os tipos de playlist ficam fora |
| O job de cada tipo | passo de jobs (`coleta/jobs-step.ts`): cria no ciclo seguinte e tira a linha de `desativado` | `desativado` | `ativo`, sem ação manual |
| O teto de download por execução | `MAX_DOWNLOADS`, `coleta/reports-step.ts:15` | 40 | o bastante para esvaziar a fila em menos de 20 dias: 10 tipos × 30 dias × 2 canais são cerca de 600 relatórios de histórico, **que vencem em 30 dias**, mais os 104 já na fila. O plano mede o tempo por download e fixa o número dentro do relógio do cron |
| O teto de tamanho por relatório | `MAX_GZ_BYTES`, `coleta/reports-step.ts:16`; acima dele o relatório vira `erro: grande_demais` e **não é guardado** | 2 MB comprimido | um teto que nenhum relatório real alcance (proposta: 10 MB), com o maior tamanho visto anotado |
| A ordem de prioridade | a ordem da lista é a prioridade de download | alcance primeiro | alcance, tráfego, e depois os novos |

- **Onde o bruto fica:** em `yt_reporting_report_blobs.csv_gz` (o CSV comprimido, dentro do banco), como hoje. **Validade:** na origem, 60 dias depois de gerado (30 para os de histórico); no banco, o tipo sem normalizador é apagado 180 dias depois do download (`yt_reporting_blobs_purge`), ou seja, **a partir de abril de 2027**. A E10 troca essa regra para "só apaga o que já foi exportado e confirmado" (9.2); com a fase de manutenção marcada pelo dono para a semana que vem, o bruto tem para onde ir muito antes disso.
- **Volume:** os 160 relatórios guardados hoje somam 21 kB. Com 14 tipos e o canal de hoje, da ordem de centenas de kB por ano; num canal ativo, cerca de 3 MB por canal por ano.
- **O que isso passa a guardar e que não existe por outro caminho:** demografia **por dia**; cartões e telas finais **por elemento**; idioma de legenda usado; e o **cruzamento** das dimensões na mesma view (origem × dispositivo × país × local de reprodução). Nada disso ganha tabela nem tela nesta fase: fica guardado para quando houver pergunta.
- **O que já está ligado e tem data para vencer** (os jobs existem; falta baixar):
  1. **Termos de pesquisa e sites por vídeo e dia.** Em 12/10 há **38 relatórios de `channel_traffic_source_a3` listados e não baixados** (e 66 de `channel_basic_a3`). Os de histórico, que cobrem de 08/09 a cerca de 08/10/2026, **vencem na origem a partir de cerca de 07/11/2026**. O que não for baixado até lá não volta: a Analytics API só devolve os 25 maiores por período. Subir o teto de download resolve os dois de uma vez.
  2. **Impressões por origem e por dispositivo.** Só existem em lote, desde 08/09/2026; os 21 relatórios estão baixados.
- **Sem tela e sem leitor:** a E12 só guarda. Nada do bruto é lido por tela, pela forja ou pelo Cowork; a leitura é só de quem edita o site (RLS de hoje).

## Itens de aceite deste arquivo (blocos da seção 10 do spec, com a numeração original)

**E6: dieta**
42. Depois de P1: `C = T` (seção 7) e, para cada vídeo, um intervalo por conjunto.
43. Depois de P2, por 3 execuções: nenhuma linha nova sem atividade; `max(covered_to)` avança a cada dia em todos os vídeos; as telas da A4 mostram os mesmos números de antes (views por dia do canal: "35" na semente; conferência nas três telas).
44. Leitor: dia coberto sem linha vira `views: 0`; dia fora da cobertura não vira linha; canal parado com cobertura em dia **não** diz "coleta parada" (teste com o perfil "parado" da semente).
45. Coleta: num vídeo sem view há dois anos, a janela pedida à API começa em `hoje − 10`, não há dois anos (teste).
46. Dia revisado para zero pelo YouTube tem a linha apagada e continua coberto (teste da função).
47. Depois de P3: as cinco igualdades da conferência de contagem, anotadas com os números do dia, antes e depois.
48. `pg_total_relation_size('yt_own_video_daily')` menor que 2 MB depois do `vacuum full`.
49. Ensaio do plano de volta no banco local: restaurar do backup devolve `T` linhas e as telas não mudam.
50. **NP-E6:** `select count(*) from youtube_videos v where not exists (select 1 from yt_own_video_coverage c where c.youtube_video_id = v.youtube_video_id and c.metric_set = 'base' and c.covered_to >= current_date - 4)` = 0 (4 dias = atraso de 2 a 3 dias da fonte mais um).

**E8: curva de retenção do canal próprio**
58. A conferência de leitura de 7.2 foi feita **antes** da migration, e o ledger traz: o vídeo usado, as duas consultas, se as curvas diferem (caso A ou B) e as duas respostas guardadas como fixture.
59. Depois da primeira leva (7 dias): `select count(*) from youtube_videos v where not exists (select 1 from yt_own_video_retention r where r.youtube_video_id = v.youtube_video_id and r.window_kind = 'vida') and not exists (select 1 from yt_own_collection_attempts a where …retenção deste vídeo…)` = 0: todo vídeo tem curva **ou** tentativa com motivo.
60. Reler no mesmo dia não cria linha; na semana seguinte, com views novas, cria; **sem views novas, a API não é chamada** (teste que conta as chamadas).
61. Resposta sem ponto grava a tentativa `sem_dado_na_janela` e nenhuma linha; ponto com campo ausente fica nulo; `ratio` maior que 1 é preservado; resposta com 37 pontos grava `point_count = 37`.
62. A API recusando uma métrica: a coleta repete com as duas básicas e `metrics_returned` diz o que veio (teste com resposta de erro).
63. Usuário sem `can_edit_site` não lê `yt_own_video_retention` (teste de RLS com o GUC forjado por papel sem superusuário).
64. A seção "Retenção" da página do vídeo próprio foi vista em navegador com dado real nos três estados (coletada, não coletada, "o YouTube não devolveu curva"), a 1440 e 390 px, nos dois temas; a frase "metade das pessoas já saiu aos m:ss" confere à mão com os pontos em dois vídeos; a data da leitura está na tela.
65. **NP-E8:** todo vídeo próprio cujo diário ganhou views nos últimos 14 dias tem leitura ou tentativa de retenção nos últimos 8 dias (consulta = 0 faltando).

**E11: canal próprio em tabelas**
83. As quatro conferências de leitura de 7.3 feitas **antes** da migration e anotadas no ledger (país por dia aceito ou não; o CSV real traz ou não os termos; até onde o detalhe por período retroage; a cota da Analytics API), com as respostas guardadas como fixture.
84. Os dois normalizadores (`channel_traffic_source_a3`, `channel_reach_combined_a1`) processaram todo relatório `baixado` do tipo: `select count(*) from yt_reporting_reports where status = 'baixado' and normalized_at is null and report_type_id in (…)` = 0, e o bruto anterior à etapa (desde 08/09/2026) também foi normalizado.
85. Gravação esparsa: nenhuma linha das três tabelas com todas as métricas zeradas ou nulas; dia coberto sem linha lê como zero naquele valor; dia fora da cobertura lê como "não medido" (teste do leitor que **apaga** a cobertura).
86. Normalizador: cabeçalho de CSV diferente do esperado dá erro e nenhuma linha (teste com o CSV real e com uma coluna trocada).
87. Relatório mais novo substitui o mais velho; o mais velho, chegando depois, não muda nada (teste das funções de gravação).
88. URL externa gravada sem query string e sem fragmento, com no máximo 300 caracteres (teste com `?utm_source=…&email=…#x`).
89. Termos e sites: o leitor só aceita o token de edição; usuário só de leitura não os vê no HTML nem no RSC; papel sem `can_edit_site` não lê as três tabelas (RLS com o GUC forjado); nenhuma resposta de endpoint do pipeline (Cowork e forja) contém linha de `yt_own_video_traffic_detail_daily` (teste que varre as respostas com um termo sentinela na semente).
90. Retroação concluída: a cobertura de cada conjunto começa na publicação de cada vídeo, ou no limite que a API devolveu, anotado por conjunto; para todo vídeo e dia, a soma das views por origem é menor ou igual às views do diário, e a diferença aparece na tela como "omitido pelo YouTube".
91. A coleta diária cabe no relógio do cron: o passo "dimensões" tem teto, grava `nao_alcancado_orcamento` quando não chega, e o que ficou para trás entra primeiro na execução seguinte; vídeo sem view na janela não gera chamada (teste que conta as chamadas).
92. **NP-E11:** todo vídeo próprio com views nos últimos 14 dias tem cobertura dos conjuntos `trafego`, `dispositivo`, `pais` e `inscrito` até `current_date - 4` (consulta = 0 faltando).
93. As seções novas das páginas do vídeo e do canal próprios foram vistas em navegador, com mockup aprovado antes, nos estados vazio, parcial e cheio, a 1440 e 390 px, nos dois temas; `youtube_channel_removal_impact` conta as três tabelas.

**E12: relatórios em lote e bruto**
94. Um ciclo depois do deploy, todo tipo da lista tem job `ativo` nos dois canais: `select report_type_id, status, count(*) from yt_reporting_jobs group by 1, 2` não mostra nenhum tipo da lista em `desativado` (ou mostra `tipo_indisponivel` com o motivo anotado, se a API não oferecer o tipo ao canal).
95. **Nada vence sem ser baixado:** `select count(*) from yt_reporting_reports where status = 'listado' and create_time < now() - interval '20 days'` = 0 e `select count(*) from yt_reporting_reports where status = 'expirado_sem_baixar' and create_time > '<deploy>'` = 0, conferidos antes de 01/11/2026 e em todo dia dos 30 seguintes.
96. Nenhum relatório em `erro` com `grande_demais`; o maior `bytes` visto está anotado e fica abaixo da metade do teto novo.
97. A execução do cron continua dentro do relógio com o teto de download novo (duração do passo de relatórios anotada em três execuções), e o tamanho de `yt_reporting_report_blobs` depois de 30 dias está anotado e comparado com a estimativa de 7.4.
