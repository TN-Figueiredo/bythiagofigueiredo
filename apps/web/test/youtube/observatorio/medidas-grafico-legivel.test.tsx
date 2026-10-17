// @vitest-environment jsdom
// A5 E5a, Tarefa 14c: <GraficoLegivel> (setas, Início, Fim, Esc, botões, linha de leitura, tabela) e graficos.css.
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { GraficoLegivel } from '@/app/cms/(authed)/youtube/competitors/_chrome/medidas/grafico-legivel'

const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_chrome/medidas')
const pontos = [
  { rotulo: 'seg 12/10', fala: 'Segunda 12/10: 100 views ganhas.' },
  { rotulo: 'ter 13/10', fala: 'Terça 13/10: nenhuma view ganha (zero medido).' },
  { rotulo: 'qua 14/10', fala: 'Quarta 14/10: sem registro neste dia.' },
]
const svg = (
  <svg viewBox="0 0 30 10">
    {pontos.map((_, i) => <rect key={i} data-i={i} data-testid={'alvo' + i} x={i * 10} width={10} height={10} />)}
  </svg>
)
const montar = () => render(<GraficoLegivel titulo="Views por dia" pontos={pontos} legenda={<span>legenda do exemplo</span>}>{svg}</GraficoLegivel>)
const grupo = () => screen.getByRole('group', { name: /Views por dia: 3 pontos/ })
const leitura = () => screen.getByRole('status').textContent
afterEach(cleanup)

describe('E5a T14c: GraficoLegivel', () => {
  it('o gráfico anda com as setas, vai ao primeiro e ao último com Início e Fim, e a linha de leitura muda', () => {
    montar()
    const g = grupo()
    expect(g.getAttribute('tabindex')).toBe('0')
    expect(leitura()).toMatch(/mouse|setas/)
    fireEvent.keyDown(g, { key: 'ArrowRight' })
    expect(leitura()).toBe(pontos[0]!.fala)
    fireEvent.keyDown(g, { key: 'ArrowRight' })
    expect(leitura()).toBe(pontos[1]!.fala)
    fireEvent.keyDown(g, { key: 'End' })
    expect(leitura()).toBe(pontos[2]!.fala)
    fireEvent.keyDown(g, { key: 'ArrowRight' })
    expect(leitura()).toBe(pontos[2]!.fala)
    fireEvent.keyDown(g, { key: 'Home' })
    expect(leitura()).toBe(pontos[0]!.fala)
    fireEvent.keyDown(g, { key: 'ArrowLeft' })
    expect(leitura()).toBe(pontos[0]!.fala)
    fireEvent.keyDown(g, { key: 'Escape' })
    expect(leitura()).toMatch(/mouse|setas/)
  })
  it('a seta para a esquerda sem ponto escolhido vai ao último', () => {
    montar()
    fireEvent.keyDown(grupo(), { key: 'ArrowLeft' })
    expect(leitura()).toBe(pontos[2]!.fala)
  })
  it('os botões andam, têm 44 px de alvo no CSS e ficam aria-disabled nas pontas', () => {
    montar()
    const ant = screen.getByRole('button', { name: 'Ponto anterior' }), seg = screen.getByRole('button', { name: 'Ponto seguinte' })
    fireEvent.click(seg)
    expect(leitura()).toBe(pontos[0]!.fala)
    expect(ant.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(seg); fireEvent.click(seg)
    expect(leitura()).toBe(pontos[2]!.fala)
    expect(seg.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(seg)
    expect(leitura()).toBe(pontos[2]!.fala)
    fireEvent.click(ant)
    expect(leitura()).toBe(pontos[1]!.fala)
    expect(fs.readFileSync(path.join(DIR, 'graficos.css'), 'utf8')).toMatch(/\.gl-step button\{width:44px;height:44px/)
  })
  it('o ponteiro sobre um elemento do desenho escolhe o ponto, e o elemento ganha a marca', () => {
    montar()
    fireEvent.pointerMove(screen.getByTestId('alvo1'), { pointerType: 'mouse' })
    expect(leitura()).toBe(pontos[1]!.fala)
    expect(screen.getByTestId('alvo1').classList.contains('gl-on')).toBe(true)
    expect(screen.getByTestId('alvo0').classList.contains('gl-on')).toBe(false)
  })
  it('o dedo que rola a página não escolhe ponto, o toque sim', () => {
    montar()
    // o jsdom não leva `pointerType` no init: o evento é montado à mão
    const evento = (tipo: string, pointerType: string) => {
      const e = new Event(tipo, { bubbles: true })
      Object.defineProperty(e, 'pointerType', { value: pointerType })
      act(() => { screen.getByTestId('alvo1').dispatchEvent(e) })
    }
    evento('pointermove', 'touch')
    expect(leitura()).toMatch(/mouse|setas/)
    evento('pointerdown', 'touch')
    expect(leitura()).toBe(pontos[1]!.fala)
  })
  it('o SVG é aria-hidden e a tabela tem uma linha por ponto', () => {
    const { container } = montar()
    expect(container.querySelector('svg')!.closest('[aria-hidden="true"]')).not.toBeNull()
    const linhas = container.querySelectorAll('details table tbody tr')
    expect(linhas.length).toBe(pontos.length)
    expect(container.querySelector('details summary')!.textContent).toBe('Ver como tabela')
    expect(linhas[1]!.textContent).toContain(pontos[1]!.fala)
    expect(container.querySelector('.gl-tw')!.getAttribute('role')).toBe('region')
  })
  it('uma tabela própria substitui a de duas colunas', () => {
    const { container } = render(<GraficoLegivel titulo="t" pontos={pontos} tabela={{ cabecalho: ['Dia', 'Views', 'Situação'], linhas: [['a', '1', 'x'], ['b', '2', 'y'], ['c', '3', 'z']] }}>{svg}</GraficoLegivel>)
    expect(container.querySelectorAll('thead th').length).toBe(3)
  })
  it('a legenda vem depois da linha de leitura', () => {
    const { container } = montar()
    const html = container.innerHTML
    expect(html.indexOf('gl-out')).toBeLessThan(html.indexOf('legenda do exemplo'))
  })
  it('sem pontos: a peça não desenha botões nem tabela vazia, nem fica focável', () => {
    const { container } = render(<GraficoLegivel titulo="vazio" pontos={[]}>{svg}</GraficoLegivel>)
    expect(screen.queryAllByRole('button').length).toBe(0)
    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelector('details')).toBeNull()
    expect(container.querySelector('[tabindex="0"]')).toBeNull()
  })
  it('trocar a lista de pontos limpa o ponto escolhido', () => {
    const { rerender } = montar()
    fireEvent.keyDown(grupo(), { key: 'ArrowRight' })
    expect(leitura()).toBe(pontos[0]!.fala)
    rerender(<GraficoLegivel titulo="Views por dia" pontos={[{ rotulo: 'outro', fala: 'outro ponto' }]}>{svg}</GraficoLegivel>)
    expect(leitura()).toMatch(/mouse|setas/)
  })
  it('a frase do aparelho é escolhida por CSS (pointer: coarse), sem JavaScript', () => {
    const css = fs.readFileSync(path.join(DIR, 'graficos.css'), 'utf8')
    expect(css).toMatch(/@media \(pointer:coarse\)\{\.gl-dica-m\{display:none\}\.gl-dica-t\{display:inline\}\}/)
    montar()
    expect(screen.getByRole('status').textContent).toContain('Toque no gráfico')
    expect(screen.getByRole('status').textContent).toContain('Passe o mouse')
  })
  it('graficos.css não tem color-mix nem z-index numérico', () => {
    const css = fs.readFileSync(path.join(DIR, 'graficos.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).not.toMatch(/color-mix/)
    expect(css).not.toMatch(/z-index\s*:\s*-?\d/)
  })
})
