// "Já iniciei" (ficha) e "Confirmar" (cartão S7, estado 1): o marcador "Em teste no Studio" (§5.2/§5.3).
// O marcador é sempre aceito; depois de confirmado, cada teste NOSSO ativo/pausado do vídeo é pausado SEM escrever no YouTube
// (`settleOnAir` com `teste_youtube`). Falha dessa pausa não desfaz a confirmação: volta como aviso e a rotação pausa no próximo ciclo.
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { settleOnAir, ORIGINAL } from '@/lib/youtube/ab-settle'

export type ErroConfirmar = 'nao_encontrada' | 'ficha_incompleta' | 'ja_ha_teste_em_andamento' | 'estado_mudou' | 'ja_confirmado'
export type ResultadoConfirmar =
  | { ok: true; registroId: string; pausados: string[]; naoPausados: string[]; aviso?: string }
  | { ok: false; erro: ErroConfirmar; registroId?: string }

export const AVISO_PAUSA_NAO_CONCLUIDA = 'Confirmado. Não deu para pausar o nosso teste agora; ele será pausado na próxima rotação, sem escrever no YouTube.'

interface Params {
  sb: SupabaseClient
  siteId: string
  userId: string
  origem: { fichaId: string } | { registroId: string; lido: string }
  settle?: typeof settleOnAir
}
interface RegistroLido { id: string; video_id: string }

async function pausarOsNossos(p: Params, videoId: string, registroId: string): Promise<ResultadoConfirmar> {
  const settle = p.settle ?? settleOnAir
  const pausados: string[] = []
  const naoPausados: string[] = []
  let aviso: string | undefined
  const { data, error } = await p.sb.from('ab_tests').select('id').eq('site_id', p.siteId).eq('youtube_video_id', videoId).in('status', ['active', 'paused'])
  if (error) {
    Sentry.captureException(new Error(`confirmar: ab_tests: ${error.message}`), { tags: { area: 'ab-nativo' } })
    return { ok: true, registroId, pausados, naoPausados, aviso: AVISO_PAUSA_NAO_CONCLUIDA }
  }
  for (const t of (data ?? []) as Array<{ id: string }>) {
    try {
      const r = await settle(t.id, { siteId: p.siteId, destino: ORIGINAL, motivo: 'teste_youtube' })
      if (r.resultado === 'feito') pausados.push(t.id)
      else if (r.resultado !== 'ja_encerrado') naoPausados.push(t.id)
    } catch (e) {
      Sentry.captureException(e, { tags: { area: 'ab-nativo' }, extra: { testId: t.id } })
      naoPausados.push(t.id)
      aviso = AVISO_PAUSA_NAO_CONCLUIDA
    }
  }
  if (naoPausados.length > 0) aviso = AVISO_PAUSA_NAO_CONCLUIDA
  return { ok: true, registroId, pausados, naoPausados, ...(aviso ? { aviso } : {}) }
}

/** `update` do "Confirmar" com CAS por `updated_at`; o predicado é a confirmação (`confirmado_em is null`), nunca a origem. */
async function confirmarRegistro(p: Params, registroId: string, lido: string): Promise<{ ok: true; reg: RegistroLido } | { ok: false; erro: ErroConfirmar }> {
  let cas = lido
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const { data, error } = await p.sb.from('ab_native_tests')
      .update({ confirmado_em: new Date().toISOString(), confirmado_por: p.userId })
      .eq('id', registroId).eq('site_id', p.siteId).eq('estado', 'em_andamento').is('confirmado_em', null).eq('updated_at', cas)
      .select('id, video_id')
    if (error) throw new Error(`ab_native_tests: ${error.message}`)
    const reg = (data as RegistroLido[] | null)?.[0]
    if (reg) return { ok: true, reg }
    // Perdeu: relê. Uma simples atualização de evidência do registrador não obriga o dono a tocar de novo.
    const { data: atual, error: e2 } = await p.sb.from('ab_native_tests')
      .select('id, video_id, estado, confirmado_em, updated_at').eq('id', registroId).eq('site_id', p.siteId).maybeSingle()
    if (e2) throw new Error(`ab_native_tests: ${e2.message}`)
    const l = atual as { estado: string; confirmado_em: string | null; updated_at: string } | null
    if (!l) return { ok: false, erro: 'nao_encontrada' }
    if (l.estado !== 'em_andamento') return { ok: false, erro: 'estado_mudou' }
    if (l.confirmado_em !== null) return { ok: false, erro: 'ja_confirmado' }
    cas = l.updated_at
  }
  return { ok: false, erro: 'estado_mudou' }
}

export async function confirmarTesteNoStudio(p: Params): Promise<ResultadoConfirmar> {
  if ('fichaId' in p.origem) {
    const { data, error } = await p.sb.rpc('ab_native_iniciar', { p_site: p.siteId, p_ficha: p.origem.fichaId, p_usuario: p.userId })
    if (error) throw new Error(`ab_native_iniciar: ${error.message}`)
    const r = (data ?? {}) as { ok?: boolean; registro_id?: string; erro?: ErroConfirmar }
    if (!r.ok) {
      const erro = r.erro ?? 'estado_mudou'
      return { ok: false, erro, ...(r.registro_id ? { registroId: r.registro_id } : {}) }
    }
    const registroId = String(r.registro_id)
    const { data: reg, error: e2 } = await p.sb.from('ab_native_tests').select('id, video_id').eq('id', registroId).eq('site_id', p.siteId).maybeSingle()
    if (e2 || !reg) return { ok: true, registroId, pausados: [], naoPausados: [], aviso: AVISO_PAUSA_NAO_CONCLUIDA }
    return pausarOsNossos(p, (reg as RegistroLido).video_id, registroId)
  }
  const c = await confirmarRegistro(p, p.origem.registroId, p.origem.lido)
  if (!c.ok) return { ok: false, erro: c.erro, ...(c.erro === 'nao_encontrada' ? {} : { registroId: p.origem.registroId }) }
  return pausarOsNossos(p, c.reg.video_id, c.reg.id)
}
