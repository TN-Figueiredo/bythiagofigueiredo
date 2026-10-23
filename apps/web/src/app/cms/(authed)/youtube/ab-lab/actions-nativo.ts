'use server'

// Ações do caminho nativo do A/B Lab (F1a-dado). Finas: `requireEditUser()` no topo (mesmo critério das demais ações de edição do Lab),
// Zod nos ids, cliente de serviço só depois. A lógica mora em `lib/youtube/teste-youtube/nativo/`.
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { requireEditUser } from '@/lib/youtube/ab-lab-acesso'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { confirmarTesteNoStudio, type ResultadoConfirmar } from '@/lib/youtube/teste-youtube/nativo/confirmar'
import { descartarDetectado, type ResultadoDescartar } from '@/lib/youtube/teste-youtube/nativo/descartar'
import { responderDia14, mudarRespostaDia14, type ResultadoResponder, type ResultadoMudar } from '@/lib/youtube/teste-youtube/nativo/resposta'
import { guardarImagemDaFichaCore, TAMANHO_MAXIMO_IMAGEM, MSG_IMAGEM_GRANDE, type ResultadoImagemFicha } from '@/lib/youtube/teste-youtube/nativo/imagem-ficha'
import { getSiteContext } from '@/lib/cms/site-context'
import {
  abrirFichaCore, salvarFichaCore, lembrarNoComputadorCore, lerFichaDoVideoCore, recomecarFichaCore,
  type FichaLida, type FichaRascunho, type ResultadoLembrar, type ResultadoLeitura,
} from '@/lib/youtube/teste-youtube/nativo/ficha'
import { marcarStudioAbertoComCopiaCore, jaIniciouCore } from '@/lib/youtube/teste-youtube/nativo/ficha-fluxo'

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

/** Só leitura: a ficha aberta mais recente do vídeo e se está vencida. Nunca cria nem descarta. */
export async function lerFichaDoVideo(videoId: string): Promise<ResultadoLeitura> {
  const a = await acesso()
  if ('ok' in a) return a
  if (!Id.safeParse(videoId).success) return { ok: false, error: MSG_PEDIDO_INVALIDO }
  try {
    return await lerFichaDoVideoCore({ sb: getSupabaseServiceClient(), siteId: a.siteId, videoId })
  } catch (e) { return falha(e, 'lerFichaDoVideo') }
}

/** "Recomeçar" uma ficha vencida: a velha é descartada, a nova nasce com as mesmas versões. */
export async function recomecarFicha(fichaVencidaId: string): Promise<ResultadoAcaoFicha> {
  const a = await acesso()
  if ('ok' in a) return a
  if (!Id.safeParse(fichaVencidaId).success) return { ok: false, error: MSG_PEDIDO_INVALIDO }
  try {
    return await recomecarFichaCore({ sb: getSupabaseServiceClient(), siteId: a.siteId, userId: a.userId, fichaVencidaId })
  } catch (e) { return falha(e, 'recomecarFicha') }
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
    return await marcarStudioAbertoComCopiaCore({ sb: getSupabaseServiceClient(), siteId: a.siteId, fichaId })
  } catch (e) { return falha(e, 'marcarStudioAberto') }
}

/** Envio manual da imagem de uma versão da ficha: guarda no Blob (`ab-native-ficha/`) e devolve a imagem; o cliente a grava pela `salvarFicha`. */
export async function enviarImagemDaFicha(fichaId: string, formData: FormData): Promise<ResultadoImagemFicha> {
  const a = await acesso()
  if ('ok' in a) return a
  if (!Id.safeParse(fichaId).success) return { ok: false, error: MSG_PEDIDO_INVALIDO }
  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: MSG_PEDIDO_INVALIDO }
  if (file.size > TAMANHO_MAXIMO_IMAGEM) return { ok: false, error: MSG_IMAGEM_GRANDE }
  try {
    const bytes = Buffer.from(await file.arrayBuffer())
    return await guardarImagemDaFichaCore({ sb: getSupabaseServiceClient(), siteId: a.siteId, fichaId, bytes })
  } catch (e) { return falha(e, 'enviarImagemDaFicha') }
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
    return await jaIniciouCore({ sb: getSupabaseServiceClient(), siteId: a.siteId, userId: a.userId, fichaId })
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

export type ResultadoAcaoDescartar = ResultadoDescartar | { ok: false; erro: 'sem_permissao' | 'pedido_invalido' | 'falha'; error: string }

/** "Não é teste / Liberar o Lab": `lido` é o `updated_at` que a tela viu (CAS). */
export async function naoETeste(registroId: string, lido: string): Promise<ResultadoAcaoDescartar> {
  const a = await acesso()
  if ('ok' in a) return { ok: false, erro: 'sem_permissao', error: a.error }
  if (!Id.safeParse(registroId).success || !Lido.safeParse(lido).success) return { ok: false, erro: 'pedido_invalido', error: MSG_PEDIDO_INVALIDO }
  let orgId: string | null = null
  try { orgId = (await getSiteContext()).orgId ?? null } catch { /* sem org: a linha de auditoria leva site_id */ }
  try {
    return await descartarDetectado({ sb: getSupabaseServiceClient(), siteId: a.siteId, userId: a.userId, orgId, registroId, lido })
  } catch (e) { return { ...falha(e, 'naoETeste'), erro: 'falha' } }
}

const PedidoResposta = z.object({
  registroId: z.string().uuid(),
  lido: z.string().min(1).max(64),
  resposta: z.enum(['venceu_nova', 'venceu_original', 'ficou_igual', 'inconclusivo', 'nao_vi']),
  n: z.number().int().min(1).max(3).nullable(),
  /** Título da versão tocada, como a tela o mostrava: o servidor confere contra a numeração de agora. Opcional para a tela-1 não quebrar. */
  tituloVisto: z.string().max(400).nullable().optional(),
}).strict()
export type PedidoRespostaDia14 = z.infer<typeof PedidoResposta>
export type ResultadoAcaoResponder = ResultadoResponder | { ok: false; erro: 'sem_permissao' | 'pedido_invalido' | 'falha'; error: string }

/** Resposta do dia 14 ("Venceu a nova", "Ficou igual", ...). `lido` é o `updated_at` que a tela viu (CAS). */
export async function responderTesteDoYouTube(pedido: PedidoRespostaDia14): Promise<ResultadoAcaoResponder> {
  const a = await acesso()
  if ('ok' in a) return { ok: false, erro: 'sem_permissao', error: a.error }
  const v = PedidoResposta.safeParse(pedido)
  if (!v.success) return { ok: false, erro: 'pedido_invalido', error: MSG_PEDIDO_INVALIDO }
  let orgId: string | null = null
  try { orgId = (await getSiteContext()).orgId ?? null } catch { /* sem org: a linha de auditoria leva site_id */ }
  try {
    return await responderDia14({ sb: getSupabaseServiceClient(), siteId: a.siteId, userId: a.userId, orgId, ...v.data, agora: new Date() })
  } catch (e) { return { ...falha(e, 'responderTesteDoYouTube'), erro: 'falha' } }
}

const PedidoMudarResposta = PedidoResposta.extend({
  /** O que a tela mostrava como resposta atual: o servidor só troca se a linha ainda está assim (CAS, D-4). */
  respostaVista: z.enum(['venceu_nova', 'venceu_original', 'ficou_igual', 'inconclusivo', 'nao_vi']),
  varianteVista: z.number().int().min(1).max(3).nullable(),
}).strict()
export type PedidoMudarRespostaDia14 = z.infer<typeof PedidoMudarResposta>
export type ResultadoAcaoMudar = ResultadoMudar | { ok: false; erro: 'sem_permissao' | 'pedido_invalido' | 'falha'; error: string }

/** "Mudar minha resposta" do dia 14. `lido` é o `updated_at` que a tela viu; uma tentativa só (D-4). */
export async function mudarRespostaDoTesteDoYouTube(pedido: PedidoMudarRespostaDia14): Promise<ResultadoAcaoMudar> {
  const a = await acesso()
  if ('ok' in a) return { ok: false, erro: 'sem_permissao', error: a.error }
  const v = PedidoMudarResposta.safeParse(pedido)
  if (!v.success) return { ok: false, erro: 'pedido_invalido', error: MSG_PEDIDO_INVALIDO }
  let orgId: string | null = null
  try { orgId = (await getSiteContext()).orgId ?? null } catch { /* sem org: a linha de auditoria leva site_id */ }
  try {
    return await mudarRespostaDia14({ sb: getSupabaseServiceClient(), siteId: a.siteId, userId: a.userId, orgId, ...v.data, tituloVisto: v.data.tituloVisto, agora: new Date() })
  } catch (e) { return { ...falha(e, 'mudarRespostaDoTesteDoYouTube'), erro: 'falha' } }
}
