// @vitest-environment jsdom
// Manutenção M5, conserto r4 (27/10): D1 details dentro de p, D2 alvo do "ver", D3 ponto final.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { render } from '@testing-library/react'
import { ArquivoScreen } from '@/app/cms/(authed)/youtube/competitors/_arquivo/arquivo-screen'
import { montarPagina } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import { paginaVazia, mesCom } from '../youtube/observatorio/fixtures/arquivo-pagina'

const liga = { arquivoLigado: true }
const css = readFileSync('src/app/cms/(authed)/youtube/competitors/_arquivo/arquivo.css', 'utf8')

describe('D1: nenhum <details> dentro de <p>', () => {
  it.each([10, 20])('mês fechado há %i dias', (d) => {
    const m = montarPagina(paginaVazia({ meses: [mesCom({ mes: 'fechado_ha', dias: d })] }), liga)
    const { container } = render(<ArquivoScreen modelo={m} bloco={{ ok: false }} acesso="administra" />)
    const dets = container.querySelectorAll('details')
    expect(container.querySelectorAll('.arq-info').length).toBeGreaterThan(0)
    dets.forEach(el => expect(el.closest('p')).toBeNull())
  })
})
describe('D2: "ver" da lista Problemas', () => {
  it('tem estilo de link e alvo de 44 px em toque', () => {
    expect(css).toMatch(/\.arq-prob a[^{]*\{[^}]*text-decoration:underline/)
    expect(css).toMatch(/@media \(pointer:coarse\)\{[^}]*\.arq-prob a\{[^}]*min-height:44px/)
  })
})
describe('D3: "Saiu das telas" termina em ponto', () => {
  it.each([2, 15])('destacado há %i dias', (d) => {
    const m = montarPagina(paginaVazia({ meses: [mesCom({ destacadoHa: d })] }), liga)
    const { container } = render(<ArquivoScreen modelo={m} bloco={{ ok: false }} acesso="administra" />)
    const fr = [...container.querySelectorAll('.arq-mes .arq-fr')].map(e => e.firstChild?.textContent ?? '').filter(t => t.startsWith('Saiu das telas'))
    expect(fr.length).toBeGreaterThan(0)
    fr.forEach(t => expect(t).toMatch(/\.$/))
  })
})
