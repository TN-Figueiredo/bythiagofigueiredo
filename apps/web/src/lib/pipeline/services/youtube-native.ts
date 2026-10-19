import { z } from 'zod'
import {
  serializarAvaliacao, serializarRegistro,
  type AvaliacaoSerializada, type LinhaAbNativeAvaliacao, type LinhaAbNativeTest, type RegistroNativoSerializado,
} from '@/lib/youtube/teste-youtube/registro/serializar'
import type { ServiceContext, ServiceResult } from './types'
import { err, ok } from './types'

export const ESTADOS_NATIVO = ['em_andamento', 'encerrado', 'sem_desfecho', 'descartado'] as const
const FiltroSchema = z.object({
  youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/, 'video_id must be the 11-character YouTube id').optional(),
  estado: z.enum(ESTADOS_NATIVO).optional(),
})
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LIMITE_LISTA = 100
const LIMITE_AVALIACOES = 20

const COLUNAS_TESTE = 'id, video_id, youtube_video_id, origem, campos, estado, variantes_titulo, votos_titulo, titulo_oficial, primeira_vista, ultima_vista, desfecho_estado, desfecho_motivo, desfecho_em, desfecho_versao_regra, vencedor_titulo, vencedor_fonte, evidencia, evidencia_cortada, versao_regra'
const COLUNAS_AVALIACAO = 'avaliada_em, estado_14, estado_48, motivo_14, mistas_48, mistas_48_fora_quarentena, min_desde_escrita, erro, retroativa, aviso'

/** Lista os registros do teste nativo do site (mais novos primeiro). `estado: sem_leitura` nunca quer dizer sem teste: é só o estado da avaliação. */
export async function listNativeTests(
  ctx: ServiceContext,
  f: { youtubeVideoId?: string; estado?: string },
): Promise<ServiceResult<{ testes: RegistroNativoSerializado[] }>> {
  const p = FiltroSchema.safeParse(f)
  if (!p.success) return err('VALIDATION_ERROR', p.error.issues.map(i => i.message).join('; '), 400)

  let q = ctx.supabase.from('ab_native_tests').select(COLUNAS_TESTE).eq('site_id', ctx.siteId)
  if (p.data.youtubeVideoId) q = q.eq('youtube_video_id', p.data.youtubeVideoId)
  if (p.data.estado) q = q.eq('estado', p.data.estado)
  const { data, error } = await q.order('created_at', { ascending: false }).order('id').limit(LIMITE_LISTA)
  if (error) return err('DB_ERROR', 'Failed to load the native test records', 500)
  return ok({ testes: ((data ?? []) as LinhaAbNativeTest[]).map(serializarRegistro) })
}

/** Um registro e as últimas 20 avaliações do vídeo (da mais nova para a mais velha). */
export async function getNativeTest(
  ctx: ServiceContext,
  id: string,
): Promise<ServiceResult<{ teste: RegistroNativoSerializado; avaliacoes: AvaliacaoSerializada[] }>> {
  if (!UUID.test(id)) return err('VALIDATION_ERROR', 'id must be a UUID', 400)

  const { data, error } = await ctx.supabase.from('ab_native_tests').select(COLUNAS_TESTE).eq('id', id).eq('site_id', ctx.siteId).limit(1)
  if (error) return err('DB_ERROR', 'Failed to load the native test record', 500)
  const linha = ((data ?? []) as Array<LinhaAbNativeTest & { video_id: string }>)[0]
  if (!linha) return err('NOT_FOUND', 'Native test record not found', 404)

  const av = await ctx.supabase.from('ab_native_avaliacoes').select(COLUNAS_AVALIACAO)
    .eq('site_id', ctx.siteId).eq('video_id', linha.video_id)
    .order('avaliada_em', { ascending: false }).order('id', { ascending: false }).limit(LIMITE_AVALIACOES)
  if (av.error) return err('DB_ERROR', 'Failed to load the native test evaluations', 500)
  return ok({
    teste: serializarRegistro(linha),
    avaliacoes: ((av.data ?? []) as LinhaAbNativeAvaliacao[]).map(serializarAvaliacao),
  })
}
