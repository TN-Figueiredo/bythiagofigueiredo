// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { blocoDeHoras, primeiraHoraCheia, type EntradaDeHoras } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/horas-model'
import { blocoDeIdade } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/idade-model'
import { cartaoDaSubida, type EntradaDaSubida } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/subida-model'
import { resumoDoVideo, type EntradaDoResumo } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/resumo-model'
import { listaDeMudancas } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/mudancas-model'
import { contagemPorSemana } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/dias-model'
import { CartaoSubida } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/cartao-subida'
import { ContagemPorSemanaHistorico } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/contagem-por-semana'
import { CurvaPorIdade } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/curva-por-idade'
import { Esqueleto, FRASE_CARREGANDO } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/esqueleto'
import { Horas72 } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/horas-72'
import { ListaDeMudancasHistorico } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/lista-de-mudancas'
import { ResumoDoVideo } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/resumo'
import type { LeituraPorHora } from '@/lib/youtube/observatorio/medidas-telas/ler-horas'

const DIR = join(process.cwd(), 'src/app/cms/(authed)/youtube/competitors/_historico/medidas')
const html = (el: ReactElement): string => renderToStaticMarkup(el)
const n = (s: string, re: RegExp): number => (s.match(re) ?? []).length

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
const subidaEnt = (o: Partial<EntradaDaSubida>): EntradaDaSubida => ({
  hojeSP: '2026-10-16', semanal: false, saiu: false, diasDeContagem: 15, subidas: { estado: 'medido', valor: [], n: 1, janela: { de: null, ate: null, dias: null }, notas: [] },
  mudancas: [], inicioDaContagem: '2026-10-03', publicadoAntesDoInicio: false, ...o,
})

describe('E5a T21a, curva por idade e pares', () => {
  const bloco = blocoDeIdade({ ...baseIdade, pontos: pontosOk, normal: normal(14) })
  it('ok: 10 pontos legíveis, três pares com largura proporcional e a tabela', () => {
    const s = html(<CurvaPorIdade bloco={bloco} />)
    expect(n(s, /class="gl-alvo"/g)).toBe(10)
    expect(n(s, /class="hv-par"/g)).toBe(3)
    expect(s).toContain('Ver como tabela')
    expect(s).toContain('Os mesmos pontos, lado a lado')
    // o vídeo e o normal do par de 7 dias: as frações da largura têm a razão dos valores
    const fr = [...s.matchAll(/data-fracao="([\d.]+)"/g)].map((x) => Number(x[1]))
    expect(fr.length).toBeGreaterThanOrEqual(2)
    expect(Math.max(...fr)).toBeLessThanOrEqual(1)
  })
  it('nunca usa a cor de direção: nem verde nem âmbar nos blocos de idade e de horas', () => {
    const s = html(<CurvaPorIdade bloco={bloco} />) + html(<Horas72 bloco={blocoDeHoras(entH({}))} />)
    expect(s).not.toMatch(/hv-up|hv-dn|dir-up|dir-dn/)
  })
  it('as formas de bloco inteiro: não carregou, ainda não existe e não medido', () => {
    expect(html(<CurvaPorIdade bloco={blocoDeIdade({ ...baseIdade, pontos: null, normal: null })} />)).toContain('data-bloco-estado="nao_carregou"')
    const nm = blocoDeIdade({
      ...baseIdade, publicadoEm: '2026-08-01',
      pontos: IDADES.map((idadeDias) => ({ idadeDias, ponto: { estado: 'nao_medido' as const, motivo: 'leitura_comecou_depois' as const, notas: [] } })), normal: normal(14),
    })
    const s = html(<CurvaPorIdade bloco={nm} />)
    expect(s).toContain('data-bloco-estado="nao_medido"')
    expect(s).toContain('publicado antes de 03/10')
    expect(s).not.toContain('class="gl-alvo"')
  })
})

describe('E5a T21a, resumo e faixa', () => {
  const idade = blocoDeIdade({ ...baseIdade, pontos: pontosOk, normal: normal(14) })
  const ent: EntradaDoResumo = {
    hojeSP: '2026-10-16', inicioDaContagem: '2026-10-03', viewsAgora: 1_020_000, idade, subida: cartaoDaSubida(subidaEnt({})), mudancas: [],
    semanal: false, aoVivo: false, diasDeContagem: 15, idadeDoVideoDias: 20, saiu: null, entrouTarde: null, zeros: { dias: 0, diasMedidos: 15, horas: null, horasMedidas: null },
  }
  it('a frase e a faixa leem o mesmo número: "1,02 milhão" nunca vira "mi"', () => {
    const r = resumoDoVideo(ent)
    const s = html(<ResumoDoVideo resumo={r} />)
    expect(s).toContain('aria-label="Números do vídeo"')
    expect(s).toContain(r.faixa.viewsAgora.texto)
    expect(s).not.toMatch(/\d mi\b/)
    expect(n(s, /data-celula=/g)).toBe(5)
  })
  it('zero medido é caixa vazada, não hachura; ainda não existe é pontilhado', () => {
    const zero = blocoDeIdade({ ...baseIdade, pontos: IDADES.map((idadeDias) => ({ idadeDias, ponto: m(idadeDias === 1 ? 0 : 100) })), normal: normal(14) })
    const s = html(<ResumoDoVideo resumo={resumoDoVideo({ ...ent, idade: zero })} />)
    expect(s).toContain('obs-ch-zero')
    expect(s).toContain('medido: nenhuma view')
    const fut = blocoDeIdade({ ...baseIdade, pontos: IDADES.map((idadeDias) => ({ idadeDias, ponto: { estado: 'nao_medido' as const, motivo: 'fecha_em' as const, fechaEm: '2026-10-20', notas: [] } })), normal: null })
    expect(html(<ResumoDoVideo resumo={resumoDoVideo({ ...ent, idade: fut })} />)).toContain('ainda não existe')
  })
})

describe('E5a T21a, 72 horas e régua', () => {
  it('ok: 72 pontos legíveis, a linha de 1/2, os três marcos e a tabela', () => {
    const s = html(<Horas72 bloco={blocoDeHoras(entH({}))} />)
    expect(n(s, /class="gl-alvo"/g)).toBe(72)
    expect(s).toContain('data-linha-da-metade')
    expect(n(s, /class="hv-rk[ "]/g)).toBeGreaterThanOrEqual(3)
    expect(s).toContain('Ver como tabela')
    expect(s).toContain('maior hora medida')
  })
  it('ponta vazia: sem linha de 1/2 e o total em hachura com a frase da hora', () => {
    const s = html(<Horas72 bloco={blocoDeHoras(entH({ leituras: seguidas(0, 50) }))} />)
    expect(s).not.toContain('data-linha-da-metade')
    expect(s).toContain('data-total="nao_medido"')
  })
  it('não carregou, ainda não existe e não medido têm forma própria', () => {
    expect(html(<Horas72 bloco={blocoDeHoras(entH({ horas: null }))} />)).toContain('data-bloco-estado="nao_carregou"')
    const novo = html(<Horas72 bloco={blocoDeHoras(entH({ leituras: [], agoraMs: PUB + 2 * H }))} />)
    expect(novo).toContain('data-bloco-estado="ainda_nao_existe"')
    expect(novo).not.toContain('class="gl-alvo"')
  })
  it('zero medido na hora é caixa vazada (gl-zero), nunca hachura', () => {
    const base = seguidas(0, 72)
    const parado = base.map((l, i) => (i > 10 && i < 20 ? { ...l, views: base[10]!.views } : i >= 20 ? { ...l, views: l.views - (base[20]!.views - base[10]!.views) } : l))
    const s = html(<Horas72 bloco={blocoDeHoras(entH({ leituras: parado }))} />)
    expect(s).toContain('data-zero')
  })
})

describe('E5a T21a, subida, mudanças e contagem por semana', () => {
  it('as cinco formas do cartão da subida', () => {
    const tipos = [
      [subidaEnt({}), 'sem_subida'],
      [subidaEnt({ semanal: true }), 'inconclusivo'],
      [subidaEnt({ subidas: null }), 'nao_carregou'],
      [subidaEnt({ diasDeContagem: 9, subidas: { estado: 'nao_medido', motivo: 'sem_leitura', notas: [] } }), 'nao_medido'],
      [subidaEnt({ subidas: { estado: 'medido', valor: [{ dia: '2026-10-10', ganho7: 5000, ganho7Antes: 1000, fator: 5, mudancasAntes: [] }], n: 1, janela: { de: null, ate: null, dias: null }, notas: [] } }), 'subiu'],
    ] as const
    for (const [e, esperado] of tipos) {
      const s = html(<CartaoSubida cartao={cartaoDaSubida(e)} />)
      expect(s).toContain(`data-subida="${esperado}"`)
      expect(s).not.toMatch(/depois da troca/i)
    }
  })
  it('subida com barra de dias e a data; contagem por semana é caixa neutra, nunca a hachura rosa', () => {
    const faltam = html(<CartaoSubida cartao={cartaoDaSubida(subidaEnt({ diasDeContagem: 9, subidas: { estado: 'nao_medido', motivo: 'sem_leitura', notas: [] } }))} />)
    expect(faltam).toContain('hv-pg')
    expect(faltam).toContain('fecha em 22/10')
    const semanal = html(<CartaoSubida cartao={cartaoDaSubida(subidaEnt({ semanal: true }))} />)
    expect(semanal).toContain('hv-neu')
    expect(semanal).not.toContain('obs-ch-nm')
  })
  it('mudanças: não lidas são "não carregou"; sem nenhuma, a frase com a data; a nota "fora dos 14 dias antes" só nos de fora', () => {
    expect(html(<ListaDeMudancasHistorico lista={null} />)).toContain('Não carregou')
    const vazia = html(<ListaDeMudancasHistorico lista={listaDeMudancas([], { subidaDia: null, inicioDoHistorico: '2026-10-03' })} />)
    expect(vazia).toContain('Nenhuma mudança registrada desde 03/10')
  })
  it('contagem por semana: um ponto por semana, primeira leitura em hachura e nenhuma barra por dia', () => {
    const D = 86_400_000
    const t0 = Date.UTC(2026, 8, 1, 15)
    const sem = contagemPorSemana([0, 1, 2, 3].map((k) => ({ t: t0 + 7 * k * D, views: 1000 + 700 * k })), t0 - 30 * D)
    const s = html(<ContagemPorSemanaHistorico semana={sem} />)
    expect(n(s, /class="gl-alvo"/g)).toBe(4)
    expect(s).toContain('data-hachura="primeira"')
    expect(s).not.toContain('gl-barra')
  })
})

describe('E5a T21a, esqueleto e regras de arquivo', () => {
  it('a frase "Carregando o histórico do vídeo." aparece uma vez e nenhum número', () => {
    const s = html(<Esqueleto />)
    expect(n(s, new RegExp(FRASE_CARREGANDO.replace('.', '\\.'), 'g'))).toBe(1)
    expect(s).not.toMatch(/\d/)
  })
  it('o CSS: tudo escopado, sem mistura de cores do CSS e nenhum texto de gráfico menor que 12 px', () => {
    const css = readFileSync(join(DIR, 'historico-medidas.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).not.toMatch(/color-mix|@container/)
    for (const [, px] of css.matchAll(/font:[^;{}]*?(\d+(?:\.\d+)?)px/g)) expect(Number(px)).toBeGreaterThanOrEqual(12)
    for (const [, px] of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) expect(Number(px)).toBeGreaterThanOrEqual(12)
    for (const bloco of css.split('}')) {
      const sel = bloco.split('{')[0]!.trim()
      if (sel === '' || sel.startsWith('@media')) continue
      for (const s of sel.split(',')) expect(s.trim().replace(/^\}/, '')).toMatch(/^(\[data-theme="light"\] )?\[data-obs-screen="historico"\]/)
    }
  })
  it('os componentes novos não importam next/link nem ação de servidor, e não usam any', () => {
    for (const f of readdirSync(DIR).filter((x) => x.endsWith('.tsx'))) {
      const src = readFileSync(join(DIR, f), 'utf8')
      expect(src, f).not.toMatch(/next\/link|from '..\/actions'|forja-actions|'use server'/)
      expect(src, f).not.toMatch(/:\s*any\b|as any\b/)
    }
  })
})
