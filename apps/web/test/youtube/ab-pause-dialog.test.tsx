import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers'),
    Lock: icon('Lock'), Plus: icon('Plus'), Trash2: icon('Trash2'), Sparkles: icon('Sparkles'),
    CheckCircle: icon('CheckCircle'), Play: icon('Play'), ChevronDown: icon('ChevronDown'),
    ChevronRight: icon('ChevronRight'), ArrowLeft: icon('ArrowLeft'), Copy: icon('Copy'),
    Download: icon('Download'), Pause: icon('Pause'), Square: icon('Square'),
    LayoutGrid: icon('LayoutGrid'), Search: icon('Search'), ListVideo: icon('ListVideo'),
    Smartphone: icon('Smartphone'), Trophy: icon('Trophy'), TrendingUp: icon('TrendingUp'),
    TrendingDown: icon('TrendingDown'), X: icon('X'),
  }
})

vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  pauseAbTest: vi.fn().mockResolvedValue(undefined),
}))

const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

// Mock YtPortal to render children directly (no createPortal in test env)
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock useModalFocusTrap (no-op in tests)
vi.mock('@/app/cms/(authed)/_shared/editor/use-modal-focus-trap', () => ({
  useModalFocusTrap: vi.fn(),
}))

import { AbPauseDialog } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-pause-dialog'

const mockTest = {
  id: 'test-123',
  config: { confidence_threshold: 0.95 },
  variants: [
    { id: 'v1', label: 'A', is_original: true, blob_url: null },
    { id: 'v2', label: 'B', is_original: false, blob_url: 'https://example.com/thumb.jpg' },
  ],
} as any

describe('AbPauseDialog', () => {
  it('renders with "Pausar teste" title', () => {
    render(<AbPauseDialog flag="thumbnail" pausar={vi.fn().mockResolvedValue({ ok: true, resultado: 'feito', campos: {} })} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Pausar teste' })).toBeTruthy()
  })

  it('shows explanation text about restoring original thumbnail', () => {
    render(<AbPauseDialog flag="thumbnail" pausar={vi.fn().mockResolvedValue({ ok: true, resultado: 'feito', campos: {} })} onClose={vi.fn()} />)
    expect(screen.getByText(/restaurar a miniatura original/)).toBeTruthy()
    expect(screen.getByText(/dados coletados ficam preservados/)).toBeTruthy()
    expect(screen.getByText(/retomar a qualquer momento/)).toBeTruthy()
  })

  it('cancel button calls onClose', () => {
    const onClose = vi.fn()
    render(<AbPauseDialog flag="thumbnail" pausar={vi.fn().mockResolvedValue({ ok: true, resultado: 'feito', campos: {} })} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Pausar teste button renders', () => {
    render(<AbPauseDialog flag="thumbnail" pausar={vi.fn().mockResolvedValue({ ok: true, resultado: 'feito', campos: {} })} onClose={vi.fn()} />)
    const buttons = screen.getAllByText('Pausar teste')
    const pauseButton = buttons.find((el) => el.tagName === 'BUTTON')
    expect(pauseButton).toBeTruthy()
  })

  it('clicking backdrop calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(<AbPauseDialog flag="thumbnail" pausar={vi.fn().mockResolvedValue({ ok: true, resultado: 'feito', campos: {} })} onClose={onClose} />)
    const backdrop = container.querySelector('[aria-hidden="true"]')!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('D4: forbidden cru vira frase em pt-BR', async () => {
    const pausar = vi.fn().mockResolvedValue({ ok: false, resultado: 'sem_permissao', error: 'forbidden' })
    render(<AbPauseDialog flag="thumbnail" pausar={pausar} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pausar teste' }))
    expect(await screen.findByText('Você não tem permissão para pausar este teste.')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/forbidden/)
  })

  it('R4: sessão expirada (a ação rejeita e a página redireciona) -> frase e link ao login com next', async () => {
    const pausar = vi.fn().mockRejectedValue(new Error('An unexpected response was received from the server.'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ type: 'opaqueredirect', status: 0 }))
    window.history.pushState({}, '', '/cms/youtube/ab-lab/abc?x=1')
    render(<AbPauseDialog flag="thumbnail" pausar={pausar} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pausar teste' }))
    expect(await screen.findByText('Sua sessão expirou. Entre de novo para pausar o teste.')).toBeTruthy()
    expect(screen.queryByText(/Sem resposta/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Entrar de novo' }).getAttribute('href')).toBe(`/cms/login?next=${encodeURIComponent('/cms/youtube/ab-lab/abc?x=1')}`)
    expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(2)
    vi.unstubAllGlobals()
  })

  it('R4: mudou -> frase no lugar do corpo, Recarregar primário e Fechar', async () => {
    const pausar = vi.fn().mockResolvedValue({ ok: false, resultado: 'mudou', error: 'x' })
    render(<AbPauseDialog flag="thumbnail" pausar={pausar} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pausar teste' }))
    expect(await screen.findByText('O teste mudou em outra aba. Reabra para decidir.')).toBeTruthy()
    expect(screen.queryByText(/restaurar a miniatura original/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Fechar' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull()
  })

  it('T18 D-1: mudou com o diálogo já fechado -> aviso de página e refresh', async () => {
    let resolver!: (r: unknown) => void
    const pausar = vi.fn().mockReturnValue(new Promise(res => { resolver = res }))
    const onAviso = vi.fn()
    const { unmount } = render(<AbPauseDialog flag="thumbnail" pausar={pausar} onClose={vi.fn()} onAviso={onAviso} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pausar teste' }))
    unmount()
    await act(async () => { resolver({ ok: false, resultado: 'mudou', error: 'x' }) })
    expect(onAviso).toHaveBeenCalledWith('O teste mudou em outra aba antes de pausar. Nada foi alterado.')
    expect(refresh).toHaveBeenCalledTimes(1)
  })
  it('P4b T9: unauthenticated com o diálogo já fechado -> aviso de página e refresh', async () => {
    refresh.mockClear()
    let resolver!: (r: unknown) => void
    const pausar = vi.fn().mockReturnValue(new Promise(res => { resolver = res }))
    const onAviso = vi.fn()
    const { unmount } = render(<AbPauseDialog flag="thumbnail" pausar={pausar} onClose={vi.fn()} onAviso={onAviso} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pausar teste' }))
    unmount()
    await act(async () => { resolver({ ok: false, resultado: 'sem_permissao', error: 'unauthenticated' }) })
    expect(onAviso).toHaveBeenCalledWith('Sua sessão expirou e o teste não foi pausado. Entre de novo e pause outra vez.', { fixo: true })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('P4b T9: a action lança com o diálogo já fechado -> aviso de página e refresh', async () => {
    refresh.mockClear()
    let rejeitar!: (e: unknown) => void
    const pausar = vi.fn().mockReturnValue(new Promise((_, rej) => { rejeitar = rej }))
    const onAviso = vi.fn()
    const { unmount } = render(<AbPauseDialog flag="thumbnail" pausar={pausar} onClose={vi.fn()} onAviso={onAviso} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pausar teste' }))
    unmount()
    await act(async () => { rejeitar(new Error('rede')) })
    await waitFor(() => expect(onAviso).toHaveBeenCalledTimes(1))
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
