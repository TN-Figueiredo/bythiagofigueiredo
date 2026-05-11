import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScriptRenderer } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/script-renderer'

const noop = vi.fn()

const BEAT_WITH_TAGS = {
  meta: { canal: 'EN', formato: 'Storytelling' },
  beats: [
    {
      number: 0,
      label: 'HOOK — Triple Curiosity Gap',
      status: 'GRAVADO',
      text: '[VISUAL: 3s — montage rápida] [TOM: calmo, NÃO dramático] "I lived in Canada for four years." [PAUSE 0.5s] "I chose to move back."',
    },
  ],
}

describe('ScriptRenderer — read mode', () => {
  it('renders tag pills for VISUAL and TOM', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />
    )
    const pills = container.querySelectorAll('[class*="uppercase"]')
    const pillTexts = Array.from(pills).map(p => p.textContent)
    expect(pillTexts).toContain('VISUAL')
    expect(pillTexts).toContain('TOM')
  })

  it('renders narration blocks with border', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />
    )
    const narrations = container.querySelectorAll('[class*="narration"]')
    expect(narrations.length).toBeGreaterThanOrEqual(1)
    expect(narrations[0].textContent).toContain('I lived in Canada')
  })

  it('renders pause chips', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('⏸')
    expect(container.textContent).toContain('0.5s')
  })

  it('highlights NÃO in red', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />
    )
    const neg = container.querySelector('[style*="f87171"]')
    expect(neg).toBeTruthy()
    expect(neg!.textContent).toBe('NÃO')
  })

  it('renders beat header with number, label, and status', () => {
    render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(screen.getByText('#0')).toBeTruthy()
    expect(screen.getByText('HOOK — Triple Curiosity Gap')).toBeTruthy()
  })

  it('renders meta grid when meta is present', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('Canal')
    expect(container.textContent).toContain('EN')
  })
})

describe('ScriptRenderer — edit mode', () => {
  it('shows raw text in contentEditable when isEditing=true', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={true} lang="en" onContentChange={noop} />
    )
    const editable = container.querySelector('[contenteditable="true"]')
    expect(editable).toBeTruthy()
    expect(editable!.textContent).toContain('[VISUAL:')
  })

  it('does NOT render tag pills in edit mode', () => {
    const { container } = render(
      <ScriptRenderer content={BEAT_WITH_TAGS} isEditing={true} lang="en" onContentChange={noop} />
    )
    const pills = Array.from(container.querySelectorAll('[class*="uppercase"]')).filter(el => el.textContent === 'VISUAL')
    expect(pills.length).toBe(0)
  })
})

describe('ScriptRenderer — edge cases', () => {
  it('handles beats with no tags as plain text', () => {
    const content = { beats: [{ number: 1, label: 'Beat 1', text: 'Just plain text here' }] }
    const { container } = render(
      <ScriptRenderer content={content} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('Just plain text here')
  })

  it('handles empty beats array', () => {
    const { container } = render(
      <ScriptRenderer content={{ beats: [] }} isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('Nenhum beat')
  })

  it('handles string content fallback', () => {
    const { container } = render(
      <ScriptRenderer content="raw string content" isEditing={false} lang="en" onContentChange={noop} />
    )
    expect(container.textContent).toContain('raw string content')
  })
})
