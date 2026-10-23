# YouTube Intelligence — Referência Pipeline Cowork

> **Skill:** Performance Reviewer  
> **Trigger:** Análise de performance de canal YouTube, recomendações de otimização  
> **Auth:** `X-Pipeline-Key` header

## Visão Geral

O módulo Intelligence Engine analisa performance de canais YouTube e gera:
- Diagnósticos por vídeo (fraquezas, oportunidades)
- Coaching cards (recomendações priorizadas por eixo)
- Notificações acionáveis (grade drops, CTR drops)
- Sugestões de A/B tests (thumb, title, combo)

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
  "action_type": "thumbnail_test | title_test | combo_test | retention_fix | seo_optimization | engagement_boost | distribution_expand | content_series | publish_timing | community_post | end_screen_optimize",
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
- `description_test` saiu: 400 com "a descrição não participa mais do teste A/B"

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
| optimization_resolved | 1 | Ciclo encerrado com sucesso |

`trending_viral` foi desligado em 10/2026 e é recusado com 400; o PATCH inteiro é recusado: tire o aviso e reenvie o corpo inteiro.

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
Num pedido do observatório, `channel_id` é `null` e o alvo vem em `task_type` + `target_niche` (o slug do nicho; os de fábrica são `ia` e `viagem`) ou `target_video_id` (`leitura-video`), com `target_fmt` (`long`/`short`) nos tipos de outliers. Ver "Leituras do observatório (forja)".

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

`refuse: true` (só pedidos do observatório): a forja **recusa** a task — status `refused`, `reason` vira o código da recusa (≤200 chars, ex.: `dado-velho`). A recusa não impede um novo pedido. `refuse` e `retry` juntos são 400.
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

Batch upsert variants (B, C, D) para um teste em status `draft`. Corpo: `{ "variants": [...] }` ou o vetor. Usa `ON CONFLICT (test_id, label)` — idempotente.

**Auth:** write

**Body:**
```json
{
  "variants": [
    {
      "label": "B",
      "title_text": "Título alternativo B",
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
- `description_text`: só `null` ou ausente. Texto (inclusive vazio) devolve **422** `DESCRICAO_FORA_DO_TESTE`, "A descrição não participa mais do teste A/B". Teste gravado como `description` também devolve 422.
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
      "metadata": {},
      "sort_order": 0
    },
    {
      "id": "uuid",
      "test_id": "uuid",
      "label": "B",
      "is_original": false,
      "title_text": "Título alternativo B",
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

## Canais próprios

### GET /api/pipeline/youtube/channels

Lista os canais próprios do site, na ordem de cadastro. É por aqui que se descobre quais canais existem — e o `id` (uuid) que os demais endpoints pedem em `channel_id`.

Aceita `read` **ou** `intelligence` (`write`/`admin` incluem os dois).

**Headers:** `X-Pipeline-Key: {api_key}`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "channel_id": "UC...",
      "slug": "tnfigueiredotv",
      "name": "tnFigueiredo",
      "handle": "@tnfigueiredotv",
      "locale": "pt",
      "niche": "viagem",
      "niche_label": "Viagem",
      "subscriber_count": 1160,
      "video_count": 42,
      "sync_enabled": true,
      "last_synced_at": "2026-10-03T12:00:00Z"
    }
  ]
}
```

- `slug` — identificador estável do canal no site (vem do handle); `null` só em canal ainda sem slug.
- `niche` / `niche_label` — slug e nome do nicho do canal; os dois `null` em canal sem nicho.
- `video_count` — contagem do YouTube, não o número de vídeos já sincronizados no site.
- `data: []` quando o site não tem canal cadastrado.
- Nenhum campo de OAuth sai nesta rota. Um canal pode existir sem conexão OAuth: nele, analytics e A/B não funcionam até o dono conectar.

**Response 401/403:** como as demais rotas. **500** `INTERNAL_ERROR` em erro de leitura.

**No snapshot (`GET .../intelligence?channel_id=`):** o objeto `channel` traz também `slug`, `locale`, `niche` e `niche_label` (os mesmos desta rota; `slug`, `niche` e `niche_label` podem ser `null`), e `grade_history`, `optimization_cycles` e `ab_tests` trazem **só** o que é do canal pedido.

---

## Competitor Observatory

O módulo Observatory monitora canais concorrentes: detecta mudanças em títulos/thumbnails/descrições, identifica outliers e gera insights agregados de timing, tags, gaps e fórmulas de título.

### GET /api/pipeline/youtube/competitors/channels

Lista os canais concorrentes monitorados do site, com os números de hoje, o perfil lido do YouTube (handle, país e data de criação) e as nove medidas calculadas de cada canal. As chaves são snake_case e `data` é um objeto com `channels`, `count`, `medidas_indisponiveis` e `medidas_meta`, não uma lista.

**Auth:** read

**Response 200** (canal com o perfil já lido e as medidas; valores inventados):
```json
{
  "data": {
    "channels": [
      {
        "id": "uuid",
        "channel_id": "UC...",
        "channel_name": "Competitor Channel",
        "thumbnail_url": "https://...",
        "subscriber_count": 50000,
        "video_count": 50,
        "last_synced_at": "2026-06-01T08:30:00Z",
        "added_at": "2026-01-10T14:00:00Z",
        "avg_engagement": 0.042,
        "perfil": {
          "estado": "lido",
          "lido_em": "2026-06-01T08:30:00Z",
          "handle": "@competitor",
          "pais": "BR",
          "criado_em": "2019-03-02T00:00:00Z"
        },
        "medidas": {
          "direcao_do_canal": {
            "estado": "medido",
            "valor": {
              "variacao": 0.3,
              "direcao": "subindo",
              "ganhoRecente": 130000,
              "ganhoAnterior": 100000
            },
            "n": 3,
            "janela": {
              "de": "2026-06-05",
              "ate": "2026-07-31",
              "dias": 56
            }
          },
          "estado_do_canal": {
            "situacao": "ativo",
            "confirmada": true,
            "parado": {
              "estado": "medido",
              "valor": {
                "dias": 8,
                "limite": 28,
                "ultimaEm": 1785000000000
              },
              "n": 1,
              "janela": {
                "de": null,
                "ate": null,
                "dias": 8
              }
            },
            "queda": {
              "estado": "medido",
              "valor": {
                "janelas": [
                  0.3,
                  0.25,
                  0.33
                ]
              },
              "n": 6,
              "janela": {
                "de": "2026-04-10",
                "ate": "2026-07-31",
                "dias": 112
              }
            }
          },
          "por_formato": {
            "long": {
              "direcao_dos_videos_novos": {
                "estado": "medido",
                "valor": {
                  "variacao": 0.12,
                  "direcao": "subindo",
                  "medianaRecente": 14500,
                  "medianaAnterior": 12900
                },
                "n": 18,
                "janela": {
                  "de": "2026-02-02",
                  "ate": "2026-08-01",
                  "dias": 180
                }
              },
              "ritmo": {
                "estado": "medido",
                "valor": {
                  "porSemana": 0.85,
                  "intervaloMedianoDias": 7.5,
                  "semanasComPublicacao": 10,
                  "semanas": 13,
                  "semanasContadas": 13,
                  "dias": 91,
                  "maiorBuracoDias": 16
                },
                "n": 11,
                "janela": {
                  "de": "2026-05-03",
                  "ate": "2026-08-01",
                  "dias": 91
                }
              },
              "taxa_de_acerto": {
                "estado": "medido",
                "valor": {
                  "acertos": 3,
                  "fracassos": 2,
                  "total": 8,
                  "pctAcerto": null,
                  "pctFracasso": null
                },
                "n": 8,
                "janela": {
                  "de": null,
                  "ate": null,
                  "dias": 90
                }
              }
            },
            "short": {
              "direcao_dos_videos_novos": {
                "estado": "nao_medido",
                "motivo": "nao_se_aplica",
                "frase": "esta medida é só dos vídeos longos: o Short não tem direção dos vídeos novos"
              },
              "ritmo": {
                "estado": "nao_medido",
                "motivo": "poucas_publicacoes",
                "frase": "há 1 publicação na janela e a medida pede 4",
                "n": 1,
                "minimo": 4
              },
              "taxa_de_acerto": {
                "estado": "nao_medido",
                "motivo": "poucos_videos",
                "frase": "há 1 vídeo na janela e a medida pede 3",
                "n": 1,
                "minimo": 3
              }
            }
          }
        }
      }
    ],
    "count": 1,
    "medidas_indisponiveis": {
      "total": 8,
      "indisponiveis": 2,
      "por_motivo": {
        "poucos_videos": 1,
        "poucas_publicacoes": 1
      }
    },
    "medidas_meta": {
      "calculado_em": "2026-08-01T15:00:00.000Z",
      "regra": 1,
      "duracao_ms": 1840,
      "canais_cortados_por_tempo": 0
    }
  }
}
```

**`perfil` de um canal ainda não lido** (a mesma posição, sem os três campos do perfil):
```json
{
  "estado": "nao_lido",
  "motivo": "canal_ainda_nao_relido",
  "frase": "o histórico do perfil deste canal ainda não tem a primeira leitura de handle e país"
}
```

**Notas:**
- `video_count` é quantos vídeos entraram na conta de engajamento (no máximo 50), e não o total de vídeos do canal. `video_count: 0` e `avg_engagement: null` podem ser falha da leitura dos vídeos daquele canal, não um canal sem vídeo; `avg_engagement` soma curtidas e comentários ocultos como zero.
- `avg_engagement` e `subscriber_count` podem ser `null` (o canal oculta o contador, ou o YouTube não devolveu): trate como "sem contagem".
- Dentro de `perfil` com `estado: "lido"`, `null` em `handle` ou `pais` quer dizer que o YouTube não informou. `lido_em` é a última leitura boa do canal e pode ser posterior à leitura do perfil. `criado_em` nulo quer dizer "não informado, ou ainda não gravado".
- `perfil` com `estado: "nao_lido"` não traz `handle`, `pais` nem `criado_em`, e traz `frase`: cite a frase e não estime o valor. Os outros motivos possíveis são `tabela_ausente`, `erro_do_banco` e `cortado`.
- Em `taxa_de_acerto` medida, `pctAcerto` e `pctFracasso` vêm `null` quando o canal tem poucos vídeos na conta (`total` abaixo do mínimo que o código usa para dar percentual): use `acertos`, `fracassos` e `total` em contagem e não calcule o percentual por conta própria.
- O recurso MCP `pipeline://youtube/competitors/channels` lê a tabela direto e não traz `perfil`; os números do perfil vêm desta rota e da ferramenta `youtube_observatory` (ação `list_channels`). O recurso MCP `pipeline://youtube/competitors/outliers` devolve **mudanças marcadas**, não vídeos fora da curva; para os vídeos, use a rota `outliers` ou a ação `get_outliers` da ferramenta.
- A lista traz só concorrentes; o seu canal não está nela.

#### Medidas por canal (`medidas`)

Cada canal traz `medidas` com as mesmas nove medidas, sempre: `direcao_do_canal`; `estado_do_canal` (com `parado` e `queda`); e, para `long` e `short` dentro de `por_formato`, `direcao_dos_videos_novos`, `ritmo` e `taxa_de_acerto`. Nenhuma é omitida: o que não foi medido vem como `nao_medido`.

**Ritmo (`ritmo`) e a base do período:**
- `semanas` é inteiro (o número de casas semanais da base, arredondado para cima); `semanasContadas` é a base real em semanas, fracionada (é ela que divide as publicações em `porSemana`); `dias` é a base em dias. Sem corte, a base é a janela cheia da regra.
- A base encolhe quando o canal é mais novo que a janela ou quando a coleta guardou menos que isso. Nesses casos `medidas.ritmo.notas` traz `canal_mais_novo_que_a_janela` (base desde a criação do canal) ou `cobertura_curta` (a coleta guardada só cobre os últimos dias da lista cortada); as duas trazem `dias` e `desde` (data de São Paulo, `AAAA-MM-DD`, de onde a base começa). Cite a base ("média desde 2026-09-20") e não diga que são as semanas da janela cheia.
- Base abaixo do piso de dias da regra não gera taxa: o ritmo vem `nao_medido` com `motivo: "canal_novo"` (a base foi cortada pela criação do canal) ou `motivo: "ritmo_parcial"` (cortada pela cobertura da coleta). Com a base no piso ou acima, a taxa volta, junto com a nota.

**Como ler uma medida:**
- `estado: "medido"` traz `valor`, `n` (quantos itens entraram na conta), `janela` (datas de São Paulo) e, quando houver, `notas`.
- `estado: "nao_medido"` traz `motivo` e `frase`: cite a frase e não estime o valor. Nunca escreva zero no lugar de uma medida que não foi feita.
- Os números saem como a conta os fez, sem arredondar; arredonde só ao escrever para quem lê.
- Longos e Shorts nunca se misturam: `por_formato.long` e `por_formato.short` são contas separadas. O Short não tem `direcao_dos_videos_novos`: a chave sai sempre `nao_medido` com motivo `nao_se_aplica`, que não conta em `medidas_indisponiveis` (`total` = 8 por canal).
- `estado_do_canal.situacao` é `fora_do_ar`, `pausado`, `parado`, `em_queda`, `ativo` ou `nao_determinada` (quando alguma leitura do canal falhou, o canal foi cortado pelo prazo do pedido (veja `canais_cortados_por_tempo`) ou a leitura dos retratos falhou).
- Quando `confirmada` é `false`, não diga que o canal está ativo: diga que não foi possível medir a queda e cite a `frase` de `queda`.
- `medidas_indisponiveis` conta quantas das medidas vieram `nao_medido`, por `motivo`; `leitura_falhou` ou `calculo_falhou` maior que zero é defeito do lado do servidor, não do canal.
- `medidas_meta.calculado_em` é o carimbo do cálculo, em UTC; `regra` é a versão das regras de medida.

**Como comparar:** compare só medidas do mesmo formato e do mesmo `calculado_em` (ou diga de que momento cada número é). Duas chamadas em horas diferentes podem dar números diferentes sem que o canal tenha mudado.

**Tempo:** a rota tem um prazo por pedido. Se `canais_cortados_por_tempo` for maior que zero, repita a chamada uma vez; se continuar maior que zero, não repita de novo: relate quais canais ficaram sem medida.

**Ferramenta:** a ferramenta `youtube_observatory`, ação `list_channels`, devolve o mesmo conteúdo desta rota, sem indentação no texto.

---

### GET /api/pipeline/youtube/competitors/changes

Lista as trocas de título, thumbnail e descrição detectadas em vídeos de concorrentes. Com `campos=todos`, acrescenta as mudanças de campo (tags, categoria, duração, idioma, nome do canal e outras).

**Auth:** read

**Query params:**
- `type` (opcional): `title`, `description`, `thumbnail` ou `all` — filtro por tipo de troca
- `bookmarked` (opcional): `true` ou `false` — apenas trocas salvas (ou apenas as não salvas)
- `limit` (opcional, máximo 100): padrão 25 pela rota HTTP e 50 pela ferramenta `youtube_observatory`
- `campos` (opcional): só `todos`; vazio (`?campos=`) é tratado como ausente, e qualquer outro valor responde 400 `VALIDATION_ERROR`

Não há filtro por canal. `type` e `bookmarked` não filtram as mudanças de campo; `limit` vale para as duas listas, cada uma com o seu corte.

**Response 200** (sem `campos`):
```json
{
  "data": {
    "changes": [
      {
        "id": "uuid",
        "video_id": "dQw4w9WgXcQ",
        "video_title": "New Title After Change",
        "channel_name": "Competitor Channel",
        "change_type": "title",
        "old_title": "Original Title",
        "new_title": "New Title After Change",
        "old_thumbnail_url": null,
        "new_thumbnail_url": null,
        "view_count_at_change": 12000,
        "detected_at": "2026-05-30T14:22:00Z",
        "bookmarked": false
      }
    ],
    "count": 1
  }
}
```

**Response 200 com `campos=todos`** (`changes` e `count` são os mesmos; entra `mudancas_de_campo`):
```json
{
  "data": {
    "changes": [],
    "count": 0,
    "mudancas_de_campo": {
      "estado": "lido",
      "itens": [
        {
          "id": 4821,
          "alvo": "video",
          "channel_name": "Competitor Channel",
          "video_id": "dQw4w9WgXcQ",
          "video_title": "Video Title",
          "campo": "tags",
          "valor_novo": ["react", "nextjs"],
          "valor_anterior": { "estado": "lido", "valor": ["react"] },
          "visto_em": "2026-06-01 08:30:00.123+00",
          "janela_desde": "2026-05-31 08:30:00+00",
          "precisao": "1d"
        }
      ],
      "count": 1,
      "limite": 25,
      "cortado": false,
      "coleta_desde": "2026-06-01 08:30:00+00",
      "lido_ate": {
        "mais_antigo": "2026-06-01 08:00:00+00",
        "mais_recente": "2026-06-01 08:30:00+00",
        "canais_sem_leitura": 0,
        "videos_mais_antigo": "2026-05-25 08:00:00+00",
        "videos_mais_recente": "2026-06-01 08:30:00+00"
      },
      "fora_da_lista": 0,
      "video_de_outro_site": 0,
      "video_ausente": 0
    }
  }
}
```

**`mudancas_de_campo` quando a leitura não foi possível:**
```json
{
  "estado": "nao_lido",
  "motivo": "coleta_ainda_nao_comecou",
  "frase": "o histórico de campos deste site ainda não tem nenhuma leitura"
}
```
Os outros motivos são `tabela_ausente`, `erro_do_banco` e `cortado`. `nao_lido` nunca é "nenhuma mudança": cite a frase e não escreva que nada mudou.

**Campos de vídeo que saem:** `tags`, `category_id`, `duration_seconds`, `default_language`, `default_audio_language`, `live_broadcast_content`, `comments_disabled`, `likes_hidden`, `views_hidden`, `availability`.

**Campos de canal que saem:** `name`, `custom_url`, `country`, `avatar_url`, `subscribers_hidden`, `availability`. A descrição do canal não é entregue.

**Notas:**
- Mudança de thumbnail traz `old_thumbnail_url` e `new_thumbnail_url`. `view_count_at_change` mostra as views no momento da detecção, para avaliar o timing da mudança.
- `precisao` diz a largura da janela em que a mudança aconteceu: `6h`, `1d` ou `7d`; `gap` quer dizer que a janela da mudança é um buraco de coleta. `janela_desde` é o começo dela. `valor_novo` nulo é valor: o YouTube deixou de informar o campo. `valor_anterior` com `estado: "nao_lido"` e `sem_versao_anterior` quer dizer que a leitura anterior não existe, não que o valor era vazio.
- A lista de mudanças de campo cobre de `coleta_desde` até `lido_ate`. `coleta_desde` é a primeira leitura do site; canal acrescentado depois tem cobertura menor. Canal com leitura mais antiga que a de hoje não foi conferido depois dela: se `lido_ate.mais_recente` não for de hoje, diga até quando a lista vale e não escreva "nada mudou".
- `lido_ate.mais_recente` e `mais_antigo` valem para os campos do canal (nome, handle, país, avatar, inscritos ocultos, disponibilidade). Os campos de vídeo são relidos na cadência de cada vídeo (parte todo dia, parte uma vez por semana): a ausência de mudança num vídeo só vale até a última leitura dele. Se `lido_ate.videos_mais_recente` não for de hoje, diga até quando os campos de vídeo valem e não escreva "nada mudou".
- `videos_mais_recente` e `videos_mais_antigo` nulos querem dizer que nenhum vídeo tem leitura, não que está em dia. `videos_mais_antigo` pode ser antigo sem defeito: há vídeo que não é relido, e vídeo nunca lido não entra nas pontas.
- `cortado: true` quer dizer que há mudanças mais antigas que esta chamada não entrega: relate que a lista está incompleta e a partir de que data (o `visto_em` do último item).
- `video_de_outro_site` maior que zero é defeito nosso: relate. `video_ausente` conta mudança de vídeo apagado durante a leitura; não é defeito.
- Pela ferramenta `youtube_observatory`, com `campos`, peça `limit` de até 17: acima disso o texto passa do limite de resultado de ferramenta (medido no pior caso de tags).

---

### GET /api/pipeline/youtube/competitors/outliers

Lista vídeos outliers de canais concorrentes — vídeos com multiplicador de 2× ou mais em relação ao próprio canal. O cálculo é o mesmo do Observatório no CMS (uma única camada de cálculo): mesmo dia de vida quando há registro diário de views desde a publicação; senão, aproximação por faixa de idade (0–7, 8–30, 31–90, 91–365, mais de 365 dias). Base fraca (n < 3) não entra. Horários em São Paulo.

**Auth:** read

**Query params:**
- `tier` (opcional): `mid`, `high`, `top` (ou `B`, `A`, `S`) — filtro por nível de outlier
- `limit` (opcional, default: 25, max: 100)
- `fmt` (opcional): `long` (default) ou `short` — vídeos longos e Shorts nunca são comparados entre si

**O que é Short:** duração ≤ 60 s, ou de 61 a 180 s quando o próprio YouTube serve o vídeo em `/shorts/<id>` (o site confere isso na sincronização). Um vídeo de 61 a 180 s ainda não conferido conta como longo até a próxima sincronização.

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
- `view_count`, `like_count` e `comment_count` são `null` quando o canal oculta o contador ou o YouTube não devolveu a contagem (nunca `0`): trate como "sem contagem". Vídeo sem `comment_count` fica de fora da base do engajamento
- `multiplier` indica quantas vezes acima do canal (ex: 8.5×); ordenado do maior para o menor
- `method`: `mesmo dia de vida` (views no mesmo dia de vida que os outros vídeos do canal) ou `aproximação por faixa` (views totais vs vídeos do canal da mesma faixa de idade)
- `n`: vídeos do canal na base de comparação; `label`: texto canônico do motor, com método e n
- `phase`: `estourando`, `recente`, `perene`, `antigo`, `novos` ou `sem-ritmo` (canal com sincronização atrasada, com erro ou ainda buscando vídeos)
- `count`: total de outliers depois do filtro de tier (antes do `limit`)
- Tiers visuais: `mid` = #60A5FA (2-5×), `high` = #A78BFA (5-10×), `top` = #D9614A (10× ou mais)
- Usado para identificar padrões de conteúdo viral entre concorrentes
- Esta rota responde **todas as idades** de vídeo, em ordem de múltiplo, 25 por padrão e 100 no máximo, e **deixa de fora os vídeos de base fraca**. A tela Outliers e o Claude Code (`destaques`) começam pelo recorte padrão da tela, mostram também os de base fraca (marcados) e ordenam **por fase**: por isso as duas listas podem trazer **outros** vídeos, e não só menos. `multiplier` vem arredondado a uma casa.

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
        "freq_motivo": null,
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
- `cadence`: frequência de upload por concorrente (vídeos longos/semana, média sobre a base real: 13 semanas, ou menos se o canal é mais novo ou a coleta cobre menos). `freq` é `null` (nunca 0) quando a base tem menos de 28 dias, e `freq_motivo` diz por quê: `canal_novo` (canal criado há menos de 28 dias) ou `ritmo_parcial` (coleta cobre menos de 28 dias); com `freq` presente, `freq_motivo` é `null`. Não escreva "0 vídeos por semana" para `freq: null`; `window` = hábito "Dia Hh" em São Paulo quando o canal costuma publicar no mesmo dia e hora (3+ vídeos e 30%+ deles), senão `—`
- Zeros e `-1` que são falta (o corpo não muda; só a leitura): `last_upload_days: -1` quer dizer **sem data conhecida**, não um número de dias. `engagement_rate: 0` pode ser falta de leitura, não uma taxa medida.

---

### GET /api/pipeline/youtube/competitors/signals

Sugestões do nicho: lugares onde vídeos de concorrentes estouraram (régua do Observatório, `estourando`) em pelo menos dois canais, ou um vídeo muito acima do normal. É uma **associação, não uma causa**: a sugestão **pode ajudar**, não promete resultado. Nunca escreva "vai ajudar".

**Auth:** read
**Ferramenta:** `youtube_observatory`, ação `get_signals` (mesmo conteúdo; o texto sai sem indentação e, se passar de 60.000 caracteres, só a lista `evidence.outliers` de cada sugestão é encurtada, com `evidence.outliers_omitidos`; `n`, ids e `motivoVazio` não mudam).

**Query:** `limit` (opcional, 1 a 50, padrão 50).

**Resposta:**
```json
{
  "n": 2,
  "itens": [
    {
      "id": "uuid", "kind": "destino", "subject_key": "pais:JP",
      "acao": "titulo_descricao", "rotulo_acao": "abrir-seus", "n_proprios": 1, "acao_gravada": "video_novo",
      "forca": 12.5, "motivo": "dois canais estouraram...", "rule_version": "sinais-v1+semente-1",
      "evidence": { "outliers": [{ "video_id": "uuid", "canal_id": "uuid", "published_at": "ISO", "mult_vpd7": 6.1, "mult_tela": 3.2, "vpd7": 900, "formato": "long" }], "outliers_total": 4, "canais": 2, "proprios": [] },
      "first_seen_at": "ISO", "expires_at": "ISO",
      "proprios_agora": ["uuid do seu vídeo público sobre o lugar"]
    }
  ],
  "computado_em": "ISO", "desatualizado": false, "motivoVazio": null, "contagens": { "canais_total": 5 }, "calculoLigado": true
}
```

**Campos-chave:**
- `n`: total de sugestões abertas e vigentes (não o tamanho de `itens`). Ordem: `forca` (maior primeiro).
- `kind`: `destino` (lugar que esquentou) ou `parecido` (vídeo de concorrente parecido com um seu).
- `acao`: derivada **agora** dos seus vídeos públicos sobre o lugar (`proprios_agora`): com ≥ 1, `titulo_descricao` (rever título e descrição do que você já tem); com nenhum, `video_novo`; `playlist` não muda. `acao_gravada` é a que o cálculo gravou, só para auditoria.
- `proprios_agora`: ids dos **seus** vídeos públicos e visíveis que citam o lugar hoje. `null` = **não medido** (os lugares dos seus vídeos ainda não foram calculados): não leia como "você não tem vídeo sobre isso".
- `evidence.proprios` é a foto de quando a sugestão nasceu; use `proprios_agora`.
- Só ids, números e chaves de lugar: a rota não traz título, miniatura nem texto de comentário. O desempenho dos seus vídeos não entra na força nem na ordem.
- **Lista vazia nunca é "nada no nicho".** Com `n: 0`, `motivoVazio` diz por quê e deve ser **citado como está**: `nunca-calculado`, `tudo-respondido` (use `contagens.respondidos_30d`), `sem-historico`, `sync-atrasado`, `sem-terceiro-outlier`, `sem-lugar`, `abaixo-do-minimo` ou `sem-grupo`. Os números do motivo estão em `contagens`.
- `desatualizado: true`: o último cálculo tem mais de 36 horas; cite a data (`computado_em`).

---

### POST /api/pipeline/youtube/competitors/signals/:id/dismiss

Dispensa uma sugestão (ela não volta por 30 dias). **Auth:** write. **Ferramenta:** `youtube_observatory`, ação `dismiss_signal` com `signal_id`, `status` e `motivo`.

**Body:**
```json
{ "status": "dispensado", "motivo": "ja_fiz" }
```

- `status`: só `dispensado` (`feito` nasce do efeito observado, nunca à mão).
- `motivo`: `nao_e_parecido` (só `parecido`), `lugar_errado` (só `destino`), `ja_fiz` ou `nao_interessa`.
- Respostas: 200 `{ "ok": true }`; 400 corpo inválido; 403 sem `write`; 404 id inexistente ou de outro site; 409 já respondida; 422 motivo que não cabe no tipo.

---

### O que não é entregue ao Cowork nesta fase

- Série por vídeo (curva de views por dia), texto e contagem de comentários, a descrição do canal e qualquer dado do canal próprio no Observatório de concorrentes.
- Os números do **seu** canal em `analytics/overview`, `analytics/grades`, `analytics/demographics`, `analytics/search-terms`, `videos/:id` e `ab-tests/:id/funnel` **não são os do Observatório**: vêm das tabelas antigas do canal e, nos termos de pesquisa, da API do YouTube na hora; as telas do canal próprio e o Claude Code (degrau 2) leem tabelas novas, com outra janela e outro corte de dia. Os dois números não são comparáveis; diga de onde veio o que citar.
- O texto de antes e depois da descrição de um vídeo não é entregue aqui.
- A lista de `channels` traz só concorrentes; o seu canal não está nela.

---

## Leituras do observatório (forja)

A forja (Gemma 12B local) lê pedidos do observatório de concorrentes feitos na tela ("Pedir leitura à forja"). Só a chave da forja (`intelligence`, API key) usa estes endpoints; o Cowork não. Fluxo de uma execução:

1. `POST .../intelligence/task/claim` com `task_types` → a task (`task_type`, `target_niche`, `target_video_id`, `target_fmt`), ou 204.
2. `GET .../competitors/readings?task_id=` → os dados enviados à forja (`sent`), congelados na primeira leitura.
3. Gerar o texto e validar contra `sent`; então **um** de: `POST .../competitors/readings` (publica), `fail` com `refuse: true` (recusa) ou `fail` com/sem `retry`.

**Regras:**
- **Um pedido = um tipo × um alvo** (um nicho, ou um vídeo em `leitura-video`); uma claim por ciclo. O orçamento acoplado da forja (20 min do claim ao último request < 25 min do cron < 30 min do vigia) cobre GET + modelo + POST — a rota tem `maxDuration` 60 s.
- **Novo pedido:** não há limite por dia. O site só aceita um pedido novo de um alvo (tipo × nicho; tipo × nicho × vídeo em `leitura-video`) quando o dado mudou desde a última leitura publicada do mesmo alvo, e só um pedido ativo por tipo e nicho. Falha e recusa não geram leitura e não impedem um novo pedido.
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
      "capped": false,
      "base": { "videos": [], "channels": ["uuid"], "windowDays": 182, "asOf": 1792857600000 },
      "changeIds": ["uuid-do-video/title/2"], "windowDays": 30,
      "effects": [{ "change": "uuid-do-video/title/2", "status": "ganhou", "numbers": "…", "reason": "…", "collected": 7 }], "viewsThen": 207600
    }
  }
}
```
`base` (padrões de título e temas), `changeIds` + `windowDays` (resumo das trocas) e `effects` + `viewsThen` (leitura de vídeo) são os dados crus que o site usa no "Desde então" da leitura publicada. Ficam congelados junto com o resto; **não são citáveis** (não entram em `numbers`) e a forja pode ignorá-los.

Uma troca seguida de outra troca do mesmo vídeo em até 7 dias sai `inconclusivo` em `effects[].status` (a leitura misturaria duas versões); o `reason` diz qual campo mudou depois. O mesmo vale quando outra troca do vídeo aconteceu 2 dias ou menos antes.
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

Endpoints estendidos para A/B tests: learnings, suggestions, dashboard stats e test history.

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
        "avgLift": null,
        "kind": "thumb"
      },
      {
        "tag": "numbers-in-title",
        "wins": 3,
        "total": 6,
        "avgLift": null,
        "kind": "title"
      }
    ],
    "channelInsights": [
      { "text": "sem métrica de entrega", "type": "neutral" }
    ],
    "totalCompletedTests": 8,
    "aviso": "sem métrica de entrega"
  }
}
```

**Notas:**
- `tagWinRates.kind`: `thumb` = thumbnail tags, `title` = title patterns, `desc` = description patterns
- `avgLift` é sempre `null`: o A/B não tem métrica de entrega real, então nenhum lift (nem queda) é calculado nem citado
- `channelInsights` não cita percentual; traz só o `aviso`
- `wins`, `total` e `totalCompletedTests` contam só testes com vitória humana (`manual_winner`, `manual_apply`); vencedor de `auto_resolve` ou `manual_no_apply` não entra
- Campos de entrega (impressões, cliques, CTR, confiança, lift) saem `null` com `aviso: 'sem métrica de entrega'` enquanto o A/B não tiver medição real. Vitória só conta quando humana (`completed_reason` `manual_winner` ou `manual_apply`).

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

### GET /api/pipeline/youtube/ab-tests/dashboard

Retorna estatísticas agregadas do programa de A/B testing.

**Auth:** read

**Response 200:**
```json
{
  "data": {
    "activeTests": 3,
    "avgConfidence": null,
    "winRate": 50.0,
    "avgLift": null,
    "aviso": "sem métrica de entrega",
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
- `avgConfidence` e `avgLift` são sempre `null` (sem métrica de entrega real)
- `winRate`: percentual de testes root (excluindo playoffs) encerrados por pessoa ou por duração em que uma pessoa escolheu o vencedor. `auto_resolve` fica fora do numerador e do denominador. É `null` (nunca `0`) quando não sobra teste que conte
- Testes com `parent_test_id` (playoff children) são excluídos de `winRate`
- Campos de entrega (impressões, cliques, CTR, confiança, lift) saem `null` com `aviso: 'sem métrica de entrega'` enquanto o A/B não tiver medição real. Vitória só conta quando humana (`completed_reason` `manual_winner` ou `manual_apply`).

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
        "liftPercent": null,
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
    ],
    "aviso": "sem métrica de entrega"
  }
}
```

**Notas:**
- `winner` é o label da variante vencedora, só quando a vitória é humana (`manual_winner`, `manual_apply`); senão `null`
- `liftPercent` é sempre `null` (sem métrica de entrega real)
- Campos de entrega (impressões, cliques, CTR, confiança, lift) saem `null` com `aviso: 'sem métrica de entrega'` enquanto o A/B não tiver medição real. Vitória só conta quando humana (`completed_reason` `manual_winner` ou `manual_apply`).
- Ordenado por `created_at` descendente (mais recente primeiro)

---

### GET /api/pipeline/youtube/ab-tests/native

Lista os registros do teste nativo do YouTube (Test & Compare) detectados pelo site. É só leitura: o registro nasce sozinho (tarefa `registro_teste_nativo`), nunca por esta rota.

**Auth:** read

**Query:**
- `video_id` (opcional): id do YouTube de 11 caracteres (o mesmo de `get_history`); formato inválido devolve 400 `VALIDATION_ERROR`
- `estado` (opcional): `em_andamento`, `encerrado`, `sem_desfecho` ou `descartado`; outro valor devolve 400 `VALIDATION_ERROR`

**Response 200:**
```json
{
  "data": {
    "testes": [
      {
        "id": "uuid",
        "youtube_video_id": "qIg9a7vqcNo",
        "origem": "detectado",
        "campos": ["titulo"],
        "estado": "em_andamento",
        "variantes_titulo": ["Título A", "Título B"],
        "votos_titulo": { "0": 29, "1": 31 },
        "titulo_oficial": null,
        "primeira_vista": "2026-10-18T10:00:00+00:00",
        "ultima_vista": "2026-10-18T12:00:00+00:00",
        "desfecho": { "estado": null, "motivo": null, "em": null, "versao_regra": null },
        "vencedor": null,
        "evidencia_rodadas": 12,
        "evidencia_cortada": false,
        "versao_regra": 1
      }
    ]
  }
}
```

**Notas:**
- Mais recentes primeiro, no máximo 100, sempre do site da chave
- `titulo_oficial` é `null` por enquanto (a leitura anônima não vê o título oficial); um registro encerrado sem vencedor (`sem_desfecho`, motivo `oficial_nao_lido`) é normal, não é erro
- `vencedor` só vem preenchido quando a fonte é a regra ou o dono

---

### GET /api/pipeline/youtube/ab-tests/native/{id}

Um registro do teste nativo (`id` é o UUID do registro) e as últimas 20 avaliações do vídeo, da mais nova para a mais velha.

**Auth:** read

**Response 200:**
```json
{
  "data": {
    "teste": { "id": "uuid", "youtube_video_id": "qIg9a7vqcNo", "estado": "em_andamento", "...": "mesmos campos da lista" },
    "avaliacoes": [
      {
        "avaliada_em": "2026-10-18T13:00:00+00:00",
        "estado_14": "provavel_teste",
        "estado_48": "provavel_teste",
        "motivo_14": null,
        "mistas_48": 2,
        "mistas_48_fora_quarentena": 1,
        "min_desde_escrita": [90],
        "erro": null,
        "retroativa": false,
        "aviso": null
      }
    ]
  }
}
```

**Notas:**
- `id` que não é UUID devolve 400; inexistente ou de outro site devolve 404
- Estado `sem_leitura` (avaliação) nunca quer dizer sem teste: quer dizer que ainda não há leitura suficiente da página de exibição
- `estado_14`/`estado_48` são avaliações, não o desfecho; quem diz o desfecho é `teste.desfecho`

**Via MCP:** `manage_ab_test` com `action: list_native` (filtros `video_id`, `estado`) e `action: get_native` (`test_id`). Devolvem o mesmo objeto das rotas.

---

## Thumbnail Library

Endpoints para a biblioteca de thumbnails.

### GET /api/pipeline/youtube/thumbnails/library

Lista thumbnails na biblioteca — incluindo vencedoras de A/B tests importadas automaticamente.

**Auth:** read

**Response 200:**
```json
{
  "data": {
    "thumbnails": [
      {
        "id": "uuid",
        "videoTitle": "Video X Title",
        "imageUrl": "https://...",
        "lift": null,
        "tags": ["close-up"],
        "longevityScore": "stable",
        "sourceType": "test_winner"
      }
    ],
    "aviso": "sem métrica de entrega"
  }
}
```

**Notas:**
- `sourceType: "test_winner"` indica thumbnail importada de A/B test concluído
- `lift` é sempre `null` (sem métrica de entrega real)
- Campos de entrega (impressões, cliques, CTR, confiança, lift) saem `null` com `aviso: 'sem métrica de entrega'` enquanto o A/B não tiver medição real. Vitória só conta quando humana (`completed_reason` `manual_winner` ou `manual_apply`).
- Import automático via `autoImportWinner()` quando teste é completado com vencedor
- Thumbnails sem `sourceTestId` são uploads manuais

---

## A/B: funil, teste e lista de testes

`GET /api/pipeline/youtube/ab-tests/{id}/funnel`, `GET /api/pipeline/youtube/ab-tests/{id}` e `GET /api/pipeline/youtube/ab-tests` (no MCP: `manage_ab_test` com `get_funnel`, `get_test` e `list_tests`). Campos de entrega (impressões, cliques, CTR, confiança, lift) saem `null` com `aviso: 'sem métrica de entrega'` enquanto o A/B não tiver medição real. Vitória só conta quando humana (`completed_reason` `manual_winner` ou `manual_apply`).

```json
{
  "data": {
    "per_variant": [{ "variant_id": "uuid", "impressions": null, "clicks": null, "link_clicks": null }],
    "per_link": [],
    "link_clicks_window": null,
    "aviso": "sem métrica de entrega"
  }
}
```

- Funil: `impressions` e `clicks` por variante saem `null`; `link_clicks` é `null`, `per_link` é `[]` e `link_clicks_window` é `null`: o A/B não cria link rastreado desde 10/2026
- Teste (`get_test`): `confidence_at_completion`, `consecutive_confident_evals`, `result_metadata.ctr_lift_percent`, `result_metadata.total_impressions`, `result_metadata.estimated_monthly_extra_clicks` e, em cada ciclo, `impressions`, `clicks`, `ctr`, `estimated_impressions`, `estimated_clicks`, `estimated_ctr` saem `null`; `result_metadata.winner_label` e o resto continuam; `aviso` no teste
- Lista (`list_tests`, `ab-tests`): continua um vetor; cada item tem os mesmos `null` e o seu próprio `aviso`
- Painel (`ab-tests/dashboard`): `winRate` é `null` quando nenhum teste concluído conta

### GET /ab-tests/:id e list_tests: `restore_status` e `leitura`

Teste (`get_test`, `GET /api/pipeline/youtube/ab-tests/{id}`) e cada item da lista (`list_tests`, `GET /api/pipeline/youtube/ab-tests`) trazem o que aconteceu quando o teste saiu do ar (restauração do original ou da variante), igual no REST e no MCP:

```json
{
  "restore_status": {
    "title": { "estado": "falhou", "destino": "original", "em": "2026-10-12T08:02:00Z", "forcado": false, "escreveu": false, "erro": { "status": 403, "reason": "forbidden", "chamada": "videos.update" }, "attempts": 1 }
  },
  "leitura": { "title": { "tipo": "final", "estado": "falhou", "em": "2026-10-12T08:02:00Z", "destino": "original", "forcado": false, "motivo": null } }
}
```

- `restore_status`: cru, como está no banco, com uma chave por campo (`title`, `thumbnail`). Forma de cada campo: `{ estado, destino, em, forcado, escreveu, motivo?, erro, attempts }`. `destino` é `original` ou o id da variante.
- `estado` é um destes: `em_andamento`, `ok`, `falhou`, `pulado_sem_original`, `pulado_drift`, `desistiu`.
- `attempts` = tentativas já feitas pela corrente de restauração do campo (quem abre uma corrente grava 0; só o vigia incrementa; o máximo é 3). Erro de cota (`quotaExceeded`, `dailyLimitExceeded`, `rateLimitExceeded`) fica em `falhou` e não incrementa.
- `motivo` de `desistiu` (string livre): `novo_teste`, `video_inexistente`, `tres_falhas` (a 3ª tentativa falhou), `antes_da_nova_tentativa` (era `falhou` antes da nova tentativa automática existir; corrigir à mão ou usar "Tentar agora") e `destino_invalido` (o destino gravado não existe mais). O estado `pulado_teste_youtube` também pode aparecer (só leitura).
- `erro` guarda só `status`, `reason` e `chamada` (`videos.list`, `videos.update`, `thumbnails.set`, `blob`) do YouTube, ou `{ motivo }` para aborto interno, ou o texto `interrompido` (posto pelo vigia). Nunca corpo de resposta.
- `leitura`: a leitura pronta do `restore_status`, por campo, com três `tipo`: `em_andamento` (até 5 min desde `em`, 5:00 exato ainda é em andamento), `sem_resposta` (mais de 5 min sem fecho; `interrompido: true` passados 15 min ou quando o vigia já marcou `interrompido`) e `final` (os outros estados, com `estado`, `em`, `destino`, `forcado`, `motivo`). Prefira citar a `leitura` a refazer a conta.
- `restore_status` nulo = o teste nunca passou pelo código novo da saída do ar (saiu antes de 10/2026 ou ainda está em andamento); nesse caso `leitura` é `null`. `{}` = passou e não há restauração a mostrar; `leitura` é `{}`.
- Se o `restore_status` gravado não tem a forma esperada, `leitura` é `{ "ilegivel": true }` (diferente de `null`: não diga que é "mundo antigo").
- `restore_seq` é interno e não aparece.
- Ciclos (`cycles[]`, só em `get_test`) ganham `end_reason`: `null` (ciclo aberto ou anterior ao campo) ou um de seis valores: `pausa`, `encerrado`, `falha_api`, `duracao_maxima`, `drift`, `rotacao`.
- As variantes saem por lista fechada de colunas, sem `thumbnail_dhash` (interno).

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
2. GET  /api/pipeline/youtube/competitors/changes     → detectar mudanças recentes (`?campos=todos` para incluir mudanças de campo)
3. GET  /api/pipeline/youtube/competitors/outliers    → identificar vídeos virais
4. GET  /api/pipeline/youtube/competitors/insights    → insights agregados (heatmap, gaps, formulas, play-of-the-week)
4b. GET /api/pipeline/youtube/competitors/signals     → sugestões do nicho (associação, não causa; cite `motivoVazio` quando `n` for 0)
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
8. GET  /api/pipeline/youtube/ab-tests/native         → testes nativos do YouTube detectados (somente leitura)
```

**Via MCP:**
1. `manage_ab_test` action: `get_intelligence` → overview
2. `manage_ab_test` action: `list_tests` → status dos testes
3. `manage_ab_test` action: `upsert_variants` → criar variantes
4. `manage_ab_test` action: `submit_intelligence` → submeter recomendações
