// @vitest-environment jsdom
// A4 Tarefa 13.3: a faixa da taxa de clique (mockup 12/10, A.faixaTaxa). O modelo é puro: o valor com o intervalo de 95% (Wilson) e, se
// houver, o do canal por baixo; faixa tracejada com "ainda não conclui" quando o intervalo é largo demais. A tela é SVG com coordenadas em
// porcentagem (o texto fica em 12 px, sem viewBox que o encolha); nada de cor de direção aqui: a direção é dita em texto por quem usa a faixa.
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { taxaComIntervalo } from '@/lib/youtube/observatorio/proprio/taxa'
import { buildTaxaFaixa, TOPOS_DO_EIXO } from '@/app/cms/(authed)/youtube/competitors/_proprio/taxa-faixa-model'
import { TaxaFaixa } from '@/app/cms/(authed)/youtube/competitors/_proprio/taxa-faixa'

afterEach(cleanup)

const t = (cliques: number, imp: number) => {
  const r = taxaComIntervalo(cliques, imp)
  if (!r) throw new Error('taxa devia existir')
  return r
}

describe('buildTaxaFaixa (modelo)', () => {
  it('sozinha: uma linha só, sem rótulo, com o valor e os dois limites em texto', () => {
    const v = buildTaxaFaixa({ alvo: t(480, 10000), canal: null, alt: 'x' })
    expect(v.linhas).toHaveLength(1)
    const l = v.linhas[0]!
    expect(l.rotulo).toBeNull()
    expect(l.valor).toBe('4,8%')
    expect(l.loTxt).toMatch(/^4,[0-9]%$/)
    expect(l.hiTxt).toMatch(/^5,[0-9]%$/)
    expect(l.lo).toBeLessThan(l.p)
    expect(l.p).toBeLessThan(l.hi)
    expect(l.inconclusiva).toBe(false)
    expect(l.nota).toBeNull()
  })

  it('com o canal: a linha do canal vem primeiro ("O canal inteiro") e a do vídeo depois ("Este vídeo")', () => {
    const v = buildTaxaFaixa({ alvo: t(300, 4000), canal: t(480, 10000), rotuloAlvo: 'Este vídeo', alt: 'x' })
    expect(v.linhas.map(l => l.rotulo)).toEqual(['O canal inteiro', 'Este vídeo'])
    expect(v.linhas.map(l => l.classe)).toEqual(['ref', 'proprio'])
  })

  it('largura: sem referência, mais de 15 pontos é inconclusiva; com referência, mais de 3x a do canal', () => {
    const largaSem = buildTaxaFaixa({ alvo: t(1, 5), canal: null, alt: 'x' }).linhas[0]!
    expect(largaSem.inconclusiva).toBe(true)
    expect(largaSem.classe).toBe('inc')
    expect(largaSem.nota).toBe('faixa tracejada: ainda não conclui')
    const estreita = buildTaxaFaixa({ alvo: t(480, 10000), canal: null, alt: 'x' }).linhas[0]!
    expect(estreita.inconclusiva).toBe(false)
    const comRef = buildTaxaFaixa({ alvo: t(2, 20), canal: t(480, 10000), rotuloAlvo: 'Este vídeo', alt: 'x' })
    expect(comRef.linhas[1]!.inconclusiva).toBe(true)
    expect(comRef.linhas[0]!.inconclusiva).toBe(false)
  })

  it('o campo inconclusivo explícito (o do veredito) vale sobre a conta local', () => {
    const v = buildTaxaFaixa({ alvo: t(480, 10000), canal: null, inconclusivo: true, alt: 'x' }).linhas[0]!
    expect(v.inconclusiva).toBe(true)
    const w = buildTaxaFaixa({ alvo: t(1, 5), canal: null, inconclusivo: false, alt: 'x' }).linhas[0]!
    expect(w.inconclusiva).toBe(false)
  })

  it('o eixo escolhe o menor topo de {5, 10, 20, 40, 100} que cabe o maior limite com 12% de folga', () => {
    expect(TOPOS_DO_EIXO).toEqual([5, 10, 20, 40, 100])
    expect(buildTaxaFaixa({ alvo: t(480, 10000), canal: null, alt: 'x' }).topo).toBe(10)
    expect(buildTaxaFaixa({ alvo: t(100, 10000), canal: null, alt: 'x' }).topo).toBe(5)
    expect(buildTaxaFaixa({ alvo: t(5000, 10000), canal: null, alt: 'x' }).topo).toBe(100)
    const v = buildTaxaFaixa({ alvo: t(100, 10000), canal: null, alt: 'x' })
    expect(v.eixo.map(e => e.txt)).toEqual(['0%', '2,5%', '5%'])
    expect(v.eixo.map(e => e.pos)).toEqual([0, 0.5, 1])
  })

  it('as posições são frações do eixo (0 a 1), nunca passam de 1', () => {
    const v = buildTaxaFaixa({ alvo: t(5000, 10000), canal: null, alt: 'x' })
    for (const l of v.linhas) for (const x of [l.lo, l.p, l.hi]) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(1) }
  })

  it('zero clique com impressões é zero medido: valor 0,0% e intervalo que sobe de zero', () => {
    const l = buildTaxaFaixa({ alvo: t(0, 1000), canal: null, alt: 'x' }).linhas[0]!
    expect(l.valor).toBe('0,0%')
    expect(l.loTxt).toBe('0,0%')
    expect(l.p).toBe(0)
  })
})

describe('TaxaFaixa (tela)', () => {
  const montar = (alvo = t(30, 400), canal: ReturnType<typeof t> | null = t(480, 10000)) =>
    render(<TaxaFaixa view={buildTaxaFaixa({ alvo, canal, rotuloAlvo: 'Este vídeo', alt: 'Taxa de clique de 7,5%, entre 5,3% e 10,5%.' })} />)

  it('é um SVG com nome acessível, e o valor de cada linha existe como texto', () => {
    const { container } = montar()
    const svgs = container.querySelectorAll('[role="img"]')
    expect(svgs.length).toBeGreaterThan(0)
    expect(container.querySelector('[role="img"][aria-label^="Taxa de clique de 7,5%"]')).not.toBeNull()
    expect(container.textContent).toContain('7,5%')
    expect(container.textContent).toContain('4,8%')
    expect(container.textContent).toContain('O canal inteiro')
    expect(container.textContent).toContain('Este vídeo')
  })

  it('a faixa inconclusiva é tracejada (classe inc) e diz "ainda não conclui" em texto', () => {
    const { container } = montar(t(2, 20), t(480, 10000))
    expect(container.querySelector('.tf-int.inc')).not.toBeNull()
    expect(container.textContent).toContain('faixa tracejada: ainda não conclui')
  })

  it('sem referência e conclusiva: nenhuma faixa tracejada', () => {
    const { container } = montar(t(480, 10000), null)
    expect(container.querySelector('.tf-int.inc')).toBeNull()
    expect(container.querySelectorAll('.tf-linha')).toHaveLength(1)
    expect(container.textContent).not.toContain('ainda não conclui')
  })

  it('nenhum viewBox (o texto não encolhe) e nenhuma cor de direção (verde/âmbar) no desenho', () => {
    const { container } = montar()
    expect(container.innerHTML).not.toMatch(/viewBox/i)
    expect(container.innerHTML).not.toMatch(/22c55e|f59e0b|11692f|8a5a00/i)
    expect(container.innerHTML).not.toMatch(/color-mix/)
  })

  it('o valor não passa do SVG para o lado de fora: âncora no começo perto de 0 e no fim perto do topo', () => {
    const { container } = render(<TaxaFaixa view={buildTaxaFaixa({ alvo: t(0, 1000), canal: null, alt: 'x' })} />)
    const num = container.querySelector('.tf-num')
    expect(num?.getAttribute('text-anchor')).toBe('start')
  })
})

describe('taxa-faixa.css (varredura)', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_proprio/taxa-faixa.css'), 'utf8')
  it('sem color-mix, sem z-index numérico, nenhum texto abaixo de 12 px', () => {
    expect(css).not.toMatch(/color-mix\(/)
    expect(css).not.toMatch(/z-index:\s*\d/)
    for (const m of css.matchAll(/font:\s*[0-9]+\s+([0-9.]+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
  })
})
