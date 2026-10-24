import 'server-only'
/**
 * F3 T6: os dados da página/bloco e o número da aba. Quem EDITA o site vê a lista; quem só lê não vê a aba e a URL direta responde "sem acesso",
 * sem criar cliente de serviço. `podeResponder` usa o MESMO predicado da ação (`requireSiteAdminScope`). Arquivo próprio: `dados.ts` é da F2 (C5).
 */
import * as Sentry from '@sentry/nextjs'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteAdminScope } from '@/lib/cms/auth-guards'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerAmostraDasLinhas, type AmostraDoVideo } from '@/lib/youtube/observatorio/sinais/amostra'
import { contarSinaisAbertos, lerEstadoDaAba, listarSinaisDoNicho, type ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { outlierMaisForte } from './view-model'

export type LeituraDaTela =
  | { estado: 'sem_acesso' }
  | { estado: 'erro' }
  | { estado: 'ok'; lista: ListaDeSinais; amostra: Map<string, AmostraDoVideo>; podeResponder: boolean }

const PROPRIOS_NA_AMOSTRA = 3

/** Ids que a tela mostra: o vídeo que puxa cada linha e, no parecido, até 3 dos seus (para o "mesmo lugar"). */
function idsDaAmostra(lista: ListaDeSinais, limite: number): string[] {
  const ids = new Set<string>()
  for (const it of lista.itens.slice(0, limite)) {
    const forte = outlierMaisForte(it.evidence)
    if (forte) ids.add(forte.video_id)
    if (it.kind === 'parecido') for (const p of (it.proprios_agora ?? []).slice(0, PROPRIOS_NA_AMOSTRA)) ids.add(p)
  }
  return [...ids]
}

export async function abrirListaDaTela(agora: Date, limite: number): Promise<LeituraDaTela> {
  const { siteId } = await getSiteContext()
  const edicao = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!edicao.ok) return { estado: 'sem_acesso' }
  const podeResponder = (await requireSiteAdminScope(siteId)).ok
  try {
    const sb = getSupabaseServiceClient()
    const lista = await listarSinaisDoNicho(sb, siteId, agora, limite)
    const amostra = await lerAmostraDasLinhas(sb, siteId, idsDaAmostra(lista, limite))
    return { estado: 'ok', lista, amostra, podeResponder }
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'sugestoes', step: 'abrir-lista' } })
    return { estado: 'erro' }
  }
}

export async function contarParaAAbaSugestoes(): Promise<{ visivel: false } | { visivel: true; n: number | null; velho: boolean; calculado: boolean }> {
  const { siteId } = await getSiteContext()
  const edicao = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!edicao.ok) return { visivel: false }
  try {
    const sb = getSupabaseServiceClient()
    const agora = new Date(observatoryNow())
    const [n, estado] = await Promise.all([contarSinaisAbertos(sb, siteId, agora), lerEstadoDaAba(sb, siteId, agora)])
    // Estado ilegível: "?" (nunca 0 nem "—", que afirmariam algo que não medimos).
    if (estado === null) return { visivel: true, n: null, velho: false, calculado: true }
    return { visivel: true, n, velho: estado.velho, calculado: estado.calculado }
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'sugestoes', step: 'contar-aba' } })
    return { visivel: true, n: null, velho: false, calculado: true }
  }
}
