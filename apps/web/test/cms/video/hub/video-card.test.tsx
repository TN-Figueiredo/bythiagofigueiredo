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
  it('is a full-width link button to the editor with code, title, duration, beats', () => {
    render(<VideoCard card={base} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/cms/video/v1/edit')
    expect(screen.getByText('V-A07')).toBeInTheDocument()
    expect(screen.getByText('Como montei meu NAS')).toBeInTheDocument()
    expect(screen.getByText('14–17 min')).toBeInTheDocument()
    expect(screen.getByText('4 beats')).toBeInTheDocument()
  })

  it('renders a colored uppercase pillar pill bound to the pillar color', () => {
    render(<VideoCard card={base} />)
    const pill = screen.getByText('NAS')
    expect(pill.className).toContain('vcard-pillar')
    expect(pill.getAttribute('style') ?? '').toContain('#22c55e')
  })

  it('renders only the languages that are present', () => {
    render(<VideoCard card={{ ...base, hasPt: true, hasEn: true }} />)
    expect(screen.getByText('🇧🇷')).toBeInTheDocument()
    expect(screen.getByText('🇬🇧')).toBeInTheDocument()
  })

  it('falls back to "Sem título" on a blank title and shows no pill for legacy (no pillar)', () => {
    render(<VideoCard card={{ ...base, title: 'Sem título', pillar: undefined }} />)
    expect(screen.getByText('Sem título')).toBeInTheDocument()
    expect(screen.queryByText('NAS')).not.toBeInTheDocument()
  })

  it('shows the dim "sem roteiro" foot label when there is no roteiro', () => {
    render(<VideoCard card={{ ...base, beatsLabel: 'sem roteiro', beatsCount: 0 }} />)
    expect(screen.getByText('sem roteiro')).toBeInTheDocument()
  })
})
