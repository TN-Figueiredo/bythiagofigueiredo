import { createHash, randomBytes } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { identityKeyOf, markTokenInvalid, sweepTokenAlerts } from '@/lib/instagram/token'
import { sendNtfyAlert } from '@/lib/ops/ntfy'
import { claimAlert } from '@/lib/ops/alert-state'
import { DELETION_BLOB_BUDGET_MS, runDeletionEffects } from '@/lib/instagram/deletion'
import { matchedAccountsFilter, readSignedRequest } from '@/lib/instagram/signed-request'
import type { InstagramAccountRow } from '@/lib/instagram/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Acima disto o run anterior está morto (o teto da função é 60 s). */
const IN_FLIGHT_MS = 90_000

interface LastRequestRow {
  id: string
  confirmation_code: string
  requested_at: string
  completed_at: string | null
}

function statusUrl(code: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/data-deletion?code=${code}`
}

export async function GET(): Promise<Response> {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } })
}

export async function POST(req: Request): Promise<Response> {
  const runStart = Date.now()
  const supabase = getSupabaseServiceClient()

  const parsed = await readSignedRequest(req, supabase, 'data-deletion')
  if (!parsed.ok) {
    return parsed.status === 200
      ? Response.json({}, { status: 200 })
      : new Response('Bad Request', { status: 400 })
  }
  const igUserId = parsed.payload.user_id
  const replayKey = `sigreq:${createHash('sha256').update(parsed.raw).digest('hex')}`

  let confirmationCode: string
  let requestId: string | null = null
  let resuming = false

  try {
    // 6 — anti-replay. Aqui a idempotência é RETOMADA, nunca confirmação cega: um
    // run morto no meio deixava a linha inserida e o claim reivindicado, e
    // responder sucesso a toda re-tentativa produzia uma declaração de compliance
    // fabricada por um timeout.
    //
    // INTERVALO = `'2 days'`, casado com a retenção: o passo `retention` dos DOIS
    // crons de C2 apaga `ops_alert_state` com `like('key','sigreq:%')` e
    // `last_at < now-2d`. Declarar um intervalo de séculos prometeria uma
    // permanência que o banco apaga em 2 dias — o número aqui é o mesmo da
    // retenção, de propósito.
    // INVARIANTE: retenção (2 d) > janela de `issued_at` (24 h). Um replay que
    // sobrevive à retenção já é recusado no passo 5 de `readSignedRequest`
    // (`ISSUED_AT_MAX_AGE_S = 24 * 3600`), então nunca reabre esta chave. Mexer em
    // um dos dois números obriga a mexer no outro e nesta nota.
    //
    // MUST: usar `claimAlert` (C2, src/lib/ops/alert-state.ts) — mesma garantia da
    // rota `deauthorize`. `claimAlert` LANÇA quando a RPC devolve `error` ou algo
    // que não é boolean; o throw cai no `catch` abaixo (captureException + 500,
    // Meta re-tenta) em vez de um banco fora do ar virar "já processado" e a
    // exclusão se perder em silêncio.
    const claimed = await claimAlert(supabase, replayKey, '2 days')

    if (claimed !== true) {
      const { data: lastData } = await supabase
        .from('instagram_deletion_requests')
        .select('id, confirmation_code, requested_at, completed_at')
        .eq('ig_user_id', igUserId)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const last = (lastData ?? null) as LastRequestRow | null

      if (last) {
        if (last.completed_at !== null) {
          return Response.json({ url: statusUrl(last.confirmation_code), confirmation_code: last.confirmation_code })
        }
        if (Date.parse(last.requested_at) >= Date.now() - IN_FLIGHT_MS) {
          return new Response(null, { status: 202 })      // o run anterior ainda pode estar vivo
        }
        confirmationCode = last.confirmation_code
        requestId = last.id
        resuming = true
      } else {
        const { data: stateData } = await supabase
          .from('ops_alert_state')
          .select('last_at')
          .eq('key', replayKey)
          .maybeSingle()
        const state = (stateData ?? null) as { last_at: string } | null
        if (state && Date.parse(state.last_at) >= Date.now() - IN_FLIGHT_MS) {
          return new Response(null, { status: 202 })
        }
        await supabase.from('ops_alert_state').delete().eq('key', replayKey)
        confirmationCode = randomBytes(16).toString('hex')
      }
    } else {
      confirmationCode = randomBytes(16).toString('hex')
    }

    if (!resuming) {
      // Alcance (MUST): (ig_user_id = X OU ig_professional_id = X) E source='oauth'.
      const { data: accountsData } = await supabase
        .from('instagram_accounts')
        .select('*')
        .or(matchedAccountsFilter(igUserId))
        .eq('ig_user_id_source', 'oauth')
      const accounts = (accountsData ?? []) as InstagramAccountRow[]

      // Zero casamentos: obrigação legal cumprida, mas nunca em silêncio.
      if (accounts.length === 0) {
        Sentry.captureMessage('instagram data-deletion matched 0 accounts', 'warning')
        const { data: legacy } = await supabase
          .from('instagram_accounts')
          .select('id')
          .or(matchedAccountsFilter(igUserId))
          .eq('ig_user_id_source', 'legacy')
        if ((legacy ?? []).length > 0) {
          const { data: pushClaim } = await supabase.rpc('ops_alert_claim', {
            p_key: `ddmismatch:${igUserId}`,
            p_min_interval: '23 hours',
          })
          if (pushClaim === true) {
            // REGRA-PII-NTFY (§0): sem handle, sem ids, sem token. Nenhuma ação
            // destrutiva sobre a linha `legacy` — o push existe só para o dono
            // decidir manualmente.
            // `click` é o MESMO de todos os outros emissores — a rota curta do card
            // (Global Constraints: "todo click/action_href/backHref aponta para
            // /cms/settings/instagram"). O runbook citado no `body` é leitura, não
            // destino de clique: no celular o link do GitHub não leva a lugar
            // acionável. O `body` NÃO muda — ele é fixado byte a byte pela tabela
            // REGRA-PII-NTFY de C2 (`test/api/cron/ntfy.test.ts`).
            await sendNtfyAlert({
              title: 'Instagram deletion request matched no account',
              body: 'possible ID-space mismatch — see the runbook',
              priority: 'default',
              tags: ['warning'],
              click: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cms/settings/instagram`,
            })
          }
        }
        const nowIso = new Date().toISOString()
        await supabase.from('instagram_deletion_requests').insert({
          confirmation_code: confirmationCode,
          ig_user_id: igUserId,
          site_id: null,
          requested_at: nowIso,
          completed_at: nowIso,
        })
        return Response.json({ url: statusUrl(confirmationCode), confirmation_code: confirmationCode })
      }

      // (a) a linha nasce com `completed_at` NULL — é O sinal de "não terminou".
      const sorted = [...accounts].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      const { data: inserted } = await supabase
        .from('instagram_deletion_requests')
        .insert({
          confirmation_code: confirmationCode,
          ig_user_id: igUserId,
          site_id: sorted[0]?.site_id ?? null,
          requested_at: new Date().toISOString(),
          completed_at: null,
        })
        .select('id')
        .single()
      requestId = (inserted as { id?: string } | null)?.id ?? null

      // (b) token fora, motivo gravado
      const nowIso = new Date().toISOString()
      for (const account of accounts) {
        await markTokenInvalid(supabase, account, 'data_deletion_requested', { fatal: true, forceReason: true })
        await supabase
          .from('instagram_accounts')
          .update({ access_token: null, token_expires_at: null, updated_at: nowIso })
          .eq('id', account.id)
      }

      // (c) varredura ANTES de anonimizar — `runDeletionEffects` anonimiza em (e)
      // e depois disso o grupo não casaria: nenhum alerta sairia.
      // A chave é `identityKeyOf(row)` (C2), NUNCA `o:${payload.user_id}`: uma
      // linha casada por `ig_professional_id` tem `ig_user_id` diferente do id da
      // Meta e a chave montada à mão não encontraria grupo nenhum.
      for (const identityKey of new Set(accounts.map(identityKeyOf))) {
        await sweepTokenAlerts(supabase, { identityKey })
      }
    }

    // (d)–(h), idempotentes e retomáveis (C2). Escreve `completed_at` por último
    // e retorna cedo, deixando-o NULL, quando o laço de blobs bate no prazo.
    if (requestId) {
      await runDeletionEffects(
        supabase,
        { id: requestId, ig_user_id: igUserId },
        runStart + DELETION_BLOB_BUDGET_MS,
      )
    }

    return Response.json({ url: statusUrl(confirmationCode), confirmation_code: confirmationCode })
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'instagram-data-deletion' } })
    await supabase.from('ops_alert_state').delete().eq('key', replayKey)
    return new Response('Internal Server Error', { status: 500 })
  }
}
