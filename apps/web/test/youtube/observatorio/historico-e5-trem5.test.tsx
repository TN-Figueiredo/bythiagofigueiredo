// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { blocoDeHoras, primeiraHoraCheia, type EntradaDeHoras } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/horas-model'
import { blocoDeIdade } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/idade-model'
import { CurvaPorIdade } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/curva-por-idade'
import { Horas72 } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/horas-72'
import type { LeituraPorHora } from '@/lib/youtube/observatorio/medidas-telas/ler-horas'

/** Trem 5, Gio: defeitos do Histórico do vídeo (eixos em px, legenda com amostra, alvos de 44 px, sem "tente de novo" sem botão). */
const DIR = join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_historico/medidas')
const css = readFileSync(join(DIR, 'historico-medidas.css'), 'utf8')
const html = (el: ReactElement): string => renderToStaticMarkup(el)

const m = (valor: number, nn = 5) => ({ estado: 'medido' as const, valor, n: nn, janela: { de: null, ate: null, dias: null }, notas: [] })
const IDADES = [1, 2, 3, 5, 7, 14, 21, 30, 60, 90]
const normal = (nn: number) => ({
  estado: 'medido' as const, valor: IDADES.map((idadeDias) => ({ idadeDias, ponto: m(1000 * idadeDias, nn), relativoAV30: m(1) })), n: nn, janela: { de: null, ate: null, dias: null }, notas: [],
})
const baseIdade = { hojeSP: '2026-10-16', inicioDaContagem: '2026-10-03', publicadoEm: '2026-09-01', aoVivo: false, saiuDoYoutube: false, horasAteEntrar: 1 }
const pontosOk = IDADES.map((idadeDias) => ({ idadeDias, ponto: m(900 * idadeDias) }))
const H = 3_600_000
const PUB = Date.UTC(2026, 9, 8, 23, 40)
const E1 = primeiraHoraCheia(PUB)
const lt = (ms: number, views: number): LeituraPorHora => ({ horaMs: Math.floor(ms / H) * H, lidaEmMs: ms, views, likes: null, comments: null })
const seguidas = (de: number, ate: number): LeituraPorHora[] => Array.from({ length: ate - de + 1 }, (_, i) => lt(E1 + (de + i) * H, 1000 + (de + i) * 100))
const entH = (o: Partial<EntradaDeHoras>): EntradaDeHoras => ({
  agoraMs: PUB + 80 * H, publicadoEmMs: PUB, descobertoEmMs: PUB + 20 * 60_000, aoVivo: false, viewsAgora: 8000,
  horas: { primeiraHoraDoSiteMs: PUB - 24 * H, ultimoOkDaTarefaMs: PUB + 79 * H, primeiraExecucaoDaTarefaMs: PUB - 24 * H },
  leituras: seguidas(0, 72), toleranciaH: 3, normal: null, contagemPorDiaDesde: '2026-10-03', ...o,
})

describe('defeito 1: eixos a >= 12 px efetivos (svg em px, rola no .gl-sc)', () => {
  it('Views por idade e 72 horas: width/height em px = viewBox, sem 100%', () => {
    for (const s of [html(<CurvaPorIdade bloco={blocoDeIdade({ ...baseIdade, pontos: pontosOk, normal: normal(14) })} />), html(<Horas72 bloco={blocoDeHoras(entH({}))} />)]) {
      const tag = s.match(/<svg class="(?:ic-svg|hv-svg72)"[^>]*>/)![0]
      const [, , w, h] = tag.match(/viewBox="([^"]+)"/)![1]!.split(' ')
      expect(tag).toContain(`width="${w}"`)
      expect(tag).toContain(`height="${h}"`)
      expect(tag).not.toContain('width="100%"')
      expect(s).toContain('data-rola')
    }
  })
  it('o CSS não encolhe esses svgs (max-width:none) e não há min-width solto', () => {
    expect(css).toMatch(/\.hv \.ic-svg\{max-width:none\}/)
    expect(css).toMatch(/\.hv-svg72\{max-width:none\}/)
    expect(css).not.toMatch(/\.hv-svg72\{[^}]*min-width/)
  })
})

describe('defeito 4: legenda das 72 horas com a amostra de cada marca', () => {
  it('cada item da legenda tem um svg de amostra com a mesma classe do gráfico', () => {
    const s = html(<Horas72 bloco={blocoDeHoras(entH({}))} />)
    const leg = s.match(/<ul class="ic-leg">[\s\S]*?<\/ul>/)![0]
    expect(leg.match(/<li /g)).toHaveLength(4)
    expect(leg.match(/class="hv-amostra"/g)).toHaveLength(4)
    expect(leg).toContain('class="gl-barra"')
    expect(leg).toContain('class="gl-zero"')
    expect(leg).toContain('gl-nm-risco')
  })
})

describe('defeito 5: alvos de 44 px a 390 px, o override no mesmo arquivo depois da regra base', () => {
  const hist = readFileSync(join(DIR, '..', 'historico.css'), 'utf8')
  it('ⓘ: regra base e depois o override de 44 px', () => {
    const base = css.indexOf('.ri-ibtn{')
    const over = css.indexOf('@media (pointer:coarse),(max-width:900px){\n[data-obs-screen="historico"] .ri-ibtn{min-width:44px;min-height:44px')
    expect(base).toBeGreaterThan(-1)
    expect(over).toBeGreaterThan(base)
  })
  it('chips de troca (.pair): 44 px no bloco de largura estreita, depois da regra base', () => {
    const base = hist.indexOf('.pair{display:inline-flex')
    const over = hist.indexOf('a.inl,[data-obs-screen="historico"] .pair{min-height:44px}')
    expect(base).toBeGreaterThan(-1)
    expect(over).toBeGreaterThan(base)
  })
})

describe('defeito 6: bloco de servidor não manda "tente de novo" onde não há botão', () => {
  it('nenhum texto dos modelos de bloco manda tentar de novo (só recarregar a página)', () => {
    for (const f of ['resumo-model.ts', 'subida-model.ts', 'idade-model.ts', 'horas-model.ts', 'dias-model.ts', 'mudancas-model.ts']) {
      expect(readFileSync(join(DIR, f), 'utf8'), f).not.toMatch(/tente de novo/i)
    }
  })
  it('o erro do histórico inteiro tem o botão, e o texto aponta para ele', () => {
    const t = readFileSync(join(DIR, '..', 'historico-screen.tsx'), 'utf8')
    expect(t).toContain('Tentar de novo')
    expect(t).not.toContain('O servidor não respondeu')
  })
})

describe('menor: rótulo da hora da live', () => {
  it('live: "início da live", dizendo que as 72 horas contam daí; vídeo comum segue "publicado"', () => {
    const live = blocoDeHoras(entH({ aoVivo: true }))
    const comum = blocoDeHoras(entH({}))
    if (live.tipo !== 'ok' || comum.tipo !== 'ok') throw new Error('esperava bloco ok')
    expect(live.publicacao).toMatch(/^início da live .*as 72 horas contam daqui/)
    expect(live.publicacao).not.toMatch(/^publicado/)
    expect(comum.publicacao).toMatch(/^publicado /)
  })
})
