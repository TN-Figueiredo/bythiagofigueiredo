# YouTube Intelligence — Referência Pipeline Cowork

> **Skill:** Performance Reviewer  
> **Trigger:** Análise de performance de canal YouTube, recomendações de otimização  
> **Auth:** `X-Pipeline-Key` header

## Visão Geral

O módulo Intelligence Engine analisa performance de canais YouTube e gera:
- Diagnósticos por vídeo (fraquezas, oportunidades)
- Coaching cards (recomendações priorizadas por eixo)
- Notificações acionáveis (grade drops, CTR drops, viral detection)
- Sugestões de A/B tests (thumb, title, description, combo)

---

## Endpoints Pipeline

**Envelope:** toda resposta de sucesso vem em `{"data": ...}`; toda recusa vem em `{"error": {"code", "message"}}`, com `details` opcional (lista `[{path, message}]` por campo) quando a recusa é de corpo inválido — vale para todo endpoint deste arquivo. Cabeçalhos `X-RateLimit-*` acompanham a resposta sempre que a chave já foi autenticada antes da recusa (inclui corpo inválido pós-auth, não só sucesso).

### GET /api/pipeline/youtube/intelligence?channel_id={id}

Retorna snapshot completo de inteligência do canal.

Exige `intelligence` (ou `write`/`admin`) — **não** `read`, escopo amplo que abriria todo GET do pipeline.

**Headers:** `X-Pipeline-Key: {api_key}`
**Query:** `channel_id` (uuid) — **obrigatório**; sem ele, `400 VALIDATION_ERROR`.

**Response 200:**
```json
{
  "data": {
    "channel": {
      "id": "uuid",
      "channel_id": "UC...",
      "name": "Canal Nome",
      "subscriber_count": 12500
    },
    "recent_window": { "date": "2026-09-17", "days": 90 },
    "videos": [
      {
        "id": "uuid",
        "video_id": "dQw4w9WgXcQ",
        "title": "Título do Vídeo",
        "published_at": "2026-01-15T10:00:00Z",
        "view_count": 45000,
        "ctr": 4.8,
        "impressions": 120000,
        "avg_view_percentage": 42.5,
        "avg_view_duration_seconds": 312,
        "retention_curve": [100, 95, 88, 72, 60, 48, 35, 28],
        "traffic_sources": {
          "browse": 35,
          "search": 25,
          "suggested": 20,
          "external": 12,
          "direct": 5,
          "notifications": 3
        },
        "is_hidden": false,
        "recent": { "views": 150, "subscribers_gained": 2 }
      }
    ],
    "grade_history": [
      {
        "youtube_video_id": "uuid",
        "week_iso": "2026-W19",
        "grade": "C",
        "score": 52.3
      }
    ],
    "optimization_cycles": [
      {
        "youtube_video_id": "uuid",
        "state": "flagged",
        "consecutive_low_weeks": 2,
        "cycle_number": 1
      }
    ],
    "intelligence": []
  }
}
```

**Campos novos (fase 2a):**
- `recent_window` — `{ date, days }` da data mais recente com analytics dentro de 3 dias; `null` inteiro (nunca `{ date: null }`) quando nada cai nesse prazo.
- `videos[].recent` — a linha daquela ÚNICA data de `recent_window` (nunca uma soma); vídeo sem atividade nela vem como `{ views: 0, subscribers_gained: 0 }`.
- `videos[].is_hidden` — vídeo ocultado (não deletado) no CMS.
- `intelligence` — substitui o antigo `existing_intelligence`; agora é um array, e contém **só** linhas com `source: "cowork"` — as análises da forja nunca aparecem aqui.

### PATCH /api/pipeline/youtube/intelligence

Recebe resultados de análise do Cowork.

**Headers:** `X-Pipeline-Key: {api_key}`

**Payload:**
```json
{
  "task_id": "uuid",
  "video_recommendations": [
    {
      "video_id": "uuid",
      "action_type": "thumbnail_test",
      "priority": "high",
      "confidence": 0.85,
      "reasoning": "CTR 2.1% está 60% abaixo da média do canal. Thumbnail atual usa texto pequeno demais em mobile."
    }
  ],
  "coaching": {
    "summary": "Canal com CTR abaixo do benchmark. Foco em thumbnails e titles nos próximos 30 dias.",
    "priorities": [
      {
        "axis": "ctr",
        "score": 3.2,
        "diagnosis": "CTR médio 2.8% vs benchmark 4.5% para canais de mesmo porte.",
        "action": "Testar thumbnails com rostos expressivos e texto de até 4 palavras."
      }
    ]
  },
  "notifications": [
    {
      "type": "optimization_available",
      "video_id": "uuid",
      "priority": 3,
      "title": "Oportunidade: Teste de thumbnail",
      "message": "O vídeo X tem CTR 60% abaixo da média. Recomendamos teste A/B de thumbnail."
    }
  ]
}
```

**Response 200:**
```json
{ "data": { "status": "ok", "processed": true } }
```

**Fonte da linha:** vem da chave que autentica a chamada, nunca de um campo `source` no corpo (ignorado se presente) — chaves largas (`write`/`admin`) ou sessão gravam `source: "cowork"`.

**Erros:**
| Code | HTTP | Quando |
|------|------|--------|
| VALIDATION_ERROR | 400 | Corpo inválido |
| VALIDATION_ERROR | 422 | `video_id` referenciado não existe no canal (falha de integridade referencial) |
| NOT_FOUND | 404 | `task_id` não existe |
| TASK_NOT_RUNNING | 409 | Task não está `running`, ou pertence a outra chave — **não reenviar** |
| PARTIAL_FAILURE | 500 | Uma ou mais escritas falharam; a task **continua `running`** e nada foi fechado — feche com `fail` (`retry: true`) |

**Fechamento explícito da task** (quando o worker não conseguiu terminar, ou levou 409/500 acima): dois endpoints REST — contrato essencial abaixo, detalhe completo mais adiante neste doc.

| Endpoint | Corpo | Respostas |
|---|---|---|
| `POST .../intelligence/task/claim` | `{"channel_ids": ["uuid", …]}` (1–10, obrigatório) | 200 `{"data":{"id","site_id","channel_id","trigger_type","requested_at","started_at"}}` · 204 fila vazia · 400 `VALIDATION_ERROR` · 403 `FORBIDDEN` · 500 `INTERNAL_ERROR` |
| `POST .../intelligence/task/{id}/fail` | `{"reason": "…", "retry": true}` | 200 `{"data":{"id","status","retry_count"}}` · 400 `VALIDATION_ERROR` · 404 `NOT_FOUND` · 409 `TASK_NOT_RUNNING` · 500 `INTERNAL_ERROR` |

**Via MCP (`manage_ab_test`):** existe `claim_task`, mas **não existe ação `fail`** — quem clamou pelo MCP e levou 409/500 fecha via REST (`POST .../task/{id}/fail`) ou espera o watchdog (30–60min). Ver "Retry & Backoff" e o workflow "Via MCP" abaixo.

### GET /api/pipeline/youtube/intelligence/task (legado)

Pickup de tasks pendentes (transição atômica para 'running'). **Endpoint legado** — exige permissão `write` (a chave estreita `{read,intelligence}` não pode usá-lo; use `POST .../intelligence/task/claim` com `channel_ids`).

**Headers:** `X-Pipeline-Key: {api_key}`

**Response 200:** `{ "data": { "id": "uuid", "site_id": "uuid", "channel_id": "uuid", "trigger_type": "weekly", "requested_at": "...", "started_at": "..." } }`
**Response 204:** corpo vazio — fila vazia
**Response 403:** `FORBIDDEN` — chave sem `write`

---

## Formato de Análise (Cowork -> PATCH)

### Recommendations (por vídeo)

```json
{
  "video_id": "uuid",
  "action_type": "thumbnail_test | title_test | description_test | combo_test | retention_fix | seo_optimization | engagement_boost | distribution_expand | content_series | publish_timing | community_post | end_screen_optimize",
  "priority": "high | medium | low",
  "confidence": 0.0-1.0,
  "reasoning": "Explicação em até 500 chars, PT-BR, acionável"
}
```

**Regras:**
- Máximo 25 recommendations por PATCH
- `confidence` deve refletir certeza da análise (0.9+ = padrão claro, 0.5-0.7 = hipótese)
- `reasoning` deve ser específico e incluir dados quando possível
- Não sugerir `thumbnail_test` se vídeo já está em ciclo `testing`

### Coaching (por canal)

```json
{
  "summary": "Resumo de 1-2 frases sobre estado geral do canal. PT-BR.",
  "priorities": [
    {
      "axis": "ctr | retention | reach | engagement | growth | sub_impact",
      "score": 0-10,
      "diagnosis": "O que está acontecendo (max 300 chars)",
      "action": "O que fazer para melhorar (max 300 chars)"
    }
  ]
}
```

`summary_source` (opcional, `model|template`): só a forja envia; o Cowork omite.

**Regras:**
- Máximo 6 priorities (uma por eixo)
- Ordenar por score crescente (pior primeiro)
- `action` deve ser concreta e executável em 7 dias

---

## Algoritmo de Scoring (6 eixos)

Cada vídeo é avaliado em 6 eixos, normalizados via sigmoid para 0-100:

| Eixo | Peso | k (sigmoid) | Descrição |
|------|------|-------------|-----------|
| CTR | 25% | 1.2 | Click-through rate vs mediana do canal |
| Retenção | 25% | 1.0 | avg_view_percentage vs mediana |
| Alcance | 15% | 0.8 | Impressões (log2 normalizado) |
| Engajamento | 15% | 1.0 | (likes+comments+shares)/views × 100 |
| Crescimento | 12% | 0.6 | Velocidade de crescimento diário (log2, sign-preserving) |
| Impacto Sub | 8% | 1.5 | Novos inscritos atribuídos ao vídeo |

**Score final:** soma ponderada dos eixos **medidos**, pesos renormalizados. Eixo sem entrada (hoje: CTR, Retenção, Impacto Sub, Crescimento) sai da soma e vai para `unavailableAxes` com o motivo — nunca entra como 0.

**Grades:** A >= 85, B >= 65, C >= 40, D < 40.

**Modificador lifecycle:** Vídeos < 7 dias recebem 120% peso em CTR; > 180 dias recebem bonus evergreen.

---

## Detecção de Outliers (MAD)

Modified Z-score via Median Absolute Deviation:
- `MAD = median(|Xi - median(X)|)`
- `modified_z = 0.6745 * (Xi - median) / MAD`
- Threshold: `|z| > 2.5` = outlier

Aplicado por eixo. Outliers positivos = "destaques", negativos = "underperformers".

---

## Loop de Otimização (State Machine)

```
unmonitored -> flagged -> diagnosed -> test_suggested -> testing -> post_test_monitoring -> resolved
                                                                                        -> retest_needed -> (volta para diagnosed)
                                                                                        -> exhausted (5 ciclos max)
```

**Triggers:**
- `unmonitored -> flagged`: 2+ semanas consecutivas com grade C/D
- `flagged -> diagnosed`: Cowork analisa e gera recommendation
- `diagnosed -> test_suggested`: recommendation.action_type inclui test
- `test_suggested -> testing`: Usuário cria A/B test via wizard
- `testing -> post_test_monitoring`: A/B test concluído com vencedor
- `post_test_monitoring -> resolved`: Grade melhora para A/B em 30 dias
- `post_test_monitoring -> retest_needed`: Grade permanece C/D após 30 dias
- Qualquer -> exhausted: 5 ciclos atingidos

**Cooldown:** 60 dias após resolved antes de poder ser re-flagged.

---

## Tipos de Notificação

| Tipo | Prioridade | Trigger |
|------|-----------|---------|
| grade_drop | 5 | Queda >= 2 grades em 1 semana |
| ctr_drop | 4 | CTR cai > 30% vs média 7 dias |
| monitoring_alert | 4 | Post-test monitoring: grade não recuperou |
| ab_test_completed | 3 | A/B test tem vencedor declarado |
| retest_suggested | 3 | Ciclo volta para diagnosed |
| optimization_available | 3 | Nova recomendação disponível |
| trending_viral | 2 | views48h >= 5x channelAvg48h |
| optimization_resolved | 1 | Ciclo encerrado com sucesso |

**Dedup:** Unique index em (site_id, dedup_key). Mesma notificação não é criada 2x.
**Expiração:** 30 dias. Cron diário marca `expired_at`.
**Agregação:** 3+ notificações do mesmo tipo são agrupadas.

---

## Tiers de Canal (modificadores)

| Tier | Subscribers | Modificador CTR | Modificador Retenção |
|------|------------|-----------------|---------------------|
| Nano | < 1K | +0.5 | +0.3 |
| Micro | 1K-10K | +0.2 | +0.1 |
| Small | 10K-100K | 0 | 0 |
| Medium | 100K-1M | -0.1 | -0.1 |
| Large | > 1M | -0.3 | -0.2 |

Canais menores recebem "benefício da dúvida" — CTR e retenção naturalmente mais altos com audiência pequena e engajada.

---

## Retry & Backoff

- Tasks em `running` há > 30min: o watchdog (`/api/cron/youtube-intelligence-watchdog`) marca como `stale` — nunca reenfileira sozinho, só libera a linha para outra claim
- `fail` com `retry: true` reenfileira a task (volta para `pending`) — até **2** vezes (`retry_count < 2`); na 3ª falha o status vira `failed` definitivo
- Rate limit: 100 requests/minuto por API key
- Headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Invalid request body or parameters | Check field types and required fields |
| 401 | Missing or invalid X-Pipeline-Key | Verify header is present in request |
| 404 | Resource not found | Verify the ID exists — for channel_id, note that 404 can mean the YouTube channel hasn't been synced yet (run a sync first) |
| 422 `VALIDATION_ERROR` | Referential integrity failed (e.g. `video_id` not found in the channel) | Check the ID against `GET .../intelligence` — do not retry with the same body |
| 409 | Revision conflict (rev mismatch) | Re-GET the resource, use current rev, retry |
| 409 `TASK_NOT_RUNNING` | Task não está `running`, ou está presa em outra chave | **Não reenviar** — reclame outra task (`claim_task` / `POST .../task/claim`) |
| 412 | Version conflict (X-Expected-Version mismatch) | Re-GET the item to refresh version, retry |
| 429 | Rate limit exceeded (100/min) | Wait and retry |
| 500 `PARTIAL_FAILURE` | Uma ou mais escritas do PATCH falharam | A task **continua `running`** e nada foi fechado — feche com `fail` (`retry: true`) para o worker tentar de novo |

---

### POST /api/pipeline/youtube/intelligence/task/claim

Pickup de tasks pendentes com CAS (compare-and-swap) — endpoint atual; funciona com a chave estreita `{read,intelligence}` (o `GET .../intelligence/task` legado exige `write`).

**Headers:** `X-Pipeline-Key: {api_key}`

**Payload:**
```json
{ "channel_ids": ["uuid", "uuid"] }
```
`channel_ids`: 1 a 10 uuids, obrigatório — o worker nunca reivindica uma task fora da lista que está processando.

`task_types` (opcional, só a forja com `OBS_TIPOS=1`): 1 a 5 tipos do observatório — `padroes-titulo`, `padroes-titulo-shorts`, `temas`, `resumo-trocas`, `leitura-video`. Com ele, a claim também pega pedidos do observatório desses tipos e grava o batimento da forja (`forja_heartbeat`: hora do poll + esses tipos como capacidades), mesmo com a fila vazia. **Sem `task_types`** a claim é exatamente a de antes: só `diagnostico` dos `channel_ids`, sem batimento.
```json
{ "channel_ids": ["uuid"], "task_types": ["padroes-titulo", "padroes-titulo-shorts", "temas", "resumo-trocas", "leitura-video"] }
```

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "site_id": "uuid",
    "channel_id": "uuid",
    "trigger_type": "weekly",
    "requested_at": "2026-09-17T10:00:00Z",
    "started_at": "2026-09-17T10:00:03Z",
    "task_type": "diagnostico",
    "target_niche": null,
    "target_video_id": null,
    "target_fmt": null
  }
}
```
Num pedido do observatório, `channel_id` é `null` e o alvo vem em `task_type` + `target_niche` (`ia`/`viagem`) ou `target_video_id` (`leitura-video`), com `target_fmt` (`long`/`short`) nos tipos de outliers. Ver "Leituras do observatório (forja)".

**Response 204:** corpo vazio — fila vazia para esses canais, ou a CAS perdeu para outra claim concorrente
**Response 400:** `VALIDATION_ERROR` — `channel_ids` ausente, vazio ou com mais de 10 ids; `task_types` vazio, com tipo desconhecido ou com mais de 5
**Response 403:** `FORBIDDEN` — chave sem `read`+`intelligence` (nem `write`/`admin`)
**Response 500:** `INTERNAL_ERROR` — falha ao ler a fila

---

### POST /api/pipeline/youtube/intelligence/task/{id}/fail

Fecha explicitamente uma task `running` que o worker não conseguiu terminar — nunca deixe uma task presa esperando o watchdog (30min).

**Headers:** `X-Pipeline-Key: {api_key}`

**Payload:**
```json
{ "reason": "motivo em até 500 chars", "retry": true }
```
`retry: true` reenfileira a task (até 2 vezes); omitido ou `false` fecha como `failed` definitivo.

`refuse: true` (só pedidos do observatório): a forja **recusa** a task — status `refused`, `reason` vira o código da recusa (≤200 chars, ex.: `dado-velho`). A recusa não gasta a cota do dia. `refuse` e `retry` juntos são 400.
```json
{ "reason": "dado-velho", "refuse": true }
```
Resposta da recusa: `{ "data": { "id": "uuid", "status": "refused" } }`.

**Response 200:**
```json
{ "data": { "id": "uuid", "status": "pending", "retry_count": 1 } }
```
**Response 400:** `VALIDATION_ERROR` — corpo inválido (`reason` obrigatório, ≤500 chars; `refuse` + `retry` juntos; recusa de task que não é do observatório)
**Response 404:** `NOT_FOUND` — task não existe
**Response 409:** `TASK_NOT_RUNNING` — task não está `running`, ou pertence a outra chave — não reenviar
**Response 500:** `INTERNAL_ERROR` — falha ao fechar a task

---

## Exemplo Completo de Análise

**Input (GET response simplificado):**
- Canal: 8.500 subs (tier: Micro)
- 12 vídeos com CTR médio 3.2%
- 3 vídeos com grade D (CTR < 2%)
- Padrão: vídeos com thumbnails de texto longo têm CTR 40% menor

**Output esperado (PATCH):**
```json
{
  "task_id": "abc-123",
  "video_recommendations": [
    {
      "video_id": "vid-1",
      "action_type": "thumbnail_test",
      "priority": "high",
      "confidence": 0.88,
      "reasoning": "CTR 1.8% (55% abaixo da média 3.2%). Thumbnail tem 12 palavras — dados mostram que thumbs com <4 palavras performam 40% melhor neste canal."
    },
    {
      "video_id": "vid-2",
      "action_type": "title_test",
      "priority": "medium",
      "confidence": 0.72,
      "reasoning": "CTR 2.4% com título genérico. Títulos com números específicos (ex: '5 maneiras...') têm CTR 25% maior no nicho."
    }
  ],
  "coaching": {
    "summary": "Canal com CTR geral abaixo do benchmark para Micro (3.2% vs 4.5%). Prioridade: otimizar thumbnails dos 3 vídeos grade D.",
    "priorities": [
      {
        "axis": "ctr",
        "score": 3.8,
        "diagnosis": "CTR médio 3.2% vs benchmark 4.5% para canais Micro. 3 de 12 vídeos abaixo de 2%.",
        "action": "Testar thumbnails com rostos expressivos e máximo 4 palavras nos 3 vídeos grade D."
      },
      {
        "axis": "retention",
        "score": 5.5,
        "diagnosis": "Retenção média 42% — aceitável mas com quedas abruptas no minuto 2-3.",
        "action": "Adicionar hook verbal nos primeiros 30s e preview do conteúdo antes da intro."
      }
    ]
  },
  "notifications": [
    {
      "type": "optimization_available",
      "video_id": "vid-1",
      "priority": 3,
      "title": "Oportunidade: Thumbnail A/B Test",
      "message": "Vídeo com CTR 55% abaixo da média. Thumb com texto excessivo identificada como causa provável."
    }
  ]
}
```

---

### POST /api/pipeline/youtube/ab-tests/:id/variants

Batch upsert variants (B, C, D) para um teste em status `draft`. Usa `ON CONFLICT (test_id, label)` — idempotente.

**Auth:** write

**Body:**
```json
{
  "variants": [
    {
      "label": "B",
      "title_text": "Título alternativo B",
      "description_text": null,
      "metadata": {
        "rationale": "Versão com gancho emocional mais forte",
        "thumbnail_tags": ["expressão", "close-up"],
        "emotional_triggers": ["curiosidade", "urgência"]
      }
    }
  ]
}
```

**Regras de validação:**
- `label` deve ser `B`, `C` ou `D` (original não pode ser criado via este endpoint)
- `title_text` obrigatório para `test_type: title` e `combo`
- `description_text` obrigatório para `test_type: description`
- Máximo 3 variantes por chamada
- Teste deve estar em status `draft` (409 caso contrário)

**Response 200:**
```json
{
  "data": {
    "results": [{ "label": "B", "ok": true, "id": "uuid" }],
    "summary": { "total": 1, "succeeded": 1, "failed": 0 }
  }
}
```

---

### GET /api/pipeline/youtube/ab-tests/:id/variants

Lista todas as variantes de um teste, ordenadas por `sort_order` ascendente.

**Auth:** read

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "test_id": "uuid",
      "label": "original",
      "is_original": true,
      "title_text": "Título original do vídeo",
      "description_text": null,
      "metadata": {},
      "sort_order": 0
    },
    {
      "id": "uuid",
      "test_id": "uuid",
      "label": "B",
      "is_original": false,
      "title_text": "Título alternativo B",
      "description_text": null,
      "metadata": { "rationale": "Gancho emocional" },
      "sort_order": 1
    }
  ]
}
```

---

### DELETE /api/pipeline/youtube/ab-tests/:id/variants?label={label}

Remove uma variante não-original (B, C ou D) de um teste em status `draft`.

**Auth:** write

**Query params:**
- `label` (obrigatório): `B`, `C` ou `D`

**Erros:**
- `400` — label ausente ou inválido (ex: `A` ou `original`)
- `400` — tentativa de deletar variante original (`is_original: true`)
- `404` — teste ou variante não encontrados
- `409` — teste não está em status `draft`

**Response 200:**
```json
{
  "data": { "deleted": true, "label": "B" }
}
```

---

## Competitor Observatory

O módulo Observatory monitora canais concorrentes: detecta mudanças em títulos/thumbnails/descrições, identifica outliers e gera insights agregados de timing, tags, gaps e fórmulas de título.

### GET /api/pipeline/youtube/competitors/channels

Lista todos os canais concorrentes monitorados.

**Auth:** read

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "channelId": "UC...",
      "channelName": "Competitor Channel",
      "thumbnailUrl": "https://...",
      "subscriberCount": 50000,
      "videoCount": 120,
      "addedAt": "2026-01-10T14:00:00Z",
      "lastSyncedAt": "2026-06-01T08:30:00Z",
      "avgEngagement": 0.042,
      "growthDelta": 1200,
      "growthSparkline": [48000, 48200, 48500, 49000, 50000],
      "recentVideos": [
        {
          "id": "uuid",
          "videoId": "dQw4w9WgXcQ",
          "title": "Video Title",
          "thumbnailUrl": "https://...",
          "viewCount": 15000,
          "likeCount": 800,
          "commentCount": 45,
          "publishedAt": "2026-05-28T10:00:00Z",
          "durationSeconds": 620,
          "viewDelta": 3000,
          "outlierMultiplier": 2.5,
          "outlierTier": "mid"
        }
      ],
      "vsYou": [
        {
          "channelName": "My Channel",
          "channelId": "uuid",
          "subsDelta": 38000,
          "engagementDelta": 0.012,
          "avgViewsDelta": 5000,
          "frequencyDelta": 1.2
        }
      ],
      "changeFlags": [
        { "type": "thumbnail", "count": 2, "latestAt": "2026-06-01T06:00:00Z" }
      ],
      "syncMode": "recent",
      "syncStatus": "idle",
      "syncProgress": 100,
      "syncError": null,
      "youtubeVideoCount": 350,
      "fullSyncCompletedAt": null,
      "videoLimit": 50
    }
  ]
}
```

**Notas:**
- `recentVideos` retorna os 3 mais recentes por default (drawer mostra todos)
- `vsYou` compara cada canal concorrente com cada canal próprio cadastrado
- `changeFlags` mostra badges de mudanças não vistas desde última visita
- `outlierTier`: `mid` = 2-5x mediana, `high` = 5-10x, `top` = >10x

---

### GET /api/pipeline/youtube/competitors/changes

Lista mudanças detectadas em vídeos de concorrentes (títulos, thumbnails, descrições).

**Auth:** read

**Query params:**
- `change_type` (opcional): `title`, `description`, `thumbnail` — filtro por tipo
- `channel_id` (opcional): UUID do canal concorrente — filtro por canal
- `bookmarked` (opcional): `true` — apenas mudanças salvas
- `limit` (opcional, default: 50, max: 100)

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "videoId": "dQw4w9WgXcQ",
      "videoTitle": "New Title After Change",
      "channelName": "Competitor Channel",
      "channelThumbnailUrl": "https://...",
      "changeType": "title",
      "oldTitle": "Original Title",
      "newTitle": "New Title After Change",
      "oldThumbnailUrl": null,
      "newThumbnailUrl": null,
      "viewCountAtChange": 12000,
      "detectedAt": "2026-05-30T14:22:00Z",
      "bookmarked": false,
      "history": []
    }
  ]
}
```

**Notas:**
- `history` contém o histórico completo de mudanças do vídeo (expandido via toggle)
- Mudanças de thumbnail incluem `oldThumbnailUrl` e `newThumbnailUrl`
- `viewCountAtChange` mostra views no momento da detecção (para avaliar timing da mudança)

---

### GET /api/pipeline/youtube/competitors/outliers

Lista vídeos outliers de canais concorrentes — vídeos com multiplicador de 2× ou mais em relação ao próprio canal. O cálculo é o mesmo do Observatório no CMS (uma única camada de cálculo): mesmo dia de vida quando há registro diário de views desde a publicação; senão, aproximação por faixa de idade (0–7, 8–30, 31–90, 91–365, mais de 365 dias). Base fraca (n < 3) não entra. Horários em São Paulo.

**Auth:** read

**Query params:**
- `tier` (opcional): `mid`, `high`, `top` (ou `B`, `A`, `S`) — filtro por nível de outlier
- `limit` (opcional, default: 25, max: 100)
- `fmt` (opcional): `long` (default) ou `short` — vídeos longos e Shorts nunca são comparados entre si

**Response 200:**
```json
{
  "data": {
    "outliers": [
      {
        "id": "uuid",
        "video_id": "dQw4w9WgXcQ",
        "title": "This Video Went Viral",
        "thumbnail_url": "https://...",
        "channel_name": "Competitor Channel",
        "view_count": 500000,
        "like_count": 25000,
        "comment_count": 1800,
        "duration_seconds": 900,
        "published_at": "2026-05-20T16:00:00.000Z",
        "multiplier": 8.5,
        "tier": "high",
        "method": "mesmo dia de vida",
        "n": 12,
        "label": "8,5× vs vídeos do canal no mesmo dia de vida (dia 14, n = 12)",
        "phase": "recente"
      }
    ],
    "count": 1
  }
}
```

**Notas:**
- `multiplier` indica quantas vezes acima do canal (ex: 8.5×); ordenado do maior para o menor
- `method`: `mesmo dia de vida` (views no mesmo dia de vida que os outros vídeos do canal) ou `aproximação por faixa` (views totais vs vídeos do canal da mesma faixa de idade)
- `n`: vídeos do canal na base de comparação; `label`: texto canônico do motor, com método e n
- `phase`: `estourando`, `recente`, `perene`, `antigo`, `novos` ou `sem-ritmo` (canal com sincronização atrasada, com erro ou ainda buscando vídeos)
- `count`: total de outliers depois do filtro de tier (antes do `limit`)
- Tiers visuais: `mid` = #60A5FA (2-5×), `high` = #A78BFA (5-10×), `top` = #D9614A (10× ou mais)
- Usado para identificar padrões de conteúdo viral entre concorrentes

---

### GET /api/pipeline/youtube/competitors/insights

Retorna insights agregados de todos os canais concorrentes monitorados.

**Auth:** read

**Response 200:**
```json
{
  "data": {
    "heatmap": [[0, 0, 0, 150, 200, ...], ...],
    "tags": [
      { "tag": "tutorial", "count": 45, "avgViews": 12000 }
    ],
    "engagement": [
      {
        "channelName": "Competitor A",
        "channelThumbnailUrl": "https://...",
        "engagementRate": 0.048,
        "isUs": false
      },
      {
        "channelName": "My Channel",
        "channelThumbnailUrl": "https://...",
        "engagementRate": 0.035,
        "isUs": true
      }
    ],
    "gaps": [
      {
        "topic": "react-server-components",
        "competitorCount": 3,
        "avgViews": 18000,
        "weCover": false,
        "channelNames": ["Channel A", "Channel B", "Channel C"]
      }
    ],
    "hitsHeatmap": [[0, 0, 0, 1, 2, ...], ...],
    "cadence": [
      {
        "channelName": "Competitor A",
        "channelId": "uuid",
        "color": "#60A5FA",
        "freq": 2.3,
        "window": "last 90 days",
        "videos": [
          { "title": "Video Title", "viewCount": 15000, "publishedAt": "2026-05-25T10:00:00Z" }
        ],
        "lastUploadDays": 5
      }
    ],
    "formulas": [
      {
        "label": "How to X in Y",
        "multiplier": 3.2,
        "hint": "Use specific numbers and timeframes",
        "count": 12,
        "exampleTitle": "How to Build a SaaS in 30 Days"
      }
    ],
    "play": {
      "topicBold": "React Server Components",
      "formulaBold": "How to X in Y",
      "formulaMult": 3.2,
      "windowBold": "Tuesday 18h",
      "windowReason": "Peak engagement window for tech content"
    },
    "ownTagsByChannel": [
      { "channelName": "My Channel", "tags": ["react", "nextjs", "typescript"] }
    ],
    "competitorTagsByChannel": [
      { "channelName": "Competitor A", "tags": ["react", "vue", "svelte"] }
    ]
  }
}
```

**Campos-chave:**
- `heatmap`: matriz 7x24 (dias seg→dom x horas, horário de São Paulo) com a contagem de vídeos longos publicados nos últimos 90 dias, em blocos de 2 h (as duas horas do bloco levam o mesmo valor); canais ainda buscando vídeos ficam de fora
- `hitsHeatmap`: matriz 7x24 (horário de São Paulo) com a contagem de outliers (mesmo cálculo de `/competitors/outliers`, todas as idades) por dia e hora de publicação
- `tags`: tags mais usadas por concorrentes, ordenadas por frequência
- `engagement`: comparação de engagement rate entre concorrentes e nosso canal (`isUs: true`)
- `gaps`: tópicos que concorrentes cobrem e nós não (`weCover: false`)
- `formulas`: padrões de título que performam acima da mediana (com `multiplier`)
- `play`: a jogada da semana — combinação tópico + fórmula + timing de maior impacto
- `cadence`: frequência de upload por concorrente (vídeos longos/semana nas últimas 13 semanas); `window` = hábito "Dia Hh" em São Paulo quando o canal costuma publicar no mesmo dia e hora (3+ vídeos e 30%+ deles), senão `—`

---

## Leituras do observatório (forja)

A forja (Gemma 12B local) lê pedidos do observatório de concorrentes feitos na tela ("Pedir leitura à forja"). Só a chave da forja (`intelligence`, API key) usa estes endpoints; o Cowork não. Fluxo de uma execução:

1. `POST .../intelligence/task/claim` com `task_types` → a task (`task_type`, `target_niche`, `target_video_id`, `target_fmt`), ou 204.
2. `GET .../competitors/readings?task_id=` → os dados enviados à forja (`sent`), congelados na primeira leitura.
3. Gerar o texto e validar contra `sent`; então **um** de: `POST .../competitors/readings` (publica), `fail` com `refuse: true` (recusa) ou `fail` com/sem `retry`.

**Regras:**
- **Um pedido = um tipo × um alvo** (um nicho, ou um vídeo em `leitura-video`); uma claim por ciclo. O orçamento acoplado da forja (20 min do claim ao último request < 25 min do cron < 30 min do vigia) cobre GET + modelo + POST — a rota tem `maxDuration` 60 s.
- **Cota:** 1 pedido por nicho + tipo por dia (dia de São Paulo). Falha e recusa não gastam a cota.
- **Recusa:** `fail` com `{"reason": "dado-velho", "refuse": true}` quando `sent.asOf` tem mais de 24 h (dado mais velho que a última sincronização). O código vai para `refused_reason`; a tela mostra "recusado às HH:MM" com a frase canônica do código. Códigos de recusa: `dado-velho` → "a máquina recebeu dados anteriores à última sincronização. Peça de novo." Um código desconhecido aparece literal na tela — use só os códigos desta lista.
- Todo número citado em `title`, `lead`, `items` e `evidence[].note` tem de estar em `sent.numbers` (forma canônica: `1,5 mil`, `8,2×`, `−41%`, `12 pp`, `3 h`, `2º`, `60s`, `1.230`); todo `evidence[].id` tem de estar em `sent.ids`.

### GET /api/pipeline/youtube/competitors/readings?task_id={uuid}

Os dados enviados à forja para uma task `running` desta chave. A primeira leitura monta o pacote e o congela em `task.sent`; as seguintes devolvem **o mesmo objeto** (idempotente).

O congelamento é **por task, não por tentativa**: quando a task volta para a fila (`fail` com `retry`, ou o vigia), o `sent` fica, e a próxima tentativa recebe os mesmos dados, na hora, sem montar de novo — a releitura cita os mesmos números. Só a primeira leitura bem-sucedida de uma task monta o pacote.

**Headers:** `X-Pipeline-Key: {api_key}` (escopo `intelligence`, só API key)

**Response 200:**
```json
{
  "data": {
    "task_id": "uuid",
    "task_type": "temas",
    "target": { "niche": "ia", "video_id": null, "fmt": "long" },
    "sent": {
      "text": "dados enviados à forja: …",
      "asOf": 1791043200000,
      "ids": ["uuid-do-video", "uuid-da-troca"],
      "numbers": ["3", "1,5 mil", "8,2×", "2º"],
      "nVideos": 3, "nOutliers": 1,
      "channels": ["uuid"], "channelsOut": [{ "id": "uuid", "reason": "…" }],
      "items": [{ "kind": "vídeo", "id": "uuid-do-video", "title": "…", "views": "1,5 mil", "mult": "8,2×" }],
      "capped": false
    }
  }
}
```
**Response 400:** `VALIDATION_ERROR` — `task_id` ausente ou não é uuid; a task não é do observatório
**Response 401:** `UNAUTHORIZED` — sem `X-Pipeline-Key` ou chave inválida
**Response 403:** `FORBIDDEN` — sessão (só API key) ou chave sem `intelligence` (nem `write`/`admin`)
**Response 404:** `NOT_FOUND` — task não existe
**Response 409:** `TASK_NOT_RUNNING` — a task não está `running`, ou pertence a outra chave (ou foi reclamada de novo enquanto o pacote era montado) — não insistir
**Response 422:** `TARGET_UNAVAILABLE` — o alvo não existe mais (o vídeo do `leitura-video` sumiu); nada é congelado — feche com `fail` sem `retry`
**Response 500:** `INTERNAL_ERROR` — falha ao carregar ou montar os dados (mensagem genérica; o detalhe vai para o Sentry); nada é congelado — feche com `fail` com `retry`

### POST /api/pipeline/youtube/competitors/readings

Publica a leitura da forja para uma task `running` desta chave cujo `sent` já foi congelado (GET acima). A leitura guarda uma cópia do `sent` congelado e a task vai para `completed`.

**Headers:** `X-Pipeline-Key: {api_key}` (escopo `intelligence`, só API key)

**Payload:**
```json
{
  "task_id": "uuid",
  "model": "Gemma 12B",
  "generated_at": "2026-10-03T15:00:00Z",
  "text": { "title": "…", "lead": "…", "items": ["…"] },
  "analysis": { "tipo": "temas", "tentativas": 1 },
  "evidence": [{ "id": "uuid-de-sent.ids", "note": "…" }]
}
```
`generated_at`: ISO com `Z` ou offset (`-03:00`). `analysis` aceita chaves extras; `linhas_lidas`/`linhas_enviadas` (inteiros) quando o prompt cortou as linhas.

**Response 200:** `{ "data": { "reading_id": "uuid" } }`
**Response 400:** `VALIDATION_ERROR` — corpo inválido; número fora de `sent.numbers` (a mensagem lista os números); `evidence[].id` fora de `sent.ids`
**Response 401:** `UNAUTHORIZED` — sem `X-Pipeline-Key` ou chave inválida
**Response 403:** `FORBIDDEN` — sessão (só API key) ou chave sem `intelligence` (nem `write`/`admin`)
**Response 404:** `NOT_FOUND` — task não existe
**Response 409:** `TASK_NOT_RUNNING` — a task não está `running` (já publicada, liberada pelo vigia) ou é de outra chave; `TASK_NOT_READY` — `sent` nunca foi lido (faça o GET antes). **Nunca reenviar** o mesmo POST
**Response 500:** `INTERNAL_ERROR` — o POST pode ou não ter gravado; feche com `fail` (`retry: true`) — um 409 nesse `fail` quer dizer que a leitura foi publicada

---

## Performance Analytics

Endpoints para análise de performance do canal próprio: health score, grades, demographics e search terms.

### GET /api/pipeline/youtube/analytics/overview

Retorna health score do canal com KPIs agregados.

**Auth:** read

**Query params:**
- `channel_id` (opcional): UUID interno do canal (default: primeiro canal do site)
- `days` (opcional, default: 28): período de análise (7, 28, 90)

**Response 200:**
```json
{
  "data": {
    "health": {
      "overall": 53,
      "axes": [
        { "axis": "reach", "score": 52, "grade": "C" },
        { "axis": "engagement", "score": 56, "grade": "C" }
      ],
      "unavailableAxes": [
        { "axis": "ctr", "reason": "no ctr: YouTube Analytics API v2 does not expose impressionClickThroughRate, ..." },
        { "axis": "retention", "reason": "no avg_view_percentage: ..." }
      ]
    },
    "kpis": { "views": 32, "watchTime": 410, "subscribers": 3, "avgCtr": null, "avgRetention": null },
    "baseline": { "medianCtr": null, "medianRetention": null }
  }
}
```

**Notas:**
- **Ausência é `null`, nunca `0`.** `avgCtr`/`avgRetention`/`medianCtr`/`medianRetention` = `null` quando nenhum vídeo tem o dado (hoje: sempre — a YouTube Analytics API v2 não expõe CTR/impressões e o sync não coleta `averageViewPercentage`). Não diga "CTR 0%" nem "retenção baixa": diga "não medido".
- `health.axes` traz só eixos medidos. Eixo em `health.unavailableAxes` NÃO é nota baixa — não crie priority/diagnóstico para ele.
- `health.overall` é a média ponderada renormalizada sobre os eixos medidos (0-100)
- Grades individuais: A >= 85, B >= 65, C >= 40, D < 40
---

### GET /api/pipeline/youtube/analytics/grades

Lista grades de performance por vídeo (scoring de 6 eixos).

**Auth:** read

**Query params:**
- `channel_id` (opcional): UUID interno do canal
- `limit` (opcional, default: 20, max: 50)

**Response 200:**
```json
{
  "data": [
    {
      "videoId": "uuid",
      "title": "Video Title",
      "thumbnailUrl": "https://...",
      "publishedAt": "2026-05-15T10:00:00Z",
      "views7d": 8500,
      "ctr": 4.8,
      "avgPercentage": 48.5,
      "score": 72.3,
      "grade": "B"
    }
  ]
}
```

**Notas:**
- `ctr` e `retention` por vídeo vêm `null` quando não medidos (hoje, todos) — `null` é ausência, não zero
- Grade por vídeo: A >= 85, B >= 65, C >= 40, D < 40
- `views7d` = views nos primeiros 7 dias (métrica de lançamento)
- Vídeos com menos de 3 no canal não geram grades (dados insuficientes)
- O score usa o algoritmo de 6 eixos documentado na seção "Algoritmo de Scoring"

---

### GET /api/pipeline/youtube/analytics/demographics

Retorna dados demográficos da audiência: idade/gênero, países e dispositivos.

**Auth:** read

**Query params:**
- `channel_id` (opcional): UUID interno do canal
- `days` (opcional, default: 28)

**Response 200:**
```json
{
  "data": {
    "ageGender": [
      { "ageGroup": "18-24", "male": 15.2, "female": 8.1 },
      { "ageGroup": "25-34", "male": 28.5, "female": 12.3 },
      { "ageGroup": "35-44", "male": 14.2, "female": 6.8 }
    ],
    "countries": [
      { "country": "BR", "views": 85000, "percentage": 68.0 },
      { "country": "PT", "views": 12000, "percentage": 9.6 },
      { "country": "US", "views": 8000, "percentage": 6.4 }
    ],
    "devices": [
      { "deviceType": "MOBILE", "views": 75000, "percentage": 60.0 },
      { "deviceType": "DESKTOP", "views": 35000, "percentage": 28.0 },
      { "deviceType": "TV", "views": 15000, "percentage": 12.0 }
    ]
  }
}
```

**Notas:**
- Requer scope `yt-analytics.readonly` na OAuth — retorna `error: "scope"` se não autorizado
- Valores de gênero são percentuais do total de views
- Dados cacheados por 5 minutos

---

### GET /api/pipeline/youtube/analytics/search-terms

Lista termos de busca que levam ao canal, ordenados por views.

**Auth:** read

**Query params:**
- `channel_id` (opcional): UUID interno do canal
- `days` (opcional, default: 28)
- `limit` (opcional, default: 50)

**Response 200:**
```json
{
  "data": [
    {
      "term": "como usar nextjs 15",
      "views": 3200,
      "estimatedMinutesWatched": 2100
    },
    {
      "term": "react server components tutorial",
      "views": 1800,
      "estimatedMinutesWatched": 1500
    }
  ]
}
```

**Notas:**
- Requer scope `yt-analytics.readonly` — retorna `error: "scope"` se não autorizado
- Útil para identificar oportunidades de SEO e novos tópicos de conteúdo
- `estimatedMinutesWatched` indica profundidade de engajamento por termo

---

### GET+POST /api/pipeline/youtube/analytics/notes

CRUD de notas de análise associadas a um canal.

**GET — Listar notas:**

**Auth:** read

**Query params:**
- `channel_id` (obrigatório): UUID interno do canal

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "channelId": "uuid",
      "text": "CTR caiu 15% após mudança de thumbnail padrão. Reverter?",
      "createdAt": "2026-06-01T10:00:00Z"
    }
  ]
}
```

**POST — Criar nota:**

**Auth:** write

**Body:**
```json
{
  "channel_id": "uuid",
  "text": "Testar formato listicle nos próximos 3 vídeos."
}
```

**Response 201:**
```json
{
  "data": { "id": "uuid", "ok": true }
}
```

**DELETE — Deletar nota:**

**Auth:** write

**Query params:**
- `note_id` (obrigatório): UUID da nota

**Response 200:**
```json
{
  "data": { "deleted": true }
}
```

---

## Video Data

Endpoints para consulta e gestão de vídeos do canal e suas categorias.

### GET /api/pipeline/youtube/videos

Lista vídeos do canal com métricas.

**Auth:** read

**Query params:**
- `channel_id` (opcional): UUID interno do canal
- `category_id` (opcional): filtro por categoria
- `sort` (opcional, default: `published_at`): `published_at`, `view_count`, `ctr`
- `order` (opcional, default: `desc`): `asc`, `desc`
- `limit` (opcional, default: 20, max: 100)
- `cursor` (opcional): cursor de paginação

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "youtubeVideoId": "dQw4w9WgXcQ",
      "title": "Video Title",
      "thumbnailUrl": "https://...",
      "publishedAt": "2026-05-15T10:00:00Z",
      "viewCount": 45000,
      "likeCount": 2200,
      "commentCount": 180,
      "ctr": 4.8,
      "avgViewPercentage": 42.5,
      "impressions": 120000,
      "durationSeconds": 620,
      "categoryId": "uuid",
      "categoryName": "Tutorials"
    }
  ],
  "cursor": "next_cursor_token"
}
```

---

### GET /api/pipeline/youtube/videos/{id}

Retorna detalhes completos de um vídeo, incluindo métricas históricas e grades.

**Auth:** read

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "youtubeVideoId": "dQw4w9WgXcQ",
    "title": "Video Title",
    "thumbnailUrl": "https://...",
    "publishedAt": "2026-05-15T10:00:00Z",
    "viewCount": 45000,
    "likeCount": 2200,
    "commentCount": 180,
    "ctr": 4.8,
    "avgViewPercentage": 42.5,
    "impressions": 120000,
    "durationSeconds": 620,
    "retentionCurve": [100, 95, 88, 72, 60, 48, 35, 28],
    "trafficSources": {
      "browse": 35,
      "search": 25,
      "suggested": 20,
      "external": 12,
      "direct": 5,
      "notifications": 3
    },
    "gradeHistory": [
      { "weekIso": "2026-W21", "grade": "B", "score": 72.3 },
      { "weekIso": "2026-W20", "grade": "C", "score": 55.1 }
    ],
    "categoryId": "uuid",
    "categoryName": "Tutorials"
  }
}
```

**Notas:**
- A resposta real traz `axes` (só eixos medidos: `axis`, `score`, `grade`, `channelMedian`) e `unavailableAxes` (`axis` + `reason`) — eixo não medido nunca aparece com score 0.

---

### GET+PATCH /api/pipeline/youtube/categories

Gestão de categorias de vídeo (auto-categorizadas e manuais).

**GET — Listar categorias:**

**Auth:** read

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Tutorials",
      "slug": "tutorials",
      "color": "#60A5FA",
      "videoCount": 15
    }
  ]
}
```

**PATCH — Atualizar categoria:**

**Auth:** write

**Body:**
```json
{
  "id": "uuid",
  "name": "Advanced Tutorials",
  "color": "#A78BFA"
}
```

**Response 200:**
```json
{
  "data": { "id": "uuid", "ok": true }
}
```

---

## AB Lab Extended

Endpoints estendidos para A/B tests: learnings, suggestions, fatigue alerts, dashboard stats e test history.

### GET /api/pipeline/youtube/ab-tests/learnings

Agrega padrões de aprendizado de testes A/B concluídos: taxa de vitória por tag e insights do canal.

**Auth:** read

**Response 200:**
```json
{
  "data": {
    "tagWinRates": [
      {
        "tag": "close-up",
        "wins": 5,
        "total": 8,
        "avgLift": 12.5,
        "kind": "thumb"
      },
      {
        "tag": "numbers-in-title",
        "wins": 3,
        "total": 6,
        "avgLift": 8.2,
        "kind": "title"
      }
    ],
    "channelInsights": [
      {
        "text": "Padrões que funcionam: \"close-up\" (5x), \"bold-text\" (3x)",
        "type": "positive"
      },
      {
        "text": "Evitar: \"text-heavy\" (15% queda)",
        "type": "negative"
      }
    ],
    "totalCompletedTests": 12
  }
}
```

**Notas:**
- `tagWinRates.kind`: `thumb` = thumbnail tags, `title` = title patterns, `desc` = description patterns
- `avgLift` é a média de CTR lift (%) dos testes vencidos com essa tag
- `channelInsights` são gerados automaticamente dos top padrões positivos/negativos

---

### GET /api/pipeline/youtube/ab-tests/suggestions

Lista vídeos sugeridos para testes A/B baseado em sinais de underperformance.

**Auth:** read

**Response 200:**
```json
{
  "data": {
    "suggestions": [
      {
        "videoId": "uuid",
        "youtubeVideoId": "dQw4w9WgXcQ",
        "title": "Video with Low CTR",
        "grade": "D",
        "ctr": 1.8,
        "suggestedTestType": "thumbnail",
        "reason": "55% abaixo da média do canal"
      },
      {
        "videoId": "uuid",
        "youtubeVideoId": "abc123",
        "title": "High Reach No Test",
        "grade": "C",
        "ctr": 0,
        "suggestedTestType": "thumbnail",
        "reason": "Alto alcance sem teste (125.000 views)"
      }
    ]
  }
}
```

**Notas:**
- Retorna máximo 5 sugestões, ordenadas por impacto potencial
- Exclui vídeos testados nos últimos 60 dias
- Requisitos mínimos: >= 1.000 views, publicado há > 14 dias
- `reason` explica o motivo da sugestão em PT-BR

---

### GET /api/pipeline/youtube/ab-tests/fatigue-alerts

Lista alertas de fadiga de thumbnail para vídeos com CTR em declínio.

**Auth:** read

**Response 200:**
```json
{
  "data": {
    "alerts": [
      {
        "id": "uuid",
        "videoId": "uuid",
        "title": "Video Losing CTR",
        "zScore": -2.8,
        "expectedCtr": 4.5,
        "actualCtr": 2.1,
        "createdAt": "2026-06-01T08:00:00Z"
      }
    ]
  }
}
```

**Notas:**
- `zScore` negativo indica queda abaixo do esperado (threshold: z < -2.0)
- `expectedCtr` vs `actualCtr` mostra a magnitude da degradação
- Apenas alertas com status `pending` são retornados (máximo 20)
- Ação recomendada: criar A/B test de thumbnail para o vídeo afetado

---

### GET /api/pipeline/youtube/ab-tests/dashboard

Retorna estatísticas agregadas do programa de A/B testing.

**Auth:** read

**Response 200:**
```json
{
  "data": {
    "activeTests": 3,
    "avgConfidence": 87.5,
    "winRate": 65.0,
    "avgLift": 12.3,
    "testsByStatus": {
      "draft": 2,
      "active": 3,
      "paused": 1,
      "completed": 15
    }
  }
}
```

**Notas:**
- `avgConfidence`: confiança média (%) dos testes concluídos
- `winRate`: percentual de testes root (excluindo playoffs) que declararam vencedor
- `avgLift`: lift médio de CTR (%) dos testes com vencedor
- Testes com `parent_test_id` (playoff children) são excluídos de `winRate` e `avgLift`

---

### GET /api/pipeline/youtube/ab-tests/{id}/history

Retorna histórico completo de testes A/B para um vídeo específico.

**Auth:** read

**Params:**
- `id`: `youtube_video_id` (UUID interno do vídeo na tabela `youtube_videos`)

**Response 200:**
```json
{
  "data": {
    "videoId": "uuid",
    "tests": [
      {
        "id": "uuid",
        "type": "thumbnail",
        "status": "completed",
        "winner": "B",
        "liftPercent": 15.2,
        "startedAt": "2026-04-01T10:00:00Z",
        "endedAt": "2026-04-15T10:00:00Z"
      },
      {
        "id": "uuid",
        "type": "title",
        "status": "active",
        "winner": null,
        "liftPercent": null,
        "startedAt": "2026-05-20T10:00:00Z",
        "endedAt": null
      }
    ]
  }
}
```

**Notas:**
- `winner` é o label da variante vencedora (ou `null` se teste ainda ativo/sem vencedor)
- `liftPercent` é o CTR lift do vencedor vs original
- Ordenado por `created_at` descendente (mais recente primeiro)

---

## Thumbnail Library

Endpoints para a biblioteca de thumbnails e análise de fadiga.

### GET /api/pipeline/youtube/thumbnails/library

Lista thumbnails na biblioteca — incluindo vencedoras de A/B tests importadas automaticamente.

**Auth:** read

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "sourceTestId": "uuid",
      "sourceVariantId": "uuid",
      "sourceType": "test_winner",
      "blobUrl": "https://...",
      "title": "B — Thumbnail Test Video X",
      "videoTitle": "Video X Title",
      "youtubeVideoId": "uuid",
      "liftAtWin": 15.2,
      "createdAt": "2026-05-15T10:00:00Z"
    }
  ]
}
```

**Notas:**
- `sourceType: "test_winner"` indica thumbnail importada de A/B test concluído
- `liftAtWin` é o CTR lift (%) no momento da vitória
- Import automático via `autoImportWinner()` quando teste é completado com vencedor
- Thumbnails sem `sourceTestId` são uploads manuais

---

### GET /api/pipeline/youtube/thumbnails/fatigue

Retorna tendências de fadiga de thumbnails — análise de declínio de CTR ao longo do tempo.

**Auth:** read

**Query params:**
- `channel_id` (opcional): UUID interno do canal
- `days` (opcional, default: 90): janela de análise

**Response 200:**
```json
{
  "data": {
    "trends": [
      {
        "videoId": "uuid",
        "title": "Video Title",
        "thumbnailUrl": "https://...",
        "ctrTimeline": [
          { "date": "2026-03-01", "ctr": 5.2 },
          { "date": "2026-04-01", "ctr": 4.1 },
          { "date": "2026-05-01", "ctr": 2.8 }
        ],
        "decline": -46.2,
        "severity": "high"
      }
    ]
  }
}
```

**Notas:**
- `decline` é a queda percentual do primeiro ao último ponto da timeline
- `severity`: `low` (< 20% queda), `medium` (20-40%), `high` (> 40%)
- Recomendação: vídeos com `severity: "high"` devem entrar no pipeline de A/B testing

---

## Workflows de Referência

### 1. Health Coach Analysis

Workflow completo de análise e coaching de canal via Intelligence Engine:

```
1. POST  /api/pipeline/youtube/intelligence/task/claim     → claim_task ({channel_ids}, CAS para running)
2. GET   /api/pipeline/youtube/intelligence                → get_intelligence (snapshot completo do canal)
3. [Cowork analisa: scoring, outliers, trends]
4. PATCH /api/pipeline/youtube/intelligence                → submit_intelligence (recommendations + coaching + notifications)
   - Não deu para terminar? POST /api/pipeline/youtube/intelligence/task/{id}/fail ({reason, retry}) — nunca deixe a task presa em `running`
```

**Via MCP:**
1. `manage_ab_test` action: `claim_task` (requer chave `write` sobre MCP)
2. `manage_ab_test` action: `get_intelligence` com `channel_id`
3. Cowork processa os dados
4. `manage_ab_test` action: `submit_intelligence` com `intel_payload` — `task_id` obrigatório; `source` da linha vem da chave, não do payload
   - Não deu para terminar, ou `submit_intelligence` voltou 409/500? **O MCP não tem ação `fail`.** Feche via REST, `POST /api/pipeline/youtube/intelligence/task/{id}/fail` ({reason, retry}), ou espere o watchdog (30–60min) — nunca reenvie o `submit_intelligence`.

### 2. Competitor Monitoring

Workflow de monitoramento competitivo e geração de insights:

```
1. GET  /api/pipeline/youtube/competitors/channels   → listar canais monitorados
2. GET  /api/pipeline/youtube/competitors/changes     → detectar mudanças recentes
3. GET  /api/pipeline/youtube/competitors/outliers    → identificar vídeos virais
4. GET  /api/pipeline/youtube/competitors/insights    → insights agregados (heatmap, gaps, formulas, play-of-the-week)
5. POST /api/pipeline/items                           → criar pipeline item com insight acionável
```

**Exemplo de uso:** Identificar que concorrentes estão cobrindo "React 19" (`gaps.weCover: false`), com fórmula "How to X in Y" (`formulas.multiplier: 3.2x`), melhor timing terça 18h (`play.windowBold`), e criar item no pipeline com esses dados.

### 3. Video Optimization

Workflow de otimização de vídeos existentes via analytics e A/B testing:

```
1. GET  /api/pipeline/youtube/analytics/overview      → health score + identificar eixos fracos
2. GET  /api/pipeline/youtube/analytics/grades        → listar vídeos por grade (focar em C/D)
3. GET  /api/pipeline/youtube/ab-tests/suggestions    → vídeos candidatos a teste
4. GET  /api/pipeline/youtube/ab-tests/learnings      → padrões que funcionam/evitar
5. [Criar A/B test via CMS wizard]
6. GET  /api/pipeline/youtube/ab-tests/dashboard      → acompanhar programa de testes
7. GET  /api/pipeline/youtube/ab-tests/{id}/history   → histórico de testes do vídeo
```

**Via MCP:**
1. `manage_ab_test` action: `get_intelligence` → overview
2. `manage_ab_test` action: `list_tests` → status dos testes
3. `manage_ab_test` action: `upsert_variants` → criar variantes
4. `manage_ab_test` action: `submit_intelligence` → submeter recomendações
