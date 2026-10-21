import { DHASH_MAX_SAME, hamming } from '@/lib/youtube/thumb-hamming'
import { normalizarTitulo } from '../normalizar-titulo'

/** Troca de miniatura só com distância de Hamming >= isto (menor rotação real observada: 10). 7 a 9 é "indeterminada". */
export const DHASH_MIN_TROCA = 10
/** Versão da regra de inferência gravada em `versao_regra`. */
export const OBS_REGRA_VERSAO = 1
export const CARENCIA_H = 24
export const ESTAVEL_JANELA_H = 24
export const ESTAVEL_SPAN_H = 12
/** 1,5 x o intervalo do concorrente (4 rodadas por dia = 6 h, `watch/alvos.ts`). */
export const FRESCOR_H = 9
export const TETO_CORRIDAS = 20
export const TETO_BYTES_CORRIDA = 1000
/** Uma versão só vale se vista em >= 2 RODADAS distintas (`rodada_id`): as 3 passadas de uma rodada são minutos, não persistência (Phil C1). */
export const MIN_RODADAS_CORRIDA = 2
/** Abaixo disto de rodadas válidas num campo, "sem troca vista" é "não medido" (Phil C2). */
export const VALIDAS_MIN_MEDIDO = 2 * MIN_RODADAS_CORRIDA
const H = 3_600_000

export interface LeituraObs {
  id: number
  rodadaId: string
  lidaEm: string
  http: number | null
  erro: string | null
  jogadorBloqueado: boolean
  idioma: string | null
  tituloOficial: string | null
  tituloFonte: string | null
  miniaturaId: number | null
}
export interface ThumbObs {
  id: number
  variante: string
  http: number | null
  dhash: string | null
  largura: number | null
  altura: number | null
}
export type CampoObs = 'titulo' | 'miniatura'
export type TipoTroca = 'sequencial' | 'alternada'
export type FicouEstado = 'estavel' | 'em_andamento' | 'sem_desfecho'
export interface CorridaObs { v: number; ref: string; primeira_vista: string; ultima_vista: string; leituras: number }
export interface Observado {
  campo: CampoObs
  tipoTroca: TipoTroca
  veredito: 'troca_observada' | 'possivel_teste_youtube'
  versaoRegra: number
  trocas: CorridaObs[]
  nVersoes: number
  ficou: Record<string, string | number | null>
  ficouEstado: FicouEstado
  motivo: string | null
  primeiraTrocaEm: string
  ultimaAtualizacaoEm: string
}
export interface EntradaObs {
  leituras: readonly LeituraObs[]
  thumbsPorId: ReadonlyMap<number, ThumbObs>
  /** `competitor_videos.published_at` (mínimo entre os canais do site); o chamador não chama com nulo. */
  publicadoEm: Date
  agoraMs: number
  alvoSaiu: boolean
  saiuPor?: string
}
export interface ResultadoObs {
  observados: Observado[]
  indeterminadas: number
  /** Rodadas distintas com leitura válida (depois da carência) que alimentaram cada campo. 0 = o campo nunca foi lido. */
  validasTitulo: number
  validasMiniatura: number
}

interface Ponto { tMs: number; iso: string; key: string; ref: string; rodadaId: string }
interface Corrida { key: string; ref: string; pontos: Ponto[] }

const valida = (l: LeituraObs): boolean => l.http === 200 && l.erro === null && !l.jogadorBloqueado
const placeholder = (t: ThumbObs): boolean => t.largura === 120 && t.altura === 90

/** Maioria; empate vai para o grupo da leitura mais recente. */
function maioria<T>(itens: readonly T[], chave: (x: T) => string, tempo: (x: T) => number): string | null {
  const cont = new Map<string, { n: number; ult: number }>()
  for (const x of itens) {
    const k = chave(x)
    const c = cont.get(k) ?? { n: 0, ult: 0 }
    c.n++; c.ult = Math.max(c.ult, tempo(x))
    cont.set(k, c)
  }
  let melhor: string | null = null
  for (const [k, c] of cont) {
    const m = melhor === null ? null : cont.get(melhor)!
    if (m === null || c.n > m.n || (c.n === m.n && c.ult > m.ult)) melhor = k
  }
  return melhor
}

/** Versões da miniatura: união de Hamming <= DHASH_MAX_SAME; componentes a menos de DHASH_MIN_TROCA se fundem (indeterminada, não é troca). */
function versoesDeMiniatura(dhashes: readonly string[]): Map<string, string> {
  const unicos = [...new Set(dhashes)]
  const pai = new Map(unicos.map(d => [d, d]))
  const raiz = (d: string): string => { let r = d; while (pai.get(r) !== r) r = pai.get(r)!; return r }
  for (let i = 0; i < unicos.length; i++) {
    for (let j = i + 1; j < unicos.length; j++) {
      if (hamming(unicos[i]!, unicos[j]!) < DHASH_MIN_TROCA) pai.set(raiz(unicos[j]!), raiz(unicos[i]!))
    }
  }
  return new Map(unicos.map(d => [d, raiz(d)]))
}

const rodadasDe = (pontos: readonly Ponto[]): number => new Set(pontos.map(p => p.rodadaId)).size

function corridas(pontos: readonly Ponto[]): Corrida[] {
  const out: Corrida[] = []
  for (const p of pontos) {
    const ult = out.at(-1)
    if (ult && ult.key === p.key) ult.pontos.push(p)
    else out.push({ key: p.key, ref: p.ref, pontos: [p] })
  }
  return out
}

/** Corta o texto de referência até a corrida caber em TETO_BYTES_CORRIDA. */
function corridaCabivel(c: CorridaObs): CorridaObs {
  let ref = c.ref
  for (;;) {
    const cand = { ...c, ref }
    if (Buffer.byteLength(JSON.stringify(cand), 'utf8') <= TETO_BYTES_CORRIDA || ref.length === 0) return cand
    ref = ref.slice(0, Math.max(0, Math.floor(ref.length * 0.8) - 1))
  }
}

function inferirCampo(campo: CampoObs, pontosTodos: readonly Ponto[], e: EntradaObs): Observado | null {
  const pontos = [...pontosTodos].sort((a, b) => a.tMs - b.tMs)
  if (pontos.length < 2) return null
  const runs = corridas(pontos)
  // corrida vista em 1 rodada só (blip) é descartada, mesmo com 3 passadas; a mais recente nessa condição só pesa na estabilidade (abaixo)
  const qualificadas: Corrida[] = []
  for (const r of runs) {
    if (rodadasDe(r.pontos) < MIN_RODADAS_CORRIDA) continue
    const ant = qualificadas.at(-1)
    if (ant && ant.key === r.key) ant.pontos.push(...r.pontos) // as vizinhas iguais, separadas por um blip, se unem
    else qualificadas.push({ key: r.key, ref: r.ref, pontos: [...r.pontos] })
  }
  if (qualificadas.length < 2) return null
  const chaves = qualificadas.map(r => r.key)
  const distintas = [...new Set(chaves)]
  const alternada = chaves.length > distintas.length
  const ficouRun = qualificadas.at(-1)!

  const refMs = e.alvoSaiu ? pontos.at(-1)!.tMs : e.agoraMs
  const janela = pontos.filter(p => p.tMs >= refMs - ESTAVEL_JANELA_H * H)
  const todasIguais = janela.length > 0 && janela.every(p => p.key === ficouRun.key)
  const span = ficouRun.pontos.at(-1)!.tMs - ficouRun.pontos[0]!.tMs
  const fresca = e.alvoSaiu || e.agoraMs - pontos.at(-1)!.tMs < FRESCOR_H * H
  const estavel = todasIguais && span > ESTAVEL_SPAN_H * H && fresca
  let ficouEstado: FicouEstado = estavel ? 'estavel' : 'em_andamento'
  let motivo: string | null = null
  if (!estavel && e.alvoSaiu) { ficouEstado = 'sem_desfecho'; motivo = (e.saiuPor ?? 'saiu').replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 40) || 'saiu' }

  const trocas = qualificadas.slice(-TETO_CORRIDAS).map(r => corridaCabivel({
    v: distintas.indexOf(r.key), ref: r.ref, primeira_vista: r.pontos[0]!.iso, ultima_vista: r.pontos.at(-1)!.iso, leituras: r.pontos.length,
  }))
  const tipoTroca: TipoTroca = alternada ? 'alternada' : 'sequencial'
  const refFicou = ficouRun.ref
  return {
    campo, tipoTroca, veredito: alternada ? 'possivel_teste_youtube' : 'troca_observada', versaoRegra: OBS_REGRA_VERSAO,
    trocas, nVersoes: distintas.length,
    ficou: campo === 'titulo' ? { titulo: refFicou.slice(0, 300) } : { dhash: refFicou },
    ficouEstado, motivo,
    primeiraTrocaEm: qualificadas[1]!.pontos[0]!.iso,
    ultimaAtualizacaoEm: new Date(e.agoraMs).toISOString(),
  }
}

/**
 * Troca observada nos concorrentes (§5.8). Puro: um item por campo com troca; vazio = nenhuma linha (nunca "0 versões").
 * Não usa `avaliarVideo`/`detectarTesteYoutube`. A carência de 24 h descarta LEITURAS (a versão inicial é a vigente aos 24 h).
 */
export function inferirObservadoDetalhe(e: EntradaObs): ResultadoObs {
  const corte = e.publicadoEm.getTime() + CARENCIA_H * H
  const validas = e.leituras.filter(l => valida(l) && Date.parse(l.lidaEm) >= corte)
  const out: Observado[] = []
  let indeterminadas = 0

  // título: só a mesma fonte e o mesmo idioma (a maioria); título oscilando nunca é estável
  const comTitulo = validas.filter(l => l.tituloOficial !== null && l.tituloFonte !== null)
  const grupo = maioria(comTitulo, l => `${l.tituloFonte}|${l.idioma ?? ''}`, l => Date.parse(l.lidaEm))
  const pontosTitulo: Ponto[] = comTitulo.filter(l => `${l.tituloFonte}|${l.idioma ?? ''}` === grupo).map(l => {
    const t = normalizarTitulo(l.tituloOficial!)
    return { tMs: Date.parse(l.lidaEm), iso: new Date(l.lidaEm).toISOString(), key: t, ref: t, rodadaId: l.rodadaId }
  })
  const titulo = inferirCampo('titulo', pontosTitulo, e)
  if (titulo) out.push(titulo)

  // miniatura: só a variante dominante (host ignorado), dhash não nulo, sem placeholder
  const candidatas = validas.flatMap(l => {
    const t = l.miniaturaId === null ? undefined : e.thumbsPorId.get(l.miniaturaId)
    return t && t.http === 200 && t.dhash !== null && !placeholder(t) ? [{ l, t }] : []
  })
  const variante = maioria(candidatas, x => x.t.variante, x => Date.parse(x.l.lidaEm))
  const daVariante = candidatas.filter(x => x.t.variante === variante)
  const mapa = versoesDeMiniatura(daVariante.map(x => x.t.dhash!))
  const pontosMini: Ponto[] = daVariante.map(x => {
    const rep = mapa.get(x.t.dhash!)!
    return { tMs: Date.parse(x.l.lidaEm), iso: new Date(x.l.lidaEm).toISOString(), key: rep, ref: rep, rodadaId: x.l.rodadaId }
  })
  const ordenados = [...daVariante].sort((a, b) => Date.parse(a.l.lidaEm) - Date.parse(b.l.lidaEm))
  for (let i = 1; i < ordenados.length; i++) {
    const d = hamming(ordenados[i - 1]!.t.dhash!, ordenados[i]!.t.dhash!)
    if (d > DHASH_MAX_SAME && d < DHASH_MIN_TROCA) indeterminadas++
  }
  const miniatura = inferirCampo('miniatura', pontosMini, e)
  if (miniatura) out.push(miniatura)
  return { observados: out, indeterminadas, validasTitulo: rodadasDe(pontosTitulo), validasMiniatura: rodadasDe(pontosMini) }
}

export function inferirObservado(e: EntradaObs): Observado[] {
  return inferirObservadoDetalhe(e).observados
}
