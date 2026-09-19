# Fase 2 — a forja drena a fila de inteligência do YouTube

**Data:** 2026-09-18 · **Versão:** v6 (rodadas 1–5 de revisão, 8 lentes cada; patches conferidos no código e no banco)
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

- **Ninguém nunca clamou.** `started_at` está sempre nulo.
  - O `expire-notifications` das 03:00 UTC marca `stale` todo `pending` com mais de 7 dias (`app/api/cron/expire-notifications/route.ts:25-31`).
  - O cron de segunda pula canal que já tem tarefa ativa. Por isso só nasce tarefa nova a cada **duas** segundas.
- **O dado recente é um total móvel de 90 dias.**
  - O sync diário grava, por vídeo, o total dos últimos 90 dias com `date = hoje` (`app/api/cron/sync-analytics-metrics/route.ts:18,68-84,148-157`). Cada linha de `youtube_video_analytics` é esse total, não uma contagem do dia.
  - Há linhas de 06/09 a 18/09.
  - Na linha de 18/09: Σ `recent.views` = 29, com máximo de 6 por vídeo e mediana 0 (21 dos 35 vídeos com 0). Zero inscritos em todos os vídeos. Views na vida inteira: 6.847.
- **O que as regras abaixo produzem hoje.** No PT, com o snapshot real, saem **0 recomendações** (nenhum vídeo tem as ≥ 30 views em 90 dias que as regras exigem), **0 prioridades** (também depois de 02/12, com o tráfego atual; §4.3) e **2 padrões de série**. O EN fica fora da fila (§5).
- **Onde está o valor desta fase:** pôr o circuito de pé, com fonte, validação e rollback. A análise ganha corpo quando o canal voltar a publicar e quando houver CTR/retenção (§7).
- **O "3" da aba Health Coach** conta os 3 cards do Cowork: as 6 priorities da linha de 18/05, cortadas por `.slice(0, 3)` (`yt-analytics-tabs.tsx:384`). Não conta a fila.

**Objetivo.** A forja (Gemma 12B local, `/opt/agente`) drena a fila. Ela grava análises com `source='forja'` ao lado das do Cowork, e o Health Coach mostra a mais recente, com selo da fonte. **Papel (decisão do dono):** a forja substitui o Cowork *eventualmente*; nesta fase, **convive**.

## 2. Decisões

1. **Abordagem A: o código calcula, o 12B redige.**
   - Todo número e toda decisão vêm de código determinístico: alvo, `action_type`, `priority`, `confidence`, `score`, `finding` e `analysis_text`.
   - O modelo só redige `summary`, `reasoning`, `suggested_variant_description` e `diagnosis`/`action`, com `response_format: json_schema`.
   - Texto que reprova duas vezes vira **template do código** (§4.5).
   - Medido: o llama b10142 respeita o schema a ~39 tok/s.
2. **Quando.** Crontab do `thiago` a cada 10 min. Só faz claim com os 2 slots do llama livres e sem turno de chat nos últimos 5 min.
3. **Convivência.** A análise da forja nunca sobrescreve a do Cowork: os índices únicos de `youtube_intelligence` já são por `source` (`20260517000003…sql:205-210`).
4. **A fonte vem só da chave.** O corpo não tem `source`.
   - Chave sem `write`/`admin` grava `forja`.
   - Chave com `write`/`admin`, ou sessão, grava `cowork`.
5. **Chave separada, estreita na escrita.** `forja (fila)` = `{read, intelligence}`, criada e revogada **pelo dono**.
   - `forja (so leitura)` continua `{read}` e é a do chat.
   - A leitura não é restringida por permissão (`authenticateRead` só autentica). O alcance de escrita está no §8.
6. **O texto da forja não alimenta o Cowork.** Só a chave `{read, intelligence}` recebe linhas `forja` no snapshot. Todo o resto, inclusive o resource MCP, recebe só `cowork` (§3.5). Texto escrito por uma chave estreita nunca vira entrada de um agente com escrita ampla.
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
- `mcpRequirePermission` (`lib/pipeline/mcp/auth.ts:84-87`) ganha a mesma regra.
- Em `mcp/services/ab-tests.ts`:
  - `submit_intelligence` sai de `WRITE_ACTIONS` (`:35`);
  - ele e `claim_task` (`:148-158`) passam a exigir `'intelligence'`, sem afrouxar `upsert_variants`/`delete_variant`;
  - `buildCtx()` (`:19-27`) passa a carregar `keyId: mcp.keyId`, como `mcp/services/items.ts:28`;
  - hoje `claim_task` não tem guarda.

**Efeitos**
- Nenhuma outra rota muda. Uma chave `{read, intelligence}` recebe 403 em toda escrita fora da fila.
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
  - 200 com a task **devolvida pelo `.select()` do próprio UPDATE do CAS**, inclusive o `started_at` gravado (relógio do servidor);
  - 500 `INTERNAL_ERROR` quando o SELECT (`.maybeSingle()`) ou o UPDATE devolvem `error`. Erro de banco nunca vira 204 (hoje vira, `youtube.ts:462-484`);
  - 204, com `buildRateLimitHeaders(auth)`, quando a fila está vazia **ou** o CAS foi perdido para outro consumidor ou para o `stale` das 03:00. A forja tenta no ciclo seguinte.
- `export const dynamic = 'force-dynamic'`, como as rotas irmãs.

**`GET …/intelligence/task`** (legado do Cowork)
- Passa de `authenticateRead` (`task/route.ts:9`) para `authenticateIntel({apiKeyOnly:true})`.
- **Força** `status='pending'`, o que fecha o `?status=completed` que reabria task concluída.

### 3.3 PATCH `…/intelligence` — REST e MCP pelo mesmo portão, dentro do serviço

**Validação**
- `authenticateIntel` fica na rota.
- `PatchPayloadSchema` hoje não roda em lugar nenhum; só aparece em `z.infer` (`services/youtube.ts:5,70`). O F0 passa a validar **também o payload do Cowork**, pela primeira vez. O teste de regressão com o payload real de maio está em §3.7.
- O `safeParse` roda **dentro de `submitIntelRecommendations`** (`:282`).
- O schema ganha teto no que hoje não tem (`lib/youtube/intelligence-schemas.ts:43-49`): `patterns_detected .max(30)`, `pattern_id .max(80)`, `category .max(40)`, `sample_size .int().min(0)`. Pré-verificação só de leitura: nenhuma linha `cowork` passa disso.
- `err()` (`services/types.ts`) ganha um 4º parâmetro opcional, `details`. **`serviceErrorToResponse` não muda**, porque é usado por ~200 rotas. A rota da inteligência repassa `err.details` a `pipelineError(code, message, status, auth, details)` (`helpers.ts:5-15`) no próprio `catch`, e sai o ramo especial `validation_failed` (`intelligence/route.ts:38-44`). Schema inválido → 400 `VALIDATION_ERROR` no envelope `{error:{code,message,details}}`.

**Fonte derivada:** `deriveSource(ctx)` = chave sem `write`/`admin` → `'forja'`, senão `'cowork'`.
- As gravações usam essa fonte no lugar do `'cowork'` fixo (`youtube.ts:331,340,381,392`).
- Tudo depois do `safeParse` usa `parsed.data`, nunca o corpo cru. Assim o strip do Zod descarta um `source` no corpo e qualquer chave extra numa recomendação, que hoje vai crua para `recommendations` (`youtube.ts:339`). Há teste: uma chave extra em `video_recommendations[0]` não aparece na linha gravada.

**Dono (§2.8).** Chave sem `write`/`admin` recebe 409 `TASK_NOT_RUNNING` antes de qualquer escrita quando `result_summary.claimed_by ≠ ctx.keyId`, e também quando `keyId` está ausente.

**Todas as recusas 4xx acontecem antes da primeira escrita, exceto o 409 do CAS de fechamento** (tabela de desfechos). Esse 409 sai quando a task virou `stale` ou foi fechada por chave `write` durante as gravações. Nesse caso as linhas `source='forja'` do canal já podem ter sido substituídas; as `cowork`, nunca. O 409 quer dizer "a task não é mais sua", não "nada foi gravado". Há teste para cada recusa:
- schema;
- estado e dono da task;
- `notifications` vindas da forja;
- o 422 de integridade, `VALIDATION_ERROR` quando o vídeo é de outro canal (`:311-322`).

**Fonte `forja` — regras impostas pelo servidor**
- `notifications` não vazio → 400.
- A transição de ciclo `flagged→diagnosed` é pulada.
- **Substituição por conjunto.** Em todo PATCH `forja`, inclusive com `video_recommendations` vazio ou ausente, e depois de todas as recusas:
  - apaga `.eq('site_id',siteId).eq('channel_id',task.channel_id).eq('source','forja').not('video_id','is',null)`;
  - com vídeos no payload, acrescenta `.not('video_id','in',(…))`; com lista vazia apaga todas, porque o PostgREST recusa `in ()`;
  - roda **fora** do `if (video_recommendations?.length)` (`:306`);
  - os filtros são explícitos porque o service client não passa por RLS;
  - erro no delete entra em `dbErrors` (`forja videos: delete_failed`).
- **Notificação**, só **depois** de o CAS de fechamento devolver `completed`:
  - uma `youtube.intelligence_ready` via `fanOutToSiteAdminsDetailed` (`lib/notifications/fan-out-to-admins.ts:73`), domínio `youtube`, prioridade 2, "Análise da forja pronta — <canal>";
  - `dedupKey = 'forja:intelligence_ready:' + task_id`;
  - `actionHref = '/cms/youtube/analytics?channel=' + youtube_channels.channel_id + '&tab=coach'` (§3.6);
  - `errors.length > 0`, `sent + suppressed === 0` ou exceção vão para o Sentry, sem mudar o 200;
  - o tipo fica fora de `notification_types` de propósito: não há FK, e assim não há migration.

**Fechamento da task** (hoje sem CAS e sem checagem, `youtube.ts:432-441`)
- CAS: `.eq('id').eq('site_id').eq('status','running')`; para chave estreita, também `.eq('result_summary->>claimed_by', keyId)`; e `.select('id')`.
- `result_summary` é mesclado: `{...anterior, recommendations, has_coaching, source, closed_by}`, mais `failed_writes: dbErrors.length` no ramo `failed`.
- Desfechos:

| Situação | Estado da task | Resposta |
|---|---|---|
| Sem `dbErrors` | `completed` + `completed_at` | 200 |
| Com `dbErrors` e o CAS para `failed` devolveu 1 linha | `failed` + `failed_at`, **sem** `completed_at` | 500 `PARTIAL_FAILURE` |
| CAS devolveu 0 linhas | inalterado; as linhas `forja` deste PATCH ficam gravadas, sem notificação (a próxima execução `forja` as substitui por conjunto) | 409 `TASK_NOT_RUNNING` |
| Erro no próprio UPDATE do CAS, em qualquer ramo | segue `running` até o watchdog | 500 `INTERNAL_ERROR`, sem notificação |

- No `PARTIAL_FAILURE`, `error_message` e `details` listam só os alvos (`video <uuid>: write_failed`); a mensagem crua vai só para o Sentry. O status inválido `partial_failure` sai.
- `PARTIAL_FAILURE` só existe quando o CAS para `failed` devolveu 1 linha.

**Código `TASK_NOT_RUNNING`** (409): task fora de `running`, de outro dono, ou CAS perdido.
- Entra no `ERROR_MAP` de `lib/pipeline/mcp/errors.ts` com `retryable:false` e `recovery_action` "A task não é mais desta sessão: não reenviar; clamar outra".
- `VERSION_CONFLICT` (`:47`, `retryable:true`) fica para os itens.
- A forja olha o status 409, não o código.

**Efeito no botão.** `requestIntelligenceAnalysis` (`app/cms/(authed)/youtube/analytics/actions.ts:201-213`) olha só a task **manual** mais recente, por `requested_at`. O cooldown de 24 h, hoje inerte, passa a valer quando essa task é concluída. Uma task `cron` concluída não o dispara, e uma manual `failed`/`stale` mais recente o anula.

### 3.4 Falha explícita

**Novo** `POST /api/pipeline/youtube/intelligence/task/:id/fail`, com `authenticateIntel({apiKeyOnly:true})`.
- Arquivo `task/[id]/fail/route.ts`, com `params: Promise<{id: string}>` e `dynamic = 'force-dynamic'`.
- Autentica **antes** de procurar a task. uuid inválido → 400.
- Corpo `{reason: string ≤ 500, retry?: boolean}` (Zod).
- CAS com `site_id` e a trava de dono do §2.8, mesclando `closed_by`:
  - com `retry:true` e `retry_count < 2`: `running→pending`, `retry_count+1`, `started_at` zerado, `requested_at` mantido. O `stale` de 7 dias continua limitando o total;
  - fora isso: `running→failed`, com `failed_at` e `error_message`, **sem** `completed_at`.
- `retry_count` já existe (`20260517000003…sql:242`), então não há migration.
- 404 se a task não é do site; 409 `TASK_NOT_RUNNING` se não está `running` ou é de outro dono.

### 3.5 Snapshot

**Janela.** `SYNC_WINDOW_DAYS` sai de `sync-analytics-metrics/route.ts:18` (const local) para `lib/youtube/analytics-window.ts`, importado pelo cron e pelo serviço. Nada é exportado de `route.ts`.

**Campos novos em `getIntelligenceSnapshot`** (`youtube.ts:201-280`). Toda leitura nova de `youtube_video_analytics` filtra `.eq('site_id',siteId).in('youtube_video_id', <ids de videosRes>)`.
- `recent_window: {date, days: SYNC_WINDOW_DAYS}`. `date` é a data mais recente entre os vídeos do canal; é `null` se não há linha nos últimos 3 dias.
- Por vídeo, `recent: {views, subscribers_gained}` é a linha de `date`, **sem somar**. Vídeo sem linha fica em `{0, 0}`, porque a API omite vídeo sem atividade (`route.ts:13-16`).
- `recent_base`: o mesmo, na linha mais próxima de `date − SYNC_WINDOW_DAYS` (±3 dias), ou `null`. É a janela anterior, sem sobreposição; a primeira base possível é 02/12.
- Por vídeo, `views_at_7d`: leitura à parte, `.not('views_at_7d','is',null)`, um valor por vídeo ou `null`. Só `youtube_video_analytics` tem a coluna (`route.ts:189-219`); fica para a R3 adiada (§7).

**Fonte no array `intelligence`** (`youtube.ts:240-245`, lido também pelo `get_intelligence` do MCP, `ab-tests.ts:69`):
- padrão → `.eq('source','cowork')`;
- todas as fontes **só** quando `ctx.permissions` inclui `intelligence` e não inclui `write`/`admin` (a `forja (fila)`; o `ok_inferido` do §4.1 lê a linha `forja`);
- a regra é por inclusão porque `buildResourceCtx()` (`mcp/resources.ts:64-76`) fixa `permissions:['read']` para qualquer chave, e o resource MCP `pipeline://youtube/intelligence` (`resources.ts:299-326`), lido pelo Cowork, chama o mesmo serviço (`:322`). Caem no padrão também a chave `{read}` do chat e a sessão.

O overview soma fotos de datas diferentes; é bug registrado no §9, e o snapshot não repete isso.

### 3.6 Health Coach

**Coaching do canal.** `fetchChannelCoaching` (`actions.ts:21-45`):
- troca `.eq('source','cowork')` por `.in('source',['cowork','forja'])` + `.not('coaching','is',null)` + `generated_at desc`;
- devolve `{coaching, source, generatedLabel}`. `generatedLabel` (dd/mm) é formatado **no servidor**, com `Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'})`.

**Props.** `YtHealthCoach` ganha `coachingMeta: {source, generatedLabel, summary} | null`, montado em `yt-analytics-tabs.tsx`.
- O rótulo, a linha de summary e a linha "regras fixas" derivam **só** dela.
- `hasCoworkCoaching` (`yt-health-coach.tsx:61`) sai.
- `lastAnalysisAt` (prop morta, `:55`) não entra.

**Cards.**
- `computeCoachingCards` (`yt-analytics-tabs.tsx:360-407`, hoje privada) passa a ser **exportada** e repassa `source`.
- A união vira `'cowork'|'forja'|'fallback'` (`yt-health-coach.tsx:16`, `yt-analytics-tabs.tsx:370`).
- Com `channelCoaching` presente e `priorities: []`, devolve `[]`, sem fallback.

**Aba pela URL.** `page.tsx` lê `tab` de `searchParams` e repassa `initialTab` a `YtAnalyticsTabs`, que troca o `useState<TabId>('overview')` (`:111`) por `useState(initialTab)`. O valor é validado contra `SUB_TABS` (`:47`); valor desconhecido vira `'overview'`.

**Textos.**
- Rótulo: `Diagnóstico · por forja · dd/mm` ou `Diagnóstico · por Cowork · dd/mm`. Sem `coachingMeta`, fica `Diagnóstico heurístico`.
- A linha "Baseado em regras fixas" (`:103-105`) passa a condição para `!coachingMeta && sortedCards.length > 0`, e o texto termina em "ainda sem análise para este canal".
- Botões → "Pedir diagnóstico": o do cabeçalho (`yt-analytics-tabs.tsx:231`) e os dois do Health Coach (`yt-health-coach.tsx:79,190`). O `cooldown` do Health Coach (`:188`, "Disponivel em breve") passa a "Aguarde...", como no cabeçalho.
- O early return de `:68` passa a exigir `videoCount === 0 && !coachingMeta`.

**Elemento novo: uma linha com `coachingMeta.summary` abaixo do rótulo.**
- Com `coachingMeta`, o parágrafo `:98-102` não é renderizado.
- Com zero cards, o card verde "saudável" (`:169-176`) não aparece.
- Com `coachingMeta.source === 'forja'` **ou** `videoCount === 0`, somem também o bloco "Potencial" (`:109-118`), o "+N pts" (`:163`) e a oração "Resolver levaria o score pra ~X" (`:100`). Essa projeção soma a um `healthScore` de CTR/retenção que a forja não mede, ou a um score 0.
- **Mockup aprovado pelo dono antes do código**, pela regra de aprovação visual.

**Efeitos visíveis aceitos**
- No PT, uma análise da forja mais nova que a de maio substitui os cards do Cowork pela linha de summary.
- O badge da aba passa a contar `priorities`; com 0, some (`:174`).
- O botão do EN continua criando tasks que ninguém consome. Mostra "Solicitado!", e depois "Aguarde..." (`already_active`) por até ~7 dias e 19 horas depois de cada task do cron (o `stale` só roda às 03:00 UTC).
- Nas 24 h depois de uma análise manual concluída, o botão mostra "Aguarde..." por 10 s, sem as horas restantes (o `hours_remaining` de `actions.ts:213` é ignorado pela UI).

**Leitura por vídeo** (`actions.ts:101-107`): não muda. Nada montado a lê; entra junto com a UI do §7.

**MCP**
- `fetchSnapshotAge` (`mcp/prompts.ts:102-113`) filtra `.eq('source','cowork')` e, quando o prompt tem `channelId`, o canal. Não chama `getMcpContext()`, porque os prompts rodam sem contexto em `test/mcp/youtube-mcp-prompts.test.ts`, e ali ele lançaria (`mcp/context.ts:6-11`).
- O prompt `youtube-analyst` (`mcp/prompts.ts:933`) diz que o array de inteligência traz só análises do Cowork.
- As descrições de `submit_intelligence`/`intel_payload` (`mcp/tools.ts:662,690`) dizem que a fonte vem da chave.

### 3.7 Arrastados pelo commit

**Registry** (`lib/pipeline/api-registry.ts`)
- +2 endpoints (claim POST, fail); `endpoint_count` do youtube vai de 31 para 33.
- `ApiEndpointMeta.auth` vira `'read'|'write'|'intelligence'` (`:7`). As entradas `:172-173` passam a `'intelligence'`.
- Acompanham: o regex de `test/lib/pipeline/api-registry.test.ts:38` e `test/mcp/mcp-registry-sync.test.ts:29` (123 → 125). As rotas novas caem em `youtube_analytics` (`mcp/auto-register.ts:137-141`).

**Erros MCP.** Entram `PARTIAL_FAILURE` (`retryable:false`) e `TASK_NOT_RUNNING` (§3.3).

**Docs**
- `data/pipeline-docs/cowork-docs-youtube.md`, na seção do GET `/task` (`:123-129`) e no fluxo (`:1351-1361`):
  - claim POST com `channel_ids`;
  - `fail` com `retry`;
  - fonte pela chave;
  - `channel_id` **obrigatório** no GET do snapshot;
  - `recent`/`recent_base`;
  - o array `intelligence` só com `cowork`, exceto para a chave `{read,intelligence}`;
  - os novos 400/409/500.
- `docs/cowork-youtube-intelligence-reference.md` (`:81-129`, `:220-290`) recebe o mesmo.
- `docs/cowork-pipeline-reference.md` não cita a inteligência e não muda.

**Cenários de validação visual** — fixtures do teste de componente jsdom abaixo, não SQL. A página exige `social_connections` YouTube não revogada com token válido e a YouTube Analytics API viva (`lib/youtube/analytics-client.ts:52-72,82-101,156-180`; `page.tsx:32-46,73-81`), e o banco local não tem isso.
- **A:** a fixture de maio (`coaching` com 6 priorities, `generated_at` 2026-05-18T13:34Z) → 3 cards do Cowork, badge 3.
- **B:** linha `forja`, `priorities: []` e `summary`.
- **C:** sem linha.
- **D:** linha `forja` com uma prioridade `reach` de score 4,2.

**Testes unitários (Vitest, no mesmo commit)**

*Permissão e fonte*
- Unitários **sem mock** de `requirePermission`, `authenticateIntel` e `mcpRequirePermission`: `{read}` recusa `intelligence`; `{read,intelligence}` recusa `write`; `write`/`admin` aceitam `intelligence`.
- `deriveSource` via REST e MCP: `{read,intelligence}`, com ou sem `source:'cowork'` no corpo, grava `forja`. Chave `write` com `source:'forja'` no corpo grava `cowork`.

*Claim*
- 200 com `started_at`; 204 com rate-limit headers; filtro `channel_ids`; `claimed_by` gravado pelo POST, pelo GET legado e pelo MCP; sessão → 403.
- Sem mock de `@/lib/pipeline/helpers` (só `authenticatePipeline` mockado): chave `{read}` → 403 no POST claim, no GET legado e no PATCH, sem consulta a `youtube_intelligence_tasks`.
- GET legado com `?status=failed` → `claimNextTask(ctx)` sem status.

*Dono*
- `{read,intelligence}` em task de outra chave → 409 `TASK_NOT_RUNNING` sem gravar, no PATCH e no fail.
- Chave `write` fecha a task da forja → 200.
- `submit_intelligence` numa task `stale` → `_meta.retryable === false`.

*PATCH*
- 400 fora do schema, via REST e MCP.
- Teto dos padrões.
- **Regressão do Cowork:** `test/fixtures/intel-cowork-2026-05-18.json`, remontado só de leitura das 11 linhas `cowork` de maio, passa no `safeParse` e grava `cowork`.
- Task `stale` → 409 sem gravar. CAS final perdido → 409. Erro no UPDATE do CAS → 500 `INTERNAL_ERROR`, sem notificação.
- Falha parcial → `failed` sem `completed_at`, com `failed_writes` e resposta 500.
- `result_summary` preserva `claimed_by`.
- Todo 4xx, exceto o 409 do CAS final, vem antes de escrita. O 422 de integridade continua 422 `VALIDATION_ERROR`.

*Forja*
- Sem ciclo.
- `notifications` não vazio → 400.
- Exatamente uma notificação, com `dedupKey` e `actionHref`. Nenhuma quando o fechamento dá `failed`/409, nem quando a fonte é `cowork`.

*Fail*
- 200 (`failed`); 200 com `retry` → `pending` e `retry_count` 1; terceiro `retry` → `failed`.
- 404, 409 e 400; `{read}` → 403; sessão → 403.

*Cross-site (chave do site A)*
- PATCH com `task_id` do B → 404 sem escrita.
- `fail` na task do B → 404.
- Claim com `channel_ids` do B → 204, e a task do B segue `pending`.
- Snapshot com `channel_id` do B → 404.

*MCP*
- `claim_task` com `{read}` → FORBIDDEN.
- `{read,intelligence}` em `upsert_variants`/`delete_variant` → FORBIDDEN.
- Claim REST + `submit_intelligence` MCP com a mesma chave `write` → 200.

*Snapshot*
- `recent` da linha de `date`, sem soma. Vídeo ausente → 0.
- `recent_base` com ±3 dias.
- `recent_window: null` com a linha mais recente em `Date.now() - 4*864e5`.
- Linhas de vídeo de outro canal não entram.
- Chave `write`, chave `{read}` e o resource MCP `pipeline://youtube/intelligence` → nenhuma linha `forja` em `intelligence`; `{read,intelligence}` → linha `forja` presente.
- Datas relativas.

*Health Coach*
- `fetchChannelCoaching` devolve a mais recente da allowlist, com `source` e `generatedLabel`; uma linha `forja_retirada_202609181200` mais nova é ignorada (trava o rollback do §5). `generated_at` às 01:30Z vira o dia anterior.
- `computeCoachingCards(videos,{priorities:[],summary})` → `[]`; sem coaching → fallback.
- Componente (`@vitest-environment jsdom`):
  - "por forja" com só `reach` de score 4,2 (D): sem "regras fixas", sem "Potencial", sem "+N pts", badge 1;
  - sem coaching (C) → "Diagnóstico heurístico";
  - summary sem "saudável" com `priorities: []` (B);
  - "por Cowork · 18/05" com a fixture de maio (A): 3 cards, badge 3;
  - `?tab=coach` abre `panel-yt-coach`.
- `fetchSnapshotAge` ignora uma linha `forja` mais nova.

*Botão*
- Manual `completed` há 1 h → `cooldown`.
- Task `cron` concluída → sem cooldown.
- Manual `failed` mais recente → sem cooldown.

*Reescritos no mesmo commit*
- `test/youtube/coaching-actions.test.ts:5-13` e `:69-77`.
- `test/youtube/yt-health-coach.test.tsx:28`.
- Em `test/api/pipeline/youtube-intelligence.test.ts`:
  - o mock de helpers (`:12-24`) ganha `authenticateIntel`;
  - o 422 `validation_failed` de schema (`:191-209`) passa a 400 `VALIDATION_ERROR`;
  - o teste de integridade (`:280-297`) mocka o erro real (422 `VALIDATION_ERROR`);
  - `:353-358`;
  - os testes que esperavam `VERSION_CONFLICT` passam a `TASK_NOT_RUNNING`.

**Integração com o banco local** — `test/integration/youtube-intelligence-forja.test.ts`, com `describe.skipIf(skipIfNoLocalDb())`
- Substituição por conjunto com 2, 1 e 0 vídeos. As linhas `forja` de outro canal e de outro site, e as linhas `cowork`, ficam intactas.
- CAS de fechamento com `claimed_by` diferente → 0 linhas e 409; igual → `completed`.
- Claim com `channel_ids` e `site_id` → só a task elegível vira `running`.
- `fail {retry:true}` → `pending`.

**Sem migration.** `source` não tem CHECK. `failed`, `retry_count` e `result_summary jsonb` já existem. `permissions` é `text[]` sem CHECK.

## 4. Forja — `/opt/agente/fila_intel.py`

### 4.1 Laço (uma execução)

**0. Crontab do thiago**

```
*/10 * * * * timeout -k 30s 25m /opt/agente/venv/bin/python /opt/agente/fila_intel.py --cron >>/opt/agente/log/fila_intel.err 2>&1
```

- **Modo.** `modo` = `cron` só com `--cron`. Sem a flag, é `manual`: imprime o desfecho e roda sob o mesmo `timeout -k 30s 25m`.
- **Lock.** O lock é tomado pelo **próprio Python** logo após os imports: `fcntl.flock(open('/opt/agente/fila_intel.lock','a'), LOCK_EX|LOCK_NB)`.
  - Lock ocupado → no cron sai 0 sem gravar nada; no modo manual imprime `ocupado: outra execução com o lock` e sai 75.
  - É o mesmo `flock(2)` que o `deploy.sh` e o rollback usam.
- **Invariante de tempo.** Do claim ao último pedido ao site passam menos de 25 min + 30 s, abaixo dos 30 min do watchdog. Assim ele nunca corta uma execução viva. A rota do PATCH declara `export const maxDuration = 60`, igual ao timeout do cliente. Com isso, quando a releitura de 20 s roda, o servidor já terminou, e `ok_inferido`/`indeterminado` refletem o estado final. Mudar o orçamento, o `timeout` ou `STALE_THRESHOLD_MINUTES` exige refazer essa conta.

**1. Uma linha de log por execução.** Toda execução com lock grava **exatamente uma** linha em `/opt/agente/log/fila_intel.jsonl`.
- Campos: `quando` (ISO com offset: `datetime.now().astimezone().isoformat(timespec='seconds')`), `modo, desfecho, etapa, task, canal, ms por etapa, tentativas, tokens, fallback, motivos`. Nunca a chave nem o texto gerado.
- `desfecho` ∈ `ocupado | chat | llama_fora | config | vazia | ok | ok_inferido | reprovada | llama | falha_site | conflito | fail_perdido | chave | indeterminado | orcamento | morto`. `llama` = geração falhou depois do claim (§4.5 item 7, `fail` com `retry`); falha do snapshot = `falha_site` com `etapa: snapshot`.
- **Morte por sinal.** O `try/finally` fica **fora** do `asyncio.run`, com o estado num dict de módulo. O handler de SIGTERM levanta `SystemExit`, e o `finally`:
  1. se houve claim 200 e `patch_enviado` e `fail_enviado` são falsos, chama `fail {reason:'morto:<etapa>', retry:true}` por um `asyncio.run` novo, com um `httpx.AsyncClient` aberto ali, sempre por `sitio.pedir(…, fase=2, chave=…, timeout=10)` e nunca por `httpx` direto. As duas flags são marcadas **antes** de abrir a conexão do PATCH ou de qualquer `fail`;
  2. se nenhum desfecho foi decidido, grava `morto` com a última etapa; senão grava o desfecho decidido.
- **Rotação**, dentro do lock:
  - o jsonl, via tmp + `os.replace`, fica em 4.000 linhas quando passa de 5.000;
  - o `.err` é aparado **no mesmo inode** (lê a cauda, `truncate(0)`, reescreve), porque o shell o abriu com `>>`. Fica em 1.500 linhas quando passa de 2.000.

**2. Antes de tocar no site**
- **Canais.** `CANAIS_FILA` (linha `CANAIS_FILA=PT` em `/opt/agente/fila_intel.env`) é traduzido por `SITIO_CANAL_PT`/`EN`, lidos de `/etc/default/proxy-agente` pelo próprio Python. Lista vazia, rótulo desconhecido ou uuid ausente → `config`, **sem claim**. Nunca sai claim sem `channel_ids`.
- **Slots.** `GET 127.0.0.1:8080/slots` (timeout 3 s). Qualquer resposta que não seja 200 com os 2 `is_processing=false` → `ocupado`/`llama_fora`.
- **Chat recente.** Lê a última linha **terminada em `\n`** de `/opt/agente/roteamento.jsonl`. O campo `quando` é ISO naive em hora local da forja (`America/Sao_Paulo`), gravado no início do turno (`proxy.py:349`), e é comparado com `datetime.now()` naive.
  - Cauda sem `\n` (turno sendo gravado) → `chat`.
  - `quando` a menos de 5 min, ou até 10 min no futuro → `chat`.
  - Mais de 10 min no futuro → segue, com `motivos: roteamento_futuro`.
  - Arquivo ausente ou linha completa ilegível → segue, com `motivos: roteamento_ilegivel`.
  - Tem teste com uma linha real e com uma cauda parcial.

**3. Claim.** `POST …/task/claim {channel_ids}` com a chave da fila.
- 204 → `vazia`.
- 401/403 → `chave`, sem `fail`.
- Timeout, 5xx ou 429 → `falha_site` com `etapa: claim`, **sem** `fail`, porque o id é desconhecido. Se o CAS rodou no servidor, a task fica `running` até o watchdog (§8).
- Outra `recusa` (3xx e 4xx, §4.6) → `falha_site` com `etapa: claim` e o status em `motivos`, sem `fail`: nada foi clamado.
- 200 → começa o orçamento de 20 min, medido com `time.monotonic()`.

**4–5. Dentro de um `try`, até o PATCH**
- `GET …/intelligence?channel_id=<task.channel_id>` com a chave da fila.
- `features` (§4.2) → `escolher` (§4.3) → redação (§4.4) → `validar` (§4.5).
- **Toda saída antes do PATCH** chama `POST …/fail` uma vez, com `reason` = etapa + motivo:
  - com `retry:true` para `llama`, `orcamento` e falha transitória do snapshot (timeout/5xx/429);
  - sem `retry` nos demais casos.
- Se o próprio `fail` volta 409 → `conflito`. Se o `fail` falha → `fail_perdido`, e o watchdog fecha a task.

**6. PATCH.** Uma vez, sem `source`, com timeout de 60 s:

| Resposta | Ação | `desfecho` |
|---|---|---|
| 200 | fim | `ok` |
| 400 / 422 | `fail {reason:'patch <st>: <code>'}` (seguro: 400/422 saem antes de escrita; a exceção é o 409 do CAS final, §3.3) | `reprovada` |
| 429 | espera 60 s fixos (a janela é de 60 s, `lib/pipeline/auth.ts:20`, e o 429 sai sem cabeçalhos de rate limit, `lib/pipeline/helpers.ts:27`) e `fail {reason:'patch 429', retry:true}` (o 429 sai antes de qualquer consulta, `lib/pipeline/auth.ts:57-59`) | `reprovada` |
| 409 / 404 | nada: a task não é mais desta execução | `conflito` |
| 401 / 403 | nada: a chave foi recusada; o watchdog fecha | `chave` |
| 500 `PARTIAL_FAILURE` | nada: o site já marcou `failed` | `falha_site` |
| timeout / outro 5xx | **não repete e não chama `fail`**; espera 20 s e relê o snapshot. Se a linha **de canal** `source='forja'` tem `generated_at` ≥ `task.started_at` (relógio do servidor) → `ok_inferido`; senão `indeterminado`, e o watchdog fecha | `ok_inferido` / `indeterminado` |

- `ok_inferido` não prova `completed`, porque a linha de canal é a última escrita antes do CAS. O pulso a conta como não-`ok`.
- **Não se reenvia o PATCH.** Um reenvio concorrente não duplica linhas, porque os índices recusam com 23505. Mas o 23505 vira `dbErrors`, e se o CAS do reenvio chegar primeiro a task fica `failed` com o dado íntegro.
- **A geração vai direto para a 8080**, nunca pela 8081. Assim não passa pelo roteador, não escreve em `roteamento.jsonl` e não depende do proxy.

### 4.2 `features` — funções puras, com `hoje` como parâmetro

**Por vídeo**, pelo `snapshot.videos[].id` (uuid interno); `video_id` é o id do YouTube e nunca vai para o PATCH.
- `idade_dias`.
- **Maturidade.** Vídeos com menos de 90 dias ficam fora das comparações de R1, R2 e dos padrões. Acima disso, a comparação usa `view_count` direto. A saturação medida (em 18/09: +29 em 90 dias sobre 6.847) só vale para vídeos com 648 dias ou mais; o limiar de 90 dias é revisto quando o canal voltar a publicar.
- `indice = view_count / mediana(view_count da coorte)`.
  - **Coorte:** vídeos maduros do mesmo ano, **sem os do grupo avaliado** (a série, na R2 e nos padrões). O ano de uma série é o do `published_at` do seu episódio mediano.
  - Com menos de 4 vídeos, soma o ano **com vídeos** mais próximo (anterior, depois seguinte, alternando), até 2 anos de distância. Sem 4 dentro desse limite, a comparação não se aplica.
- `recent.views` (90 dias), quando `recent_window` não é nulo.

**Série**
- **A verdade é `/opt/agente/series.json`** (`{"videos":{snapshot.videos[].id: slug},"nomes":{slug: nome exibível}}`). O nome alimenta `series[].nome`, `recs[].serie` e o `finding`, passa por `_t` e nunca tem `_`. O slug só vai para `pattern_id`. O arquivo é escrito pelo dono uma vez a partir da proposta do código. Cada vídeo pertence a uma série só. Série = 3 ou mais vídeos com o mesmo slug.
- **A heurística só propõe**, para vídeos fora do arquivo, e registra no log (`motivos: serie_proposta`). Ela reconhece:
  - marcador de episódio (`(Parte N)`, `Part N`, `#N`, `Ep. N`, `^N - `) com prefixo comum; "9 dicas" não conta;
  - o mesmo tipo de marcador com N = anterior + 1, publicado a até 45 dias do anterior;
  - 3 ou mais títulos com o mesmo prefixo de 10 caracteres ou mais, desde que não sejam títulos idênticos e o prefixo não termine em dígito ("Main AD Diamante 2" é elo, não episódio).
- Com marcadores aninhados ("4 - Como somos controlados - … (Part 3)"), a proposta lista as duas leituras, e o dono escolhe.

**Teste**
- Fixture PT do F0.5, com `hoje` = `congelado_em` e o `series.json` do dono.
- Fronteiras em 89/90 e 179/180 dias.

### 4.3 `escolher` — regras (dado, não prompt)

**Piso de dado.** Com menos de 8 vídeos no snapshot, **não há chamada ao 12B**:
- `summary` e `analysis_text` saem de template: "Canal com {n} vídeos no banco: dado insuficiente para comparar séries e coortes.";
- `priorities: []`, zero recomendações e zero padrões;
- `motivos: dado_insuficiente`.

**Regras**

| # | Regra | `action_type` | `priority` |
|---|---|---|---|
| 1 | vídeo maduro, em série ≥ 3, com `view_count` < 0,5 × mediana dos outros episódios **e** ≥ 20 views abaixo de algum episódio publicado **depois**; exige `recent.views` ≥ 30 (≈ 10/mês, o mínimo para um teste de título ter leitura) | `title_test` | low; medium com `recent.views` ≥ 90; high só com < 0,25×, diferença ≥ 50 **e** `recent.views` ≥ 180 |
| 2 | série com mediana de `indice` ≥ 2 (coorte sem a série) | `content_series` (no episódio mais recente) | medium |
| 4 | `recent_window` não nulo e ≥ 8 vídeos: até 3 vídeos de 180 dias ou mais, por `recent.views`, cada um com `recent.views` ≥ max(30, 0,15 × Σ `recent.views` do canal) (o mesmo piso de leitura da R1) | `end_screen_optimize` | low |

- A **R3** (`distribution_expand` por `views_at_7d`) fica adiada (§7): exige 4 ou mais uploads novos.
- Em 18/09 (Σ = 29, máximo de 6 por vídeo), nenhuma regra dispara: a R1 e a R4 exigem ≥ 30 views em 90 dias num vídeo, e nenhuma série tem mediana de `indice` ≥ 2. Com piso 5, a R4 oscilaria por ruído (2 recs em 06/09, 1 em 18/09).

**Volume.** No máximo 10 recomendações e **no máximo uma por vídeo**, porque o índice `(site_id, channel_id, video_id, source)` guarda uma linha por vídeo. Quando duas regras miram o mesmo vídeo, fica a de menor número, e a outra vai para o log (`motivos: colisao_video`). Depois, a ordem é por `priority` (high > medium > low), depois pela ordem da tabela, depois por `recent.views` decrescente e, no empate, por `snapshot.videos[].id` crescente. Zero é válido.

**`confidence`** = `min(0,7, 0,3 + 0,05 × min(n_grupo, 6) + 0,1 × [forte])`
- `n_grupo`: R1 = tamanho da série; R2 e padrões = `min(n_série, n_coorte)`.
- `forte`: R1 < 0,25×; R2 com mediana ≥ 4; padrão com `razao` ≤ 0,5 ou ≥ 2.
- A R4 é fixa em 0,4.
- O teto de 0,7 existe porque não há CTR nem retenção.

**Coaching `priorities`.** Só `reach` (views) e `growth` (inscritos), e só com `recent_base` não nulo.
- `x = Σ recent`, `base = Σ recent_base`.
- `score = clamp(round(6,5 + 2,5 × log2((x+1)/(base+1)), 1), 0, 10)`; 6,5 é a média da UI (`COACHING_BENCHMARK`).
- Um eixo entra só com `score < 5` **e** `x + base ≥ 60` (reach) ou `≥ 40` (growth). Com 5 ou mais, a UI pinta o eixo de verde (`yt-health-coach.tsx:35-38`).
- Pela fórmula, `score < 5` exige uma queda de mais de 34%, então todo `Pj` tem `direcao = queda`. Alta e estabilidade não geram prioridade.
- Sem eixo → `priorities: []`.
- Risco de ruído: no empate, a chance de um eixo entrar por acaso é de ~5% (reach) e ~8% (growth) sob modelo binomial, e maior com a sobredispersão real (um vídeo com 6 das 29 views).
- Piso implícito na base: `reach` exige `base` ≥ 37 views em 90 dias (Σ medido: 28–35, de 06/09 a 18/09) e `growth` exige `base` ≥ 25 inscritos (0 em 18/09). Com o tráfego atual, `priorities` sai vazio também depois de 02/12; o caminho só é exercitado pelo `--base-sintetica queda` e pelo cenário D do teste de componente.
- `recent_base` é nulo antes de 02/12; até lá, o summary diz isso.

**`patterns_detected`** — só séries:
- `pattern_id = serie:<slug>`, `category = series`, `sample_size` = número de vídeos da série.
- `razao` = mediana de `view_count` da série / mediana de `view_count` da coorte sem ela.
- `finding` é template: `Série "{nome}": {n} vídeos, mediana de {views} views na vida ({razao} da coorte do mesmo período)`.
- Piso de efeito: só sai padrão com `razao` ≤ 0,67 ou ≥ 1,5; o resto vai para o log (`motivos: padrao_neutro`).
- `confidence` pela fórmula acima.
- Eras e dia da semana ficam fora.

**`analysis_text`** é template: os `finding` unidos, mais "Gerado pela forja em {data_base} a partir de views e séries.". Nenhuma tela o lê hoje.

**Teste da fixture PT.** Fixa a saída de `escolher` e os padrões; o dono confere uma vez. Um limiar só muda por item julgado errado ou faltante, nunca para atingir uma contagem. **Esperado em 18/09:** 0 recomendações e 2 padrões ("0–10" e "Main AD Diamante"; "Vlogzeira" fica abaixo do piso de efeito).

### 4.4 Redação pelo 12B — contrato (fonte única do `teste_fila`)

**Mensagens.** `[{system: SISTEMA_FILA}, {user: json.dumps(ENTRADA, ensure_ascii=False, separators=(',',':'))}]`.
- Na tentativa 2, o `user` vira `{"entrada":ENTRADA,"corrigir":{…}}`.
- **Nunca há dois `user` seguidos**: o template do Gemma exige alternância (`trilha/t4.py:48`), e com `--jinja` dois `user` seguidos dão 500.

**`ENTRADA`**

```
{"canal":{"nome":str,"idioma":"pt"|"en","videos":"35","views_90d":"29","inscritos_90d":"0","data_base":"18/09",
          "n_recs":"0","n_prioridades":"0","n_series":"2"},
 "prioridades":[{"id":"P1","eixo":"alcance (views)"|"crescimento (inscritos)",
                 "fatos":{"atual_90d":"…","anterior_90d":"…","variacao_pct":"40%","diferenca":"…","direcao":"queda"}}],
 "recs":[{"id":"R1","titulo":str,"serie":str|null,"episodio":"3"|null,
          "acao":"testar outro título"|"repetir o formato da série"|"reforçar a tela final",
          "prioridade":"baixa"|"média"|"alta","fatos":F}],
 "series":[{"nome":str,"n":"5","mediana_views_vida":"91","razao_coorte":"2,4×"}]}
```

- **Formato dos valores.** Todo número é string pt-BR exibível e **sem sinal** (o sentido vem de `direcao`). O modelo nunca vê UUID.
- **Títulos** (`recs`, `posterior`, `series.nome`) passam por `sitio._t` (`sitio.py:141-142`).
- **`F` sempre traz** `dias`, `idade` exibível ("5 anos e 3 meses"; abaixo de 60 dias, "N dias") e `publicado` ("MM/AAAA").
- **Campos de `F` por regra:**
  - **R1:** `views, recent_90d, mediana_views_serie, razao_serie (×), pct_serie (%), pct_abaixo_serie (%), posterior:{episodio, titulo, views, publicado, razao_posterior (×), diferenca_views}`
  - **R2:** `n, mediana_views_vida, razao_coorte (×), ultimo_episodio`
  - **R4:** `recent_90d, pct_do_canal (%)`
- **`Ri` e `Pj`** são numerados na ordem de `escolher`, depois do corte. O mapa `Ri → índice` fica no código e nunca é lido de volta do modelo.

**`SISTEMA_FILA`**
- Citar só números de `fatos` e `canal`; percentuais, razões e diferenças, só os prontos, sem converter um no outro.
- Nunca calcular.
- Nunca mencionar métrica ausente nem os nomes técnicos.
- Tamanho em frases: `reasoning` 2, `diagnosis`/`action` 1–2, `summary` 2, passo concreto 1, título alternativo até 70 caracteres.
- O contrato de saída fica escrito aqui porque o llama.cpp transforma `S` só em gramática e não o põe no prompt: `reasoning` = por que agir no vídeo de `Ri`; `suggested_variant_description` = **só o título alternativo, sem aspas**, quando `acao` é "testar outro título", e 1 frase de passo concreto nas outras ações; `diagnosis` = o que caiu em `Pj`; `action` = o que fazer; `summary` = o canal.

**Corte do prompt.** Se, depois do chat template (`/apply-template` → `/tokenize`), o prompt passar de 6.000 tokens, cortam-se primeiro as `series` não referenciadas e depois as `recs` de menor prioridade. Uma rec cortada **continua no PATCH**, com texto de template, e entra em `fallback`. `canal.n_recs` e `n_series` contam o que vai no PATCH, não o que ficou no prompt.

**Pedido.** `POST 127.0.0.1:8080/v1/chat/completions` com:
- `response_format: {type:"json_schema", json_schema:{name:"redacao", strict:true, schema:S}}`;
- `temperature 0.4`, `seed` por tentativa;
- `chat_template_kwargs: {enable_thinking: false}` (como a fase 1, `trilha/s2.py:93`);
- `max_tokens 6144`, timeout = `min(600 s, orçamento restante − 120 s)`.

**`S`** tem só `object`/`string`, `additionalProperties:false` e `required` com todas as chaves na ordem de `properties`. `recs`/`prioridades` saem de `S` quando vazios. As chaves fixas `Ri`/`Pj` fazem a gramática impor a ligação entre texto e alvo.

```
{"recs":{"R1":{"reasoning","suggested_variant_description"},…},
 "prioridades":{"P1":{"diagnosis","action"},…},
 "summary"}
```

**Faixas** — limites da gramática, abaixo do Zod:

| Campo | Faixa |
|---|---|
| `summary` | 60 – (500 − len(AVISO_ESTREITO) − 10) |
| `diagnosis`, `action` | 60–280 |
| `reasoning` | 80–460 |
| `suggested_variant_description` (**obrigatório** na gramática; no PATCH pode sair, §4.5 item 7) | 10–100 para `title_test` (título alternativo, no idioma do canal); 20–190 nas outras ações (passo concreto) |

- **Idioma.** O texto analítico é sempre pt-BR. Títulos existentes vão entre aspas, sem tradução.
- **Aparo.** Um campo (exceto o título alternativo) que termine sem `.`, `!` ou `?` é aparado no último `[.!?]` seguido de espaço ou fim. O corte não vale para pontuação dentro de aspas, entre dígitos ou logo após `Ep|Part|vs|nº`. Se sobrarem menos de 40 caracteres, reprova. O log conta os campos que bateram no teto (`motivos: teto`).

**Aceite.** A resposta é aceita só com `finish_reason == "stop"`, `reasoning_content` vazio ou ausente, `json.loads` sem erro e o conjunto de chaves igual ao de `S` em cada nível. Qualquer outra coisa reprova a tentativa: `truncado|timeout|json|llama|pensou`. O log grava `usage`, `len(reasoning_content)` e `timings.predicted_per_second`.

**O código nunca lê do modelo** id, ação, prioridade, número ou vídeo: só as strings dos campos de `S`. Depois da validação, junta o texto aos campos numéricos do §4.3 e prefixa o `summary` com `AVISO_ESTREITO` ("Sem CTR/retenção nesta fase; base: views e séries.", até 80 caracteres). O validador do §4.5 roda só sobre o texto gerado.

### 4.5 Validador local

**1. Espelho do Zod.** Espelho em Python dos limites de `PatchPayloadSchema`, inclusive os tetos novos. Tamanhos em UTF-16. Texto gerado com caractere fora do BMP reprova antes, com motivo `emoji`.

**2. Vídeos.** Todo `video_recommendations[].video_id` é um `snapshot.videos[].id`, e nenhum se repete.

**3. Números com escopo.**
- `Ri` só cita valores de `fatos` de `Ri`, da série de `Ri` e, de `canal`, só `views_90d` e `data_base`.
- `Pj` só cita os de `Pj` e `data_base`.
- `summary` cita qualquer valor do prompt.
- O título alternativo de `title_test` pode trazer números novos. Reprova se `norm(_t(alt))` for igual ao de algum título do snapshot (`titulo_copiado`) ou se passar de 70 caracteres (`titulo_longo`, que também pega o corte no teto de 100 da gramática, onde o aparo não atua).

**4. Normalização** (função pura, com teste de tabela).

- **(0) Tokens permitidos.** Cada escopo permite `tokens(normalizar(v))` de suas strings, pela **mesma função** usada no texto gerado.
  - `id`, `acao`, `prioridade`, `eixo`, `direcao`, `nome`, `titulo`, `serie` e `posterior.titulo` nunca geram token. Um número de título só passa entre aspas, pela etapa (a), ou como episódio, pela (e).
  - Cada token é `(valor, tipo)`, com tipo ∈ {número, %, ×, data, ano}, e só casa com o mesmo tipo.
  - `−` e `-` são descartados: a comparação é por valor absoluto.
- **(a) Títulos entre aspas.** Sai todo trecho entre aspas (`"…"`, `“…”`, `‘…’`, `«…»`) cuja forma `_t` normalizada tenha 8 caracteres ou mais e seja substring de um título do snapshot ou de `series[].nome`. No escopo `Ri`, esse título tem de ser o de `Ri`, o de `posterior` ou o da série de `Ri`; outro título reprova (`titulo_alheio`).
- **(b) Datas e anos**, nesta ordem de alternância: `\d{1,2}/\d{1,2}/\d{4}`, `\d{1,2}/\d{4}`, `\d{1,2}/\d{1,2}`, `\d{1,2} de <mês>( de \d{4})?`, `<mês>(\.)?( de|/)? ?\d{4}` (com `jan…dez`) e `\b(20(0[5-9]|[12]\d|30))\b`.
  - Cada um vira `(dia|None, mes|None, ano|None)` e casa quando todo componente não nulo é igual ao do permitido (`data_base` e os `publicado` do escopo).
  - Teste de tabela: `12/2024`, `dezembro de 2024`, `dez/2024`, `em 2024`, `18/09`, `18 de setembro`.
- **(c) Número:** `\d{1,3}(\.\d{3})+|\d+(,\d+)?`, com sufixo `%|x|×| vezes| mil| milhões?`, lido em pt-BR.
- **(d) Por extenso.**
  - `metade`/`dobro`/`triplo` são tokens `×` (0,5/2/3).
  - Precedidos de `menos d[aeo]|abaixo d[aeo]|mais d[aeo]|mais que|acima d[aeo]`, casam por desigualdade com um `×` do escopo ("menos da metade" ⇔ algum `×` < 0,5). `quase` não abre desigualdade: "quase a metade" é o token `×` 0,5 e casa só por (g).
  - `dois|duas..vinte` seguidos de ` vezes` são tokens `×`; sem isso, são tokens `número`.
  - "um"/"uma" são artigo e não contam.
- **(e) Episódios.** `Parte N`, `Part N`, `#N`, `Ep. N`, `episódio N`, `Nº` e `Nª` casam só com `episodio` de `Ri`, da série dele ou de `posterior`.
- **(f) Constantes** sempre permitidas: 60, 90, 180 e `top 3`. 28 e 30 não entram, porque não há janela dessas no dado (§9).
- **(g) Arredondamento:** `x == round(v, k)` com k menor que as casas exibidas. Com `mil`/`milhões`, a diferença para `v` fica abaixo de 5%.

**5. Direção.** Só em `Pj.diagnosis`, nunca em `action` (que prescreve melhora). Todo `Pj` é `queda` (§4.3), então o `diagnosis` não pode casar `\b(cresc\w*|aument\w*|subi\w*|ganh\w*|dobr\w*|recuper\w*|avanc\w*|melhorou|alta)\b`. Um `Pj` com outra direção é bug de `escolher` e termina em `fail`.

**6. Proibidos** (sem acento, com borda de palavra):

`\b(ctr|taxa de cliques|impress(ao|oes)|retenc(ao|oes)|retid[oa]s?|tempo (de )?exibic(ao|oes)|watch ?time|nota [0-9]|nota [a-f] ?(no|na|do|da|de)|score|impressions?|retention|engajamento|engagement|curtidas?|likes?|comentarios?|duracao media|tempo medio)\b`

- Também reprovam rótulos crus: `\b[a-z]+_[a-z_]+\b`, `\b[rp]\d{1,2}\b` ou `\b(reach|growth|title_test|low|medium|high)\b` (`rotulo_cru`).
- Os itens 3–6 rodam sobre o texto já sem os títulos retirados pela etapa (a).
- Na tabela de teste, "grade de horarios" e "a nota e o titulo" passam; "tempo de exibicao" reprova.

**7. Reprovação.**
- **Tentativa 2.** Um `user` só (ver §4.4), com `corrigir: {"R2.reasoning":{"anterior":"…","motivo":"…","permitidos":["85","412","0,21×","21%"]}}`.
  - A resposta da tentativa 1 não entra como turno.
  - O schema traz só os campos reprovados, com as mesmas chaves e outro `seed`.
  - Os campos aprovados ficam.
  - O canário passa essa mensagem pelo `/apply-template` real.
- **Depois da tentativa 2.** Todo campo ainda reprovado vira **template do código**, montado só com os `fatos` do escopo e com todo título entre “ ”. Exemplo de R4: "“{titulo}” recebeu {recent_90d} views nos últimos 90 dias, {pct_do_canal} do canal: vale reforçar a tela final.".
  - Na `title_test`, o código não inventa título: se `suggested_variant_description` segue reprovado, o campo **sai do PATCH** (o Zod o aceita ausente, `intelligence-schemas.ts:13`). Todo outro campo (`summary`, `Pj.diagnosis`, `Pj.action`, `Ri.reasoning` de R1/R2/R4 e o passo concreto de R2/R4) tem template próprio.
  - Os templates passam no mesmo validador, e o teste de tabela cobre cada template, um título com dígitos e o caso em que todos os campos caem no template.
  - O log grava `fallback: [campos]`.
- **Pouco orçamento.** Com menos de 9 min restantes, a tentativa 2 é pulada e os campos vão para o template.
- **`fail` só por infraestrutura:** llama fora, `truncado`/`timeout`/`json`/`pensou` nas duas tentativas, ou Zod reprovado depois da montagem.

### 4.6 `sitio.py`, trava e segredos

**`pedir`** (hoje `pedir(cli, metodo, caminho, params, agora)`, sempre `cli.get`, `sitio.py:90-127`)
- **Na fase 1, nada muda.** O GET continua em `cli.get`, byte a byte igual. O ramo de status de `sitio.py:108-116` fica intocado: 3xx/4xx → `formato`; 5xx/429 → `_velho` (`teste_s1.py:80-95`). `teste_s1`/`teste_s2` passam sem edição.
- **Método não-GET** usa `cli.request(metodo, …, json=corpo, follow_redirects=False)`. O `CliFalso` (`trilha/sitio_falso.py`) ganha `request()` com o mesmo registro de `chamadas`.
- **Parâmetros novos, só por palavra-chave:**
  - `corpo=None`;
  - `fase=FASE`, repassado a `autorizada`;
  - `chave=None`;
  - `timeout=None`: quando dado, substitui `TIMEOUT_LENTO.get(caminho, TIMEOUT)`. O `fila_intel.py` passa 15 s no claim, no fail e no snapshot, 60 s no PATCH e 10 s no `fail` do `finally` (§4.1).
- **Com `fase=2` (qualquer método) ou método não-GET:**
  - não lê nem grava `_CACHE`, não chama `_velho` e não repete a chamada;
  - exige `chave=` explícito; sem ele, `FalhaSite(caminho, …)` do tipo `sem_chave` antes da rede;
  - 204 → `(None, t, False)`.
- **`FalhaSite`** ganha `status=None, code=None` por palavra-chave e mantém `tipo, rota, detalhe` posicionais. O mapeamento de fase 2:

| Resposta | `FalhaSite` |
|---|---|
| 400/404/409/422/500 | `('recusa', rota, str(st), status=st, code=…)`; `code` só quando o corpo é JSON e `error` é um objeto com `code`, senão `None`, sem exceção |
| 401/403 | `('chave', rota)` |
| 429 | `('429', rota, status=429)` |
| 502/503/504 | `('5xx', rota, status=st)` |
| rede | `('timeout'\|'fora', rota)` |
| 3xx e qualquer outro 4xx | `recusa` |

  `recusa` não entra em `MENSAGEM`: o proxy nunca a vê.
- **`FASE = 1` não muda.** Só o `fila_intel.py` passa `fase=2`.
- **`ROTAS_FASE[2]`** = fase 1 + `POST …/task/claim`, `POST …/task/<uuid>/fail`, `GET …/intelligence?channel_id=<uuid>` e `PATCH …/intelligence`.

**Testes do cartão S4**
- Com a fase padrão, claim, fail e PATCH levantam `RotaBloqueada` sem rede.
- Com `fase=2`: nada vem de cache nem de `_velho` num 5xx; sem `chave=` dá `sem_chave`; 204 devolve a tupla; 409 dá `recusa` com status e code; corpo de erro não-JSON dá `code=None`; `timeout=` é respeitado.
- `teste_s1`/`teste_s2` passam sem edição.

**Instalação**
- **`sitio.py`**, só pelo **cartão S4**. O `trilha/s4.py` copia `proxy.py` para `proxy.py.novo` sem alteração e escreve o `sitio.py.novo` (0600), que é o que `cartao.sh:8-9` e `deploy.sh:11` esperam. Replay com `mudaram: 0`.
- **`deploy.sh`** toma o lock por descritor **antes** da guarda de mídia (`deploy.sh:7`) e o segura até o fim: `exec 9>>/opt/agente/fila_intel.lock; flock -n 9 || { echo 'ESPERAR: fila_intel em execução'; exit 1; }`.
  - A troca (`:11`) e o restauro do rollback (`:20`) do `sitio.py` passam a copiar para um temporário e fazer `mv`, porque o cron importa o `sitio.py` a cada execução.
- **`cartao.sh`** ganha, depois da linha 22, `[ "$T" = S4 ] && { (cd docs/trilha && AGENTE_SITIO="$B/sitio.py.novo" $PY -B teste_s1.py) || falha teste_s1; }`. O `teste_s2` roda depois do `deploy.sh S4`, porque o proxy carrega o `sitio.py` do próprio diretório (`trilha/s2.py:20`). O `cartao.sh` também ganha:

  ```
  if [ -s sitio.py.novo ] && [ -f fila_intel.py ]; then (cd docs/trilha && env -u PYTHONPATH AGENTE_SITIO="$B/sitio.py.novo" AGENTE_FILA="$B/fila_intel.py" /opt/agente/venv/bin/python -B teste_fila.py) || falha teste_fila; fi
  ```

  - O `env -u` tira o stub `st/httpx.py` do caminho.
  - O `teste_fila.py` carrega o worker só por `AGENTE_FILA` (SourceFileLoader, como `replay2.py`), nunca a cópia de `docs/trilha/`.
- **`fila_intel.py`** vai por scp para `docs/trilha/` e é instalado sob o lock:

  ```
  flock /opt/agente/fila_intel.lock sh -c 'cp -p fila_intel.py fila_intel.py.bak; install -m 600 docs/trilha/fila_intel.py fila_intel.py.tmp && mv fila_intel.py.tmp fila_intel.py'
  ```

  - Só depois de `teste_fila.py` passar **na forja**, a cada instalação ou atualização: `(cd /opt/agente/docs/trilha && env -u PYTHONPATH AGENTE_SITIO=/opt/agente/sitio.py AGENTE_FILA=/opt/agente/docs/trilha/fila_intel.py /opt/agente/venv/bin/python -B teste_fila.py)`.
  - Um cartão que reverta o `sitio.py` comenta antes a linha do crontab.
- **O `teste_fila.py` cobre no mínimo**, com `CliFalso` e llama falso:
  - cada linha das tabelas do §4.1 passos 3 e 6, e cada saída dos passos 4–5 (`retry:true` para llama, orçamento e snapshot timeout/5xx/429; sem `retry` nos demais; `fail`→409 = `conflito`; `fail` que falha = `fail_perdido`), conferindo quantas vezes `fail`/PATCH são chamados (0 ou 1) e com qual `retry`;
  - `CANAIS_FILA` vazio ou desconhecido → `config`, sem chamadas ao site;
  - `/slots` ocupado → zero claims;
  - `SystemExit` depois do claim → exatamente um `fail` com `retry`, e uma linha `morto`;
  - `SystemExit` com `patch_enviado` → nenhum `fail`;
  - saída `reprovada` com o `fail` perdido → nenhum segundo `fail`, e a linha é `fail_perdido`, não `morto`;
  - lock ocupado → 0 no cron e 75 no manual;
  - exatamente uma linha jsonl por execução com lock;
  - nenhum valor de chave no jsonl;
  - os de `features`/`escolher` (§4.2, §4.3) e o validador (§4.5).

**Segredo**
- `SITIO_CHAVE_FILA` e `CANAIS_FILA` moram em `/opt/agente/fila_intel.env` (thiago:thiago 0600), que nenhuma unit carrega.
- No modo normal, **toda** chamada passa `chave=` com a chave da fila.
- `--sombra` e `--congelar` leem `SITIO_CHAVE` e `SITIO_CANAL_*` de `/etc/default/proxy-agente` pelo próprio Python. Nunca por argv, env do cron ou `set -a`.
- O leitor nunca põe a linha nem o valor em exceção ou log.
- **O5 da onda0b (pré-condição resolvida em 19/09).** O `install` do O5 troca `/etc/default/proxy-agente` inteiro, e o `gerar_segredos.py` agora preserva as linhas que não são as 4 credenciais (`preservadas()`), então `SITIO_CHAVE`/`SITIO_CANAL_*` sobrevivem. Prova, depois de qualquer mexida no arquivo: `grep -cE '^SITIO_(CHAVE|CANAL_PT|CANAL_EN)=' /etc/default/proxy-agente` → 3.
- **Provas:**
  - `grep -c SITIO_CHAVE_FILA /etc/default/proxy-agente` → 0;
  - o `environ` do `proxy-agente` sem `FILA`;
  - `sed -n 's/^SITIO_CHAVE_FILA="\(forja_[A-Za-z0-9_-]\{43\}\)"$/\1/p' /opt/agente/fila_intel.env | wc -l` → exatamente 1. Sem isso, a prova seguinte é vazia e passa sozinha;
  - o comando abaixo, sem o valor em argv, dá 0:

  ```
  grep -rlFf <(sed -n 's/^SITIO_CHAVE_FILA="\(.*\)"$/\1/p' /opt/agente/fila_intel.env) /opt/agente/log/ /opt/agente/sombra/ | wc -l
  ```

**Kit da chave**
- **`nova_chave.py --fila`** desvia **antes** das checagens de `/etc/default/proxy-agente` (`nova_chave.py:12-19`).
  - Grava só `SITIO_CHAVE_FILA="forja_…"` em `/opt/agente/fila_intel.env`.
  - Recusa se o arquivo não existir ou não for 600, e se já houver chave sem `--trocar`.
  - Imprime o SQL com `'forja (fila)'` e `array['read','intelligence']`.
- **`seed_chave_forja.sh`:**
  - `$1` de 64 hex → modo da fase 1;
  - `$1 = fila` → o hash é o `$2`, validado por `^[0-9a-f]{64}$`, e grava `'forja (fila)'` com `{read,intelligence}`. No mesmo SQL, revoga (`revoked_at = now()`) toda outra `'forja (fila)'` ativa do site com `key_hash <> $2`. Depois confere que resta exatamente uma ativa, ou para;
  - qualquer outra forma → `pare`;
  - nome e permissões vêm de um `case` fechado; depois do insert, confere as permissões e para se o hash já existia com outras.

### 4.7 Modos auxiliares

Todos tomam o lock do §4.1. As linhas desses modos levam `modo` e não contam para o pulso.

- **Scripts de apoio** (antes do S4, fora do `sitio.py`, que ainda é da fase 1): `trilha/capturar_fixture.py` e `trilha/sonda_f0.py`.
  - Leem a chave `{read}` pelo Python e usam `httpx` direto.
  - `capturar_fixture` faz **só GET**.
  - Nenhum dos dois é importado pelo proxy nem pelo `fila_intel.py`.
- **`--congelar --canal PT`:** salva `/opt/agente/sombra/congelado-PT.json` com `congelado_em`. Faz a checagem de `/slots`.
- **`--sombra --snapshot arq [--base-sintetica queda|alta] [--recs-sinteticas]`:** sem claim, sem PATCH e sem fail.
  - `hoje` = `congelado_em`, nunca o relógio.
  - `--base-sintetica` injeta um `recent_base` fictício sobre o `x` do snapshot (já com `--recs-sinteticas`, se houver): `queda` = Σ views da base max(4·(x+1), 60) e Σ inscritos max(4·(x_insc+1), 40), o que dá `P1` reach e `P2` growth; `alta` = Σ views max(x, 60 − x) e inscritos 0, o que passa o piso de 60 com score ≥ 5 (x = 29 na fixture), então `[]` pela fórmula e não pelo volume.
  - `--recs-sinteticas` sobrescreve, na cópia em memória, `view_count`/`recent.views` de 3 vídeos fixados na fixture, para disparar exatamente uma R1, uma R2 e uma R4.
  - Grava `/opt/agente/sombra/<canal>-<quando>.json` com o `system`, o `user`, o payload (com `task_id` = `00000000-0000-4000-8000-000000000000`), o veredito e os tempos. Mantém os 30 mais recentes.
- **`--canario`:** não clama.
  - Faz `POST …/task/00000000-0000-4000-8000-000000000000/fail {reason:'canario'}` com a chave da fila e espera 404. Um 400 reprova: o corpo foi recusado antes da busca.
  - Sonda a 8080 com o schema real de 10 recs + 2 prioridades: resposta válida, `reasoning_content` vazio e tok/s ≥ 80% do medido sem schema.
  - Passa a mensagem de tentativa 2 pelo `/apply-template`.

## 5. Rollout

| Card | Quem | O quê | Portão |
|---|---|---|---|
| **F0** | Claude + dono | Commit do site (§3) em staging → main | Mockup (selo, linha de summary, tela sem "Potencial"/"regras fixas") aprovado **antes** do código · `npx vitest run` completo (~160 s) + `npm run db:start && HAS_LOCAL_DB=1 npx vitest run test/integration/youtube-intelligence-forja.test.ts` + typecheck web/api · Vercel verde · validação **autenticada antes da promoção** (`docs/ops/runbook-cms-e2e-local.md`): varredura da sidebar 200/`ok`, e `/cms/youtube/analytics` e `…?tab=coach` sem boundary, com console sem `error`. Localmente não há conexão YouTube com token válido, então a página para em "Nenhuma conexão YouTube encontrada" (`page.tsx:32-46,73-81`); os cenários A–D do §3.7 ficam no teste jsdom: A → "por Cowork · 18/05", 3 cards, badge 3; B → "por forja", summary, sem card verde nem "Potencial"; C → heurístico; D → "por forja", card de Alcance sem "+N pts", sem "regras fixas", badge 1 · **depois da promoção**, com `sonda_f0.py` na forja (chave `{read}` lida pelo Python): `GET …/intelligence?channel_id=<PT>` → 200 com `recent_window` (prova o deploy novo); só então, `POST …/task/claim {channel_ids:[<uuid inexistente>]}` e `PATCH …/intelligence` vazio → 403 cada; e `GET …/intelligence/task` → 403, feito só com `select count(*) from youtube_intelligence_tasks where status='pending'` (dono, leitura) = 0 (se der mais, repete só esse GET num momento com 0, antes do F4). Qualquer outro status reprova; um 200/204 dispara o rollback do F0 · logado em prod, PT "por Cowork · 18/05" com 3 cards e badge 3, e `?tab=coach` abre o Health Coach |
| **F0.5** | dono + Claude | Na forja, `capturar_fixture.py` salva `docs/trilha/fixture_pt.json` com `congelado_em`. O código propõe séries; o dono grava `series.json` e confere a saída de `escolher` | Fixture com 35 vídeos e `recent_window` não nulo · `series.json` e lista conferidos |
| **S4** | dono | Cartão da Trilha com o `sitio.py` novo, `s4.py` e o `deploy.sh`/`cartao.sh` do §4.6 | `cartao.sh S4` (replay `mudaram: 0`, `teste_s4.py`, `teste_s1` sem edição sobre o `sitio.py.novo`) · `deploy.sh S4` com PID novo · `cd docs/trilha && python3 -B teste_s2.py` sem edição · `prova_site.py agente-auto` 5/5 |
| **F1** | **dono** | Na forja, sem sudo: `install -m 600 /dev/null /opt/agente/fila_intel.env`, `mkdir -m 700 -p /opt/agente/sombra`, `nova_chave.py --fila` e `CANAIS_FILA=PT` no mesmo arquivo. No Mac: `seed_chave_forja.sh fila <sha>`. Instala o `fila_intel.py` (§4.6) depois de `teste_fila.py` verde na forja | `curl -fsS 127.0.0.1:8080/slots` → 2 entradas com `is_processing` · `--canario` → 404, sonda de schema e `/apply-template` aprovados · o mesmo `fail` com a chave `{read}` → 403 · um turno de chat e, logo depois, a última linha de `roteamento.jsonl` com `quando` a menos de 1 min de `date +%FT%T` (mesmo fuso) · **nenhum claim antes do F4** |
| **F2** | dono roda, Claude lê | 3× `--sombra --snapshot docs/trilha/fixture_pt.json`; 2× com `--base-sintetica queda`/`alta`; 3× com `--recs-sinteticas`; depois `--congelar --canal PT` para o F3 (se a saída de `escolher` mudar, o dono confere só a diferença) | Payload final aprovado 8/8 pelo espelho **e** pelo `PatchPayloadSchema.safeParse` real (Claude roda `npx tsx` no Mac sobre os payloads copiados) · primeira geração aprovada ≥ 6/8 · template em no máximo 1 campo de 1 rodada, nunca no `summary` · saída de `escolher` igual à fixture conferida · as 3 rodadas reais com campos numéricos idênticos · rodada `queda` com `P1` sem verbo de alta; rodada `alta` com `priorities: []` · rodadas sintéticas com R1, R2 e R4 redigidas e aprovadas · ≤ 10 min por rodada e p95 de geração < 7 min |
| **F3** | dono, às cegas | De cada rodada do F3 (o congelado real e 2 com `--recs-sinteticas`, uma delas também com `--base-sintetica queda`, para que `diagnosis`/`action` de `P1`/`P2` entrem no julgamento), o arquivo de sombra guarda o `system` e o `user` enviados ao 12B. O Cowork recebe **essas mesmas mensagens**, mais o `S` da rodada e a tabela de faixas do §4.4 como texto, numa sessão sem ferramentas do pipeline (MCP desligado, sem chave), e devolve JSON com as mesmas chaves. Alvo, números e `patterns_detected` são do código e ficam fora do julgamento | Itens = pares (mesmo alvo: texto da forja × texto do Cowork) mais o `summary`, somando as rodadas (≥ 5 pares) · o texto do Cowork passa pelo validador do §4.5 (o `f3_cego.py` carrega `docs/trilha/fila_intel.py` do kit por SourceFileLoader); fora de faixa ou com métrica proibida, é regenerado uma vez, nunca truncado nem mascarado · `trilha/f3_cego.py` (Mac) tira o `AVISO_ESTREITO`, põe em cada linha os `fatos` do escopo do item (os do `user` enviado), sorteia a ordem em cada par com semente guardada e grava `f3.csv` sem a origem; a chave de origem fica em `f3_chave.json`, aberta só com o CSV fechado · **errada** = número que não bate, vídeo errado ou ação contraproducente · liga com a forja ≥ 80% "aceitável" e zero "errada"; se o Cowork tirar < 80%, "aceitável" é reescrito e os mesmos itens são rejulgados com outra semente (no máximo 2 vezes; depois decide o dono) |
| **F4** | dono | (1) Uma execução **manual** com um pedido PT do botão; (2) `crontab -l > /opt/agente/crontab.bak-F4 && (cat /opt/agente/crontab.bak-F4; echo '<linha do §4.1>') \| crontab -`, conferindo que `crontab -l \| grep -c -e retentar -e pulso` não mudou; (3) o dono cria o check `URL_FILA` no healthchecks (§6) e a regra do §6 é inserida **no `pulso.sh` vivo** (a O2 é pré-requisito) por `ferramentas/fase2/pulso_f4.py`, que insere o bloco antes de `[ "$ok" -eq 1 ]` (âncora com contagem 1, como `trilha/s3.py:troca`); `bash -n`; `cp -p pulso.sh pulso.sh.bak-F4`; `install -m 755 … pulso.sh.tmp && mv` (o arquivo vivo é `/opt/agente/docs/pulso.sh`, num diretório do thiago; a troca por rename funciona sem sudo seja qual for o dono do arquivo) | Execução manual: `desfecho: ok`, exatamente uma `youtube.intelligence_ready` com link para a aba e `result_summary.claimed_by` = id da `forja (fila)` · o próximo pedido PT (task do cron de segunda, ou o botão só 24 h depois do `completed_at` da manual; antes, conferir que não há `pending`/`running` PT) fica `completed` em ≤ 40 min com o llama livre e sem chat, com `result_summary.claimed_by` = id da `forja (fila)` (SQL de leitura do dono), e aparece "por forja · dd/mm" com sessão autenticada · a linha `cowork` continua no banco · o **EN** só entra em `CANAIS_FILA` com ≥ 8 vídeos e um F3 próprio |

**Rollback, na ordem inversa**
- **F4.**
  - Tira só a linha da fila: `crontab -l | grep -vF '/opt/agente/fila_intel.py' | crontab -`, e confere `crontab -l | grep -c fila_intel` → 0 com `retentar`/`pulso` intactos. Restaurar o `.bak-F4` inteiro apagaria linhas acrescentadas depois do F4.
  - Espera o lock (`flock /opt/agente/fila_intel.lock true`), o que deixa a execução em curso terminar.
  - Volta o pulso ao `.bak-F4`.
- **Qualidade, com o F0 no ar.** O dono, por `npx supabase db query --linked`:
  1. exporta `select * from youtube_intelligence where source='forja'` para JSON;
  2. apaga as linhas `forja` de vídeo;
  3. renomeia a de canal: `update … set source='forja_retirada_' || to_char(now(),'YYYYMMDDHH24MI') where source='forja'`.

  O sufixo evita colisão com os índices. A allowlist do §3.6 volta a mostrar o Cowork, e o Cowork já não lia a forja (§3.5).
- **F1 (dono).** `revoked_at` na `forja (fila)` e apaga `/opt/agente/fila_intel.env`.
- **S4.** O `deploy.sh` restaura o backup, com troca atômica.
- **F0.** O dono:
  1. `git revert` e promoção, sem esperar o banco (o Health Coach velho já ignora `forja`);
  2. antes de qualquer execução do Cowork, exporta e apaga `where source like 'forja%'` (o snapshot velho não filtra `source`);
  3. apaga as `notification_deliveries` com `status='pending'` das notificações `youtube.intelligence_ready`.

## 6. Observabilidade
- **Log.** Uma linha por execução com lock (§4.1).
- **Pulso.** Entra no F4, com leitura por `python3 -` embutido, e reporta num **check próprio do healthchecks** (`URL_FILA`, criado pelo dono no F4, período 1 h). O bloco calcula `ok_fila`, pinga `$URL_FILA` ou `$URL_FILA/fail` com as mesmas tentativas do pulso e acrescenta seu motivo a `$motivo` (para o `pulso.log`), **sem tocar em `ok`**. O healthchecks só avisa na transição: se a fila pintasse o check principal, uma task reprovada o deixaria vermelho por até 24 h e calaria um proxy, llama ou esteira caídos nesse intervalo. O check da fila fica vermelho se:
  - o mtime de `fila_intel.jsonl` tem mais de 45 min (cron morto ou import quebrado). Arquivo ausente conta como vermelho: o bloco só entra no passo (3) do F4, depois da execução manual do passo (1), que cria o arquivo;
  - a linha `modo: cron` mais recente com `task` não nulo tem menos de 24 h e não é `ok`. Uma linha `ok` mais nova apaga o motivo na hora;
  - nenhuma linha `modo: cron` das últimas 24 h chegou à resposta do claim, isto é, todas ficaram em `ocupado|chat|llama_fora|config|chave` ou em `falha_site` com `etapa: claim` (chegar ao claim = resposta 200 ou 204). Isso pega config errada, chave recusada, `/slots` mudado e relógio divergente. No `pulso.log`, o motivo sai como `fila-sem-claim-24h:<desfecho dominante>`.
- **Site.** `failed` com `error_message` legível; `stale` pelo watchdog, com `auto-released`.

## 7. Fora desta fase
- CTR, retenção e eixos sem dado (`BACKLOG-site.md` itens 1–2).
- A **R3** (`distribution_expand` por `views_at_7d`): espera 4 uploads novos.
- A UI das recomendações por vídeo (`YtGradesV2` não montado) e a leitura por vídeo.
- Notificações ricas e o ciclo `flagged→diagnosed` pela forja.
- O tipo `youtube.intelligence_ready` no catálogo.
- Eras e dia da semana.
- As horas restantes do cooldown na UI.
- O canal EN, até ter vídeos.
- Aposentar o Cowork (decisão com os dados do F3).
- Fase 3.

## 8. Riscos aceitos
- **Análise estreita e magra.** Sem CTR nem retenção, sem eixos com o tráfego atual e hoje 0 recomendações; o canal PT sai com summary e 2 padrões. Isso fica visível no `AVISO_ESTREITO` e na linha de summary.
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
  - gravar diagnóstico `source='forja'` visível no Health Coach (texto escapado pelo React);
  - 1 notificação por task.

  Não toca tasks do Cowork, não lê além de `{read}` (mais as próprias linhas `forja` no snapshot, §3.5), não altera linhas `cowork` e não alimenta o Cowork (§3.5). A resposta é revogar (F1) e retirar (§5).
- **Snapshot limitado a 50 vídeos** (`services/youtube.ts:222`, os mais recentes). Acima disso, coortes e séries antigas somem das regras. Hoje são 35.
- **Regex de números reprovando texto correto.** O F2 mede; ajusta-se a normalização; o template garante que a task não trava.

## 9. Achado colateral — o overview soma fotos de 90 dias

A fase 1 disse "428 views nos últimos 28 dias", e o erro está no site.
- O overview (`services/youtube.ts:1857-1864,1917-1919`) soma as linhas de `youtube_video_analytics` desde o corte, mas cada linha já é um total móvel de 90 dias.
- Os 428 são 13 fotos de ~33 views. O real é **~29 views nos últimos 90 dias**.
- O `scoreVideo` também recebe essas fotos como se fossem views diárias.

Duas correções à parte:
- **Site** (`BACKLOG-site.md` item 0, prioridade alta): usar a linha mais recente. Antes, conferir quais telas consomem `kpis.views`.
- **Forja, cartão S5:**
  - `resumir_canal` passa a citar `Σ recent.views` do snapshot como "views nos últimos 90 dias", pelo `GET …/intelligence?channel_id=`, que entra em `ROTAS_FASE[1]` como só leitura;
  - o S5 muda no próprio cartão `teste_s1.py:49-50` (13 → 14 rotas) e `:51-58`: tira o GET `/youtube/intelligence` sem parâmetros de `BLOQ` (12 → 11 tentativas) e põe no lugar o mesmo GET com `channel_id` não-uuid;
  - se o S5 entrar antes do S4, o teste do S4 deixa de listar esse GET entre as rotas bloqueadas, e o "sem edição" do S4 passa a valer contra o `teste_s1` já editado.
