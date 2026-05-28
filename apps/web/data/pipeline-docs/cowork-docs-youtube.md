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

### GET /api/pipeline/youtube/intelligence?channel_id={id}

Retorna snapshot completo de inteligência do canal.

**Headers:** `X-Pipeline-Key: {api_key}`

**Response:**
```json
{
  "channel": {
    "id": "uuid",
    "channel_id": "UC...",
    "name": "Canal Nome",
    "subscriber_count": 12500
  },
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
      "view_count_yesterday": 150,
      "view_count_delta_today": 45
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
  "existing_intelligence": {
    "channel_coaching": null,
    "video_recommendations": []
  }
}
```

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

### GET /api/pipeline/youtube/intelligence/task

Pickup de tasks pendentes (transição atômica para 'running').

**Headers:** `X-Pipeline-Key: {api_key}`

**Response:** `{ "task": { "id": "uuid", "channel_id": "uuid", "trigger_type": "weekly" } }` ou `{ "task": null }`

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

**Score final:** soma ponderada dos 6 eixos normalizados.

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

**Regras:**
- Máximo 6 priorities (uma por eixo)
- Ordenar por score crescente (pior primeiro)
- `action` deve ser concreta e executável em 7 dias

---

## Retry & Backoff

- Tasks em `running` há > 30min: marcadas como `failed`, re-enfileiradas
- Máximo 3 retries por task antes de `abandoned`
- Rate limit: 100 requests/minuto por API key
- Headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Invalid request body or parameters | Check field types and required fields |
| 401 | Missing or invalid X-Pipeline-Key | Verify header is present in request |
| 404 | Resource not found | Verify the ID exists — for channel_id, note that 404 can mean the YouTube channel hasn't been synced yet (run a sync first) |
| 409 | Revision conflict (rev mismatch) | Re-GET the resource, use current rev, retry |
| 412 | Version conflict (X-Expected-Version mismatch) | Re-GET the item to refresh version, retry |
| 429 | Rate limit exceeded (100/min) | Wait and retry |

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
