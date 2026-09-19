# Fase 2 — a forja drena a fila de inteligência do YouTube

**Data:** 2026-09-18 · **Estado:** aprovado em conversa (3 seções), aguardando revisão do spec escrito
**Fase 1 (feita):** `~/Workspace/forja/SPEC-forja-le-site.md` — a forja lê o site só leitura, em produção desde 18/09.
**Esboço anterior:** `~/Workspace/forja/spec-site/secoes/10-fase2.md` (achados de código; este spec o substitui).

## 1. Problema e objetivo

A fila `youtube_intelligence_tasks` recebe pedidos (cron de segunda 8h + botão "Solicitar Nova Análise" do
Health Coach), mas **ninguém consome**. Medido em produção em 18/09:

| Canal | Tarefas | Análises gravadas |
|---|---|---|
| EN `117b666d…` (Thiago Figueiredo) | stale:2 | nenhuma |
| PT `969fcf1b…` (tnFigueiredo) | completed:3 · stale:9 | 1 canal + 10 vídeos, Cowork, 2026-05-18 |

Nenhuma tarefa foi clamada (`started_at` sempre nulo); um job das 03:00 marca `stale` o `pending` com ~8 dias,
por isso o cron só gera tarefa nova a cada **duas** segundas. O "3" da aba Health Coach conta cards heurísticos,
não a fila.

**Objetivo:** a forja (Gemma 12B local, `/opt/agente`) vira worker da fila, grava análises com
`source='forja'` ao lado das do Cowork, e o Health Coach mostra a mais recente com selo da fonte.
**Papel decidido pelo dono:** a forja substitui o Cowork *eventualmente*; nesta fase, **convive**.

## 2. Decisões (aprovadas)

1. **Abordagem A — código calcula, 12B redige.** Toda aritmética, escolha de alvo, `action_type`,
   `priority`, `confidence` e `score` vêm de código determinístico; o modelo só escreve os campos de texto,
   com `response_format: json_schema` (medido: llama b10142 respeita o schema; ~39 tok/s; o Gemma gasta
   tokens em `reasoning_content`, então `max_tokens` folgado).
2. **Quando:** crontab do `thiago` a cada 10 min; só faz o claim se os 2 slots do llama estão livres
   (`GET 127.0.0.1:8080/slots` → `is_processing` todos `false`) e não houve turno de chat nos últimos 5 min.
3. **Convivência:** `source='forja'` nunca sobrescreve `source='cowork'` (índices únicos já são por `source`).
4. **Chave separada e estreita:** `forja (fila)` com `permissions = {read, intelligence}`; a chave
   `forja (so leitura)` da fase 1 continua `{read}` e continua sendo a do chat.

## 3. Site — um commit (card F0), antes de ligar a forja

### 3.1 Permissão `intelligence`
`lib/pipeline/auth.ts`: `requirePermission(auth, 'intelligence')` aceita `intelligence | write | admin`.
`lib/pipeline/helpers.ts`: `authenticateIntel(req)` (mesmo formato de `authenticateWrite`). Rotas de escrita
da fila usam `authenticateIntel`; nenhuma outra rota muda — uma chave `{read, intelligence}` recebe 403 em
qualquer escrita fora da fila. Sessão do CMS continua `['read','write']`.

### 3.2 Claim
- **Novo** `POST /api/pipeline/youtube/intelligence/task/claim` (`authenticateIntel`): CAS `pending→running`,
  sem parâmetro de status. 200 com a task, 204 com fila vazia.
- `GET …/intelligence/task` (legado do Cowork) vira alias: passa a exigir `authenticateIntel` e **força**
  `status='pending'` — fecha o `?status=completed` que reabria task concluída.
- `claimNextTask(ctx)` perde o parâmetro `statusFilter`.

### 3.3 PATCH `…/intelligence`
- `authenticateIntel` + `parseBody(req, PatchPayloadSchema)` (hoje o schema existe mas não é aplicado).
- `PatchPayloadSchema` ganha `source: z.enum(['cowork','forja']).default('cowork')`; as gravações usam
  `source` do corpo no lugar do `'cowork'` fixo (canal e vídeo).
- Com `source='forja'`: **não** move ciclo `flagged→diagnosed` e **não** faz fan-out de `notifications`
  (o corpo da forja manda `notifications: []`); faz **uma** notificação simples ao dono
  (`youtube.intelligence_ready`, "Análise da forja pronta — <canal>", dedup por task).
- **Bug `partial_failure`:** o status final vira `completed` sem erro, ou `failed` com `error_message`
  listando os erros e `failed_at`; o erro do update da task é checado (hoje é ignorado e a task fica
  `running` até o watchdog).

### 3.4 Falha explícita
**Novo** `POST /api/pipeline/youtube/intelligence/task/{id}/fail` (`authenticateIntel`), corpo
`{ reason: string ≤ 500 }` (Zod): CAS `running→failed`, grava `failed_at` e `error_message`. 409 se a task
não está `running`; 404 se não é do site.

### 3.5 Health Coach
`fetchChannelCoaching` e a leitura das recomendações por vídeo deixam de filtrar `source='cowork'`: pegam
a linha mais recente (`generated_at desc`) de qualquer fonte e devolvem `source`. A UI mostra um selo
"por forja · dd/mm" ou "por Cowork · dd/mm" no card do diagnóstico. Sem outra mudança visual.

### 3.6 Arrastados pelo commit
- `lib/pipeline/api-registry.ts` (+2 endpoints, `endpoint_count`) e
  `data/pipeline-docs/cowork-docs-youtube.md` (claim POST, fail, `source`, `channel_id` **obrigatório** no GET).
- Testes (Vitest): claim POST 200/204, GET legado ignora `?status=completed`, PATCH 400 em payload fora do
  schema, `source` default `cowork`, forja não mexe em ciclo nem notificações, falha parcial → `failed`,
  rota fail 200/409/404, chave `{read}` → 403 no claim/PATCH/fail, chave `{read,intelligence}` → 403 em
  outra escrita do pipeline (ex.: PATCH de item), Health Coach devolve a fonte mais recente.
- **Sem migration:** `youtube_intelligence.source` não tem CHECK; status `failed` já existe no CHECK da fila.

## 4. Forja — `/opt/agente/fila_intel.py` (cards F1–F4)

### 4.1 Laço (uma execução do cron)
1. `flock -n /opt/agente/fila_intel.lock` — se outra execução roda, sai.
2. Llama ocupado ou chat nos últimos 5 min (última linha de `roteamento.jsonl`) → sai sem tocar no site.
3. `POST claim` com `SITIO_CHAVE_FILA`. 204 → sai. 200 → relógio de 30 min (watchdog) começa; orçamento
   interno 20 min.
4. `GET …/intelligence?channel_id=<task.channel_id>` (snapshot) + `GET …/youtube/analytics/overview`
   (28 dias do canal).
5. `features(snapshot, overview)` → tabela (§4.2). 6. `escolher(tabela)` → alvos e campos numéricos (§4.3).
7. Gemma redige os textos (§4.4). 8. `validar(payload, tabela)` (§4.5).
9. Passou → um `PATCH` com `source:'forja'`. Reprovou → uma nova geração; reprovou de novo ou estourou o
   orçamento → `POST …/fail {reason}`.
10. Uma linha em `/opt/agente/log/fila_intel.jsonl`: quando, task, canal, fase, ms por etapa, tentativas,
    veredito, motivos. Sem chave, sem texto gerado.

### 4.2 `features` — função pura
Por vídeo: `views_dia = view_count / max(dias_desde_publicacao, 1)`, rank, razão à mediana do canal,
série (prefixo de título até ` - `/`:`/número, ou palavra-chave repetida ≥3 vídeos), era (ano de
publicação). Por canal: mediana, total, inscritos 28d, views 28d. Campos nulos (`ctr`, `impressions`,
`avg_view_percentage`, `retention_curve`, `traffic_sources`) ficam **ausentes** da tabela, não zero.
Teste: fixture congelada de 35 vídeos (snapshot real anonimizado de títulos não é necessário — é dado do
próprio dono).

### 4.3 `escolher` — regras (dado, não prompt)
| Regra | `action_type` | `priority` |
|---|---|---|
| vídeo ≥ 60 dias com `views_dia` < 0,4 × mediana da própria série (série ≥ 3 vídeos) | `title_test` | high se < 0,2×, senão medium |
| série com mediana ≥ 2 × mediana do canal | `content_series` (no vídeo mais recente da série) | medium |
| vídeo < 30 dias com `views_dia` < 0,5 × mediana do canal | `distribution_expand` | medium |
| top 3 do canal por `views_dia` com ≥ 180 dias | `end_screen_optimize` | low |
No máximo 10 recomendações, ordenadas por `priority` e distância à mediana; um vídeo recebe uma só.
`confidence = min(0,9, 0,4 + 0,05 × tamanho_da_amostra_da_regra)`.
**Coaching `priorities`:** só eixos com dado — `reach` (views 28d vs. média das 4 janelas de 28d
anteriores, quando existir; senão views_dia mediana vs. canal) e `growth` (inscritos 28d); `score` 0–10 por
fórmula fixa no código. `ctr`, `retention`, `engagement`, `sub_impact` **não entram** nesta fase.
`patterns_detected`: séries (finding + sample_size), eras, e dia da semana só com ≥ 20 vídeos.

### 4.4 Redação pelo 12B
Um pedido por análise ao llama local, `json_schema` com os campos de texto apenas: `summary` (≤500),
por prioridade `diagnosis`/`action` (≤300), por recomendação `reasoning` (≤500) e opcional
`suggested_variant_description` (≤200), `analysis_text` (≤2000). O prompt recebe a tabela compacta
(≈5 KB) e a instrução "use só números da tabela; não fale de CTR, retenção ou nota". O código monta o
payload final juntando texto + campos numéricos de §4.3.

### 4.5 Validador local (tudo ou nada)
- Espelho em Python dos limites de `PatchPayloadSchema` (enums, tamanhos, faixas, uuid, ≤25 recs, ≤6 prioridades).
- Todo `video_id` existe no snapshot.
- Todo número no texto (inteiros e decimais, com `%`/`x`/`mil`) casa com um valor da tabela ±1% ou
  arredondamento exibido; datas e ordinais de série ignorados.
- Nenhuma menção a CTR, impressões, retenção, nota/letra (regex).

### 4.6 Trava e segredos
`sitio.py` ganha `ROTAS_FASE[2]` = fase 1 + `POST …/task/claim`, `POST …/task/{uuid}/fail`,
`GET …/intelligence?channel_id=<uuid>`, `PATCH …/intelligence` — as de escrita só com `SITIO_CHAVE_FILA`
e só dentro de `fila_intel.py` (o proxy continua em fase 1). `pedir()` ganha `metodo` e `corpo`; 204 é
resposta válida. `SITIO_CHAVE_FILA` mora em `/etc/default/proxy-agente` (thiago 0600); o cron lê o arquivo
pelo próprio Python, nunca por argv. Gerada por `nova_chave.py --fila`, semeada por
`seed_chave_forja.sh --fila <sha>` com `permissions = array['read','intelligence']`.

### 4.7 Sombra
`fila_intel.py --sombra [--canal PT|EN]`: sem claim, sem PATCH, sem fail; lê snapshot com a chave de
leitura, gera, valida, grava `/opt/agente/sombra/<canal>-<quando>.json` com payload + veredito.

## 5. Rollout — cards

| Card | O quê | Portão |
|---|---|---|
| **F0** | Commit do site (§3) em staging → main | Vitest das rotas novas + typecheck; Vercel verde; validação **autenticada** do Health Coach (`docs/ops/runbook-cms-e2e-local.md`) mostrando a análise de maio "por Cowork" |
| **F1** | Chave `forja (fila)` | canário: claim com a chave nova → 204/200 (se 200, `fail` imediato com reason "canario"); a chave `{read}` → 403 no claim |
| **F2** | `--sombra` | **100% em 6 rodadas** (2 canais × 3) nos portões duros de §4.5 |
| **F3** | Qualidade | dono avalia às cegas 10 recomendações da forja × 10 do Cowork geradas sobre o **mesmo snapshot congelado**; liga com ≥ 8/10 "aceitável" e zero "errada" |
| **F4** | Liga o cron | próximo pedido (botão ou cron de segunda) vira análise "por forja" no Health Coach em ≤ 15 min; a do Cowork continua visível |

**Rollback, ordem inversa:** F4 comenta a linha do crontab · F1 revoga `forja (fila)` (`revoked_at`) ·
F0 `git revert` (linhas `source='forja'` ficam inertes: a UI antiga filtra `cowork`). Nada de banco a
desfazer.

## 6. Observabilidade
- Pulso (O2): falha se existe task `pending` há > 1 h e a forja não registrou tentativa no log na última hora.
- `failed` com `error_message` legível no banco; log JSONL por tentativa na forja.

## 7. Fora desta fase
CTR/retenção/eixos sem dado (dependem de `BACKLOG-site.md` itens 1–2); notificações ricas e ciclo
`flagged→diagnosed` pela forja; aposentar o Cowork (decisão com os dados do F3); fase 3.

## 8. Riscos
- **Análise estreita** sem CTR/retenção: diz isso no `summary`. Valor esperado: consistência e alcance
  por série.
- **Slot disputado:** o chat do dono pode começar no meio da análise; o llama tem 2 slots, o chat segue
  no outro; o orçamento de 20 min < watchdog de 30.
- **Regex de números** pode reprovar texto correto (falso negativo) → o F2 mede; ajuste nas regras, não
  no limiar de 100%.
