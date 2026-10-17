// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../src/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard', () => ({
  AbCreateWizard: (p: { video: { id: string }; referencia?: React.ReactNode }) => (
    <div data-testid="wizard" data-video={p.video.id}>{p.referencia}</div>
  ),
}))

import { NewTestClient } from '../src/app/cms/(authed)/youtube/ab-lab/new/client'

const video = (id: string, hasActiveTest = false) => ({
  id, title: `Vídeo ${id}`, thumbnailUrl: null, durationSeconds: 60,
  channelHandle: '@x', hasActiveTest, previousLift: null, sourcePipelineId: null,
})
const base = {
  siteId: 's',
  settings: {} as never,
  eligibleVideos: [video('u1'), video('u2')],
}

describe('NewTestClient', () => {
  it('initialVideoId elegível abre o assistente com aquele vídeo', () => {
    render(<NewTestClient {...base} initialVideoId="u2" />)
    expect(screen.getByTestId('wizard').getAttribute('data-video')).toBe('u2')
  })
  it('sem initialVideoId mostra a lista', () => {
    render(<NewTestClient {...base} />)
    expect(screen.queryByTestId('wizard')).toBeNull()
    expect(screen.getByText('Vídeo u1')).toBeTruthy()
  })
  it('aviso aparece na região status', () => {
    render(<NewTestClient {...base} aviso="Não encontramos esse vídeo." />)
    expect(screen.getByRole('status').textContent).toContain('Não encontramos esse vídeo.')
  })
  it('thumb hostil não vira img e título hostil vira texto', () => {
    const { container } = render(
      <NewTestClient
        {...base}
        initialVideoId="u1"
        competitorContext={{ changeType: 'title', competitorThumb: 'https://evil.com/a.jpg', competitorTitle: '<b>x</b>' }}
      />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('<b>x</b>')).toBeTruthy()
  })
  it('thumb do YouTube renderiza img', () => {
    const { container } = render(
      <NewTestClient {...base} initialVideoId="u1" competitorContext={{ competitorThumb: 'https://i.ytimg.com/vi/a/hq.jpg' }} />,
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://i.ytimg.com/vi/a/hq.jpg')
  })
})
