import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SecaoConcluidos } from '@/app/cms/(authed)/youtube/ab-lab/_components/pagina/secao-concluidos'
import type { LinhaConcluida } from '@/lib/youtube/ab-lab-pagina/tipos'

vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/learnings-panel', () => ({ LearningsPanel: () => null }))
afterEach(cleanup)

const TITULO = 'T'.repeat(100)
const linha: LinhaConcluida = {
  chave: 'k1', origem: 'lab', testId: 't1', ytId: 'yt1', titulo: TITULO, miniaturaUrl: null, tipo: 'Título',
  resultado: 'B venceu', apoio: 'no ar desde 26/10', acao: null, ordem: '2026-10-26T00:00:00Z',
}

describe('Concluídos: título longo (M7 T14 Gio M3)', () => {
  it('mostra o título inteiro no title e libera 4 linhas a 390 (sem cortar em 2)', () => {
    const { container } = render(<SecaoConcluidos concluidos={{ linhas: [linha], total: 1, regua: null }} temHistorico learnings={null} channelLearnings={null} onAbrirPainel={() => undefined} />)
    const b = container.querySelector('[data-concluido="k1"] b')!
    expect(b.getAttribute('title')).toBe(TITULO)
    expect(b.className).toContain('max-sm:line-clamp-4')
  })
})
