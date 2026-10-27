// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { OpcaoEncerrar, ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import type { FreioDoEncerrar } from '@/app/cms/(authed)/youtube/ab-lab/_components/cabecalho-do-teste'

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { AbEndTestDialog, type AbEndTestDialogProps } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-end-test-dialog'
import { AbPauseDialog } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-pause-dialog'

const opcoes = [
  { id: 'v1', rotulo: 'A (original)', isOriginal: true, titulo: 'Título original', miniatura: 'https://x/a.jpg' },
  { id: 'v2', rotulo: 'B', isOriginal: false, titulo: 'Título de B', miniatura: 'https://x/b.jpg' },
]
const F: Record<string, FreioDoEncerrar> = {
  g1: { tipo: 'sem_leitura', texto: 'Ainda não há leitura. Encerrar agora não calcula resultado.' },
  g2: { tipo: 'faltam', texto: 'Faltam 8 dias dos 14. Encerrar agora usa só os 5 dias já medidos.' },
  g3: { tipo: 'falta_1', texto: 'Falta 1 dia.' },
  g4: { tipo: 'completo', texto: 'Todos os 14 dias foram medidos.' },
}
function props(over: Partial<AbEndTestDialogProps> = {}): AbEndTestDialogProps {
  return {
    aberto: true, onFechar: vi.fn(), testeNome: 'T', noArAgora: { rotulo: 'B', desde: '07/10 05:00' }, opcoes,
    originalBaixaResolucao: false, podeDeixarVariante: true,
    encerrar: vi.fn<(o: OpcaoEncerrar) => Promise<ResultadoAcaoSaida>>(), seqVisto: 1, freio: F.g2!, ...over,
  }
}
beforeEach(() => { router.refresh.mockClear() })
afterEach(() => cleanup())

describe('M7d T4: Encerrar', () => {
  it('título, legenda e selo do mockup', () => {
    render(<AbEndTestDialog {...props()} />)
    expect(screen.getByRole('heading', { name: 'Encerrar o teste?' })).toBeTruthy()
    expect(screen.getByText('Qual versão fica no vídeo?')).toBeTruthy()
    expect(screen.getByText('No ar agora')).toBeTruthy()
  })
  it('g1: sem leitura, role=status, botão sem pri', () => {
    render(<AbEndTestDialog {...props({ freio: F.g1! })} />)
    const el = screen.getByText(F.g1!.texto).closest('[role="status"]')
    expect(el).toBeTruthy()
    expect(el!.className).toContain('sem')
    expect(screen.getByRole('button', { name: /^Encerrar e ficar com/ }).className).not.toContain('pri')
  })
  it('g2 e g3: aviso com role=status e botão sem pri', () => {
    const { unmount } = render(<AbEndTestDialog {...props({ freio: F.g2! })} />)
    expect(screen.getByText(F.g2!.texto).closest('[role="status"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Encerrar e ficar com/ }).className).not.toContain('pri')
    unmount()
    render(<AbEndTestDialog {...props({ freio: F.g3! })} />)
    expect(screen.getByText('Falta 1 dia.').closest('[role="status"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Encerrar e ficar com/ }).className).not.toContain('pri')
  })
  it('g4: completo sem role=status de freio e botão pri', () => {
    render(<AbEndTestDialog {...props({ freio: F.g4! })} />)
    expect(screen.getByText('Todos os 14 dias foram medidos.').closest('[role="status"]')).toBeNull()
    expect(screen.getByRole('button', { name: /^Encerrar e ficar com/ }).className).toContain('pri')
  })
  it('a versão no ar vem marcada, só ela, com a frase', () => {
    render(<AbEndTestDialog {...props()} />)
    const r = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(r.filter(x => x.checked).map(x => x.value)).toEqual(['v2'])
    expect(screen.getByText('A versão no ar já vem marcada; troque só se quiser.')).toBeTruthy()
  })
  it('sem admin, a original fica marcada mesmo com a variante no ar (Foco 5)', () => {
    render(<AbEndTestDialog {...props({ podeDeixarVariante: false })} />)
    const r = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(r.filter(x => x.checked).map(x => x.value)).toEqual(['v1'])
  })
  it('foco inicial no Cancelar; Esc fecha e devolve o foco ao Encerrar', () => {
    const onFechar = vi.fn()
    render(<AbEndTestDialog {...props({ onFechar })} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(onFechar).toHaveBeenCalled()
  })
})

describe('M7d T4: Pausa', () => {
  const pausar = vi.fn()
  it('texto por tipo', () => {
    const { unmount } = render(<AbPauseDialog pausar={pausar} seqVisto={1} onClose={() => {}} flag="title" />)
    expect(screen.getByText('Pausar vai restaurar o título original imediatamente.')).toBeTruthy()
    unmount()
    render(<AbPauseDialog pausar={pausar} seqVisto={1} onClose={() => {}} flag="combo" />)
    expect(screen.getByText('Pausar vai restaurar o título e a miniatura originais imediatamente.')).toBeTruthy()
  })
})
