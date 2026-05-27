# YouTube Cowork Prompt System

**Date:** 2026-05-27
**Revision:** 8 (30 fixes from Round 6 — 8 critics, avg 74/100)
**Status:** Under review

## Problem

The YouTube CMS section has rich analytics infrastructure (150+ metrics, 6-axis scoring, A/B testing with 4 types, intelligence API with 12 action types, optimization cycle state machine) but **no way to generate AI-ready prompts** from this data. The Reference page has "Copy Cowork Prompt" but it's generic — it points to pipeline docs, not YouTube-specific context.

Users copy prompts to Claude.ai/ChatGPT where the AI **cannot call the pipeline API directly**. API-reference-only prompts are useless in this context.

## Solution

**Textarea-first prompt system** matching the existing `CoworkRequestPanel` pattern:

1. User writes **what they want** in a textarea (free-form instructions)
2. System auto-appends **YouTube data context** (channel health, grades, analytics)
3. The 3 prompt "types" are **context presets** — they determine WHICH data is included, not what the AI does
4. Guardrails, persona, and context appear BEFORE user instructions — positional authority prevents instruction override

This mirrors the pipeline's `buildPrompt(userInstructions, context)` pattern exactly. The user drives the question; the system provides the data.

**MODE 2 (API write-back) is deferred to Phase 2.** Phase 1 prompts are analysis-only — no PATCH schema, no hard stop separator, no Zod reconciliation needed.

## Prerequisites

### Phase 1 Prerequisites (~1.5h)

**P1: Add `youtube_videos.version` column**

CMS notes concurrency uses optimistic locking via a `version` integer:

```sql
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS cms_notes text;
```

Migration via `npm run db:new youtube-videos-version-notes`. ~15 min.

**P1: Canonicalize shared constants**

Three duplicated exports between `scoring-types.ts` and `intelligence-types.ts`:

| Constant | Canonical source | Delete from |
|----------|-----------------|-------------|
| `SIGMOID_K` (keyed by `Axis`) | `scoring-types.ts` | `intelligence-types.ts` (`SIGMOID_STEEPNESS` with mismatched keys) |
| `GRADE_THRESHOLDS` | `scoring-types.ts` | `intelligence-types.ts` (identical duplicate) |
| `ChannelTier` (5 tiers) | `scoring-types.ts` | `intelligence-types.ts` (`ChannelSizeTier` with only 3 tiers) |

Delete duplicates from `intelligence-types.ts`, re-export from `scoring-types.ts`. ~45 min.

**P1: Document health score axis mismatch**

**Scoring engine** (`scoring-types.ts`): 6 axes — `ctr | retention | reach | engagement | growth | sub_impact`
**Intelligence GET response** (`intelligence-types.ts`): 5 axes — `ctr | retention | growth | engagement | frequency`

Missing in intelligence GET: `reach`, `sub_impact`. Extra in intelligence GET: `frequency`.
The intelligence GET uses `HealthGrade = 'excellent' | 'good' | 'average' | 'below_average' | 'critical'` while video grades use `Grade = 'A' | 'B' | 'C' | 'D'`.

**For prompts:** Use the 6-axis system from scoring-types.ts (canonical scoring engine). The prompt builder computes scores from raw data, not from the intelligence GET health_score breakdown.

### Phase 2 Prerequisites (~3.5h — deferred, needed only for MODE 2)

These are NOT Phase 1 blockers.

**P0: Reconcile `action_type` enums** (~30 min)

| Canonical (intelligence-types.ts) | Zod schema (intelligence-schemas.ts) |
|---|---|
| `thumbnail_redesign` | `thumbnail_test` |
| `title_rewrite` | `title_test` |
| `description_seo` | `description_test` |
| `ab_test_thumb` | `combo_test` |
| `ab_test_title` | _(missing)_ |
| `retention_fix` | `retention_fix` |
| `content_strategy` | `content_series` |
| `publish_timing` | `publish_timing` |
| `series_opportunity` | `seo_optimization` |
| `chapters_add` | `engagement_boost` |
| `end_screen_optimize` | `end_screen_optimize` |
| `pinned_comment` | `community_post` |
| _(missing)_ | `distribution_expand` |

**P0: Reconcile `notification` types** (~30 min)

| TypeScript `NotificationTrigger` (9) | Zod `NotificationSchema.type` (8) |
|---|---|
| `ctr_drop` | `ctr_drop` |
| `grade_drop` | `grade_drop` |
| `stagnant_after_test` | `retest_suggested` |
| `optimization_opportunity` | `optimization_available` |
| `viral_detection` | `trending_viral` |
| `retention_cliff` | `monitoring_alert` |
| `search_surge` | _(missing)_ |
| `milestone_approaching` | _(missing)_ |
| `ab_test_ready` | `ab_test_completed` |
| _(missing)_ | `optimization_resolved` |

**P0: Reconcile `coaching.priorities` shape** (~30 min)

PATCH spec uses `{ axis, score, diagnosis, action }`. TypeScript `CoachingPriority` uses `{ rank, action, impact, effort, estimated_lift, timeline }` — zero field overlap except `action`. Decide canonical shape.

**P0: Add `prompt_version` to Zod PatchPayloadSchema**

```typescript
prompt_version: z.string().regex(/^yt-[a-z]{2}-v\d+$/).optional(),
```

**P1: Tighten Zod validation + PATCH transform layer** (~1.5h)

## Phased Delivery (~25h MVP)

| Phase | Scope | Effort | Value |
|-------|-------|--------|-------|
| **Phase 1 (MVP)** | Textarea + 3 context presets + drawer (analysis-only) | **~25h** | 80% of value |
| Phase 2 | MODE 2 write-back + Analytics preset + A/B Generator | ~15h | 15% |
| Phase 3 | Direct AI API integration (replace copy-paste) | ~15h | Evolution |

This spec covers Phase 1 fully and Phase 2/3 as design sketches.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  User writes instructions in textarea                     │
│  "Por que meu CTR caiu essa semana?"                     │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  buildYoutubePrompt({ preset, data, instructions })      │
│  = persona + guardrails + <context> + <instructions>     │
└──────────────┬───────────────────────────────────────────┘
               │
    ┌──────────┼──────────────┐
    ▼          ▼              ▼
 Content    Channel        Video        ← context presets
 Calendar   Health         Optimizer       (which data to include)
 (default)
```

### Core Pattern: Guardrails-First, Instructions-Last

The prompt uses XML tags for structural boundaries — `<context>` and `<instructions>` have strong training signal across all models (Claude, GPT-4, Llama, Gemini). User instructions appear LAST, giving system rules positional authority.

```
LANGUAGE REQUIREMENT: All output MUST be in Brazilian Portuguese (PT-BR). No exceptions.

# Idioma: PT-BR obrigatório
Responda 100% em português brasileiro.
Se o usuário escreveu em inglês: entenda em inglês, responda em PT-BR.
Nomes de campos JSON permanecem em inglês.

# Persona
Você é um analista de YouTube especializado em otimização de canais pequenos/médios.
Seu papel: responder à pergunta do usuário usando APENAS os dados abaixo.
Comportamento: data-driven, sem especulação. Toda afirmação deve ser rastreável aos dados inline.
Não tente fazer requisições HTTP.
Se você tem capacidade de raciocínio interno, use-a para cruzar dados dos blocos JSON.
Estruture a resposta com subtítulos quando a análise tiver 2+ temas distintos.

## Guardrails
[hallucination prevention rules]

## Guia de Confiança
[confidence tiers]

<context>
```json
{contextJSON}
```
</context>

<instructions>
{userInstructions}
</instructions>
```

**Key design decisions:**
- **XML tags for structural boundaries:** `<context>` and `<instructions>` are well-trained patterns across all major LLMs. Novel separators (e.g., `======`) have zero training distribution and provide no structural signal to models.
- **Guardrails before instructions:** Prevents "ignore all previous instructions" attacks. The AI processes persona/rules first.
- **JSON in fenced code block:** ```` ```json ``` ```` inside `<context>` leverages code-block semantics. Prevents JSON values from being interpreted as instructions.
- **English meta-instruction for language:** English instructions about language requirements have stronger training signal cross-model than PT-BR meta-instructions.
- **Proper Portuguese accents:** `Não`, `Você`, `análise` — stronger linguistic signal.
- **Output format nudge in persona:** "Estruture a resposta com subtítulos" prevents wall-of-text responses without over-constraining format.

### Empty Instructions Gate

**No instructions = no prompt = no copy.** Matching `CoworkRequestPanel`:

```typescript
const prompt = useMemo(
  () => instructions.trim() ? buildYoutubePrompt({ instructions: instructions.trim(), preset, data }) : '',
  [instructions, preset, data]
)
// Copy button disabled when !prompt
```

### Data Strategy: Context Presets (Inline-First)

Each preset determines WHICH data is included as context.

| Preset | Data Included | Char Cost |
|--------|---------------|-----------|
| **Content Calendar** (default) | Search terms, categories, outliers, timing, recent uploads | ~3,000 chars |
| **Channel Health** | Health score, 6 axes, top/bottom videos, demographics, search terms, outliers, A/B results | ~4,500 chars |
| **Video Optimizer** | Per-video grade, retention curve, traffic sources, optimization state, channel baseline, thumbnail/title metadata | ~3,200 chars |
| **User instructions** | Free-form (capped at 2,000 chars) | up to 2,000 chars |
| **Shared base** | Persona, guardrails, confidence guide, language directive | ~1,750 chars |

### MODE 2: Deferred to Phase 2

Phase 1 prompts are **analysis-only**. In Phase 2, MODE 2 is added as an **explicit checkbox** (default OFF). When checked, the MODE 2 appendix is appended inside a `<mode2>` XML tag after `</instructions>`. When unchecked, it is not generated at all.

**Every prompt MUST include `Não tente fazer requisições HTTP` in the persona block**, even in Phase 1.

### System Persona (all prompts)

Embedded BEFORE user instructions:

```
# Persona
Você é um analista de YouTube especializado em otimização de canais pequenos/médios.
Seu papel: responder à pergunta do usuário usando APENAS os dados abaixo.
Comportamento: data-driven, sem especulação. Toda afirmação deve ser rastreável aos dados inline.
Não tente fazer requisições HTTP.
Se você tem capacidade de raciocínio interno, use-a para cruzar dados dos blocos JSON.
Estruture a resposta com subtítulos quando a análise tiver 2+ temas distintos.
```

### Thumbnail Handling

**In the modal (UI element, NOT in the prompt text):**
A callout box below the textarea — **shown only when Video Optimizer preset is selected AND the selected video has a `thumbnailUrl`**:
> "Para análise de thumbnail: abra a URL do thumbnail e cole como imagem no chat antes de colar o prompt."

**In the context JSON (for the AI):**
```json
{ "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcY/hqdefault.jpg" }
```

URLs validated by parsing with `new URL(url)`, checking `hostname === 'i.ytimg.com'` + strict path regex `/^\/vi\/[A-Za-z0-9_-]{11}\/[a-z]+\.jpg$/`, then **reconstructing** as `https://i.ytimg.com${pathname}` — dropping query/fragment by omission. YouTube video ID in URL path must match `video.youtube_video_id`. Rejected URLs are logged (not silently dropped) to aid debugging.

```typescript
// lib/youtube/prompt-sanitize.ts
export function sanitizeThumbnailUrl(url: string, expectedVideoId: string): string | null
```

### Input Sanitization

Three sanitization contexts — **never mix them**:

**For JSON-embedded values — `sanitizeForJson(text: string | null | undefined): string`:**
Returns `JSON.stringify(text ?? '').slice(1, -1)` — the escaped inner content WITHOUT outer quotes. Null/undefined inputs coerce to empty string. Relies on ES2019+ `JSON.stringify` which escapes U+2028/U+2029 and lone surrogates. No additional handling needed for modern runtimes (Node 18+).

**For markdown prose sections** (video titles in headers) — `sanitizeForMarkdown(text: string, maxLen?: number): string`:
- Replace `#` with `\#`, `` ` `` with `'`, `|` with `\|`
- Replace `---`, `===`, `***` with `- - -`
- Strip `<`, `>`, `{`, `}`, `[`, `]`
- Replace literal `\n` with space
- Strip Unicode format characters (category Cf)
- Enforce max length: titles 100 chars, descriptions 200 chars

**For user instructions — NO sanitization.** User instructions are intentional prose written by the user for their own AI session. Sanitizing them would break legitimate use cases. This matches the pipeline `buildPrompt` which passes `expandedInstructions` verbatim.

The security property against instruction spoofing is **positional authority** (instructions inside `<instructions>` tag, after all system content), not content filtering.

**Builder-level length validation (defense-in-depth):**
```typescript
function buildYoutubePrompt(options: BuildYoutubePromptOptions): string {
  const instructions = options.instructions.slice(0, 2000)
  // ...
}
```

```typescript
// lib/youtube/prompt-sanitize.ts
export function sanitizeForMarkdown(text: string, maxLen?: number): string
export function sanitizeForJson(text: string | null | undefined): string
export function sanitizeThumbnailUrl(url: string, expectedVideoId: string): string | null
export function estimateTokens(text: string): number    // chars / 3.0 (calibrated for PT-BR)
export function estimateChars(text: string): number     // identity (for display)
```

### Prompt Versioning

```typescript
// lib/youtube/prompt-types.ts
export const PROMPT_VERSIONS = {
  'channel-health': 'yt-ch-v8',
  'video-optimizer': 'yt-vo-v8',
  'content-calendar': 'yt-cc-v8',
} as const
```

## 3 Context Presets (Phase 1 MVP)

### 1. Content Calendar (default preset)

For small channels, "what should I create next and when?" is the highest-leverage question. Default because it works well even with minimal data and produces the smallest context (~3,000 chars).

**Context JSON:**
```json
{
  "_idioma": "pt-br",
  "preset": "content-calendar",
  "current_time": "2026-05-27T16:00:00-03:00",
  "channel": {
    "name": "tnfigueiredo",
    "subscribers": 1234,
    "videoCount": 35,
    "tier": "micro"
  },
  "searchTerms": [
    { "term": "bangkok shopping", "views": 1200, "estimatedMinutesWatched": 840 }
  ],
  "topPerformingCategories": [
    { "categorySlug": "tutorials", "categoryName": "Tutoriais", "avgViews": 500, "avgRetention": 48, "videoCount": 8 }
  ],
  "demographics": { "topAge": "25-34 (38%)", "topCountry": "Brasil (72%)", "topDevice": "Mobile (65%)" },
  "outlierSuccesses": [
    { "title": "...", "views": 1420, "modifiedZ": 2.8, "axis": "ctr" }
  ],
  "bestPerformingDay": "tuesday",
  "bestPerformingHour": 14,
  "recentUploads": [
    { "title": "...", "publishedAt": "2026-05-20T14:00:00Z", "categorySlug": "tutorials" }
  ],
  "snapshot_at": "2026-05-27T14:30:00-03:00",
  "snapshot_age_hours": 1.5,
  "prompt_version": "yt-cc-v8"
}
```

**Field mapping to codebase types:**
- `searchTerms` → **`fetchYtSearchTerms()` in analytics-client.ts** (direct call, NOT from intelligence GET). `IntelligenceTrafficSources.top_search_terms` has `{ term, views, ctr }` but NO `estimatedMinutesWatched`. The analytics API returns the correct fields.
- `topPerformingCategories` → `IntelligenceContentPatterns.by_category` (mapped from `CategoryPerformance`)
- `demographics` → **aggregated from `YtDemographics` via `fetchYtDemographics()`**: top entry from `ageGender[]`, `countries[]`, `devices[]` arrays with percentage (e.g., "25-34 (38%)")
- `outlierSuccesses` → computed via `computeOutliers()` from scoring.ts. `OutlierResult` has `{ videoId, axis, modifiedZ, direction }` — fetch function joins with `youtube_videos` for `title` and `view_count`.
- `bestPerformingDay` → `IntelligenceTrends.best_performing_day` (lowercase day name)
- `bestPerformingHour` → `IntelligenceTrends.best_performing_hour` (0-23 integer)
- `current_time` → `formatISO(new Date())` from date-fns (preserves local timezone offset `-03:00`)
- `snapshot_age_hours` → **computed server-side** in the fetch function: `(Date.now() - new Date(snapshotAt).getTime()) / 3_600_000`, rounded to 1 decimal. Server-side computation avoids client clock skew.

**Clickable example prompts (fill textarea on click):**
- "Qual nicho devo explorar no próximo vídeo?"
- "Melhor dia e hora para publicar?"
- "Que tópicos estão dando mais retenção?"

### 2. Channel Health (most comprehensive)

Full channel diagnostic context.

**Context JSON:**
```json
{
  "_idioma": "pt-br",
  "preset": "channel-health",
  "current_time": "2026-05-27T16:00:00-03:00",
  "channel": { "name": "tnfigueiredo", "subscribers": 1234, "videoCount": 35, "tier": "micro" },
  "healthScore": { "overall": 63, "axes": [
    { "axis": "ctr", "score": 52, "grade": "C", "benchmark": 50, "weight": 0.25 },
    { "axis": "retention", "score": 38, "grade": "D", "benchmark": 50, "weight": 0.25 },
    { "axis": "reach", "score": 60, "grade": "C", "benchmark": 50, "weight": 0.15 },
    { "axis": "engagement", "score": 70, "grade": "B", "benchmark": 50, "weight": 0.15 },
    { "axis": "growth", "score": 45, "grade": "C", "benchmark": 50, "weight": 0.12 },
    { "axis": "sub_impact", "score": 55, "grade": "C", "benchmark": 50, "weight": 0.08 }
  ]},
  "topVideos": [{ "id": "uuid", "youtubeVideoId": "dQw4w9WgXcY", "title": "...", "score": 80, "grade": "B", "retention": 48, "trend": "up", "lifecycleStage": "maturing" }],
  "bottomVideos": [{ "id": "uuid", "youtubeVideoId": "abc123XYZ-_", "title": "...", "score": 25, "grade": "D", "retention": 22, "trend": "down" }],
  "gradeDistribution": { "A": 0, "B": 5, "C": 18, "D": 12 },
  "demographics": { "topAge": "25-34 (38%)", "topCountry": "Brasil (72%)", "topDevice": "Mobile (65%)" },
  "searchTerms": [{ "term": "...", "views": 1200, "estimatedMinutesWatched": 840 }],
  "outliers": { "positive": [{ "title": "...", "modifiedZ": 2.8, "views": 1420 }], "negative": [{ "title": "...", "modifiedZ": -2.3, "views": 28 }] },
  "abTestResults": [{ "videoTitle": "...", "testType": "thumbnail", "winner": "B", "confidence": 0.96 }],
  "cyclesSummary": { "active": 2, "resolved": 1, "exhausted": 0 },
  "total_videos": 35,
  "showing_top_n": 5,
  "snapshot_at": "2026-05-27T14:30:00-03:00",
  "snapshot_age_hours": 1.5,
  "prompt_version": "yt-ch-v8"
}
```

**Field mapping:**
- `healthScore.axes` → computed from `AxisScore[]` (6 axes). `AxisScore` has `{ axis, raw, normalized, weight, weighted }` — fetch function computes `score` (from `normalized`), `grade` (from `GRADE_THRESHOLDS`), and `benchmark` (sigmoid midpoint via `SIGMOID_K`). NOT direct fields on `AxisScore`.
- `gradeDistribution` → A/B/C/D only. **No Grade "F" exists.**
- `topVideos/bottomVideos` → joined from `youtube_videos` + scoring data. `title` and `views` require DB join.
- `demographics` → aggregated from `YtDemographics` (same as Content Calendar)
- `total_videos` and `showing_top_n` make truncation explicit

**Minimum-data threshold:** If fewer than 10 scored videos exist, show a UI notice: "Dados insuficientes para diagnóstico completo — considere usar Content Calendar." The button is NOT disabled (user may still want partial analysis), but the notice steers toward the preset that works with minimal data.

**Clickable example prompts:**
- "O que está segurando o crescimento do canal?"
- "Quais vídeos devo otimizar primeiro?"
- "Compare meu CTR com o benchmark do canal"

### 3. Video Optimizer (per-video context)

Per-video focused context from the Video Optimizer drawer.

**Context JSON:**
```json
{
  "_idioma": "pt-br",
  "preset": "video-optimizer",
  "current_time": "2026-05-27T16:00:00-03:00",
  "video": {
    "id": "uuid", "youtubeVideoId": "dQw4w9WgXcY",
    "title": "...", "thumbnailUrl": "...",
    "duration": "38:51", "publishedAt": "2026-04-15", "ageDays": 42,
    "lifecycleStage": "maturing", "viewCount": 118,
    "thumbnailTags": ["face_close", "text_overlay", "bright_colors"],
    "titlePattern": "how_to"
  },
  "grade": {
    "score": 63, "grade": "C",
    "axes": [
      { "axis": "ctr", "score": 52, "channelMedian": 48, "status": "above" },
      { "axis": "retention", "score": 38, "channelMedian": 45, "status": "below" }
    ],
    "trend": "up", "streak": 3
  },
  "retentionCurve": [100, 85, 72, 60, 52, 45, 40, 38, 35, 33],
  "trafficSources": { "browse": 45, "search": 25, "suggested": 20, "other": 10 },
  "optimizationState": "flagged",
  "cycleNumber": 1,
  "maxCycles": 5,
  "cooldownUntil": null,
  "previousDiagnosis": null,
  "channelBaseline": { "medianCtr": 3.6, "medianRetention": 45 },
  "snapshot_at": "2026-05-27T14:30:00-03:00",
  "snapshot_age_hours": 1.5,
  "prompt_version": "yt-vo-v8"
}
```

**Clickable example prompts:**
- "Por que a retenção deste vídeo está baixa?"
- "Sugira uma nova thumbnail para melhorar CTR"
- "O que posso melhorar no título?"

## Phase 2 Design Sketches

### 4. Analytics Deep Dive

Single context preset with ALL analytics data inline (~600-800 tokens).

### 5. A/B Test Generator

No explicit gate. If `abTestResults` is empty, it is omitted from context. Persona includes soft note: "Para canais sem dados de A/B testing: foque em otimização de conteúdo existente."

### MODE 2: API Write-Back (Phase 2)

Added as an **explicit checkbox** (default OFF, label: "Incluir instruções de API write-back"). When checked, appendix inside `<mode2>` XML tag after `</instructions>`. When unchecked, not generated.

**PATCH body schema (post-reconciliation target):**
```json
{
  "task_id": "<uuid>",
  "prompt_version": "yt-ch-v8",
  "video_recommendations": [{
    "video_id": "<uuid>",
    "action_type": "thumbnail_redesign | title_rewrite | description_seo | ab_test_thumb | ab_test_title | retention_fix | content_strategy | publish_timing | series_opportunity | chapters_add | end_screen_optimize | pinned_comment",
    "priority": "high | medium | low",
    "confidence": "high | medium | low",
    "reasoning": "Max 500 chars, PT-BR",
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
    "type": "ctr_drop | grade_drop | stagnant_after_test | optimization_opportunity | viral_detection | retention_cliff | search_surge | milestone_approaching | ab_test_ready | optimization_resolved",
    "video_id": "<optional uuid>",
    "priority": 1-5,
    "title": "Max 100 chars",
    "message": "Max 500 chars"
  }],
  "channel_insights": {
    "prompt_version": "yt-ch-v8",
    "patterns_detected": [{
      "pattern_id": "pat_<8 lowercase alphanumeric>",
      "category": "thumbnail_style | title_pattern | content_type | publish_timing | duration_sweet_spot | traffic_source | engagement_driver | retention_pattern | growth_lever",
      "finding": "Max 300 chars",
      "confidence": "high | medium | low",
      "sample_size": 0-1000
    }],
    "analysis_text": "Max 2000 chars"
  }
}
```

**Constraints:** Max 25 recommendations, 20 notifications, 6 coaching priorities per PATCH.

## Phase 3: Direct AI API (trigger condition)

**Trigger:** 8 unique days of prompt copy usage over 4 weeks (tracked via `logPromptCopy` with day-of-copy dedup). Proves sustained habit, not a burst of curiosity.

Phase 3 scope: server-side prompt execution via AI SDK, response storage, "This week's insights" dashboard card.

## Prompt-Wide Standards

### Hallucination Guardrails

```
## Guardrails
- APENAS cite números que aparecem nos dados inline.
- Se não tem um dado, diga "dados insuficientes" — NÃO estime.
- Toda afirmação deve ser rastreável: "Retenção do vídeo X é 38% (inline data)".
- NÃO emita padrão com sample_size < 5 vídeos.
- Se sample_size < 5, confiança DEVE ser medium ou low (nunca high).
- NÃO infira causalidade de correlação. Diga "correlação observada" quando apropriado.
- NÃO cite benchmarks externos (ex: "média da indústria"). Use APENAS os benchmarks do JSON inline.
- NÃO referencie vídeos que NÃO estão nos dados.
- NÃO invente video_id, URLs, ou identificadores.
- Se snapshot_age_hours > 48, recomende re-execução do prompt com dados atualizados.
```

### Confidence Guide

```
## Guia de Confiança

Três faixas — use APENAS as categorias (strings), sem valores numéricos:

- "high": Padrão claro com 5+ data points. Se sample_size < 5: nunca use "high".
- "medium": 2-4 data points ou correlação observada.
- "low": 1 data point ou especulação baseada em dado único.
- Abaixo de "low": NÃO inclua como recomendação.

Prefira sub-estimar confiança.
```

### Language Directive

```
LANGUAGE REQUIREMENT: All output MUST be in Brazilian Portuguese (PT-BR). No exceptions.

# Idioma: PT-BR obrigatório
Responda 100% em português brasileiro.
Se o usuário escreveu em inglês: entenda em inglês, responda em PT-BR.
Nomes de campos JSON permanecem em inglês.
Valores string no output DEVEM ser em PT-BR.
```

The language constraint is also embedded in the `<instructions>` section header: `<instructions lang="pt-br">`. No trailing reminder needed — the English meta-instruction at the top and the XML attribute provide sufficient signal.

### Null Data Handling

When context data sections are null/empty, **omit them entirely** from the JSON. Models naturally handle missing keys — the guardrail "Se não tem um dado, diga dados insuficientes" already covers this.

### Token Budgets

| Component | Characters | Tokens (est. @ 3.0 chars/tok for PT-BR) |
|-----------|-----------|---------------|
| User instructions (max) | 2,000 chars | ~670 tokens |
| Shared base (persona, guardrails, confidence, language) | ~1,750 chars | ~580 tokens |
| Content Calendar context | ~3,000 chars | ~1,000 tokens |
| Channel Health context | ~4,500 chars | ~1,500 tokens |
| Video Optimizer context | ~3,200 chars | ~1,070 tokens |
| **Total max (CH + instructions)** | **~8,250 chars** | **~2,750 tokens** |

**Character count shown only when total exceeds 6,000 chars.** Below that, no counter in the footer.

**Overflow protection:** Applied in the **fetch layer** (server actions), NOT the prompt builder. Server actions cap data at: top 5 + bottom 3 videos, top 5 search terms when serialized context would exceed 5,000 chars. Server action adds `"truncated": true`. The prompt builder is a **pure serializer** that never mutates its input.

### Small Channel Calibration

For channels with `getChannelTier(subscriberCount) === 'nano'` (< 1K subs):
- Persona includes: "Canal nano — foque em discoverability via search, long-tail keywords."

### Analytics Events

```typescript
// Fired on every prompt copy
logPromptCopy(preset: ContextPreset, charCount: number, snapshotAgeHours: number)

// Phase 2 gate: at least 2 presets used in a 7-day window
// Phase 3 trigger: 8 unique days over 4 weeks
```

Server-side via lightweight fire-and-forget POST with session validation.

## UI Design

### 2 Levels of Buttons

**Level 1 — YouTube Header (primary CTA):**
Large gradient button: "Copy Cowork Prompt" in indigo gradient. Opens main YouTube prompt modal. Always visible.

**Level 2 — Per-Item (inline actions):**
- Video table rows: icon button with **text labels on hover/focus**
- In Video Optimizer drawer: "Copiar Prompt" + "Abrir no Claude"
- Each: `text-[11px] border border-border` (minimum 11px for readability)

### YouTube Prompt Modal (textarea-first)

**File:** `apps/web/src/app/cms/(authed)/youtube/_components/youtube-cowork-prompt-modal.tsx`

**Layout (top to bottom):**

1. **Header**: "YouTube Cowork Prompt" + channel name + close button
2. **Context preset selector**: 3 cards in a row. **Content Calendar highlighted by default.** Each card shows: icon, name, data description, character estimate.
   - Channel Health card: shows "Dados insuficientes" notice when < 10 scored videos
3. **Video selector** (conditional: Video Optimizer only): combobox with `role="combobox"`, thumbnail + title + grade. Max 50 videos, debounced 300ms.
4. **Textarea**: Free-form instructions. Placeholder varies by preset. Max length: 2,000 chars.
   - Persistent hint below textarea (11px, muted): "Contexto do canal será incluído automaticamente abaixo."
   - **Clickable example prompts** (2-3 per preset): below hint, `text-xs text-indigo-400 cursor-pointer`. Clicking fills textarea with the example text.
5. **Thumbnail callout** (conditional: Video Optimizer + thumbnailUrl, amber left border): "Para análise de thumbnail: cole a imagem no chat antes do prompt."
6. **Staleness warning** (conditional, amber badge): "Dados desatualizados (última sync: Xh atrás)" when `snapshot_age_hours > 24`.
7. **Prompt preview**: Two-section layout:
   - **Top section** (always visible): user instructions
   - **Bottom section** (collapsible, **default collapsed**): context JSON + guardrails. Label: "Contexto ({N} caracteres)"
8. **Footer**:
   - Left: character count shown **only when > 6,000 chars**
   - Right: "Cancelar" (ghost) + "Abrir no Claude" (secondary, disabled when `chars > 8,000` or real key embedded, privacy tooltip: "Prompt aparecerá no histórico do navegador") + "Copiar Prompt" (primary indigo gradient, **disabled when textarea is empty**, keyboard shortcut platform-aware: `Cmd+Enter` on macOS, `Ctrl+Enter` elsewhere)

**Pipeline Key handling:**
- `usePipelineKey(siteId)` hook — reads `cowork-pipeline-key-${siteId}`. Migration: check if scoped key exists first → if not, read old unscoped → write scoped → delete old → set `migrated-cowork-key` flag to prevent re-running.
- Default: `[SUA-KEY]` placeholder in MODE 2 section (Phase 2)
- **Key-in-clipboard guard**: on copy, scan prompt for strings matching `/pk_[a-zA-Z0-9]{20,}/`. Show amber toast if found.
- **Disable "Open in Claude" when real key is embedded.**

**State management:**
```typescript
const [preset, setPreset] = useState<ContextPreset>('content-calendar')
const [instructions, setInstructions] = useState('')
const [selectedVideo, setSelectedVideo] = useState<VideoRow | null>(null)

const prompt = useMemo(
  () => instructions.trim() ? buildYoutubePrompt({ preset, data, instructions: instructions.trim() }) : '',
  [instructions, preset, data]
)
```

**Fetch cancellation:** Each preset switch creates a new `AbortController`, cancelling any in-flight fetch. Server actions accept `signal: AbortSignal`.

### Video Optimizer Drawer

**File:** `apps/web/src/app/cms/(authed)/youtube/videos/video-optimizer-drawer.tsx`

The drawer has a **compact textarea** for quick instructions. **3 lines minimum** (`min-h-[72px]`), expandable to 5 lines max before scrolling. Placeholder: "O que quer melhorar neste vídeo? Ex: O CTR caiu de 5% para 3%"

**Decomposed into sub-components (6):**

```
video-optimizer-drawer.tsx          <- orchestrator
├── _components/
│   ├── drawer-header.tsx           <- title (line-clamp-2) + close + optimization badge
│   ├── thumbnail-with-grade.tsx    <- 16:9 thumbnail + grade badge overlay
│   ├── video-stats-card.tsx        <- metrics grid + retention sparkline + traffic sources text
│   ├── cms-notes-editor.tsx        <- textarea + 800ms debounce auto-save + status indicator
│   ├── drawer-prompt-section.tsx   <- compact textarea + copy/claude buttons
│   └── data-freshness-badge.tsx    <- amber badge when lastSyncedAt > 24h
```

**Props (orchestrator):**
```typescript
interface VideoOptimizerDrawerProps {
  video: VideoRow | null
  onClose: () => void
  onCreateAbTest: (videoId: string, testType: string) => void
  onSaveNotes: (videoId: string, notes: string, version: number) => Promise<{ version: number }>
}
```

## Component Architecture

```
apps/web/src/
├── app/cms/(authed)/youtube/
│   ├── _components/
│   │   └── youtube-cowork-prompt-modal.tsx   <- main modal
│   ├── videos/
│   │   ├── video-optimizer-drawer.tsx        <- orchestrator
│   │   ├── _components/                     <- 6 sub-components
│   │   └── actions.ts                       <- per-video fetch + saveVideoNotes()
│   ├── _actions/
│   │   └── youtube-actions.ts               <- channel-level fetch + truncation + snapshot_age_hours
│   └── layout.tsx                           <- + header "Copy Cowork Prompt" button
├── lib/youtube/
│   ├── prompt-builders.ts                   <- buildYoutubePrompt() + 3 context serializers
│   ├── prompt-types.ts                      <- TypeScript interfaces + PROMPT_VERSIONS const
│   └── prompt-sanitize.ts                   <- sanitize functions + estimateTokens (3.0 chars/tok)
├── hooks/
│   └── use-pipeline-key.ts                  <- shared hook (read/write/migration + atomic cleanup)
└── components/
    └── prompt-preview.tsx                   <- simple <pre> (React children, NEVER dangerouslySetInnerHTML)
```

### Prompt Builder Function (discriminated union + exhaustive switch)

```typescript
// lib/youtube/prompt-builders.ts

type BuildYoutubePromptOptions =
  | { preset: 'channel-health'; data: ChannelHealthData; instructions: string }
  | { preset: 'video-optimizer'; data: VideoOptimizationData; video: VideoRow; instructions: string }
  | { preset: 'content-calendar'; data: ContentCalendarData; instructions: string }

export function buildYoutubePrompt(options: BuildYoutubePromptOptions): string {
  const instructions = options.instructions.slice(0, 2000)
  const base = buildSharedBase(options.data.channel.tier)

  let context: string
  switch (options.preset) {
    case 'channel-health':
      context = serializeChannelHealthContext(options.data)
      break
    case 'video-optimizer':
      context = serializeVideoOptimizerContext(options.data, options.video)
      break
    case 'content-calendar':
      context = serializeContentCalendarContext(options.data)
      break
    default:
      assertNever(options) // compile-time exhaustiveness check
  }
  // ... assemble prompt
}
```

**Output structure (Phase 1):**
```
LANGUAGE REQUIREMENT: All output MUST be in Brazilian Portuguese (PT-BR). No exceptions.

{sharedBase}

<context>
```json
{contextJSON}
```
</context>

<instructions lang="pt-br">
{instructions}
</instructions>
```

### Shared View Types (prompt-types.ts)

```typescript
interface VideoGradeRow {
  id: string
  youtubeVideoId: string
  title: string
  score: number
  grade: Grade
  retention: number
  trend: TrendDirection
  lifecycleStage?: VideoLifecycle
  thumbnailTags?: string[]
  titlePattern?: string
}

interface OutlierRow {
  title: string
  modifiedZ: number
  views: number
  axis?: Axis
}

interface AbTestResultRow {
  videoTitle: string
  testType: string
  winner: string
  confidence: number
}
```

### Computed Field Provenance

| Field | Source | Computation |
|-------|--------|-------------|
| `healthScore.axes[].score` | `AxisScore.normalized` | Direct mapping (0-100) |
| `healthScore.axes[].grade` | computed | `GRADE_THRESHOLDS` from `scoring-types.ts`: A>=85, B>=65, C>=40, D<40 |
| `healthScore.axes[].benchmark` | `ChannelBaseline` + `SIGMOID_K` from `scoring-types.ts` | Sigmoid midpoint |
| `grade.axes[].channelMedian` | `ChannelBaseline` | Direct: `medianCtr`, `medianRetention` |
| `grade.axes[].status` | computed | `score >= channelMedian ? 'above' : 'below'` |
| `snapshot_age_hours` | **computed server-side** | `(Date.now() - new Date(snapshotAt).getTime()) / 3_600_000`, rounded to 1 decimal |
| `lifecycleStage` | computed | `getVideoLifecycle(ageDays)` |
| `demographics` | `fetchYtDemographics()` | Aggregated: top entry from each array + percentage |

## Edge Cases

### Textarea + Prompt Generation
| Case | Handling |
|------|----------|
| Empty textarea | Copy button disabled, preview shows nothing (gate) |
| Whitespace-only textarea | Treated as empty (`.trim()` gate) |
| Instructions > 2,000 chars | `maxLength` on textarea + builder-level `slice(0, 2000)` |
| Instructions in English | Allowed — persona says "entenda em inglês, responda em PT-BR" |
| Instructions reference videos not in context | AI guardrail: "NÃO referencie vídeos que NÃO estão nos dados" |
| No channels configured | Disable all buttons, show "Connect a channel first" |
| 0 videos (new channel) | Omit video-related fields |
| < 10 scored videos | Channel Health shows "Dados insuficientes" notice (not disabled) |
| 50+ videos | Truncation in fetch layer. `truncated: true` in data. |
| snapshot_age_hours > 24 | UI amber badge BEFORE copy |
| snapshot_age_hours > 48 | Guardrail: AI recommends re-running |
| Preset switch with non-empty textarea | Instructions persist, context changes |
| Key accidentally in textarea | On copy, scan for `pk_` regex → amber toast |
| Rapid preset switching | AbortController cancels in-flight fetches |
| Example prompt clicked | Fills textarea, does NOT append to existing text |

### Accessibility
- Textarea in modal: `aria-label="Instruções para o AI"`, auto-focus on open
- Textarea in drawer: `aria-label="O que quer melhorar neste vídeo?"`, not auto-focused
- Character counter: `aria-live="polite"` when shown
- Focus trap in modal, focus rings, Escape closes
- Combobox: `role="combobox"`, `aria-expanded`, keyboard navigation
- Preset selector: `role="radiogroup"`, arrow key navigation
- Keyboard shortcut: platform-aware (Cmd/Ctrl+Enter)

### Security
- User instructions: NOT sanitized (positional authority via XML tags, not content filtering)
- **Builder-level length cap:** `instructions.slice(0, 2000)`
- **XML structural boundaries:** `<context>` and `<instructions>` provide model-recognized separation
- **Thumbnail URL reconstruction:** Parse → validate → reconstruct (drops query/fragment by omission). Rejected URLs logged.
- Key-in-clipboard guard: `/pk_[a-zA-Z0-9]{20,}/` regex on copy
- "Open in Claude": disabled when key embedded, privacy tooltip, `encodeURIComponent` on prompt body, disabled when encoded length > 8,000 chars
- Key migration: atomic (check scoped first, migrate once, set flag, delete old)
- Preview: React children only, **NEVER `dangerouslySetInnerHTML`**
- `logPromptCopy`: server-side POST with session validation

## Visual Style

Use existing CMS color system (`--cms-*` tokens). Indigo accent (`#6366f1`) for prompt-related buttons. Fix `#da3633` red → `#f85149` for WCAG AA compliance.

## Implementation Notes

1. **Canonicalize SIGMOID_K + GRADE_THRESHOLDS + ChannelTier** — delete duplicates from intelligence-types.ts
2. **Add `bestPublishDay/Hour` computation** from `published_at` dates
3. **Impressions data** currently hardcoded to 0. Sub_impact axis dead weight until real.
4. **Per-video intelligence query** — add `?video_id=X` to GET endpoint
5. **`top_search_terms.ctr`** — make optional or remove (never populated). Content Calendar uses `fetchYtSearchTerms()` directly for `estimatedMinutesWatched`.
6. **`prompt-preview.tsx`** — simple `<pre>` with React children
7. **`logPromptCopy`** — server-side POST, records `preset + charCount + snapshotAgeHours + day-of-copy`
8. **Truncation in fetch layer** — server actions cap data, builder is pure serializer
9. **`snapshot_age_hours`** — computed server-side in fetch functions, not client-side
10. **`_idioma`** — present in all context JSON as field (position irrelevant per RFC 8259)
11. **`AbortController`** — per preset switch, cancels in-flight fetch
12. **`assertNever`** — exhaustive switch in builder for Phase 2 preset additions

## Implementation Estimate (Phase 1 MVP — ~25h)

| Component | Effort |
|-----------|--------|
| **Prerequisites** (version column + constant canonicalization) | 1.5h |
| `prompt-builders.ts` + `prompt-types.ts` + `prompt-sanitize.ts` | 2h |
| `youtube-cowork-prompt-modal.tsx` (textarea + 3 presets + preview + examples) | 3.5h |
| `video-optimizer-drawer.tsx` + 6 sub-components | 3.5h |
| Fetch functions (video + channel-health + content-calendar + truncation + snapshot_age) | 3h |
| `usePipelineKey()` shared hook + atomic migration | 0.5h |
| Header button + layout integration | 0.5h |
| Per-row video buttons (Level 2) | 0.5h |
| Tests | **10h** |
| **Total Phase 1** | **~25h** |

### Test Plan (~190 cases, 10h)

**Prompt sanitization (30 cases, ~1h):**
- `sanitizeForMarkdown`: `#`, backtick, `|`, `---`, `===`, `***`, `<tag>`, `<|endoftext|>`, `{`, `}`, `[`, `]`, `\n`, combined injection, empty string, Unicode Cf, max length, null guard
- `sanitizeForMarkdown` adversarial: XML tag injection (`</context>`), Unicode RTL override, zero-width space, surrogate pairs, nested escape sequences, video title containing "Ignore all previous instructions"
- `sanitizeForJson`: JSON.stringify delegation, special chars, control chars, null→empty, undefined→empty, `</script>` tag, lone surrogate pair, string at 2000-char boundary
- `sanitizeThumbnailUrl`: valid URL, wrong hostname, path traversal, query params stripped, `javascript:` blocked, data URI blocked, hostname spoofing (`i.ytimg.com.evil.com`), video ID mismatch, malformed URL, logged rejection
- `estimateTokens`: empty→0, known string, PT-BR Unicode (3.0 chars/tok)

**Prompt builder (30 cases, ~1.5h):**
Value-assertion tests per preset:
- Empty instructions → returns empty string (gate test)
- Short instructions → valid prompt with user text in `<instructions>` tag
- Builder-level `slice(0, 2000)` enforcement
- Given fixture `normalized=52`, assert `score=52, grade="C"` in context JSON
- Context JSON has correct fields and `prompt_version` from `PROMPT_VERSIONS` const
- `_idioma` field present in context JSON
- `snapshot_age_hours` correctly computed from server-side fixture
- Null data → field omitted
- Language directive at top (English meta) + `lang="pt-br"` attribute on `<instructions>`
- Persona includes "Não tente fazer requisições HTTP"
- Persona before `<context>`, `<context>` before `<instructions>` (positional order)
- JSON wrapped in fenced code block inside `<context>`
- Nano channel calibration differences
- `thumbnailTags` and `titlePattern` present when data available
- Output format nudge in persona ("Estruture a resposta com subtítulos")

**Discriminated union + exhaustiveness (3 cases):**
- Correct preset + data combination compiles
- Mismatched preset + data is compile-time error
- `assertNever` catches unhandled preset at compile time

**Fetch-layer tests (10 cases, ~45 min):**
- Truncation threshold: > 5,000 chars triggers capping
- Top 5 + bottom 3 video counts after truncation
- `truncated: true` flag added when capped
- `estimatedMinutesWatched` source: from `fetchYtSearchTerms()` not intelligence GET
- `snapshot_age_hours` server-side computation from UTC timestamp
- `snapshot_age_hours` boundary: 23.9h vs 24.1h
- `snapshot_age_hours` zero-age (just synced)
- `snapshot_age_hours` with timezone-offset string input
- `demographics` aggregation from array to summary string
- Null-data field omission at fetch level

**Modal component (35 cases, ~1.5h):**
- Preset selector: 3 presets render, Content Calendar default
- Video selector: combobox for Video Optimizer, hidden for others
- Textarea: empty = disabled, whitespace = disabled, typing enables, persists across presets, max 2000 chars, auto-focus
- **Clickable examples: fill textarea on click, replace (not append)**
- **Minimum-data notice: shown for Channel Health with < 10 scored videos**
- Preview: two-section (collapsed default), context chars shown in label
- Copy: platform-aware keyboard shortcut, toast, audit
- Open in Claude: correct URL, `encodeURIComponent`, disabled when > 8,000 encoded chars or real key, privacy tooltip
- Key-in-clipboard guard: regex `/pk_[a-zA-Z0-9]{20,}/` scan
- Pipeline key: atomic migration with flag
- Focus trap, escape closes, loading skeleton, error banner
- Character count only when > 6,000 chars
- Staleness badge when snapshot_age_hours > 24
- Thumbnail callout: Video Optimizer + thumbnailUrl only
- AbortController: cancels fetch on preset switch

**Security test suite (15 cases, ~45 min):**
- Thumbnail URL: valid, wrong hostname, path traversal, query stripped, `javascript:` blocked, data URI blocked, hostname spoofing blocked, rejection logged
- Key detection: `pk_` regex in instructions (toast), `pk_` substring in video title (no false positive), partial key match
- Builder enforces 2000 char cap
- "Open in Claude" disabled when key embedded
- Preview renders via React children (no innerHTML)
- URL encoding: PT-BR accents encoded correctly, encoded length check
- `logPromptCopy`: server-side validation

**Drawer component (28 cases, ~1.5h):**
- Compact textarea: 3 lines min, 5 lines max, example placeholder
- Empty textarea = copy disabled
- All drawer sub-component rendering
- CMS notes: debounce, optimistic locking, version conflict

**Accessibility (12 cases, ~30 min):**
- Textarea ARIA labels (modal + drawer)
- Character counter `aria-live="polite"`
- Focus trap + keyboard navigation
- Combobox + radiogroup roles
- Escape closes, focus rings
- Platform-aware shortcut display

**Integration tests (14 cases, ~1h):**
- Full modal flow: open → select preset → type instructions → copy → validate XML structure
- Drawer flow: open → type → copy → validate
- Empty textarea: try copy → verify disabled
- Preset switch: instructions persist + context changes + fetch cancelled
- Error: 403/404/500 handled
- SessionStorage persistence
- Modal → drawer handoff
- Key migration: atomic, old key deleted, flag set
- Key-in-clipboard detection
- Concurrent save conflict (409)
- Staleness badge at threshold
- Truncation indicator from fetch layer
- Example prompt click → fills textarea
- Minimum-data notice for Channel Health

**Concurrency tests (7 cases, ~30 min):**
- `saveVideoNotes` version conflict → 409
- Concurrent modal + drawer open (same video): independent state
- Rapid preset toggling: AbortController prevents stale data
- Key migration: both tabs → scoped key exists after both complete
- Key migration: tab opens post-migration → reads scoped directly
- Old unscoped key deleted after migration
- Migrated flag prevents re-running

## Scoring (Round 6 — 8 Critics, avg 74/100)

| Dimension | R5 | R6 | Rev 8 Changes |
|-----------|-----|-----|---------------|
| Prompt engineering | 72 | 78 | XML tags, confidence fully categorical, output format nudge, no trailing reminder |
| UX/UI design | 72 | 71 | Content Calendar default, clickable examples, collapsed preview default, 8K Claude threshold, platform-aware shortcut |
| Architecture | 72 | 78 | snapshot_age server-side, assertNever exhaustiveness, AbortController, estimateTokens 3.0 for PT-BR, lone surrogate note |
| Data completeness | 78 | 74 | ChannelTier + GRADE_THRESHOLDS canonicalized, demographics mapping documented, coaching reconciliation added |
| Security | 72 | 74 | Atomic key migration with flag, URL encodeURIComponent, preview no innerHTML, logPromptCopy server-side, pk_ regex |
| Test coverage | 52 | 72 | Fetch-layer suite (10), snapshot boundary tests (4), sanitizeForJson adversarial (3), URL tests (3), concurrency expanded (7) |
| AI portability | 58 | 74 | XML tags replace custom separator, confidence strings only, _idioma position-agnostic, lang attribute on instructions |
| Product strategy | 52 | 71 | Phase 3 trigger: 8 unique days/4 weeks, logPromptGenerated analytics, minimum-data threshold, 25h with 10h tests |
