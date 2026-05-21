import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

vi.mock('@/lib/pipeline/gem-design', () => ({
  getFormatIcon: vi.fn(() => ({ icon: '🎬', bgClass: 'bg-red-500/10', label: 'Video' })),
}))

const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
  configurable: true,
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

import { PromptGeneratorModal, generatePrompt } from '@/app/cms/(authed)/pipeline/_components/prompt-generator-modal'
import type {
  PipelineItemForPrompt,
  SectionForPrompt,
  PromptGeneratorModalProps,
} from '@/app/cms/(authed)/pipeline/_components/prompt-generator-modal'

const baseItem: PipelineItemForPrompt = {
  id: 'item-123',
  code: 'VID-042',
  format: 'video',
  stage: 'draft',
  priority: 4,
  language: 'pt-br',
  title_pt: 'Como gravar vídeo profissional',
  title_en: null,
  hook: 'Você não precisa de câmera cara',
  synopsis: 'Guia prático para iniciantes',
}

const baseSections: SectionForPrompt[] = [
  { section_type: 'rascunho_pt', language: 'pt-br', content: 'Conteúdo curto.' },
  { section_type: 'seo_pt', language: 'pt-br', content: 'Título: Como gravar | Desc: Guia prático' },
]

const defaultProps: PromptGeneratorModalProps = {
  item: baseItem,
  sections: baseSections,
  targetLocale: 'en',
  onClose: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PromptGeneratorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClipboard.writeText.mockResolvedValue(undefined)
  })

  it('renders modal with item code in header', () => {
    render(<PromptGeneratorModal {...defaultProps} />)
    expect(screen.getByText('VID-042')).toBeTruthy()
  })

  it('generates prompt with item context (code, format, title_en: vazio)', () => {
    render(<PromptGeneratorModal {...defaultProps} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toContain('VID-042')
    expect(textarea.value).toContain('title_en: (vazio)')
    expect(textarea.value).toContain('Como gravar vídeo profissional')
  })

  it('includes section content in prompt', () => {
    render(<PromptGeneratorModal {...defaultProps} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toContain('rascunho_pt')
    expect(textarea.value).toContain('Conteúdo curto.')
  })

  it('truncates sections longer than 500 chars and shows truncation note', () => {
    const longContent = 'A'.repeat(600)
    const sectionsWithLong: SectionForPrompt[] = [
      { section_type: 'rascunho_pt', language: 'pt-br', content: longContent },
    ]
    render(
      <PromptGeneratorModal
        {...defaultProps}
        sections={sectionsWithLong}
      />,
    )
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toContain('...')
    expect(screen.getByText(/truncado/i)).toBeTruthy()
  })

  it('copies prompt to clipboard on button click', async () => {
    render(<PromptGeneratorModal {...defaultProps} />)
    const copyBtn = screen.getByRole('button', { name: /copiar prompt/i })
    fireEvent.click(copyBtn)
    // Wait for async clipboard write
    await vi.waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledOnce()
    })
  })

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn()
    render(<PromptGeneratorModal {...defaultProps} onClose={onClose} />)
    const cancelBtn = screen.getByRole('button', { name: /cancelar/i })
    fireEvent.click(cancelBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('has role="dialog" and aria-modal', () => {
    render(<PromptGeneratorModal {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })
})

describe('generatePrompt (pure function)', () => {
  it('returns text with item code and context', () => {
    const result = generatePrompt(baseItem, baseSections, 'en')
    expect(result.text).toContain('VID-042')
    expect(result.text).toContain('title_en: (vazio)')
    expect(result.text).toContain('Possui apenas versão pt-br')
  })

  it('includes hook and synopsis when present', () => {
    const result = generatePrompt(baseItem, baseSections, 'en')
    expect(result.text).toContain('Hook: Você não precisa de câmera cara')
    expect(result.text).toContain('Synopsis: Guia prático para iniciantes')
  })

  it('omits hook/synopsis lines when null', () => {
    const itemNoHook = { ...baseItem, hook: null, synopsis: null }
    const result = generatePrompt(itemNoHook, baseSections, 'en')
    expect(result.text).not.toContain('Hook:')
    expect(result.text).not.toContain('Synopsis:')
  })

  it('truncates sections over 500 chars and sets wasTruncated', () => {
    const longSections: SectionForPrompt[] = [
      { section_type: 'body', language: 'pt-br', content: 'X'.repeat(600) },
    ]
    const result = generatePrompt(baseItem, longSections, 'en')
    expect(result.wasTruncated).toBe(true)
    expect(result.text).toContain('...')
    expect(result.text).not.toContain('X'.repeat(600))
  })

  it('generates correct direction for pt-br target', () => {
    const itemEn = { ...baseItem, language: 'en' as const, title_en: 'Pro video', title_pt: null }
    const result = generatePrompt(itemEn, [], 'pt-br')
    expect(result.text).toContain('Possui apenas versão en')
    expect(result.text).toContain('title_pt: (vazio)')
    expect(result.text).toContain('Crie a versão Português (PT-BR)')
  })

  it('returns accurate word count', () => {
    const result = generatePrompt(baseItem, [], 'en')
    const manualCount = result.text.split(/\s+/).filter(Boolean).length
    expect(result.wordCount).toBe(manualCount)
  })

  it('references PATCH API (not server actions) for item update', () => {
    const result = generatePrompt(baseItem, baseSections, 'en')
    expect(result.text).toContain(`PATCH /api/pipeline/items/${baseItem.id}`)
    expect(result.text).toContain('X-Expected-Version')
    expect(result.text).not.toContain('server action')
    expect(result.text).not.toContain('updatePipelineItem()')
  })

  it('references per-section PATCH endpoint for creating target locale sections', () => {
    const result = generatePrompt(baseItem, baseSections, 'en')
    expect(result.text).toContain(`PATCH /api/pipeline/items/${baseItem.id}/sections/<section_key>?lang=en`)
    expect(result.text).toContain('"source": "cowork"')
  })

  it('includes initial GET step to fetch item version', () => {
    const result = generatePrompt(baseItem, baseSections, 'en')
    expect(result.text).toContain(`GET /api/pipeline/items/${baseItem.id}`)
    expect(result.text).toContain('Note "version" for X-Expected-Version header')
  })
})
