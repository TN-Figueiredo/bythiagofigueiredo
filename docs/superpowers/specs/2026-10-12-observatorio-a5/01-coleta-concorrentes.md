# Observatório, fase A5 (spec v2.3), parte 01: coleta dos concorrentes

> Parte do spec da A5 v2.2, dividido em 12/10/2026 só movendo texto (nenhuma frase mudou; a numeração de seções, etapas, migrations, perguntas e itens de aceite é a do original). Índice, cabeçalho "O que mudou" e tabela "onde está cada seção": [`../2026-10-12-observatorio-a5-concorrentes-design.md`](../2026-10-12-observatorio-a5-concorrentes-design.md).

> **v2.3 (12/10/2026, resposta ao portão de fim de spec).** Emendas localizadas, marcadas "v2.3" com o achado ou a decisão que as pediu. **A etapa E3 (playlists) e a migration MG3 foram retiradas da fase** (decisão 32 do dono: "depois, num spec de pós-conclusão"); o texto de 4.4 fica só como esboço para esse spec, e os itens 24 a 26 estão marcados. A numeração antiga não mudou. Onde um trecho antigo divergir de uma emenda v2.3, vale a emenda. Respostas aos revisores: `.superpowers/sdd/a5/resposta-revisao-spec.md`.

## 4. Parte 1: coleta dos concorrentes

Princípios, valem para E1 e E2 (e valeriam para a E3, retirada na v2.3):

- **D1. Nada de chamada nova por vídeo.** As partes novas entram nas chamadas que já existem (`videos.list` de 50 em 50, `channels.list`).
- **D2. Nunca zero por falta.** Contagem ausente na resposta é nulo mais o sinalizador; o leitor diz o motivo.
- **D3. O estado atual fica em `competitor_videos` e `competitor_channels`; o histórico fica em tabela própria.** A conta "Trocas" das telas (título + miniatura) e `competitor_changes` não mudam: nenhum tipo novo entra em `competitor_video_versions.field` nem em `competitor_changes.change_type`, para que contagens, notificações e o endpoint do Cowork continuem dizendo o mesmo número.
- **D4. A regra de contagem de views é função da data** (corte em 24/08/2026 na Data API), calculada por uma função única no código (`countRuleOf(dia)`), **sem coluna** nas tabelas de série. Diverge do inventário (que propunha `count_rule text`): a coluna custaria cerca de 15% do espaço da maior tabela para guardar um valor derivável.
- **D5. Dia:** `snap_date` é a data de São Paulo (UTC-3), como hoje. Nunca se junta ao "dia do YouTube" do canal próprio sem aviso.
- **D6. RLS no padrão existente de `competitor_*`:** `enable row level security`; leitura por `public.can_view_site(site_id)` (dado público do YouTube, mesmo nível das tabelas atuais); `raw` por `public.can_edit_site(site_id)`; nenhuma policy de escrita (só service role); sempre `drop policy if exists` antes de `create policy`. Toda tabela nova leva `site_id` desnormalizado.
- **D7. Migration só com o dono**, criada por `npm run db:new <nome>`; o DDL abaixo é proposta em texto, aditivo e idempotente.

### 4.1 Etapa E1: campos com histórico, sinalizadores, `raw` das partes pedidas

**O que se perde a cada dia sem ela:** a data de cada mudança de tags, categoria, duração, idioma e formato; a diferença entre "0 comentários" e "comentários desligados"; a data em que um vídeo sumiu.

**Coleta.** `videos.list?part=snippet,statistics,contentDetails,liveStreamingDetails` (hoje sem a última) nas três chamadas existentes (página de uploads, passada diária, fixados; a passada diária hoje pede só `snippet,statistics` e passa a pedir as quatro). `channels.list?part=contentDetails,snippet,statistics` não muda. Custo: 0 unidade a mais (o quadro de cota cobra por chamada, não por parte; inventário 2.3).

**DDL proposto (migration MG1).**

```sql
-- 1. Estado atual do vídeo (colunas novas; nulo = a API não devolveu)
alter table public.competitor_videos
  add column if not exists discovered_at timestamptz,          -- instante da 1ª leitura; nulo nas linhas antigas (nunca preenchido por palpite)
  add column if not exists default_language text,
  add column if not exists default_audio_language text,
  add column if not exists live_broadcast_content text,        -- 'none' | 'upcoming' | 'live'
  add column if not exists live_scheduled_start_at timestamptz,
  add column if not exists live_actual_start_at timestamptz,
  add column if not exists live_actual_end_at timestamptz,
  add column if not exists was_live boolean,                   -- a resposta trouxe liveStreamingDetails: ao vivo OU estreia
  add column if not exists comments_disabled boolean,          -- commentCount ausente na resposta
  add column if not exists likes_hidden boolean,               -- likeCount ausente na resposta
  add column if not exists views_hidden boolean,               -- v2.3 (I-11): viewCount ausente na resposta (estatística oculta, estreia agendada)
  add column if not exists miss_streak smallint not null default 0,   -- v2.3 (I-10): leituras SEGUIDAS sem o vídeo; zera quando ele vem. É o estado da "segunda leitura"
  add column if not exists missing_since date,                 -- 1ª data (São Paulo) em que videos.list não devolveu o vídeo; nulo = veio
  add column if not exists last_seen_at timestamptz,           -- última leitura em que o vídeo VEIO (a "última contagem" da fila de 4.5 é desta data)
  add column if not exists removal_decision text check (removal_decision in ('manter')),  -- resposta do dono na fila de 4.5; nulo = sem resposta (o dado fica)
  add column if not exists removal_decided_at timestamptz,
  add column if not exists removal_decided_by uuid;            -- auth.users.id de quem respondeu
alter table public.competitor_videos alter column view_count drop default;   -- hoje default 0
alter table public.competitor_videos alter column like_count drop default;      -- v2.3: os dois também têm default 0 (medido), contra o princípio D2
alter table public.competitor_videos alter column comment_count drop default;   -- NC (C0.8): se forem NOT NULL, a MG1 leva também `drop not null`

-- 2. Estado atual do canal
alter table public.competitor_channels
  add column if not exists custom_url text,                    -- handle
  add column if not exists description text,
  add column if not exists published_at timestamptz,           -- criação do canal
  add column if not exists country text,
  add column if not exists subscribers_hidden boolean,
  add column if not exists missing_since date,                 -- channels.list sem item
  add column if not exists miss_streak smallint not null default 0,   -- v2.3 (I-10), como no vídeo
  add column if not exists last_seen_at timestamptz,
  add column if not exists removal_decision text check (removal_decision in ('manter')),
  add column if not exists removal_decided_at timestamptz,
  add column if not exists removal_decided_by uuid;
alter table public.competitor_channel_snapshots
  add column if not exists subscribers_hidden boolean;

-- 3. Histórico de campo (mesma forma de competitor_video_versions: uma linha por valor, com início, fim e precisão)
create table if not exists public.competitor_field_versions (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  video_id uuid references public.competitor_videos(id) on delete cascade,   -- nulo = campo do canal
  field text not null,                 -- catálogo no código (abaixo); sem check: campo novo não exige migration
  value jsonb,                         -- o valor como veio; nulo = a API deixou de devolver
  value_hash text not null,            -- sha256 do JSON canônico (chaves ordenadas)
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  window_start timestamptz,            -- última leitura boa antes da mudança (a mudança ocorreu entre window_start e first_seen_at)
  precision text not null check (precision in ('6h', '1d', '7d', 'gap', 'first')),   -- v2.3: 'gap' = a janela da mudança é um buraco de coleta, não um intervalo normal
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
  video_id uuid references public.competitor_videos(id) on delete cascade,   -- nulo = resposta do canal
  raw_sha256 text not null,            -- do JSON canônico SEM statistics, etag e concurrentViewers
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  is_current boolean not null default true,
  raw jsonb not null
);
create unique index if not exists idx_craw_one_current_video on public.competitor_raw (video_id) where is_current and video_id is not null;
create unique index if not exists idx_craw_one_current_channel on public.competitor_raw (competitor_channel_id) where is_current and video_id is null;
alter table public.competitor_raw enable row level security;
drop policy if exists "competitor_raw_select" on public.competitor_raw;
create policy "competitor_raw_select" on public.competitor_raw for select using (public.can_edit_site(site_id));
```

- **Chave e índices:** identidade própria, não `(id, hash)` como no inventário: um valor que vai e volta (A, B, A) repete o hash e quebraria a chave. O índice parcial `is_current` dá o estado de agora sem varrer o histórico.
- **Catálogo de campos** (constante em `lib/`, com teste que falha se um campo for gravado fora dele). Vídeo: `tags`, `category_id`, `duration_seconds`, `default_language`, `default_audio_language`, `live_broadcast_content`, `comments_disabled`, `likes_hidden`, `availability` (`'no_ar'` | `'sumiu'`). Canal: `name`, `custom_url`, `description`, `country`, `avatar_url`, `subscribers_hidden`, `availability`. A primeira linha de cada campo tem `precision = 'first'` e **não é mudança**. Título, miniatura e descrição continuam em `competitor_video_versions`.
- **Unidades:** instantes em UTC; `duration_seconds` inteiro; `value` de `tags` é a lista na ordem da API (reordenar é mudança, e a tela diz "mesma lista, outra ordem").
- **Escrita atômica:** uma função `apply_competitor_field_plan(p_channel uuid, p_video uuid, p_close bigint[], p_open jsonb)` no molde de `apply_competitor_version_plan` (security invoker, `search_path` fixo, `execute` só para `service_role`): fecha e abre versões na mesma transação. O `raw` usa o mesmo molde.
- **Sumiço:** vídeo pedido e não devolvido por `videos.list` ganha `missing_since` e uma versão `availability = 'sumiu'`; se voltar, `missing_since` vira nulo e abre `'no_ar'`. Uma leitura só não basta: marca na **segunda** leitura seguida sem o vídeo (falha de rede não é sumiço). **v2.3 (achado I-10): a regra das duas leituras precisa de onde guardar a primeira falta.** É a coluna `miss_streak`: cada leitura do lote em que o vídeo foi pedido e não veio soma 1; a que traz o vídeo zera. `missing_since` é gravado quando `miss_streak` chega a 2, com a data da **primeira** das duas leituras. O mesmo vale para o canal. Sem a coluna, o estado se perdia entre uma execução e a seguinte (item 221). **A E1 só marca; nunca apaga.** O que acontece depois é a fila de 4.5 (etapa E9): o dado fica até o dono responder.
- **Conserto junto (sem migration):** `comment_count` deixa de receber 0 por falta (`competitor-sync.ts:467` passa a usar `optCount`); as 64 linhas com 0 ficam como estão até a próxima leitura as corrigir. As unidades de cota de cada execução passam a ser gravadas em `youtube_quota_usage` (soma do dia e, em `operations`, o total por modo). **v2.3 (revisão de dados, seção 5):** (i) o "dia" de `youtube_quota_usage` é o **dia do Pacífico**, que é quando a cota do YouTube zera, não o de São Paulo; (ii) a soma é **uma instrução atômica** (`insert … on conflict (<dia>) do update set units_used = youtube_quota_usage.units_used + excluded.units_used`), nunca ler, somar e gravar, porque dois disparos podem somar ao mesmo tempo; (iii) `operations` é um objeto `{"<modo>": unidades}`, somado por chave na mesma instrução. **NC (C0.8):** o padrão atual da coluna é lista; se for, a MG1 troca o padrão para `'{}'::jsonb`. Item 224.
- **`competitor_channel_removal_impact`** é recriada contando as duas tabelas novas.
- **Zero × não medido:** coluna nula = a API não devolveu; sinalizador `true` com contagem nula = "não medido" com motivo.
- **v2.3 (achado I-8): a versão corrente não é tocada quando nada muda.** `last_seen_at` de `competitor_field_versions` e de `competitor_raw` **não** é regravado a cada sincronização: seriam cerca de 50 mil regravações por dia (1.390 vídeos × 9 campos × 4 leituras), o mesmo inchaço que a dieta do diário está consertando (fato 11). A "última vez vista" é a do vídeo ou do canal (`competitor_videos.last_seen_at`, `competitor_channels.last_seen_at`, uma regravação por leitura); ela é **copiada para a versão só quando a versão é fechada**. Enquanto a versão é a corrente, o leitor usa a data do vídeo. Item 223; o item 12 foi corrigido.
- **v2.3: a precisão de cada mudança de campo** segue a distância entre `window_start` e `first_seen_at`: até 8 horas, `'6h'`; até 36 horas, `'1d'`; até 8 dias com todos os dias do meio em faixa semanal (4.3), `'7d'`; qualquer outra, `'gap'` (a coleta ficou parada, e a tela diz "mudou em algum momento entre dd/mm e dd/mm").
- **v2.3 (achado I-11): vídeo sem contagem de views.** Estreia agendada (`live_broadcast_content = 'upcoming'`) e vídeo com estatística oculta não trazem `viewCount`. A linha de série não é gravada (as colunas `views` das três tabelas de série continuam `not null`), o vídeo ganha `views_hidden = true`, e as consultas de prova (itens 13, 15 e 128) **excluem** esses vídeos; a execução devolve quantos foram excluídos. Sem isso os três itens dariam diferente de zero para sempre.
- **Retroação:** nenhuma. O histórico começa na primeira leitura depois do deploy; a tela diz "histórico de tags, categoria e duração desde dd/mm".

### 4.2 O que o Blob guarda (sem mudança)

Uma cópia por versão de miniatura, como hoje (fato 10). Nada novo é arquivado: a imagem do canal entra só como URL no histórico de campo. O Blob continua com URL pública nesta fase (padrão assumido, seção 13). Duas saídas apagam arquivos dele: a resposta "apagar" da fila de 4.5 e a remoção de um canal inteiro (9.2).

### 4.3 Etapa E2: série desde o dia 0, primeiras horas, catálogo semanal

**O que se perde a cada dia sem ela:** a série dos 715 vídeos antigos (a API só dá o valor de agora); as primeiras horas de todo vídeo novo; os dias de um vídeo empurrado para fora dos 50 por canal que publica muito.

**Regra de cadência (explícita, calculada a cada sincronização).**

| Faixa | Quem | Leitura |
|---|---|---|
| **Primeiras horas** | vídeo com `discovered_at − published_at ≤ 24 h`, enquanto a idade for menor que 72 h | em toda sincronização do canal (4 por dia: 00, 06, 12 e 18 de São Paulo), em `competitor_video_early` |
| **Diária** | idade ≤ 30 dias, **ou** entre os `video_limit` (50) mais recentes do canal (regra de hoje, sem regressão), **ou** fixado, **ou** promovido (`daily_until ≥ hoje`) | uma linha por dia, 12:00 de São Paulo, em `competitor_video_daily` |
| **Semanal** | todo o resto dos vídeos guardados | uma linha por semana, no dia `hash(id do vídeo) mod 7` (espalha a carga), na mesma tabela |

- **Promoção de semanal para diária, por 28 dias** (`daily_until = hoje + 28`): (a) o vídeo ganhou em uma semana pelo menos 1.000 views **e** pelo menos 5% do total dele [DONO, pergunta 6]; ou (b) foi detectada mudança de título, miniatura ou descrição (para medir o efeito, M5).
- **Rebaixamento:** automático quando nenhuma condição da faixa diária vale mais. Nada é apagado ao rebaixar.
- **Teto de segurança:** no máximo `RULES.videoLimitMax` (200) vídeos em faixa diária por canal, mais os fixados. Acima disso os mais antigos da regra "idade ≤ 30 dias" vão para a semanal **e a execução registra quantos** (em `youtube_quota_usage.operations` e no retorno do cron): corte silencioso é proibido.
- **O catálogo que não está guardado não é buscado.** 14 dos 15 canais estão em modo `recent` (1.389 vídeos guardados de 6.089 publicados). Buscar o catálogo inteiro é a pergunta 7; o padrão é não.

**DDL proposto (migration MG2).**

```sql
alter table public.competitor_videos
  add column if not exists series_tier text check (series_tier in ('diaria', 'semanal')),   -- nulo = ainda não classificado
  add column if not exists series_tier_since date,
  add column if not exists daily_until date;

create table if not exists public.competitor_video_early (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  taken_at timestamptz not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  views bigint not null,
  likes bigint,            -- nulo = oculto
  comments bigint,         -- nulo = desligado
  primary key (video_id, taken_at)
);
alter table public.competitor_video_early enable row level security;
drop policy if exists "competitor_video_early_select" on public.competitor_video_early;
create policy "competitor_video_early_select" on public.competitor_video_early
  for select using (public.can_view_site(site_id));

-- v2.3 (achado C-2 da revisão de dados): a faixa em vigor NO TEMPO.
-- Sem ela, um buraco de 3 dias num vídeo de faixa diária seria lido como "intervalo semanal": ausência viraria dado.
create table if not exists public.competitor_video_tier_spans (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  from_date date not null,              -- 1º dia (São Paulo) em que a faixa valeu
  to_date date,                         -- último dia; nulo = em vigor
  tier text not null check (tier in ('diaria', 'semanal')),
  site_id uuid not null references public.sites(id) on delete cascade,
  primary key (video_id, from_date),
  check (to_date is null or to_date >= from_date)
);
create unique index if not exists idx_cvts_one_open on public.competitor_video_tier_spans (video_id) where to_date is null;
alter table public.competitor_video_tier_spans enable row level security;
drop policy if exists "competitor_video_tier_spans_select" on public.competitor_video_tier_spans;
create policy "competitor_video_tier_spans_select" on public.competitor_video_tier_spans
  for select using (public.can_view_site(site_id));
```

`competitor_video_daily` **não muda de forma** (chave `video_id, snap_date`; `views` em contagem acumulada; `likes` e `comments` nulos quando ausentes). A linha semanal é uma linha comum, mais espaçada; ~~a faixa de cada intervalo é deduzida da distância entre dois pontos seguidos (até 36 h: diário; até 8 dias: semanal; mais: buraco), sem coluna nova.~~ **Corrigido na v2.3 (achado C-2, crítico):** deduzir a faixa só da distância faz um buraco valer como dado (hoje o motor recusa intervalo sobre dia faltante, fato 7; com a regra antiga, um vídeo diário que ficou 3 dias sem leitura, por cron parado, seria lido como "taxa média da semana"). **A regra que vale:** a troca de `series_tier` grava, na mesma transação, o fim da faixa anterior e o começo da nova em `competitor_video_tier_spans` (acima; uma linha por troca, duas ou três por vídeo na vida). Entre dois pontos seguidos A e B: até 36 horas de distância, **diário**; mais de 36 horas e até 8 dias, **semanal só se todos os dias sem leitura entre A e B estavam em faixa semanal**; em qualquer outro caso, **buraco**, e o motor recusa o intervalo como hoje. Vídeo sem nenhuma linha de faixa (anterior à MG2) nunca tem intervalo semanal. A tabela foi preferida a um campo em `competitor_field_versions` (a sugestão do revisor) porque um campo de histórico entraria na lista de mudanças de M5, na "Linha do tempo" e no `campos=todos` do Cowork, e pediria filtro em cada leitor. Itens 23 (corrigido) e 222. **v2.3, 2ª passada (m-2 de dados): duas trocas de faixa no mesmo dia.** A chave é (vídeo, `from_date`) e há 4 sincronizações por dia: promoção e rebaixamento no mesmo dia bateriam nela. Regra: a segunda troca do dia **troca a faixa da linha aberta daquele dia** (`update ... set tier = <nova> where video_id = V and from_date = :hoje and to_date is null`), sem fechar nem abrir linha; o dia vale pela faixa em que terminou. Se com isso duas linhas vizinhas ficarem com a mesma faixa, não são fundidas: o leitor as trata como contínuas.

**Efeito no código que já existe (obrigação do plano, cada um com teste):**

1. `series.ts`, `intervalsOf`: passa a aceitar intervalo semanal como **taxa média da semana**, marcado como tal; continua recusando buraco. **v2.3:** "semanal" é o da regra corrigida acima (faixa gravada no tempo), não o da distância. Efeito de troca (`effect.ts`) e múltiplo "mesmo dia de vida" continuam exigindo pontos diários: sobre série semanal respondem "inconclusivo: série semanal".
2. `load.ts`: lê a série dos observados **e** dos que têm linha na janela pedida; o teto de 365 dias fica. `ObsVideo` ganha a faixa (`tier`), sem mudar o significado de `tracked` (os 50), que segue sendo a base dos números atuais das telas.
3. `pack.ts`: mais vídeos com série aumentam o pacote do canal; o teto é 2 MB. O plano **mede** o pacote do maior canal com um ano simulado antes de ligar a leitura semanal nas telas; se passar, a série semanal é lida à parte, sob demanda (página do vídeo), e não entra no pacote. `PACK_VERSION` sobe.
4. `competitor-sync.ts`: `loadTracked` vira `loadDailySet` (a regra da tabela acima); nova `loadWeeklyDue`; a leitura das primeiras horas reaproveita a resposta da página de uploads (0 chamada a mais).
5. Orçamento do cron: `runCompetitorBatch` tem 200 s por execução e 15 canais por lote (`cron/sync-youtube/route.ts`); a passada semanal soma no máximo uma chamada por 50 vídeos devidos no dia. O plano mede o tempo com 75 canais simulados antes de promover.

**Retroação:** nenhuma. Vídeo antigo ganha o primeiro ponto na semana do deploy.

> **Emenda v2.1:** com a E15 (4.7) a faixa "Primeiras horas" passa de 4 leituras por dia para **uma por hora**, na mesma tabela `competitor_video_early`, e o item de aceite 16 passa a exigir 60 leituras em 72 horas.

### 4.4 Etapa E3: playlists (só se a pergunta 1 for "sim"; migration MG3)

> **Retirada na v2.3 (decisão 32 do dono, 12/10): "Playlists: depois; anotar num spec de pós-conclusão".** A etapa E3 e a migration MG3 **não fazem parte desta fase**: não entram na sequência, no volume, na cota nem em nenhuma tela. O texto abaixo fica só como esboço para o spec de pós-conclusão (`.superpowers/sdd/a5/pos-conclusao.md`). **O que se perde enquanto isso, dito sem suavizar:** a data de entrada de cada vídeo numa playlist vem da API e não se perde; **remoções de itens e renomeações de playlist feitas até lá não retroagem.** Uma nota para quando voltar: o campo `playlist_title` em `competitor_field_versions` quebraria o índice "um corrente por canal e campo" (um canal tem várias playlists); precisa de chave própria.

`playlists.list?part=snippet,contentDetails&channelId=…` e `playlistItems.list?part=snippet,contentDetails` de cada playlist, uma vez por semana e canal (mesmo espalhamento por `hash mod 7`). Teto de 50 playlists por canal e de 500 itens por playlist por semana; o que passar entra na semana seguinte e a execução registra o corte.

```sql
create table if not exists public.competitor_playlists (
  playlist_id text primary key,                       -- id do YouTube
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  title text,
  published_at timestamptz,
  item_count integer,                                 -- contentDetails.itemCount; NC se a API o devolve (inventário 2.3): nulo se não vier
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  missing_since date
);
create index if not exists idx_cpl_channel on public.competitor_playlists (competitor_channel_id);

create table if not exists public.competitor_playlist_items (
  playlist_id text not null references public.competitor_playlists(playlist_id) on delete cascade,
  youtube_video_id text not null,                     -- 11 caracteres; pode ser vídeo de outro canal
  site_id uuid not null references public.sites(id) on delete cascade,
  position integer,
  added_at timestamptz,                               -- snippet.publishedAt do item = quando entrou na playlist
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  removed_since date,                                 -- 1ª leitura sem o item
  primary key (playlist_id, youtube_video_id)
);
create index if not exists idx_cpli_video on public.competitor_playlist_items (youtube_video_id);
-- RLS nas duas: can_view_site(site_id), como em 4.1
```

Mudança de nome de playlist entra em `competitor_field_versions` (campo `playlist_title`, com o id da playlist dentro de `value`). **Retroação parcial:** `added_at` e `published_at` vêm da API, então a ordem em que a série foi montada aparece já na primeira leitura; o que saiu antes dela, não.

### 4.5 Etapa E9: o que saiu do YouTube (guardar por padrão; o dono decide caso a caso)

**Decisão do dono (12/10), que substitui a "lápide após 30 dias" da v1:** guardar tudo por padrão, com pergunta e confirmação manual, caso a caso. "Se o vídeo foi deletado por questão judicial e coisas assim a gente vai e apaga; agora se foi segredo revelado de como ter mais sucesso é bom a gente conseguir analisar."

**Regras.**

1. **Sem resposta, o dado fica.** Nenhuma rotina apaga dado de vídeo ou canal ausente: nem por prazo, nem por cron, nem pelo arquivamento de 9.2 (que só move dado antigo, e exporta antes).
2. **Entra na fila** todo vídeo ou canal com `missing_since` preenchido (segunda leitura seguida sem ele, E1) e `removal_decision` nulo. Canal que saiu inteiro é **um** item (o canal), não um item por vídeo.
3. **Sai da fila** por uma das duas respostas, ou sozinho se voltar ao ar (`missing_since` volta a nulo; a decisão anterior, se era "manter", é limpa e a volta fica no histórico de campo `availability`).

**A fila "Saíram do YouTube"** (aba do Observatório, com contador; desenho em mockup, seção 6). Cada item mostra **o que se sabe**, e só isso:

| O que | De onde |
|---|---|
| título, miniatura (a nossa cópia), canal, formato, duração | última versão guardada |
| data de publicação; data em que o Observatório o viu pela primeira vez | `published_at`, `discovered_at` (nulo nas linhas antigas: "antes de dd/mm") |
| **"não veio mais do YouTube desde dd/mm"** | `missing_since` |
| última contagem de views, curtidas e comentários, **com a data da leitura** | `competitor_videos` e `last_seen_at` |
| **o canal continua no ar?** ("sim" / "o canal inteiro também saiu, desde dd/mm") | `competitor_channels.missing_since` |
| o que há guardado: N dias de série, N versões de título, miniatura e descrição, N miniaturas no Blob, períodos já arquivados (9.2) | contagem |
| **motivo: "o YouTube não diz"** | a API devolve a mesma ausência para vídeo apagado pelo autor, tornado privado, removido por denúncia ou por ordem judicial. A tela escreve isso e **não sugere** motivo |

**As duas respostas.**

- **Manter para análise.** Grava `removal_decision = 'manter'`, quem e quando. O vídeo continua em todas as telas com a pastilha "saiu do YouTube em dd/mm · mantido para análise"; a série dele termina em `missing_since`; ele **continua** nas medidas de quando estava no ar (M1, M4, M9, M10) e a tela diz quantos vídeos fora do ar entram em cada mediana. Reversível: a pastilha tem "apagar".
- **Apagar.** Pede confirmação escrita (digitar `APAGAR`) e mostra antes a contagem do que vai sumir. Apaga, para o vídeo: a linha de `competitor_videos` e, em cascata, a série (`competitor_video_daily`, `competitor_video_early`), as marcas (`competitor_video_marks`), as versões de título, miniatura e descrição, o histórico de campo, o `raw`, as mudanças (`competitor_changes`), salvos e fixação; ~~os itens dele em `competitor_playlist_items` (por id do YouTube);~~ *(v2.3: não existe nesta fase, E3 retirada)* **os arquivos de miniatura no Blob** (`observatorio/thumbs/<uuid>/…`, todas as versões); e invalida o pacote em cache do canal. **v2.3 (achado M-3 da revisão de dados): a cascata leva mais duas tabelas que a lista acima não citava**, lidas em produção: `competitor_readings` (as leituras da forja) e `youtube_intelligence_tasks` (a fila da forja). As duas entram na contagem mostrada antes de confirmar. **E "apagar" recusa enquanto houver tarefa da forja em andamento para aquele vídeo** (tarefa tomada e ainda dentro dos 20 minutos do claim): a tela diz "a forja está lendo este vídeo; tente de novo em até 20 minutos". Sem isso, a tarefa some no meio e a forja devolve o resultado para uma linha que não existe. Os nomes dos estados da fila são a conferência C0.12. Para o canal inteiro: o mesmo fluxo de remover canal que já existe (`competitor_channel_removal_impact` mostra a contagem), mais as miniaturas. **Não exporta antes**: é a única exceção à regra "exportar antes de apagar" de 9.2, porque o motivo de apagar aqui é não ter mais o dado. Se parte dele já foi para o arquivo, a tela lista os arquivos que o contêm e **prepara os comandos** para o dono os apagar no NAS (um por linha; escrita no NAS é do dono), e o item só é dado por concluído quando ele marca que rodou.

**O que sobra depois de "apagar": uma linha sem conteúdo**, para o vídeo não voltar a ser tratado como novo e para o registro existir.

```sql
create table if not exists public.competitor_removed_items (       -- migration MG1
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  kind text not null check (kind in ('video', 'canal', 'comentario')),   -- v2.3: 'comentario' já na MG1 (4.6.7), para a MG8 não alterar o check
  youtube_id text not null,                  -- id público do vídeo (11 caracteres) ou do canal; NENHUM título, texto, contagem ou imagem
  competitor_channel_id uuid,                -- sem FK: o canal pode ter sido apagado junto
  missing_since date,
  decided_at timestamptz not null default now(),
  decided_by uuid not null,
  rows_deleted jsonb not null,               -- contagem por tabela
  blobs_pending text[] not null default '{}',-- caminhos do Blob ainda não apagados; vazio = tudo apagado
  archive_pending boolean not null default false,  -- há cópia no arquivo esperando o dono apagar no NAS
  purge_count smallint not null default 1,         -- v2.3 (M3 da revisão de software): quantas vezes este id foi apagado
  returned_seen_at timestamptz,                    -- v2.3: 1ª leitura em que o item apagado voltou a vir do YouTube; nulo = não voltou
  return_decision text check (return_decision in ('voltar', 'ignorar')),   -- v2.3: resposta do dono a "voltar a acompanhar?"; nulo = sem resposta
  return_decided_at timestamptz,
  unique (site_id, kind, youtube_id)
);
alter table public.competitor_removed_items enable row level security;
drop policy if exists "competitor_removed_items_select" on public.competitor_removed_items;
create policy "competitor_removed_items_select" on public.competitor_removed_items
  for select using (public.can_edit_site(site_id));
```

- **Atomicidade e "falha em verde".** Uma função `competitor_video_purge(p_site uuid, p_video uuid, p_actor uuid)` (`execute` só para `service_role`) apaga as linhas e grava a linha acima na mesma transação, devolvendo os caminhos do Blob. Os arquivos são apagados **depois** do commit; o que falhar fica em `blobs_pending` e a tela mostra "faltam N miniaturas", com nova tentativa. Um item com `blobs_pending` ou `archive_pending` não é "apagado": é "apagando".
- **Quem pode.** A ação de servidor valida `canAdminSite(siteId)` antes de qualquer uso do cliente de serviço (regra do projeto).
- **Registro.** Cada resposta grava em `audit_log` (com `set_audit_context`): ação (`competitor_missing_keep` / `competitor_missing_purge`), quem, alvo (**v2.3:** o id do YouTube vai em `after_data`, porque `audit_log.resource_id` é `uuid`), contagem por tabela; **sem título nem conteúdo** no caso de apagar.
- **Se o vídeo apagado voltar ao ar:** a sincronização o encontra em `competitor_removed_items`, **não o recoleta** e põe um item na fila: "voltou ao ar; você apagou em dd/mm. Voltar a acompanhar?". **v2.3 (achado M3 da revisão de software): o que acontece com a linha.** A primeira leitura em que o item volta grava `returned_seen_at`. **"Voltar":** grava `return_decision = 'voltar'`; o vídeo é coletado como novo (`discovered_at` = agora, histórico recomeçando do zero; o que foi apagado não volta) e a linha de `competitor_removed_items` **fica**, como registro de que ele já foi apagado uma vez. **"Ignorar":** grava `'ignorar'`, e o item não volta a ser perguntado. **Apagar de novo o mesmo vídeo** não bate na chave `(site_id, kind, youtube_id)`: `competitor_video_purge` grava por `on conflict … do update`, somando as contagens em `rows_deleted`, somando 1 em `purge_count`, atualizando `decided_at` e `decided_by` e limpando os três campos de volta.
- **O que a E9 não faz:** não tenta descobrir o motivo; não lê a página do YouTube; não avisa por e-mail (só o contador na aba).

## Itens de aceite deste arquivo (blocos da seção 10 do spec, com a numeração original)

**E1: campos, sinalizadores, `raw`**
1. Depois de uma rodada completa (4 faixas), todo vídeo lido tem `raw` corrente: `select count(*) from competitor_videos v where last_checked_at > now() - interval '1 day' and not exists (select 1 from competitor_raw r where r.video_id = v.id and r.is_current)` = 0.
2. Todo canal tem `raw` corrente e as colunas `custom_url` e `published_at` preenchidas (ou nulas só onde a resposta não trouxe, conferido no `raw`).
3. Uma segunda rodada sem mudança no YouTube não cria linha: contagem de `competitor_raw` e de `competitor_field_versions` igual antes e depois (teste com resposta fixa; a ordem das chaves do JSON trocada não muda o hash).
4. Mudar só `statistics` na resposta fixa não cria versão; mudar uma tag cria uma versão de `tags` com `window_start` = leitura anterior e fecha a antiga.
5. Valor que vai e volta (A, B, A) gera três versões, sem erro de chave.
6. Vídeo cuja resposta não traz `commentCount`: `comment_count` nulo e `comments_disabled = true`; nenhuma linha nova com `comment_count = 0` vinda de ausência (teste que apaga o campo da resposta).
7. Vídeo ausente de `videos.list` em duas leituras seguidas ganha `missing_since`; ausente em uma só, não; ao voltar, `missing_since` nulo e versão `availability = 'no_ar'`. Marcar **não apaga nada** (a contagem de linhas do vídeo é igual antes e depois).
8. Vídeo com `liveStreamingDetails` tem `was_live = true` e os horários; sem, `was_live = false` (não nulo) depois da primeira leitura.
9. As contagens das telas não mudam: "Trocas N" da lista, do painel e da comparação iguais antes e depois do deploy para os 15 canais; `competitors/changes` devolve o mesmo corpo sem parâmetro. **v2.3:** "iguais antes e depois" é provado sobre base congelada, pela regra do retrato da seção 10 do `00` (item 247).
10. `youtube_quota_usage` tem a linha do dia com `units_used > 0` e o total por modo em `operations`.
11. Usuário sem `can_edit_site` não lê `competitor_raw`; usuário sem `can_view_site` não lê `competitor_field_versions` (teste de RLS com o GUC `app.site_id` forjado por papel sem superusuário, regra do projeto).
12. **NP-E1:** `select count(distinct competitor_channel_id) from competitor_raw where last_seen_at::date = :hoje` = número de canais sincronizados no dia; e `select count(*) from competitor_videos where last_checked_at::date = :hoje and discovered_at is null and published_at > '<deploy>'` = 0. **Corrigido na v2.3 (achados I-8 e 9.x da revisão de dados):** `competitor_raw.last_seen_at` deixou de ser regravado, e `::date` comparava UTC com o dia de São Paulo. As duas consultas passam a ser: `select count(*) from competitor_channels c where (c.last_seen_at at time zone 'America/Sao_Paulo')::date = :hoje and not exists (select 1 from competitor_raw r where r.competitor_channel_id = c.id and r.video_id is null and r.is_current)` = 0 (todo canal visto hoje tem `raw` corrente); e `select count(*) from competitor_videos where (last_checked_at at time zone 'America/Sao_Paulo')::date = :hoje and discovered_at is null and published_at > '<deploy>'` = 0.

**E2: série**
13. Todo vídeo em faixa diária tem linha do dia: `select count(*) from competitor_videos v where series_tier = 'diaria' and missing_since is null and not exists (select 1 from competitor_video_daily d where d.video_id = v.id and d.snap_date = :hoje)` = 0, depois das 18:00 de São Paulo. **v2.3 (achado I-11):** a consulta ganha `and coalesce(v.views_hidden, false) = false and coalesce(v.live_broadcast_content, 'none') <> 'upcoming'`, e a execução devolve quantos vídeos ficaram fora por esse motivo.
14. Vídeo com idade ≤ 30 dias fora dos 50 mais recentes está em faixa diária (teste com canal de 80 vídeos em 30 dias).
15. Nenhum vídeo guardado fica mais de 8 dias sem ponto: `select count(*) from competitor_videos v where missing_since is null and published_at is not null and not exists (select 1 from competitor_video_daily d where d.video_id = v.id and d.snap_date > :hoje - 8)` = 0, a partir do oitavo dia. **v2.3 (achado I-11):** com a mesma exclusão do item 13.
16. Vídeo descoberto com menos de 24 h tem pelo menos 8 leituras em `competitor_video_early` ao completar 72 h (tolerância: 1 faixa perdida); vídeo descoberto depois de 24 h não tem nenhuma.
17. Promoção: vídeo semanal com ganho de 1.000 views e 5% numa semana tem `daily_until = :hoje + 28` e linha diária no dia seguinte; troca de título num vídeo semanal faz o mesmo; no dia 29 volta a semanal sem perder linha.
18. Canal com mais de 200 vídeos na regra diária: 200 em faixa diária, o resto semanal, e a execução registra o número cortado (não é silencioso).
19. O motor trata intervalo semanal como média da semana e buraco como buraco; efeito de troca sobre série semanal responde "inconclusivo: série semanal" (testes em `series` e `effect`).
20. Os números atuais das telas (views por dia, múltiplo, mediana) dos 15 canais não mudam com o deploy (comparação de antes e depois sobre a mesma base). **v2.3:** "a mesma base" é a base congelada da regra do retrato (seção 10 do `00`, item 247): o dado de produção muda 4 vezes por dia e não serve de base sem corte de data.
21. O pacote do maior canal com um ano de série simulada cabe em `PACK_BUDGET`, ou a série semanal fica fora do pacote; `PACK_VERSION` subiu e `pack-shape.test.ts` passa.
22. Uma execução do cron com 75 canais simulados termina dentro dos 200 s do lote, ou deixa `remainingDue` para a seguinte sem perder o dia.
23. **NP-E2:** `select series_tier, count(*) from competitor_videos where missing_since is null group by 1` comparado com `select count(*) from competitor_video_daily where snap_date = :hoje`: diários do dia ≥ vídeos em faixa diária; e semanais lidos nos últimos 7 dias = vídeos em faixa semanal. **Corrigido na v2.3 (achado C-2):** a linha de série não diz de que faixa veio; a segunda metade passa a ser: `select count(*) from competitor_videos v join competitor_video_tier_spans s on s.video_id = v.id and s.to_date is null and s.tier = 'semanal' and s.from_date <= :hoje - 8 where v.missing_since is null and coalesce(v.views_hidden, false) = false and not exists (select 1 from competitor_video_daily d where d.video_id = v.id and d.snap_date > :hoje - 8)` = 0 (todo vídeo em faixa semanal há 8 dias ou mais tem ponto nos últimos 8 dias).

**E3: playlists** *(etapa retirada na v2.3; os três itens ficam só para não quebrar referências)*
24. ~~Toda playlist pública de um canal aparece em `competitor_playlists` em até 7 dias; item removido ganha `removed_since`; playlist apagada, `missing_since`.~~ **Retirado na v2.3 (decisão 32 do dono).**
25. ~~Canal com mais de 50 playlists: a execução registra o corte e a semana seguinte cobre as restantes.~~ **Retirado na v2.3 (decisão 32 do dono).**
26. ~~**NP-E3:** `select count(distinct competitor_channel_id) from competitor_playlists where last_seen_at > now() - interval '8 days'` = canais com pelo menos uma playlist.~~ **Retirado na v2.3 (decisão 32 do dono).**

**E9: o que saiu do YouTube**
66. Vídeo com `missing_since` e sem decisão aparece na fila com todos os campos de 4.5 e a frase "o YouTube não diz o motivo"; um canal inteiro fora do ar é **um** item.
67. **Sem resposta, o dado fica:** teste que avança o relógio 400 dias, roda todas as rotinas (sincronização, crons, export de lote por idade) e afirma que nenhuma linha de conteúdo, versão ou miniatura do vídeo ausente foi apagada. **v2.3 (itens "sem verificação possível" das duas revisões):** "todas as rotinas" passa a ser a **lista fechada do que apaga**, de 9.2: o teste roda cada rotina da lista e falha se existir no código do Observatório um `delete` fora dela. E há prova em produção: o cron diário devolve `linhas_de_ausentes` (linhas de série, versões e miniaturas de vídeos com `missing_since`) e falha se o número cair sem uma decisão "apagar" registrada no dia.
68. "Manter": grava decisão, quem e quando, e uma linha em `audit_log`; o vídeo segue nas telas com a pastilha e nas medidas do tempo em que esteve no ar.
69. "Apagar": zero linhas do vídeo em cada tabela listada em 4.5; nenhum arquivo no prefixo dele no Blob; uma linha em `competitor_removed_items` só com id, datas e contagens; `audit_log` sem título nem conteúdo; o pacote em cache do canal foi invalidado. **v2.3:** "cada tabela listada em 4.5" inclui `competitor_readings` e `youtube_intelligence_tasks`; com tarefa da forja em andamento para o vídeo, "apagar" recusa e nada é apagado (teste).
70. Falha ao apagar no Blob: `blobs_pending` preenchido, a tela diz "apagando: faltam N miniaturas", e a nova tentativa conclui (teste que faz o Blob falhar uma vez).
71. Usuário sem `canAdminSite` não consegue nenhuma das duas respostas; usuário só de leitura não vê a fila nem `competitor_removed_items`.
72. Vídeo apagado que volta ao ar **não** é recoletado e gera o item "voltou ao ar; você apagou em dd/mm". **v2.3:** "voltar" recoleta o vídeo como novo e mantém a linha de `competitor_removed_items`; apagar pela segunda vez o mesmo vídeo não dá erro de chave e deixa `purge_count = 2` (teste).
73. Vídeo sem decisão que volta ao ar sai da fila sozinho, com a volta no histórico de campo.

**E1 e E2: o que as revisões acrescentaram (v2.3)**
221. **Estado da segunda leitura (achado I-10):** em duas execuções **separadas** (não na mesma chamada), a primeira ausência deixa `miss_streak = 1` e `missing_since` nulo; a segunda grava `missing_since` com a data da primeira; uma leitura que traz o vídeo entre as duas zera o contador e nada é marcado. O mesmo para canal.
222. **Buraco não vira semanal (achado C-2):** vídeo em faixa diária com 3 dias sem leitura tem o intervalo classificado como buraco, e o motor o recusa; vídeo em faixa semanal com 7 dias entre dois pontos tem intervalo semanal; vídeo rebaixado ontem tem o intervalo do último ponto diário ao primeiro semanal aceito; vídeo sem nenhuma linha em `competitor_video_tier_spans` nunca tem intervalo semanal (testes em `series`). Toda troca de `series_tier` tem a linha correspondente (`select count(*) from competitor_videos v where series_tier is not null and not exists (select 1 from competitor_video_tier_spans s where s.video_id = v.id and s.to_date is null and s.tier = v.series_tier)` = 0). **v2.3, 2ª passada (m-2 de dados):** promoção e rebaixamento do mesmo vídeo no mesmo dia deixam **uma** linha aberta, com a última faixa, sem erro de chave (teste).
223. **Sem regravação (achado I-8):** uma segunda rodada sem mudança no YouTube faz **zero** `update` em `competitor_field_versions` e em `competitor_raw` (teste que conta as escritas por tabela); ao fechar uma versão, `last_seen_at` dela recebe a data da última leitura boa do vídeo.
224. **Cota:** a linha de `youtube_quota_usage` é a do dia do Pacífico (teste com relógio falso às 03:30 de São Paulo); dois disparos que somam ao mesmo tempo resultam na soma dos dois (teste de concorrência com banco local); `operations` traz um total por modo.
225. **Vídeo sem contagem (achado I-11):** resposta fixa com uma estreia agendada e um vídeo sem `viewCount`: nenhum dos dois ganha linha de série, os dois ficam com `views_hidden = true`, as consultas dos itens 13 e 15 dão 0, e o retorno da execução traz "2 fora da prova: sem contagem".
