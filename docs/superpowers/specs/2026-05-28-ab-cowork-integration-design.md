# AB Lab — Cowork Integration Redesign

> **Rev 2** — 2026-05-28
> Replaces Rev 1 (clipboard-only brainstorm). Phase 1 scope.

## Goal

Transform Step "Ideias" from a clipboard-copy advisory flow into a Cowork-integrated workflow where the AI assistant generates ideas in an external Claude conversation and populates variant slots B/C/D via REST API calls. Add locale-aware prompt generation, batch variant upsert endpoint, SWR polling for external variant detection, and optional review loop with multimodal analysis.

## Architecture

```
Wizard Step 1 (Tipo)
  -> User picks test type + video
  -> Draft test created (status='draft') -> gets test_id
  |
Wizard Step 2 (Ideias) -- REDESIGNED
  1. Prompt generated with locale (pt/en) from youtube_channels
  2. Prompt rendered on page, user copies to clipboard
  3. User pastes in Cowork, discusses ideas
  4. Cowork POST /api/pipeline/youtube/ab-tests/:id/variants
     -> batch upserts slots B, C, D via API
  5. Wizard detects variants (SWR polling 5s)
  6. Variant cards render inline with fade-in
  |
Wizard Step 3 (Variantes)
  -> User reviews/edits populated variants
  -> Optional: copy review prompt for Cowork evaluation (blob URLs)
  |
Steps 4-5 (Config -> Revisar -> Launch)
  -> status changes from 'draft' -> 'running'
```

**Key decisions:**

1. **Same external flow** as pipeline Cowork (copy prompt -> Claude -> API calls back). No Cowork embedding.
2. **Early draft creation** at Step 1 so Cowork has a `test_id` for API calls.
3. **Batch variant upsert** — single POST with array of variants. Two-phase: validate all first, execute all only if validation passes (all-or-nothing).
4. **SWR polling** (already installed, used in `pipeline-overview.tsx`) with 5s interval.
5. **Dynamic locale** from `youtube_channels.locale` ('pt'|'en').
6. **Type-specific flows:** title/description = direct text, thumbnail = creative directions + `ai_image_prompt`, combo = mix.
7. **Review loop** — optional prompt with Vercel Blob URLs (permanent, public) for multimodal evaluation.
8. **Last-write-wins** on variant upsert — Cowork can overwrite user edits on the same label. No conflict dialog in Phase 1.

**New code estimate:** ~700 lines (route handler, Zod schemas, prompt builder, wizard changes, cron cleanup).

---

## 1. Database Migration

### 1.1 UNIQUE index for upsert (REQUIRED)

The batch upsert uses `ON CONFLICT (test_id, label) DO UPDATE`. Currently **no UNIQUE constraint exists** on `(test_id, label)` in `ab_test_variants`.

```sql
CREATE UNIQUE INDEX IF NOT EXISTS ab_test_variants_test_id_label_idx
  ON public.ab_test_variants(test_id, label);
```

### 1.2 Performance index

RLS subqueries and SWR polling join on `test_id`. No index exists.

```sql
CREATE INDEX IF NOT EXISTS ab_test_variants_test_id_idx
  ON public.ab_test_variants(test_id);
```

### 1.3 Migration file

Create via `npm run db:new ab_variants_indexes`:

```sql
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS ab_test_variants_test_id_label_idx
  ON public.ab_test_variants(test_id, label);

CREATE INDEX IF NOT EXISTS ab_test_variants_test_id_idx
  ON public.ab_test_variants(test_id);

COMMENT ON COLUMN public.ab_test_variants.metadata IS
  'Cowork-facing metadata: thumbnail_tags, title_pattern, emotional_triggers, visual_description, ai_image_prompt, creative_direction, rationale';

COMMIT;
```

---

## 2. Type System & Validation

### 2.1 VariantMetadata update

**File:** `apps/web/src/lib/youtube/ab-types.ts`

```typescript
export interface VariantMetadata {
  thumbnail_tags?: string[]
  title_pattern?: string
  emotional_triggers?: string[]
  visual_description?: string
  ai_image_prompt?: string      // Midjourney/DALL-E prompt for thumbnail generation
  creative_direction?: string   // Human-readable creative direction for thumbnails
  rationale?: string            // Why this variant was chosen by Cowork
}
```

### 2.2 New Zod schemas

**File:** `apps/web/src/lib/youtube/ab-schemas.ts` (NEW)

```typescript
import { z } from 'zod'

export const VariantMetadataSchema = z.object({
  thumbnail_tags: z.array(z.string().max(50)).max(10).optional(),
  title_pattern: z.string().max(200).optional(),
  emotional_triggers: z.array(z.string().max(50)).max(10).optional(),
  visual_description: z.string().max(2000).optional(),
  ai_image_prompt: z.string().max(1000).optional(),
  creative_direction: z.string().max(2000).optional(),
  rationale: z.string().max(1000).optional(),
})

export const VariantPayloadSchema = z.object({
  label: z.enum(['B', 'C', 'D']),
  title_text: z.string().max(200).nullable().optional(),
  description_text: z.string().max(5000).nullable().optional(),
  metadata: VariantMetadataSchema.nullable().optional(),
})

export const BatchVariantUpsertSchema = z.object({
  variants: z.array(VariantPayloadSchema).min(1).max(3),
})
```

### 2.3 Retrofit validation on existing `createTextVariant`

Add `VariantMetadataSchema.safeParse()` on `input.metadata` inside `actions.ts:createTextVariant()`. Hardens the existing server action without breaking the current flow.

---

## 3. API Endpoint: Variant CRUD

### 3.1 Route file

**Path:** `apps/web/src/app/api/pipeline/youtube/ab-tests/[id]/variants/route.ts`

Three HTTP methods in one file, following existing pipeline patterns (`authenticateRead`/`authenticateWrite`, `pipelineSuccess`/`pipelineError`, `parseBody`, `UUID_REGEX`).

#### POST — Batch upsert variants

**Two-phase validation** (following `batch-sections` pattern):
1. Phase 1: Validate all variants (type-specific requirements, label validity)
2. Phase 2: Execute all upserts (only if Phase 1 passes completely)

Request:
```json
{
  "variants": [
    {
      "label": "B",
      "title_text": "Why Bangkok's MBK Center Is NOT What You Think",
      "description_text": null,
      "metadata": {
        "rationale": "Contrarian hook + curiosity gap"
      }
    },
    {
      "label": "C",
      "title_text": "I Spent 24h at MBK Center",
      "metadata": {
        "creative_direction": "Warm tones, close-up reaction shot",
        "ai_image_prompt": "youtuber surprised face, Bangkok mall, warm orange tones",
        "rationale": "Time-boxed challenge format"
      }
    }
  ]
}
```

**Validation is all-or-nothing:** If any variant fails Phase 1, the entire batch is rejected with 400. No partial writes occur.

Success response:
```json
{
  "data": {
    "results": [
      { "label": "B", "ok": true, "id": "uuid-1" },
      { "label": "C", "ok": true, "id": "uuid-2" }
    ],
    "summary": { "total": 2, "succeeded": 2, "failed": 0 }
  }
}
```

Error response (any validation failure rejects all):
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Variant B: title_text required for title tests; Variant C: label must be B, C, or D"
  }
}
```

**Guards:**
- `authenticateWrite(req)` — pipeline key auth
- Test exists + `status === 'draft'` + `site_id === auth.siteId`
- Zod validation via `BatchVariantUpsertSchema.safeParse(body)`
- Upsert: `ON CONFLICT (test_id, label) DO UPDATE` (last-write-wins)

**Type-specific validation:**

| test_type | title_text | description_text | metadata fields |
|-----------|-----------|-----------------|-----------------|
| title | REQUIRED | optional | accepted, stored as-is |
| description | optional | REQUIRED | accepted, stored as-is |
| thumbnail | optional | optional | creative_direction recommended (not enforced) |
| combo | REQUIRED | optional | creative_direction recommended (not enforced) |

"Recommended" means the review prompt will flag missing fields but the API accepts the request.

**Error codes:**
- `VALIDATION_ERROR` (400) — Zod parse failure or type-specific requirement unmet
- `NOT_FOUND` (404) — test_id doesn't exist or doesn't belong to auth.siteId
- `INVALID_STATUS` (409) — test is not in 'draft' status
- `DB_ERROR` (500) — unexpected database error during upsert

#### GET — List variants for a test

```
GET /api/pipeline/youtube/ab-tests/:id/variants
```

- `authenticateRead(req)`
- Returns all variants for test_id ordered by `sort_order`
- Used by SWR polling in wizard

#### DELETE — Remove a variant

```
DELETE /api/pipeline/youtube/ab-tests/:id/variants?label=B
```

- `authenticateWrite(req)`
- Only on `status === 'draft'` tests
- Only non-original variants (`is_original = false`)
- Label query param required: `B`, `C`, or `D`

### 3.2 Security

All three methods verify `auth.siteId` matches the test's `site_id`. The service client bypasses RLS, so this application-level guard is required (per CLAUDE.md: never call `getSupabaseServiceClient()` without explicit permission check).

---

## 4. Prompt System

### 4.1 LANGUAGE_DIRECTIVE parametrization

**File:** `apps/web/src/lib/youtube/prompt-builders.ts`

Replace hardcoded constant with locale map:

```typescript
const LANGUAGE_DIRECTIVES: Record<'pt' | 'en', string> = {
  pt: 'LANGUAGE REQUIREMENT: All output MUST be in Brazilian Portuguese (PT-BR). No exceptions.\nJSON field names stay in English. All prose output in PT-BR.',
  en: 'LANGUAGE REQUIREMENT: All output MUST be in English. No exceptions.\nJSON field names stay in English. All prose output in English.',
}
```

### 4.2 buildSharedBase locale param

```typescript
export function buildSharedBase(
  channel: Pick<PromptChannelInfo, 'tier' | 'subscribers'>,
  locale: 'pt' | 'en' = 'pt',
): string {
  const persona = channel.tier === 'nano' ? `${PERSONA}\n${NANO_CALIBRATION}` : PERSONA
  return [LANGUAGE_DIRECTIVES[locale], persona, GUARDRAILS, RESPONSE_FORMAT, CONFIDENCE_GUIDE].join('\n\n')
}
```

**Backward compatible:** default `locale = 'pt'` preserves the 2 existing callers.

### 4.3 TEST_TYPE_INSTRUCTIONS bilingual

**File:** `apps/web/src/lib/youtube/prompt-builders-ab.ts`

```typescript
type Locale = 'pt' | 'en'

const TEST_TYPE_INSTRUCTIONS: Record<Locale, Record<TestType, string>> = {
  pt: {
    thumbnail: `Analise a thumbnail atual e sugira 3 variacoes para teste A/B.
Para cada variacao (B, C, D), descreva:
- Composicao visual e enquadramento
- Paleta de cores e contraste
- Texto overlay (se aplicavel)
- Expressao facial / elemento humano
Foco: composicao visual, paleta de cores, texto overlay, expressao facial. 3 variacoes.`,
    title: `Analise o titulo atual e sugira 3 variacoes para teste A/B.
Para cada variacao (B, C, D), descreva:
- Hook emocional ou curiosidade
- Power words e senso de urgencia
- Uso de numeros, brackets, ou padroes comprovados
- Comprimento ideal: 50-60 caracteres
Foco: hook emocional, power words, numeros/brackets, comprimento 50-60 chars. 3 variacoes.`,
    description: `Analise a descricao atual e sugira 3 variacoes para teste A/B.
Para cada variacao (B, C, D), descreva:
- Posicao e texto do CTA principal
- Conteudo acima do fold (3 primeiras linhas visiveis)
- Uso de links rastreados com sintaxe {{link:nome}}
- Hashtags estrategicas
Foco: CTA posicao, fold (3 primeiras linhas), links {{link:nome}}, hashtags. 3 variacoes.`,
    combo: `Analise o combo atual (thumbnail + titulo) e sugira 3 combos coerentes para teste A/B.
Para cada combo (B, C, D), descreva:
**Thumbnail:** Composicao, paleta, texto overlay
**Titulo:** Hook emocional, power words, urgencia, por que esse combo funciona junto
Foco: sinergia thumb+titulo, complementaridade visual/textual. 3 combos coerentes.`,
  },
  en: {
    thumbnail: `Analyze the current thumbnail and suggest 3 A/B test variations.
For each variation (B, C, D), describe:
- Visual composition and framing
- Color palette and contrast
- Text overlay (if applicable)
- Facial expression / human element
Focus: visual composition, color palette, text overlay, facial expression. 3 variations.`,
    title: `Analyze the current title and suggest 3 A/B test variations.
For each variation (B, C, D), describe:
- Emotional hook or curiosity gap
- Power words and sense of urgency
- Use of numbers, brackets, or proven patterns
- Ideal length: 50-60 characters
Focus: emotional hook, power words, numbers/brackets, length 50-60 chars. 3 variations.`,
    description: `Analyze the current description and suggest 3 A/B test variations.
For each variation (B, C, D), describe:
- Position and text of the main CTA
- Content above the fold (first 3 visible lines)
- Use of tracked links with {{link:name}} syntax
- Strategic hashtags
Focus: CTA position, fold (first 3 lines), links {{link:name}}, hashtags. 3 variations.`,
    combo: `Analyze the current combo (thumbnail + title) and suggest 3 coherent combos for A/B testing.
For each combo (B, C, D), describe:
**Thumbnail:** Composition, palette, text overlay
**Title:** Emotional hook, power words, urgency, why this combo works together
Focus: thumb+title synergy, visual/textual complementarity. 3 coherent combos.`,
  },
}
```

### 4.4 AbBriefingData update

Add `locale` and `testId`:

```typescript
interface AbBriefingData {
  channel: Pick<PromptChannelInfo, 'name' | 'subscribers' | 'tier'>
  locale: 'pt' | 'en'
  testId: string
  video: {
    title: string
    thumbnailUrl: string | null
    ctr: number | null
    avgViewPercentage: number | null
    score: number | null
    grade: string | null
  }
  testHistory: Array<{
    test_type: string
    winner_label: string | null
    ctr_lift_percent: number | null
  }>
  snapshotAgeHours: number
}
```

### 4.5 New buildAbWritePrompt

New function for the Cowork-integrated flow. Adds explicit API workflow steps, matching the pipeline prompt pattern (GET docs -> parse -> POST/PATCH with headers).

```typescript
export function buildAbWritePrompt(options: {
  testType: TestType
  data: AbBriefingData
  focus?: string       // sanitized via escapeXmlTags() before embedding
}): string
```

**Structure:**
1. `buildSharedBase(data.channel, data.locale)` — persona, guardrails, locale-aware
2. `<context>` JSON — channel, video, testHistory, test_id, test_type
3. `<instructions>` — type-specific instructions (bilingual) + workflow section
4. If `focus` is provided, appended after instructions via `escapeXmlTags(focus)` (same pattern as `buildAbBriefingPrompt`)

**Workflow section** (locale-aware, embedded in `<instructions>`):
```
## Workflow
1. Discuss ideas with the user until consensus
2. For each agreed variant (B, C, D), send:
   POST /api/pipeline/youtube/ab-tests/{test_id}/variants
   Headers: { "X-Pipeline-Key": "<key>", "Content-Type": "application/json" }
   Body: {
     "variants": [
       {
         "label": "B",
         "title_text": "<title or null>",
         "description_text": "<description or null>",
         "metadata": {
           "creative_direction": "<for thumbnails>",
           "ai_image_prompt": "<for AI image generation>",
           "rationale": "<why this variant>"
         }
       }
     ]
   }
3. Confirm which variants were created
```

**Note on `<key>` placeholder:** The prompt uses literal `<key>` as placeholder text. The Cowork session already has the pipeline key configured in its environment — the user does NOT paste the actual key into the prompt. This follows the same pattern as other pipeline write prompts (e.g., `buildPipelineWritePrompt` in `lib/pipeline/prompt-builders.ts`).

### 4.6 Review prompt (optional, Step 3)

```typescript
export function buildAbReviewPrompt(options: {
  testId: string
  locale: 'pt' | 'en'
  variants: Array<{
    label: string
    title_text: string | null
    description_text: string | null
    blob_url: string | null
    metadata: VariantMetadata
  }>
  channel: Pick<PromptChannelInfo, 'tier' | 'subscribers'>
}): string
```

Includes Vercel Blob URLs (permanent, publicly accessible) for multimodal analysis. These are the same URLs stored in `ab_test_variants.blob_url` — not ephemeral browser `blob:` URLs. Cowork evaluates each variant against the original, scores visual contrast, hook strength, and differentiation.

### 4.7 Prompt version bump

```typescript
export const AB_BRIEFING_PROMPT_VERSION = 'yt-ab-v2' as const
```

### 4.8 Scope for PERSONA/GUARDRAILS

PERSONA, GUARDRAILS, RESPONSE_FORMAT, and CONFIDENCE_GUIDE stay in PT-BR for Phase 1. These are system instructions for Claude (meta-instructions), not user-facing content. The `LANGUAGE_DIRECTIVE` + `TEST_TYPE_INSTRUCTIONS` control the output language. Full i18n of system prompts is Phase 2.

---

## 5. Wizard UX Changes

### 5.1 Early draft creation (Step 1)

When user selects test type + video, wizard calls `createAbTest()` immediately. The existing function already hardcodes `status: 'draft'` — no signature change needed:

```typescript
const handleTypeSelect = async (type: TestType) => {
  setTestType(type)
  // createAbTest already creates with status='draft'
  const result = await createAbTest({
    videoId: video.id,
    testType: type,
    ...defaultConfig,
  })
  if (result.ok && result.id) {
    setDraftTestId(result.id)
    setStep(2)
  } else {
    setSubmitError(result.error ?? 'Failed to create draft')
  }
}
```

Existing UNIQUE index `ab_tests_one_active_per_video` WHERE `status IN ('draft', 'active', 'paused')` prevents concurrent drafts on the same video. If user already has a draft for this video, `createAbTest` returns an error — wizard should detect this and offer to resume the existing draft.

### 5.2 Draft collision handling

If `createAbTest` fails due to UNIQUE violation (draft already exists for this video):
1. Query existing draft: `SELECT id FROM ab_tests WHERE youtube_video_id = ? AND status = 'draft'`
2. Show inline message: "You have an existing draft for this video. Resume it?"
3. If user accepts, load the existing `test_id` and proceed to Step 2
4. If user declines, archive the old draft and create a new one

### 5.3 SWR polling for external variants (Step 2)

```typescript
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data)

const { data: externalVariants, mutate } = useSWR(
  draftTestId ? `/api/pipeline/youtube/ab-tests/${draftTestId}/variants` : null,
  fetcher,
  {
    refreshInterval: 5_000,
    revalidateOnFocus: true,
    dedupingInterval: 3_000,
  },
)
```

Follows the pattern from `pipeline-overview.tsx` (SWR with `refreshInterval`).

SWR deduplicates requests within 3s. Each poll response **completely replaces** the variant list (no merging with local state). Max staleness: 5s.

### 5.4 Variant cards inline rendering

When SWR detects non-original variants, render cards in Step 2:

```
+-- Variante B -------------------------+
| "Why MBK Center Is NOT What You Think" |
| Rationale: Contrarian hook + curiosity |
+----------------------------------------+

+-- Variante C -------------------------+
| "I Spent 24h at MBK Center"           |
| Creative: Warm tones, reaction shot   |
| AI prompt: "youtuber surprised..."    |
+----------------------------------------+

[ Variante D -- aguardando... ]
```

Cards fade in as they arrive. Each shows label, title/description, metadata fields.

### 5.5 Prompt display + copy

StepIdeias shows the write workflow prompt (from `buildAbWritePrompt()`). The prompt includes test_id and API endpoint instructions.

- Prompt rendered in a scrollable card with syntax highlighting
- "Copiar Prompt" button copies full prompt to clipboard
- "Abrir no Claude" opens `claude.ai/new?q=...` (disabled if >8KB)
- After copy: button shows "Copiado!" for 2s, step dot gets green ring

### 5.6 Review loop (Step 3, optional)

In Step 3 (Variantes), after variants are populated, show a "Solicitar Review" button. Clicking generates a review prompt via `buildAbReviewPrompt()` with blob URLs and copies to clipboard. User pastes in Cowork for multimodal evaluation. This step is entirely optional — user can skip to Config.

### 5.7 Submit flow changes

The final submit (Step 5) no longer creates the test (already exists as draft). Instead it:
1. Updates test config (duration, confidence threshold, etc.)
2. If launching: changes status from `draft` to `active`, sets `started_at`
3. Creates any remaining variants that were added manually (not via Cowork)

### 5.8 Draft resume (Phase 1 — minimal)

Phase 1 does not implement full wizard resume. If the user closes the browser:
- The draft persists in DB for up to 24h (then archived by cron)
- SessionStorage preserves `focus` and `slotNotes` within the same browser tab
- If user starts a new wizard for the same video, the draft collision handler (5.2) offers to resume

Full wizard state persistence (saving current step, config, etc. to `ab_tests.metadata`) is Phase 2.

---

## 6. Draft Lifecycle & Cleanup

### 6.1 Draft status behavior

- Draft tests filtered from production queries (`WHERE status != 'draft'` in cron evaluation, analytics)
- UNIQUE index prevents concurrent drafts on same video
- If wizard closes without launching, draft persists in DB

### 6.2 Cron cleanup

**File:** `apps/web/src/app/api/cron/ab-draft-cleanup/route.ts`

Follows media system cleanup pattern:
- Archives draft tests older than 24h (`status = 'draft'` -> `status = 'archived'`)
- Hard-deletes archived tests older than 30 days (FK CASCADE handles variants + cycles)
- Uses `withCronLock()` for advisory lock (prevents concurrent runs)
- `CRON_SECRET` auth header validation
- Batch size: 50
- If a wizard is open when the cron archives its draft, the next SWR poll or form submission returns `INVALID_STATUS` (409). Wizard shows: "Your draft was archived (inactive for 24h). Start a new test?" Acceptable for Phase 1 — active sessions are uncommon at 4 AM.

### 6.3 vercel.json entry

```json
{ "path": "/api/cron/ab-draft-cleanup", "schedule": "0 4 * * *" }
```

---

## 7. Registry & Documentation

### 7.1 api-registry.ts changes

Add 3 endpoints to YOUTUBE domain. Increment `endpoint_count` from 7 to 10:

```typescript
{ method: 'POST', path: '/api/pipeline/youtube/ab-tests/:id/variants', summary: 'Batch upsert variants for A/B test', auth: 'write' },
{ method: 'GET', path: '/api/pipeline/youtube/ab-tests/:id/variants', summary: 'List variants for A/B test', auth: 'read' },
{ method: 'DELETE', path: '/api/pipeline/youtube/ab-tests/:id/variants', summary: 'Delete variant from A/B test', auth: 'write' },
```

### 7.2 cowork-docs-youtube.md additions

Add section (>=100 lines) documenting:

- **POST** batch upsert: full request/response JSON examples, type-specific field requirements
- **GET** list: response shape, ordering
- **DELETE**: label query param, draft-only guard
- **Error codes:** `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `INVALID_STATUS` (409)
- **Complete example:** brainstorm discussion -> batch upsert -> GET verify -> review prompt

### 7.3 Test contract

Registry tests (`api-registry.test.ts`, `registry-completeness.test.ts`) validate:
- `endpoint_count === endpoints.length` (10)
- Route file exists at `youtube/ab-tests/[id]/variants/route.ts`
- Route exports `GET`, `POST`, `DELETE`
- Doc file `cowork-docs-youtube.md` has >=100 lines
- No duplicate `{method}:{path}` combinations

---

## 8. Test Strategy

### 8.1 Unit tests

**`apps/web/test/youtube/prompt-builders-ab.test.ts`** — Update existing + add:
- Locale 'en' produces English instructions
- Locale 'pt' produces Portuguese instructions
- `buildAbWritePrompt` includes workflow steps with test_id
- `buildAbWritePrompt` includes correct API endpoint path
- `buildAbReviewPrompt` includes blob URLs
- Version is `yt-ab-v2`
- `buildSharedBase` with locale='en' uses English language directive

**`apps/web/test/youtube/ab-schemas.test.ts`** (NEW):
- `VariantMetadataSchema` accepts valid metadata
- `VariantMetadataSchema` rejects oversized strings
- `BatchVariantUpsertSchema` accepts 1-3 variants
- `BatchVariantUpsertSchema` rejects 0 or 4+ variants
- Label enum rejects invalid labels
- Optional fields are truly optional

### 8.2 API route tests

**`apps/web/test/api/pipeline/ab-variants-route.test.ts`** (NEW):
- POST: happy path batch upsert returns results array
- POST: validation error returns 400 with per-variant errors
- POST: non-draft test returns 409 INVALID_STATUS
- POST: wrong site_id returns 404 NOT_FOUND
- POST: upsert same label twice -> update not duplicate
- GET: returns variants ordered by sort_order
- GET: empty test returns empty array
- DELETE: removes variant by label
- DELETE: rejects non-draft test
- DELETE: rejects original variant

### 8.3 Integration tests (DB-gated)

**`apps/web/test/integration/ab-variants.test.ts`** (NEW):
- Full flow: create draft -> batch upsert -> GET -> DELETE -> verify cascade
- UNIQUE constraint prevents duplicate (test_id, label)
- Concurrent upserts: second upsert updates, doesn't duplicate

### 8.4 Component tests

**`apps/web/test/youtube/step-ideias.test.tsx`** — Update for:
- Write prompt includes workflow steps
- Variant cards render when SWR returns data
- Copy button copies write prompt (not read-only briefing)
- Polling triggers on draftTestId presence

---

## Files Summary

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/TIMESTAMP_ab_variants_indexes.sql` |
| CREATE | `apps/web/src/lib/youtube/ab-schemas.ts` |
| CREATE | `apps/web/src/app/api/pipeline/youtube/ab-tests/[id]/variants/route.ts` |
| CREATE | `apps/web/src/app/api/cron/ab-draft-cleanup/route.ts` |
| CREATE | `apps/web/test/youtube/ab-schemas.test.ts` |
| CREATE | `apps/web/test/api/pipeline/ab-variants-route.test.ts` |
| CREATE | `apps/web/test/integration/ab-variants.test.ts` |
| MODIFY | `apps/web/src/lib/youtube/ab-types.ts` — add ai_image_prompt, creative_direction, rationale |
| MODIFY | `apps/web/src/lib/youtube/prompt-builders.ts` — LANGUAGE_DIRECTIVES map, buildSharedBase locale param |
| MODIFY | `apps/web/src/lib/youtube/prompt-builders-ab.ts` — bilingual instructions, buildAbWritePrompt, buildAbReviewPrompt, version bump |
| MODIFY | `apps/web/src/lib/youtube/prompt-types.ts` — AbBriefingData + locale/testId, version bump |
| MODIFY | `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-ideias.tsx` — write prompt, SWR polling, variant cards |
| MODIFY | `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx` — early draft creation, draftTestId state |
| MODIFY | `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts` — Zod validation on createTextVariant, fetchAbBriefingData returns locale + testId |
| MODIFY | `apps/web/src/lib/pipeline/api-registry.ts` — 3 new endpoints, endpoint_count 7->10 |
| MODIFY | `apps/web/data/pipeline-docs/cowork-docs-youtube.md` — variant CRUD docs (>=100 lines addition) |
| MODIFY | `vercel.json` — add ab-draft-cleanup cron |
| UPDATE | `apps/web/test/youtube/prompt-builders-ab.test.ts` — locale tests, v2 version, workflow steps |
| UPDATE | `apps/web/test/youtube/step-ideias.test.tsx` — write prompt, polling, variant cards |

---

## Non-Goals (Phase 1)

- Full i18n of PERSONA/GUARDRAILS/CONFIDENCE_GUIDE (system instructions stay PT-BR)
- Supabase Realtime subscriptions (SWR polling sufficient)
- Embedded Cowork in wizard (external flow only)
- Auto-parsing of Claude responses
- Thumbnail upload via Cowork API (creative direction only; user uploads manually)
- Max variant enforcement trigger in DB (app-level check sufficient)
- OCC / version header on variant upsert (draft-only, no concurrent editing risk)
