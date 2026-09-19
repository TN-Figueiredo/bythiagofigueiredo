# Fase 2 — a forja drena a fila de inteligência do YouTube

**Data:** 2026-09-19 · **Versão:** v11 (rodadas 1–10; escopo 2a) — versão final do spec
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
- **Envelope (vale também para o `fail` do §3.4).** As duas rotas novas respondem só pelos helpers do repo, como as irmãs: sucesso por `pipelineSuccess(payload, 200, auth)`, que embrulha em `{"data": …}` (`lib/pipeline/helpers.ts:17-21`); recusa por `pipelineError(code, message, status, auth)`, que embrulha em `{"error":{"code","message"}}` (`:5-15`); e o 204 como `new NextResponse(null, {status:204, headers: buildRateLimitHeaders(auth)})`. **Todo corpo descrito neste spec é o conteúdo do `data`**, nunca o corpo da resposta. Do lado da forja nada muda: o `pedir` passa a resposta por `_desembrulha` (`sitio.py:77-81`, chamado em `:121`), que descasca `{data:…}` antes de devolver — também no ramo não-GET do §4.6, que é o mesmo corpo de função —, e por isso o §4.1 continua lendo `task.channel_id` e `recent_window` direto.

**`GET …/intelligence/task`** (legado do Cowork)
- Passa de `authenticateRead` (`task/route.ts:9`) para `authenticateIntel({apiKeyOnly:true})` seguido de `requirePermission(auth,'write')` (403 `FORBIDDEN` sem `write`/`admin`). É o caminho do Cowork; a chave `{read,intelligence}` clama só pelo POST com `channel_ids`, como no MCP (§3.1).
- **Força** `status='pending'`, o que fecha o `?status=completed` que reabria task concluída.

### 3.3 PATCH `…/intelligence` — REST e MCP pelo mesmo portão, dentro do serviço

**Validação**
- `authenticateIntel` fica na rota, que passa a declarar `export const maxDuration = 60`. Hoje ela só declara `dynamic` (`intelligence/route.ts:7`); sem isso vale o padrão de 300 s do Vercel (o `apps/web/vercel.json` não tem bloco `functions`, então não há teto de projeto), e a invariante de tempo do §4.1 perde a garantia. O `maxDuration` é do **módulo**: o teto de 60 s passa a valer também para o `GET` do snapshot, que mora no mesmo arquivo (`intelligence/route.ts:9-24`) e é a leitura mais pesada (5 consultas em paralelo, mais as duas novas de `youtube_video_analytics` do §3.5). Queda de teto aceita e folgada — a forja já corta o snapshot em 15 s no próprio cliente (§4.6) —, registrada aqui para não ser lida como efeito não visto.
- `PatchPayloadSchema` hoje não roda em nenhum caminho de produção — no código só aparece em `z.infer` (`services/youtube.ts:5,70`); o único `safeParse` existente é de teste (`test/analytics-intelligence-api.test.ts:2,33-107`), que os tetos novos não quebram (lá `patterns_detected` tem 1 item, `pattern_id` 12 caracteres, `category` 15 e `sample_size` 15) e por isso não entra na lista de reescritos do §3.7. O F0 passa a validar **também o payload do Cowork**, pela primeira vez. O teste de regressão com o payload real de maio está em §3.7.
- O `safeParse` roda **dentro de `submitIntelRecommendations`** (`:282`), cuja assinatura passa de `data: IntelRecommendations` para `data: unknown` (`:284`); somem os casts `body as IntelRecommendations` (`intelligence/route.ts:36`) e `params.intel_payload as IntelRecommendations` (`mcp/services/ab-tests.ts:149`), e com eles o `type IntelRecommendations` dos imports de `intelligence/route.ts:5` e `mcp/services/ab-tests.ts:13`.
- O schema ganha teto no que hoje não tem (`lib/youtube/intelligence-schemas.ts:43-49`): `patterns_detected .max(30)`, `pattern_id .max(80)`, `category .max(40)`, `sample_size .int().min(0)`. Pré-verificação só de leitura: nenhuma linha `cowork` passa disso.
- `err()` e `serviceErrorToResponse` não mudam. Sai o ramo morto `validation_failed` (`intelligence/route.ts:39-45`: nenhum serviço lança `VALIDATION_FAILED`), e o `catch` da rota fica só com `serviceErrorToResponse`. Schema inválido e as quatro recusas `forja` → 400 `VALIDATION_ERROR`, com até 3 problemas na `message` como `<path>: <message>`, unidos por `; ` (as recusas usam os paths `video_recommendations`, `notifications`, `coaching` e `coaching.priorities`). O `PARTIAL_FAILURE` lista os alvos na `message`. A forja decide só por `status` (§4.6); ninguém lê `code` nem `details` na 2a.

**Fonte derivada:** `deriveSource(ctx)` = `'cowork'` quando as permissões têm `write` ou `admin` **ou** `ctx.source === 'session'`; `'forja'` em todo o resto. O ramo da sessão é o §2.4 ("chave com `write`/`admin`, ou sessão, grava `cowork`"), e o PATCH aceita sessão por não ser `apiKeyOnly`; hoje ela acerta por acidente, porque recebe `['read','write']` fixo (`lib/pipeline/auth.ts:88`). A condição é escrita **por exclusão**, e não como `ctx.source === 'api_key'`, para falhar fechada: `source` é opcional em `ServiceContext` (`services/types.ts:18`), e um caminho futuro que esquecesse de preenchê-lo rotularia a chave estreita como `cowork` e **desligaria as quatro recusas de escopo** abaixo. Hoje os dois caminhos que chegam ao serviço preenchem (`services/http-adapter.ts:6-17`, `mcp/services/ab-tests.ts:19-27`), e o precedente é o `deriveSource` de `app/api/pipeline/items/[id]/recording/service.ts:160-167`. Há teste com `ctx.source: 'session'` (grava `cowork`) e teste com `ctx.source` ausente e permissões `{read,intelligence}` (grava `forja`, e as recusas de escopo valem).
- As gravações usam essa fonte no lugar do `'cowork'` fixo (`youtube.ts:331,340,381,392`).
- Tudo depois do `safeParse` usa `parsed.data`, nunca o corpo cru. Assim o strip do Zod descarta um `source` no corpo e qualquer chave extra numa recomendação, que hoje vai crua para `recommendations` (`youtube.ts:339`). Há teste, com chave `write` (a fonte `forja` recusa `video_recommendations` não vazio): uma chave extra em `video_recommendations[0]` não aparece na linha gravada.

**Dono (§2.8).** Chave sem `write`/`admin` recebe 409 `TASK_NOT_RUNNING` antes de qualquer escrita quando `result_summary.claimed_by ≠ ctx.keyId`, e também quando `keyId` está ausente.

**Todas as recusas 4xx acontecem antes da primeira escrita, exceto o 409 do CAS de fechamento** (tabela de desfechos). Esse 409 sai quando a task virou `stale`, foi fechada por chave `write` ou foi devolvida à fila e clamada de novo (outro `started_at`) durante as gravações. Nesse caso as linhas da fonte do PATCH já podem ter sido gravadas (num PATCH `forja`, só a de canal `forja`); as da outra fonte, nunca. O 409 quer dizer "a task não é mais sua", não "nada foi gravado". O SELECT da task passa a trazer `result_summary` e `started_at` (hoje só `id, channel_id, status`, `youtube.ts:292`), de onde saem o `claimed_by` da trava de dono e o `started_at` do CAS de fechamento, e troca o `.single()` de hoje (`youtube.ts:295`) por `.maybeSingle()`: com `.single()`, 0 linhas vêm com `error` (PGRST116) e virariam 500 pela regra abaixo. Um `error` nesse SELECT, ou no SELECT de integridade dos vídeos (só o Cowork chega lá), devolve 500 `INTERNAL_ERROR` antes de qualquer escrita, nunca 404 nem 422; 404 só com 0 linhas sem `error`. Há teste com erro de banco em cada SELECT → 500 sem escrita, e teste para cada recusa:
- schema;
- estado e dono da task;
- as quatro recusas da fonte `forja` abaixo;
- o 422 de integridade, `VALIDATION_ERROR` quando o vídeo é de outro canal (`:311-322`; só o Cowork chega lá).

**Fonte `forja` — regras impostas pelo servidor (escopo 2a)**
- Rodam **logo depois do `safeParse`, antes do SELECT da task** — e portanto antes da trava de dono, do 404 e de qualquer escrita —, sobre `parsed.data`. É estritamente mais seguro: nenhuma ida ao banco para um corpo que já será recusado, e a recusa só fala do corpo do próprio chamador, então um `task_id` inexistente ou de outro site sai 400 sem dizer nada sobre a existência da task. É também o que torna a guarda sondável em produção pelo `--canario` (§4.7), que já tem `PATCH …/intelligence` em `ROTAS_FASE[2]` (§4.6):
  - `notifications` não vazio → 400 `VALIDATION_ERROR`;
  - `video_recommendations` não vazio → 400 `VALIDATION_ERROR`. Ausente ou `[]` passa;
  - `coaching` ausente, ou `coaching.priorities` não vazio → 400 `VALIDATION_ERROR`. Na 2a a linha de canal com `coaching` é o único produto da forja; um PATCH `forja` sem ele não grava nada que o Health Coach leia.
- **Escolha: recusar, não reescrever.** O servidor não zera `priorities` nem descarta recomendações em silêncio: um payload `forja` fora do escopo é bug do worker e tem de aparecer (a forja o trata como `reprovada`, §4.1). É também o mais simples: quatro condições no mesmo ponto, sem ramo de escrita novo. A forja sempre manda `coaching` com `priorities: []` e nunca manda `video_recommendations`.
- Consequência: a forja nunca grava linha de vídeo, então o laço de vídeos (`:306-371`, que inclui a transição `flagged→diagnosed`) nunca roda para ela. A linha de canal usa o update-or-insert por fonte que já existe (`:373-408`), trocando `'cowork'` por `deriveSource(ctx)`: cada PATCH `forja` sobrescreve a linha `forja` do canal e nunca toca a `cowork`, e o índice `(site_id, channel_id, source) where video_id is null` (`20260517000003…sql:208-210`) garante uma só.
- **Sem notificação na 2a.** O PATCH `forja` não notifica ninguém; a análise aparece na linha de summary do Health Coach (§3.6). A notificação de análise pronta fica para depois (§8).

**Fechamento da task** (hoje sem CAS e sem checagem, `youtube.ts:432-441`)
- CAS: `.eq('id').eq('site_id').eq('status','running')`; para chave estreita, também `.eq('result_summary->>claimed_by', keyId)`; sempre `.eq('started_at', <started_at do SELECT da task>)`, que identifica o claim e não só a chave; e `.select('id')`.
- `result_summary` é mesclado: `{...anterior, recommendations, has_coaching, source, closed_by}`, só no ramo sem `dbErrors` — o único que escreve na task. O número de escritas falhas vai para o Sentry e para a `message` do 500, não para a linha da task.
- Desfechos:

| Situação | Estado da task | Resposta |
|---|---|---|
| Sem `dbErrors` | `completed` + `completed_at` | 200 |
| Com `dbErrors` | task **inalterada** (segue `running`; o ramo de fechamento não roda UPDATE nenhum): quem chamou devolve a task à fila com o `fail {retry:true}` que o 500 já manda (a forja pelo §4.1 passo 6, o Cowork pelo doc do §3.7), e se esse `fail` se perder o watchdog libera em 30–60 min | 500 `PARTIAL_FAILURE` |
| CAS devolveu 0 linhas | inalterado; as linhas gravadas por este PATCH ficam (num PATCH `forja`, só a de canal `forja`, que a próxima execução sobrescreve) | 409 `TASK_NOT_RUNNING` |
| Erro no próprio UPDATE do CAS (ramo sem `dbErrors`, o único que atualiza a task) | segue `running` até o watchdog | 500 `INTERNAL_ERROR` |

- No `PARTIAL_FAILURE`, a `message` do erro lista só os alvos (`video <uuid>: write_failed` ou `channel: write_failed`, este o único alvo possível de um PATCH `forja` na 2a); a mensagem crua vai só para o Sentry. A task não recebe `error_message`: ela segue `running` e quem a fecha é o `fail` do §3.4 (com `reason`) ou o `stale` do watchdog. O status inválido `partial_failure` sai.
- `PARTIAL_FAILURE` não escreve na task: o único UPDATE de fechamento é o do ramo sem `dbErrors`. Com `dbErrors`, o `failed` da task passa a existir só pelo `fail` do §3.4, e o `retry_count` volta a servir justamente no caso em que nada foi gravado.

**Código `TASK_NOT_RUNNING`** (409): task fora de `running`, de outro dono, ou CAS perdido.
- Entra no `ERROR_MAP` de `lib/pipeline/mcp/errors.ts` com `retryable:false` e `recovery_action` "The task is no longer held by this session (closed, stale or owned by another key). Do not resend; claim another task.", em inglês como as demais do `ERROR_MAP` (`mcp/errors.ts:45-60`).
- `VERSION_CONFLICT` (`:47`, `retryable:true`) fica para os itens.
- A forja olha o status 409, não o código.

**Efeito no botão.** `requestIntelligenceAnalysis` (`app/cms/(authed)/youtube/analytics/actions.ts:201-213`) olha só a task **manual** mais recente, por `requested_at`. O cooldown de 24 h, hoje inerte, passa a valer quando essa task é concluída. Uma task `cron` concluída não o dispara, e uma manual `failed`/`stale` mais recente o anula.

### 3.4 Falha explícita

**Novo** `POST /api/pipeline/youtube/intelligence/task/:id/fail`, com `authenticateIntel({apiKeyOnly:true})`.
- Arquivo `task/[id]/fail/route.ts`, com `params: Promise<{id: string}>` e `dynamic = 'force-dynamic'`. A rota é adaptador fino: autentica, valida o corpo e chama `failTask(ctx, taskId, {reason, retry})`, exportada de `lib/pipeline/services/youtube.ts` ao lado de `claimNextTask` (`services/youtube.ts:455`), onde moram o SELECT, o CAS e os dois desfechos — é ela que o teste de serviço do §3.7 chama com um `ServiceContext` mockado.
- Autentica **antes** de procurar a task. uuid inválido → 400.
- Corpo `{reason: string ≤ 500, retry?: boolean}` (Zod).
- CAS com `.eq('id').eq('site_id').eq('status','running')`, sempre `.eq('started_at', <started_at do SELECT da task>)` e, para chave estreita, `.eq('result_summary->>claimed_by', keyId)` — as mesmas cláusulas do CAS de fechamento do §3.3, porque `claimed_by` é o id da chave (`lib/pipeline/auth.ts:78`) e é igual em todo claim da forja, então dono + status não distinguem um claim novo. O `started_at` comparado é o que este mesmo request leu no SELECT, então a cláusula fecha a janela entre o SELECT e o UPDATE — não um `fail` que chegue minutos depois. Esse caso é inalcançável por outro caminho: a forja manda um `fail` só, em processo, e sob o lock do §4.1; pela invariante de tempo do §4.1 (≤ 25 min + 30 s contra os 30 min do watchdog) nenhum `stale` cai sobre execução viva; só uma chave `write` poderia tomar a task no meio, e aí a trava de dono já barra. Nem o `stale` do watchdog nem um fechamento por chave `write` são desfeitos —, mesclando `closed_by`:
  - com `retry:true` e `retry_count < 2`: `running→pending`, `retry_count+1`, `started_at` zerado, `error_message` zerado (o `reason` vai só para o Sentry), `requested_at` mantido. O `stale` de 7 dias continua limitando o total;
  - fora isso: `running→failed`, com `failed_at` e `error_message`, **sem** `completed_at`.
- Resposta 200: `pipelineSuccess({id, status, retry_count}, 200, auth)` — corpo `{"data":{id, status, retry_count}}` pelo envelope do §3.2 —, os três vindos do `.select('id, status, retry_count')` do próprio UPDATE do CAS; nunca `error_message` nem `result_summary`.
- `retry_count` já existe (`20260517000003…sql:243`), então não há migration.
- O SELECT da task traz `id, status, retry_count, result_summary, started_at` e usa `.maybeSingle()`: dele saem o `claimed_by` da trava de dono, o `started_at` do CAS e o `retry_count` — o supabase-js não incrementa coluna no UPDATE, então o valor gravado é `<retry_count lido> + 1`, e a condição `retry_count < 2` é avaliada sobre o valor lido. 404 só quando ele devolve 0 linhas sem `error` (task de outro site ou inexistente); com `error` → 500 `INTERNAL_ERROR`, que na forja dá `fail_perdido` e deixa a task para o watchdog; 409 `TASK_NOT_RUNNING` se não está `running` ou é de outro dono.

### 3.5 Snapshot

**Janela.** `SYNC_WINDOW_DAYS` sai de `sync-analytics-metrics/route.ts:18` (const local) para `lib/youtube/analytics-window.ts`, importado pelo cron e pelo serviço. Nada é exportado de `route.ts`.

**Campos novos em `getIntelligenceSnapshot`** (`youtube.ts:201-280`). `videos[].is_hidden` entra no select (`:219`) e no map (`:255-267`), e esse mesmo SELECT ganha `.eq('site_id', siteId)` ao lado do `.eq('channel_id', channel.id)` de `:220`: hoje ele se apoia só no `site_id` do SELECT do canal (`:207-212`), com o cliente de serviço, que ignora RLS. É dessa lista de `id` que saem os `.in('youtube_video_id', …)` abaixo, então o filtro de site que eles ganham vale só o quanto valer essa lista. O gêmeo do CMS já filtra os dois (`app/cms/(authed)/youtube/analytics/actions.ts:55-56`). Custo zero na linha que já muda — o mesmo argumento do array `intelligence`. O unitário confere o argumento. Toda leitura nova de `youtube_video_analytics` filtra `.eq('site_id',siteId).in('youtube_video_id', <videosRes.data[].id>)`. Usa o `id` (uuid), nunca o `youtube_video_id` textual de `youtube_videos`: o `youtube_video_id` da analytics é FK para `youtube_videos.id`. Com `videosRes.data` vazio, nenhuma das duas consultas roda: `recent_window` sai `null` e todo `recent` fica `{0,0}`, sem gastar ida ao PostgREST nem depender de como ele trata o `youtube_video_id=in.()` que o `.in(col, [])` gera. Não é hipótese: o canal EN tem 0 vídeos em prod e seu snapshot é caminho vivo (o Cowork clamou task EN em 18/05, e o cron de segunda segue criando task EN). Tem unitário: canal sem vídeos → zero chamadas a `youtube_video_analytics`. Toda leitura é limitada por data, nunca o histórico inteiro, porque o PostgREST corta em 1000 linhas (default do Supabase; no local está escrito em `supabase/config.toml:15`, e em prod vale o `max-rows` do projeto, mesmo default, fora do repo), o que com 14 linhas por dia acontece por volta de meados de novembro:
- `date` = `.gte('date', hoje−3).order('date',{ascending:false}).limit(1)`, com `hoje` em UTC (`new Date().toISOString().slice(0,10)`), o mesmo fuso em que o sync grava `date` (`sync-analytics-metrics/route.ts:125,151`; `:72-73` são só as datas da janela pedida à API);
- `recent` = `.eq('date', date)`.
- `recent_window: {date, days: SYNC_WINDOW_DAYS}`, com `date` = a data mais recente entre os vídeos do canal. **O objeto inteiro é `null`** quando não há linha nos últimos 3 dias — nunca `{date: null}` —, como supõem o §4.1 (passos 4–5), a `ENTRADA` do §4.4 e a integração do §3.7.
- Por vídeo, `recent: {views, subscribers_gained}` é a linha de `date`, **sem somar**. Vídeo sem linha fica em `{0, 0}`, porque a API omite vídeo sem atividade (`route.ts:13-16`).
- `recent_base` e `views_at_7d` ficam para a 2b (§7): nada na 2a os lê.

**Fonte no array `intelligence`** (`youtube.ts:240-245`, lido também pelo `get_intelligence` do MCP, `ab-tests.ts:69`):
- sempre `.eq('site_id', siteId).eq('source','cowork')`, sem exceção por permissão. O filtro de site vira explícito, como nas leituras novas de analytics acima: hoje a consulta filtra só `.eq('channel_id', channel.id)` (`youtube.ts:240-245`) e se apoia no `.eq('site_id', siteId)` do SELECT do canal (`youtube.ts:207-212`), com o cliente de serviço, que ignora RLS. É defesa em profundidade de custo zero na linha que já muda. O mesmo serviço atende `get_intelligence` (`ab-tests.ts:69`) e o resource `pipeline://youtube/intelligence` (`resources.ts:299-326`, `:322`); na 2a a forja não lê a própria análise.

O overview soma fotos de datas diferentes; é bug registrado no §10, e o snapshot não repete isso.

### 3.6 Health Coach

**Coaching do canal.** `fetchChannelCoaching` (`actions.ts:21-45`; o comentário de `:14-20`, que diz `source='cowork'` e "Diagnostico do Cowork", é reescrito no mesmo commit para a allowlist e o selo por fonte):
- troca `.eq('source','cowork')` por `.in('source',['cowork','forja'])` + `.not('coaching','is',null)` + `generated_at desc`;
- devolve `{coaching, source, generatedLabel}`, com o `select` passando a trazer `source` (hoje `'coaching, generated_at'`, `actions.ts:32`) e o valor estreitado no próprio action por `row.source === 'forja' ? 'forja' : 'cowork'` — a coluna é `TEXT` sem CHECK (`20260517000003…sql:198`) —, o que também mantém qualquer `forja_retirada_…` fora do selo. `generatedLabel` (dd/mm) é formatado **no servidor**, com `Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'})`.

**Props.** `YtHealthCoach` ganha `coachingMeta: {source, generatedLabel, summary} | null`, montado em `yt-analytics-tabs.tsx`.
- O rótulo e a linha de summary derivam **só** dela; a linha "regras fixas" e o card verde "saudável" derivam dela **e** de `sortedCards.length`.
- `hasCoworkCoaching` (`yt-health-coach.tsx:61`) sai.
- `lastAnalysisAt` (prop morta, `:55`) **fica como está**: não entra na derivação do rótulo nem da data, e **não é removida** da interface (`:24`) — tirá-la obrigaria a mexer em `yt-analytics-tabs.tsx:84,106,300` e `page.tsx:111`, fora do que este commit precisa.

**Cards.**
- `computeCoachingCards` (`yt-analytics-tabs.tsx:360-407`, hoje privada) passa a ser **exportada**, com a mesma assinatura `(videos, coaching | null)`.
- A união do `source` do card (`yt-health-coach.tsx:16`, `yt-analytics-tabs.tsx:370`) **não muda**: na 2a a forja nunca tem card (`priorities` é sempre `[]`, §3.3), e o único leitor de `card.source`, `hasCoworkCoaching` (`yt-health-coach.tsx:61`), sai. `'forja'` entra na união com a 2b (§7).
- Com `channelCoaching` presente e `priorities: []`, devolve `[]`, sem fallback. A guarda de hoje é `if (channelCoaching?.priorities?.length)` (`yt-analytics-tabs.tsx:372`): com o array vazio ela cai no ramo heurístico (`:388-406`) e devolveria até 3 cards `fallback`. Ela passa a testar só `channelCoaching != null`, e dentro do ramo o map roda sobre `channelCoaching.priorities ?? []` — o `coaching` vem de um `as CoachingOutput` sobre jsonb (`actions.ts:43`), então uma linha antiga sem `priorities` não pode virar `TypeError`. Só `null` chega ao fallback.

**Textos.**
- Rótulo (literal exato, **sem acentos** como os rótulos de hoje; o separador é o ponto médio `·`, U+00B7, que **não** é ASCII — o componente já usa `—` em `yt-health-coach.tsx:101,105` e "Ação" em `:156`): `Diagnostico · por forja · dd/mm` ou `Diagnostico · por Cowork · dd/mm`. Sem `coachingMeta`, fica `Diagnostico heuristico`, o texto de hoje (`yt-health-coach.tsx:97`).
- A linha "Baseado em regras fixas" (`:103-105`) passa a condição para `!coachingMeta && sortedCards.length > 0`, e o texto termina em "ainda sem analise para este canal" (sem acentos, como hoje em `:105`).
- O botão do cabeçalho passa de "Pedir diagnostico ao Cowork" (`yt-analytics-tabs.tsx:231`, e o comentário `:5`) para "Pedir diagnostico" (entra no mockup), porque na 2a quem atende o PT é a forja; no mesmo commit a `className` de `yt-analytics-tabs.tsx:223` passa de `btn cowork` para `btn`, porque `[data-cms-section="youtube"] .btn.cowork` (`youtube-motion.css:408-418`) pinta o botão com `--cowork`/`--cowork-soft`, a variante usada só em CTAs do Cowork, e deixaria a cor contando outra fonte. O botão fica com a `.btn` base (`youtube-motion.css:342-381`) e o mockup o mostra já assim. Os demais textos de botão, inclusive "Solicitar Nova Analise" (`yt-health-coach.tsx:79,190`), não mudam.

**Elemento novo: uma linha com `coachingMeta.summary` abaixo do rótulo.**
- Com `coachingMeta`, o parágrafo `:98-102` não é renderizado; a linha nova ocupa o lugar dele, com o mesmo `<p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 6 }}>`, dentro do mesmo `div.flex-1` de `:96-108`. O `summary` de `coachingMeta` é estreitado onde ele é montado (`yt-analytics-tabs.tsx`, *Props* acima) por `typeof coaching.summary === 'string' ? coaching.summary : ''`, pelo mesmo motivo do `priorities ?? []` dos *Cards*: o `coaching` vem de um `as CoachingOutput` sobre jsonb (`actions.ts:43`) e o `summary: string` do tipo (`lib/youtube/intelligence-types.ts:372`) é promessa do TypeScript, não do banco — nenhuma linha gravada antes do F0 passou pelo Zod (§3.3) e `.not('coaching','is',null)` não exclui `{}`. Sem esse estreitamento, `.trim()` de `undefined` é `TypeError` num componente cliente, com boundary na `/cms/youtube/analytics`. A linha só é renderizada quando esse `summary` estreitado, com `.trim()`, não é vazio; com summary vazio ou ausente aparece só o rótulo. O teste de componente tem dois casos: Cowork com `summary: ''` e Cowork com `coaching` sem a chave `summary`, ambos com cards → rótulo e cards, sem linha vazia e sem erro.
- Com `coachingMeta` e zero cards, o card verde "saudável" (`:169-176`) não aparece. Sem `coachingMeta` (heurístico), ele continua como hoje: ali zero cards quer dizer todos os eixos ≥ 6,5 (`yt-analytics-tabs.tsx:404`).
- Com `coachingMeta.source === 'forja'`, o bloco "Potencial" (`:109-118`), o "+N pts" (`:163`) e a projeção (`:100`) não aparecem sem regra nova: `priorities` é sempre `[]` (§3.3), então não há card, `potentialGain` é 0 (`:63-66`) e o parágrafo `:98-102` não é renderizado. O early return de `:68` (`videoCount === 0`) não muda: o único canal com 0 vídeos, o EN, não tem análise de nenhuma fonte e fica fora de `CANAIS_FILA` (§5 F4).
- **Mockup aprovado pelo dono antes do código**, pela regra de aprovação visual.

**Efeitos visíveis aceitos**
- No PT, já no F0 e sem a forja, a análise do Cowork de maio passa a mostrar a linha com o `coaching.summary` dela no lugar do parágrafo "O canal esta em X/100 … ~N" (`yt-health-coach.tsx:98-102`); os 3 cards e o bloco "Potencial" continuam. Esse summary tem 500 caracteres. Começa em "Canal micro (1.160 subs)…" e termina cortado pelo próprio Cowork em "Conteúdo de...". O texto aparece como está, sem reticências extras nem expansão, e o mockup do F0 usa esse texto real.
- No PT, uma análise da forja mais nova que a de maio substitui a linha de summary, os cards e o "Potencial" do Cowork pela linha de summary da forja, sem cards.
- `channel_insights.patterns_detected` e `analysis_text` da linha `forja` não aparecem em tela nenhuma na 2a: `actions.ts:101-107` só lê linhas de vídeo (`.not('video_id','is',null)`) e nada montado usa o resultado. O dono lê o `finding` com os números, no template do §4.3 (`Série "0–10": 11 vídeos, mediana de 91 views na vida (0,63× da coorte de 2019)`) pelo `npx --yes supabase@2.98.2 db query --linked --agent=no` de leitura, a mesma receita do §5; a tela ganha isso com a UI da 2b (§7).
- O badge continua contando os cards (`coachingCards.length`, `yt-analytics-tabs.tsx:174`, até 3 pelo `.slice(0, 3)` de `:384`); com `priorities: []` não há card nem fallback, então é 0 e some.
- O botão do EN continua criando tasks que ninguém consome. Mostra "Solicitado!", e depois "Aguarde..." (`already_active`) por até ~7 dias e 19 horas depois de cada task do cron (o `stale` só roda às 03:00 UTC).
- Nas 24 h depois de uma análise manual concluída, o botão mostra "Aguarde..." (cabeçalho) ou "Disponivel em breve" (Health Coach) por 10 s, sem as horas restantes (o `hours_remaining` de `actions.ts:213` é ignorado pela UI).

**Leitura por vídeo** (`actions.ts:101-107`): não muda. Nada montado a lê, e a forja não grava linha de vídeo; entra junto com a UI da 2b (§7).

**MCP**
- `fetchSnapshotAge` (`mcp/prompts.ts:102-113`) ganha só `.eq('source','cowork')`, sem parâmetro novo: sem ele, uma linha `forja` faria a análise do Cowork parecer nova. A idade continua global entre canais **e entre sites**, como hoje: a consulta não filtra `site_id` (`mcp/prompts.ts:104-109`, `.limit(1).single()` sobre a tabela inteira) e não há site a filtrar aqui — nenhum prompt chama `getMcpContext()` (abaixo), e o `fetchChannelInfo` da mesma chamada (`:83-89`) também varre a tabela inteira, além de hoje não devolver dado nenhum (seleciona `channel_name`, coluna que não existe em `youtube_channels`; conferido só de leitura). Os dois filtros, por canal e por site, ficam fora desta fase (§8), e o que vaza é um número de horas num prompt, não conteúdo. Não chama `getMcpContext()`, porque os prompts rodam sem contexto em `test/mcp/youtube-mcp-prompts.test.ts`, e ali ele lançaria (`mcp/context.ts:6-11`).
- O prompt `youtube-analyst` (`mcp/prompts.ts:933`) diz que o array de inteligência traz só análises do Cowork.
- As descrições de `submit_intelligence`/`intel_payload` (`mcp/tools.ts:662,690`) dizem que a fonte vem da chave, e a de `claim_task`, na mesma string de `:662`, diz que no MCP ela exige `write` (a chave `{read,intelligence}` clama só pelo REST, com `channel_ids`).

### 3.7 Arrastados pelo commit

**Registry** (`lib/pipeline/api-registry.ts`)
- +2 endpoints: `{ method: 'POST', path: '/api/pipeline/youtube/intelligence/task/claim', summary: 'Claim next pending intelligence task by channel_ids (API key only) — accepts intelligence, write or admin', auth: 'intelligence' }` e `{ method: 'POST', path: '/api/pipeline/youtube/intelligence/task/:id/fail', summary: 'Fail or requeue a running intelligence task owned by the key — accepts intelligence, write or admin', auth: 'intelligence' }` (o path é literal: `api-registry.test.ts:144` converte `:id` em `[id]` para achar o `route.ts`); `endpoint_count` do youtube vai de 31 para 33 (`api-registry.ts:169`).
- `ApiEndpointMeta.auth` vira `'read'|'write'|'intelligence'` (`:7`). A entrada `:172` (PATCH) passa a `'intelligence'`, e a `:173` (GET legado da task) passa a `'write'` (§3.2). Como o catálogo inteiro vai ao Cowork (`app/api/pipeline/route.ts:44`, `API_REGISTRY.capabilities`), `'intelligence'` não é exclusivo: o `summary` das três entradas `intelligence` (as duas novas e o PATCH) termina em `— accepts intelligence, write or admin`, e a seção do PATCH no doc do domínio diz o mesmo, para a chave `{read,write,admin}` do Cowork não concluir que perdeu o PATCH.
- Acompanham: o regex de `test/lib/pipeline/api-registry.test.ts:38` e `test/mcp/mcp-registry-sync.test.ts:28-29` (comentário `youtube(31)` → `youtube(33)`, e 123 → 125). As rotas novas caem em `youtube_analytics` (`mcp/auto-register.ts:137-141`).

**Erros MCP.** Entram `PARTIAL_FAILURE` (`retryable:false`) e `TASK_NOT_RUNNING` (§3.3).

**Docs**
- `data/pipeline-docs/cowork-docs-youtube.md` (servido ao Cowork por `/api/pipeline/docs/youtube`), nas seções do snapshot (`:19-79`, inclusive `existing_intelligence` → `intelligence`), do PATCH (`:81-121`), do GET `/task` (`:123-129`), mais **duas seções `###` novas**, inseridas **depois** do `---` de `:281` e antes de `## Exemplo Completo de Análise` (`:283`) — nunca entre `:131` e `:133`, porque ali elas empurrariam o formato de `coaching` para fora do corte de 8.000 caracteres do prompt (orçamento abaixo) —, uma por endpoint novo — `### POST /api/pipeline/youtube/intelligence/task/claim` (corpo `{channel_ids}`, 200/204/400/403/500) e `### POST /api/pipeline/youtube/intelligence/task/{id}/fail` (corpo `{reason, retry}`, 200/400/404/409/500) —, "Retry & Backoff" (`:263-268`: trocar o texto por watchdog → `stale` e `retry` até 2), "Error Codes" (`:270-281`: 409 `TASK_NOT_RUNNING` = não reenviar; 500 `PARTIAL_FAILURE` = a task segue `running` e nada foi fechado — dar `fail` com `retry`) e do fluxo (`:1351-1361`). **Orçamento dos 8.000 caracteres:** o prompt `youtube-analyst` injeta só os primeiros 8.000 caracteres deste arquivo (`mcp/prompts.ts:1023-1024`), e hoje `## Formato de Análise (Cowork -> PATCH)` começa no caractere 6.580, `### Coaching (por canal)` no 7.321 e o bloco acaba no 7.842 (`## Retry & Backoff`): sobram **158 caracteres** de folga, e só 679 até o *começo* de `### Coaching`. As edições de `:19-79`, `:81-121` e `:123-129` ficam todas antes do caractere 3.276 e passam disso com folga, então, no mesmo commit, o bloco `:220-261` (de `## Formato de Análise (Cowork -> PATCH)` até o `---` de `:261`) é **movido** para logo depois do `---` de `:131`, à frente de `## Algoritmo de Scoring`: ali ele termina por volta do caractere 4.540 e sobram ~3,4 mil caracteres para as edições dos endpoints. Sem esse cuidado o corte silenciosamente tira do prompt o formato de `coaching`/`priorities` — exatamente o que produz os 3 cards que o dono vê (§1). `test/mcp/youtube-cowork-docs.test.ts`, que já lê o arquivo inteiro (`:10-13`), ganha no mesmo commit a asserção de que a seção `### Coaching (por canal)` inteira (do seu índice até o próximo cabeçalho `\n## `) acaba antes do caractere 8.000:
  - claim POST com `channel_ids`;
  - `fail` com `retry`;
  - fonte pela chave;
  - `channel_id` **obrigatório** no GET do snapshot;
  - `recent`/`recent_window` e `videos[].is_hidden`;
  - o array `intelligence` só com `cowork`;
  - o GET `/task` legado exige `write`;
  - o **envelope**: `{"data": …}` em toda resposta de sucesso e `{"error":{"code","message"}}` em toda recusa. As seções da inteligência são as únicas do arquivo que hoje mostram o corpo nu — `:27` abre o snapshot direto em `"channel"`, e `:129` diz `**Response:** { "task": { … } }`, que nunca foi o que a rota devolve (`task/route.ts:23` responde `{"data":{…}}`) —, enquanto todas as outras já mostram o `"data"` (`:376`, `:458`, `:612`). As três seções reescritas e as duas novas passam a mostrar o corpo com o `data` em volta;
  - os novos 400/409/500, repetidos **também dentro da seção do PATCH (`:81-121`)**, porque o prompt `youtube-analyst` injeta só os primeiros 8.000 caracteres do doc (`mcp/prompts.ts:1023-1024`) e esse corte cai hoje na linha 267 — o caractere 8.000 cai dentro de `- Rate limit: 100 requests/minuto por API key` (`:267`), de modo que `:264-266` ainda chegam ao prompt e `:267-268` não — e sobe com as edições acima, porque tudo o que entra antes dele entra antes do corte (daí o remanejamento do orçamento acima): a cauda de "Retry & Backoff" (`:267-268`), "Error Codes" inteiro (`:270-281`), as duas seções `###` novas (depois do `---` de `:281`) e o fluxo (`:1351-1361`) só chegam ao Cowork pelo resource `pipeline://docs/youtube` ou pelo REST, e é exatamente o Cowork que passa a levar 409 `TASK_NOT_RUNNING` no PATCH e 403 no GET legado.
- `docs/cowork-youtube-intelligence-reference.md` **não muda**: é a origem copiada em maio para `data/pipeline-docs/cowork-docs-youtube.md`, nenhuma rota o serve e nenhum teste o lê.
- `docs/cowork-pipeline-reference.md` não cita a inteligência e não muda.

**Cenários de validação visual** — fixtures do teste de componente jsdom abaixo, não SQL. A página exige `social_connections` YouTube não revogada com token válido e a YouTube Analytics API viva (`lib/youtube/analytics-client.ts:52-72,82-101,156-180`; `page.tsx:32-46,73-81`), e o banco local não tem isso.
- **A:** a fixture de maio (`coaching` com 6 priorities, `generated_at` 2026-05-18T13:34Z) → linha de summary, 3 cards do Cowork, badge 3.
- **B:** linha `forja`, `priorities: []` e `summary`.
- **C:** sem linha.

**Testes unitários (Vitest, no mesmo commit).** Onde cada um mora: `test/api/pipeline/youtube-intelligence.test.ts` mocka o serviço inteiro (`:59-63`) e guarda só contratos de rota (status e envelope). As asserções de serviço (claim, PATCH, dono, fonte `forja`, fechamento, fail, snapshot) vão para `test/lib/pipeline/services/youtube-intelligence-service.test.ts`, chamando o serviço com um `ServiceContext` cujo `supabase` é um mock encadeável que grava cada chamada (o padrão de `test/lib/pipeline/services/items-history-key-identity.test.ts`). As do MCP (`claim_task`, `submit_intelligence`) vão para `test/mcp/ab-tests-intel.test.ts`, chamando `manageAbTest` com `getMcpContext` mockado. As das rotas novas (`task/claim`, `task/[id]/fail`) vão para `test/api/pipeline/youtube-intelligence-task-routes.test.ts`, e as de permissão sem mock de `@/lib/pipeline/helpers` para `test/api/pipeline/youtube-intelligence-auth.test.ts` (detalhe em *Claim*, abaixo).

*Permissão e fonte*
- Unitários **sem mock** de `requirePermission` e `authenticateIntel`: `{read}` recusa `intelligence`; `{read,intelligence}` recusa `write`; `write`/`admin` aceitam `intelligence`.
- `deriveSource` via REST: `{read,intelligence}`, com ou sem `source:'cowork'` no corpo, grava `forja`. Chave `write` com `source:'forja'` no corpo grava `cowork`, via REST e MCP.

*Claim*
- 200 com `started_at`; 204 com rate-limit headers; filtro `channel_ids`; `claimed_by` gravado pelo POST, pelo GET legado e pelo MCP; sem corpo, `channel_ids: []`, 11 itens ou um não-uuid → 400 `VALIDATION_ERROR`, sem consulta a `youtube_intelligence_tasks`.
- Em arquivo próprio, `test/api/pipeline/youtube-intelligence-auth.test.ts`, sem mock de `@/lib/pipeline/helpers` e com `vi.mock('@/lib/pipeline/auth', async (o) => ({...(await o()), authenticatePipeline: vi.fn()}))` (só `authenticatePipeline` mockado; o arquivo existente mocka `helpers` inteiro): chave `{read}` → 403 no POST claim, no GET legado e no PATCH; chave `{read,intelligence}` → 403 no GET legado; e sessão — `authenticatePipeline` devolvendo `{ok:true, auth:{siteId, permissions:['read','write'], source:'session'}}`, a forma que ele dá ao caminho de sessão (`lib/pipeline/auth.ts:86`) — → 403 `FORBIDDEN` no POST claim e no `fail`, que é o único lugar onde o `apiKeyOnly` do §3.1 é exercitado de verdade; todos sem consulta a `youtube_intelligence_tasks`.
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
- Contrato de rota, em `test/api/pipeline/youtube-intelligence.test.ts` (que já carrega o módulo por `await import('…/intelligence/route')`, `:176`): `mod.maxDuration === 60`. Sem essa asserção a linha `export const maxDuration = 60` (§3.3) some num revert ou merge sem quebrar teste nenhum, e a invariante de tempo do §4.1 fica sem garantia. O outro lado dessa conta ganha trava no mesmo commit: `test/cron/youtube-intelligence-watchdog.test.ts` hoje afirma só a coluna do corte (`expect(supabase.ltCalls[0]![0]).toBe('started_at')`, `:87-88`) e nunca o valor, então `STALE_THRESHOLD_MINUTES = 30` (`app/api/cron/youtube-intelligence-watchdog/route.ts:23`) pode cair para 15 sem quebrar teste nenhum. Entra a asserção do valor, com `vi.useFakeTimers({ now, toFake: ['Date'] })` e nunca data fixa (regra de fixtures temporais do `CLAUDE.md`): `ltCalls[0]![1] === new Date(now - 30 * 60_000).toISOString()`. Com 15 min o watchdog marcaria `stale` a task da forja no meio da execução (orçamento de 20 min, §4.1), todo PATCH voltaria 409 e a fila entraria em `conflito` em laço — visível só no check `URL_FILA` do §6, nunca na CI.
- Teto dos padrões.
- **Regressão do Cowork:** `test/fixtures/intel-cowork-2026-05-18.json`, remontado só de leitura das 11 linhas `cowork` de maio, passa no `safeParse` e grava `cowork`. O texto vai do banco sem retoque: o `coaching.summary` tem exatamente 500 caracteres e cinco `suggested_variant_description` têm exatamente 200, cada um no teto do Zod (`intelligence-schemas.ts:17,13`), e o teste afirma esses dois comprimentos antes do `safeParse`. Sem isso, uma remontagem que acrescente reticências ou um espaço reprova a fixture — ou é "consertada" e passa a medir outro payload. Não há caractere fora do BMP nas 11 linhas, então caractere e unidade UTF-16 coincidem aqui.
- Task `stale` → 409 sem gravar. CAS final perdido → 409. `started_at` da linha diferente do lido no SELECT (novo claim) → 409. Erro no UPDATE do CAS → 500 `INTERNAL_ERROR`.
- Falha parcial → resposta 500 `PARTIAL_FAILURE` e **nenhum** UPDATE em `youtube_intelligence_tasks`: a task segue `running`, sem `failed_at`, sem `completed_at` e sem `error_message`.
- `result_summary` preserva `claimed_by`.
- `error` no SELECT da task e no SELECT de integridade → 500 `INTERNAL_ERROR`, sem escrita; 0 linhas sem `error` → 404.
- Todo 4xx, exceto o 409 do CAS final, vem antes de escrita. O 422 de integridade continua 422 `VALIDATION_ERROR`.

*Forja*
- `notifications` não vazio → 400; `video_recommendations` com 1 item → 400; `coaching.priorities` com 1 item → 400; sem `coaching` → 400. Nas quatro, nenhuma escrita em `youtube_intelligence` e a task segue `running`.
- Ordem (§3.3): `video_recommendations` com 1 item e `task_id` inexistente → 400 `VALIDATION_ERROR` **sem nenhuma consulta a `youtube_intelligence_tasks`**, nunca 404. Sem esta asserção a guarda pode voltar para depois do SELECT da task num refactor sem quebrar teste nenhum, e o `--canario` (§4.7) só perceberia em produção.
- `video_recommendations: []` (ou ausente) com `priorities: []` → 200, uma linha de canal `forja` e nenhuma linha de vídeo.
- PATCH `forja` 200 → nenhuma chamada a `fanOutToSiteAdmins` (`lib/notifications/fan-out-to-admins.ts:14`, o único fan-out que o serviço importa e chama, `services/youtube.ts:4,416`), com o mock de `@/lib/notifications/fan-out-to-admins` conferindo 0 chamadas.

*Fail*
- 200 (`failed`); 200 com `retry` → `pending` e `retry_count` 1; terceiro `retry` → `failed`.
- 404, 409 e 400; `error` no SELECT da task → 500 `INTERNAL_ERROR`, sem UPDATE; `{read}` → 403 (o 403 de sessão do `fail` fica no arquivo de auth acima, pelo mesmo motivo).

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
- O unitário confere só os argumentos passados ao cliente: `.gte('date', <hoje UTC − 3>)`, `.order('date',{ascending:false})`, `.limit(1)`, `.eq('site_id', …)` e `.in('youtube_video_id', <uuids de videosRes>)`. A semântica (janela, outro canal) fica na integração.
- `videos[].is_hidden` presente no snapshot.
- Chave `write` (REST e tool MCP `manage_ab_test` `get_intelligence`), chave `{read}`, chave `{read,intelligence}` e o resource MCP `pipeline://youtube/intelligence` → o serviço filtra `.eq('source','cowork')` e nenhuma linha `forja` chega a `intelligence`.
- Datas relativas.

*Health Coach*
- `fetchChannelCoaching` devolve a mais recente da allowlist, com `source` e `generatedLabel`; o mock confere `.eq('site_id', <siteId de getSiteContext>)`, `.eq('channel_id', <argumento>)`, `.in('source',['cowork','forja'])`, `.not('coaching','is',null)`, `.is('video_id',null)` e `.eq('type','channel')`. O "`forja_retirada_…` mais nova é ignorada" (trava o rollback do §5) é testado na integração abaixo. `generated_at` às 01:30Z vira o dia anterior.
- `computeCoachingCards(videos,{priorities:[],summary})` → `[]`, com vídeos de eixos `normalized` 0; com os mesmos vídeos e sem coaching → 3 cards `fallback`.
- Componente (`@vitest-environment jsdom`):
  - o rótulo literal `Diagnostico · por forja · dd/mm` com `priorities: []` (B): linha de summary, sem card verde "saudável", sem "regras fixas", sem "Potencial", sem "+N pts", sem badge; e, nos três cenários, o botão do cabeçalho com o literal "Pedir diagnostico" e nenhum "ao Cowork";
  - sem coaching (C) → "Diagnostico heuristico" (literal sem acentos de `yt-health-coach.tsx:97`);
  - Cowork com `summary: ''` e Cowork com `coaching` sem a chave `summary`, os dois com cards → rótulo e cards, sem linha de summary vazia e sem erro (§3.6);
  - "por Cowork · 18/05" com a fixture de maio (A): 3 cards, badge 3, a linha com o `summary` da fixture e nenhum "O canal esta em";
  - os cenários A–C renderizam `YtAnalyticsTabs` (props mínimas mais `intelligenceVideos` com ≥ 1 `VideoGradeRow` cujos 6 eixos têm `normalized` 0 — sem vídeos `videoCount` é 0 (`yt-analytics-tabs.tsx:299`) e o early return de `yt-health-coach.tsx:68` esconde rótulo e summary, e com eixos altos o fallback já daria `[]`; com esses vídeos o C mostra 3 cards heurísticos, badge 3 e "regras fixas", e o B prova que a linha `forja` suprime o fallback; `next/navigation`, `sonner` e `@/app/cms/(authed)/pipeline/actions` mockados — a aba Busca importa `createPipelineItem` (`yt-search-terms.tsx:18`) de um módulo `'use server'` que puxa `getSupabaseServiceClient`/`getSiteContext`/`requireSiteScope`/`next/cache` (`pipeline/actions.ts:2-13`), como faz `test/youtube/yt-search-terms.test.tsx:17` —, em `test/youtube/yt-analytics-tabs-coach.test.tsx`, com `metrics.views: 0` e `dailyMetrics: []` para a aba inicial cair em `PerfNewChannel` (`yt-analytics-tabs.tsx:112,275`) e não nos gráficos; o teste abre a aba Health Coach pelo botão da aba), porque o badge mora nele (`yt-analytics-tabs.tsx:170-178,259-261`) e o `page.tsx` assíncrono não roda em jsdom (`getSiteContext`, `requireSiteScope`). `channelCoaching` vem no formato novo `{coaching, source, generatedLabel}` (A: `generatedLabel:'18/05'`); a conversão de `generated_at` é testada só em `fetchChannelCoaching`. A prop `channelCoaching` de `YtAnalyticsTabs` (`:78`, hoje `{coaching, generatedAt}`) muda para esse tipo.
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
- Claim com `channel_ids` e `site_id` → só a task elegível vira `running`. Fila vazia, `channel_ids` sem task `pending` e `channel_ids` de outro site → 204 com o PostgREST real, nunca 500: o `.single()` de hoje (`services/youtube.ts:469`) devolve PGRST116 em 0 linhas, e o mock `{data: null, error: null}` do unitário (§3.7, *Claim*) passa mesmo se a troca por `.maybeSingle()` (§3.2) se perder num revert.
- Snapshot: `recent_window` é null com a última linha em hoje(UTC)−4 e não nulo com hoje(UTC)−3; linhas de vídeo de outro canal não entram (fixture com `youtube_videos.youtube_video_id` diferente do `id`).
- `fail {retry:true}` → `pending`.
- PATCH e `fail` com `task_id` inexistente e com `task_id` de outro site → 404, nunca 500 (PostgREST real; o mock `{data:null,error:null}` do unitário não pega o PGRST116).
- `fetchChannelCoaching` (com `getSiteContext`/`requireSiteScope` mockados), três casos no mesmo canal: com uma linha `cowork` e uma `forja` mais nova, devolve a `forja` com `source: 'forja'`; com a `forja` mais velha que a `cowork`, devolve a `cowork` com `source: 'cowork'`; com uma `cowork` e uma `forja_retirada_202609181200` mais nova, devolve a `cowork` (trava o rollback do §5). Sem os dois primeiros, a allowlist com `generated_at desc` — de que dependem o selo (§3.6), a troca de fonte no F4 (§5) e o risco do §9 ("uma linha forjada esconde os cards do Cowork") — não é exercida em lugar nenhum: o unitário do *Health Coach* acima confere só as cláusulas passadas ao mock, e o mock de `test/youtube/coaching-actions.test.ts:5-13` é uma cadeia fixa que devolve o que foi empilhado em `maybeSingle`, então ordenação não passa por ele.

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
  - Todo caminho vem de `BASE = os.environ.get('AGENTE_BASE','/opt/agente')` (a convenção de `replay2.py:8`: lock, `log/`, `series.json`, `roteamento.jsonl`, `fila_intel.env`, `sombra/`) e `DEFAULT = os.environ.get('AGENTE_DEFAULT','/etc/default/proxy-agente')`, lido só dentro de `main()`. `agora_mono`, `dormir`, `agora` (relógio de parede com fuso; dele saem `hoje` **como data UTC** (`agora().astimezone(timezone.utc).date()`; padrão de `agora` = `datetime.now().astimezone()`, aware no fuso da forja), o mesmo fuso do `date` do site e portanto do `data_base` do §4.4; a janela do sync em UTC e a hora local naive comparada com `roteamento.jsonl`), `abrir_site` e `abrir_llama` (fábricas dos clientes do site e da 8080; padrão `httpx.AsyncClient`) são parâmetros de `main()`, com os padrões reais, para testar o orçamento, os 9 min, a espera de 60 s e a janela do sync sem esperar de verdade. O `teste_fila` passa o `CliFalso`, um llama falso em processo (`/slots`, `/v1/chat/completions`) e relógios injetados; o llama falso não pode ser um servidor local, porque o `sitio_falso` bloqueia `socket.socket.connect` na importação (`trilha/sitio_falso.py:3`).
  - O próprio `teste_fila` grava um tmpdir em `os.environ['AGENTE_BASE']` e, em `os.environ['AGENTE_DEFAULT']`, o caminho de um **arquivo** dentro desse tmpdir com as linhas `SITIO_CANAL_PT`/`SITIO_CANAL_EN` (`DEFAULT` é arquivo, não diretório); escreve também `<tmpdir>/fila_intel.env` 0600 com `SITIO_CHAVE_FILA` e `CANAIS_FILA=PT`, e cada caso que exercita `config` reescreve esses dois arquivos. Tudo **antes** do SourceFileLoader, sobrescrevendo (nunca `setdefault`) o ambiente herdado: o `cartao.sh:6` exporta `AGENTE_BASE=/opt/agente`. Para o teste da fixture (§4.2), ele copia `fixture_pt.json` (do cwd `docs/trilha`) e `/opt/agente/series.json` para o tmpdir.
  - O teste confere que todo caminho resolvido pelo worker (lock, `log/`, `series.json`, `roteamento.jsonl`, `fila_intel.env`, `sombra/`) fica sob o tmpdir, e que o par (existe, mtime) de `/opt/agente/log/fila_intel.jsonl`, `/opt/agente/log/fila_intel.err` e `/opt/agente/fila_intel.lock` não mudou: um arquivo ausente antes continua ausente depois. Não confere o `log/` inteiro, porque o pulso grava `log/pulso.log` a cada hora. Na forja, o `teste_fila` roda sempre sob `flock -w 1800 /opt/agente/fila_intel.lock` (§4.6), para que o cron vivo não grave no meio do teste.
  - Logo depois de tomar o lock, o `main()` faz `os.makedirs` de `<BASE>/log` e `<BASE>/sombra` com `exist_ok=True` e `mode=0o700`, e a rotação aceita o jsonl ausente. Na forja os dois já existem (o `log/` desde o pulso, `mkdir -p` de `onda0b/pulso.sh.novo:29`; o `sombra/` desde o F1), mas no tmpdir do `teste_fila` não.
  - Lock ocupado → no cron sai 0 sem gravar nada; no modo manual imprime `ocupado: outra execução com o lock` e sai 75.
  - É o mesmo `flock(2)` que o `deploy.sh` e o rollback usam.
- **Invariante de tempo.** Do claim ao último pedido ao site passam menos de 25 min + 30 s, abaixo dos 30 min do watchdog. Assim ele nunca corta uma execução viva. A rota do PATCH passa a declarar `export const maxDuration = 60` (§3.3), igual ao timeout de leitura do cliente. Mudar o orçamento, o `timeout` ou `STALE_THRESHOLD_MINUTES` exige refazer essa conta.

**1. Uma linha de log por execução.** Toda execução com lock grava **exatamente uma** linha em `/opt/agente/log/fila_intel.jsonl`.
- Campos: `quando` (ISO com offset: `datetime.now().astimezone().isoformat(timespec='seconds')`), `modo, desfecho, etapa, claim, task, canal, ms por etapa, tentativas, seeds, tokens, fallback, motivos`, onde `claim` é o status HTTP da resposta do claim (200, 204…) ou `null` quando não houve resposta. Nunca a chave nem o texto gerado.
- `desfecho` ∈ `ocupado | chat | llama_fora | config | vazia | ok | reprovada | llama | falha_site | conflito | fail_perdido | chave | indeterminado | orcamento | bug | morto`.
  - `llama` = as duas tentativas depois do claim foram feitas e nenhuma chegou ao validador (llama fora ou `truncado|timeout|json|pensou` nas duas; `fail` com `retry`).
  - `orcamento` = a tentativa 1 não chegou ao validador (as mesmas falhas) e restam menos de 9 min, então não há tentativa 2 (`fail` com `retry`, §4.5 item 6).
  - `reprovada`, antes do PATCH = guarda determinística (`fail` sem `retry`: repetir daria o mesmo payload): limite de texto estourado depois da montagem ou escopo 2a violado (§4.5 itens 1–2, `etapa: validar`) ou janela ≠ 90 (passos 4–5). Depois do PATCH, a tabela do passo 6.
  - `bug` = exceção não prevista entre o claim e o PATCH (`KeyError` em `features`, `series.json` incoerente com o snapshot): `fail` **sem** `retry`, `motivos: [<tipo da exceção>]`. Uma exceção não prevista **antes** do claim (leitura de `roteamento.jsonl`, `/slots`, `fila_intel.env`) também é `bug`, com `claim: null` e **sem** `fail`, porque não há task. `morto` fica só para `SystemExit`/sinal.
  - Falha do snapshot = `falha_site` com `etapa: snapshot`.
- **Morte por sinal.** O `try/finally` fica **fora** do `asyncio.run`, com o estado num dict de módulo. O handler de SIGTERM levanta `SystemExit`, e o `finally`:
  1. não chama `fail`: uma task já clamada fica `running` até o watchdog (§9), o mesmo desfecho do SIGKILL. Com o orçamento de 20 min e toda espera limitada (passos 3 a 6), o SIGTERM do `timeout -k 30s 25m` não chega a sair; na prática ele só vem de desligar ou reiniciar a máquina;
  2. se nenhum desfecho foi decidido, grava `morto` com a última etapa; senão grava o desfecho decidido.
- **Rotação**, dentro do lock:
  - o jsonl, via tmp + `os.replace`, fica em 4.000 linhas quando passa de 5.000;
  - o `.err` é truncado no lugar quando passa de 1 MB, na mesma rotação e dentro do lock: `open(...,'r+')`, últimas 2.000 linhas, `truncate()` — nunca tmp + `os.replace`, porque o cron o mantém aberto pelo `>>` (com `O_APPEND` toda escrita volta ao fim, então truncar o mesmo inode é seguro). O teto existe porque "já vira `bug`/`morto` no jsonl" era falso: no `--cron` nada vai para stdout (só o modo manual imprime o desfecho), então o `.err` só recebe traceback — e justamente o traceback que **não** chega ao jsonl, porque a linha do jsonl só é escrita com o lock na mão (passo 1) e depois do import (Lock, acima). Falha de import (venv recriado sem `httpx`, `AGENTE_SITIO` apontando para arquivo inexistente, §4.6) repete a 144 tracebacks por dia, para sempre; o §6 pega a parada pelo mtime do jsonl em 70 min, mas nada limitava o arquivo.

**2. Antes de tocar no site**
- **Canais.** `CANAIS_FILA` (linha `CANAIS_FILA=PT` em `/opt/agente/fila_intel.env`) é traduzido por `SITIO_CANAL_PT`/`EN`, lidos de `DEFAULT` (`/etc/default/proxy-agente`) pelo próprio Python. Lista vazia, rótulo desconhecido, uuid ausente, `fila_intel.env` ausente/ilegível, ou sem uma linha `SITIO_CHAVE_FILA` cujo valor case `^forja_[A-Za-z0-9_-]{43}$` → `config`, **sem claim**. A chave da fila é lida uma vez por execução, aqui no passo 2 e junto de `CANAIS_FILA`, nunca na primeira chamada: assim o `sem_chave` do `sitio.py` (§4.6) nunca chega ao laço, uma edição malfeita do arquivo tem desfecho nomeado em vez de `bug`, e o leitor nunca põe a linha nem o valor no log nem em exceção (§4.6). Nunca sai claim sem `channel_ids`.
- **Janela do sync.** Entre 11:58 e 12:05 UTC, pelo mesmo relógio injetado `agora` do Lock, convertido por `.astimezone(timezone.utc)` (o crontab roda em hora local): `ocupado` com `motivos: janela_sync`, sem claim. O `sync-analytics-metrics` roda `0 12 * * *` UTC (`vercel.json:25`) e grava as linhas de hoje uma a uma; um claim nesse instante leria `views_90d` parcial. Tem teste.
- **Slots.** `GET 127.0.0.1:8080/slots` (timeout 3 s). Erro de conexão, timeout, status ≠ 200, JSON sem exatamente 2 slots, **ou qualquer slot cujo `is_processing` não seja booleano** → `llama_fora`; 200 com algum `is_processing=true` → `ocupado`, com `motivos: slots`. A guarda fecha no campo ausente porque o inventário do kit lista as chaves de `/slots` como `id, n_ctx, n_prompt_tokens, params, next_token…`, **sem citar `is_processing`** (`spec-site/secoes/07-seguranca.md:22`): tratar ausente como slot livre faria a fila clamar e gerar em cima do chat depois de qualquer atualização do llama-server, sem motivo no log e com o claim em 200 — invisível para o §6, que só olha `claim` e `desfecho`. O portão do F1 (§5) confere o campo uma vez; esta guarda é a que dura. O `teste_fila` tem o caso: `/slots` com 2 slots sem `is_processing` → `llama_fora`, zero claims.
- **Chat recente.** Lê a última linha **terminada em `\n`** de `/opt/agente/roteamento.jsonl`. O campo `quando` é ISO naive em hora local da forja (`America/Sao_Paulo`), gravado no início do turno (`proxy.py:349`), e é comparado com a hora local naive derivada do mesmo `agora` (`agora().astimezone().replace(tzinfo=None)`).
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
- No §4.1, "5xx" quer dizer `status` 500–599, seja qual for o tipo da `FalhaSite` (o 500 sai como `recusa`, os 501–599 como `5xx`, §4.6). O código ramifica pelo `status` sempre que há resposta, e pelo `tipo` só quando não há (`timeout`/`fora`); um 500 do PATCH, inclusive `PARTIAL_FAILURE`, é `indeterminado` (nenhum 500 do PATCH fecha a task, então o `fail {retry:true}` seguinte a devolve à fila; ele só volta 409 quando o PATCH na verdade concluiu e o 500 era um timeout de resposta, §3.3 e §3.4).
- 200 → começa o orçamento de 20 min, medido com `time.monotonic()`.

**4–5. Dentro de um `try`, até o PATCH**
- `GET …/intelligence?channel_id=<task.channel_id>` com a chave da fila. Quando `recent_window` não é nulo e `recent_window.days ≠ 90`, a forja chama `fail` sem `retry`, com `reason:'janela <n>'`. O desfecho é `reprovada`, com `motivos: janela_<n>`. Os textos (`views_90d` e `views_90d_serie`, o template do §4.5 item 6), a constante 90 do §4.5 (e) e a maturidade supõem 90 dias, e o site lê a janela de `YT_ANALYTICS_SYNC_WINDOW_DAYS`. O `teste_fila` cobre esse caso.
- `features` (§4.2) → `escolher` (§4.3) → redação (§4.4) → `validar` (§4.5).
- **Toda saída antes do PATCH** chama `POST …/fail` uma vez, com `reason` = etapa + motivo:
  - com `retry:true` para `llama`, `orcamento` e falha transitória do snapshot (timeout/5xx/429, §4.6);
  - sem `retry` nos demais casos (`reprovada`, `bug`, snapshot não transitório).
- Se o próprio `fail` volta 409 → `conflito`. Qualquer outra resposta do `fail` que não seja 200 (404, 401/403, 429, 5xx, 3xx/outro 4xx, timeout, rede) → `fail_perdido`, e o watchdog fecha a task.

**6. PATCH.** Uma vez, sem `source`, com timeout de 60 s:

| Resposta | Ação | `desfecho` |
|---|---|---|
| 200 (qualquer corpo, inclusive `formato`/`grande`: o 200 só sai depois do CAS de fechamento, §3.3) | fim | `ok` |
| 400 / 422 / 3xx / outro 4xx | `fail {reason:'patch <st>'}` (seguro: 400/422 saem antes de escrita, e 3xx/405/413 antes do handler; a exceção é o 409 do CAS final, §3.3) | `reprovada` |
| 429 | espera 60 s fixos (a janela é de 60 s, `lib/pipeline/auth.ts:20`, e o 429 sai sem cabeçalhos de rate limit, `lib/pipeline/helpers.ts:27`) e `fail {reason:'patch 429', retry:true}` (o 429 sai antes de qualquer consulta, `lib/pipeline/auth.ts:57-59`) | `falha_site` (`etapa: patch`, `motivos: patch_429`) |
| 409 / 404 | nada: a task não é mais desta execução | `conflito` |
| 401 / 403 | nada: a chave foi recusada; o watchdog fecha | `chave` |
| timeout / 5xx (inclusive `PARTIAL_FAILURE`) | **não repete o PATCH**; chama uma vez `fail {reason:'patch indeterminado', retry:true}`. É seguro: o `fail` e o CAS final do PATCH são ambos CAS sobre `running` com a trava de dono, e só um vence. Se o PATCH concluiu, o `fail` volta 409; se o `fail` vence, o CAS do PATCH volta 409 e a task volta à fila (a linha de canal `forja` já gravada é sobrescrita pela próxima execução). `fail`→409 ou `fail` que falha não mudam o desfecho (no segundo caso o watchdog fecha) | `indeterminado` |

- Nas linhas 400/422/3xx/outro 4xx e 429, o `fail` que a tabela manda segue a mesma regra dos passos 4–5: 409 → `conflito`; qualquer outra resposta que não seja 200 → `fail_perdido`, e o watchdog fecha a task. Nos dois casos os `motivos` da tabela ficam na linha do jsonl.
- **Não se reenvia o PATCH.** No `indeterminado`, o `fail {retry:true}` devolve a task à fila quando o servidor não a fechou; o watchdog só entra quando esse `fail` se perde. O pulso conta `indeterminado` como não-`ok`.
- **A geração vai direto para a 8080**, nunca pela 8081. Assim não passa pelo roteador, não escreve em `roteamento.jsonl` e não depende do proxy.

### 4.2 `features` — funções puras, com `hoje` como parâmetro

**Vídeo oculto** (`is_hidden`): entra em Σ `recent` e em `canal.videos`, mas fica fora de série e de coorte (e da proposta de séries do F0.5). Em 18/09 são 4 dos 35 do PT: os 3 "Main AD Diamante" e "Lolzin D5" (conferido só de leitura).

**Por vídeo**, pelo `snapshot.videos[].id` (uuid interno); `video_id` é o id do YouTube e nunca vai para o PATCH.
- `idade_dias`.
- **Maturidade.** Vídeos com menos de 90 dias ficam fora das comparações dos padrões. Acima disso, a comparação usa `view_count` direto, que na 2a é o valor da importação de 06/05 (canal parado; o `refreshMetrics` de todos os vídeos entra na 2b, §7). Risco aceito: um vídeo novo congela perto dos 30 dias de idade e, se a 2b não sair antes de ele completar 90 dias, entra nas comparações com esse valor. A saturação medida (em 18/09: +29 em 90 dias sobre 6.847) só vale para vídeos com 647 dias ou mais (o mais novo do PT, publicado em 10/12/2024, tinha 647 em 18/09); o limiar de 90 dias é revisto quando o canal voltar a publicar.
- **Coorte de uma série** (base da `razao` dos padrões, §4.3): vídeos maduros e não ocultos do mesmo ano, **sem os do grupo avaliado** (a série); vídeos de outras séries continuam na coorte. Ano = ano do `published_at` no fuso de São Paulo, o mesmo do `ultimo_video` (§4.4). O ano de uma série é o do `published_at` do seu episódio mediano pela ordem de `published_at`. Com número par de episódios, vale o de menor posição entre os dois centrais.
  - Com menos de 4 vídeos elegíveis no ano, a comparação não se aplica e a série não vira padrão. Ampliar a coorte para os anos vizinhos entra na 2b, se e quando um ano fino aparecer: nas duas leituras principais da fixture as séries são de 2019, que tem 21 vídeos visíveis, e na terceira a ampliação só troca um 0,94× neutro por um "não se aplica" (§4.3) — o mesmo desfecho, sem padrão.
- `recent.views` (90 dias), quando `recent_window` não é nulo; somado no canal, vira `views_90d` da `ENTRADA` (§4.4), e somado pelos episódios de cada série vira `views_90d_serie` (bloco **Série**, abaixo). **Inscritos não entram na 2a:** `recent.subscribers_gained` fica no snapshot (§3.5) e nada o lê — o texto não pode dizer que o canal ganhou ou deixou de ganhar inscritos (a soma seria das páginas dos vídeos, não do canal), e nenhum item do validador consegue impor isso sobre um número que o modelo viu. A soma volta na 2b (§7, eixo `growth`).

**Série**
- **A verdade é `/opt/agente/series.json`** (`{"videos":{snapshot.videos[].id: slug},"nomes":{slug: nome exibível}}`). O nome alimenta `series[].nome` e o `finding`, passa por `_t` e nunca tem `_`. O slug só vai para `pattern_id`. O arquivo é escrito uma vez, no F0.5: Claude o redige no Mac a partir dos títulos da fixture, e o dono escolhe e o leva à forja (marcadores aninhados, como "4 - Como somos controlados - … (Part 3)", saem com as duas leituras, e o dono escolhe). Cada vídeo pertence a uma série só. Série = 3 ou mais vídeos **maduros e não ocultos** com o mesmo slug; `n`, `sample_size`, a mediana e o episódio mediano que define o ano contam só esses. Um slug cujos vídeos são todos ocultos ou imaturos não vira série e não gera padrão — é o caso de "Main AD Diamante" (3 vídeos, os 3 `is_hidden`), que sem esta regra viraria série com mediana de conjunto vazio.
- **O `fila_intel.py` não tem heurística de série.** Vídeo fora do arquivo não pertence a série nenhuma. O canal não publica desde 10/12/2024; quando voltar, o dono acrescenta os vídeos novos ao arquivo (gatilho da 2b, §7).
- `views_90d_serie` = soma de `recent.views` dos episódios da série (os mesmos maduros e não ocultos que contam em `n`), quando `recent_window` não é nulo; com `recent_window` nulo a chave sai do item de série da `ENTRADA` (§4.4). Uma série pode estar abaixo da coorte na vida inteira e ainda assim concentrar o tráfego vivo: em 18/09 os 11 episódios de "0–10" somam 16 das 29 views de 90 dias do canal, com 11 dos 31 vídeos não ocultos. Sem esse número o `summary` — a única entrega da 2a — só diz que essa série fica abaixo da coorte, e a regra 5b (§4.5) ainda obriga essa direção.

**Teste**
- Fixture PT do F0.5, com `hoje` = `congelado_em` e o `series.json` do dono.
- Fronteiras em 89/90 dias.

### 4.3 `escolher` — padrões e montagem (dado, não prompt)

**Escopo 2a.** `escolher` produz só a análise do canal:
- `channel_insights.patterns_detected` e `channel_insights.analysis_text`, abaixo;
- `coaching.priorities: []`, **sempre**;
- `video_recommendations` **ausente** do PATCH. O servidor recusa com 400 um PATCH `forja` fora disso (§3.3).

**`patterns_detected`** — só séries:
- `pattern_id = serie:<slug>`, `category = series`, `sample_size` = `n_grupo` = `min(n da série, n da coorte)` — o suporte real da razão, o mesmo que entra em `confidence`; com o piso de coorte de 4 do §4.2, o valor pode ser 4. O `n` da série continua no `finding` e na `ENTRADA`, e os dois podem divergir.
- `razao` = mediana de `view_count` da série / mediana de `view_count` da coorte sem ela — **mediana de valores**: com número par de elementos, a média dos dois centrais (`statistics.median`); a regra de menor posição do §4.2 vale só para escolher o episódio que define o ano da série, nunca aqui. Não é detalhe de estilo: com a outra convenção a coorte plana de 2019 (68, 86, 104, 113, 131, 156, 186, 297, 322, 644) daria 131 em vez de 143,5, e 91/131 = 0,69 > 0,67 deixaria a 2a **sem nenhum padrão**. Arredondada a 2 casas **antes** de qualquer uso (`Decimal(a)/Decimal(b)` com `quantize(Decimal('0.01'), ROUND_HALF_UP)`, sem `round()` de float). O piso de efeito, `forte`, `leitura` (§4.4), o `finding` e a `ENTRADA` usam esse mesmo valor, e a razão crua nunca é comparada. Exibição: 2 casas + `×` ("0,63×"). Medianas: sem casas quando inteiras, senão 1 casa ("143,5"). Teste de fronteira: 91/136 = 0,669 → 0,67 → padrão "abaixo"; 0,674 → 0,67 → padrão; 0,675 → 0,68 → neutro.
- `finding` é template: `Série "{nome}": {n} vídeos, mediana de {views} views na vida ({razao} da coorte de {periodo})`, com `{periodo}` = o ano da série (§4.2).
- Piso de efeito: só sai padrão com `razao` ≤ 0,67 ou ≥ 1,5; o resto vai para o log (`motivos: padrao_neutro`).
- Se o `series.json` tem mapeamentos e **nenhum** dos seus `id` casa com `snapshot.videos[].id`, a execução segue (canal sem série), mas a linha do jsonl leva `motivos: series_orfas`; o `teste_fila` cobre. Sem isso, um arquivo desatualizado — vídeo apagado e recriado, edição à mão — vira um canal "sem padrão" silencioso, com o template "Nenhuma série se afasta da coorte do mesmo período." (§4.5 item 6) e `desfecho: ok` no pulso.
- Ordem fixa: `patterns_detected` — e a `series` da `ENTRADA`, que é a mesma lista (§4.4) — sai por `|razao − 1|` decrescente (sobre a `razao` já arredondada), com empate desfeito pelo slug em ordem alfabética; nunca pela ordem de iteração do `series.json`, que o dono pode reescrever. Com um padrão só, como hoje, a regra não muda nada; ela existe para a fixture do §4.3 e o "campos numéricos idênticos" do F2 (§5) continuarem comparáveis quando houver 2 ou mais.
- **`confidence`** = `min(0,7, 0,3 + 0,05 × min(n_grupo, 6) + 0,1 × [forte])`, com `n_grupo = min(n_série, n_coorte)` e `forte` = `razao` ≤ 0,5 ou ≥ 2. Arredondada com `round(v, 2)`: como `n_grupo ≥ 3` (a série tem 3 ou mais episódios e a coorte 4 ou mais vídeos), os valores possíveis são os múltiplos de 0,05 entre 0,45 e 0,70, nenhum numa fronteira de meio centavo, e o `round` já tira o `0.6000000000000001` do float puro antes de `patterns_detected` (que a fixture espera como `0,6`). `Decimal`/`ROUND_HALF_UP` fica só na `razao`, onde a fronteira existe (0,675). O teto de 0,7 existe porque não há CTR nem retenção.
- Eras e dia da semana ficam fora.

**`analysis_text`** é template: os `finding` unidos na ordem de `patterns_detected`, entrando até caber em 2.000 caracteres UTF-16 junto com a frase final (`analysis_text .max(2000)`, `intelligence-schemas.ts:50`), e `patterns_detected` cortado em 30 pela mesma ordem (o teto novo do §3.3) — os dois cortes são do código e nunca chegam ao item 1 do §4.5; mais "Gerado pela forja com as views na vida de cada vídeo (contagem importada, sem atualização diária) e as séries.". Não cita `data_base`, porque nenhum `finding` usa dado até essa data. Nenhuma tela o lê hoje.

**Teste da fixture PT.** Fixa a saída de `escolher` e os padrões; o dono confere uma vez. Um limiar só muda por item julgado errado ou faltante, nunca para atingir uma contagem. **Esperado em 18/09** (com o `view_count` da importação de 06/05, o mesmo que a fixture do F0.5 traz na 2a, §4.2), conforme a leitura que o dono gravar no `series.json` (F0.5):
- **Leitura plana** ("0–10", episódios 0 a 10 numa série só): 1 padrão, "0–10" (11 vídeos, 91 / 143,5 = 0,63×, `confidence` 0,6).
- **Leitura aninhada:** 1 padrão, "Como somos controlados" (episódios 1, 2, 4, 5 e 6; ano 2019 pelo episódio 4; 91 / 136 = 0,669, arredondada a 0,67 e exibida como "0,67×", `confidence` 0,55). É o caso de fronteira do piso de efeito (a `razao` arredondada, 0,67, fica no piso). O resto do 0–10 (episódios 0, 3, 7, 8, 9 e 10) dá 113 / 113 = 1,00, neutro.
- **Nas duas leituras:** "Vlogzeira" (156 / 109,5 = 1,42×, com os vídeos da outra série dentro da coorte) fica abaixo do piso de efeito, e "Main AD Diamante" é oculto (os 3 episódios são `is_hidden`, então nem chega a ser série, §4.2).
- **Terceira leitura possível, se o dono juntar os 3 "VLOG - " (2017–18) a "Vlogzeira":** série de 6 episódios, ano 2018 pelo episódio mediano (07/01/2018). Em 2018 sobra 1 vídeo elegível fora da série ("Novo rumo do canal", 31/12/2018), abaixo do piso de 4, então a comparação não se aplica e não sai padrão — com a coorte ampliada dos anos vizinhos ela daria 171 / 182 = 0,94×, neutra, o mesmo desfecho. Os 3 "VLOG - " como série própria também são de 2018 pelo episódio mediano (05/01/2018) e caem no mesmo "não se aplica" (ampliada, seriam 198 / 182 = 1,09×, também neutros). Em qualquer das três leituras o canal sai com 1 padrão só.
- **Sempre:** `priorities: []` e nenhuma chave `video_recommendations`.

### 4.4 Redação pelo 12B — contrato (fonte única do `teste_fila`)

**O 12B redige um campo só: `coaching.summary`**, sobre o estado do canal e os padrões de série. Todo o resto do PATCH é do código (§4.3).

**Mensagens.** `[{system: SISTEMA_FILA}, {user: json.dumps(ENTRADA, ensure_ascii=False, separators=(',',':'))}]`.
- A tentativa 2, seja qual for o motivo, repete a mensagem da tentativa 1 com outro `seed` (§4.5 item 6).
- **Nunca há dois `user` seguidos**: o template do Gemma exige alternância (`trilha/t4.py:48`), e com `--jinja` dois `user` seguidos dão 500.

**`ENTRADA`**

```
{"canal":{"nome":str,"videos":"35","views_90d":"29","data_base":"18/09/2026",
          "ultimo_video":"10/12/2024","dias_sem_publicar":"647","series_com_efeito":"1"},
 "series":[{"nome":str,"n":"11","ano":"2019","mediana_views_vida":"91","razao_coorte":"0,63×","leitura":"abaixo da coorte","views_90d_serie":"16"}]}
```

- **Formato dos valores.** Todo número é string pt-BR exibível e **sem sinal**. O modelo nunca vê UUID. `data_base` = `recent_window.date` (dd/mm/aaaa); com `recent_window` nulo, `hoje` (dd/mm/aaaa).
- `series` são os padrões que vão no PATCH, na ordem de `escolher`; `series_com_efeito` é quantos são. `series[].nome` **e `canal.nome`** passam por `sitio._t` (`sitio.py:141-142`): são as duas únicas strings livres da `ENTRADA`, e `canal.nome` é `youtube_channels.name`, escrito pelo sync a partir do que a API do YouTube devolve (`lib/youtube/sync.ts:31-37`), não digitado pelo dono. Sem `_t`, um emoji no nome do canal chega ao prompt e, se o modelo o ecoar, reprova em silêncio pelo item 1 do §4.5 nas duas tentativas — a etapa (a2) só libera nomes de **série** — e o `summary` cai no template. O `teste_fila` tem um caso com emoji no nome do canal.
- `views_90d` é a soma de `recent.views` do §4.2 e `series[].views_90d_serie` a soma dos episódios de cada série; com `recent_window` nulo, as duas chaves saem da `ENTRADA`. **Inscritos não entram na `ENTRADA`** (§4.2).
- `ultimo_video` = o maior `published_at` do snapshot (dd/mm/aaaa, fuso de São Paulo), e `dias_sem_publicar` é `data_base` menos a data **em UTC** do mesmo `published_at`, em dias (§4.2, função pura), porque `data_base` é data UTC. O exibido em `ultimo_video` continua no fuso de São Paulo; as duas só diferem quando o vídeo saiu depois das 21:00 de São Paulo, e aí vale a contagem em UTC. Com o dado de hoje (10/12/2024 15:57Z = 12:57 em SP) elas coincidem, e todo número de `canal` se refere à mesma data. `series[].ano` = o ano da série (§4.2, episódio mediano). `leitura` = `"acima da coorte"` se `razao` ≥ 1,5, `"abaixo da coorte"` se ≤ 0,67. É calculada pelo código, e o modelo nunca deduz a direção de `razao_coorte`.

**`SISTEMA_FILA`**
- Citar só números de `canal` e `series`; percentuais e razões, só os prontos, sem converter um no outro.
- Nunca calcular. O tempo sem publicar aparece só como os dias de `dias_sem_publicar` ou como a data de `ultimo_video`, nunca em meses ou anos.
- Nunca escrever CTR, taxa de cliques, impressões, retenção, tempo de exibição, engajamento, curtidas, comentários, nota ou score, **nem para dizer que faltam**: o código já avisa. Nunca escrever nomes de campo (`views_90d`, `razao_coorte`…).
- A direção de cada série é a de `leitura`, com as mesmas palavras. Nunca dizer "acima" ou "abaixo" por conta própria.
- Só descrever. Nunca recomendar, sugerir, aconselhar nem dizer o que fazer: nesta fase não há recomendação nenhuma, e o `summary` é o único campo de texto livre.
- Tamanho e idioma: `summary` em 2 frases, em pt-BR, com no máximo 300 caracteres. Os 300 são instrução de estilo; o limite duro é o da gramática (`MAX`, Faixa abaixo), e nada reprova um texto entre 300 e `MAX` — nem o do modelo, nem o template do §4.5 item 6.
- Glossário (texto fixo no prompt; as chaves só explicam a entrada e nunca vão para o texto): `videos` = vídeos do canal no banco, de toda a vida do canal; `views_90d` = soma, sobre os vídeos do canal, das views de cada vídeo nos 90 dias até `data_base` (não é o total do canal); `ultimo_video` = data do vídeo mais recente; `dias_sem_publicar` = dias entre `ultimo_video` e `data_base`; `series_com_efeito` = quantas séries se afastam da coorte; o canal pode ter outras que não se afastam e não aparecem aqui, então o texto nunca pode dizer que esse é o número de séries do canal; em cada série, `n` = episódios considerados (os maduros e não ocultos; a série pode ter outros, então o texto nunca pode dizer que esse é o tamanho da série), `ano` = ano da série, `mediana_views_vida` = mediana das views de cada episódio desde que foi publicado, `razao_coorte` = essa mediana dividida pela mediana dos vídeos do mesmo ano fora da série, `views_90d_serie` = quantas das views dos últimos 90 dias do canal vieram dos episódios dessa série — uma série pode estar abaixo da coorte na vida inteira e ainda assim concentrar o tráfego recente, e o texto deve dizer as duas coisas quando for o caso.
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
- **Aparo.** Um `summary` que termine sem `.`, `!` ou `?` é aparado no último `[.!?]` seguido de espaço ou fim. O corte não vale para pontuação dentro de aspas, entre dígitos ou logo após `Ep|Part|vs|nº`. Se sobrarem menos de 60 caracteres (o mínimo da faixa), reprova com motivo `curto`. O aparo roda depois do Aceite, como primeiro passo do validador, então uma reprovação `curto` conta como "chegou ao validador": leva à tentativa 2 ou ao template, nunca a `fail`. O log conta quando bateu no teto (`motivos: teto`).

**Aceite.** A resposta é aceita só com `finish_reason == "stop"`, `reasoning_content` vazio ou ausente, `json.loads` sem erro e o conjunto de chaves igual a `{"summary"}`. Qualquer outra coisa reprova a tentativa: `truncado|timeout|json|llama|pensou`. O log grava `usage`, `len(reasoning_content)` e `timings.predicted_per_second`.

**O código nunca lê do modelo** número, padrão ou prioridade: só a string `summary`. Depois da validação, monta o PATCH com os campos do §4.3 e prefixa o `summary` com `AVISO_ESTREITO` ("Sem CTR/retenção nesta fase; base: views e séries.", até 80 caracteres). Os itens 3–5b do validador (§4.5) rodam só sobre o texto gerado; os itens 1–2, sobre o payload montado — com uma exceção: o comprimento de `coaching.summary` é medido logo depois do Aparo, já com o prefixo (§4.5 item 1).

### 4.5 Validador local

**1. Limites de texto.** Confere, em UTF-16 e só sobre o payload montado, os três campos de comprimento variável que o código produz: cada `pattern_id` (≤ 80 — o `serie:<slug>` vem do `series.json` que o dono escreve), cada `finding` (≤ 300) e `analysis_text` (≤ 2000). Os demais campos são literais do código ou inteiros por construção (`category = "series"`, `sample_size`, `confidence`, `priorities: []`, `task_id`), e o `PatchPayloadSchema.safeParse` real é portão do F2 (§5); um espelho do schema inteiro só criaria deriva quando o Zod mudar. O motivo no log desses três continua `zod` (item 2). **O comprimento de `coaching.summary` (≤ 500) não é julgado aqui:** logo depois do Aparo (§4.4) o validador mede `len(AVISO_ESTREITO) + 1 + len(summary)` em UTF-16 e reprova acima de 500 com motivo `longo`, que conta como "chegou ao validador" — tentativa 2 ou template, nunca `fail`. A gramática limita `MAX` em pontos de código e o Zod conta unidades UTF-16, então um caractere fora do BMP que a faixa de emoji não pegue pode estourar os 500 sem que isso seja bug do código. **Emoji não é checado aqui:** um `summary` gerado com emoji reprova junto dos itens 3–5b, com motivo `emoji`, e conta como "chegou ao validador" — leva à tentativa 2 ou ao template, como o `curto` do Aparo (§4.4), nunca a `fail`. A faixa é a mesma do kit, `[\U0001F000-\U0001FFFF☀-➿️]` (`ferramentas/docs/sitio.py:133`), que inclui os emoji do BMP; "fora do BMP" deixaria passar `⚠️`, `☀` e `➡`.

**2. Escopo 2a.** O payload montado tem `coaching`, não tem `video_recommendations` nem `notifications`, e `coaching.priorities == []`. Falhar aqui, ou nos limites de texto do item 1 depois da montagem, é bug do código: termina em `fail {reason:'escopo: <campo>'|'zod: <campo>'}` **sem** `retry`, porque repetir daria o mesmo payload. O desfecho é `reprovada`, com `etapa: validar` e `motivos: zod|escopo`, e o PATCH não é enviado (espelho das recusas do §3.3). O `teste_fila` cobre essa saída.

**3. Números.** O `summary` só cita valores de `canal` e `series` da `ENTRADA` enviada.

- **Papel das views.** Numa frase (mesmo corte em frases do 5b) que cite `90 dias` ou `noventa dias`, todo número seguido, em até 3 palavras, de `views` ou `visualizacoes` só pode ser `views_90d` ou `views_90d_serie` (as chaves de janela presentes na `ENTRADA`); a exceção é o número precedido de `mediana de` ou seguido, em até 4 palavras, de `na vida`, que só pode ser `mediana_views_vida`. Qualquer outro reprova, com motivo `papel`. Sem isso, `91 views nos últimos 90 dias` — a mediana de vida no papel da janela, o mesmo erro de 3× que a fase 1 já cometeu por outro caminho (§10) — passa em todos os itens 3–5b, porque 91 está na `ENTRADA`. Teste de tabela com a `ENTRADA` do §4.4: `29 views nos ultimos 90 dias` e `mediana de 91 views na vida, e 16 das 29 views dos ultimos 90 dias` passam; `91 views nos ultimos 90 dias` e `35 views nos ultimos 90 dias` reprovam; `mediana de 91 views na vida`, sem a janela na frase, não é checada por este item.

**4. Normalização** (função pura, com teste de tabela).

- **(0) Tokens permitidos.** São `tokens(normalizar(v))` das strings de `canal` e `series`, pela **mesma função** usada no texto gerado.
  - `nome` e `series[].nome` nunca geram token. Um número dentro de um nome, de canal ou de série, passa pela etapa (a2).
  - Cada token é `(valor, tipo)`, com tipo ∈ {número, %, ×, data}, e só casa com o mesmo tipo. Um ano solto é `data` com dia e mês nulos, casado por componente como em (b) — não há tipo `ano` separado.
  - `−` e `-` são descartados: a comparação é por valor absoluto.
- **(a) Títulos entre aspas:** fica para a 2b (§7). Na 2a o modelo não vê títulos, e os nomes de série saem pela (a2).
- **(a2) Nomes.** Sai **toda ocorrência literal** de `norm(_t(series[].nome))` e de `norm(_t(canal.nome))` da `ENTRADA` enviada, entre aspas ou não e **sem mínimo de tamanho**. O nome do canal entra aqui pelo mesmo motivo do nome de série: um dígito dentro dele não pode virar token. `-`, `–` e `—` são equivalentes na comparação. Teste de tabela: `a série 0–10 rende 0,63× da coorte`, `a série '0-10'` e o template com “0–10” passam; `os vídeos 0 a 10` reprova.
- **(b) Datas e anos**, sobre o texto já normalizado sem acento, nesta ordem de alternância: `\d{1,2}/\d{1,2}/\d{4}`, `\d{1,2}/\d{4}`, `\d{1,2}/\d{1,2}`, `\d{1,2} de <mês>( de \d{4})?`, `<mês>(\.)?( de|/)? ?\d{4}` e `\b(20(0[5-9]|[12]\d|30))\b`, com `<mês>` = `(jan(eiro)?|fev(ereiro)?|mar(co)?|abr(il)?|mai(o)?|jun(ho)?|jul(ho)?|ago(sto)?|set(embro)?|out(ubro)?|nov(embro)?|dez(embro)?)\b`.
  - Cada um vira `(dia|None, mes|None, ano|None)` e casa quando todo componente não nulo do texto é igual ao de um permitido: `data_base`, `ultimo_video` e `(None, None, series[].ano)`.
  - Teste de tabela (com a `ENTRADA` do §4.4): `12/2024`, `dezembro de 2024`, `dez/2024`, `em 2024`, `18/09`, `18 de setembro de 2026`, `a série de 2019` passam; `em 2023`, `11/2024` e `novembro de 2024` reprovam.
- **(c) Número:** `\d{1,3}(\.\d{3})+|\d+(,\d+)?`, com sufixo ` ?(%|x|×)| vezes`, lido em pt-BR. O espaço opcional existe porque o modelo copia `0,63×` da `ENTRADA` colado e às vezes separa; sem ele, `0,63 ×` vira token `número` 0,63, que não casa com nenhum valor de `canal`/`series` e reprova texto correto. Teste de tabela: `0,63×`, `0,63 ×` e `0,63 x` passam.
- **(d) Por extenso.**
  - `metade|dobro|triplo` e `<dois|duas..vinte> vezes` reprovam (motivo `extenso`): o `SISTEMA_FILA` proíbe converter razões.
  - `dois|duas..vinte` sem ` vezes` são tokens `número`.
  - "um"/"uma" são artigo e não contam.
  - Tempo em anos ou meses reprova, com motivo `tempo`: `\b(\d+|um|uma|meio|dois|duas|tres|quatro|cinco) (anos?|mes|meses)\b` (sem acento). O tempo sem publicar só aparece em dias ou pela data do último vídeo.
- **(e) Constante** sempre permitida: só 90 (a janela de `recent` e do template, guardada pelo §4.1 passos 4–5). 28 e 30 não entram, porque não há janela dessas no dado (§10). 60, 180 e `top 3` eram das regras R4 e dos eixos, e voltam com elas na 2b (§7).
- **(f) Igualdade estrita:** um número do texto casa só com o valor exibido na `ENTRADA` (mesmo tipo, mesmas casas). Arredondamento e `mil`/`milhões` voltam só se o F2 mostrar reprovação por eles.

**5. Proibidos** (sem acento, com borda de palavra):

`\b(ctr|taxa de cliques|impress(ao|oes)|retenc(ao|oes)|retid[oa]s?|tempo (de )?exibic(ao|oes)|watch ?time|nota [0-9]|nota [a-f] ?(no|na|do|da|de)|score|impressions?|retention|engajamento|engagement|curtidas?|likes?|comentarios?|duracao media|tempo medio|inscrit[oa]s?|subscribers?)\b`

- Também reprovam rótulos crus: `\b[a-z]+_[a-z0-9_]+\b` (`rotulo_cru`). O `0-9` é obrigatório: com `[a-z_]+`, `views_90d` escapa inteiro, porque o que vem depois do `_` começa por dígito — e é justamente o rótulo que o glossário mostra ao modelo. Teste de tabela: `views_90d` e `razao_coorte` reprovam.
- Os itens 3–5 rodam sobre o texto já sem os nomes de série retirados pela etapa (a2); o 5b usa esses nomes para achar a série de cada frase.
- Na tabela de teste, "grade de horarios" e "a nota e o titulo" passam; "tempo de exibicao" reprova.

**5b. Direção** (sem acento, com borda de palavra). O `summary` é cortado em frases por `[.!?]`, com as mesmas exceções do Aparo (§4.4). Numa frase que cite o nome de uma série só (casado pela etapa (a2)), reprova, com motivo `direcao`:
- se a `leitura` da série for "abaixo da coorte": `acima|supera(m)?|superior(es)?|melhor(es)? que`;
- se for "acima da coorte": `abaixo|inferior(es)?|pior(es)? que|fica(m)? atras`.
- Uma frase que **não** cite nenhuma série é checada contra a `leitura` comum quando há ao menos uma série e **todas** as da `ENTRADA` têm a mesma `leitura` — é o caso de 1 série, o único da 2a (§4.3) —, com o mesmo motivo `direcao`; sem isso basta não nomear a série para inverter a direção e nada barra. Com séries de leituras diferentes, uma frase sem nome de série não é checada, nem uma frase que cite duas séries de leituras opostas. O template do item 6 passa, porque a única palavra de direção que ele usa é a própria `leitura` da série.
- Teste de tabela (com a `ENTRADA` do §4.4): "a série 0–10 fica abaixo da coorte (0,63×)" passa; "a série 0–10 supera a coorte, com 0,63×" reprova; "o conjunto de episódios supera a coorte, com 0,63×" reprova (sem nome de série, com a `leitura` comum); "o canal nao publica desde 10/12/2024" passa.

**6. Reprovação.**
- **Tentativa 2** (depois de reprovação no validador **ou** de falha de infraestrutura na tentativa 1): a mesma mensagem da tentativa 1 (um `user` só, ver §4.4), o mesmo `S`, outro `seed`. A resposta da tentativa 1 não entra como turno, e o motivo da reprovação vai só para o log (`motivos`).
- **Depois da tentativa 2.** O `summary` ainda reprovado vira **template do código**, montado só com `canal` e `series`, com todo nome de série entre “ ”: "Canal com {videos} vídeos no banco e {views_90d} views nos últimos 90 dias até {data_base}. Séries com efeito: “{nome}” ({razao_coorte}, {leitura}), …." (sem série: "Nenhuma série se afasta da coorte do mesmo período."; sem `recent_window`, sai a oração das views). As séries entram em ordem até caber na faixa, e o template **sempre termina em `.`**, inclusive quando a faixa corta séries.
  - O template passa no mesmo validador. O ponto final é o que o protege do Aparo (§4.4), primeiro passo do validador: terminando em `)`, o Aparo cortaria no ponto depois de `{data_base}`, o `summary` chegaria ao PATCH só com a frase do canal — que tem mais de 60 caracteres e portanto passa em silêncio, sem nenhuma série.
  - O teste de tabela cobre o template com 0, 1 e 2 séries e um nome de série com dígitos, e confere que o template **sai** do validador com todas as séries que couberam na faixa.
  - O log grava `fallback: [summary]`.
- **Pouco orçamento.** Com menos de 9 min restantes depois da tentativa 1, a tentativa 2 é pulada. Se a tentativa 1 chegou ao validador e reprovou nele (itens 3–5b, `emoji`, `longo`, ou `curto` no Aparo do §4.4), o `summary` vai para o template e o PATCH segue. Se não chegou (llama fora ou `truncado|timeout|json|pensou`), a execução termina em `orcamento`: `fail {reason:'orcamento', retry:true}`, sem PATCH (§4.1 passos 4–5).
- **Desfecho misto.** Se ao menos uma tentativa passou do Aceite e chegou ao validador, o fim é o `summary` aprovado ou o template, nunca `fail`.
- **`fail` só por infraestrutura ou por guarda determinística.** Com `retry`: `llama` (as duas tentativas sem chegar ao validador, por llama fora ou `truncado`/`timeout`/`json`/`pensou`) ou `orcamento` (a tentativa 1 sem chegar ao validador, com menos de 9 min restantes). Sem `retry` (`reprovada`): limite de texto estourado depois da montagem ou escopo 2a violado (itens 1–2), ou janela ≠ 90 (§4.1 passos 4–5). Um `summary` reprovado pelo validador nunca dá `fail`: vira template.

### 4.6 `sitio.py`, trava e segredos

**`pedir`** (hoje `pedir(cli, metodo, caminho, params, agora)`, sempre `cli.get`, `sitio.py:90-127`)
- **Na fase 1, nada muda.** O GET continua em `cli.get`, byte a byte igual. O ramo de status de `sitio.py:108-116` fica intocado: 3xx/4xx → `formato`; 5xx/429 → `_velho` (`teste_s1.py:80-95`). `teste_s1`/`teste_s2` passam sem edição.
- **Método não-GET** usa `cli.request(metodo, …, json=corpo, follow_redirects=False)`. O `CliFalso` (`trilha/sitio_falso.py`) ganha `request(metodo, url, params=None, json=None, headers=None, timeout=None, follow_redirects=True)`. Ele grava em `chamadas` a mesma tupla de 3 que o `get()` e, numa lista nova `pedidos`, `(metodo, caminho, json)`. O construtor ganha `respostas={(metodo, rota-regex): (status, corpo_bytes)}`, consultado pelo `get()` e pelo `request()` antes de `status`. Com ele o teste serve 204, `{"error":{"code":…}}`, corpo não-JSON e respostas diferentes para o GET do snapshot e o PATCH na mesma rota. Sem `respostas`, o `get()` continua como hoje, e `teste_s1`/`teste_s2` passam sem edição.
- **Parâmetros novos, só por palavra-chave:**
  - `corpo=None`;
  - `fase=FASE`, repassado a `autorizada`;
  - `chave=None`;
  - `timeout=None`: quando dado, substitui `TIMEOUT_LENTO.get(caminho, TIMEOUT)`. O `fila_intel.py` passa 15 s no claim, no fail e no snapshot, 60 s no PATCH (`httpx.Timeout(60, connect=5)`).
- **Com `fase=2` (qualquer método) ou método não-GET:**
  - não lê nem grava `_CACHE`, não chama `_velho` e não repete a chamada;
  - exige `chave=` explícito; sem ele, `FalhaSite(caminho, …)` do tipo `sem_chave` antes da rede;
  - 204 → `(None, t, False)`.
- **`FalhaSite`** ganha `status=None` por palavra-chave e mantém `tipo, rota, detalhe` posicionais. O mapeamento de fase 2:

| Resposta | `FalhaSite` |
|---|---|
| 400/404/409/422/500 | `('recusa', rota, str(st), status=st)` |
| 401/403 | `('chave', rota, str(st), status=st)`: o `--canario` e o F1 conferem `status == 403` (um 401 reprova) |
| 429 | `('429', rota, status=429)` |
| 501–599 | `('5xx', rota, status=st)` |
| rede | `('timeout'\|'fora', rota)` |
| 3xx e qualquer outro 4xx | `recusa` |

  `recusa` não entra em `MENSAGEM`: o proxy nunca a vê.
- **Falha transitória no `fila_intel.py`.** Ele decide por `status` sempre que há resposta; sem resposta não há `status`, e aí decide o `tipo` (`timeout`/`fora`). Uma falha é **transitória** (`retry:true` no snapshot; `indeterminado` com `fail {retry:true}` no PATCH) quando `tipo in {'timeout','fora','429','5xx'}` **ou** `status == 500`. Um 200 com corpo `formato`/`grande` (`sitio.py:118-124`; com `fase=2` essa `FalhaSite` leva `status=200`) é `falha_site` sem `retry`, exceto no PATCH, onde é `ok` (tabela do §4.1 passo 6). O `teste_fila` tem uma linha para cada caso, e mais: 500 `INTERNAL_ERROR` no PATCH → `indeterminado` e um `fail` com `retry` (`fail`→409 mantém `indeterminado`); 500 no snapshot → `fail {retry:true}`; 500 no claim → `falha_site` com `etapa: claim`.
- **`FASE = 1` não muda.** Só o `fila_intel.py` passa `fase=2`.
- **`ROTAS_FASE[2]`** = fase 1 + `POST …/task/claim`, `POST …/task/<uuid>/fail`, `GET …/intelligence?channel_id=<uuid>` e `PATCH …/intelligence`.

**Testes do cartão S4**
- Com a fase padrão, claim, fail e PATCH levantam `RotaBloqueada` sem rede.
- Com `fase=2`: nada vem de cache nem de `_velho` num 5xx; sem `chave=` dá `sem_chave`; 204 devolve a tupla; 409 dá `recusa` com status; `timeout=` é respeitado.
- `teste_s1`/`teste_s2` passam sem edição.
- O `teste_s4.py` carrega o `sitio` como `teste_s1.py:7-11`: `AGENTE_SITIO` ou, na falta, `../../sitio.py.novo`. O `cartao.sh:22` só passa `AGENTE_PROXY`.

**Instalação**
- **`sitio.py`**, só pelo **cartão S4**. O `trilha/s4.py` copia `proxy.py` para `proxy.py.novo` sem alteração e escreve o `sitio.py.novo` (0600), que é o que `cartao.sh:8-9` e `deploy.sh:11` esperam. Replay com `mudaram: 0`.
- **`deploy.sh`** toma o lock por descritor **antes** da guarda de mídia (`deploy.sh:7`) e o segura até o fim: `exec 9>>/opt/agente/fila_intel.lock; flock -n 9 || { echo 'ESPERAR: fila_intel em execução'; exit 1; }`.
  - A troca (`:11`) e o restauro do rollback (`:20`) do `sitio.py` passam a copiar para um temporário e fazer `mv`, porque o cron importa o `sitio.py` a cada execução.
- **`cartao.sh`** ganha, depois da linha 22, `[ "$T" = S4 ] && { (cd docs/trilha && AGENTE_SITIO="$B/sitio.py.novo" $PY -B teste_s1.py) || falha teste_s1; }`. O `teste_s2` roda depois do `deploy.sh S4`, porque o proxy carrega o `sitio.py` do próprio diretório (`trilha/s2.py:20`). O `cartao.sh` também ganha:

  ```
  if [ -s sitio.py.novo ]; then F="$B/fila_intel.py"; [ -f "$F" ] || F="$B/docs/trilha/fila_intel.py"; [ -f "$F" ] || falha 'sem fila_intel.py'; (cd docs/trilha && flock -w 1800 "$B/fila_intel.lock" env -u PYTHONPATH -u AGENTE_BASE AGENTE_SITIO="$B/sitio.py.novo" AGENTE_FILA="$F" /opt/agente/venv/bin/python -B teste_fila.py) || falha 'teste_fila (ou lock ocupado por 30 min)'; fi
  ```

  - No S4 o `fila_intel.py` instalado ainda não existe (entra no F1), então o teste usa a cópia de trabalho que o K levou; sem nenhuma das duas, o cartão falha em vez de pular o teste.
  - O `env -u` tira o stub `st/httpx.py` do caminho.
  - O `teste_fila.py` carrega o worker **só** por `AGENTE_FILA` (SourceFileLoader, como `replay2.py`), nunca por caminho implícito ao lado do próprio teste; quem aponta `AGENTE_FILA` é quem chama — a cópia de trabalho `docs/trilha/fila_intel.py` no S4 e antes de cada instalação, e `/opt/agente/fila_intel.py` depois de instalado.
  - O `fila_intel.py` nunca faz `import sitio`. Ele carrega o módulo por caminho, `os.environ.get('AGENTE_SITIO') or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sitio.py')`, por `spec_from_file_location`, como `trilha/s2.py:19-22`. O carregamento fica numa função chamada por `main()` e pelo teste. O `teste_fila` confere que o módulo carregado é o de `AGENTE_SITIO`: `ROTAS_FASE` tem a chave 2.
- **Nenhum `flock` de shell desta seção espera sem limite.** O `deploy.sh` usa `-n` com mensagem (acima); os demais — o do `cartao.sh` (acima), os da instalação e da volta (abaixo) e o do `nova_chave.py --fila --trocar` ("Kit da chave") — levam `-w 1800` e uma mensagem própria na falha, pelo mesmo motivo do rollback do F4 (§5, `flock -w 1800`): depois do F4 o cron está vivo e uma execução pode segurar a trava por 25 min (§4.1), e sem `-w` o terminal fica pendurado sem dizer por quê — inclusive dentro do `cartao.sh`, que tem `set -u` sem `set -e` e nenhum timeout (`trilha/cartao.sh:4`). Só o lock tomado pelo próprio worker é não-bloqueante (`LOCK_NB`, §4.1).
- **`fila_intel.py`** vai por scp para `docs/trilha/` e é instalado sob o lock:

  ```
  cd /opt/agente && flock -w 1800 /opt/agente/fila_intel.lock sh -c 'cp -p fila_intel.py fila_intel.py.bak 2>/dev/null; install -m 600 docs/trilha/fila_intel.py fila_intel.py.tmp && mv fila_intel.py.tmp fila_intel.py' || echo 'PARE: lock ocupado por 30 min ou instalacao falhou — nada foi trocado'
  ```

  - Só depois de `teste_fila.py` passar **na forja**, a cada instalação ou atualização: `(cd /opt/agente/docs/trilha && flock -w 1800 /opt/agente/fila_intel.lock env -u PYTHONPATH -u AGENTE_BASE AGENTE_SITIO=/opt/agente/sitio.py AGENTE_FILA=/opt/agente/docs/trilha/fila_intel.py /opt/agente/venv/bin/python -B teste_fila.py) || echo 'PARE: teste_fila reprovou ou lock ocupado por 30 min'`.
  - Um cartão que reverta o `sitio.py` comenta antes a linha do crontab.
  - Voltar uma atualização do worker: `cd /opt/agente && flock -w 1800 /opt/agente/fila_intel.lock sh -c 'cp -p fila_intel.py.bak fila_intel.py.tmp && mv fila_intel.py.tmp fila_intel.py' || echo 'PARE: lock ocupado por 30 min ou volta falhou — nada foi trocado'`, e depois o mesmo `teste_fila.py` acima com `AGENTE_FILA=/opt/agente/fila_intel.py`.
- **O `teste_fila.py` cobre no mínimo**, com `CliFalso` e llama falso:
  - cada linha das tabelas do §4.1 passos 3 e 6 (no `indeterminado`, um `fail` com `retry`; `fail`→409 mantém `indeterminado`), e cada saída dos passos 4–5 (`retry:true` para llama, orçamento e snapshot timeout/5xx/429; sem `retry` nos demais; `fail`→409 = `conflito`; `fail` que falha = `fail_perdido`), conferindo quantas vezes `fail`/PATCH são chamados (0 ou 1) e com qual `retry`;
  - `CANAIS_FILA` vazio ou desconhecido, `fila_intel.env` ausente, e `fila_intel.env` sem `SITIO_CHAVE_FILA` ou com valor fora do formato → `config`, sem chamadas ao site e sem exceção; exceção injetada na leitura de `roteamento.jsonl` → `bug`, `claim: null`, zero chamadas ao site;
  - `/slots` com um slot ocupado → `ocupado`; `/slots` recusando conexão ou com 500 → `llama_fora`; nos dois, zero claims;
  - SIGTERM depois do claim (o llama falso chama `signal.raise_signal(signal.SIGTERM)`, o que prova que `main()` instalou o handler; o teste restaura o handler anterior ao fim) → nenhum `fail` e exatamente uma linha `morto` com a etapa;
  - saída `reprovada` com o `fail` perdido, antes do PATCH e depois de um PATCH 400 → nenhum segundo `fail`, e a linha é `fail_perdido`, não `reprovada`; PATCH 429 com o `fail` respondendo 409 → `conflito`;
  - lock ocupado → 0 no cron e 75 no manual. Com o worker parado no llama falso depois de tomar a trava, um `flock -n` de outro processo no mesmo arquivo falha;
  - exatamente uma linha jsonl por execução com lock;
  - nenhum valor de chave no jsonl, e nenhum trecho do `summary` que foi ao PATCH (nem do gerado, nem do template) em qualquer campo da linha;
  - o PATCH montado com `coaching`, sem `video_recommendations` nem `notifications`, com `coaching.priorities: []`. Um `escolher` adulterado que devolve 1 prioridade → um `fail` sem `retry`, zero PATCH, `desfecho: reprovada`, `etapa: validar`;
  - exceção em `features` depois do claim → um `fail` sem `retry` e linha `bug`;
  - `recent_window.days` ≠ 90 → um `fail` sem `retry`, `desfecho: reprovada`, `motivos: janela_<n>`;
  - claim às 12:00 UTC (relógio injetado) → `ocupado`, `motivos: janela_sync`, zero claims;
  - llama falso que reprova o `summary` nas duas tentativas por validador (números/proibidos) → PATCH enviado uma vez com o `summary` de template, `fallback: [summary]`, `desfecho: ok` e **nenhum** `fail`; com menos de 9 min de orçamento (relógio injetado), uma chamada ao llama só. Um caso por combinação de tentativas: validador × infra e infra × validador → PATCH (template ou aprovado), nenhum `fail`; infra × infra → zero PATCH, um `fail` com `retry`, `desfecho: llama`; tentativa 1 em `timeout` com menos de 9 min restantes → zero PATCH, um `fail` com `retry`, `desfecho: orcamento`;
  - `--sombra` e `--escolher` → zero chamadas ao `CliFalso`; `--canario` → exatamente dois `POST …/00000000-0000-4000-8000-000000000000/fail` (chave da fila e chave `{read}`), exatamente um `PATCH …/intelligence` com a chave da fila (§4.7), e nenhum claim; com o `CliFalso` devolvendo 404 nesse PATCH, o desfecho é `reprovada`;
  - rotação: jsonl com 5.001 linhas fica com 4.000, e `.err` com 1,5 MB fica com 2.000 linhas e o mesmo inode (`os.stat().st_ino` igual antes e depois, o que prova o truncamento no lugar do §4.1);
  - os de `features`/`escolher` (§4.2, §4.3) e o validador (§4.5).

**Segredo**
- `SITIO_CHAVE_FILA` e `CANAIS_FILA` moram em `/opt/agente/fila_intel.env` (thiago:thiago 0600), que nenhuma unit carrega. Formato, uma chave por linha: `SITIO_CHAVE_FILA="forja_…"` (valor **entre aspas duplas**, como o `nova_chave.py:23` já grava em `/etc/default/proxy-agente`) e `CANAIS_FILA=PT` (sem aspas, como o bloco do F1 escreve). O leitor do §4.1 passo 2 tira as aspas opcionais antes de casar `^forja_[A-Za-z0-9_-]{43}$`, com o mesmo padrão tolerante do pulso (`onda0b/pulso.sh.novo:59`, `^SITIO_CHAVE="?([^"\n]+)"?$`), e o `teste_fila` cobre as duas grafias.
- No modo normal, **toda** chamada passa `chave=` com a chave da fila.
- `--canario` e os scripts de apoio (§4.7) leem `SITIO_CHAVE` (a `{read}`) de `/etc/default/proxy-agente` pelo próprio Python. Nunca por argv, env do cron ou `set -a`. `--sombra --snapshot arq` e `--escolher --snapshot arq` não leem chave nenhuma e não abrem conexão com o site (na 2a não há `--congelar`, §7). O `--sombra` lê de `fila_intel.env` só a linha `CANAIS_FILA`, para o rótulo do arquivo de sombra (§4.7), e o `--escolher` não lê esse arquivo; nos dois, a falta de `SITIO_CHAVE_FILA` **não** vira `config`. A checagem de chave do §4.1 passo 2 vale no modo normal e no `--canario`, que usam a chave da fila.
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
  - Recusa se o arquivo não existir ou não for 600, e se já houver chave sem `--trocar`. Com o cron vivo (depois do F4), o `--trocar` roda **sob a trava**, e com limite de espera: `cd /opt/agente && flock -w 1800 /opt/agente/fila_intel.lock python3 docs/trilha/nova_chave.py --fila --trocar || echo 'PARE: lock ocupado por 30 min ou nova_chave recusou — veja a saida acima'`. Assim nenhuma execução está no meio do caminho quando o arquivo é reescrito, e nenhuma task clamada com a chave velha continua `running` quando o `seed_chave_forja.sh fila` a revoga. Entre a troca e o seed, a chave nova leva 401 no claim (`chave`) e não clama nada.
  - Imprime o SQL com `'forja (fila)'` e `array['read','intelligence']`.
- **`seed_chave_forja.sh`:**
  - `$1` de 64 hex → modo da fase 1;
  - `$1 = fila` → o hash é o `$2`, validado por `^[0-9a-f]{64}$`, e grava `'forja (fila)'` com `{read,intelligence}`. No mesmo SQL, revoga (`revoked_at = now()`) toda outra `'forja (fila)'` ativa do site com `key_hash <> $2`. Depois confere que resta exatamente uma ativa, ou para;
  - qualquer outra forma → `pare`;
  - nome e permissões vêm de um `case` fechado; depois do insert, confere as permissões e para se o hash já existia com outras.

### 4.7 Modos auxiliares

Todos tomam o lock do §4.1. Nenhum deles clama, então o orçamento de 20 min do §4.1 passo 3 conta do início de `main()` (mesmo `time.monotonic()`): dele saem o timeout da geração do §4.4 (`min(600 s, orçamento restante − 120 s)`, que na primeira tentativa dá os mesmos 600 s da execução real) e o corte de 9 min da tentativa 2 (§4.5 item 6); o `--escolher` não chama o 12B. Sem isso a sombra do F2 e o canário do F1 gerariam com timeout indefinido, e o portão "toda geração < 7 min" do F2 não mediria o que a execução real faz. `--sombra` e `--canario` passam antes pelas checagens de `/slots` e de chat recente do §4.1 passo 2 (a janela do sync não entra). Se alguma falhar, saem com `ocupado`/`llama_fora`/`chat` sem chamar o llama, e o dono repete. As linhas desses modos levam `modo`, usam o mesmo enum de `desfecho` do §4.1 — `ok` quando o modo terminou o que se propôs, os valores das checagens acima quando elas barram, `reprovada` quando dispara uma guarda determinística do §4.5 (escopo 2a) ou quando uma sonda do `--canario` não devolve o esperado, e `bug` na exceção não prevista — e não contam para as regras 2 a 4 do pulso (§6), que só olham `modo: cron`. Contam para a regra 1, porque gravam no mesmo jsonl e mexem no mtime: uma execução auxiliar adia em até 70 min o vermelho de cron morto, então o dono não roda modo auxiliar enquanto investiga o cron.

- **Scripts de apoio** (antes do S4, fora do `sitio.py`, que ainda é da fase 1): `trilha/capturar_fixture.py` e `trilha/sonda_f0.py`.
  - Leem a chave `{read}` pelo Python e usam `httpx` direto. Por isso rodam sempre com `cd /opt/agente && venv/bin/python -B docs/trilha/<script>.py`, nunca com o `python3` do sistema, que não tem `httpx`.
  - `capturar_fixture` faz **só GET**.
  - Nenhum dos dois é importado pelo proxy nem pelo `fila_intel.py`.
- **`--sombra --snapshot arq`:** sem claim, sem PATCH e sem fail.
  - `hoje` = `congelado_em`, nunca o relógio.
  - Grava `/opt/agente/sombra/<canal>-<quando>.json` (`<canal>` = rótulo `PT`/`EN` de `CANAIS_FILA`, nunca o uuid) com o `system`, o `user`, o payload (com `task_id` = `00000000-0000-4000-8000-000000000000`), o veredito e os tempos. Não apaga nada: a sombra só roda quando o dono a chama.
- **`--escolher --snapshot arq`:** sem rede, sem llama e sem `fila_intel.env`. Imprime os vídeos fora de `series.json` (todos, quando ele não existe) e a saída de `escolher` (§4.3). Roda antes do F1, pela cópia de trabalho: `cd /opt/agente && AGENTE_SITIO=/opt/agente/sitio.py venv/bin/python -B docs/trilha/fila_intel.py --escolher --snapshot docs/trilha/fixture_pt.json`. O `AGENTE_SITIO` é obrigatório aqui: sem ele o carregamento por caminho do §4.6 procura `docs/trilha/sitio.py`, que não existe (o K leva o `sitio.py` para `docs/`, não para `docs/trilha/`). O `--escolher` só usa `_t`, que o `sitio.py` da fase 1 já tem (`sitio.py:141-142`), e nunca exige `ROTAS_FASE[2]`.
- **`--canario`:** não clama.
  - Faz `POST …/task/00000000-0000-4000-8000-000000000000/fail {reason:'canario'}` com a chave da fila e espera 404. Um 400 reprova: o corpo foi recusado antes da busca.
  - Repete o mesmo pedido com `SITIO_CHAVE` (a `{read}`), lida pelo próprio Python de `/etc/default/proxy-agente`, e espera 403.
  - Faz `PATCH …/intelligence` com a chave da fila e o corpo `{"task_id":"00000000-0000-4000-8000-000000000000","coaching":{"summary":"canario","priorities":[]},"video_recommendations":[{"video_id":"00000000-0000-4000-8000-000000000000","action_type":"title_test","priority":"low","confidence":0.5,"reasoning":"canario"}]}` e espera **400** (`FalhaSite` do tipo `recusa` com `status=400`, §4.6) — prova, em produção e antes do F4, que a recusa de `video_recommendations` para a fonte `forja` está viva. O corpo é válido para o `PatchPayloadSchema` (`intelligence-schemas.ts:3-14,16-24,37-41`), então o 400 só pode vir da guarda de escopo, não do Zod. Um **404 reprova**: quer dizer que a guarda ficou depois do SELECT da task (§3.3). Nada é gravado: o `task_id` não existe e a guarda recusa antes de qualquer escrita.
  - Sonda a 8080 com o `S` real (só `summary`) e a `ENTRADA` da fixture: resposta válida pelo Aceite do §4.4 e `reasoning_content` vazio. O tempo fica com o portão do F2 (§5); o log continua gravando `timings.predicted_per_second` (§4.4).

## 5. Rollout

**Ordem de execução (a tabela está em ordem de leitura, não de execução):** F0k → K → F0 (commit, CI, promoção e portão pós-promoção) → F0.5 → S4 → F1 → F2 → F4. O rollback é a inversa dos cartões que mudam estado: F4 → Qualidade → F1 → S4 → F0.

| Card | Quem | O quê | Portão |
|---|---|---|---|
| **F0** | Claude + dono | Commit do site (§3) em staging → main | Mockup (selo, linha de summary, tela sem "Potencial"/"regras fixas", botão "Pedir diagnostico") aprovado **antes** do código · `(cd apps/web && npx vitest run)` completo (~160 s) + na raiz do repo, `npx supabase@2.98.2 start --exclude gotrue,realtime,imgproxy --ignore-health-check && npx supabase@2.98.2 db reset --local && SUPABASE_EXCLUDE_GOTRUE=true HAS_LOCAL_DB=1 npm test --workspace=apps/web -- integration/` (a mesma sequência de `ci.yml:135-137`, com o `SUPABASE_EXCLUDE_GOTRUE` de `ci.yml:142` — `npm run db:start` (`package.json:27`) é `supabase start`, um CLI que não é dependência do repo nem está pinado, exatamente o que o comentário de `ci.yml:132-134` proíbe, e rodar só o arquivo novo deixaria de fora as outras suítes DB-gated que o job roda; conferir na saída que os testes do arquivo **passaram**, não `skipped` — sem `HAS_LOCAL_DB=1`, ou com o Supabase local fora, o `describe.skipIf(skipIfNoLocalDb())` (`test/helpers/db-skip.ts:8-10`) deixa a suíte verde por omissão) + typecheck web/api · CI (`ci.yml`) verde no push de staging, inclusive o job de integração · Vercel verde · validação **autenticada antes da promoção** (`docs/ops/runbook-cms-e2e-local.md`): varredura da sidebar 200/`ok`, e `/cms/youtube/analytics` sem boundary, com console sem `error`. Localmente não há conexão YouTube com token válido, então a página para em "Nenhuma conexão YouTube encontrada" (`page.tsx:32-46,73-81`); os cenários A–C do §3.7 ficam no teste jsdom: A → "por Cowork · 18/05", linha de summary, 3 cards, badge 3; B → "por forja", summary, sem card verde, sem "Potencial", sem "regras fixas", sem badge; C → heurístico · **depois da promoção**, com `sonda_f0.py` na forja (levado pelo card K; chave `{read}` lida pelo Python): `GET …/intelligence?channel_id=<PT>` → 200 com `recent_window` (prova o deploy novo); só então, `POST …/task/claim {channel_ids:[<uuid inexistente>]}` e `PATCH …/intelligence` vazio → 403 cada. O 403 do GET legado `…/intelligence/task` **não** é sondado em prod: ele já é unitário sem mock de helpers (§3.7, *Claim*), e contra um build velho a sonda seria um claim de verdade com a chave `{read}`, porque hoje o GET autentica com `authenticateRead` e chama `claimNextTask`. Qualquer outro status reprova; um 200/204 dispara o rollback do F0 · logado em prod, PT "por Cowork · 18/05" com a linha de summary, 3 cards e badge 3 |
| **F0k** | Claude, no Mac | Antes do K: escreve em `~/Workspace/forja/ferramentas/docs/trilha/` os arquivos novos `fila_intel.py` (§4), `teste_fila.py` (§4.6), `s4.py` e `teste_s4.py` (§4.6), `capturar_fixture.py` e `sonda_f0.py` (§4.7); em `~/Workspace/forja/ferramentas/fase2/` (`mkdir -p`), `pulso_f4.py` e `teste_pulso_fila.py` (§6); e altera `trilha/nova_chave.py` (desvio `--fila`, §4.6), `trilha/cartao.sh` e `trilha/deploy.sh` (§4.6) e `ferramentas/seed_chave_forja.sh` (forma `fila <sha>`, §4.6). Nada é instalado aqui: o K leva, o S4 e o F1 instalam | Bloco **F0k — para colar** (abaixo da tabela): cada `.py` novo passa em `python3 -m py_compile` e cada `.sh` em `bash -n`. `teste_fila.py` e `teste_s4.py` **não** rodam no Mac (o `python3` do Mac não tem `httpx`, e o worker o importa — §4.1 e §4.6); eles são portão do `cartao.sh S4` e do F1, na forja |
| **K** | dono, no Mac | Antes do portão pós-promoção do F0, e de novo sempre que o kit mudar: `cd ~/Workspace/forja/ferramentas/docs && scp -r sitio.py trilha forja:/opt/agente/docs/` (leva `trilha/sonda_f0.py`, `capturar_fixture.py`, `s4.py`, `teste_s4.py`, `teste_fila.py`, `nova_chave.py`, `cartao.sh`, `deploy.sh` e `fila_intel.py`, como o passo 1 do S1 da fase 1) e, só no K que antecede o F4, `scp ~/Workspace/forja/ferramentas/fase2/pulso_f4.py ~/Workspace/forja/ferramentas/fase2/teste_pulso_fila.py forja:/opt/agente/docs/`. Claude prepara as linhas, e o dono as roda. O `docs/trilha/fila_intel.py` é só a cópia de trabalho; quem instala é o §4.6. A `fixture_pt.json` e o `series.json` nunca entram no kit (`ferramentas/docs/trilha/`): assim o `scp -r trilha` do K nunca sobrescreve a fixture que o dono conferiu no F0.5 | bloco **K — portão** (abaixo da tabela): `KIT-IGUAL` (e `PULSO-IGUAL` no K que antecede o F4) |
| **F0.5** | dono + Claude | Na forja, `capturar_fixture.py` salva `docs/trilha/fixture_pt.json` com `congelado_em`. O dono traz a fixture ao Mac: `mkdir -p ~/Workspace/forja/ferramentas/fase2 && scp forja:/opt/agente/docs/trilha/fixture_pt.json ~/Workspace/forja/ferramentas/fase2/`. Claude propõe as séries lendo os títulos dessa cópia e, depois que o dono escolhe, escreve `~/Workspace/forja/ferramentas/fase2/series.json`. O dono o leva à forja com `scp ~/Workspace/forja/ferramentas/fase2/series.json forja:/opt/agente/series.json` e confere a saída de `escolher` por `--escolher` (§4.7). As duas cópias no Mac ficam fora do kit e servem só para leitura. Na forja, o `teste_fila` lê a fixture de `docs/trilha/` e o `series.json` de `/opt/agente/` (§4.1, Lock) | Fixture com 35 vídeos e `recent_window` não nulo · `series.json` e lista conferidos |
| **S4** | dono | Cartão da Trilha com o `sitio.py` novo, `s4.py` e o `deploy.sh`/`cartao.sh` do §4.6 | `cartao.sh S4` (replay `mudaram: 0`, `teste_s4.py`, `teste_s1` sem edição e `teste_fila` sobre o `sitio.py.novo`) · `deploy.sh S4` com PID novo · `cd docs/trilha && python3 -B teste_s2.py` sem edição · `prova_site.py agente-auto` 5/5 |
| **F1** | **dono** | Na forja, sem sudo, o bloco **F1 — para colar** (abaixo da tabela): cria `fila_intel.env` 0600 e `sombra/` 700, acrescenta `CANAIS_FILA=PT` e gera a chave (repetível: o `install` só cria o arquivo quando ele falta, porque sobre um existente o trunca e apaga a chave; e o `nova_chave.py --fila` fica por último e atrás de um `grep`, porque ele sai 1 quando já há chave e não veio `--trocar` — `nova_chave.py:17-18` —, o que, na segunda execução, cortaria um encadeamento por `&&` antes do `CANAIS_FILA`). No Mac: `bash ~/Workspace/forja/ferramentas/seed_chave_forja.sh fila <sha>` (o arquivo é 0644 e está fora do PATH; `<sha>` é o hash impresso pelo `nova_chave.py --fila`, nunca a chave). Instala o `fila_intel.py` (§4.6) depois de `teste_fila.py` verde na forja | `curl -fsS 127.0.0.1:8080/slots` → 2 entradas com `is_processing` · `cd /opt/agente && timeout -k 30s 25m venv/bin/python fila_intel.py --canario` → 404 com a chave da fila, 403 com a `{read}`, 400 no `PATCH …/intelligence` com `video_recommendations` (§4.7 — a recusa de escopo `forja` está viva; 404 reprova) e sonda de schema aprovada · um turno de chat e, logo depois, a última linha de `roteamento.jsonl` com `quando` a menos de 1 min de `date +%FT%T` (mesmo fuso) · `grep -c '^CANAIS_FILA=' /opt/agente/fila_intel.env` → 1 e `grep -c '^SITIO_CHAVE_FILA=' /opt/agente/fila_intel.env` → 1 · **nenhum claim antes do F4**: no início do F4, `select count(*) from youtube_intelligence_tasks where result_summary->>'claimed_by' in (select id::text from pipeline_api_keys where name = 'forja (fila)')` (dono, leitura) = 0 |
| **F2** | dono roda, Claude lê | 3× `cd /opt/agente && timeout -k 30s 25m venv/bin/python fila_intel.py --sombra --snapshot docs/trilha/fixture_pt.json` (o instalado, que carrega `/opt/agente/sitio.py`), só com o dado real; depois o dono traz os três mais recentes para `~/Workspace/forja/ferramentas/fase2/sombra-f2/` com o bloco **F2 — para colar** (abaixo da tabela), de onde Claude os lê para o `safeParse` no Mac (se a saída de `escolher` mudar, o dono confere só a diferença) | Payload final aprovado 3/3 pelo espelho **e** pelo `PatchPayloadSchema.safeParse` real (Claude roda, na raiz do repo, `npx tsx <script>` — que resolve o `node_modules/.bin/tsx` já instalado, o mesmo binário que `package.json:34` usa — com import **relativo** `./apps/web/src/lib/youtube/intelligence-schemas.ts` e os payloads lidos por caminho absoluto de `~/Workspace/forja/ferramentas/fase2/sombra-f2/`; nada de alias `@/`, que só o `vitest.config.ts` e o Next resolvem. O módulo de schemas só importa `zod` (`intelligence-schemas.ts:1`), então não puxa mais nada; o script é descartável e não entra no commit), sem `video_recommendations`, sem `notifications`, com `coaching` presente e com `coaching.priorities: []` (as quatro recusas do §3.3, não duas) · `summary` aprovado na primeira geração em ≥ 2/3, e nunca em template · saída de `escolher` igual à fixture conferida · as 3 rodadas com campos numéricos idênticos · o dono lê os 3 `summary` e aprova (sem o F3, é o único julgamento de texto antes do F4) · toda geração < 7 min · rodada de uma geração ≤ 10 min; rodada com segunda tentativa ≤ 20 min (o teto do orçamento do §4.7), e a linha do jsonl diz em `tentativas` quantas houve |
| **F4** | dono | (1) Uma execução **manual** sobre a task PT pendente: a do cron de segunda, se existir (aí o botão responde `already_active`); senão, um pedido PT do botão: `cd /opt/agente && timeout -k 30s 25m venv/bin/python fila_intel.py` (modo manual, imprime o desfecho; se sair `chat`, `ocupado` ou `llama_fora` nada foi clamado — §4.1 passo 2 — então espere 5 min, fora da janela 11:58–12:05 UTC, e repita o mesmo comando); (2) o bloco **F4 (2) — para colar** (abaixo da tabela): guarda o crontab em `/opt/agente/crontab.bak-F4`, acrescenta a linha do §4.1 e confere o resultado **contra esse backup** (`retentar`/`pulso` com a mesma contagem) e `fila_intel` com contagem 1; (3) só depois de existir ao menos uma linha `modo: cron` com `desfecho` `vazia` ou `ok` (`python3 -c "import json,sys;sys.exit(0 if any(d.get('modo')=='cron' and d.get('desfecho') in ('vazia','ok') for d in (json.loads(l) for l in open('/opt/agente/log/fila_intel.jsonl') if l.endswith('}\n'))) else 1)"` → saída 0; senão espera o próximo ciclo de 10 min), o dono cria o check `URL_FILA` no healthchecks (§6) e a regra do §6 é inserida **no `pulso.sh` vivo** (a O2 é pré-requisito: `grep -c 'yt_hints-sem-200-15min' /opt/agente/docs/pulso.sh` → 1, senão para) por `cd /opt/agente/docs && python3 pulso_f4.py <url do check>`. Ele valida `^https://hc-ping\.com/[0-9a-f-]{36}$` e grava `pulso.sh.tmp` com o bloco inserido antes de `[ "$ok" -eq 1 ]` (âncora com contagem 1, como `trilha/s3.py:troca`), entre as linhas `# >>> fila_intel (F4)` e `# <<< fila_intel (F4)`, com `URL_FILA="<url>"` logo depois da primeira. O script recusa inserir se os marcadores já existem, e o `--remover` apaga do marcador de abertura ao de fechamento, exigindo contagem 1 de cada. Depois: `bash -n pulso.sh.tmp`; `python3 teste_pulso_fila.py pulso.sh.tmp` verde (extrai o bloco pelos marcadores de `pulso.sh.tmp`, troca a linha `URL_FILA=` por `URL_FILA="https://hc-ping.com/00000000-0000-0000-0000-000000000000"` e o roda com `PATH=<tmp>/bin:$PATH`, onde um `curl` e um `sleep` falsos gravam os argumentos e saem 0, e com `FILA_LOG=<fixture>`; o harness prefixa o bloco extraído com `ok=1` e `motivo=""` — as linhas que no vivo ficam **fora** dele (`onda0b/pulso.sh.novo:31-32`, e o bloco entra antes de `:78`) — e o sufixa com `printf 'OK=%s MOTIVO=%s\n' "$ok" "$motivo"`; confere pela URL gravada se o ping foi o de sucesso ou o `/fail`, e que nenhum pedido chegou ao healthchecks. Casos, sobre jsonl de fixture: arquivo ausente; mtime de 80 min; última linha `modo: cron` com task `reprovada` há 2 h, e depois uma `ok` mais nova; 24 h só com `chat` → `fila-sem-claim-24h:chat`; última linha `modo: cron` com `desfecho: chave` (e `claim: 403`) → ping `/fail` com `fila-parada:chave`, e com uma linha `ok` mais nova depois dela → verde; só a linha `modo: manual` → `fila-sem-claim-24h:nenhuma`; `indeterminado` conta como não-`ok`; 24 h só com `morto` de `etapa: slots` (`claim: null`) → `fila-sem-claim-24h:morto`; última linha truncada (sem `\n`) → ignorada; em todos os casos a saída traz `OK=1` e um `MOTIVO` com o motivo `fila-*` esperado e nada mais) e dois casos sobre o próprio `pulso_f4.py`, numa cópia de `pulso.sh` em tmp: inserir e depois `--remover` devolve o arquivo byte a byte igual ao original (`cmp -s`), e uma segunda inserção com os marcadores já presentes recusa sem gravar; `cp -p pulso.sh pulso.sh.bak-F4`; `chmod 755 pulso.sh.tmp && mv pulso.sh.tmp pulso.sh` (o arquivo vivo é `/opt/agente/docs/pulso.sh`, num diretório do thiago; a troca por rename funciona sem sudo seja qual for o dono do arquivo) | Depois da troca, uma execução real do pulso com o check `URL_FILA` verde no healthchecks, o check principal ainda verde e a última linha de `/opt/agente/log/pulso.log` com `ok=1` · execução manual: `desfecho: ok` e `result_summary.claimed_by` = id da `forja (fila)` · o próximo pedido PT (task do cron de segunda, ou o botão, só 24 h depois do `completed_at` quando a task do passo (1) foi pedida pelo botão, e na hora quando foi a do cron; antes, conferir que não há `pending`/`running` PT) fica `completed` em ≤ 40 min com o llama livre, sem chat e com o pedido feito fora do intervalo 11:45–12:05 UTC (§4.1 passo 2: ali um tique de 10 min cai na janela do sync e sai `ocupado` sem clamar; somado à espera do tique seguinte e aos 25 min + 30 s de uma execução, o total passa de 40 min sem nada quebrado), com `result_summary.claimed_by` = id da `forja (fila)` (SQL de leitura do dono), e aparece "por forja · dd/mm" com sessão autenticada · a linha `cowork` continua no banco · o **EN** só entra em `CANAIS_FILA` com ≥ 8 vídeos e um F2 próprio |

**Comandos para colar** — os blocos abaixo são o texto literal, sem escape de `|`, dos comandos que as células do §5 nomeiam; comando curto fica na própria célula, e nenhuma célula contém `|`.

```
# F0.5 — na forja (canal e destino são fixos no script: o PT é o único canal da 2a)
cd /opt/agente && venv/bin/python -B docs/trilha/capturar_fixture.py
# grava docs/trilha/fixture_pt.json com congelado_em e imprime nº de vídeos e recent_window
```

```
# F0 — portão pós-promoção, na forja (depois do K e da promoção)
cd /opt/agente && venv/bin/python -B docs/trilha/sonda_f0.py
# nesta ordem: GET snapshot PT (200 com recent_window) -> POST task/claim (403)
# -> PATCH intelligence (403). O GET legado /intelligence/task não é sondado (célula do F0).
# Canal PT, uuid inexistente do claim e chave {read} são fixos/lidos pelo script.
# Qualquer outro status: imprime REPROVADO e sai 1.
```

```
# F0k — no Mac, depois de escrever/alterar os arquivos do kit
cd ~/Workspace/forja/ferramentas
for f in docs/trilha/fila_intel.py docs/trilha/teste_fila.py docs/trilha/s4.py docs/trilha/teste_s4.py docs/trilha/capturar_fixture.py docs/trilha/sonda_f0.py docs/trilha/nova_chave.py fase2/pulso_f4.py fase2/teste_pulso_fila.py; do python3 -m py_compile "$f" || echo "FALHOU $f"; done
bash -n docs/trilha/cartao.sh && bash -n docs/trilha/deploy.sh && bash -n seed_chave_forja.sh && echo SH-OK
```

```
# K — portão, no Mac, depois do scp (md5 do Mac tem 1 espaço; md5sum -c quer 2)
cd ~/Workspace/forja/ferramentas/docs && find sitio.py trilha -type f ! -path '*__pycache__*' | sort | xargs md5 -r | sed 's/ /  /' | ssh forja 'cd /opt/agente/docs && md5sum -c --quiet' && echo KIT-IGUAL
# só no K que antecede o F4
cd ~/Workspace/forja/ferramentas/fase2 && md5 -r pulso_f4.py teste_pulso_fila.py | sed 's/ /  /' | ssh forja 'cd /opt/agente/docs && md5sum -c --quiet' && echo PULSO-IGUAL
```

```
# F1 — na forja, sem sudo
cd /opt/agente
[ -e fila_intel.env ] || install -m 600 /dev/null fila_intel.env
mkdir -m 700 -p sombra
grep -q '^CANAIS_FILA=' fila_intel.env || printf 'CANAIS_FILA=PT\n' >> fila_intel.env
grep -q '^SITIO_CHAVE_FILA=' fila_intel.env || python3 docs/trilha/nova_chave.py --fila
```

```
# F2 — no Mac, depois das 3 rodadas de sombra (o nome do arquivo de sombra é PT-%Y%m%dT%H%M%S.json, sem `:`)
mkdir -p ~/Workspace/forja/ferramentas/fase2/sombra-f2
scp $(ssh forja 'cd /opt/agente/sombra && ls -t PT-*.json | head -3' | sed 's#^#forja:/opt/agente/sombra/#') ~/Workspace/forja/ferramentas/fase2/sombra-f2/
```

```
# F4 (2) — na forja
(
  crontab -l > /opt/agente/crontab.bak-F4 || { echo 'PARE: crontab -l falhou — nada foi instalado'; exit 1; }
  grep -q pulso /opt/agente/crontab.bak-F4 && grep -q retentar /opt/agente/crontab.bak-F4 || { echo 'PARE: backup do crontab sem pulso/retentar — nao instalar'; exit 1; }
  grep -q fila_intel /opt/agente/crontab.bak-F4 && { echo 'PARE: ja existe linha fila_intel no crontab'; exit 1; }
  N0=$(grep -c -e retentar -e pulso /opt/agente/crontab.bak-F4)
  (cat /opt/agente/crontab.bak-F4; echo '*/10 * * * * timeout -k 30s 25m /opt/agente/venv/bin/python /opt/agente/fila_intel.py --cron >>/opt/agente/log/fila_intel.err 2>&1') | crontab -
  [ "$(crontab -l | grep -c -e retentar -e pulso)" = "$N0" ] && [ "$(crontab -l | grep -c fila_intel)" = 1 ] && echo CRON-OK || echo 'PARE: crontab divergente — restaure com  crontab /opt/agente/crontab.bak-F4'
)
```

**Rollback, na ordem inversa**
- **F4.**
  - Tira só a linha da fila: `crontab -l | grep -vF '/opt/agente/fila_intel.py' | crontab -`, e confere `crontab -l | grep -c fila_intel` → 0 com `retentar`/`pulso` intactos. Restaurar o `.bak-F4` inteiro apagaria linhas acrescentadas depois do F4.
  - Espera o lock (`flock -w 1800 /opt/agente/fila_intel.lock true && echo LOCK-LIVRE || echo 'ESPERAR: execucao ainda viva'`), o que deixa a execução em curso terminar. Só siga para o passo seguinte com `LOCK-LIVRE` impresso. A espera é limitada porque uma execução pode levar 25 min (§4.1) e o `flock` sem `-w` penduraria o rollback sem dizer por quê; se estourar, o dono confere `pgrep -af fila_intel.py` antes de seguir.
  - Tira só o bloco da fila do pulso com `cd /opt/agente/docs && python3 pulso_f4.py --remover` (do marcador `# >>> fila_intel (F4)` ao `# <<< fila_intel (F4)`, contagem 1 de cada); os comandos seguintes rodam nesse mesmo diretório, porque também são relativos: `bash -n pulso.sh.tmp`; `chmod 755 pulso.sh.tmp && mv pulso.sh.tmp pulso.sh`. Não restaura o `.bak-F4` inteiro, pelo mesmo motivo do crontab. Confere `grep -c URL_FILA /opt/agente/docs/pulso.sh` → 0.
  - Na mesma hora, o dono pausa (ou apaga) o check `URL_FILA` no healthchecks. Sem ping, ele fica atrasado em ~1 h e vermelho depois da folga configurada, e dá um alarme falso no meio do rollback.
- **Qualidade, com o F0 no ar.** Antes de qualquer SQL, tire a linha do crontab e espere o lock (os dois primeiros passos do rollback do F4): com o cron vivo, a execução seguinte clama a task seguinte e regrava uma linha `forja` em até 10 min, desfazendo a retirada. Só então, o dono, na raiz do repo, por `npx --yes supabase@2.98.2 db query --linked --agent=no -o json "<sql>"`:
  1. exporta `select * from public.youtube_intelligence where source='forja' and site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com')` com `> ~/Workspace/forja/ferramentas/fase2/forja-export-$(date +%F).json` (fora do repo);
  2. renomeia a de canal (na 2a a forja não tem linha de vídeo, §3.3): `update public.youtube_intelligence set source='forja_retirada_' || to_char(now(),'YYYYMMDDHH24MI') where source='forja' and site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com')`.

  Os três SQLs levam o mesmo `and site_id = …`, o escopo do `seed_chave_forja.sh` (§4.6): um `where source='forja'` solto exporta, renomeia e depois "prova" sobre as linhas de todos os sites. O sufixo evita colisão com os índices. Prova: `select count(*) from public.youtube_intelligence where source='forja' and site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com')` = 0, e PT logado mostra "por Cowork". A allowlist do §3.6 volta a mostrar o Cowork, e o Cowork já não lia a forja (§3.5). Se a task que a forja fechou foi **manual** (o pedido do botão do passo (1) do F4), ela segue `completed` e o botão responde `cooldown` por até 24 h depois do `completed_at` (`actions.ts:211-213`): nesse intervalo o PT mostra a análise `cowork` de maio e um pedido novo só sai pela task do cron de segunda ou depois das 24 h. Se a task fechada foi do cron, o botão responde na hora (§3.6).
- **F1 (dono).** Pelo mesmo `db query`: `update public.pipeline_api_keys set revoked_at=now() where name='forja (fila)' and revoked_at is null and site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com')` — o mesmo escopo de site do `seed_chave_forja.sh`, que revoga só as `'forja (fila)'` ativas **do site** (§4.6). Depois apaga `/opt/agente/fila_intel.env`.
- **S4 (dono).** O `deploy.sh` só restaura sozinho quando a saúde falha logo depois da troca (`deploy.sh:17-23`). Depois disso, com a linha do crontab já fora (rollback do F4), em `/opt/agente`: `B=$(ls proxy.py.bak-*-S4 | head -1)` (o mais antigo pelo carimbo `%m%d-%H%M` do nome: o `cp -p` do `deploy.sh` preserva o mtime, e um S4 refeito deixa um backup mais novo já com o `sitio.py` da fase 2); `[ -f "$B.sitio" ]` ou para; `flock /opt/agente/fila_intel.lock sh -c "cp -p $B.sitio sitio.py.tmp && mv sitio.py.tmp sitio.py"`; reinicia o `proxy-agente` sem sudo, esperando o PID mudar, com a receita de `deploy.sh:13-16`: `P=$(systemctl show -p MainPID --value proxy-agente); [ "$P" -gt 0 ] && kill "$P"; N=$P; for i in $(seq 40); do N=$(systemctl show -p MainPID --value proxy-agente); [ "$N" -gt 0 ] && [ "$N" != "$P" ] && curl -fsS -m 2 127.0.0.1:8081/v1/models >/dev/null && break; sleep 1; done; [ "$N" != "$P" ] || echo 'PID nao mudou - proxy fora, avisar'`; confere `curl -fsS 127.0.0.1:8081/v1/models`, `(cd /opt/agente/docs/trilha && AGENTE_SITIO=/opt/agente/sitio.py python3 -B teste_s1.py)` sem edição, `prova_site.py agente-auto` 5/5 e `python3 -c "import importlib.util as u;s=u.spec_from_file_location('s','/opt/agente/sitio.py');m=u.module_from_spec(s);s.loader.exec_module(m);assert 2 not in m.ROTAS_FASE"` saindo 0. O `proxy.py` do S4 é cópia idêntica e não volta. Depois disso, desfaz o que o S4 e o F1 deixaram no caminho dos cartões futuros, senão o próximo cartão que escrever `sitio.py.novo` — o S5 do §10, que mexe em `resumir_canal`, função do **`sitio.py`** — reprova num portão que nada tem a ver com ele, porque sobre um `sitio.py` de volta à fase 1 o `teste_fila` não acha `ROTAS_FASE[2]`: tira a linha do `teste_fila` do `cartao.sh` vivo (`sed -i '/teste_fila/d' /opt/agente/docs/trilha/cartao.sh` e depois `grep -c teste_fila /opt/agente/docs/trilha/cartao.sh` → 0) **e** a mesma linha da cópia do kit no Mac (`~/Workspace/forja/ferramentas/docs/trilha/cartao.sh`), senão o próximo K a repõe; e remove o worker (`rm -f /opt/agente/fila_intel.py /opt/agente/fila_intel.py.bak`), que o F1 instalou e cujo rollback só apagou o `fila_intel.env`.
- **F0.** O dono:
  1. com o F0 ainda no ar, exporta e, com o arquivo conferido, apaga — na raiz do repo, como no rollback de qualidade: `npx --yes supabase@2.98.2 db query --linked --agent=no -o json "select * from public.youtube_intelligence where source like 'forja%' and site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com')" > ~/Workspace/forja/ferramentas/fase2/forja-export-f0-$(date +%F).json` e depois `npx --yes supabase@2.98.2 db query --linked --agent=no "delete from public.youtube_intelligence where source like 'forja%' and site_id = (select id from public.sites where primary_domain='bythiagofigueiredo.com')"` — mesmo escopo de site dos SQLs de qualidade acima, e o `select count(*)` do passo 2 leva o mesmo predicado. O snapshot velho não filtra `source`, e o Cowork o lê a qualquer momento pelo resource MCP e por `get_intelligence`, sem uma "execução" marcada. Com o F0 no ar, a allowlist do §3.6 já mostra o Cowork sem essas linhas;
  2. só então `git revert` e promoção, com o mesmo portão do F0 (CI verde em staging, validação autenticada antes da promoção); depois, `select count(*) from public.youtube_intelligence where source like 'forja%'` = 0, e PT com o diagnóstico do Cowork logado em prod.

## 6. Observabilidade
- **Log.** Uma linha por execução com lock (§4.1).
- **Pulso.** Entra no F4, com leitura por `python3 -` embutido, e reporta num **check próprio do healthchecks** (`URL_FILA`, criado pelo dono no F4, período 1 h. O `pulso_f4.py` recebe a URL do ping como argumento, recusa valor fora de `^https://hc-ping\.com/[0-9a-f-]{36}$` e grava `URL_FILA="…"` no início do bloco inserido; o `pulso.sh` já guarda a própria URL no arquivo, `onda0b/pulso.sh.novo:27`). O bloco lê `FILA_LOG="${FILA_LOG:-/opt/agente/log/fila_intel.jsonl}"` (nunca o caminho fixo; passado ao `python3 -` por argumento), calcula `ok_fila` (ignora linha que não termina em `\n` ou falha em `json.loads`; qualquer exceção do `python3 -` embutido dá vermelho com motivo `fila-leitura-<Tipo>`, no padrão `print(type(e).__name__)` do pulso), pinga `$URL_FILA` ou `$URL_FILA/fail` com as mesmas tentativas do pulso, chamando `curl` e `sleep` pelo nome (nunca por caminho absoluto), e acrescenta seu motivo a `$motivo` (para o `pulso.log`), **sem tocar em `ok`**. O healthchecks só avisa na transição: se a fila pintasse o check principal, uma task reprovada o deixaria vermelho por até 24 h e calaria um proxy, llama ou esteira caídos nesse intervalo. O check da fila fica vermelho se:
  - o mtime de `fila_intel.jsonl` tem mais de 70 min (cron morto ou import quebrado). A conta da margem: a linha só é escrita no fim (§4.1), uma execução pode durar 25 min e os tiques de 10 min que pegam o lock ocupado não gravam nada, então o silêncio normal já chega a 30 min; uma execução morta por SIGKILL não grava linha e, somada à seguinte, chega a ~60 min sem que nada tenha caído. O limiar cabe no período de 1 h do check. Arquivo ausente conta como vermelho: o bloco só entra no passo (3) do F4, e o arquivo já existe desde o `--escolher` do F0.5 (toda execução com lock grava uma linha, §4.1 e §4.7);
  - a linha `modo: cron` mais recente com `task` não nulo tem menos de 24 h e não é `ok`. Uma linha `ok` mais nova apaga o motivo na hora;
  - a linha `modo: cron` mais recente tem `desfecho` em (`chave`, `config`): são falhas permanentes, sem nada a esperar, e o motivo sai como `fila-parada:<desfecho>`. Uma linha `modo: cron` mais nova com `claim` em (200, 204) apaga o motivo — inclusive na troca de chave do §4.6, cuja janela entre o `--trocar` e o `seed_chave_forja.sh` dá `chave` e se limpa no primeiro claim depois do seed;
  - nenhuma linha `modo: cron` das últimas 24 h tem `claim` em (200, 204). Isso pega config errada, chave recusada, `/slots` mudado e relógio divergente. No `pulso.log`, o motivo sai como `fila-sem-claim-24h:` seguido do `desfecho` da última linha `modo: cron` das 24 h; quando esse desfecho é `ocupado`, acrescenta o primeiro `motivos` dessa linha (`fila-sem-claim-24h:ocupado:janela_sync` ou `:slots`), porque `ocupado` cobre a janela do sync e o slot em uso (o lock ocupado não grava linha, §4.1). Sem nenhuma linha `modo: cron` em 24 h, o motivo é `fila-sem-claim-24h:nenhuma` (vermelho).
- **Site.** `failed` com `error_message` legível; `stale` pelo watchdog, com `auto-released`.

## 7. Fase 2b — recomendações por vídeo, prioridades e F3

Tudo o que a v6 desenhou para vídeos e eixos, adiado pela decisão de 19/09. Aqui fica só o desenho, sem detalhe de implementação; a 2b terá spec próprio, partindo da v6.

**Gatilho objetivo** — a 2b abre quando valer **qualquer** um:
1. **O canal volta a publicar e há cobertura:** existe vídeo PT com `published_at` depois de 10/12/2024 **e** `youtube_video_analytics` tem ≥ 56 datas distintas para os vídeos do canal (em 19/09: 14, de 06/09 a 19/09; conferido só de leitura). As 56 datas bastam para R1/R2/R4, que só usam `recent`; as prioridades `reach`/`growth` dependem de `recent_base` e só passam a sair a partir de 02/12 (a primeira `date` com linha a ±3 dias de `date − 90`, contada da primeira linha, 06/09), ou seja ≈ 88 datas — a 56ª cai em 31/10, e até 02/12 a 2b abriria com R1/R2/R4 vivos e os eixos mortos. Conferência só de leitura: `select count(distinct a.date) from youtube_video_analytics a join youtube_videos v on v.id = a.youtube_video_id where v.channel_id = '<PT>'`;
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
- A idade do snapshot por canal e por site no MCP (`fetchSnapshotAge` filtrando `channel_id` e `site_id`, e `fetchChannelInfo` idem); hoje é global e segue global (§3.6).
- O canal EN, até ter vídeos.
- Aposentar o Cowork (decisão com os dados do F3 da 2b, §7).
- Fase 3.

## 9. Riscos aceitos
- **Análise estreita e magra.** Sem CTR nem retenção, e, por escopo, sem recomendações por vídeo e sem prioridades (§7); o canal PT sai com summary e 1 padrão. Isso fica visível no `AVISO_ESTREITO` e na linha de summary. Se `fetchGradesData` falhar, `page.tsx:58` cai em `{videos: [], outliers: []}`, `videoCount` vira 0 (`yt-analytics-tabs.tsx:299`) e o early return de `yt-health-coach.tsx:68` esconde rótulo e summary: a aba mostra "Nenhuma analise de inteligencia disponivel ainda." mesmo com a linha `forja` gravada.
- **Disputa pelo slot.**
  - No chat comum, a análise segue no outro slot.
  - No `agente-pesquisa` (2 slots), o pedido da fila espera; se o orçamento acabar, vira `fail {retry:true}`.
  - O inverso: uma pesquisa com mais de 5 min pode deixar a fila clamar no meio, e a chamada paralela da pesquisa espera até ~2,6 min por tentativa (o proxy usa `timeout=None`). Atrasa, não derruba.
- **Morte depois do claim.**
  - O `finally` só grava a linha `morto`; não chama `fail`.
  - Sinal, SIGKILL, falta de rede ou resposta do claim perdida deixam a task `running` até o watchdog (30–60 min). Nesse intervalo o botão responde `already_active`, e depois a task vira `stale` sem cooldown.
  - Um pedido manual perdido assim tem de ser refeito.
- **Vazamento da `forja (fila)`.** O alcance é fechado:
  - clamar tasks `pending` do site, deixando o Cowork sem trabalho;
  - dar `fail`, inclusive com `retry`, só nas tasks que ela mesma clamou;
  - gravar diagnóstico `source='forja'` visível no Health Coach (texto escapado pelo React). Como a linha `forja` da 2a sempre tem `priorities: []` e o Health Coach mostra a mais nova da allowlist (§3.6), uma linha forjada **esconde os cards do Cowork** até a retirada (§5, "Qualidade"). O `AVISO_ESTREITO` é prefixado pelo worker (§4.4), não pelo servidor: um `summary` forjado aparece sem ressalva nenhuma, com o selo "por forja". O servidor não o impõe de propósito — seria mais uma regra de reescrita, contra a escolha "recusar, não reescrever" do §3.3. Para saber se houve abuso, confira o `result_summary.claimed_by` da task e o conteúdo da linha exportada.

  Clama só pelo REST, com `channel_ids`; não fecha tasks clamadas por outra chave, não lê além de `{read}`, não altera linhas `cowork` e não alimenta o Cowork (§3.5). A resposta é revogar (F1) e retirar (§5).
- **Snapshot limitado a 50 vídeos** (`services/youtube.ts:222`, os mais recentes). Acima disso, coortes e séries antigas somem dos padrões e, junto, `canal.videos` e `views_90d` da `ENTRADA` (§4.4) passam a contar só os 50 mais recentes — contra o glossário, que diz ao 12B que `videos` é o canal inteiro. Hoje são 35; o teto é revisto no mesmo movimento em que o canal voltar a publicar (gatilho da 2b, §7).
- **Retry sem backoff.** O `fail {retry:true}` devolve a task com o `requested_at` original, e o claim pega sempre o `pending` mais antigo (`services/youtube.ts:467`): a execução seguinte (≤ 10 min) reclama a mesma task. Uma causa que dure meia hora (geração truncando, contenção de slot estourando o orçamento) gasta os 3 desfechos em ~30 min e a task vira `failed`, terminal — o canal fica sem análise até a task do cron da segunda seguinte. As guardas de `/slots` e de chat (§4.1 passo 2) evitam o caso de llama fora; o pulso mostra o `llama`/`orcamento` por 24 h.
- **Regex de números reprovando texto correto.** O F2 mede; ajusta-se a normalização; o template garante que a task não trava.

## 10. Achado colateral — o overview soma fotos de 90 dias

A fase 1 disse "428 views nos últimos 28 dias", e o erro está no site.
- O overview (`services/youtube.ts:1857-1864,1917-1919`) soma as linhas de `youtube_video_analytics` desde o corte, mas cada linha já é um total móvel de 90 dias.
- Os 428 são 13 fotos de ~33 views. O real é **~29 views nos últimos 90 dias**.
- O `scoreVideo` também recebe essas fotos como se fossem views diárias.

Duas correções à parte:
- **Site** (`BACKLOG-site.md` item 0, prioridade alta): usar a linha mais recente. Antes, conferir quais telas consomem `kpis.views`.
- **Forja, cartão S5** (fora desta fase, sempre depois do F4): `resumir_canal` passa a citar `Σ recent.views` do snapshot como "views nos últimos 90 dias". O S5 terá desenho próprio, partindo do `teste_s1` que o S4 deixou intacto.
