// Registro de tentativas em yt_own_collection_attempts, pela função do banco (o PostgREST não soma
// num upsert). Toda tentativa é gravada, inclusive `ok`: sem linha = nunca tentado.
import { conferirBanco, type ErroBanco } from './schema'
import type { AttemptKind, Outcome, StepCtx, Tentativa } from './types'

/** Nunca lança: erro ao gravar a tentativa vira item de `falhas[]`. */
export async function registrarTentativa(
  ctx: Pick<StepCtx, 'supabase' | 'falhas' | 'tentativas'>,
  t: Tentativa,
): Promise<void> {
  ctx.tentativas.push(t)
  let res: { error: ErroBanco | null }
  try {
    res = await ctx.supabase.rpc('yt_own_attempt_record', {
      p_site_id: t.site_id,
      p_scope_type: t.scope_type,
      p_scope_id: t.scope_id,
      p_kind: t.kind,
      p_outcome: t.outcome,
      p_http_status: t.http_status ?? null,
      p_error: t.error ?? null,
      p_channel_id: t.channel_id ?? null,
    })
  } catch {
    res = { error: { code: null, message: 'rpc lançou' } }
  }
  conferirBanco(res, 'yt_own_collection_attempts', ctx.falhas)
}

export function contarPorResultado(
  tentativas: readonly Tentativa[],
  kinds: readonly AttemptKind[],
): Partial<Record<Outcome, number>> {
  const out: Partial<Record<Outcome, number>> = {}
  for (const t of tentativas) {
    if (!kinds.includes(t.kind)) continue
    out[t.outcome] = (out[t.outcome] ?? 0) + 1
  }
  return out
}

/** `scope_id` de um job: `<youtube_channels.id>:<report_type_id>`. */
export function scopeJob(channelUuid: string, reportTypeId: string): string {
  return `${channelUuid}:${reportTypeId}`
}
