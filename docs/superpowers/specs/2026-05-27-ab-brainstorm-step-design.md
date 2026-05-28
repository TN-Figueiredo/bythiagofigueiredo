# A/B Lab — Brainstorm com IA Step

> **Rev 1** — 2026-05-27

## Goal

Add a **step 2 "Ideias"** to the A/B test creation wizard (between Tipo and Variantes) that generates a contextual AI prompt, lets the user discuss ideas with Claude, and captures per-slot notes that carry through to the Variantes step as inline hints.

## Architecture

The wizard goes from 4 steps to 5: **Tipo → Ideias → Variantes → Config → Revisar**. The Ideias step is advisory — never blocking. The user can always skip to Variantes.

New code (~350 lines total):
- `buildAbBriefingPrompt()` — new prompt builder reusing `buildSharedBase()`
- `fetchAbBriefingData()` — lightweight server action (video CTR + channel tier)
- `StepIdeias` — inline wizard step component (not a modal)
- Tests for the new builder + integration

## Wizard State Changes

### New state in `AbCreateWizard`

```typescript
// Ideias step state (lifted to parent for persistence across step navigation)
const [ideiasFocus, setIdeiasFocus] = useState('')           // custom instructions textarea
const [slotNotes, setSlotNotes] = useState<[string, string, string]>(['', '', ''])
const [briefingCopied, setBriefingCopied] = useState(false)
const [briefingData, setBriefingData] = useState<AbBriefingData | null>(null)
```

### Step labels

```typescript
const STEP_LABELS = ['Tipo', 'Ideias', 'Variantes', 'Config', 'Revisar'] as const
```

### Step navigation

- Step 1 (Tipo): `handleTypeSelect` sets type → advances to step 2 (Ideias)
- Step 2 (Ideias): "Proximo" advances to step 3 (Variantes). Always enabled.
- Step 3 (Variantes): "Proximo" enabled when `hasVariantForType`. Shows brainstorm notes as hints.
- Step 4 (Config): Same as current step 3.
- Step 5 (Revisar): Same as current step 4.
- Prefill with `testType`: skips step 1, lands on step 2 (Ideias).

## New Types

### `AbBriefingData`

```typescript
interface AbBriefingData {
  channel: Pick<PromptChannelInfo, 'name' | 'subscribers' | 'tier'>
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

## New Prompt Builder

### `buildAbBriefingPrompt()`

**File:** `apps/web/src/lib/youtube/prompt-builders-ab.ts`

```typescript
export function buildAbBriefingPrompt(options: {
  testType: TestType
  data: AbBriefingData
  focus?: string      // user's custom instructions (optional)
}): string
```

**Structure:**
1. `buildSharedBase(data.channel)` — reuses persona, guardrails, confidence guide
2. `<context>` block with: channel info, video metrics, test history (cross-test learning)
3. `<instructions>` block with test-type-specific task template
4. User's `focus` text appended to instructions (escaped via `escapeXmlTags`)

### Test-type instruction templates

| Type | Focus |
|------|-------|
| `thumbnail` | Composicao visual, paleta de cores, texto overlay, expressao facial. 3 variacoes. |
| `title` | Hook emocional, power words, numeros/brackets, comprimento 50-60 chars. 3 variacoes. |
| `description` | CTA posicao, fold (3 primeiras linhas), links `{{link:nome}}`, hashtags. 3 variacoes. |
| `combo` | Sinergia thumb+titulo, complementaridade visual/textual. 3 combos coerentes. |

### Cross-test learning in context

If `testHistory.length > 0`, the prompt includes a `historico_ab` section:
```json
{
  "historico_ab": {
    "testes_anteriores": 3,
    "lift_medio": "+12.5%",
    "padroes_vencedores": ["close-up", "texto overlay"]
  }
}
```

## New Server Action

### `fetchAbBriefingData(videoId: string)`

**File:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`

Fetches minimal data for the prompt:
1. `youtube_videos` row → title, thumbnailUrl, ctr, avg_view_percentage
2. `youtube_channels` row → name, subscribers, tier (via existing `getChannelInfo` helper — needs extraction)
3. `youtube_video_scores` → latest score + grade
4. `getVideoTestHistory(videoId)` → past test results for cross-test context
5. `snapshotAgeHours` from `last_synced_at`

Returns `ActionResult<AbBriefingData>`.

**Graceful degradation:** If video has no scores or CTR data, returns `null` values. The prompt builder handles this by generating a channel-only context with a note "sem dados de video disponiveis."

## StepIdeias Component

**File:** `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-ideias.tsx`

### Props

```typescript
interface StepIdeiasProps {
  testType: TestType
  video: WizardVideo
  siteId: string
  focus: string
  onFocusChange: (value: string) => void
  slotNotes: [string, string, string]
  onSlotNoteChange: (index: number, value: string) => void
  briefingCopied: boolean
  onBriefingCopied: () => void
}
```

### Layout (top to bottom)

1. **Icon + title:** "Brainstorm com IA" with test-type-colored gradient icon
2. **Cross-test insights bar** (if test history exists): "Em X testes anteriores, thumbnails com close-up tiveram +Y% CTR"
3. **Asset preview:** Current thumbnail/title/description with metrics (CTR, grade, char count). Shows `DataFreshnessBadge` if stale.
4. **Custom instructions textarea** with example chips (clickable, test-type-specific)
5. **Prompt card:** Preview (truncated), "Ver prompt completo" expand toggle, "Copiar Prompt (Cmd+Enter)" button, "Abrir no Claude" button with privacy tooltip
6. **Per-slot notes (B, C, D):** Three labeled inputs with contextual placeholders. Auto-saved to `sessionStorage` keyed by `ab-brainstorm-${videoId}`.
7. **Tips:** 2-3 test-type-specific tips

### States

| State | Trigger | UI |
|-------|---------|-----|
| Loading | On mount, `fetchAbBriefingData` in flight | Skeleton for asset preview + prompt card. "Proximo" enabled (advisory step). |
| Error | Fetch fails | Error banner with "Tentar novamente". Prompt card hidden. User can still skip. |
| No data | Video has null CTR/grade | Amber banner "Sem dados de performance". Prompt generated with channel-only context. |
| Ready | Data loaded | Full UI with prompt preview, copy button, notes. |
| Post-copy | User clicks "Copiar Prompt" | Button → "Copiado!" (2s). Step dot gets green ring. Subtitle → "Prompt copiado! Discuta com o Claude e anote por slot." |
| Re-entry | User navigates back from Variantes | All state preserved (lifted to parent). No re-fetch. Shows "Copiar novamente" if already copied. |

### Keyboard & Accessibility

- `Cmd+Enter` / `Ctrl+Enter` on custom instructions textarea → copies prompt
- `role="status" aria-live="polite"` for step announcements (visually hidden)
- Focus moves to custom instructions textarea on step entry
- "Abrir no Claude" disabled when `encodedLength > 8000`
- Popup-blocked recovery: `toast.warning('Popup bloqueado — copie e cole manualmente')`
- `motion-safe:animate-fadeIn` on step content transition

### SessionStorage persistence

Key: `ab-brainstorm-${videoId}`
Value: `JSON.stringify({ focus, slotNotes })`

Saved on every change (debounced 500ms). Restored on mount. Cleared on wizard close or test creation.

## Variantes Step Enhancement

### Brainstorm reference panel

When `slotNotes.some(n => n.trim())`, show a collapsible panel at the top of Step 3 (Variantes):

```
💡 Suas ideias do brainstorm  [▾ Expandir]
  B: Close-up com expressao surpresa, cores quentes
  C: Texto overlay '5 COISAS' com fundo contrastante
  D: (sem anotacao)
```

### Per-slot hints

Each variant slot (B, C, D) in `ThumbnailUploadSection`, `TitleEditorSection`, and `DescriptionEditorSection` shows the corresponding brainstorm note as a small indigo hint above the upload/input area:

```
💡 Close-up com expressao surpresa, cores quentes
[Upload area / Input field]
```

Only shown when the note is non-empty.

## Mobile Responsive

### Stepper (< 480px)

Replace circle+label stepper with compact mode:
```
Ideias                    Passo 2 de 5
[====--------progress bar-----------]
```

### Body

Same layout, slightly smaller padding (16px vs 20px). Example chips wrap. Prompt preview shorter `max-h-20`.

## i18n Consistency

All new UI text in PT-BR. Flag existing English strings in Config step for future cleanup (not in scope):
- "Max Duration" → "Duração máxima" (deferred)
- "Confidence Threshold" → "Limiar de confiança" (deferred)

## Reuse Strategy

| Component/Function | Action | Notes |
|---|---|---|
| `buildSharedBase()` | REUSE | Import from prompt-builders.ts |
| `escapeXmlTags()` | REUSE | For user instructions sanitization |
| `PromptPreview` | REUSE | For prompt display |
| `DataFreshnessBadge` | REUSE | For stale data warning |
| `usePromptCopy` | EXTEND | Widen type to accept `'ab-briefing'` or create minimal parallel |
| `estimateChars()` | REUSE | For char count display |
| `sanitizeForMarkdown()` | REUSE | For title sanitization in prompt |
| `getVideoTestHistory()` | REUSE | Already exists in ab-lab actions |
| `toast` (sonner) | REUSE | For popup-blocked warning |
| `useFocusTrap` | NOT NEEDED | Wizard already handles Escape; focus management via useEffect |

## Testing Strategy

### Unit tests (~8 tests)

**File:** `apps/web/test/youtube/prompt-builders-ab.test.ts`

1. `buildAbBriefingPrompt` includes `buildSharedBase` output (persona, guardrails)
2. Thumbnail template includes visual composition instructions
3. Title template includes hook/power word instructions
4. Description template includes fold/CTA instructions
5. Combo template includes synergy instructions
6. Cross-test history included when available
7. Channel-only fallback when video data is null
8. Custom focus text appended and escaped

### Integration test (~4 tests)

**File:** `apps/web/test/youtube/ab-briefing-integration.test.ts`

1. Full prompt for each test type contains all expected sections
2. Prompt version matches expected format (`yt-ab-v1`)
3. Focus text appears in instructions block
4. Empty history → no `historico_ab` section

### Pattern

Follow existing factory function pattern from `prompt-builders.test.ts`:
- `makeAbBriefingData(overrides?)` factory
- String/regex matching for prompt structure validation
- No database dependency (pure function tests)

## Non-Goals

- No API calls to Claude from the wizard (user copies prompt manually)
- No auto-parsing of Claude responses
- No server-side persistence of brainstorm notes (sessionStorage only)
- No changes to existing prompt presets (content-calendar, channel-health, video-optimizer)
- No i18n cleanup of existing Config step English strings (deferred)
