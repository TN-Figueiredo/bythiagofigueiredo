import { z } from 'zod'
import { refTrocaValida, thumbReferenciaSegura, tituloReferencia, type TipoTroca } from '@/lib/youtube/ab-referencia'

/**
 * Parâmetros de `ab-lab/new`. Regra geral: parâmetro inválido vira ausente, nunca erro de página;
 * o que some nunca inventa nada (sem faixa, sem pré-escolha).
 */
export interface ReferenciaPedida {
  tipo: TipoTroca
  /** passou por thumbReferenciaSegura; o amarre ao vídeo é feito na página (precisa do ytId) */
  thumb: string | null
  titulo: string | null
  refVideoId: string | null
  refTroca: string | null
}

export interface ParamsNovoTeste {
  draft: string | null
  videoId: string | null
  tipo: TipoTroca | null
  referencia: ReferenciaPedida | null
}

type Raw = Record<string, string | string[] | undefined>

const primeiro = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v)
const UUID = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
const VIDEO_ID = z.string().trim().min(1).max(64)
const TIPO = z.enum(['thumbnail', 'title'])
const TEXTO = z.string()

function campo<T>(esquema: z.ZodType<T>, valor: unknown): T | null {
  const r = esquema.safeParse(primeiro(valor))
  return r.success ? r.data : null
}

export function lerParamsNovoTeste(raw: Raw): ParamsNovoTeste {
  const draft = campo(UUID, raw.draft)
  const videoId = campo(VIDEO_ID, raw.videoId)
  const tipo = campo(TIPO, raw.changeType)
  const ref = campo(TEXTO, raw.ref)
  if (ref !== 'competitor' || !tipo) return { draft, videoId, tipo, referencia: null }
  const refVideoId = campo(UUID, raw.refVideoId)
  return {
    draft,
    videoId,
    tipo,
    referencia: {
      tipo,
      thumb: thumbReferenciaSegura(campo(TEXTO, raw.competitorThumb)),
      titulo: tituloReferencia(campo(TEXTO, raw.competitorTitle)),
      refVideoId,
      // sem vídeo não há troca
      refTroca: refVideoId ? refTrocaValida(campo(TEXTO, raw.refTroca)) : null,
    },
  }
}

const YT_ID = /^[\w-]{11}$/
const Canal = z.object({ channel_name: z.string(), site_id: z.string() })
const Linha = z.object({
  video_id: z.string().nullish(),
  competitor_channels: z.union([Canal, z.array(Canal).length(1).transform((a) => a[0]!)]),
})

/** Defesa dupla além do filtro da consulta: linha de outro site não devolve nome nem id do YouTube. */
export function canalDaReferencia(linha: unknown, siteId: string): { canal: string; ytId: string | null } | null {
  const r = Linha.safeParse(linha)
  if (!r.success) return null
  const c = r.data.competitor_channels
  if (c.site_id !== siteId) return null
  const v = r.data.video_id
  return { canal: c.channel_name, ytId: typeof v === 'string' && YT_ID.test(v) ? v : null }
}
