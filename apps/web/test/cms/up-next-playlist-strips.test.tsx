// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { PlaylistStrip } from '../../src/app/cms/(authed)/pipeline/_components/up-next-playlist-strips'

function makePlaylist(overrides: Partial<PlaylistStrip> = {}): PlaylistStrip {
  return {
    id: 'pl-1',
    name: 'JS Basics',
    items: [
      { stage: null, isPublished: true },
      { stage: null, isPublished: true },
      { stage: 'roteiro', isPublished: false },
      { stage: null, isPublished: false },
    ],
    nextItemTitle: 'Closures',
    nextItemStage: 'rascunho',
    nearCompletion: false,
    ...overrides,
  }
}

describe('UpNextPlaylistStrips', () => {
  it('returns null when playlists is empty', async () => {
    const { UpNextPlaylistStrips } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/up-next-playlist-strips'
    )
    const { container } = render(<UpNextPlaylistStrips playlists={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders section header', async () => {
    const { UpNextPlaylistStrips } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/up-next-playlist-strips'
    )
    render(<UpNextPlaylistStrips playlists={[makePlaylist()]} />)
    expect(screen.getByText('Playlists em Andamento')).toBeTruthy()
  })

  it('renders playlist names', async () => {
    const { UpNextPlaylistStrips } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/up-next-playlist-strips'
    )
    render(
      <UpNextPlaylistStrips
        playlists={[
          makePlaylist({ id: 'pl-1', name: 'JS Basics' }),
          makePlaylist({ id: 'pl-2', name: 'CSS Mastery' }),
        ]}
      />,
    )
    expect(screen.getByText('JS Basics')).toBeTruthy()
    expect(screen.getByText('CSS Mastery')).toBeTruthy()
  })

  it('renders correct number of dots per playlist', async () => {
    const { UpNextPlaylistStrips } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/up-next-playlist-strips'
    )
    const items = [
      { stage: null, isPublished: true },
      { stage: null, isPublished: true },
      { stage: 'roteiro', isPublished: false },
      { stage: null, isPublished: false },
      { stage: 'idea', isPublished: false },
    ]
    render(
      <UpNextPlaylistStrips playlists={[makePlaylist({ items })]} />,
    )
    const dotsContainer = screen.getByTestId('dots-pl-1')
    const dots = dotsContainer.querySelectorAll('span')
    expect(dots.length).toBe(5)
  })

  it('uses filled style for published items', async () => {
    const { UpNextPlaylistStrips } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/up-next-playlist-strips'
    )
    const items = [
      { stage: null, isPublished: true },
      { stage: null, isPublished: false },
    ]
    render(
      <UpNextPlaylistStrips playlists={[makePlaylist({ items })]} />,
    )
    const dotsContainer = screen.getByTestId('dots-pl-1')
    const dots = dotsContainer.querySelectorAll('span')
    expect(dots[0].getAttribute('data-dot')).toBe('filled')
    expect(dots[1].getAttribute('data-dot')).toBe('hollow')
  })

  it('uses filled yellow style for in-progress items', async () => {
    const { UpNextPlaylistStrips } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/up-next-playlist-strips'
    )
    const items = [
      { stage: 'roteiro', isPublished: false },
      { stage: 'idea', isPublished: false },
    ]
    render(
      <UpNextPlaylistStrips playlists={[makePlaylist({ items })]} />,
    )
    const dotsContainer = screen.getByTestId('dots-pl-1')
    const dots = dotsContainer.querySelectorAll('span')
    // roteiro = in-progress → filled
    expect(dots[0].getAttribute('data-dot')).toBe('filled')
    // idea = not started → hollow
    expect(dots[1].getAttribute('data-dot')).toBe('hollow')
  })

  it('shows next item title and stage', async () => {
    const { UpNextPlaylistStrips } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/up-next-playlist-strips'
    )
    render(
      <UpNextPlaylistStrips
        playlists={[
          makePlaylist({ nextItemTitle: 'Closures', nextItemStage: 'rascunho' }),
        ]}
      />,
    )
    expect(screen.getByText(/Closures/)).toBeTruthy()
    expect(screen.getByText(/rascunho/)).toBeTruthy()
  })

  it('shows "próximo a concluir!" for nearCompletion playlists', async () => {
    const { UpNextPlaylistStrips } = await import(
      '../../src/app/cms/(authed)/pipeline/_components/up-next-playlist-strips'
    )
    render(
      <UpNextPlaylistStrips
        playlists={[
          makePlaylist({ nearCompletion: true }),
          makePlaylist({ id: 'pl-2', name: 'React Pro', nearCompletion: false }),
        ]}
      />,
    )
    const badges = screen.getAllByText('— próximo a concluir!')
    expect(badges.length).toBe(1)
  })
})
