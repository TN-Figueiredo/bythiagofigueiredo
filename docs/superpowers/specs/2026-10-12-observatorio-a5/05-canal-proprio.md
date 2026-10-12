# Observatório, fase A5 (spec v2.3), parte 05: canal próprio

> Parte do spec da A5 v2.2, dividido em 12/10/2026 só movendo texto (nenhuma frase mudou; a numeração de seções, etapas, migrations, perguntas e itens de aceite é a do original). Índice, cabeçalho "O que mudou" e tabela "onde está cada seção": [`../2026-10-12-observatorio-a5-concorrentes-design.md`](../2026-10-12-observatorio-a5-concorrentes-design.md).

> **v2.3 (12/10/2026, resposta ao portão de fim de spec).** Este arquivo recebeu emendas localizadas, todas marcadas "v2.3" com o achado ou a decisão que as pediu, e duas seções novas: **7.5 (etapa E18, versões do vídeo próprio, MG12 e MG17)** e **7.6 (etapa E20, guarda do bruto dos relatórios, MG13)**. A numeração antiga não mudou. Os três passos de migration da dieta ganharam número: **P1 = MG14, P3 = MG15, P4 = MG16**. Onde um trecho antigo divergir de uma emenda v2.3, vale a emenda. Respostas aos revisores: `.superpowers/sdd/a5/resposta-revisao-spec.md`.

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
    'trafego', 'dispositivo', 'pais', 'inscrito', 'detalhe', 'alcance_dim',     -- conjuntos da E11 (7.3); já entram no check para não haver segunda migration
    'meta_texto', 'meta_thumb')),                                               -- v2.3: conjuntos da dieta de yt_own_video_meta_daily (7.5.10)
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
-- leitura: bloco PL, logo abaixo (v2.3, achado I11 da revisão de software)
```

**Bloco PL: a policy de leitura de toda tabela privada do canal próprio (v2.3).** O direito "ver desempenho privado" foi aprovado pelo dono (decisão 32). A função `can_view_private_site` nasce na MG11 (8.1.4), que pode ser aplicada antes ou depois das migrations deste arquivo. Para a ordem não importar, **toda tabela privada deste arquivo (7.1, 7.2, 7.3 e 7.5) e as duas tabelas de texto de comentários (4.6.7) criam a policy por este bloco**, trocando `<tabela>` pelo nome:

```sql
do $$
declare v_fn text := case when to_regprocedure('public.can_view_private_site(uuid)') is not null
                          then 'public.can_view_private_site(site_id)' else 'public.can_edit_site(site_id)' end;
begin
  execute 'drop policy if exists "<tabela>_select" on public.<tabela>';
  execute format('create policy "<tabela>_select" on public.<tabela> for select using (%s)', v_fn);
end $$;
-- Nenhuma policy de escrita: insert, update e delete só por service role.
```

A MG11 troca, pelo mesmo bloco, a policy de toda tabela da lista de 8.1.4 que já exista. **A prova é o item 191:** depois de todas as migrations, em qualquer ordem, nenhuma tabela da lista fica em `can_edit_site`. Quem lê, em palavras: sem o direito e sem edição, não lê; com o direito, lê; ninguém escreve.

- **D10. Leitura:** para uma métrica do conjunto S, o dia D do vídeo V é **zero medido** se existe intervalo de (V, S) que contém D e não há linha; é **o valor da linha** se há linha (coluna nula na linha continua "não medido" daquela métrica); é **não medido** se nenhum intervalo contém D. Dia que a fonte não devolveu dentro de uma janela pedida **parte o intervalo** (hoje não há nenhum caso; a forma existe para não mentir se houver). Há dois conjuntos porque as métricas estendidas podem ser recusadas pela API (`estendidas: 'recusadas'`): sem isso, um dia sem linha diria "0 impressões de cartão" de um dia em que elas nem foram pedidas.
- **D11. Escrita atômica.** Função `yt_own_daily_apply(p_video text, p_ids jsonb, p_rows jsonb, p_days_returned date[], p_sets text[])`, no molde de `yt_own_reach_apply` (`execute` só para `service_role`): na mesma transação (1) grava as linhas com atividade, sem deixar valor ausente no envio apagar valor gravado; (2) **apaga** a linha de um dia devolvido que agora não tem atividade (o YouTube revisa os últimos dias); (3) estende ou parte os intervalos de cobertura com os dias devolvidos, fundindo vizinhos.
- **D12. Efeito na coleta** (`coleta/diario-step.ts`): o "último dia gravado" de cada vídeo (`:105-110`, hoje `max(day_pt)` do diário) passa a ser `max(covered_to)` do conjunto `base`. Sem isso, num canal parado a janela recomeçaria no último dia **com view**, anos atrás, todo dia. O envio em lotes de mesma assinatura (`:186-212`) é substituído pela função.
- **D13. Efeito nos leitores da A4** (`lib/proprio/`): a mudança fica **inteira dentro de `ler.ts`**. `lerDiario` lê também os intervalos da janela e **devolve as mesmas `DiarioLinha`**, materializando `views: 0` para dia coberto sem linha; `ultimoDia` passa a ser o `max(covered_to)`. `tipos.ts`, `vpd.ts`, `dias.ts` e os modelos de tela não mudam: para eles "zero é linha, falta de linha é não medido" continua verdade, agora na fronteira do leitor. O leitor tolera os dois estados do banco (antes e depois da dieta), o que permite publicar o código antes de apagar qualquer coisa. A Tarefa 2 da A4 (`avg_view_percentage`, `avg_view_duration_seconds`) não é afetada: esses valores só existem em dia com view.
- **D14. Outros pontos tocados:** `youtube_channel_removal_impact` recriada com a tabela nova em `serie_coletada`, e `youtube_channel_remove` conferida (a cobertura tem `on delete restrict` no canal, como o diário); a semente e2e (`e2e/fixtures/observatorio-seed.ts:292`, `:412`) passa a semear cobertura e a limpar a tabela nova; `database.types.ts` regenerado.

**Migração dos dados existentes: destrutiva, só com o dono, em quatro passos separados por conferência.**

| Passo | O que | Reversível? |
|---|---|---|
| **P1** (migration aditiva; **MG14** na v2.3) | cria `yt_own_video_coverage` e `yt_own_daily_apply`; preenche a cobertura a partir das linhas existentes (ilhas de dias seguidos por vídeo, um conjunto para `views is not null`, outro para `engaged_views is not null`); recria a função de impacto. **Não apaga nada** | sim (`drop table`) |
| **P2** (código) | leitor tolerante (D13) e coleta pela função (D11, D12) em produção; observar **3 execuções** do cron das 12:00 UTC | sim (reverter o commit) |
| **P3** (com o dono, fora da janela 11:30 a 13:00 UTC; a migration do passo (iii) é a **MG15** na v2.3) | (i) cópia fora do banco: `\copy (select * from yt_own_video_daily order by youtube_video_id, day_pt) to 'yt_own_video_daily-AAAAMMDD.csv' csv header`, guardada pelo dono; (ii) contagens "antes" (abaixo) anotadas; (iii) migration: `create table if not exists yt_own_video_daily_zeros_bkp as select …` das linhas sem atividade **e cobertas**, com RLS ligada, sem policy e `revoke all from anon, authenticated`; `delete` das mesmas linhas; (iv) contagens "depois"; (v) `vacuum full public.yt_own_video_daily` (comando à parte: não roda dentro de migration; trava a tabela por segundos) | sim: `insert into yt_own_video_daily select * from yt_own_video_daily_zeros_bkp on conflict do nothing` |
| **P4** (com o dono, 14 dias ou mais depois; **MG16** na v2.3) | `drop table yt_own_video_daily_zeros_bkp` | só pelo CSV, ou pedindo de novo à Analytics API (ela devolveu a vida inteira dos vídeos em 35 chamadas; não é garantia documentada) |

**v2.3: a MG14 leva também a troca do `check` de `yt_own_collection_attempts.kind`** (achado I-10 da revisão de dados). Hoje ele só aceita `'sondagem', 'meta', 'thumbnail', 'relatorio', 'diario', 'retencao_vida'` (`20261007000006_coleta_canais_proprios_l1a.sql:104`): as janelas de 7 e de 30 dias da retenção, o passo "dimensões" e os normalizadores não conseguiriam gravar tentativa, e os itens 59, 65 e 91 dependem disso. A lista sai do banco e vira catálogo no código (`COLLECTION_KINDS`, com teste que falha se um `kind` for gravado fora dele), para a próxima etapa não pedir migration:

```sql
alter table public.yt_own_collection_attempts drop constraint if exists yt_own_collection_attempts_kind_check;   -- NC: o nome da constraint; conferir com \d antes (C0.8)
alter table public.yt_own_collection_attempts
  add constraint yt_own_collection_attempts_kind_check check (kind ~ '^[a-z0-9_]{1,40}$');
```

Valores novos do catálogo: `retencao_7d`, `retencao_30d`, `dimensoes`, `normalizador_trafego`, `normalizador_alcance_dim`. Por ser a primeira migration do canal próprio na ordem de aplicação (seção 14) *(v2.3, 2ª passada, m-5 de dados: a primeira **da dieta**; a primeira do canal próprio é a MG13)*, a MG14 é aditiva e convive com o código que está em produção (o código antigo só grava os seis valores antigos, todos aceitos pela expressão nova).

**Conferência de contagem (invariantes; os números mudam todo dia, as igualdades não).** Antes de P3: `T` = linhas do diário; `A` = linhas com atividade; `Z = T − A`; `S` = soma de `views`; `C` = soma de `(covered_to − covered_from + 1)` do conjunto `base`. Exigido antes: `C = T`. Exigido depois: linhas = `A`; soma de `views` = `S`; linhas no backup = `Z`; `C` inalterado; para cada vídeo, dias cobertos sem linha = linhas dele no backup. Em 12/10: `T` = 96.892, `A` = 2.455, `Z` = 94.437.

**Plano de volta.** Até P4, o comando da tabela acima mais reverter o código de P2 (o leitor tolerante funciona nos dois estados, então a ordem não importa). O que não volta: o espaço, que o `vacuum full` devolveu.

**Ganho.** Tabela de 72 MB para menos de 1 MB (2.455 linhas); backup temporário de cerca de 23 MB até P4; depois, 71 MB livres. A regravação diária de 350 linhas (35 vídeos × 10 dias) some: é ela que inflou a tabela a três vezes o tamanho dos dados.

### 7.2 Curva de retenção do vídeo próprio (etapa E8)

**Decisão do dono (12/10):** "eu quero a curva de retenção sim… quero curva de retenção no site sim". É o equivalente, para os vídeos dele, aos "momentos mais vistos". É dado **autorizado** de Analytics: pode ser guardado por mais de 30 dias (fato 16), com a conferência de autorização que a coleta já faz a cada chamada (`authorization_verified_at`).

**Unidade (escrita na tela).** Cada ponto da curva é um par: **fração do vídeo** (`t`, de 0,01 a 1,00: cem posições, cada uma 1% da duração) × **fração da audiência** (`ratio`, o `audienceWatchRatio` do YouTube: quantas reproduções passavam por aquele trecho, divididas pelas views do vídeo). `ratio` **pode passar de 1** (trecho revisto, ou início de Short em repetição); nunca é cortado em 1. Minuto e segundo são derivados (`t` × duração), não gravados.

**Primeiro passo da etapa, antes de qualquer migration: uma conferência de leitura.** O inventário deixou não confirmado se a consulta respeita o período pedido. A conferência é uma só, sem gravar nada: para **um** vídeo com views recentes, pedir `reports.query` com `dimensions=elapsedVideoTimeRatio`, `metrics=audienceWatchRatio`, `filters=video==<id>;audienceType==ORGANIC` **duas vezes**: da publicação até hoje, e só os últimos 28 dias. Curvas diferentes = a API aceita período (caso A). Curvas idênticas ponto a ponto = só existe o acumulado (caso B). Erro na segunda = caso B, com o erro anotado. O resultado vai para o ledger, com as duas respostas guardadas como fixture de teste. Feita com o acesso do canal que o site já tem; é leitura. **v2.3 (achado I-1 da revisão de dados): esta conferência estava sem dono** (a seção 14 a punha junto da E12, e o plano da E12 a excluiu). Passa a ser a **C0.1** da ordem 0 da sequência, com quem faz e quando escritos lá.

| | **Caso A: a API aceita período** | **Caso B: só o acumulado** |
|---|---|---|
| O que se coleta | `vida` (publicação até hoje), relida quando o vídeo teve views novas e no máximo uma vez por semana; mais `primeiros_7_dias` e `primeiros_30_dias`, **uma vez** cada, quando a janela fecha | só `vida`, com a mesma regra de releitura |
| O que dá para retroagir | ~~**tudo**: as três janelas dos 35 vídeos, numa leva (cerca de 105 consultas, espalhadas em 7 dias)~~ **v2.3 (decisão 32 do dono): nada é retroagido.** `vida` é lida do deploy em diante (é o estado de hoje, não retroação); `primeiros_7_dias` e `primeiros_30_dias` só para vídeo cuja janela fecha depois do deploy. O que a API devolveria para trás continua recuperável se o dono mudar a decisão | **só a curva acumulada de hoje.** Como a curva de 2019 de um vídeo de 2015 era diferente, e ninguém a guardou, a evolução **começa no dia do deploy**: cada semana sem coletar é uma leitura que não volta |
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
  requested_end date not null,              -- v2.3: o fim PEDIDO à API; window_end é o último dia que ela de fato cobriu (a API trunca ao último dia processado)
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
-- leitura: bloco PL de 7.1 (v2.3); escrita só por service role
-- v2.3: metric_version NÃO tem check nesta tabela nem nas de 7.3: o catálogo é a constante METRIC_VERSIONS no código,
--       com teste; a próxima mudança de contagem do YouTube não pede alterar quatro checks.
```

- **Chave.** Uma linha por vídeo, janela, segmento e data de leitura: reler na semana seguinte cria linha nova (é o histórico da curva); reler no mesmo dia regrava a mesma. `youtube_channel_removal_impact` é recriada contando a tabela nova, e `youtube_channel_remove` conferida (`on delete restrict`, como o diário).
- **Coleta.** É o passo "retenção" já previsto no spec de coleta (seção 6, lote L3, e seção 7: último da ordem, teto de 40 s): `dimensions=elapsedVideoTimeRatio`, `filters=video==<id>;audienceType==ORGANIC`, métricas `audienceWatchRatio`, `relativeRetentionPerformance`, `startedWatching`, `stoppedWatching`, `totalSegmentImpressions`; se a API recusar métrica, repete só com as duas primeiras e `metrics_returned` diz o que veio. Um vídeo vence 7 dias depois da última linha ou tentativa; **e só é relido se `views` do diário cresceu desde `views_at_read`** (regra nova: num canal com 36 views em 90 dias, quase nenhum vídeo vence). Primeira leva espalhada por `sha256(uuid) mod 7`. Cota: uma consulta da Analytics API por vídeo e leitura; não toca a cota da Data API.
- **Zero × não medido.** Sem linha = "não coletada". Resposta sem ponto = tentativa `sem_dado_na_janela` em `yt_own_collection_attempts`, e a tela diz "o YouTube não devolveu curva para este vídeo (poucas views)". Ponto com campo ausente = nulo. Nunca curva inventada, nunca reta em zero.
- **Volume.** Cerca de 1,5 kB por linha (comprimida). Com a regra de views novas: da ordem de 1,5 MB por canal por ano; pior caso (todos os vídeos toda semana) 3 a 7 MB. Entra no ciclo de vida (9.2): a leitura mais recente de cada vídeo e janela nunca sai do online; as anteriores seguem a idade de corte.
- **Leitor e tela.** Leitor novo em `lib/proprio/` que devolve, por vídeo, a curva mais recente e a lista das datas de leitura; modelo com: o ponto em que a curva cruza 0,5 ("metade das pessoas já saiu aos m:ss"; se nunca cruza, "mais da metade fica até o fim"); as maiores quedas entre pontos vizinhos; os trechos em que `ratio` sobe (revistos); e `relative` como faixa ("acima / na média / abaixo de vídeos de duração parecida", cálculo do YouTube, dito assim). A seção fica na **página do vídeo próprio**; o canal não ganha tela própria da curva. O mockup de exemplo já existe; o definitivo é refeito com o dado real (6.5, mockup 11).
- **Quem não lê.** Nenhum pacote da forja (o escopo da fase 2a dela exclui retenção) e nenhum endpoint do Cowork nesta fase.
- **Relação com a A4.** A lacuna P2-3 da `REVISAO.md` ("a curva espera o lote L3, que tem migration") é esta etapa. A seção "Retenção: não coletada" das Tarefas 12 e 13 da A4 continua valendo até a E8 entregar.

### 7.3 Canal próprio em tabelas: origem de tráfego, termos de pesquisa, dispositivo, país, inscrito (etapa E11)

**Decisão do dono (12/10).** O canal próprio entra de uma vez, já em tabelas, com coleta diária e retroação: "vamos preparar para já colocar tudo de uma vez". **v2.3: a retroação caiu.** Decisão 32 do dono, do mesmo dia e posterior: "Retroação do canal próprio até 2015: NÃO. Do meu passado tem pouca coisa, estou criando canais novos. Quero é daqui a 5 anos ainda ter os dados de 5 anos meus e dos concorrentes." A coleta é para a frente; o ponto de partida de cada conjunto está no bullet "Ponto de partida", abaixo. **Onde a tabela e os bullets seguintes falarem em retroagir, vale esta frase.** É a etapa E3 do inventário. Vem **depois** da E12 (7.4), que liga os relatórios em lote e guarda o bruto, e por isso pode normalizar também o bruto que já estiver guardado. Continuam **fora**: o diário ampliado e a demografia em tabela (12.1).

**Cinco famílias, três tabelas, uma fonte por tabela** (duas fontes na mesma tabela obrigariam a conciliar dias e limiares diferentes; o spec de coleta já registra que as duas fontes não documentam o mesmo "dia").

| Família | Tabela | De onde vem | Até onde retroage | Unidade |
|---|---|---|---|---|
| **Origem de tráfego** (pesquisa, sugeridos, navegação, externo, Shorts, playlist…) por vídeo e dia | `yt_own_video_dim_daily`, `dim_kind = 'traffic_source'` | **Analytics API**, `dimensions=day,insightTrafficSourceType`, uma consulta por vídeo | até a publicação de cada vídeo (a API devolve para trás; empírico no diário: desde 2015) | views; minutos assistidos |
| **Dispositivo e sistema** | idem, `'device_os'` (valor `MOBILE\|ANDROID`) | Analytics API, `day,deviceType,operatingSystem` | idem | idem |
| **País** | idem, `'country'` (ISO de duas letras; `ZZ` = não identificado) | Analytics API. **NC se `day,country` é aceito numa consulta só** (conferência 1, abaixo). Se não for: daqui para a frente, uma consulta por vídeo com `startDate = endDate`; para trás, por mês de calendário | por dia, ou por mês se a conferência disser que não (a linha de mês leva `period_days` e a tela diz "no mês") | idem |
| **Inscrito × não inscrito** | idem, `'subscribed_status'` | Analytics API, `day,subscribedStatus` (vem sem custo: mais uma consulta por vídeo) | desde 15/12/2015 (limite da API) | idem |
| **Termos de pesquisa e sites externos** (o detalhe da origem), por vídeo e dia | `yt_own_video_traffic_detail_daily` | **relatório em lote** `channel_traffic_source_a3` (job **já ligado** desde 08/10). A Analytics API só dá os 25 maiores de um período, sem dia. **NC se o CSV traz o termo em `traffic_source_detail`** (conferência 2) | **só desde 08/09/2026**, e só se os relatórios forem baixados a tempo (abaixo). Antes disso: os 25 maiores por ano, pela Analytics API, em tabela de período (NC até onde: conferência 3) | views; minutos |
| **Impressões e taxa de clique por origem e por dispositivo** | `yt_own_video_reach_dim_daily` | **relatório em lote** `channel_reach_combined_a1` (já ligado; 21 baixados). Só existe em lote | só desde 08/09/2026 | impressões; taxa de clique de 0 a 1 |

**v2.3, sobre a coluna "Até onde retroage":** ela fica como registro do que a API devolveria se a decisão 32 mudar. Sem retroação não existe linha de mês (país) nem de ano (os 25 maiores termos): `period_days` saiu das duas tabelas (achado C-3c da revisão de dados).

**Nenhuma destas famílias espera um job novo:** as duas que dependem de lote usam tipos que já estão ativos. O que falta é o **normalizador** (hoje só `channel_reach_basic_a1` tem; fato 17). Com a E12, os relatórios de dispositivo, país e inscrito também passam a existir em bruto, por vídeo e dia e sem o limiar da Analytics API: ficam como conferência e como fonte de troca futura, mas **a tabela continua com uma fonte só** (a Analytics API, que é a que retroage).

**Conferências de leitura, antes da migration** (sem gravar nada; resultado no ledger): (1) `reports.query` com `dimensions=day,country` e filtro de um vídeo: aceita ou dá 400; (2) abrir um CSV real de `channel_traffic_source_a3` já baixado e ver se `traffic_source_detail` traz termos de pesquisa e URLs; (3) pedir o detalhe (`insightTrafficSourceDetail`, `YT_SEARCH`) de um vídeo antigo para 2019 e ver se volta dado; (4) a cota diária da Analytics API no console do Google (o inventário não a confirmou). **v2.3:** são a **C0.2** da ordem 0 da sequência. A conferência 3 perdeu o efeito com a decisão 32 e fica só anotada.

**DDL proposto (migration MG7).**

```sql
-- 1. Uma linha por vídeo × dia × valor da dimensão. ESPARSA: só existe linha onde houve atividade.
create table if not exists public.yt_own_video_dim_daily (
  youtube_video_id text not null,
  day_pt date not null,                          -- dia do YouTube, como no diário
  dim_kind text not null check (dim_kind in ('traffic_source', 'device_os', 'country', 'subscribed_status')),
  dim_value text not null,                       -- o código da API, sem tradução: 'YT_SEARCH', 'MOBILE|ANDROID', 'BR', 'SUBSCRIBED'
  -- v2.3: period_days retirado (sem retroação não há linha de período; achado C-3c)
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
  detail_hash text not null,                     -- v2.3 (C-3b): sha256 do detalhe INTEIRO, já normalizado (URL sem query e sem fragmento), ANTES do corte de 300; é ele que entra na chave
  -- v2.3: period_days retirado (achado C-3c)
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  views bigint,
  watch_time_minutes numeric,
  source text not null default 'reporting_api' check (source in ('reporting_api')),   -- v2.3: só lote (a retroação por ano, pela Analytics API, caiu)
  source_report_id text not null,                -- v2.3, 2ª passada (N-2 de dados): not null. Estavam anuláveis de quando havia a segunda fonte (a retroação, que caiu)
  report_create_time timestamptz not null,       -- idem; é por eles que o dia inteiro é substituído (bullet "Escrita atômica")
  collected_at timestamptz not null default now(),
  metric_version text not null,
  primary key (youtube_video_id, day_pt, source_type, detail_hash)   -- v2.3: era `detail`
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
  thumbnail_clicks_est numeric,                  -- v2.3 (C-3a), no lugar de thumbnail_ctr: soma de (impressões × taxa) das linhas do CSV que caem nesta chave.
                                                 --   A taxa é derivada na leitura (cliques estimados ÷ impressões): taxa não se soma nem se sobrescreve
  source_report_id text not null,
  report_create_time timestamptz not null,
  collected_at timestamptz not null default now(),
  metric_version text not null,
  primary key (youtube_video_id, day_pt, traffic_source_type, device_type, operating_system)
);
-- RLS nas três: enable row level security; leitura pelo bloco PL de 7.1 (v2.3); escrita só service role.
-- A cobertura reaproveita yt_own_video_coverage (7.1): o check de metric_set ganha
--   'trafego', 'dispositivo', 'pais', 'inscrito', 'detalhe', 'alcance_dim'.
```

- **Gravação esparsa, no padrão da dieta.** Só existe linha onde houve atividade (alguma métrica diferente de zero). `yt_own_video_coverage` diz, por vídeo e conjunto, quais dias foram coletados. Leitura: dia coberto sem linha para um valor = **zero medido** naquele valor; dia fora da cobertura = **não medido**. Vídeo sem view no diário na janela não gera consulta de dimensão: a cobertura dele avança sozinha (zero views não têm origem), e isso é o que mantém a coleta barata num canal parado.
- **v2.3 (achado C-4): a cobertura de dimensão nunca afirma mais do que o YouTube já processou, e a falta de linha tem três leituras, não duas.** (i) **Teto da cobertura:** a Analytics API tem atraso de 48 a 72 horas e, em consulta com dimensão, só devolve as combinações com dado: não existe "dias devolvidos" para a função receber. Por isso `yt_own_dim_apply` recebe a **janela pedida** (`p_from`, `p_to`) e grava a cobertura do conjunto até `least(p_to, max(covered_to) do conjunto 'base' do mesmo vídeo)`: um dia que o diário ainda não cobre não fica coberto na dimensão. O mesmo teto vale para o vídeo sem view na janela (a cobertura dele "avança sozinha" só até onde a `base` chegou). (ii) **Três estados por valor**, para o vídeo V, o dia D e a dimensão K, com `S` = soma das views das linhas de (V, D, K) e `B` = views de (V, D) no diário: fora da cobertura = **não medido**; coberto e com linha = **o valor**; coberto, sem linha e `S = B` = **zero medido**; coberto, sem linha e `S < B` = **"zero ou abaixo do limiar do YouTube"** (o YouTube omitiu `B − S` views; a tela mostra a diferença como "omitido" e não afirma zero para nenhum valor ausente daquele dia); `S > B` (o diário foi revisado e a dimensão ainda não) = **"em revisão"**, sem número, e a execução conta quantos dias ficaram assim. O leitor devolve o estado como valor nominal, nunca como `0` ou `null` solto. Itens 85 (corrigido) e 227. **v2.3, 2ª passada (m-3 de dados): como avança a cobertura dos dois conjuntos de lote.** `detalhe` e `alcance_dim` não têm "janela pedida". A cobertura do dia D avança quando o relatório daquele tipo para o dia D foi **normalizado sem erro**, e avança para **todos os vídeos do canal**, com ou sem linha (vídeo sem linha naquele dia cai nos estados de (ii)); dia sem relatório normalizado fica fora da cobertura ("não medido"). Em `alcance_dim` a comparação dos três estados é contra as **impressões de `yt_own_video_reach_daily`** do mesmo vídeo e dia (`S` = soma das impressões das linhas; `B` = impressões do alcance básico), não contra as views do diário; em `detalhe`, contra as views do diário, como escrito.
- **Escrita atômica.** `yt_own_dim_apply` (linhas, dias devolvidos, conjunto), no molde de `yt_own_daily_apply`: grava, apaga a linha de um dia revisado para zero, estende a cobertura. Para as duas tabelas de lote, o molde é `yt_own_reach_apply`: **relatório de `create_time` maior substitui; mais velho nunca passa por cima**. **v2.3 (achado C-3): o normalizador soma dentro do relatório antes de gravar.** O CSV de `channel_reach_combined_a1` traz também `traffic_source_detail`, que não está na chave de `yt_own_video_reach_dim_daily`: várias linhas caem na mesma chave (vídeo, dia, origem, aparelho, sistema). O normalizador soma `thumbnail_impressions` e `thumbnail_clicks_est` dessas linhas e grava **uma** linha por chave. Em `yt_own_video_traffic_detail_daily`, dois detalhes que ficam iguais depois de tirar a query string são somados (`views`, `watch_time_minutes`) e viram uma linha; dois detalhes que só diferem depois do 300º caractere são **duas** linhas, porque a chave usa `detail_hash`. Impressões por termo de pesquisa (que só existem nesse relatório) **não ganham tabela nesta fase**: ficam no bruto, que a E20 (7.6) impede de ser apagado; registrado em 12.1. Item 226. **v2.3, 2ª passada (N-2 de dados): nas duas tabelas de lote a substituição é do dia inteiro, não por linha.** O molde `yt_own_reach_apply` troca linha a linha por `on conflict`, o que só serve a tabela de **uma** linha por vídeo e dia. Aqui um dia tem várias linhas e a gravação é esparsa: se o relatório refeito não traz mais um termo (ou uma combinação de origem e aparelho), a linha do relatório velho ficaria, e a soma do dia misturaria dois relatórios. **Regra exata:** a unidade de substituição é **(canal, dia, tipo de relatório)**. A função de gravação recebe o relatório R (`source_report_id`, `report_create_time`) e, para cada dia D que R traz do canal C, na mesma transação: (1) se já existe linha de (C, D) naquela tabela com `report_create_time` **maior** que o de R, não grava nada daquele dia (o mais velho nunca passa por cima); (2) senão, **apaga todas as linhas de (C, D)** naquela tabela e grava as de R (o mesmo relatório processado de novo dá o mesmo resultado). Depois da transação, todas as linhas de (C, D) têm um único `source_report_id`. Cada tabela recebe um tipo só (`channel_traffic_source_a3` no detalhe; `channel_reach_combined_a1` no alcance por dimensão), então "(canal, dia, tipo)" e "(canal, dia) naquela tabela" são a mesma coisa. Por isso `source_report_id` e `report_create_time` são `not null` nas duas (DDL acima). É substituição pelo valor novo, com o bruto guardado (E20): entra na lista fechada de 9.2 (linha 14). Itens 87 (emendado) e 249.
- **Normalizadores de lote** (`channel_traffic_source_a3`, `channel_reach_combined_a1`): validam o cabeçalho contra um CSV **real** exportado, como `reach-csv.ts` (fixture sintética não vale, runbook de coleta seção 7). Cabeçalho diferente do esperado = erro e nenhuma linha.
- **Limiar do YouTube, dito na tela.** A API omite valores pequenos ("search terms and URLs that lead very small numbers of views will not appear"; o mesmo para origens). A soma das linhas de um dia pode ficar **abaixo** das views do diário: a tela mostra a diferença como "omitido pelo YouTube", nunca a redistribui.
- **Coleta diária.** Passo novo "dimensões", depois do diário e antes da retenção, com teto próprio dentro do relógio do cron (o plano refaz a soma dos tetos, hoje 200 s de 270 s); janela de 10 dias como o diário (o YouTube revisa os últimos dias); até quatro consultas por vídeo **com view na janela**; o que não couber grava `nao_alcancado_orcamento` e entra primeiro na execução seguinte. Os lotes entram pelo passo de relatórios que já existe.
- **Ponto de partida (v2.3, no lugar da retroação; decisão 32 do dono e achado I-2).** (i) Conjuntos que vêm de **lote** (`detalhe`, `alcance_dim`): a cobertura começa no primeiro dia do bruto que já está guardado, **08/09/2026**; normalizar bruto já baixado não é consulta para trás. (ii) Conjuntos que vêm da **Analytics API** (`trafego`, `dispositivo`, `pais`, `inscrito`): a cobertura começa em **dia do deploy da E11 menos 10 dias** (a mesma janela que o passo relê todo dia, porque o YouTube revisa os últimos dias); nenhuma consulta é feita com `startDate` anterior a isso (item 228). (iii) Tudo o que é anterior lê como **"não medido: a coleta começou em dd/mm"**, com a data do conjunto; nunca como zero. A data é confirmada com o dono na pergunta 35; se ele não responder, vale esta regra.
- ~~**Retroação.**~~ *(retirado na v2.3, decisão 32 do dono; o texto fica só como referência do que a API devolveria)* Uma leva, espalhada por dias (`sha256 mod 7`), vídeo a vídeo, da publicação até hoje: para os 35 vídeos, cerca de 140 consultas de dimensão (mais as de país por mês, se a conferência 1 der "não": cerca de 2.500, espalhadas em duas semanas). Roda fora do cron diário, por um comando com retomada.
- **Termos de pesquisa e sites externos: acesso restrito.** Só quem **edita** o site lê, pelo mesmo token de edição da A4 (`EdicaoDoSite`, `lib/proprio/edicao.ts`): o leitor exige o token, não um booleano. **Não entram em nenhum pacote da forja nem em nenhum endpoint do Cowork.** A URL externa é gravada **sem a query string e sem o fragmento** (é ali que costumam vir e-mail, token e identificador de campanha), cortada na escrita, com teste. Um termo de pesquisa pode ser o nome de uma pessoa: por isso fica do lado privado e nunca é agregado numa tela que um usuário só de leitura veja. **v2.3 (achado I11 e decisão 32):** com o direito "ver desempenho privado" aprovado, quem lê estas tabelas é quem tem esse direito, pelo token `LeituraPrivadaDoSite` (8.1.4), e não mais só quem edita; "usuário só de leitura", aqui, passa a ser quem **não** tem o direito. **Registro (achado I12):** as tabelas novas não saem pelo Cowork, mas o Cowork **já lê hoje** termos de pesquisa e demografia do canal próprio por outro caminho: a ferramenta `youtube_analytics` (ações `get_search_terms` e `get_demographics`, `lib/pipeline/mcp/tools.ts:731`) consulta a Analytics API ao vivo e responde a qualquer chave `read`. A v2.3 não muda isso; se fica assim é a pergunta 38.
- **Volume.** Retroação: o canal de hoje tem 2.455 dias de vídeo com atividade em 11 anos; a cerca de 12 linhas por dia ativo e 250 B por linha, **cerca de 7 MB uma vez**. Daqui para a frente, no ritmo de hoje (cerca de 220 dias de vídeo ativos por ano): **cerca de 1 MB por ano**. Se o canal crescer até o modelo do inventário (40 vídeos, 30% dos dias com view): 13 MB de dimensões, 3 MB de detalhe e 3 MB de alcance por dimensão, **cerca de 19 MB por canal por ano**. A tabela cresce com as views, não com o calendário. Entra na conta de 9.3. **v2.3:** os "cerca de 7 MB uma vez" da retroação deixaram de existir; a conta que vale é a de 9.6.
- **Telas** (todas com mockup antes; 6.2 e 6.5): na página do vídeo próprio e na do canal próprio, "De onde vêm as views", "O que pesquisaram e de que sites vieram", "Em que aparelho", "De que país", "Inscritos e não inscritos"; o cartão "Só o seu canal mede" ganha as linhas correspondentes.
- **Outros pontos tocados:** `youtube_channel_removal_impact` recriada com as três tabelas; semente e2e; `database.types.ts`.

### 7.4 Ligar os relatórios em lote e guardar o bruto (etapa E12: a primeira do canal próprio)

**Decisão do dono (12/10, a que vale):** "vamos fazer como você recomendou e salvar os brutos de uma vez". É a primeira etapa do canal próprio porque é a única em que esperar custa dado: um relatório em lote só existe para os dias em que o job existia (ao ser ligado, cada tipo traz os 30 dias anteriores e mais nada).

**O que "ligar" exige, conferido no código (VERIFICADO; nenhuma migration).**

| O quê | Onde | Hoje | Passa a |
|---|---|---|---|
| A lista de tipos pedidos | `REPORT_TYPES_ENABLED`, `lib/youtube/reporting/types.ts:4-9` ("habilitar um tipo é um commit de uma linha") | 4 tipos | mais **9** (v2.3: a v2.2 dizia 10 e listava estes 9; total de 13): `channel_combined_a3`, `channel_device_os_a3`, `channel_playback_location_a3`, `channel_province_a3`, `channel_demographics_a1`, `channel_subtitles_a3`, `channel_cards_a1`, `channel_end_screens_a1`, `channel_sharing_service_a1`, na versão que `reportTypes.list` devolver sem `deprecateTime` (NC qual é a corrente: a documentação cita `_a2` para dois deles). Anotações (descontinuadas) e os tipos de playlist ficam fora |
| O job de cada tipo | passo de jobs (`coleta/jobs-step.ts`): cria no ciclo seguinte e tira a linha de `desativado` | `desativado` | `ativo`, sem ação manual |
| O teto de download por execução | `MAX_DOWNLOADS`, `coleta/reports-step.ts:15` | 40 | **100 (v2.3, decisão 37 do dono)**. O raciocínio da v2.2: o bastante para esvaziar a fila em menos de 20 dias: 10 tipos × 30 dias × 2 canais são cerca de 600 relatórios de histórico, **que vencem em 30 dias**, mais os 104 já na fila. O plano mede o tempo por download e fixa o número dentro do relógio do cron |
| O teto de tamanho por relatório | `MAX_GZ_BYTES`, `coleta/reports-step.ts:16`; acima dele o relatório vira `erro: grande_demais` e **não é guardado** | 2 MB comprimido | ~~um teto que nenhum relatório real alcance (proposta: 10 MB)~~ **v2.3 (decisão 36 do dono): continua em 2 MB comprimido** (o maior relatório real tem 564 bytes; estourar é falha segura, `grande_demais`, vermelha), mais um segundo teto de **64 MB para o CSV descomprimido** (`MAX_CSV_BYTES`), com o maior tamanho visto anotado |
| A ordem de prioridade | a ordem da lista é a prioridade de download | alcance primeiro | ~~alcance, tráfego, e depois os novos~~ **v2.3 (decisão 37): fila em três faixas** (`coleta/fila-relatorios.ts`): (0) o que vence em poucos dias, de qualquer tipo; (1) alcance, que é o que as telas leem; (2) o resto. Dentro da faixa: vencimento crescente, depois a posição do tipo, depois a criação |

**v2.3: estado da E12 e o que ela ensinou (decisões 35 a 37; ledger em `.superpowers/sdd/a5-e12/progress.md`).** A etapa está **implementada localmente** (8 tarefas e 5 ondas de conserto, 26 commits), com a revisão final do lote despachada aos dois especialistas; o push espera só essa revisão e vai **separado da A4** (o ledger registra que a A4 não tocou os arquivos da E12). O dono aprovou: 9 tipos, sem anotações; fila em três faixas; 100 downloads e 120 s por execução; teto de 2 MB; e está ciente de que o primeiro ciclo cria **18 jobs no YouTube** (9 tipos × 2 canais). Cada dia sem o deploy custa um dia de 9 tipos para os dois canais (cada tipo, ao ser ligado, traz só os 30 dias anteriores). O que a E12 aprendeu e que vira trabalho deste spec:

1. **Falta a coluna `expired_at`** (e `download_attempts`, `last_error_at`) em `yt_reporting_reports`: um relatório que a origem recusa com 404 ou 410 depois de 14 dias só avisa no dia. Entram na **MG13 (E20, 7.6)**.
2. **O bruto é apagado por cron**, 90 dias depois de normalizado: achado C-1, **E20 (7.6)**.
3. **`gzip_invalido` não tem teto de tentativas:** ocupa uma vaga por dia até vencer, com o cron vermelho por 27 a 57 dias sem ação possível. É decisão de plano que o ledger manda levar ao dono: pergunta 45.
4. **Com todos os jobs ativos a sondagem de tipos não roda:** um tipo que some da lista do YouTube só é percebido pela falta de relatório (critério "job sem relatório há mais de 6 dias"). Fica assim; anotado como risco 15.
5. **"O YouTube gera relatório todo dia" só foi medido para os 4 tipos antigos.** Para os 9 novos, o runbook da coleta manda conferir em D+3 e D+7 depois do deploy; job que nunca gerou relatório em 6 dias vai para "ação do dono", não para vermelho.
6. **O prazo de 07/11/2026 dos tipos já ligados não está em risco** (medido pelo revisor de dados em 12/10: 160 relatórios processados em 4 execuções, 96 de histórico por baixar, criados em 09/10; a fila esvazia por volta de 15/10 mesmo com o código de hoje).

**Onde a tabela acima e os bullets abaixo divergirem deste bloco, vale o bloco.**

- **Onde o bruto fica:** em `yt_reporting_report_blobs.csv_gz` (o CSV comprimido, dentro do banco), como hoje. **Validade:** na origem, 60 dias depois de gerado (30 para os de histórico); no banco, o tipo sem normalizador é apagado 180 dias depois do download (`yt_reporting_blobs_purge`), ou seja, **a partir de abril de 2027**. A E10 troca essa regra para "só apaga o que já foi exportado e confirmado" (9.2); com a fase de manutenção marcada pelo dono para a semana que vem, o bruto tem para onde ir muito antes disso. **v2.3 (achado C-1 da revisão de dados): a data estava errada e a regra, incompleta.** A função apaga também, e antes, todo bruto de tipo **normalizado**: `normalized_at < now() - interval '90 days'` (`20261007000006_coleta_canais_proprios_l1a.sql:197`). O alcance básico é normalizado desde 09/10/2026: **a primeira deleção acontece em 07/01/2027**, não em abril. E no dia em que a E11 normalizar `channel_traffic_source_a3` e `channel_reach_combined_a1`, o bruto deles entra no mesmo relógio, justamente o bruto que guarda o que as tabelas não guardam (impressões por termo, a taxa "como veio"). **Não se espera a E10: a etapa E20 (7.6) desliga o apagamento já.**
- **Volume:** os 160 relatórios guardados hoje somam 21 kB. Com 13 tipos (v2.3; a v2.2 dizia 14) e o canal de hoje, da ordem de centenas de kB por ano; num canal ativo, cerca de 3 MB por canal por ano.
- **O que isso passa a guardar e que não existe por outro caminho:** demografia **por dia**; cartões e telas finais **por elemento**; idioma de legenda usado; e o **cruzamento** das dimensões na mesma view (origem × dispositivo × país × local de reprodução). Nada disso ganha tabela nem tela nesta fase: fica guardado para quando houver pergunta.
- **O que já está ligado e tem data para vencer** (os jobs existem; falta baixar):
  1. **Termos de pesquisa e sites por vídeo e dia.** Em 12/10 há **38 relatórios de `channel_traffic_source_a3` listados e não baixados** (e 66 de `channel_basic_a3`). Os de histórico, que cobrem de 08/09 a cerca de 08/10/2026, **vencem na origem a partir de cerca de 07/11/2026**. O que não for baixado até lá não volta: a Analytics API só devolve os 25 maiores por período. Subir o teto de download resolve os dois de uma vez.
  2. **Impressões por origem e por dispositivo.** Só existem em lote, desde 08/09/2026; os 21 relatórios estão baixados.
- **Sem tela e sem leitor:** a E12 só guarda. Nada do bruto é lido por tela, pela forja ou pelo Cowork; a leitura é só de quem edita o site (RLS de hoje).

### 7.5 Histórico de troca de título, thumbnail e descrição dos vídeos próprios (etapa E18, v2.3; migrations MG12 e MG17)

**Origem.** Decisão 34 do dono (no mockup 3 ele pediu marcas de "antes e depois da troca de título ou thumbnail") e a correção da decisão 39. A proposta foi escrita em `.superpowers/sdd/a5/emenda-versoes-proprio.md` e entra aqui com o texto dela, mais o que o revisor de dados pediu (7.5.9 e 7.5.10). Marcas, as mesmas do spec: **VERIFICADO**, **NC**, **[DONO]**.

**O achado que muda a proposta: o dado bruto já existe desde 07/10/2026.**

A decisão 34 registrou que "não existe histórico de troca para vídeo do canal próprio". Isso vale para a **forma** (não há tabela de versões nem leitor), mas não para o **dado**:

1. **A coleta diária do canal próprio já grava, por vídeo e por dia, o título, a descrição e a imagem da thumbnail.** Tabela `yt_own_video_meta_daily` (migration `20261007000006`, linhas 66 a 96), escrita pelo passo de metadados (`apps/web/src/lib/youtube/coleta/meta-step.ts`). Cada linha traz `title_at_capture` (o título que o YouTube devolveu), `description_sha256` e `description_text` (o texto só quando muda), `thumbnail_dhash` (a "impressão digital visual" da imagem: 64 bits que mudam pouco quando a imagem é a mesma e muito quando é outra), `thumbnail_sha256_at_capture` (impressão digital dos bytes) e `thumbnail_blob_url` (a cópia da imagem guardada no Blob). **VERIFICADO.**
2. **Em produção: 175 linhas, 35 vídeos, dias 07/10 a 11/10, nenhum dia faltando, nenhuma linha sem imagem guardada, nenhuma troca de título nem de imagem nesses 5 dias.** A captura roda às 12:00 UTC (09:00 de São Paulo), no cron `sync-analytics-metrics`. **VERIFICADO.**
3. **A troca de imagem com URL igual já está resolvida nesse passo:** ele baixa a imagem todo dia (`probeThumb`, `thumb-fingerprint.ts:60`), compara o dHash com o da véspera e guarda a imagem nova no Blob quando a distância passa de 6 (`meta-step.ts:152-164`). É o mesmo método dos concorrentes. **VERIFICADO.**
4. **`audit_log` não serve de semente: tem zero linhas de `youtube_videos`.** O gatilho existe (`audit_youtube_videos_editorial`), mas não disparou nenhuma vez desde 22/09. E, por desenho, ele só guardaria a URL da thumbnail, não a imagem. **VERIFICADO** (contagem por `resource_type`: só `consents`, `invitations`, `site_memberships`).
5. **Só o A/B Lab escreve título e thumbnail no YouTube** (`setThumbnail` e `updateVideoMetadata` só são chamados de `ab-*.ts`, da tela do A/B Lab e do `ab-watchdog`). Toda troca que não vier de um evento do A/B Lab foi feita fora do sistema. **VERIFICADO** (grep).

**Consequência.** A emenda fica menor e mais barata do que se supunha: **não cria coleta nova, não gasta cota e não guarda imagem nova**. Ela acrescenta a forma que falta: uma tabela de versões **derivada** das linhas diárias, a marca de origem de cada troca, o leitor e a leitura "antes × depois". E como as linhas diárias já estão sendo gravadas, **nenhum dia a mais de espera perde troca** (na granularidade de um dia): a E18 não tem a urgência da E12.

**O que a etapa entrega.**

Para cada vídeo dos canais do dono, o sistema passa a saber **quais títulos, thumbnails e descrições ele já teve, de quando a quando, e quem trocou** (o A/B Lab ou alguém fora do sistema); e a tela do vídeo passa a poder mostrar, para cada troca, a taxa de clique dos dias antes e dos dias depois, com intervalo, dizendo "ainda não dá para dizer" quando não dá.

**Não entrega:** hora exata de troca feita no Studio (a leitura é diária); trocas anteriores a 07/10/2026 (salvo as do A/B Lab, 7.5.4); nenhuma afirmação de causa ("a troca fez a taxa subir").

#### 7.5.1 Onde guardar: tabela própria `yt_own_video_versions`, com a mesma forma das versões dos concorrentes

**Decisão: tabela nova, não estender `competitor_video_versions`.**

| Motivo | Detalhe |
|---|---|
| Chave e vínculo | `competitor_video_versions.video_id` aponta para `competitor_videos` com `on delete cascade` (migration `20261003000002`). Vídeo próprio mora em `youtube_videos` e a família `yt_own_*` usa o id de 11 caracteres do YouTube como chave. Estender exigiria uma coluna de vínculo alternativa e um `check` de "um ou outro" |
| Quem pode ler | A policy dos concorrentes é `can_view_site` (dado público de terceiros). O dado próprio segue a família `yt_own_*`: hoje `can_edit_site(site_id)`, e `can_view_private_site(site_id)` quando a MG11 existir (direito "ver desempenho privado", 8.1.4). Uma tabela com duas regras de leitura por linha é onde nasce vazamento |
| Colunas que só o próprio tem | origem da troca (A/B Lab ou fora do sistema), teste e variante, dia do YouTube da primeira e da última vez em que a versão foi vista |
| Ciclo de vida diferente | versões de concorrente entram na fila "Saíram do YouTube" (E9) e somem com a remoção do concorrente; as do próprio não |

**O que se reaproveita, para não haver dois métodos:** as funções puras `hashValue` e `normalizeDescription` (`competitor-versions.ts:19-24`), `hamming` e `DHASH_MAX_SAME = 6` (`thumb-fingerprint.ts:9,18`), o comparador de texto das telas (`observatorio/text-diff.ts`) e a **forma** das versões que as telas já sabem desenhar (`TitleVersion`, `ThumbVersion`).

**Por que o título, que é público, fica em tabela privada:** o vídeo pode estar não listado ou privado, a origem da troca revela o que está em teste, e a regra do projeto é que leitura sensível nunca use `can_view_site` (que confia num valor que o cliente pode forjar).

**Alternativas descartadas.** (a) Estender a tabela dos concorrentes: pelos quatro motivos acima. (b) Não criar tabela e derivar as trocas na leitura, direto das linhas diárias: funciona hoje, mas obriga toda tela a ler N dias × vídeos, não tem onde gravar a origem (os ciclos do A/B Lab podem ser apagados depois) e deixa de funcionar no dia em que as linhas diárias antigas forem para o arquivo (7.5.8 e 7.5.10). (c) Usar `audit_log`: vazio, sem imagem e sem garantia de cobrir troca feita no Studio.

#### 7.5.2 Como detectar: derivar das linhas diárias que já existem, num passo novo logo depois dos metadados

**Decisão.** Um passo novo, `coleta/versoes-step.ts`, roda no mesmo cron (`sync-analytics-metrics`, 12:00 UTC), **depois** do passo de metadados. Ele não chama o YouTube: lê as linhas de `yt_own_video_meta_daily` dos dias ainda não derivados, compara com a versão corrente de cada vídeo e campo, e grava o resultado por uma função de banco, um canal e um dia por transação.

**Custo.** Cota: **zero unidades** (o `videos.list` do passo de metadados já custa 1 unidade por 50 vídeos por canal e não muda). Rede: zero. Blob: zero imagem nova (a cópia já é guardada). Tempo: duas leituras por canal e uma gravação por canal e dia; com 35 vídeos, bem abaixo de 1 segundo. Entrada de cron nova: **zero**.

**Regra por campo** (função pura, testável sem banco, no molde de `reconcileVideoVersions`):

- **Título e descrição.** Só valem as linhas em que a captura pela API respondeu naquele dia. O sinal é `privacy_status` não nulo: sem captura, o passo de metadados preenche o título com o de `youtube_videos`, que pode estar velho (`meta-step.ts:354`; as 35 linhas de 07/10, anteriores à captura, têm `privacy_status` nulo, **VERIFICADO**). Linha sem captura **não abre, não fecha e não confirma** versão. Texto igual ao da versão corrente (pelo hash): só avança o "visto por último". Texto diferente: fecha a corrente e abre a nova.
- **Thumbnail.** Só valem as linhas com `thumbnail_dhash` preenchido e vídeo não privado. Compara o dHash do dia com o da **versão corrente** (a âncora), nunca com o da véspera: assim uma deriva lenta de um ou dois bits por dia não se acumula sem ser vista nem vira troca falsa. Distância acima de 6: versão nova, com a `thumbnail_blob_url` da linha.
- **Retoque** (bytes diferentes, imagem quase igual). Quando o `thumbnail_sha256_at_capture` muda e a distância do dHash fica em 6 ou menos, a imagem foi reenviada com um ajuste pequeno, ou o YouTube a recodificou. Nos 140 pares de dias seguidos em produção os bytes não mudaram nenhuma vez (**VERIFICADO**), então mudança de bytes é sinal raro. **Decisão:** grava como versão com `thumb_similar = true`; a tela, por padrão, **não** conta retoque como troca (constante). Exige uma mudança de uma condição no passo de metadados, para ele guardar a imagem também quando só os bytes mudam. **NC:** se o YouTube recodifica thumbnails sozinho; confirmar contando versões `thumb_similar` nos primeiros 30 dias (item 195). **Descartado:** ignorar o retoque (perde justamente o que a origem sobrescreve) e tratá-lo como troca cheia (um método diferente do dos concorrentes para a mesma pergunta).
- **Tags** ficam fora das versões: já estão em `yt_own_video_meta_daily` (hash e lista quando mudam) e nenhuma tela as pede.

**Janela e precisão de cada troca.** A linha do dia D é capturada por volta das 12:00 UTC do dia seguinte (`meta-step.ts:169`: o passo grava "ontem no Pacífico"). Uma troca vista pela primeira vez na linha D, com a versão anterior confirmada pela última vez na linha D', aconteceu **entre as duas capturas**. A versão guarda esse intervalo (`window_start`, `window_end`) e a precisão:

| Precisão | Quando | O que a tela pode dizer |
|---|---|---|
| `first` | primeira vez que o sistema vê o vídeo | "registro desde dd/mm" (não é troca) |
| `1d` | D − D' = 1 | "trocado entre 09:00 de dd/mm e 09:00 de dd/mm" (São Paulo) |
| `lacuna` | D − D' > 1 (dia sem coleta, ou campo sem captura no meio) | "trocado em algum momento entre dd/mm e dd/mm" |
| `min` | um evento do A/B Lab explica a troca (7.5.3): vale a hora em que o servidor gravou o evento | "trocado pelo A/B Lab em dd/mm às hh:mm" (hora do servidor, não confirmação do YouTube) |

**Granularidade, dita sem suavizar.** Uma leitura por dia vê **o estado às 09:00 de São Paulo**. Duas trocas no mesmo intervalo viram uma só (de A para C, sem o B); uma troca desfeita no mesmo dia (A, B, A) **não é vista**. O que reduz o estrago: as trocas feitas pelo A/B Lab têm hora registrada pelo próprio sistema, e são elas as que mais se repetem dentro de um dia. Para troca à mão no Studio, o limite fica. A alternativa de ler mais vezes por dia está na pergunta 31.

**Ordem e recuperação.** Uma tabela pequena de estado guarda, por canal, até que dia as versões já foram derivadas (`derived_through`). O passo deriva **todo dia que tem linha e ainda não foi derivado, em ordem**; se falhar hoje, amanhã deriva os dois dias. A função de banco recusa dia repetido ou fora de ordem, o que torna a reexecução segura. A primeira execução deriva tudo desde 07/10 pelo mesmo caminho: **a semente retroativa e a rotina diária são o mesmo código.**

**Descartado:** detectar dentro do passo de metadados (mistura captura com interpretação num arquivo de 546 linhas que "nunca desiste de gravar a linha"; um defeito na interpretação poria a captura em risco); derivar só em SQL (o dHash, o limiar e a normalização já existem e são testados em TypeScript; duplicá-los em SQL cria dois métodos).

#### 7.5.3 Origem da troca: feita pelo sistema (A/B Lab) ou fora dele

Para cada troca, o passo procura, **no mesmo vídeo e dentro da janela da troca**, um evento do A/B Lab que a explique:

| Origem gravada | Evento | Como reconhece |
|---|---|---|
| `ab_lab` / `rotacao` | um ciclo do teste começou | `ab_test_cycles.started_at` na janela e `applied_metadata.title_set` igual ao título novo (para thumbnail: `applied_metadata.thumbnail_set` verdadeiro) |
| `ab_lab` / `vencedor` | o vencedor foi aplicado | `ab_tests.winner_applied_at` na janela |
| `ab_lab` / `restauro` | o teste parou e o original voltou | `ab_tests.paused_at` ou `completed_at` na janela e título novo igual a `original_title` |
| `fora_do_sistema` | nenhum evento explica | feita no Studio, no aplicativo do YouTube ou por outra ferramenta; o sistema **não sabe qual** e a tela diz "fora do A/B Lab" |
| `nao_se_sabe` | as tabelas do A/B Lab não puderam ser lidas naquele dia | a troca é gravada; a origem não é afirmada. O passo marca falha (vermelho) |
| `linha_de_base` | primeira versão vista | não é troca |

A versão guarda também `ab_test_id` e `ab_variant_id`, **sem chave estrangeira**, porque testes são apagados e a versão tem de sobreviver (mesma regra de `yt_own_video_meta_daily`).

**Consequência para a tela (pergunta 28).** Um teste A/B em rotação gera uma "troca" por ciclo. Elas **não** entram no bloco "Trocas deste vídeo" como trocas com antes × depois: comparar dois ciclos de um teste é o trabalho do A/B Lab, com o método dele. No gráfico por dia, o período de teste vira uma faixa "em teste A/B", com link para o teste. Contam como troca, no bloco: `fora_do_sistema`, `vencedor` e `restauro`. **Isto é elemento visual novo, que o mockup 3 não tem: pede desenho, revisão de UX e aprovação do dono antes de código.**

#### 7.5.4 Semente retroativa: o que dá e o que não dá para reconstruir

| Fonte | O que dá | O que não dá |
|---|---|---|
| `yt_own_video_meta_daily` (desde 07/10/2026) | tudo, pelo mesmo código da rotina diária. Linha de base em 07/10 para a thumbnail e em 08/10 para título e descrição (primeiro dia com captura pela API), para os 35 vídeos | nada antes de 07/10 |
| A/B Lab (`ab_tests`, `ab_test_cycles`) | 2 testes, os dois do tipo "combo", 7 ciclos entre 31/05 e 07/06/2026, 4 deles com `applied_metadata` (**VERIFICADO**). Para esses 2 vídeos: o título de cada ciclo, o título original e a hora de cada rotação | a imagem **original** (o `original_thumbnail_url` é a URL do YouTube, que hoje mostra a imagem atual); os 3 ciclos sem `applied_metadata`; se o que o Lab mandou ficou de fato no ar; e o antes × depois, porque as impressões por dia só existem desde 08/09/2026 |
| `audit_log` | nada (zero linhas) | tudo |

**Decisão:** a semente do A/B Lab entra por um comando à parte (não na migration), como **última tarefa da etapa**, e grava as versões com `pre_registro = true`: a tela as mostra numa faixa "antes do início do registro (07/10/2026), reconstruído do A/B Lab", sem antes × depois, e elas nunca são a versão corrente. Vale pouco (2 vídeos) e custa pouco; o dono pode cortar (pergunta 30).

#### 7.5.5 O antes × depois

**De onde vêm impressões e cliques por dia.** De `yt_own_video_reach_daily` (migration `20261009000001`, linhas 45 a 60): `thumbnail_impressions` e `thumbnail_ctr` (de 0 a 1), por vídeo e dia do YouTube (dia do Pacífico), vindos do relatório em lote `channel_reach_basic_a1`. **O YouTube não entrega contagem de cliques:** o clique do dia é estimado (impressões × taxa), como a tela aprovada já faz ("cliques estimados"). Existe desde 08/09/2026 (104 linhas, 33 vídeos). **Atraso medido: 2 dias** (o dia 10/10 chegou no relatório criado em 12/10 às 06:39 UTC e foi gravado às 12:02 UTC). **VERIFICADO.**

**Regra** (função pura `anteDepoisDaTroca`, calculada na leitura; **nada é gravado**, porque o relatório revisa os últimos dias):

1. **Lados.** Até `trocaJanelaDias` dias de cada lado da troca, parando na troca vizinha do mesmo vídeo (de qualquer campo: título e thumbnail agem na mesma taxa de clique).
2. **Dias que ficam de fora:** todo dia do YouTube que encosta na janela da troca (com precisão `1d` são dois dias; com `min`, um), porque mistura as duas versões; e o dia da publicação (pico de lançamento), como no mockup.
3. **Dia medido × zero.** Só conta o dia coberto por um relatório baixado. Dia coberto sem linha é zero impressões; dia não coberto é "não medido" e não entra na soma. O leitor da E18 usa a mesma regra do leitor de alcance da A4 (`lib/proprio/ler.ts`, `lerAlcance`) e não a reescreve. **NC:** como esse leitor separa hoje "zero" de "não medido" no alcance; conferir no plano, lendo `ler.ts:81-112`. (v2.3: é a conferência C0.10 da sequência.)
4. **Limiar.** Cada lado precisa somar pelo menos `trocaMinImpressoesPorLado` impressões. Abaixo disso não há taxa nem faixa: "ainda não dá para dizer", com as duas contagens.
5. **Intervalo.** Wilson de 95% sobre (cliques estimados, impressões) de cada lado, a mesma conta das telas de taxa de clique (`a4-comum.js:42`). Uma função só no código; hoje só existe uma em `ab-lab/queries.ts`: extrair para um módulo comum em vez de copiar.
6. **Leitura.** Faixa do depois inteira acima da do antes: "taxa subiu depois da troca". Inteira abaixo: "caiu". Faixas que se tocam: "sem diferença firme" (`a4-comum.js:212-216`).
7. **Estados sem número:** "depois ainda não medido" (nenhum dia fechado depois; com o atraso de 2 dias, o primeiro dia do depois aparece cerca de 3 dias após a troca e a janela cheia, cerca de 10); "sem antes" (a troca veio antes de haver impressões por dia); "em teste A/B" (7.5.3); "janela cortada por outra troca".

**Limiar e janela são constantes à espera do dono** (pergunta 27): `RULES.proprio.trocaMinImpressoesPorLado = 100` e `RULES.proprio.trocaJanelaDias = 7`, em `observatorio/rules.ts`, lidas pela função e pelo texto da tela (nunca escritas duas vezes). **Fato que o dono precisa ter na mão para decidir:** nos últimos 30 dias os dois canais somaram **158 impressões** ao todo, e nenhum vídeo chegou a 100 impressões em 9 dias (**VERIFICADO**). Com o limiar em 100, **toda troca feita hoje daria "ainda não dá para dizer"**. Isso é a leitura honesta de um canal pequeno, não defeito; baixar o limiar alarga a faixa até ela não separar nada.

**Por que isto NÃO é teste A/B** (a tela diz, no ⓘ, e o código não usa a palavra "efeito"):

- As duas versões **não ficaram no ar ao mesmo tempo**: o antes e o depois são dias diferentes, com público, dia da semana, assunto do momento e idade do vídeo diferentes. Vídeo novo perde impressões e muda de público sozinho, com ou sem troca.
- Ninguém sorteou quem via qual versão.
- Quem troca costuma trocar **porque** o vídeo ia mal; depois de uma fase ruim, a taxa tende a voltar ao normal sozinha.
- O intervalo de Wilson mede só o acaso da amostra. Ele não cobre nenhum dos três pontos acima.

Por isso o texto é sempre "depois da troca, a taxa subiu", nunca "a troca fez subir"; e o ⓘ manda usar o A/B Lab quando a pergunta for de causa.

**Não se reaproveita `observatorio/effect.ts`:** ele mede outra coisa (views por dia contra vídeos parecidos de outros canais, porque concorrente não tem impressões). Reaproveita-se a ideia dos estados ("aguardando", "troca seguinte dentro da janela", "antes curto").

#### 7.5.6 "O que acontece quando o dado não existe?"

| Caso | O que o sistema grava | O que a tela diz |
|---|---|---|
| **Vídeo anterior ao início do registro** | primeira versão com precisão `first` e origem `linha_de_base` | "Registro de trocas desde 07/10/2026. Antes disso: **não registrado**." Nunca "nenhuma troca" |
| **Vídeo publicado depois do início** | idem; a primeira versão nasce até 2 dias depois da publicação | "nenhuma troca registrada desde a publicação" (zero medido) |
| **Vídeo sem nenhuma versão** (o passo ainda não o alcançou) | nada | "não registrado" (não medido). O leitor distingue "sem linha de base" de "linha de base sem troca"; os dois nunca caem no mesmo texto |
| **Primeira execução** | só linhas de base; **nenhuma troca** é marcada, mesmo que o título de hoje difira do que está em `youtube_videos` | marca "registro desde" |
| **Coleta que falhou num dia** (sem linha naquele dia) | nada naquele dia; a troca vista depois ganha precisão `lacuna` e a janela inteira | "trocado em algum momento entre dd/mm e dd/mm" |
| **Thumbnail não baixou num dia** (linha sem dHash) | o campo é pulado; a versão corrente da thumbnail **não avança** o "visto por último"; título segue normal | se a falha persistir: "thumbnail não conferida desde dd/mm" |
| **Captura da API falhou** (linha sem `privacy_status`) | título e descrição pulados naquele dia | idem, para o título |
| **Vídeo privado** | título e descrição seguem (o token do dono enxerga); thumbnail pulada | "thumbnail não conferida enquanto o vídeo está privado" |
| **Vídeo apagado, ou ausente da resposta** | nada novo; as versões ficam (`video_id` vira nulo se a linha de `youtube_videos` sumir; a chave é o id do YouTube) | histórico até a última data vista; nunca uma "troca" inventada |
| **Passo de versões falhou hoje** | `derived_through` não avança; amanhã deriva os dois dias | cabeçalho: "trocas conferidas até dd/mm" |
| **Dia derivado sem nenhuma linha para um canal que tem vídeos** | nada | o passo acusa **falha** (vermelho); não devolve "ok, 0 trocas" |
| **Sem impressões do período** | nada (o antes × depois não é gravado) | "sem antes" ou "depois ainda não medido" |

**Regra de fundo, a do projeto: este passo não pode falhar em verde.** "Zero trocas hoje" só é resultado válido quando houve linhas lidas e comparadas; o resumo do passo traz quantos vídeos e campos foram **confirmados**, quantos **pulados** e por quê, e o atraso em dias de `derived_through`.

#### 7.5.7 Migration MG12 (proposta; aplicar é do dono, criar o arquivo é com `npm run db:new observatorio_versoes_proprio`)

Idempotente; só acrescenta; não altera nem apaga dado existente.

```sql
-- MG12: versões de título, thumbnail e descrição dos vídeos dos canais próprios (A5, E18).
-- Derivadas de yt_own_video_meta_daily. Escrita só por service role, pela função abaixo.

create table if not exists public.yt_own_video_versions (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null,                 -- id de 11 caracteres do YouTube (como a família yt_own_*)
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  field text not null check (field in ('title', 'thumb', 'desc')),
  value_text text,                                -- título ou descrição; nulo na thumbnail
  value_hash text not null,                       -- hash do texto; na thumbnail, o dHash
  thumb_dhash text,
  thumb_sha256 text,
  thumb_blob_url text,
  thumb_similar boolean not null default false,   -- bytes mudaram, imagem quase igual (retoque)
  first_day_pt date not null,                     -- dia do YouTube da primeira linha em que foi vista
  last_day_pt date not null,                      -- idem, da última
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  window_start timestamptz,                       -- a troca aconteceu entre window_start e window_end
  window_end timestamptz,
  window_precision text not null check (window_precision in ('first', 'min', '1d', 'lacuna')),
  origin text not null check (origin in ('linha_de_base', 'ab_lab', 'fora_do_sistema', 'nao_se_sabe', 'cms')),   -- v2.3: 'cms' reservado, sem uso hoje (7.5.9, ponto 1)
  ab_event text check (ab_event is null or ab_event in ('rotacao', 'vencedor', 'restauro')),
  ab_test_id uuid,                                -- sem FK: o teste pode ser apagado, a versão fica
  ab_variant_id uuid,
  pre_registro boolean not null default false,    -- reconstruída do A/B Lab, anterior ao início do registro
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  check (last_day_pt >= first_day_pt),
  check ((origin = 'ab_lab') = (ab_event is not null)),
  check ((window_precision = 'first') = (origin = 'linha_de_base')),
  check (field = 'thumb' or (thumb_dhash is null and thumb_blob_url is null and not thumb_similar)),
  check (not (pre_registro and is_current))
);
create unique index if not exists idx_yovv_one_current
  on public.yt_own_video_versions (youtube_video_id, field) where is_current;
create unique index if not exists idx_yovv_dia          -- reexecutar o mesmo dia não duplica
  on public.yt_own_video_versions (youtube_video_id, field, first_day_pt) where not pre_registro;
create unique index if not exists idx_yovv_pre
  on public.yt_own_video_versions (youtube_video_id, field, first_seen_at) where pre_registro;
create index if not exists idx_yovv_canal on public.yt_own_video_versions (channel_id, first_seen_at);

create table if not exists public.yt_own_versions_state (
  channel_id uuid primary key references public.youtube_channels(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete cascade,
  tracking_since date not null,                   -- primeiro dia derivado: o "registro desde" do canal
  derived_through date not null,                  -- último dia de yt_own_video_meta_daily já derivado
  updated_at timestamptz not null default now(),
  check (derived_through >= tracking_since)
);

-- Leitura: quem tem o direito "ver desempenho privado" (MG11); enquanto ela não existir, quem edita o site.
alter table public.yt_own_video_versions enable row level security;
alter table public.yt_own_versions_state enable row level security;
drop policy if exists "yt_own_video_versions_select" on public.yt_own_video_versions;
drop policy if exists "yt_own_versions_state_select" on public.yt_own_versions_state;
do $$
declare v_fn text := case when to_regprocedure('public.can_view_private_site(uuid)') is not null
                          then 'public.can_view_private_site(site_id)' else 'public.can_edit_site(site_id)' end;
begin
  execute format('create policy "yt_own_video_versions_select" on public.yt_own_video_versions for select using (%s)', v_fn);
  execute format('create policy "yt_own_versions_state_select" on public.yt_own_versions_state for select using (%s)', v_fn);
end $$;
-- Sem policy de escrita: insert, update e delete só por service role.

-- Aplica UM canal e UM dia numa transação: confirma o que não mudou, fecha e abre o que mudou,
-- avança o estado. Recusa dia já derivado (reexecução segura) e nunca deixa o dia pela metade.
create or replace function public.yt_own_versions_apply_day(
  p_channel_id uuid, p_site_id uuid, p_day date, p_touch jsonb, p_open jsonb
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  v_through date; v_touched integer := 0; v_opened integer := 0; r record;
begin
  perform pg_advisory_xact_lock(hashtext('yt_own_versions:' || p_channel_id::text));
  select derived_through into v_through from yt_own_versions_state where channel_id = p_channel_id;
  if found and p_day <= v_through then
    return jsonb_build_object('resultado', 'ja_derivado', 'derived_through', v_through);
  end if;

  update yt_own_video_versions v
     set last_day_pt = p_day, last_seen_at = t.seen_at
    from jsonb_to_recordset(coalesce(p_touch, '[]'::jsonb)) as t(id uuid, seen_at timestamptz)
   where v.id = t.id and v.channel_id = p_channel_id and v.is_current;
  get diagnostics v_touched = row_count;

  for r in
    select * from jsonb_to_recordset(coalesce(p_open, '[]'::jsonb)) as x(
      youtube_video_id text, video_id uuid, field text, value_text text, value_hash text,
      thumb_dhash text, thumb_sha256 text, thumb_blob_url text, thumb_similar boolean,
      first_seen_at timestamptz, seen_at timestamptz, window_start timestamptz, window_end timestamptz,
      window_precision text, origin text, ab_event text, ab_test_id uuid, ab_variant_id uuid)
  loop
    update yt_own_video_versions set is_current = false
     where youtube_video_id = r.youtube_video_id and field = r.field and channel_id = p_channel_id and is_current;
    insert into yt_own_video_versions (
      youtube_video_id, site_id, video_id, channel_id, field, value_text, value_hash,
      thumb_dhash, thumb_sha256, thumb_blob_url, thumb_similar, first_day_pt, last_day_pt,
      first_seen_at, last_seen_at, window_start, window_end, window_precision,
      origin, ab_event, ab_test_id, ab_variant_id, is_current
    ) values (
      r.youtube_video_id, p_site_id, r.video_id, p_channel_id, r.field, r.value_text, r.value_hash,
      r.thumb_dhash, r.thumb_sha256, r.thumb_blob_url, coalesce(r.thumb_similar, false), p_day, p_day,
      r.first_seen_at, r.seen_at, r.window_start, r.window_end, r.window_precision,
      r.origin, r.ab_event, r.ab_test_id, r.ab_variant_id, true
    );
    v_opened := v_opened + 1;
  end loop;

  insert into yt_own_versions_state (channel_id, site_id, tracking_since, derived_through)
  values (p_channel_id, p_site_id, p_day, p_day)
  on conflict (channel_id) do update set derived_through = excluded.derived_through, updated_at = now();

  return jsonb_build_object('resultado', 'ok', 'confirmadas', v_touched, 'abertas', v_opened);
end;
$$;
revoke all on function public.yt_own_versions_apply_day(uuid, uuid, date, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.yt_own_versions_apply_day(uuid, uuid, date, jsonb, jsonb) to service_role;
```

**O que a migration não faz, e por quê.** Não mexe no `check` de `yt_own_collection_attempts.kind`: o passo de versões não registra tentativa por vídeo; o estado por canal já diz até onde ele chegou, e evita-se disputar a mesma constraint com as migrations da E8 e da E11. Não carrega dado: a primeira execução do passo deriva tudo desde 07/10.

**Pontos que o plano tem de conferir (NC; o ponto (a) é a conferência C0.11 da sequência):** (a) `youtube_channel_remove` e `youtube_channel_removal_impact` precisam tratar as duas tabelas novas, porque `channel_id` tem `on delete restrict` (como `yt_own_video_reach_daily`); a função em produção hoje não cita nem `yt_own_video_meta_daily`. (b) Se a MG11 for aplicada **depois** da MG12, a lista de tabelas cuja policy ela troca tem de incluir estas duas (item 191). (c) `database.types.ts` regenerado; a semente e2e (`e2e/fixtures/observatorio-seed.ts`) passa a semear e a limpar as tabelas novas.

#### 7.5.8 Volume por ano

| O que | Conta | Por ano |
|---|---|---|
| Linhas de base | 35 vídeos × 3 campos hoje; mais 3 por vídeo novo | 105 linhas uma vez; com 100 vídeos novos por ano, +300 |
| Trocas fora do sistema | estimativa: 2 por vídeo novo (**NC**: não há histórico para medir) | ~200 linhas |
| Rotações do A/B Lab | 1 versão de título e 1 de thumbnail por ciclo; um teste de 14 dias com rotação diária = 28 linhas; 10 testes por ano | ~280 linhas |
| **Total de linhas** | | **~800 por ano** |
| **Tamanho** | título e thumbnail: ~0,3 kB por linha; descrição: 2 a 5 kB por versão (o texto inteiro) | **menos de 1 MB por ano** para os canais do dono, somados |
| Blob | nenhuma imagem a mais: a cópia já é guardada pelo passo de metadados; o retoque acrescenta uma imagem por ocorrência | ~0 |
| Cota do YouTube | nenhuma chamada nova | 0 unidades |

As versões **nunca saem do banco online** (9.2: "o que nunca sai, por ser pequeno e necessário às telas"), como as dos concorrentes.

**v2.3 (achado I-9 da revisão de dados): `yt_own_video_meta_daily` deixa de ser "registro para depois".** Ela grava uma linha por vídeo por dia para sempre (medido em 12/10: 175 linhas em 5 dias, 35 vídeos, 615 B por linha em regime; cerca de **9 MB por ano** para 35 vídeos, proporcional a vídeos × dias) e não estava em conta nenhuma. É o mesmo desenho que o dono chamou de "lixo" no diário. Entra na conta de 9.6 e ganha dieta própria, como parte 2 desta etapa: 7.5.10.

#### 7.5.9 O que a revisão de dados acrescentou ou corrigiu (v2.3)

1. **Origens da troca.** O revisor propôs `cms`, `ab_lab` e `detectado`. Ficam as origens de 7.5.3, porque **não existe troca "pelo CMS"**: só o A/B Lab escreve título e thumbnail no YouTube (`setThumbnail` e `updateVideoMetadata` só aparecem em `ab-*.ts`, em `ab-lab/actions.ts` e em `cron/ab-watchdog`; conferido de novo em 12/10). O valor `'cms'` entra no `check` de `origin` **reservado e sem uso**, para o dia em que o CMS passar a escrever não pedir migration; nenhuma versão é gravada com ele nesta fase (item 203).
2. **Imagem.** A comparação é por dHash com tolerância de 6 bits: um ajuste pequeno na arte vira "retoque", não troca. O ⓘ da tela diz isso. A tela escreve **"histórico de imagem desde 07/10/2026"** e **"de título e descrição desde 08/10/2026"** (primeiro dia com captura pela API). **Não há semente de título pelo `audit_log`:** ele tem zero linhas de `youtube_videos` (medido; decisão 39).
3. **Dia.** A captura é por dia do YouTube (Pacífico), o mesmo do alcance. O antes × depois compara dias inteiros e deixa de fora os dias que encostam na troca (regra 2 de 7.5.5).
4. **Política.** Título, descrição e thumbnail do vídeo próprio, lidos com o acesso do dono, são dado autorizado que **não** é estatística: III.E.4.c pede apagar ou atualizar em 30 dias (fato 16). A tabela diária já guarda esse dado desde 07/10/2026, pelo spec de coleta; a E18 não cria retenção nova, só dá forma. Registrado em 11.1 e no risco 37.
5. **Prova diária em produção** (item 200): todo vídeo próprio público tem versão corrente de título e de thumbnail vista nos últimos 2 dias, ou tentativa com motivo.
6. **Remoção de canal próprio.** `youtube_channel_removal_impact` conta `yt_own_video_versions` e `yt_own_versions_state`, e `youtube_channel_remove` trata as duas (têm `on delete restrict` no canal). Item 201; a leitura das duas funções em produção é a conferência C0.11.
7. **Cópias no Blob.** A imagem de cada versão existe **uma vez só**, em URL pública no Vercel Blob. Nesta fase o canal próprio não tem export (9.2: fica online); quando tiver, as cópias entram no manifesto como as dos concorrentes (achado I-7). Risco 43.
8. **Quem lê.** A policy das duas tabelas é o bloco PL de 7.1 (o `do $$` da MG12 acima é o mesmo bloco, escrito por extenso).
9. **Interruptor e volta.** O passo `versoes` entra na lista de `YT_OWN_STEPS_OFF` (seção 14, tabela de interruptores): com `versoes` na variável, o passo não roda e devolve "desligado" (nunca "ok, 0 trocas"); sem a variável, roda. Voltar atrás é reverter o commit: as tabelas ficam, e o passo religado deriva os dias que faltaram, em ordem.

#### 7.5.10 Parte 2 da etapa: dieta de `yt_own_video_meta_daily` (v2.3, achado I-9; migration MG17)

**Quando.** Só depois de **14 execuções seguidas** do passo de versões sem falha, com os itens 188 e 199 conferidos em produção. Antes disso a tabela diária é a única fonte e não se mexe nela.

**Desenho, no molde da dieta do diário (7.1).**

- **A tabela passa a guardar só o dia em que algo mudou.** "Mudou" = em relação à **última linha gravada** do mesmo vídeo, qualquer um destes: hash do título, hash da descrição, hash das tags, duração, privacidade, vínculo com teste A/B, `thumbnail_sha256_at_capture`, ou dHash a mais de 6 bits da âncora (a versão corrente, como em 7.5.2). A primeira linha de cada vídeo sempre fica.
- **A cobertura diz que o dia foi conferido.** O passo de metadados estende `yt_own_video_coverage` em dois conjuntos (já previstos no `check` da MG14): `meta_texto` (a captura pela API respondeu naquele dia) e `meta_thumb` (a imagem foi baixada e comparada). São dois porque uma pode falhar sem a outra (7.5.6).
- **O passo de versões passa a ler assim:** dia **coberto e sem linha** = "conferido, sem mudança" (avança `last_day_pt`); dia **não coberto** = ausência (regra de 7.5.2, sem mudança: não abre, não fecha, não confirma). O resultado da derivação tem de ser **igual** ao de hoje (item 202).
- **Os dados existentes** saem por uma migration destrutiva, a **MG17**, só com o dono, no ritual do P3 de 7.1 em escala pequena: (i) cópia fora do banco (`\copy` da tabela inteira para CSV, guardada pelo dono); (ii) contagens "antes"; (iii) a migration preenche a cobertura a partir das linhas existentes e apaga as linhas que são iguais à anterior do mesmo vídeo em todos os campos comparados; (iv) contagens "depois". Reversível pelo CSV.
- **Invariantes da conferência:** dias cobertos de cada vídeo e conjunto = linhas que ele tinha com aquele campo capturado; linhas depois = primeiras linhas + linhas com mudança; a derivação de versões refeita do zero sobre a tabela depois da dieta produz as mesmas versões (mesmos `value_hash`, `first_day_pt`, `last_day_pt`, `window_precision`).
- **Enquanto a parte 2 não vier:** a tabela cresce cerca de 9 MB por ano para 35 vídeos, e esse número está em 9.6. **v2.3, 2ª passada (m-8 de dados):** com 100 vídeos novos por ano, cerca de 22 MB no primeiro ano (9.6).

### 7.6 Guarda do bruto dos relatórios em lote (etapa E20, v2.3; migration MG13)

**Por que existe (achado C-1 da revisão de dados, crítico).** O dono decidiu "salvar os brutos de uma vez" (decisão 14) e quer "daqui a 5 anos ainda ter os dados" (decisão 32). O código em produção faz o contrário: `yt_reporting_blobs_purge`, chamada pelo cron diário (`coleta/reports-step.ts`), apaga todo bruto com `normalized_at < now() - interval '90 days'`, de qualquer tipo, e todo bruto sem normalizador 180 dias depois do download (`20261007000006_coleta_canais_proprios_l1a.sql:193-203`, VERIFICADO). O alcance básico é normalizado desde 09/10/2026: **a primeira deleção acontece em 07/01/2027.** Não há motivo de espaço: o bruto inteiro pesa 21 kB em 160 arquivos (medido em 12/10).

**Prazo duro:** a MG13 tem de estar aplicada **antes de 07/01/2027** e **antes de qualquer normalizador da E11 ir a produção** (normalizar põe o bruto no relógio de 90 dias). Recomendação: é a primeira migration da fase (seção 14, ordem 2), aplicada junto com a MG1 e a MG2.

**O que muda (migration MG13; aditiva e idempotente; convive com o código que está em produção).**

```sql
-- MG13 (A5, E20): o bruto dos relatórios em lote deixa de ser apagado por cron.
-- Mesma assinatura e mesmos grants: o cron diário continua chamando e passa a receber 0.
create or replace function public.yt_reporting_blobs_purge(p_sem_normalizador text[])
returns integer
language plpgsql
set search_path = ''
as $$
begin
  return 0;   -- nada é apagado. A MG6 (E10) troca este corpo por "só o bruto que está em lote com nas_confirmed_at".
end $$;
revoke all on function public.yt_reporting_blobs_purge(text[]) from public, anon, authenticated;
grant execute on function public.yt_reporting_blobs_purge(text[]) to service_role;

-- Estado que a E12 pediu e não tinha onde gravar (pendência M6 do ledger da E12).
alter table public.yt_reporting_reports
  add column if not exists expired_at timestamptz,                    -- a origem respondeu 404 ou 410: venceu sem ser baixado. Nulo = não venceu, ou não se sabe
  add column if not exists download_attempts integer not null default 0,   -- tentativas de download deste relatório
  add column if not exists last_error_at timestamptz;                 -- última falha de download; nulo = nunca falhou
```

- **RLS:** nenhuma tabela nova; as policies de `yt_reporting_reports` e de `yt_reporting_report_blobs` ficam como estão (leitura só de quem edita; o bruto não é dado de tela).
- **Código que vai junto** (pequeno, no passo de relatórios): gravar `expired_at`, `download_attempts` e `last_error_at`; o critério persistente "expirado sem baixar" da E12 passa a ler `expired_at` em vez de aproximar por `create_time`; o retorno do cron ganha `blobs_guardados` (a contagem de `yt_reporting_report_blobs`) e **acusa falha se ela cair** de um dia para o outro sem um lote confirmado no NAS que explique.
- **Quando o dado não existe:** relatório sem `expired_at` não é "não venceu com certeza": a tela e o critério dizem "sem registro de vencimento" para os relatórios anteriores à MG13.
- **Volume:** centenas de kB por ano com 13 tipos e o canal de hoje; cerca de 3 MB por canal por ano num canal ativo (7.4). Entra em 9.6.
- **Plano de volta:** recriar o corpo antigo da função (está na migration `20261007000006`, linhas 186 a 206). Não é recomendado: é exatamente o que apaga. As três colunas ficam.
- **O que a E20 não faz:** não exporta o bruto. Levar o bruto ao NAS é da E10 (o comando) e da fase de manutenção (o lote por idade).

## Itens de aceite deste arquivo (blocos da seção 10 do spec, com a numeração original)

**E6: dieta**
42. Depois de P1: `C = T` (seção 7) e, para cada vídeo, um intervalo por conjunto.
43. Depois de P2, por 3 execuções: nenhuma linha nova sem atividade; `max(covered_to)` avança a cada dia em todos os vídeos; as telas da A4 mostram os mesmos números de antes (views por dia do canal: "35" na semente; conferência nas três telas). **v2.3 (item 9.x da revisão de dados):** "os mesmos números de antes" é provado sobre base congelada, pela regra do retrato da seção 10 do `00` (item 247).
44. Leitor: dia coberto sem linha vira `views: 0`; dia fora da cobertura não vira linha; canal parado com cobertura em dia **não** diz "coleta parada" (teste com o perfil "parado" da semente).
45. Coleta: num vídeo sem view há dois anos, a janela pedida à API começa em `hoje − 10`, não há dois anos (teste).
46. Dia revisado para zero pelo YouTube tem a linha apagada e continua coberto (teste da função).
47. Depois de P3: as cinco igualdades da conferência de contagem, anotadas com os números do dia, antes e depois.
48. `pg_total_relation_size('yt_own_video_daily')` menor que 2 MB depois do `vacuum full`.
49. Ensaio do plano de volta no banco local: restaurar do backup devolve `T` linhas e as telas não mudam.
50. **NP-E6:** `select count(*) from youtube_videos v where not exists (select 1 from yt_own_video_coverage c where c.youtube_video_id = v.youtube_video_id and c.metric_set = 'base' and c.covered_to >= current_date - 4)` = 0 (4 dias = atraso de 2 a 3 dias da fonte mais um).

**E8: curva de retenção do canal próprio**
58. A conferência de leitura de 7.2 foi feita **antes** da migration, e o ledger traz: o vídeo usado, as duas consultas, se as curvas diferem (caso A ou B) e as duas respostas guardadas como fixture. **v2.3:** é a conferência C0.1 da sequência (seção 14), com quem faz e quando.
59. Depois da primeira leva (7 dias): `select count(*) from youtube_videos v where not exists (select 1 from yt_own_video_retention r where r.youtube_video_id = v.youtube_video_id and r.window_kind = 'vida') and not exists (select 1 from yt_own_collection_attempts a where …retenção deste vídeo…)` = 0: todo vídeo tem curva **ou** tentativa com motivo. **v2.3 (a consulta, escrita; achado I-10):** o `exists` das tentativas é `select 1 from yt_own_collection_attempts a where a.scope_type = 'video' and a.scope_id = v.youtube_video_id and a.kind in ('retencao_vida', 'retencao_7d', 'retencao_30d') and a.attempt_day >= current_date - 8`. Depende do `check` de `kind` trocado na MG14 (7.1).
60. Reler no mesmo dia não cria linha; na semana seguinte, com views novas, cria; **sem views novas, a API não é chamada** (teste que conta as chamadas).
61. Resposta sem ponto grava a tentativa `sem_dado_na_janela` e nenhuma linha; ponto com campo ausente fica nulo; `ratio` maior que 1 é preservado; resposta com 37 pontos grava `point_count = 37`.
62. A API recusando uma métrica: a coleta repete com as duas básicas e `metrics_returned` diz o que veio (teste com resposta de erro).
63. Usuário sem `can_edit_site` não lê `yt_own_video_retention` (teste de RLS com o GUC forjado por papel sem superusuário). **Corrigido na v2.3 (achado I11; decisão 32):** a regra que vale é a do direito. Sem "ver desempenho privado" e sem edição, não lê; com o direito (linha em `site_private_viewers`), lê; ninguém escreve (só service role). O teste é o do item 169, com esta tabela na lista.
64. A seção "Retenção" da página do vídeo próprio foi vista em navegador com dado real nos três estados (coletada, não coletada, "o YouTube não devolveu curva"), a 1440 e 390 px, nos dois temas; a frase "metade das pessoas já saiu aos m:ss" confere à mão com os pontos em dois vídeos; a data da leitura está na tela.
65. **NP-E8:** todo vídeo próprio cujo diário ganhou views nos últimos 14 dias tem leitura ou tentativa de retenção nos últimos 8 dias (consulta = 0 faltando).

**E11: canal próprio em tabelas**
83. As quatro conferências de leitura de 7.3 feitas **antes** da migration e anotadas no ledger (país por dia aceito ou não; o CSV real traz ou não os termos; até onde o detalhe por período retroage; a cota da Analytics API), com as respostas guardadas como fixture. **v2.3:** são a conferência C0.2 da sequência; a terceira (até onde o detalhe por período retroage) perdeu o efeito com a decisão 32 e fica só anotada.
84. Os dois normalizadores (`channel_traffic_source_a3`, `channel_reach_combined_a1`) processaram todo relatório `baixado` do tipo: `select count(*) from yt_reporting_reports where status = 'baixado' and normalized_at is null and report_type_id in (…)` = 0, e o bruto anterior à etapa (desde 08/09/2026) também foi normalizado.
85. Gravação esparsa: nenhuma linha das três tabelas com todas as métricas zeradas ou nulas; dia coberto sem linha lê como zero naquele valor; dia fora da cobertura lê como "não medido" (teste do leitor que **apaga** a cobertura). **Corrigido na v2.3 (achado C-4):** "dia coberto sem linha lê como zero" só vale quando a soma das linhas do dia fecha com o diário; quando não fecha, lê como "zero ou abaixo do limiar do YouTube". O teste é o do item 227.
86. Normalizador: cabeçalho de CSV diferente do esperado dá erro e nenhuma linha (teste com o CSV real e com uma coluna trocada).
87. Relatório mais novo substitui o mais velho; o mais velho, chegando depois, não muda nada (teste das funções de gravação). **v2.3, 2ª passada (N-2 de dados):** nas duas tabelas de lote, de várias linhas por dia, "substitui" é o dia inteiro do canal, e o teste é o do item 249; o teste por linha desta frase só vale para tabela de uma linha por vídeo e dia.
88. URL externa gravada sem query string e sem fragmento, com no máximo 300 caracteres (teste com `?utm_source=…&email=…#x`).
89. Termos e sites: o leitor só aceita o token de edição; usuário só de leitura não os vê no HTML nem no RSC; papel sem `can_edit_site` não lê as três tabelas (RLS com o GUC forjado); nenhuma resposta de endpoint do pipeline (Cowork e forja) contém linha de `yt_own_video_traffic_detail_daily` (teste que varre as respostas com um termo sentinela na semente). **Corrigido na v2.3 (achados I11 e I12):** o leitor aceita o token de **leitura privada** (quem tem o direito), não só o de edição; "usuário só de leitura" é quem não tem o direito. E o que este item **não** prova: o Cowork já lê termos de pesquisa por `youtube_analytics.get_search_terms`, que consulta a Analytics API ao vivo e não passa por estas tabelas (7.3; pergunta 38). O sentinela só cobre a tabela nova.
90. ~~Retroação concluída: a cobertura de cada conjunto começa na publicação de cada vídeo, ou no limite que a API devolveu, anotado por conjunto;~~ **(primeira metade retirada na v2.3, decisão 32 do dono; no lugar dela vale o item 228)** para todo vídeo e dia, a soma das views por origem é menor ou igual às views do diário, e a diferença aparece na tela como "omitido pelo YouTube".
91. A coleta diária cabe no relógio do cron: o passo "dimensões" tem teto, grava `nao_alcancado_orcamento` quando não chega, e o que ficou para trás entra primeiro na execução seguinte; vídeo sem view na janela não gera chamada (teste que conta as chamadas).
92. **NP-E11:** todo vídeo próprio com views nos últimos 14 dias tem cobertura dos conjuntos `trafego`, `dispositivo`, `pais` e `inscrito` até `current_date - 4` (consulta = 0 faltando).
93. As seções novas das páginas do vídeo e do canal próprios foram vistas em navegador, com mockup aprovado antes, nos estados vazio, parcial e cheio, a 1440 e 390 px, nos dois temas; `youtube_channel_removal_impact` conta as três tabelas.

**E12: relatórios em lote e bruto**
94. Um ciclo depois do deploy, todo tipo da lista tem job `ativo` nos dois canais: `select report_type_id, status, count(*) from yt_reporting_jobs group by 1, 2` não mostra nenhum tipo da lista em `desativado` (ou mostra `tipo_indisponivel` com o motivo anotado, se a API não oferecer o tipo ao canal). **v2.3:** "a lista" são os 13 tipos de `REPORT_TYPES_ENABLED`; o primeiro ciclo cria 18 jobs (9 tipos novos × 2 canais), e o ledger anota o dia.
95. **Nada vence sem ser baixado:** `select count(*) from yt_reporting_reports where status = 'listado' and create_time < now() - interval '20 days'` = 0 e `select count(*) from yt_reporting_reports where status = 'expirado_sem_baixar' and create_time > '<deploy>'` = 0, conferidos antes de 01/11/2026 e em todo dia dos 30 seguintes. **v2.3 (item 9.x da revisão de dados):** quem confere "todo dia" é o cron: o critério persistente da E12 acusa relatório `listado` perto de vencer e relatório vencido sem baixar, e com a MG13 passa a ler `expired_at` (item 206). A conferência manual fica com data absoluta: 01/11/2026 e 08/11/2026, anotadas no ledger da E12.
96. Nenhum relatório em `erro` com `grande_demais`; o maior `bytes` visto está anotado e fica abaixo da metade do teto ~~novo~~. **v2.3 (decisão 36 do dono):** o teto é o de 2 MB comprimido, que não mudou. Achado aberto da onda 5 da E12: o aviso de "mais da metade do teto" mede o gzip guardado e, com gzip de transporte, quase nunca dispara antes da recusa; fica para o juízo do revisor de dados na revisão final do lote.
97. A execução do cron continua dentro do relógio com o teto de download novo (duração do passo de relatórios anotada em três execuções), e o tamanho de `yt_reporting_report_blobs` depois de 30 dias está anotado e comparado com a estimativa de 7.4. **v2.3:** a conferência de 30 dias ganha data absoluta no commit do deploy, pela regra da seção 10 do `00` (item 246).

**E18: versões do vídeo próprio (v2.3; os itens 173 a 198 são os da emenda, sem mudança de número nem de texto)**

**Derivação (função pura, sem banco)**

173. Primeira linha de um vídeo: abre uma versão por campo com precisão `first` e origem `linha_de_base`, e **nenhuma troca**; vale também quando o título da linha difere do de `youtube_videos`.
174. Título igual ao da versão corrente: nenhuma versão nova; a corrente avança `last_day_pt`. Título diferente: fecha a corrente, abre a nova com `window_start` = captura da última linha que confirmou a anterior e `window_end` = captura da linha atual.
175. Linha com `privacy_status` nulo (sem captura da API): título e descrição não abrem, não fecham e não avançam versão, mesmo com texto diferente.
176. Thumbnail: distância de dHash até 6 contra a **versão corrente** não abre versão; acima de 6, abre. Três dias seguidos com 3 bits de diferença cada (9 no total contra a âncora) abrem **uma** versão, no terceiro dia.
177. Linha sem dHash, ou de vídeo privado: a thumbnail é pulada e a versão corrente não avança; o título da mesma linha é tratado normalmente.
178. Bytes diferentes com dHash a 6 ou menos: versão com `thumb_similar = true`; a contagem de trocas da tela não a inclui.
179. Buraco de dias (D − D' > 1): precisão `lacuna`, e a janela cobre o buraco inteiro.
180. Duas trocas de campos diferentes no mesmo dia geram duas versões, uma por campo, com a mesma janela.

**Origem**

181. Ciclo do A/B Lab iniciado dentro da janela, com `title_set` igual ao título novo: origem `ab_lab`, evento `rotacao`, precisão `min`, `first_seen_at` = início do ciclo, `ab_test_id` e `ab_variant_id` preenchidos.
182. `winner_applied_at` dentro da janela: evento `vencedor`. Teste parado dentro da janela e título novo igual a `original_title`: evento `restauro`.
183. Nenhum evento na janela: `fora_do_sistema`. Evento na janela cujo título **não** bate com o novo: `fora_do_sistema` (o Lab não explica aquela troca).
184. Leitura do A/B Lab que falha ou vem cortada em 1.000 linhas: a troca é gravada com origem `nao_se_sabe` e o passo devolve falha.

**Gravação (com banco local)**

185. `yt_own_versions_apply_day` é atômica: com uma linha inválida no meio de `p_open`, nada do dia é gravado e `derived_through` não muda.
186. Reexecutar o mesmo canal e dia devolve `ja_derivado` e não altera nenhuma linha. Dia anterior a `derived_through`, idem.
187. Depois de dois dias sem o passo rodar, uma execução deriva os dois dias em ordem, e o resultado é igual ao de duas execuções diárias.
188. A derivação completa desde 07/10 (primeira execução), rodada sobre uma cópia das linhas de produção, produz 105 linhas de base (35 vídeos × 3 campos) e zero trocas. O número é o de 12/10; o teste usa uma semente com a mesma forma.
189. Falha em verde: canal com vídeos e **nenhuma** linha em `yt_own_video_meta_daily` para um dia a derivar faz o passo acusar falha; `derived_through` atrasado mais de 1 dia, idem. Teste que apaga as linhas do dia e afirma sobre a falha.

**Autorização**

190. Usuário sem edição e sem o direito de ver dado privado não lê nenhuma linha das duas tabelas, **inclusive forjando o GUC `app.site_id`** como papel não superusuário (regra do projeto para teste de RLS). `anon` e `authenticated` não executam a função.
191. Com a MG11 e a MG12 aplicadas, em qualquer ordem, a policy de leitura das duas tabelas é `can_view_private_site`: teste que lista as policies de toda tabela `yt_own_*` e falha se alguma ficou em `can_edit_site`. **Corrigido na v2.3, 2ª passada (N6 de software):** "toda tabela `yt_own_*`" contradizia a lista de 8.1.4 e forçaria a policy errada. O teste percorre **a lista das doze** de 8.1.4, escrita no teste (`yt_own_video_daily`, `yt_own_video_reach_daily`, `yt_own_video_meta_daily`, `yt_own_video_coverage`, `yt_own_video_retention`, `yt_own_video_dim_daily`, `yt_own_video_traffic_detail_daily`, `yt_own_video_reach_dim_daily`, `yt_own_video_versions`, `yt_own_versions_state`, `competitor_video_comments`, `competitor_video_comment_marks`), e afirma `can_view_private_site` em cada uma. E afirma **pelo nome** as exceções: `yt_own_collection_attempts`, `competitor_video_comment_authors`, `competitor_raw` e as `yt_reporting_*` em `can_edit_site`; as quatro `yt_own_public_*` em `can_view_site`; `yt_own_collection_runs` sem policy nenhuma (só service role). Uma tabela `yt_own_*` que não esteja na lista nem nas exceções faz o teste falhar: tabela nova tem de ser classificada.
192. O leitor (`lib/proprio/`) só entrega versões a quem apresenta o token de leitura privada (ou o de edição, enquanto a MG11 não existir); sem token, devolve "privado", nunca lista vazia.

**Antes × depois (função pura)**

193. Com 99 impressões de um lado e 5.000 do outro: "ainda não dá para dizer", sem taxa e sem faixa. Com 100 de cada: faixas de Wilson; o teste lê o limiar de `RULES.proprio.trocaMinImpressoesPorLado` e, com a constante trocada para 50, o mesmo dado passa a ter leitura (prova de que o número mora num lugar só).
194. Ficam fora dos dois lados: os dias do YouTube que encostam na janela da troca (dois com precisão `1d`, um com `min`), o dia da publicação e os dias além da troca vizinha de **qualquer** campo. Dia sem relatório não soma zero: reduz a contagem de "dias medidos". Sem nenhum dia medido depois: "depois ainda não medido", nunca "0 impressões".
195. Trinta dias depois de ligada, uma consulta registrada no relatório da etapa conta as versões `thumb_similar` e as trocas por origem; se houver retoque em vídeo que o dono não tocou, o YouTube recodifica sozinho e a regra do retoque é revista.

**Tela e estados (depois do mockup aprovado)**

196. Vídeo sem versão nenhuma: "não registrado". Vídeo só com linha de base anterior à publicação + 2 dias: "nenhuma troca registrada desde a publicação". Vídeo mais antigo que o registro: "registro desde 07/10/2026; antes disso, não registrado". Os três textos são distintos e os estados "não registrado" e "nenhuma registrada" diferem por forma ou símbolo, não só por cor (achado N2 da REVISAO-UX-7).
197. Rotações de um teste A/B não aparecem como trocas no bloco; o período aparece como faixa "em teste A/B". Versões `pre_registro` aparecem só na faixa "antes do início do registro" e sem antes × depois.
198. Nenhum texto da tela nem do pacote "Perguntar a uma IA" (E17) diz que a troca **causou** a mudança; o ⓘ traz "não é teste A/B" e os quatro motivos de 7.5.5. As versões e a leitura antes × depois são classe (ii) da E17 (desempenho privado): saem só para quem tem o direito.

**E18: o que a revisão de dados acrescentou (v2.3)**
199. **Invariante da derivação:** para qualquer sequência diária de um vídeo e campo, o número de versões com origem diferente de `linha_de_base` é igual ao número de mudanças de valor na sequência (teste com sequências geradas por semente fixa; a sequência A, B, A dá três versões, duas delas trocas).
200. **NP-E18 (prova diária em produção):** `select count(*) from youtube_videos v where <vídeo público de canal próprio> and (not exists (select 1 from yt_own_video_versions x where x.youtube_video_id = v.youtube_video_id and x.field = 'title' and x.is_current and x.last_day_pt >= :dia_pt_de_ontem - 1) or not exists (… x.field = 'thumb' …)) and not exists (select 1 from yt_own_collection_attempts a where a.scope_id = v.youtube_video_id and a.kind in ('meta', 'thumbnail') and a.attempt_day >= current_date - 2)` = 0. O filtro "vídeo público" é escrito no plano depois de conferir a coluna (C0.11).
201. Remover um canal próprio na semente: `youtube_channel_removal_impact` conta as duas tabelas da MG12 e `youtube_channel_remove` termina sem erro de chave estrangeira. `database.types.ts` regenerado; a semente e2e semeia e limpa as duas tabelas.
202. **Dieta de `yt_own_video_meta_daily` (parte 2, MG17):** a derivação de versões sobre a tabela inteira e sobre a tabela depois da dieta dá o mesmo resultado, linha a linha (teste com a semente); dia coberto sem linha avança `last_day_pt`; dia não coberto não avança; depois da MG17, as contagens de antes e de depois e o tamanho da tabela estão anotados, e os invariantes de 7.5.10 fecham.
203. Nenhuma versão é gravada com `origin = 'cms'` nesta fase (`select count(*) … where origin = 'cms'` = 0) e nenhuma tela escreve "trocado pelo CMS"; a tela do vídeo traz "histórico de imagem desde 07/10/2026" e o ⓘ diz que a imagem é comparada por semelhança, com tolerância.

**E20: guarda do bruto dos relatórios (v2.3)**
204. Com a MG13 aplicada, `yt_reporting_blobs_purge` chamada com qualquer argumento apaga **zero** linhas: teste com um relatório normalizado há 91 dias e outro, sem normalizador, baixado há 181 dias; a contagem de `yt_reporting_report_blobs` é igual antes e depois.
205. **Prova em produção, com data:** em 08/01/2027 (o dia seguinte ao que seria a primeira deleção), `select count(*) from yt_reporting_reports r where r.downloaded_at is not null and not exists (select 1 from yt_reporting_report_blobs b where b.report_id = r.report_id)` devolve o mesmo número anotado no dia da MG13 (os relatórios vazios, que nunca tiveram bruto, entram nos dois lados). E, todo dia, o retorno do cron traz `blobs_guardados` e falha se ele cair sem lote confirmado.
206. Um relatório que a origem recusa com 404 ou 410 ganha `expired_at`; cada tentativa soma em `download_attempts`; o critério "expirado sem baixar" lê `expired_at`. Relatório anterior à MG13 sem `expired_at` lê como "sem registro de vencimento", nunca como "não venceu" (teste que apaga a coluna do registro de teste).

**E11: o que as revisões acrescentaram (v2.3)**
226. **Chaves (achado C-3):** duas linhas do CSV real de `channel_reach_combined_a1` com o mesmo vídeo, dia, origem, aparelho e sistema e `traffic_source_detail` diferente viram **uma** linha, com impressões somadas e cliques estimados somados; a taxa lida é cliques ÷ impressões. Dois detalhes iguais nos 300 primeiros caracteres e diferentes depois viram **duas** linhas; a mesma URL com duas query strings diferentes vira **uma**, com as views somadas. Nenhuma das duas tabelas de detalhe e de dimensão tem coluna `period_days` (`information_schema.columns`).
227. **Três estados (achado C-4):** pedir a janela até hoje com a `base` coberta só até anteontem deixa a cobertura da dimensão em anteontem (teste da função); valor sem linha num dia em que a soma fecha com o diário lê "zero medido"; num dia em que a soma fica abaixo, lê "zero ou abaixo do limiar do YouTube" e a tela mostra a diferença como "omitido"; soma acima do diário lê "em revisão" e é contada no retorno.
228. **Ponto de partida (achado I-2; decisão 32):** nenhuma chamada da Analytics API feita pela E11 tem `startDate` anterior ao dia do deploy menos 10 dias (teste que inspeciona as chamadas); a cobertura inicial dos conjuntos `detalhe` e `alcance_dim` é o primeiro dia do bruto guardado; todo dia anterior lê "não medido: a coleta começou em dd/mm", com a data do conjunto, nunca zero.

**E11: segunda passada dos revisores (v2.3, 2ª passada)**
249. **Relatório refeito substitui o dia inteiro (N-2 de dados):** nas duas tabelas de lote, com o relatório A gravado para um (canal, dia) com as chaves k1, k2 e k3, gravar o relatório B, de `create_time` maior, só com k1 e k2: **a linha k3 some**, `select count(distinct source_report_id) from <tabela> where channel_id = :c and day_pt = :d` = 1, e a soma do dia é a de B. Gravar depois o A de novo (mais velho, chegando atrasado) não muda nada; gravar B duas vezes deixa as mesmas linhas; as linhas de outro dia e de outro canal não mudam (contagem antes e depois). `source_report_id` e `report_create_time` são `not null` nas duas tabelas (`information_schema.columns`). Em produção, prova diária: `select count(*) from (select channel_id, day_pt from yt_own_video_traffic_detail_daily group by 1, 2 having count(distinct source_report_id) > 1) x` = 0, e o mesmo sobre `yt_own_video_reach_dim_daily`.
