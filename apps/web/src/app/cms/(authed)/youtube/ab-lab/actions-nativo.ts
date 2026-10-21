'use server'

// Ações do caminho nativo do A/B Lab (F1a-dado). Finas: `requireEditUser()` no topo (mesmo critério das demais ações de edição do Lab),
// Zod nos ids, cliente de serviço só depois. A lógica mora em `lib/youtube/teste-youtube/nativo/`.
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { requireEditUser } from '@/lib/youtube/ab-lab-acesso'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { confirmarTesteNoStudio, type ResultadoConfirmar } from '@/lib/youtube/teste-youtube/nativo/confirmar'
import {
  abrirFichaCore, salvarFichaCore, marcarStudioAbertoCore, lembrarNoComputadorCore,
  type FichaLida, type FichaRascunho, type ResultadoLembrar,
} from '@/lib/youtube/teste-youtube/nativo/ficha'

/** Frase provisória da exceção inesperada (o Logan fecha na F1a-tela-1). */
const MSG_FALHA = 'Não foi possível concluir agora. Recarregue a página e tente de novo.'
const MSG_PEDIDO_INVALIDO = 'Pedido inválido.'
const Id = z.string().uuid()
const Lido = z.string().min(1).max(64)

export type ResultadoAcaoFicha = { ok: true; ficha: FichaLida } | { ok: false; error: string; fichaAtual?: FichaLida }

async function acesso(): Promise<{ siteId: string; userId: string } | { ok: false; error: string }> {
  try {
    return await requireEditUser()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'forbidden' }
  }
}
const falha = (e: unknown, acao: string): { ok: false; error: string } => {
  Sentry.captureException(e, { tags: { area: 'ab-nativo', acao } })
  return { ok: false, error: MSG_FALHA }
}

export async function abrirFicha(videoId: string): Promise<ResultadoAcaoFicha> {
  const a = await acesso()
  if ('ok' in a) return a
  if (!Id.safeParse(videoId).success) return { ok: false, error: MSG_PEDIDO_INVALIDO }
  try {
    return await abrirFichaCore({ sb: getSupabaseServiceClient(), siteId: a.siteId, userId: a.userId, videoId })
  } catch (e) { return falha(e, 'abrirFicha') }
}

/** CAS por `atualizada_em` (`lido`): quem perde recebe a ficha atual em `fichaAtual`. */
export async function salvarFicha(fichaId: string, lido: string, dados: FichaRascunho): Promise<ResultadoAcaoFicha> {
  const a = await acesso()
  if ('ok' in a) return a
  if (!Id.safeParse(fichaId).success || !Lido.safeParse(lido).success) return { ok: false, error: MSG_PEDIDO_INVALIDO }
  try {
    return await salvarFichaCore({ sb: getSupabaseServiceClient(), siteId: a.siteId, fichaId, lido, dados })
  } catch (e) { return falha(e, 'salvarFicha') }
}

export async function marcarStudioAberto(fichaId: string): Promise<ResultadoAcaoFicha> {
  const a = await acesso()
  if ('ok' in a) return a
  if (!Id.safeParse(fichaId).success) return { ok: false, error: MSG_PEDIDO_INVALIDO }
  try {
    return await marcarStudioAbertoCore({ sb: getSupabaseServiceClient(), siteId: a.siteId, fichaId })
  } catch (e) { return falha(e, 'marcarStudioAberto') }
}

export async function lembrarNoComputador(fichaId: string): Promise<ResultadoLembrar> {
  const a = await acesso()
  if ('ok' in a) return a
  if (!Id.safeParse(fichaId).success) return { ok: false, error: MSG_PEDIDO_INVALIDO }
  try {
    return await lembrarNoComputadorCore({ sb: getSupabaseServiceClient(), siteId: a.siteId, userId: a.userId, fichaId })
  } catch (e) { return falha(e, 'lembrarNoComputador') }
}

export type ResultadoAcaoConfirmar = ResultadoConfirmar | { ok: false; erro: 'sem_permissao' | 'pedido_invalido' | 'falha'; error: string }

/** "Já iniciei": ficha -> registro confirmado e pausa do nosso sem escrever no YouTube. */
export async function jaIniciei(fichaId: string): Promise<ResultadoAcaoConfirmar> {
  const a = await acesso()
  if ('ok' in a) return { ok: false, erro: 'sem_permissao', error: a.error }
  if (!Id.safeParse(fichaId).success) return { ok: false, erro: 'pedido_invalido', error: MSG_PEDIDO_INVALIDO }
  try {
    return await confirmarTesteNoStudio({ sb: getSupabaseServiceClient(), siteId: a.siteId, userId: a.userId, origem: { fichaId } })
  } catch (e) { return { ...falha(e, 'jaIniciei'), erro: 'falha' } }
}

/** "Confirmar" do cartão S7 (estado 1): `lido` é o `updated_at` que a tela viu (CAS). */
export async function confirmarDetectado(registroId: string, lido: string): Promise<ResultadoAcaoConfirmar> {
  const a = await acesso()
  if ('ok' in a) return { ok: false, erro: 'sem_permissao', error: a.error }
  if (!Id.safeParse(registroId).success || !Lido.safeParse(lido).success) return { ok: false, erro: 'pedido_invalido', error: MSG_PEDIDO_INVALIDO }
  try {
    return await confirmarTesteNoStudio({ sb: getSupabaseServiceClient(), siteId: a.siteId, userId: a.userId, origem: { registroId, lido } })
  } catch (e) { return { ...falha(e, 'confirmarDetectado'), erro: 'falha' } }
}
