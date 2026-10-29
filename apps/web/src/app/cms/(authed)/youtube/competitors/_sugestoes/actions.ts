'use server'
/**
 * F3 T6: as ações "Dispensar" e (F3b) "Adiar 7 dias" da lista de sugestões. Porta de entrada, nenhuma regra. Ordem (ruling C10): (1) Zod; (2) quem administra, ANTES de qualquer
 * cliente de serviço; (3) a sessão de edição, para o id do usuário; (4) `dispensarSinal`; (5) mapeamento da resposta; (6) invalidar.
 * O `siteId` vem SEMPRE de `getSiteContext()`; o cliente manda só o id e o motivo. Componente client recebe esta ação por prop, nunca a importa.
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { unstable_rethrow } from 'next/navigation'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { denyUnlessSiteAdmin, requireSiteAdminScope } from '@/lib/cms/auth-guards'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { adiarSinal, dispensarSinal } from '@/lib/youtube/observatorio/sinais/leitura'
import { askReading, cancelReading } from '@/lib/pipeline/services/forja-queue'
import { PipelineServiceError } from '@/lib/pipeline/services/types'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import type { RespostaDaAcao, RespostaDoPedidoDeTitulos } from './tipos'

const ACAO = 'dispensar sugestões do nicho'
const Entrada = z.object({
  id: z.string().uuid(),
  motivo: z.enum(['lugar_errado', 'nao_interessa', 'nao_e_parecido', 'ja_fiz']),
})
const REPASSADOS: ReadonlySet<string> = new Set(['nao_aberto', 'nao_encontrado', 'motivo_invalido'])

export async function dispensarSugestao(id: string, motivo: string): Promise<RespostaDaAcao> {
  const entrada = Entrada.safeParse({ id, motivo })
  if (!entrada.success) return { ok: false, motivo: 'motivo_invalido' }
  try {
    const { siteId } = await getSiteContext()
    if (await denyUnlessSiteAdmin(siteId, ACAO)) return { ok: false, motivo: 'sem_permissao' }
    const edicao = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
    if (!edicao.ok) return { ok: false, motivo: 'sem_permissao' }
    const r = await dispensarSinal(getSupabaseServiceClient(), siteId, entrada.data.id, 'dispensado', entrada.data.motivo, `user:${edicao.user.id}`)
    // A aba (contador) está em todas as páginas do Observatório; o bloco vive no A/B Lab. Também quando "já saiu": a tela está desatualizada.
    if (r.ok || r.motivo === 'nao_aberto') {
      revalidatePath('/cms/youtube/competitors', 'layout')
      revalidatePath('/cms/youtube/ab-lab')
    }
    if (r.ok) return { ok: true }
    if (r.motivo === undefined || !REPASSADOS.has(r.motivo)) Sentry.captureMessage('sugestoes: motivo desconhecido de niche_signals_dispensar', { level: 'warning', extra: { motivo: r.motivo } })
    return { ok: false, motivo: r.motivo !== undefined && REPASSADOS.has(r.motivo) ? (r.motivo as 'nao_aberto' | 'nao_encontrado' | 'motivo_invalido') : 'falhou' }
  } catch (e) {
    unstable_rethrow(e)
    Sentry.captureException(e, { tags: { component: 'sugestoes', step: 'dispensar' } })
    return { ok: false, motivo: 'falhou' }
  }
}

const EntradaAdiar = z.object({ id: z.string().uuid() })
const REPASSADOS_ADIAR: ReadonlySet<string> = new Set(['nao_aberto', 'nao_encontrado'])
const ACAO_ADIAR = 'adiar sugestões do nicho'

/**
 * F3b: "Adiar 7 dias". Mesma ordem da dispensa. `ja_adiado` (com a data) e `expira_antes` (com a data de vencimento) seguem para a tela, que trata o primeiro
 * como sucesso e o segundo como "não adiou". Vencida ainda `aberto` chega como `nao_aberto` (a função do banco recusa).
 */
export async function adiarSugestao(id: string): Promise<RespostaDaAcao> {
  const entrada = EntradaAdiar.safeParse({ id })
  if (!entrada.success) return { ok: false, motivo: 'motivo_invalido' }
  try {
    const { siteId } = await getSiteContext()
    if (await denyUnlessSiteAdmin(siteId, ACAO_ADIAR)) return { ok: false, motivo: 'sem_permissao' }
    const edicao = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
    if (!edicao.ok) return { ok: false, motivo: 'sem_permissao' }
    const r = await adiarSinal(getSupabaseServiceClient(), siteId, entrada.data.id, `user:${edicao.user.id}`)
    // A tela está desatualizada em todo desfecho que não é erro nosso: revalida também em "já saiu", "já adiada" e "vence antes".
    if (r.ok || r.motivo === 'nao_aberto' || r.motivo === 'ja_adiado' || r.motivo === 'expira_antes') {
      revalidatePath('/cms/youtube/competitors', 'layout')
      revalidatePath('/cms/youtube/ab-lab')
    }
    if (r.ok) return { ok: true, adiado_ate: r.adiado_ate }
    if (r.motivo === 'ja_adiado' && r.adiado_ate) return { ok: false, motivo: 'ja_adiado', adiado_ate: r.adiado_ate }
    if (r.motivo === 'expira_antes' && r.expira_em) return { ok: false, motivo: 'expira_antes', expira_em: r.expira_em }
    if (!REPASSADOS_ADIAR.has(r.motivo)) Sentry.captureMessage('sugestoes: motivo desconhecido de niche_signals_adiar', { level: 'warning', extra: { motivo: r.motivo } })
    return { ok: false, motivo: REPASSADOS_ADIAR.has(r.motivo) ? (r.motivo as 'nao_aberto' | 'nao_encontrado') : 'falhou' }
  } catch (e) {
    unstable_rethrow(e)
    Sentry.captureException(e, { tags: { component: 'sugestoes', step: 'adiar' } })
    return { ok: false, motivo: 'falhou' }
  }
}

const EntradaTitulos = z.object({ ownVideoId: z.string().uuid(), signalId: z.string().uuid() })
const ACAO_TITULOS = 'pedir títulos à forja'
const NADA_CANCELADO = 'Nada cancelado: o pedido já saiu da fila ou está sendo escrito.'

/** 400 = entrada nossa malformada (o motor recusou o formato): vira `falhou` sem texto e sem Sentry; a frase do motor só sai pelo ramo `recusado`. */
const ehEntradaRuim = (e: unknown): e is PipelineServiceError =>
  (e instanceof PipelineServiceError || (e instanceof Error && e.name === 'PipelineServiceError')) && (e as PipelineServiceError).status === 400

/**
 * F4 T9: "Pedir títulos". Ordem: Zod; quem administra o site, ANTES de qualquer cliente de serviço; a sessão de edição (id do usuário);
 * `askReading`. O motor recusa com a frase dele (sem a capacidade, já há pedido, sem dado novo, sinal fechado). O Cowork NÃO tem esta ação (D-F4-4).
 */
export async function pedirTitulos(ownVideoId: string, signalId: string): Promise<RespostaDoPedidoDeTitulos> {
  const entrada = EntradaTitulos.safeParse({ ownVideoId, signalId })
  if (!entrada.success) return { ok: false, motivo: 'falhou' }
  try {
    const { siteId } = await getSiteContext()
    const admin = await requireSiteAdminScope(siteId)
    if (!admin.ok) return { ok: false, motivo: 'sem_permissao' }
    const edicao = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
    if (!edicao.ok) return { ok: false, motivo: 'sem_permissao' }
    const ctx = { siteId, permissions: ['write' as const], supabase: getSupabaseServiceClient(), source: 'session' as const }
    const r = await askReading(ctx, { type: 'titulo-complementar', scope: 'todos', ownVideoId: entrada.data.ownVideoId, signalId: entrada.data.signalId, userId: edicao.user.id }, observatoryNow())
    revalidatePath('/cms/youtube/competitors', 'layout')
    revalidatePath('/cms/youtube/ab-lab')
    if (r.data.ok) return { ok: true }
    return { ok: false, motivo: 'recusado', texto: r.data.reason ?? 'Nada enviado.' }
  } catch (e) {
    unstable_rethrow(e)
    if (ehEntradaRuim(e)) return { ok: false, motivo: 'falhou' }
    Sentry.captureException(e, { tags: { component: 'sugestoes', step: 'pedir-titulos' } })
    return { ok: false, motivo: 'falhou' }
  }
}

/** F4 T9: "Cancelar pedido" do par (vídeo seu × sugestão); só o que ainda espera na fila. Mesma ordem de guardas do pedido. */
export async function cancelarTitulos(ownVideoId: string, signalId: string): Promise<RespostaDoPedidoDeTitulos> {
  const entrada = EntradaTitulos.safeParse({ ownVideoId, signalId })
  if (!entrada.success) return { ok: false, motivo: 'falhou' }
  try {
    const { siteId } = await getSiteContext()
    const admin = await requireSiteAdminScope(siteId)
    if (!admin.ok) return { ok: false, motivo: 'sem_permissao' }
    const edicao = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
    if (!edicao.ok) return { ok: false, motivo: 'sem_permissao' }
    const ctx = { siteId, permissions: ['write' as const], supabase: getSupabaseServiceClient(), source: 'session' as const }
    const r = await cancelReading(ctx, { type: 'titulo-complementar', ownVideoId: entrada.data.ownVideoId, signalId: entrada.data.signalId })
    revalidatePath('/cms/youtube/competitors', 'layout')
    revalidatePath('/cms/youtube/ab-lab')
    return r.data.cancelled ? { ok: true } : { ok: false, motivo: 'recusado', texto: NADA_CANCELADO }
  } catch (e) {
    unstable_rethrow(e)
    if (ehEntradaRuim(e)) return { ok: false, motivo: 'falhou' }
    Sentry.captureException(e, { tags: { component: 'sugestoes', step: 'cancelar-titulos' } })
    return { ok: false, motivo: 'falhou' }
  }
}
