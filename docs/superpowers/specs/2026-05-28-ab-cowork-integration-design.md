# AB Lab — Cowork Integration Redesign

> **Rev 3** — 2026-05-28
> Replaces Rev 2. Incorporates v7 approved design (4 progressive states, label unification, slotNotes injection, Step 3 auto-populate, visual refinements).

## Goal

Transform Step "Ideias" from a clipboard-copy advisory flow into a Cowork-integrated workflow where the AI assistant generates ideas in an external Claude conversation and populates variant slots B/C/D via REST API calls. Add locale-aware prompt generation, batch variant upsert endpoint, SWR polling for external variant detection, 4 progressive UI states, per-variant direction injection, and Step 3 auto-populate bridge.

## Architecture

```
Wizard Step 1 (Tipo)
  -> User picks test type + video
  -> Draft test created (status='draft') -> gets test_id
  |
Wizard Step 2 (Ideias) -- REDESIGNED (v7)
  STATE 1 — PRE-COPY:
    1. Compact header + hypothesis field (optional, uses existing `focus` param)
    2. Collapsible per-variant directions (slotNotes, injected into prompt)
    3. Prompt card with CTA "Copiar prompt"
    4. Combo warning (if test_type === 'combo')
    5. Empty variant grid placeholder
    6. Footer: "Pode pular se já sabe o que testar" + dimmed "Próximo →"

  STATE 2 — WAITING (after prompt copied):
    1. Prompt card collapsed: "✓ Copiado" + "Copiar novamente"
    2. 3 skeleton cards (simulating incoming variants)
    3. Footer: "0 de 3 variações" + dimmed "Próximo →"
    4. After 60s: escalation "Está demorando? Verifique se o Cowork recebeu o prompt."
    5. SWR polling 5s interval

  STATE 3 — PARTIAL (1-2 variants arrived):
    1. Arrived variants render with fade-in (Thumb + Título columns for combo)
    2. Remaining slots stay as skeleton cards
    3. Footer: "1 de 3 variações" (green) + enabled "Próximo →"

  STATE 4 — COMPLETE (3 variants arrived):
    1. All 4 options visible: A (original, gray) + B/C/D (gradient badges)
    2. Each combo variant shows: Thumb direction + Title text + synergy rationale
    3. "Passo 3 pré-preenchido" badge in grid header
    4. Handoff microcopy: "No próximo passo, você edita os títulos e faz upload de thumbnails..."
    5. Footer: "3 de 3 variações ✓" (green) + full opacity "Próximo →"
  |
Wizard Step 3 (Variantes) -- AUTO-POPULATED
  -> textVariants auto-filled from Cowork data (useEffect bridge)
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
4. **SWR polling** (already installed, used in `pipeline-overview.tsx`) with 5s interval. Continue until 3 non-original variants arrive OR 120s timeout. Do NOT stop after first variant.
5. **Dynamic locale** from `youtube_channels.locale` ('pt'|'en').
6. **Type-specific flows:** title/description = direct text, thumbnail = creative directions + `ai_image_prompt`, combo = thumb direction + title as coherent package.
7. **Review loop** — optional prompt with Vercel Blob URLs (permanent, public) for multimodal evaluation.
8. **Last-write-wins** on variant upsert — Cowork can overwrite user edits on the same label. No conflict dialog in Phase 1.
9. **Label unification** — all labels use single uppercase letters `B`, `C`, `D` (matching pipeline API schema). `VARIANT_LABELS` in `actions.ts` changes from `['variant_b', 'variant_c', 'variant_d']` to `['B', 'C', 'D']`.
10. **slotNotes injection** — per-variant directions from the hypothesis section get injected into `buildAbWritePrompt` (not cosmetic-only).
11. **Step 3 auto-populate** — useEffect bridge pushes Cowork variant data into `textVariants` state via `onVariantsReceived` callback.

**New code estimate:** ~800 lines (route handler, Zod schemas, prompt builder changes, wizard UX overhaul, Step 3 bridge, cron cleanup).

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

### 2.2 Zod schemas

**File:** `apps/web/src/lib/youtube/ab-schemas.ts` (already exists)

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
    thumbnail: `Analise a thumbnail atual e sugira 3 variações para teste A/B.
Para cada variação (B, C, D), descreva:
- Composição visual e enquadramento
- Paleta de cores e contraste
- Texto overlay (se aplicável)
- Expressão facial / elemento humano
Foco: composição visual, paleta de cores, texto overlay, expressão facial. 3 variações.`,
    title: `Analise o título atual e sugira 3 variações para teste A/B.
Para cada variação (B, C, D), descreva:
- Hook emocional ou curiosidade
- Power words e senso de urgência
- Uso de números, brackets, ou padrões comprovados
- Comprimento ideal: 50-60 caracteres
Foco: hook emocional, power words, números/brackets, comprimento 50-60 chars. 3 variações.`,
    description: `Analise a descrição atual e sugira 3 variações para teste A/B.
Para cada variação (B, C, D), descreva:
- Posição e texto do CTA principal
- Conteúdo acima do fold (3 primeiras linhas visíveis)
- Uso de links rastreados com sintaxe {{link:nome}}
- Hashtags estratégicas
Foco: CTA posição, fold (3 primeiras linhas), links {{link:nome}}, hashtags. 3 variações.`,
    combo: `Analise o combo atual (thumbnail + título) e sugira 3 combos coerentes para teste A/B.
Para cada combo (B, C, D), descreva:
**Thumbnail:** Composição, paleta, texto overlay
**Título:** Hook emocional, power words, urgência, por que esse combo funciona junto
Foco: sinergia thumb+título, complementaridade visual/textual. 3 combos coerentes.`,
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

### 4.5 buildAbWritePrompt — slotNotes injection

**File:** `apps/web/src/lib/youtube/prompt-builders-ab.ts`

Update signature to accept `slotNotes`:

```typescript
export function buildAbWritePrompt(options: {
  testType: TestType
  data: AbBriefingData
  focus?: string
  slotNotes?: [string, string, string]  // NEW: per-variant directions from hypothesis UI
}): string
```

**slotNotes injection point:** After `TEST_TYPE_INSTRUCTIONS` (line ~345), before the `focus` block. Only non-empty notes get injected:

```typescript
// After TEST_TYPE_INSTRUCTIONS block
if (slotNotes?.some(n => n.trim())) {
  const labels = ['B', 'C', 'D'] as const
  const directions = slotNotes
    .map((note, i) => note.trim() ? `- Variação ${labels[i]}: ${escapeXmlTags(note.trim())}` : null)
    .filter(Boolean)
    .join('\n')
  lines.push(`\n## Direções por variação\n${directions}`)
}
```

This fixes the critical flaw where slotNotes were cosmetic-only and never reached the AI.

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

## 5. Wizard UX Changes (v7 Design)

### 5.0 Design tokens

All v7 components follow these constraints:
- **Fonts:** minimum 9px. No 7px/8px text anywhere.
- **Colors:** CMS tokens only — `#0f1117` (bg), `#1a1d27` (surface), `#2a2d3a` (border), `#FF8240` (accent). Additional: `#6b7280` (muted text — no `#9ca3af`), `#e5e7eb` (primary text), `#4b5563` (dimmed text).
- **Opacities:** Tailwind-friendly only — `/5`, `/10`, `/15`, `/20`. No arbitrary values like `0.03`, `0.06`, `0.12`.
- **Border-radius:** 4px (inner elements: badges, inputs), 8px (cards, containers), 50% (circles/dots).
- **Spacing:** 4px grid. No 3px or 5px values.
- **Combo gradient:** `from-pink-500 to-purple-600` (`#ec4899` → `#a855f7`).
- **Semantic colors:** indigo (`#818cf8`) for hypothesis/Cowork, amber (`#f59e0b`) for titles/warnings, green (`#22c55e`) for success/completion.

### 5.1 Early draft creation (Step 1)

When user selects test type + video, wizard calls `createAbTest()` immediately. The existing function already hardcodes `status: 'draft'` — no signature change needed:

```typescript
const handleTypeSelect = async (type: TestType) => {
  setTestType(type)
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

### 5.3 Label unification (CRITICAL BUG FIX)

**File:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`

**Current:** `VARIANT_LABELS = ['variant_b', 'variant_c', 'variant_d']` (line 33)
**Pipeline API:** `z.enum(['B', 'C', 'D'])` in `ab-schemas.ts`
**DB upsert:** `ON CONFLICT (test_id, label)` — `variant_b` ≠ `B` → creates duplicates

**Fix:** Change `VARIANT_LABELS` to `['B', 'C', 'D']`. Update all consumers:

- `createTextVariant()` — uses `VARIANT_LABELS[index]` for label
- `uploadVariant()` — uses `VARIANT_LABELS[index]` for label
- `handleSubmit()` in `ab-create-wizard.tsx` — creates variants with these labels

Also update `VARIANT_LABELS_TEXT` (line ~1162) to match.

The existing `ab_test_variants` table may have rows with `variant_b/c/d` labels from earlier tests — these are draft/archived tests only and don't need migration. New tests will use `B/C/D`.

### 5.4 SWR polling for external variants (Step 2) — FIX

**Current bug:** `variantsReceived` becomes `true` after 1st variant arrives, stopping polling.

**Fix:** Continue polling until **3 non-original variants** exist OR **120s timeout** from first poll.

```typescript
const variantCount = (externalVariants ?? []).filter(
  (v: { is_original: boolean }) => !v.is_original
).length

const allVariantsReceived = variantCount >= 3

const { data: externalVariants } = useSWR(
  draftTestId && !allVariantsReceived
    ? `/api/pipeline/youtube/ab-tests/${draftTestId}/variants`
    : null,
  fetcher,
  {
    refreshInterval: 5_000,
    revalidateOnFocus: true,
    dedupingInterval: 3_000,
  },
)
```

Add 120s timeout as fallback (SWR stops if Cowork never responds):

```typescript
const [pollingTimedOut, setPollingTimedOut] = useState(false)
const pollingStartRef = useRef<number | null>(null)

useEffect(() => {
  if (briefingCopied && !pollingStartRef.current) {
    pollingStartRef.current = Date.now()
    const timer = setTimeout(() => setPollingTimedOut(true), 120_000)
    return () => clearTimeout(timer)
  }
}, [briefingCopied])
```

### 5.5 Four progressive UI states (v7 core)

**State derivation logic:**

```typescript
type StepState = 'pre-copy' | 'waiting' | 'partial' | 'complete'

const stepState: StepState = useMemo(() => {
  if (allVariantsReceived) return 'complete'
  if (variantCount > 0) return 'partial'
  if (briefingCopied) return 'waiting'
  return 'pre-copy'
}, [allVariantsReceived, variantCount, briefingCopied])
```

#### State 1: Pre-copy

- **Header:** Compact inline — 28px gradient icon + "Monte sua hipótese" + subtitle
- **Hypothesis section:** `focus` input with "(opcional)" label. Example chips clickable. Collapsible "Guiar cada variação" accordion for slotNotes.
- **Prompt card:** Collapsed by default. Badge "PROMPT" + char count. "▼ Ver prompt" toggle. CTA button "Copiar prompt" with gradient background.
- **Combo warning:** Amber banner — "Você vai testar thumb + título juntos. Se o CTR subir, ótimo! Para saber qual mudança pesou mais, rode um teste separado depois."
- **Variant grid:** Empty placeholder — "Copie o prompt e cole no Cowork / As variações aparecem aqui automaticamente"
- **Footer:** "← Voltar" + "Pode pular se já sabe o que testar" + dimmed "Próximo →" (opacity 0.7)

#### State 2: Waiting

- **Prompt card:** Collapsed — "✓ Copiado" (green) + "Copiar novamente" link
- **Variant grid:** 3 skeleton cards. Each: gray badge placeholder + two column placeholders. Header: "Aguardando variações do Cowork..." + "0 de 3"
- **Escalation:** After 60s, show italic text: "Está demorando? Verifique se o Cowork recebeu o prompt." (appears via timer, `#4b5563`)
- **Footer:** "0 de 3 variações" + dimmed "Próximo →"

#### State 3: Partial

- **Variant grid:** Arrived variants render with transition (fade-in). Combo cards show two columns: `Thumb: direção` (indigo) + `Título` with char count (amber). Synergy rationale below with `↔` icon. Remaining slots stay as skeleton.
- **Grid header:** "Recebendo variações..." + "N de 3" (green)
- **Footer:** "N de 3 variações" (green) + full opacity "Próximo →"

#### State 4: Complete

- **Grid header:** "Variações" + "4 no teste" + badge "Passo 3 pré-preenchido"
- **Option A:** Gray badge, "Original (atual)", shows current thumbnail direction + title (muted `#6b7280`)
- **Options B/C/D:** Gradient badges, combo columns (Thumb direction + Title), synergy rationale per variant
- **Thumb column:** Header "THUMB" + "direção" hint (clarifies this is creative direction, not the actual image)
- **Title column:** Header "TÍTULO" + char count right-aligned
- **Handoff microcopy:** "No próximo passo, você edita os títulos e faz upload de thumbnails seguindo as direções acima."
- **Footer:** "3 de 3 variações ✓" (green) + full opacity "Próximo →"

### 5.6 Combo variant card layout (v7)

For `test_type === 'combo'`, each variant card (B/C/D) renders as:

```
┌─ B ── Variação B ─────────────────────────────────┐
│ ┌── THUMB direção ────┐  ┌── TÍTULO ────── 47 car.┐│
│ │ Close-up expressão  │  │ "Você NÃO vai         ││
│ │ surpresa. Fundo     │  │  acreditar no que      ││
│ │ amarelo saturado.   │  │  aconteceu"            ││
│ └─────────────────────┘  └────────────────────────┘│
│    ↔ Surpresa na thumb → "NÃO vai acreditar" amp. │
└────────────────────────────────────────────────────┘
```

- Thumb column: `bg-indigo-500/5 border-indigo-500/10`
- Title column: `bg-amber-500/5 border-amber-500/10`
- Synergy line: italic `#6b7280`, purple `↔` icon, left-padded 24px

For non-combo types: single column layout matching the test type (title-only, description-only, or thumbnail direction only).

### 5.7 Step 3 auto-populate bridge (CRITICAL)

**Current bug:** `textVariants` in `ab-create-wizard.tsx` is initialized as `[{title:'', description:''}, ...]` and NEVER populated from Cowork data. User reaches Step 3 and sees empty fields despite Cowork having sent variants.

**Fix:** Add `onVariantsReceived` callback from `StepIdeias` to parent wizard:

```typescript
// In ab-create-wizard.tsx
const handleVariantsReceived = useCallback((variants: Array<{
  label: string
  title_text: string | null
  description_text: string | null
  metadata: Record<string, unknown> | null
}>) => {
  const labelToIndex: Record<string, number> = { B: 0, C: 1, D: 2 }
  setTextVariants(prev => {
    const next = [...prev]
    for (const v of variants) {
      const idx = labelToIndex[v.label]
      if (idx !== undefined) {
        next[idx] = {
          title: v.title_text ?? '',
          description: v.description_text ?? '',
        }
      }
    }
    return next
  })
}, [])
```

StepIdeias calls `onVariantsReceived` whenever SWR data changes and has non-original variants:

```typescript
// In step-ideias.tsx
useEffect(() => {
  if (!externalVariants?.length) return
  const nonOriginal = externalVariants.filter(
    (v: { is_original: boolean }) => !v.is_original
  )
  if (nonOriginal.length > 0) {
    onVariantsReceived(nonOriginal)
  }
}, [externalVariants, onVariantsReceived])
```

### 5.8 Dynamic footer

Footer content changes based on `stepState`:

| State | Left | Center/Right |
|-------|------|-------------|
| pre-copy | "← Voltar" | "Pode pular se já sabe o que testar" + dimmed "Próximo →" |
| waiting | "← Voltar" | "0 de 3 variações" + dimmed "Próximo →" |
| partial | "← Voltar" | "N de 3 variações" (green) + enabled "Próximo →" |
| complete | "← Voltar" | "3 de 3 variações ✓" (green) + full "Próximo →" |

"Próximo →" is always enabled (user can skip Step 2 entirely). Opacity changes from 0.7 to 1.0 as variants arrive.

### 5.9 Prompt display + copy

StepIdeias shows the write workflow prompt (from `buildAbWritePrompt()`). The prompt includes test_id and API endpoint instructions.

- Prompt rendered in a collapsible card (collapsed by default in v7)
- Badge "PROMPT" (gradient) + character count
- "▼ Ver prompt" expands to show full prompt in scrollable `<PromptPreview>`
- CTA button: gradient "Copiar prompt" (pre-copy) → "✓ Copiado" + "Copiar novamente" (post-copy)
- Copy handler sets `briefingCopied = true`, triggering transition to waiting state

### 5.10 Review loop (Step 3, optional)

In Step 3 (Variantes), after variants are populated, show a "Solicitar Review" button. Clicking generates a review prompt via `buildAbReviewPrompt()` with blob URLs and copies to clipboard. User pastes in Cowork for multimodal evaluation. This step is entirely optional — user can skip to Config.

### 5.11 Submit flow changes

The final submit (Step 5) no longer creates the test (already exists as draft). Instead it:
1. Updates test config (duration, confidence threshold, etc.)
2. If launching: changes status from `draft` to `active`, sets `started_at`
3. Creates any remaining variants that were added manually (not via Cowork)

### 5.12 Draft resume (Phase 1 — minimal)

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
- `buildAbWritePrompt` injects non-empty slotNotes as per-variant directions
- `buildAbWritePrompt` omits slotNotes section when all notes are empty
- `buildAbReviewPrompt` includes blob URLs
- Version is `yt-ab-v2`
- `buildSharedBase` with locale='en' uses English language directive

**`apps/web/test/youtube/ab-schemas.test.ts`** (already exists — update):
- `VariantMetadataSchema` accepts valid metadata
- `VariantMetadataSchema` rejects oversized strings
- `BatchVariantUpsertSchema` accepts 1-3 variants
- `BatchVariantUpsertSchema` rejects 0 or 4+ variants
- Label enum rejects invalid labels
- Optional fields are truly optional

### 8.2 API route tests

**`apps/web/test/api/pipeline/ab-variants-route.test.ts`** (already exists — update):
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
- slotNotes injection into prompt when non-empty
- Variant cards render when SWR returns data
- Copy button copies write prompt (not read-only briefing)
- Polling triggers on draftTestId presence
- Polling continues until 3 variants (not stopping after 1)
- 4 progressive states render correctly
- Footer shows dynamic variant count
- onVariantsReceived callback fires with Cowork data

---

## 9. Files Summary

| Action | File |
|--------|------|
| CREATE | `supabase/migrations/TIMESTAMP_ab_variants_indexes.sql` |
| CREATE | `apps/web/src/app/api/cron/ab-draft-cleanup/route.ts` |
| CREATE | `apps/web/test/integration/ab-variants.test.ts` |
| MODIFY | `apps/web/src/lib/youtube/ab-types.ts` — add ai_image_prompt, creative_direction, rationale |
| MODIFY | `apps/web/src/lib/youtube/prompt-builders.ts` — LANGUAGE_DIRECTIVES map, buildSharedBase locale param |
| MODIFY | `apps/web/src/lib/youtube/prompt-builders-ab.ts` — bilingual instructions, slotNotes injection, buildAbWritePrompt, buildAbReviewPrompt, version bump |
| MODIFY | `apps/web/src/lib/youtube/prompt-types.ts` — AbBriefingData + locale/testId, version bump |
| MODIFY | `apps/web/src/lib/youtube/ab-schemas.ts` — add BatchVariantUpsertSchema, VariantMetadataSchema |
| MODIFY | `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-ideias.tsx` — 4 progressive states, skeleton cards, dynamic footer, SWR fix, slotNotes injection, onVariantsReceived callback |
| MODIFY | `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx` — early draft creation, draftTestId state, handleVariantsReceived bridge, label unification in handleSubmit |
| MODIFY | `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts` — VARIANT_LABELS to ['B','C','D'], Zod validation on createTextVariant |
| MODIFY | `apps/web/src/lib/pipeline/api-registry.ts` — 3 new endpoints, endpoint_count 7->10 |
| MODIFY | `apps/web/data/pipeline-docs/cowork-docs-youtube.md` — variant CRUD docs (>=100 lines addition) |
| MODIFY | `apps/web/src/app/api/pipeline/youtube/ab-tests/[id]/variants/route.ts` — add POST batch upsert, DELETE handler |
| MODIFY | `vercel.json` — add ab-draft-cleanup cron |
| UPDATE | `apps/web/test/youtube/prompt-builders-ab.test.ts` — locale tests, v2 version, workflow steps, slotNotes |
| UPDATE | `apps/web/test/youtube/ab-schemas.test.ts` — BatchVariantUpsertSchema, VariantMetadataSchema |
| UPDATE | `apps/web/test/api/pipeline/ab-variants-route.test.ts` — POST/DELETE tests |
| UPDATE | `apps/web/test/youtube/step-ideias.test.tsx` — progressive states, polling fix, auto-populate |

---

## 10. Non-Goals (Phase 1)

- Full i18n of PERSONA/GUARDRAILS/CONFIDENCE_GUIDE (system instructions stay PT-BR)
- Supabase Realtime subscriptions (SWR polling sufficient)
- Embedded Cowork in wizard (external flow only)
- Auto-parsing of Claude responses
- Thumbnail upload via Cowork API (creative direction only; user uploads manually)
- Max variant enforcement trigger in DB (app-level check sufficient)
- OCC / version header on variant upsert (draft-only, no concurrent editing risk)
- Full wizard state persistence / resume (Phase 2)
