// F2b T5: estimador da D2 e gatilho. Núcleo puro (sem banco, sem relógio). INALCANÇÁVEL: nada fora de test/ o importa até a
// emenda do gatilho (sem-vazamento.test.ts). Tipos derivados de 20261029000001_f2b_niche_signal_efeitos.sql.
import { z } from 'zod'
import { FONTE_DA_METRICA, REGRA_D2, type MetricaD2, type MetricaLinha } from './regra-d2'

const METRICAS = Object.keys(FONTE_DA_METRICA) as MetricaD2[]
const METRICAS_LINHA: [MetricaLinha, ...MetricaLinha[]] = ['par', ...METRICAS]

/** A partir daqui o placebo de impressões (anos anteriores) é lido; antes, "associação, não causa". */
export const DATA_PLACEBO_IMPRESSOES = '2027-09-08'

// `numeric` do Postgres pode chegar como string
// `''` não vira 0: só texto numérico
const Numero = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]).refine(Number.isFinite)

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
  videos_medidos: z.number().int().nullable(),
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

export type FaltaDoGatilho = 'eventos' | 'volume'
export type GatilhoD2 =
  | { estado: 'coletando'; eventosFechados: number; eventosNoPiso: number; faltam: FaltaDoGatilho[] }
  | { estado: 'medindo'; separaEstacao: boolean }

type Sinal = { signalId: string; dispensaMotivo: string | null }

/** Métrica-marcador do gatilho: views totais (R1), a que todo par fechado tem. */
const METRICA_DO_GATILHO: MetricaD2 = 'views_total'

export interface ParCalc { signal: string; deltaA: number; deltaC: number; preA: number; preC: number; razao: number | null; razaoZero: boolean
  /** `null` = sem braço gravado: não se sabe se há outro destino quente, não é "limpo" */
  emEvento: boolean | null }

const chave = (...p: (string | number)[]): string => p.join('|')
const media = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length
const delta = (pre: number, pos: number, n: number): number => (pos / REGRA_D2.posDias - pre / REGRA_D2.preDias) / n
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/

function indiceDe(linhas: EfeitoRow[], metrica: MetricaD2): Map<string, EfeitoRow> {
  const m = new Map<string, EfeitoRow>()
  for (const l of linhas) if (l.metrica === metrica) m.set(chave(l.signal_id, l.outlier_video_id, l.papel, l.anos_atras), l)
  return m
}
const autodeclaradosDe = (sinais: Sinal[]): Set<string> => new Set(sinais.filter(s => s.dispensaMotivo === 'ja_fiz').map(s => s.signalId))
const bracosDe = (bracos: BracoRow[]): Map<string, BracoRow> =>
  new Map(bracos.map(b => [chave(b.signal_id, b.outlier_video_id, b.papel, b.anos_atras), b]))

/**
 * Regra ÚNICA de validade do par (gatilho e estimador): alvo e controle `medido` com pré, pós e `videos_medidos > 0`,
 * sinal não `ja_fiz` (lido na hora, E-b2). O Δ divide por `videos_medidos` (o que a soma cobriu), não pelo braço
 * congelado. O braço só informa `chaves_em_evento`.
 */
export function paresValidos(p: {
  linhas: Map<string, EfeitoRow>; bracos: Map<string, BracoRow>; autodeclarado: Set<string>; anos: number
}): { validos: ParCalc[]; naoMedidos: number; autodeclarados: Set<string> } {
  const validos: ParCalc[] = []
  const autos = new Set<string>()
  let naoMedidos = 0
  for (const a of p.linhas.values()) {
    if (a.papel !== 'alvo' || a.anos_atras !== p.anos) continue
    if (p.autodeclarado.has(a.signal_id)) { autos.add(a.signal_id); continue }
    const c = p.linhas.get(chave(a.signal_id, a.outlier_video_id, 'controle', p.anos))
    if (!c || a.estado !== 'medido' || c.estado !== 'medido' || a.pre === null || a.pos === null || c.pre === null || c.pos === null
      || !a.videos_medidos || a.videos_medidos <= 0 || !c.videos_medidos || c.videos_medidos <= 0) { naoMedidos++; continue }
    const ba = p.bracos.get(chave(a.signal_id, a.outlier_video_id, 'alvo', p.anos)) ?? p.bracos.get(chave(a.signal_id, a.outlier_video_id, 'alvo', 0))
    const bc = p.bracos.get(chave(a.signal_id, a.outlier_video_id, 'controle', p.anos)) ?? p.bracos.get(chave(a.signal_id, a.outlier_video_id, 'controle', 0))
    const ra = a.pre > 0 ? a.pos / REGRA_D2.posDias / (a.pre / REGRA_D2.preDias) : null
    const rc = c.pre > 0 ? c.pos / REGRA_D2.posDias / (c.pre / REGRA_D2.preDias) : null
    const bruta = a.pre >= REGRA_D2.pisoPre && c.pre >= REGRA_D2.pisoPre && ra !== null && rc !== null && rc > 0 ? ra / rc : null
    validos.push({
      signal: a.signal_id, preA: a.pre, preC: c.pre,
      // razão <= 0 não entra na média geométrica (log); fica fora, não vira número
      razao: bruta !== null && bruta > 0 && Number.isFinite(bruta) ? bruta : null,
      razaoZero: bruta === 0,
      deltaA: delta(a.pre, a.pos, a.videos_medidos), deltaC: delta(c.pre, c.pos, c.videos_medidos),
      emEvento: !ba || !bc ? null : ba.chaves_em_evento.length > 0 || bc.chaves_em_evento.length > 0,
    })
  }
  return { validos, naoMedidos, autodeclarados: autos }
}

interface EventoCalc { signal: string; efeito: number; preMedio: number; logRazao: number | null; pares: ParCalc[] }

/** Evento = sinal. Efeito, Σpré do alvo e razão são a média dos pares do evento (peso igual por evento). */
function agruparEventos(validos: ParCalc[]): EventoCalc[] {
  const g = new Map<string, ParCalc[]>()
  for (const v of validos) { const a = g.get(v.signal); if (a) a.push(v); else g.set(v.signal, [v]) }
  return [...g.entries()].map(([signal, pares]) => {
    const logs = pares.map(x => x.razao).filter((r): r is number => r !== null).map(Math.log)
    return {
      signal, pares,
      efeito: media(pares.map(x => x.deltaA - x.deltaC)),
      preMedio: media(pares.map(x => x.preA)),
      logRazao: logs.length > 0 ? media(logs) : null,
    }
  })
}

/**
 * (a) e (b) juntos, por evento: >= `eventosMinimos` eventos válidos (mesma regra do estimador), cada um com a MÉDIA
 * do Σpré do alvo entre os seus pares >= `pisoPre`. O que falta: `eventos` ou `volume`.
 */
export function gatilhoD2(p: { linhas: EfeitoRow[]; bracos: BracoRow[]; sinais: Sinal[]; hoje: string }): GatilhoD2 {
  if (!FORMATO_DATA.test(p.hoje)) throw new Error(`hoje fora do formato AAAA-MM-DD: ${p.hoje}`)
  const { validos } = paresValidos({
    linhas: indiceDe(p.linhas, METRICA_DO_GATILHO), bracos: bracosDe(p.bracos), autodeclarado: autodeclaradosDe(p.sinais), anos: 0,
  })
  const eventos = agruparEventos(validos)
  const eventosFechados = eventos.length
  const eventosNoPiso = eventos.filter(e => e.preMedio >= REGRA_D2.pisoPre).length
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

/** Pares descartados inteiros (linha `par`), por motivo; repetido em toda métrica para o denominador não sumir. */
export type Descartados = Record<string, number>

export type EstimativaMedida = {
  estado: 'medido'
  /** Δ por vídeo-dia do alvo menos o do controle, média dos eventos no piso de volume */
  diferenca: number
  /** percentil 2,5 e 97,5 do bootstrap por evento; nulo com menos de 2 eventos */
  ic: [number, number] | null
  /** razão de razões: média geométrica por evento, depois entre eventos; nulo sem par com Σpré >= piso nos dois braços */
  razao: number | null
  eventos: number
  /** eventos válidos abaixo do piso de volume (fora da diferença) */
  eventosAbaixoDoPiso: number
  pares: number
  naoMedidos: number
  descartados: Descartados
  autodeclarados: number
  /** mesma diferença sem os pares com outro destino quente na janela (M6) */
  diferencaSemChavesEmEvento: number | null
  eventosSemChavesEmEvento: number
  /** pares (no piso) sem braço gravado: ficam fora da sensibilidade, contados aqui */
  bracoAusente: number
  /** eventos no piso sem razão (todos os pares com razão <= 0 ou sem piso nos dois braços): a razão cobre `eventos - eventosSemRazao` */
  eventosSemRazao: number
  /** pares no piso cujo alvo caiu a 0 (razão 0, fora do log) */
  paresRazaoZero: number
  /** diferença por ano anterior; só com par acima do piso, nunca 0 por ausência */
  placebo?: Partial<Record<1 | 2, { valor: number; eventos: number }>>
}
export type Estimativa =
  | EstimativaMedida
  | { estado: 'nao_medido'; motivo: 'base_zero' | 'sem_dados'; naoMedidos: number; descartados: Descartados; autodeclarados: number }
  | { estado: 'nao_medido'; motivo: 'volume'; eventos: number; eventosNoPiso: number; naoMedidos: number; descartados: Descartados; autodeclarados: number }
  | { estado: 'presenca'; pares: number; apareceu: number; naoApareceu: number; naoMedidos: number; descartados: Descartados; autodeclarados: number }

export function estimar(p: {
  linhas: EfeitoRow[]
  bracos: BracoRow[]
  sinais: Sinal[]
  semente: number
  reamostras: number
}): Record<MetricaD2, Estimativa> {
  const autodeclarado = autodeclaradosDe(p.sinais)
  const braco = bracosDe(p.bracos)
  const descartados: Descartados = {}
  for (const l of p.linhas) {
    if (l.metrica !== 'par' || l.anos_atras !== 0 || l.estado !== 'nao_medido') continue
    const m = l.motivo ?? 'sem_motivo'
    descartados[m] = (descartados[m] ?? 0) + 1
  }

  const out = {} as Record<MetricaD2, Estimativa>
  for (const metrica of METRICAS) {
    const linhas = indiceDe(p.linhas, metrica)
    out[metrica] = metrica === 'prova_related' ? presenca(linhas) : numerica(linhas)
  }
  return out

  function numerica(linhas: Map<string, EfeitoRow>): Estimativa {
    const { validos, naoMedidos, autodeclarados } = paresValidos({ linhas, bracos: braco, autodeclarado, anos: 0 })
    const autos = autodeclarados.size
    if (validos.length === 0) return { estado: 'nao_medido', motivo: 'sem_dados', naoMedidos, descartados: { ...descartados }, autodeclarados: autos }
    if (validos.reduce((s, v) => s + v.preA, 0) === 0) return { estado: 'nao_medido', motivo: 'base_zero', naoMedidos, descartados: { ...descartados }, autodeclarados: autos }

    const todos = agruparEventos(validos)
    const noPiso = todos.filter(e => e.preMedio >= REGRA_D2.pisoPre)
    if (noPiso.length < REGRA_D2.eventosMinimos) {
      return { estado: 'nao_medido', motivo: 'volume', eventos: todos.length, eventosNoPiso: noPiso.length, naoMedidos, descartados: { ...descartados }, autodeclarados: autos }
    }
    const paresNoPiso = noPiso.flatMap(e => e.pares)
    const efeitos = noPiso.map(e => e.efeito)
    const efeitosSem = agruparEventos(paresNoPiso.filter(v => v.emEvento === false)).map(e => e.efeito)
    const logs = noPiso.map(e => e.logRazao).filter((r): r is number => r !== null)

    // piso do placebo pela média por evento (como o resto); `eventos` vai junto: a frase só usa com >= eventosMinimos
    const placebo: Partial<Record<1 | 2, { valor: number; eventos: number }>> = {}
    for (const ano of [1, 2] as const) {
      const pl = agruparEventos(paresValidos({ linhas, bracos: braco, autodeclarado, anos: ano }).validos).filter(e => e.preMedio >= REGRA_D2.pisoPre)
      if (pl.length > 0) placebo[ano] = { valor: media(pl.map(e => e.efeito)), eventos: pl.length }
    }

    const est: EstimativaMedida = {
      estado: 'medido',
      diferenca: media(efeitos),
      ic: bootstrap(efeitos),
      razao: logs.length > 0 ? Math.exp(media(logs)) : null,
      eventos: noPiso.length,
      eventosAbaixoDoPiso: todos.length - noPiso.length,
      pares: paresNoPiso.length,
      naoMedidos,
      descartados: { ...descartados },
      autodeclarados: autos,
      diferencaSemChavesEmEvento: efeitosSem.length > 0 ? media(efeitosSem) : null,
      eventosSemChavesEmEvento: efeitosSem.length,
      bracoAusente: paresNoPiso.filter(v => v.emEvento === null).length,
      eventosSemRazao: noPiso.length - logs.length,
      paresRazaoZero: paresNoPiso.filter(v => v.razaoZero).length,
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
  function presenca(linhas: Map<string, EfeitoRow>): Estimativa {
    let apareceu = 0
    let naoApareceu = 0
    let naoMedidos = 0
    const auto = new Set<string>()
    for (const a of linhas.values()) {
      if (a.papel !== 'alvo' || a.anos_atras !== 0) continue
      if (autodeclarado.has(a.signal_id)) { auto.add(a.signal_id); continue }
      if (a.estado !== 'medido' || a.pos === null) { naoMedidos++; continue }
      if (a.pos > 0) apareceu++
      else naoApareceu++
    }
    return { estado: 'presenca', pares: apareceu + naoApareceu, apareceu, naoApareceu, naoMedidos, descartados: { ...descartados }, autodeclarados: auto.size }
  }
}
