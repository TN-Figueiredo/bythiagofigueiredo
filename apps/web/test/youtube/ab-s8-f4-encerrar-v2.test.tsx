// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { OpcaoEncerrar, ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { AbEndTestDialog, type AbEndTestDialogProps } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-end-test-dialog'

const AVISO = 'Encerrar à mão tira o teste da decisão: o resultado não será calculado.'
const opcoes = [
  { id: 'v1', rotulo: 'A (original)', isOriginal: true, titulo: 'Título original', miniatura: null },
  { id: 'v2', rotulo: 'B', isOriginal: false, titulo: 'Título de B', miniatura: null },
]

function props(over: Partial<AbEndTestDialogProps> = {}): AbEndTestDialogProps {
  return {
    aberto: true, onFechar: vi.fn(), testeNome: 'Teste', noArAgora: { rotulo: 'A', desde: '' }, opcoes,
    originalBaixaResolucao: false, podeDeixarVariante: true, seqVisto: 1,
    encerrar: vi.fn<(o: OpcaoEncerrar) => Promise<ResultadoAcaoSaida>>(), ...over,
  }
}

afterEach(cleanup)

describe('T12 T8: aviso v2 no Encerrar', () => {
  it('com regraV2 mostra o aviso .etd-msg.warn antes do rodapé', () => {
    const { container } = render(<AbEndTestDialog {...props({ regraV2: true })} />)
    const aviso = screen.getByText(AVISO).closest('.etd-msg')
    expect(aviso?.classList.contains('warn')).toBe(true)
    const corpo = container.querySelector('.etd-b')!
    expect(corpo.contains(aviso)).toBe(true)
    expect(corpo.nextElementSibling?.classList.contains('etd-f')).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy()
  })
  it('sem a prop (v1) não mostra', () => {
    render(<AbEndTestDialog {...props()} />)
    expect(screen.queryByText(AVISO)).toBeNull()
    expect(screen.getByRole('button', { name: 'Encerrar' })).toBeTruthy()
  })
})
