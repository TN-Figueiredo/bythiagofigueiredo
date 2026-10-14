import 'server-only'
/**
 * A5 · E9, Tarefa 9: os dados da página e o número da aba. Quem EDITA o site vê a fila (o critério da policy de `competitor_removed_items`); quem
 * só lê não vê a aba e a URL direta responde "sem acesso", sem criar cliente de serviço. `podeResponder` (administrar) só preenche o botão.
 */
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { requireSiteAdminScope } from '@/lib/cms/auth-guards'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { lerFila } from '@/lib/youtube/observatorio/saiu/ler-fila'
import { contarFila } from '@/lib/youtube/observatorio/saiu/contar'
import type { LeituraDaFila } from '@/lib/youtube/observatorio/saiu/modelo'

export async function abrirFila(mostrar: number): Promise<LeituraDaFila> {
  const { siteId } = await getSiteContext()
  const edicao = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!edicao.ok) return { estado: 'sem_acesso' }
  const admin = await requireSiteAdminScope(siteId)
  return lerFila(getSupabaseServiceClient(), { siteId, mostrar, agoraMs: observatoryNow(), podeResponder: admin.ok })
}

export async function contarParaAAba(): Promise<{ visivel: false } | { visivel: true; n: number | null }> {
  const { siteId } = await getSiteContext()
  const edicao = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!edicao.ok) return { visivel: false }
  return { visivel: true, n: await contarFila(getSupabaseServiceClient(), siteId) }
}
