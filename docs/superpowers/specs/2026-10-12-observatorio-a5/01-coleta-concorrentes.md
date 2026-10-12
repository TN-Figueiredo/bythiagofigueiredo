# Observatório, fase A5 (spec v2.2), parte 01: coleta dos concorrentes

> Parte do spec da A5 v2.2, dividido em 12/10/2026 só movendo texto (nenhuma frase mudou; a numeração de seções, etapas, migrations, perguntas e itens de aceite é a do original). Índice, cabeçalho "O que mudou" e tabela "onde está cada seção": [`../2026-10-12-observatorio-a5-concorrentes-design.md`](../2026-10-12-observatorio-a5-concorrentes-design.md).

## 4. Parte 1: coleta dos concorrentes

Princípios, valem para E1 a E3:

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
  add column if not exists missing_since date,                 -- 1ª data (São Paulo) em que videos.list não devolveu o vídeo; nulo = veio
  add column if not exists last_seen_at timestamptz,           -- última leitura em que o vídeo VEIO (a "última contagem" da fila de 4.5 é desta data)
  add column if not exists removal_decision text check (removal_decision in ('manter')),  -- resposta do dono na fila de 4.5; nulo = sem resposta (o dado fica)
  add column if not exists removal_decided_at timestamptz,
  add column if not exists removal_decided_by uuid;            -- auth.users.id de quem respondeu
alter table public.competitor_videos alter column view_count drop default;   -- hoje default 0

-- 2. Estado atual do canal
alter table public.competitor_channels
  add column if not exists custom_url text,                    -- handle
  add column if not exists description text,
  add column if not exists published_at timestamptz,           -- criação do canal
  add column if not exists country text,
  add column if not exists subscribers_hidden boolean,
  add column if not exists missing_since date,                 -- channels.list sem item
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
  precision text not null check (precision in ('6h', '1d', '7d', 'first')),
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
- **Sumiço:** vídeo pedido e não devolvido por `videos.list` ganha `missing_since` e uma versão `availability = 'sumiu'`; se voltar, `missing_since` vira nulo e abre `'no_ar'`. Uma leitura só não basta: marca na **segunda** leitura seguida sem o vídeo (falha de rede não é sumiço). **A E1 só marca; nunca apaga.** O que acontece depois é a fila de 4.5 (etapa E9): o dado fica até o dono responder.
- **Conserto junto (sem migration):** `comment_count` deixa de receber 0 por falta (`competitor-sync.ts:467` passa a usar `optCount`); as 64 linhas com 0 ficam como estão até a próxima leitura as corrigir. As unidades de cota de cada execução passam a ser gravadas em `youtube_quota_usage` (soma do dia e, em `operations`, o total por modo).
- **`competitor_channel_removal_impact`** é recriada contando as duas tabelas novas.
- **Zero × não medido:** coluna nula = a API não devolveu; sinalizador `true` com contagem nula = "não medido" com motivo.
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
```

`competitor_video_daily` **não muda de forma** (chave `video_id, snap_date`; `views` em contagem acumulada; `likes` e `comments` nulos quando ausentes). A linha semanal é uma linha comum, mais espaçada; a faixa de cada intervalo é deduzida da distância entre dois pontos seguidos (até 36 h: diário; até 8 dias: semanal; mais: buraco), sem coluna nova.

**Efeito no código que já existe (obrigação do plano, cada um com teste):**

1. `series.ts`, `intervalsOf`: passa a aceitar intervalo semanal como **taxa média da semana**, marcado como tal; continua recusando buraco. Efeito de troca (`effect.ts`) e múltiplo "mesmo dia de vida" continuam exigindo pontos diários: sobre série semanal respondem "inconclusivo: série semanal".
2. `load.ts`: lê a série dos observados **e** dos que têm linha na janela pedida; o teto de 365 dias fica. `ObsVideo` ganha a faixa (`tier`), sem mudar o significado de `tracked` (os 50), que segue sendo a base dos números atuais das telas.
3. `pack.ts`: mais vídeos com série aumentam o pacote do canal; o teto é 2 MB. O plano **mede** o pacote do maior canal com um ano simulado antes de ligar a leitura semanal nas telas; se passar, a série semanal é lida à parte, sob demanda (página do vídeo), e não entra no pacote. `PACK_VERSION` sobe.
4. `competitor-sync.ts`: `loadTracked` vira `loadDailySet` (a regra da tabela acima); nova `loadWeeklyDue`; a leitura das primeiras horas reaproveita a resposta da página de uploads (0 chamada a mais).
5. Orçamento do cron: `runCompetitorBatch` tem 200 s por execução e 15 canais por lote (`cron/sync-youtube/route.ts`); a passada semanal soma no máximo uma chamada por 50 vídeos devidos no dia. O plano mede o tempo com 75 canais simulados antes de promover.

**Retroação:** nenhuma. Vídeo antigo ganha o primeiro ponto na semana do deploy.

> **Emenda v2.1:** com a E15 (4.7) a faixa "Primeiras horas" passa de 4 leituras por dia para **uma por hora**, na mesma tabela `competitor_video_early`, e o item de aceite 16 passa a exigir 60 leituras em 72 horas.

### 4.4 Etapa E3: playlists (só se a pergunta 1 for "sim"; migration MG3)

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
- **Apagar.** Pede confirmação escrita (digitar `APAGAR`) e mostra antes a contagem do que vai sumir. Apaga, para o vídeo: a linha de `competitor_videos` e, em cascata, a série (`competitor_video_daily`, `competitor_video_early`), as marcas (`competitor_video_marks`), as versões de título, miniatura e descrição, o histórico de campo, o `raw`, as mudanças (`competitor_changes`), salvos e fixação; os itens dele em `competitor_playlist_items` (por id do YouTube); **os arquivos de miniatura no Blob** (`observatorio/thumbs/<uuid>/…`, todas as versões); e invalida o pacote em cache do canal. Para o canal inteiro: o mesmo fluxo de remover canal que já existe (`competitor_channel_removal_impact` mostra a contagem), mais as miniaturas. **Não exporta antes**: é a única exceção à regra "exportar antes de apagar" de 9.2, porque o motivo de apagar aqui é não ter mais o dado. Se parte dele já foi para o arquivo, a tela lista os arquivos que o contêm e **prepara os comandos** para o dono os apagar no NAS (um por linha; escrita no NAS é do dono), e o item só é dado por concluído quando ele marca que rodou.

**O que sobra depois de "apagar": uma linha sem conteúdo**, para o vídeo não voltar a ser tratado como novo e para o registro existir.

```sql
create table if not exists public.competitor_removed_items (       -- migration MG1
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  kind text not null check (kind in ('video', 'canal')),
  youtube_id text not null,                  -- id público do vídeo (11 caracteres) ou do canal; NENHUM título, texto, contagem ou imagem
  competitor_channel_id uuid,                -- sem FK: o canal pode ter sido apagado junto
  missing_since date,
  decided_at timestamptz not null default now(),
  decided_by uuid not null,
  rows_deleted jsonb not null,               -- contagem por tabela
  blobs_pending text[] not null default '{}',-- caminhos do Blob ainda não apagados; vazio = tudo apagado
  archive_pending boolean not null default false,  -- há cópia no arquivo esperando o dono apagar no NAS
  unique (site_id, kind, youtube_id)
);
alter table public.competitor_removed_items enable row level security;
drop policy if exists "competitor_removed_items_select" on public.competitor_removed_items;
create policy "competitor_removed_items_select" on public.competitor_removed_items
  for select using (public.can_edit_site(site_id));
```

- **Atomicidade e "falha em verde".** Uma função `competitor_video_purge(p_site uuid, p_video uuid, p_actor uuid)` (`execute` só para `service_role`) apaga as linhas e grava a linha acima na mesma transação, devolvendo os caminhos do Blob. Os arquivos são apagados **depois** do commit; o que falhar fica em `blobs_pending` e a tela mostra "faltam N miniaturas", com nova tentativa. Um item com `blobs_pending` ou `archive_pending` não é "apagado": é "apagando".
- **Quem pode.** A ação de servidor valida `canAdminSite(siteId)` antes de qualquer uso do cliente de serviço (regra do projeto).
- **Registro.** Cada resposta grava em `audit_log` (com `set_audit_context`): ação (`competitor_missing_keep` / `competitor_missing_purge`), quem, alvo (id do YouTube), contagem por tabela; **sem título nem conteúdo** no caso de apagar.
- **Se o vídeo apagado voltar ao ar:** a sincronização o encontra em `competitor_removed_items`, **não o recoleta** e põe um item na fila: "voltou ao ar; você apagou em dd/mm. Voltar a acompanhar?".
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
9. As contagens das telas não mudam: "Trocas N" da lista, do painel e da comparação iguais antes e depois do deploy para os 15 canais; `competitors/changes` devolve o mesmo corpo sem parâmetro.
10. `youtube_quota_usage` tem a linha do dia com `units_used > 0` e o total por modo em `operations`.
11. Usuário sem `can_edit_site` não lê `competitor_raw`; usuário sem `can_view_site` não lê `competitor_field_versions` (teste de RLS com o GUC `app.site_id` forjado por papel sem superusuário, regra do projeto).
12. **NP-E1:** `select count(distinct competitor_channel_id) from competitor_raw where last_seen_at::date = :hoje` = número de canais sincronizados no dia; e `select count(*) from competitor_videos where last_checked_at::date = :hoje and discovered_at is null and published_at > '<deploy>'` = 0.

**E2: série**
13. Todo vídeo em faixa diária tem linha do dia: `select count(*) from competitor_videos v where series_tier = 'diaria' and missing_since is null and not exists (select 1 from competitor_video_daily d where d.video_id = v.id and d.snap_date = :hoje)` = 0, depois das 18:00 de São Paulo.
14. Vídeo com idade ≤ 30 dias fora dos 50 mais recentes está em faixa diária (teste com canal de 80 vídeos em 30 dias).
15. Nenhum vídeo guardado fica mais de 8 dias sem ponto: `select count(*) from competitor_videos v where missing_since is null and published_at is not null and not exists (select 1 from competitor_video_daily d where d.video_id = v.id and d.snap_date > :hoje - 8)` = 0, a partir do oitavo dia.
16. Vídeo descoberto com menos de 24 h tem pelo menos 8 leituras em `competitor_video_early` ao completar 72 h (tolerância: 1 faixa perdida); vídeo descoberto depois de 24 h não tem nenhuma.
17. Promoção: vídeo semanal com ganho de 1.000 views e 5% numa semana tem `daily_until = :hoje + 28` e linha diária no dia seguinte; troca de título num vídeo semanal faz o mesmo; no dia 29 volta a semanal sem perder linha.
18. Canal com mais de 200 vídeos na regra diária: 200 em faixa diária, o resto semanal, e a execução registra o número cortado (não é silencioso).
19. O motor trata intervalo semanal como média da semana e buraco como buraco; efeito de troca sobre série semanal responde "inconclusivo: série semanal" (testes em `series` e `effect`).
20. Os números atuais das telas (views por dia, múltiplo, mediana) dos 15 canais não mudam com o deploy (comparação de antes e depois sobre a mesma base).
21. O pacote do maior canal com um ano de série simulada cabe em `PACK_BUDGET`, ou a série semanal fica fora do pacote; `PACK_VERSION` subiu e `pack-shape.test.ts` passa.
22. Uma execução do cron com 75 canais simulados termina dentro dos 200 s do lote, ou deixa `remainingDue` para a seguinte sem perder o dia.
23. **NP-E2:** `select series_tier, count(*) from competitor_videos where missing_since is null group by 1` comparado com `select count(*) from competitor_video_daily where snap_date = :hoje`: diários do dia ≥ vídeos em faixa diária; e semanais lidos nos últimos 7 dias = vídeos em faixa semanal.

**E3: playlists**
24. Toda playlist pública de um canal aparece em `competitor_playlists` em até 7 dias; item removido ganha `removed_since`; playlist apagada, `missing_since`.
25. Canal com mais de 50 playlists: a execução registra o corte e a semana seguinte cobre as restantes.
26. **NP-E3:** `select count(distinct competitor_channel_id) from competitor_playlists where last_seen_at > now() - interval '8 days'` = canais com pelo menos uma playlist.

**E9: o que saiu do YouTube**
66. Vídeo com `missing_since` e sem decisão aparece na fila com todos os campos de 4.5 e a frase "o YouTube não diz o motivo"; um canal inteiro fora do ar é **um** item.
67. **Sem resposta, o dado fica:** teste que avança o relógio 400 dias, roda todas as rotinas (sincronização, crons, export de lote por idade) e afirma que nenhuma linha de conteúdo, versão ou miniatura do vídeo ausente foi apagada.
68. "Manter": grava decisão, quem e quando, e uma linha em `audit_log`; o vídeo segue nas telas com a pastilha e nas medidas do tempo em que esteve no ar.
69. "Apagar": zero linhas do vídeo em cada tabela listada em 4.5; nenhum arquivo no prefixo dele no Blob; uma linha em `competitor_removed_items` só com id, datas e contagens; `audit_log` sem título nem conteúdo; o pacote em cache do canal foi invalidado.
70. Falha ao apagar no Blob: `blobs_pending` preenchido, a tela diz "apagando: faltam N miniaturas", e a nova tentativa conclui (teste que faz o Blob falhar uma vez).
71. Usuário sem `canAdminSite` não consegue nenhuma das duas respostas; usuário só de leitura não vê a fila nem `competitor_removed_items`.
72. Vídeo apagado que volta ao ar **não** é recoletado e gera o item "voltou ao ar; você apagou em dd/mm".
73. Vídeo sem decisão que volta ao ar sai da fila sozinho, com a volta no histórico de campo.
