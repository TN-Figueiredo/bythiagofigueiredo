import { DHASH_MAX_SAME, hamming } from '@/lib/youtube/thumb-hamming'
import { normalizarTitulo } from '../normalizar-titulo'

/** Troca de miniatura só com distância de Hamming >= isto (menor rotação real observada: 10). 7 a 9 é "indeterminada". */
export const DHASH_MIN_TROCA = 10
/** Versão da regra de inferência gravada em `versao_regra`. */
export const OBS_REGRA_VERSAO = 2
export const CARENCIA_H = 24
/** 1,5 x o intervalo do concorrente (4 rodadas por dia = 6 h, `watch/alvos.ts`). */
export const FRESCOR_H = 9
/** Abaixo disto de rodadas válidas num campo, "sem troca vista" é "não medido". @deprecated sai na T7 (a regra v2 devolve 0 quando não mediu). */
export const VALIDAS_MIN_MEDIDO = 4
/** Guarda no máximo estas versões em `trocas` (§4); o total real fica em `nVersoes`. */
export const TETO_VERSOES = 8
/** Regra v2 (§3.2): janela W de rodadas e mínimos por campo. */
export const W_RODADAS = 8
export const MIN_RODADAS_TITULO = 6
export const MIN_RODADAS_MINIATURA = 4
export const SPAN_MAX_H = 72
export const MIN_RODADAS_MISTAS_HIST = 2
/** Risco aceito de declarar "terminou" com o teste ainda vivo (§3.5). */
export const ALFA = 0.0005
/** Sem a trava, q = 1 daria ln 0 = -Infinity e a exigência sumiria. */
export const Q_TRAVA = 0.999
export const PERIODO_MIN_RODADAS = 16
/** Cadência da sonda (uma rodada a cada 6 h, `watch/alvos.ts`). Acoplada a `W_RODADAS` x `FRESCOR_H` (§3.2): 8 rodadas ~ 48 h, frescor 1,5 x a cadência. D-P2 usa para a data "desde". */
export const CADENCIA_H = 6
const H = 3_600_000
export interface LeituraObs {
  id: number
  rodadaId: string
  lidaEm: string
  http: number | null
  erro: string | null
  jogadorBloqueado: boolean
  idioma: string | null
  /** `yt_watch_readings.titulo_exibido` (regra v2). */
  tituloExibido: string | null
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



// ───────────────────────── Regra v2 (§3.1–§3.6): rodadas, janelas e decisão ─────────────────────────

/** Uma rodada da sonda para um campo: `tMs` = menor `lida_em` válida dela; `versoes` = chaves normalizadas vistas nela. */
export interface Rodada { tMs: number; rodadaId: string; versoes: ReadonlySet<string> }
export type EstadoRegra = 'em_andamento' | 'sumindo' | 'terminou' | 'troca' | 'indeterminada' | 'sem_troca_vista' | 'nao_medido'
export interface Decisao {
  estado: EstadoRegra
  /** W: as últimas 8 rodadas do campo. */
  w: Rodada[]
  /** Versão única qualificada de W (quando há uma só). */
  x: string | null
  /** Versões qualificadas da última janela de teste (terminou/sumindo). */
  s: string[]
  /** Versões Y que saíram (terminou/sumindo); em `troca`, a versão antes. */
  sumidas: string[]
  /** Em andamento: W. Terminou/sumindo: a última janela de teste. Senão null. */
  janelaTeste: Rodada[] | null
  /** Em `troca`: Y, a versão de antes. */
  antes: string | null
  /** Rodadas mistas (>= 2 versões qualificadas juntas) do histórico, para as versões do teste. */
  mistasHist: number
}

/** Validade do título (§3.1): `jogador_bloqueado` não invalida. */
export function tituloValido(l: LeituraObs): boolean {
  return l.http === 200 && l.erro === null && l.tituloExibido !== null && l.idioma !== null
}

function agrupar(itens: readonly { tMs: number; rodadaId: string; chave: string }[]): Rodada[] {
  const por = new Map<string, { tMs: number; versoes: Set<string> }>()
  for (const x of itens) {
    const r = por.get(x.rodadaId) ?? { tMs: x.tMs, versoes: new Set<string>() }
    if (x.tMs < r.tMs) r.tMs = x.tMs
    r.versoes.add(x.chave)
    por.set(x.rodadaId, r)
  }
  return [...por.entries()].map(([rodadaId, r]) => ({ tMs: r.tMs, rodadaId, versoes: r.versoes })).sort((a, b) => a.tMs - b.tMs)
}

interface Item { tMs: number; rodadaId: string; chave: string }

/** Leituras que votam no título (§3.1): válidas, sem os suspensos e só do idioma majoritário (calculado depois de tirar os suspensos). */
function votantesTitulo(ls: readonly LeituraObs[], suspensos: ReadonlySet<string>): { l: LeituraObs; chave: string }[] {
  const validas = ls.flatMap(l => {
    if (!tituloValido(l)) return []
    const chave = normalizarTitulo(l.tituloExibido!)
    return suspensos.has(chave) ? [] : [{ l, chave }]
  })
  const idioma = maioria(validas, x => x.l.idioma!, x => Date.parse(x.l.lidaEm))
  return validas.filter(x => x.l.idioma === idioma)
}

/**
 * Rodadas do título (§3.1). `suspensos` (chaves normalizadas, guarda §6.2) contam como leitura inválida e saem ANTES da maioria de idioma.
 * `brutos`: chave -> textos brutos que a produziram (a guarda consulta cada um).
 */
export function rodadasDoTitulo(ls: readonly LeituraObs[], suspensos: ReadonlySet<string> = new Set()): { rodadas: Rodada[]; brutos: Map<string, Set<string>> } {
  const votam = votantesTitulo(ls, suspensos)
  const brutos = new Map<string, Set<string>>()
  for (const x of votam) {
    const b = brutos.get(x.chave) ?? new Set<string>()
    b.add(x.l.tituloExibido!)
    brutos.set(x.chave, b)
  }
  return { rodadas: agrupar(votam.map(x => ({ tMs: Date.parse(x.l.lidaEm), rodadaId: x.l.rodadaId, chave: x.chave }))), brutos }
}

/** Versões vistas em >= 2 rodadas da janela. */
export function qualificadas(janela: readonly Rodada[]): Set<string> {
  const c = new Map<string, number>()
  for (const r of janela) for (const v of r.versoes) c.set(v, (c.get(v) ?? 0) + 1)
  return new Set([...c].filter(([, n]) => n >= 2).map(([v]) => v))
}

/** Rodadas do histórico com >= 2 das versões `q` juntas. */
export function rodadasMistas(hist: readonly Rodada[], q: ReadonlySet<string>): number {
  let n = 0
  for (const r of hist) {
    let k = 0
    for (const v of r.versoes) if (q.has(v)) k++
    if (k >= 2) n++
  }
  return n
}

/** Rodadas de ausência exigidas: ceil(ln ALFA / ln(1 - min(q, Q_TRAVA))). q <= 0 -> 0 (a ausência não precisa de prova). */
export function rodadasExigidas(q: number): number {
  if (!(q > 0)) return 0
  return Math.ceil(Math.log(ALFA) / Math.log(1 - Math.min(q, Q_TRAVA)))
}

const ehTeste = (w: readonly Rodada[], hist: readonly Rodada[]): boolean => {
  const q = qualificadas(w)
  return q.size >= 2 && rodadasMistas(hist, q) >= MIN_RODADAS_MISTAS_HIST
}

/** Y ausente há R rodadas, com q = fração de rodadas de `base` que têm Y e R contado de trás para frente em `rs`. */
function ausenciaOk(rs: readonly Rodada[], base: readonly Rodada[], y: string): boolean {
  const q = base.filter(r => r.versoes.has(y)).length / Math.max(1, base.length)
  let r = 0
  for (let i = rs.length - 1; i >= 0 && !rs[i]!.versoes.has(y); i--) r++
  return r >= rodadasExigidas(q)
}

/** Período de Y: da 1ª à última rodada com Y, estendido para trás até ter PERIODO_MIN_RODADAS. */
function periodo(rs: readonly Rodada[], y: string): Rodada[] {
  const ix: number[] = []
  rs.forEach((r, i) => { if (r.versoes.has(y)) ix.push(i) })
  if (ix.length === 0) return []
  const ultimo = ix[ix.length - 1]!
  const a = Math.max(0, Math.min(ix[0]!, ultimo + 1 - PERIODO_MIN_RODADAS))
  return rs.slice(a, ultimo + 1)
}

function ultimaJanelaTeste(rs: readonly Rodada[]): { w: Rodada[]; q: Set<string> } | null {
  for (let e = rs.length; e >= W_RODADAS; e--) {
    const w = rs.slice(e - W_RODADAS, e)
    if (ehTeste(w, rs.slice(0, e))) return { w, q: qualificadas(w) }
  }
  return null
}

/**
 * Decisão por campo (§3.2–§3.5): porte de `avalia`/`decide_unica` do protótipo. Pura: o relógio entra por `agoraMs`.
 * O frescor vale se `agoraMs - última rodada de W < FRESCOR_H`.
 */
export function decidirCampo(campo: CampoObs, rodadas: readonly Rodada[], o: { publicadoMs: number; agoraMs: number }): Decisao {
  const rs = rodadas
  const mn = campo === 'titulo' ? MIN_RODADAS_TITULO : MIN_RODADAS_MINIATURA
  const w = rs.slice(-W_RODADAS)
  const base: Decisao = { estado: 'nao_medido', w, x: null, s: [], sumidas: [], janelaTeste: null, antes: null, mistasHist: 0 }
  if (w.length < mn) return base
  if (w[w.length - 1]!.tMs - w[0]!.tMs > SPAN_MAX_H * H) return base
  if (!(o.agoraMs - w[w.length - 1]!.tMs < FRESCOR_H * H)) return base
  const qw = qualificadas(w)
  if (ehTeste(w, rs)) {
    return { ...base, estado: campo === 'titulo' ? 'em_andamento' : 'indeterminada', s: [...qw], janelaTeste: w, mistasHist: rodadasMistas(rs, qw) }
  }
  if (qw.size !== 1) return base
  const x = [...qw][0]!
  const prev = rs.slice(-W_RODADAS - 1, -1)
  const qprev = qualificadas(prev)
  if (prev.length < mn || qprev.size !== 1 || !qprev.has(x)) return base
  const ant = rs.slice(-2 * W_RODADAS, -W_RODADAS).filter(r => r.tMs >= o.publicadoMs + CARENCIA_H * H)

  const ult = ultimaJanelaTeste(rs)
  if (campo === 'titulo' && ult !== null && !(ult.q.size === 1 && ult.q.has(x))) {
    const sumidas = [...ult.q].filter(v => v !== x)
    const fim = sumidas.every(y => ausenciaOk(rs, periodo(rs, y), y))
    return { ...base, estado: fim ? 'terminou' : 'sumindo', x, s: [...ult.q], sumidas, janelaTeste: ult.w, mistasHist: rodadasMistas(rs, ult.q) }
  }
  if (ant.length < mn) return { ...base, x }
  const qa = qualificadas(ant)
  if (qa.size === 1 && qa.has(x)) return { ...base, estado: 'sem_troca_vista', x }
  if (qa.size === 1) {
    const y = [...qa][0]!
    if (ausenciaOk(rs, ant, y)) return { ...base, estado: 'troca', x, antes: y, sumidas: [y] }
  }
  if (qa.size >= 1 && campo === 'miniatura') return { ...base, estado: 'indeterminada', x, s: [...qa] }
  return { ...base, x }
}

// ───────────────────────── Miniatura (§3.7) e montagem do `Observado` (§4) ─────────────────────────

/** Corte por ponto de código (nunca em unidades UTF-16): o `jsonb` recusa surrogate solto. */
export const cortar = (s: string, n: number): string => Array.from(s).slice(0, n).join('')

function itensMiniatura(ls: readonly LeituraObs[], thumbsPorId: ReadonlyMap<number, ThumbObs>): { itens: Item[]; indeterminadas: number } {
  const candidatas = ls.flatMap(l => {
    const t = l.miniaturaId === null ? undefined : thumbsPorId.get(l.miniaturaId)
    return t && t.http === 200 && t.dhash !== null && !placeholder(t) ? [{ l, t }] : []
  })
  const variante = maioria(candidatas, x => x.t.variante, x => Date.parse(x.l.lidaEm))
  const daVariante = candidatas.filter(x => x.t.variante === variante)
  const mapa = versoesDeMiniatura(daVariante.map(x => x.t.dhash!))
  const ordenados = [...daVariante].sort((a, b) => Date.parse(a.l.lidaEm) - Date.parse(b.l.lidaEm))
  let indeterminadas = 0
  for (let i = 1; i < ordenados.length; i++) {
    const d = hamming(ordenados[i - 1]!.t.dhash!, ordenados[i]!.t.dhash!)
    if (d > DHASH_MAX_SAME && d < DHASH_MIN_TROCA) indeterminadas++
  }
  return { itens: daVariante.map(x => ({ tMs: Date.parse(x.l.lidaEm), rodadaId: x.l.rodadaId, chave: mapa.get(x.t.dhash!)! })), indeterminadas }
}

/** Rodadas da miniatura: só a variante dominante, sem placeholder, versões por Hamming (`versoesDeMiniatura`). */
export function rodadasDaMiniatura(ls: readonly LeituraObs[], thumbsPorId: ReadonlyMap<number, ThumbObs>): Rodada[] {
  return agrupar(itensMiniatura(ls, thumbsPorId).itens)
}

export interface VersaoObs { v: number; ref: string; primeira_vista: string; ultima_vista: string; leituras: number; rodadas: number }
export interface VersaoEmW { v: number; rodadas_em_w: number; ultima_vista: string }
/** D-P1: de `de` (última vista de `antes`, contando blips) até `ate` (1ª rodada da versão nova depois disso). */
export interface Transicao { antes: string; de: string; ate: string }
export interface FicouTitulo { titulo: string; versoes: VersaoEmW[]; sumindo: boolean; mistas_hist: boolean; janela_teste: { de: string; ate: string } | null; versoes_omitidas: number; transicao: Transicao | null }
export interface FicouMiniatura { dhash: string; versoes: VersaoEmW[]; versoes_omitidas: number; transicao: Transicao | null }
export interface BaseObs {
  versaoRegra: number
  tipoTroca: TipoTroca
  trocas: VersaoObs[]
  nVersoes: number
  ficouEstado: 'estavel' | 'em_andamento'
  motivo: null
  primeiraTrocaEm: string
  ultimaAtualizacaoEm: string
}
export interface ObservadoTitulo extends BaseObs { campo: 'titulo'; veredito: 'possivel_teste_youtube' | 'troca_observada'; ficou: FicouTitulo }
/** `possivel_teste_youtube` na miniatura é proibido por tipo (§3.7). */
export interface ObservadoMiniatura extends BaseObs { campo: 'miniatura'; veredito: 'troca_observada'; ficou: FicouMiniatura }
export type Observado = ObservadoTitulo | ObservadoMiniatura

export interface EntradaObs {
  leituras: readonly LeituraObs[]
  thumbsPorId: ReadonlyMap<number, ThumbObs>
  /** `competitor_videos.published_at` (mínimo entre os canais do site); o chamador não chama com nulo. */
  publicadoEm: Date
  agoraMs: number
  /** Chaves normalizadas suspensas pela guarda (§6.2); contam como leitura inválida. */
  titulosSuspensos?: ReadonlySet<string>
}
export interface VersaoParaConferir { chave: string; brutos: string[]; primeiraVista: string; ultimaVista: string }
export interface ResultadoObs {
  observados: Observado[]
  indeterminadas: number
  /** Rodadas de W usadas na decisão; 0 = a regra devolveu `nao_medido` (§4, Cursor). */
  validasTitulo: number
  validasMiniatura: number
  estadoTitulo: EstadoRegra
  estadoMiniatura: EstadoRegra
  /** Todas as versões do título do alvo, com os textos brutos, para a guarda (§6.2). */
  versoesTitulo: VersaoParaConferir[]
  versoesDemais: boolean
}

export function montarObservado(campo: CampoObs, veredito: Observado['veredito'], base: BaseObs, ficou: FicouTitulo | FicouMiniatura): Observado {
  if (campo === 'miniatura' && veredito === 'possivel_teste_youtube') throw new Error('miniatura nunca é possivel_teste_youtube')
  if (campo === 'titulo' && veredito === 'troca_observada' && base.ficouEstado === 'em_andamento') throw new Error('título nunca é troca_observada em andamento')
  return (campo === 'titulo' ? { ...base, campo, veredito, ficou } : { ...base, campo, veredito: 'troca_observada', ficou }) as Observado
}

interface VersaoAlvo { chave: string; primeira: number; ultima: number; leituras: number; rodadas: number }

/** "Versão do alvo": vista em 2 rodadas a <= W_RODADAS - 1 posições de distância (qualificada em alguma janela de 8). Na ordem da 1ª vista. */
function versoesDoAlvo(itens: readonly Item[], rodadas: readonly Rodada[]): VersaoAlvo[] {
  const pos = new Map<string, number[]>()
  rodadas.forEach((r, i) => { for (const v of r.versoes) pos.set(v, [...(pos.get(v) ?? []), i]) })
  const ok = new Set([...pos].filter(([, ix]) => ix.some((p, k) => k > 0 && p - ix[k - 1]! <= W_RODADAS - 1)).map(([v]) => v))
  const info = new Map<string, VersaoAlvo>()
  for (const it of itens) {
    if (!ok.has(it.chave)) continue
    const a = info.get(it.chave) ?? { chave: it.chave, primeira: it.tMs, ultima: it.tMs, leituras: 0, rodadas: pos.get(it.chave)!.length }
    a.primeira = Math.min(a.primeira, it.tMs); a.ultima = Math.max(a.ultima, it.tMs); a.leituras++
    info.set(it.chave, a)
  }
  return [...info.values()].sort((a, b) => a.primeira - b.primeira || (a.chave < b.chave ? -1 : 1))
}

const iso = (ms: number): string => new Date(ms).toISOString()

function montarCampo(campo: CampoObs, d: Decisao, itens: readonly Item[], rodadas: readonly Rodada[], agoraMs: number): { obs: Observado | null; demais: boolean } {
  const linha = campo === 'titulo'
    ? ({ em_andamento: ['possivel_teste_youtube', 'em_andamento', 'alternada'], sumindo: ['possivel_teste_youtube', 'em_andamento', 'alternada'], terminou: ['possivel_teste_youtube', 'estavel', 'alternada'], troca: ['troca_observada', 'estavel', 'sequencial'] } as Partial<Record<EstadoRegra, [Observado['veredito'], BaseObs['ficouEstado'], TipoTroca]>>)[d.estado]
    : ({ troca: ['troca_observada', 'estavel', 'sequencial'], indeterminada: ['troca_observada', 'em_andamento', 'alternada'] } as Partial<Record<EstadoRegra, [Observado['veredito'], BaseObs['ficouEstado'], TipoTroca]>>)[d.estado]
  if (!linha) return { obs: null, demais: false }
  const vs = versoesDoAlvo(itens, rodadas)
  if (vs.length < 2) return { obs: null, demais: false }
  const n = vs.length
  const vDe = new Map(vs.map((v, i) => [v.chave, i]))
  const guardadas = n > TETO_VERSOES ? [...vs].sort((a, b) => b.ultima - a.ultima).slice(0, TETO_VERSOES).sort((a, b) => a.primeira - b.primeira) : vs
  const ref = (chave: string): string => cortar(chave, 300)
  const trocas: VersaoObs[] = guardadas.map(v => ({ v: vDe.get(v.chave)!, ref: ref(v.chave), primeira_vista: iso(v.primeira), ultima_vista: iso(v.ultima), leituras: v.leituras, rodadas: v.rodadas }))
  const emW = (chave: string): number => d.w.filter(r => r.versoes.has(chave)).length
  const versoes: VersaoEmW[] = guardadas.filter(v => emW(v.chave) > 0).map(v => ({ v: vDe.get(v.chave)!, rodadas_em_w: emW(v.chave), ultima_vista: iso(v.ultima) }))
  const maisEmW = (): string => [...guardadas].sort((a, b) => emW(b.chave) - emW(a.chave) || b.ultima - a.ultima)[0]!.chave
  const refFicou = (d.estado === 'terminou' || d.estado === 'troca') && d.x !== null ? d.x : maisEmW()
  let transicao: Transicao | null = null
  if (d.estado === 'troca' && d.antes !== null && d.x !== null) {
    let ultimaY = -1
    rodadas.forEach((r, i) => { if (r.versoes.has(d.antes!)) ultimaY = i })
    const depois = rodadas.slice(ultimaY + 1).find(r => r.versoes.has(d.x!)) ?? rodadas[rodadas.length - 1]!
    transicao = { antes: ref(d.antes), de: iso(rodadas[Math.max(0, ultimaY)]!.tMs), ate: iso(depois.tMs) }
  }
  const [veredito, ficouEstado, tipoTroca] = linha
  const base: BaseObs = {
    versaoRegra: OBS_REGRA_VERSAO, tipoTroca, trocas, nVersoes: n, ficouEstado, motivo: null,
    primeiraTrocaEm: iso(vs[1]!.primeira), ultimaAtualizacaoEm: iso(agoraMs),
  }
  const omitidas = n - guardadas.length
  if (campo === 'titulo') {
    const jan = d.estado === 'em_andamento' || d.estado === 'sumindo' ? d.w : d.estado === 'terminou' ? d.janelaTeste : null
    const ficou: FicouTitulo = {
      titulo: ref(refFicou), versoes, sumindo: d.estado === 'sumindo', mistas_hist: d.estado !== 'troca' && d.mistasHist >= MIN_RODADAS_MISTAS_HIST,
      janela_teste: jan && jan.length > 0 ? { de: iso(jan[0]!.tMs), ate: iso(jan[jan.length - 1]!.tMs) } : null, versoes_omitidas: omitidas, transicao,
    }
    return { obs: montarObservado('titulo', veredito, base, ficou), demais: omitidas > 0 }
  }
  const ficou: FicouMiniatura = { dhash: ref(refFicou), versoes, versoes_omitidas: omitidas, transicao }
  return { obs: montarObservado('miniatura', veredito, base, ficou), demais: omitidas > 0 }
}

/**
 * Troca observada nos concorrentes, regra v2 (§3–§4). Puro: um item por campo com algo a dizer; vazio = nenhuma linha (nunca "0 versões").
 * Não usa `avaliarVideo`/`detectarTesteYoutube`. A carência de 24 h vale só para a "versão antes" da troca (dentro de `decidirCampo`).
 */
export function inferirObservadoDetalhe(e: EntradaObs): ResultadoObs {
  const o = { publicadoMs: e.publicadoEm.getTime(), agoraMs: e.agoraMs }
  const votam = votantesTitulo(e.leituras, e.titulosSuspensos ?? new Set())
  const itensT: Item[] = votam.map(x => ({ tMs: Date.parse(x.l.lidaEm), rodadaId: x.l.rodadaId, chave: x.chave }))
  const rodadasT = agrupar(itensT)
  const dT = decidirCampo('titulo', rodadasT, o)
  const { itens: itensM, indeterminadas } = itensMiniatura(e.leituras, e.thumbsPorId)
  const rodadasM = agrupar(itensM)
  const dM = decidirCampo('miniatura', rodadasM, o)

  const titulo = montarCampo('titulo', dT, itensT, rodadasT, e.agoraMs)
  const miniatura = montarCampo('miniatura', dM, itensM, rodadasM, e.agoraMs)

  const porChave = new Map<string, { brutos: Set<string>; primeira: number; ultima: number }>()
  for (const x of votam) {
    const t = Date.parse(x.l.lidaEm)
    const a = porChave.get(x.chave) ?? { brutos: new Set<string>(), primeira: t, ultima: t }
    a.brutos.add(x.l.tituloExibido!); a.primeira = Math.min(a.primeira, t); a.ultima = Math.max(a.ultima, t)
    porChave.set(x.chave, a)
  }
  const versoesTitulo: VersaoParaConferir[] = [...porChave].map(([chave, a]) => ({ chave, brutos: [...a.brutos], primeiraVista: iso(a.primeira), ultimaVista: iso(a.ultima) })).sort((a, b) => Date.parse(a.primeiraVista) - Date.parse(b.primeiraVista))

  return {
    observados: [titulo.obs, miniatura.obs].filter((x): x is Observado => x !== null),
    indeterminadas,
    validasTitulo: dT.estado === 'nao_medido' ? 0 : dT.w.length,
    validasMiniatura: dM.estado === 'nao_medido' ? 0 : dM.w.length,
    estadoTitulo: dT.estado,
    estadoMiniatura: dM.estado,
    versoesTitulo,
    versoesDemais: titulo.demais || miniatura.demais,
  }
}

export function inferirObservado(e: EntradaObs): Observado[] {
  return inferirObservadoDetalhe(e).observados
}
