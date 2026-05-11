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

import { PromptGeneratorModal } from '@/app/cms/(authed)/pipeline/_components/prompt-generator-modal'
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
})
