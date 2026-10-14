/**
 * Quem chama já fez `requireEditAccess`: esta leitura NÃO confere direito.
 *
 * A5 · E10: as sugestões de arquivar: canais sem publicar há `RULES.archiveCutMonths` meses, com o tamanho estimado. Só LÊ
 * (`competitor_archive_suggestions` é `stable`): nada é pausado, exportado nem apagado por aqui. Resposta nula é `forma_invalida`,
 * nunca lista vazia; "0 avaliados e nenhum item" é devolvido como está. `mbEstimado` é ESTIMATIVA (`linhas × 156 bytes`).
 * `naoAvaliado` marca o canal cuja última leitura boa é nula ou tem mais de `RULES.archive.suggestionFreshDays` dias: "não publica"
 * pode ser "não é lido", e a tela mostra esses como "não avaliado", nunca como sugestão de arquivar.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CausaDaFalha } from '@/lib/youtube/agenda/tipos'
import { RULES } from '../rules'
import { causaDoErro, TETO_LEITURA_MS } from './ler-sinal'

export const BYTES_ESTIMADOS_POR_LINHA = 156
const MB = 1_048_576
const DIA_MS = 86_400_000

export interface SugestaoDeArquivar {
  canalId: string
  nome: string | null
  ultimaPublicacao: string
  videos: number
  linhas: number
  /** ESTIMATIVA: `linhas × 156 B`, em MB com uma casa. */
  mbEstimado: number
  ultimaLeituraBoa: string | null
  naoAvaliado: boolean
}
export type Sugestoes =
  | { valor: { avaliados: number; semVideo: number; cortaEmMeses: number; itens: SugestaoDeArquivar[] } }
  | { porque: CausaDaFalha }

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const contagem = (v: unknown): number | null => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : typeof v === 'string' && /^\d{1,15}$/.test(v) ? Number(v) : null)

export async function lerSugestoes(sb: SupabaseClient, siteId: string, agoraMs: number): Promise<Sugestoes> {
  try {
    const res: { data?: unknown; error?: unknown } | null | undefined = await sb
      .rpc('competitor_archive_suggestions', { p_site: siteId, p_now: new Date(agoraMs).toISOString(), p_months: RULES.archiveCutMonths })
      .abortSignal(AbortSignal.timeout(TETO_LEITURA_MS))
    if (typeof res !== 'object' || res === null) return { porque: 'forma_invalida' }
    if (res.error) return { porque: causaDoErro(res.error) }
    const d = res.data
    if (!ehObjeto(d)) return { porque: 'forma_invalida' } // nulo (parâmetro nulo no banco) nunca vira "nenhuma sugestão"
    const avaliados = contagem(d.canais_avaliados)
    const semVideo = contagem(d.canais_sem_video)
    if (avaliados === null || semVideo === null || !Array.isArray(d.sugestoes)) return { porque: 'forma_invalida' }
    const itens: SugestaoDeArquivar[] = []
    for (const s of d.sugestoes) {
      if (!ehObjeto(s)) return { porque: 'forma_invalida' }
      const videos = contagem(s.videos)
      const linhas = contagem(s.linhas)
      if (typeof s.channel_row_id !== 'string' || typeof s.last_published_at !== 'string' || videos === null || linhas === null) return { porque: 'forma_invalida' }
      const leitura = typeof s.last_ok_synced_at === 'string' ? Date.parse(s.last_ok_synced_at) : Number.NaN
      const boa = Number.isFinite(leitura)
      itens.push({
        canalId: s.channel_row_id, nome: typeof s.channel_name === 'string' ? s.channel_name : null, ultimaPublicacao: s.last_published_at, videos, linhas,
        mbEstimado: Math.round(((linhas * BYTES_ESTIMADOS_POR_LINHA) / MB) * 10) / 10,
        ultimaLeituraBoa: boa ? new Date(leitura).toISOString() : null,
        naoAvaliado: !boa || agoraMs - leitura > RULES.archive.suggestionFreshDays * DIA_MS,
      })
    }
    return { valor: { avaliados, semVideo, cortaEmMeses: RULES.archiveCutMonths, itens } }
  } catch (err) {
    return { porque: causaDoErro(err) }
  }
}
