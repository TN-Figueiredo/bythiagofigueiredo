import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('LGPD / Cookie Banner', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to ensure banner shows
    await page.addInitScript(() => {
      localStorage.removeItem('lgpd_consent')
    })
  })

  test('banner aparece na primeira visita com botões de igual proeminência', async ({ page }) => {
    await page.goto('/')
    const acceptBtn = page.getByTestId('lgpd-cookie-banner-accept-button')
    const rejectBtn = page.getByTestId('lgpd-cookie-banner-reject-button')

    await expect(acceptBtn).toBeVisible({ timeout: 10_000 })
    await expect(rejectBtn).toBeVisible()

    // Both must be <button> elements (equal prominence — no button vs link)
    const acceptTag = await acceptBtn.evaluate((el: HTMLElement) => el.tagName)
    const rejectTag = await rejectBtn.evaluate((el: HTMLElement) => el.tagName)
    expect(acceptTag).toBe(rejectTag)
  })

  test('aceitar tudo esconde banner e salva consent com analytics=true', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('lgpd-cookie-banner-accept-button')).toBeVisible({ timeout: 10_000 })

    await page.getByTestId('lgpd-cookie-banner-accept-button').click()

    // Banner should disappear
    await expect(page.getByTestId('lgpd-cookie-banner-accept-button')).not.toBeVisible({ timeout: 5_000 })

    // Consent stored in localStorage
    const consent = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('lgpd_consent') ?? '{}')
    )
    expect(consent).toMatchObject({ functional: true, analytics: true, marketing: true })
  })

  test('rejeitar tudo esconde banner e salva apenas functional=true', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('lgpd-cookie-banner-reject-button')).toBeVisible({ timeout: 10_000 })

    await page.getByTestId('lgpd-cookie-banner-reject-button').click()

    await expect(page.getByTestId('lgpd-cookie-banner-reject-button')).not.toBeVisible({ timeout: 5_000 })

    const consent = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('lgpd_consent') ?? '{}')
    )
    expect(consent.functional).toBe(true)
    expect(consent.analytics).not.toBe(true)
    expect(consent.marketing).not.toBe(true)
  })

  test.fixme('re-prompt em version bump exibe banner mesmo com consent existente', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'lgpd_consent',
        JSON.stringify({
          functional: true,
          analytics: true,
          marketing: true,
          version: '1.0',
        }),
      )
    })

    await page.route('**/*', async route => {
      const response = await route.fetch()
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          'x-lgpd-consent-fingerprint': 'v2-bump',
        },
      })
    })

    await page.goto('/')
    await expect(page.getByTestId('lgpd-cookie-banner-accept-button')).toBeVisible({ timeout: 5_000 })
  })

  test.describe('a11y', () => {
    test('sem violations críticas no cookie banner', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByTestId('lgpd-cookie-banner-accept-button')).toBeVisible({ timeout: 10_000 })
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
})
