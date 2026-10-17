// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Lancamentos } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/lancamentos'
import type { ModeloDeLancamentos, VideoDeLancamento } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/lancamentos-model'

afterEach(cleanup)

const video = (i: number, razao: number): VideoDeLancamento => ({
  id: `v${i}`, ordem: i + 1, titulo: `Título ${i}`, legenda: `publicado há ${i + 8} dias · 1000 views`, faixa: 'perto', faixaNome: 'perto do normal',
  razao: `${razao}× no dia 7`, ultima: { dia: 7, razao }, curva: [{ idadeDias: 1, views: 100 }, { idadeDias: 7, views: 300 }], passou: null,
  frase: { negrito: `“Título ${i}” está perto do normal:`, resto: ` ${razao}× o normal do canal no dia 7.` },
})
const modelo: ModeloDeLancamentos = {
  tipo: 'curvas', soShorts: false, frase: null, temNormal: true, temCasaSemPonto: false, melhorN: null,
  escala: { ymax: 400, rotulos: ['0', '200', '400'] },
  normal: [1, 2, 3, 5, 7, 14, 21, 30].map(a => ({ idadeDias: a, valor: 100 + a, n: 5 })),
  videos: [video(0, 1.1), video(1, 0.9)],
}

describe('Lançamentos: escolher outro vídeo', () => {
  it('troca a frase e o botão marcado, sem ir à rede', () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    render(<Lancamentos modelo={modelo} horas={null} />)
    expect(document.querySelector('[data-frase-do-bloco]')?.textContent).toContain('“Título 0” está perto do normal')
    const botoes = screen.getAllByRole('button', { pressed: false })
    fireEvent.click(botoes.find(b => b.textContent?.includes('Título 1'))!)
    expect(document.querySelector('[data-frase-do-bloco]')?.textContent).toContain('“Título 1” está perto do normal: 0.9× o normal')
    expect(screen.getByRole('button', { pressed: true }).textContent).toContain('Título 1')
    expect(f).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
