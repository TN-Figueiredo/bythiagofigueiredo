// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  gatilhoD2, estimar, mulberry32, EfeitoRowSchema, BracoRowSchema,
  type EfeitoRow, type BracoRow,
} from '@/lib/youtube/observatorio/sinais/medida/estimador'
import type { MetricaLinha } from '@/lib/youtube/observatorio/sinais/medida/regra-d2'

const sig = (n: number) => `s${n}`
const out = (n: number) => `o${n}`

function linha(p: Partial<EfeitoRow> & { n: number; papel: 'alvo' | 'controle'; metrica: MetricaLinha }): EfeitoRow {
  const { n, ...resto } = p
  return {
    signal_id: sig(n), outlier_video_id: out(n), anos_atras: 0, pre: 100, pos: 100, estado: 'medido', motivo: null,
    dias_sem_cobertura: 0, videos_medidos: 1, versao_regra: 'd2-v1', ...resto,
  }
}
function braco(n: number, papel: 'alvo' | 'controle', videos: number, extra: Partial<BracoRow> = {}): BracoRow {
  return { signal_id: sig(n), outlier_video_id: out(n), papel, anos_atras: 0, chave: 'k', videos: Array.from({ length: videos }, (_, i) => `v${i}`), chaves_em_evento: [], ...extra }
}
/** n eventos, cada um com alvo e controle de views_total */
function eventos(qtd: number, preAlvo = 100, extra: Partial<EfeitoRow> = {}): { linhas: EfeitoRow[]; bracos: BracoRow[] } {
  const linhas: EfeitoRow[] = []
  const bracos: BracoRow[] = []
  for (let n = 1; n <= qtd; n++) {
    linhas.push(linha({ n, papel: 'alvo', metrica: 'views_total', pre: preAlvo, pos: preAlvo, ...extra }), linha({ n, papel: 'controle', metrica: 'views_total', pre: 1000, pos: 1000 }))
    bracos.push(braco(n, 'alvo', 1), braco(n, 'controle', 1))
  }
  return { linhas, bracos }
}
const sinais = (qtd: number, dispensa: Record<number, string> = {}) =>
  Array.from({ length: qtd }, (_, i) => ({ signalId: sig(i + 1), dispensaMotivo: dispensa[i + 1] ?? null }))

describe('gatilhoD2', () => {
  it('9 eventos: coletando, faltam eventos', () => {
    const { linhas, bracos } = eventos(9)
    expect(gatilhoD2({ linhas, bracos, hoje: '2027-10-01' })).toEqual({ estado: 'coletando', eventosFechados: 9, eventosNoPiso: 9, faltam: ['eventos'] })
  })
  it('10 eventos de soma pré 3: coletando, falta volume', () => {
    const { linhas, bracos } = eventos(10, 3)
    const g = gatilhoD2({ linhas, bracos, hoje: '2027-10-01' })
    expect(g).toEqual({ estado: 'coletando', eventosFechados: 10, eventosNoPiso: 0, faltam: ['volume'] })
  })
  it('o piso é por evento: soma dos pares do mesmo evento conta, não a soma geral', () => {
    const { linhas, bracos } = eventos(10, 20)
    // segundo par do evento 1 leva o evento a 40
    linhas.push(linha({ n: 1, papel: 'alvo', metrica: 'views_total', pre: 20 }))
    linhas[linhas.length - 1] = { ...linhas[linhas.length - 1]!, outlier_video_id: 'outro' }
    const g = gatilhoD2({ linhas, bracos, hoje: '2027-10-01' })
    expect(g).toMatchObject({ estado: 'coletando', eventosFechados: 10, eventosNoPiso: 1, faltam: ['volume'] })
  })
  it('10 eventos no piso: medindo; separaEstacao só a partir de 2027-09-08', () => {
    const { linhas, bracos } = eventos(10, 30)
    expect(gatilhoD2({ linhas, bracos, hoje: '2027-09-07' })).toEqual({ estado: 'medindo', separaEstacao: false })
    expect(gatilhoD2({ linhas, bracos, hoje: '2027-09-08' })).toEqual({ estado: 'medindo', separaEstacao: true })
  })
  it('alvo nao_medido não conta como evento fechado', () => {
    const { linhas, bracos } = eventos(10, 30)
    linhas[0] = { ...linhas[0]!, estado: 'nao_medido', motivo: 'cobertura', pre: null, pos: null, videos_medidos: null }
    expect(gatilhoD2({ linhas, bracos, hoje: '2027-10-01' })).toMatchObject({ estado: 'coletando', eventosFechados: 9 })
  })
})

describe('estimar', () => {
  const base = { semente: 7, reamostras: 200 }
  it('alvo de 2 vídeos e controle de 31 com o mesmo +0,1/vídeo/dia: diferença 0', () => {
    // por vídeo-dia: alvo pre 2*28*1 = 56, pos 2*30*1.1 = 66; controle pre 31*28 = 868, pos 31*30*1.1 = 1023
    const linhas = [
      linha({ n: 1, papel: 'alvo', metrica: 'views_total', pre: 56, pos: 66, videos_medidos: 2 }),
      linha({ n: 1, papel: 'controle', metrica: 'views_total', pre: 868, pos: 1023, videos_medidos: 31 }),
    ]
    const bracos = [braco(1, 'alvo', 2), braco(1, 'controle', 31)]
    const e = estimar({ linhas, bracos, sinais: sinais(1), ...base }).views_total
    expect(e.estado).toBe('medido')
    if (e.estado === 'medido') expect(e.diferenca).toBeCloseTo(0, 10)
  })
  it('Σpré = 0: sem NaN nem Infinity, base_zero', () => {
    const { linhas, bracos } = eventos(3, 0, { pos: 10 })
    const e = estimar({ linhas, bracos, sinais: sinais(3), ...base }).views_total
    expect(e).toMatchObject({ estado: 'nao_medido', motivo: 'base_zero' })
    expect(JSON.stringify(e)).not.toMatch(/NaN|Infinity/)
  })
  it('razão só com Σpré ≥ piso nos dois braços', () => {
    const { linhas, bracos } = eventos(3, 20, { pos: 40 })
    const e = estimar({ linhas, bracos, sinais: sinais(3), ...base }).views_total
    expect(e.estado).toBe('medido')
    if (e.estado === 'medido') { expect(e.razao).toBeNull(); expect(Number.isFinite(e.diferenca)).toBe(true) }
    const f = eventos(3, 100, { pos: 200 })
    const e2 = estimar({ linhas: f.linhas, bracos: f.bracos, sinais: sinais(3), ...base }).views_total
    if (e2.estado === 'medido') expect(e2.razao).not.toBeNull()
  })
  it('mesma semente, mesmo intervalo; outra semente, outro', () => {
    const linhas: EfeitoRow[] = []
    const bracos: BracoRow[] = []
    for (let n = 1; n <= 8; n++) {
      linhas.push(linha({ n, papel: 'alvo', metrica: 'views_total', pre: 100, pos: 100 + n * 37 }), linha({ n, papel: 'controle', metrica: 'views_total', pre: 100, pos: 100 + (n % 3) * 11 }))
      bracos.push(braco(n, 'alvo', 1), braco(n, 'controle', 1))
    }
    const ic = (semente: number) => {
      const e = estimar({ linhas, bracos, sinais: sinais(8), semente, reamostras: 300 }).views_total
      return e.estado === 'medido' ? e.ic : null
    }
    expect(ic(1)).toEqual(ic(1))
    expect(ic(1)).not.toEqual(ic(2))
  })
  it('ja_fiz dado depois do fecho tira o par da soma do alvo e conta à parte', () => {
    const { linhas, bracos } = eventos(4, 100)
    const e = estimar({ linhas, bracos, sinais: sinais(4, { 2: 'ja_fiz', 3: 'nao_interessa' }), ...base }).views_total
    expect(e).toMatchObject({ estado: 'medido', eventos: 3, autodeclarados: 1 })
  })
  it('par nao_medido fica fora e é contado à parte', () => {
    const { linhas, bracos } = eventos(3)
    linhas[0] = { ...linhas[0]!, estado: 'nao_medido', motivo: 'cobertura', pre: null, pos: null, videos_medidos: null }
    const e = estimar({ linhas, bracos, sinais: sinais(3), ...base }).views_total
    expect(e).toMatchObject({ estado: 'medido', eventos: 2, naoMedidos: 1 })
  })
  it('prova_related entra como presença, nunca somada com views', () => {
    const { linhas, bracos } = eventos(2)
    linhas.push(
      linha({ n: 1, papel: 'alvo', metrica: 'prova_related', pre: 0, pos: 5 }), linha({ n: 1, papel: 'controle', metrica: 'prova_related', pre: 0, pos: 0 }),
      linha({ n: 2, papel: 'alvo', metrica: 'prova_related', pre: 0, pos: 0 }), linha({ n: 2, papel: 'controle', metrica: 'prova_related', pre: 0, pos: 0 }),
    )
    const e = estimar({ linhas, bracos, sinais: sinais(2), ...base })
    expect(e.prova_related).toEqual({ estado: 'presenca', pares: 2, apareceu: 1, naoApareceu: 1, autodeclarados: 0 })
    expect(e.views_total).toMatchObject({ estado: 'medido', eventos: 2 })
  })
  it('placebo abaixo do piso não aparece; sem linha não aparece; acima do piso aparece', () => {
    const { linhas, bracos } = eventos(3, 100)
    const semPlacebo = estimar({ linhas, bracos, sinais: sinais(3), ...base }).views_total
    expect(semPlacebo.estado === 'medido' && 'placebo' in semPlacebo && semPlacebo.placebo !== undefined).toBe(false)

    const pl = (pre: number) => [1, 2, 3].flatMap(n => [
      linha({ n, papel: 'alvo', metrica: 'views_total', anos_atras: 1, pre, pos: pre }), linha({ n, papel: 'controle', metrica: 'views_total', anos_atras: 1, pre: 1000, pos: 1000 }),
    ])
    const baixo = estimar({ linhas: [...linhas, ...pl(10)], bracos, sinais: sinais(3), ...base }).views_total
    expect(baixo.estado === 'medido' && baixo.placebo !== undefined).toBe(false)
    const alto = estimar({ linhas: [...linhas, ...pl(100)], bracos, sinais: sinais(3), ...base }).views_total
    expect(alto.estado === 'medido' && Number.isFinite(alto.placebo?.[1])).toBe(true)
    expect(alto.estado === 'medido' && alto.placebo?.[2]).toBeUndefined()
  })
  it('sensibilidade: sem os pares com outros destinos quentes (M6)', () => {
    const { linhas, bracos } = eventos(4, 100)
    bracos[1] = braco(1, 'controle', 1, { chaves_em_evento: ['outra'] })
    const e = estimar({ linhas, bracos, sinais: sinais(4), ...base }).views_total
    expect(e).toMatchObject({ estado: 'medido', eventos: 4, eventosSemChavesEmEvento: 3 })
  })
  it('métrica sem nenhuma linha: nao_medido sem_dados', () => {
    const e = estimar({ linhas: [], bracos: [], sinais: [], ...base })
    expect(e.views_busca).toMatchObject({ estado: 'nao_medido', motivo: 'sem_dados' })
  })
})

describe('peças', () => {
  it('mulberry32 é determinístico e fica em [0,1)', () => {
    const a = mulberry32(5)
    const b = mulberry32(5)
    for (let i = 0; i < 20; i++) { const x = a(); expect(x).toBe(b()); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1) }
  })
  it('Zod aceita numeric como string e recusa estado desconhecido', () => {
    const l = EfeitoRowSchema.parse({ ...linha({ n: 1, papel: 'alvo', metrica: 'views_total' }), pre: '12.5', pos: '3' })
    expect(l.pre).toBe(12.5)
    expect(() => EfeitoRowSchema.parse({ ...linha({ n: 1, papel: 'alvo', metrica: 'views_total' }), estado: 'x' })).toThrow()
    expect(() => BracoRowSchema.parse({ ...braco(1, 'alvo', 1), videos: 'a' })).toThrow()
  })
})
