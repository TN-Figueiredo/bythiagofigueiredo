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

Lista vídeos outliers de canais concorrentes — vídeos com performance significativamente acima da mediana do canal.

**Auth:** read

**Query params:**
- `tier` (opcional): `mid`, `high`, `top` — filtro por nível de outlier
- `limit` (opcional, default: 20, max: 50)

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "videoId": "dQw4w9WgXcQ",
      "title": "This Video Went Viral",
      "thumbnailUrl": "https://...",
      "channelName": "Competitor Channel",
      "channelThumbnailUrl": "https://...",
      "viewCount": 500000,
      "likeCount": 25000,
      "commentCount": 1800,
      "durationSeconds": 900,
      "publishedAt": "2026-05-20T16:00:00Z",
      "multiplier": 8.5,
      "tier": "high"
    }
  ]
}
```

**Notas:**
- `multiplier` indica quantas vezes acima da mediana do canal (ex: 8.5x)
- Tiers visuais: `mid` = #60A5FA (2-5x), `high` = #A78BFA (5-10x), `top` = #D9614A (>10x)
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
- `heatmap`: matriz 7x24 (dias x horas) com média de views — identifica melhores horários de publicação
- `hitsHeatmap`: matriz 7x24 com contagem de outliers publicados — confirma timing de picos
- `tags`: tags mais usadas por concorrentes, ordenadas por frequência
- `engagement`: comparação de engagement rate entre concorrentes e nosso canal (`isUs: true`)
- `gaps`: tópicos que concorrentes cobrem e nós não (`weCover: false`)
- `formulas`: padrões de título que performam acima da mediana (com `multiplier`)
- `play`: a jogada da semana — combinação tópico + fórmula + timing de maior impacto
- `cadence`: frequência de upload por concorrente (vídeos/semana)

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
    "healthScore": {
      "overall": 68,
      "ctr": { "value": 4.2, "grade": "B" },
      "retention": { "value": 45.0, "grade": "C" },
      "growth": { "value": 2.1, "grade": "B" },
      "engagement": { "value": 3.8, "grade": "B" },
      "frequency": { "value": 1.5, "grade": "C" }
    },
    "metrics": {
      "views": 125000,
      "estimatedMinutesWatched": 85000,
      "averageViewDuration": 245,
      "averageViewPercentage": 45.0,
      "subscribersGained": 350,
      "subscribersLost": 45,
      "impressions": 950000,
      "impressionClickThroughRate": 4.2,
      "likes": 5200,
      "comments": 380,
      "shares": 120
    },
    "daily": [
      {
        "date": "2026-06-01",
        "views": 4500,
        "estimatedMinutesWatched": 3200,
        "subscribersGained": 12,
        "subscribersLost": 2,
        "impressions": 35000,
        "impressionClickThroughRate": 4.1,
        "likes": 180,
        "comments": 14,
        "shares": 5
      }
    ]
  }
}
```

**Notas:**
- `healthScore.overall` é a média ponderada dos 5 eixos (0-100)
- Grades individuais: A >= 85, B >= 65, C >= 40, D < 40
- `daily` retorna uma série temporal para sparklines e trend charts
- Dados cacheados por 5 minutos (`revalidate: 300`)

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
1. GET  /api/pipeline/youtube/intelligence/task     → claim_task (transição atômica para running)
2. GET  /api/pipeline/youtube/intelligence          → get_intelligence (snapshot completo do canal)
3. [Cowork analisa: scoring, outliers, trends]
4. PATCH /api/pipeline/youtube/intelligence          → submit_intelligence (recommendations + coaching + notifications)
```

**Via MCP:**
1. `manage_ab_test` action: `claim_task`
2. `manage_ab_test` action: `get_intelligence` com `channel_id`
3. Cowork processa os dados
4. `manage_ab_test` action: `submit_intelligence` com `intel_payload`

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
