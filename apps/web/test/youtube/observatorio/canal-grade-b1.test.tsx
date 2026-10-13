// @vitest-environment jsdom
// A4, revisão de UX dos ajustes finais, B1: Voltar do Histórico a 480 px ou menos com o último vídeo visto além do 24º cartão. O cálculo de quantos
// lotes de 24 incluem o cartão é puro (`lotesParaMostrar`); o aviso dos antigos some junto do botão dele (`cv-pag-espera` também no parágrafo).
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { lotesParaMostrar } from '@/app/cms/(authed)/youtube/competitors/_canal/grade-paginacao'
import { CarregarMais } from '@/app/cms/(authed)/youtube/competitors/_canal/carregar-mais'

afterEach(() => cleanup())

describe('lotesParaMostrar: ceil((idx + 1) / 24)', () => {
  it('0 e 23 cabem no primeiro lote; 24 abre o segundo', () => {
    expect(lotesParaMostrar(0, 100)).toBe(1)
    expect(lotesParaMostrar(23, 100)).toBe(1)
    expect(lotesParaMostrar(24, 100)).toBe(2)
  })
  it('47 fecha o segundo lote; 48 abre o terceiro', () => {
    expect(lotesParaMostrar(47, 100)).toBe(2)
    expect(lotesParaMostrar(48, 100)).toBe(3)
  })
  it('o vídeo 30 (índice 29) pede dois lotes', () => { expect(lotesParaMostrar(29, 58)).toBe(2) })
  it('o último cartão da lista é aceito; além do fim, não (null, sem inventar lote)', () => {
    expect(lotesParaMostrar(57, 58)).toBe(3)
    expect(lotesParaMostrar(58, 58)).toBeNull()
    expect(lotesParaMostrar(500, 58)).toBeNull()
  })
  it('cartão inexistente (índice -1 do indexOf, NaN, fração) e lista vazia: null', () => {
    expect(lotesParaMostrar(-1, 58)).toBeNull()
    expect(lotesParaMostrar(Number.NaN, 58)).toBeNull()
    expect(lotesParaMostrar(2.5, 58)).toBeNull()
    expect(lotesParaMostrar(0, 0)).toBeNull()
  })
})

describe('aviso dos antigos junto do botão', () => {
  const mais = { mostrando: 0, total: 40, frase: 'Mais 40 vídeos antigos.', botao: 'Carregar mais 40 vídeos', soAntigos: 'Nenhum dos vídeos acompanhados está neste filtro.' }
  it('com o botão à espera da grade, o parágrafo leva a mesma marca que o esconde a 480 px ou menos', () => {
    const { container } = render(<CarregarMais mais={mais} onMais={() => {}} espera />)
    expect(container.querySelector('p.cv-soantigos')!.classList.contains('cv-pag-espera')).toBe(true)
    expect(container.querySelector('.cv-more')!.classList.contains('cv-pag-espera')).toBe(true)
  })
  it('sem espera, o parágrafo fica sem a marca', () => {
    const { container } = render(<CarregarMais mais={mais} onMais={() => {}} />)
    expect(container.querySelector('p.cv-soantigos')!.classList.contains('cv-pag-espera')).toBe(false)
  })
  it('o CSS esconde o parágrafo e o bloco com a mesma marca, só dentro da media query de 480 px', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_canal/canal.css'), 'utf8')
    const bloco = css.split('@media (max-width:480px){').find(b => b.includes('data-pag-oculto'))
    expect(bloco).toBeDefined()
    const dentro = bloco!.slice(0, bloco!.indexOf('\n}'))
    expect(dentro).toMatch(/\.cv-soantigos\.cv-pag-espera[^{]*\{display:none\}/)
    expect(dentro).toMatch(/\.cv-more\.cv-pag-espera[^{]*\{display:none\}/)
  })
})
