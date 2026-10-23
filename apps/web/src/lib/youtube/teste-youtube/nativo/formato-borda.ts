// Borda do roteador (§5.1): lê o formato do vídeo (Short, kids, 18+, ao vivo) do banco, em lote, sem nunca gravar.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Formato } from './roteador'

export type { Formato }

const NULO: Pick<Formato, 'kids' | 'adulto' | 'aoVivo'> = { kids: null, adulto: null, aoVivo: null }
/** `duration_seconds` acima disto é vídeo longo com certeza (mesma regra de `shortSemSonda`). */
const DURACAO_MAXIMA_DE_SHORT_S = 180
const LOTE = 100
/** `ab_lab_formato_atual` em lotes: o PostgREST corta em `max_rows` = 1000 sem avisar. */
const LOTE_RPC = 500

const obj = (x: unknown): Record<string, unknown> | null =>
  typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null

/** Campo ausente, tipo errado ou bruto vazio => `null` (desconhecido), nunca `false`. */
export function lerFormatoDoBruto(raw: unknown): Pick<Formato, 'kids' | 'adulto' | 'aoVivo'> {
  const r = obj(raw)
  if (!r) return { ...NULO }
  const kidsBruto = obj(r.status)?.madeForKids
  const rating = obj(obj(r.contentDetails)?.contentRating)
  const live = obj(r.snippet)?.liveBroadcastContent
  return {
    kids: typeof kidsBruto === 'boolean' ? kidsBruto : null,
    adulto: rating ? rating.ytRating === 'ytAgeRestricted' : null,
    aoVivo: typeof live === 'string' ? live === 'live' || live === 'upcoming' : null,
  }
}

interface LinhaFormato { youtube_video_id: string; raw: unknown; is_short: boolean | null }
const ehLinha = (x: unknown): x is LinhaFormato => {
  const o = obj(x)
  return o !== null && typeof o.youtube_video_id === 'string' && (o.is_short === null || typeof o.is_short === 'boolean')
}

export interface FormatoLido { formato: Formato; temBruto: boolean }

/** Uma ida ao RPC `ab_lab_formato_atual` (bruto mais novo + `is_short` mais recente por vídeo) e, só se algum `is_short` ficou nulo, uma ao `youtube_videos` (duração). */
async function lerFormatosComOrigem(sb: SupabaseClient, siteId: string, videos: { id: string; ytId: string }[]): Promise<Map<string, FormatoLido>> {
  const saida = new Map<string, FormatoLido>()
  if (videos.length === 0) return saida
  const porYt = new Map<string, LinhaFormato>()
  for (let i = 0; i < videos.length; i += LOTE_RPC) {
    const { data, error } = await sb.rpc('ab_lab_formato_atual', { p_site: siteId, p_ids: videos.slice(i, i + LOTE_RPC).map((v) => v.ytId) })
    if (error) throw new Error(`ab_lab_formato_atual: ${error.message}`)
    for (const l of (Array.isArray(data) ? data : [])) if (ehLinha(l)) porYt.set(l.youtube_video_id, l)
  }

  for (const v of videos) {
    const l = porYt.get(v.ytId)
    saida.set(v.id, { formato: { isShort: l?.is_short ?? null, ...lerFormatoDoBruto(l?.raw) }, temBruto: obj(l?.raw) !== null })
  }

  // Fallback sem custo de bruto: duração > 180 s => não é Short, com certeza. <= 180 s ou nula continua nulo.
  const semShort = videos.filter((v) => saida.get(v.id)!.formato.isShort === null).map((v) => v.id)
  for (let i = 0; i < semShort.length; i += LOTE) {
    const { data: d, error: e } = await sb.from('youtube_videos').select('id, duration_seconds').eq('site_id', siteId).in('id', semShort.slice(i, i + LOTE))
    if (e) throw new Error(`youtube_videos.duration_seconds: ${(e as { message: string }).message}`)
    for (const x of (Array.isArray(d) ? d : []) as Array<{ id: string; duration_seconds: number | null }>) {
      if (typeof x.duration_seconds === 'number' && x.duration_seconds > DURACAO_MAXIMA_DE_SHORT_S) {
        const atual = saida.get(x.id)
        if (atual) atual.formato.isShort = false
      }
    }
  }
  return saida
}

export async function lerFormatos(sb: SupabaseClient, siteId: string, videos: { id: string; ytId: string }[]): Promise<Map<string, Formato>> {
  const m = await lerFormatosComOrigem(sb, siteId, videos)
  return new Map([...m].map(([k, v]) => [k, v.formato]))
}

export interface PortasFormato { videosList?: (ytId: string) => Promise<unknown> }

/**
 * Na abertura da ficha: sem bruto, uma `videos.list` (`part=status,contentDetails,snippet`, 1 unidade) lida por `lerFormatoDoBruto`.
 * Não grava (o bruto é da coleta). Falha da chamada = formato nulo (terceiro estado), nunca erro para a tela.
 */
export async function formatoNaAbertura(sb: SupabaseClient, siteId: string, video: { id: string; ytId: string }, portas: PortasFormato): Promise<Formato> {
  const lido = (await lerFormatosComOrigem(sb, siteId, [video])).get(video.id)
  const base: Formato = lido?.formato ?? { isShort: null, ...NULO }
  if (lido?.temBruto || !portas.videosList) return base
  try {
    const resposta = obj(await portas.videosList(video.ytId))
    const itens = resposta && Array.isArray(resposta.items) ? resposta.items : null
    const item = itens ? itens[0] : resposta
    return { ...base, ...lerFormatoDoBruto(item) }
  } catch {
    return base
  }
}
