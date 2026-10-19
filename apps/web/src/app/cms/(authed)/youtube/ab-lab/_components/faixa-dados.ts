import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireSiteAdminScope } from '@/lib/cms/auth-guards'
import { getCronHealth } from '@/lib/cron-health'
import { inicioDoSim, camposPendentes, type CampoNome, type RestoreStatus } from '@/lib/youtube/ab-restore'
import type { DadosDaFaixa } from './faixa-da-pagina'

const ABERTOS = ['draft', 'queued', 'active', 'paused']

interface TesteDaFaixa { id: string; site_id: string; youtube_video_id: string; status: string }

/**
 * Leituras do servidor para a faixa (P4b), sem efeito colateral: última execução do vigia, permissão de administrar,
 * bloqueio (outro teste aberto no vídeo, ou teste pausado com destino variante) e o início do "sim" por campo.
 */
export async function carregarDadosDaFaixa(test: TesteDaFaixa, rs: RestoreStatus | null): Promise<DadosDaFaixa> {
  if (!rs) return { vigiaUltimaExecucao: null, podeAdministrar: false, bloqueio: null, inicioDoSim: {} }
  const supabase = getSupabaseServiceClient()
  const [saude, admin, outro] = await Promise.all([
    getCronHealth('ab-watchdog').catch(() => null),
    requireSiteAdminScope(test.site_id),
    supabase.from('ab_tests').select('id').eq('site_id', test.site_id).eq('youtube_video_id', test.youtube_video_id).neq('id', test.id).in('status', ABERTOS).limit(1),
  ])
  const temOutro = ((outro.data ?? []) as unknown[]).length > 0
  const variante = (['title', 'thumbnail'] as const).some(k => { const c = rs[k]; return c && c.destino !== 'original' && c.estado === 'falhou' })
  const bloqueio = temOutro ? 'outro_teste' : test.status === 'paused' && variante ? 'pausado_variante' : null
  const inicio: Partial<Record<CampoNome, string | null>> = {}
  for (const c of camposPendentes(rs, 'humano')) {
    const h = await supabase.from('ab_test_restores').select('em, forcado').eq('test_id', test.id).eq('campo', c).order('seq', { ascending: false }).limit(10)
    inicio[c] = h.error ? null : inicioDoSim((h.data ?? []) as Array<{ em: string; forcado: boolean }>)
  }
  const ultima = (saude as { updated_at?: string | null } | null)?.updated_at ?? null
  return { vigiaUltimaExecucao: ultima, podeAdministrar: admin.ok, bloqueio, inicioDoSim: inicio }
}
