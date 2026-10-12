# Observatório, fase A5 (spec v2.3), parte 03: ritmo por hora e agenda única

> Parte do spec da A5 v2.2, dividido em 12/10/2026 só movendo texto (nenhuma frase mudou; a numeração de seções, etapas, migrations, perguntas e itens de aceite é a do original). Índice, cabeçalho "O que mudou" e tabela "onde está cada seção": [`../2026-10-12-observatorio-a5-concorrentes-design.md`](../2026-10-12-observatorio-a5-concorrentes-design.md).

> **v2.3 (12/10/2026, resposta ao portão de fim de spec).** Emendas localizadas, marcadas "v2.3" com o achado que as pediu. As três que mudam o desenho: **o canal do dono não entra em `competitor_*`** (ganha tabelas próprias na MG9: 4.7.1 e 4.7.4); **a leitura crua fica 60 dias, e não 3** (4.7.3); **a agenda troca a trava de sessão por arrendamento com validade e tomada atômica, ganha o vigia por tarefa e a regra de uma tarefa pesada por disparo** (4.8.2 a 4.8.6). A numeração antiga não mudou. Onde um trecho antigo divergir de uma emenda v2.3, vale a emenda. Respostas aos revisores: `.superpowers/sdd/a5/resposta-revisao-spec.md`.

### 4.7 Etapa E15: ritmo por hora (emenda v2.1; migration MG9)

**Pedido do dono (12/10):** "Dá para a gente descobrir o pico de curtidas meu e dos outros? Se aumentarmos a frequência do cron… eu quero saber se das 21 às 23 horas tem mais likes do que das 3 às 5 da manhã. Não sei se a API nos entrega isso, mas se colocarmos os crons no momento certinho, podemos inferir estas janelas."

**Resposta curta: a API não entrega nada por hora, nem para terceiros nem para o canal do dono. Dá para inferir por amostragem**, lendo o contador de hora em hora e guardando a diferença, com os limites de 4.7.6, que a tela tem de dizer.

**O que se perde a cada dia sem ela:** as diferenças hora a hora daquele dia. O contador só diz o total de agora; a hora em que ele subiu não volta.

#### 4.7.1 O que a API entrega por hora (documentação oficial, lida em 12/10)

| Fonte | O que a documentação diz | Consequência |
|---|---|---|
| Vídeo de terceiro, Data API | `videos.list` devolve em `statistics` só o **total acumulado de agora**: `viewCount` ("The number of times the video has been viewed"), `likeCount`, `commentCount`. Nenhuma série, nenhum horário ([recurso video](https://developers.google.com/youtube/v3/docs/videos)). Custo: 1 unidade por chamada ([custo de cota](https://developers.google.com/youtube/v3/determine_quota_cost)), com até 50 ids por chamada (como o spec já usa, 3.1) | por hora só existe o que nós amostrarmos |
| Canal próprio, Analytics API | as únicas dimensões de tempo são `day` e `month`; **não há `hour`**, nem dimensão de "tempo real" ou de 48 horas. O dia é o do Pacífico ("All dates refer to the time period beginning at 12:00AM Pacific time") ([dimensões](https://developers.google.com/youtube/analytics/dimensions)) | o "tempo real" de 48 horas do Studio **não existe na API** |
| Canal próprio, Reporting API (relatórios em lote) | a única dimensão de tempo dos relatórios de canal é `date` ([relatórios de canal](https://developers.google.com/youtube/reporting/v1/reports/channel_reports)) | idem |
| O "tempo real" do Studio | a Ajuda do YouTube diz que ele "only shows estimates of potential view activity" e pode não bater com a página do vídeo ([Ajuda: como as métricas são contadas](https://support.google.com/youtube/answer/2991785?hl=en)) | mesmo se existisse na API, seria estimativa |
| De quanto em quanto tempo o contador público muda | **a página do recurso não diz nada** sobre frequência, lote ou atraso. A Ajuda diz: "It takes our systems some time to figure out which views, likes, dislikes, and subscriptions are legitimate"; "The timing of these changes varies depending on a video or channel's popularity and views"; o YouTube pode "temporarily slow down, freeze, or change your metric count"; e nas primeiras horas de um vídeo "It may take time for your metrics to appear" | **NC, a medir nas primeiras semanas** (item de aceite 140): de quanto em quanto tempo cada contador de fato anda; se as views chegam em degraus; se a resposta da API vem de cache |

**Para o canal próprio a mesma amostragem serve**, sem depender da Analytics API: os contadores públicos dos vídeos do dono são lidos pela mesma chamada, e a comparação "o meu × o deles" fica no mesmo relógio e na mesma fonte (regra de 6.1.6). ~~O canal do dono entra como mais um canal acompanhado em `competitor_*`.~~ **Corrigido na v2.3 (achado C-5 da revisão de dados, crítico, e I2 da de software): o canal do dono NÃO entra em `competitor_*`.** A frase riscada era uma mudança de arquitetura sem etapa, sem migration e sem item. Hoje nenhum canal próprio está em `competitor_channels` (medido: 0 de 15); pô-lo lá mudaria, sem ninguém ter pedido, a Lista de Canais (ele apareceria duas vezes), as medianas de nicho, "Você no nicho", as notificações de troca (cada edição de título do dono viraria "troca de concorrente"), os endpoints do Cowork, o pacote da forja (o item 53 quebraria), o limite de canais e o fluxo de remoção; e a série do próprio passaria a existir duas vezes, uma autorizada e outra não. **O desenho que vale:** os vídeos **públicos** dos canais do dono são lidos pela mesma chamada e gravados em quatro tabelas próprias, com a mesma forma das dos concorrentes e o id de 11 caracteres do YouTube como chave (`yt_own_public_*`, na MG9: 4.7.4). As funções puras (intervalo limpo, fatia, fases, limiares) são as mesmas; só o escritor e o leitor mudam de tabela. É a mesma decisão da E18 (7.5.1: versões do vídeo próprio em tabela própria). Se o dono quiser o canal dele **também** na lista de concorrentes, é a pergunta 34. **O estado real, dito sem suavizar:** com 36 views em 90 dias (medido), o mapa do canal do dono é "não medido" por meses; o que a etapa entrega para ele agora é a coleta, não a leitura.

#### 4.7.2 O desenho: amostrar de hora em hora e guardar a diferença

- **Uma execução por hora, no minuto zero.** Lê views, curtidas e comentários de cada vídeo da lista com `videos.list?part=statistics&id=…`, **50 ids por chamada, juntando vídeos de canais diferentes na mesma chamada** (a chamada é por id de vídeo, não por canal; é isso que deixa a cota em dezenas de unidades por dia, 9.5).
- **A diferença** entre duas leituras seguidas do mesmo vídeo é o que entra no mapa. Cada leitura guarda o instante real (`taken_at`); o intervalo é atribuído à hora de São Paulo em que **começou**.
- **Intervalo de 1 hora como padrão** [DONO, pergunta 17]. O que mudaria: **30 minutos** dobra a cota e as linhas da curva das primeiras 72 horas (mais 0,75 MB por canal por ano) e só rende se o contador de fato andar mais de uma vez por hora, que é justamente o que não está confirmado; **2 horas** corta os dois pela metade e ainda responde à pergunta do dono (ele comparou janelas de 2 horas, "21 às 23" contra "3 às 5"), mas borra a curva de lançamento, em que a primeira hora pesa. Começar em 1 hora e decidir com a medição do item 140.
- **Para quais vídeos:** os publicados nos últimos **14 dias** (`RULES.hourlyAgeDays`), até **25 por canal** (`RULES.hourlyVideosMax`), os mais novos primeiro, de todos os canais acompanhados e dos canais do dono; ao vivo em andamento fica fora. **v2.3: de onde sai a lista do dono.** Dos canais de `youtube_channels` do site e dos vídeos de `youtube_videos` publicados nos últimos 14 dias, **só os públicos** (a chave de API devolve também vídeo não listado quando se sabe o id, e esses não entram); até 25 por canal, como nos outros. Os ids vão nas mesmas chamadas de 50, e as leituras são gravadas em `yt_own_public_video_hourly` e `yt_own_public_video_early`. A coluna que diz "público" é conferida no plano (C0.11); enquanto não houver captura que diga, o vídeo **não** é lido (negação por padrão) e a execução conta quantos ficaram fora. **Por quê:** é onde há movimento. Um vídeo de seis meses ganha poucas curtidas por dia, a diferença de hora em hora é quase sempre zero, e somá-lo só acrescenta ruído e chamadas. O canal médio tem 3,8 vídeos nessa janela (98 por ano); o que mais publica teve 152 em 90 dias, cerca de 24 em 14 dias, e é para ele o teto. Acima do teto a execução **registra quantos ficaram fora** (corte silencioso é proibido).
- **A descoberta de vídeo novo continua sendo a da sincronização que já existe** (até 6 horas depois da publicação). A curva de lançamento começa na primeira leitura depois da descoberta, e a tela diz a idade do vídeo nessa leitura. Descobrir de hora em hora custa 24 unidades por canal por dia e é a pergunta 19.

#### 4.7.3 Armazenamento: o que fica, o que é descartado

**A conta do desenho ingênuo** (uma linha por vídeo e por hora, cerca de 105 B com o índice): os 50 vídeos acompanhados de um canal dariam 438.000 linhas e **cerca de 46 MB por canal por ano** (690 MB por ano com 15 canais: estoura o plano gratuito em menos de um ano, sozinho); só os vídeos de até 14 dias, 33.000 linhas e **cerca de 3,5 MB por canal por ano**, mais da metade de tudo o que a v2 previa para um canal. **Não é proposto.** *(v2.3, 2ª passada, N-4 de dados: esta conta usa a linha de 105 B estimada na v2.1. Com a linha de **156 B**, medida na série e usada em 9.6, os dois números são cerca de 68 MB e cerca de **5,2 MB** por canal por ano. A conclusão não muda.)* O que é:

| Peça | O que guarda | Quanto tempo | Por canal e ano |
|---|---|---|---|
| **1. Curva das primeiras 72 horas**, hora a hora | os três contadores **acumulados** de cada vídeo, a cada leitura, enquanto a idade for menor que 72 horas. É a tabela `competitor_video_early` da E2 (4.3), sem mudar de forma: passa de 4 leituras por dia para 24 | fica; vai para o arquivo pela idade (9.2) | 98 vídeos × 72 = 7.060 linhas, **≈ 0,75 MB** (eram 1.200 linhas e 0,13 na v2) |
| **2. Mapa de horas do canal** | as diferenças **somadas** numa grade de 168 casas (7 dias da semana × 24 horas de São Paulo), **por mês**, separando views, curtidas e comentários, longo × Short, e duas fases do vídeo: **lançamento** (idade até 72 horas) e **depois** (do dia 4 ao 14). Quatro linhas por canal e mês, cada uma com vetores de 168 posições | fica online (é pequeno e é o que a tela lê) | 48 linhas, **≈ 0,25 MB** |
| **3. Leituras cruas, de passagem** | os contadores acumulados de cada vídeo da lista, por hora | ~~**3 dias** (`RULES.hourlyBufferDays`): só o tempo de fechar o dia e somar no mapa; depois são apagadas~~ **v2.3 (achado C-6, crítico): pelo menos 60 dias**, e o apagamento fica **desligado por padrão** (abaixo) | ~~não cresce: cerca de 270 linhas por canal, 0,03 MB, em regime~~ **v2.3:** com 60 dias, cerca de 5.500 linhas e 0,85 MB por canal, em regime; **sem apagar, cerca de ~~3,5~~ 5,2 MB por canal por ano** (9.6) **(v2.3, 2ª passada, N-4 de dados: 3,8 vídeos × 24 × 365 × 156 B; os 3,5 usavam a linha de 105 B)** |
| **Descartado** | a diferença hora a hora de cada vídeo depois das 72 horas | | |

**v2.3 (achado C-6 da revisão de dados): por que 3 dias não servem, e o que vale.** A medição que decide o que a etapa mostra é feita 14 dias depois do deploy (item 140), por contador e por tamanho de vídeo. Com o bruto apagado em 3 dias, a proporção de "zero seguido de salto" dos vídeos de 4 a 14 dias **não seria recuperável**, e um erro na função de soma (intervalo limpo, fases, limiares) ficaria gravado no mapa sem como refazer. É dado que a origem não guarda, descartado por nós. Regras: (i) `RULES.hourlyBufferDays = 60`; (ii) **nenhuma leitura crua é apagada enquanto o interruptor `OBS_HOURLY_RAW_PURGE` não estiver ligado**; ele nasce desligado, e variável ausente = desligado (teste que apaga a variável); (iii) só se liga depois de o item 140 estar fechado e anotado, de a soma ter sido conferida contra o bruto (item 219) **e** de o dono responder à pergunta 36 (guardar a leitura crua para o NAS, a cerca de ~~3,5~~ **5,2** MB por canal por ano, ou descartar depois de 60 dias); (iv) ligado, apaga só leitura com mais de 60 dias **de dia já somado**, como antes. Enquanto ele não responde, o custo é de cerca de ~~6~~ **6,5** MB por mês com 15 canais, e o sinal de limite (9.2) enxerga. **(v2.3, 2ª passada, N-4 de dados: 15 × 5,2 = 78 MB por ano; sem levar ao NAS, o banco cruza os 500 MB por volta do mês 21, e não do 31: 9.6.)**

**Por que duas fases no mapa.** Sem separar, o mapa mostraria a hora em que o **canal publica**, não a hora em que o **público reage**: um canal que publica sempre às 18:00 teria o pico às 18:00 por causa do lançamento. A fase "depois" (dia 4 ao 14) é a leitura do hábito do público; a fase "lançamento" e a curva de 72 horas são a leitura da tração. A tela nunca soma as duas.

**Por que guardar também a fatia, e não só a soma.** Um vídeo que estoura ganha num dia mais curtidas que todos os outros no mês e sozinho desenharia o mapa. Por isso cada casa guarda duas coisas: a **soma** das diferenças (o volume) e a **soma das fatias** (a parte que aquela hora teve do total daquele vídeo naquele dia), em que cada vídeo e dia pesa igual. A medida M13 usa a fatia; o volume é mostrado ao lado. A fatia só é calculada para vídeo e dia com as 24 horas lidas e com movimento mínimo (4.7.6).

**Por mês, e não por semana** [DONO, pergunta 18]: por semana custa 4,3 vezes mais (cerca de 1,1 MB por canal por ano) e cada casa teria uma amostra só (uma terça às 21:00 por semana); a leitura de "nas últimas 4 semanas" continua possível somando o mês corrente e o anterior, com a tela dizendo a janela.

#### 4.7.4 DDL proposto (migration MG9)

```sql
-- 1. Leituras cruas (v2.3: guardadas por pelo menos 60 dias; apagamento desligado por padrão, 4.7.3)
create table if not exists public.competitor_video_hourly (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  hour_slot timestamptz not null,           -- date_trunc('hour', taken_at): duas execuções na mesma hora não duplicam
  taken_at timestamptz not null,            -- instante real da leitura
  site_id uuid not null references public.sites(id) on delete cascade,
  views bigint not null,
  likes bigint,                             -- nulo = oculto
  comments bigint,                          -- nulo = desligado
  primary key (video_id, hour_slot)
);
create index if not exists idx_cvh_slot on public.competitor_video_hourly (hour_slot);

-- 2. Mapa de horas: 4 linhas por canal e mês (formato × fase)
create table if not exists public.competitor_channel_hour_map (
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  month date not null,                      -- 1º dia do mês, data de São Paulo
  format text not null check (format in ('longo', 'short')),
  phase text not null check (phase in ('lancamento', 'depois')),   -- idade até 72 h | do dia 4 ao 14
  site_id uuid not null references public.sites(id) on delete cascade,
  -- vetores de 168 posições; índice = (dia da semana, 0 = domingo) × 24 + hora de São Paulo, + 1
  views_sum bigint[] not null,              -- soma das diferenças POSITIVAS de intervalos limpos
  likes_sum integer[] not null,
  comments_sum integer[] not null,
  views_share real[] not null,              -- soma das fatias (diferença da hora ÷ diferença do dia do mesmo vídeo)
  likes_share real[] not null,
  comments_share real[] not null,
  n_intervals integer[] not null,           -- intervalos limpos de 1 hora que caíram na casa
  -- por linha, não por casa:
  video_days_views integer not null default 0,     -- dias de vídeo completos que entraram na fatia, por contador
  video_days_likes integer not null default 0,
  video_days_comments integer not null default 0,
  videos integer not null default 0,               -- vídeos distintos que contribuíram no mês
  long_intervals integer not null default 0,       -- intervalos maiores que 1 hora (buraco): ficam FORA das casas
  long_views bigint not null default 0,            -- e a diferença que eles cobriam, para a tela dizer quanto ficou fora
  long_likes bigint not null default 0,
  long_comments bigint not null default 0,
  neg_views_n integer not null default 0,          -- leituras em que o contador DIMINUIU, e de quanto (soma, número negativo)
  neg_views_sum bigint not null default 0,
  neg_likes_n integer not null default 0,
  neg_likes_sum bigint not null default 0,
  neg_comments_n integer not null default 0,
  neg_comments_sum bigint not null default 0,
  updated_at timestamptz not null default now(),
  rule_version smallint not null default 1,        -- v2.3: versão da regra (intervalo limpo, fatia, limiares) com que a linha foi somada; um mês tem uma versão só
  primary key (competitor_channel_id, month, format, phase),
  check (cardinality(views_sum) = 168 and cardinality(likes_sum) = 168 and cardinality(comments_sum) = 168
     and cardinality(views_share) = 168 and cardinality(likes_share) = 168 and cardinality(comments_share) = 168
     and cardinality(n_intervals) = 168)
);

-- 3. Registro do que já foi somado: é o que torna a soma idempotente
create table if not exists public.competitor_hour_fold_log (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  day date not null,                        -- dia de São Paulo já somado no mapa
  site_id uuid not null references public.sites(id) on delete cascade,
  intervals_clean smallint not null,
  intervals_long smallint not null,
  folded_at timestamptz not null default now(),
  primary key (video_id, day)
);

alter table public.competitor_video_hourly enable row level security;
alter table public.competitor_channel_hour_map enable row level security;
alter table public.competitor_hour_fold_log enable row level security;
drop policy if exists "competitor_video_hourly_select" on public.competitor_video_hourly;
create policy "competitor_video_hourly_select" on public.competitor_video_hourly for select using (public.can_view_site(site_id));
drop policy if exists "competitor_channel_hour_map_select" on public.competitor_channel_hour_map;
create policy "competitor_channel_hour_map_select" on public.competitor_channel_hour_map for select using (public.can_view_site(site_id));
drop policy if exists "competitor_hour_fold_log_select" on public.competitor_hour_fold_log;
create policy "competitor_hour_fold_log_select" on public.competitor_hour_fold_log for select using (public.can_view_site(site_id));

-- 4. v2.3 (achados C-5 e I2): o canal do dono NÃO entra em competitor_*. Quatro tabelas com a mesma forma,
--    chaveadas pelo id de 11 caracteres do YouTube (padrão yt_own_*), só com contadores PÚBLICOS de vídeos PÚBLICOS.
--    "public" no nome: é dado de classe (i) (8.1.3), lido por can_view_site, e fica FORA da lista de tabelas privadas do bloco PL (7.1).
create table if not exists public.yt_own_public_video_hourly (
  youtube_video_id text not null,
  hour_slot timestamptz not null,           -- date_trunc('hour', taken_at)
  taken_at timestamptz not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  views bigint not null,
  likes bigint,                             -- nulo = oculto
  comments bigint,                          -- nulo = desligado
  primary key (youtube_video_id, hour_slot)
);
create index if not exists idx_yopvh_slot on public.yt_own_public_video_hourly (hour_slot);

create table if not exists public.yt_own_public_video_early (      -- curva das primeiras 72 horas, como competitor_video_early
  youtube_video_id text not null,
  taken_at timestamptz not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  views bigint not null,
  likes bigint,
  comments bigint,
  primary key (youtube_video_id, taken_at)
);

create table if not exists public.yt_own_public_hour_map (
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  month date not null,
  format text not null check (format in ('longo', 'short')),
  phase text not null check (phase in ('lancamento', 'depois')),
  site_id uuid not null references public.sites(id) on delete cascade,
  -- as MESMAS colunas de competitor_channel_hour_map, com os mesmos tipos, not null e padrões:
  -- os 7 vetores de 168 posições, os 3 video_days_*, videos, os 4 long_*, os 6 neg_*, updated_at e rule_version,
  -- e o mesmo check de cardinalidade. O plano copia o bloco; um teste compara as colunas das duas tabelas.
  primary key (channel_id, month, format, phase)
);

create table if not exists public.yt_own_public_hour_fold_log (
  youtube_video_id text not null,
  day date not null,                        -- dia de São Paulo já somado
  site_id uuid not null references public.sites(id) on delete cascade,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  intervals_clean smallint not null,
  intervals_long smallint not null,
  folded_at timestamptz not null default now(),
  primary key (youtube_video_id, day)
);

alter table public.yt_own_public_video_hourly enable row level security;
alter table public.yt_own_public_video_early enable row level security;
alter table public.yt_own_public_hour_map enable row level security;
alter table public.yt_own_public_hour_fold_log enable row level security;
drop policy if exists "yt_own_public_video_hourly_select" on public.yt_own_public_video_hourly;
create policy "yt_own_public_video_hourly_select" on public.yt_own_public_video_hourly for select using (public.can_view_site(site_id));
drop policy if exists "yt_own_public_video_early_select" on public.yt_own_public_video_early;
create policy "yt_own_public_video_early_select" on public.yt_own_public_video_early for select using (public.can_view_site(site_id));
drop policy if exists "yt_own_public_hour_map_select" on public.yt_own_public_hour_map;
create policy "yt_own_public_hour_map_select" on public.yt_own_public_hour_map for select using (public.can_view_site(site_id));
drop policy if exists "yt_own_public_hour_fold_log_select" on public.yt_own_public_hour_fold_log;
create policy "yt_own_public_hour_fold_log_select" on public.yt_own_public_hour_fold_log for select using (public.can_view_site(site_id));
-- Nenhuma policy de escrita: só service role.
```

- **`competitor_video_early` (MG2) não muda de forma**: chave `(video_id, taken_at)`, contadores acumulados. A E15 só passa a escrever nela de hora em hora, e a condição "descoberto com menos de 24 horas" da E2 continua (para vídeo descoberto tarde a curva de lançamento não existe: "descoberto tarde").
- **A soma no mapa** é uma função `competitor_hour_fold(p_day date)` (security invoker, `search_path` fixo, `execute` só para `service_role`), chamada pela execução horária para todo dia de São Paulo **fechado há pelo menos 3 horas** e ainda sem linha no registro. Numa transação só: grava a linha do registro (se já existe, não soma de novo), soma os vetores, e atualiza os contadores da linha. Depois, e só depois, a execução apaga as leituras cruas com mais de 3 dias **de dias que já têm registro**: leitura crua de dia ainda não somado nunca é apagada (se a soma parar, as leituras se acumulam e o alerta de 4.7.5 aparece; o dado não se perde em silêncio). **v2.3:** onde este bullet diz "3 dias", leia-se a regra de 4.7.3: 60 dias, e só com o interruptor ligado. **A soma pode ser refeita:** uma função `competitor_hour_refold(p_month date)` (mesmos atributos de segurança) apaga as linhas do mapa e do registro daquele mês e soma de novo a partir das leituras cruas, **só se todas as leituras do mês ainda existirem** (senão recusa e diz desde que dia falta); grava a `rule_version` em vigor. Serve para corrigir um erro da soma e para trocar a regra da fatia depois da medição do item 140 (4.7.6, ponto 5). As tabelas do dono têm o par equivalente (`yt_own_public_hour_fold`, `yt_own_public_hour_refold`), que chama as mesmas regras. **v2.3, 2ª passada (N-1 de dados):** "ainda sem linha no registro" só protege contra a soma em dobro enquanto o registro não for podado antes do bruto: o invariante está no bullet seguinte.
- **O registro de dias somados** tem 98 vídeos × 14 dias, cerca de 1.400 linhas por canal por ano (0,07 MB), e é podado pela mesma execução depois de 60 dias (o vídeo já saiu da janela), ficando em cerca de 230 linhas por canal. **v2.3, 2ª passada (N-1 de dados, crítico): a poda aos 60 dias, incondicional, corrompia o mapa.** Ela era segura quando o bruto saía em 3 dias. Com o bruto guardado (4.7.3), no dia 61 o dia 1 perderia a linha do registro com as leituras ainda no banco, e `competitor_hour_fold`, que soma "todo dia fechado e ainda sem linha no registro", sem limite para trás, somaria o dia 1 pela segunda vez. **Invariante: a linha do registro de (vídeo, dia) vive pelo menos tanto quanto as leituras cruas daquele vídeo e dia.** Regra exata da poda, que substitui "depois de 60 dias": `delete from competitor_hour_fold_log f where f.day < :hoje - 60 and not exists (select 1 from competitor_video_hourly h where h.video_id = f.video_id and h.hour_slot >= <início do dia f.day em São Paulo> and h.hour_slot < <início do dia seguinte>)`. Com `OBS_HOURLY_RAW_PURGE` ausente (o padrão) nenhuma leitura sai, logo **nenhuma linha do registro sai**. Com ele ligado, `podas` apaga as leituras e depois o registro, **nessa ordem e na mesma transação**: uma falha no meio deixa registro sem bruto (inofensivo: não há o que somar), nunca bruto sem registro. A soma continua sem limite para trás (um dia atrasado por cron parado ainda é somado); quem impede a soma em dobro é o invariante, não um corte de idade. `competitor_hour_refold` não o quebra: apaga mapa e registro do mês e regrava os dois na mesma transação. Vale igual para o par `yt_own_public_hour_fold_log` × `yt_own_public_video_hourly`. Custo: enquanto o bruto não for apagado, o registro cresce cerca de 1.400 linhas por canal por ano (0,07 MB), em vez de parar em 230 (9.6). Item 248.
- **RLS no padrão D6** (`can_view_site`): são contagens públicas, sem texto e sem pessoa. Nenhuma policy de escrita.
- **Zero × não medido:** casa com `n_intervals = 0` é "não medido naquela hora", **não** "zero curtidas naquela hora"; casa com intervalos e soma zero é zero medido. São dois estados com forma diferente na tela.
- **Remoção de canal e "apagar" de 4.5** levam as três tabelas por cascata; `competitor_channel_removal_impact` passa a contá-las. O mapa do mês **não** é recalculado quando um vídeo é apagado (as somas não guardam de qual vídeo vieram): a tela do mapa diz "inclui vídeos que saíram do YouTube ou foram apagados do painel". **v2.3:** as quatro tabelas `yt_own_public_*` têm `on delete restrict` no canal, como as outras `yt_own_*`: `youtube_channel_removal_impact` passa a contá-las e `youtube_channel_remove` a tratá-las (C0.11).

#### 4.7.5 Infra: de onde sai a execução horária

- **Emenda v2.2: nenhuma linha nova em `vercel.json`.** A v2.1 propunha uma entrada `sync-youtube?mode=hourly`; o dono pediu para combinar os crons (decisão 24). A leitura horária passa a ser a tarefa `leitura_horaria` da **agenda única** (4.8), disparada pela entrada que já existe, `sync-youtube?mode=competitors`, a cada 20 minutos. **Onde os itens abaixo falarem em "modo horário", "rota" ou na chave de trava `sync-youtube-hourly`, leia-se a tarefa da agenda, com a trava e o orçamento de 4.8;** a chave de saúde `sync-youtube-hourly` continua existindo, agora por tarefa. **v2.3:** a trava deixa de ser `cron_try_lock` (4.8.4), e a chave de saúde por tarefa não passa por `resolveCronName`, que só conhece as entradas do `vercel.json`: o vigia ganha uma segunda fonte (4.8.5).
- **Nenhum job de `pg_cron`.** O problema registrado do projeto é o agendamento em dois lugares (a Vercel chama por `GET`, o `pg_cron` por `POST`; rota só `POST` morre calada na Vercel; rota nos dois dispara em dobro; e um job de `pg_cron` criado só no painel derrubou a produção em 05/09). Esta etapa fica **só na Vercel**, e o item de aceite 141 confere que não existe job de `pg_cron` com o nome.
- **Duração esperada:** de 2 chamadas (15 a 20 canais) a 16 (200 canais) por execução, mais uma gravação em lote e, uma vez por dia, a soma: segundos, bem abaixo do teto de 300 s da rota. O plano mede com 75 canais simulados.
- **Execução que atrasa e encavala na seguinte.** (a) **Trava:** a rota usa `withCronLock` com a chave `sync-youtube-hourly`; a segunda execução responde "já rodando" e sai. **Achado a tratar no plano:** existem duas implementações de `withCronLock`, a de `apps/web/src/lib/logger.ts` (trava **em memória**, que não vale entre instâncias da Vercel) e a de `apps/web/lib/logger.ts` (trava no banco, `cron_try_lock`); o modo horário tem de usar a do banco, e o plano confere qual a rota importa hoje. (b) **Sem duplicar:** a chave `(video_id, hour_slot)` com `on conflict do nothing` faz duas execuções na mesma hora gravarem uma leitura só. (c) **Execução pulada vira buraco, não erro escondido:** a diferença seguinte cobre duas horas e é tratada como intervalo longo (4.7.6). A Vercel não repete cron que falhou.
- **Falha em vermelho.** Chave própria em `cron_health` (`sync-youtube-hourly`), com entrada em `resolveCronName` da rota de saúde; mais de 2 horas sem sucesso é falha. A execução devolve e registra: vídeos lidos, vídeos fora do teto, intervalos longos, dias somados, leituras cruas à espera de soma. E o mapa mostra a própria cobertura ("lidas 702 de 720 horas do mês"), de modo que cron parado aparece na tela como falta, nunca como mapa vazio.
- **Cota** gravada em `youtube_quota_usage.operations`, modo `horario`.

#### 4.7.6 Limites que a tela tem de dizer, sem suavizar

1. **A diferença mostra quando o YouTube atualizou o contador, não o minuto em que a pessoa curtiu.** O YouTube valida views e curtidas antes de contar, ajusta depois, pode segurar ou congelar a contagem, e não publica de quanto em quanto tempo o número público anda (4.7.1). O que é **NC e será medido** (item 140): a proporção de intervalos de 1 hora com diferença zero seguidos de um salto (contador que anda em degraus), separada por contador e por tamanho do vídeo. Se as views andarem em degraus de várias horas, o mapa de views por hora **não é mostrado** e a tela diz por quê; o de curtidas é o mais provável de servir, e também é hipótese até a medição. Texto fixo no corpo do mapa: *"Mostra quando o contador público mudou, lido de hora em hora. O YouTube atualiza os contadores com atraso e em lotes; a hora real da curtida pode ser anterior."*
2. **Buraco:** leitura que falha faz a diferença seguinte cobrir duas horas ou mais. **Nunca é dividida ao meio.** Intervalo "limpo" é o que começa a até 5 minutos da hora cheia e dura de 50 a 70 minutos; qualquer outro é "longo": fica **fora** das casas, entra em `long_intervals` com a diferença que cobria, e a tela diz "N intervalos sem leitura horária, com X curtidas, fora do mapa". Um dia com intervalo longo não entra na fatia.
3. **Contador que diminui** (curtida retirada, limpeza de views, comentário apagado): **proposta: guardar como é, à parte.** A diferença negativa não entra na casa (uma limpeza de 5.000 views às 4:00 apagaria a casa; uma curtida retirada às 3:00 não é "menos uma reação às 3:00") e também **não vira zero em silêncio**: vai para os contadores `neg_*` da linha, com número e soma, e a tela diz "N leituras em que o contador diminuiu (soma −X), fora do mapa". Na curva das 72 horas o contador é guardado como veio, com a queda à vista. Dia com queda não entra na fatia daquele contador.
4. **Fuso.** O mapa é em **horário de São Paulo** (D5; o Brasil não tem horário de verão hoje, e a regra é "data e hora de São Paulo", não um deslocamento fixo). O público de um canal pode estar em outro fuso, ou espalhado: "21 às 23" é a hora de São Paulo em que o contador subiu, não a hora local de quem curtiu. A tela diz isso e mostra o país declarado do canal (E1) ao lado.
5. **Amostra mínima.** A fatia de um vídeo e dia só conta com as 24 horas limpas e movimento mínimo naquele dia: 200 views, 20 curtidas ou 10 comentários (cada contador com o seu) [DONO, pergunta 20]. O mapa de um canal, formato e contador é "medido" só com pelo menos **28 dias de vídeo** e **3 vídeos distintos** na janela; **v2.3 (achado I-12 da revisão de dados): o custo de exigir as 24 horas, dito.** Com 97% de leituras boas por hora, só 48% dos dias de vídeo têm as 24 horas limpas (0,97 elevado a 24; com 99%, 79%), e uma leitura perdida custa dois intervalos. O limiar de 28 dias de vídeo pode demorar o dobro e a etapa parecer vazia sem estar quebrada. A regra das 24 horas **fica** nesta versão, porque com menos horas a soma do perfil deixa de fechar em 1; mas (i) o item 140 passa a medir a proporção de dias de vídeo que entram na fatia; (ii) se ela ficar abaixo de 60%, a regra muda para "22 horas limpas ou mais, com a fatia calculada sobre as horas lidas e a base dita", o mapa é refeito do bruto (`competitor_hour_refold`, possível porque o bruto agora fica 60 dias) e `rule_version` sobe; (iii) o item 128 e esta regra passam a ser lidos juntos: a prova de saúde aceita 22 horas, a fatia exige 24, e a tela mostra as duas contagens ("dias de vídeo lidos: N; com as 24 horas: M"). abaixo disso é "não medido: poucos vídeos recentes (N dias de vídeo de 28)". Para a maioria dos canais pequenos, e para o canal do dono hoje (36 views em 90 dias), **o estado real é "não medido"**, por meses.
6. **Só vê vídeos de até 14 dias.** O mapa é o ritmo do público **dos vídeos recentes**; quem assiste ao catálogo antigo não aparece.
7. **Curtidas ocultas e comentários desligados:** "não medido: oculto pelo canal", nunca zero.
8. **A regra de contagem de views** mudou em 24/08/2026; todo o mapa nasce depois dela.
9. **É cálculo nosso** sobre dado público, dito no ⓘ (III.E.4.h, seção 11.1).

#### 4.7.7 O que isso responde, e as medidas (entram na E4)

Perguntas: **em que horas o público deste canal reage** (M13, fase "depois"); **a que horas os vídeos dele ganham tração depois de publicados** (M14); **e a comparação com o canal do dono**, pela mesma amostragem.

| # | Medida | Definição exata | Janela | "Não medido" quando | Viés dito na tela |
|---|---|---|---|---|---|
| **M13** | **Horas em que o público reage** (por canal, formato e contador: views, curtidas ou comentários) | **perfil de 24 horas:** para cada hora h de São Paulo, p(h) = soma das fatias da hora h em todos os dias da semana ÷ número de dias de vídeo, na fase "depois"; a soma de p(h) nas 24 horas é 1. **Janela de pico:** as 2 horas seguidas com a maior soma de p; mostrada com "quantas vezes a média" (soma da janela ÷ 2/24). **Comparação de duas janelas** (a pergunta do dono, "21 às 23 contra 3 às 5"): razão entre as somas de p nas duas. **Mapa 7 × 24:** a mesma fatia por dia da semana, só para dia da semana com 4 dias de vídeo ou mais | o mês corrente e o anterior (padrão), ou os últimos 3, 6 ou 12 meses | menos de 28 dias de vídeo ou de 3 vídeos; contador oculto; mais de 20% das horas do período sem leitura; contador que a medição do item 140 mostrou andar em degraus | os nove limites de 4.7.6, com o primeiro no corpo da tela; "é quando o contador mudou"; canal que publica muito em um dia da semana tem aquele dia mais bem medido |
| **M14** | **Tração depois de publicar** (por canal e formato) | para cada hora k desde a publicação (1 a 72), a mediana, entre os vídeos, de views na hora k ÷ views na hora 72 (curva de 72 horas, com as leituras hora a hora); e **"metade em N horas"**: a primeira hora em que a mediana chega a 0,5. O mesmo para curtidas | publicados nos últimos 90 dias | menos de 3 vídeos com curva; vídeo descoberto com mais de 6 horas fica fora da mediana (a tela diz quantos); ao vivo e estreia fora (regra b da seção 5) | a primeira leitura depende de quando o vídeo foi descoberto; a hora de publicação do canal e o dia da semana pesam; views chegam com atraso nas primeiras horas, segundo o próprio YouTube |

M1 na idade de 1 dia (seção 5) passa a usar as leituras de hora em hora no lugar das de 6 em 6 horas, sem mudar de definição; a tolerância de "leituras vizinhas a mais de 8 h" cai para 2 h.

#### 4.7.8 Tela: o que o mockup 21 tem de considerar (seção 6.5)

1. **O mapa de horas × dias** (7 × 24) e, acima dele, o perfil de 24 horas com a janela de pico: frase-resumo no topo ("As curtidas deste canal sobem mais entre 20:00 e 22:00, 2,3 vezes a média; base: 41 dias de vídeo, 6 vídeos"), régua ou barra, cor estável.
2. **Três estados de casa, distintos por cor e por símbolo:** medido com valor, **zero medido** (caixa vazada, como no gráfico do canal próprio), **não medido** (rosa com hachura). Nunca um degradê em que "sem leitura" pareça "pouco".
3. **Caso magro, que é o caso real por meses:** canal com quase nada ("não medido: 6 dias de vídeo de 28"), com o que já existe à vista e a data provável em que passa a existir; canal do dono com 36 views em 90 dias; canal só com Shorts.
4. **O texto fixo do limite 1** no corpo, não só no ⓘ; fuso de São Paulo escrito no eixo; "N intervalos fora do mapa" e "N leituras em que o contador diminuiu" visíveis.
5. **Seletores:** contador (curtidas primeiro, que foi o pedido), formato, fase ("hábito do público: do dia 4 ao 14" × "lançamento: primeiras 72 horas", nunca somadas), período.
6. **Comparar com o meu canal:** os dois perfis de 24 horas lado a lado, cada um com a sua base, e "não comparável" quando um dos dois é não medido.
7. **A curva de 72 horas** (M14) na página do canal e na do vídeo (mockup 13, que já previa as primeiras 72 horas: passa a ser hora a hora), com a marca da hora de publicação em São Paulo.
8. **A 390 px** um mapa de 24 colunas não cabe: o mockup resolve (blocos de 2 ou 3 horas, ou o perfil de 24 horas no lugar do mapa) sem rolagem horizontal da página.
9. **Cobertura do cron à vista:** "lidas N de M horas no período".
10. Acrescenta à lista fechada de 6.1.5: "poucos vídeos recentes (N dias de vídeo de 28)", "sem leitura horária nesta hora", "o contador do YouTube anda em degraus: mapa de views por hora não mostrado", "a leitura por hora começou em dd/mm".

### 4.8 Etapa E16: agenda única do cron de concorrentes (emenda v2.2; migration MG10)

**Decisão do dono (12/10, item 24):** "temos limites de cron, apesar de pagarmos a Vercel Pro; combinar o que pudermos."

#### 4.8.1 O levantamento (lido em 12/10)

| O quê | Número | Fonte |
|---|---|---|
| Entradas de cron na Vercel | **49**, todas em `apps/web/vercel.json`; `apps/api/vercel.json` não tem nenhuma | **VERIFICADO** (contagem do arquivo) |
| Rotas em `apps/web/src/app/api/cron/` | 47 pastas; a rota `sync-youtube` atende 5 entradas (modos `schedule`, `catchall`, `metrics`, `ab-poll`, `competitors`) e `ab-watchdog` atende 2 | **VERIFICADO** |
| Limite do plano | **100 crons por projeto, em todos os planos** (Hobby, Pro, Enterprise); no Pro, intervalo mínimo de 1 minuto e precisão por minuto | [Usage & Pricing for Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing) (página atualizada em 15/07/2026) |
| Folga na contagem | 51 entradas | conta |
| Outro limite de **quantidade** que explique "temos limites" | **não confirmado.** A página só dá o teto de 100 e diz que cada cron é uma invocação de função, cobrada e limitada como função. O limite que o dono sente pode ser o de invocações e de tempo de função, não o de entradas; a fase respeita os dois | mesma página |
| Jobs de `pg_cron` | 6 versionados em `20260905000001_pg_cron_jobs_versionados.sql`; a migration seguinte (`20260905000002_pg_net_removal.sql`) desagenda os que chamavam rota por HTTP e remove o `pg_net`. **NC:** a lista de hoje em produção (`select jobname, schedule from cron.job`, leitura, a rodar no plano) | **VERIFICADO** nos arquivos; produção NC |
| Disparos por dia do cron de concorrentes | 72 (`*/20 * * * *`), com `maxDuration` de 300 s e o lote com orçamento de 200 s | **VERIFICADO** (`apps/web/vercel.json`; `sync-youtube/route.ts:16` e `:136`) |

**Resultado: a fase A5 acrescenta zero entradas de cron** (a v2.1 acrescentava uma). Não cria job de `pg_cron`.

#### 4.8.2 O desenho: uma entrada, uma tabela de tarefas, o estado no banco

A entrada `sync-youtube?mode=competitors` já dispara de 20 em 20 minutos. Ela passa a ser um **despachante**: a cada disparo percorre uma tabela fixa de tarefas (no código, `lib/agenda.ts`, uma linha por tarefa) e roda as que estão **devidas**.

**"Devida" é decidido pelo estado gravado, não pelo minuto do relógio.** Cada tarefa tem um período (hora, dia, semana, faixa de 6 horas) e uma chave do período corrente (por exemplo `2026-10-12T21` para a hora). A tarefa está devida quando **não existe linha `ok` para a chave corrente** em `competitor_agenda_runs` (MG10). Consequências, que são o motivo do desenho: um disparo pulado pela Vercel não perde a tarefa, porque o disparo seguinte a encontra devida; e os dois disparos extras de cada hora (minutos 20 e 40) funcionam como **nova tentativa** da leitura horária, que na v2.1 não tinha nenhuma.

| Ordem | Tarefa | Período | Orçamento proposto | O que faz | Chave em `cron_health` e atraso que vira falha |
|---|---|---|---|---|---|
| 1 | `leitura_horaria` | hora | 25 s | amostragem dos contadores (E15) e a curva das primeiras 72 horas (uma leitura só serve às duas) | `sync-youtube-hourly`, 2 h |
| 2 | `anular_identidade` | dia | 10 s | `competitor_comment_identity_purge()` (4.6.6); vem antes dos comentários porque a coleta se recusa a rodar com identidade vencida | `competitor-comment-identity`, 36 h |
| 3 | `sincronizar_canais` | faixa de 6 horas (a de hoje: 00, 06, 12 e 18 de São Paulo) | 150 s (hoje 200 s) | o lote que já existe: descoberta de vídeo novo, série diária, mudanças de campo (E1 e E2) | `sync-youtube-competitors`, como hoje |
| 4 | `retratos_comentarios` | dia, a partir das 12:00 de São Paulo | 40 s e `commentsCallsMax` | retratos dos marcos 1, 7 e 30 e a consulta de inscritos do autor de destaque (E14) | `competitor-comments`, 36 h |
| 5 | `soma_do_mapa` | dia | 10 s | `competitor_hour_fold` do dia fechado (E15) | `competitor-hour-fold`, 36 h |
| 6 | `serie_semanal` | semana | 30 s | passada semanal do catálogo (E2) | `competitor-weekly`, 8 dias |

- **A ordem é fixa e a leitura horária é sempre a primeira,** porque a regra de intervalo limpo de 4.7.6 exige começo a até 5 minutos da hora cheia. Uma leitura feita no disparo dos minutos 20 ou 40 é gravada, mas o intervalo dela **não é limpo** (item 132) e entra em `long_intervals`: melhor um buraco medido que um buraco.
- **Os orçamentos somam 265 s, abaixo do prazo geral de 270 s e dos 300 s da função.** *(v2.3: 5 s em 270 não é folga; a E12 mostrou uma folga de 66 s virar 6. Vale o bloco "v2.3" no fim desta seção.)* São proposta: o plano mede com 75 canais simulados e refaz a soma (como manda a regra do orçamento acoplado do projeto). As tarefas não coincidem em todo disparo: a horária roda em 24 dos 72 disparos do dia; as diárias, em um; a semanal, em um por semana, e só num disparo em que `sincronizar_canais` não tem nada devido.
- **Entra tarefa nova depois: uma linha na tabela, nunca uma entrada no `vercel.json`.** Vale para o TikTok e para a fase de manutenção.

**v2.3: janelas, peso e a regra de uma tarefa pesada por disparo** (achados I-5 de dados, I9 de software e M-2). Onde a tabela acima divergir desta, vale esta.

| Ordem | Tarefa | Peso | Fica devida (São Paulo) | Orçamento proposto | Tolerância no vigia (4.8.5) |
|---|---|---|---|---|---|
| 1 | `leitura_horaria` | sempre roda | toda hora, no minuto 0; novas tentativas aos 20 e 40 | 25 s | 2 h |
| 2 | `anular_identidade` | leve | a partir das 03:00 | 10 s | 36 h |
| 3 | `soma_do_mapa` | leve | a partir das 04:00 (o dia anterior fechou há 4 horas) | 10 s | 36 h |
| 4 | `tamanho_do_banco` (o sinal da E10, 9.2; antes era "gravado pelo cron diário", sem nome) | leve | a partir das 05:00 | 5 s | 36 h |
| 5 | `podas` (linhas da agenda com mais de 90 dias; registro de dias somados com mais de 60 **(v2.3, 2ª passada, N-1 de dados: só de vídeo e dia cujas leituras cruas já foram apagadas; com o interruptor desligado, nenhuma linha: 4.7.4)**; leitura crua, só com o interruptor de 4.7.3) | leve | a partir das 05:00 | 5 s | 8 dias |
| 6 | `sincronizar_canais` | **pesada** | nas faixas de 00, 06, 12 e 18 | 150 s | como hoje |
| 7 | `retratos_comentarios` | **pesada** | a partir das 13:00 (era 12:00) | 40 s e `commentsCallsMax` | 36 h |
| 8 | `serie_semanal` | **pesada** | em qualquer disparo fora das horas 00, 06, 12, 13 e 18 | 30 s | 8 dias |

- **A regra dura:** cada disparo roda, nesta ordem, `leitura_horaria` (se devida), **todas** as leves devidas e **no máximo uma** pesada: a devida há mais tempo; em empate, a ordem da tabela. A pesada que ficou para o disparo seguinte grava `adiada` com o motivo `uma_pesada_por_disparo`. **v2.3, 2ª passada (N5 de software): a escolha da pesada.** "A devida há mais tempo" deixava uma pesada em `erro` desde cedo ganhar de toda pesada mais nova até bater o teto. Regra: entre as pesadas devidas, vêm primeiro as que **não** terminaram a última execução sem progresso (a devida há mais tempo na frente; em empate, a ordem da tabela); as que terminaram a última execução em `erro`, ou em `parcial` com `done_n = 0`, vão para o **fim** da fila das pesadas, entre si pela execução mais antiga. Uma pesada quebrada só roda no disparo em que nenhuma pesada sã está devida. Item 251.
- **A conta do pior disparo, por construção:** 25 + 10 + 10 + 5 + 5 + 150 = **205 s de 270 (24% de folga)**, qualquer que seja o atraso acumulado. Vale também para o **primeiro disparo depois do deploy**, quando a tabela da agenda está vazia e tudo está devido de uma vez: ele roda a horária, as leves e uma pesada; as outras duas pesadas entram nos dois disparos seguintes. A faixa de 6 horas que o código antigo já tinha sincronizado roda de novo uma vez (idempotente, cerca de 45 unidades de cota): aceito e anotado no ledger do deploy.
- **Quem cede primeiro:** `serie_semanal` (tolerância de 8 dias), depois `retratos_comentarios` (o marco tem tolerância de dias, 4.6.4). **Nunca cedem:** `leitura_horaria` (a hora perdida não volta) e `anular_identidade` (prazo de dado pessoal).
- **`sincronizar_canais` só grava `ok` quando o lote terminou de verdade.** O lote já tem a própria noção de "devido" (`isDue`, `competitor-sync-batch.ts:25`): a linha da faixa é `ok` só com `remainingDue = 0`; com sobra, é `parcial` com `left_n = remainingDue`, e a tarefa volta no disparo seguinte.
- **Os orçamentos continuam sendo proposta, e só são fixados depois de medidos:** a duração real de `sincronizar_canais` hoje (lida do que o cron já grava: conferência C0.5) e o tempo de cada tarefa com 75 canais simulados. O orçamento de `sincronizar_canais` cai de 200 s para 150 s sem medição nenhuma por trás: se a medição disser que 150 s não bastam para 15 canais, o plano refaz a tabela antes de escrever código.
- **Interruptores (seção 14):** `OBS_AGENDA_TASKS_OFF` (lista de tarefas desligadas, separadas por vírgula; ausente = todas ligadas; `anular_identidade` é ignorada na lista e nunca desliga) e `OBS_AGENDA=off` (a rota volta a rodar só o lote antigo, que fica no código até a E16 ter 14 dias limpos em produção). **v2.3, 2ª passada (N4 de software): `OBS_AGENDA=off` não desliga `anular_identidade`.** O lote antigo não tem essa tarefa; com a agenda desligada, identidade de terceiros passaria dos 28 dias (decisão 20) sem ninguém acusar. Regra: com `OBS_AGENDA=off` a rota roda, **antes** do lote antigo, `competitor_comment_identity_purge()`, devida pelo mesmo estado (sem linha `ok` do dia para `anular_identidade` em `competitor_agenda_runs`) e tomada pela mesma `competitor_agenda_claim`, gravando a linha como sempre. O vigia (4.8.5) continua cobrando **essa** tarefa, com a tolerância de 36 h; as outras aparecem como "desligada (agenda off)", nunca como "em dia". Vale a partir da E14 (antes dela a tarefa não está no catálogo e não há identidade guardada). Item 215 (emendado).

#### 4.8.3 Orçamento de tempo e o que acontece quando uma parte estoura

1. **Cada tarefa recebe o próprio prazo** (o menor entre o orçamento dela e o que falta para o prazo geral de 270 s) e o confere **entre unidades de trabalho** (um canal, um vídeo, um lote de 50 ids); toda chamada HTTP leva `AbortSignal.timeout`, para que uma chamada pendurada não coma o orçamento das outras.
2. **Tarefa que estoura para na unidade seguinte** e grava a linha do período como `parcial`, com quantas unidades fez e **quantas ficaram** (`left_n`). Ela continua devida; o próximo disparo, 20 minutos depois, retoma do que ficou (cada tarefa já é idempotente por chave: `(video_id, hour_slot)`, `(video_id, mark)`, o cursor por `last_synced_at`). **v2.3 (achado I4 da revisão de software):** "retoma" passa pela **tomada atômica** de 4.8.4 (uma instrução; dois disparos nunca retomam a mesma linha) e tem **teto de tentativas por período**: hora, 3; faixa de 6 horas, 9; dia, 12; semana, 24. Sem teto, uma tarefa diária em `erro` seria tentada a cada 20 minutos, 72 vezes no dia. Batido o teto, a linha vira `esgotada`: é falha visível (retorno `error`, vigia), e a tarefa só volta no período seguinte. **v2.3, 2ª passada (N5 de software): retomada com progresso não gasta tentativa.** `parcial` é o modo normal de `sincronizar_canais` com muitos canais e de `serie_semanal`; contada como falha, a tarefa viraria `esgotada` sem ter falhado. Regra: a retomada de uma linha `parcial` com `done_n > 0` (unidades feitas **na última execução**) **não soma** em `attempts`; somam a retomada de `erro`, de `parcial` com `done_n = 0` e de `rodando` vencida (DDL de 4.8.6). O número de retomadas com progresso é limitado pelo número de disparos do período (3 na hora, 18 na faixa de 6 horas, 72 no dia, 504 na semana): não há laço sem fim. Item 251.
3. **As outras não se perdem.** Cada tarefa roda dentro do próprio `try/catch`; erro ou estouro de uma não impede as seguintes. A única dependência declarada é a dos comentários com a anulação de identidade (4.6.6, ponto 6), que é de propósito.
4. **Tarefa que nem começou por falta de tempo** grava `adiada`, com o motivo `sem_tempo`, e sobe na frente no disparo seguinte **dentro da ordem de prioridade** (a leitura horária nunca cede o primeiro lugar).
5. **Sobra passa adiante:** o tempo que uma tarefa não usou fica para as seguintes, até o prazo geral.
6. **A função morta pela plataforma aos 300 s** não roda o `finally`. Linha `rodando` com mais de 10 minutos é lida como `interrompida` e a tarefa volta a estar devida. **NC, a conferir no plano:** se `cron_try_lock` expira sozinha ou depende do `cron_unlock` do `finally`; se depender, a trava ganha prazo de validade na MG10. **v2.3: respondido pelo código, pelos dois revisores.** `cron_try_lock` é `pg_try_advisory_lock` (`20260507000001_schema.sql:4084-4087`): trava de **sessão**, chamada por RPC numa conexão de pool; não expira por tempo, e uma função morta sem `finally` a deixa presa à conexão. Com seis tarefas atrás dela, trava presa responde `locked` com HTTP 200 e a agenda inteira para, inclusive a anulação de identidade. **A agenda deixa de usar essa trava** (4.8.4). O comportamento do pool em produção não foi medido; o desenho novo não depende dele.

#### 4.8.4 Trava e duplicidade

- **A trava é a do banco.** A rota importa `withCronLock` de `apps/web/lib/logger.ts` (`sync-youtube/route.ts:6`, **VERIFICADO**), que chama `cron_try_lock`; não é a de `apps/web/src/lib/logger.ts`, que é em memória e não vale entre instâncias. Uma trava só, a da entrada (`sync-youtube-competitors`): com um despachante não há duas tarefas da agenda rodando ao mesmo tempo.
- **Achado: essa trava falha aberta.** Se a chamada a `cron_try_lock` der erro, o código segue como se tivesse a trava (`apps/web/lib/logger.ts:129-136`, de propósito, para ambiente sem a migration). Por isso **a trava não é a garantia contra duplicidade; as chaves são:** `unique (task, period_key)` na tabela da agenda com tomada da tarefa por `insert ... on conflict do nothing` (quem não inseriu não roda), mais as chaves de cada tabela de dado. O item de aceite 153 prova com duas execuções simultâneas **e a trava desligada**.
- **v2.3 (achados I-4 de dados e I4 de software): arrendamento com validade e tomada atômica; a trava de sessão sai.** (i) **O despachante** toma um arrendamento em tabela (`competitor_agenda_lease`, 4.8.6) com validade de 290 s: quem não toma responde "já rodando" e sai; função morta pela plataforma libera sozinha quando a validade vence; o `finally` apaga o arrendamento de quem o tem. O modo `competitors` **não chama mais `withCronLock` nem `cron_try_lock`** (os outros modos da rota não mudam). (ii) **Cada tarefa** é tomada pela função `competitor_agenda_claim` (4.8.6), uma instrução só, que serve para os dois casos: a primeira vez no período (insere `rodando`) e a **retomada** (linha em `parcial`, `adiada`, `erro`, ou `rodando` há mais de 10 minutos). O `insert … on conflict do nothing` da v2.2 só cobria a primeira vez: quem retomava não inseria, e dois disparos podiam retomar a mesma `parcial` e gastar cota em dobro. (iii) Se o arrendamento falhar aberto (erro ao tomá-lo), a tomada atômica continua sendo a garantia: é ela que o item 153 prova.

#### 4.8.5 Atraso visível (nunca verde por falta)

- **O retorno do cron** lista, por tarefa: estado (`ok`, `parcial`, `adiada`, `erro`, `nao_devida`), duração, unidades feitas e deixadas. O estado geral é `error` se qualquer tarefa devida terminou em `erro`, ou em `parcial` ou `adiada` pela terceira vez seguida.
- **Uma chave de `cron_health` por tarefa** (tabela acima), com entrada em `resolveCronName` da rota de saúde e o limite de atraso de cada uma. A agenda inteira parada aparece como todas as chaves vencidas, e não só uma. **v2.3 (achado I3 da revisão de software): do jeito que estava escrito, o vigia não veria nenhuma dessas chaves.** O relatório de saúde parte das entradas do `vercel.json`, uma chave por entrada, e calcula o atraso pela expressão de cron (`lib/ops/cron-health-report.ts:42-63`); as chaves por tarefa não têm entrada lá, por desenho da E16. A anulação de identidade poderia parar e ninguém acusaria: falha em verde. **A E16 inclui no escopo uma segunda fonte para o relatório de saúde:** o catálogo de `lib/agenda.ts`, que exporta, por tarefa, a chave, o período e a tolerância da tabela de 4.8.2. Para cada tarefa do catálogo o relatório procura a última linha `ok` em `competitor_agenda_runs`; **linha ausente ou mais velha que a tolerância é falha**, com o nome da tarefa. Tarefa desligada por `OBS_AGENDA_TASKS_OFF` aparece como "desligada", nunca como "em dia". Item 211. **v2.3, 2ª passada (N9 de software): qual das duas vale.** Vale a segunda fonte: **não existe chave de `cron_health` por tarefa, nem entrada em `resolveCronName` por tarefa.** A entrada do `vercel.json` (`sync-youtube-competitors`) segue com a chave única que já tem, e diz só "o despachante rodou"; o estado de cada tarefa vem de `competitor_agenda_runs`, pelo catálogo. Onde a coluna "Chave em `cron_health`" da primeira tabela de 4.8.2, o começo deste bullet e os itens 142, 154 e 156 falam em chave de `cron_health` da tarefa, leia-se "a tarefa, pelo nome do catálogo, no relatório de saúde".
- **Na tela:** para quem edita, o cabeçalho do Observatório mostra a tarefa atrasada com o número: "retratos de comentários: 14 ficaram para trás, última execução completa em dd/mm hh:mm". O mapa de horas continua mostrando a própria cobertura ("lidas 702 de 720 horas").
- **O que acontece quando o dado não existe:** tabela da agenda **vazia** (antes do primeiro disparo, ou apagada) lê como "sem leitura", com teste que apaga as linhas e afirma isso; nunca como "tudo em dia".

#### 4.8.6 DDL proposto (migration MG10)

```sql
create table if not exists public.competitor_agenda_runs (
  task text not null,                       -- catálogo no código (lib/agenda.ts)
  period_key text not null,                 -- '2026-10-12T21' (hora), '2026-10-12' (dia), '2026-W42' (semana), '2026-10-12#18' (faixa)
  status text not null check (status in ('rodando', 'ok', 'parcial', 'adiada', 'erro', 'esgotada')),   -- v2.3: 'esgotada' = bateu o teto de tentativas do período
  attempts smallint not null default 1,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  done_n integer,                           -- v2.3, 2ª passada (N5): unidades feitas NA ÚLTIMA execução (não o acumulado); é o que diz se a retomada teve progresso
  left_n integer,                           -- quantas unidades ficaram para trás; nulo = não se aplica
  reason text,                              -- 'sem_tempo' | mensagem de erro curta, sem dado pessoal
  primary key (task, period_key)
);
create index if not exists idx_car_task_started on public.competitor_agenda_runs (task, started_at desc);
alter table public.competitor_agenda_runs enable row level security;
drop policy if exists "competitor_agenda_runs_select" on public.competitor_agenda_runs;
create policy "competitor_agenda_runs_select" on public.competitor_agenda_runs
  for select using (public.is_member_staff());   -- só estado de execução; nenhuma policy de escrita (service role)

-- v2.3 (achados I-4 de dados e I4 de software): arrendamento com validade no lugar da trava de sessão.
create table if not exists public.competitor_agenda_lease (
  name text primary key,                    -- 'despachante'
  holder uuid not null,                     -- id sorteado por disparo
  expires_at timestamptz not null           -- now() + 290 s: função morta sem finally libera sozinha ao vencer
);
alter table public.competitor_agenda_lease enable row level security;   -- sem policy nenhuma: só service role

create or replace function public.competitor_agenda_lease_take(p_name text, p_holder uuid, p_ttl interval)
returns boolean language sql security invoker set search_path = public as $$
  with t as (
    insert into competitor_agenda_lease (name, holder, expires_at) values (p_name, p_holder, now() + p_ttl)
    on conflict (name) do update set holder = excluded.holder, expires_at = excluded.expires_at
      where competitor_agenda_lease.expires_at < now()
    returning 1)
  select exists (select 1 from t);
$$;

-- Tomada ATÔMICA de uma tarefa: vale para a primeira vez no período e para retomar parcial, adiada, erro e rodando vencida.
-- Devolve true para exatamente um chamador. Quem recebe false não roda.
create or replace function public.competitor_agenda_claim(
  p_task text, p_period_key text, p_max_attempts smallint, p_stale interval default interval '10 minutes'
) returns boolean language sql security invoker set search_path = public as $$
  with t as (
    insert into competitor_agenda_runs (task, period_key, status) values (p_task, p_period_key, 'rodando')
    on conflict (task, period_key) do update
      set status = 'rodando',
          -- v2.3, 2ª passada (N5 de software): retomada de 'parcial' com progresso não gasta tentativa
          attempts = competitor_agenda_runs.attempts
                     + case when competitor_agenda_runs.status = 'parcial' and coalesce(competitor_agenda_runs.done_n, 0) > 0 then 0 else 1 end,
          started_at = now(), finished_at = null
      where (competitor_agenda_runs.status in ('parcial', 'adiada', 'erro')
             or (competitor_agenda_runs.status = 'rodando' and competitor_agenda_runs.started_at < now() - p_stale))
        and competitor_agenda_runs.attempts < p_max_attempts
    returning 1)
  select exists (select 1 from t);
$$;
revoke all on function public.competitor_agenda_lease_take(text, uuid, interval) from public, anon, authenticated;
revoke all on function public.competitor_agenda_claim(text, text, smallint, interval) from public, anon, authenticated;
grant execute on function public.competitor_agenda_lease_take(text, uuid, interval) to service_role;
grant execute on function public.competitor_agenda_claim(text, text, smallint, interval) to service_role;
-- Linha 'adiada' (a tarefa nem começou) é inserida com attempts = 0: adiar não gasta tentativa.
-- Linha que não pode mais ser tomada por ter batido o teto é marcada 'esgotada' pelo despachante, no mesmo disparo.
```

A tabela não tem `site_id` porque a agenda é do sistema, não de um site (o lote já percorre todos). Linhas com mais de 90 dias são apagadas pela própria agenda (as de hora somam 8.760 por ano; o volume é desprezível, menos de 1 MB por ano, e não entra em 9.5).

#### 4.8.7 Sugestão separada: o que poderia ser fundido entre os 49 que já existem (não é desta fase)

Nada abaixo é feito na A5; é a resposta à segunda metade do pedido ("combinar o que pudermos") e precisa de decisão e de plano próprios. A regra para fundir sem risco é a mesma da agenda: estado no banco, orçamento por tarefa, uma chave de saúde por tarefa. **Fundir sem isso troca 49 entradas por menos pontos de falha maiores.**

| Grupo | Entradas hoje | Fundidas | Risco |
|---|---|---|---|
| `ab-watchdog` às 10:00 e às 20:00 | 2 | 1 (`0 10,20 * * *`) | nenhum: é a mesma rota, só a expressão muda |
| Agregações de links de hora em hora (`links-aggregate-metrics`, `linktree-aggregate-metrics`) | 2 | 1 | baixo |
| Limpezas e anonimizações da madrugada (`expire-notifications`, `links-anonymize-clicks`, `anonymize-linktree-events`, `notification-cleanup`, `anonymize-newsletter-tracking`, `ab-draft-cleanup`, `media-cleanup`, `snapshot-cleanup`, `waitlist-retention-sweep`) | 9 | 1 despachante de manutenção diária | baixo a médio: são idempotentes e sem hora crítica, mas cada uma tem hoje `maxDuration` e chave de saúde próprios |
| Purgas semanais de domingo (`purge-webhook-events`, `purge-content-events`) | 2 | entram no despachante acima | baixo |
| Agregações diárias (`aggregate-content-metrics`, `ad-events-aggregate`, `adsense-sync`, `links-health-check`) | 4 | 1 | médio: `adsense-sync` chama API externa |
| Os outros 4 modos de `sync-youtube` (`schedule`, `catchall`, `metrics`, `ab-poll`) | 4 | até 1, na mesma agenda | médio: o `ab-poll` tem janela de postagem e o canal próprio tem relógio apertado (risco 18) |

**Ficam separados, por desenho:** `cron-watchdog` e `uptime-probe` (o vigia não pode cair junto com o vigiado); `lgpd-cleanup-sweep` (deleção irreversível, com válvula própria); `publish-scheduled`, `send-scheduled-newsletters`, `send-welcome-emails`, `social-publish` e `notification-deliver` (o atraso é visto por gente de fora). **Ordem de grandeza: de 49 para cerca de 33 com os quatro primeiros grupos; cerca de 30 com o quinto.** Estimativa, não medição.

## Itens de aceite deste arquivo (blocos da seção 10 do spec, com a numeração original)

**E15: ritmo por hora (emenda v2.1)**
128. **NP-E15:** todo vídeo da lista horária tem leitura em pelo menos 22 das últimas 24 horas: `select count(*) from competitor_videos v where missing_since is null and published_at > now() - interval '13 days' and published_at < now() - interval '1 day' and (select count(*) from competitor_video_hourly h where h.video_id = v.id and h.hour_slot > now() - interval '24 hours') < 22` = 0 (fora os vídeos cortados pelo teto, que a execução lista). **v2.3:** a consulta exclui também vídeo sem contagem (`coalesce(v.views_hidden, false) = false and coalesce(v.live_broadcast_content, 'none') <> 'upcoming'`, achado I-11), e há a consulta gêmea sobre `yt_own_public_video_hourly` para os vídeos públicos do dono. Este item prova a **saúde da leitura** (22 de 24); a fatia do mapa exige 24 (4.7.6, ponto 5): são duas contagens, e a tela mostra as duas.
129. A lista: vídeo com 15 dias não é lido; canal com 40 vídeos em 14 dias tem 25 lidos e a execução registra 15 fora; ao vivo em andamento fica fora; os canais do dono estão na lista (teste da função que monta a lista). **v2.3:** "na lista" de leitura, sim; **em `competitor_channels`, não** (item 216).
130. As chamadas juntam vídeos de canais diferentes: com 57 vídeos de 15 canais a execução faz 2 chamadas, não 15 (teste que conta as chamadas).
131. Duas execuções na mesma hora gravam uma leitura só por vídeo (teste que chama duas vezes).
132. Intervalo limpo × longo: 50 e 70 minutos são limpos, 49 e 71 não; começo a 6 minutos da hora cheia não é limpo; um buraco de 2 horas **não é dividido**: nenhuma casa recebe a diferença, `long_intervals` sobe 1 e `long_likes` recebe o valor (teste com leituras fixas).
133. Contador que diminui: a diferença negativa não entra em nenhuma casa, **não vira zero** (a casa da hora seguinte não a absorve), sobe `neg_*_n` e soma em `neg_*_sum`; a curva de 72 horas guarda o contador como veio; o dia fica fora da fatia daquele contador.
134. A soma é idempotente: `competitor_hour_fold` chamada duas vezes para o mesmo dia deixa os vetores iguais; leitura crua de dia sem registro nunca é apagada (teste que desliga a soma por dois dias: as leituras continuam lá, e a execução devolve quantas esperam). **v2.3, 2ª passada (N-1 de dados):** "duas vezes para o mesmo dia" inclui chamar de novo **depois da poda**: é o teste do item 248.
135. A fatia: para todo mapa medido, a soma de p(h) nas 24 horas é 1 (±0,001); dia com intervalo longo ou abaixo do movimento mínimo não entra; **um vídeo com cem vezes mais curtidas que os outros muda o perfil no peso de um dia de vídeo, não de cem** (teste com dados fixos).
136. Fases: leitura de vídeo com 2 dias vai para "lancamento"; com 5 dias, para "depois"; nenhuma leitura entra nas duas; nenhuma tela soma as duas.
137. Zero × não medido: casa com `n_intervals = 0` lê como "sem leitura nesta hora", casa com intervalos e soma 0 lê como zero medido; com o banco **sem nenhuma linha** das tabelas novas, M13 e M14 devolvem `nao_medido` com motivo e a data de início.
138. M13 e M14: testes de borda (exatamente 28 dias de vídeo e 3 vídeos; 27 e 2 são não medido; exatamente 20% de horas sem leitura); a comparação de duas janelas devolve a razão e as duas bases; M14 exclui vídeo descoberto com mais de 6 horas e diz quantos.
139. Armazenamento: ~~`select count(*) from competitor_video_hourly where hour_slot < now() - interval '4 days'` = 0 em todo dia;~~ **(primeira parte retirada na v2.3, achado C-6: a leitura crua agora fica 60 dias; vale o item 218)** trinta dias depois do deploy, o tamanho das três tabelas novas e de `competitor_video_early` está anotado e comparado com 9.5 (≈ 0,85 MB por canal por ano); diferença acima de 30% corrige 9.5. O item 16 da E2 passa a exigir pelo menos 60 leituras em 72 horas para vídeo descoberto com menos de 24 horas. **v2.3, 2ª passada (N-4 de dados):** a comparação é contra **9.6**, e o tamanho de linha medido (`pg_total_relation_size('competitor_video_hourly') / count(*)`) é anotado ao lado dos 156 B da conta; diferença acima de 30% refaz as duas linhas da leitura crua de 9.6 e o cruzamento de ≈ 21 meses, e a pergunta 36 volta ao dono com o número novo.
140. **A medição que decide o que se mostra, 14 dias depois do deploy,** anotada no ledger: para cada contador, a proporção de intervalos de 1 hora com diferença zero seguidos de salto, por faixa de tamanho de vídeo; de quanto em quanto tempo cada contador de fato anda; e se duas leituras com 5 minutos de distância devolvem o mesmo número (cache). Com ela o dono decide se o mapa de views por hora é mostrado, e se 30 minutos ou 2 horas servem melhor (pergunta 17). **v2.3:** a medição agora é possível para os vídeos de 4 a 14 dias, porque o bruto fica 60 dias (achado C-6); ela mede também **a proporção de dias de vídeo com as 24 horas limpas** (achado I-12) e a duração de cada tarefa da agenda. A data absoluta da medição (deploy + 14 dias) é gravada no commit do deploy, pela regra da seção 10 do `00` (item 246).
141. (reescrito na v2.2) Infra: **nenhuma linha nova em `apps/web/vercel.json`** e nenhum job de `pg_cron` (item 150); a leitura horária roda como tarefa `leitura_horaria` da agenda (4.8), sempre a primeira do disparo; a trava da entrada é a do banco (`cron_try_lock`), e a garantia contra duplicidade são as chaves (item 153); chamar a rota **sem** `mode` e com cada modo antigo (`schedule`, `catchall`, `metrics`, `ab-poll`) devolve o mesmo que antes da fase (teste por modo).
142. **Falha em vermelho:** `cron_health` tem a chave `sync-youtube-hourly`; duas horas sem sucesso é falha na rota de saúde; teste que **apaga** a linha e afirma "sem leitura", nunca verde; a tela do mapa mostra "lidas N de M horas" e, com o cron parado em teste, mostra a falta. `youtube_quota_usage.operations` traz o modo `horario`, e a duração da execução com 75 canais simulados está anotada. **v2.3 (achado I3):** "falha na rota de saúde" só é verdade com a segunda fonte do relatório (4.8.5): o teste é o do item 211.
143. RLS das três tabelas com o GUC forjado; `competitor_channel_removal_impact` conta as três; remover um canal zera as três para ele; o mapa foi visto em navegador, com mockup 21 aprovado antes, nos casos cheio, magro e "não medido", a 1440 e 390 px, nos dois temas.

**E16: agenda única (emenda v2.2)**
150. **Zero entradas novas:** `apps/web/vercel.json` tem as mesmas 49 entradas de antes da fase (o `diff` do arquivo na fase inteira é vazio) e `select count(*) from cron.job where command ilike '%competitor%' or command ilike '%agenda%'` = 0.
151. "Devida" pelo estado: com a linha `ok` do período corrente, um segundo disparo não roda a tarefa; **sem** a linha (disparo pulado, simulado), o disparo seguinte roda; teste com relógio falso para hora, dia, faixa e semana.
152. Estouro: uma tarefa com orçamento de 1 s e trabalho de 10 unidades para na unidade seguinte, grava `parcial` com `left_n`, **as tarefas seguintes rodam**, e o disparo seguinte retoma só o que ficou (teste que conta as unidades nos dois disparos; nenhuma é feita duas vezes).
153. Duplicidade **com a trava desligada** (o RPC `cron_try_lock` forçado a dar erro, que é o caminho em que ela falha aberta): dois disparos simultâneos resultam em uma linha por tarefa e período e em uma execução de cada. **v2.3 (achado I4):** o item só provava a **primeira** tomada. Passa a cobrir também a retomada: dois disparos simultâneos sobre uma linha `parcial` (e sobre uma `rodando` com 11 minutos) resultam em uma retomada só (item 212). A "trava desligada" passa a ser o arrendamento forçado a dar erro.
154. Isolamento: uma tarefa que lança erro grava `erro` com o motivo, as outras rodam, o estado geral do retorno é `error`, e só a chave de `cron_health` daquela tarefa marca falha. **v2.3, 2ª passada (N9 de software):** "a chave de `cron_health` daquela tarefa" lê-se "aquela tarefa, pelo nome, no relatório de saúde" (4.8.5; item 211).
155. Ordem: `leitura_horaria` é sempre a primeira; `anular_identidade` roda antes de `retratos_comentarios`; uma leitura horária feita no disparo do minuto 20 é gravada e contada como intervalo não limpo.
156. **Atraso visível:** a terceira `parcial` ou `adiada` seguida da mesma tarefa torna o retorno `error`; o cabeçalho do Observatório mostra a tarefa e quantas unidades ficaram; teste que **apaga** as linhas da agenda e a linha de `cron_health` e afirma "sem leitura", nunca verde. **v2.3:** a prova de que o vigia enxerga cada tarefa é o item 211.
157. Execução interrompida: linha `rodando` com mais de 10 minutos é lida como interrompida e a tarefa volta a estar devida; ~~o comportamento de `cron_try_lock` depois de uma função morta sem `finally` está conferido e anotado (expira sozinha, ou a MG10 lhe deu validade).~~ **Corrigido na v2.3:** a pergunta foi respondida pelo código (é trava de sessão e não expira), e a agenda não a usa mais; a prova é o item 213.
158. Relógio: a duração de cada tarefa com 75 canais simulados está anotada, a soma dos orçamentos fica abaixo de 270 s, e três disparos reais em produção com todas as tarefas do dia devidas terminaram sem `adiada`. **v2.3:** a soma que vale é a do pior disparo, 205 s (item 215); "sem `adiada`" exclui a `adiada` de motivo `uma_pesada_por_disparo`, que é esperada; os três disparos têm data e responsável gravados no commit do deploy (item 246).

**E16: o que as revisões acrescentaram (v2.3)**
211. **O vigia enxerga cada tarefa (achado I3):** o relatório de saúde lista toda tarefa do catálogo de `lib/agenda.ts`; teste que **apaga** as linhas `ok` de uma tarefa e afirma que o relatório a acusa pelo nome, com as outras em dia; tarefa nova acrescentada ao catálogo entra no relatório sem tocar em `vercel.json` nem em `resolveCronName` (teste que percorre o catálogo, não uma lista escrita à mão); tarefa em `OBS_AGENDA_TASKS_OFF` aparece como "desligada".
212. **Retomada atômica e teto (achado I4):** `competitor_agenda_claim` chamada por dois clientes ao mesmo tempo, com banco local, devolve `true` para exatamente um, nos quatro casos (linha inexistente, `parcial`, `erro`, `rodando` há 11 minutos) e `false` para os dois quando a linha é `ok` ou `rodando` há 1 minuto; uma tarefa de período "hora" que falha sempre é tentada 3 vezes, vira `esgotada`, e o retorno e o vigia a mostram; `adiada` não gasta tentativa. **v2.3, 2ª passada (N5 de software):** "falha sempre" quer dizer terminar em `erro` ou em `parcial` com `done_n = 0`; retomada com progresso não conta (item 251).
213. **Arrendamento com validade (achado I-4):** com o arrendamento tomado e nunca liberado (processo morto, simulado), o disparo feito 291 s depois o toma; antes disso, responde "já rodando". `grep` por `cron_try_lock` e por `withCronLock` no caminho do modo `competitors` = 0.
214. **Arranque e fim de lote (achados M-2 e I9):** com `competitor_agenda_runs` vazia e todas as tarefas devidas, o primeiro disparo roda a horária, as leves e **uma** pesada, e as outras duas gravam `adiada` com `uma_pesada_por_disparo`; `sincronizar_canais` com `remainingDue > 0` grava `parcial` com `left_n`, nunca `ok`.
215. **Orçamento (achados I-5 e I9):** teste com todas as tarefas devidas e cada uma gastando o orçamento inteiro: o disparo termina em até 205 s simulados e nunca roda duas pesadas; `OBS_AGENDA_TASKS_OFF` ausente = todas ligadas (teste que **apaga** a variável); com `anular_identidade` na lista, ela roda mesmo assim; com `OBS_AGENDA=off`, a rota devolve o mesmo que antes da fase. A duração medida de `sincronizar_canais` em produção está anotada **antes** de os orçamentos serem fixados no código. **v2.3, 2ª passada (N4 de software):** "o mesmo que antes da fase" vale para o lote. Além dele: com identidade de 29 dias na semente e `OBS_AGENDA=off`, o disparo anula a identidade e grava a linha `ok` de `anular_identidade`; apagando essa linha e avançando o relógio 37 horas, com a agenda ainda desligada, o relatório de saúde acusa `anular_identidade` pelo nome, e as outras tarefas aparecem como "desligada", não "em dia".

**E15: o que as revisões acrescentaram (v2.3)**
216. **O canal do dono fica fora de `competitor_*` (achados C-5 e I2):** `select count(*) from competitor_channels c join youtube_channels y on y.youtube_channel_id = c.youtube_channel_id` = 0, no dia do deploy e na prova diária (os nomes das colunas são conferidos no plano); a Lista de Canais, as medianas de nicho, `competitors/channels` e o pacote da forja são iguais antes e depois da E15 (o item 53 continua valendo); as leituras dos vídeos do dono estão em `yt_own_public_video_hourly`.
217. Vídeo próprio **não público** (não listado, privado, ou sem captura que diga) não entra na lista horária e a execução conta quantos ficaram fora (teste da função que monta a lista).
218. **A leitura crua é guardada (achado C-6):** com `OBS_HOURLY_RAW_PURGE` ausente, nenhuma linha de `competitor_video_hourly` nem de `yt_own_public_video_hourly` é apagada, com qualquer idade (teste que **apaga** a variável e avança o relógio 90 dias); com ela ligada, só sai leitura com mais de 60 dias de dia já somado. A partir do dia 60, `select min(hour_slot) from competitor_video_hourly` é anterior a `now() - interval '59 days'`.
219. **A soma pode ser refeita:** `competitor_hour_refold` de um mês com todas as leituras presentes reproduz o mapa vetor a vetor quando a regra não mudou; com a regra mudada, grava a `rule_version` nova; com leitura faltando no mês, recusa e diz desde que dia falta. As quatro tabelas `yt_own_public_*` têm RLS provada com o GUC forjado, e `yt_own_public_hour_map` tem as mesmas colunas de `competitor_channel_hour_map` (teste que compara `information_schema.columns`).
220. **Antes de construir (risco 40):** o atraso do disparo da Vercel na hora cheia foi medido por 7 dias com os horários que o cron de 20 minutos já grava (mediana e percentil 95; conferência C0.5). Se o percentil 95 passar de 5 minutos, o limiar de "intervalo limpo" de 4.7.6 é revisto **antes** do código, e a decisão fica no ledger.

**E15 e E16: segunda passada dos revisores (v2.3, 2ª passada)**
248. **O registro de soma vive tanto quanto o bruto (N-1 de dados, crítico):** com `OBS_HOURLY_RAW_PURGE` **ausente**, leituras de um vídeo no dia D somadas no mapa, e o relógio avançado para D + 61 e depois D + 90, rodando `podas` e a execução horária a cada passo: a linha de (vídeo, D) continua em `competitor_hour_fold_log`, **os vetores do mapa do mês são idênticos** aos de antes (comparação vetor a vetor) e `competitor_hour_fold(D)` chamada à mão não muda nada. Com o interruptor **ligado**: em D + 61 as leituras de D e a linha do registro de D saem na mesma transação, e a soma seguinte não muda o mapa; forçando erro entre os dois apagamentos, nada é apagado. O mesmo teste roda sobre `yt_own_public_hour_fold_log` e `yt_own_public_video_hourly`. Em produção, prova diária a partir do dia 61: `select count(*) from competitor_video_hourly h where h.hour_slot < now() - interval '4 days' and not exists (select 1 from competitor_hour_fold_log f where f.video_id = h.video_id and f.day = (h.hour_slot at time zone 'America/Sao_Paulo')::date)` = 0 (leitura com mais de 4 dias sem linha no registro é soma parada, ou registro podado antes do bruto); e `select count(*) from competitor_hour_fold_log where day < current_date - 60` é maior que zero enquanto o interruptor estiver desligado (zero ali, com bruto antigo no banco, é o defeito de volta).
251. **Teto e vaga da pesada (N5 de software):** (a) `sincronizar_canais` que termina cinco disparos seguidos em `parcial` com `done_n > 0` continua com `attempts = 1`, é tomada no sexto e não vira `esgotada` (teste de `competitor_agenda_claim` em banco local); a mesma tarefa terminando em `parcial` com `done_n = 0`, ou em `erro`, soma 1 por retomada e vira `esgotada` no teto do período (9 na faixa de 6 horas); `rodando` vencida soma 1. (b) Com `serie_semanal` em `erro` desde o primeiro disparo do dia, e `sincronizar_canais` e `retratos_comentarios` devidas depois, cada disparo escolhe uma das duas sãs, nunca a quebrada; a quebrada roda no primeiro disparo sem pesada sã devida (teste do despachante com relógio falso). (c) Uma tarefa que sempre progride e nunca termina é retomada no máximo uma vez por disparo do período (3, 18, 72 ou 504), e a terceira `parcial` seguida continua tornando o retorno `error` (item 156).
