// Uma consulta por página aos testes abertos do site, com a guarda de edição DENTRO do leitor.
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ObservatoryLoadError } from '@/lib/youtube/observatorio/niches-db'
import { createClock } from '@/lib/youtube/observatorio/time'
import { porVideo, TETO_ABERTOS, type TestesAbertos } from './testes-abertos'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLUNAS = 'id, youtube_video_id, test_type, status, started_at, paused_at, created_at, config'
const clock = createClock(0, 0, 0)
/** dd/mm em America/Sao_Paulo (o mesmo formatador do Observatório). */
const dmSp = (iso: string): string => clock.dm(Date.parse(iso))

function avisa(siteId: string, code: string | undefined): void {
  // só siteId e código: nada de título nem URL
  Sentry.captureMessage('ab-entradas: falha ao ler os testes abertos', { level: 'warning', extra: { siteId, code: code ?? null } })
}

/** Nunca lança. Reporter: `negado` sem tocar o banco. Falha de leitura: `erro` (as entradas mostram "Testar no A/B Lab"; o destino reconfere). */
export async function lerTestesAbertos(siteId: string, so?: { videoUuid: string }): Promise<TestesAbertos> {
  // Guarda que cai ou nega: nada aparece (negado), nunca "erro" (que mostraria o botão).
  try {
    const guarda = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
    if (!guarda.ok) return { acesso: 'negado' }
  } catch {
    return { acesso: 'negado' }
  }
  try {
    if (so && !UUID.test(so.videoUuid)) return { acesso: 'ok', porVideo: {} }
    let q = getSupabaseServiceClient()
      .from('ab_tests')
      .select(COLUNAS)
      .eq('site_id', siteId)
      .in('status', ['draft', 'active', 'paused', 'queued'])
    if (so) q = q.eq('youtube_video_id', so.videoUuid)
    const { data, error } = await q.order('id').range(0, TETO_ABERTOS)
    if (error) throw new ObservatoryLoadError('ab_tests', error.code, error.message)
    const linhas: unknown[] = Array.isArray(data) ? data : []
    if (linhas.length > TETO_ABERTOS) throw new ObservatoryLoadError('ab_tests', undefined, `mais de ${TETO_ABERTOS} testes abertos`, true)
    return { acesso: 'ok', porVideo: porVideo(linhas, dmSp) }
  } catch (e) {
    avisa(siteId, e instanceof ObservatoryLoadError ? e.code : undefined)
    return { acesso: 'erro' }
  }
}
