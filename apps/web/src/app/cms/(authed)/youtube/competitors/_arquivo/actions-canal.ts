'use server'

import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { denyUnlessSiteAdmin } from '@/lib/cms/auth-guards'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerCapacidades } from '@/lib/youtube/observatorio/arquivo-mensal/capacidades'
import { lerCanaisRemovidos } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { nomeConfere } from '../_canais/remover-model'
import { soltarCache } from '../_canais/solta-cache'

/** M9b T2: "Apagar do arquivo" de um canal removido, e "Já rodei"/"Desfazer" do painel. Tudo no servidor: admin, Zod, nome relido do banco. */
export type RespostaApagar =
  | { ok: true; status: 'ok' | 'ja_pedido' }
  | { ok: false; erro: 'sem_permissao' | 'forma' | 'desligado' | 'nome_nao_confere' | 'canal_nao_encontrado' | 'interno' }
export type RespostaMarcar = { ok: true } | { ok: false; erro: string }

const CanalRef = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
const ItemId = z.string().regex(/^(item:[1-9][0-9]{0,18}|canal:[0-9a-f-]{36})$/)

type Guarda = { ok: true; siteId: string; userId: string } | { ok: false }
async function guarda(acao: string): Promise<Guarda> {
  try {
    const { siteId } = await getSiteContext()
    if (await denyUnlessSiteAdmin(siteId, acao)) return { ok: false }
    const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
    if (!res.ok) return { ok: false }
    return { ok: true, siteId, userId: res.user.id }
  } catch {
    return { ok: false }
  }
}

function erroDoBanco(e: { message?: string } | null | undefined): 'sem_permissao' | 'canal_nao_encontrado' | 'interno' {
  const m = e?.message ?? ''
  if (m.includes('sem_direito')) return 'sem_permissao'
  if (m.includes('canal_nao_encontrado')) return 'canal_nao_encontrado'
  Sentry.captureMessage('obs_archive_channel_removal_decide falhou', 'error')
  return 'interno'
}

export async function apagarDoArquivoAction(channelRef: string, digitado: string): Promise<RespostaApagar> {
  const g = await guarda('apagar o arquivo de um canal removido')
  if (!g.ok) return { ok: false, erro: 'sem_permissao' }
  if (!lerCapacidades().comandoDeLimpeza) return { ok: false, erro: 'desligado' }
  const ref = CanalRef.safeParse(channelRef)
  if (!ref.success) return { ok: false, erro: 'forma' }
  const sb = getSupabaseServiceClient()
  try {
    // o nome esperado vem do banco, nunca do client
    const lida = await lerCanaisRemovidos(sb, g.siteId)
    if (!lida.ok) return { ok: false, erro: 'interno' }
    const linha = lida.lista.find(l => l.channel_ref === ref.data)
    if (!linha) return { ok: false, erro: 'canal_nao_encontrado' }
    const esperado = linha.nome ?? ref.data.slice(0, 8).toUpperCase()
    if (!nomeConfere(String(digitado ?? ''), esperado)) return { ok: false, erro: 'nome_nao_confere' }
    const r = await sb.rpc('obs_archive_channel_removal_decide', { p_site: g.siteId, p_channel_ref: ref.data, p_actor: g.userId })
    if (r.error) return { ok: false, erro: erroDoBanco(r.error) }
    const status = (r.data as { status?: string } | null)?.status
    return { ok: true, status: status === 'ja_pedido' ? 'ja_pedido' : 'ok' }
  } catch (e) {
    Sentry.captureException(e)
    return { ok: false, erro: 'interno' }
  } finally {
    soltarCache(g.siteId)
  }
}

async function marcar(itemId: string, desfazer: boolean): Promise<RespostaMarcar> {
  const g = await guarda('marcar um comando do arquivo como rodado')
  if (!g.ok) return { ok: false, erro: 'sem_permissao' }
  const id = ItemId.safeParse(itemId)
  if (!id.success) return { ok: false, erro: 'forma' }
  try {
    const r = await getSupabaseServiceClient().rpc('obs_archive_marcar_rodado', { p_site: g.siteId, p_item_id: id.data, p_actor: g.userId, p_desfazer: desfazer })
    if (r.error) { Sentry.captureMessage('obs_archive_marcar_rodado falhou', 'error'); return { ok: false, erro: 'interno' } }
    return { ok: true }
  } catch (e) {
    Sentry.captureException(e)
    return { ok: false, erro: 'interno' }
  } finally {
    soltarCache(g.siteId)
  }
}

export async function marcarRodado(itemId: string): Promise<RespostaMarcar> { return marcar(itemId, false) }
export async function desfazerRodado(itemId: string): Promise<RespostaMarcar> { return marcar(itemId, true) }
