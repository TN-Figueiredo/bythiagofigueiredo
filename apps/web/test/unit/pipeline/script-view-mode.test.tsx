import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScriptViewMode } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/script-view-mode'
import type { RoteiroContent } from '@/lib/pipeline/roteiro-schemas'

const SAMPLE_CONTENT: RoteiroContent = {
  version: 2,
  meta: { canal: 'EN', formato: 'Storytelling', duracao: '14 min' },
  beats: [
    {
      idx: 0,
      name: 'HOOK',
      status: 'DONE',
      duration: 24,
      script: [
        { type: 'note', tag: 'VISUAL', text: 'montage rapida' },
        { type: 'note', tag: 'DIRECTION', text: 'calm delivery' },
        { type: 'line', text: 'I lived in Canada for four years.' },
        { type: 'pause', duration: 0.5 },
        { type: 'line', text: 'I chose to move back.' },
        { type: 'ref', text: 'Double promise plus plan' },
      ],
    },
    {
      idx: 1,
      name: 'Chapter Canada',
      status: 'PENDING',
      duration: 93,
      script: [
        { type: 'line', text: 'It was 2022 when I arrived in Toronto.' },
      ],
    },
  ],
}

describe('ScriptViewMode', () => {
  it('renders header with meta fields', () => {
    render(<ScriptViewMode content={SAMPLE_CONTENT} title="Test Video" />)
    expect(screen.getByText('Test Video')).toBeTruthy()
    expect(screen.getByText(/EN/)).toBeTruthy()
    expect(screen.getByText(/Storytelling/)).toBeTruthy()
  })

  it('renders overview table with beat count', () => {
    const { container } = render(
      <ScriptViewMode content={SAMPLE_CONTENT} />,
    )
    const rows = container.querySelectorAll('.sv-overview tbody tr')
    expect(rows).toHaveLength(2)
  })

  it('renders beat sections with spoken lines', () => {
    render(<ScriptViewMode content={SAMPLE_CONTENT} />)
    expect(screen.getByText('I lived in Canada for four years.')).toBeTruthy()
    expect(screen.getByText('I chose to move back.')).toBeTruthy()
  })

  it('renders direction notes', () => {
    render(<ScriptViewMode content={SAMPLE_CONTENT} />)
    expect(screen.getByText(/calm delivery/)).toBeTruthy()
    expect(screen.getByText(/montage rapida/)).toBeTruthy()
  })

  it('renders pause markers', () => {
    const { container } = render(
      <ScriptViewMode content={SAMPLE_CONTENT} />,
    )
    const pauses = container.querySelectorAll('.sv-pause')
    expect(pauses).toHaveLength(1)
    expect(pauses[0]!.textContent).toContain('0.5s')
  })

  it('renders ref blocks', () => {
    const { container } = render(
      <ScriptViewMode content={SAMPLE_CONTENT} />,
    )
    const refs = container.querySelectorAll('.sv-ref')
    expect(refs).toHaveLength(1)
    expect(refs[0]!.textContent).toContain('Double promise plus plan')
  })

  it('renders footer with date', () => {
    const { container } = render(
      <ScriptViewMode content={SAMPLE_CONTENT} />,
    )
    const footer = container.querySelector('.sv-footer')
    expect(footer).toBeTruthy()
    expect(footer!.textContent).toContain('Pipeline CMS')
  })
})
