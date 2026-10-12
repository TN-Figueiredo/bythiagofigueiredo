# Observatório, fase A5: desempenho dos concorrentes (coleta, medidas, telas) e dieta do diário próprio

Data: 12/10/2026 · Estado: v1, **aguarda aprovação do dono** (primeiro a seção 3, a triagem) · Base: `staging` 2ca9e1d7 · Matéria-prima: `.superpowers/sdd/a5/inventario-coleta.md` ("inventário"; este spec aponta para ele e não o repete) · Mockups já feitos: `docs/superpowers/mockups/2026-10-12-a4-proprio-e-ajustes/` (`REVISAO.md`, Partes C e D) · Specs irmãos: `2026-10-07-observatorio-canal-video-ui-design.md` ("spec de telas"), `2026-10-07-coleta-canais-proprios-design.md` ("spec de coleta"), `2026-10-02-observatorio-competidores-design.md`. `lib/` é `apps/web/src/lib/youtube/observatorio/`; `C/` é `apps/web/src/app/cms/(authed)/youtube/competitors/`.

Marcas: **VERIFICADO** (arquivo:linha ou consulta) = lido no código ou medido em produção em 12/10 por `supabase db query --linked` (só `SELECT`); **NC** = não confirmado, com o modo de confirmar; **[DONO]** = padrão assumido que o dono pode trocar (seção 13).

**Mapa:** 1 objetivo · 2 fatos conferidos · 3 triagem (aprovar primeiro) · 4 coleta (E1 a E3) · 5 medidas derivadas (E4) · 6 telas (E5) · 7 dieta do diário próprio (E6) · 8 forja e Cowork (E7) · 9 volume e cota · 10 itens de aceite · 11 riscos · 12 fora do escopo, registrado · 13 perguntas ao dono · 14 sequência.

## 1. Objetivo, não-objetivos, critério de sucesso

**Objetivo (dono, 12/10).** Entender o sucesso e o fracasso de cada canal concorrente: "queremos dados para entender a performance, como um canal está se saindo, engajamento". O critério de coleta é **"o que explica desempenho"**, não "tudo o que a API devolve" (estreitado pelo dono no mesmo dia; vence o brief e o inventário onde divergirem).

**Perguntas que o dono passa a responder sobre um concorrente** (hoje não consegue, ou só em parte):

| # | Pergunta | Hoje | Com a A5 | Medida (seção 5) |
|---|---|---|---|---|
| P1 | Este canal está subindo ou descendo? | só inscritos em 30 dias e views por dia dos 50 acompanhados | direção em três leituras, cada canal contra ele mesmo | M3 |
| P2 | Quais vídeos puxam o canal? | múltiplo por faixa de idade | views na mesma idade (1, 7, 30 dias) e curva por idade | M1, M2, M4 |
| P3 | O que ele mudou antes de subir? | troca de título, miniatura e descrição | mais tags, categoria, duração, idioma, capítulos, formato, playlists, tudo num eixo de tempo | M5 |
| P4 | Com que ritmo publica, e é regular? | vídeos por semana em 13 semanas | intervalo mediano, semanas cobertas, maior buraco | M6 |
| P5 | O público reage? | engajamento sobre o total de hoje | curtidas e comentários por view na mesma idade | M7 |
| P6 | O que morreu? | "parado" por dias sem publicar | canal parado, em queda sustentada, fora do ar; vídeo que sumiu; vídeo de pico × perene | M8, M9 |
| P7 | As primeiras horas decidem? | nada (uma leitura por dia) | leituras de 6 em 6 horas nas primeiras 72 horas | M1 (idade 1 dia) |

**Não-objetivos.** (a) Nenhuma coleta nova do canal próprio (seção 12). (b) Nada que a API não dê para canal de terceiro (seção 3.3); raspagem de página não é proposta. (c) Nenhuma IA nas medidas: são contas fixas, com a conta escrita no ⓘ. (d) Nenhuma mudança no kit da forja (seção 8). (e) Nenhum contorno técnico da política de 30 dias (seção 11.1). (f) Texto e autor de comentários: nunca.

**Critério de sucesso da fase.** (1) Depois de E1 e E2, nenhum dia passa sem a leitura dos dados da triagem, provado por consulta (itens "nada se perde"). (2) Cada pergunta P1 a P7 tem na tela um número com base, janela e viés escritos, ou um "não medido" com motivo e a data em que passa a existir. (3) O banco cabe no plano contratado com o número de canais que o dono escolher (seção 9). (4) O diário próprio cai de 72 MB para menos de 2 MB sem que nenhuma tela da A4 mude de número.

## 2. Fatos conferidos em 12/10 (o que manda no desenho)

1. **A série de vídeo só cobre os "acompanhados".** `loadTracked` lê os `video_limit` (50) mais recentes mais os fixados (`competitor-sync.ts:163-174`); 674 de 1.389 vídeos tinham linha no último dia; série de 03/10 a 11/10 (9 dias, 5.480 linhas, 909 kB, 166 B por linha com índices). VERIFICADO (consulta).
2. **Um vídeo novo já entra na série no dia em que é descoberto**, porque entra nos 50 mais recentes; o que falta é (a) canal que publica mais de 50 em pouco tempo (máximo medido: 152 vídeos em 90 dias num canal; mediana 14), (b) os 715 vídeos antigos sem série, (c) as primeiras horas (uma leitura por dia, 12:00 de São Paulo).
3. **Tags, categoria e duração são sobrescritas** a cada sincronização (`competitor-sync.ts:529-532`); só título, miniatura e descrição têm versão (`competitor_video_versions.field in ('title','thumb','desc')`, migration `20261003000002`).
4. **Comentário ausente vira 0** em `competitor_videos.comment_count` (`competitor-sync.ts:467`, `parseInt(... ?? '0')`); 64 vídeos têm 0 hoje e não se sabe quantos são "desligados". A linha diária já grava nulo (`:582`).
5. **Vídeo que some do YouTube fica congelado**: `videos.list` não o devolve, a linha não é atualizada nem marcada; nada é apagado. Só o vídeo fixado ganha o estado "sem resposta" (`types.ts`, `pinState`).
6. **Canal por dia existe desde 01/06/2026** (`competitor_channel_snapshots`: inscritos, vídeos, views; 1.237 linhas). É o histórico mais longo que há e cruza a mudança de contagem de views de 24/08/2026 (inventário 2.1).
7. **O motor recusa intervalo sobre dia faltante** (`series.ts`, `intervalsOf`: "a hole: no interval across a missing day") e o carregador só lê série de vídeo observado, com teto de 365 dias (`load.ts:109`, `:637`). O pacote de um canal em cache tem teto de 2 MB (`pack.ts`, `PACK_BUDGET`). Qualquer série nova mexe nesses três pontos.
8. **`deriveChanges` deriva as trocas das versões**, não de `competitor_changes` (`changes.ts`); `competitor_changes` serve a salvos, notificação e ao endpoint `competitors/changes` do Cowork. A conta "Trocas N" das telas é título + miniatura.
9. **`youtube_quota_usage` está vazia** (0 linhas): as unidades de concorrentes não são registradas, embora `syncCompetitorChannel` as conte (`unitsUsed`).
10. **Miniaturas:** uma cópia por versão no Vercel Blob, acesso público, `observatorio/thumbs/<uuid>/<dhash>.jpg`, na maior resolução disponível (`thumb-fingerprint.ts:84-108`); 707 arquivadas.
11. **Banco:** 179 MB. `yt_own_video_daily` 72,0 MB (40%): 96.892 linhas, 35 vídeos, 26/08/2015 a 09/10/2026; **94.437 linhas sem nenhuma atividade** (97,5%); 22 linhas com views 0 e outra atividade (curtida, inscrito); 14 linhas com valor negativo (descurtida); **nenhum buraco** (cada vídeo tem um intervalo contínuo que começa no dia da publicação); linha média de 215 B, ou seja, cerca de 40 MB da tabela são espaço vazio deixado pelas regravações da janela de 10 dias. VERIFICADO (consulta).
12. **Plano do banco:** `docs/ops/plano-custo-zero.md:144` registra "o Free tier limita 500 MB". Se o projeto continua no plano gratuito é a pergunta 1 (seção 13); é ela que dimensiona a fase.
13. **Mesmas credenciais Google para tudo.** Uma `YOUTUBE_API_KEY` serve concorrentes (`cron/sync-youtube`, `C/actions.ts`), a busca de canais (`api/youtube/search-channels`), o A/B Lab (`ab-start.ts`, `cron/ab-watchdog`, `api/youtube/poll-stats`) e o cadastro de canais (`youtube/_actions/channels.ts`). Um par `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` serve o acesso autorizado do YouTube (envio, edição, Analytics e Reporting dos canais do dono: `api/social/oauth/[provider]`, `lib/social/token-refresh.ts`) **e o AdSense** (`api/adsense/authorize`, `callback`, `cron/adsense-sync`). VERIFICADO no código. Que a chave e o cliente OAuth pertencem ao mesmo projeto do Google Cloud só o console confirma (o dono afirma que sim).

## 3. Triagem: o que coletar (seção que o dono aprova primeiro)

Regra: um dado entra se responde a uma pergunta de desempenho (P1 a P7). "Custo" é cota (unidades da Data API por canal e dia; o teto do projeto é 10.000 por dia) e espaço (por canal e ano; seção 9). Todas as contagens abaixo são públicas e lidas com a chave de API.

### 3.1 Coletar

| Dado | Como | Pergunta | Custo | Observação dita na tela |
|---|---|---|---|---|
| Canal: inscritos | série diária (já existe) | P1, P6 | 0 a mais | **o YouTube arredonda a 3 algarismos**; variação menor que o arredondamento é "≈ 0"; canal que esconde a contagem é "não medido: inscritos ocultos" |
| Canal: views totais | série diária (já existe) | P1, P6 | 0 | inclui Shorts e vídeos apagados; regra de contagem mudou em 24/08/2026 |
| Canal: total de vídeos | série diária (já existe) | P4, P6 | 0 | queda = vídeo apagado ou privado |
| Vídeo: views, curtidas, **número** de comentários | série diária até 30 dias de idade e para os 50 mais recentes; semanal depois (4.3) | P1, P2, P5 | diária: 1 un. por 50 vídeos; semanal: +0,3 a 1 un./canal/dia; 3,8 MB | curtidas ocultas e comentários desligados são "não medido", nunca 0 |
| Vídeo: as mesmas três contagens, de 6 em 6 horas, nas primeiras 72 horas | leitura das sincronizações que já acontecem | P7, P2 | 0 un.; 0,13 MB | só para vídeo descoberto com menos de 24 horas |
| Título, miniatura (arquivo), descrição | uma vez e quando muda (já existe) | P3 | 0 | sem mudança |
| Duração, tags, categoria, idioma do texto e do áudio | uma vez e quando muda, **com histórico** (hoje sobrescreve) | P3 | 0 un.; 0,2 MB | |
| Data e hora de publicação | uma vez (já existe) | P4 | 0 | |
| Formato: longo, Short, **ao vivo ou estreia** | uma vez e quando muda (`liveBroadcastContent`, horários de `liveStreamingDetails`) | P2, P7 | 0 un. (uma parte a mais na mesma chamada) | ao vivo e estreia distorcem as primeiras horas: ficam fora das medianas de M1 e M2 e a tela diz |
| Capítulos | derivados do texto da descrição já guardada, na leitura; nada novo é coletado nem gravado | P3 | 0 | "cálculo nosso, do texto da descrição" |
| Vídeo sumiu / voltou | data da primeira leitura sem o vídeo | P6 | 0 | "não veio mais do YouTube desde dd/mm" (apagado ou privado: a API não diz qual) |
| Comentários desligados, curtidas ocultas, inscritos ocultos | sinalizador, uma vez e quando muda (a contagem ausente na resposta) | P5 | 0 | é o motivo do "não medido" |
| Canal: nome, handle, descrição, país, data de criação, imagem | uma vez e quando muda, com histórico | P3, identificação, busca no seletor | 0 | |
| A resposta da API, **só das partes pedidas** (`snippet`, `contentDetails`, `liveStreamingDetails`; canal: `snippet`, `contentDetails`), sem `statistics` | `raw jsonb`, gravado só quando o conteúdo muda | rede de segurança: campo que a triagem deixou de tipar não se perde | 0 un.; 0,8 MB | nunca lido por tela |
| Unidades de cota gastas por dia | `youtube_quota_usage` (tabela existe, vazia) | controle do risco 11.1 | 0 | |

### 3.2 Coletar depois, se barato (E3, decisão na pergunta 6)

| Dado | Pergunta | Custo |
|---|---|---|
| Playlists do canal: nome, data, tamanho, e os vídeos de cada uma (estratégia de série) | P3, P2 ("o vídeo entrou numa série antes de subir?") | semanal; 1 un. por 50 playlists mais 1 un. por 50 itens de cada playlist: cerca de 1,5 un./canal/dia com 10 playlists; 0,15 MB |

### 3.3 Não coletar

| Dado | Por quê |
|---|---|
| Texto e autor de comentários | dado pessoal de terceiros; o dono não se importa com comentário alheio; o número basta como sinal |
| `localizations` | traduções de título: não explicam desempenho no nicho acompanhado; dobram o `raw` |
| `brandingSettings` (palavras-chave, trailer) | o que identifica o canal já vem em `snippet`; o resto não responde a nenhuma pergunta |
| `topicDetails` | categorias genéricas da Wikipédia; a categoria do vídeo já entra |
| `status` (licença, incorporável, "feito para crianças", privacidade) | sem efeito medível; o sumiço do vídeo é detectado pela ausência na resposta. Ressalva honesta: "feito para crianças" desliga comentários e notificações; se um concorrente infantil entrar, reabrir |
| Restrição de região, definição, dimensão, projeção, legenda (`contentDetails.caption` continua vindo dentro do `raw`, sem coluna) | não respondem a P1 a P7 |
| `captions.list` | 50 unidades por vídeo e exige autorização do dono do vídeo: não existe para terceiro |
| `channelSections` | vitrine da página inicial: sem pergunta de desempenho |
| Patrocínio pago, data de gravação | idem |
| Espectadores simultâneos de ao vivo | só existem durante a transmissão; quatro leituras por dia não os pegam; não prometido |

### 3.4 Não existe para canal de terceiro (a API não dá; não entra; nada o substitui)

**"Momentos mais vistos"** (o gráfico de trechos mais repetidos da página do vídeo), **retenção**, **impressões**, **taxa de clique**, **tempo de exibição**, **origem de tráfego**, demografia, inscritos ganhos por vídeo, receita. Só o dono do canal vê esses números (inventário 2.5). Ler a página do YouTube por fora da API viola os Termos e **não é proposto**. Para os vídeos do **próprio** canal, o equivalente a "momentos mais vistos" é a curva de retenção: fica fora desta fase e é a pergunta 4 ao dono (seção 12, item R1).

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

**DDL proposto (migration M1).**

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
  add column if not exists missing_since date;                 -- 1ª data (São Paulo) em que videos.list não devolveu o vídeo; nulo = veio
alter table public.competitor_videos alter column view_count drop default;   -- hoje default 0

-- 2. Estado atual do canal
alter table public.competitor_channels
  add column if not exists custom_url text,                    -- handle
  add column if not exists description text,
  add column if not exists published_at timestamptz,           -- criação do canal
  add column if not exists country text,
  add column if not exists subscribers_hidden boolean,
  add column if not exists missing_since date;                 -- channels.list sem item
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
- **Sumiço:** vídeo pedido e não devolvido por `videos.list` ganha `missing_since` e uma versão `availability = 'sumiu'`; se voltar, `missing_since` vira nulo e abre `'no_ar'`. Uma leitura só não basta: marca na **segunda** leitura seguida sem o vídeo (falha de rede não é sumiço). O que fazer com os dados dele: seção 11.1 e pergunta 3.
- **Conserto junto (sem migration):** `comment_count` deixa de receber 0 por falta (`competitor-sync.ts:467` passa a usar `optCount`); as 64 linhas com 0 ficam como estão até a próxima leitura as corrigir. As unidades de cota de cada execução passam a ser gravadas em `youtube_quota_usage` (soma do dia e, em `operations`, o total por modo).
- **`competitor_channel_removal_impact`** é recriada contando as duas tabelas novas.
- **Zero × não medido:** coluna nula = a API não devolveu; sinalizador `true` com contagem nula = "não medido" com motivo.
- **Retroação:** nenhuma. O histórico começa na primeira leitura depois do deploy; a tela diz "histórico de tags, categoria e duração desde dd/mm".

### 4.2 O que o Blob guarda (sem mudança)

Uma cópia por versão de miniatura, como hoje (fato 10). Nada novo é arquivado: a imagem do canal entra só como URL no histórico de campo. Se o Blob deve deixar de ser público é a pergunta 9.

### 4.3 Etapa E2: série desde o dia 0, primeiras horas, catálogo semanal

**O que se perde a cada dia sem ela:** a série dos 715 vídeos antigos (a API só dá o valor de agora); as primeiras horas de todo vídeo novo; os dias de um vídeo empurrado para fora dos 50 por canal que publica muito.

**Regra de cadência (explícita, calculada a cada sincronização).**

| Faixa | Quem | Leitura |
|---|---|---|
| **Primeiras horas** | vídeo com `discovered_at − published_at ≤ 24 h`, enquanto a idade for menor que 72 h | em toda sincronização do canal (4 por dia: 00, 06, 12 e 18 de São Paulo), em `competitor_video_early` |
| **Diária** | idade ≤ 30 dias, **ou** entre os `video_limit` (50) mais recentes do canal (regra de hoje, sem regressão), **ou** fixado, **ou** promovido (`daily_until ≥ hoje`) | uma linha por dia, 12:00 de São Paulo, em `competitor_video_daily` |
| **Semanal** | todo o resto dos vídeos guardados | uma linha por semana, no dia `hash(id do vídeo) mod 7` (espalha a carga), na mesma tabela |

- **Promoção de semanal para diária, por 28 dias** (`daily_until = hoje + 28`): (a) o vídeo ganhou em uma semana pelo menos 1.000 views **e** pelo menos 5% do total dele [DONO, pergunta 7]; ou (b) foi detectada mudança de título, miniatura ou descrição (para medir o efeito, M5).
- **Rebaixamento:** automático quando nenhuma condição da faixa diária vale mais. Nada é apagado ao rebaixar.
- **Teto de segurança:** no máximo `RULES.videoLimitMax` (200) vídeos em faixa diária por canal, mais os fixados. Acima disso os mais antigos da regra "idade ≤ 30 dias" vão para a semanal **e a execução registra quantos** (em `youtube_quota_usage.operations` e no retorno do cron): corte silencioso é proibido.
- **O catálogo que não está guardado não é buscado.** 14 dos 15 canais estão em modo `recent` (1.389 vídeos guardados de 6.089 publicados). Buscar o catálogo inteiro é a pergunta 8; o padrão é não.

**DDL proposto (migration M2).**

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

### 4.4 Etapa E3: playlists (só se a pergunta 6 for "sim")

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

## 5. Medidas derivadas (etapa E4): contas fixas sobre o que a Parte 1 grava

Regras comuns. (a) Toda medida devolve `{ estado: 'medido', valor, n, janela }` ou `{ estado: 'nao_medido', motivo, desde? }`; nunca nulo solto, nunca 0 por falta (o sistema "falha em verde"; seção 8). (b) Longos e Shorts nunca se misturam; ao vivo e estreia (`was_live`) ficam fora das medianas de M1, M2 e M7 e a tela diz quantos saíram. (c) Mínimo de amostra: `RULES.weakBase` (3) para mediana de canal, salvo dito. (d) Limiar de "igual": ±10%, o mesmo de "praticamente igual" [DONO]. (e) Toda medida é **cálculo nosso sobre dado público**, e o ⓘ diz isso (política III.E.4.h, seção 11.1). (f) Janela que cruza 24/08/2026 leva a marca "a contagem de views do YouTube mudou neste período". As funções são puras, em `lib/medidas/`, com teste de borda para cada limiar.

| # | Medida | Definição exata | Janela | "Não medido" quando | Viés dito na tela |
|---|---|---|---|---|---|
| **M1** | **Views na idade N** (N = 1, 7, 30 dias) | views do vídeo no instante `publicação + N dias`, por interpolação linear entre as duas leituras vizinhas (`viewsAtAge`, `series.ts`). N = 1 usa as leituras das primeiras horas; N = 7 e 30, a série diária. Do canal: mediana entre os vídeos do formato publicados na janela | vídeo: fixa na idade; canal: publicados nos últimos 90 dias | vídeo publicado antes de 03/10/2026 ("a contagem diária começou em 03/10"); descoberto com mais de 24 h ("descoberto tarde"); leituras vizinhas a mais de 36 h (8 h para N = 1); idade menor que N ("fecha em dd/mm"); canal com menos de 3 vídeos medidos | interpolar entre leituras espaçadas subestima a subida inicial; o horário de publicação e o fim de semana pesam mais em N = 1 e 7 |
| **M2** | **Curva por idade** | para as idades 1, 2, 3, 5, 7, 14, 21 e 30 dias (e 60, 90 com a série diária ou semanal), a mediana de M1 entre os vídeos do canal medidos naquela idade; e a versão relativa: fração de V30 já alcançada em cada idade | publicados nos últimos 180 dias | ponto com menos de 3 vídeos (cada ponto escreve o seu `n`) | os pontos de idade alta só têm os vídeos mais velhos: a curva não é de um mesmo grupo |
| **M3** | **Direção do canal** (cada canal contra ele mesmo) | três leituras, mostradas com o nome: **(a) do canal inteiro:** views totais ganhas nos últimos 28 dias ÷ nos 28 anteriores (`competitor_channel_snapshots.view_count`); **(b) dos vídeos novos, acumulada:** mediana das views atuais dos longos publicados nos últimos 90 dias ÷ a dos 90 anteriores (a da Parte D do mockup); **(c) dos vídeos novos, justa:** o mesmo com V30 (M1) no lugar das views atuais. ▲ se ≥ +10%, ▼ se ≤ −10%, ＝ no meio | 28 × 28 dias (a); 90 × 90 dias (b, c) | (a) menos de 56 dias de registro, ou dia sem registro na borda; (b) menos de 3 longos em algum dos períodos; (c) idem com V30: **só existe a partir de abril de 2027** (180 dias de série desde 03/10/2026) | (a) inclui Shorts e vídeos apagados; antes de 19/10/2026 a janela cruza a mudança de contagem; (b) "descer pode ser só idade: os vídeos mais antigos tiveram mais tempo"; subir apesar disso é sinal forte; (c) sem viés de idade |
| **M4** | **Taxa de acerto** | fração dos longos publicados nos últimos 90 dias, com 7 dias ou mais, cujo múltiplo (motor atual, `multiplier.ts`) é ≥ 2 (`RULES.outlierMin`); ao lado, a de fracasso: múltiplo ≤ 0,5 | 90 dias | menos de 5 vídeos com múltiplo de base não fraca (`RULES.medianMinN`) | o múltiplo é contra a mediana do próprio canal: mede regularidade, não tamanho; não compara canais em valor absoluto. Sempre "3 de 12"; percentual só com 10 ou mais |
| **M5** | **O que mudou antes e depois de subir** | (i) efeito de troca: o do motor atual (`effect.ts`: 7 dias depois contra até 7 antes, comparado com os outros vídeos do canal), só para título e miniatura; (ii) **subida**: primeiro dia em que a taxa dos 7 dias seguintes é ≥ 2× a dos 7 anteriores **e** o ganho nesses 7 dias é ≥ 1.000 views [DONO]; para cada subida, a lista de todas as mudanças registradas nos 14 dias anteriores (título, miniatura, descrição, tags, categoria, duração, capítulos, entrada em playlist) | 14 dias antes da subida; 7 depois da troca | sem série diária nos 14 dias (vídeo em faixa semanal: "série semanal") ou antes de 03/10 | lista coincidências, **não afirma causa**; não vê o que acontece fora do YouTube nem o que o YouTube recomenda; mudanças simultâneas não se separam |
| **M6** | **Ritmo e regularidade** | por formato: publicações por semana em 13 semanas (existe, `cadence`); **intervalo mediano** entre publicações; **semanas com publicação** ("11 de 13"); **maior buraco** em 26 semanas, em dias | 13 e 26 semanas | menos de 4 publicações na janela (3 intervalos); canal ainda buscando vídeos ("ritmo parcial", já existe) | vídeo apagado some da conta nos dados anteriores à E1; estreia conta pela data de publicação |
| **M7** | **Engajamento por view** | por vídeo: (curtidas + comentários) ÷ views **na idade de 30 dias** (leitura do dia 30); sem ela, sobre o total de hoje para vídeos de até 90 dias (existe, `engagementOf`), rotulado "total de hoje". Do canal: mediana. Curtidas e comentários também separados | idade 30 dias; ou 90 dias | curtidas ocultas **e** comentários desligados; com só um ausente, mostra o outro, rotulado ("só curtidas: comentários desligados"); vídeo com menos de 100 views | a taxa cai com a idade (views tardias engajam menos); por isso a idade fixa |
| **M8** | **Estado do canal** | **ativo**; **parado**: dias desde a última publicação > maior entre 28 e 4× o intervalo mediano (M6); **em queda sustentada**: M3(a) ≤ −10% em três janelas de 28 dias seguidas; **fora do ar**: `channels.list` sem o canal em duas leituras seguidas (`missing_since`) | 112 dias para a queda | queda: menos de 112 dias de registro sem cruzar 24/08/2026 (**primeira leitura limpa em 14/12/2026**); parado: M6 não medido usa só o piso de 28 dias | canal sazonal parece parado; inscritos não entram (arredondados a 3 algarismos) |
| **M9** | **Cauda do vídeo** (pico × perene) | (views de hoje − V30) ÷ views de hoje, para vídeos com 90 dias ou mais e V30 medido; e "ainda rende": ganho dos últimos 28 dias ÷ V30 | idade ≥ 90 dias | sem V30 (todo vídeo publicado antes de 03/10/2026); série semanal com buraco | só existe para vídeos nascidos dentro da série: **a partir de janeiro de 2027** |

Datas em que cada medida passa a existir (a tela calcula; aqui, a ordem de grandeza): M1 N = 7 desde 10/10/2026 e N = 30 desde 02/11/2026 para os 39 vídeos publicados desde 03/10; N = 1 só para vídeos publicados depois do deploy da E2; M3(a) já (com a marca de contagem até 19/10); M3(b) já; M6 já; M4 já; M8 "parado" já, "queda" em 14/12/2026; M2 conforme M1; M9 em janeiro de 2027; M3(c) em abril de 2027. Divergência registrada: a `REVISAO.md` diz que a direção "14 dias contra 14" existe em 17/10; a conta dá 31/10 (28 dias de série). Este spec usa M3(a), que já tem 133 dias de registro.

Nenhuma medida depende de dado que saiu da triagem (conferido linha a linha: usam contagens, datas, formato, versões e, em M5, playlists só se a E3 existir; sem ela, a linha "entrada em playlist" não aparece).

## 6. Parte 2: telas (etapa E5)

Regra do dono: **mockup antes de código, sempre com a skill `frontend-design`, e ele aprova o mockup de cada tela.** Este spec não desenha; lista o que cada mockup tem de considerar. Preferências dele, que valem como critério de reprovação: frase-resumo no topo de cada bloco; régua ou barra; cor estável, inclusive a de "não medido" (rosa com hachura, spec de telas 19.2); método no ⓘ; bloco monocromático ou em prosa é reprovado; nenhum `color-mix()`.

### 6.1 O que todo mockup desta fase considera (do inventário, seção 6)

1. **A tela nasce quase vazia.** Histórico de campo desde o deploy da E1; primeiras horas desde a E2; V30 de 39 vídeos em novembro. O estado vazio é o estado real por meses: é desenhado primeiro, com a data em que cada número passa a existir.
2. **Valor de agora × série.** O total de hoje (sempre existe) e o ponto da série (pode não existir) são coisas diferentes e têm rótulos diferentes.
3. **Vídeo fora da série diária:** "série semanal" é um estado com forma própria (ponto por semana, sem veredito de efeito), não um gráfico diário com buracos.
4. **Contagem oculta ou arredondada:** inscritos a 3 algarismos ("≈ 0, dentro do arredondamento"); inscritos ocultos; curtidas ocultas; comentários desligados.
5. **"Não medido" com motivo**, da lista fechada: contagem começou em 03/10; histórico de campo desde dd/mm; descoberto tarde; fecha em dd/mm; menos de N vídeos; série semanal; oculto pelo canal; não veio mais do YouTube; o YouTube não mostra isso de canal de terceiro.
6. **Comparável com o canal próprio ou não.** Do concorrente só existe o público. Views na idade N, ritmo, engajamento e direção são comparáveis **desde que do mesmo relógio**: o canal próprio entra pela série pública dele em `competitor_*` quando existir, nunca pelo diário privado (dia do YouTube, outra fonte). Retenção, impressões, taxa de clique, tráfego: só no cartão "Só o seu canal mede".
7. **Mudança de contagem de 24/08/2026:** linha de corte em toda série longa.
8. **1440 e 390 px, tema escuro e claro**, com a página no tamanho cheio e no magro.

### 6.2 Telas existentes: o que muda

| Tela | Já desenhado | Passa a poder mostrar | O mockup precisa considerar |
|---|---|---|---|
| **Comparar canais** (`C/_comparar/`) | Parte D: base de 90 dias × todos; direção; primeiros 7 e 30 dias; "Longos acompanhados" fora do ranking; Leitura rápida por direção | M3 nas três leituras; M1 com N = 1; M4; M7 na idade 30; M8 no cartão de cada lado | qual das três direções é a principal (proposta: (a) hoje, (c) quando existir) e como as outras aparecem sem virar três vereditos; canal de nichos diferentes; lado sem canal próprio |
| **Seletor de canal da comparação** | C1: combobox com busca | busca também por handle e país; "sem vídeos", "inscritos ocultos", "fora do ar" como pastilha | 75 ou mais canais; canal fora do ar não some da lista |
| **Lista de Canais e painel** | C2: descrição à parte da conta principal, com hábito | coluna Direção (M3a) e estado (M8); filtro "parados" e "em queda" | a conta "Trocas" segue título + miniatura; mudanças de campo novas ficam fora dela; a decisão D16 (cortar o painel) conflita com C2: o dono escolhe |
| **Página do canal** | não | aba ou bloco "Lançamentos" (6.3); cabeçalho com direção e estado; M6 completo; M4 | o cabeçalho já tem seis células: o que sai para entrar direção |
| **Histórico do vídeo** | não | curva do vídeo contra M2 do canal; primeiras 72 horas; marcas de mudança de campo no eixo; subida marcada com a lista de M5; "série semanal"; "sumiu em dd/mm" | o gráfico já tem raias de título e miniatura: quantas raias cabem antes de virar ruído |
| **Trocas / Mudanças** | não | filtro "outras mudanças" (tags, categoria, duração, formato), separado | não inflar a contagem da aba |
| **Outliers** | não | ordenar por V7 ou V30 na mesma idade, além do múltiplo; selo "ao vivo ou estreia" | quase tudo "não medido" até novembro: o padrão continua sendo o múltiplo |
| **Insights** | não | "quem sobe e quem desce no nicho" (régua de direção da Parte D, com todos os canais) | posição escrita, nunca percentil; a régua ordena, não julga |

### 6.3 Telas novas que se justificam (duas, ambas dentro da página do canal)

1. **Lançamentos:** as curvas dos primeiros 30 dias dos vídeos recentes do canal, alinhadas pela idade, sobre a mediana do canal (M2). Responde P2 e P7 de relance ("este saiu acima do normal já no dia 2"). Sem ela, M1 e M2 só existem como número em tabela.
2. **Linha do tempo do canal:** um eixo de tempo com as views ganhas por dia do canal (M3a) e, sobre ele, publicações, mudanças de campo, trocas e playlists. Responde P3 ("o que ele mudou antes de subir") no nível do canal. Depende da E1 (e da E3 para playlists).

Nenhuma rota nova de topo; nenhuma tela para playlists sozinha.

### 6.4 Defeito em produção: o contêiner da comparação para no meio do monitor (T0)

**Sintoma relatado pelo dono:** na tela Comparar, o conteúdo é cortado em cerca de 925 px numa janela de cerca de 1.060 px; o documento mede 1.205 px de altura (1.931 de largura) e abaixo do corte o fundo é preto. **Hipótese não verificada:** o documento rola além do `main` da casca do CMS. Já descartado: o foco do `h1` usa `preventScroll`. **Exigência:** reproduzir em navegador (1440 × 1060 e 390 px, tema escuro e claro, página cheia e magra), medir `document.scrollingElement`, o `main` da casca e o contêiner da tela, e só então consertar; o conserto leva um teste e2e que falha no estado atual. Não depende de mockup nem de dado. Por decisão do dono de 12/10 os ajustes da A3 estão "só em planejamento": este item entra no plano e executa quando ele liberar (pergunta 10).

### 6.5 Ordem dos mockups (cada um aprovado antes do seguinte começar a virar código)

1. **Comparar** (Parte D, já desenhada): aprovar, e acrescentar os estados com M3(a), M4 e M8.
2. **Seletor (C1) e trocas na lista e no painel (C2)**: já desenhados; aprovar.
3. **Histórico do vídeo** com curva por idade, primeiras horas e marcas novas (é onde o dado novo mais aparece).
4. **Página do canal:** cabeçalho, Lançamentos, Linha do tempo.
5. **Lista de Canais:** direção, estado, filtros.
6. **Outliers e Insights.**

## 7. Dieta do diário do canal próprio (etapa E6)

**Problema.** `yt_own_video_daily` grava uma linha por vídeo e dia desde a publicação, e 97,5% delas são um dia sem nada (fato 11). O volume cresce com vídeos × dias de vida, para sempre.

**Desenho.**

- **D8. A tabela guarda só dia com atividade.** Atividade = pelo menos uma destas colunas diferente de zero (negativo conta): `views`, `engaged_views`, `watch_time_minutes`, `likes`, `comments`, `shares`, `subscribers_gained`, `subscribers_lost`, `card_impressions`. Conferido: nenhuma linha sem atividade tem `avg_view_*` ou `card_click_rate` preenchido; as 22 linhas com views 0 e outra atividade **ficam**.
- **D9. Uma tabela de cobertura diz "o dia D foi coletado para o vídeo V"**, por intervalo (não por dia: uma linha por dia teria as mesmas 96.892 linhas):

```sql
create table if not exists public.yt_own_video_coverage (
  youtube_video_id text not null,
  metric_set text not null check (metric_set in ('base', 'estendidas')),   -- METRICAS_BASE × METRICAS_ESTENDIDAS (analytics-diario.ts:12-17)
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

## 8. Leitura pela forja e pelo Cowork (etapa E7)

**Quem lê hoje.** A forja lê só `GET /api/pipeline/youtube/competitors/readings` (o pacote de `forja/sent.ts`: título, views, múltiplo e até 400 registros diários por pedido). O Cowork lê `competitors/channels`, `changes`, `outliers`, `insights` e os recursos MCP sobre `competitor_channels` e `competitor_changes`.

**Decisão: nenhuma mudança no kit da forja e nenhum campo novo nos pacotes da forja nesta fase.** Motivos: o orçamento acoplado (20 min do claim < 25 min do cron < 30 min do vigia) foi dimensionado para o pacote de hoje; o validador confere cada número citado contra o pacote; e por meses quase toda medida nova é "não medido". Qualquer mudança no kit é do dono, em fase própria.

**O que entra para o Cowork (aditivo, sem rota nova, `endpoint_count` igual):** em `competitors/channels`, por canal: direção M3(a) e (b), estado M8, ritmo M6, taxa de acerto M4, handle, país, data de criação. Em `competitors/changes`: um parâmetro opcional `campos=todos` devolve também as mudanças de campo; **sem o parâmetro a resposta é a de hoje** (com teste que chama sem o parâmetro e afirma isso). Atualizar `apps/web/data/pipeline-docs/cowork-docs-youtube.md` e `docs/cowork-pipeline-reference.md`, e rodar a semente da referência.

**O que não entra em pacote nenhum:** `raw jsonb`; a descrição do canal (costuma trazer e-mail de contato do criador); a lista de vídeos de playlists; as leituras das primeiras horas em bruto (entra só M1).

**Quando o dado novo ainda não existe (a regra contra "falha em verde").** Toda medida sai como objeto com `estado`; uma medida não medida sai **com** `estado: 'nao_medido'`, `motivo` e, quando há, `desde`: nunca é omitida, nunca é `null`, `0` ou lista vazia. O endpoint acrescenta `medidas_indisponiveis` (contagem por motivo). Teste obrigatório por medida: banco sem nenhuma linha das tabelas novas devolve `nao_medido` com motivo, e o texto que o Cowork recebe contém a frase do motivo. Se um dia um pacote da forja ganhar uma medida, a linha "não medido: <motivo>" vai escrita no pacote; um pacote sem a linha é erro, não "ok".

## 9. Volume e cota

**Por canal e ano** (médias medidas nos 15 canais: 93 vídeos guardados, 98 novos por ano, 61% Shorts; 166 B por linha de série com índices).

| Parcela | Linhas | MB |
|---|---|---|
| Série diária (50 vídeos × 365; igual a hoje) | 18.250 | 3,0 |
| Série semanal (catálogo guardado, média de 97 vídeos × 52) | 5.000 | 0,8 |
| Primeiras horas (98 vídeos × 12 leituras) | 1.200 | 0,1 |
| `competitor_raw` (93 existentes + 98 novos + ~80 mudanças, ~3 kB) | 270 | 0,8 |
| Versões de título, miniatura e descrição; linhas de vídeo; canal por dia | ~1.100 | 0,7 |
| Histórico de campo | ~900 | 0,2 |
| Playlists (E3) | ~500 | 0,15 |
| **Total** | | **≈ 5,8** |

**Banco em um ano** (hoje 179 MB; menos 70 MB da dieta; mais cerca de 20 MB do resto do site):

| Canais | Concorrentes | Banco inteiro | Cota por dia (de 10.000) |
|---|---|---|---|
| 15 (hoje) | ≈ 90 MB | ≈ 220 MB | ≈ 240 |
| 20 | ≈ 115 MB | ≈ 245 MB | ≈ 320 |
| **75** | **≈ 435 MB** | **≈ 565 MB** | ≈ 1.200 |
| 200 | ≈ 1.160 MB | ≈ 1.290 MB | ≈ 3.200 |

São estimativas: o canal mediano publica 14 vídeos em 90 dias e o maior, 152; a soma depende de quais canais entrarem. **Com 75 canais o banco passa de 500 MB por volta do décimo mês** (limite do plano gratuito, fato 12). Sem a dieta, passa antes. Saídas, todas do dono (pergunta 1): plano pago; teto de cerca de 55 canais; ou série diária só até 30 dias de idade sem a regra dos 50 mais recentes (corta a série diária em cerca de metade nos canais lentos, ao custo de mudar a base dos números atuais das telas). Buscar o catálogo inteiro dos canais (pergunta 8) quadruplica a parcela semanal. A cota não é o limite em nenhum cenário; ela é compartilhada com o A/B Lab e o envio de vídeos do canal próprio (trocar miniatura ou título custa 50 unidades por chamada) e com a busca de canais (100 por busca).

## 10. Itens de aceite, por etapa

Cada item é uma consulta ou uma tela. `:hoje` é a data de São Paulo. Os itens **NP** são os de "nada se perde": rodados no dia seguinte ao deploy e em mais dois dias.

**E1: campos, sinalizadores, `raw`**
1. Depois de uma rodada completa (4 faixas), todo vídeo lido tem `raw` corrente: `select count(*) from competitor_videos v where last_checked_at > now() - interval '1 day' and not exists (select 1 from competitor_raw r where r.video_id = v.id and r.is_current)` = 0.
2. Todo canal tem `raw` corrente e as colunas `custom_url` e `published_at` preenchidas (ou nulas só onde a resposta não trouxe, conferido no `raw`).
3. Uma segunda rodada sem mudança no YouTube não cria linha: contagem de `competitor_raw` e de `competitor_field_versions` igual antes e depois (teste com resposta fixa; a ordem das chaves do JSON trocada não muda o hash).
4. Mudar só `statistics` na resposta fixa não cria versão; mudar uma tag cria uma versão de `tags` com `window_start` = leitura anterior e fecha a antiga.
5. Valor que vai e volta (A, B, A) gera três versões, sem erro de chave.
6. Vídeo cuja resposta não traz `commentCount`: `comment_count` nulo e `comments_disabled = true`; nenhuma linha nova com `comment_count = 0` vinda de ausência (teste que apaga o campo da resposta).
7. Vídeo ausente de `videos.list` em duas leituras seguidas ganha `missing_since`; ausente em uma só, não; ao voltar, `missing_since` nulo e versão `availability = 'no_ar'`.
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

**E4: medidas**
27. Cada medida M1 a M9 tem função pura com testes de borda: exatamente no limiar (±10%, 3 vídeos, 2×, 1.000 views), amostra abaixo do mínimo, divisor zero (nunca `Infinity` nem `NaN`).
28. Banco sem nenhuma linha nova: toda medida devolve `nao_medido` com motivo (teste que **apaga** os dados, não que os substitui).
29. M1 de um vídeo com série completa confere, à mão, com as duas leituras vizinhas (três vídeos reais de produção, conta anotada no plano).
30. M3(a) dos 15 canais confere com `competitor_channel_snapshots` por consulta direta; janela que cruza 24/08/2026 sai marcada.
31. Vídeo com `was_live` não entra nas medianas de M1, M2 e M7, e o resultado diz quantos saíram.
32. Longos e Shorts nunca na mesma mediana (teste com canal misto).

**E5: telas**
33. T0: o defeito do contêiner reproduzido em navegador com medidas anotadas; teste e2e vermelho antes e verde depois; a 1440 e 390 px, nos dois temas, a página rola até o fim e não há faixa preta.
34. Cada tela só começa a ser codificada com o mockup aprovado pelo dono (registro no ledger com a data).
35. Em cada tela, cada número novo tem base, janela e ⓘ com a conta e a frase "cálculo do Observatório sobre dados públicos do YouTube".
36. Cada tela foi vista em navegador nos estados: vazio (banco de antes da E1), parcial (uma semana de dado) e cheio (semente de um ano), a 1440 e 390 px, tema escuro e claro, sem rolagem horizontal e sem erro de console.
37. "Não medido" usa a cor e a forma únicas, e o motivo vem da lista fechada de 6.1.5; nenhum zero aparece onde a contagem é oculta ou ausente.
38. Seletor: digitar, setas, Enter, Esc e o canal indisponível funcionam por teclado; busca sem acento; itens de 44 px a 390 px.
39. A conta "Trocas" é igual na lista, no painel e na comparação; a descrição aparece à parte nos dois lugares.
40. `?base=` ausente dá a base de 90 dias (teste que apaga o parâmetro).
41. Usuário só de leitura não vê nada de `competitor_raw` no HTML nem no RSC.

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

**E7: Cowork**
51. `competitors/channels` devolve as medidas com `estado`; `competitors/changes` sem parâmetro é idêntico ao de hoje; com `campos=todos` traz as mudanças de campo.
52. Os dois documentos do pipeline atualizados e a semente rodada; os testes de estrutura do registro passam com `endpoint_count` inalterado.
53. Nenhum pacote da forja mudou: o retrato de `buildSent` de antes e de depois é igual (teste).

## 11. Riscos

### 11.1 Riscos aceitos pelo dono

**A regra dos 30 dias das Developer Policies do YouTube.** Fonte: <https://developers.google.com/youtube/terms/developer-policies>, seção III.E.4, lida na página oficial em 12/10/2026 (por ferramenta que devolve trechos curtos; **o dono deve reler a seção inteira antes de aprovar**).

- **O que diz.** III.E.4.b: "To be clear, an API Client must not store statistics retrieved as Non-Authorized Data for more than 30 days." III.E.4.d: o cliente pode "temporarily store limited amounts of Non-Authorized Data" pelo tempo necessário, "but not longer than 30 calendar days"; depois disso "must either delete or refresh the stored data". III.E.4.e: "API Clients must use reasonable efforts to ensure that their stored API Data is consistent with the current data available through YouTube API Services." III.E.4.h: o cliente não deve "replace API Data with similar, independently calculated data" nem usar dados da API "to create new or derived data or metrics"; métrica que não é do YouTube, mostrada ao lado, precisa de aviso claro. III.E.2: só se agregam dados de canais "under the same content owner".
- **O que o projeto faz.** Lê com chave de API (dado não autorizado) e **guarda a série histórica**: canal por dia desde 01/06/2026, vídeo por dia desde 03/10/2026, versões de título, miniatura e descrição; a A5 amplia isso. Calcula medidas próprias (seção 5) e compara canais de donos diferentes.
- **O que o "refresh" resolve e o que não resolve.** Atualizar o dado dentro do prazo mantém em dia o **valor atual** (as colunas de `competitor_videos` e `competitor_channels`, relidas até 4 vezes por dia). **Não torna conforme guardar os valores antigos**: uma contagem de 40 dias atrás continua guardada há mais de 30 dias. O projeto guarda histórico por decisão do dono, sabendo disso.
- **Decisão do dono (12/10):** seguir. "É tudo para uso pessoal, não é produto." Este spec não propõe contorno técnico nem ocultação.
- **Consequência possível.** A seção III.H reserva ao YouTube o direito de "survey, monitor, and/or audit" o uso; III.D.3 diz que o YouTube "may use quotas and place use restrictions"; o pedido de aumento de cota exige auditoria de conformidade (inventário 2.3). Na leitura feita, a página de políticas não traz uma frase geral listando a punição por descumprimento (a suspensão aparece escrita para casos específicos); a suspensão ou o encerramento do acesso do **projeto** de API é a consequência prevista nos Termos de Serviço da API, que este spec não releu: fica como o pior caso a considerar, não como texto citado. Se a chave e o cliente OAuth forem do mesmo projeto do Google Cloud (fato 13; a confirmar no console), a suspensão atingiria também: a coleta do canal próprio (Analytics e Reporting), o envio e a edição de vídeos, o A/B Lab, o cadastro e a busca de canais, e o login do AdSense. Não há como estimar a probabilidade; este spec não a chama de baixa nem de alta.
- **O que mantém o risco baixo sem burlar nada.** (1) Ficar na cota padrão e **nunca pedir aumento** (é o pedido que dispara a auditoria); a seção 9 mostra folga de 68% mesmo com 200 canais. (2) Coleta em ritmo normal, pelas rotas documentadas, sem leitura de página fora da API. (3) Não redistribuir: nenhum dado de concorrente sai do painel do dono (nada público, nada vendido, nada em produto). (4) Registrar a cota gasta por dia (E1), para ver qualquer desvio. (5) Toda medida própria leva o aviso de que é cálculo do Observatório. **Nada disto é garantia de conformidade.**

**Dado de vídeo ou canal que saiu do YouTube.** A página lida não tem frase que mande apagar o dado quando o conteúdo é removido; tem o dever de coerência com o dado atual (III.E.4.e) e, no exemplo de III.E.4.b, o de verificar a cada 30 dias "that the video has not been deleted". A leitura prudente é que guardar o conteúdo de um vídeo que o autor apagou contraria III.E.4.e. **Hoje o projeto não faz nada:** a linha fica congelada, sem marca (fato 5), com título, descrição e miniatura no Blob. **Padrão proposto [DONO, pergunta 3]:** marcar `missing_since` (E1); com 30 dias seguidos ausente, apagar o conteúdo do vídeo (versões de título e descrição, `raw`, miniaturas do Blob, série) e manter só a lápide: id, data de publicação, formato, data em que sumiu e a última contagem de views, que é o que M8 e a pergunta "o que morreu" usam. Alternativas: guardar tudo (coerente com a decisão dos 30 dias, mais exposto) ou apagar tudo (M8 perde o registro do sumiço).

### 11.2 Riscos abertos

1. **Plano do banco × número de canais** (seção 9): sem resposta à pergunta 1, a E2 não deve passar de 55 canais.
2. **Pacote em cache de 2 MB** (fato 7): a série semanal pode estourá-lo; item de aceite 21.
3. **Tempo do cron com 75 canais:** 200 s por lote; item 22.
4. **Sondas de Short** (`short-classifier.ts`) fazem chamadas HTTP fora da API para classificar vídeos de 61 a 180 s; o inventário não as revisou. Pesam no risco 11.1 mais do que qualquer coisa nova desta fase. Pergunta 5.
5. **Mudança de contagem de views de 24/08/2026** atravessa a série de canal; toda medida marca a janela, mas M3(a) e M8 só ficam limpas depois de 19/10 e 14/12.
6. **Interpolação em M1:** entre leituras diárias o erro é pequeno; no primeiro dia depende das leituras de 6 em 6 horas e de quando o vídeo foi descoberto. A tela mostra a distância entre as leituras usadas.
7. **Ao vivo × estreia:** a API não distingue os dois de forma documentada (NC); os dois ficam fora das medianas juntos.
8. **Dieta:** apagar 94 mil linhas em produção. Mitigado por P1 a P4, CSV fora do banco e ensaio local; o risco que resta é erro humano entre P3(i) e P3(iii).
9. **Miniaturas de terceiros em URL pública no Blob** (707 hoje): pergunta 9.
10. **Fuso:** a série de concorrentes é do dia de São Paulo; a do canal próprio, do dia do YouTube. Nenhuma tela desta fase soma as duas.

## 12. Fora do escopo, registrado (para o dono poder reabrir)

Decisão do dono: o canal próprio não precisa substituir o Studio; "talvez não seja necessário adicionar mais informações além das que já coletamos". Saem as etapas do inventário abaixo.

| # | Etapa do inventário | O que daria | O que expira enquanto não for feita |
|---|---|---|---|
| R1 | **E4: curva de retenção do vídeo próprio** | onde as pessoas saem e que trechos revêem: **o equivalente, para os vídeos do dono, aos "momentos mais vistos"**, e a única coisa do canal próprio que ele citou querer | a curva de hoje em diante, **se** a API só devolver o acumulado (NC: pedir o mesmo vídeo com dois períodos e comparar). Pergunta 4 |
| R2 | **E0: ligar os 10 tipos de relatório em lote desativados** (dispositivo e sistema, local de reprodução, província, demografia diária, legendas, cartões, telas finais, compartilhamento, combinado) | origem e perfil de quem assiste, por vídeo e dia | **cada tipo só nasce com o job e traz 30 dias de histórico ao criar: cada dia sem ligar é um dia que nunca existirá.** Cartões e telas finais por elemento e legendas só existem em lote |
| R3 | E3: normalizar os relatórios já baixados (tráfego, alcance combinado, básico) | origem de tráfego e termos de pesquisa por vídeo | o bruto é apagado 180 dias depois do download (a partir de abril de 2027); 104 relatórios `listado` de histórico expiram na origem a partir de cerca de 07/11/2026 se não forem baixados |
| R4 | E2 ampliada: métricas que faltam no diário, canal por dia, contadores públicos por dia | descurtidas, salvos em playlist, total do canal com vídeos apagados | só os contadores públicos por dia (a Data API só dá o de agora); o resto a Analytics API devolve para trás |
| R5 | E5: estado diário do vídeo e do canal próprios | histórico de categoria, idioma e afins | a data de cada mudança |
| R6 | E6: retroação pela Analytics API | histórico de tráfego, dispositivo, país, demografia | nada (retroage), salvo o detalhe de termos de pesquisa (NC) |
| R7 | E8: limpar zeros falsos legados (`youtube_video_analytics.impressions` e `ctr` em 0) | fecha um "zero nunca medido" | nada |

Também fora: tudo de 3.3 e 3.4; entidade "criador" e outras plataformas; chat; qualquer mudança no kit da forja.

## 13. Perguntas ao dono (cada uma com o padrão assumido e o que trava)

1. **O banco está no plano gratuito (500 MB)? Quantos canais em um ano?** Padrão: gratuito, e por isso teto de 55 canais com as regras de 4.3. Trava: a regra de cadência da E2 e o `channel_limit`. Com 75 canais são cerca de 565 MB em um ano.
2. **A triagem da seção 3 está certa?** Padrão: como escrita (inclui idioma, formato ao vivo ou estreia, sumiço e sinalizadores, que o ponto de partida não listava; exclui "feito para crianças"). Trava: a migration M1.
3. **Vídeo ou canal que saiu do YouTube: lápide, guardar tudo ou apagar tudo?** Padrão: lápide depois de 30 dias ausente (11.1). Trava: só a rotina de limpeza; a marcação entra na E1 de qualquer forma.
4. **Reabrir a curva de retenção do canal próprio (R1), que é o seu "momentos mais vistos"?** Padrão: não nesta fase. Trava: nada da A5; se sim, vira fase própria com migration e uma chamada de confirmação antes.
5. **Ligar os 10 relatórios em lote (R2) mesmo sem usar?** Padrão: não (decisão de escopo), sabendo que cada dia sem ligar não volta. É mudança de uma lista no código, sem migration.
6. **Playlists (E3): entram?** Padrão: sim, depois de E1 e E2, se a cota medida ficar abaixo de 2 unidades por canal e dia. Trava: a migration M3 e a "Linha do tempo" com playlists.
7. **Limiar de promoção para a série diária (1.000 views e 5% numa semana) e de "subida" (2× e 1.000 views em 7 dias).** Padrão: esses. Trava: nada; trocar muda um número em `rules.ts`.
8. **Buscar o catálogo inteiro dos canais (6.089 vídeos, hoje 1.389 guardados)?** Padrão: não; a série semanal cobre só o que já está guardado. Trava: o volume (quadruplica a parcela semanal).
9. **Miniaturas arquivadas: o Blob continua com URL pública?** Padrão: fica como está nesta fase. Trava: nada.
10. **O defeito do contêiner da comparação (T0) pode ser consertado já, fora do "só planejamento" da A3?** Padrão: sim, é defeito em produção e não depende de desenho. Trava: a ordem da E5.

## 14. Sequência proposta

**Sete etapas.** Cada uma vai à produção sozinha, com CI verde; push e promoção são do agente; migration e qualquer comando em produção são do dono; nenhuma escrita na forja.

| Ordem | Etapa | Migration | Precisa de mockup? | Depende de |
|---|---|---|---|---|
| 1 | **E6 (P1 e P2): dieta, parte aditiva** | sim (cobertura) | não | nada; libera espaço para o resto |
| 2 | **E1: campos, sinalizadores, `raw`** | sim (M1) | não | perguntas 2 e 3 |
| 3 | **E2: série** | sim (M2) | não | E1 (reusa o escritor), pergunta 1 |
| 4 | **E6 (P3): apagar as linhas vazias**, com o dono | sim | não | 3 execuções limpas de P2 |
| 5 | **E4: medidas** | não | não (funções e testes) | E2 para M1; M3(a), M4, M6 e M8 "parado" podem começar já |
| 6 | **E3: playlists** | sim (M3) | não | pergunta 6 |
| 7 | **E5: telas** (T0 primeiro) | não | **sim, uma a uma, na ordem de 6.5** | E4; aprovação visual |
| 8 | **E7: Cowork** | não | não | E4 |
| 9 | **E6 (P4): apagar o backup** | sim | não | 14 dias depois de P3 |

**Podem ser planejadas já, sem esperar desenho:** E6, E1, E2, E4 e T0. A ordem entre E1 e E2 segue "o que se perde por dia": as duas perdem todo dia; a E1 vem antes por custar zero de cota, ser só acréscimo e dar à E2 o escritor de `raw` que a passada semanal usa. As duas cabem na mesma semana.

**Esperam aprovação visual:** toda a E5 menos o T0. Os mockups de Comparar, seletor e trocas já existem e esperam o dono; os de Histórico do vídeo, página do canal, lista, Outliers e Insights ainda não foram feitos.

**Como se junta à A4 (12 de 17 tarefas feitas localmente).**

- A A4 continua como está: as Tarefas 13 e 14 esperam a aprovação dos mockups de `2026-10-12-a4-proprio-e-ajustes/`; a 15 fecha a semente.
- **A dieta toca o leitor da A4** (`lib/proprio/ler.ts`) e a semente e2e. Para não haver dois agentes no mesmo arquivo: a parte de código da E6 (P2) só começa depois de a A4 fechar o lote e ir a `staging`, ou é feita pelo mesmo implementador. P1 (migration aditiva) não toca código da A4 e pode ir antes.
- Os ajustes da A3 (seletor, trocas, base e direção, defeito do contêiner) estão "só em planejamento" por decisão do dono: **passam a ser a E5 desta fase**, na ordem de 6.5; a Tarefa 16 da A4 (cortar o painel) fica suspensa até ele decidir o conflito com C2.
- A Tarefa 14 da A4 ("Só o seu canal mede") e a comparação da E5 mexem na mesma tela: a E5 começa nela depois da 14.
- E1, E2 e E4 não tocam nenhum arquivo da A4 (são `competitor-sync.ts`, `series.ts`, `load.ts`, `pack.ts` e arquivos novos) e podem correr em paralelo.
