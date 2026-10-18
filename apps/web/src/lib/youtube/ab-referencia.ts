// Construtor único dos links para o A/B Lab e regras da imagem de referência.
// Módulo PURO: sem server-only, sem Sentry, sem env (é importado por componentes cliente).

export type TipoTroca = 'thumbnail' | 'title'

export const AB_BASE = '/cms/youtube/ab-lab'
/** Tamanho da URL, não regra do YouTube; conta por pontos de código (Array.from), não por UTF-16. */
export const TITULO_REF_MAX = 300

const ID_YT = /^[\w-]{11}$/
const REF_TROCA = /^[A-Za-z0-9:_/-]{1,80}$/

/**
 * Só mostra imagem de referência vinda da URL se o host for o do YouTube ou um Vercel Blob (https, sem query).
 * Dívida declarada: o curinga `*.public.blob.vercel-storage.com` aceita QUALQUER loja Blob, não só a do projeto.
 */
export function thumbReferenciaSegura(url: string | undefined | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return null
    const h = u.hostname
    if (h === 'i.ytimg.com' || h.endsWith('.public.blob.vercel-storage.com')) {
      return `https://${h}${u.pathname}`
    }
    return null
  } catch {
    return null
  }
}

/** Imagem amarrada ao vídeo de referência: Blob só em /observatorio/thumbs/<refVideoId>/, ytimg só em /vi/<ytId>/. Sem vínculo, null. */
export function thumbDoVideoDeReferencia(url: string | null, refVideoId: string | null, ytId: string | null): string | null {
  const segura = thumbReferenciaSegura(url)
  if (!segura) return null
  const u = new URL(segura)
  if (u.hostname === 'i.ytimg.com') {
    return ytId && u.pathname.startsWith(`/vi/${ytId}/`) ? segura : null
  }
  return refVideoId && u.pathname.startsWith(`/observatorio/thumbs/${refVideoId}/`) ? segura : null
}

export function thumbOriginalYtimg(ytId: string | null): string | null {
  return ytId && ID_YT.test(ytId) ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null
}

export function tituloReferencia(t: string | undefined | null): string | null {
  if (typeof t !== 'string') return null
  const s = t.trim()
  if (!s || Array.from(s).length > TITULO_REF_MAX) return null
  return s
}

export function refTrocaValida(t: string | null | undefined): string | null {
  return typeof t === 'string' && REF_TROCA.test(t) ? t : null
}

export function hrefNovoTesteProprio(videoUuid: string, tipo?: TipoTroca): string {
  const q = new URLSearchParams({ videoId: videoUuid })
  if (tipo) q.set('changeType', tipo)
  return `${AB_BASE}/new?${q.toString()}`
}

export function hrefNovoTesteConcorrente(p: { tipo: TipoTroca; thumb: string | null; titulo: string | null; refVideoId: string; refTroca?: string | null }): string {
  const q = new URLSearchParams()
  q.set('ref', 'competitor')
  q.set('changeType', p.tipo)
  const thumb = thumbReferenciaSegura(p.thumb)
  if (thumb) q.set('competitorThumb', thumb)
  const titulo = tituloReferencia(p.titulo)
  if (titulo) q.set('competitorTitle', titulo)
  q.set('refVideoId', p.refVideoId)
  if (p.refTroca) q.set('refTroca', p.refTroca)
  return `${AB_BASE}/new?${q.toString()}`
}

export function hrefTesteAb(testId: string): string {
  return `${AB_BASE}/${encodeURIComponent(testId)}`
}

/** Lista do A/B Lab; destino do rascunho (Q-c). */
export function hrefListaAb(): string {
  return AB_BASE
}

export function tipoDaLane(l: 'title' | 'thumb' | 'desc'): TipoTroca | null {
  return l === 'title' ? 'title' : l === 'thumb' ? 'thumbnail' : null
}
