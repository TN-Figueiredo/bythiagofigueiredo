# AB Lab — Cowork Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Step "Ideias" from clipboard-copy advisory flow into a Cowork-integrated workflow with locale-aware prompts, batch variant upsert API, SWR polling, and optional review loop.

**Architecture:** Early draft creation at Step 1 gives Cowork a test_id. Write prompt displayed on site includes API instructions. Cowork POSTs variants via batch upsert endpoint. Wizard detects variants via SWR polling (5s). Cron cleans stale drafts.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Zod, Supabase, SWR 2.4.1, Vitest, Vercel Cron

**Spec:** `docs/superpowers/specs/2026-05-28-ab-cowork-integration-design.md` (Rev 2)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| CREATE | `supabase/migrations/{ts}_ab_variants_indexes.sql` | UNIQUE + perf indexes |
| CREATE | `apps/web/src/lib/youtube/ab-schemas.ts` | Zod schemas for variant validation |
| CREATE | `apps/web/src/app/api/pipeline/youtube/ab-tests/[id]/variants/route.ts` | POST/GET/DELETE variant CRUD |
| CREATE | `apps/web/src/app/api/cron/ab-draft-cleanup/route.ts` | Archive stale drafts, hard-delete old |
| CREATE | `apps/web/test/youtube/ab-schemas.test.ts` | Schema validation tests |
| CREATE | `apps/web/test/api/pipeline/ab-variants-route.test.ts` | Route handler tests |
| MODIFY | `apps/web/src/lib/youtube/ab-types.ts:49-54` | Add ai_image_prompt, creative_direction, rationale to VariantMetadata |
| MODIFY | `apps/web/src/lib/youtube/prompt-types.ts:138-156` | AbBriefingData + locale/testId, version bump v2 |
| MODIFY | `apps/web/src/lib/youtube/prompt-builders.ts:13,69-73` | LANGUAGE_DIRECTIVES map, buildSharedBase locale param |
| MODIFY | `apps/web/src/lib/youtube/prompt-builders-ab.ts` | Bilingual instructions, buildAbWritePrompt, buildAbReviewPrompt |
| MODIFY | `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts:1265-1333` | fetchAbBriefingData returns locale + testId |
| MODIFY | `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx:280-283` | Early draft creation, draftTestId state |
| MODIFY | `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-ideias.tsx` | Write prompt, SWR polling, variant cards |
| MODIFY | `apps/web/src/lib/pipeline/api-registry.ts:142-158` | 3 new endpoints, endpoint_count 7→10 |
| MODIFY | `apps/web/data/pipeline-docs/cowork-docs-youtube.md` | Variant CRUD docs (≥100 lines) |
| MODIFY | `apps/web/vercel.json` | Add ab-draft-cleanup cron |
| UPDATE | `apps/web/test/youtube/prompt-builders-ab.test.ts` | Locale tests, v2 version, write/review prompts |
| UPDATE | `apps/web/test/youtube/step-ideias.test.tsx` | Write prompt, polling, variant cards |

---

### Task 1: Database Migration — UNIQUE + Performance Indexes

**Files:**
- Create: `supabase/migrations/{timestamp}_ab_variants_indexes.sql`

- [ ] **Step 1: Generate migration file**

Run: `npm run db:new ab_variants_indexes`

- [ ] **Step 2: Write the migration SQL**

Replace the generated file contents with:

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

- [ ] **Step 3: Push migration to prod**

Run: `npm run db:push:prod`
Expected: Migration applies successfully, indexes created.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_ab_variants_indexes.sql
git commit -m "feat(ab-lab): add UNIQUE and performance indexes for variant upsert"
```

---

### Task 2: Type System — VariantMetadata + AbBriefingData

**Files:**
- Modify: `apps/web/src/lib/youtube/ab-types.ts:49-54`
- Modify: `apps/web/src/lib/youtube/prompt-types.ts:138-156`

- [ ] **Step 1: Write failing test for new metadata fields**

Add to `apps/web/test/youtube/prompt-builders-ab.test.ts`:

```typescript
it('includes locale in context block', () => {
  const prompt = buildAbBriefingPrompt({
    testType: 'thumbnail',
    data: makeAbBriefingData({ locale: 'en', testId: 'test-123' }),
  })
  expect(prompt).toContain('"locale": "en"')
})
```

Update the `makeAbBriefingData` factory at top of file to include new fields:

```typescript
function makeAbBriefingData(overrides?: Partial<AbBriefingData>): AbBriefingData {
  return {
    channel: { name: 'Test Channel', subscribers: 5000, tier: 'micro' },
    locale: 'pt',
    testId: '00000000-0000-0000-0000-000000000000',
    video: {
      title: 'O Que Esperar Do MBK Center em Bangkok',
      thumbnailUrl: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      ctr: 4.2,
      avgViewPercentage: 38,
      score: 72,
      grade: 'B',
    },
    testHistory: [],
    snapshotAgeHours: 2,
    ...overrides,
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/youtube/prompt-builders-ab.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — `locale` and `testId` not recognized on AbBriefingData.

- [ ] **Step 3: Update VariantMetadata in ab-types.ts**

In `apps/web/src/lib/youtube/ab-types.ts`, replace lines 49-54:

```typescript
export interface VariantMetadata {
  thumbnail_tags?: string[]
  title_pattern?: string
  emotional_triggers?: string[]
  visual_description?: string
  ai_image_prompt?: string
  creative_direction?: string
  rationale?: string
}
```

- [ ] **Step 4: Update AbBriefingData in prompt-types.ts**

In `apps/web/src/lib/youtube/prompt-types.ts`, replace the `AB_BRIEFING_PROMPT_VERSION` and `AbBriefingData`:

```typescript
export const AB_BRIEFING_PROMPT_VERSION = 'yt-ab-v2' as const

export interface AbBriefingData {
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

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run apps/web/test/youtube/prompt-builders-ab.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: The new test should still fail (prompt builder doesn't use locale yet), but the type error should be resolved. Other existing tests must still pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/youtube/ab-types.ts apps/web/src/lib/youtube/prompt-types.ts apps/web/test/youtube/prompt-builders-ab.test.ts
git commit -m "feat(ab-lab): extend VariantMetadata and AbBriefingData with locale, testId, ai fields"
```

---

### Task 3: Zod Schemas — ab-schemas.ts

**Files:**
- Create: `apps/web/src/lib/youtube/ab-schemas.ts`
- Create: `apps/web/test/youtube/ab-schemas.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/test/youtube/ab-schemas.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  VariantMetadataSchema,
  VariantPayloadSchema,
  BatchVariantUpsertSchema,
} from '@/lib/youtube/ab-schemas'

describe('VariantMetadataSchema', () => {
  it('accepts valid metadata with all fields', () => {
    const result = VariantMetadataSchema.safeParse({
      thumbnail_tags: ['closeup', 'warm'],
      title_pattern: 'curiosity-gap',
      emotional_triggers: ['surprise', 'fomo'],
      visual_description: 'Close-up reaction shot with warm orange tones',
      ai_image_prompt: 'youtuber surprised face, Bangkok mall, warm tones',
      creative_direction: 'Warm tones, close-up reaction shot',
      rationale: 'Contrarian hook + curiosity gap',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all fields optional)', () => {
    const result = VariantMetadataSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects thumbnail_tags with strings over 50 chars', () => {
    const result = VariantMetadataSchema.safeParse({
      thumbnail_tags: ['A'.repeat(51)],
    })
    expect(result.success).toBe(false)
  })

  it('rejects thumbnail_tags with more than 10 items', () => {
    const result = VariantMetadataSchema.safeParse({
      thumbnail_tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    })
    expect(result.success).toBe(false)
  })

  it('rejects ai_image_prompt over 1000 chars', () => {
    const result = VariantMetadataSchema.safeParse({
      ai_image_prompt: 'A'.repeat(1001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects rationale over 1000 chars', () => {
    const result = VariantMetadataSchema.safeParse({
      rationale: 'A'.repeat(1001),
    })
    expect(result.success).toBe(false)
  })
})

describe('VariantPayloadSchema', () => {
  it('accepts valid payload with label B', () => {
    const result = VariantPayloadSchema.safeParse({
      label: 'B',
      title_text: 'Why MBK Center Is NOT What You Think',
      metadata: { rationale: 'Contrarian hook' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid label', () => {
    const result = VariantPayloadSchema.safeParse({
      label: 'A',
      title_text: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects label E', () => {
    const result = VariantPayloadSchema.safeParse({
      label: 'E',
      title_text: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null title_text and description_text', () => {
    const result = VariantPayloadSchema.safeParse({
      label: 'C',
      title_text: null,
      description_text: null,
      metadata: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects title_text over 200 chars', () => {
    const result = VariantPayloadSchema.safeParse({
      label: 'B',
      title_text: 'A'.repeat(201),
    })
    expect(result.success).toBe(false)
  })

  it('rejects description_text over 5000 chars', () => {
    const result = VariantPayloadSchema.safeParse({
      label: 'D',
      description_text: 'A'.repeat(5001),
    })
    expect(result.success).toBe(false)
  })
})

describe('BatchVariantUpsertSchema', () => {
  it('accepts 1-3 variants', () => {
    const result = BatchVariantUpsertSchema.safeParse({
      variants: [
        { label: 'B', title_text: 'Title B' },
        { label: 'C', title_text: 'Title C' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty variants array', () => {
    const result = BatchVariantUpsertSchema.safeParse({ variants: [] })
    expect(result.success).toBe(false)
  })

  it('rejects more than 3 variants', () => {
    const result = BatchVariantUpsertSchema.safeParse({
      variants: [
        { label: 'B', title_text: 'B' },
        { label: 'C', title_text: 'C' },
        { label: 'D', title_text: 'D' },
        { label: 'B', title_text: 'B2' },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('accepts single variant', () => {
    const result = BatchVariantUpsertSchema.safeParse({
      variants: [{ label: 'D', description_text: 'New description' }],
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/youtube/ab-schemas.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — module `@/lib/youtube/ab-schemas` does not exist.

- [ ] **Step 3: Implement ab-schemas.ts**

Create `apps/web/src/lib/youtube/ab-schemas.ts`:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/test/youtube/ab-schemas.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/ab-schemas.ts apps/web/test/youtube/ab-schemas.test.ts
git commit -m "feat(ab-lab): add Zod schemas for batch variant upsert validation"
```

---

### Task 4: Prompt System — Locale-Aware Builders

**Files:**
- Modify: `apps/web/src/lib/youtube/prompt-builders.ts:13,69-73`
- Modify: `apps/web/src/lib/youtube/prompt-builders-ab.ts`
- Update: `apps/web/test/youtube/prompt-builders-ab.test.ts`

- [ ] **Step 1: Write failing tests for locale + new functions**

Add to `apps/web/test/youtube/prompt-builders-ab.test.ts`:

```typescript
import { buildAbWritePrompt, buildAbReviewPrompt } from '@/lib/youtube/prompt-builders-ab'

// Add inside the main describe block:

it('locale en produces English instructions for thumbnail', () => {
  const prompt = buildAbBriefingPrompt({
    testType: 'thumbnail',
    data: makeAbBriefingData({ locale: 'en' }),
  })
  expect(prompt).toContain('visual composition')
  expect(prompt).toContain('All output MUST be in English')
})

it('locale pt produces Portuguese instructions for thumbnail', () => {
  const prompt = buildAbBriefingPrompt({
    testType: 'thumbnail',
    data: makeAbBriefingData({ locale: 'pt' }),
  })
  expect(prompt).toContain('composição visual')
  expect(prompt).toContain('PT-BR')
})

it('version is yt-ab-v2', () => {
  const prompt = buildAbBriefingPrompt({
    testType: 'thumbnail',
    data: makeAbBriefingData(),
  })
  expect(prompt).toContain('yt-ab-v2')
})

// New describe for buildAbWritePrompt:

describe('buildAbWritePrompt', () => {
  it('includes workflow steps with test_id', () => {
    const prompt = buildAbWritePrompt({
      testType: 'title',
      data: makeAbBriefingData({ testId: 'abc-123' }),
    })
    expect(prompt).toContain('abc-123')
    expect(prompt).toContain('/api/pipeline/youtube/ab-tests/')
    expect(prompt).toContain('X-Pipeline-Key')
  })

  it('includes API endpoint path with POST method', () => {
    const prompt = buildAbWritePrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
    })
    expect(prompt).toContain('POST /api/pipeline/youtube/ab-tests/')
    expect(prompt).toContain('/variants')
  })

  it('includes type-specific instructions for title', () => {
    const prompt = buildAbWritePrompt({
      testType: 'title',
      data: makeAbBriefingData({ locale: 'pt' }),
    })
    expect(prompt).toContain('hook emocional')
    expect(prompt).toContain('power words')
  })

  it('en locale produces English workflow steps', () => {
    const prompt = buildAbWritePrompt({
      testType: 'title',
      data: makeAbBriefingData({ locale: 'en' }),
    })
    expect(prompt).toContain('Discuss ideas with the user')
    expect(prompt).toContain('All output MUST be in English')
  })

  it('appends focus text escaped', () => {
    const prompt = buildAbWritePrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
      focus: 'Focar em <cores quentes>',
    })
    expect(prompt).toContain('&lt;cores quentes>')
    expect(prompt).not.toContain('<cores quentes>')
  })

  it('omits focus section when focus is empty string', () => {
    const prompt = buildAbWritePrompt({
      testType: 'thumbnail',
      data: makeAbBriefingData(),
      focus: '',
    })
    expect(prompt).not.toContain('Instruções adicionais do usuário:')
  })
})

describe('buildAbReviewPrompt', () => {
  it('includes blob URLs for multimodal analysis', () => {
    const prompt = buildAbReviewPrompt({
      testId: 'test-1',
      locale: 'pt',
      variants: [
        { label: 'B', title_text: 'Title B', description_text: null, blob_url: 'https://blob.vercel-storage.com/img.png', metadata: {} },
      ],
      channel: { tier: 'micro', subscribers: 5000 },
    })
    expect(prompt).toContain('https://blob.vercel-storage.com/img.png')
    expect(prompt).toContain('Title B')
  })

  it('includes locale-appropriate language directive', () => {
    const prompt = buildAbReviewPrompt({
      testId: 'test-1',
      locale: 'en',
      variants: [
        { label: 'B', title_text: 'Title B', description_text: null, blob_url: null, metadata: {} },
      ],
      channel: { tier: 'micro', subscribers: 5000 },
    })
    expect(prompt).toContain('All output MUST be in English')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/web/test/youtube/prompt-builders-ab.test.ts --reporter=verbose 2>&1 | tail -30`
Expected: FAIL — `buildAbWritePrompt` and `buildAbReviewPrompt` not exported, locale tests fail.

- [ ] **Step 3: Parametrize LANGUAGE_DIRECTIVE in prompt-builders.ts**

In `apps/web/src/lib/youtube/prompt-builders.ts`, replace the `LANGUAGE_DIRECTIVE` constant (line 13) with:

```typescript
export const LANGUAGE_DIRECTIVES: Record<'pt' | 'en', string> = {
  pt: 'LANGUAGE REQUIREMENT: All output MUST be in Brazilian Portuguese (PT-BR). No exceptions.\nJSON field names stay in English. All prose output in PT-BR.',
  en: 'LANGUAGE REQUIREMENT: All output MUST be in English. No exceptions.\nJSON field names stay in English. All prose output in English.',
}
```

Update `buildSharedBase` (line 69-73) to accept optional locale:

```typescript
export function buildSharedBase(
  channel: Pick<PromptChannelInfo, 'tier' | 'subscribers'>,
  locale: 'pt' | 'en' = 'pt',
): string {
  const persona =
    channel.tier === 'nano' ? `${PERSONA}\n${NANO_CALIBRATION}` : PERSONA

  return [LANGUAGE_DIRECTIVES[locale], persona, GUARDRAILS, RESPONSE_FORMAT, CONFIDENCE_GUIDE].join('\n\n')
}
```

Update the internal `LANGUAGE_DIRECTIVE` usage in `buildYoutubePrompt` — the `buildSharedBase` call at line 142 already goes through the function, so no other changes needed. But remove the now-unused `LANGUAGE_DIRECTIVE` const reference from the `buildYoutubePrompt` function. Note: `buildYoutubePrompt` calls `buildSharedBase(channel)` which defaults to `locale='pt'`, so existing callers are backward compatible.

- [ ] **Step 4: Implement bilingual prompt-builders-ab.ts**

Replace the full contents of `apps/web/src/lib/youtube/prompt-builders-ab.ts` with the new version that includes:
- Bilingual `TEST_TYPE_INSTRUCTIONS` (Record<Locale, Record<TestType, string>>)
- Updated `buildAbBriefingPrompt` that passes `data.locale` to `buildSharedBase` and uses locale-keyed instructions
- New `buildAbWritePrompt` with workflow section and API endpoint instructions
- New `buildAbReviewPrompt` with blob URLs and multimodal evaluation

The key implementation:

```typescript
import { AB_BRIEFING_PROMPT_VERSION } from './prompt-types'
import type { AbBriefingData } from './prompt-types'
import type { TestType, VariantMetadata } from './ab-types'
import type { PromptChannelInfo } from './prompt-types'
import { buildSharedBase, escapeXmlTags } from './prompt-builders'
import { sanitizeForMarkdown } from './prompt-sanitize'

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
**Thumbnail:** Composição e enquadramento, paleta de cores, texto overlay
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

const WORKFLOW_STEPS: Record<Locale, (testId: string) => string> = {
  pt: (testId) => `## Workflow
1. Discuta as ideias com o usuário até atingir consenso
2. Para cada variante acordada (B, C, D), envie:
   POST /api/pipeline/youtube/ab-tests/${testId}/variants
   Headers: { "X-Pipeline-Key": "<key>", "Content-Type": "application/json" }
   Body: {
     "variants": [
       {
         "label": "B",
         "title_text": "<título ou null>",
         "description_text": "<descrição ou null>",
         "metadata": {
           "creative_direction": "<para thumbnails>",
           "ai_image_prompt": "<para geração de imagem AI>",
           "rationale": "<por que esta variante>"
         }
       }
     ]
   }
3. Confirme quais variantes foram criadas`,
  en: (testId) => `## Workflow
1. Discuss ideas with the user until consensus
2. For each agreed variant (B, C, D), send:
   POST /api/pipeline/youtube/ab-tests/${testId}/variants
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
3. Confirm which variants were created`,
}

const REVIEW_INSTRUCTIONS: Record<Locale, string> = {
  pt: `Avalie cada variante contra a original. Para cada uma, analise:
- Contraste visual e diferenciação
- Força do hook / curiosidade
- Probabilidade de click (estimativa qualitativa)
Dê uma nota de 1-5 para cada variante e recomende a melhor para testar primeiro.`,
  en: `Evaluate each variant against the original. For each one, analyze:
- Visual contrast and differentiation
- Hook strength / curiosity
- Click probability (qualitative estimate)
Rate each variant 1-5 and recommend the best one to test first.`,
}

function buildHistorySection(testHistory: AbBriefingData['testHistory']): string {
  if (testHistory.length === 0) return ''

  const completedTests = testHistory.filter(t => t.winner_label !== null)
  const avgLift =
    completedTests.length > 0
      ? completedTests.reduce((sum, t) => sum + (t.ctr_lift_percent ?? 0), 0) / completedTests.length
      : 0

  const winnerPatterns = completedTests
    .map(t => t.winner_label)
    .filter((v): v is string => v !== null)

  return JSON.stringify(
    {
      historico_ab: {
        testes_anteriores: testHistory.length,
        lift_medio: avgLift > 0 ? `+${avgLift.toFixed(1)}%` : 'N/A',
        padroes_vencedores: winnerPatterns,
      },
    },
    null,
    2,
  )
}

export function buildAbBriefingPrompt(options: {
  testType: TestType
  data: AbBriefingData
  focus?: string
}): string {
  const { testType, data, focus } = options
  const locale = data.locale ?? 'pt'
  const sharedBase = buildSharedBase(data.channel, locale)

  const videoHasData = data.video.ctr !== null || data.video.score !== null

  const contextPayload: Record<string, unknown> = {
    prompt_version: AB_BRIEFING_PROMPT_VERSION,
    current_time: new Date().toISOString(),
    channel: {
      name: data.channel.name,
      subscribers: data.channel.subscribers,
      tier: data.channel.tier,
    },
    video: {
      title: sanitizeForMarkdown(data.video.title, 200),
      thumbnailUrl: data.video.thumbnailUrl,
      ...(videoHasData
        ? {
            ctr: data.video.ctr,
            avgViewPercentage: data.video.avgViewPercentage,
            score: data.video.score,
            grade: data.video.grade,
          }
        : { nota: locale === 'pt' ? 'sem dados de performance disponíveis' : 'no performance data available' }),
    },
  }

  if (data.testId) {
    contextPayload.test_id = data.testId
  }
  if (data.locale) {
    contextPayload.locale = data.locale
  }

  const historySection = buildHistorySection(data.testHistory)
  if (historySection) {
    contextPayload.historico_ab = (JSON.parse(historySection) as { historico_ab: unknown }).historico_ab
  }

  const contextJson = JSON.stringify(contextPayload, null, 2)

  let instructions = TEST_TYPE_INSTRUCTIONS[locale][testType]
  if (focus) {
    const focusLabel = locale === 'pt' ? 'Instruções adicionais do usuário:' : 'Additional user instructions:'
    instructions += `\n\n${focusLabel}\n${escapeXmlTags(focus)}`
  }

  const noDataNote = locale === 'pt'
    ? 'Nota: sem dados de performance disponíveis para este vídeo. Use contexto do canal.'
    : 'Note: no performance data available for this video. Use channel context.'

  if (!videoHasData) {
    instructions += `\n\n${noDataNote}`
  }

  return `${sharedBase}

<context>
${contextJson}
</context>

<instructions>
${instructions}
</instructions>`
}

export function buildAbWritePrompt(options: {
  testType: TestType
  data: AbBriefingData
  focus?: string
}): string {
  const { testType, data, focus } = options
  const locale = data.locale ?? 'pt'
  const sharedBase = buildSharedBase(data.channel, locale)

  const videoHasData = data.video.ctr !== null || data.video.score !== null

  const contextPayload: Record<string, unknown> = {
    prompt_version: AB_BRIEFING_PROMPT_VERSION,
    current_time: new Date().toISOString(),
    test_id: data.testId,
    test_type: testType,
    channel: {
      name: data.channel.name,
      subscribers: data.channel.subscribers,
      tier: data.channel.tier,
    },
    video: {
      title: sanitizeForMarkdown(data.video.title, 200),
      thumbnailUrl: data.video.thumbnailUrl,
      ...(videoHasData
        ? {
            ctr: data.video.ctr,
            avgViewPercentage: data.video.avgViewPercentage,
            score: data.video.score,
            grade: data.video.grade,
          }
        : { nota: locale === 'pt' ? 'sem dados de performance disponíveis' : 'no performance data available' }),
    },
  }

  const historySection = buildHistorySection(data.testHistory)
  if (historySection) {
    contextPayload.historico_ab = (JSON.parse(historySection) as { historico_ab: unknown }).historico_ab
  }

  const contextJson = JSON.stringify(contextPayload, null, 2)

  let instructions = TEST_TYPE_INSTRUCTIONS[locale][testType]
  instructions += '\n\n' + WORKFLOW_STEPS[locale](data.testId)

  if (focus) {
    const focusLabel = locale === 'pt' ? 'Instruções adicionais do usuário:' : 'Additional user instructions:'
    instructions += `\n\n${focusLabel}\n${escapeXmlTags(focus)}`
  }

  return `${sharedBase}

<context>
\`\`\`json
${contextJson}
\`\`\`
</context>

<instructions>
${instructions}
</instructions>`
}

export function buildAbReviewPrompt(options: {
  testId: string
  locale: 'pt' | 'en'
  variants: Array<{
    label: string
    title_text: string | null
    description_text: string | null
    blob_url: string | null
    metadata: VariantMetadata | Record<string, unknown>
  }>
  channel: Pick<PromptChannelInfo, 'tier' | 'subscribers'>
}): string {
  const { testId, locale, variants, channel } = options
  const sharedBase = buildSharedBase(channel, locale)

  const contextPayload = {
    prompt_version: AB_BRIEFING_PROMPT_VERSION,
    test_id: testId,
    variants: variants.map(v => ({
      label: v.label,
      title_text: v.title_text,
      description_text: v.description_text,
      blob_url: v.blob_url,
      metadata: v.metadata,
    })),
  }

  const contextJson = JSON.stringify(contextPayload, null, 2)

  return `${sharedBase}

<context>
\`\`\`json
${contextJson}
\`\`\`
</context>

<instructions>
${REVIEW_INSTRUCTIONS[locale]}
</instructions>`
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run apps/web/test/youtube/prompt-builders-ab.test.ts --reporter=verbose 2>&1 | tail -30`
Expected: All tests PASS.

- [ ] **Step 6: Run existing prompt-builders tests to verify no regression**

Run: `npx vitest run apps/web/test/youtube/prompt-builders.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: All existing tests PASS (buildSharedBase default locale='pt' preserves behavior).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/youtube/prompt-builders.ts apps/web/src/lib/youtube/prompt-builders-ab.ts apps/web/test/youtube/prompt-builders-ab.test.ts
git commit -m "feat(ab-lab): locale-aware prompt builders with write and review prompts"
```

---

### Task 5: API Route — Variant CRUD Endpoint

**Files:**
- Create: `apps/web/src/app/api/pipeline/youtube/ab-tests/[id]/variants/route.ts`
- Create: `apps/web/test/api/pipeline/ab-variants-route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/api/pipeline/ab-variants-route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const MOCK_SITE_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_TEST_ID = '22222222-2222-2222-2222-222222222222'
const MOCK_VARIANT_ID = '33333333-3333-3333-3333-333333333333'

vi.mock('@/lib/pipeline/helpers', () => ({
  authenticateRead: vi.fn(),
  authenticateWrite: vi.fn(),
  pipelineError: vi.fn(
    (code: string, msg: string, status: number) =>
      new Response(JSON.stringify({ error: { code, message: msg } }), { status }),
  ),
  pipelineSuccess: vi.fn(
    (data: unknown, status: number) =>
      new Response(JSON.stringify({ data }), { status }),
  ),
  parseBody: vi.fn(),
}))

vi.mock('@/lib/pipeline/auth', () => ({
  buildRateLimitHeaders: vi.fn().mockReturnValue(undefined),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

vi.mock('@/lib/pipeline/logger', () => ({
  pipelineLog: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { authenticateRead, authenticateWrite, parseBody } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const AUTH_OK = {
  ok: true,
  auth: { siteId: MOCK_SITE_ID, permissions: ['read', 'write'], source: 'api_key' as const, keyHash: 'test' },
} as any

function createMockChain(finalResult: { data?: unknown; error?: unknown; count?: number | null }) {
  const chain: Record<string, any> = {}
  for (const m of [
    'from', 'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'is', 'in', 'or', 'order', 'limit', 'not', 'neq',
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.single = vi.fn().mockResolvedValue({ data: finalResult.data, error: finalResult.error })
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: finalResult.data, error: finalResult.error })
  chain.then = (resolve: (v: any) => any) =>
    resolve({ data: finalResult.data, error: finalResult.error, count: finalResult.count ?? null })
  return chain
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeRequest(method: string, path: string, body?: unknown) {
  const url = `http://localhost:3000${path}`
  const init: RequestInit = { method, headers: { 'content-type': 'application/json' } }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest(url, init)
}

describe('POST /api/pipeline/youtube/ab-tests/:id/variants', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/ab-tests/[id]/variants/route')
    POST = mod.POST
  })

  it('returns 401 when auth fails', async () => {
    const resp = new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 })
    vi.mocked(authenticateWrite).mockResolvedValue(resp as any)

    const req = makeRequest('POST', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await POST(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(401)
  })

  it('returns 400 for invalid UUID', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)
    vi.mocked(parseBody).mockResolvedValue({ variants: [{ label: 'B', title_text: 'Test' }] })

    const req = makeRequest('POST', '/api/pipeline/youtube/ab-tests/not-a-uuid/variants')
    const result = await POST(req, makeParams('not-a-uuid'))
    expect(result.status).toBe(400)
  })

  it('returns 400 for invalid body (empty variants)', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)
    vi.mocked(parseBody).mockResolvedValue({ variants: [] })

    const req = makeRequest('POST', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await POST(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(400)
  })

  it('returns 404 when test not found', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)
    vi.mocked(parseBody).mockResolvedValue({ variants: [{ label: 'B', title_text: 'Test' }] })

    const chain = createMockChain({ data: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: () => chain } as any)

    const req = makeRequest('POST', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await POST(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(404)
  })

  it('returns 409 when test is not draft', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)
    vi.mocked(parseBody).mockResolvedValue({ variants: [{ label: 'B', title_text: 'Test' }] })

    const chain = createMockChain({ data: { id: MOCK_TEST_ID, status: 'active', site_id: MOCK_SITE_ID, test_type: 'title' } })
    vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: () => chain } as any)

    const req = makeRequest('POST', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await POST(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(409)
  })

  it('returns 200 with results on successful upsert', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)
    vi.mocked(parseBody).mockResolvedValue({
      variants: [{ label: 'B', title_text: 'Title B', metadata: { rationale: 'test' } }],
    })

    const testChain = createMockChain({
      data: { id: MOCK_TEST_ID, status: 'draft', site_id: MOCK_SITE_ID, test_type: 'title' },
    })
    const upsertChain = createMockChain({
      data: [{ id: MOCK_VARIANT_ID, label: 'B' }],
    })
    upsertChain.select = vi.fn().mockReturnValue(upsertChain)
    upsertChain.then = (resolve: (v: any) => any) =>
      resolve({ data: [{ id: MOCK_VARIANT_ID, label: 'B' }], error: null })

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => {
        callCount++
        return callCount === 1 ? testChain : upsertChain
      },
    } as any)

    const req = makeRequest('POST', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await POST(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(200)
  })
})

describe('GET /api/pipeline/youtube/ab-tests/:id/variants', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/ab-tests/[id]/variants/route')
    GET = mod.GET
  })

  it('returns variants ordered by sort_order', async () => {
    vi.mocked(authenticateRead).mockResolvedValue(AUTH_OK)

    const variants = [
      { id: '1', label: 'original', sort_order: 0 },
      { id: '2', label: 'B', sort_order: 1 },
    ]
    const testChain = createMockChain({
      data: { id: MOCK_TEST_ID, site_id: MOCK_SITE_ID },
    })
    const variantChain = createMockChain({ data: variants })

    let callCount = 0
    vi.mocked(getSupabaseServiceClient).mockReturnValue({
      from: () => {
        callCount++
        return callCount === 1 ? testChain : variantChain
      },
    } as any)

    const req = makeRequest('GET', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await GET(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(200)
  })
})

describe('DELETE /api/pipeline/youtube/ab-tests/:id/variants', () => {
  let DELETE: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../../../src/app/api/pipeline/youtube/ab-tests/[id]/variants/route')
    DELETE = mod.DELETE
  })

  it('returns 400 when label query param is missing', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)

    const req = makeRequest('DELETE', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants`)
    const result = await DELETE(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(400)
  })

  it('returns 400 for invalid label', async () => {
    vi.mocked(authenticateWrite).mockResolvedValue(AUTH_OK)

    const req = makeRequest('DELETE', `/api/pipeline/youtube/ab-tests/${MOCK_TEST_ID}/variants?label=A`)
    const result = await DELETE(req, makeParams(MOCK_TEST_ID))
    expect(result.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/web/test/api/pipeline/ab-variants-route.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — route module does not exist.

- [ ] **Step 3: Implement the route handler**

Create `apps/web/src/app/api/pipeline/youtube/ab-tests/[id]/variants/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { authenticateRead, authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { BatchVariantUpsertSchema } from '@/lib/youtube/ab-schemas'
import type { TestType } from '@/lib/youtube/ab-types'

const VALID_LABELS = new Set(['B', 'C', 'D'])

function validateTypeSpecificFields(
  testType: TestType,
  variants: Array<{ label: string; title_text?: string | null; description_text?: string | null }>,
): string[] {
  const errors: string[] = []
  for (const v of variants) {
    if (testType === 'title' && !v.title_text) {
      errors.push(`Variant ${v.label}: title_text required for title tests`)
    }
    if (testType === 'description' && !v.description_text) {
      errors.push(`Variant ${v.label}: description_text required for description tests`)
    }
    if (testType === 'combo' && !v.title_text) {
      errors.push(`Variant ${v.label}: title_text required for combo tests`)
    }
  }
  return errors
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid test ID format', 400, auth)
  }

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = BatchVariantUpsertSchema.safeParse(body)
  if (!parsed.success) {
    return pipelineError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request body', 400, auth)
  }

  const supabase = getSupabaseServiceClient()

  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('id, status, site_id, test_type')
    .eq('id', id)
    .single()

  if (testError || !test) {
    return pipelineError('NOT_FOUND', 'Test not found', 404, auth)
  }
  if (test.site_id !== auth.siteId) {
    return pipelineError('NOT_FOUND', 'Test not found', 404, auth)
  }
  if (test.status !== 'draft') {
    return pipelineError('INVALID_STATUS', 'Variants can only be added to draft tests', 409, auth)
  }

  const typeErrors = validateTypeSpecificFields(
    test.test_type as TestType,
    parsed.data.variants,
  )
  if (typeErrors.length > 0) {
    return pipelineError('VALIDATION_ERROR', typeErrors.join('; '), 400, auth)
  }

  const upsertRows = parsed.data.variants.map((v, i) => ({
    test_id: id,
    label: v.label,
    is_original: false,
    title_text: v.title_text ?? null,
    description_text: v.description_text ?? null,
    metadata: v.metadata ?? {},
    sort_order: i + 1,
  }))

  const { data: upserted, error: upsertError } = await supabase
    .from('ab_test_variants')
    .upsert(upsertRows, { onConflict: 'test_id,label' })
    .select('id, label')

  if (upsertError) {
    return pipelineError('DB_ERROR', upsertError.message, 500, auth)
  }

  const results = (upserted ?? []).map(r => ({
    label: r.label,
    ok: true,
    id: r.id,
  }))

  return pipelineSuccess(
    {
      results,
      summary: { total: results.length, succeeded: results.length, failed: 0 },
    },
    200,
    auth,
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid test ID format', 400, auth)
  }

  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id')
    .eq('id', id)
    .single()

  if (!test || test.site_id !== auth.siteId) {
    return pipelineError('NOT_FOUND', 'Test not found', 404, auth)
  }

  const { data: variants, error } = await supabase
    .from('ab_test_variants')
    .select('*')
    .eq('test_id', id)
    .order('sort_order', { ascending: true })

  if (error) {
    return pipelineError('DB_ERROR', error.message, 500, auth)
  }

  return pipelineSuccess(variants ?? [], 200, auth)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid test ID format', 400, auth)
  }

  const { searchParams } = new URL(req.url)
  const label = searchParams.get('label')
  if (!label || !VALID_LABELS.has(label)) {
    return pipelineError('VALIDATION_ERROR', 'Query param "label" must be B, C, or D', 400, auth)
  }

  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id, status')
    .eq('id', id)
    .single()

  if (!test || test.site_id !== auth.siteId) {
    return pipelineError('NOT_FOUND', 'Test not found', 404, auth)
  }
  if (test.status !== 'draft') {
    return pipelineError('INVALID_STATUS', 'Variants can only be deleted from draft tests', 409, auth)
  }

  const { data: variant } = await supabase
    .from('ab_test_variants')
    .select('id, is_original')
    .eq('test_id', id)
    .eq('label', label)
    .single()

  if (!variant) {
    return pipelineError('NOT_FOUND', 'Variant not found', 404, auth)
  }
  if (variant.is_original) {
    return pipelineError('VALIDATION_ERROR', 'Cannot delete the original variant', 400, auth)
  }

  const { error: deleteError } = await supabase
    .from('ab_test_variants')
    .delete()
    .eq('id', variant.id)

  if (deleteError) {
    return pipelineError('DB_ERROR', deleteError.message, 500, auth)
  }

  return pipelineSuccess({ deleted: true, label }, 200, auth)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/web/test/api/pipeline/ab-variants-route.test.ts --reporter=verbose 2>&1 | tail -30`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/pipeline/youtube/ab-tests/\[id\]/variants/route.ts apps/web/test/api/pipeline/ab-variants-route.test.ts
git commit -m "feat(ab-lab): variant CRUD pipeline endpoint with batch upsert"
```

---

### Task 6: Registry & Documentation

**Files:**
- Modify: `apps/web/src/lib/pipeline/api-registry.ts:142-158`
- Modify: `apps/web/data/pipeline-docs/cowork-docs-youtube.md`
- Modify: `apps/web/vercel.json`

- [ ] **Step 1: Run existing registry completeness test to see baseline**

Run: `npx vitest run apps/web/test/api/pipeline/registry-completeness.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: PASS at current state (endpoint_count=7).

- [ ] **Step 2: Update api-registry.ts**

In `apps/web/src/lib/pipeline/api-registry.ts`, update the YOUTUBE constant:

Change `endpoint_count: 7` to `endpoint_count: 10` and add 3 new endpoints after line 157 (before the closing `]`):

```typescript
    { method: 'POST', path: '/api/pipeline/youtube/ab-tests/:id/variants', summary: 'Batch upsert variants for A/B test', auth: 'write' },
    { method: 'GET', path: '/api/pipeline/youtube/ab-tests/:id/variants', summary: 'List variants for A/B test', auth: 'read' },
    { method: 'DELETE', path: '/api/pipeline/youtube/ab-tests/:id/variants', summary: 'Delete variant from A/B test', auth: 'write' },
```

- [ ] **Step 3: Add variant CRUD documentation to cowork-docs-youtube.md**

Append to `apps/web/data/pipeline-docs/cowork-docs-youtube.md` a new section (≥100 lines) documenting the variant CRUD endpoints with full request/response examples, error codes, and a complete workflow example.

The section must include:
- POST batch upsert: full request/response JSON, type-specific field requirements table
- GET list: response shape, ordering
- DELETE: label query param, draft-only guard
- Error codes: VALIDATION_ERROR (400), NOT_FOUND (404), INVALID_STATUS (409)
- Complete example: brainstorm → batch upsert → GET verify

- [ ] **Step 4: Add cron entry to vercel.json**

In `apps/web/vercel.json`, add to the `crons` array:

```json
{ "path": "/api/cron/ab-draft-cleanup", "schedule": "0 4 * * *" }
```

- [ ] **Step 5: Run registry completeness test**

Run: `npx vitest run apps/web/test/api/pipeline/registry-completeness.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: PASS — endpoint_count matches, route file exists, exports match.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/pipeline/api-registry.ts apps/web/data/pipeline-docs/cowork-docs-youtube.md apps/web/vercel.json
git commit -m "feat(ab-lab): register variant endpoints and add Cowork documentation"
```

---

### Task 7: Cron — Draft Cleanup

**Files:**
- Create: `apps/web/src/app/api/cron/ab-draft-cleanup/route.ts`

- [ ] **Step 1: Write failing test**

Create a minimal test in the existing youtube cron test file or a new one. Since the cron follows the exact media-cleanup pattern, we test the auth guard and basic behavior:

Add to `apps/web/test/youtube/cron-route.test.ts` (or create if testing convention differs — check the existing file first):

The cron test should verify:
- Returns 401 without valid CRON_SECRET
- The route exports a POST function

- [ ] **Step 2: Implement the cron route**

Create `apps/web/src/app/api/cron/ab-draft-cleanup/route.ts`:

```typescript
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const JOB = 'ab-draft-cleanup'
const LOCK_KEY = 'cron:ab-draft-cleanup'
const ARCHIVE_AFTER_HOURS = 24
const HARD_DELETE_AFTER_DAYS = 30
const BATCH_SIZE = 50

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    let archived = 0
    let hardDeleted = 0

    const archiveCutoff = new Date()
    archiveCutoff.setHours(archiveCutoff.getHours() - ARCHIVE_AFTER_HOURS)

    const { data: staleDrafts, error: draftErr } = await supabase
      .from('ab_tests')
      .select('id')
      .eq('status', 'draft')
      .lt('created_at', archiveCutoff.toISOString())
      .limit(BATCH_SIZE)

    if (draftErr) {
      Sentry.captureException(draftErr, { tags: { component: JOB } })
      return { status: 'error' as const, error: draftErr.message }
    }

    if (staleDrafts && staleDrafts.length > 0) {
      const ids = staleDrafts.map(d => d.id as string)
      const { error: updateErr } = await supabase
        .from('ab_tests')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .in('id', ids)

      if (updateErr) {
        Sentry.captureException(updateErr, { tags: { component: JOB } })
        return { status: 'error' as const, error: updateErr.message }
      }
      archived = ids.length
    }

    const hardDeleteCutoff = new Date()
    hardDeleteCutoff.setDate(hardDeleteCutoff.getDate() - HARD_DELETE_AFTER_DAYS)

    const { data: oldArchived, error: oldErr } = await supabase
      .from('ab_tests')
      .select('id')
      .eq('status', 'archived')
      .lt('updated_at', hardDeleteCutoff.toISOString())
      .limit(BATCH_SIZE)

    if (oldErr) {
      Sentry.captureException(oldErr, { tags: { component: JOB } })
      return { status: 'error' as const, error: oldErr.message }
    }

    if (oldArchived && oldArchived.length > 0) {
      const ids = oldArchived.map(d => d.id as string)
      const { error: deleteErr } = await supabase
        .from('ab_tests')
        .delete()
        .in('id', ids)

      if (deleteErr) {
        Sentry.captureException(deleteErr, { tags: { component: JOB } })
      } else {
        hardDeleted = ids.length
      }
    }

    return { status: 'ok' as const, ok: true, archived, hardDeleted }
  })
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run apps/web/test/youtube/cron-route.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/cron/ab-draft-cleanup/route.ts
git commit -m "feat(ab-lab): add cron job for draft cleanup (archive 24h, delete 30d)"
```

---

### Task 8: Server Action — fetchAbBriefingData Returns Locale + TestId

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts:1265-1333`

- [ ] **Step 1: Write failing test**

The `fetchAbBriefingData` is a server action that's tested via the component tests. We verify by checking that the step-ideias test's mock data factory includes `locale` and `testId`, and that the existing tests still pass.

Since `fetchAbBriefingData` is a server action and needs DB mocking, the most effective test is via the component. Update the mock factory in `apps/web/test/youtube/step-ideias.test.tsx` to include `locale` and `testId` in `makeAbBriefingData`.

- [ ] **Step 2: Modify fetchAbBriefingData in actions.ts**

In `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`, update `fetchAbBriefingData` (starting at line 1265):

1. Add `locale` to the channel SELECT query:
   Change `.select('name, subscriber_count')` to `.select('name, subscriber_count, locale')`

2. Add the locale to the return data:
   After the `tier` calculation (around line 1288), add:
   ```typescript
   const locale = (channel?.locale as 'pt' | 'en' | null) ?? 'pt'
   ```

3. Update the return object to include `locale`:
   In the `data:` return block (around line 1315-1331), add:
   ```typescript
   locale,
   testId: '', // Will be set by wizard, not by this function
   ```

Wait — the spec says `testId` should be in `AbBriefingData` but `fetchAbBriefingData` can't know the test ID (the test might not exist yet when fetching briefing data). The `testId` is set by the wizard after draft creation. So `fetchAbBriefingData` returns `testId: ''` as placeholder and the wizard overrides it.

Actually, let me re-read the spec... The spec says `fetchAbBriefingData` returns `locale + testId`. But for the briefing prompt (read-only), testId is not needed. For the write prompt, the wizard already has `draftTestId`. So `fetchAbBriefingData` should return `locale` but not `testId` — the wizard constructs the full `AbBriefingData` by merging `fetchAbBriefingData` result with the `draftTestId`.

Update approach: `fetchAbBriefingData` returns `locale` only. The wizard adds `testId` when constructing prompt data.

In `fetchAbBriefingData`, update:

```typescript
// In the channel query (line ~1283):
const { data: channel } = await supabase
  .from('youtube_channels')
  .select('name, subscriber_count, locale')
  .eq('id', video.channel_id as string)
  .eq('site_id', siteId)
  .maybeSingle()

// After tier calculation:
const locale = (channel?.locale as 'pt' | 'en' | null) ?? 'pt'

// In the return block, add locale and testId:
return {
  ok: true,
  data: {
    channel: {
      name: (channel?.name as string | null) ?? 'Canal',
      subscribers,
      tier,
    },
    locale,
    testId: '',
    video: { /* ... same as before ... */ },
    testHistory: historyForBriefing,
    snapshotAgeHours,
  },
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run apps/web/test/youtube/ --reporter=verbose 2>&1 | tail -30`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/youtube/ab-lab/actions.ts
git commit -m "feat(ab-lab): fetchAbBriefingData returns locale from youtube_channels"
```

---

### Task 9: Wizard UX — Early Draft Creation + draftTestId State

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx`

- [ ] **Step 1: Identify changes needed**

In `ab-create-wizard.tsx`, the following changes are required:

1. Add `draftTestId` state variable
2. Move `createAbTest` call from `handleSubmit` to `handleTypeSelect`
3. Handle draft collision (existing draft for same video)
4. Pass `draftTestId` to StepIdeias
5. Update `handleSubmit` to use existing draft instead of creating new test

- [ ] **Step 2: Implement early draft creation**

Update `ab-create-wizard.tsx`:

Add state:
```typescript
const [draftTestId, setDraftTestId] = useState<string | null>(null)
const [draftLoading, setDraftLoading] = useState(false)
```

Replace `handleTypeSelect` (line 280-283):
```typescript
async function handleTypeSelect(type: TestType) {
  setTestType(type)
  setDraftLoading(true)
  setSubmitError(null)

  const result = await createAbTest({
    site_id: siteId,
    youtube_video_id: video.id,
    name: `Test: ${video.title}`,
    test_type: type,
    config,
  })

  setDraftLoading(false)

  if (result.ok && result.id) {
    setDraftTestId(result.id)
    setStep(2)
  } else if (result.error?.includes('already exists')) {
    // Draft collision — offer to resume
    setSubmitError('Já existe um rascunho para este vídeo. Feche e reabra para continuar.')
  } else {
    setSubmitError(result.error ?? 'Falha ao criar rascunho')
  }
}
```

Update StepIdeias props to include `draftTestId`:
```typescript
{step === 2 && (
  <StepIdeias
    testType={testType}
    video={video}
    focus={ideiasFocus}
    onFocusChange={setIdeiasFocus}
    slotNotes={slotNotes}
    onSlotNoteChange={handleSlotNoteChange}
    briefingCopied={briefingCopied}
    onBriefingCopied={handleBriefingCopied}
    briefingData={briefingData}
    onBriefingDataChange={handleBriefingDataChange}
    draftTestId={draftTestId}
  />
)}
```

Update `handleSubmit` to use existing `draftTestId` instead of creating a new test:
```typescript
function handleSubmit(isLaunch: boolean) {
  setSubmitError(null)
  startTransition(async () => {
    let testId = draftTestId

    if (!testId) {
      const result = await createAbTest({
        site_id: siteId,
        youtube_video_id: video.id,
        name: `Test: ${video.title}`,
        test_type: testType,
        config,
      })
      if (!result.ok || !result.id) {
        setSubmitError(result.error ?? 'Falha ao criar teste')
        return
      }
      testId = result.id
    }

    // Upload image variants (for thumbnail and combo types)
    // ... rest of the upload/text variant logic stays the same but uses testId variable ...

    if (isLaunch) {
      const startResult = await startAbTest(testId)
      if (!startResult.ok) {
        setSubmitError(startResult.error ?? 'Falha ao iniciar teste')
        return
      }
    }
    try { sessionStorage.removeItem(storageKey) } catch { /* ignore */ }
    onCreated(testId)
  })
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run apps/web/test/youtube/step-ideias.test.tsx --reporter=verbose 2>&1 | tail -20`
Expected: Tests should still pass (StepIdeias tests don't depend on draftTestId yet).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/youtube/ab-lab/_components/ab-create-wizard.tsx
git commit -m "feat(ab-lab): early draft creation at Step 1 with draftTestId state"
```

---

### Task 10: Wizard UX — StepIdeias Redesign (Write Prompt + SWR Polling + Variant Cards)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-ideias.tsx`
- Update: `apps/web/test/youtube/step-ideias.test.tsx`

- [ ] **Step 1: Write failing tests**

Update `apps/web/test/youtube/step-ideias.test.tsx` to add:

```typescript
// Add mock for buildAbWritePrompt
vi.mock('@/lib/youtube/prompt-builders-ab', () => ({
  buildAbBriefingPrompt: vi.fn(() => 'MOCK_BRIEFING_PROMPT'),
  buildAbWritePrompt: vi.fn(() => 'MOCK_WRITE_PROMPT with POST /api/pipeline/youtube/ab-tests/test-id/variants'),
}))

// Add these new tests:

it('renders write prompt when draftTestId is provided', async () => {
  // Update props to include draftTestId
  // ...
  expect(screen.getByTestId('prompt-preview')).toHaveTextContent('MOCK_WRITE_PROMPT')
})

it('shows variant cards when SWR returns data', async () => {
  // Mock global.fetch to return variants from SWR polling
  // ...
})
```

- [ ] **Step 2: Run tests to see them fail**

Run: `npx vitest run apps/web/test/youtube/step-ideias.test.tsx --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — new tests fail because StepIdeias doesn't accept draftTestId yet.

- [ ] **Step 3: Implement StepIdeias redesign**

Update `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-ideias.tsx`:

1. Add `draftTestId` to `StepIdeiasProps`:
   ```typescript
   interface StepIdeiasProps {
     // ... existing props ...
     draftTestId: string | null
   }
   ```

2. Import SWR and `buildAbWritePrompt`:
   ```typescript
   import useSWR from 'swr'
   import { buildAbBriefingPrompt, buildAbWritePrompt } from '@/lib/youtube/prompt-builders-ab'
   ```

3. Add SWR polling for external variants:
   ```typescript
   const variantsFetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data ?? [])

   const { data: externalVariants } = useSWR(
     draftTestId ? `/api/pipeline/youtube/ab-tests/${draftTestId}/variants` : null,
     variantsFetcher,
     { refreshInterval: 5_000, revalidateOnFocus: true, dedupingInterval: 3_000 },
   )

   const nonOriginalVariants = (externalVariants ?? []).filter(
     (v: { is_original: boolean }) => !v.is_original,
   )
   ```

4. Switch prompt generation:
   - If `draftTestId` is set, use `buildAbWritePrompt` instead of `buildAbBriefingPrompt`
   - The write prompt includes the test_id and API instructions

   ```typescript
   const prompt = briefingData
     ? draftTestId
       ? buildAbWritePrompt({
           testType,
           data: { ...briefingData, testId: draftTestId },
           focus: focus || undefined,
         })
       : buildAbBriefingPrompt({ testType, data: briefingData, focus: focus || undefined })
     : ''
   ```

5. Add variant cards section after the prompt card:
   ```typescript
   {/* External variant cards */}
   {nonOriginalVariants.length > 0 && (
     <div className="space-y-2">
       <h4 className="text-xs font-medium text-cms-text">
         Variantes do Cowork
         <span className="ml-1.5 text-[10px] text-green-400 font-normal">
           {nonOriginalVariants.length} recebida{nonOriginalVariants.length > 1 ? 's' : ''}
         </span>
       </h4>
       {nonOriginalVariants.map((v: { label: string; title_text: string | null; description_text: string | null; metadata: Record<string, string> }) => (
         <div
           key={v.label}
           className="rounded-[var(--cms-radius)] border border-green-500/20 bg-green-500/5 p-3 space-y-1"
           style={{ animation: 'fadeIn 300ms ease-out' }}
         >
           <div className="flex items-center justify-between">
             <span className="text-xs font-semibold text-green-400">Variante {v.label}</span>
           </div>
           {v.title_text && (
             <p className="text-xs text-cms-text">{v.title_text}</p>
           )}
           {v.description_text && (
             <p className="text-[10px] text-cms-text-dim line-clamp-2">{v.description_text}</p>
           )}
           {v.metadata?.rationale && (
             <p className="text-[10px] text-cms-text-muted italic">{v.metadata.rationale}</p>
           )}
           {v.metadata?.creative_direction && (
             <p className="text-[10px] text-indigo-300">{v.metadata.creative_direction}</p>
           )}
         </div>
       ))}
     </div>
   )}

   {/* Waiting indicator when no variants yet */}
   {draftTestId && nonOriginalVariants.length === 0 && !loading && (
     <div className="rounded-[var(--cms-radius)] border border-dashed border-cms-border bg-cms-surface p-3 text-center">
       <p className="text-xs text-cms-text-dim">Aguardando variantes do Cowork...</p>
       <p className="text-[10px] text-cms-text-muted mt-1">Copie o prompt e cole no Claude. As variantes aparecerão aqui automaticamente.</p>
     </div>
   )}
   ```

- [ ] **Step 4: Run tests**

Run: `npx vitest run apps/web/test/youtube/step-ideias.test.tsx --reporter=verbose 2>&1 | tail -20`
Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `npm run test:web 2>&1 | tail -30`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/youtube/ab-lab/_components/step-ideias.tsx apps/web/test/youtube/step-ideias.test.tsx
git commit -m "feat(ab-lab): redesign StepIdeias with write prompt, SWR polling, and variant cards"
```

---

### Task 11: Final Integration — Build Verification + Full Test Suite

**Files:**
- All modified files from Tasks 1-10

- [ ] **Step 1: Run build:packages (if any packages/ touched)**

Run: `npm run build:packages`
Expected: Clean build. (This task doesn't touch packages/ but run as safety net.)

- [ ] **Step 2: Run full web test suite**

Run: `npm run test:web 2>&1 | tail -40`
Expected: All tests PASS. Pay attention to:
- `prompt-builders-ab.test.ts` — locale tests, v2 version, write/review prompts
- `ab-schemas.test.ts` — Zod validation
- `ab-variants-route.test.ts` — route handler tests
- `step-ideias.test.tsx` — component tests with SWR polling
- `registry-completeness.test.ts` — endpoint_count=10, route file exists

- [ ] **Step 3: Run next build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds. No type errors.

- [ ] **Step 4: Verify registry test**

Run: `npx vitest run apps/web/test/api/pipeline/registry-completeness.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: PASS — 10 endpoints, route file exists, docs ≥100 lines.

- [ ] **Step 5: Final commit (if any fixes needed)**

Only if fixes were required:
```bash
git add -A
git commit -m "fix(ab-lab): integration fixes for Cowork integration"
```
