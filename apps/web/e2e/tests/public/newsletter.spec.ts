import { test, expect } from '../../fixtures'
import { PublicPage } from '../../pages/PublicPage'
import { createHash } from 'node:crypto'

async function getConfirmUrl(
  inbucketUrl: string,
  mailbox: string,
  maxAttempts = 15,
  initialDelayMs = 500,
): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const delayMs = Math.min(initialDelayMs * 2 ** i, 5_000)
    try {
      const listRes = await fetch(`${inbucketUrl}/api/v1/mailbox/${mailbox}`)
      if (!listRes.ok) { await new Promise(r => setTimeout(r, delayMs)); continue }
      const headers: Array<{ id: string }> = await listRes.json()
      if (headers.length === 0) { await new Promise(r => setTimeout(r, delayMs)); continue }

      const msgRes = await fetch(`${inbucketUrl}/api/v1/mailbox/${mailbox}/${headers[0].id}`)
      if (!msgRes.ok) { await new Promise(r => setTimeout(r, delayMs)); continue }
      const msg: { body: { text: string; html: string } } = await msgRes.json()
      const text = msg.body.html || msg.body.text
      const match = text.match(/https?:\/\/[^\s"<>]+confirm[^\s"<>]*/i)
      if (match?.[0]) return match[0]
    } catch {}
    await new Promise(r => setTimeout(r, delayMs))
  }
  return null
}

const INBUCKET_URL = process.env.INBUCKET_URL ?? 'http://127.0.0.1:54324'
const TEST_EMAIL = 'e2e-newsletter-test@test.example'

test.describe('Public / Newsletter', () => {
  test.use({ storageState: 'e2e/.auth/public.json' })
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async ({ supabaseAdmin }) => {
    const hashedEmail = createHash('sha256').update(TEST_EMAIL).digest('hex')
    await supabaseAdmin
      .from('newsletter_subscriptions')
      .delete()
      .in('email', [TEST_EMAIL, hashedEmail])
  })

  test('subscribe com email válido exibe confirmação pendente', async ({ page, acceptedCookies }) => {
    await page.goto('/')
    const pub = new PublicPage(page)
    await pub.subscribeNewsletter(TEST_EMAIL)
    await expect(
      page.getByRole('status')
        .or(page.getByRole('alert'))
        .or(page.locator('[data-testid="newsletter-feedback"]'))
        .or(page.locator('form').getByText(/[Cc]onfirm|[Pp]endente|[Vv]erifique/i))
    ).toBeVisible({ timeout: 10_000 })
  })

  test('confirmar via link de email muda status para confirmed', async ({ page, acceptedCookies }) => {
    test.slow()

    const mailbox = TEST_EMAIL.split('@')[0]
    const confirmUrl = await getConfirmUrl(INBUCKET_URL, mailbox)
    if (!confirmUrl) {
      test.skip(true, 'Inbucket não entregou email dentro do timeout — verifique se supabase está rodando')
      return // stop execution — test.skip alone doesn't halt in Playwright
    }

    await page.goto(confirmUrl)
    await expect(
      page.getByText(/[Cc]onfirmado|[Cc]onfirmed|[Ss]ubscrito/i)
    ).toBeVisible({ timeout: 20_000 })
  })

  test('double-subscribe com mesmo email exibe mensagem adequada', async ({ page, acceptedCookies }) => {
    await page.goto('/')
    const pub = new PublicPage(page)
    // Subscribe again with same email
    await pub.subscribeNewsletter(TEST_EMAIL)
    // Should show "already subscribed" or similar
    await expect(
      page.getByText(/[Jj]á.*[Cc]adastrado|[Aa]lready|[Ee]xist/i)
        .or(page.getByText(/[Cc]onfirm|[Pp]endente/i))
    ).toBeVisible({ timeout: 10_000 })
  })

  test('unsubscribe via token anonymiza email', async ({ page, acceptedCookies, supabaseAdmin }) => {
    test.slow()
    // Get the unsubscribe token from the unsubscribe_tokens table (keyed by token_hash, has email column)
    const { data: token } = await supabaseAdmin
      .from('unsubscribe_tokens')
      .select('token_hash')
      .eq('email', TEST_EMAIL)
      .maybeSingle()

    if (!token?.token_hash) {
      test.skip(true, 'No subscription found to unsubscribe')
      return
    }

    await page.goto(`/unsubscribe/${token.token_hash}`)

    // Verify UI shows unsubscribed state
    await expect(
      page.getByText(/[Dd]escadastrado|[Uu]nsubscribed|[Rr]emovido/i)
    ).toBeVisible({ timeout: 15_000 })

    // Verify DB: original email is gone (anonymized to sha256 hash)
    const { data: byOriginal } = await supabaseAdmin
      .from('newsletter_subscriptions')
      .select('email, status')
      .eq('email', TEST_EMAIL)
      .maybeSingle()
    expect(byOriginal).toBeNull() // original email no longer queryable

    // Verify an anonymized row exists (sha256 hex = 64 chars, all hex)
    const hashedEmail = createHash('sha256').update(TEST_EMAIL).digest('hex')
    const { data: anonymized } = await supabaseAdmin
      .from('newsletter_subscriptions')
      .select('email, status')
      .eq('email', hashedEmail)
      .maybeSingle()
    expect(anonymized?.status).toBe('unsubscribed')
    expect(anonymized?.email).toBe(hashedEmail)
  })
})
