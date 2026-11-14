// @vitest-environment node
/**
 * C1 R1: "semana" = 7 dias corridos (hoje e os 6 anteriores, dia de São Paulo), calculado no servidor; o topo diz o recorte.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: () => undefined, captureException: () => undefined }))

import { ENTRADA, traduzir } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { empacotarConsulta, type ResultadoDaConsulta } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-consulta'
import { DESCRICAO_DOS_CAMPOS_DA_CONSULTA } from '@/lib/pipeline/mcp/observatorio/servidor'
import { CHAVES_COM_FORMA_DE_PARAMS } from '@/lib/youtube/observatorio/acesso-ia/registrar'
import type { PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { pedido } from './consulta-fixture'

// 14/11 02:30 UTC = 13/11 23:30 em São Paulo (o dia de SP é o 13, o de UTC é o 14)
const FRONTEIRA = Date.UTC(2026, 10, 14, 2, 30)
// 14/11 12:00 UTC = 14/11 09:00 em SP
const MEIO_DIA = Date.UTC(2026, 10, 14, 12, 0)

const tr = (e: object, agora: number) => {
  const lida = ENTRADA.safeParse({ acao: 'consultar', ...e })
  if (!lida.success) throw new Error(JSON.stringify(lida.error.issues))
  return traduzir(lida.data, agora)
}
const consulta = (e: object, agora: number) => { const t = tr(e, agora); if (!t.ok) throw new Error(t.frase); return t.pedido.consulta! }

describe('R1: publicado_nos_ultimos_dias', () => {
  it('N=7 dá de = hoje-6 e ate = hoje (dia de SP)', () => {
    const c = consulta({ publicado_nos_ultimos_dias: 7 }, MEIO_DIA)
    expect(c.publicadoDe).toBe('2026-11-08')
    expect(c.publicadoAte).toBe('2026-11-14')
  })
  it('N=1 é só hoje; N=30 atravessa a virada do mês', () => {
    const um = consulta({ publicado_nos_ultimos_dias: 1 }, MEIO_DIA)
    expect([um.publicadoDe, um.publicadoAte]).toEqual(['2026-11-14', '2026-11-14'])
    expect(consulta({ publicado_nos_ultimos_dias: 30 }, MEIO_DIA).publicadoDe).toBe('2026-10-16')
  })
  it('fronteira de fuso: 23:30 em SP (já dia seguinte em UTC) usa o dia de SP', () => {
    const c = consulta({ publicado_nos_ultimos_dias: 7 }, FRONTEIRA)
    expect(c.publicadoAte).toBe('2026-11-13')
    expect(c.publicadoDe).toBe('2026-11-07')
  })
  it('aceita número em texto; recusa 0, 366 e fração', () => {
    expect(consulta({ publicado_nos_ultimos_dias: '7' }, MEIO_DIA).publicadoDe).toBe('2026-11-08')
    for (const n of [0, 366, 1.5, 'sete']) expect(ENTRADA.safeParse({ acao: 'consultar', publicado_nos_ultimos_dias: n }).success, String(n)).toBe(false)
  })
  it('com publicado_nos_ultimos_dias e sem janela_idade, a faixa padrão (0-90) não corta o período', () => {
    expect(consulta({ publicado_nos_ultimos_dias: 200 }, MEIO_DIA).janelaIdade).toBe('todas')
    expect(consulta({ publicado_nos_ultimos_dias: 7, janela_idade: '0-30' }, MEIO_DIA).janelaIdade).toEqual(['0-30'])
  })
  it.each([['publicado_de', '2026-11-01'], ['publicado_ate', '2026-11-10']])('junto de %s: erro de pedido claro', (campo, v) => {
    const t = tr({ publicado_nos_ultimos_dias: 7, [campo]: v }, MEIO_DIA)
    expect(t.ok).toBe(false)
    if (!t.ok) { expect(t.campos).toContain('publicado_nos_ultimos_dias'); expect(t.frase).toMatch(/publicado_nos_ultimos_dias.*publicado_de|publicado_de.*publicado_nos_ultimos_dias/) }
  })
  it('o parâmetro tem forma no registro do log', () => {
    expect(CHAVES_COM_FORMA_DE_PARAMS).toContain('publicado_nos_ultimos_dias')
  })
  it('as descrições do servidor dizem como pedir "semana"', () => {
    const d = DESCRICAO_DOS_CAMPOS_DA_CONSULTA
    expect(d.publicado_nos_ultimos_dias).toMatch(/7/)
    expect(d.publicado_nos_ultimos_dias).toMatch(/Bras[ií]lia/)
    expect(d.publicado_de).toMatch(/AAAA-MM-DD, dia de Bras[ií]lia/)
    expect(d.janela_idade).toMatch(/nunca para per[ií]odo pedido em dias/)
  })
})

describe('R1: o topo ecoa o recorte', () => {
  const topo = (p: Partial<ResultadoDaConsulta['pedido']>): string => {
    const r: ResultadoDaConsulta = { pedido: pedido(p), blocos: [], dadosDe: { motor: null, medidas: null, lugares: null }, canaisSemMedida: [], canaisNaoEncontrados: [] }
    const m: PacoteModelo = empacotarConsulta(r)
    const t = m.tabelas.find((x) => x.id === 'consulta-cabecalho')!
    const l = t.linhas[0]!
    return l.map((c) => ('texto' in c ? c.texto : '')).join(': ')
  }
  it('últimos N dias', () => {
    expect(topo({ publicadoDe: '2026-11-08', publicadoAte: '2026-11-14', ultimosDias: 7 })).toContain('Publicados de 08/11 a 14/11 (últimos 7 dias, horário de Brasília)')
  })
  it('datas fixas', () => {
    expect(topo({ publicadoDe: '2026-10-01', publicadoAte: '2026-10-31' })).toContain('Publicados de 01/10 a 31/10 (horário de Brasília)')
  })
  it('sem data: a faixa de idade', () => {
    expect(topo({ janelaIdade: ['0-30'] })).toContain('Publicados nos últimos 30 dias (faixa 0-30)')
    expect(topo({ janelaIdade: 'todas' })).toContain('Publicados em qualquer data')
  })
})
