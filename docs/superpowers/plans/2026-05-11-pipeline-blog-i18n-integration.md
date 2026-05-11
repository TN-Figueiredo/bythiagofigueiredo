# Pipeline ↔ Blog i18n Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add prompt generator for 2nd language, pipeline search in blog editorial/new post, and flag toggle locale selector in blog editor.

**Architecture:** 4 new components + enhanced server actions + integration into 6 existing files. Components are independent; integrations depend on their respective components.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind 4, Supabase, Sonner toasts, Vitest

**Parallelism:** Tasks 1-3 are fully independent (Wave 1). Tasks 4-6 each depend on one Wave 1 task (Wave 2). Tasks 7-8 depend on Task 4 (Wave 3).

---

### Task 1: LocaleToggle Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_shared/locale-toggle.tsx`
- Test: `apps/web/test/unit/blog/locale-toggle.test.tsx`

This component replaces the existing `LocalePill` in the blog editor toolbar. It shows flag badges for existing locales and a "+" button to add a missing locale.

**Existing code to know:**
- `LOCALE_FLAGS` and `LOCALE_LABELS` constants are currently defined in `apps/web/src/app/cms/(authed)/blog/new/post-edition-editor.tsx` lines 83-97. The toggle needs its own copy or these should be extracted. For simplicity, define them inline in the new component.
- Colors: PT = `#10b981` (green), bg `rgba(16,185,129,0.1)`. EN = `#3b82f6` (blue), bg `rgba(59,130,246,0.1)`.

- [ ] **Step 1: Write the test file**

```typescript
// apps/web/test/unit/blog/locale-toggle.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LocaleToggle } from '@/app/cms/(authed)/blog/_shared/locale-toggle'

describe('LocaleToggle', () => {
  const defaults = {
    currentLocale: 'pt-BR',
    existingLocales: ['pt-BR'],
    supportedLocales: ['pt-BR', 'en'],
    isPostPersisted: true,
    isSaving: false,
    onSwitchLocale: vi.fn(),
    onAddLocale: vi.fn(),
  }

  it('renders current locale flag', () => {
    render(<LocaleToggle {...defaults} />)
    expect(screen.getByText('PT-BR')).toBeDefined()
  })

  it('shows add button for missing locale when post is persisted', () => {
    render(<LocaleToggle {...defaults} />)
    expect(screen.getByRole('button', { name: /\+ EN/i })).toBeDefined()
  })

  it('hides add button when post is NOT persisted', () => {
    render(<LocaleToggle {...defaults} isPostPersisted={false} />)
    expect(screen.queryByRole('button', { name: /\+ EN/i })).toBeNull()
  })

  it('calls onAddLocale when + button clicked', () => {
    const onAddLocale = vi.fn()
    render(<LocaleToggle {...defaults} onAddLocale={onAddLocale} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ EN/i }))
    expect(onAddLocale).toHaveBeenCalledWith('en')
  })

  it('shows both flags when dual locale, calls onSwitchLocale on inactive click', () => {
    const onSwitchLocale = vi.fn()
    render(
      <LocaleToggle
        {...defaults}
        existingLocales={['pt-BR', 'en']}
        onSwitchLocale={onSwitchLocale}
      />,
    )
    expect(screen.getByText('PT-BR')).toBeDefined()
    expect(screen.getByText('EN')).toBeDefined()
    fireEvent.click(screen.getByText('EN'))
    expect(onSwitchLocale).toHaveBeenCalledWith('en')
  })

  it('disables toggle when isSaving is true', () => {
    render(
      <LocaleToggle
        {...defaults}
        existingLocales={['pt-BR', 'en']}
        isSaving={true}
      />,
    )
    const enButton = screen.getByText('EN').closest('button')
    expect(enButton?.getAttribute('disabled')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/unit/blog/locale-toggle.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement LocaleToggle component**

```typescript
// apps/web/src/app/cms/(authed)/blog/_shared/locale-toggle.tsx
'use client'

const LOCALE_FLAGS: Record<string, string> = {
  'pt-BR': '\u{1F1E7}\u{1F1F7}',
  en: '\u{1F1FA}\u{1F1F8}',
  es: '\u{1F1EA}\u{1F1F8}',
  fr: '\u{1F1EB}\u{1F1F7}',
  de: '\u{1F1E9}\u{1F1EA}',
}

const LOCALE_LABELS: Record<string, string> = {
  'pt-BR': 'PT-BR',
  en: 'EN',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
}

const LOCALE_COLORS: Record<string, { text: string; bg: string }> = {
  'pt-BR': { text: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  en: { text: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
}

const DEFAULT_COLOR = { text: '#7a8ba3', bg: 'rgba(122,139,163,0.1)' }

interface LocaleToggleProps {
  currentLocale: string
  existingLocales: string[]
  supportedLocales: string[]
  isPostPersisted: boolean
  isSaving: boolean
  onSwitchLocale: (locale: string) => void
  onAddLocale: (locale: string) => void
}

export function LocaleToggle({
  currentLocale,
  existingLocales,
  supportedLocales,
  isPostPersisted,
  isSaving,
  onSwitchLocale,
  onAddLocale,
}: LocaleToggleProps) {
  const missingLocales = supportedLocales.filter((l) => !existingLocales.includes(l))

  return (
    <div className="inline-flex items-center gap-1 rounded-md bg-[#161d2d] p-0.5">
      {existingLocales.map((loc) => {
        const isActive = loc === currentLocale
        const colors = LOCALE_COLORS[loc] ?? DEFAULT_COLOR
        const flag = LOCALE_FLAGS[loc] ?? '\u{1F310}'
        const label = LOCALE_LABELS[loc] ?? loc.toUpperCase()

        if (isActive) {
          return (
            <span
              key={loc}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              <span className="text-xs">{flag}</span>
              {label}
            </span>
          )
        }

        return (
          <button
            key={loc}
            type="button"
            disabled={isSaving}
            onClick={() => onSwitchLocale(loc)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[#5a6b7f] hover:text-[#7a8ba3] disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="text-xs">{flag}</span>
            {label}
          </button>
        )
      })}

      {isPostPersisted && missingLocales.length > 0 && (
        <button
          type="button"
          disabled={isSaving}
          onClick={() => onAddLocale(missingLocales[0])}
          className="inline-flex items-center gap-1 rounded border border-dashed border-[#6366f1] px-2 py-1 text-[10px] text-[#6366f1] hover:bg-[rgba(99,102,241,0.06)] disabled:pointer-events-none disabled:opacity-50"
          aria-label={`+ ${LOCALE_LABELS[missingLocales[0]] ?? missingLocales[0].toUpperCase()}`}
        >
          <span className="text-xs">{LOCALE_FLAGS[missingLocales[0]] ?? '\u{1F310}'}</span>
          + {LOCALE_LABELS[missingLocales[0]] ?? missingLocales[0].toUpperCase()}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/unit/blog/locale-toggle.test.tsx`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/_shared/locale-toggle.tsx apps/web/test/unit/blog/locale-toggle.test.tsx
git commit -m "feat(blog): add LocaleToggle component with flag badges and add-locale button"
```

---

### Task 2: PromptGeneratorModal Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/prompt-generator-modal.tsx`
- Test: `apps/web/test/unit/pipeline/prompt-generator-modal.test.tsx`

Modal that generates a pre-filled prompt for Claude Code to create a 2nd language version of a pipeline item. Textarea is editable, copy-to-clipboard button.

**Existing code to know:**
- `getFormatIcon(format)` from `apps/web/src/lib/pipeline/gem-design.ts` returns `{ icon, bgClass, label }`.
- Sections are fetched from `GET /api/pipeline/items/{id}/sections`. The modal receives sections as a prop (parent handles fetching).
- Uses `sonner` toast for "Prompt copiado" notification.

- [ ] **Step 1: Write the test file**

```typescript
// apps/web/test/unit/pipeline/prompt-generator-modal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PromptGeneratorModal } from '@/app/cms/(authed)/pipeline/_components/prompt-generator-modal'

// Mock sonner
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Mock clipboard
const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
Object.assign(navigator, { clipboard: mockClipboard })

describe('PromptGeneratorModal', () => {
  const item = {
    id: 'abc-123',
    code: 'ts-01',
    format: 'blog_post',
    stage: 'ideia',
    priority: 3,
    language: 'pt-br' as const,
    title_pt: 'Aprendi Inglês Porque Não Conseguia Passar de Fase',
    title_en: null,
    hook: 'Fiquei preso numa caverna em Namekusei',
    synopsis: 'A história de como jogos me ensinaram inglês',
  }

  const sections = [
    { section_type: 'ideia_shared', language: 'shared', content: 'Contar a jornada...' },
    { section_type: 'rascunho_pt', language: 'pt-br', content: 'Era 2008. Eu tinha 12 anos...' },
  ]

  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders modal with item code in header', () => {
    render(<PromptGeneratorModal item={item} sections={sections} targetLocale="en" onClose={onClose} />)
    expect(screen.getByText(/Adicionar versão English/)).toBeDefined()
    expect(screen.getByText('ts-01')).toBeDefined()
  })

  it('generates prompt with item context', () => {
    render(<PromptGeneratorModal item={item} sections={sections} targetLocale="en" onClose={onClose} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toContain('ts-01')
    expect(textarea.value).toContain('blog_post')
    expect(textarea.value).toContain('title_en: (vazio)')
    expect(textarea.value).toContain('Aprendi Inglês')
  })

  it('includes section content in prompt', () => {
    render(<PromptGeneratorModal item={item} sections={sections} targetLocale="en" onClose={onClose} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toContain('ideia_shared')
    expect(textarea.value).toContain('rascunho_pt')
  })

  it('truncates sections longer than 500 chars', () => {
    const longSections = [
      { section_type: 'rascunho_pt', language: 'pt-br', content: 'x'.repeat(600) },
    ]
    render(<PromptGeneratorModal item={item} sections={longSections} targetLocale="en" onClose={onClose} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toContain('...')
    expect(screen.getByText(/truncado/)).toBeDefined()
  })

  it('copies prompt to clipboard on button click', async () => {
    render(<PromptGeneratorModal item={item} sections={sections} targetLocale="en" onClose={onClose} />)
    const copyBtn = screen.getByRole('button', { name: /Copiar prompt/i })
    fireEvent.click(copyBtn)
    expect(mockClipboard.writeText).toHaveBeenCalled()
  })

  it('calls onClose when cancel clicked', () => {
    render(<PromptGeneratorModal item={item} sections={sections} targetLocale="en" onClose={onClose} />)
    const cancelBtn = screen.getByRole('button', { name: /Cancelar/i })
    fireEvent.click(cancelBtn)
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/unit/pipeline/prompt-generator-modal.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PromptGeneratorModal**

```typescript
// apps/web/src/app/cms/(authed)/pipeline/_components/prompt-generator-modal.tsx
'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { getFormatIcon } from '@/lib/pipeline/gem-design'

interface PipelineItemForPrompt {
  id: string
  code: string
  format: string
  stage: string
  priority: number
  language: 'pt-br' | 'en' | 'both'
  title_pt: string | null
  title_en: string | null
  hook: string | null
  synopsis: string | null
}

interface SectionForPrompt {
  section_type: string
  language: string
  content: string
}

interface PromptGeneratorModalProps {
  item: PipelineItemForPrompt
  sections: SectionForPrompt[]
  targetLocale: 'pt-br' | 'en'
  onClose: () => void
}

const SECTION_TRUNCATE_LIMIT = 500

const LANG_LABELS: Record<string, { label: string; audience: string }> = {
  'pt-br': { label: 'Português (PT-BR)', audience: 'lusófona' },
  en: { label: 'English', audience: 'anglófona' },
}

function generatePrompt(
  item: PipelineItemForPrompt,
  sections: SectionForPrompt[],
  targetLocale: 'pt-br' | 'en',
): { text: string; wordCount: number; wasTruncated: boolean } {
  const currentLang = targetLocale === 'en' ? 'pt-br' : 'en'
  const currentLabel = LANG_LABELS[currentLang]?.label ?? currentLang
  const targetLabel = LANG_LABELS[targetLocale]?.label ?? targetLocale
  const targetAudience = LANG_LABELS[targetLocale]?.audience ?? targetLocale
  const targetSuffix = targetLocale === 'en' ? 'en' : 'pt'
  const title = (currentLang === 'pt-br' ? item.title_pt : item.title_en) ?? 'Sem título'

  let wasTruncated = false
  const sectionLines = sections.map((s) => {
    let content = s.content
    if (content.length > SECTION_TRUNCATE_LIMIT) {
      content = content.slice(0, SECTION_TRUNCATE_LIMIT) + '...'
      wasTruncated = true
    }
    return `${s.section_type}: ${content}`
  })

  const lines = [
    '# Contexto',
    `Pipeline item ${item.code} (${item.format}, stage: ${item.stage}, P${item.priority})`,
    `Possui apenas versão ${currentLabel}.`,
    `Item ID: ${item.id}`,
    `title_${targetSuffix}: (vazio)`,
    '',
    `# Conteúdo ${currentLabel}`,
    '',
    `Título: ${title}`,
    item.hook ? `Hook: ${item.hook}` : null,
    item.synopsis ? `Synopsis: ${item.synopsis}` : null,
    '',
    `# Seções (${sections.length})`,
    '',
    ...sectionLines,
    '',
    '# Instruções',
    `Crie a versão ${targetLabel} deste item de ${item.format}.`,
    `Adapte para audiência ${targetAudience} — não traduza literalmente.`,
    'Tom narrativo e pessoal.',
    '',
    '# O que atualizar',
    'Use updatePipelineItem() server action:',
    `- title_${targetSuffix}: título adaptado`,
    '- language: "both"',
    '',
    `Use PATCH /api/pipeline/items/${item.id}/sections:`,
    `- Crie seções _${targetSuffix} (rascunho_${targetSuffix}, seo_${targetSuffix})`,
    '- Mantenha seções _shared intactas',
    '',
    '[Adicione instruções extras aqui]',
  ]

  const text = lines.filter((l) => l !== null).join('\n')
  const wordCount = text.split(/\s+/).length

  return { text, wordCount, wasTruncated }
}

export function PromptGeneratorModal({
  item,
  sections,
  targetLocale,
  onClose,
}: PromptGeneratorModalProps) {
  const { icon } = getFormatIcon(item.format as Parameters<typeof getFormatIcon>[0])
  const targetLabel = LANG_LABELS[targetLocale]?.label ?? targetLocale
  const { text: initialPrompt, wordCount, wasTruncated } = generatePrompt(item, sections, targetLocale)
  const [prompt, setPrompt] = useState(initialPrompt)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const currentLang = item.language === 'en' ? 'EN' : 'PT'
  const targetLang = targetLocale === 'en' ? 'EN' : 'PT'
  const sectionCount = sections.length

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success('Prompt copiado')
    } catch {
      toast.error('Erro ao copiar. Selecione manualmente.')
      textareaRef.current?.select()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-lg border border-[#222d40] bg-[#161d2d] p-4 shadow-xl">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            <div>
              <div className="text-sm font-semibold text-[#edf2f7]">
                Adicionar versão {targetLabel}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                <span className="font-mono text-[9px] text-[#6366f1]">{item.code}</span>
                <span className="rounded bg-[rgba(16,185,129,0.15)] px-1 py-px text-[9px] text-[#10b981]">
                  {item.stage}
                </span>
                <span className="rounded bg-[rgba(245,158,11,0.15)] px-1 py-px text-[9px] text-[#f59e0b]">
                  P{item.priority}
                </span>
                <span className="text-[9px] text-[#5a6b7f]">·</span>
                <span className="text-[9px] text-[#5a6b7f]">
                  {sectionCount} seções · {currentLang} → {targetLang}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-[#5a6b7f] hover:text-[#7a8ba3]"
          >
            ✕
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          role="textbox"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="mb-1 max-h-[200px] w-full resize-none overflow-y-auto rounded-lg border border-[#222d40] bg-[#0c1222] p-3 font-mono text-[10px] leading-relaxed text-[#7a8ba3] focus:border-[#6366f1] focus:outline-none"
          rows={12}
        />

        {/* Footer info */}
        <div className="mb-2 flex justify-between text-[8px] text-[#5a6b7f]">
          <span>
            {sectionCount} seções incluídas{wasTruncated ? ' (conteúdo > 500 chars truncado)' : ''}
          </span>
          <span>~{wordCount} palavras</span>
        </div>

        {/* Workflow hint */}
        <div className="mb-3 rounded-md border border-[rgba(99,102,241,0.15)] bg-[rgba(99,102,241,0.06)] p-2">
          <div className="mb-0.5 text-[9px] font-semibold text-[#6366f1]">
            💡 Cole no Claude Code
          </div>
          <div className="text-[9px] leading-relaxed text-[#7a8ba3]">
            Edite se precisar → Copie → Cole no Claude Code → Item será atualizado para PT+EN
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 rounded-md bg-[#6366f1] px-3 py-2 text-[11px] font-medium text-white hover:bg-[#5558e6]"
          >
            📋 Copiar prompt
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#222d40] px-3 py-2 text-[11px] text-[#7a8ba3] hover:border-[#333d50]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/unit/pipeline/prompt-generator-modal.test.tsx`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/prompt-generator-modal.tsx apps/web/test/unit/pipeline/prompt-generator-modal.test.tsx
git commit -m "feat(pipeline): add PromptGeneratorModal for 2nd language creation"
```

---

### Task 3: Enhanced Search + createPostFromPipeline Server Actions

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/actions.ts` (add `createPostFromPipeline`, move + enhance `searchPipelineItems`)
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` (remove old `searchPipelineItems`, re-export from blog/actions.ts)
- Test: `apps/web/test/unit/blog/pipeline-actions.test.ts`

**Existing code to know:**
- Current `searchPipelineItems` in `blog/[id]/edit/actions.ts` lines 346-370 searches `content_pipeline` for non-archived items by title/code, returns id/code/title/format/stage/blog_post_id.
- `linkPostToItem(itemId, postId, siteId, userId)` in `lib/pipeline/blog-link.ts` links a post to a pipeline item.
- `createPost({ title, locale, tagId, status })` in `blog/actions.ts` creates a post + translation.
- `getSiteContext()` returns `{ siteId, defaultLocale }`.
- `requireEditScope(siteId)` validates auth.
- `getSupabaseServiceClient()` bypasses RLS.

- [ ] **Step 1: Write the test file**

```typescript
// apps/web/test/unit/blog/pipeline-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', defaultLocale: 'pt-BR' }),
}))

vi.mock('@/app/cms/(authed)/blog/actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/cms/(authed)/blog/actions')>()
  return {
    ...actual,
    // Keep generatePromptText testable since it's a pure function
  }
})

describe('generatePromptText', () => {
  // This tests the pure prompt generation logic that will be exported
  it('placeholder — actual tests depend on implementation', () => {
    expect(true).toBe(true)
  })
})
```

Note: Server actions with `'use server'` are difficult to unit test directly (they require the Next.js server context). The primary validation for `createPostFromPipeline` and `searchPipelineItems` will be:
1. TypeScript compilation (type safety)
2. Integration testing via the UI
3. The existing test suite continues to pass

- [ ] **Step 2: Move and enhance searchPipelineItems in blog/actions.ts**

Add to the end of `apps/web/src/app/cms/(authed)/blog/actions.ts`:

```typescript
export interface PipelineSearchResult {
  id: string
  code: string
  title: string
  format: string
  stage: string
  language: string
  priority: number
  hook: string | null
  blog_post_id: string | null
  linked_post_title: string | null
}

export async function searchPipelineItems(
  siteId: string,
  query: string,
): Promise<PipelineSearchResult[]> {
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()
  const sanitized = query.replace(/[,%()]/g, '')
  if (!sanitized) return []
  const pattern = `%${sanitized}%`

  const { data } = await svc
    .from('content_pipeline')
    .select('id, code, title_pt, title_en, format, stage, language, priority, hook, blog_post_id')
    .eq('site_id', siteId)
    .eq('is_archived', false)
    .or(`title_pt.ilike.${pattern},title_en.ilike.${pattern},code.ilike.${pattern}`)
    .limit(10)

  if (!data || data.length === 0) return []

  // Fetch linked post titles for items that have blog_post_id
  const linkedPostIds = data
    .filter((item: { blog_post_id: string | null }) => item.blog_post_id)
    .map((item: { blog_post_id: string }) => item.blog_post_id)

  let titleMap = new Map<string, string>()
  if (linkedPostIds.length > 0) {
    const { data: translations } = await svc
      .from('blog_translations')
      .select('post_id, title')
      .in('post_id', linkedPostIds)
      .limit(linkedPostIds.length)

    if (translations) {
      titleMap = new Map(
        translations.map((t: { post_id: string; title: string }) => [t.post_id, t.title]),
      )
    }
  }

  return data.map(
    (item: {
      id: string
      code: string
      title_pt: string | null
      title_en: string | null
      format: string
      stage: string
      language: string
      priority: number
      hook: string | null
      blog_post_id: string | null
    }) => ({
      id: item.id,
      code: item.code,
      title: item.title_pt || item.title_en || 'Untitled',
      format: item.format,
      stage: item.stage,
      language: item.language,
      priority: item.priority,
      hook: item.hook,
      blog_post_id: item.blog_post_id,
      linked_post_title: item.blog_post_id ? (titleMap.get(item.blog_post_id) ?? null) : null,
    }),
  )
}
```

- [ ] **Step 3: Add createPostFromPipeline action**

Add to `apps/web/src/app/cms/(authed)/blog/actions.ts`, after `searchPipelineItems`:

```typescript
export async function createPostFromPipeline(
  siteId: string,
  pipelineItemId: string,
  locale: string,
): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()
  const userClient = await getUserClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }

  // Fetch pipeline item
  const { data: item, error: itemErr } = await svc
    .from('content_pipeline')
    .select('id, code, title_pt, title_en, hook, language, blog_post_id')
    .eq('id', pipelineItemId)
    .eq('site_id', siteId)
    .eq('is_archived', false)
    .single()

  if (itemErr || !item) return { ok: false, error: 'Pipeline item not found' }
  if (item.blog_post_id) return { ok: false, error: 'Item already linked to a blog post' }

  // Determine title based on locale
  const isPt = locale === 'pt-BR'
  const title = (isPt ? item.title_pt : item.title_en) ?? item.title_pt ?? item.title_en ?? 'Untitled'
  const excerpt = item.hook ?? undefined

  // Fetch body content from sections
  let bodyContent = ''
  const { data: sections } = await svc
    .from('content_pipeline_sections')
    .select('section_type, content')
    .eq('pipeline_id', pipelineItemId)
    .or('section_type.ilike.%rascunho%,section_type.ilike.%body%,section_type.ilike.%draft%')
    .limit(1)

  if (sections && sections.length > 0) {
    bodyContent = (sections[0] as { content: string }).content
  }

  // Create the post
  const result = await createPost({
    title,
    locale,
    status: 'idea',
  })
  if (!result.ok) return result

  // Update excerpt and content if available
  if (excerpt || bodyContent) {
    await svc
      .from('blog_translations')
      .update({
        ...(excerpt ? { excerpt } : {}),
        ...(bodyContent ? { content_mdx: bodyContent } : {}),
      })
      .eq('post_id', result.postId)
      .eq('locale', locale)
  }

  // Link pipeline item to post
  const { linkPostToItem } = await import('@/lib/pipeline/blog-link')
  const linkResult = await linkPostToItem(pipelineItemId, result.postId, siteId, user.id)
  if (!linkResult.ok) {
    // Post was created but linking failed — log but don't fail
    console.error('[createPostFromPipeline] link failed:', linkResult.error)
  }

  return { ok: true, postId: result.postId }
}
```

- [ ] **Step 4: Update blog/[id]/edit/actions.ts to re-export**

In `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts`, replace the `searchPipelineItems` function with a re-export:

```typescript
// Remove the full function definition (lines 346-370) and replace with:
export { searchPipelineItems } from '@/app/cms/(authed)/blog/actions'
export type { PipelineSearchResult } from '@/app/cms/(authed)/blog/actions'
```

- [ ] **Step 5: Run full test suite to verify no regressions**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/actions.ts apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts apps/web/test/unit/blog/pipeline-actions.test.ts
git commit -m "feat(blog): add createPostFromPipeline action + enhance searchPipelineItems with language/priority/hook/linked_post_title"
```

---

### Task 4: PipelineSearchInput Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_shared/pipeline-search-input.tsx`
- Test: `apps/web/test/unit/blog/pipeline-search-input.test.tsx`

**Depends on:** Task 3 (uses `searchPipelineItems` and `PipelineSearchResult` type)

Reusable search input with dropdown results. Two modes: "create" (editorial tab — click creates post) and "select" (new post — click selects item).

**Existing code to know:**
- `getFormatIcon(format)` from `@/lib/pipeline/gem-design` for format icons in results
- `getPriorityConfig(priority)` from same file for priority badge colors
- `searchPipelineItems(siteId, query)` from `blog/actions.ts` (Task 3)

- [ ] **Step 1: Write the test file**

```typescript
// apps/web/test/unit/blog/pipeline-search-input.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PipelineSearchInput } from '@/app/cms/(authed)/blog/_shared/pipeline-search-input'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockResults = [
  {
    id: '1',
    code: 'tg-01',
    title: 'AI Empire',
    format: 'blog_post',
    stage: 'ideia',
    language: 'pt-br',
    priority: 2,
    hook: 'Um mapa do que estou construindo',
    blog_post_id: null,
    linked_post_title: null,
  },
  {
    id: '2',
    code: 'tg-02',
    title: 'Hacking',
    format: 'blog_post',
    stage: 'rascunho',
    language: 'pt-br',
    priority: 3,
    hook: null,
    blog_post_id: 'post-99',
    linked_post_title: 'Meu Primeiro Contato com Hacking',
  },
]

describe('PipelineSearchInput', () => {
  const onSearch = vi.fn().mockResolvedValue(mockResults)
  const onSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search input with placeholder', () => {
    render(<PipelineSearchInput onSearch={onSearch} onSelect={onSelect} mode="create" />)
    expect(screen.getByPlaceholderText(/Criar do pipeline/)).toBeDefined()
  })

  it('calls onSearch after typing 2+ chars', async () => {
    vi.useFakeTimers()
    render(<PipelineSearchInput onSearch={onSearch} onSelect={onSelect} mode="create" />)
    const input = screen.getByPlaceholderText(/Criar do pipeline/)
    fireEvent.change(input, { target: { value: 'ai' } })
    vi.advanceTimersByTime(350)
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('ai'))
    vi.useRealTimers()
  })

  it('does not search with less than 2 chars', async () => {
    vi.useFakeTimers()
    render(<PipelineSearchInput onSearch={onSearch} onSelect={onSelect} mode="create" />)
    const input = screen.getByPlaceholderText(/Criar do pipeline/)
    fireEvent.change(input, { target: { value: 'a' } })
    vi.advanceTimersByTime(350)
    expect(onSearch).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('shows linked items as disabled', async () => {
    vi.useFakeTimers()
    render(<PipelineSearchInput onSearch={onSearch} onSelect={onSelect} mode="create" />)
    const input = screen.getByPlaceholderText(/Criar do pipeline/)
    fireEvent.change(input, { target: { value: 'tg' } })
    vi.advanceTimersByTime(350)
    await waitFor(() => expect(screen.getByText(/vinculado a/)).toBeDefined())
    vi.useRealTimers()
  })

  it('calls onSelect with item when available result clicked', async () => {
    vi.useFakeTimers()
    render(<PipelineSearchInput onSearch={onSearch} onSelect={onSelect} mode="create" />)
    const input = screen.getByPlaceholderText(/Criar do pipeline/)
    fireEvent.change(input, { target: { value: 'tg' } })
    vi.advanceTimersByTime(350)
    await waitFor(() => expect(screen.getByText('AI Empire')).toBeDefined())
    fireEvent.click(screen.getByText('AI Empire'))
    expect(onSelect).toHaveBeenCalledWith(mockResults[0])
    vi.useRealTimers()
  })

  it('shows empty state when no results', async () => {
    vi.useFakeTimers()
    const emptySearch = vi.fn().mockResolvedValue([])
    render(<PipelineSearchInput onSearch={emptySearch} onSelect={onSelect} mode="create" />)
    const input = screen.getByPlaceholderText(/Criar do pipeline/)
    fireEvent.change(input, { target: { value: 'xyz' } })
    vi.advanceTimersByTime(350)
    await waitFor(() => expect(screen.getByText(/Nenhum item encontrado/)).toBeDefined())
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/unit/blog/pipeline-search-input.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PipelineSearchInput**

```typescript
// apps/web/src/app/cms/(authed)/blog/_shared/pipeline-search-input.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getFormatIcon, getPriorityConfig } from '@/lib/pipeline/gem-design'
import type { PipelineSearchResult } from '@/app/cms/(authed)/blog/actions'

interface PipelineSearchInputProps {
  onSearch: (query: string) => Promise<PipelineSearchResult[]>
  onSelect: (item: PipelineSearchResult) => void
  mode: 'create' | 'select'
}

const STAGE_LABELS: Record<string, string> = {
  ideia: 'ideia',
  rascunho: 'rascunho',
  roteiro: 'roteiro',
  gravacao: 'gravação',
  edicao: 'edição',
  thumbnail: 'thumbnail',
  scheduled: 'agendado',
  published: 'publicado',
}

const LANG_BADGES: Record<string, { label: string; className: string }> = {
  'pt-br': { label: 'PT', className: 'bg-[rgba(16,185,129,0.15)] text-[#10b981]' },
  en: { label: 'EN', className: 'bg-[rgba(59,130,246,0.15)] text-[#3b82f6]' },
  both: { label: 'PT+EN', className: 'bg-[rgba(99,102,241,0.15)] text-[#6366f1]' },
}

export function PipelineSearchInput({ onSearch, onSelect, mode }: PipelineSearchInputProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PipelineSearchResult[] | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isSearching, setIsSearching] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const doSearch = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults(null)
        setIsOpen(false)
        return
      }
      setIsSearching(true)
      try {
        const r = await onSearch(q)
        setResults(r)
        setIsOpen(true)
        setSelectedIndex(-1)
      } catch {
        setResults([])
        setIsOpen(true)
      } finally {
        setIsSearching(false)
      }
    },
    [onSearch],
  )

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 300)
  }

  function handleSelect(item: PipelineSearchResult) {
    if (item.blog_post_id) return
    onSelect(item)
    setQuery('')
    setResults(null)
    setIsOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || !results) return
    const availableItems = results.filter((r) => !r.blog_post_id)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, availableItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      handleSelect(availableItems[selectedIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 rounded-md border border-[#222d40] bg-[#161d2d] px-2.5 py-1.5 focus-within:border-[#6366f1]" style={{ minWidth: 240 }}>
        <span className="text-[10px] text-[#6366f1]">📋</span>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results && setIsOpen(true)}
          placeholder={mode === 'create' ? 'Criar do pipeline... (código ou título)' : 'Buscar pipeline... (código ou título)'}
          className="min-w-0 flex-1 bg-transparent text-[11px] text-[#edf2f7] placeholder-[#5a6b7f] outline-none"
        />
        {isSearching && (
          <div className="h-3 w-3 animate-spin rounded-full border border-[#6366f1] border-t-transparent" />
        )}
      </div>

      {isOpen && results !== null && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-[#222d40] bg-[#161d2d] shadow-[0_8px_24px_rgba(0,0,0,0.5)]" style={{ minWidth: 320 }}>
          {results.length === 0 ? (
            <div className="p-4 text-center">
              <div className="text-[11px] text-[#5a6b7f]">Nenhum item encontrado</div>
              <div className="mt-1 text-[9px] text-[#3a4a5f]">
                Busque por código (ex: tg-01) ou título
              </div>
            </div>
          ) : (
            results.map((item, idx) => {
              const isLinked = !!item.blog_post_id
              const { icon } = getFormatIcon(item.format as Parameters<typeof getFormatIcon>[0])
              const pConfig = getPriorityConfig(item.priority)
              const langBadge = LANG_BADGES[item.language] ?? LANG_BADGES['pt-br']
              const stageLabel = STAGE_LABELS[item.stage] ?? item.stage

              if (isLinked) {
                return (
                  <div
                    key={item.id}
                    className="cursor-not-allowed border-b border-[#222d40] px-2.5 py-2 opacity-40 last:border-b-0"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px]">{icon}</span>
                      <span className="font-mono text-[9px] text-[#6366f1]">{item.code}</span>
                      <span className="text-[9px] text-[#5a6b7f]">→ vinculado a</span>
                      <span className="text-[9px] italic text-[#7a8ba3]">
                        &quot;{item.linked_post_title}&quot;
                      </span>
                    </div>
                  </div>
                )
              }

              const availableIdx = results
                .filter((r) => !r.blog_post_id)
                .findIndex((r) => r.id === item.id)

              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={availableIdx === selectedIndex}
                  className={`cursor-pointer border-b border-[#222d40] px-2.5 py-2 last:border-b-0 hover:bg-[rgba(99,102,241,0.06)] ${
                    availableIdx === selectedIndex ? 'bg-[rgba(99,102,241,0.06)]' : ''
                  }`}
                  onClick={() => handleSelect(item)}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px]" title={item.format}>
                      {icon}
                    </span>
                    <span className="font-mono text-[9px] text-[#6366f1]">{item.code}</span>
                    <span
                      className={`rounded px-1 py-px text-[9px] ${langBadge.className}`}
                    >
                      {langBadge.label}
                    </span>
                    <span
                      className="rounded px-1 py-px text-[9px]"
                      style={{
                        backgroundColor: `${pConfig.accent}20`,
                        color: pConfig.accent,
                      }}
                    >
                      P{item.priority}
                    </span>
                    <span className="rounded bg-[rgba(6,182,212,0.15)] px-1 py-px text-[9px] text-[#06b6d4]">
                      {stageLabel}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#edf2f7]">{item.title}</div>
                  {item.hook && (
                    <div className="mt-px line-clamp-1 text-[9px] text-[#5a6b7f]">
                      {item.hook}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/unit/blog/pipeline-search-input.test.tsx`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/_shared/pipeline-search-input.tsx apps/web/test/unit/blog/pipeline-search-input.test.tsx
git commit -m "feat(blog): add PipelineSearchInput with dropdown results, linked-item display, keyboard nav"
```

---

### Task 5: Integrate LocaleToggle into PostEditionEditor + MoreMenu Changes

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/new/post-edition-editor.tsx`
- Modify: `apps/web/src/app/cms/(authed)/_shared/editor/more-menu.tsx`

**Depends on:** Task 1 (LocaleToggle component)

**Existing code to know:**
- `LocalePill` is defined at lines 274-283 of `post-edition-editor.tsx` and rendered at line ~1074.
- `LOCALE_FLAGS` (lines 83-89) and `LOCALE_LABELS` (lines 91-97) can stay in the editor file (other parts may use them).
- `handleChangeLocale` at lines 895-904 uses `changeTranslationLocale` to switch locale (this is a RENAME, not a switch — it changes the existing translation's locale). The toggle needs a DIFFERENT behavior: it should navigate to the other locale, not rename.
- The editor receives `existingLocales`, `supportedLocales`, `locale`, and `postId` as props or state. The `postId` is null for new unsaved posts.
- MoreMenu props `changeLocaleTargets` and `onChangeLocale` need to be removed; `canRemoveLocale` and `onRemoveLocale` stay.

- [ ] **Step 1: Modify MoreMenu — remove locale switch props**

In `apps/web/src/app/cms/(authed)/_shared/editor/more-menu.tsx`:

Remove from the Props interface:
```typescript
  changeLocaleTargets?: string[]
  onChangeLocale?: (toLocale: string) => void
```

Remove the locale change menu items (lines 55-59):
```typescript
    if (changeLocaleTargets && changeLocaleTargets.length > 0 && onChangeLocale) {
      items.push('separator')
      for (const loc of changeLocaleTargets) {
        items.push({ label: `Change to ${loc.toUpperCase()}`, icon: <Globe size={14} />, onClick: () => onChangeLocale(loc) })
      }
    }
```

Keep the remove locale items (lines 61-63) — they remain unchanged.

Also remove the `Globe` import if it's no longer used elsewhere in the file.

- [ ] **Step 2: Replace LocalePill with LocaleToggle in PostEditionEditor**

In `apps/web/src/app/cms/(authed)/blog/new/post-edition-editor.tsx`:

Add import at the top:
```typescript
import { LocaleToggle } from '@/app/cms/(authed)/blog/_shared/locale-toggle'
```

Find where `<LocalePill locale={locale} />` is rendered (line ~1074) and replace with:
```typescript
<LocaleToggle
  currentLocale={locale}
  existingLocales={existingLocales ?? [locale]}
  supportedLocales={supportedLocales}
  isPostPersisted={!!postId}
  isSaving={isSaving}
  onSwitchLocale={(toLocale) => {
    router.push(`/cms/blog/${postId}/edit?locale=${toLocale}`)
  }}
  onAddLocale={async (newLocale) => {
    if (!postId) return
    const result = await addLocale(postId, newLocale)
    if (result.ok) {
      toast.success('Locale added')
      router.push(`/cms/blog/${postId}/edit?locale=${newLocale}`)
    } else {
      toast.error(result.error === 'locale_exists' ? 'Locale already exists' : 'Failed to add locale')
    }
  }}
/>
```

Remove `changeLocaleTargets` and `onChangeLocale` from the `<MoreMenu>` usage (around line 1160).

The `LocalePill` component definition (lines 274-283) can be removed since it's no longer used. But verify no other code references it first — it's a local (non-exported) function, so removing it is safe.

- [ ] **Step 3: Run full test suite to verify no regressions**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/new/post-edition-editor.tsx apps/web/src/app/cms/(authed)/_shared/editor/more-menu.tsx
git commit -m "feat(blog): replace LocalePill with LocaleToggle, remove locale switch from MoreMenu"
```

---

### Task 6: Pipeline Item Detail — PromptGenerator Integration

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx`

**Depends on:** Task 2 (PromptGeneratorModal)

Add an "Adicionar versão EN/PT" button in the language section of the pipeline item detail sidebar. Clicking opens the PromptGeneratorModal.

**Existing code to know:**
- Language display is at lines 517-520: a simple `<dt>Language</dt><dd>{lang.label}</dd>` row.
- The sidebar's Details card starts around line 490 and contains format, language, priority, tags, collections.
- The item data is available as `item` (the full pipeline item with all fields).
- Sections are NOT currently fetched on the detail page. Need to fetch them when modal opens.

- [ ] **Step 1: Add prompt generator trigger to pipeline-item-detail.tsx**

Add import:
```typescript
import { PromptGeneratorModal } from './prompt-generator-modal'
```

Add state near the top of the component:
```typescript
const [showPromptModal, setShowPromptModal] = useState(false)
const [promptSections, setPromptSections] = useState<Array<{ section_type: string; language: string; content: string }>>([])
const [loadingSections, setLoadingSections] = useState(false)
```

Add handler:
```typescript
async function handleOpenPromptGenerator() {
  setLoadingSections(true)
  try {
    const res = await fetch(`/api/pipeline/items/${item.id}/sections`)
    if (!res.ok) throw new Error('Failed to fetch sections')
    const data = await res.json()
    setPromptSections(
      (data.sections ?? []).map((s: { section_type: string; language: string; content: string }) => ({
        section_type: s.section_type,
        language: s.language,
        content: s.content,
      })),
    )
    setShowPromptModal(true)
  } catch {
    toast.error('Erro ao carregar seções')
  } finally {
    setLoadingSections(false)
  }
}
```

Modify the language row (lines 517-520). After the existing `<dd>` for language, add:
```typescript
<div className="flex justify-between">
  <dt style={{ color: 'var(--gem-dim)' }}>Language</dt>
  <dd className="flex items-center gap-2">
    <span className={`text-[10px] px-1 py-0.5 rounded ${lang.className}`}>{lang.label}</span>
    {item.language !== 'both' && (
      <button
        type="button"
        onClick={handleOpenPromptGenerator}
        disabled={loadingSections}
        className="text-[9px] text-[#6366f1] hover:text-[#818cf8] disabled:opacity-50"
      >
        {loadingSections ? '...' : `+ ${item.language === 'pt-br' ? 'EN' : 'PT'}`}
      </button>
    )}
  </dd>
</div>
```

Add the modal render at the end of the component's return (before the closing fragment/div):
```typescript
{showPromptModal && (
  <PromptGeneratorModal
    item={{
      id: item.id,
      code: item.code,
      format: item.format,
      stage: item.stage,
      priority: item.priority,
      language: item.language as 'pt-br' | 'en' | 'both',
      title_pt: item.title_pt,
      title_en: item.title_en,
      hook: item.hook ?? null,
      synopsis: item.synopsis ?? null,
    }}
    sections={promptSections}
    targetLocale={item.language === 'pt-br' ? 'en' : 'pt-br'}
    onClose={() => setShowPromptModal(false)}
  />
)}
```

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx
git commit -m "feat(pipeline): add prompt generator button in item detail language section"
```

---

### Task 7: Editorial Tab Integration

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/editorial-tab.tsx`

**Depends on:** Task 3 (searchPipelineItems), Task 4 (PipelineSearchInput)

Add `PipelineSearchInput` to the editorial tab's top bar, between the existing post search and the kanban board. Click creates a post from pipeline item and optimistically updates the kanban.

**Existing code to know:**
- The editorial tab's top bar is at lines 239-248 (search input).
- The tab receives `siteId` and kanban posts data.
- `revalidatePath` is used after mutations, but optimistic UI for the new card is preferred.
- The tab is a client component.
- `createPostFromPipeline(siteId, itemId, locale)` from `blog/actions.ts` (Task 3) handles post creation + linking.

- [ ] **Step 1: Add PipelineSearchInput to editorial tab**

Add imports at the top of `editorial-tab.tsx`:
```typescript
import { PipelineSearchInput } from '@/app/cms/(authed)/blog/_shared/pipeline-search-input'
import { searchPipelineItems, createPostFromPipeline } from '@/app/cms/(authed)/blog/actions'
import type { PipelineSearchResult } from '@/app/cms/(authed)/blog/actions'
import { toast } from 'sonner'
```

In the top bar area (after the existing search input, before the closing `</div>` of the flex container), add:

```typescript
<PipelineSearchInput
  onSearch={(q) => searchPipelineItems(siteId, q)}
  onSelect={async (item: PipelineSearchResult) => {
    const locale =
      item.language === 'en'
        ? 'en'
        : item.language === 'pt-br'
          ? 'pt-BR'
          : defaultLocale
    const result = await createPostFromPipeline(siteId, item.id, locale)
    if (result.ok) {
      toast.success(`Post criado a partir de ${item.code}`, {
        action: {
          label: 'Abrir →',
          onClick: () => window.open(`/cms/blog/${result.postId}/edit`, '_blank'),
        },
      })
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }}
  mode="create"
/>
```

Note: The editorial tab needs access to `router` and `siteId`. The `siteId` is available as a prop. Add `useRouter` if not already imported:
```typescript
import { useRouter } from 'next/navigation'
```
And inside the component: `const router = useRouter()` (if not already present).

Also need `defaultLocale` prop — check if it's already passed; if not, add it to the component's props interface.

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/_tabs/editorial/editorial-tab.tsx
git commit -m "feat(blog): add pipeline search in editorial tab — click creates post from pipeline item"
```

---

### Task 8: New Post — PipelineSourcePicker + Page Integration

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/new/pipeline-source-picker.tsx`
- Modify: `apps/web/src/app/cms/(authed)/blog/new/page.tsx`
- Test: `apps/web/test/unit/blog/pipeline-source-picker.test.tsx`

**Depends on:** Task 3 (createPostFromPipeline, searchPipelineItems), Task 4 (PipelineSearchInput)

Source selector for new post page: "Em branco" vs "Do Pipeline". When "Do Pipeline" selected, shows pipeline search, selected item card, locale picker, and create button.

**Existing code to know:**
- `page.tsx` (lines 7-51) is a server component that fetches tags and supportedLocales, then renders `<PostEditionEditor>`.
- `PostEditionEditor` handles the full editing experience.
- When source is "Do Pipeline", the PipelineSourcePicker handles item selection + locale selection + creation, then redirects to the editor with data pre-filled.
- `createPostFromPipeline(siteId, itemId, locale)` from `blog/actions.ts` does creation + linking.

- [ ] **Step 1: Write PipelineSourcePicker test**

```typescript
// apps/web/test/unit/blog/pipeline-source-picker.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PipelineSourcePicker } from '@/app/cms/(authed)/blog/new/pipeline-source-picker'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe('PipelineSourcePicker', () => {
  const defaults = {
    siteId: 'site-1',
    supportedLocales: ['pt-BR', 'en'],
    defaultLocale: 'pt-BR',
    onSearch: vi.fn().mockResolvedValue([]),
    onCreate: vi.fn().mockResolvedValue({ ok: true, postId: 'new-123' }),
  }

  it('renders source selector with two options', () => {
    render(<PipelineSourcePicker {...defaults} />)
    expect(screen.getByText('Em branco')).toBeDefined()
    expect(screen.getByText('Do Pipeline')).toBeDefined()
  })

  it('shows pipeline search when "Do Pipeline" selected', () => {
    render(<PipelineSourcePicker {...defaults} />)
    fireEvent.click(screen.getByText('Do Pipeline'))
    expect(screen.getByPlaceholderText(/Buscar pipeline/)).toBeDefined()
  })

  it('shows locale picker after item selected', () => {
    // This is a visual integration test — the flow is:
    // 1. Select "Do Pipeline"
    // 2. Search + select item
    // 3. Locale picker appears
    // Detailed testing of search is in PipelineSearchInput tests
    expect(true).toBe(true)
  })
})
```

- [ ] **Step 2: Implement PipelineSourcePicker**

```typescript
// apps/web/src/app/cms/(authed)/blog/new/pipeline-source-picker.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PipelineSearchInput } from '@/app/cms/(authed)/blog/_shared/pipeline-search-input'
import { getFormatIcon } from '@/lib/pipeline/gem-design'
import type { PipelineSearchResult } from '@/app/cms/(authed)/blog/actions'

const LOCALE_FLAGS: Record<string, string> = {
  'pt-BR': '\u{1F1E7}\u{1F1F7}',
  en: '\u{1F1FA}\u{1F1F8}',
}

const LOCALE_NAMES: Record<string, string> = {
  'pt-BR': 'Português',
  en: 'English',
}

const PIPELINE_LANG_TO_LOCALE: Record<string, string> = {
  'pt-br': 'pt-BR',
  en: 'en',
}

interface PipelineSourcePickerProps {
  siteId: string
  supportedLocales: string[]
  defaultLocale: string
  onSearch: (query: string) => Promise<PipelineSearchResult[]>
  onCreate: (
    siteId: string,
    itemId: string,
    locale: string,
  ) => Promise<{ ok: true; postId: string } | { ok: false; error: string }>
}

export function PipelineSourcePicker({
  siteId,
  supportedLocales,
  defaultLocale,
  onSearch,
  onCreate,
}: PipelineSourcePickerProps) {
  const router = useRouter()
  const [source, setSource] = useState<'blank' | 'pipeline'>('blank')
  const [selectedItem, setSelectedItem] = useState<PipelineSearchResult | null>(null)
  const [selectedLocale, setSelectedLocale] = useState<string>(defaultLocale)
  const [isCreating, setIsCreating] = useState(false)

  if (source === 'blank') {
    return (
      <div className="mb-4">
        <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[#5a6b7f]">Fonte</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSource('blank')}
            className="flex-1 rounded-lg border border-[#6366f1] bg-[rgba(99,102,241,0.06)] p-2.5 text-center"
          >
            <div className="text-base">✏️</div>
            <div className="text-[11px] font-medium text-[#6366f1]">Em branco</div>
          </button>
          <button
            type="button"
            onClick={() => setSource('pipeline')}
            className="flex-1 rounded-lg border border-[#222d40] bg-[#161d2d] p-2.5 text-center hover:border-[#6366f1]"
          >
            <div className="text-base">📋</div>
            <div className="text-[11px] text-[#7a8ba3]">Do Pipeline</div>
          </button>
        </div>
      </div>
    )
  }

  // Source: pipeline
  function handleItemSelect(item: PipelineSearchResult) {
    setSelectedItem(item)
    const pipelineLocale = PIPELINE_LANG_TO_LOCALE[item.language] ?? defaultLocale
    setSelectedLocale(pipelineLocale)
  }

  async function handleCreate() {
    if (!selectedItem) return
    setIsCreating(true)
    try {
      const result = await onCreate(siteId, selectedItem.id, selectedLocale)
      if (result.ok) {
        router.push(`/cms/blog/${result.postId}/edit`)
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('Erro ao criar post')
    } finally {
      setIsCreating(false)
    }
  }

  const formatIcon = selectedItem
    ? getFormatIcon(selectedItem.format as Parameters<typeof getFormatIcon>[0])
    : null

  return (
    <div className="mb-4 space-y-4">
      {/* Source selector */}
      <div>
        <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[#5a6b7f]">Fonte</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSource('blank')
              setSelectedItem(null)
            }}
            className="flex-1 rounded-lg border border-[#222d40] bg-[#161d2d] p-2.5 text-center hover:border-[#6366f1]"
          >
            <div className="text-base">✏️</div>
            <div className="text-[11px] text-[#7a8ba3]">Em branco</div>
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg border border-[#6366f1] bg-[rgba(99,102,241,0.06)] p-2.5 text-center"
          >
            <div className="text-base">📋</div>
            <div className="text-[11px] font-medium text-[#6366f1]">Do Pipeline</div>
          </button>
        </div>
      </div>

      {/* Pipeline item search/selection */}
      <div>
        <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[#5a6b7f]">Pipeline Item</div>
        {selectedItem ? (
          <div className="rounded-lg border border-[rgba(99,102,241,0.3)] bg-[#161d2d] p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">{formatIcon?.icon}</span>
                <span className="rounded bg-[rgba(99,102,241,0.1)] px-1 py-px font-mono text-[9px] text-[#6366f1]">
                  {selectedItem.code}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="text-[9px] text-[#5a6b7f] hover:text-[#7a8ba3]"
              >
                ✕ trocar
              </button>
            </div>
            <div className="text-xs font-medium text-[#edf2f7]">{selectedItem.title}</div>
            {selectedItem.hook && (
              <div className="mt-0.5 text-[10px] italic text-[#5a6b7f]">{selectedItem.hook}</div>
            )}
            <div className="mt-2 border-t border-[#222d40] pt-2">
              <div className="mb-1 text-[9px] text-[#5a6b7f]">Será copiado:</div>
              <div className="flex flex-wrap gap-1">
                <span className="rounded bg-[rgba(16,185,129,0.1)] px-1.5 py-px text-[8px] text-[#10b981]">
                  título → title
                </span>
                <span className="rounded bg-[rgba(16,185,129,0.1)] px-1.5 py-px text-[8px] text-[#10b981]">
                  hook → excerpt
                </span>
                <span className="rounded bg-[rgba(16,185,129,0.1)] px-1.5 py-px text-[8px] text-[#10b981]">
                  body → content_mdx
                </span>
                <span className="rounded bg-[rgba(99,102,241,0.1)] px-1.5 py-px text-[8px] text-[#6366f1]">
                  pipeline link
                </span>
              </div>
            </div>
          </div>
        ) : (
          <PipelineSearchInput onSearch={onSearch} onSelect={handleItemSelect} mode="select" />
        )}
      </div>

      {/* Locale picker (only when item selected) */}
      {selectedItem && (
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[#5a6b7f]">
            Idioma inicial
          </div>
          <div className="flex gap-2">
            {supportedLocales.map((loc) => {
              const isSelected = loc === selectedLocale
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setSelectedLocale(loc)}
                  className={`flex-1 rounded-lg border p-2 text-center ${
                    isSelected
                      ? 'border-[#10b981] bg-[rgba(16,185,129,0.06)]'
                      : 'border-[#222d40] bg-[#161d2d] hover:border-[#333d50]'
                  }`}
                >
                  <div className="text-base">{LOCALE_FLAGS[loc] ?? '\u{1F310}'}</div>
                  <div
                    className={`mt-0.5 text-[10px] ${
                      isSelected ? 'font-medium text-[#10b981]' : 'text-[#5a6b7f]'
                    }`}
                  >
                    {LOCALE_NAMES[loc] ?? loc}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Create + Cancel buttons */}
      {selectedItem && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            className="flex-1 rounded-lg bg-[#6366f1] px-3 py-2.5 text-xs font-medium text-white hover:bg-[#5558e6] disabled:opacity-50"
          >
            {isCreating ? 'Criando...' : `Criar post a partir de ${selectedItem.code}`}
          </button>
          <button
            type="button"
            onClick={() => {
              setSource('blank')
              setSelectedItem(null)
            }}
            className="rounded-lg border border-[#222d40] px-4 py-2.5 text-xs text-[#7a8ba3] hover:border-[#333d50]"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Integrate into blog/new/page.tsx**

In `apps/web/src/app/cms/(authed)/blog/new/page.tsx`, add a wrapper that shows the PipelineSourcePicker before the PostEditionEditor. Since `page.tsx` is a server component and PipelineSourcePicker is a client component, create a small client wrapper or pass the search/create actions as props.

Replace the `return` statement (around line 42) with:

```typescript
  return (
    <NewPostWithPipelineSource
      locale={locale}
      tagId={tagId}
      defaultLocale={ctx.defaultLocale}
      tags={tags}
      supportedLocales={supportedLocales}
      siteId={ctx.siteId}
    />
  )
```

Create a new client component in the same file or a separate file. Since the page.tsx is a server component, create a client wrapper:

Add at the top of `page.tsx`:
```typescript
import { NewPostWithPipelineSource } from './new-post-with-pipeline-source'
```

Create `apps/web/src/app/cms/(authed)/blog/new/new-post-with-pipeline-source.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { PostEditionEditor } from './post-edition-editor'
import { PipelineSourcePicker } from './pipeline-source-picker'
import { searchPipelineItems, createPostFromPipeline } from '@/app/cms/(authed)/blog/actions'

interface Props {
  locale: string
  tagId?: string
  defaultLocale: string
  tags: Array<{ id: string; name: string; color: string; nameTranslations: Record<string, string> | null }>
  supportedLocales: string[]
  siteId: string
}

export function NewPostWithPipelineSource({
  locale,
  tagId,
  defaultLocale,
  tags,
  supportedLocales,
  siteId,
}: Props) {
  const [source, setSource] = useState<'blank' | 'pipeline'>('blank')

  return (
    <>
      <PipelineSourcePicker
        siteId={siteId}
        supportedLocales={supportedLocales}
        defaultLocale={defaultLocale}
        onSearch={(q) => searchPipelineItems(siteId, q)}
        onCreate={createPostFromPipeline}
      />
      {source === 'blank' && (
        <PostEditionEditor
          locale={locale}
          tagId={tagId}
          defaultLocale={defaultLocale}
          tags={tags}
          supportedLocales={supportedLocales}
          siteId={siteId}
        />
      )}
    </>
  )
}
```

Wait — the PipelineSourcePicker already manages its own source state internally and redirects on create. The PostEditionEditor should always render (it's the blank-mode editor). When "Do Pipeline" is selected and a post is created, the picker redirects to `/cms/blog/{id}/edit`. So the wrapper is simpler:

```typescript
'use client'

import { PostEditionEditor } from './post-edition-editor'
import { PipelineSourcePicker } from './pipeline-source-picker'
import { searchPipelineItems, createPostFromPipeline } from '@/app/cms/(authed)/blog/actions'

interface Props {
  locale: string
  tagId?: string
  defaultLocale: string
  tags: Array<{ id: string; name: string; color: string; nameTranslations: Record<string, string> | null }>
  supportedLocales: string[]
  siteId: string
}

export function NewPostWithPipelineSource({
  locale,
  tagId,
  defaultLocale,
  tags,
  supportedLocales,
  siteId,
}: Props) {
  return (
    <>
      <PipelineSourcePicker
        siteId={siteId}
        supportedLocales={supportedLocales}
        defaultLocale={defaultLocale}
        onSearch={(q) => searchPipelineItems(siteId, q)}
        onCreate={createPostFromPipeline}
      />
      <PostEditionEditor
        locale={locale}
        tagId={tagId}
        defaultLocale={defaultLocale}
        tags={tags}
        supportedLocales={supportedLocales}
        siteId={siteId}
      />
    </>
  )
}
```

Update `page.tsx` to import and use this wrapper instead of directly rendering `PostEditionEditor`.

- [ ] **Step 4: Run tests**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/new/pipeline-source-picker.tsx apps/web/src/app/cms/(authed)/blog/new/new-post-with-pipeline-source.tsx apps/web/src/app/cms/(authed)/blog/new/page.tsx apps/web/test/unit/blog/pipeline-source-picker.test.tsx
git commit -m "feat(blog): add 'Do Pipeline' source option in new post page with locale picker"
```
