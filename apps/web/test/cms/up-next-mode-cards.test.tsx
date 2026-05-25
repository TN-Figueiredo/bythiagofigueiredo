// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/pipeline/gem-design', () => ({
  getFormatIcon: vi.fn((f: string) => ({ icon: `[${f}]`, label: f })),
  getPriorityConfig: vi.fn((p: number) => ({ accent: '#888', label: `P${p}` })),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('lucide-react', () => ({
  Pencil: (props: Record<string, unknown>) => <svg data-testid="icon-pencil" {...props} />,
  Video: (props: Record<string, unknown>) => <svg data-testid="icon-video" {...props} />,
  Sparkles: (props: Record<string, unknown>) => <svg data-testid="icon-sparkles" {...props} />,
}))

const COMPONENT_PATH = '../../src/app/cms/(authed)/pipeline/_components/up-next-mode-cards'

function makeModeItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'item-1',
    code: 'V001',
    title_pt: 'Introducao ao JavaScript',
    format: 'video',
    stage: 'roteiro',
    priority: 3,
    playlistName: null as string | null,
    playlistProgress: null as string | null,
    ...overrides,
  }
}

describe('UpNextModeCards', () => {
  it('renders 3 mode cards even when all modes are null', async () => {
    const { UpNextModeCards } = await import(COMPONENT_PATH)
    render(<UpNextModeCards escrever={null} gravar={null} posProducao={null} />)

    expect(screen.getByText('Escrever')).toBeTruthy()
    expect(screen.getByText('Gravar')).toBeTruthy()
    expect(screen.getByText('Pós-Produção')).toBeTruthy()
  })

  it('shows gap observation messages when modes are null', async () => {
    const { UpNextModeCards } = await import(COMPONENT_PATH)
    render(<UpNextModeCards escrever={null} gravar={null} posProducao={null} />)

    expect(
      screen.getByText(/Nenhum conteúdo em escrita/),
    ).toBeTruthy()
    expect(
      screen.getByText(/Nenhum roteiro pronto para gravar/),
    ).toBeTruthy()
    expect(
      screen.getByText(/Nenhuma gravação pendente de edição/),
    ).toBeTruthy()
  })

  it('renders item title when mode has an item', async () => {
    const { UpNextModeCards } = await import(COMPONENT_PATH)
    const item = makeModeItem({ title_pt: 'Aprenda React Hooks' })
    render(<UpNextModeCards escrever={item} gravar={null} posProducao={null} />)

    expect(screen.getByText('Aprenda React Hooks')).toBeTruthy()
  })

  it('falls back to code when title_pt is null', async () => {
    const { UpNextModeCards } = await import(COMPONENT_PATH)
    const item = makeModeItem({ title_pt: null, code: 'V042' })
    render(<UpNextModeCards escrever={item} gravar={null} posProducao={null} />)

    expect(screen.getByText('V042')).toBeTruthy()
  })

  it('shows playlist context when playlistName is provided', async () => {
    const { UpNextModeCards } = await import(COMPONENT_PATH)
    const item = makeModeItem({
      playlistName: 'JS Basics',
      playlistProgress: '8/10',
    })
    render(<UpNextModeCards escrever={item} gravar={null} posProducao={null} />)

    expect(screen.getByText('JS Basics 8/10')).toBeTruthy()
  })

  it('shows correct action button labels for each mode', async () => {
    const { UpNextModeCards } = await import(COMPONENT_PATH)
    const writeItem = makeModeItem({ id: 'w1' })
    const recordItem = makeModeItem({ id: 'r1', stage: 'gravacao' })
    const postItem = makeModeItem({ id: 'p1', stage: 'edicao' })

    render(
      <UpNextModeCards
        escrever={writeItem}
        gravar={recordItem}
        posProducao={postItem}
      />,
    )

    expect(screen.getByText('Continuar')).toBeTruthy()
    expect(screen.getByText('Ver roteiro')).toBeTruthy()
    expect(screen.getByText('Revisar')).toBeTruthy()
  })

  it('action buttons link to correct pipeline item URLs', async () => {
    const { UpNextModeCards } = await import(COMPONENT_PATH)
    const writeItem = makeModeItem({ id: 'abc-111' })
    const recordItem = makeModeItem({ id: 'def-222', stage: 'gravacao' })
    const postItem = makeModeItem({ id: 'ghi-333', stage: 'edicao' })

    render(
      <UpNextModeCards
        escrever={writeItem}
        gravar={recordItem}
        posProducao={postItem}
      />,
    )

    const continuar = screen.getByText('Continuar').closest('a')
    expect(continuar?.getAttribute('href')).toBe('/cms/pipeline/items/abc-111')

    const verRoteiro = screen.getByText('Ver roteiro').closest('a')
    expect(verRoteiro?.getAttribute('href')).toBe('/cms/pipeline/items/def-222')

    const revisar = screen.getByText('Revisar').closest('a')
    expect(revisar?.getAttribute('href')).toBe('/cms/pipeline/items/ghi-333')
  })

  it('shows stage badge for the current stage', async () => {
    const { UpNextModeCards } = await import(COMPONENT_PATH)
    const item = makeModeItem({ stage: 'roteiro' })
    render(<UpNextModeCards escrever={item} gravar={null} posProducao={null} />)

    expect(screen.getByText('roteiro')).toBeTruthy()
  })

  it('renders format icon from getFormatIcon', async () => {
    const { UpNextModeCards } = await import(COMPONENT_PATH)
    const item = makeModeItem({ format: 'video' })
    render(<UpNextModeCards escrever={item} gravar={null} posProducao={null} />)

    expect(screen.getByText('[video]')).toBeTruthy()
  })

  it('does not show playlist text when playlistName is null', async () => {
    const { UpNextModeCards } = await import(COMPONENT_PATH)
    const item = makeModeItem({ playlistName: null, playlistProgress: null })
    render(<UpNextModeCards escrever={item} gravar={null} posProducao={null} />)

    // Should not find any playlist-related text
    expect(screen.queryByText(/JS Basics/)).toBeNull()
  })
})
