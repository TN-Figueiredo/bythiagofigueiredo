// F2b T5: estimador da D2 e gatilho. Núcleo puro (sem banco, sem relógio). INALCANÇÁVEL: nada fora de test/ o importa até a
// emenda do gatilho (sem-vazamento.test.ts). Tipos derivados de 20261029000001_f2b_niche_signal_efeitos.sql.
import { z } from 'zod'
import { FONTE_DA_METRICA, REGRA_D2, type MetricaD2, type MetricaLinha } from './regra-d2'

const METRICAS = Object.keys(FONTE_DA_METRICA) as MetricaD2[]
const METRICAS_LINHA: [MetricaLinha, ...MetricaLinha[]] = ['par', ...METRICAS]

/** A partir daqui o placebo de impressões (anos anteriores) é lido; antes, "associação, não causa". */
export const DATA_PLACEBO_IMPRESSOES = '2027-09-08'

// `numeric` do Postgres pode chegar como string
const Numero = z.union([z.number(), z.string().transform(Number)]).refine(Number.isFinite)

export const EfeitoRowSchema = z.object({
  signal_id: z.string(),
  outlier_video_id: z.string(),
  papel: z.enum(['alvo', 'controle']),
  metrica: z.enum(METRICAS_LINHA),
  anos_atras: z.number().int().min(0).max(2),
  pre: Numero.nullable(),
  pos: Numero.nullable(),
  estado: z.enum(['medido', 'nao_medido']),
  motivo: z.string().nullable(),
  dias_sem_cobertura: z.number().nullable(),
  videos_medidos: z.number().nullable(),
  versao_regra: z.string(),
})
export type EfeitoRow = z.infer<typeof EfeitoRowSchema>

export const BracoRowSchema = z.object({
  signal_id: z.string(),
  outlier_video_id: z.string(),
  papel: z.enum(['alvo', 'controle']),
  anos_atras: z.number().int().min(0).max(2),
  chave: z.string(),
  videos: z.array(z.string()),
  chaves_em_evento: z.array(z.string()),
})
export type BracoRow = z.infer<typeof BracoRowSchema>

export type FaltaDoGatilho = 'eventos' | 'volume' | 'idade_impressoes'
export type GatilhoD2 =
  | { estado: 'coletando'; eventosFechados: number; eventosNoPiso: number; faltam: FaltaDoGatilho[] }
  | { estado: 'medindo'; separaEstacao: boolean }

/** Métrica-marcador do gatilho: views totais (R1), a que todo par fechado tem. */
const METRICA_DO_GATILHO: MetricaD2 = 'views_total'

/**
 * (a) e (b) juntos, por evento (Phil I4): >= `eventosMinimos` eventos, cada um com o alvo medido e Σpré >= `pisoPre`.
 * Evento = sinal; os pares do mesmo sinal somam. O que falta: `eventos` (poucos eventos fechados) ou `volume`
 * (eventos suficientes, mas poucos acima do piso).
 */
export function gatilhoD2(p: { linhas: EfeitoRow[]; bracos: BracoRow[]; hoje: string }): GatilhoD2 {
  const preDoEvento = new Map<string, number>()
  for (const l of p.linhas) {
    if (l.metrica !== METRICA_DO_GATILHO || l.papel !== 'alvo' || l.anos_atras !== 0 || l.estado !== 'medido' || l.pre === null) continue
    preDoEvento.set(l.signal_id, (preDoEvento.get(l.signal_id) ?? 0) + l.pre)
  }
  const eventosFechados = preDoEvento.size
  const eventosNoPiso = [...preDoEvento.values()].filter(v => v >= REGRA_D2.pisoPre).length
  const faltam: FaltaDoGatilho[] = []
  if (eventosFechados < REGRA_D2.eventosMinimos) faltam.push('eventos')
  else if (eventosNoPiso < REGRA_D2.eventosMinimos) faltam.push('volume')
  if (faltam.length > 0) return { estado: 'coletando', eventosFechados, eventosNoPiso, faltam }
  return { estado: 'medindo', separaEstacao: p.hoje >= DATA_PLACEBO_IMPRESSOES }
}

/** PRNG semeado (sem dependência nova). */
export function mulberry32(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type EstimativaMedida = {
  estado: 'medido'
  /** Δ por vídeo-dia do alvo menos o do controle, média dos eventos */
  diferenca: number
  /** percentil 2,5 e 97,5 do bootstrap por evento; nulo com menos de 2 eventos */
  ic: [number, number] | null
  /** razão de razões; nulo sem par com Σpré >= piso nos dois braços */
  razao: number | null
  eventos: number
  pares: number
  naoMedidos: number
  autodeclarados: number
  /** mesma diferença sem os pares com outro destino quente na janela (M6) */
  diferencaSemChavesEmEvento: number | null
  eventosSemChavesEmEvento: number
  /** diferença por ano anterior; só com par acima do piso, nunca 0 por ausência */
  placebo?: Partial<Record<1 | 2, number>>
}
export type Estimativa =
  | EstimativaMedida
  | { estado: 'nao_medido'; motivo: 'base_zero' | 'sem_dados'; naoMedidos: number; autodeclarados: number }
  | { estado: 'presenca'; pares: number; apareceu: number; naoApareceu: number; autodeclarados: number }

interface ParCalc { signal: string; deltaA: number; deltaC: number; preA: number; preC: number; razao: number | null; emEvento: boolean }

const chave = (...p: (string | number)[]): string => p.join('|')
const media = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length
const delta = (pre: number, pos: number, n: number): number => (pos / REGRA_D2.posDias - pre / REGRA_D2.preDias) / n

export function estimar(p: {
  linhas: EfeitoRow[]
  bracos: BracoRow[]
  sinais: { signalId: string; dispensaMotivo: string | null }[]
  semente: number
  reamostras: number
}): Record<MetricaD2, Estimativa> {
  const autodeclarado = new Set(p.sinais.filter(s => s.dispensaMotivo === 'ja_fiz').map(s => s.signalId))
  const braco = new Map(p.bracos.map(b => [chave(b.signal_id, b.outlier_video_id, b.papel, b.anos_atras), b]))
  const porMetrica = new Map<MetricaD2, Map<string, EfeitoRow>>()
  for (const l of p.linhas) {
    if (l.metrica === 'par') continue
    const m = porMetrica.get(l.metrica) ?? new Map<string, EfeitoRow>()
    m.set(chave(l.signal_id, l.outlier_video_id, l.papel, l.anos_atras), l)
    porMetrica.set(l.metrica, m)
  }

  const out = {} as Record<MetricaD2, Estimativa>
  for (const metrica of METRICAS) {
    const linhas = porMetrica.get(metrica) ?? new Map<string, EfeitoRow>()
    out[metrica] = metrica === 'prova_related' ? presenca(linhas, autodeclarado) : numerica(linhas)
  }
  return out

  function pares(linhas: Map<string, EfeitoRow>, anos: number): { validos: ParCalc[]; naoMedidos: number; autodeclarados: Set<string> } {
    const validos: ParCalc[] = []
    const autos = new Set<string>()
    let naoMedidos = 0
    for (const a of linhas.values()) {
      if (a.papel !== 'alvo' || a.anos_atras !== anos) continue
      const c = linhas.get(chave(a.signal_id, a.outlier_video_id, 'controle', anos))
      if (autodeclarado.has(a.signal_id)) { autos.add(a.signal_id); continue }
      const ba = braco.get(chave(a.signal_id, a.outlier_video_id, 'alvo', anos)) ?? braco.get(chave(a.signal_id, a.outlier_video_id, 'alvo', 0))
      const bc = braco.get(chave(a.signal_id, a.outlier_video_id, 'controle', anos)) ?? braco.get(chave(a.signal_id, a.outlier_video_id, 'controle', 0))
      if (!c || a.estado !== 'medido' || c.estado !== 'medido' || a.pre === null || a.pos === null || c.pre === null || c.pos === null
        || !ba || !bc || ba.videos.length === 0 || bc.videos.length === 0) { naoMedidos++; continue }
      const ra = a.pre > 0 ? a.pos / REGRA_D2.posDias / (a.pre / REGRA_D2.preDias) : null
      const rc = c.pre > 0 ? c.pos / REGRA_D2.posDias / (c.pre / REGRA_D2.preDias) : null
      const razao = a.pre >= REGRA_D2.pisoPre && c.pre >= REGRA_D2.pisoPre && ra !== null && rc !== null && rc > 0 ? ra / rc : null
      validos.push({
        signal: a.signal_id, preA: a.pre, preC: c.pre, razao,
        deltaA: delta(a.pre, a.pos, ba.videos.length), deltaC: delta(c.pre, c.pos, bc.videos.length),
        emEvento: ba.chaves_em_evento.length > 0 || bc.chaves_em_evento.length > 0,
      })
    }
    return { validos, naoMedidos, autodeclarados: autos }
  }

  /** efeito por evento = média dos pares do sinal; a diferença final é a média dos eventos */
  function porEvento(validos: ParCalc[]): number[] {
    const g = new Map<string, number[]>()
    for (const v of validos) g.set(v.signal, [...(g.get(v.signal) ?? []), v.deltaA - v.deltaC])
    return [...g.values()].map(media)
  }

  function numerica(linhas: Map<string, EfeitoRow>): Estimativa {
    const { validos, naoMedidos, autodeclarados } = pares(linhas, 0)
    const autos = autodeclarados.size
    if (validos.length === 0) return { estado: 'nao_medido', motivo: 'sem_dados', naoMedidos, autodeclarados: autos }
    if (validos.reduce((s, v) => s + v.preA, 0) === 0) return { estado: 'nao_medido', motivo: 'base_zero', naoMedidos, autodeclarados: autos }

    const efeitos = porEvento(validos)
    const sem = validos.filter(v => !v.emEvento)
    const efeitosSem = porEvento(sem)
    const razoes = validos.map(v => v.razao).filter((r): r is number => r !== null)

    // piso do placebo é aplicado aqui: par com Σpré do alvo abaixo de `pisoPre` não entra
    const placebo: Partial<Record<1 | 2, number>> = {}
    for (const ano of [1, 2] as const) {
      const pl = pares(linhas, ano).validos.filter(v => v.preA >= REGRA_D2.pisoPre)
      if (pl.length > 0) placebo[ano] = media(porEvento(pl))
    }

    const est: EstimativaMedida = {
      estado: 'medido',
      diferenca: media(efeitos),
      ic: bootstrap(efeitos),
      razao: razoes.length > 0 ? media(razoes) : null,
      eventos: efeitos.length,
      pares: validos.length,
      naoMedidos,
      autodeclarados: autos,
      diferencaSemChavesEmEvento: efeitosSem.length > 0 ? media(efeitosSem) : null,
      eventosSemChavesEmEvento: efeitosSem.length,
    }
    if (Object.keys(placebo).length > 0) est.placebo = placebo
    return est
  }

  function bootstrap(efeitos: number[]): [number, number] | null {
    if (efeitos.length < 2 || p.reamostras < 1) return null
    const rand = mulberry32(p.semente)
    const medias: number[] = []
    for (let r = 0; r < p.reamostras; r++) {
      let s = 0
      for (let i = 0; i < efeitos.length; i++) s += efeitos[Math.floor(rand() * efeitos.length)]!
      medias.push(s / efeitos.length)
    }
    medias.sort((a, b) => a - b)
    const em = (q: number): number => medias[Math.min(medias.length - 1, Math.max(0, Math.floor(q * medias.length)))]!
    return [em(0.025), em(0.975)]
  }

  /** `prova_related` é presença: `pos` = nº de dias-vídeo em que apareceu; ausência não é zero de views e nada é somado */
  function presenca(linhas: Map<string, EfeitoRow>, autos: Set<string>): Estimativa {
    let apareceu = 0
    let naoApareceu = 0
    const auto = new Set<string>()
    for (const a of linhas.values()) {
      if (a.papel !== 'alvo' || a.anos_atras !== 0 || a.estado !== 'medido' || a.pos === null) continue
      if (autos.has(a.signal_id)) { auto.add(a.signal_id); continue }
      if (a.pos > 0) apareceu++
      else naoApareceu++
    }
    return { estado: 'presenca', pares: apareceu + naoApareceu, apareceu, naoApareceu, autodeclarados: auto.size }
  }
}
