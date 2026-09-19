# Fase 2 — a forja drena a fila de inteligência do YouTube

**Data:** 2026-09-19 · **Versão:** v9 (rodadas 1–8; escopo 2a) — a v8 com os patches da rodada 8 (12 lentes, conferidos no código, no kit e no banco) aplicados
**Estado:** desenho aprovado em conversa (3 seções); spec escrito em revisão
**Fase 1 (feita):** `~/Workspace/forja/SPEC-forja-le-site.md` — a forja lê o site só leitura, em produção desde 18/09.
Caminhos do site são relativos a `apps/web/`.

## 1. Problema, dado real e objetivo

A fila `youtube_intelligence_tasks` recebe pedidos, mas **ninguém consome**. Os pedidos vêm do cron `0 8 * * 1` UTC (segunda, 05:00 BRT; `vercel.json:27`) e do botão "Solicitar Nova Análise" do Health Coach.

Medido em produção em 18/09:

| Canal | Vídeos no banco | Tarefas | Análises gravadas |
|---|---|---|---|
| PT `969fcf1b…` (tnFigueiredo) | 35 (o último é de 10/12/2024) | completed:3 · stale:9 | 1 canal + 10 vídeos, Cowork, 2026-05-18 13:34Z |
| EN `117b666d…` (Thiago Figueiredo) | **0** | stale:2 | nenhuma |

- **Ninguém clama desde 18/05.** As 4 tarefas de 18/05 foram clamadas pelo Cowork: 3 PT `completed` e 1 EN liberada pelo watchdog (`stale`, `error_message` 'auto-released: running past 30min', a prova de que o watchdog do §9 funciona). As 10 criadas desde 23/05 têm `started_at` nulo.
  - O `expire-notifications` das 03:00 UTC marca `stale` todo `pending` com mais de 7 dias (`app/api/cron/expire-notifications/route.ts:25-31`).
  - O cron de segunda pula canal que já tem tarefa ativa. Por isso só nasce tarefa nova a cada **duas** segundas.
- **O dado recente é um total móvel de 90 dias.**
  - O sync diário grava, por vídeo, o total dos últimos 90 dias com `date = hoje` (`app/api/cron/sync-analytics-metrics/route.ts:18,68-84,148-157`). Cada linha de `youtube_video_analytics` é esse total, não uma contagem do dia.
  - Há linhas de 06/09 a 18/09.
  - Na linha de 18/09: Σ `recent.views` = 29, com máximo de 6 por vídeo e mediana 0 (21 dos 35 vídeos com 0). Zero inscritos em todos os vídeos. Views na vida inteira: 6.847 (valores de `view_count` congelados na importação de 06/05; reavivados na 2b, §7).
- **O que a 2a entrega hoje.** No PT, com o snapshot real, a forja grava **só a análise do canal**: um `coaching.summary` redigido pelo 12B sobre o estado do canal e os padrões de série, `coaching.priorities: []`, e em `channel_insights` **1 padrão de série** (código) e o `analysis_text` (template). O EN fica fora da fila (§5).
- **O que saiu para a 2b (§7).** Recomendações por vídeo e prioridades `reach`/`growth`. Com o tráfego de 18/09 as regras desenhadas na v6 dariam 0 recomendações (nenhum vídeo tem ≥ 30 views em 90 dias) e 0 prioridades (também depois de 02/12), e nenhuma tela lê as recomendações por vídeo.
- **Onde está o valor desta fase:** pôr o circuito de pé, com fonte, validação e rollback. A análise ganha corpo na 2b, quando o canal voltar a publicar, e quando houver CTR/retenção (§8).
- **O "3" da aba Health Coach** conta os 3 cards do Cowork: as 6 priorities da linha de 18/05, cortadas por `.slice(0, 3)` (`yt-analytics-tabs.tsx:384`). Não conta a fila.

**Objetivo.** A forja (Gemma 12B local, `/opt/agente`) drena a fila. Ela grava análises com `source='forja'` ao lado das do Cowork, e o Health Coach mostra a mais recente, com selo da fonte. **Papel (decisão do dono):** a forja substitui o Cowork *eventualmente*; nesta fase, **convive**. **Escopo (decisão do dono, 19/09):** fase 2 enxuta agora (**2a**, este spec), completa depois (**2b**, §7).

## 2. Decisões

1. **Abordagem A: o código calcula, o 12B redige.**
   - Todo número e toda decisão vêm de código determinístico: os padrões (`pattern_id`, `finding`, `confidence`, `sample_size`), `coaching.priorities` (sempre `[]` na 2a) e `analysis_text`.
   - O modelo só redige `coaching.summary`, com `response_format: json_schema`.
   - Texto que reprova duas vezes vira **template do código** (§4.5).
   - Medido: o llama b10142 respeita o schema a ~39 tok/s.
2. **Quando.** Crontab do `thiago` a cada 10 min. Só faz claim com os 2 slots do llama livres e sem turno de chat nos últimos 5 min.
3. **Convivência.** A análise da forja nunca sobrescreve a do Cowork: os índices únicos de `youtube_intelligence` já são por `source` (`20260517000003…sql:205-210`).
4. **A fonte vem só da chave.** O corpo não tem `source`.
   - Chave sem `write`/`admin` grava `forja`.
   - Chave com `write`/`admin`, ou sessão, grava `cowork`.
5. **Chave separada, estreita na escrita.** `forja (fila)` = `{read, intelligence}`, criada e revogada **pelo dono**.
   - `forja (so leitura)` continua `{read}` e é a do chat.
   - A leitura não é restringida por permissão (`authenticateRead` só autentica). O alcance de escrita está no §9.
6. **O texto da forja não alimenta o Cowork.** O array `intelligence` do snapshot traz só `cowork` para qualquer chave, sessão ou resource MCP (§3.5). Texto escrito por uma chave estreita nunca vira entrada de um agente com escrita ampla.
7. **A chave de escrita fica fora do ambiente do chat.**
   - Ela mora num arquivo que nenhuma unit carrega (§4.6), então não aparece em env, argv nem no journal do proxy.
   - Não há fronteira de UID: o `proxy-agente` roda como `thiago`, dono do arquivo.
   - Risco aceito: o proxy não tem ferramenta que leia arquivo arbitrário. Isolar exigiria usuário próprio, e fica fora desta fase.
8. **Dono da task.** `claimNextTask` grava `result_summary.claimed_by = ctx.keyId` em todo caminho de claim, e o fechamento preserva esse campo.
   - Uma chave **sem** `write`/`admin` só fecha, por PATCH ou `fail`, a task que ela mesma clamou.
   - Chave com `write`/`admin` fecha qualquer task `running` do site.

## 3. Site — um commit (card F0)

### 3.1 Permissão `intelligence`

**REST**
- `Permission` (`lib/pipeline/services/types.ts:3`) e `requirePermission` (`lib/pipeline/auth.ts:99-102`) ganham `'intelligence'`, aceito por `intelligence | write | admin`.
- `authenticateIntel(req, {apiKeyOnly})` em `lib/pipeline/helpers.ts`, no formato de `authenticateWrite`. Com `apiKeyOnly`, sessão recebe 403 `FORBIDDEN`.

**MCP**
- `mcpRequirePermission` (`lib/pipeline/mcp/auth.ts:84-87`) não muda: no MCP, a fila continua exigindo `write`.
- Em `mcp/services/ab-tests.ts`:
  - `claim_task` (`:155-158`) entra em `WRITE_ACTIONS` (`:35`), ao lado de `submit_intelligence`: no MCP as duas passam a exigir `write` (`submit_intelligence` já exige, `ab-tests.ts:35-40`; `claim_task` ganha a guarda), e `upsert_variants`/`delete_variant` não mudam. A chave `{read,intelligence}` só clama e grava pelo REST, cujo claim exige `channel_ids`;
  - `buildCtx()` (`:19-27`) passa a carregar `keyId: mcp.keyId`, como `mcp/services/items.ts:28`;
  - hoje `claim_task` não tem guarda.

**Efeitos**
- Nenhuma outra rota muda. Uma chave `{read, intelligence}` recebe 403 em toda escrita REST fora da fila e no GET legado de claim (§3.2), e FORBIDDEN em toda tool MCP de escrita.
- Pré-verificado (só leitura): a chave ativa do Cowork, `cowork-permanent`, tem `{read,write,admin}`.

### 3.2 Claim

**`claimNextTask(ctx, channelIds?)`** perde `statusFilter` e é o **único** lugar do CAS.
- `pending→running`, com `site_id` no próprio UPDATE.
- Grava `started_at` e `result_summary = {claimed_by: ctx.keyId}`.
- Vale para o POST novo, o GET legado e o `claim_task` do MCP.

**Novo** `POST /api/pipeline/youtube/intelligence/task/claim`
- Autenticação: `authenticateIntel({apiKeyOnly:true})`. Sessão não tem worker e deixaria a task órfã.
- Corpo obrigatório `{channel_ids: uuid[]}` (Zod, 1–10, por `parseBody(req, schema)`) filtra o `pending` elegível. Sem corpo → 400 `VALIDATION_ERROR`.
- Respostas:
  - 200 com a task **devolvida pelo `.select('id, site_id, channel_id, trigger_type, requested_at, started_at')` do próprio UPDATE do CAS** (lista fechada, nunca `*`: `error_message` e `result_summary` podem trazer texto de uma chave estreita e não chegam a quem clama), inclusive o `started_at` gravado (relógio do servidor);
  - 500 `INTERNAL_ERROR` quando o SELECT (`.maybeSingle()`) ou o UPDATE devolvem `error`. Erro de banco nunca vira 204 (hoje vira, `youtube.ts:462-484`);
  - 204, com `buildRateLimitHeaders(auth)`, quando a fila está vazia **ou** o CAS foi perdido para outro consumidor ou para o `stale` das 03:00. A forja tenta no ciclo seguinte.
- `export const dynamic = 'force-dynamic'`, como as rotas irmãs.

**`GET …/intelligence/task`** (legado do Cowork)
- Passa de `authenticateRead` (`task/route.ts:9`) para `authenticateIntel({apiKeyOnly:true})` seguido de `requirePermission(auth,'write')` (403 `FORBIDDEN` sem `write`/`admin`). É o caminho do Cowork; a chave `{read,intelligence}` clama só pelo POST com `channel_ids`, como no MCP (§3.1).
- **Força** `status='pending'`, o que fecha o `?status=completed` que reabria task concluída.

### 3.3 PATCH `…/intelligence` — REST e MCP pelo mesmo portão, dentro do serviço

**Validação**
- `authenticateIntel` fica na rota, que passa a declarar `export const maxDuration = 60`. Hoje ela só declara `dynamic` (`intelligence/route.ts:7`); sem isso vale o padrão de 300 s do Vercel, e a invariante de tempo do §4.1 perde a garantia.
- `PatchPayloadSchema` hoje não roda em lugar nenhum; só aparece em `z.infer` (`services/youtube.ts:5,70`). O F0 passa a validar **também o payload do Cowork**, pela primeira vez. O teste de regressão com o payload real de maio está em §3.7.
- O `safeParse` roda **dentro de `submitIntelRecommendations`** (`:282`).
- O schema ganha teto no que hoje não tem (`lib/youtube/intelligence-schemas.ts:43-49`): `patterns_detected .max(30)`, `pattern_id .max(80)`, `category .max(40)`, `sample_size .int().min(0)`. Pré-verificação só de leitura: nenhuma linha `cowork` passa disso.
- `err()` e `serviceErrorToResponse` não mudam. Sai o ramo morto `validation_failed` (`intelligence/route.ts:39-45`: nenhum serviço lança `VALIDATION_FAILED`), e o `catch` da rota fica só com `serviceErrorToResponse`. Schema inválido e as quatro recusas `forja` → 400 `VALIDATION_ERROR`, com até 3 problemas na `message` como `<path>: <message>`, unidos por `; ` (as recusas usam os paths `video_recommendations`, `notifications`, `coaching` e `coaching.priorities`). O `PARTIAL_FAILURE` lista os alvos na `message`. A forja decide por `status` e, só no `PARTIAL_FAILURE`, por `code` (§4.6); ninguém lê `details` na 2a.

**Fonte derivada:** `deriveSource(ctx)` = chave sem `write`/`admin` → `'forja'`, senão `'cowork'`.
- As gravações usam essa fonte no lugar do `'cowork'` fixo (`youtube.ts:331,340,381,392`).
- Tudo depois do `safeParse` usa `parsed.data`, nunca o corpo cru. Assim o strip do Zod descarta um `source` no corpo e qualquer chave extra numa recomendação, que hoje vai crua para `recommendations` (`youtube.ts:339`). Há teste, com chave `write` (a fonte `forja` recusa `video_recommendations` não vazio): uma chave extra em `video_recommendations[0]` não aparece na linha gravada.

**Dono (§2.8).** Chave sem `write`/`admin` recebe 409 `TASK_NOT_RUNNING` antes de qualquer escrita quando `result_summary.claimed_by ≠ ctx.keyId`, e também quando `keyId` está ausente.

**Todas as recusas 4xx acontecem antes da primeira escrita, exceto o 409 do CAS de fechamento** (tabela de desfechos). Esse 409 sai quando a task virou `stale`, foi fechada por chave `write` ou foi devolvida à fila e clamada de novo (outro `started_at`) durante as gravações. Nesse caso as linhas da fonte do PATCH já podem ter sido gravadas (num PATCH `forja`, só a de canal `forja`); as da outra fonte, nunca. O 409 quer dizer "a task não é mais sua", não "nada foi gravado". O SELECT da task passa a trazer `result_summary` e `started_at` (hoje só `id, channel_id, status`, `youtube.ts:292`), de onde saem o `claimed_by` da trava de dono e o `started_at` do CAS de fechamento, e troca o `.single()` de hoje (`youtube.ts:295`) por `.maybeSingle()`: com `.single()`, 0 linhas vêm com `error` (PGRST116) e virariam 500 pela regra abaixo. Um `error` nesse SELECT, ou no SELECT de integridade dos vídeos (só o Cowork chega lá), devolve 500 `INTERNAL_ERROR` antes de qualquer escrita, nunca 404 nem 422; 404 só com 0 linhas sem `error`. Há teste com erro de banco em cada SELECT → 500 sem escrita, e teste para cada recusa:
- schema;
- estado e dono da task;
- as quatro recusas da fonte `forja` abaixo;
- o 422 de integridade, `VALIDATION_ERROR` quando o vídeo é de outro canal (`:311-322`; só o Cowork chega lá).

**Fonte `forja` — regras impostas pelo servidor (escopo 2a)**
- Rodam logo depois do `safeParse` e da trava de dono, **antes de qualquer escrita**, sobre `parsed.data`:
  - `notifications` não vazio → 400 `VALIDATION_ERROR`;
  - `video_recommendations` não vazio → 400 `VALIDATION_ERROR`. Ausente ou `[]` passa;
  - `coaching` ausente, ou `coaching.priorities` não vazio → 400 `VALIDATION_ERROR`. Na 2a a linha de canal com `coaching` é o único produto da forja; um PATCH `forja` sem ele não grava nada que o Health Coach leia.
- **Escolha: recusar, não reescrever.** O servidor não zera `priorities` nem descarta recomendações em silêncio: um payload `forja` fora do escopo é bug do worker e tem de aparecer (a forja o trata como `reprovada`, §4.1). É também o mais simples: quatro condições no mesmo ponto, sem ramo de escrita novo. A forja sempre manda `coaching` com `priorities: []` e nunca manda `video_recommendations`.
- Consequência: a forja nunca grava linha de vídeo, então o laço de vídeos (`:306-371`, que inclui a transição `flagged→diagnosed`) nunca roda para ela. A linha de canal usa o update-or-insert por fonte que já existe (`:373-408`), trocando `'cowork'` por `deriveSource(ctx)`: cada PATCH `forja` sobrescreve a linha `forja` do canal e nunca toca a `cowork`, e o índice `(site_id, channel_id, source) where video_id is null` (`20260517000003…sql:208-210`) garante uma só.
- **Sem notificação na 2a.** O PATCH `forja` não notifica ninguém; a análise aparece na linha de summary do Health Coach (§3.6). A notificação de análise pronta fica para depois (§8).

**Fechamento da task** (hoje sem CAS e sem checagem, `youtube.ts:432-441`)
- CAS: `.eq('id').eq('site_id').eq('status','running')`; para chave estreita, também `.eq('result_summary->>claimed_by', keyId)`; sempre `.eq('started_at', <started_at do SELECT da task>)`, que identifica o claim e não só a chave; e `.select('id')`.
- `result_summary` é mesclado: `{...anterior, recommendations, has_coaching, source, closed_by}`, mais `failed_writes: dbErrors.length` no ramo `failed`.
- Desfechos:

| Situação | Estado da task | Resposta |
|---|---|---|
| Sem `dbErrors` | `completed` + `completed_at` | 200 |
| Com `dbErrors` e o CAS para `failed` devolveu 1 linha | `failed` + `failed_at`, **sem** `completed_at` | 500 `PARTIAL_FAILURE` |
| CAS devolveu 0 linhas | inalterado; as linhas gravadas por este PATCH ficam (num PATCH `forja`, só a de canal `forja`, que a próxima execução sobrescreve) | 409 `TASK_NOT_RUNNING` |
| Erro no próprio UPDATE do CAS, em qualquer ramo | segue `running` até o watchdog | 500 `INTERNAL_ERROR` |

- No `PARTIAL_FAILURE`, `error_message` e a `message` do erro listam só os alvos (`video <uuid>: write_failed` ou `channel: write_failed`, este o único alvo possível de um PATCH `forja` na 2a); a mensagem crua vai só para o Sentry. O status inválido `partial_failure` sai.
- `PARTIAL_FAILURE` só existe quando o CAS para `failed` devolveu 1 linha.

**Código `TASK_NOT_RUNNING`** (409): task fora de `running`, de outro dono, ou CAS perdido.
- Entra no `ERROR_MAP` de `lib/pipeline/mcp/errors.ts` com `retryable:false` e `recovery_action` "The task is no longer held by this session (closed, stale or owned by another key). Do not resend; claim another task.", em inglês como as demais do `ERROR_MAP` (`mcp/errors.ts:45-60`).
- `VERSION_CONFLICT` (`:47`, `retryable:true`) fica para os itens.
- A forja olha o status 409, não o código.

**Efeito no botão.** `requestIntelligenceAnalysis` (`app/cms/(authed)/youtube/analytics/actions.ts:201-213`) olha só a task **manual** mais recente, por `requested_at`. O cooldown de 24 h, hoje inerte, passa a valer quando essa task é concluída. Uma task `cron` concluída não o dispara, e uma manual `failed`/`stale` mais recente o anula.

### 3.4 Falha explícita

**Novo** `POST /api/pipeline/youtube/intelligence/task/:id/fail`, com `authenticateIntel({apiKeyOnly:true})`.
- Arquivo `task/[id]/fail/route.ts`, com `params: Promise<{id: string}>` e `dynamic = 'force-dynamic'`.
- Autentica **antes** de procurar a task. uuid inválido → 400.
- Corpo `{reason: string ≤ 500, retry?: boolean}` (Zod).
- CAS com `site_id` e a trava de dono do §2.8, mesclando `closed_by`:
  - com `retry:true` e `retry_count < 2`: `running→pending`, `retry_count+1`, `started_at` zerado, `error_message` zerado (o `reason` vai só para o Sentry), `requested_at` mantido. O `stale` de 7 dias continua limitando o total;
  - fora isso: `running→failed`, com `failed_at` e `error_message`, **sem** `completed_at`.
- Resposta 200: `{id, status, retry_count}`, vindos do `.select('id, status, retry_count')` do próprio UPDATE do CAS; nunca `error_message` nem `result_summary`.
- `retry_count` já existe (`20260517000003…sql:242`), então não há migration.
- O SELECT da task usa `.maybeSingle()`. 404 só quando ele devolve 0 linhas sem `error` (task de outro site ou inexistente); com `error` → 500 `INTERNAL_ERROR`, que na forja dá `fail_perdido` e deixa a task para o watchdog; 409 `TASK_NOT_RUNNING` se não está `running` ou é de outro dono.

### 3.5 Snapshot

**Janela.** `SYNC_WINDOW_DAYS` sai de `sync-analytics-metrics/route.ts:18` (const local) para `lib/youtube/analytics-window.ts`, importado pelo cron e pelo serviço. Nada é exportado de `route.ts`.

**Campos novos em `getIntelligenceSnapshot`** (`youtube.ts:201-280`). `videos[].is_hidden` entra no select (`:219`) e no map (`:255-267`). Toda leitura nova de `youtube_video_analytics` filtra `.eq('site_id',siteId).in('youtube_video_id', <videosRes.data[].id>)`. Usa o `id` (uuid), nunca o `youtube_video_id` textual de `youtube_videos`: o `youtube_video_id` da analytics é FK para `youtube_videos.id`. Toda leitura é limitada por data, nunca o histórico inteiro, porque o PostgREST corta em 1000 linhas (`supabase/config.toml:15`), o que com 14 linhas por dia acontece por volta de meados de novembro:
- `date` = `.gte('date', hoje−3).order('date',{ascending:false}).limit(1)`, com `hoje` em UTC (`new Date().toISOString().slice(0,10)`), o mesmo fuso em que o sync grava `date` (`sync-analytics-metrics/route.ts:71-72`);
- `recent` = `.eq('date', date)`.
- `recent_window: {date, days: SYNC_WINDOW_DAYS}`. `date` é a data mais recente entre os vídeos do canal; é `null` se não há linha nos últimos 3 dias.
- Por vídeo, `recent: {views, subscribers_gained}` é a linha de `date`, **sem somar**. Vídeo sem linha fica em `{0, 0}`, porque a API omite vídeo sem atividade (`route.ts:13-16`).
- `recent_base` e `views_at_7d` ficam para a 2b (§7): nada na 2a os lê.

**Fonte no array `intelligence`** (`youtube.ts:240-245`, lido também pelo `get_intelligence` do MCP, `ab-tests.ts:69`):
- sempre `.eq('source','cowork')`, sem exceção por permissão. O mesmo serviço atende `get_intelligence` (`ab-tests.ts:69`) e o resource `pipeline://youtube/intelligence` (`resources.ts:299-326`, `:322`); na 2a a forja não lê a própria análise.

O overview soma fotos de datas diferentes; é bug registrado no §10, e o snapshot não repete isso.

### 3.6 Health Coach

**Coaching do canal.** `fetchChannelCoaching` (`actions.ts:21-45`):
- troca `.eq('source','cowork')` por `.in('source',['cowork','forja'])` + `.not('coaching','is',null)` + `generated_at desc`;
- devolve `{coaching, source, generatedLabel}`. `generatedLabel` (dd/mm) é formatado **no servidor**, com `Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'})`.

**Props.** `YtHealthCoach` ganha `coachingMeta: {source, generatedLabel, summary} | null`, montado em `yt-analytics-tabs.tsx`.
- O rótulo, a linha de summary e a linha "regras fixas" derivam **só** dela.
- `hasCoworkCoaching` (`yt-health-coach.tsx:61`) sai.
- `lastAnalysisAt` (prop morta, `:55`) não entra.

**Cards.**
- `computeCoachingCards` (`yt-analytics-tabs.tsx:360-407`, hoje privada) passa a ser **exportada**, com a mesma assinatura `(videos, coaching | null)`.
- A união do `source` do card (`yt-health-coach.tsx:16`, `yt-analytics-tabs.tsx:370`) **não muda**: na 2a a forja nunca tem card (`priorities` é sempre `[]`, §3.3), e o único leitor de `card.source`, `hasCoworkCoaching` (`yt-health-coach.tsx:61`), sai. `'forja'` entra na união com a 2b (§7).
- Com `channelCoaching` presente e `priorities: []`, devolve `[]`, sem fallback.

**Textos.**
- Rótulo (literal exato, ASCII como o resto do componente): `Diagnostico · por forja · dd/mm` ou `Diagnostico · por Cowork · dd/mm`. Sem `coachingMeta`, fica `Diagnostico heuristico`, o texto de hoje (`yt-health-coach.tsx:97`).
- A linha "Baseado em regras fixas" (`:103-105`) passa a condição para `!coachingMeta && sortedCards.length > 0`, e o texto termina em "ainda sem analise para este canal" (ASCII, como hoje em `:105`).
- O botão do cabeçalho passa de "Pedir diagnostico ao Cowork" (`yt-analytics-tabs.tsx:231`, e o comentário `:5`) para "Pedir diagnostico" (entra no mockup), porque na 2a quem atende o PT é a forja. Os demais textos de botão, inclusive "Solicitar Nova Analise" (`yt-health-coach.tsx:79,190`), não mudam.

**Elemento novo: uma linha com `coachingMeta.summary` abaixo do rótulo.**
- Com `coachingMeta`, o parágrafo `:98-102` não é renderizado. A linha só é renderizada quando `coachingMeta.summary.trim()` não é vazio. Com summary vazio aparece só o rótulo. O teste de componente tem um caso para isso: Cowork, `summary: ''`, com cards → rótulo e cards, sem linha vazia.
- Com `coachingMeta` e zero cards, o card verde "saudável" (`:169-176`) não aparece. Sem `coachingMeta` (heurístico), ele continua como hoje: ali zero cards quer dizer todos os eixos ≥ 6,5 (`yt-analytics-tabs.tsx:404`).
- Com `coachingMeta.source === 'forja'`, o bloco "Potencial" (`:109-118`), o "+N pts" (`:163`) e a projeção (`:100`) não aparecem sem regra nova: `priorities` é sempre `[]` (§3.3), então não há card, `potentialGain` é 0 (`:63-66`) e o parágrafo `:98-102` não é renderizado. O early return de `:68` (`videoCount === 0`) não muda: o único canal com 0 vídeos, o EN, não tem análise de nenhuma fonte e fica fora de `CANAIS_FILA` (§5 F4).
- **Mockup aprovado pelo dono antes do código**, pela regra de aprovação visual.

**Efeitos visíveis aceitos**
- No PT, já no F0 e sem a forja, a análise do Cowork de maio passa a mostrar a linha com o `coaching.summary` dela no lugar do parágrafo "O canal esta em X/100 … ~N" (`yt-health-coach.tsx:98-102`); os 3 cards e o bloco "Potencial" continuam. Esse summary tem 500 caracteres. Começa em "Canal micro (1.160 subs)…" e termina cortado pelo próprio Cowork em "Conteúdo de...". O texto aparece como está, sem reticências extras nem expansão, e o mockup do F0 usa esse texto real.
- No PT, uma análise da forja mais nova que a de maio substitui a linha de summary, os cards e o "Potencial" do Cowork pela linha de summary da forja, sem cards.
- O badge continua contando os cards (`coachingCards.length`, `yt-analytics-tabs.tsx:174`, até 3 pelo `.slice(0, 3)` de `:384`); com `priorities: []` não há card nem fallback, então é 0 e some.
- O botão do EN continua criando tasks que ninguém consome. Mostra "Solicitado!", e depois "Aguarde..." (`already_active`) por até ~7 dias e 19 horas depois de cada task do cron (o `stale` só roda às 03:00 UTC).
- Nas 24 h depois de uma análise manual concluída, o botão mostra "Aguarde..." (cabeçalho) ou "Disponivel em breve" (Health Coach) por 10 s, sem as horas restantes (o `hours_remaining` de `actions.ts:213` é ignorado pela UI).

**Leitura por vídeo** (`actions.ts:101-107`): não muda. Nada montado a lê, e a forja não grava linha de vídeo; entra junto com a UI da 2b (§7).

**MCP**
- `fetchSnapshotAge` (`mcp/prompts.ts:102-113`) ganha só `.eq('source','cowork')`, sem parâmetro novo: sem ele, uma linha `forja` faria a análise do Cowork parecer nova. A idade continua global entre canais, como hoje; o filtro por canal fica fora desta fase (§8). Não chama `getMcpContext()`, porque os prompts rodam sem contexto em `test/mcp/youtube-mcp-prompts.test.ts`, e ali ele lançaria (`mcp/context.ts:6-11`).
- O prompt `youtube-analyst` (`mcp/prompts.ts:933`) diz que o array de inteligência traz só análises do Cowork.
- As descrições de `submit_intelligence`/`intel_payload` (`mcp/tools.ts:662,690`) dizem que a fonte vem da chave.

### 3.7 Arrastados pelo commit

**Registry** (`lib/pipeline/api-registry.ts`)
- +2 endpoints: `{ method: 'POST', path: '/api/pipeline/youtube/intelligence/task/claim', summary: 'Claim next pending intelligence task by channel_ids (API key only)', auth: 'intelligence' }` e `{ method: 'POST', path: '/api/pipeline/youtube/intelligence/task/:id/fail', summary: 'Fail or requeue a running intelligence task owned by the key', auth: 'intelligence' }` (o path é literal: `api-registry.test.ts:144` converte `:id` em `[id]` para achar o `route.ts`); `endpoint_count` do youtube vai de 31 para 33 (`api-registry.ts:169`).
- `ApiEndpointMeta.auth` vira `'read'|'write'|'intelligence'` (`:7`). A entrada `:172` (PATCH) passa a `'intelligence'`, e a `:173` (GET legado da task) passa a `'write'` (§3.2).
- Acompanham: o regex de `test/lib/pipeline/api-registry.test.ts:38` e `test/mcp/mcp-registry-sync.test.ts:28-29` (comentário `youtube(31)` → `youtube(33)`, e 123 → 125). As rotas novas caem em `youtube_analytics` (`mcp/auto-register.ts:137-141`).

**Erros MCP.** Entram `PARTIAL_FAILURE` (`retryable:false`) e `TASK_NOT_RUNNING` (§3.3).

**Docs**
- `data/pipeline-docs/cowork-docs-youtube.md` (servido ao Cowork por `/api/pipeline/docs/youtube`), nas seções do snapshot (`:19-79`, inclusive `existing_intelligence` → `intelligence`), do PATCH (`:81-121`), do GET `/task` (`:123-129`), "Retry & Backoff" (`:263-268`: trocar o texto por watchdog → `stale` e `retry` até 2), "Error Codes" (`:270-281`: 409 `TASK_NOT_RUNNING` = não reenviar; 500 `PARTIAL_FAILURE`) e do fluxo (`:1351-1361`):
  - claim POST com `channel_ids`;
  - `fail` com `retry`;
  - fonte pela chave;
  - `channel_id` **obrigatório** no GET do snapshot;
  - `recent`/`recent_window` e `videos[].is_hidden`;
  - o array `intelligence` só com `cowork`;
  - o GET `/task` legado exige `write`;
  - os novos 400/409/500.
- `docs/cowork-youtube-intelligence-reference.md` (`:81-129`, `:220-290`) recebe o mesmo.
- `docs/cowork-pipeline-reference.md` não cita a inteligência e não muda.

**Cenários de validação visual** — fixtures do teste de componente jsdom abaixo, não SQL. A página exige `social_connections` YouTube não revogada com token válido e a YouTube Analytics API viva (`lib/youtube/analytics-client.ts:52-72,82-101,156-180`; `page.tsx:32-46,73-81`), e o banco local não tem isso.
- **A:** a fixture de maio (`coaching` com 6 priorities, `generated_at` 2026-05-18T13:34Z) → linha de summary, 3 cards do Cowork, badge 3.
- **B:** linha `forja`, `priorities: []` e `summary`.
- **C:** sem linha.

**Testes unitários (Vitest, no mesmo commit).** Onde cada um mora: `test/api/pipeline/youtube-intelligence.test.ts` mocka o serviço inteiro (`:59-63`) e guarda só contratos de rota (status e envelope). As asserções de serviço (claim, PATCH, dono, fonte `forja`, fechamento, fail, snapshot) vão para `test/lib/pipeline/services/youtube-intelligence-service.test.ts`, chamando o serviço com um `ServiceContext` cujo `supabase` é um mock encadeável que grava cada chamada (o padrão de `test/lib/pipeline/services/items-history-key-identity.test.ts`). As do MCP (`claim_task`, `submit_intelligence`) vão para `test/mcp/ab-tests-intel.test.ts`, chamando `manageAbTest` com `getMcpContext` mockado. As das rotas novas (`task/claim`, `task/[id]/fail`) vão para `test/api/pipeline/youtube-intelligence-task-routes.test.ts`.

*Permissão e fonte*
- Unitários **sem mock** de `requirePermission` e `authenticateIntel`: `{read}` recusa `intelligence`; `{read,intelligence}` recusa `write`; `write`/`admin` aceitam `intelligence`.
- `deriveSource` via REST: `{read,intelligence}`, com ou sem `source:'cowork'` no corpo, grava `forja`. Chave `write` com `source:'forja'` no corpo grava `cowork`, via REST e MCP.

*Claim*
- 200 com `started_at`; 204 com rate-limit headers; filtro `channel_ids`; `claimed_by` gravado pelo POST, pelo GET legado e pelo MCP; sessão → 403; sem corpo, `channel_ids: []`, 11 itens ou um não-uuid → 400 `VALIDATION_ERROR`, sem consulta a `youtube_intelligence_tasks`.
- Em arquivo próprio, `test/api/pipeline/youtube-intelligence-auth.test.ts`, sem mock de `@/lib/pipeline/helpers` e com `vi.mock('@/lib/pipeline/auth', async (o) => ({...(await o()), authenticatePipeline: vi.fn()}))` (só `authenticatePipeline` mockado; o arquivo existente mocka `helpers` inteiro): chave `{read}` → 403 no POST claim, no GET legado e no PATCH, e chave `{read,intelligence}` → 403 no GET legado, todos sem consulta a `youtube_intelligence_tasks`.
- GET legado com `?status=failed` → `claimNextTask(ctx)` sem status.
- `error` no SELECT e `error` no UPDATE do CAS → 500 `INTERNAL_ERROR`, nunca 204. SELECT sem linha (`data: null, error: null`) → 204. UPDATE que devolve 0 linhas → 204 com rate-limit headers.
- Task devolvida a `pending` por `fail {retry:true}` da forja e depois clamada por chave `write` (GET legado e MCP `claim_task`) → a resposta não traz `error_message` nem `result_summary`, e a linha tem `error_message` nulo.

*Dono*
- `{read,intelligence}` em task de outra chave → 409 `TASK_NOT_RUNNING` sem gravar, no PATCH e no fail.
- Chave `write` fecha a task da forja → 200.
- `{read,intelligence}` com `ctx.keyId` ausente → 409 `TASK_NOT_RUNNING` sem gravar, no PATCH e no fail.
- `submit_intelligence` numa task `stale` → `_meta.retryable === false`.

*PATCH*
- 400 fora do schema, via REST e MCP.
- Teto dos padrões.
- **Regressão do Cowork:** `test/fixtures/intel-cowork-2026-05-18.json`, remontado só de leitura das 11 linhas `cowork` de maio, passa no `safeParse` e grava `cowork`.
- Task `stale` → 409 sem gravar. CAS final perdido → 409. `started_at` da linha diferente do lido no SELECT (novo claim) → 409. Erro no UPDATE do CAS → 500 `INTERNAL_ERROR`.
- Falha parcial → `failed` sem `completed_at`, com `failed_writes` e resposta 500.
- `result_summary` preserva `claimed_by`.
- `error` no SELECT da task e no SELECT de integridade → 500 `INTERNAL_ERROR`, sem escrita; 0 linhas sem `error` → 404.
- Todo 4xx, exceto o 409 do CAS final, vem antes de escrita. O 422 de integridade continua 422 `VALIDATION_ERROR`.

*Forja*
- `notifications` não vazio → 400; `video_recommendations` com 1 item → 400; `coaching.priorities` com 1 item → 400; sem `coaching` → 400. Nas quatro, nenhuma escrita em `youtube_intelligence` e a task segue `running`.
- `video_recommendations: []` (ou ausente) com `priorities: []` → 200, uma linha de canal `forja` e nenhuma linha de vídeo.
- PATCH `forja` 200 → nenhuma chamada a `fanOutToSiteAdmins` (`lib/notifications/fan-out-to-admins.ts:14`, o único fan-out que o serviço importa e chama, `services/youtube.ts:4,416`), com o mock de `@/lib/notifications/fan-out-to-admins` conferindo 0 chamadas.

*Fail*
- 200 (`failed`); 200 com `retry` → `pending` e `retry_count` 1; terceiro `retry` → `failed`.
- 404, 409 e 400; `error` no SELECT da task → 500 `INTERNAL_ERROR`, sem UPDATE; `{read}` → 403; sessão → 403.

*Cross-site (chave do site A)*
- PATCH com `task_id` do B → 404 sem escrita.
- `fail` na task do B → 404.
- Claim com `channel_ids` do B → 204, e a task do B segue `pending`.
- Snapshot com `channel_id` do B → 404.

*MCP*
- `claim_task` com `{read}` → FORBIDDEN.
- `{read,intelligence}` em `claim_task`, `submit_intelligence`, `upsert_variants` e `delete_variant` → FORBIDDEN.
- Claim REST + `submit_intelligence` MCP com a mesma chave `write` → 200.

*Snapshot*
- `recent` da linha de `date`, sem soma. Vídeo ausente → 0.
- O unitário confere só os argumentos passados ao cliente: `.gte('date', <hoje UTC − 3>)`, `.order('date',{ascending:false})`, `.limit(1)`, `.eq('site_id', …)` e `.in('youtube_video_id', <uuids de videosRes>)`. A semântica (janela, outro canal, corte de 1000 linhas) fica na integração.
- `videos[].is_hidden` presente no snapshot.
- Chave `write` (REST e tool MCP `manage_ab_test` `get_intelligence`), chave `{read}`, chave `{read,intelligence}` e o resource MCP `pipeline://youtube/intelligence` → o serviço filtra `.eq('source','cowork')` e nenhuma linha `forja` chega a `intelligence`.
- Datas relativas.

*Health Coach*
- `fetchChannelCoaching` devolve a mais recente da allowlist, com `source` e `generatedLabel`; o mock confere `.eq('site_id', <siteId de getSiteContext>)`, `.eq('channel_id', <argumento>)`, `.in('source',['cowork','forja'])`, `.not('coaching','is',null)`, `.is('video_id',null)` e `.eq('type','channel')`. O "`forja_retirada_…` mais nova é ignorada" (trava o rollback do §5) é testado na integração abaixo. `generated_at` às 01:30Z vira o dia anterior.
- `computeCoachingCards(videos,{priorities:[],summary})` → `[]`, com vídeos de eixos `normalized` 0; com os mesmos vídeos e sem coaching → 3 cards `fallback`.
- Componente (`@vitest-environment jsdom`):
  - "por forja" com `priorities: []` (B): linha de summary, sem card verde "saudável", sem "regras fixas", sem "Potencial", sem "+N pts", sem badge;
  - sem coaching (C) → "Diagnostico heuristico" (literal ASCII de `yt-health-coach.tsx:97`);
  - Cowork com `summary: ''` e cards → rótulo e cards, sem linha de summary vazia (§3.6);
  - "por Cowork · 18/05" com a fixture de maio (A): 3 cards, badge 3, a linha com o `summary` da fixture e nenhum "O canal esta em";
  - os cenários A–C renderizam `YtAnalyticsTabs` (props mínimas mais `intelligenceVideos` com ≥ 1 `VideoGradeRow` cujos 6 eixos têm `normalized` 0 — sem vídeos `videoCount` é 0 (`yt-analytics-tabs.tsx:299`) e o early return de `yt-health-coach.tsx:68` esconde rótulo e summary, e com eixos altos o fallback já daria `[]`; com esses vídeos o C mostra 3 cards heurísticos, badge 3 e "regras fixas", e o B prova que a linha `forja` suprime o fallback; `next/navigation` mockado; o teste abre a aba Health Coach pelo botão da aba), porque o badge mora nele (`yt-analytics-tabs.tsx:170-178,259-261`) e o `page.tsx` assíncrono não roda em jsdom (`getSiteContext`, `requireSiteScope`). `channelCoaching` vem no formato novo `{coaching, source, generatedLabel}` (A: `generatedLabel:'18/05'`); a conversão de `generated_at` é testada só em `fetchChannelCoaching`. A prop `channelCoaching` de `YtAnalyticsTabs` (`:78`, hoje `{coaching, generatedAt}`) muda para esse tipo.
- `fetchSnapshotAge` chama `.eq('source','cowork')` (conferido nas chamadas do mock de `test/mcp/youtube-mcp-prompts.test.ts`).

*Botão*
- Manual `completed` há 1 h → `cooldown`.
- Task `cron` concluída → sem cooldown.
- Manual `failed` mais recente → sem cooldown.

*Reescritos no mesmo commit*
- `test/youtube/coaching-actions.test.ts:5-13` e `:69-77`.
- `test/youtube/yt-health-coach.test.tsx`: `baseProps` (`:43-50`) ganha `coachingMeta: null`. O teste do botão (`:113-118`, "Solicitar Nova Analise") e a interface local `CoachingCard` (`:21-29`) não mudam, porque "Solicitar Nova Analise" e a união do `source` ficam como estão (§3.6); nenhum teste referencia "Pedir diagnostico ao Cowork".
- Em `test/api/pipeline/youtube-intelligence.test.ts`:
  - o mock de helpers (`:12-24`) ganha `authenticateIntel`; o teste de schema confere `body.error.code === 'VALIDATION_ERROR'` e o `path` na `message`;
  - o 422 `validation_failed` de schema (`:191-209`) passa a 400 `VALIDATION_ERROR`;
  - o teste de integridade (`:266-297`) mocka o erro real (422 `VALIDATION_ERROR`);
  - o mock de `@/lib/pipeline/auth` (`:26-29`) passa a `async (o) => ({...(await o()), buildRateLimitHeaders: vi.fn().mockReturnValue(undefined)})`, porque o GET legado importa dali o `requirePermission` (`lib/pipeline/auth.ts:99`; `helpers.ts` não o reexporta);
  - os testes do PATCH (`:171-297`) e do GET `/task` (`:303-358`) trocam `mockAuthWrite`/`mockAuthRead`/`mockAuthFail` (`:72-88`) por `authenticateIntel` mockado (`permissions:['read','write']` no sucesso, `Response` 401 na falha), porque as duas rotas deixam de chamar `authenticateWrite`/`authenticateRead`;
  - `:353-358` passa a conferir `claimNextTask(ctx)` sem status;
  - os testes que esperavam `VERSION_CONFLICT` passam a `TASK_NOT_RUNNING`.

**Integração com o banco local** — `test/integration/youtube-intelligence-forja.test.ts`, com `describe.skipIf(skipIfNoLocalDb())`
- Dois PATCH `forja` seguidos (tasks distintas) no mesmo canal → uma só linha de canal `forja`, com o texto do segundo. A linha `cowork` do canal e as `forja` de outro canal e de outro site ficam intactas.
- CAS de fechamento com `claimed_by` diferente → 0 linhas e 409; igual → `completed`.
- Claim com `channel_ids` e `site_id` → só a task elegível vira `running`.
- Snapshot: `recent_window` é null com a última linha em hoje(UTC)−4 e não nulo com hoje(UTC)−3; linhas de vídeo de outro canal não entram (fixture com `youtube_videos.youtube_video_id` diferente do `id`); um histórico com mais de 1000 linhas ainda dá o `date` mais recente e o `recent` completo.
- `fail {retry:true}` → `pending`.
- PATCH e `fail` com `task_id` inexistente e com `task_id` de outro site → 404, nunca 500 (PostgREST real; o mock `{data:null,error:null}` do unitário não pega o PGRST116).
- `fetchChannelCoaching` (com `getSiteContext`/`requireSiteScope` mockados): com uma linha `cowork` e uma `forja_retirada_202609181200` mais nova no mesmo canal, devolve a `cowork`.

**`view_count` vivo fica para a 2b (§7).** Na 2a, `view_count` é o valor da importação de 06/05 (`refreshMetrics` só atualiza vídeos de até 30 dias, `lib/youtube/sync.ts:158-166`). Com o canal parado, a diferença é de +29 views em 90 dias sobre 6.847 e não muda os padrões. O F0 não mexe no cron `metrics`.

**Sem migration.** `source` não tem CHECK. `failed`, `retry_count` e `result_summary jsonb` já existem. `permissions` é `text[]` sem CHECK.

## 4. Forja — `/opt/agente/fila_intel.py`

### 4.1 Laço (uma execução)

**0. Crontab do thiago**

```
*/10 * * * * timeout -k 30s 25m /opt/agente/venv/bin/python /opt/agente/fila_intel.py --cron >>/opt/agente/log/fila_intel.err 2>&1
```

- **Modo.** `modo` = `cron` com `--cron`; `sombra`, `escolher` ou `canario` nos modos do §4.7; `manual` no resto, que imprime o desfecho e roda sob o mesmo `timeout -k 30s 25m`.
- **Lock.** O lock é tomado pelo **próprio Python** no início de `main()`, sob `if __name__ == '__main__'`, e nunca na importação: `_TRAVA = open(os.path.join(BASE,'fila_intel.lock'),'a')`, guardado numa global de módulo que nunca é fechada, e depois `fcntl.flock(_TRAVA.fileno(), LOCK_EX|LOCK_NB)`. Um `open()` temporário seria coletado logo depois da chamada, fecharia o descritor e soltaria a trava.
  - Importar o módulo não tem efeito colateral: não toma lock, não instala handler de sinal e não lê nem grava arquivo (o `teste_fila.py` o carrega por SourceFileLoader, §4.6).
  - Todo caminho vem de `BASE = os.environ.get('AGENTE_BASE','/opt/agente')` (a convenção de `replay2.py:8`: lock, `log/`, `series.json`, `roteamento.jsonl`, `fila_intel.env`, `sombra/`) e `DEFAULT = os.environ.get('AGENTE_DEFAULT','/etc/default/proxy-agente')`, lido só dentro de `main()`. `agora_mono`, `dormir`, `agora` (relógio de parede com fuso; dele saem `hoje`, a janela do sync em UTC e a hora local naive comparada com `roteamento.jsonl`), `abrir_site` e `abrir_llama` (fábricas dos clientes do site e da 8080; padrão `httpx.AsyncClient`) são parâmetros de `main()`, com os padrões reais, para testar o orçamento, os 9 min, a espera de 60 s e a janela do sync sem esperar de verdade. O `teste_fila` passa o `CliFalso`, um llama falso em processo (`/slots`, `/v1/chat/completions`, `/apply-template`) e relógios injetados; o llama falso não pode ser um servidor local, porque o `sitio_falso` bloqueia `socket.socket.connect` na importação (`trilha/sitio_falso.py:3`). O `fail` do `finally` usa a mesma `abrir_site`.
  - O próprio `teste_fila` grava um tmpdir em `os.environ['AGENTE_BASE']` e em `os.environ['AGENTE_DEFAULT']` **antes** do SourceFileLoader, sobrescrevendo (nunca `setdefault`) o ambiente herdado: o `cartao.sh:6` exporta `AGENTE_BASE=/opt/agente`. Para o teste da fixture (§4.2), ele copia `fixture_pt.json` (do cwd `docs/trilha`) e `/opt/agente/series.json` para o tmpdir.
  - O teste confere que todo caminho resolvido pelo worker (lock, `log/`, `series.json`, `roteamento.jsonl`, `fila_intel.env`, `sombra/`) fica sob o tmpdir, e que o par (existe, mtime) de `/opt/agente/log/fila_intel.jsonl`, `/opt/agente/log/fila_intel.err` e `/opt/agente/fila_intel.lock` não mudou: um arquivo ausente antes continua ausente depois. Não confere o `log/` inteiro, porque o pulso grava `log/pulso.log` a cada hora. Na forja, o `teste_fila` roda sempre sob `flock /opt/agente/fila_intel.lock` (§4.6), para que o cron vivo não grave no meio do teste.
  - Lock ocupado → no cron sai 0 sem gravar nada; no modo manual imprime `ocupado: outra execução com o lock` e sai 75.
  - É o mesmo `flock(2)` que o `deploy.sh` e o rollback usam.
- **Invariante de tempo.** Do claim ao último pedido ao site passam menos de 25 min + 30 s, abaixo dos 30 min do watchdog. Assim ele nunca corta uma execução viva. A rota do PATCH passa a declarar `export const maxDuration = 60` (§3.3), igual ao timeout de leitura do cliente. Mudar o orçamento, o `timeout` ou `STALE_THRESHOLD_MINUTES` exige refazer essa conta.

**1. Uma linha de log por execução.** Toda execução com lock grava **exatamente uma** linha em `/opt/agente/log/fila_intel.jsonl`.
- Campos: `quando` (ISO com offset: `datetime.now().astimezone().isoformat(timespec='seconds')`), `modo, desfecho, etapa, claim, task, canal, ms por etapa, tentativas, seeds, tokens, fallback, motivos`, onde `claim` é o status HTTP da resposta do claim (200, 204…) ou `null` quando não houve resposta. Nunca a chave nem o texto gerado.
- `desfecho` ∈ `ocupado | chat | llama_fora | config | vazia | ok | reprovada | llama | falha_site | conflito | fail_perdido | chave | indeterminado | orcamento | bug | morto`.
  - `llama` = as duas tentativas depois do claim foram feitas e nenhuma chegou ao validador (llama fora ou `truncado|timeout|json|pensou` nas duas; `fail` com `retry`).
  - `orcamento` = a tentativa 1 não chegou ao validador (as mesmas falhas) e restam menos de 9 min, então não há tentativa 2 (`fail` com `retry`, §4.5 item 6).
  - `reprovada`, antes do PATCH = guarda determinística (`fail` sem `retry`: repetir daria o mesmo payload): Zod local reprovado depois da montagem ou escopo 2a violado (§4.5 itens 1–2, `etapa: validar`), piso de dado (§4.3) ou janela ≠ 90 (passos 4–5). Depois do PATCH, a tabela do passo 6.
  - `bug` = exceção não prevista entre o claim e o PATCH (`KeyError` em `features`, `series.json` incoerente com o snapshot): `fail` **sem** `retry`, `motivos: [<tipo da exceção>]`. `morto` fica só para `SystemExit`/sinal.
  - Falha do snapshot = `falha_site` com `etapa: snapshot`.
- **Morte por sinal.** O `try/finally` fica **fora** do `asyncio.run`, com o estado num dict de módulo. O handler de SIGTERM levanta `SystemExit`, e o `finally`:
  1. se houve claim 200, `fail_enviado` é falso e o PATCH não teve uma resposta que dispense `fail` na tabela do passo 6 (200, 409/404, 401/403, 500 `PARTIAL_FAILURE`), chama `fail {reason:'morto:<etapa>', retry:true}` por um `asyncio.run` novo, com um cliente aberto ali por `abrir_site()`, sempre por `sitio.pedir(…, fase=2, chave=…, timeout=httpx.Timeout(8, connect=3))` dentro de `asyncio.wait_for(…, ESPERA_FAIL_MORTO)` (constante de módulo = 12 s; o `TimeoutError` é engolido e o desfecho continua `morto`), e nunca por `httpx` direto: o `fail` e a linha do jsonl cabem, juntos, nos 30 s do `-k`. O caso inclui o PATCH ainda não enviado, o PATCH enviado e sem resposta, e a espera de 60 s depois de um 429. É seguro pelo mesmo argumento do `indeterminado` (passo 6): `fail` e CAS final são CAS sobre `running` com trava de dono, e só um vence. `fail_enviado` é marcado **antes** de abrir a conexão de qualquer `fail`, e `patch_status` só é gravado quando a resposta do PATCH chega;
  2. se nenhum desfecho foi decidido, grava `morto` com a última etapa; senão grava o desfecho decidido.
- **Rotação**, dentro do lock:
  - o jsonl, via tmp + `os.replace`, fica em 4.000 linhas quando passa de 5.000;
  - o `.err` é aparado **no mesmo inode** (lê a cauda, `truncate(0)`, reescreve), porque o shell o abriu com `>>`. Fica em 1.500 linhas quando passa de 2.000.

**2. Antes de tocar no site**
- **Canais.** `CANAIS_FILA` (linha `CANAIS_FILA=PT` em `/opt/agente/fila_intel.env`) é traduzido por `SITIO_CANAL_PT`/`EN`, lidos de `DEFAULT` (`/etc/default/proxy-agente`) pelo próprio Python. Lista vazia, rótulo desconhecido ou uuid ausente → `config`, **sem claim**. Nunca sai claim sem `channel_ids`.
- **Janela do sync.** Entre 11:58 e 12:05 UTC, pelo relógio injetado `agora` em UTC (padrão `datetime.now(timezone.utc)`; o crontab roda em hora local): `ocupado` com `motivos: janela_sync`, sem claim. O `sync-analytics-metrics` roda `0 12 * * *` UTC (`vercel.json:25`) e grava as linhas de hoje uma a uma; um claim nesse instante leria `views_90d` parcial. Tem teste.
- **Slots.** `GET 127.0.0.1:8080/slots` (timeout 3 s). Erro de conexão, timeout, status ≠ 200 ou JSON sem exatamente 2 slots → `llama_fora`; 200 com algum `is_processing=true` → `ocupado`.
- **Chat recente.** Lê a última linha **terminada em `\n`** de `/opt/agente/roteamento.jsonl`. O campo `quando` é ISO naive em hora local da forja (`America/Sao_Paulo`), gravado no início do turno (`proxy.py:349`), e é comparado com a hora local naive derivada de `agora` (padrão `datetime.now()`).
  - Cauda sem `\n` (turno sendo gravado) → `chat`.
  - `quando` a menos de 5 min, ou até 10 min no futuro → `chat`.
  - Mais de 10 min no futuro → segue, com `motivos: roteamento_futuro`.
  - Arquivo ausente ou linha completa ilegível → segue, com `motivos: roteamento_ilegivel`.
  - Tem teste com uma linha real e com uma cauda parcial.

**3. Claim.** `POST …/task/claim {channel_ids}` com a chave da fila.
- 204 → `vazia`.
- 401/403 → `chave`, sem `fail`.
- Timeout, 5xx ou 429 → `falha_site` com `etapa: claim`, **sem** `fail`, porque o id é desconhecido. Se o CAS rodou no servidor, a task fica `running` até o watchdog (§9).
- Outra `recusa` com status 3xx/4xx (§4.6) → `falha_site` com `etapa: claim` e o status em `motivos`, sem `fail`: nada foi clamado.
- No §4.1, "5xx" quer dizer `status` 500–599, seja qual for o tipo da `FalhaSite` (o 500 sai como `recusa`, os 501–599 como `5xx`, §4.6). O código ramifica pelo `status`, não pelo tipo; o 500 `PARTIAL_FAILURE` do passo 6 se distingue pelo `code` (regra de falha transitória no §4.6).
- 200 → começa o orçamento de 20 min, medido com `time.monotonic()`.

**4–5. Dentro de um `try`, até o PATCH**
- `GET …/intelligence?channel_id=<task.channel_id>` com a chave da fila. Quando `recent_window` não é nulo e `recent_window.days ≠ 90`, a forja chama `fail` sem `retry`, com `reason:'janela <n>'`. O desfecho é `reprovada`, com `motivos: janela_<n>`. Os textos (`views_90d`/`inscritos_90d`, o template do §4.5 item 6), a constante 90 do §4.5 (e) e a maturidade supõem 90 dias, e o site lê a janela de `YT_ANALYTICS_SYNC_WINDOW_DAYS`. O `teste_fila` cobre esse caso.
- `features` (§4.2) → `escolher` (§4.3) → redação (§4.4) → `validar` (§4.5).
- **Toda saída antes do PATCH** chama `POST …/fail` uma vez, com `reason` = etapa + motivo:
  - com `retry:true` para `llama`, `orcamento` e falha transitória do snapshot (timeout/5xx/429, §4.6);
  - sem `retry` nos demais casos (`reprovada`, `bug`, snapshot não transitório).
- Se o próprio `fail` volta 409 → `conflito`. Qualquer outra resposta do `fail` que não seja 200 (404, 401/403, 429, 5xx, 3xx/outro 4xx, timeout, rede) → `fail_perdido`, e o watchdog fecha a task.

**6. PATCH.** Uma vez, sem `source`, com timeout de 60 s:

| Resposta | Ação | `desfecho` |
|---|---|---|
| 200 (qualquer corpo, inclusive `formato`/`grande`: o 200 só sai depois do CAS de fechamento, §3.3) | fim | `ok` |
| 400 / 422 / 3xx / outro 4xx | `fail {reason:'patch <st>: <code>'}` (seguro: 400/422 saem antes de escrita, e 3xx/405/413 antes do handler; a exceção é o 409 do CAS final, §3.3) | `reprovada` |
| 429 | espera 60 s fixos (a janela é de 60 s, `lib/pipeline/auth.ts:20`, e o 429 sai sem cabeçalhos de rate limit, `lib/pipeline/helpers.ts:27`) e `fail {reason:'patch 429', retry:true}` (o 429 sai antes de qualquer consulta, `lib/pipeline/auth.ts:57-59`) | `falha_site` (`etapa: patch`, `motivos: patch_429`) |
| 409 / 404 | nada: a task não é mais desta execução | `conflito` |
| 401 / 403 | nada: a chave foi recusada; o watchdog fecha | `chave` |
| 500 `PARTIAL_FAILURE` | nada: o site já marcou `failed` | `falha_site` |
| timeout / outro 5xx | **não repete o PATCH**; chama uma vez `fail {reason:'patch indeterminado', retry:true}`. É seguro: o `fail` e o CAS final do PATCH são ambos CAS sobre `running` com a trava de dono, e só um vence. Se o PATCH concluiu, o `fail` volta 409; se o `fail` vence, o CAS do PATCH volta 409 e a task volta à fila (a linha de canal `forja` já gravada é sobrescrita pela próxima execução). `fail`→409 ou `fail` que falha não mudam o desfecho (no segundo caso o watchdog fecha) | `indeterminado` |

- **Não se reenvia o PATCH.** No `indeterminado`, o `fail {retry:true}` devolve a task à fila quando o servidor não a fechou; o watchdog só entra quando esse `fail` se perde. O pulso conta `indeterminado` como não-`ok`.
- **A geração vai direto para a 8080**, nunca pela 8081. Assim não passa pelo roteador, não escreve em `roteamento.jsonl` e não depende do proxy.

### 4.2 `features` — funções puras, com `hoje` como parâmetro

**Vídeo oculto** (`is_hidden`): entra em Σ `recent` e em `canal.videos`, mas fica fora de série e de coorte (e da proposta de séries do F0.5). Em 18/09 são 4 dos 35 do PT: os 3 "Main AD Diamante" e "Lolzin D5" (conferido só de leitura).

**Por vídeo**, pelo `snapshot.videos[].id` (uuid interno); `video_id` é o id do YouTube e nunca vai para o PATCH.
- `idade_dias`.
- **Maturidade.** Vídeos com menos de 90 dias ficam fora das comparações dos padrões. Acima disso, a comparação usa `view_count` direto, que na 2a é o valor da importação de 06/05 (canal parado; o `refreshMetrics` de todos os vídeos entra na 2b, §7). Risco aceito: um vídeo novo congela perto dos 30 dias de idade e, se a 2b não sair antes de ele completar 90 dias, entra nas comparações com esse valor. A saturação medida (em 18/09: +29 em 90 dias sobre 6.847) só vale para vídeos com 647 dias ou mais (o mais novo do PT, publicado em 10/12/2024, tinha 647 em 18/09); o limiar de 90 dias é revisto quando o canal voltar a publicar.
- **Coorte de uma série** (base da `razao` dos padrões, §4.3): vídeos maduros e não ocultos do mesmo ano, **sem os do grupo avaliado** (a série); vídeos de outras séries continuam na coorte. Ano = ano do `published_at` no fuso de São Paulo, o mesmo do `ultimo_video` (§4.4). O ano de uma série é o do `published_at` do seu episódio mediano pela ordem de `published_at`. Com número par de episódios, vale o de menor posição entre os dois centrais.
  - Com menos de 4 vídeos, soma o ano mais próximo **com vídeos elegíveis para a coorte** (maduros, não ocultos, fora da série) (anterior, depois seguinte, alternando), até 2 anos de distância. Sem 4 dentro desse limite, a comparação não se aplica.
- `recent.views` e `recent.subscribers_gained` (90 dias), quando `recent_window` não é nulo; somados no canal, viram `views_90d` e `inscritos_90d` da `ENTRADA` (§4.4).

**Série**
- **A verdade é `/opt/agente/series.json`** (`{"videos":{snapshot.videos[].id: slug},"nomes":{slug: nome exibível}}`). O nome alimenta `series[].nome` e o `finding`, passa por `_t` e nunca tem `_`. O slug só vai para `pattern_id`. O arquivo é escrito uma vez, no F0.5: Claude o redige no Mac a partir dos títulos da fixture, e o dono escolhe e o leva à forja (marcadores aninhados, como "4 - Como somos controlados - … (Part 3)", saem com as duas leituras, e o dono escolhe). Cada vídeo pertence a uma série só. Série = 3 ou mais vídeos com o mesmo slug.
- **O `fila_intel.py` não tem heurística de série.** Vídeo fora do arquivo não pertence a série nenhuma. O canal não publica desde 10/12/2024; quando voltar, o dono acrescenta os vídeos novos ao arquivo (gatilho da 2b, §7).

**Teste**
- Fixture PT do F0.5, com `hoje` = `congelado_em` e o `series.json` do dono.
- Fronteiras em 89/90 dias.

### 4.3 `escolher` — padrões e montagem (dado, não prompt)

**Escopo 2a.** `escolher` produz só a análise do canal:
- `channel_insights.patterns_detected` e `channel_insights.analysis_text`, abaixo;
- `coaching.priorities: []`, **sempre**;
- `video_recommendations` **ausente** do PATCH. O servidor recusa com 400 um PATCH `forja` fora disso (§3.3).

**Piso de dado.** Com menos de 8 vídeos no snapshot, **não há chamada ao 12B nem PATCH**: `fail {reason:'dado_insuficiente'}` sem `retry`, desfecho `reprovada`, `motivos: dado_insuficiente`. Na 2a isso não acontece (só o PT, com 35 vídeos, está em `CANAIS_FILA`); é só a guarda.

**`patterns_detected`** — só séries:
- `pattern_id = serie:<slug>`, `category = series`, `sample_size` = número de vídeos da série.
- `razao` = mediana de `view_count` da série / mediana de `view_count` da coorte sem ela, arredondada a 2 casas **antes** de qualquer uso (`Decimal(a)/Decimal(b)` com `quantize(Decimal('0.01'), ROUND_HALF_UP)`, sem `round()` de float). O piso de efeito, `forte`, `leitura` (§4.4), o `finding` e a `ENTRADA` usam esse mesmo valor, e a razão crua nunca é comparada. Exibição: 2 casas + `×` ("0,63×"). Medianas: sem casas quando inteiras, senão 1 casa ("143,5"). Teste de fronteira: 91/136 = 0,669 → 0,67 → padrão "abaixo"; 0,674 → 0,67 → padrão; 0,675 → 0,68 → neutro.
- `finding` é template: `Série "{nome}": {n} vídeos, mediana de {views} views na vida ({razao} da coorte do mesmo período)`.
- Piso de efeito: só sai padrão com `razao` ≤ 0,67 ou ≥ 1,5; o resto vai para o log (`motivos: padrao_neutro`).
- **`confidence`** = `min(0,7, 0,3 + 0,05 × min(n_grupo, 6) + 0,1 × [forte])`, com `n_grupo = min(n_série, n_coorte)` e `forte` = `razao` ≤ 0,5 ou ≥ 2. O teto de 0,7 existe porque não há CTR nem retenção.
- Eras e dia da semana ficam fora.

**`analysis_text`** é template: os `finding` unidos, mais "Gerado pela forja com as views na vida de cada vídeo (contagem importada, sem atualização diária) e as séries.". Não cita `data_base`, porque nenhum `finding` usa dado até essa data. Nenhuma tela o lê hoje.

**Teste da fixture PT.** Fixa a saída de `escolher` e os padrões; o dono confere uma vez. Um limiar só muda por item julgado errado ou faltante, nunca para atingir uma contagem. **Esperado em 18/09** (com o `view_count` da importação de 06/05, o mesmo que a fixture do F0.5 traz na 2a, §4.2), conforme a leitura que o dono gravar no `series.json` (F0.5):
- **Leitura plana** ("0–10", episódios 0 a 10 numa série só): 1 padrão, "0–10" (11 vídeos, 91 / 143,5 = 0,63×, `confidence` 0,6).
- **Leitura aninhada:** 1 padrão, "Como somos controlados" (episódios 1, 2, 4, 5 e 6; ano 2019 pelo episódio 4; 91 / 136 = 0,669, arredondada a 0,67 e exibida como "0,67×", `confidence` 0,55). É o caso de fronteira do piso de efeito (a `razao` arredondada, 0,67, fica no piso). O resto do 0–10 (episódios 0, 3, 7, 8, 9 e 10) dá 113 / 113 = 1,00, neutro.
- **Nas duas leituras:** "Vlogzeira" (156 / 109,5 = 1,42×, com os vídeos da outra série dentro da coorte) fica abaixo do piso de efeito, e "Main AD Diamante" é oculto.
- **Sempre:** `priorities: []` e nenhuma chave `video_recommendations`.

### 4.4 Redação pelo 12B — contrato (fonte única do `teste_fila`)

**O 12B redige um campo só: `coaching.summary`**, sobre o estado do canal e os padrões de série. Todo o resto do PATCH é do código (§4.3).

**Mensagens.** `[{system: SISTEMA_FILA}, {user: json.dumps(ENTRADA, ensure_ascii=False, separators=(',',':'))}]`.
- Na tentativa 2 depois de reprovação no validador, o `user` vira `{"entrada":ENTRADA,"corrigir":{…}}`; depois de falha de infraestrutura, repete a mensagem da tentativa 1 (§4.5 item 6).
- **Nunca há dois `user` seguidos**: o template do Gemma exige alternância (`trilha/t4.py:48`), e com `--jinja` dois `user` seguidos dão 500.

**`ENTRADA`**

```
{"canal":{"nome":str,"videos":"35","views_90d":"29","inscritos_90d":"0","data_base":"18/09/2026",
          "ultimo_video":"10/12/2024","dias_sem_publicar":"647","n_series":"1"},
 "series":[{"nome":str,"n":"11","ano":"2019","mediana_views_vida":"91","razao_coorte":"0,63×","leitura":"abaixo da coorte"}]}
```

- **Formato dos valores.** Todo número é string pt-BR exibível e **sem sinal**. O modelo nunca vê UUID. `data_base` = `recent_window.date` (dd/mm/aaaa); com `recent_window` nulo, `hoje` (dd/mm/aaaa).
- `series` são os padrões que vão no PATCH, na ordem de `escolher`; `n_series` é quantos são. `series[].nome` passa por `sitio._t` (`sitio.py:141-142`).
- `views_90d`/`inscritos_90d` são as somas de `recent` do §4.2; com `recent_window` nulo, as duas chaves saem da `ENTRADA`.
- `ultimo_video` = o maior `published_at` do snapshot (dd/mm/aaaa, fuso de São Paulo), e `dias_sem_publicar` é `data_base` menos essa data, em dias (§4.2, função pura), para que todo número de `canal` se refira à mesma data. `series[].ano` = o ano da série (§4.2, episódio mediano). `leitura` = `"acima da coorte"` se `razao` ≥ 1,5, `"abaixo da coorte"` se ≤ 0,67. É calculada pelo código, e o modelo nunca deduz a direção de `razao_coorte`.

**`SISTEMA_FILA`**
- Citar só números de `canal` e `series`; percentuais e razões, só os prontos, sem converter um no outro.
- Nunca calcular. O tempo sem publicar aparece só como os dias de `dias_sem_publicar` ou como a data de `ultimo_video`, nunca em meses ou anos.
- Nunca escrever CTR, taxa de cliques, impressões, retenção, tempo de exibição, engajamento, curtidas, comentários, nota ou score, **nem para dizer que faltam**: o código já avisa. Nunca escrever nomes de campo (`views_90d`, `razao_coorte`…).
- A direção de cada série é a de `leitura`, com as mesmas palavras. Nunca dizer "acima" ou "abaixo" por conta própria.
- Tamanho e idioma: `summary` em 2 frases, em pt-BR, com no máximo 300 caracteres.
- Glossário (texto fixo no prompt; as chaves só explicam a entrada e nunca vão para o texto): `videos` = vídeos do canal no banco, de toda a vida do canal; `views_90d`/`inscritos_90d` = views e inscritos ganhos pelo canal nos 90 dias até `data_base`; `ultimo_video` = data do vídeo mais recente; `dias_sem_publicar` = dias entre `ultimo_video` e `data_base`; `n_series` = quantas séries se afastam da coorte; em cada série, `n` = número de episódios, `ano` = ano da série, `mediana_views_vida` = mediana das views de cada episódio desde que foi publicado, `razao_coorte` = essa mediana dividida pela mediana dos vídeos do mesmo período fora da série.
- O contrato de saída fica escrito aqui porque o llama.cpp transforma `S` só em gramática e não o põe no prompt: `summary` = o estado do canal e o que os padrões de série mostram.

**Pedido.** `POST 127.0.0.1:8080/v1/chat/completions` com:
- `response_format: {type:"json_schema", json_schema:{name:"redacao", strict:true, schema:S}}`;
- `temperature 0.4`; `seed` = `secrets.randbelow(2**31)`, sorteado a cada tentativa, inclusive na sombra, e gravado no jsonl (`seeds`) e no arquivo da sombra. Nunca é fixo: com seed fixo, as 3 rodadas do F2 dariam o mesmo texto;
- `chat_template_kwargs: {enable_thinking: false}` (como a fase 1, `trilha/s2.py:93`);
- `max_tokens 6144`, timeout = `min(600 s, orçamento restante − 120 s)`.

**`S`** = `{"type":"object","properties":{"summary":{"type":"string","minLength":60,"maxLength":MAX}},"required":["summary"],"additionalProperties":false}`, com `MAX = 500 − len(AVISO_ESTREITO) − 10` calculado no import a partir da constante (440 com o aviso atual de 50 caracteres). O `teste_fila` confere `MAX ≥ 300` e `len(AVISO_ESTREITO) + 1 + MAX ≤ 500` em UTF-16.

**Faixa** — limite da gramática, abaixo do Zod (`CoachingSchema.summary .max(500)`, `intelligence-schemas.ts:17`):

| Campo | Faixa |
|---|---|
| `summary` | 60 – (500 − len(AVISO_ESTREITO) − 10) |

- **Idioma.** O texto analítico é sempre pt-BR. Nomes de série vão entre aspas, sem tradução.
- **Aparo.** Um `summary` que termine sem `.`, `!` ou `?` é aparado no último `[.!?]` seguido de espaço ou fim. O corte não vale para pontuação dentro de aspas, entre dígitos ou logo após `Ep|Part|vs|nº`. Se sobrarem menos de 60 caracteres (o mínimo da faixa), reprova com motivo `curto`. O aparo roda depois do Aceite, como primeiro passo do validador, então uma reprovação `curto` conta como "chegou ao validador": leva à tentativa 2 com `corrigir` ou ao template, nunca a `fail`. O log conta quando bateu no teto (`motivos: teto`).

**Aceite.** A resposta é aceita só com `finish_reason == "stop"`, `reasoning_content` vazio ou ausente, `json.loads` sem erro e o conjunto de chaves igual a `{"summary"}`. Qualquer outra coisa reprova a tentativa: `truncado|timeout|json|llama|pensou`. O log grava `usage`, `len(reasoning_content)` e `timings.predicted_per_second`.

**O código nunca lê do modelo** número, padrão ou prioridade: só a string `summary`. Depois da validação, monta o PATCH com os campos do §4.3 e prefixa o `summary` com `AVISO_ESTREITO` ("Sem CTR/retenção nesta fase; base: views e séries.", até 80 caracteres). Os itens 3–5b do validador (§4.5) rodam só sobre o texto gerado; os itens 1–2, sobre o payload montado.

### 4.5 Validador local

**1. Espelho do Zod.** Espelho em Python dos limites de `PatchPayloadSchema`, inclusive os tetos novos. Tamanhos em UTF-16. Texto gerado com caractere fora do BMP reprova antes, com motivo `emoji`.

**2. Escopo 2a.** O payload montado tem `coaching`, não tem `video_recommendations` nem `notifications`, e `coaching.priorities == []`. Falhar aqui, ou no espelho do Zod (item 1) depois da montagem, é bug do código: termina em `fail {reason:'escopo: <campo>'|'zod: <campo>'}` **sem** `retry`, porque repetir daria o mesmo payload. O desfecho é `reprovada`, com `etapa: validar` e `motivos: zod|escopo`, e o PATCH não é enviado (espelho das recusas do §3.3). O `teste_fila` cobre essa saída.

**3. Números.** O `summary` só cita valores de `canal` e `series` da `ENTRADA` enviada.

**4. Normalização** (função pura, com teste de tabela).

- **(0) Tokens permitidos.** São `tokens(normalizar(v))` das strings de `canal` e `series`, pela **mesma função** usada no texto gerado.
  - `nome` e `series[].nome` nunca geram token. Um número de nome de série passa pela etapa (a2).
  - Cada token é `(valor, tipo)`, com tipo ∈ {número, %, ×, data, ano}, e só casa com o mesmo tipo.
  - `−` e `-` são descartados: a comparação é por valor absoluto.
- **(a) Títulos entre aspas:** fica para a 2b (§7). Na 2a o modelo não vê títulos, e os nomes de série saem pela (a2).
- **(a2) Nomes de série.** Sai **toda ocorrência literal** de `norm(_t(series[].nome))` da `ENTRADA` enviada, entre aspas ou não e **sem mínimo de tamanho**. `-`, `–` e `—` são equivalentes na comparação. Teste de tabela: `a série 0–10 rende 0,63× da coorte`, `a série '0-10'` e o template com “0–10” passam; `os vídeos 0 a 10` reprova.
- **(b) Datas e anos**, nesta ordem de alternância: `\d{1,2}/\d{1,2}/\d{4}`, `\d{1,2}/\d{4}`, `\d{1,2}/\d{1,2}`, `\d{1,2} de <mês>( de \d{4})?`, `<mês>(\.)?( de|/)? ?\d{4}` (com `jan…dez`) e `\b(20(0[5-9]|[12]\d|30))\b`.
  - Cada um vira `(dia|None, mes|None, ano|None)` e casa quando todo componente não nulo do texto é igual ao de um permitido: `data_base`, `ultimo_video` e `(None, None, series[].ano)`.
  - Teste de tabela (com a `ENTRADA` do §4.4): `12/2024`, `dezembro de 2024`, `dez/2024`, `em 2024`, `18/09`, `18 de setembro de 2026`, `a série de 2019` passam; `em 2023` e `11/2024` reprovam.
- **(c) Número:** `\d{1,3}(\.\d{3})+|\d+(,\d+)?`, com sufixo `%|x|×| vezes`, lido em pt-BR.
- **(d) Por extenso.**
  - `metade|dobro|triplo` e `<dois|duas..vinte> vezes` reprovam (motivo `extenso`): o `SISTEMA_FILA` proíbe converter razões.
  - `dois|duas..vinte` sem ` vezes` são tokens `número`.
  - "um"/"uma" são artigo e não contam.
  - Tempo em anos ou meses reprova, com motivo `tempo`: `\b(\d+|um|uma|meio|dois|duas|tres|quatro|cinco) (anos?|mes|meses)\b` (sem acento). O tempo sem publicar só aparece em dias ou pela data do último vídeo.
- **(e) Constante** sempre permitida: só 90 (a janela de `recent` e do template, guardada pelo §4.1 passos 4–5). 28 e 30 não entram, porque não há janela dessas no dado (§10). 60, 180 e `top 3` eram das regras R4 e dos eixos, e voltam com elas na 2b (§7).
- **(f) Igualdade estrita:** um número do texto casa só com o valor exibido na `ENTRADA` (mesmo tipo, mesmas casas). Arredondamento e `mil`/`milhões` voltam só se o F2 mostrar reprovação por eles.

**5. Proibidos** (sem acento, com borda de palavra):

`\b(ctr|taxa de cliques|impress(ao|oes)|retenc(ao|oes)|retid[oa]s?|tempo (de )?exibic(ao|oes)|watch ?time|nota [0-9]|nota [a-f] ?(no|na|do|da|de)|score|impressions?|retention|engajamento|engagement|curtidas?|likes?|comentarios?|duracao media|tempo medio)\b`

- Também reprovam rótulos crus: `\b[a-z]+_[a-z_]+\b` (`rotulo_cru`).
- Os itens 3–5 rodam sobre o texto já sem os nomes de série retirados pela etapa (a2); o 5b usa esses nomes para achar a série de cada frase.
- Na tabela de teste, "grade de horarios" e "a nota e o titulo" passam; "tempo de exibicao" reprova.

**5b. Direção** (sem acento, com borda de palavra). O `summary` é cortado em frases por `[.!?]`, com as mesmas exceções do Aparo (§4.4). Numa frase que cite o nome de uma série só (casado pela etapa (a2)), reprova, com motivo `direcao`:
- se a `leitura` da série for "abaixo da coorte": `acima|supera(m)?|superior(es)?|melhor(es)? que`;
- se for "acima da coorte": `abaixo|inferior(es)?|pior(es)? que|fica(m)? atras`.
- Uma frase que cite duas séries de leituras opostas não é checada. O template do item 6 passa, porque a única palavra de direção que ele usa é a própria `leitura` da série.
- Teste de tabela (com a `ENTRADA` do §4.4): "a série 0–10 fica abaixo da coorte (0,63×)" passa; "a série 0–10 supera a coorte, com 0,63×" reprova.

**6. Reprovação.**
- **Tentativa 2** (depois de reprovação no validador). Um `user` só (ver §4.4), com `corrigir: {"summary":{"anterior":"…","motivo":"…","permitidos":[…]}}`.
  - `permitidos` = os valores de `canal` e `series` da `ENTRADA` enviada, exceto `nome` e `leitura`, na ordem da `ENTRADA` e sem repetição, mais "90". Com a `ENTRADA` do §4.4: `["35","29","0","18/09/2026","10/12/2024","647","1","11","2019","91","0,63×","90"]`.
  - `motivo` = frases fixas por código de reprovação, unidas por "; ": `numero`/`data` → "cite só valores de permitidos, sem converter nem calcular"; `extenso` → "cite as razões só como estão em permitidos"; `proibido` → "tire as métricas que não estão na entrada" (nunca repete o termo achado; quando `proibido` ou `rotulo_cru` está entre os motivos, `anterior` vai com cada ocorrência achada trocada por `[…]`); `rotulo_cru` → "não use nomes de campo"; `curto` → "escreva 2 frases completas"; `emoji` → "sem emoji"; `direcao` → "use para cada série a direção de leitura"; `tempo` → "diga o tempo sem publicar só em dias ou pela data do último vídeo".
  - A resposta da tentativa 1 não entra como turno.
  - O schema é o mesmo `S`, com outro `seed`.
  - O canário passa essa mensagem pelo `/apply-template` real.
- **Depois da tentativa 2.** O `summary` ainda reprovado vira **template do código**, montado só com `canal` e `series`, com todo nome de série entre “ ”: "Canal com {videos} vídeos no banco e {views_90d} views nos últimos 90 dias até {data_base}. Séries com efeito: “{nome}” ({razao_coorte}, {leitura}), …" (sem série: "Nenhuma série se afasta da coorte do mesmo período."; sem `recent_window`, sai a oração das views). As séries entram em ordem até caber na faixa.
  - O template passa no mesmo validador, e o teste de tabela cobre o template com 0, 1 e 2 séries e um nome de série com dígitos.
  - O log grava `fallback: [summary]`.
- **Pouco orçamento.** Com menos de 9 min restantes depois da tentativa 1, a tentativa 2 é pulada. Se a tentativa 1 chegou ao validador e reprovou nele (itens 3–5b, ou `curto` no Aparo do §4.4), o `summary` vai para o template e o PATCH segue. Se não chegou (llama fora ou `truncado|timeout|json|pensou`), a execução termina em `orcamento`: `fail {reason:'orcamento', retry:true}`, sem PATCH (§4.1 passos 4–5).
- **Tentativa 2 depois de falha de infraestrutura** (llama fora, ou `truncado|timeout|json|pensou`, na tentativa 1): vai a mesma mensagem da tentativa 1, sem `corrigir`, com outro `seed`.
- **Desfecho misto.** Se ao menos uma tentativa passou do Aceite e chegou ao validador, o fim é o `summary` aprovado ou o template, nunca `fail`.
- **`fail` só por infraestrutura ou por guarda determinística.** Com `retry`: `llama` (as duas tentativas sem chegar ao validador, por llama fora ou `truncado`/`timeout`/`json`/`pensou`) ou `orcamento` (a tentativa 1 sem chegar ao validador, com menos de 9 min restantes). Sem `retry` (`reprovada`): Zod reprovado depois da montagem ou escopo 2a violado (itens 1–2), piso de dado (§4.3) ou janela ≠ 90 (§4.1 passos 4–5). Um `summary` reprovado pelo validador nunca dá `fail`: vira template.

### 4.6 `sitio.py`, trava e segredos

**`pedir`** (hoje `pedir(cli, metodo, caminho, params, agora)`, sempre `cli.get`, `sitio.py:90-127`)
- **Na fase 1, nada muda.** O GET continua em `cli.get`, byte a byte igual. O ramo de status de `sitio.py:108-116` fica intocado: 3xx/4xx → `formato`; 5xx/429 → `_velho` (`teste_s1.py:80-95`). `teste_s1`/`teste_s2` passam sem edição.
- **Método não-GET** usa `cli.request(metodo, …, json=corpo, follow_redirects=False)`. O `CliFalso` (`trilha/sitio_falso.py`) ganha `request(metodo, url, params=None, json=None, headers=None, timeout=None, follow_redirects=True)`. Ele grava em `chamadas` a mesma tupla de 3 que o `get()` e, numa lista nova `pedidos`, `(metodo, caminho, json)`. O construtor ganha `respostas={(metodo, rota-regex): (status, corpo_bytes)}`, consultado pelo `get()` e pelo `request()` antes de `status`. Com ele o teste serve 204, `{"error":{"code":…}}`, corpo não-JSON e respostas diferentes para o GET do snapshot e o PATCH na mesma rota. Sem `respostas`, o `get()` continua como hoje, e `teste_s1`/`teste_s2` passam sem edição.
- **Parâmetros novos, só por palavra-chave:**
  - `corpo=None`;
  - `fase=FASE`, repassado a `autorizada`;
  - `chave=None`;
  - `timeout=None`: quando dado, substitui `TIMEOUT_LENTO.get(caminho, TIMEOUT)`. O `fila_intel.py` passa 15 s no claim, no fail e no snapshot, 60 s no PATCH (`httpx.Timeout(60, connect=5)`) e `httpx.Timeout(8, connect=3)` sob `asyncio.wait_for(…, ESPERA_FAIL_MORTO)` no `fail` do `finally` (§4.1).
- **Com `fase=2` (qualquer método) ou método não-GET:**
  - não lê nem grava `_CACHE`, não chama `_velho` e não repete a chamada;
  - exige `chave=` explícito; sem ele, `FalhaSite(caminho, …)` do tipo `sem_chave` antes da rede;
  - 204 → `(None, t, False)`.
- **`FalhaSite`** ganha `status=None, code=None` por palavra-chave e mantém `tipo, rota, detalhe` posicionais. O mapeamento de fase 2:

| Resposta | `FalhaSite` |
|---|---|
| 400/404/409/422/500 | `('recusa', rota, str(st), status=st, code=…)`; `code` só quando o corpo é JSON e `error` é um objeto com `code`, senão `None`, sem exceção |
| 401/403 | `('chave', rota, str(st), status=st)`: o `--canario` e o F1 conferem `status == 403` (um 401 reprova) |
| 429 | `('429', rota, status=429)` |
| 501–599 | `('5xx', rota, status=st)` |
| rede | `('timeout'\|'fora', rota)` |
| 3xx e qualquer outro 4xx | `recusa` |

  `recusa` não entra em `MENSAGEM`: o proxy nunca a vê.
- **Falha transitória no `fila_intel.py`.** Ele decide sempre por `status` (e por `code` só para separar `PARTIAL_FAILURE`), nunca por `tipo`. Uma falha é **transitória** (`retry:true` no snapshot; `indeterminado` com `fail {retry:true}` no PATCH, "outro 5xx") quando `tipo in {'timeout','fora','429','5xx'}` **ou** quando `status == 500` e `code != 'PARTIAL_FAILURE'` (inclusive `code=None`). Um 200 com corpo `formato`/`grande` (`sitio.py:118-124`; com `fase=2` essa `FalhaSite` leva `status=200`) é `falha_site` sem `retry`, exceto no PATCH, onde é `ok` (tabela do §4.1 passo 6). O `teste_fila` tem uma linha para cada caso, e mais: 500 `INTERNAL_ERROR` no PATCH → `indeterminado` e um `fail` com `retry` (`fail`→409 mantém `indeterminado`); 500 no snapshot → `fail {retry:true}`; 500 no claim → `falha_site` com `etapa: claim`.
- **`FASE = 1` não muda.** Só o `fila_intel.py` passa `fase=2`.
- **`ROTAS_FASE[2]`** = fase 1 + `POST …/task/claim`, `POST …/task/<uuid>/fail`, `GET …/intelligence?channel_id=<uuid>` e `PATCH …/intelligence`.

**Testes do cartão S4**
- Com a fase padrão, claim, fail e PATCH levantam `RotaBloqueada` sem rede.
- Com `fase=2`: nada vem de cache nem de `_velho` num 5xx; sem `chave=` dá `sem_chave`; 204 devolve a tupla; 409 dá `recusa` com status e code; corpo de erro não-JSON dá `code=None`; `timeout=` é respeitado.
- `teste_s1`/`teste_s2` passam sem edição.
- O `teste_s4.py` carrega o `sitio` como `teste_s1.py:7-11`: `AGENTE_SITIO` ou, na falta, `../../sitio.py.novo`. O `cartao.sh:22` só passa `AGENTE_PROXY`.

**Instalação**
- **`sitio.py`**, só pelo **cartão S4**. O `trilha/s4.py` copia `proxy.py` para `proxy.py.novo` sem alteração e escreve o `sitio.py.novo` (0600), que é o que `cartao.sh:8-9` e `deploy.sh:11` esperam. Replay com `mudaram: 0`.
- **`deploy.sh`** toma o lock por descritor **antes** da guarda de mídia (`deploy.sh:7`) e o segura até o fim: `exec 9>>/opt/agente/fila_intel.lock; flock -n 9 || { echo 'ESPERAR: fila_intel em execução'; exit 1; }`.
  - A troca (`:11`) e o restauro do rollback (`:20`) do `sitio.py` passam a copiar para um temporário e fazer `mv`, porque o cron importa o `sitio.py` a cada execução.
- **`cartao.sh`** ganha, depois da linha 22, `[ "$T" = S4 ] && { (cd docs/trilha && AGENTE_SITIO="$B/sitio.py.novo" $PY -B teste_s1.py) || falha teste_s1; }`. O `teste_s2` roda depois do `deploy.sh S4`, porque o proxy carrega o `sitio.py` do próprio diretório (`trilha/s2.py:20`). O `cartao.sh` também ganha:

  ```
  if [ -s sitio.py.novo ]; then F="$B/fila_intel.py"; [ -f "$F" ] || F="$B/docs/trilha/fila_intel.py"; [ -f "$F" ] || falha 'sem fila_intel.py'; (cd docs/trilha && flock "$B/fila_intel.lock" env -u PYTHONPATH -u AGENTE_BASE AGENTE_SITIO="$B/sitio.py.novo" AGENTE_FILA="$F" /opt/agente/venv/bin/python -B teste_fila.py) || falha teste_fila; fi
  ```

  - No S4 o `fila_intel.py` instalado ainda não existe (entra no F1), então o teste usa a cópia de trabalho que o K levou; sem nenhuma das duas, o cartão falha em vez de pular o teste.
  - O `env -u` tira o stub `st/httpx.py` do caminho.
  - O `teste_fila.py` carrega o worker só por `AGENTE_FILA` (SourceFileLoader, como `replay2.py`), nunca a cópia de `docs/trilha/`.
  - O `fila_intel.py` nunca faz `import sitio`. Ele carrega o módulo por caminho, `os.environ.get('AGENTE_SITIO') or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sitio.py')`, por `spec_from_file_location`, como `trilha/s2.py:19-22`. O carregamento fica numa função chamada por `main()` e pelo teste. O `teste_fila` confere que o módulo carregado é o de `AGENTE_SITIO`: `ROTAS_FASE` tem a chave 2.
- **`fila_intel.py`** vai por scp para `docs/trilha/` e é instalado sob o lock:

  ```
  cd /opt/agente && flock /opt/agente/fila_intel.lock sh -c 'cp -p fila_intel.py fila_intel.py.bak 2>/dev/null; install -m 600 docs/trilha/fila_intel.py fila_intel.py.tmp && mv fila_intel.py.tmp fila_intel.py'
  ```

  - Só depois de `teste_fila.py` passar **na forja**, a cada instalação ou atualização: `(cd /opt/agente/docs/trilha && flock /opt/agente/fila_intel.lock env -u PYTHONPATH -u AGENTE_BASE AGENTE_SITIO=/opt/agente/sitio.py AGENTE_FILA=/opt/agente/docs/trilha/fila_intel.py /opt/agente/venv/bin/python -B teste_fila.py)`.
  - Um cartão que reverta o `sitio.py` comenta antes a linha do crontab.
  - Voltar uma atualização do worker: `cd /opt/agente && flock /opt/agente/fila_intel.lock sh -c 'cp -p fila_intel.py.bak fila_intel.py.tmp && mv fila_intel.py.tmp fila_intel.py'`, e depois o mesmo `teste_fila.py` acima com `AGENTE_FILA=/opt/agente/fila_intel.py`.
- **O `teste_fila.py` cobre no mínimo**, com `CliFalso` e llama falso:
  - cada linha das tabelas do §4.1 passos 3 e 6 (no `indeterminado`, um `fail` com `retry`; `fail`→409 mantém `indeterminado`), e cada saída dos passos 4–5 (`retry:true` para llama, orçamento e snapshot timeout/5xx/429; sem `retry` nos demais; `fail`→409 = `conflito`; `fail` que falha = `fail_perdido`), conferindo quantas vezes `fail`/PATCH são chamados (0 ou 1) e com qual `retry`;
  - `CANAIS_FILA` vazio ou desconhecido → `config`, sem chamadas ao site;
  - `/slots` com um slot ocupado → `ocupado`; `/slots` recusando conexão ou com 500 → `llama_fora`; nos dois, zero claims;
  - SIGTERM depois do claim (o llama falso chama `signal.raise_signal(signal.SIGTERM)`, o que prova que `main()` instalou o handler; o teste restaura o handler anterior ao fim) → exatamente um `fail` com `retry` e `reason` `morto:<etapa>`, e uma linha `morto`;
  - `SystemExit` com o PATCH enviado e sem resposta, e na espera do 429 → exatamente um `fail` com `retry` e linha `morto`; `SystemExit` depois de PATCH 200/409/401 ou com `fail` já enviado → nenhum `fail`;
  - `SystemExit` depois do claim com o `fail` do `finally` pendurado no `CliFalso` (e `ESPERA_FAIL_MORTO` reduzida a 0,2 s pelo teste) → a linha `morto` é gravada mesmo assim;
  - saída `reprovada` com o `fail` perdido → nenhum segundo `fail`, e a linha é `fail_perdido`, não `morto`;
  - lock ocupado → 0 no cron e 75 no manual. Com o worker parado no llama falso depois de tomar a trava, um `flock -n` de outro processo no mesmo arquivo falha;
  - exatamente uma linha jsonl por execução com lock;
  - nenhum valor de chave no jsonl;
  - o PATCH montado com `coaching`, sem `video_recommendations` nem `notifications`, com `coaching.priorities: []`. Um `escolher` adulterado que devolve 1 prioridade → um `fail` sem `retry`, zero PATCH, `desfecho: reprovada`, `etapa: validar`;
  - exceção em `features` depois do claim → um `fail` sem `retry` e linha `bug`;
  - `recent_window.days` ≠ 90 → um `fail` sem `retry`, `desfecho: reprovada`, `motivos: janela_<n>`;
  - claim às 12:00 UTC (relógio injetado) → `ocupado`, `motivos: janela_sync`, zero claims;
  - llama falso que reprova o `summary` nas duas tentativas por validador (números/proibidos) → PATCH enviado uma vez com o `summary` de template, `fallback: [summary]`, `desfecho: ok` e **nenhum** `fail`; com menos de 9 min de orçamento (relógio injetado), uma chamada ao llama só. Um caso por combinação de tentativas: validador × infra e infra × validador → PATCH (template ou aprovado), nenhum `fail`; infra × infra → zero PATCH, um `fail` com `retry`, `desfecho: llama`; tentativa 1 em `timeout` com menos de 9 min restantes → zero PATCH, um `fail` com `retry`, `desfecho: orcamento`;
  - snapshot com 7 vídeos → zero chamadas ao llama, zero PATCH, um `fail` sem `retry`, `desfecho: reprovada`, `motivos: dado_insuficiente`;
  - `--sombra` e `--escolher` → zero chamadas ao `CliFalso`; `--canario` → exatamente dois `POST …/00000000-0000-4000-8000-000000000000/fail` (chave da fila e chave `{read}`) e nenhum claim;
  - rotação: jsonl com 5.001 linhas fica com 4.000; `.err` com 2.001 linhas fica com 1.500 e com o mesmo `st_ino`;
  - os de `features`/`escolher` (§4.2, §4.3) e o validador (§4.5).

**Segredo**
- `SITIO_CHAVE_FILA` e `CANAIS_FILA` moram em `/opt/agente/fila_intel.env` (thiago:thiago 0600), que nenhuma unit carrega.
- No modo normal, **toda** chamada passa `chave=` com a chave da fila.
- `--canario` e os scripts de apoio (§4.7) leem `SITIO_CHAVE` (a `{read}`) de `/etc/default/proxy-agente` pelo próprio Python. Nunca por argv, env do cron ou `set -a`. `--sombra --snapshot arq` e `--escolher --snapshot arq` não leem chave nenhuma e não abrem conexão com o site (na 2a não há `--congelar`, §7).
- O leitor nunca põe a linha nem o valor em exceção ou log.
- **O5 da onda0b (pré-condição resolvida em 19/09).** O `install` do O5 troca `/etc/default/proxy-agente` inteiro, e o `gerar_segredos.py` agora preserva as linhas que não são as 4 credenciais (`preservadas()`), então `SITIO_CHAVE`/`SITIO_CANAL_*` sobrevivem. Prova, depois de qualquer mexida no arquivo: `grep -cE '^SITIO_(CHAVE|CANAL_PT|CANAL_EN)=' /etc/default/proxy-agente` → 3.
- **Provas:**
  - `grep -c SITIO_CHAVE_FILA /etc/default/proxy-agente` → 0;
  - `tr '\0' '\n' < /proc/$(systemctl show -p MainPID --value proxy-agente)/environ | grep -c FILA` → 0 (sem sudo: o serviço roda como `thiago`);
  - `sed -n 's/^SITIO_CHAVE_FILA="\(forja_[A-Za-z0-9_-]\{43\}\)"$/\1/p' /opt/agente/fila_intel.env | wc -l` → exatamente 1. Sem isso, a prova seguinte é vazia e passa sozinha;
  - o comando abaixo, sem o valor em argv, dá 0:

  ```
  grep -rlFf <(sed -n 's/^SITIO_CHAVE_FILA="\(.*\)"$/\1/p' /opt/agente/fila_intel.env) /opt/agente/log/ /opt/agente/sombra/ | wc -l
  ```

**Kit da chave**
- **`nova_chave.py --fila`** desvia **antes** das checagens de `/etc/default/proxy-agente` (`nova_chave.py:11-18`).
  - Troca só a linha `SITIO_CHAVE_FILA="forja_…"` em `/opt/agente/fila_intel.env` e preserva as demais (`CANAIS_FILA`), filtrando `^SITIO_CHAVE_FILA=` como `nova_chave.py:22` faz antes de reescrever com `O_TRUNC`.
  - Recusa se o arquivo não existir ou não for 600, e se já houver chave sem `--trocar`.
  - Imprime o SQL com `'forja (fila)'` e `array['read','intelligence']`.
- **`seed_chave_forja.sh`:**
  - `$1` de 64 hex → modo da fase 1;
  - `$1 = fila` → o hash é o `$2`, validado por `^[0-9a-f]{64}$`, e grava `'forja (fila)'` com `{read,intelligence}`. No mesmo SQL, revoga (`revoked_at = now()`) toda outra `'forja (fila)'` ativa do site com `key_hash <> $2`. Depois confere que resta exatamente uma ativa, ou para;
  - qualquer outra forma → `pare`;
  - nome e permissões vêm de um `case` fechado; depois do insert, confere as permissões e para se o hash já existia com outras.

### 4.7 Modos auxiliares

Todos tomam o lock do §4.1. `--sombra` e `--canario` passam antes pelas checagens de `/slots` e de chat recente do §4.1 passo 2 (a janela do sync não entra). Se alguma falhar, saem com `ocupado`/`llama_fora`/`chat` sem chamar o llama, e o dono repete. As linhas desses modos levam `modo` e não contam para o pulso.

- **Scripts de apoio** (antes do S4, fora do `sitio.py`, que ainda é da fase 1): `trilha/capturar_fixture.py` e `trilha/sonda_f0.py`.
  - Leem a chave `{read}` pelo Python e usam `httpx` direto. Por isso rodam sempre com `cd /opt/agente && venv/bin/python -B docs/trilha/<script>.py`, nunca com o `python3` do sistema, que não tem `httpx`.
  - `capturar_fixture` faz **só GET**.
  - Nenhum dos dois é importado pelo proxy nem pelo `fila_intel.py`.
- **`--sombra --snapshot arq`:** sem claim, sem PATCH e sem fail.
  - `hoje` = `congelado_em`, nunca o relógio.
  - Grava `/opt/agente/sombra/<canal>-<quando>.json` (`<canal>` = rótulo `PT`/`EN` de `CANAIS_FILA`, nunca o uuid) com o `system`, o `user`, o payload (com `task_id` = `00000000-0000-4000-8000-000000000000`), o veredito e os tempos. Mantém os 30 mais recentes.
- **`--escolher --snapshot arq`:** sem rede, sem llama e sem `fila_intel.env`. Imprime os vídeos fora de `series.json` (todos, quando ele não existe) e a saída de `escolher` (§4.3). Roda antes do F1, pela cópia de trabalho: `cd /opt/agente && AGENTE_SITIO=/opt/agente/sitio.py venv/bin/python -B docs/trilha/fila_intel.py --escolher --snapshot docs/trilha/fixture_pt.json`. O `AGENTE_SITIO` é obrigatório aqui: sem ele o carregamento por caminho do §4.6 procura `docs/trilha/sitio.py`, que não existe (o K leva o `sitio.py` para `docs/`, não para `docs/trilha/`). O `--escolher` só usa `_t`, que o `sitio.py` da fase 1 já tem (`sitio.py:141-142`), e nunca exige `ROTAS_FASE[2]`.
- **`--canario`:** não clama.
  - Faz `POST …/task/00000000-0000-4000-8000-000000000000/fail {reason:'canario'}` com a chave da fila e espera 404. Um 400 reprova: o corpo foi recusado antes da busca.
  - Repete o mesmo pedido com `SITIO_CHAVE` (a `{read}`), lida pelo próprio Python de `/etc/default/proxy-agente`, e espera 403.
  - Sonda a 8080 com o `S` real (só `summary`) e a `ENTRADA` da fixture: resposta válida pelo Aceite do §4.4 e `reasoning_content` vazio. O tempo fica com o portão do F2 (§5); o log continua gravando `timings.predicted_per_second` (§4.4).
  - Passa a mensagem de tentativa 2 pelo `/apply-template`.

## 5. Rollout

| Card | Quem | O quê | Portão |
|---|---|---|---|
| **F0** | Claude + dono | Commit do site (§3) em staging → main | Mockup (selo, linha de summary, tela sem "Potencial"/"regras fixas", botão "Pedir diagnostico") aprovado **antes** do código · `(cd apps/web && npx vitest run)` completo (~160 s) + `npm run db:start && npx supabase@2.98.2 db reset --local && (cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/youtube-intelligence-forja.test.ts)` (a mesma sequência de `ci.yml:135-137`) + typecheck web/api · CI (`ci.yml`) verde no push de staging, inclusive o job de integração · Vercel verde · validação **autenticada antes da promoção** (`docs/ops/runbook-cms-e2e-local.md`): varredura da sidebar 200/`ok`, e `/cms/youtube/analytics` sem boundary, com console sem `error`. Localmente não há conexão YouTube com token válido, então a página para em "Nenhuma conexão YouTube encontrada" (`page.tsx:32-46,73-81`); os cenários A–C do §3.7 ficam no teste jsdom: A → "por Cowork · 18/05", linha de summary, 3 cards, badge 3; B → "por forja", summary, sem card verde, sem "Potencial", sem "regras fixas", sem badge; C → heurístico · **depois da promoção**, com `sonda_f0.py` na forja (levado pelo card K; chave `{read}` lida pelo Python): `GET …/intelligence?channel_id=<PT>` → 200 com `recent_window` (prova o deploy novo); só então, `POST …/task/claim {channel_ids:[<uuid inexistente>]}` e `PATCH …/intelligence` vazio → 403 cada; e `GET …/intelligence/task` → 403, feito logo depois do 200 com `recent_window`, que já prova o código novo. Se ainda assim vier 200, a task clamada pela chave `{read}` vira `stale` pelo watchdog em 30–60 min. Qualquer outro status reprova; um 200/204 dispara o rollback do F0 · logado em prod, PT "por Cowork · 18/05" com a linha de summary, 3 cards e badge 3 |
| **K** | dono, no Mac | Antes do portão pós-promoção do F0, e de novo sempre que o kit mudar: `cd ~/Workspace/forja/ferramentas/docs && scp -r sitio.py trilha forja:/opt/agente/docs/` (leva `trilha/sonda_f0.py`, `capturar_fixture.py`, `s4.py`, `teste_s4.py`, `teste_fila.py`, `nova_chave.py`, `cartao.sh`, `deploy.sh` e `fila_intel.py`, como o passo 1 do S1 da fase 1) e, só no K que antecede o F4, `scp ~/Workspace/forja/ferramentas/fase2/pulso_f4.py ~/Workspace/forja/ferramentas/fase2/teste_pulso_fila.py forja:/opt/agente/docs/`. Claude prepara as linhas, e o dono as roda. O `docs/trilha/fila_intel.py` é só a cópia de trabalho; quem instala é o §4.6. A `fixture_pt.json` e o `series.json` nunca entram no kit (`ferramentas/docs/trilha/`): assim o `scp -r trilha` do K nunca sobrescreve a fixture que o dono conferiu no F0.5 | `md5sum` de cada arquivo na forja igual ao `md5` do Mac |
| **F0.5** | dono + Claude | Na forja, `capturar_fixture.py` salva `docs/trilha/fixture_pt.json` com `congelado_em`. O dono traz a fixture ao Mac: `mkdir -p ~/Workspace/forja/ferramentas/fase2 && scp forja:/opt/agente/docs/trilha/fixture_pt.json ~/Workspace/forja/ferramentas/fase2/`. Claude propõe as séries lendo os títulos dessa cópia e, depois que o dono escolhe, escreve `~/Workspace/forja/ferramentas/fase2/series.json`. O dono o leva à forja com `scp ~/Workspace/forja/ferramentas/fase2/series.json forja:/opt/agente/series.json` e confere a saída de `escolher` por `--escolher` (§4.7). As duas cópias no Mac ficam fora do kit e servem só para leitura. Na forja, o `teste_fila` lê a fixture de `docs/trilha/` e o `series.json` de `/opt/agente/` (§4.1, Lock) | Fixture com 35 vídeos e `recent_window` não nulo · `series.json` e lista conferidos |
| **S4** | dono | Cartão da Trilha com o `sitio.py` novo, `s4.py` e o `deploy.sh`/`cartao.sh` do §4.6 | `cartao.sh S4` (replay `mudaram: 0`, `teste_s4.py`, `teste_s1` sem edição e `teste_fila` sobre o `sitio.py.novo`) · `deploy.sh S4` com PID novo · `cd docs/trilha && python3 -B teste_s2.py` sem edição · `prova_site.py agente-auto` 5/5 |
| **F1** | **dono** | Na forja, sem sudo: `cd /opt/agente && { [ -e fila_intel.env ] \|\| install -m 600 /dev/null fila_intel.env; } && mkdir -m 700 -p sombra && python3 docs/trilha/nova_chave.py --fila && { grep -q '^CANAIS_FILA=' fila_intel.env \|\| printf 'CANAIS_FILA=PT\n' >> fila_intel.env; }` (repetível: o `install` só cria o arquivo quando ele falta, porque sobre um existente o trunca e apaga a chave). No Mac: `seed_chave_forja.sh fila <sha>`. Instala o `fila_intel.py` (§4.6) depois de `teste_fila.py` verde na forja | `curl -fsS 127.0.0.1:8080/slots` → 2 entradas com `is_processing` · `cd /opt/agente && timeout -k 30s 25m venv/bin/python fila_intel.py --canario` → 404 com a chave da fila e 403 com a `{read}`, sonda de schema e `/apply-template` aprovados · um turno de chat e, logo depois, a última linha de `roteamento.jsonl` com `quando` a menos de 1 min de `date +%FT%T` (mesmo fuso) · **nenhum claim antes do F4**: no início do F4, `select count(*) from youtube_intelligence_tasks where result_summary->>'claimed_by' in (select id::text from pipeline_api_keys where name = 'forja (fila)')` (dono, leitura) = 0 |
| **F2** | dono roda, Claude lê | 3× `cd /opt/agente && timeout -k 30s 25m venv/bin/python fila_intel.py --sombra --snapshot docs/trilha/fixture_pt.json` (o instalado, que carrega `/opt/agente/sitio.py`), só com o dado real; depois o dono traz os três mais recentes com `scp $(ssh forja 'cd /opt/agente/sombra && ls -t PT-*.json | head -3' | sed 's#^#forja:/opt/agente/sombra/#') <scratchpad>/` para o `safeParse` no Mac (se a saída de `escolher` mudar, o dono confere só a diferença) | Payload final aprovado 3/3 pelo espelho **e** pelo `PatchPayloadSchema.safeParse` real (Claude roda `npx tsx` no Mac sobre os payloads copiados), sem `video_recommendations` e com `priorities: []` · `summary` aprovado na primeira geração em ≥ 2/3, e nunca em template · saída de `escolher` igual à fixture conferida · as 3 rodadas com campos numéricos idênticos · o dono lê os 3 `summary` e aprova (sem o F3, é o único julgamento de texto antes do F4) · ≤ 10 min por rodada e toda geração < 7 min |
| **F4** | dono | (1) Uma execução **manual** sobre a task PT pendente: a do cron de segunda, se existir (aí o botão responde `already_active`); senão, um pedido PT do botão: `cd /opt/agente && timeout -k 30s 25m venv/bin/python fila_intel.py`; (2) `crontab -l > /opt/agente/crontab.bak-F4 && (cat /opt/agente/crontab.bak-F4; echo '<linha do §4.1>') \| crontab -`, conferindo que `crontab -l \| grep -c -e retentar -e pulso` não mudou; (3) só depois de existir ao menos uma linha `modo: cron` com `desfecho` `vazia` ou `ok` (`python3 -c "import json,sys;sys.exit(0 if any(d.get('modo')=='cron' and d.get('desfecho') in ('vazia','ok') for d in (json.loads(l) for l in open('/opt/agente/log/fila_intel.jsonl') if l.endswith('}\n'))) else 1)"` → saída 0; senão espera o próximo ciclo de 10 min), o dono cria o check `URL_FILA` no healthchecks (§6) e a regra do §6 é inserida **no `pulso.sh` vivo** (a O2 é pré-requisito: `grep -c 'yt_hints-sem-200-15min' /opt/agente/docs/pulso.sh` → 1, senão para) por `cd /opt/agente/docs && python3 pulso_f4.py <url do check>`. Ele valida `^https://hc-ping\.com/[0-9a-f-]{36}$` e grava `pulso.sh.tmp` com o bloco inserido antes de `[ "$ok" -eq 1 ]` (âncora com contagem 1, como `trilha/s3.py:troca`), entre as linhas `# >>> fila_intel (F4)` e `# <<< fila_intel (F4)`, com `URL_FILA="<url>"` logo depois da primeira. O script recusa inserir se os marcadores já existem, e o `--remover` apaga do marcador de abertura ao de fechamento, exigindo contagem 1 de cada. Depois: `bash -n pulso.sh.tmp`; `python3 teste_pulso_fila.py pulso.sh.tmp` verde (extrai o bloco pelos marcadores de `pulso.sh.tmp`, troca a linha `URL_FILA=` por `URL_FILA="https://hc-ping.com/00000000-0000-0000-0000-000000000000"` e o roda com `PATH=<tmp>/bin:$PATH`, onde um `curl` e um `sleep` falsos gravam os argumentos e saem 0, e com `FILA_LOG=<fixture>`; confere pela URL gravada se o ping foi o de sucesso ou o `/fail`, e que nenhum pedido chegou ao healthchecks. Casos, sobre jsonl de fixture: arquivo ausente; mtime de 50 min; última linha `modo: cron` com task `reprovada` há 2 h, e depois uma `ok` mais nova; 24 h só com `chat` → `fila-sem-claim-24h:chat`; só a linha `modo: manual` → `fila-sem-claim-24h:nenhuma`; `indeterminado` conta como não-`ok`; 24 h só com `morto` de `etapa: slots` (`claim: null`) → `fila-sem-claim-24h:morto`; última linha truncada (sem `\n`) → ignorada; em todos os casos o `ok` do pulso fica intacto); `cp -p pulso.sh pulso.sh.bak-F4`; `chmod 755 pulso.sh.tmp && mv pulso.sh.tmp pulso.sh` (o arquivo vivo é `/opt/agente/docs/pulso.sh`, num diretório do thiago; a troca por rename funciona sem sudo seja qual for o dono do arquivo) | Depois da troca, uma execução real do pulso com o check `URL_FILA` verde no healthchecks · execução manual: `desfecho: ok` e `result_summary.claimed_by` = id da `forja (fila)` · o próximo pedido PT (task do cron de segunda, ou o botão, só 24 h depois do `completed_at` quando a task do passo (1) foi pedida pelo botão, e na hora quando foi a do cron; antes, conferir que não há `pending`/`running` PT) fica `completed` em ≤ 40 min com o llama livre e sem chat, com `result_summary.claimed_by` = id da `forja (fila)` (SQL de leitura do dono), e aparece "por forja · dd/mm" com sessão autenticada · a linha `cowork` continua no banco · o **EN** só entra em `CANAIS_FILA` com ≥ 8 vídeos e um F2 próprio |

**Rollback, na ordem inversa**
- **F4.**
  - Tira só a linha da fila: `crontab -l | grep -vF '/opt/agente/fila_intel.py' | crontab -`, e confere `crontab -l | grep -c fila_intel` → 0 com `retentar`/`pulso` intactos. Restaurar o `.bak-F4` inteiro apagaria linhas acrescentadas depois do F4.
  - Espera o lock (`flock /opt/agente/fila_intel.lock true`), o que deixa a execução em curso terminar.
  - Tira só o bloco da fila do pulso com `pulso_f4.py --remover` (do marcador `# >>> fila_intel (F4)` ao `# <<< fila_intel (F4)`, contagem 1 de cada; `bash -n pulso.sh.tmp`; `chmod 755 pulso.sh.tmp && mv pulso.sh.tmp pulso.sh`). Não restaura o `.bak-F4` inteiro, pelo mesmo motivo do crontab. Confere `grep -c URL_FILA /opt/agente/docs/pulso.sh` → 0.
  - Na mesma hora, o dono pausa (ou apaga) o check `URL_FILA` no healthchecks. Sem ping, ele fica vermelho em ~1 h e dá um alarme falso no meio do rollback.
- **Qualidade, com o F0 no ar.** O dono, na raiz do repo, por `npx --yes supabase@2.98.2 db query --linked --agent=no -o json "<sql>"`:
  1. exporta `select * from public.youtube_intelligence where source='forja'` com `> ~/Workspace/forja/ferramentas/fase2/forja-export-$(date +%F).json` (fora do repo);
  2. renomeia a de canal (na 2a a forja não tem linha de vídeo, §3.3): `update public.youtube_intelligence set source='forja_retirada_' || to_char(now(),'YYYYMMDDHH24MI') where source='forja'`.

  O sufixo evita colisão com os índices. Prova: `select count(*) from public.youtube_intelligence where source='forja'` = 0, e PT logado mostra "por Cowork". A allowlist do §3.6 volta a mostrar o Cowork, e o Cowork já não lia a forja (§3.5).
- **F1 (dono).** Pelo mesmo `db query`: `update public.pipeline_api_keys set revoked_at=now() where name='forja (fila)' and revoked_at is null`. Depois apaga `/opt/agente/fila_intel.env`.
- **S4 (dono).** O `deploy.sh` só restaura sozinho quando a saúde falha logo depois da troca (`deploy.sh:17-23`). Depois disso, com a linha do crontab já fora (rollback do F4), em `/opt/agente`: `B=$(ls proxy.py.bak-*-S4 | head -1)` (o mais antigo pelo carimbo `%m%d-%H%M` do nome: o `cp -p` do `deploy.sh` preserva o mtime, e um S4 refeito deixa um backup mais novo já com o `sitio.py` da fase 2); `[ -f "$B.sitio" ]` ou para; `flock /opt/agente/fila_intel.lock sh -c "cp -p $B.sitio sitio.py.tmp && mv sitio.py.tmp sitio.py"`; reinicia o `proxy-agente` esperando o PID mudar (a receita de `deploy.sh:13-16`); confere `curl -fsS 127.0.0.1:8081/v1/models`, `(cd /opt/agente/docs/trilha && AGENTE_SITIO=/opt/agente/sitio.py python3 -B teste_s1.py)` sem edição, `prova_site.py agente-auto` 5/5 e `python3 -c "import importlib.util as u;s=u.spec_from_file_location('s','/opt/agente/sitio.py');m=u.module_from_spec(s);s.loader.exec_module(m);assert 2 not in m.ROTAS_FASE"` saindo 0. O `proxy.py` do S4 é cópia idêntica e não volta.
- **F0.** O dono:
  1. com o F0 ainda no ar, exporta (para `~/Workspace/forja/ferramentas/fase2/`, fora do repo, como no rollback de qualidade) e apaga `where source like 'forja%'`. O snapshot velho não filtra `source`, e o Cowork o lê a qualquer momento pelo resource MCP e por `get_intelligence`, sem uma "execução" marcada. Com o F0 no ar, a allowlist do §3.6 já mostra o Cowork sem essas linhas;
  2. só então `git revert` e promoção, com o mesmo portão do F0 (CI verde em staging, validação autenticada antes da promoção); depois, `select count(*) from public.youtube_intelligence where source like 'forja%'` = 0, e PT com o diagnóstico do Cowork logado em prod.

## 6. Observabilidade
- **Log.** Uma linha por execução com lock (§4.1).
- **Pulso.** Entra no F4, com leitura por `python3 -` embutido, e reporta num **check próprio do healthchecks** (`URL_FILA`, criado pelo dono no F4, período 1 h. O `pulso_f4.py` recebe a URL do ping como argumento, recusa valor fora de `^https://hc-ping\.com/[0-9a-f-]{36}$` e grava `URL_FILA="…"` no início do bloco inserido; o `pulso.sh` já guarda a própria URL no arquivo, `onda0b/pulso.sh.novo:27`). O bloco lê `FILA_LOG="${FILA_LOG:-/opt/agente/log/fila_intel.jsonl}"` (nunca o caminho fixo; passado ao `python3 -` por argumento), calcula `ok_fila` (ignora linha que não termina em `\n` ou falha em `json.loads`; qualquer exceção do `python3 -` embutido dá vermelho com motivo `fila-leitura-<Tipo>`, no padrão `print(type(e).__name__)` do pulso), pinga `$URL_FILA` ou `$URL_FILA/fail` com as mesmas tentativas do pulso, chamando `curl` e `sleep` pelo nome (nunca por caminho absoluto), e acrescenta seu motivo a `$motivo` (para o `pulso.log`), **sem tocar em `ok`**. O healthchecks só avisa na transição: se a fila pintasse o check principal, uma task reprovada o deixaria vermelho por até 24 h e calaria um proxy, llama ou esteira caídos nesse intervalo. O check da fila fica vermelho se:
  - o mtime de `fila_intel.jsonl` tem mais de 45 min (cron morto ou import quebrado). Arquivo ausente conta como vermelho: o bloco só entra no passo (3) do F4, e o arquivo já existe desde o `--escolher` do F0.5 (toda execução com lock grava uma linha, §4.1 e §4.7);
  - a linha `modo: cron` mais recente com `task` não nulo tem menos de 24 h e não é `ok`. Uma linha `ok` mais nova apaga o motivo na hora;
  - nenhuma linha `modo: cron` das últimas 24 h tem `claim` em (200, 204). Isso pega config errada, chave recusada, `/slots` mudado e relógio divergente. No `pulso.log`, o motivo sai como `fila-sem-claim-24h:<desfecho dominante>`. Sem nenhuma linha `modo: cron` em 24 h, o motivo é `fila-sem-claim-24h:nenhuma` (vermelho).
- **Site.** `failed` com `error_message` legível; `stale` pelo watchdog, com `auto-released`.

## 7. Fase 2b — recomendações por vídeo, prioridades e F3

Tudo o que a v6 desenhou para vídeos e eixos, adiado pela decisão de 19/09. Aqui fica só o desenho, sem detalhe de implementação; a 2b terá spec próprio, partindo da v6.

**Gatilho objetivo** — a 2b abre quando valer **qualquer** um:
1. **O canal volta a publicar e há cobertura:** existe vídeo PT com `published_at` depois de 10/12/2024 **e** `youtube_video_analytics` tem ≥ 56 datas distintas para os vídeos do canal (em 19/09: 14, de 06/09 a 19/09; conferido só de leitura). Conferência só de leitura: `select count(distinct a.date) from youtube_video_analytics a join youtube_videos v on v.id = a.youtube_video_id where v.channel_id = '<PT>'`;
2. **Ou uma UI por vídeo é montada:** `YtGradesV2` (`_components/yt-grades-v2.tsx`, hoje sem nenhum `<YtGradesV2` no app) ou outra tela passa a ler as linhas de vídeo de `youtube_intelligence` (`actions.ts:101-107`).

**O que muda no servidor.** Saem as recusas `forja` de `video_recommendations` e `coaching.priorities` (§3.3). Entram a substituição por conjunto das linhas de vídeo `forja` em todo PATCH `forja` (delete com filtros explícitos de site, canal e fonte, fora do `if` de `video_recommendations`) e a transição `flagged→diagnosed` pulada para a forja. `refreshMetrics` (`lib/youtube/sync.ts:152-190`) deixa de filtrar por 30 dias e atualiza todos os vídeos em lotes de 50, trocando o `upsert` parcial (`sync.ts:174-185`, que viola o NOT NULL de `title`/`published_at` e nunca rodou em prod) por `update` por vídeo, com teste de integração. O snapshot ganha `recent_base` (a linha mais próxima de `date − 90` dias, ±3; a primeira base possível é 02/12) e `views_at_7d`.

**Regras por vídeo (código), resumo**
- **R1 `title_test`:** episódio maduro com `view_count` < 0,5 × a mediana da série e abaixo de um episódio posterior, com piso de leitura de ≥ 30 views em 90 dias; `priority` sobe com a distância e com `recent.views`.
- **R2 `content_series`:** série com `razao` ≥ 2 (a mesma dos padrões, §4.3), no episódio mais recente.
- **R4 `end_screen_optimize`:** até 3 vídeos de 180 dias ou mais que concentram as views recentes do canal, com o mesmo piso de leitura.
- **R3 `distribution_expand`** por `views_at_7d` continua adiada (§8).
- No máximo 10 recomendações e uma por vídeo (o índice `(site_id, channel_id, video_id, source)`), com colisão resolvida pela regra de menor número; `confidence` pela mesma fórmula dos padrões, com teto 0,7.

**Prioridades `reach`/`growth` (eixos)**
- Só com `recent_base`: score = `clamp(round(6,5 + 2,5 × log2((x+1)/(base+1)), 1), 0, 10)`, centrado no `COACHING_BENCHMARK` 6,5 (`yt-analytics-tabs.tsx:37`).
- Um eixo entra só com score < 5 e volume mínimo (x + base ≥ 60 views ou ≥ 40 inscritos); por construção toda prioridade é de queda.
- Na UI, `'forja'` entra na união do `source` do card, e a forja com cards volta a exigir a regra que esconde "Potencial", "+N pts" e a projeção de score, e o cenário D do teste de componente (linha `forja` com uma `reach` de score 4,2).

**Redação e validação.** O 12B passa a redigir `reasoning`/`suggested_variant_description` por `Ri` e `diagnosis`/`action` por `Pj`, com chaves fixas na gramática; o validador ganha o escopo de números por `Ri`/`Pj`, títulos alheios, episódios, título alternativo (copiado/longo) e o validador de direção por prioridade (nenhum verbo de alta no `diagnosis` de uma queda; o de séries já existe na 2a, §4.5 item 5b); templates por regra; corte do prompt por recs de menor prioridade.

**Sombra, F2 e F3.** A sombra ganha `--recs-sinteticas` (dispara uma R1, uma R2 e uma R4) e `--base-sintetica queda|alta`, e volta o `--congelar`. O **F3** é o julgamento às cegas: as mesmas mensagens vão ao Cowork sem ferramentas, os pares (forja × Cowork, mesmo alvo) são embaralhados com semente guardada, e a forja precisa de ≥ 80% "aceitável" e zero "errada". É o F3 que alimenta a decisão de aposentar o Cowork.

## 8. Fora desta fase
- CTR, retenção e eixos sem dado (`BACKLOG-site.md` itens 1–2).
- A **R3** (`distribution_expand` por `views_at_7d`): espera 4 uploads novos, mesmo na 2b.
- Notificações: a de análise pronta (`youtube.intelligence_ready`) e as ricas; o ciclo `flagged→diagnosed` pela forja.
- Eras e dia da semana.
- As horas restantes do cooldown na UI.
- A idade do snapshot por canal no MCP (`fetchSnapshotAge` filtrando `channel_id`); hoje é global e segue global.
- O canal EN, até ter vídeos.
- Aposentar o Cowork (decisão com os dados do F3 da 2b, §7).
- Fase 3.

## 9. Riscos aceitos
- **Análise estreita e magra.** Sem CTR nem retenção, e, por escopo, sem recomendações por vídeo e sem prioridades (§7); o canal PT sai com summary e 1 padrão. Isso fica visível no `AVISO_ESTREITO` e na linha de summary.
- **Disputa pelo slot.**
  - No chat comum, a análise segue no outro slot.
  - No `agente-pesquisa` (2 slots), o pedido da fila espera; se o orçamento acabar, vira `fail {retry:true}`.
  - O inverso: uma pesquisa com mais de 5 min pode deixar a fila clamar no meio, e a chamada paralela da pesquisa espera até ~2,6 min por tentativa (o proxy usa `timeout=None`). Atrasa, não derruba.
- **Morte depois do claim.**
  - O `finally` tenta `fail {retry:true}`.
  - SIGKILL, falta de rede ou resposta do claim perdida deixam a task `running` até o watchdog (30–60 min). Nesse intervalo o botão responde `already_active`, e depois a task vira `stale` sem cooldown.
  - Um pedido manual perdido assim tem de ser refeito.
- **Vazamento da `forja (fila)`.** O alcance é fechado:
  - clamar tasks `pending` do site, deixando o Cowork sem trabalho;
  - dar `fail`, inclusive com `retry`, só nas tasks que ela mesma clamou;
  - gravar diagnóstico `source='forja'` visível no Health Coach (texto escapado pelo React). Como a linha `forja` da 2a sempre tem `priorities: []` e o Health Coach mostra a mais nova da allowlist (§3.6), uma linha forjada **esconde os cards do Cowork** até a retirada (§5, "Qualidade"). Para saber se houve abuso, confira o `result_summary.claimed_by` da task e o conteúdo da linha exportada.

  Clama só pelo REST, com `channel_ids`; não fecha tasks clamadas por outra chave, não lê além de `{read}`, não altera linhas `cowork` e não alimenta o Cowork (§3.5). A resposta é revogar (F1) e retirar (§5).
- **Snapshot limitado a 50 vídeos** (`services/youtube.ts:222`, os mais recentes). Acima disso, coortes e séries antigas somem dos padrões. Hoje são 35.
- **Regex de números reprovando texto correto.** O F2 mede; ajusta-se a normalização; o template garante que a task não trava.

## 10. Achado colateral — o overview soma fotos de 90 dias

A fase 1 disse "428 views nos últimos 28 dias", e o erro está no site.
- O overview (`services/youtube.ts:1857-1864,1917-1919`) soma as linhas de `youtube_video_analytics` desde o corte, mas cada linha já é um total móvel de 90 dias.
- Os 428 são 13 fotos de ~33 views. O real é **~29 views nos últimos 90 dias**.
- O `scoreVideo` também recebe essas fotos como se fossem views diárias.

Duas correções à parte:
- **Site** (`BACKLOG-site.md` item 0, prioridade alta): usar a linha mais recente. Antes, conferir quais telas consomem `kpis.views`.
- **Forja, cartão S5** (fora desta fase, sempre depois do F4): `resumir_canal` passa a citar `Σ recent.views` do snapshot como "views nos últimos 90 dias". O S5 terá desenho próprio, partindo do `teste_s1` que o S4 deixou intacto.
