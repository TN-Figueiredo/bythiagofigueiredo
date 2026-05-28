# CMS ↔ Cowork MCP Integration — Design Spec

**Date:** 2026-05-28
**Status:** Approved
**Scope:** 13 CMS touchpoints + Variant Studio + Result view improvements

## Problem

The CMS has 13 places where users hand off to the Cowork AI assistant. Today this requires copying multi-step prompts manually. With MCP connected, the handoff should be a single deep link click, and the CMS should display AI-generated content richly when Cowork writes back via MCP.

Additionally, the A/B test wizard (Steps 3-5) doesn't load existing variants, doesn't show AI metadata, and the result view lacks an actionable winner banner.

## Architecture: Two Separate Surfaces

### 1. Wizard de Criação (rich AI specs)
Where Cowork delivers variant analysis. Located in the A/B wizard Steps 2-3.

### 2. Resultado A/B (clean metrics)
Post-test view. CTR, confidence, winner. Let numbers speak. The existing Bayesian engine + charts stay.

**Principle:** Never mix AI predictions with real measurements.

## Shared Components

### `<CoworkDeepLink>`
Reusable button that opens `claude://cowork/new?q=${encodeURIComponent(instruction)}`.

```typescript
interface CoworkDeepLinkProps {
  instruction: string
  label?: string              // default "Abrir no Cowork"
  variant?: 'button' | 'icon' | 'inline'
  shortcut?: string           // e.g. "Cmd+P"
  className?: string
}
```

Behavior:
- Click → `window.open(deepLink, '_self')`
- Fallback: if no blur event after 500ms, copy instruction to clipboard + toast
- Tooltip shows instruction preview (first 120 chars)

File: `apps/web/src/components/cms/cowork-deep-link.tsx`

### `buildCoworkInstruction(template, params)`
Generates instruction strings for each touchpoint. Instructions are SHORT (<200 chars) because MCP provides full context.

File: `apps/web/src/lib/pipeline/cowork-instructions.ts`

Templates:
- `pipeline-section` → "Editar seção '{section}' do item {code}. Use o MCP bythiagofigueiredo."
- `pipeline-translate` → "Traduzir item {code} para {locale}."
- `pipeline-empty-section` → "Gerar conteúdo da seção '{section}' do item {code}."
- `youtube-ab-refine` → "Refinar variantes do teste A/B {testId}."
- `youtube-intelligence` → "Analisar performance do canal YouTube."
- `playlist-organize` → "Organizar playlist '{name}'."
- `reference-overview` → "Liste meus items no pipeline. Mostre status e sugira próximos passos."

### `useCoworkSync(key, fetcher, options)`
SWR-based hook for detecting Cowork writes.

```typescript
interface UseCoworkSyncOptions<T> {
  key: string | null
  fetcher: (key: string) => Promise<T>
  pollInterval?: number       // default 5000ms
  pollTimeout?: number        // default 120000ms
  fallbackData?: T
}

interface UseCoworkSyncReturn<T> {
  data: T | undefined
  syncState: 'empty' | 'loading' | 'loaded' | 'polling' | 'timeout'
  mutate: KeyedMutator<T>
  retryPolling: () => void
}
```

Primary sync: `revalidateOnFocus: true` (SWR built-in). No WebSocket needed for single-user.

File: `apps/web/src/lib/hooks/use-cowork-sync.ts`

### `<AiBadge>`
Provenance indicator. Shows "via Cowork" when content was AI-generated.

- AI untouched: `bg-indigo-500/15 text-indigo-400` + sparkle icon
- AI + edited: `bg-amber-500/15 text-amber-400` + "editado"
- Manual: no badge

File: `apps/web/src/components/cms/ai-badge.tsx`

## 13 Touchpoints — Deep Link Migration

| # | Location | Button Text | Instruction Template | Replaces Modal? |
|---|----------|-------------|---------------------|-----------------|
| 1 | Pipeline Section Toolbar | Abrir no Cowork | `pipeline-section` | Companion |
| 2 | Pipeline Translation | Abrir no Cowork | `pipeline-translate` | Yes |
| 3 | Pipeline Empty Section | Gerar com Cowork | `pipeline-empty-section` | New |
| 4 | Pipeline Social Post | Abrir no Cowork | `pipeline-section` | Yes |
| 5 | Music/SFX Picker | Abrir no Cowork | `audio-resolve` | New |
| 6 | YouTube Layout Header | Abrir no Cowork | `youtube-intelligence` | Yes (modal) |
| 7 | YouTube Video Optimizer | Abrir no Cowork | `youtube-intelligence` | Yes (modal) |
| 8 | YouTube A/B Lab Step 2 | Abrir no Cowork | `youtube-ab-refine` | Companion |
| 9 | YouTube A/B Lab Steps 3-5 | Refinar no Cowork | `youtube-ab-refine` | New |
| 10 | YouTube Analytics Health | Abrir no Cowork | `youtube-intelligence` | Upgrade |
| 11 | Playlists Graph Builder | Abrir no Cowork | `playlist-organize` | Yes (modal) |
| 12 | Playlists Notes Drawer | Abrir no Cowork | `playlist-organize` | New |
| 13 | Reference Editor | Abrir no Cowork | `reference-overview` | Done ✅ |

Modals to delete after migration:
- `cowork-prompt-modal.tsx` (pipeline)
- `youtube-cowork-prompt-modal.tsx`
- `prompt-generator-modal.tsx` (pipeline translation)
- `prompt-generator-modal.tsx` (playlist)

## Variant Studio (Wizard Step 3)

### Heatmap Table
Replaces radar chart. 3×3 table: rows = variants (B/C/D), columns = Thumb/Title/Combo.

- Scores: 1-10 scale (not 0-100)
- Combo column visually emphasized (larger font, separator border)
- Cell background intensity = score (higher = more saturated)
- Combo is NOT the average of Thumb+Title — it measures synergy

### Variant Cards (compact)
Each card:
- Top border in variant color (green/blue/amber)
- Variant label + combo score badge (e.g., "B · 9.3")
- Thumbnail slot with "Copiar Image Prompt" button
- **Editable title** (input field, not static text)
- Collapsible synergy note (summary = 1-line insight, detail = full composition/palette/expression specs)
- Palette swatches (click-to-copy hex)
- No tags in main view (too noisy)

### Actions
- "Regenerar" — clears variants, user re-prompts Cowork
- "Refinar no Cowork" — deep link with test ID
- "Próximo" — advances to Step 4

### Variant Loading
On Step 3 mount with `draftTestId`:
1. Call `fetchAbTestVariants(draftTestId)`
2. Populate `textVariants[]` + `variantMetadata[]` state
3. Skip if already hydrated from Step 2 polling

### Data Model
All AI metadata in existing `ab_test_variants.metadata` JSONB (no migration):

```typescript
interface VariantMetadata {
  composition?: { face_position?: string; background?: string; product_placement?: string }
  palette?: Array<{ hex: string; role: string; purpose?: string }>
  text_overlay?: { text: string; font?: string; size?: string; position?: string }
  expression?: string
  synergy?: { division?: string; reinforcement?: string }
  rationale?: string
  emotional_triggers?: string[]
  thumbnail_tags?: string[]
  ai_image_prompt?: string
  visual_description?: string
  score?: { thumbnail: number; title: number; combo: number }  // 1-10 scale
  classification?: 'hero' | 'challenger' | 'safety'
}
```

## Result View Improvements

### Winner Banner
Replaces current plain text. Shows:
- Winner thumbnail inline (120×68px)
- CTR lift (large, bold: "+12.3% CTR")
- Confidence + extra views/month + test duration
- **"Aplicar Winner"** button (actionable, pre-fills end-test dialog)

### Variant Results Table
Clean table: Variant | CTR | Impressions | Clicks | vs Original
- Winner row highlighted with green background
- Negative deltas in red
- "AI context" expandable per row (shows rationale, creative_direction from metadata)

### Existing Charts Stay
- Daily CTR chart ✅
- Confidence trend ✅
- Rotation timeline ✅
- No new charts needed

## Implementation Phases

### Phase 1: Foundation (3-4h)
- `<CoworkDeepLink>` component
- `buildCoworkInstruction()` utility
- `<AiBadge>` component
- `useCoworkSync` hook
- Touchpoint 13 audit (already done)
- Touchpoint 6 (YouTube header) conversion

### Phase 2: YouTube A/B Lab (4-5h)
- Heatmap table component
- Variant cards with inline edit + collapsible synergy
- Variant loading on Step 3 mount
- Step 2 deep link integration
- Steps 4-5 minor improvements
- Video Optimizer deep link (touchpoint 7)
- Analytics Health upgrade (touchpoint 10)

### Phase 3: Pipeline (2-3h)
- Touchpoints 1-4 (section toolbar, translation, empty, social)
- Pipeline item detail `useCoworkSync` for section updates

### Phase 4: Polish (2-3h)
- Touchpoint 5 (Music/SFX)
- Touchpoints 11-12 (Playlists)
- Winner banner for result view
- Variant results table with AI context expandable
- Delete old modals + tests
- Error boundaries for detail view + dashboard

**Total: 11-15h. Phases 2-4 parallelizable after Phase 1.**

## Non-Goals

- Radar/spider charts (3-axis is useless, heatmap is better)
- Hero/Challenger/Safety in result view (only in creation wizard)
- Evolution tracking v1→v2→v3 (Cowork handles internally)
- In-CMS thumbnail generation with satori (future — v2)
- Figma plugin integration (future)
- Supabase Realtime WebSocket (poll on focus is sufficient)
- 0-100 scoring scale (1-10 is more honest)
