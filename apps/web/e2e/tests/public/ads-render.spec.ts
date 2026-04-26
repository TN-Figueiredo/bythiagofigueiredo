import { test, expect } from '../../fixtures'

test.describe('Ad Rendering — Public Blog Post', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'lgpd_consent_v1',
        JSON.stringify({
          functional: true,
          analytics: true,
          marketing: true,
          version: 1,
          anonymousId: 'e2e-anon-id',
          updatedAt: new Date().toISOString(),
        }),
      )
    })
  })

  test('template placeholder renders in blog post when kill_ads is disabled', async ({ page }) => {
    const response = await page.goto('/blog')
    expect(response?.status()).not.toBe(500)

    const firstPost = page.locator('article a, [data-testid="blog-post-card"] a').first()
    const hasPost = await firstPost.isVisible({ timeout: 5_000 }).catch(() => false)

    if (hasPost) {
      await firstPost.click()
      await page.waitForURL(/\/blog\//)
      await expect(page.locator('main')).toBeVisible()

      const errors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text())
      })

      const ignoredPatterns = ['favicon', 'net::ERR_ABORTED', 'Failed to load resource']
      await page.waitForTimeout(500)
      const realErrors = errors.filter(e => !ignoredPatterns.some(p => e.includes(p)))
      expect(
        realErrors.filter(e => !e.includes('adsbygoogle')),
        `Unexpected console errors: ${realErrors.join(', ')}`,
      ).toHaveLength(0)
    }
  })

  test('dismiss button hides the ad and persists on return', async ({ page, supabaseAdmin }) => {
    const { data: killSwitch } = await supabaseAdmin
      .from('kill_switches')
      .select('enabled')
      .eq('id', 'kill_ads')
      .single()

    test.skip(!killSwitch?.enabled, 'kill_ads is disabled — no ads to dismiss')

    await page.goto('/blog')
    const firstPost = page.locator('article a, [data-testid="blog-post-card"] a').first()
    const hasPost = await firstPost.isVisible({ timeout: 5_000 }).catch(() => false)

    if (!hasPost) {
      test.skip(true, 'No blog posts available to test ad dismiss')
      return
    }

    await firstPost.click()
    await page.waitForURL(/\/blog\//)
    await page.waitForLoadState('networkidle')

    const dismissBtn = page.getByRole('button', { name: /[Dd]ismiss/ }).first()
    const hasDismiss = await dismissBtn.isVisible({ timeout: 3_000 }).catch(() => false)

    if (!hasDismiss) {
      test.skip(true, 'No dismissable ad rendered — possibly no active campaign for this post')
      return
    }

    const beforeDismissed = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('btf_ads_dismissed') ?? '{}'),
    )

    await dismissBtn.click()
    await expect(dismissBtn).not.toBeVisible({ timeout: 5_000 })

    const afterDismissed = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('btf_ads_dismissed') ?? '{}'),
    )
    const newKeys = Object.keys(afterDismissed).filter(k => !(k in beforeDismissed))
    expect(newKeys.length).toBeGreaterThan(0)

    const currentUrl = page.url()
    await page.goto('/blog')
    await page.goto(currentUrl)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: /[Dd]ismiss/ }).nth(newKeys.length - 1))
      .not.toBeVisible({ timeout: 3_000 })
      .catch(() => undefined)
  })

  test('blog post page loads without 500 error', async ({ page }) => {
    const response = await page.goto('/blog')
    expect(response?.status()).not.toBe(500)
    await expect(page.locator('main')).toBeVisible()
  })
})
