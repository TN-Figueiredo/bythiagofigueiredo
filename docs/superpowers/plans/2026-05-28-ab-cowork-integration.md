# AB Lab Cowork Integration — Implementation Plan (Rev 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Step "Ideias" (Step 2) of the A/B wizard with 4 progressive UI states, fix SWR polling, inject slotNotes into prompts, unify variant labels, and auto-populate Step 3 from Cowork data.

**Architecture:** Backend (API route, schemas, registry, cron, prompt builders) is already fully implemented. This plan covers 4 targeted changes: label unification in server actions, slotNotes injection into the write prompt, Step 2 UI overhaul with progressive states, and Step 3 auto-populate bridge. Tasks 1-3 are independent and can run in parallel.

**Tech Stack:** React 19 + Next.js 15 + TypeScript 5 + Tailwind 4 + SWR 2.4.1 + Vitest

**Spec:** `docs/superpowers/specs/2026-05-28-ab-cowork-integration-design.md` (Rev 3)

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| MODIFY | `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts:33,1162` | VARIANT_LABELS unification |
| MODIFY | `apps/web/src/lib/youtube/prompt-builders-ab.ts:288-361` | slotNotes injection into buildAbWritePrompt |
| MODIFY | `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-ideias.tsx` | Step 2 progressive states UI overhaul |
| MODIFY | `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx:79-83,226-291,415-429` | Auto-populate bridge + submit flow guard |
| UPDATE | `apps/web/test/youtube/prompt-builders-ab.test.ts` | slotNotes injection tests |
| UPDATE | `apps/web/test/youtube/step-ideias.test.tsx` | Progressive states + polling tests |

---

### Task 1: Label unification in actions.ts

**Parallel:** Can run simultaneously with Tasks 2 and 3.

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts:33,1162`

**Context:** `VARIANT_LABELS` on line 33 and `VARIANT_LABELS_TEXT` on line 1162 both use `['variant_b', 'variant_c', 'variant_d']`. The pipeline API uses `['B', 'C', 'D']` (in `ab-schemas.ts`). The mismatch creates duplicate rows when Cowork sends variants via API and the wizard also creates them via server actions. Both constants must use `['B', 'C', 'D']`.

- [ ] **Step 1: Change VARIANT_LABELS on line 33**

In `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`, replace:

```typescript
const VARIANT_LABELS = ['variant_b', 'variant_c', 'variant_d'] as const
```

with:

```typescript
const VARIANT_LABELS = ['B', 'C', 'D'] as const
```

- [ ] **Step 2: Change VARIANT_LABELS_TEXT on line 1162**

In the same file, replace:

```typescript
  const VARIANT_LABELS_TEXT = ['variant_b', 'variant_c', 'variant_d'] as const
```

with:

```typescript
  const VARIANT_LABELS_TEXT = ['B', 'C', 'D'] as const
```

- [ ] **Step 3: Fix the fallback label in createTextVariant**

On line 1163, the fallback uses `variant_${sortOrder + 1}`. Update:

```typescript
  const label = input.label ?? VARIANT_LABELS_TEXT[sortOrder - 1] ?? `variant_${sortOrder + 1}`
```

to:

```typescript
  const label = input.label ?? VARIANT_LABELS_TEXT[sortOrder - 1] ?? `v${sortOrder + 1}`
```

- [ ] **Step 4: Run tests**

Run: `npm run test:web -- --run apps/web/test/youtube`
Expected: All existing tests pass (tests don't assert on specific label values)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts
git commit -m "fix(ab-lab): unify variant labels to B/C/D matching pipeline API"
```

---

### Task 2: slotNotes injection into buildAbWritePrompt

**Parallel:** Can run simultaneously with Tasks 1 and 3.

**Files:**
- Modify: `apps/web/src/lib/youtube/prompt-builders-ab.ts:288-361`
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-ideias.tsx:151-161`
- Update: `apps/web/test/youtube/prompt-builders-ab.test.ts`

**Context:** `slotNotes` are per-variant directions the user types in the hypothesis UI. Currently they are cosmetic-only — never injected into the prompt. The fix adds a `slotNotes` parameter to `buildAbWritePrompt` and injects non-empty notes after the type-specific instructions block (line 345) and before the optional user focus block (line 348).

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/test/youtube/prompt-builders-ab.test.ts` inside the `describe('buildAbWritePrompt')` block:

```typescript
  it('injects non-empty slotNotes as per-variant directions', () => {
    const result = buildAbWritePrompt({
      testType: 'combo',
      data: { ...makeAbBriefingData(), testId: 'test-123' },
      slotNotes: ['Close-up dramático', '', 'Minimalista preto'],
    })
    expect(result).toContain('Direções por variação')
    expect(result).toContain('Variação B: Close-up dramático')
    expect(result).not.toContain('Variação C:')
    expect(result).toContain('Variação D: Minimalista preto')
  })

  it('omits slotNotes section when all notes are empty', () => {
    const result = buildAbWritePrompt({
      testType: 'title',
      data: { ...makeAbBriefingData(), testId: 'test-123' },
      slotNotes: ['', '', ''],
    })
    expect(result).not.toContain('Direções por variação')
  })

  it('omits slotNotes section when slotNotes is undefined', () => {
    const result = buildAbWritePrompt({
      testType: 'title',
      data: { ...makeAbBriefingData(), testId: 'test-123' },
    })
    expect(result).not.toContain('Direções por variação')
  })

  it('escapes XML tags in slotNotes content', () => {
    const result = buildAbWritePrompt({
      testType: 'combo',
      data: { ...makeAbBriefingData(), testId: 'test-123' },
      slotNotes: ['Use <bold> text', '', ''],
    })
    expect(result).toContain('&lt;bold>')
    expect(result).not.toContain('<bold>')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- --run apps/web/test/youtube/prompt-builders-ab.test.ts`
Expected: 4 new tests FAIL (buildAbWritePrompt doesn't accept slotNotes param)

- [ ] **Step 3: Add slotNotes to buildAbWritePrompt signature and implementation**

In `apps/web/src/lib/youtube/prompt-builders-ab.ts`, update the function signature (line 288):

```typescript
export function buildAbWritePrompt(options: {
  testType: TestType
  data: AbBriefingData
  focus?: string
  baseUrl?: string
  slotNotes?: [string, string, string]
}): string {
  const { testType, data, focus, baseUrl = '', slotNotes } = options
```

Then after line 345 (`lines.push(TEST_TYPE_INSTRUCTIONS[locale][testType])`), add:

```typescript
  // Per-variant directions from hypothesis UI
  if (slotNotes?.some(n => n.trim())) {
    const labels = ['B', 'C', 'D'] as const
    const directions = slotNotes
      .map((note, i) => note.trim() ? `- Variação ${labels[i]}: ${escapeXmlTags(note.trim())}` : null)
      .filter(Boolean)
      .join('\n')
    lines.push('')
    lines.push(`## Direções por variação\n${directions}`)
  }
```

- [ ] **Step 4: Pass slotNotes from StepIdeias to buildAbWritePrompt**

In `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-ideias.tsx`, update the `prompt` useMemo (lines 151-161):

```typescript
  const prompt = useMemo(() => {
    if (!briefingData) return ''
    return draftTestId
      ? buildAbWritePrompt({
          testType,
          data: { ...briefingData, testId: draftTestId },
          focus: focus || undefined,
          baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
          slotNotes,
        })
      : buildAbBriefingPrompt({ testType, data: briefingData, focus: focus || undefined })
  }, [briefingData, draftTestId, testType, focus, slotNotes])
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:web -- --run apps/web/test/youtube/prompt-builders-ab.test.ts`
Expected: All tests PASS including the 4 new ones

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/youtube/prompt-builders-ab.ts apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-ideias.tsx apps/web/test/youtube/prompt-builders-ab.test.ts
git commit -m "feat(ab-lab): inject slotNotes as per-variant directions into write prompt"
```

---

### Task 3: Step 2 progressive states UI overhaul

**Parallel:** Can run simultaneously with Tasks 1 and 2.

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-ideias.tsx` (major rewrite)
- Update: `apps/web/test/youtube/step-ideias.test.tsx`

**Context:** The current Step 2 UI has a flat layout without progressive states. The v7 design introduces 4 states (pre-copy → waiting → partial → complete) with skeleton cards, dynamic footer, escalation message, and combo-specific variant cards. SWR polling currently stops after 1st variant — must continue until 3 arrive or 120s timeout.

**Design reference:** `docs/superpowers/specs/2026-05-28-ab-cowork-integration-design.md` Section 5 (v7 Design), and mockup at `.superpowers/brainstorm/97691-1779982385/content/13-v7-final.html`

**Design tokens (MUST follow):**
- Fonts: minimum 9px (`text-[9px]`). No 7px/8px.
- Opacities: Tailwind only — `/5`, `/10`, `/15`, `/20`. No arbitrary.
- Border-radius: `rounded` (4px inner), `rounded-lg` (8px cards), `rounded-full` (circles).
- Spacing: 4px grid only. No 3px/5px.
- Colors: `#6b7280` (muted, no `#9ca3af`), `#4b5563` (dimmed), `#e5e7eb` (primary), `#d1d5db` (body text).
- Combo gradient: `from-pink-500 to-purple-600`.
- Semantic: indigo for hypothesis/Cowork, amber for titles/warnings, green for success.

- [ ] **Step 1: Add onVariantsReceived prop to the interface**

This new callback is needed for Task 4 (auto-populate bridge). Add it now so the component's interface is stable.

In `step-ideias.tsx`, update `StepIdeiasProps` (line 22):

```typescript
interface StepIdeiasProps {
  testType: TestType
  video: WizardVideo
  focus: string
  onFocusChange: (value: string) => void
  slotNotes: [string, string, string]
  onSlotNoteChange: (index: number, value: string) => void
  briefingCopied: boolean
  onBriefingCopied: () => void
  briefingData: AbBriefingData | null
  onBriefingDataChange: (data: AbBriefingData | null) => void
  draftTestId?: string | null
  onVariantsReceived?: (variants: Array<{
    label: string
    title_text: string | null
    description_text: string | null
    metadata: Record<string, unknown> | null
  }>) => void
}
```

Destructure it in the function body (line 87): add `onVariantsReceived` to the destructured props.

- [ ] **Step 2: Replace state variables and SWR polling logic**

Replace the state declarations and SWR block (lines 88-116) with:

```typescript
  const [loading, setLoading] = useState(briefingData === null)
  const [error, setError] = useState<string | null>(null)
  const [promptExpanded, setPromptExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pollingTimedOut, setPollingTimedOut] = useState(false)
  const [showEscalation, setShowEscalation] = useState(false)
  const [directionsExpanded, setDirectionsExpanded] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchingRef = useRef(false)

  const variantsFetcher = async (url: string) => {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`Variants fetch failed: ${r.status}`)
    const d = await r.json()
    return d.data ?? []
  }

  const { data: externalVariants, error: swrError } = useSWR(
    draftTestId && !pollingTimedOut
      ? `/api/pipeline/youtube/ab-tests/${draftTestId}/variants`
      : null,
    variantsFetcher,
    { refreshInterval: 5_000, revalidateOnFocus: true, dedupingInterval: 4_900 },
  )

  const nonOriginalVariants = useMemo(() => {
    return (externalVariants ?? []).filter(
      (v: { is_original: boolean }) => !v.is_original,
    ) as Array<{
      label: string
      title_text: string | null
      description_text: string | null
      metadata: VariantMetadata
      is_original: boolean
    }>
  }, [externalVariants])

  const variantCount = nonOriginalVariants.length
  const allVariantsReceived = variantCount >= 3

  // Stop polling once all 3 variants arrive
  useEffect(() => {
    if (allVariantsReceived) setPollingTimedOut(true)
  }, [allVariantsReceived])
```

- [ ] **Step 3: Add polling timeout, escalation timer, stepState, and onVariantsReceived effect**

Add these after the SWR block, before the existing cleanup effect:

```typescript
  // 120s polling timeout
  useEffect(() => {
    if (!briefingCopied || pollingTimedOut) return
    const timeout = setTimeout(() => setPollingTimedOut(true), 120_000)
    return () => clearTimeout(timeout)
  }, [briefingCopied, pollingTimedOut])

  // 60s escalation message
  useEffect(() => {
    if (!briefingCopied || variantCount > 0) return
    const timer = setTimeout(() => setShowEscalation(true), 60_000)
    return () => clearTimeout(timer)
  }, [briefingCopied, variantCount])

  type StepState = 'pre-copy' | 'waiting' | 'partial' | 'complete'

  const stepState: StepState = useMemo(() => {
    if (allVariantsReceived) return 'complete'
    if (variantCount > 0) return 'partial'
    if (briefingCopied) return 'waiting'
    return 'pre-copy'
  }, [allVariantsReceived, variantCount, briefingCopied])

  // Notify parent when variants arrive (for Step 3 auto-populate)
  useEffect(() => {
    if (!nonOriginalVariants.length || !onVariantsReceived) return
    onVariantsReceived(nonOriginalVariants)
  }, [nonOriginalVariants, onVariantsReceived])
```

- [ ] **Step 4: Replace the ready-state JSX (icon+title through end of component)**

Replace everything from the opening `<div className="space-y-4">` return (line 199) through the closing of the component (line 474) with the v7 layout. The full replacement code:

```tsx
  return (
    <div className="flex flex-col gap-2">
      {/* Loading state */}
      {loading && (
        <div className="space-y-3" aria-busy="true">
          <div className="rounded-lg border border-[#2a2d3a] bg-[#1a1d27] p-3 animate-pulse">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-[#2a2d3a]" />
              <div className="space-y-1 flex-1">
                <div className="h-3 bg-[#2a2d3a] rounded w-32" />
                <div className="h-2 bg-[#2a2d3a] rounded w-48" />
              </div>
            </div>
            <div className="h-16 bg-[#2a2d3a] rounded" />
          </div>
          <div className="rounded-lg border border-[#2a2d3a] bg-[#1a1d27] p-3 animate-pulse space-y-2">
            <div className="h-4 bg-[#2a2d3a] rounded w-20" />
            <div className="h-20 bg-[#2a2d3a] rounded" />
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
          <p className="text-xs text-red-400">{error}</p>
          <button onClick={doFetch} className="text-xs text-red-300 underline mt-1">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Ready state — v7 layout */}
      {briefingData && !loading && (
        <>
          {/* Compact header */}
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${TYPE_GRADIENT[testType]} flex items-center justify-center shrink-0`}>
              <Lightbulb className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-[#e5e7eb]">Monte sua hipótese</h3>
              <p className="text-[9px] text-[#6b7280]">Descreva o que quer testar e receba variações do Cowork</p>
            </div>
          </div>

          {/* No-data warning */}
          {videoHasNoData && (
            <div role="status" className="rounded-lg bg-amber-500/5 border border-amber-500/15 px-2.5 py-1.5">
              <p className="text-[9px] text-amber-300">Sem dados de performance — prompt gerado com contexto do canal apenas.</p>
            </div>
          )}

          {/* Hypothesis section */}
          <div className="rounded-lg border border-indigo-500/20 p-2.5 bg-indigo-500/5">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[10px] font-semibold text-indigo-400">O que você quer testar?</span>
              <span className="text-[9px] text-indigo-400/50">(opcional)</span>
            </div>
            <textarea
              id="ab-focus"
              ref={textareaRef}
              value={focus}
              onChange={e => onFocusChange(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Ex: Qual estilo de thumb + título gera mais cliques..."
              className="w-full rounded-lg border border-[#2a2d3a] bg-[#0f1117] px-2.5 py-2 text-[11px] text-[#e5e7eb] placeholder:text-[#6b7280] placeholder:italic focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {EXAMPLE_CHIPS[testType]
                .filter(chip => !focus.includes(chip))
                .map(chip => (
                  <button
                    key={chip}
                    onClick={() => onFocusChange(focus ? `${focus}. ${chip}` : chip)}
                    className="text-[9px] rounded-lg border border-indigo-500/20 px-1.5 py-0.5 text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors"
                  >
                    {chip}
                  </button>
                ))}
            </div>
            {/* Collapsible per-variant directions */}
            <div className="mt-2 border-t border-indigo-500/10 pt-1.5">
              <button
                onClick={() => setDirectionsExpanded(!directionsExpanded)}
                className="flex items-center gap-1 py-1 text-[9px] text-indigo-400/80 hover:text-indigo-400 transition-colors"
              >
                <span>{directionsExpanded ? '▾' : '▸'}</span>
                <span>Guiar cada variação (opcional)</span>
              </button>
              {directionsExpanded && (
                <div className="space-y-1.5 mt-1">
                  {SLOT_LABELS.map((label, i) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className={`w-[18px] h-[18px] rounded flex items-center justify-center text-[9px] font-bold text-white bg-gradient-to-br ${TYPE_GRADIENT[testType]} shrink-0`}>
                        {label}
                      </span>
                      <input
                        type="text"
                        value={slotNotes[i]}
                        onChange={e => onSlotNoteChange(i, e.target.value)}
                        placeholder={`Direção para variação ${label}...`}
                        className="flex-1 rounded border border-[#2a2d3a] bg-[#0f1117] px-2 py-1 text-[10px] text-[#e5e7eb] placeholder:text-[#6b7280] focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Prompt card — dual state */}
          <div className="rounded-lg border border-[#2a2d3a] p-2 bg-[#1a1d27]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] font-bold tracking-wide bg-gradient-to-r ${TYPE_GRADIENT[testType]} text-white px-1.5 py-0.5 rounded uppercase`}>
                  Prompt
                </span>
                {stepState === 'pre-copy' ? (
                  <span className="text-[9px] text-[#6b7280]">{charCount.toLocaleString('pt-BR')} caracteres</span>
                ) : (
                  <span className="text-[9px] text-green-500">✓ Copiado</span>
                )}
              </div>
              {stepState === 'pre-copy' ? (
                <button
                  onClick={() => setPromptExpanded(!promptExpanded)}
                  className="text-[9px] text-[#4b5563] hover:text-[#6b7280] transition-colors"
                >
                  {promptExpanded ? '▲ Ocultar' : '▼ Ver prompt'}
                </button>
              ) : (
                <button
                  onClick={handleCopy}
                  className="text-[9px] text-[#4b5563] hover:text-[#6b7280] transition-colors"
                >
                  Copiar novamente
                </button>
              )}
            </div>
            {promptExpanded && stepState === 'pre-copy' && (
              <div className="mt-2">
                <PromptPreview maxHeight="12rem">{prompt}</PromptPreview>
              </div>
            )}
            {stepState === 'pre-copy' && (
              <div className="flex justify-end mt-1.5">
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[11px] font-semibold text-white transition-all ${
                    copied
                      ? 'bg-green-600'
                      : `bg-gradient-to-r ${TYPE_GRADIENT[testType]} hover:opacity-90 shadow-[0_0_12px_rgba(236,72,153,0.15)]`
                  }`}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copiado!' : 'Copiar prompt'}
                </button>
              </div>
            )}
          </div>

          {/* Combo warning */}
          {testType === 'combo' && (
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 px-2.5 py-1.5 flex gap-1.5 items-start">
              <span className="text-[11px] mt-px">⚠️</span>
              <span className="text-[9px] text-amber-400 leading-relaxed">
                Você vai testar thumb + título juntos. Se o CTR subir, ótimo! Para saber qual mudança pesou mais, rode um teste separado depois.
              </span>
            </div>
          )}

          {/* Variant grid — PRE-COPY state */}
          {stepState === 'pre-copy' && (
            <div className="rounded-lg border border-indigo-500/10 p-4 bg-indigo-500/5 text-center">
              <p className="text-[10px] text-[#6b7280] mb-1">Copie o prompt e cole no Cowork</p>
              <p className="text-[9px] text-[#4b5563]">As variações aparecem aqui automaticamente</p>
            </div>
          )}

          {/* Variant grid — WAITING state (skeleton cards) */}
          {stepState === 'waiting' && (
            <div className="rounded-lg border border-indigo-500/10 overflow-hidden bg-indigo-500/5">
              <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-indigo-500/5">
                <span className="text-[10px] text-[#6b7280]">Aguardando variações do Cowork...</span>
                <span className="text-[9px] text-[#4b5563]">0 de 3</span>
              </div>
              {[0, 1, 2].map(i => (
                <div key={i} className={`px-2.5 py-2 ${i < 2 ? 'border-b border-indigo-500/5' : ''}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-[18px] h-[18px] rounded bg-[#2a2d3a] animate-pulse" />
                    <div className="w-[60px] h-[10px] rounded bg-[#2a2d3a] animate-pulse" />
                  </div>
                  <div className="flex gap-1.5">
                    <div className="flex-1 h-7 rounded bg-[#2a2d3a]/50 animate-pulse" />
                    <div className="flex-1 h-7 rounded bg-[#2a2d3a]/50 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Variant grid — PARTIAL or COMPLETE state */}
          {(stepState === 'partial' || stepState === 'complete') && (
            <div className="rounded-lg border border-green-500/10 overflow-hidden bg-green-500/5">
              <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-green-500/10">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-[#e5e7eb]">Variações</span>
                  <span className="text-[9px] text-green-500">
                    {stepState === 'complete' ? `${variantCount + 1} no teste` : `${variantCount} de 3`}
                  </span>
                </div>
                {stepState === 'complete' && (
                  <span className="text-[9px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">
                    Passo 3 pré-preenchido
                  </span>
                )}
              </div>

              {/* Option A — Original (complete state only) */}
              {stepState === 'complete' && (
                <div className="px-2.5 py-2 border-b border-green-500/5 bg-[#6b7280]/5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-[18px] h-[18px] rounded flex items-center justify-center text-[9px] font-bold text-white bg-[#6b7280]">A</span>
                    <span className="text-[10px] font-medium text-[#6b7280]">Original (atual)</span>
                  </div>
                  {testType === 'combo' ? (
                    <div className="flex gap-1.5">
                      <div className="flex-1 rounded border border-[#6b7280]/10 bg-[#6b7280]/5 px-1.5 py-1">
                        <div className="text-[9px] text-[#6b7280] uppercase tracking-wider font-semibold">Thumb</div>
                        <div className="text-[10px] text-[#6b7280] leading-snug">Thumb atual do vídeo</div>
                      </div>
                      <div className="flex-1 rounded border border-[#6b7280]/10 bg-[#6b7280]/5 px-1.5 py-1">
                        <div className="text-[9px] text-[#6b7280] uppercase tracking-wider font-semibold">Título</div>
                        <div className="text-[10px] text-[#6b7280] leading-snug truncate">{video.title}</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-[#6b7280] leading-snug truncate">{video.title}</p>
                  )}
                </div>
              )}

              {/* Variant cards B/C/D */}
              {SLOT_LABELS.map((label, i) => {
                const variant = nonOriginalVariants.find(v => v.label === label)
                if (!variant) {
                  if (stepState === 'complete') return null
                  return (
                    <div key={label} className={`px-2.5 py-2 ${i < 2 ? 'border-b border-green-500/5' : ''}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-[18px] h-[18px] rounded bg-[#2a2d3a] animate-pulse" />
                        <div className="w-[60px] h-[10px] rounded bg-[#2a2d3a] animate-pulse" />
                      </div>
                      <div className="flex gap-1.5">
                        <div className="flex-1 h-7 rounded bg-[#2a2d3a]/50 animate-pulse" />
                        <div className="flex-1 h-7 rounded bg-[#2a2d3a]/50 animate-pulse" />
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={label}
                    className={`px-2.5 py-2 ${i < SLOT_LABELS.length - 1 ? 'border-b border-green-500/5' : ''}`}
                    style={{ animation: 'fadeIn 300ms ease-out' }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-[18px] h-[18px] rounded flex items-center justify-center text-[9px] font-bold text-white bg-gradient-to-br ${TYPE_GRADIENT[testType]}`}>
                        {label}
                      </span>
                      <span className="text-[10px] font-medium text-[#e5e7eb]">Variação {label}</span>
                      {stepState === 'partial' && <span className="text-[9px] text-green-500">✓</span>}
                    </div>
                    {testType === 'combo' ? (
                      <>
                        <div className="flex gap-1.5">
                          <div className="flex-1 rounded border border-indigo-500/10 bg-indigo-500/5 px-1.5 py-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-indigo-400 uppercase tracking-wider font-semibold">Thumb</span>
                              <span className="text-[9px] text-[#4b5563]">direção</span>
                            </div>
                            <div className="text-[10px] text-[#d1d5db] leading-snug">
                              {variant.metadata?.creative_direction ?? variant.metadata?.visual_description ?? '—'}
                            </div>
                          </div>
                          <div className="flex-1 rounded border border-amber-500/10 bg-amber-500/5 px-1.5 py-1">
                            <div className="flex justify-between">
                              <span className="text-[9px] text-amber-400 uppercase tracking-wider font-semibold">Título</span>
                              {variant.title_text && (
                                <span className="text-[9px] text-[#6b7280]">{variant.title_text.length} car.</span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#d1d5db] leading-snug">
                              {variant.title_text ? `"${variant.title_text}"` : '—'}
                            </div>
                          </div>
                        </div>
                        {variant.metadata?.rationale && (
                          <div className="mt-1 text-[9px] text-[#6b7280] italic pl-6">
                            <span className="text-purple-400">↔</span> {variant.metadata.rationale}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-0.5">
                        {variant.title_text && <p className="text-[10px] text-[#d1d5db]">{variant.title_text}</p>}
                        {variant.description_text && <p className="text-[9px] text-[#6b7280] line-clamp-2">{variant.description_text}</p>}
                        {variant.metadata?.rationale && <p className="text-[9px] text-[#6b7280] italic">{variant.metadata.rationale}</p>}
                        {variant.metadata?.creative_direction && <p className="text-[9px] text-indigo-300">{variant.metadata.creative_direction}</p>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Escalation message (after 60s with 0 variants) */}
          {showEscalation && variantCount === 0 && (
            <p className="text-center text-[9px] text-[#4b5563] italic">
              Está demorando? Verifique se o Cowork recebeu o prompt.
            </p>
          )}

          {/* Handoff microcopy (complete + combo only) */}
          {stepState === 'complete' && testType === 'combo' && (
            <p className="text-[9px] text-[#4b5563] text-center py-0.5">
              No próximo passo, você edita os títulos e faz upload de thumbnails seguindo as direções acima.
            </p>
          )}
        </>
      )}
    </div>
  )
```

- [ ] **Step 5: Update tests for the new UI structure**

In `apps/web/test/youtube/step-ideias.test.tsx`:

1. Update the `'Renders asset preview, prompt card, and slot notes when briefingData provided'` test — assert on new elements:
   - `screen.getByText('Monte sua hipótese')` instead of `'Brainstorm com IA'`
   - `screen.getByText('Copiar prompt')` instead of `'Copiar Prompt'`
   - `screen.getByText(/Guiar cada variação/)` for collapsed directions

2. Update the `'Shows variant cards when SWR returns external variants'` test — assert `Variação B` instead of `Variante B`.

3. Update the `'Slot note input calls onSlotNoteChange'` test — need to expand directions first:
   ```typescript
   const toggle = screen.getByText(/Guiar cada variação/)
   fireEvent.click(toggle)
   // Then find the input
   ```

4. Add new tests:
   ```typescript
   it('shows pre-copy empty placeholder when briefingCopied is false', () => {
     renderStep({ briefingCopied: false, briefingData: makeAbBriefingData() })
     expect(screen.getByText('Copie o prompt e cole no Cowork')).toBeTruthy()
   })

   it('shows waiting skeleton cards after prompt is copied', () => {
     renderStep({ briefingCopied: true, briefingData: makeAbBriefingData(), draftTestId: 'draft-1' })
     expect(screen.getByText(/Aguardando variações/)).toBeTruthy()
     expect(screen.getByText('0 de 3')).toBeTruthy()
   })

   it('shows combo warning only for combo test type', () => {
     renderStep({ testType: 'combo', briefingData: makeAbBriefingData() })
     expect(screen.getByText(/thumb \+ título juntos/)).toBeTruthy()
   })

   it('does not show combo warning for title test type', () => {
     renderStep({ testType: 'title', briefingData: makeAbBriefingData() })
     expect(screen.queryByText(/thumb \+ título juntos/)).toBeNull()
   })
   ```

- [ ] **Step 6: Run all tests**

Run: `npm run test:web -- --run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/step-ideias.tsx apps/web/test/youtube/step-ideias.test.tsx
git commit -m "feat(ab-lab): Step 2 progressive states UI with v7 design"
```

---

### Task 4: Auto-populate bridge + submit flow guard

**Depends on:** Task 3 (uses `onVariantsReceived` prop added in Task 3 Step 1)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx:79-83,226-291,415-429`

**Context:** `textVariants` in the wizard is initialized as `[{title:'', description:''}, ...]` (line 79-83) and never populated from Cowork data. When the user advances to Step 3, they see empty fields despite Cowork having sent variants. The fix adds a `handleVariantsReceived` callback that populates `textVariants`, and a guard in `handleSubmit` to skip creating variants that Cowork already created (avoiding UNIQUE constraint violations).

- [ ] **Step 1: Add coworkVariantLabels state**

In `ab-create-wizard.tsx`, add after the `draftLoading` state (line 99):

```typescript
  const [coworkVariantLabels, setCoworkVariantLabels] = useState<Set<string>>(new Set())
```

Add `Set` to the imports if not already imported — it's a built-in, no import needed.

- [ ] **Step 2: Add handleVariantsReceived callback**

After the `handleBriefingDataChange` callback (around line 104):

```typescript
  const handleVariantsReceived = useCallback((variants: Array<{
    label: string
    title_text: string | null
    description_text: string | null
    metadata: Record<string, unknown> | null
  }>) => {
    const labelToIndex: Record<string, number> = { B: 0, C: 1, D: 2 }
    const labels = new Set<string>()
    setTextVariants(prev => {
      const next = [...prev]
      for (const v of variants) {
        const idx = labelToIndex[v.label]
        if (idx !== undefined) {
          next[idx] = {
            title: v.title_text ?? '',
            description: v.description_text ?? '',
          }
          labels.add(v.label)
        }
      }
      return next
    })
    setCoworkVariantLabels(labels)
  }, [])
```

- [ ] **Step 3: Pass onVariantsReceived to StepIdeias**

In the JSX where `<StepIdeias>` is rendered (lines 415-429), add the prop:

```tsx
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
      onVariantsReceived={handleVariantsReceived}
    />
  )}
```

- [ ] **Step 4: Guard handleSubmit against Cowork-created variants**

In `handleSubmit` (line 226), replace the text variant creation block (lines 259-279):

```typescript
      // Create text variants (for title, description, and combo types)
      // Skip variants already created by Cowork via API
      if (testType === 'title' || testType === 'description' || testType === 'combo') {
        const variantLabels = ['B', 'C', 'D'] as const
        const textSlotsToSave = textVariants
          .map((tv, i) => ({ ...tv, label: variantLabels[i] }))
          .filter(tv => {
            if (coworkVariantLabels.has(tv.label)) return false
            if (testType === 'title') return tv.title.trim().length > 0
            if (testType === 'description') return tv.description.trim().length > 0
            return tv.title.trim().length > 0 || tv.description.trim().length > 0
          })

        for (const tv of textSlotsToSave) {
          const textResult = await createTextVariant({
            test_id: testId,
            title_text: tv.title.trim() || undefined,
            description_text: tv.description.trim() || undefined,
          })
          if (!textResult.ok) {
            setSubmitError(textResult.error ?? 'Falha ao criar variante de texto')
            return
          }
        }
      }
```

And update the image upload block (lines 247-257) with a guard:

```typescript
      // Upload image variants (for thumbnail and combo types)
      // Skip if Cowork already populated all variant slots
      if ((testType === 'thumbnail' || testType === 'combo') && coworkVariantLabels.size === 0) {
        for (const slot of variants) {
          const fd = new FormData()
          fd.append('file', slot.file)
          const uploadResult = await uploadVariant(testId, fd)
          if (!uploadResult.ok) {
            setSubmitError(uploadResult.error ?? 'Falha ao enviar variante')
            return
          }
        }
      }
```

- [ ] **Step 5: Run tests**

Run: `npm run test:web -- --run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard.tsx
git commit -m "feat(ab-lab): auto-populate Step 3 from Cowork variants + submit guard"
```

---

### Task 5: Build verification

**Depends on:** Tasks 1-4

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm run test:web -- --run`
Expected: All tests PASS

- [ ] **Step 2: Build packages**

Run: `npm run build:packages`
Expected: Build succeeds

- [ ] **Step 3: Run Next.js typecheck and build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds with no type errors

- [ ] **Step 4: Fix and commit any issues**

If typecheck or build reveals issues, fix them and commit:

```bash
git commit -m "fix(ab-lab): resolve build issues from Cowork integration"
```

---

## Parallelism Guide

```
Time →
─────────────────────────────────────────────────
Task 1 (labels)     ████░░░░░░░░░░░░░░░░░░░░░░
Task 2 (slotNotes)  ████████░░░░░░░░░░░░░░░░░░
Task 3 (Step 2 UI)  ██████████████████░░░░░░░░
                                       ↓ depends
Task 4 (bridge)     ░░░░░░░░░░░░░░░░░░████████
Task 5 (build)      ░░░░░░░░░░░░░░░░░░░░░░░░██
```

- **Tasks 1, 2, 3** → run all 3 simultaneously (no file conflicts, no dependencies)
- **Task 4** → after Task 3 completes (uses `onVariantsReceived` prop from Task 3)
- **Task 5** → after all tasks (full build verification)
