import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { authenticateArchive } from '@/lib/pipeline/archive-auth'
import { parseBody, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { erroDoRpc } from '@/lib/youtube/observatorio/arquivo-mensal/exportar-do-banco'
import {
  CorpoExpurgo, RespostaAbrir, RespostaBloquear, RespostaCanal, RespostaRegistrar,
} from '@/lib/youtube/observatorio/arquivo-mensal/expurgo-contrato'

export const dynamic = 'force-dynamic'

const ITEM = /^item:([1-9][0-9]{0,18})$/
type Corpo = CorpoExpurgo
type Rpc = { fn: string; args: Record<string, unknown>; esquema: typeof RespostaAbrir | typeof RespostaRegistrar | typeof RespostaBloquear }

/** O passo vira uma função do banco; `item_id` que não é `item:<n>` não tem função (400). `canal` não passa por aqui. */
function chamada(site: string, c: Exclude<Corpo, { passo: 'canal' }>): Rpc | null {
  switch (c.passo) {
    case 'abrir': {
      const m = ITEM.exec(c.item_id)
      return m ? { fn: 'obs_archive_expurgo_open', args: { p_site: site, p_item_id: m[1] }, esquema: RespostaAbrir } : null
    }
    case 'registrar': {
      const m = ITEM.exec(c.item_id)
      if (!m) return null
      const { passo: _passo, item_id: _item, ...grupo } = c
      return { fn: 'obs_archive_expurgo_record', args: { p_site: site, p_item_id: m[1], p_grupo: grupo }, esquema: RespostaRegistrar }
    }
    case 'bloquear':
      return { fn: 'obs_archive_expurgo_block', args: { p_site: site, p_alvo: c.alvo_id, p_motivo: c.motivo }, esquema: RespostaBloquear }
  }
}

/** Só lê. Canal desconhecido é resposta (o CLI escreve a frase), não erro de transporte. */
async function motivoDoCanal(site: string, ref: string): Promise<RespostaCanal> {
  const sb = getSupabaseServiceClient()
  const r = await sb.from('obs_archive_channel_removals').select('archive_decision, completed_at').eq('site_id', site).eq('channel_ref', ref).maybeSingle()
  if (r.error) throw new Error('leitura_falhou')
  if (r.data) return { motivo: r.data.archive_decision === 'guardar' ? 'canal_guardado' : r.data.archive_decision === 'apagar' ? 'ok' : 'sem_destino', prefixos: [] }
  const c = await sb.from('competitor_channels').select('id').eq('site_id', site).eq('id', ref).maybeSingle()
  if (c.error) throw new Error('leitura_falhou')
  return { motivo: c.data ? 'canal_nao_removido' : 'canal_desconhecido', prefixos: [] }
}

/**
 * C14 (M9): o expurgo enxuto em quatro passos (`abrir`, `registrar`, `bloquear`, `canal`), só com chave `archive_owner`.
 * Recusa da função (`{ status: 'recusado', motivo }`) é 409 com o motivo dela; a rota não mantém lista de códigos, então código novo na SQL não pede mexer aqui.
 * Recusa não é exceção: Sentry só no caminho de falha. `unblock` e `obs_archive_m9_ligar` não têm rota (só o painel).
 */
export async function POST(req: NextRequest) {
  const a = await authenticateArchive(req, ['archive_owner'] as const)
  if (a instanceof Response) return a
  const corpo = await parseBody(req, CorpoExpurgo, a.auth)
  if (corpo instanceof Response) return corpo
  try {
    if (corpo.passo === 'canal') {
      const r = RespostaCanal.safeParse(await motivoDoCanal(a.auth.siteId, corpo.channel_ref))
      if (!r.success) throw new Error('canal_fora_do_esquema')
      return pipelineSuccess(r.data, 200, a.auth)
    }
    const rpc = chamada(a.auth.siteId, corpo)
    if (!rpc) return pipelineError('VALIDATION_ERROR', 'item_id deve ser item:<n>', 400, a.auth, [{ path: 'item_id', message: 'item_id deve ser item:<n>' }])
    const { data, error } = await getSupabaseServiceClient().rpc(rpc.fn, rpc.args)
    if (error) {
      if (error.code === 'P0001' && /^item_desconhecido\b/.test(error.message)) return pipelineError('item_desconhecido', 'item desconhecido', 404, a.auth)
      // corrida esperada com a E9 (o mês some do banco e o item é apagado no mesmo minuto): recusa de regra, não falha
      if (error.code === 'P0001' && /^mes_destacado_em_transito\b/.test(error.message)) return pipelineError('mes_destacado_em_transito', 'mes destacado em transito', 409, a.auth)
      return erroDoRpc(error, a.auth)
    }
    const recusa = (data ?? null) as { status?: unknown; motivo?: unknown; alvo_id?: unknown } | null
    if (recusa !== null && typeof recusa === 'object' && recusa.status === 'recusado') {
      const motivo = typeof recusa.motivo === 'string' && recusa.motivo.length > 0 ? recusa.motivo : 'recusado'
      return pipelineError(motivo, motivo.replaceAll('_', ' '), 409, a.auth, typeof recusa.alvo_id === 'number' ? { alvo_id: recusa.alvo_id } : undefined)
    }
    const lido = rpc.esquema.safeParse(data)
    if (!lido.success) {
      Sentry.captureMessage(`archive ${rpc.fn} fora do esquema`, 'error')
      return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth)
    }
    return pipelineSuccess(lido.data, 200, a.auth)
  } catch (e) {
    Sentry.captureException(e, { tags: { rota: 'pipeline/archive/expurgo' }, extra: { passo: corpo.passo } })
    return pipelineError('erro_do_banco', 'erro do banco', 500, a.auth)
  }
}
