import { compararCodePoint, normalizarTitulo } from './normalizar-titulo'
import { leituraWatchSchema, RENDERERS_TITULO, type LeituraWatch, type LimiaresDeteccao } from './tipos'

export interface LeituraPreparada {
  l: LeituraWatch                 // saída do Zod
  ms: number
  chaveRodada: string             // JSON.stringify([rodadaId, idioma, origemRede])
  voto: string | null             // normalizado; null = não vota (§4.3 p.2)
  votoCru: string | null          // texto cru do renderer de menor índice (RENDERERS_TITULO; outros depois, por nome)
  idxRenderer: number             // índice desse renderer (fora da lista: RENDERERS_TITULO.length)
  leuTitulo: boolean              // ≥ 1 renderer com texto (conta em validasTitulo)
  leuMiniatura: boolean           // ≥ 1 miniatura com dhash
  textoCanonico: string           // JSON canônico da leitura (chaves ordenadas): último critério do desempate
}

export interface Preparacao { leituras: LeituraPreparada[]; recebidas: number; invalidas: number; comErro: number }

function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o)
      .sort()
      .map(k => `${JSON.stringify(k)}:${canonico(o[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v)
}

function indiceRenderer(nome: string): number {
  const i = (RENDERERS_TITULO as readonly string[]).indexOf(nome)
  return i === -1 ? RENDERERS_TITULO.length : i
}

function preparar(l: LeituraWatch): LeituraPreparada {
  const lidos = l.titulosExibidos
    .filter((t): t is { renderer: string; texto: string } => t.texto !== null)
    .sort((a, b) => indiceRenderer(a.renderer) - indiceRenderer(b.renderer) || compararCodePoint(a.renderer, b.renderer))
  const normalizados = new Set(lidos.map(t => normalizarTitulo(t.texto)))
  const vota = lidos.length > 0 && normalizados.size === 1
  const escolhido = vota ? lidos[0]! : null
  return {
    l,
    ms: Date.parse(l.lidaEm),
    chaveRodada: JSON.stringify([l.rodadaId, l.idioma, l.origemRede]),
    voto: vota ? [...normalizados][0]! : null,
    votoCru: escolhido ? escolhido.texto : null,
    idxRenderer: escolhido ? indiceRenderer(escolhido.renderer) : RENDERERS_TITULO.length,
    leuTitulo: lidos.length > 0,
    leuMiniatura: l.miniaturas.some(m => m.dhash !== null),
    textoCanonico: canonico(l),
  }
}

/** (ms, chaveRodada, idxRenderer, votoCru, textoCanonico): ordem total e independente da ordem de entrada. */
export function compararDesempate(a: LeituraPreparada, b: LeituraPreparada): number {
  return (
    a.ms - b.ms ||
    compararCodePoint(a.chaveRodada, b.chaveRodada) ||
    a.idxRenderer - b.idxRenderer ||
    compararCodePoint(a.votoCru ?? '', b.votoCru ?? '') ||
    compararCodePoint(a.textoCanonico, b.textoCanonico)
  )
}

/** Valida (Zod), lança com 2+ vídeos entre as válidas (antes de tirar as com erro), tira as com erro e ordena. */
export function prepararLeituras(entradas: readonly unknown[]): Preparacao {
  const validas: LeituraWatch[] = []
  let invalidas = 0
  for (const e of entradas) {
    const r = leituraWatchSchema.safeParse(e)
    if (r.success) validas.push(r.data)
    else invalidas++
  }
  if (new Set(validas.map(l => l.youtubeVideoId)).size > 1) {
    throw new Error('detectarTesteYoutube: leituras de mais de um youtubeVideoId')
  }
  const semErro = validas.filter(l => l.erro === null)
  const leituras = semErro.map(preparar).sort(compararDesempate)
  return { leituras, recebidas: entradas.length, invalidas, comErro: validas.length - semErro.length }
}

export interface Rodada {
  chave: string
  leituras: LeituraPreparada[]
  deMs: number
  ateMs: number
  longa: boolean
  emQuarentena: boolean
  votos: Map<string, number>
  votosValidos: number
  mista: boolean
}

/** Rodadas de título (só leituras que leram algum título), ordenadas por deMs e depois chave. */
export function montarRodadas(ls: readonly LeituraPreparada[], o: LimiaresDeteccao): Rodada[] {
  const grupos = new Map<string, LeituraPreparada[]>()
  for (const p of ls) {
    if (!p.leuTitulo) continue
    const g = grupos.get(p.chaveRodada)
    if (g) g.push(p)
    else grupos.set(p.chaveRodada, [p])
  }
  const janelas = o.escritasConhecidas
    .filter(e => e.campo === 'titulo')
    .map(e => {
      const em = Date.parse(e.em)
      return { de: em - o.maxDuracaoRodadaMs, ate: em + o.quarentenaEscritaMs }
    })
  const out: Rodada[] = []
  for (const [chave, leituras] of grupos) {
    let deMs = Infinity
    let ateMs = -Infinity
    const votos = new Map<string, number>()
    let votosValidos = 0
    for (const p of leituras) {
      if (p.ms < deMs) deMs = p.ms
      if (p.ms > ateMs) ateMs = p.ms
      if (p.voto !== null) {
        votos.set(p.voto, (votos.get(p.voto) ?? 0) + 1)
        votosValidos++
      }
    }
    const longa = ateMs - deMs > o.maxDuracaoRodadaMs
    const emQuarentena = janelas.some(j => deMs <= j.ate && ateMs >= j.de)
    out.push({ chave, leituras, deMs, ateMs, longa, emQuarentena, votos, votosValidos, mista: !longa && !emQuarentena && votos.size >= 2 })
  }
  return out.sort((a, b) => a.deMs - b.deMs || compararCodePoint(a.chave, b.chave))
}
