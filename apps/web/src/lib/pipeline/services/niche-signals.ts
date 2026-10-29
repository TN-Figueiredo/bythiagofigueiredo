// Serviço dos sinais do nicho (F2 T8) para a rota do pipeline e o MCP `youtube_observatory`. Delega a `listarSinaisDoNicho`
// (o mesmo leitor da tela e da ação `sugestoes`); nunca consulta tabela aqui. Payload só com ids, números e chaves de lugar (D5/D8).
import { z } from 'zod'
import { calculoLigadoNoAmbiente, dispensarSinal, listarSinaisDoNicho, type ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'
import { err, ok, type ServiceContext, type ServiceResult } from './types'

export const MOTIVOS_DE_DISPENSA = ['nao_e_parecido', 'lugar_errado', 'ja_fiz', 'nao_interessa'] as const
/** E-1: `feito` só nasce de efeito observado (F4/F2b); o Cowork só dispensa. */
export const DispensaInput = z.object({ status: z.literal('dispensado'), motivo: z.enum(MOTIVOS_DE_DISPENSA) }).strict()
export type DispensaInput = z.infer<typeof DispensaInput>

const temEscrita = (ctx: ServiceContext): boolean => ctx.permissions.includes('write') || ctx.permissions.includes('admin')

export async function listNicheSignals(ctx: ServiceContext, opts: { limit?: number } = {}): Promise<ServiceResult<ListaDeSinais>> {
  const limite = Math.min(Math.max(Math.trunc(opts.limit ?? 50), 1), 50)
  return ok(await listarSinaisDoNicho(ctx.supabase, ctx.siteId, new Date(), limite, calculoLigadoNoAmbiente(), null))
}

const quemDispensa = (ctx: ServiceContext): string => (ctx.source === 'api_key' ? `key:${ctx.keyId ?? 'desconhecida'}` : 'sessao')

export async function dismissNicheSignal(ctx: ServiceContext, id: string, input: unknown): Promise<ServiceResult<{ ok: true }>> {
  if (!temEscrita(ctx)) return err('FORBIDDEN', 'Write permission required', 403)
  if (!z.string().uuid().safeParse(id).success) return err('VALIDATION_ERROR', 'id must be a uuid', 400)
  const p = DispensaInput.safeParse(input)
  if (!p.success) return err('VALIDATION_ERROR', "body must be { status: 'dispensado', motivo: nao_e_parecido | lugar_errado | ja_fiz | nao_interessa }", 400)
  const r = await dispensarSinal(ctx.supabase, ctx.siteId, id, p.data.status, p.data.motivo, quemDispensa(ctx))
  if (r.ok) return ok({ ok: true as const })
  if (r.motivo === 'nao_encontrado') return err('NOT_FOUND', 'Signal not found', 404)
  if (r.motivo === 'nao_aberto') return err('CONFLICT', 'Signal is no longer open', 409)
  return err('VALIDATION_ERROR', 'motivo is not valid for this kind of signal', 422)
}
