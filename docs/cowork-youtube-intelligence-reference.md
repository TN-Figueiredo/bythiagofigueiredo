# YouTube Intelligence — Cowork AI Reference

> **Skill:** Performance Reviewer  
> **Trigger:** Análise de performance de canal YouTube, recomendações de otimização  
> **Auth:** `X-Pipeline-Key` header

---

## Regra fundamental: SEMPRE buscar referência online

**NUNCA use conhecimento estático sobre benchmarks ou thresholds.** Antes de qualquer análise, faça GET na referência atualizada:

```
GET /api/pipeline/context/youtube-intelligence
Header: X-Pipeline-Key: $KEY
```

Se a referência mudou desde a última vez que você consultou, adapte seu comportamento.

---

## O que é YouTube Intelligence

Sistema de análise automatizada que:
1. **Lê** dados de performance de vídeos (CTR, retenção, impressões, tráfego, A/B tests)
2. **Analisa** padrões entre vídeos (thumbnails, títulos, tipos de conteúdo, horários)
3. **Escreve** recomendações específicas, acionáveis e priorizadas
4. **Dispara** notificações quando detecta anomalias ou oportunidades

---

## Dados que você recebe (GET response)

### Endpoint

```
GET /api/pipeline/youtube/intelligence?channel_id=<internal_channel_uuid>
Header: X-Pipeline-Key: $KEY
```

### Estrutura do response

Você receberá um JSON com estas seções:

| Seção | Descrição |
|-------|-----------|
| `channel` | Metadados do canal (nome, handle, subs, total vídeos) |
| `metrics_30d` | Métricas agregadas dos últimos 30 dias |
| `metrics_previous_30d` | Período anterior para calcular deltas |
| `health_score` | Score de saúde composto (0-100) com breakdown |
| `videos` | Array dos últimos 20 vídeos com performance individual |
| `trends` | Tendências detectadas (7d, 30d, 90d) |
| `ab_tests` | Histórico de A/B tests (completados e ativos) |
| `traffic_sources` | Distribuição de tráfego por fonte |
| `content_patterns` | Análise de padrões por tipo/categoria/horário |

### Campos por vídeo (`videos[]`)

```json
{
  "video_id": "uuid-interno",
  "youtube_video_id": "dQw4w9WgXcQ",
  "title": "Título do vídeo",
  "thumbnail_url": "https://...",
  "published_at": "2026-05-10T18:00:00Z",
  "duration_seconds": 720,
  "category_slug": "tutoriais",
  "tags": ["typescript", "ai"],

  "metrics": {
    "views": 12500,
    "impressions": 85000,
    "ctr": 5.8,
    "avg_view_duration_seconds": 312,
    "avg_view_percentage": 43.3,
    "likes": 450,
    "comments": 67,
    "shares": 23,
    "subscribers_gained": 85,
    "estimated_minutes_watched": 65000
  },

  "grade": "B",
  "score": 1.35,
  "relative_performance": "above_average",

  "thumbnail_metadata": {
    "tags": ["face_close", "text_overlay", "dark_bg"],
    "style": "tech-minimal",
    "has_face": true,
    "has_text": true,
    "dominant_colors": ["#1a1a2e", "#e2e8f0"]
  },

  "title_metadata": {
    "word_count": 8,
    "has_number": true,
    "has_question": false,
    "has_brackets": true,
    "pattern": "how_to",
    "emotional_trigger": "curiosity"
  },

  "traffic_sources": {
    "browse_features": 45.2,
    "search": 22.1,
    "suggested": 18.5,
    "external": 8.3,
    "direct": 5.9
  },

  "retention_curve": [100, 92, 85, 78, 72, 65, 58, 52, 48, 45, 42, 40],

  "ab_test_history": [
    {
      "test_id": "uuid",
      "test_type": "thumbnail",
      "status": "completed",
      "winner_label": "Variant B",
      "ctr_lift_percent": 18.5,
      "confidence": 0.97,
      "completed_at": "2026-05-08T12:00:00Z"
    }
  ]
}
```

---

## Benchmarks de referência

### CTR (Click-Through Rate)

| Faixa | Classificação | Ação sugerida |
|-------|--------------|---------------|
| < 2% | Crítico | Thumb + título precisam reformulação urgente |
| 2-4% | Abaixo da média | Testar novo thumb ou título |
| 4-5% | Média (Education niche) | Otimizar incrementalmente |
| 5-7% | Bom | Identificar o que funciona e replicar |
| 7-10% | Ótimo | Usar como template para futuros |
| > 10% | Excepcional | Analisar por que — pode ser viral ou nicho estreito |

**Contexto por nicho:**
- Tech/Tutoriais: avg 4.5%, bom 6%+
- Vlog/Lifestyle: avg 5%, bom 7%+
- Shorts: avg 2-3% (impressões altíssimas, CTR mais baixo)

### Retenção (Average View Percentage)

| Faixa | Classificação | Ação sugerida |
|-------|--------------|---------------|
| < 20% | Crítico | Problema no hook ou promessa não cumprida |
| 20-35% | Abaixo da média | Melhorar pacing, cortar mortes |
| 35-50% | Média | Boa estrutura, polir transições |
| 50-65% | Bom | Conteúdo engajante, manter fórmula |
| > 65% | Excepcional | Padrão ouro — analisar e replicar |

**Ajuste por duração:**
- < 5 min: espera-se 50%+ avg
- 5-15 min: espera-se 40%+ avg
- 15-30 min: espera-se 30%+ avg
- > 30 min: espera-se 25%+ avg

### Engagement Rate

```
engagement_rate = (likes + comments + shares) / views * 100
```

| Faixa | Classificação |
|-------|--------------|
| < 2% | Baixo |
| 2-5% | Médio |
| 5-10% | Bom |
| > 10% | Viral/comunidade ativa |

### Growth indicators

| Métrica | Saudável | Alerta |
|---------|----------|--------|
| Subs gained por vídeo | > 0.5% das views | < 0.1% das views |
| Views vs impressions ratio (CTR proxy) | > 4% | < 2% |
| Watch time growth MoM | > 0% | < -10% |
| Impressions growth MoM | > 5% | < -15% |

---

## Como analisar padrões

### 1. Thumbnail patterns

Compare CTR entre grupos:
- **Com rosto vs sem rosto** — calcule avg CTR de cada grupo
- **Com texto overlay vs sem** — idem
- **Fundo escuro vs claro** — idem
- **Close-up vs wide shot** — idem
- **Expressão (surpresa, sorriso, sério)** — idem

Regra: um padrão só é significativo com **5+ vídeos** por grupo.

### 2. Title patterns

Compare performance entre:
- **How-to / Tutorial** (`"Como..."`, `"How to..."`)
- **Listicle** (`"5 maneiras..."`, `"Top 10..."`)
- **Question** (`"Por que...?"`, `"Você sabia...?"`)
- **Statement** (`"Eu larguei..."`, `"A verdade sobre..."`)
- **Brackets** (`[2026]`, `(Tutorial)`)
- **Numbers** (presença de dígitos no título)

### 3. Content type performance

Agrupe por `category_slug` e compare:
- Views médias
- CTR médio
- Retenção média
- Engagement rate

### 4. Temporal patterns

- **Melhor dia da semana** para publicação (por views 7d)
- **Melhor horário** (se disponível)
- **Sazonalidade** — vídeos de certos temas performam melhor em certas épocas

### 5. Traffic source patterns

- **Browse-heavy videos** → thumb + título otimizados para homepage
- **Search-heavy videos** → SEO title + tags + description otimizados
- **Suggested-heavy videos** → boa retenção + metadata relacionada

---

## Como gerar recomendações

### Princípios

1. **Específico** — "Teste um thumbnail com close-up do rosto + texto '3 erros'" em vez de "melhore o thumbnail"
2. **Acionável** — cada recomendação deve ter um próximo passo claro
3. **Data-driven** — cite os números que justificam a recomendação
4. **Priorizado** — ordene por impacto estimado (high > medium > low)
5. **Contextual** — considere o histórico de A/B tests já realizados

### Tipos de ação

| `action_type` | Quando sugerir |
|--------------|----------------|
| `thumbnail_redesign` | CTR < benchmark OU padrão de thumb com baixo CTR identificado |
| `title_rewrite` | CTR < benchmark E thumbnail não é o problema (ou já testada) |
| `description_seo` | Traffic source "search" < 15% para conteúdo evergreen |
| `ab_test_thumb` | CTR abaixo da média do canal, thumb atual não segue best pattern |
| `ab_test_title` | Título segue padrão que historicamente performa pior |
| `retention_fix` | Retenção < benchmark por duração, queda abrupta na curva |
| `content_strategy` | Categoria inteira underperforming vs resto do canal |
| `publish_timing` | Vídeo publicado fora do window ótimo do canal |
| `series_opportunity` | Vídeo performou 2x+ acima da média, tema pode virar série |

### Confidence levels

| Nível | Quando usar |
|-------|-------------|
| `high` (0.8-1.0) | 10+ data points, padrão claro e consistente |
| `medium` (0.5-0.79) | 5-9 data points, padrão visível mas com exceções |
| `low` (0.3-0.49) | 3-4 data points, tendência emergente mas não confirmada |

---

## Output: formato das recomendações (PATCH payload)

### Endpoint

```
PATCH /api/pipeline/youtube/intelligence
Header: X-Pipeline-Key: $KEY
Header: Content-Type: application/json
```

### Payload completo

```json
{
  "channel_id": "uuid-interno",
  "analysis_version": 1,
  "analyzed_at": "2026-05-17T14:30:00Z",

  "video_recommendations": [
    {
      "video_id": "uuid-interno",
      "recommendations": [
        {
          "id": "rec_<random_8_chars>",
          "action_type": "thumbnail_redesign",
          "priority": "high",
          "confidence": 0.85,
          "title": "Thumbnail com close-up + texto de curiosidade",
          "reasoning": "Seus vídeos com close-up do rosto têm CTR médio de 7.2% vs 4.1% sem rosto. Este vídeo (CTR 3.8%) usa wide shot. Teste com close-up pode ganhar ~80% mais CTR.",
          "suggested_action": "Criar thumbnail com enquadramento próximo, expressão de surpresa, texto bold '3 erros que matam seu código' em amarelo sobre fundo escuro.",
          "data_points": {
            "current_ctr": 3.8,
            "benchmark_ctr": 7.2,
            "pattern_sample_size": 8,
            "potential_lift_percent": 89
          },
          "status": "pending",
          "created_at": "2026-05-17T14:30:00Z"
        }
      ]
    }
  ],

  "channel_insights": {
    "patterns_detected": [
      {
        "pattern_id": "pat_<random_8_chars>",
        "category": "thumbnail_style",
        "finding": "Vídeos com face close-up performam 76% melhor em CTR",
        "confidence": 0.88,
        "sample_size": 14,
        "data": {
          "with_face_avg_ctr": 7.2,
          "without_face_avg_ctr": 4.1,
          "with_face_count": 8,
          "without_face_count": 6
        }
      },
      {
        "pattern_id": "pat_<random_8_chars>",
        "category": "title_pattern",
        "finding": "Títulos com brackets [2026] ganham 23% mais impressões",
        "confidence": 0.62,
        "sample_size": 7,
        "data": {
          "with_brackets_avg_impressions": 95000,
          "without_brackets_avg_impressions": 77000
        }
      },
      {
        "pattern_id": "pat_<random_8_chars>",
        "category": "content_type",
        "finding": "Categoria 'tutoriais' tem 2x mais watch time que 'vlogs'",
        "confidence": 0.91,
        "sample_size": 12,
        "data": {
          "tutorials_avg_watch_min": 8500,
          "vlogs_avg_watch_min": 4200
        }
      }
    ],

    "strengths": [
      "CTR médio do canal (6.1%) está acima do nicho tech (4.5%)",
      "Retenção nos primeiros 30s consistentemente > 85%",
      "Engagement rate (5.8%) indica comunidade ativa"
    ],

    "weaknesses": [
      "Retenção cai 20% entre minuto 3-5 em tutoriais longos (> 15min)",
      "Vídeos publicados no domingo performam 40% pior que terça-feira",
      "Descrições com < 200 chars correlacionam com -30% search traffic"
    ],

    "opportunities": [
      "4 vídeos com grade D nunca tiveram A/B test — potencial de recuperação",
      "Série sobre TypeScript tem retenção 60%+ — considerar spinoff dedicado",
      "Search term 'como usar cursor ai' tem 500+ views/mês sem vídeo dedicado"
    ]
  },

  "coaching": {
    "summary": "Seu canal está saudável (score 72/100) com CTR acima da média do nicho. O principal gap é retenção mid-roll em tutoriais longos. Recomendo focar nas 3 thumbnails flagged para A/B test esta semana — potencial de +2.500 views/mês.",

    "priorities": [
      {
        "rank": 1,
        "action": "A/B test thumbnails dos 3 vídeos com CTR < 4%",
        "impact": "high",
        "effort": "low",
        "estimated_lift": "+2.500 views/mês",
        "timeline": "Esta semana"
      },
      {
        "rank": 2,
        "action": "Adicionar chapters nos 5 tutoriais sem timestamps",
        "impact": "medium",
        "effort": "low",
        "estimated_lift": "+5% retenção, melhor search discovery",
        "timeline": "Esta semana"
      },
      {
        "rank": 3,
        "action": "Reformular descrições dos vídeos evergreen (SEO)",
        "impact": "medium",
        "effort": "medium",
        "estimated_lift": "+15% search traffic em 30d",
        "timeline": "Próxima semana"
      }
    ],

    "next_video_advice": "Para o próximo vídeo, use: thumbnail close-up + texto com número + publique terça 18h BRT. Baseado nos padrões: CTR +76% (face), +23% (brackets), +40% (terça vs domingo)."
  },

  "notifications": [
    {
      "trigger": "ctr_drop",
      "severity": "warning",
      "video_id": "uuid",
      "message": "CTR do vídeo 'Como usar Cursor AI' caiu de 6.2% para 3.8% nos últimos 7 dias (-38.7%)",
      "suggested_action": "Testar novo thumbnail — o atual pode estar saturado nas impressões"
    }
  ]
}
```

---

## Notification triggers

Gere `notifications[]` no PATCH quando detectar:

| Trigger | Condição | Severity |
|---------|----------|----------|
| `ctr_drop` | CTR caiu > 25% vs média dos últimos 30d por 3+ dias consecutivos | `warning` |
| `grade_drop` | Vídeo tinha grade B+ e caiu para D | `warning` |
| `stagnant_after_test` | A/B test completou há 14+ dias mas CTR não melhorou | `info` |
| `optimization_opportunity` | Vídeo com 10k+ impressões e CTR < 3% (alto potencial, baixa conversão) | `info` |
| `viral_detection` | Views 5x+ acima da média do canal em 48h | `success` |
| `retention_cliff` | Queda > 30% em 10s na curva de retenção (problema pontual) | `warning` |
| `search_surge` | Search term específico cresceu > 200% WoW com vídeo relevante | `opportunity` |

### Formato de notification

```json
{
  "trigger": "ctr_drop",
  "severity": "warning" | "info" | "success" | "opportunity",
  "video_id": "uuid | null",
  "message": "Texto human-readable em PT-BR",
  "suggested_action": "Ação sugerida em uma frase",
  "data": {
    "current_value": 3.8,
    "previous_value": 6.2,
    "delta_percent": -38.7,
    "days_below": 5
  }
}
```

---

## Workflow de execução

### Quando rodar

1. **Cron diário** (6h BRT) — análise incremental, só gera notifications
2. **Cron semanal** (segunda 8h BRT) — análise completa com recommendations
3. **On-demand** — via CMS action button "Analisar agora"

### Passo a passo

```
1. GET /api/pipeline/youtube/intelligence?channel_id=<uuid>
2. Processar dados recebidos:
   a. Calcular deltas vs período anterior
   b. Identificar padrões cross-video
   c. Verificar benchmarks por categoria/nicho
   d. Analisar curvas de retenção
   e. Cruzar com histórico de A/B tests
3. Gerar recomendações priorizadas
4. PATCH /api/pipeline/youtube/intelligence
   Body: { channel_id, video_recommendations, channel_insights, coaching, notifications }
5. Notifications com severity "warning" disparam push no CMS automaticamente
```

### Regras de idempotência

- Cada recomendação tem `id` único (`rec_<random>`)
- Se o vídeo já tem recomendação com mesmo `action_type` e `status: "pending"`, NÃO duplicar
- Se o vídeo já teve A/B test para aquele `action_type` nos últimos 30d, NÃO recomendar novamente
- Notifications com mesmo `trigger` + `video_id` nos últimos 7 dias = NÃO repetir

---

## Exemplos de análise

### Exemplo 1: Vídeo com CTR baixo

**Input:**
```json
{
  "title": "Minha rotina de desenvolvedor",
  "ctr": 2.8,
  "thumbnail_metadata": { "has_face": false, "has_text": false, "style": "stock-like" }
}
```

**Output:**
```json
{
  "action_type": "thumbnail_redesign",
  "priority": "high",
  "confidence": 0.85,
  "title": "Thumbnail precisa de face + texto para competir no browse",
  "reasoning": "CTR 2.8% está 54% abaixo da média do canal (6.1%). Thumbnail sem rosto e sem texto — seus vídeos com face + text têm CTR 7.2% em média (8 vídeos). Padrão claro e consistente.",
  "suggested_action": "Criar thumb com: close-up do rosto (expressão 'mind blown'), texto bold '24h de um dev' em amarelo, fundo gradient escuro.",
  "data_points": {
    "current_ctr": 2.8,
    "benchmark_ctr": 7.2,
    "pattern_sample_size": 8,
    "potential_lift_percent": 157
  }
}
```

### Exemplo 2: Retenção com cliff

**Input:**
```json
{
  "title": "Setup completo para dev em 2026",
  "avg_view_percentage": 28,
  "duration_seconds": 1200,
  "retention_curve": [100, 95, 88, 82, 75, 42, 38, 35, 33, 30, 28, 27]
}
```

**Output:**
```json
{
  "action_type": "retention_fix",
  "priority": "high",
  "confidence": 0.92,
  "title": "Cliff de retenção no minuto 5 — perda de 33% da audiência",
  "reasoning": "Curva de retenção mostra queda abrupta de 75% → 42% entre posição 4-5 (aprox. minuto 4-5 de 20min). Indica break de expectativa ou segmento desinteressante. Avg retention 28% está abaixo do benchmark 30% para vídeos de 15-30min.",
  "suggested_action": "Revisar o minuto 4-5 do vídeo: (1) Há troca brusca de assunto? Adicionar transition card. (2) Segmento longo sem corte? Adicionar B-Roll. (3) Considerar mover esse segmento para depois ou cortar. Adicionar chapter marker antes do drop.",
  "data_points": {
    "cliff_position": 5,
    "cliff_drop_percent": 33,
    "avg_retention": 28,
    "benchmark_retention": 30
  }
}
```

---

## Retry e resiliência

Se o PATCH falhar (timeout, 5xx, rede):

1. **Retry:** 3 tentativas com backoff exponencial (2s → 4s → 8s)
2. **Idempotência:** O PATCH usa `analysis_version` como chave de dedup — safe to retry
3. **Partial failure:** Se o GET suceder mas o PATCH falhar após 3 retries, salve o payload localmente e reporte: "Intelligence analysis complete, but PATCH failed after 3 retries. Payload saved for manual retry."
4. **Timeout:** GET timeout = 30s, PATCH timeout = 15s

---

## Channel size tiers

O scoring considera o tamanho do canal. Use estes modificadores ao avaliar benchmarks:

| Tier | Subscribers | CTR modifier | Retention modifier | Growth modifier |
|------|-------------|--------------|-------------------|-----------------|
| small | 0-10K | 0.8x (mais leniente) | 0.85x | 0.7x |
| medium | 10K-100K | 1.0x (baseline) | 1.0x | 1.0x |
| large | 100K+ | 1.2x (mais exigente) | 1.1x | 1.3x |

Exemplo: benchmark CTR "bom" = 6%. Para canal small: 6% × 0.8 = 4.8% já é "bom". Para canal large: 6% × 1.2 = 7.2% para ser "bom".

---

## Regras finais

1. **Língua:** Todas as recomendações, coaching e notifications em **PT-BR**
2. **Tom:** Direto, prático, sem enrolação. Use números sempre que possível.
3. **Limite:** Máximo 5 recomendações por vídeo, 3 pattern findings, 5 priorities no coaching
4. **Não inventar dados:** Se não há dados suficientes para uma conclusão, diga explicitamente e use confidence `low`
5. **Respeitar A/B history:** Nunca recomendar algo que já foi testado e falhou
6. **Considerar contexto:** Um vídeo de nicho estreito com 500 views pode ter grade A se a média do canal é 300
7. **Atualizar, não sobrescrever:** O PATCH é merge — só envie campos que mudaram
8. **Channel size:** Aplicar `CHANNEL_SIZE_TIERS` modifier ao comparar métricas com benchmarks
