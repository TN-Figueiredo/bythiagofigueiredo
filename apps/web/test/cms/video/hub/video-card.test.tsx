import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoCard } from '@/app/cms/(authed)/video/_components/video-card'
import type { VideoHubCard } from '@/lib/pipeline/load-video-hub'

const base: VideoHubCard = {
  id: 'v1', code: 'V-A07', title: 'Como montei meu NAS', column: 'roteiro', stage: 'roteiro',
  language: 'pt-br', pillar: 'nas', duration: '14–17 min', beatsLabel: '4 beats', beatsCount: 4,
  hasPt: true, hasEn: false, version: 1,
}

describe('VideoCard', () => {
  it('is a .vcard link to the editor with code, title, duration', () => {
    const { container } = render(<VideoCard card={base} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/cms/video/v1/edit')
    expect(link).toHaveClass('vcard')
    expect(container.querySelector('.vcard-code')!.textContent).toBe('V-A07')
    expect(container.querySelector('.vcard-title')!.textContent).toBe('Como montei meu NAS')
    expect(container.querySelector('.vf-dur')!.textContent).toBe('14–17 min')
  })

  it('renders a .vpill pillar pill bound to the pillar color via --pc', () => {
    const { container } = render(<VideoCard card={base} />)
    const pill = container.querySelector('.vpill') as HTMLElement
    expect(pill).toBeTruthy()
    expect(pill.textContent).toContain('NAS')
    expect(pill.getAttribute('style') ?? '').toContain('#22c55e')
    expect(pill.querySelector('.vp-dot')).toBeTruthy()
  })

  it('renders only the flags for the languages present', () => {
    const { container } = render(<VideoCard card={{ ...base, hasPt: true, hasEn: true }} />)
    const langs = container.querySelector('.vcard-langs')!.textContent ?? ''
    expect(langs).toContain('🇧🇷')
    expect(langs).toContain('🇺🇸')
  })

  it('falls back to "Sem título" and shows a fallback pill (PILLARS[0]) for legacy (no pillar)', () => {
    const { container } = render(<VideoCard card={{ ...base, title: '', pillar: undefined }} />)
    expect(screen.getByText('Sem título')).toBeInTheDocument()
    const pill = container.querySelector('.vpill') as HTMLElement
    expect(pill).toBeTruthy()
    expect(pill.textContent).toContain('Viagem')
  })

  it('shows the dim beatsLabel in .vf-beats when there is no roteiro', () => {
    const { container } = render(<VideoCard card={{ ...base, beatsLabel: 'sem roteiro', beatsCount: 0 }} />)
    const beats = container.querySelector('.vf-beats') as HTMLElement
    expect(beats.className).toContain('dim')
    expect(beats.textContent).toContain('sem roteiro')
  })

  it('shows "{n} beats" in .vf-beats when beatsCount > 0', () => {
    const { container } = render(<VideoCard card={base} />)
    const beats = container.querySelector('.vf-beats') as HTMLElement
    expect(beats.className).not.toContain('dim')
    expect(beats.textContent).toContain('4 beats')
  })
})
