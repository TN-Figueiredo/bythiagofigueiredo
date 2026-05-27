# YouTube Cowork Prompt System

**Date:** 2026-05-27
**Score:** 101/110
**Status:** Design approved

## Problem

The YouTube CMS section has rich analytics infrastructure (150+ metrics, 6-axis scoring, A/B testing with 4 types, intelligence API with 12 action types, optimization cycle state machine) but **no way to generate AI-ready prompts** from this data. The Reference page has "Copy Cowork Prompt" but it's generic — it points to pipeline docs, not YouTube-specific context.

Users copy prompts to Claude.ai/ChatGPT where the AI **cannot call the pipeline API directly**. API-reference-only prompts are useless in this context.

## Solution

Hybrid prompt system with **inline data snapshots** (works in any AI) + **API references** (for deeper analysis when tools are available) + **write-back instructions** (AI submits analysis back via PATCH).

## Architecture

```
┌──────────────────────────────────────────────────┐
│  buildYoutubePromptBase()                        │
│  Auth + Channel ID + Pipeline Catalog + YT Docs  │
└──────────────┬───────────────────────────────────┘
               │
    ┌──────────┼──────────┬──────────────┐
    ▼          ▼          ▼              ▼
 Channel    A/B Test    Video        Analytics
 Health     Generator   Optimizer    Insight
 (full)     (variants)  (per-video)  (per-tab)
```

### Data Strategy: Hybrid

| Layer | Content | Token Cost |
|-------|---------|-----------|
| **Inline** (always present) | Channel KPIs, top 10 grades, demographics, thumbnail URLs, search terms | 600-1200 tokens |
| **API refs** (optional depth) | GET intelligence (50 videos), GET ab-performance, full grade history | ~100 tokens/endpoint |
| **Write-back** (Channel Health only) | PATCH intelligence with recommendations, coaching, notifications | ~200 tokens (schema) |

Thumbnail URLs embedded as `![thumbnail](url)` for vision model analysis.

## 4 Prompt Types

### 1. Channel Health (Health Coach tab)

The most comprehensive prompt. Round-trip: reads → analyzes → writes back.

**Inline data:**
- 6-axis scores with grades and benchmarks
- Demographics summary (age/gender/country/device)
- Top 15 search terms with views + watch time
- Top 10 video grades table + bottom 5 for optimization
- Outlier patterns (positive to replicate, negative to fix)
- Winning A/B patterns from completed tests

**API steps:**
1. `GET /api/pipeline/` — catalog + directives
2. `GET /api/pipeline/docs/youtube` — YouTube docs
3. `GET /api/pipeline/youtube/intelligence/task` — claim pending task (204 if none)
4. `GET /api/pipeline/youtube/intelligence?channel_id={id}` — full snapshot
5. Analyze inline + GET data
6. `PATCH /api/pipeline/youtube/intelligence` — submit analysis

**PATCH body schema:**
```json
{
  "task_id": "<uuid>",
  "video_recommendations": [{
    "video_id": "<uuid>",
    "action_type": "thumbnail_test | title_test | description_test | combo_test | retention_fix | seo_optimization | engagement_boost | distribution_expand | content_series | publish_timing | community_post | end_screen_optimize",
    "priority": "high | medium | low",
    "confidence": 0.0-1.0,
    "reasoning": "Max 500 chars, PT-BR, with data",
    "suggested_variant_description": "Optional, max 200 chars"
  }],
  "coaching": {
    "summary": "Max 500 chars",
    "priorities": [{
      "axis": "ctr | retention | reach | engagement | growth | sub_impact",
      "score": 0-10,
      "diagnosis": "Max 300 chars",
      "action": "Max 300 chars"
    }]
  },
  "notifications": [{
    "type": "grade_drop | ctr_drop | monitoring_alert | ab_test_completed | retest_suggested | optimization_available | trending_viral | optimization_resolved",
    "video_id": "<optional uuid>",
    "priority": 1-5,
    "title": "Max 100 chars",
    "message": "Max 500 chars"
  }],
  "channel_insights": {
    "patterns_detected": [{
      "pattern_id": "unique_id",
      "category": "thumbnail_style | title_pattern | content_type | publish_timing | duration_sweet_spot | traffic_source | engagement_driver | retention_pattern | growth_lever",
      "finding": "Max 300 chars",
      "confidence": 0.0-1.0,
      "sample_size": 5
    }],
    "analysis_text": "Max 2000 chars"
  }
}
```

**Constraints:** Max 25 recommendations, 20 notifications, 6 coaching priorities per PATCH. Confidence: 0.8-1.0 (obvious), 0.6-0.8 (probable), 0.4-0.6 (speculative). Error handling: 409 = re-GET resource, 422 = schema validation failed.

**Expected AI output:**
1. Channel diagnosis (health score, tier, strengths/weaknesses)
2. Top 5 recommendations ranked by impact
3. Detected patterns (correlations between thumbnails/titles/timing/retention)
4. 30-day action plan (week by week)
5. Submit via PATCH

### 2. A/B Test Generator (A/B Lab)

Focused on generating concrete test variants for a selected video.

**Inline data:**
- Selected video: title, description, thumbnail URL (as image), CTR, impressions, views, retention, grade
- Traffic sources breakdown
- Winning patterns from past tests (title_patterns, thumbnail_tags, emotional_triggers)

**API steps:**
1. `GET /api/pipeline/youtube/ab-performance` — full winning patterns
2. `GET /api/pipeline/youtube/intelligence?channel_id={id}` — channel context

**Instructions:** Analyze current thumbnail/title/description → propose 2-3 variants with:
- **Thumbnail:** visual_description, thumbnail_tags, reasoning
- **Title:** title_text (max 100 chars), title_pattern, emotional_triggers, reasoning
- **Description:** description_text, CTA placement, `{{link:name}}` tracked links, reasoning
- **Combo:** coherent combination of all three

**Output format:**
```json
{
  "test_name": "Short descriptive name",
  "test_type": "thumbnail | title | description | combo",
  "analysis": {
    "current_state": "2-3 sentence diagnosis",
    "weaknesses": ["list"],
    "opportunities": ["from winning patterns"]
  },
  "variants": [{
    "label": "B",
    "title_text": "or null",
    "description_text": "or null",
    "metadata": {
      "title_pattern": "pattern or null",
      "thumbnail_tags": ["tag1", "tag2"],
      "emotional_triggers": ["trigger1"],
      "visual_description": "detailed or null"
    },
    "reasoning": "Why this variant should perform better"
  }],
  "config": {
    "max_duration_days": 14,
    "confidence_threshold": 0.95,
    "burn_in_days": 2,
    "auto_apply_winner": true,
    "rotation_pattern": "abba"
  }
}
```

### 3. Video Optimizer (Videos tab drawer)

Per-video focused prompt from the Video Optimizer drawer.

**Inline data:**
- Video: title, thumbnail URL (as image), duration, published date, lifecycle stage
- Grade: 6-axis scores vs channel medians, overall score, trend
- Retention curve data points
- Traffic sources breakdown
- Optimization state + cycle history
- Previous diagnosis (if exists)

**Instructions:**
1. Identify top 3 problems ordered by impact
2. For each: one specific, executable action (7-day timeframe)
3. Prioritize by impact × effort
4. If CTR < median → suggest thumbnail A/B test with variant description
5. If retention < median → identify drop-off segment with timestamp
6. If reach low → suggest SEO improvements
7. If video flagged → generate diagnosis to advance cycle to "diagnosed"

**Output:** JSON compatible with PATCH intelligence endpoint (video_recommendations + notifications).

### 4. Analytics Insight (per sub-tab)

Context-adaptive prompt that changes based on the active analytics sub-tab.

**Variant A — Search Terms:**
- Inline: Top 15 terms with views + watch time
- Task: Cluster by intent, identify content gaps, suggest 3 video ideas, recommend tag/description SEO

**Variant B — Demographics:**
- Inline: Age/gender %, top 5 countries, device breakdown
- Task: Build primary persona, suggest format adaptations (mobile-first?), recommend publish windows, identify audience expansion opportunities

**Variant C — Outliers:**
- Inline: Positive outliers (patterns to replicate) + negative outliers (problems to fix) with z-scores
- Task: Extract success playbook (3-5 rules), create rescue plan for negatives, identify the #1 factor separating success from failure

**Variant D — Grades:**
- Inline: Top 10 + bottom 5 videos with scores, grade distribution
- Task: Diagnose overall health, identify quick wins (C→B), prioritize D-grade optimization, extract A-grade checklist, 30-day improvement plan

All variants share the same auth header and channel context base.

## UI Design

### 3 Levels of Buttons

**Level 1 — YouTube Header:**
"Copy Cowork Prompt" button in the YouTube layout header (next to "Sync All" and "Manage Channels"). Opens the main YouTube prompt modal with type selector.

**Level 2 — Per-Tab Contextual:**
- Health Coach tab: "Gerar Relatório AI" → pre-selects Channel Health type
- A/B Lab: "Sugerir Testes" → pre-selects A/B Test Generator
- Analytics sub-tabs: "Analisar com AI" → pre-selects Analytics Insight with correct variant
- Videos tab: button in table header area

**Level 3 — Per-Video:**
In the Video Optimizer drawer: "Copy Optimizer Prompt" and "Sugerir A/B Test" buttons.

### YouTube Prompt Modal

**File:** `apps/web/src/app/cms/(authed)/youtube/_components/youtube-cowork-prompt-modal.tsx`

Independent from the pipeline cowork modal but follows the same patterns:
- Pipeline Key input (sessionStorage: `youtube-pipeline-key`)
- Prompt type selector (radio: Channel Health / A/B Generator / Video Optimizer / Analytics)
- Analytics sub-type selector (conditional: Search Terms / Demographics / Outliers / Grades)
- Video selector (conditional: for Video Optimizer and A/B Generator)
- Syntax-highlighted preview (shared `PromptPreview` component)
- Copy to clipboard (Cmd+Enter shortcut, toast notification)
- Focus trap + keyboard navigation

### Video Optimizer Drawer

**File:** `apps/web/src/app/cms/(authed)/youtube/videos/video-optimizer-drawer.tsx`

Custom right-slide panel (no Sheet/Drawer primitive exists — build as fixed div with backdrop + transition, matching existing modal patterns).

**Props:**
```typescript
interface VideoOptimizerDrawerProps {
  video: VideoRow | null        // null = closed
  gradeData: VideoGradeRow | null
  onClose: () => void
  onCreateAbTest: (videoId: string, testType: string) => void
  onSaveNotes: (videoId: string, notes: string) => Promise<void>
}
```

**Sections (top to bottom):**
1. **Header** — title (line-clamp-2) + close button
2. **Thumbnail** — 16:9, grade badge overlay (bottom-left)
3. **Mini Radar** — 120×120 reusing `YtRadarChart`, 6 axes from gradeData
4. **Metrics Row** — 4-cell grid: Views | CTR | Retention | Impressions
5. **Retention Curve** — sparkline (80px tall) reusing `YtRetentionCurveV2`
6. **Traffic Sources** — horizontal bar segments (top 4 sources)
7. **Optimization State** — badge (flagged/diagnosed/testing/monitoring/resolved)
8. **AI Diagnosis** — collapsible card with diagnosis + recommendation
9. **CMS Notes** — textarea with debounced auto-save (800ms)
10. **Action Buttons** — sticky bottom: Copy Prompt | Sugerir A/B | Criar A/B Test

**Data loading:** Immediate data from VideoRow (title, thumbnail, views). Lazy-load on drawer open via `fetchVideoOptimizationData(videoId)` → grade, axes, retention curve, traffic sources, optimization state, intelligence records.

**Responsive:** Desktop `w-[480px]` overlay, mobile `w-full`. Slide-from-right 200ms transition.

## Component Architecture

```
apps/web/src/
├── app/cms/(authed)/youtube/
│   ├── _components/
│   │   └── youtube-cowork-prompt-modal.tsx   ← main modal (type selector + preview)
│   ├── videos/
│   │   ├── video-optimizer-drawer.tsx        ← per-video drawer
│   │   └── actions.ts                       ← + fetchVideoOptimizationData()
│   ├── analytics/_components/               ← per-tab contextual buttons
│   ├── ab-lab/_components/                  ← "Sugerir Testes" button
│   └── layout.tsx                           ← + header "Copy Cowork Prompt" button
├── lib/youtube/
│   ├── prompt-builders.ts                   ← 5 builder functions
│   └── prompt-types.ts                      ← TypeScript interfaces
└── components/
    └── prompt-preview.tsx                   ← extracted from cowork modal (shared)
```

### Prompt Builder Functions

```typescript
// lib/youtube/prompt-types.ts

interface YouTubePromptBaseOptions {
  channelId: string
  channelName: string
  subscriberCount: number
  baseUrl?: string
}

interface ChannelHealthPromptOptions extends YouTubePromptBaseOptions {
  healthScore: { overall: number; axes: AxisScore[] }
  demographics?: { ageGender: AgeGenderRow[]; countries: CountryRow[]; devices: DeviceRow[] }
  searchTerms?: SearchTermRow[]
  topVideos: VideoGradeRow[]
  bottomVideos: VideoGradeRow[]
  outliers?: { positive: OutlierRow[]; negative: OutlierRow[] }
  winningPatterns?: { titlePatterns: PatternRow[]; thumbnailTags: TagRow[] }
}

interface AbTestPromptOptions extends YouTubePromptBaseOptions {
  videoId: string
  videoTitle: string
  videoDescription: string
  thumbnailHqUrl: string
  ctr: number
  impressions: number
  viewCount: number
  avgRetention: number
  grade: string
  score: number
  trafficSources: TrafficSourceRow[]
  testType: 'thumbnail' | 'title' | 'description' | 'combo'
  winningPatterns?: { titlePatterns: PatternRow[]; thumbnailTags: TagRow[] }
}

interface VideoOptimizerPromptOptions extends YouTubePromptBaseOptions {
  video: { id: string; title: string; thumbnailUrl: string; duration: string; publishedAt: string; viewCount: number }
  grade: { score: number; grade: string; axes: AxisScore[]; trend: TrendInfo }
  retentionCurve?: number[]
  trafficSources?: TrafficSourceRow[]
  channelBaseline: { medianCtr: number; medianRetention: number }
  optimizationState?: string
  diagnosis?: string
}

interface AnalyticsInsightPromptOptions extends YouTubePromptBaseOptions {
  variant: 'search_terms' | 'demographics' | 'outliers' | 'grades'
  searchTerms?: SearchTermRow[]
  demographics?: DemographicsData
  outliers?: { positive: OutlierRow[]; negative: OutlierRow[] }
  topVideos?: VideoGradeRow[]
  bottomVideos?: VideoGradeRow[]
  gradeDistribution?: { a: number; b: number; c: number; d: number }
}
```

```typescript
// lib/youtube/prompt-builders.ts

export function buildYoutubePromptBase(options: YouTubePromptBaseOptions): string
export function buildChannelHealthPrompt(options: ChannelHealthPromptOptions): string
export function buildAbTestGeneratorPrompt(options: AbTestPromptOptions): string
export function buildVideoOptimizerPrompt(options: VideoOptimizerPromptOptions): string
export function buildAnalyticsInsightPrompt(options: AnalyticsInsightPromptOptions): string
```

## Edge Cases

### Prompt Generation
| Case | Handling |
|------|----------|
| No pipeline key | Generate with `[sua key]` placeholder, toast warning on copy |
| No channels configured | Disable button, show "Connect a channel first" |
| 0 videos (new channel) | Omit analytics sections, include note "No video data yet" |
| No analytics data (just synced) | Skip grade sections, note "Analytics not yet computed" |
| No A/B tests completed | Omit winning patterns section |
| Demographics unavailable (scope) | Omit demographics, note "Analytics scope not granted" |

### Video Optimizer Drawer
| Case | Handling |
|------|----------|
| Grade not computed | Show "Not graded yet" badge, disable diagnosis |
| Active A/B test | Disable "Start A/B" with tooltip "Test in progress" |
| Video hidden | Show "Hidden" badge, allow all optimization actions |
| Retention curve unavailable | Show "Data not available" placeholder |
| In cooldown (60 days post-resolved) | Disable new test with cooldown date |

### Accessibility
| Item | Implementation |
|------|---------------|
| Keyboard nav | Focus trap in modal/drawer, Escape closes, Cmd+Enter copies |
| Screen reader | `role="dialog"`, `aria-modal="true"`, `aria-label`, toast announcements |
| Focus restoration | Save `activeElement` before open, restore on close |
| Color contrast | Bump `--cpw-text-muted` to `#8a9bb5` (≥4.5:1), `--cpw-code-dim` to `#7d8da4` |
| Clipboard fallback | `document.execCommand('copy')` fallback for insecure contexts |

## Prompt Templates

### Channel Health Template (full)

```
# Voce e um analista de YouTube especializado em otimizacao de canais.
# Auth: X-Pipeline-Key: {pipelineKey}
# Inclua o header X-Pipeline-Key em TODAS as requisicoes.
# Base: {baseUrl}

## Dados do Canal (snapshot de {date})

### Health Score: {healthScore}/100

### 6 Eixos de Performance
| Eixo | Score | Grade | Benchmark |
|------|-------|-------|-----------|
| CTR (25%) | {ctr} | {grade} | 50 |
| Retencao (25%) | {retention} | {grade} | 50 |
| Alcance (15%) | {reach} | {grade} | 50 |
| Engajamento (15%) | {engagement} | {grade} | 50 |
| Crescimento (12%) | {growth} | {grade} | 50 |
| Impacto Sub (8%) | {subImpact} | {grade} | 50 |

### Demografia
{demographicsSummary}

### Top 15 Termos de Busca
| Termo | Views | Watch Time |
|-------|-------|-----------|
{searchTermsTable}

### Top 10 Videos por Score
| Video | Score | Grade | CTR | Retencao | Tendencia |
|-------|-------|-------|-----|----------|-----------|
{top10Table}

### Bottom 5 para Otimizacao
{bottom5List}

### Padroes Outlier
{outlierPatterns}

## Instrucoes

1. GET {baseUrl}/api/pipeline/ (catalogo + directives)
2. GET {baseUrl}/api/pipeline/docs/youtube (docs YouTube)
3. GET {baseUrl}/api/pipeline/youtube/intelligence/task (claim task — 204 se nenhuma pendente)
4. GET {baseUrl}/api/pipeline/youtube/intelligence?channel_id={channelId} (snapshot completo)
5. Analise dados inline + response do GET. Benchmarks por tier:
   Nano (<1K): CTR +0.5, Ret +0.3 | Micro (1-10K): CTR +0.2, Ret +0.1
   Small (10-100K): baseline | Medium (100K-1M): CTR -0.1, Ret -0.1
6. PATCH {baseUrl}/api/pipeline/youtube/intelligence (submeta analise — schema abaixo)

## Formato do PATCH
{PATCH JSON schema — see Architecture section above}

## Regras
- Max 25 recommendations, 20 notifications, 6 coaching priorities
- Confidence: 0.8+ (obvio), 0.6-0.8 (provavel), 0.4-0.6 (especulativo)
- 12 action_types: thumbnail_test, title_test, description_test, combo_test, retention_fix, seo_optimization, engagement_boost, distribution_expand, content_series, publish_timing, community_post, end_screen_optimize
- 8 notification types: grade_drop, ctr_drop, monitoring_alert, ab_test_completed, retest_suggested, optimization_available, trending_viral, optimization_resolved
- reasoning deve citar valores numericos concretos
- Nao sugerir thumbnail_test se video em ciclo "testing"
- Se GET retornar erro, reporte status e NAO prossiga
- Rate limit: 100 req/min

## Apos analisar, apresente:
1. Diagnostico geral do canal
2. Top 5 recomendacoes por impacto
3. Padroes detectados
4. Plano de acao 30 dias
5. Submeta via PATCH
```

### A/B Test Generator Template

```
# Voce e um especialista em testes A/B para YouTube.
# Auth: X-Pipeline-Key: {pipelineKey}
# Base: {baseUrl}

## Video Selecionado
- Titulo: {videoTitle}
- Descricao: {videoDescription}
- Thumbnail: ![thumbnail]({thumbnailHqUrl})
- CTR: {ctr}% | Impressoes: {impressions} | Views: {viewCount}
- Retencao: {avgRetention}% | Grade: {grade} ({score}/100)
- Publicado: {publishedAt}
- Trafego: Browse {browsePct}% | Search {searchPct}% | Suggested {suggestedPct}%

## Tipo de Teste: {testType}

## Padroes Vencedores do Canal
- Testes concluidos: {completedTests}
- Title patterns: {winningPatterns}
- Thumbnail tags: {winningTags}

## Instrucoes
1. GET {baseUrl}/api/pipeline/youtube/ab-performance (padroes completos)
2. GET {baseUrl}/api/pipeline/youtube/intelligence?channel_id={channelId}
3. Analise estado atual:
   - Thumbnail: composicao, legibilidade mobile, rosto/texto/cores
   - Title: padrao, tamanho, emotional triggers
   - Description: CTA, keywords, links
4. Proponha 2-3 variantes (B, C, D) com metadata estruturada
5. Sugira configuracao do teste

## Formato de Saida
{variant JSON structure — see Prompt Types section}

Responda em PT-BR.
```

### Video Optimizer Template

```
# Voce e um otimizador de videos do YouTube.
# Auth: X-Pipeline-Key: {pipelineKey}
# Base: {baseUrl}

## Video em Analise
- Titulo: {title}
- Thumbnail: ![thumbnail]({thumbnailUrl})
- Duracao: {duration} | Publicado: {publishedAt} ({ageDays} dias)
- Views: {viewCount} | CTR: {ctr}% | Retencao: {avgRetention}%

## Grade: {grade} ({score}/100)
| Eixo | Score | Mediana Canal | Status |
|------|-------|---------------|--------|
{axesTable}

## Curva de Retencao
{retentionCurve}

## Fontes de Trafego
{trafficSources}

## Estado de Otimizacao: {optimizationState}

## Instrucoes
1. Identifique 3 maiores problemas, ordenados por impacto
2. Para cada: 1 acao especifica executavel em 7 dias
3. Priorize por impacto x esforco
4. Se CTR < mediana → sugira A/B thumbnail com descricao da variante
5. Se retencao < mediana → identifique segmento com maior queda
6. Se alcance baixo → sugira melhorias de SEO
7. Responda com JSON para PATCH /api/pipeline/youtube/intelligence

Regras: max 25 recs, confidence 0.9+ = padrao claro, cite valores concretos.
```

### Analytics Insight Templates (4 variants)

**Search Terms:**
```
# Analista de SEO YouTube — Canal: {channelName}
## Top {termCount} Termos de Busca (28 dias)
{searchTermsTable}
Totais: {totalViews} views | {uniqueTerms} termos | {totalWatchTime}min

## Tarefa
1. Clusters tematicos por intencao de busca
2. Gaps de conteudo (termos sem video dedicado)
3. Oportunidades de titulo/tag para videos existentes
4. 3 ideias de video por volume e gap
```

**Demographics:**
```
# Analista de Audiencia — Canal: {channelName}
## Idade/Genero
{ageGenderTable}
## Paises Top 5
{countriesTable}
## Dispositivos
{devicesTable}

## Tarefa
1. Persona primaria (nome ficticio, 2 linhas)
2. Implicacoes de formato (mobile-first? duracao? edicao?)
3. Janela de publicacao otima por fuso
4. Estrategia de expansao de audiencia
```

**Outliers:**
```
# Analista de Performance — Canal: {channelName}
## Destaques Positivos (z > 2.0)
{positiveOutliers}
## Abaixo da Media (z < -2.0)
{negativeOutliers}

## Tarefa
1. Padroes de sucesso (titulo, thumb, duracao, topico)
2. Padroes de fracasso (erros sistematicos)
3. Playbook replicavel (3-5 regras)
4. Plano de resgate para negativos
5. Hipotese principal separando sucesso de fracasso
```

**Grades:**
```
# Auditor de Performance — Canal: {channelName}
## Top 10
{top10Table}
## Bottom 5
{bottom5Table}
Distribuicao: {countA} A | {countB} B | {countC} C | {countD} D

## Tarefa
1. Diagnostico geral (proporcao A+B vs C+D saudavel?)
2. Quick wins (C com tendencia de subida → B)
3. Prioridades de otimizacao (Grade D, maior audiencia potencial)
4. Checklist dos Grade A (regras pre-publicacao)
5. Meta 30 dias com acoes semanais
```

## Scoring Breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Prompt template quality | 90 | Inline data, round-trip write-back, tier benchmarks |
| Video detail UX | 88 | Drawer with grades, retention, optimization state, prompt buttons |
| A/B Lab integration | 85 | Winning patterns inline, thumbnail vision, structured output |
| Analytics prompt depth | 88 | Per-tab data blocks with real metrics, 4 specialized variants |
| Component architecture | 90 | Shared PromptPreview, clean separation, TypeScript types |
| Data freshness strategy | 92 | Hybrid inline + API, portable to any AI |
| Missing capabilities | 86 | Write-back, cross-video patterns, outlier replication |
| End-to-end workflow | 82 | Drawer → prompt → PATCH → monitoring |
| **Total** | **101/110** | |

## Implementation Estimate

| Component | Effort |
|-----------|--------|
| `prompt-builders.ts` + `prompt-types.ts` | 4h |
| `youtube-cowork-prompt-modal.tsx` | 6h |
| `video-optimizer-drawer.tsx` | 8h |
| `fetchVideoOptimizationData()` server action | 2h |
| Extract shared `prompt-preview.tsx` | 2h |
| Per-tab contextual buttons (Health Coach, A/B Lab, Analytics) | 3h |
| Header button + layout integration | 1h |
| Tests | 4h |
| **Total** | **~30h** |
