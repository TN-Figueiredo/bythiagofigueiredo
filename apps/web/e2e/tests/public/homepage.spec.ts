import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Public / Homepage', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('homepage carrega sem erros', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.locator('main')).toBeVisible()
    // Zero console errors (excluding known noise: favicon, net errors, hydration resource warnings)
    const ignoredPatterns = ['favicon', 'net::ERR_ABORTED', 'Failed to load resource', 'Content Security Policy']
    const realErrors = errors.filter(e => !ignoredPatterns.some(p => e.includes(p)))
    expect(realErrors).toHaveLength(0)
  })

  test('navegação principal está visível', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByLabel('Main navigation')).toBeVisible()
    // Homepage uses h2 (DualHero component), not h1
    await expect(page.locator('h2').first()).toBeVisible()
  })

  test('blog listing carrega artigos', async ({ page }) => {
    const response = await page.goto('/pt/blog')
    expect(response?.status()).toBe(200)
    await expect(page.locator('main')).toBeVisible()
    // Either an article list or an empty state — both are acceptable
    const articles = page.locator('article')
    const emptyState = page.getByText(/[Nn]enhum|[Ee]mpty|[Ss]em post/i)
    await expect(articles.first().or(emptyState)).toBeVisible()
  })

  test.describe('a11y', () => {
    test('sem violations críticas na homepage', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('main')).toBeVisible()
      const results = await new AxeBuilder({ page }).analyze()
      const critical = results.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      )
      expect(
        critical,
        critical.map(v => `${v.id}: ${v.description}`).join('\n')
      ).toHaveLength(0)
    })
  })

  test.fixme('host desconhecido redireciona para /site-not-configured', async ({ page }) => {
    // Chromium forbids modifying the `Host` header via route.continue() (restricted header).
    // This test requires a server running on a real unknown domain or a proxy setup.
    // TODO Sprint 6: test via API request context (not browser) or configure a local DNS alias.
    await page.route('**/*', route => {
      route.continue({
        headers: {
          ...route.request().headers(),
          host: 'unknown-domain-xyz.example.com',
        },
      })
    })

    await page.goto('/')
    await expect(
      page.getByText(/[Ss]ite.*[Nn]ot.*[Cc]onfigured|[Ss]ite.*[Nn]ão.*[Cc]onfigurado/i)
        .or(page.locator('[data-testid="site-not-configured"]'))
    ).toBeVisible({ timeout: 15_000 })
  })
})
