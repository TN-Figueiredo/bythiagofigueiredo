// @vitest-environment jsdom
// A5 · E8 · Tarefa 13 (conserto da revisão de 13/10): o GRÁFICO da curva de retenção. Tamanho do texto em tela estreita, eixo do tempo que não se
// sobrepõe, primeiro desenho com a altura final, cores com significado e contraste, e o trecho sem dado desenhado como ausência.
// O texto da seção (frases, avisos, estados) fica em `proprio-retencao-curva-tela.test.tsx`.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { buildRetencaoView, type RetencaoView } from '@/app/cms/(authed)/youtube/competitors/_proprio/retencao-curva-model'
import { RetencaoCurva } from '@/app/cms/(authed)/youtube/competitors/_proprio/retencao-curva'
import { dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import type { RetencaoDoVideo } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import type { Privado } from '@/lib/youtube/observatorio/proprio/tipos'

afterEach(() => { cleanup() })

interface Ponto { t: number; ratio: number; relative: number | null }
const curvaDe = (f: (t: number) => number, n = 100): Ponto[] => Array.from({ length: n }, (_, k) => ({ t: (k + 1) / 100, ratio: f((k + 1) / 100), relative: 0.5 }))
const cruzaEm35 = (t: number): number => (t < 0.345 ? 1 - t : 0.4 - (t - 0.35) * 0.4)
const D = (n: number): string => { const x = new Date(Date.now() - n * 86_400_000); return x.toISOString().slice(0, 10) }
const comCurva = (pontos: Ponto[]): Privado<RetencaoDoVideo> => ({
  acesso: 'ok',
  dado: {
    ytId: 'vid00000001', leituras: [], leiturasCortadas: false, ultimaTentativa: null, ultimaResposta: null, descartados: 0, tabelaAusente: false, janelasIlegiveis: [],
    curvas: { vida: { janela: 'vida', windowStart: D(60), windowEnd: D(2), coletadaEm: D(1) + 'T15:00:00.000Z', pontos, metricas: ['audienceWatchRatio'], viewsAtRead: 1234 } },
  },
})
const view = (r: Privado<RetencaoDoVideo>, duracaoSeg: number | null = 360): RetencaoView => buildRetencaoView({ retencao: r, duracaoSeg, dm: dmDia })
function RetencaoSvg({ v }: { v: RetencaoView }) { return v.curva ? <RetencaoCurva curva={v.curva} /> : null }
const texto = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
/** O jsdom não tem layout: `clientWidth` do contêiner vem daqui. */
function comLargura(px: number, f: () => void): void {
  const antes = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => px })
  try { f() } finally {
    if (antes) Object.defineProperty(HTMLElement.prototype, 'clientWidth', antes)
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth
  }
}
const eixoDe = (c: HTMLElement): string[] => [...c.querySelectorAll('.rc-gx')].map(x => x.textContent ?? '')
const CSS = readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_proprio/retencao-curva.css'), 'utf8')

describe('o gráfico: tela estreita, eixo do tempo e primeiro desenho', () => {
  it('o desenho nunca encolhe: o viewBox acompanha a largura real, mesmo num cartão de 230 px (nada de largura mínima de 300)', () => {
    for (const px of [230, 264, 304, 334]) {
      comLargura(px, () => {
        const { container } = render(<RetencaoSvg v={view(comCurva(curvaDe(cruzaEm35)))} />)
        const svg = container.querySelector('svg')!
        expect(svg.getAttribute('viewBox'), `${px}px`).toBe(`0 0 ${px} 200`)
        expect(svg.getAttribute('width')).toBe(String(px))
        cleanup()
      })
    }
  })
  it('antes de medir (servidor e primeiro render) o SVG nasce escondido e com a altura final; depois de medir, aparece', () => {
    const { container } = render(<RetencaoSvg v={view(comCurva(curvaDe(cruzaEm35)))} />) // jsdom: largura 0 = ainda não medido
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('rc-prep')
    cleanup()
    comLargura(334, () => {
      const { container: c2 } = render(<RetencaoSvg v={view(comCurva(curvaDe(cruzaEm35)))} />)
      expect(c2.querySelector('svg')!.getAttribute('class')).not.toContain('rc-prep')
    })
  })
  it('CSS: o SVG reserva 200 px (240 px a partir de 520 px) sem depender do viewBox, e some enquanto não é medido', () => {
    expect(CSS).toMatch(/\.rc\{[^}]*container-type:inline-size/)
    expect(CSS).toMatch(/\.rc-svg\{[^}]*height:200px/)
    expect(CSS).toMatch(/@container \(min-width:\s*520px\)\{[^}]*\.rc-svg\{height:240px\}/)
    expect(CSS).not.toMatch(/\.rc-svg\{[^}]*height:auto/)
    expect(CSS).toMatch(/\.rc-prep\{visibility:hidden\}/)
  })
  it('eixo do tempo: vídeo de 1h30 num celular mostra só 0, 50 e 100% (cinco rótulos de 7 caracteres não cabem); em tela larga, os cinco', () => {
    const v = view(comCurva(curvaDe(cruzaEm35)), 5400)
    comLargura(300, () => {
      const { container } = render(<RetencaoSvg v={v} />)
      expect(eixoDe(container)).toEqual(['0:00', '45:00', '1:30:00'])
      cleanup()
    })
    comLargura(860, () => {
      const { container } = render(<RetencaoSvg v={v} />)
      expect(eixoDe(container)).toEqual(['0:00', '22:30', '45:00', '1:07:30', '1:30:00'])
    })
  })
  it('eixo do tempo: vídeo curto (m:ss) cabe com cinco rótulos a 390 px; em % cinco até 270 px e três abaixo disso (230 px)', () => {
    comLargura(334, () => {
      const { container } = render(<RetencaoSvg v={view(comCurva(curvaDe(cruzaEm35)), 360)} />)
      expect(eixoDe(container)).toHaveLength(5)
      cleanup()
    })
    comLargura(270, () => {
      const { container } = render(<RetencaoSvg v={view(comCurva(curvaDe(cruzaEm35)), null)} />)
      expect(eixoDe(container)).toEqual(['0%', '25%', '50%', '75%', '100%'])
      cleanup()
    })
    comLargura(230, () => {
      const { container } = render(<RetencaoSvg v={view(comCurva(curvaDe(cruzaEm35)), null)} />)
      expect(eixoDe(container)).toEqual(['0%', '50%', '100%'])
    })
  })
  it('eixo do tempo: nenhum par de rótulos se sobrepõe (largura de 7,2 px por caractere) em nenhuma largura de celular', () => {
    for (const dur of [360, 3_700, 5_400, 40_000]) {
      for (const px of [200, 230, 270, 300, 334, 500]) {
        comLargura(px, () => {
          const { container } = render(<RetencaoSvg v={view(comCurva(curvaDe(cruzaEm35)), dur)} />)
          const ts = [...container.querySelectorAll<SVGTextElement>('.rc-gx')]
          const caixas = ts.map(t => {
            const x = Number(t.getAttribute('x')), w = (t.textContent ?? '').length * 7.2, a = t.getAttribute('text-anchor')
            return a === 'start' ? [x, x + w] : a === 'end' ? [x - w, x] : [x - w / 2, x + w / 2]
          })
          for (let i = 1; i < caixas.length; i++) expect(caixas[i]![0], `${dur}s a ${px}px, rótulo ${i}`).toBeGreaterThanOrEqual(caixas[i - 1]![1] + 4)
          cleanup()
        })
      }
    }
  })
  it('"metade já saiu aqui" nunca sai do gráfico: sem espaço dos dois lados, quebra em duas linhas', () => {
    comLargura(230, () => {
      const { container } = render(<RetencaoSvg v={view(comCurva(curvaDe(cruzaEm35)))} />)
      const rotulo = container.querySelector('.rc-rotulo')!
      const linhas = [...rotulo.querySelectorAll('tspan')]
      expect(linhas.map(l => l.textContent)).toEqual(['metade já', 'saiu aqui'])
      for (const l of linhas) expect(Number(l.getAttribute('x'))).toBeGreaterThanOrEqual(40)
      cleanup()
    })
    comLargura(860, () => {
      const { container } = render(<RetencaoSvg v={view(comCurva(curvaDe(cruzaEm35)))} />)
      expect(container.querySelector('.rc-rotulo')!.textContent).toBe('metade já saiu aqui')
    })
  })
})

describe('o gráfico: cores com significado e contraste (CSS)', () => {
  it('nenhum color-mix e nenhum valor de cor solto: só token', () => {
    expect(CSS).not.toMatch(/color-mix/)
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
  it('a maior saída não reusa --terco-baixo (outro significado, sem valor no tema claro): usa --dir-dn', () => {
    expect(CSS).not.toMatch(/terco-baixo\)/)
    expect(CSS).toMatch(/\.rc-saida\{[^}]*fill:var\(--dir-dn\)/)
  })
  it('a faixa de trecho revisto tem contorno de 3:1 ou mais (--dim) e a transparência só no preenchimento (opacity apagaria o contorno)', () => {
    const faixa = CSS.match(/\.rc-revisto\{[^}]*\}/)![0]
    expect(faixa).toMatch(/stroke:var\(--dim\)/)
    expect(faixa).toMatch(/fill-opacity:/)
    expect(faixa).not.toMatch(/[^-]opacity:/)
  })
  it('a linha de 50% é pontilhada em --dim (a de 0 e 100% pode ficar suave)', () => {
    expect(CSS).toMatch(/\.rc-grade-meia\{[^}]*stroke:var\(--dim\)/)
    const { container } = render(<RetencaoSvg v={view(comCurva(curvaDe(cruzaEm35)))} />)
    const linhas = [...container.querySelectorAll('.rc-grade, .rc-grade-meia')]
    expect(linhas).toHaveLength(3)
    expect(container.querySelectorAll('.rc-grade-meia')).toHaveLength(1)
  })
  it('o trecho sem dado da curva incompleta é desenhado: hachura de "não medido" (token), marca no último ponto e rótulo; legenda diz "sem dado coletado"', () => {
    comLargura(860, () => {
      const { container } = render(<RetencaoSvg v={view(comCurva(curvaDe(cruzaEm35, 37)))} />)
      const faixa = container.querySelector('rect.rc-semdado')!
      expect(faixa).not.toBeNull()
      expect(faixa.getAttribute('fill')).toMatch(/^url\(#.+\)$/)
      const id = faixa.getAttribute('fill')!.slice(5, -1)
      expect(container.querySelector(`pattern[id="${id}"]`)).not.toBeNull()
      expect(container.querySelector('circle.rc-ultimo')).not.toBeNull()
      expect(container.querySelector('.rc-semdado-rotulo')!.textContent).toBe('sem dado depois daqui')
      // a faixa começa onde a curva acaba e vai até a borda direita da grade
      const grade = container.querySelector('.rc-grade')!
      const x2 = Number(grade.getAttribute('x2')), x = Number(faixa.getAttribute('x'))
      expect(x + Number(faixa.getAttribute('width'))).toBeCloseTo(x2, 1)
      expect(Number(container.querySelector('circle.rc-ultimo')!.getAttribute('cx'))).toBeCloseTo(x, 1)
      expect(texto(container.querySelector('.rc-leg'))).toContain('sem dado coletado')
    })
    // curva completa: nada disso
    const c = render(<RetencaoSvg v={view(comCurva(curvaDe(cruzaEm35)))} />).container
    expect(c.querySelector('.rc-semdado')).toBeNull()
    expect(c.querySelector('circle.rc-ultimo')).toBeNull()
    expect(texto(c.querySelector('.rc-leg'))).not.toContain('sem dado coletado')
  })
  it('a legenda da maior saída usa o MESMO desenho do gráfico (triângulo com contorno), não um quadrado', () => {
    const f = (t: number): number => (t < 0.2 ? 1 - t : t < 0.3 ? 0.8 - (t - 0.2) * 3 : 0.5 - (t - 0.3) * 0.1)
    const { container } = render(<RetencaoSvg v={view(comCurva(curvaDe(f)), 600)} />)
    expect(container.querySelector('.rc-leg svg polygon.rc-saida')).not.toBeNull()
  })
  it('curva de 1 ponto: nada de caminho de largura zero; o ponto aparece como marca e o resto como "sem dado"', () => {
    const { container } = render(<RetencaoSvg v={view(comCurva(curvaDe(cruzaEm35, 1)))} />)
    expect(container.querySelector('path.rc-linha')).toBeNull()
    expect(container.querySelector('path.rc-area')).toBeNull()
    expect(container.querySelector('circle.rc-ultimo')).not.toBeNull()
    expect(container.querySelector('rect.rc-semdado')).not.toBeNull()
  })
})
