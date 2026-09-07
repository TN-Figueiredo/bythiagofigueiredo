import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { identityKeyOf, markTokenInvalid, sweepTokenAlerts } from '@/lib/instagram/token'
import { claimAlert } from '@/lib/ops/alert-state'
import { matchedAccountsFilter, readSignedRequest } from '@/lib/instagram/signed-request'
import type { InstagramAccountRow } from '@/lib/instagram/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(): Promise<Response> {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } })
}

export async function POST(req: Request): Promise<Response> {
  const supabase = getSupabaseServiceClient()

  const parsed = await readSignedRequest(req, supabase, 'deauthorize')
  if (!parsed.ok) {
    return parsed.status === 200
      ? Response.json({}, { status: 200 })
      : new Response('Bad Request', { status: 400 })
  }
  const igUserId = parsed.payload.user_id

  const replayKey = `sigreq:${createHash('sha256').update(parsed.raw).digest('hex')}`

  try {
    // 6 — anti-replay SÓ depois de assinatura + janela. `false` = já processado:
    // 200 {} incondicional, sem efeitos e sem liberar o claim.
    //
    // INTERVALO = `'2 days'`, e não um intervalo "permanente", porque a retenção
    // manda: o passo `retention` dos DOIS crons de C2 apaga `ops_alert_state` com
    // `like('key','sigreq:%')` e `last_at < now-2d`, então uma chave declarada
    // "permanente" evaporaria de qualquer jeito em 2 dias e o plano estaria
    // afirmando uma garantia que o banco não sustenta.
    // INVARIANTE: retenção (2 d) > janela de `issued_at` (24 h). Um replay que
    // sobrevive à retenção já é recusado no passo 5 de `readSignedRequest`
    // (`issuedAt >= nowS - ISSUED_AT_MAX_AGE_S`, 24 h) — nunca chega até aqui.
    // Quem mudar um dos dois números tem de mudar o outro.
    //
    // MUST: usar `claimAlert` (C2, src/lib/ops/alert-state.ts), que LANÇA quando a
    // RPC devolve `error` ou algo que não é boolean. Ler só `data` faria um banco
    // fora do ar ou a RPC ausente virarem `data: null` ⇒ "já processado" ⇒ 200 {}
    // sem NENHUM efeito: a Meta considera o callback entregue, nunca re-tenta, e a
    // desautorização se perde em silêncio. Dentro do `try`, como em
    // `data-deletion`: o throw vira `captureException` + 500 e a Meta re-tenta.
    if (!(await claimAlert(supabase, replayKey, '2 days'))) {
      return Response.json({}, { status: 200 })
    }

    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .or(matchedAccountsFilter(igUserId))
      .eq('ig_user_id_source', 'oauth')

    const rows = (accounts ?? []) as InstagramAccountRow[]
    if (rows.length === 0) {
      Sentry.captureMessage('instagram deauthorize matched 0 accounts', 'warning')
      return Response.json({}, { status: 200 })
    }

    const nowIso = new Date().toISOString()
    for (const account of rows) {
      await markTokenInvalid(supabase, account, 'deauthorized', { fatal: true, forceReason: true })
      await supabase
        .from('instagram_accounts')
        .update({ access_token: null, token_expires_at: null, updated_at: nowIso })
        .eq('id', account.id)
      await supabase.from('instagram_sync_log').insert({
        site_id: account.site_id,
        account_id: account.id,
        mode: 'deauthorize',
        status: 'completed',
        posts_found: 0,
        posts_inserted: 0,
        posts_updated: 0,
        media_cached: 0,
        error_message: 'detail: deauthorized by Meta callback',
        started_at: nowIso,
        completed_at: nowIso,
      })
    }

    // MUST: a identidade de um alerta é `identityKeyOf(row)` (C2), não
    // `o:${payload.user_id}`. Uma linha casada por `ig_professional_id` tem
    // `ig_user_id` diferente do id da Meta — varrer a chave montada à mão não
    // encontraria o grupo e o episódio recém-aberto ficaria sem alerta nenhum.
    for (const identityKey of new Set(rows.map(identityKeyOf))) {
      await sweepTokenAlerts(supabase, { identityKey })
    }
    return Response.json({}, { status: 200 })
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'instagram-deauthorize' } })
    await supabase.from('ops_alert_state').delete().eq('key', replayKey)
    return new Response('Internal Server Error', { status: 500 })
  }
}
