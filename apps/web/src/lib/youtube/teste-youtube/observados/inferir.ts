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
/** A 1ª versão do vídeo vale com 1 rodada unânime de >= isto de passadas, SÓ se a seguinte se confirmar em >= MIN_RODADAS_CORRIDA rodadas unânimes. */
export const MIN_PASSADAS_INICIAL = 3
/** Abaixo disto de rodadas válidas num campo, "sem troca vista" é "não medido" (Phil C2). */
export const VALIDAS_MIN_MEDIDO = 2 * MIN_RODADAS_CORRIDA
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
/** `rodadas` = rodadas UNÂNIMES em que a versão foi vista; 1 só na 1ª versão do vídeo (exceção da primeira corrida), sempre `sequencial`. */
export interface CorridaObs { v: number; ref: string; primeira_vista: string; ultima_vista: string; leituras: number; rodadas: number }
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
  // Só rodada UNÂNIME (todas as passadas válidas do campo com a mesma chave) confirma versão: a rodada mista não sustenta nada (Yannis C2)
  const porRodada = new Map<string, { keys: Set<string>; n: number }>()
  for (const p of pontos) {
    const c = porRodada.get(p.rodadaId) ?? { keys: new Set<string>(), n: 0 }
    c.keys.add(p.key); c.n++
    porRodada.set(p.rodadaId, c)
  }
  const unanimesDe = (ps: readonly Ponto[]): Set<string> => new Set(ps.filter(p => porRodada.get(p.rodadaId)!.keys.size === 1).map(p => p.rodadaId))
  const qualifica = (r: Corrida): boolean => unanimesDe(r.pontos).size >= MIN_RODADAS_CORRIDA
  // corrida vista em 1 rodada unânime só (blip) é descartada, mesmo com 3 passadas; a mais recente nessa condição só pesa na estabilidade (abaixo)
  // Exceção: a 1ª corrida do vídeo vale com 1 rodada unânime (>= 3 passadas) se a corrida seguinte se confirma (Phil + Yannis, decisão do controlador)
  const inicialOk = (): boolean => {
    const r0 = runs[0]!
    const ids = unanimesDe(r0.pontos)
    if (ids.size !== 1 || !runs[1] || !qualifica(runs[1])) return false
    const id = [...ids][0]!
    return porRodada.get(id)!.n >= MIN_PASSADAS_INICIAL
  }
  const montar = (comInicial: boolean): Corrida[] => {
    const out: Corrida[] = []
    runs.forEach((r, i) => {
      if (!qualifica(r) && !(comInicial && i === 0)) return
      const ant = out.at(-1)
      if (ant && ant.key === r.key) ant.pontos.push(...r.pontos) // as vizinhas iguais, separadas por um blip, se unem
      else out.push({ key: r.key, ref: r.ref, pontos: [...r.pontos] })
    })
    return out
  }
  let inicial = !qualifica(runs[0]!) && inicialOk()
  let qualificadas = montar(inicial)
  // a exceção nunca forma A,B,A: a troca com ela é sempre sequencial
  if (inicial && qualificadas.slice(1).some(q => q.key === qualificadas[0]!.key)) { inicial = false; qualificadas = montar(false) }
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
    v: distintas.indexOf(r.key), ref: r.ref, primeira_vista: r.pontos[0]!.iso, ultima_vista: r.pontos.at(-1)!.iso, leituras: r.pontos.length, rodadas: unanimesDe(r.pontos).size,
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

/**
 * Rodadas do título (§3.1). `suspensos` (chaves normalizadas, guarda §6.2) contam como leitura inválida e saem ANTES da maioria de idioma.
 * `brutos`: chave -> textos brutos que a produziram (a guarda consulta cada um).
 */
export function rodadasDoTitulo(ls: readonly LeituraObs[], suspensos: ReadonlySet<string> = new Set()): { rodadas: Rodada[]; brutos: Map<string, Set<string>> } {
  const validas = ls.flatMap(l => {
    if (!tituloValido(l)) return []
    const chave = normalizarTitulo(l.tituloExibido!)
    return suspensos.has(chave) ? [] : [{ l, chave }]
  })
  const idioma = maioria(validas, x => x.l.idioma!, x => Date.parse(x.l.lidaEm))
  const votam = validas.filter(x => x.l.idioma === idioma)
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
