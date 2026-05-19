import { test, expect } from '../../fixtures'
import { seedTrackedLink } from '../../fixtures/seed-helpers'

test.describe('Public / Link Redirect', () => {
  const createdLinkIds: string[] = []

  test.afterAll(async ({ supabaseAdmin }) => {
    for (const id of createdLinkIds) {
      await supabaseAdmin.from('link_clicks').delete().eq('link_id', id)
      await supabaseAdmin.from('link_daily_metrics').delete().eq('link_id', id)
      await supabaseAdmin.from('tracked_links').delete().eq('id', id)
    }
  })

  test('active link redirects to destination', async ({ page, supabaseAdmin, siteId }) => {
    const { id, code } = await seedTrackedLink(supabaseAdmin, siteId, {
      destination_url: 'https://example.com/redirect-target',
    })
    createdLinkIds.push(id)

    await page.goto(`/go/${code}`, { waitUntil: 'commit' })
    const finalUrl = page.url()
    expect(finalUrl).toContain('example.com/redirect-target')
  })

  test('inactive link returns 410', async ({ page, supabaseAdmin, siteId }) => {
    const { id, code } = await seedTrackedLink(supabaseAdmin, siteId, {
      active: false,
    })
    createdLinkIds.push(id)

    const response = await page.goto(`/go/${code}`)
    expect(response?.status()).toBe(410)
  })

  test('expired link returns 410', async ({ page, supabaseAdmin, siteId }) => {
    const { id, code } = await seedTrackedLink(supabaseAdmin, siteId, {
      expires_at: new Date(Date.now() - 86_400_000).toISOString(),
    })
    createdLinkIds.push(id)

    const response = await page.goto(`/go/${code}`)
    expect(response?.status()).toBe(410)
  })

  test('not-yet-active link shows coming-soon page', async ({ page, supabaseAdmin, siteId }) => {
    const futureDate = new Date(Date.now() + 7 * 86_400_000).toISOString()
    const { id, code } = await seedTrackedLink(supabaseAdmin, siteId, {
      title: 'Coming Soon E2E',
      activates_at: futureDate,
    })
    createdLinkIds.push(id)

    const response = await page.goto(`/go/${code}`)
    expect(response?.status()).toBe(200)
    await expect(page.getByText('Coming Soon E2E')).toBeVisible()
  })

  test('UTM params are appended to destination', async ({ page, supabaseAdmin, siteId }) => {
    const { id, code } = await seedTrackedLink(supabaseAdmin, siteId, {
      destination_url: 'https://example.com/utm-test',
      utm_source: 'e2e',
      utm_medium: 'test',
      utm_campaign: 'playwright',
    })
    createdLinkIds.push(id)

    await page.goto(`/go/${code}`, { waitUntil: 'commit' })
    const finalUrl = page.url()
    expect(finalUrl).toContain('utm_source=e2e')
    expect(finalUrl).toContain('utm_medium=test')
    expect(finalUrl).toContain('utm_campaign=playwright')
  })

  test('click ID passthrough forwards gclid', async ({ page, supabaseAdmin, siteId }) => {
    const { id, code } = await seedTrackedLink(supabaseAdmin, siteId, {
      destination_url: 'https://example.com/clickid-test',
      pass_click_ids: true,
    })
    createdLinkIds.push(id)

    await page.goto(`/go/${code}?gclid=test-gclid-123`, { waitUntil: 'commit' })
    const finalUrl = page.url()
    expect(finalUrl).toContain('gclid=test-gclid-123')
  })

  test('click ID NOT forwarded when pass_click_ids is false', async ({ page, supabaseAdmin, siteId }) => {
    const { id, code } = await seedTrackedLink(supabaseAdmin, siteId, {
      destination_url: 'https://example.com/no-clickid-test',
      pass_click_ids: false,
    })
    createdLinkIds.push(id)

    await page.goto(`/go/${code}?gclid=should-not-appear`, { waitUntil: 'commit' })
    const finalUrl = page.url()
    expect(finalUrl).not.toContain('gclid')
  })

  test('nonexistent code returns 404', async ({ page }) => {
    const response = await page.goto('/go/nonexistent-code-xyz')
    expect(response?.status()).toBe(404)
  })

  test('click increments total_clicks counter', async ({ page, supabaseAdmin, siteId }) => {
    const { id, code } = await seedTrackedLink(supabaseAdmin, siteId, {
      destination_url: 'https://example.com/counter-test',
    })
    createdLinkIds.push(id)

    const { data: before } = await supabaseAdmin
      .from('tracked_links')
      .select('total_clicks')
      .eq('id', id)
      .single()
    expect(before?.total_clicks).toBe(0)

    await page.goto(`/go/${code}`, { waitUntil: 'commit' })
    await page.waitForTimeout(2000)

    const { data: after } = await supabaseAdmin
      .from('tracked_links')
      .select('total_clicks')
      .eq('id', id)
      .single()
    expect(after?.total_clicks).toBeGreaterThan(0)
  })
})
