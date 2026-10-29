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
    expect(gatilhoD2({ linhas, bracos, sinais: sinais(10), hoje: '2027-10-01' })).toEqual({ estado: 'coletando', eventosFechados: 9, eventosNoPiso: 9, faltam: ['eventos'] })
  })
  it('10 eventos de soma pré 3: coletando, falta volume', () => {
    const { linhas, bracos } = eventos(10, 3)
    const g = gatilhoD2({ linhas, bracos, sinais: sinais(10), hoje: '2027-10-01' })
    expect(g).toEqual({ estado: 'coletando', eventosFechados: 10, eventosNoPiso: 0, faltam: ['volume'] })
  })
  it('o piso é pela MÉDIA dos pares do evento (I1): dois pares de pré 20 não viram 40', () => {
    const { linhas, bracos } = eventos(10, 20)
    linhas.push(
      linha({ n: 1, papel: 'alvo', metrica: 'views_total', pre: 20, pos: 20, outlier_video_id: 'outro' }),
      linha({ n: 1, papel: 'controle', metrica: 'views_total', pre: 1000, pos: 1000, outlier_video_id: 'outro' }),
    )
    const g = gatilhoD2({ linhas, bracos, sinais: sinais(10), hoje: '2027-10-01' })
    expect(g).toEqual({ estado: 'coletando', eventosFechados: 10, eventosNoPiso: 0, faltam: ['volume'] })
  })
  it('I2: 10 eventos no piso com o controle nao_medido em um: coletando, 9 fechados', () => {
    const { linhas, bracos } = eventos(10, 100)
    linhas[1] = { ...linhas[1]!, estado: 'nao_medido', motivo: 'cobertura', pre: null, pos: null, videos_medidos: null }
    expect(gatilhoD2({ linhas, bracos, sinais: sinais(10), hoje: '2027-10-01' })).toMatchObject({ estado: 'coletando', eventosFechados: 9 })
  })
  it('I2: 10 eventos de controle não medido: coletando, não medindo', () => {
    const { linhas, bracos } = eventos(10, 100)
    const l2 = linhas.map(l => l.papel === 'controle' ? { ...l, estado: 'nao_medido' as const, motivo: 'cobertura', pre: null, pos: null, videos_medidos: null } : l)
    expect(gatilhoD2({ linhas: l2, bracos, sinais: sinais(10), hoje: '2027-10-01' })).toMatchObject({ estado: 'coletando', eventosFechados: 0 })
  })
  it('I2: ja_fiz tira o evento do gatilho; e gatilho medindo implica estimador com >= 10 eventos', () => {
    const { linhas, bracos } = eventos(10, 100)
    expect(gatilhoD2({ linhas, bracos, sinais: sinais(10, { 3: 'ja_fiz' }), hoje: '2027-10-01' })).toMatchObject({ estado: 'coletando', faltam: ['eventos'] })
    expect(gatilhoD2({ linhas, bracos, sinais: sinais(10), hoje: '2027-10-01' }).estado).toBe('medindo')
    const e = estimar({ linhas, bracos, sinais: sinais(10), semente: 1, reamostras: 50 }).views_total
    expect(e.estado === 'medido' && e.eventos >= 10).toBe(true)
  })
  it('hoje fora de AAAA-MM-DD lança', () => {
    const { linhas, bracos } = eventos(10, 100)
    expect(() => gatilhoD2({ linhas, bracos, sinais: sinais(10), hoje: '2027-9-8' })).toThrow()
  })
  it('10 eventos no piso: medindo; separaEstacao só a partir de 2027-09-08', () => {
    const { linhas, bracos } = eventos(10, 30)
    expect(gatilhoD2({ linhas, bracos, sinais: sinais(10), hoje: '2027-09-07' })).toEqual({ estado: 'medindo', separaEstacao: false })
    expect(gatilhoD2({ linhas, bracos, sinais: sinais(10), hoje: '2027-09-08' })).toEqual({ estado: 'medindo', separaEstacao: true })
  })
  it('alvo nao_medido não conta como evento fechado', () => {
    const { linhas, bracos } = eventos(10, 30)
    linhas[0] = { ...linhas[0]!, estado: 'nao_medido', motivo: 'cobertura', pre: null, pos: null, videos_medidos: null }
    expect(gatilhoD2({ linhas, bracos, sinais: sinais(10), hoje: '2027-10-01' })).toMatchObject({ estado: 'coletando', eventosFechados: 9 })
  })
})

describe('estimar', () => {
  const base = { semente: 7, reamostras: 200 }
  it('alvo de 2 vídeos e controle de 31 com o mesmo +0,1/vídeo/dia: diferença 0', () => {
    // por vídeo-dia: alvo pre 2*28*1 = 56, pos 2*30*1.1 = 66; controle pre 31*28 = 868, pos 31*30*1.1 = 1023
    const linhas: EfeitoRow[] = []
    const bracos: BracoRow[] = []
    for (let n = 1; n <= 10; n++) {
      linhas.push(linha({ n, papel: 'alvo', metrica: 'views_total', pre: 56, pos: 66, videos_medidos: 2 }), linha({ n, papel: 'controle', metrica: 'views_total', pre: 868, pos: 1023, videos_medidos: 31 }))
      bracos.push(braco(n, 'alvo', 2), braco(n, 'controle', 31))
    }
    const e = estimar({ linhas, bracos, sinais: sinais(10), ...base }).views_total
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
    // pré 20 < piso: o evento fica abaixo do piso de volume (B2) e o estimador não devolve número
    const { linhas, bracos } = eventos(10, 20, { pos: 40 })
    const e = estimar({ linhas, bracos, sinais: sinais(10), ...base }).views_total
    expect(e).toMatchObject({ estado: 'nao_medido', motivo: 'volume', eventosNoPiso: 0 })
    const f = eventos(10, 100, { pos: 200 })
    const e2 = estimar({ linhas: f.linhas, bracos: f.bracos, sinais: sinais(10), ...base }).views_total
    expect(e2.estado === 'medido' && e2.razao !== null && Number.isFinite(e2.razao)).toBe(true)
  })
  it('mesma semente, mesmo intervalo; outra semente, outro', () => {
    const linhas: EfeitoRow[] = []
    const bracos: BracoRow[] = []
    for (let n = 1; n <= 10; n++) {
      linhas.push(linha({ n, papel: 'alvo', metrica: 'views_total', pre: 100, pos: 100 + n * 37 }), linha({ n, papel: 'controle', metrica: 'views_total', pre: 100, pos: 100 + (n % 3) * 11 }))
      bracos.push(braco(n, 'alvo', 1), braco(n, 'controle', 1))
    }
    const ic = (semente: number) => {
      const e = estimar({ linhas, bracos, sinais: sinais(10), semente, reamostras: 300 }).views_total
      return e.estado === 'medido' ? e.ic : null
    }
    expect(ic(1)).toEqual(ic(1))
    expect(ic(1)).not.toEqual(ic(2))
  })
  it('ja_fiz dado depois do fecho tira o par da soma do alvo e conta à parte', () => {
    const { linhas, bracos } = eventos(12, 100)
    const e = estimar({ linhas, bracos, sinais: sinais(12, { 2: 'ja_fiz', 3: 'nao_interessa' }), ...base }).views_total
    expect(e).toMatchObject({ estado: 'medido', eventos: 11, autodeclarados: 1 })
  })
  it('par nao_medido fica fora e é contado à parte', () => {
    const { linhas, bracos } = eventos(11)
    linhas[0] = { ...linhas[0]!, estado: 'nao_medido', motivo: 'cobertura', pre: null, pos: null, videos_medidos: null }
    const e = estimar({ linhas, bracos, sinais: sinais(11), ...base }).views_total
    expect(e).toMatchObject({ estado: 'medido', eventos: 10, naoMedidos: 1 })
  })
  it('prova_related entra como presença, nunca somada com views', () => {
    const { linhas, bracos } = eventos(2)
    linhas.push(
      linha({ n: 1, papel: 'alvo', metrica: 'prova_related', pre: 0, pos: 5 }), linha({ n: 1, papel: 'controle', metrica: 'prova_related', pre: 0, pos: 0 }),
      linha({ n: 2, papel: 'alvo', metrica: 'prova_related', pre: 0, pos: 0 }), linha({ n: 2, papel: 'controle', metrica: 'prova_related', pre: 0, pos: 0 }),
    )
    const e = estimar({ linhas, bracos, sinais: sinais(2), ...base })
    expect(e.prova_related).toEqual({ estado: 'presenca', pares: 2, apareceu: 1, naoApareceu: 1, naoMedidos: 0, descartados: {}, autodeclarados: 0 })
    expect(e.views_total).toMatchObject({ estado: 'nao_medido', motivo: 'volume' })
  })
  it('placebo abaixo do piso não aparece; sem linha não aparece; acima do piso aparece', () => {
    const { linhas, bracos } = eventos(10, 100)
    const semPlacebo = estimar({ linhas, bracos, sinais: sinais(10), ...base }).views_total
    expect(semPlacebo.estado === 'medido' && 'placebo' in semPlacebo && semPlacebo.placebo !== undefined).toBe(false)

    const pl = (pre: number) => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap(n => [
      linha({ n, papel: 'alvo', metrica: 'views_total', anos_atras: 1, pre, pos: pre }), linha({ n, papel: 'controle', metrica: 'views_total', anos_atras: 1, pre: 1000, pos: 1000 }),
    ])
    const baixo = estimar({ linhas: [...linhas, ...pl(10)], bracos, sinais: sinais(10), ...base }).views_total
    expect(baixo.estado === 'medido' && baixo.placebo !== undefined).toBe(false)
    const alto = estimar({ linhas: [...linhas, ...pl(100)], bracos, sinais: sinais(10), ...base }).views_total
    expect(alto.estado === 'medido' && Number.isFinite(alto.placebo?.[1]?.valor) && alto.placebo?.[1]?.eventos === 10).toBe(true)
    expect(alto.estado === 'medido' && alto.placebo?.[2]).toBeUndefined()
  })
  it('sensibilidade: sem os pares com outros destinos quentes (M6)', () => {
    const { linhas, bracos } = eventos(10, 100)
    bracos[1] = braco(1, 'controle', 1, { chaves_em_evento: ['outra'] })
    const e = estimar({ linhas, bracos, sinais: sinais(10), ...base }).views_total
    expect(e).toMatchObject({ estado: 'medido', eventos: 10, eventosSemChavesEmEvento: 9 })
  })
  it('métrica sem nenhuma linha: nao_medido sem_dados', () => {
    const e = estimar({ linhas: [], bracos: [], sinais: [], ...base })
    expect(e.views_busca).toMatchObject({ estado: 'nao_medido', motivo: 'sem_dados' })
  })
})

describe('consertos T5 r1', () => {
  const base = { semente: 7, reamostras: 100 }
  it('B1: braços crescendo igual com cobertura 80% x 100%: diferença 0', () => {
    const { linhas, bracos } = eventos(10, 100)
    // alvo de 5 vídeos, 4 entraram; controle 31/31; os dois sobem +0,1/vídeo/dia
    for (let n = 1; n <= 10; n++) {
      const i = (papel: 'alvo' | 'controle') => linhas.findIndex(l => l.signal_id === sig(n) && l.papel === papel)
      linhas[i('alvo')] = { ...linhas[i('alvo')]!, pre: 4 * 28 * 10, pos: 4 * 30 * 11, videos_medidos: 4 }
      linhas[i('controle')] = { ...linhas[i('controle')]!, pre: 31 * 28 * 10, pos: 31 * 30 * 11, videos_medidos: 31 }
      bracos[(n - 1) * 2] = braco(n, 'alvo', 5)
      bracos[(n - 1) * 2 + 1] = braco(n, 'controle', 31)
    }
    const e = estimar({ linhas, bracos, sinais: sinais(10), ...base }).views_total
    expect(e.estado).toBe('medido')
    if (e.estado === 'medido') expect(e.diferenca).toBeCloseTo(0, 10)
  })
  it('B2: piso de volume por métrica', () => {
    const v = eventos(10, 100)
    const linhas = [...v.linhas]
    for (let n = 1; n <= 10; n++) linhas.push(
      linha({ n, papel: 'alvo', metrica: 'impressoes_busca', pre: 3, pos: 9 }), linha({ n, papel: 'controle', metrica: 'impressoes_busca', pre: 3, pos: 3 }))
    const e = estimar({ linhas, bracos: v.bracos, sinais: sinais(10), ...base })
    expect(e.views_total.estado).toBe('medido')
    expect(e.impressoes_busca).toMatchObject({ estado: 'nao_medido', motivo: 'volume', eventosNoPiso: 0 })
    expect('diferenca' in e.impressoes_busca).toBe(false)
  })
  it('Y5-3: razões 0,5 e 2 por evento: razão 1; mais pares num evento não pesam mais', () => {
    const { linhas, bracos } = eventos(10, 100)
    linhas.forEach((l, i) => {
      if (l.papel === 'alvo') linhas[i] = { ...l, pos: 100 * (30 / 28) * (Number(l.signal_id.slice(1)) % 2 === 0 ? 2 : 0.5) }
      else linhas[i] = { ...l, pos: 1000 * (30 / 28) }
    })
    for (let k = 0; k < 3; k++) {
      linhas.push(
        linha({ n: 1, papel: 'alvo', metrica: 'views_total', outlier_video_id: `x${k}`, pre: 100, pos: 100 * (30 / 28) * 0.5 }),
        linha({ n: 1, papel: 'controle', metrica: 'views_total', outlier_video_id: `x${k}`, pre: 1000, pos: 1000 * (30 / 28) }),
      )
    }
    const e = estimar({ linhas, bracos, sinais: sinais(10), ...base }).views_total
    expect(e.estado).toBe('medido')
    if (e.estado === 'medido') { expect(e.razao).toBeCloseTo(1, 10); expect(JSON.stringify(e)).not.toMatch(/NaN|Infinity/) }
  })
  it('I3: pares descartados na linha par e nao_medido de prova_related contados à parte', () => {
    const { linhas, bracos } = eventos(10, 100)
    linhas.push(
      linha({ n: 11, papel: 'alvo', metrica: 'par', estado: 'nao_medido', motivo: 'contaminacao_desconhecida', pre: null, pos: null, videos_medidos: null }),
      linha({ n: 12, papel: 'alvo', metrica: 'par', estado: 'nao_medido', motivo: 'sem_controle', pre: null, pos: null, videos_medidos: null }),
      linha({ n: 1, papel: 'alvo', metrica: 'prova_related', estado: 'nao_medido', motivo: 'detalhe_ausente', pre: null, pos: null, videos_medidos: null }),
    )
    const e = estimar({ linhas, bracos, sinais: sinais(10), ...base })
    expect(e.views_total).toMatchObject({ descartados: { contaminacao_desconhecida: 1, sem_controle: 1 } })
    expect(e.prova_related).toMatchObject({ estado: 'presenca', naoMedidos: 1, descartados: { contaminacao_desconhecida: 1, sem_controle: 1 } })
  })
})

describe('consertos T5 r2', () => {
  const base = { semente: 7, reamostras: 100 }
  it('R1: par sem braço fica fora da sensibilidade e é contado em bracoAusente', () => {
    const { linhas, bracos } = eventos(10, 100)
    const sem = bracos.filter(b => b.signal_id !== sig(1))
    const e = estimar({ linhas, bracos: sem, sinais: sinais(10), ...base }).views_total
    expect(e).toMatchObject({ estado: 'medido', eventos: 10, eventosSemChavesEmEvento: 9, bracoAusente: 1 })
  })
  it('R2: 2 de 10 eventos com alvo pós 0: eventosSemRazao 2, paresRazaoZero 2', () => {
    const { linhas, bracos } = eventos(10, 100)
    linhas.forEach((l, i) => { if (l.papel === 'alvo' && (l.signal_id === sig(1) || l.signal_id === sig(2))) linhas[i] = { ...l, pos: 0 } })
    const e = estimar({ linhas, bracos, sinais: sinais(10), ...base }).views_total
    expect(e).toMatchObject({ estado: 'medido', eventos: 10, eventosSemRazao: 2, paresRazaoZero: 2 })
  })
  it('R3: placebo de 1 evento devolve eventos 1; piso pela média por evento', () => {
    const { linhas, bracos } = eventos(10, 100)
    linhas.push(
      linha({ n: 1, papel: 'alvo', metrica: 'views_total', anos_atras: 1, pre: 100, pos: 100 }),
      linha({ n: 1, papel: 'controle', metrica: 'views_total', anos_atras: 1, pre: 1000, pos: 1000 }),
    )
    const e = estimar({ linhas, bracos, sinais: sinais(10), ...base }).views_total
    expect(e.estado === 'medido' && e.placebo?.[1]?.eventos).toBe(1)
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
    expect(() => EfeitoRowSchema.parse({ ...linha({ n: 1, papel: 'alvo', metrica: 'views_total' }), pre: '' })).toThrow()
    expect(() => BracoRowSchema.parse({ ...braco(1, 'alvo', 1), videos: 'a' })).toThrow()
  })
})
