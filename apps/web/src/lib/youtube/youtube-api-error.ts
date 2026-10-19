import { MOTIVOS_INTERNOS } from '@/lib/youtube/ab-restore'
import type { ChamadaYouTube, ErroGravado, MotivoInterno } from '@/lib/youtube/ab-restore'

// Erro de uma chamada ao YouTube (ou ao Blob). Nunca carrega corpo de resposta nem token.
export class YouTubeApiError extends Error {
  constructor(readonly status: number, readonly reason: string, readonly chamada: ChamadaYouTube) {
    super(`${chamada} ${status} ${reason}`)
    this.name = 'YouTubeApiError'
  }
}

// Aborto interno com motivo conhecido (ex.: falha do token). Vira `{ motivo }` no retrato.
export class ErroConhecido extends Error {
  constructor(readonly motivo: MotivoInterno) {
    super(motivo)
    this.name = 'ErroConhecido'
  }
}

const ehMotivoInterno = (s: string): s is MotivoInterno => (MOTIVOS_INTERNOS as readonly string[]).includes(s)

export async function erroDaResposta(res: Response, chamada: ChamadaYouTube): Promise<YouTubeApiError> {
  let reason = 'desconhecido'
  try {
    const j: unknown = await res.json()
    const r = (j as { error?: { errors?: Array<{ reason?: unknown }> } })?.error?.errors?.[0]?.reason
    if (typeof r === 'string' && r.length > 0) reason = r.slice(0, 100)
  } catch { /* corpo não JSON */ }
  return new YouTubeApiError(res.status, reason, chamada)
}

export function erroDeRede(e: unknown, chamada: ChamadaYouTube): YouTubeApiError {
  const nome = e instanceof Error || e instanceof DOMException ? e.name : ''
  return new YouTubeApiError(0, nome === 'TimeoutError' || nome === 'AbortError' ? 'timeout' : 'rede', chamada)
}

export function paraErroGravado(e: unknown): ErroGravado {
  if (e instanceof YouTubeApiError) {
    if (e.status === 0 && ehMotivoInterno(e.reason)) return { motivo: e.reason } // Y-P2
    return { status: e.status, reason: e.reason, chamada: e.chamada }
  }
  if (e instanceof ErroConhecido) return { motivo: e.motivo }
  return { motivo: 'erro_interno' }
}

// 403 do Blob não é "sem permissão do YouTube" (Y-D10); cota esgotada tem tratamento próprio.
export const REASONS_DE_COTA: readonly string[] = ['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded']
export const ehCotaEsgotada = (e: YouTubeApiError): boolean => REASONS_DE_COTA.includes(e.reason)
export const contaParaFalhas = (e: YouTubeApiError): boolean => e.chamada !== 'blob' && !ehCotaEsgotada(e)
