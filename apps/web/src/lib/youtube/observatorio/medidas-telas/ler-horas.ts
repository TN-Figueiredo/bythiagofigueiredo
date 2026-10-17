import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { TAREFA_HORARIA } from '../../horaria/gravar'
import type { CausaNaoLida, Parte } from '../medidas/ler'
import { REGRAS_DAS_72_HORAS as R } from './tracao-72h'

/**
 * E5a Tarefa 14a: a leitura por hora dos vídeos de um canal, para as duas páginas (canal e vídeo).
 * Recebe o cliente por parâmetro (a página o cria depois da guarda dela) e NUNCA lança: o que não foi lido vira `{ lido: false, causa }`.
 * O teto de 72 horas por vídeo está na CONSULTA (blocos definidos por tempo, não por quantidade) e de novo no código, por vídeo.
 * `competitor_agenda_runs` NÃO tem `site_id`: a agenda é do banco inteiro, e o "último ok" e a "primeira execução" são dela, não do site.
 */

export interface LeituraPorHora { horaMs: number; lidaEmMs: number; views: number; likes: number | null; comments: number | null }
export interface HorasDoCanal {
  porVideo: Map<string, LeituraPorHora[]>
  /** A primeira `hour_slot` do SITE (nula = a leitura por hora ainda não gravou nada). */
  primeiraHoraDoSiteMs: number | null
  /** Último `ok` da tarefa na agenda (do banco inteiro). */
  ultimoOkDaTarefaMs: number | null
  /** Primeira execução da tarefa (qualquer status): decide o caso sem `ok` nenhum. */
  primeiraExecucaoDaTarefaMs: number | null
  /** Ids recebidos que não eram do canal (descartados). */
  foraDoCanal: number
}

const HORA = 3_600_000
const PAGINA = 1000
const MAX_PAGINAS = 50
const SCHEMA_AUSENTE = new Set(['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])

type Obj = Record<string, unknown>
const ehObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const ehNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const numOuNulo = (v: unknown): number | null => (ehNum(v) ? v : null)
const msDe = (v: unknown): number | null => {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}
// bigint do Postgres pode vir como texto
const contador = (v: unknown): number | null => (typeof v === 'string' && v.trim() !== '' ? numOuNulo(Number(v)) : numOuNulo(v))

function causaDoErro(err: unknown): CausaNaoLida {
  return ehObj(err) && typeof err.code === 'string' && SCHEMA_AUSENTE.has(err.code) ? 'schema_ausente' : 'erro_do_banco'
}

type Resposta = { data: unknown; error: unknown }
type Lote = { ok: true; linhas: Obj[] } | { ok: false; causa: CausaNaoLida }

async function paginar(pedir: (de: number, ate: number) => PromiseLike<Resposta>): Promise<Lote> {
  const linhas: Obj[] = []
  try {
    for (let p = 0; p < MAX_PAGINAS; p++) {
      const r = await pedir(p * PAGINA, p * PAGINA + PAGINA - 1)
      if (r.error !== null && r.error !== undefined) return { ok: false, causa: causaDoErro(r.error) }
      if (!Array.isArray(r.data)) return { ok: false, causa: 'erro_do_banco' }
      for (const x of r.data) if (ehObj(x)) linhas.push(x)
      if (r.data.length < PAGINA) return { ok: true, linhas }
    }
    return { ok: false, causa: 'cortado' }
  } catch {
    return { ok: false, causa: 'erro_do_banco' }
  }
}

/** Uma linha só, de uma coluna de data: `null` = a tabela respondeu e não há linha. */
async function umaData(pedir: () => PromiseLike<Resposta>, coluna: string): Promise<{ ok: true; ms: number | null } | { ok: false; causa: CausaNaoLida }> {
  try {
    const r = await pedir()
    if (r.error !== null && r.error !== undefined) return { ok: false, causa: causaDoErro(r.error) }
    if (!Array.isArray(r.data)) return { ok: false, causa: 'erro_do_banco' }
    if (r.data.length === 0) return { ok: true, ms: null }
    const linha: unknown = r.data[0]
    const ms = ehObj(linha) ? msDe(linha[coluna]) : null
    // linha sem a data na forma: erro, nunca "não há linha"
    return ms === null ? { ok: false, causa: 'erro_do_banco' } : { ok: true, ms }
  } catch {
    return { ok: false, causa: 'erro_do_banco' }
  }
}

export interface VideoParaHoras { id: string; publicadoEmMs: number }

/** Blocos definidos por tempo: vídeos consecutivos por publicação enquanto (maior − menor) <= JANELA_DO_BLOCO_H e até IDS_POR_BLOCO. */
export function blocosPorTempo(videos: readonly VideoParaHoras[]): VideoParaHoras[][] {
  const ord = [...videos].sort((a, b) => a.publicadoEmMs - b.publicadoEmMs)
  const out: VideoParaHoras[][] = []
  let atual: VideoParaHoras[] = []
  for (const v of ord) {
    const primeiro = atual[0]
    if (primeiro !== undefined && (atual.length >= R.IDS_POR_BLOCO || v.publicadoEmMs - primeiro.publicadoEmMs > R.JANELA_DO_BLOCO_H * HORA)) {
      out.push(atual)
      atual = []
    }
    atual.push(v)
  }
  if (atual.length > 0) out.push(atual)
  return out
}

async function mapaComLimite<A, B>(itens: readonly A[], limite: number, f: (a: A) => Promise<B>): Promise<B[]> {
  const out = new Array<B>(itens.length)
  let prox = 0
  const operario = async (): Promise<void> => { for (let i = prox++; i < itens.length; i = prox++) out[i] = await f(itens[i]!) }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, operario))
  return out
}

export async function lerHorasDoCanal(
  sb: SupabaseClient,
  o: { siteId: string; channelId: string; videos: readonly VideoParaHoras[]; agoraMs: number },
): Promise<Parte<HorasDoCanal>> {
  try {
    const naoLido = (causa: CausaNaoLida): Parte<HorasDoCanal> => ({ lido: false, causa })
    // as três leituras de uma linha: se uma falha, a parte inteira é não lida (não se afirma "começou" com metade)
    const [primeira, ultimoOk, primeiraExec] = await Promise.all([
      umaData(() => sb.from('competitor_video_hourly').select('hour_slot').eq('site_id', o.siteId).order('hour_slot').limit(1), 'hour_slot'),
      umaData(() => sb.from('competitor_agenda_runs').select('finished_at').eq('task', TAREFA_HORARIA).eq('status', 'ok').order('finished_at', { ascending: false }).limit(1), 'finished_at'),
      umaData(() => sb.from('competitor_agenda_runs').select('started_at').eq('task', TAREFA_HORARIA).order('started_at').limit(1), 'started_at'),
    ])
    if (!primeira.ok) return naoLido(primeira.causa)
    if (!ultimoOk.ok) return naoLido(ultimoOk.causa)
    if (!primeiraExec.ok) return naoLido(primeiraExec.causa)

    // só os vídeos do canal (os que quem chama leu); nada de outro canal entra
    const meus = new Map<string, number>()
    for (const v of o.videos) meus.set(v.id, v.publicadoEmMs)
    const blocos = blocosPorTempo(o.videos)
    const porVideo = new Map<string, LeituraPorHora[]>()
    let foraDoCanal = 0
    const estado: { falha: CausaNaoLida | null } = { falha: null }
    await mapaComLimite(blocos, R.BLOCOS_AO_MESMO_TEMPO, async (bloco) => {
      if (estado.falha !== null) return
      const menor = bloco[0]!.publicadoEmMs
      const maior = bloco[bloco.length - 1]!.publicadoEmMs
      // a hora cheia no limite de baixo: `hour_slot` é a hora cheia de `taken_at`
      const de = new Date(Math.floor(menor / HORA) * HORA).toISOString()
      const ate = new Date(maior + (R.HORAS + R.FOLGA_DA_CONSULTA_H) * HORA).toISOString()
      const ids = bloco.map((v) => v.id)
      const r = await paginar((a, z) => sb.from('competitor_video_hourly').select('video_id, hour_slot, taken_at, views, likes, comments')
        .eq('site_id', o.siteId).in('video_id', ids).gte('hour_slot', de).lt('hour_slot', ate).order('video_id').order('hour_slot').range(a, z))
      if (!r.ok) { estado.falha ??= r.causa; return }
      for (const x of r.linhas) {
        const id = x.video_id
        const pub = typeof id === 'string' ? meus.get(id) : undefined
        if (typeof id !== 'string' || pub === undefined) { foraDoCanal++; continue }
        const horaMs = msDe(x.hour_slot), lidaEmMs = msDe(x.taken_at), views = contador(x.views)
        if (horaMs === null || lidaEmMs === null || views === null) continue
        // o teto de 72 horas é POR VÍDEO e pelo instante real da leitura (nunca por hour_slot)
        if (lidaEmMs < pub || lidaEmMs > pub + (R.HORAS + R.FOLGA_DA_CONSULTA_H) * HORA) continue
        const l = porVideo.get(id) ?? []
        l.push({ horaMs, lidaEmMs, views, likes: contador(x.likes), comments: contador(x.comments) })
        porVideo.set(id, l)
      }
    })
    if (estado.falha !== null) return naoLido(estado.falha)
    for (const l of porVideo.values()) l.sort((a, b) => a.lidaEmMs - b.lidaEmMs)
    return { lido: true, dados: { porVideo, primeiraHoraDoSiteMs: primeira.ms, ultimoOkDaTarefaMs: ultimoOk.ms, primeiraExecucaoDaTarefaMs: primeiraExec.ms, foraDoCanal } }
  } catch {
    return { lido: false, causa: 'erro_do_banco' }
  }
}
