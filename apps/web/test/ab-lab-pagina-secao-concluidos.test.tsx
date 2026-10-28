// @vitest-environment jsdom
// Linha de Concluídos (M7b T13): com painel a linha é um botão que o abre; sem painel não é clicável; dois selos; sem texto de mockup.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SecaoConcluidos } from '@/app/cms/(authed)/youtube/ab-lab/_components/pagina/secao-concluidos'
import type { LinhaConcluida } from '@/lib/youtube/ab-lab-pagina/tipos'
import type { PainelEscolha } from '@/lib/youtube/ab-lab-pagina/painel-escolha'

vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/learnings-panel', () => ({ LearningsPanel: () => null }))
afterEach(cleanup)

const painel = { modo: 'escolha', testId: 't1' } as unknown as PainelEscolha
const base: LinhaConcluida = {
  chave: 'lab:t1', origem: 'lab', testId: 't1', ytId: 'yt1', titulo: 'Vídeo X', miniaturaUrl: null, tipo: 'Título', resultado: 'B venceu', apoio: '',
  painel, selos: [{ texto: 'Teste: sugeriu B', tom: 'neutro', icone: 'dot' }, { texto: 'B no ar desde 22/10 · escolhida por você', tom: 'esc', icone: 'dot' }] as unknown as LinhaConcluida['selos'],
  concluidoEm: '21/10', ordem: '2026-10-21T00:00:00Z',
}
const render1 = (l: LinhaConcluida, onAbrir = vi.fn()) => {
  const r = render(<SecaoConcluidos concluidos={{ linhas: [l], total: 1, regua: null }} temHistorico learnings={null} channelLearnings={null} onAbrirPainel={onAbrir} />)
  return { ...r, onAbrir }
}

describe('SecaoConcluidos: linha que abre o painel', () => {
  it('com painel: botão, clique abre o painel com o elemento de origem; mostra os 2 selos e a dica', () => {
    const { container, onAbrir } = render1(base)
    const b = container.querySelector('button[data-concluido="lab:t1"]') as HTMLElement
    expect(b).toBeTruthy()
    fireEvent.click(b)
    expect(onAbrir).toHaveBeenCalledWith(painel, b)
    expect(screen.getByText('Teste: sugeriu B')).toBeTruthy()
    expect(screen.getByText(/escolhida por você/)).toBeTruthy()
    expect(screen.getByText('Toque numa linha para abrir o painel do teste.')).toBeTruthy()
  })
  it('sem painel (Studio ou fora da regra): não é botão nem clicável, sem dica', () => {
    const { container, onAbrir } = render1({ ...base, origem: 'studio', testId: null, painel: null, selos: null, apoio: 'você contou do Studio' })
    expect(container.querySelector('button[data-concluido]')).toBeNull()
    fireEvent.click(container.querySelector('[data-concluido]') as HTMLElement)
    expect(onAbrir).not.toHaveBeenCalled()
    expect(screen.queryByText(/Toque numa linha/)).toBeNull()
  })
})
