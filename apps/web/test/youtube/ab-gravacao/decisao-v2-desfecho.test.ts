// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  pisos, decidirV2, desfechoProvisorio, encerradoEmDia, ENCERRA_AO_FECHAR_PISOS, type DiaDaDecisao, type Pisos, type EstatisticaV2,
} from '@/lib/youtube/ab-gravacao/decisao-v2'
import { lerResultadoV2 } from '@/lib/youtube/ab-types'

const dia = (i: number, variant: string | null, imp: number | null, clicks: number | null, bloco: number | null, over: Partial<DiaDaDecisao> = {}): DiaDaDecisao => ({
  day_pt: `2026-09-${String(i + 1).padStart(2, '0')}`, variant_id: variant, alcance_estado: 'medido',
  impressoes: imp, ctr: clicks === null || !imp ? null : clicks / imp, final: true, bloco, ...over,
})
const V2 = ['o', 'a']
/** n dias por variante, ABBA. */
function serie(n: number, imp = 100_000, over: (i: number) => Partial<DiaDaDecisao> = () => ({})): DiaDaDecisao[] {
  const p = [0, 1, 1, 0]
  return Array.from({ length: n }, (_, i) => dia(i, V2[p[i % 4]!]!, imp, imp * (p[i % 4] ? 0.05 : 0.04), Math.floor(i / 4), over(i)))
}
const SEM_DADO: EstatisticaV2 = { estado: 'sem_dado', motivo: 'gl_menor_que_2' }
const calc = (passa: boolean, p_adj = 0.01): EstatisticaV2 => ({
  estado: 'calculada', phi: 1, gl: 6,
  por_variante: [{ variant_id: 'a', alfa: 0.05, z: 3, z_adj: 3, p_adj, sinais_por_bloco: [1, 1], passa, lift: 0.2 }],
})
const P = (o: Partial<Pisos> = {}): Pisos => ({
  dias_validos: { o: 4, a: 4 }, blocos_completos: 2, piso_dias: true, volume: { o: 9e9, a: 9e9 }, piso_volume: true, fechavel_por_aguardando: false, ...o,
})

describe('pisos', () => {
  it('conta dias válidos, blocos completos e volume', () => {
    const p = pisos(serie(8), V2, 1000)
    expect(p.dias_validos).toEqual({ o: 4, a: 4 })
    expect(p.blocos_completos).toBe(2)
    expect(p.piso_dias).toBe(true)
    expect(p.piso_volume).toBe(true)
  })
  it('C-13: menos de 4 dias por variante, volume enorme', () => {
    const p = pisos(serie(6), V2, 10)
    expect(p.piso_dias).toBe(false)
    expect(p.piso_volume).toBe(true)
  })
  it('dia aguardando que fecharia o piso marca fechavel_por_aguardando', () => {
    const p = pisos(serie(8, 100_000, i => (i >= 6 ? { alcance_estado: 'aguardando', impressoes: null, ctr: null } : {})), V2, 10)
    expect(p.piso_dias).toBe(false)
    expect(p.fechavel_por_aguardando).toBe(true)
  })
  it('dia nao_medido não fecha por aguardando', () => {
    const p = pisos(serie(8, 100_000, i => (i >= 6 ? { alcance_estado: 'nao_medido', impressoes: null, ctr: null } : {})), V2, 10)
    expect(p.fechavel_por_aguardando).toBe(false)
  })
  it('volume nulo sem dia de volume', () => {
    const p = pisos([dia(0, 'o', 1000, 40, 0)], V2, 10)
    expect(p.volume.a).toBeNull()
    expect(p.piso_volume).toBe(false)
  })
})

describe('decidirV2', () => {
  const base = { relogio: 10, teto: 15, estatistica: calc(true) }
  it('relógio < teto e pisos não atingidos => seguir', () => {
    expect(decidirV2({ ...base, pisos: P({ piso_dias: false }) })).toEqual({ acao: 'seguir' })
  })
  it('C-13: sem piso de dias nunca vencedor_provavel', () => {
    for (const relogio of [10, 15, 16]) {
      const d = decidirV2({ ...base, relogio, pisos: P({ piso_dias: false }) })
      expect(d.acao === 'encerrar' && d.desfecho === 'vencedor_provavel').toBe(false)
    }
  })
  it('C-14: teto sem N => inconclusivo_por_volume', () => {
    expect(decidirV2({ ...base, relogio: 15, pisos: P({ piso_volume: false }) })).toMatchObject({ acao: 'encerrar', desfecho: 'inconclusivo_por_volume' })
  })
  it('C-14: teto com dias nao_medido => inconclusivo_por_dado', () => {
    expect(decidirV2({ ...base, relogio: 15, pisos: P({ piso_dias: false }) })).toMatchObject({ desfecho: 'inconclusivo_por_dado' })
  })
  it('C-14: faltam os dois => inconclusivo_por_volume', () => {
    expect(decidirV2({ ...base, relogio: 15, pisos: P({ piso_dias: false, piso_volume: false }) })).toMatchObject({ desfecho: 'inconclusivo_por_volume' })
  })
  it('aguardando que fecharia o piso => aguardando_alcance', () => {
    expect(decidirV2({ ...base, relogio: 15, pisos: P({ piso_dias: false, fechavel_por_aguardando: true }) })).toMatchObject({ desfecho: 'aguardando_alcance' })
  })
  it('relogio = teto + 1 encerra (M4)', () => {
    expect(decidirV2({ ...base, relogio: 16, pisos: P({ piso_dias: false }) }).acao).toBe('encerrar')
  })
  it('no teto com pisos: vencedor com a menor p_adj', () => {
    const e: EstatisticaV2 = { estado: 'calculada', phi: 1, gl: 6, por_variante: [
      { variant_id: 'a', alfa: 0.025, z: 3, z_adj: 3, p_adj: 0.02, sinais_por_bloco: [1], passa: true, lift: 0.1 },
      { variant_id: 'b', alfa: 0.025, z: 4, z_adj: 4, p_adj: 0.005, sinais_por_bloco: [1], passa: true, lift: 0.2 },
    ] }
    expect(decidirV2({ relogio: 15, teto: 15, pisos: P(), estatistica: e })).toEqual({ acao: 'encerrar', desfecho: 'vencedor_provavel', vencedor_sugerido: 'b' })
  })
  it('B1: passa com z negativo nunca vence (mistura: pior e melhor sugere a melhor)', () => {
    const pior = { variant_id: 'a', alfa: 0.025, z: -9, z_adj: -9, p_adj: 0.0001, sinais_por_bloco: [-1], passa: true, lift: -0.3 }
    const melhor = { variant_id: 'b', alfa: 0.025, z: 3, z_adj: 3, p_adj: 0.02, sinais_por_bloco: [1], passa: true, lift: 0.1 }
    const so: EstatisticaV2 = { estado: 'calculada', phi: 1, gl: 6, por_variante: [pior] }
    expect(decidirV2({ relogio: 15, teto: 15, pisos: P(), estatistica: so })).toEqual({ acao: 'encerrar', desfecho: 'sem_diferenca_detectavel', vencedor_sugerido: null }) // sem originalId: nada a sugerir
    const mix: EstatisticaV2 = { estado: 'calculada', phi: 1, gl: 6, por_variante: [pior, melhor] }
    expect(decidirV2({ relogio: 15, teto: 15, pisos: P(), estatistica: mix })).toMatchObject({ desfecho: 'vencedor_provavel', vencedor_sugerido: 'b' })
  })
  const perde = (id: string) => ({ variant_id: id, alfa: 0.025, z: -9, z_adj: -9, p_adj: 0.0001, sinais_por_bloco: [-1, -1], passa: false, lift: -0.3 })
  const neutra = (id: string) => ({ variant_id: id, alfa: 0.025, z: 0.5, z_adj: 0.5, p_adj: 0.6, sinais_por_bloco: [1, -1], passa: false, lift: 0.01 })
  it('B2: V=2, a única variante é pior e significativa => vencedor_provavel com a original', () => {
    const e: EstatisticaV2 = { estado: 'calculada', phi: 1, gl: 6, por_variante: [perde('a')] }
    expect(decidirV2({ relogio: 15, teto: 15, pisos: P(), estatistica: e, originalId: 'o' })).toEqual({ acao: 'encerrar', desfecho: 'vencedor_provavel', vencedor_sugerido: 'o' })
  })
  it('B2: V=3, as duas são piores => original; uma pior e outra neutra => sem_diferenca_detectavel', () => {
    const duas: EstatisticaV2 = { estado: 'calculada', phi: 1, gl: 6, por_variante: [perde('a'), perde('b')] }
    expect(decidirV2({ relogio: 15, teto: 15, pisos: P(), estatistica: duas, originalId: 'o' })).toMatchObject({ desfecho: 'vencedor_provavel', vencedor_sugerido: 'o' })
    const mix: EstatisticaV2 = { estado: 'calculada', phi: 1, gl: 6, por_variante: [perde('a'), neutra('b')] }
    expect(decidirV2({ relogio: 15, teto: 15, pisos: P(), estatistica: mix, originalId: 'o' })).toEqual({ acao: 'encerrar', desfecho: 'sem_diferenca_detectavel', vencedor_sugerido: null })
  })
  it('B2: pior sem significância ou sem consistência por bloco não faz a original vencer', () => {
    const fraca = { ...perde('a'), p_adj: 0.3 }
    const incons = { ...perde('a'), sinais_por_bloco: [-1, 1] }
    for (const x of [fraca, incons]) {
      const e: EstatisticaV2 = { estado: 'calculada', phi: 1, gl: 6, por_variante: [x] }
      expect(decidirV2({ relogio: 15, teto: 15, pisos: P(), estatistica: e, originalId: 'o' })).toMatchObject({ desfecho: 'sem_diferenca_detectavel' })
    }
  })
  it('no teto com pisos e ninguém passa => sem_diferenca_detectavel', () => {
    expect(decidirV2({ relogio: 15, teto: 15, pisos: P(), estatistica: calc(false) })).toEqual({ acao: 'encerrar', desfecho: 'sem_diferenca_detectavel', vencedor_sugerido: null })
  })
  it('pisos atingidos + sem_dado => sem_diferenca_detectavel', () => {
    expect(decidirV2({ relogio: 15, teto: 15, pisos: P(), estatistica: SEM_DADO })).toMatchObject({ desfecho: 'sem_diferenca_detectavel', vencedor_sugerido: null })
  })
  it('◆3: padrão false => seguir com pisos fechados antes do teto; true => encerrar', () => {
    expect(ENCERRA_AO_FECHAR_PISOS).toBe(false)
    expect(decidirV2({ ...base, pisos: P() })).toEqual({ acao: 'seguir' })
    expect(decidirV2({ ...base, pisos: P(), encerraAoFecharPisos: false })).toEqual({ acao: 'seguir' })
    expect(decidirV2({ ...base, pisos: P(), encerraAoFecharPisos: true })).toMatchObject({ acao: 'encerrar', desfecho: 'vencedor_provavel', vencedor_sugerido: 'a' })
  })
})

describe('lerResultadoV2', () => {
  it('ausente, ilegível e ok', () => {
    expect(lerResultadoV2(null)).toEqual({ estado: 'ausente' })
    expect(lerResultadoV2({})).toEqual({ estado: 'ausente' })
    expect(lerResultadoV2({ winner_label: 'x' })).toEqual({ estado: 'ausente' })
    expect(lerResultadoV2({ v2: { n: 'x' } })).toEqual({ estado: 'ilegivel' })
    expect(lerResultadoV2({ v2: { n: 0 } })).toEqual({ estado: 'ilegivel' })
    expect(lerResultadoV2({ v2: { n: null, p1: 0.04 } })).toMatchObject({ estado: 'ok' })
    expect(lerResultadoV2({ v2: { n: 5000, desfecho: 'inconclusivo_por_volume' } })).toMatchObject({ estado: 'ok', v2: { n: 5000 } })
    expect(lerResultadoV2({ v2: { desfecho: 'inventado' } })).toEqual({ estado: 'ilegivel' })
  })
  it('por_variante com 2 entradas em V = 3, lift finito', () => {
    const pv = (id: string) => ({ variant_id: id, alfa: 0.025, z: 1, z_adj: 1, p_adj: 0.3, sinais_por_bloco: [1, -1], passa: false, lift: 0.1 })
    const r = lerResultadoV2({ v2: { por_variante: [pv('a'), pv('b')] } })
    expect(r.estado).toBe('ok')
    if (r.estado === 'ok') expect(r.v2.por_variante?.every(x => Number.isFinite(x.lift))).toBe(true)
  })
})

describe('encerradoEmDia e desfechoProvisorio', () => {
  it('completed_at 00:30 PT dá o dia anterior', () => {
    expect(encerradoEmDia('2026-09-10T07:30:00Z')).toBe('2026-09-09') // 00:30 PDT do dia 10
    expect(encerradoEmDia('2026-09-10T15:00:00Z')).toBe('2026-09-09') // 12:00 PT do dia 10
  })
  it('dia posterior a encerradoEmDia não entra; provisório se algum não é final', () => {
    const dias = serie(12, 100_000, i => (i === 11 ? { final: false } : {}))
    const r = desfechoProvisorio({ dias, encerradoEmDia: '2026-09-12', variantes: V2, originalId: 'o', n: 1000 })
    expect(r.provisorio).toBe(true)
    const r2 = desfechoProvisorio({ dias, encerradoEmDia: '2026-09-11', variantes: V2, originalId: 'o', n: 1000 })
    expect(r2.provisorio).toBe(false)
    expect(['vencedor_provavel', 'sem_diferenca_detectavel']).toContain(r2.desfecho)
  })
  it('sem piso de dias no provisório nunca vence', () => {
    const r = desfechoProvisorio({ dias: serie(12), encerradoEmDia: '2026-09-05', variantes: V2, originalId: 'o', n: 1000 })
    expect(r.desfecho).not.toBe('vencedor_provavel')
    expect(r.vencedor_sugerido).toBeNull()
  })
})
