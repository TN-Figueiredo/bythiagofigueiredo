import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { getSiteContext } from '../../../../lib/cms/site-context'

export async function GET() {
  const steps: Record<string, unknown> = {}

  try {
    const ctx = await getSiteContext()
    steps.siteId = ctx.siteId

    const db = getSupabaseServiceClient()
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 86400000).toISOString()

    const ids = ['main-en', 'trips-en', 'code-en', 'growth-en']
    const results: Record<string, string> = {}

    for (const nlId of ids) {
      const { error } = await db.from('newsletter_subscriptions').insert({
        site_id: ctx.siteId,
        email: 'multi-test@example.com',
        status: 'pending_confirmation',
        newsletter_id: nlId,
        locale: 'en',
        consent_text_version: 'test',
        confirmation_token_hash: tokenHash,
        confirmation_expires_at: expiresAt,
        ip: null,
        user_agent: 'test',
      })
      results[nlId] = error ? `FAIL: ${error.message}` : 'OK'
    }
    steps.inserts = results

    // Count rows
    const { count } = await db
      .from('newsletter_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('email', 'multi-test@example.com')
    steps.totalRows = count

    // Test confirm RPC
    const { data: confirmResult } = await db.rpc('confirm_newsletter_subscription', {
      p_token_hash: tokenHash,
    })
    steps.confirm = confirmResult

    // Verify all confirmed
    const { data: rows } = await db
      .from('newsletter_subscriptions')
      .select('newsletter_id, status')
      .eq('email', 'multi-test@example.com')
    steps.finalRows = rows

    // Cleanup
    await db.from('newsletter_subscriptions').delete().eq('email', 'multi-test@example.com')
    steps.cleanup = 'done'
  } catch (e: unknown) {
    steps.error = String(e)
  }

  return NextResponse.json(steps, { status: 200 })
}
