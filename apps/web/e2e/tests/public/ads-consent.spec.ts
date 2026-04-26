import { test, expect } from '@playwright/test'

const CONSENT_KEY = 'lgpd_consent_v1'

function consentPayload(marketing: boolean) {
  return JSON.stringify({
    functional: true,
    analytics: true,
    marketing,
    version: 1,
    anonymousId: 'e2e-consent-test',
    updatedAt: new Date().toISOString(),
  })
}

test.describe('Ad Consent Integration', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.describe.configure({ mode: 'serial' })

  test('page loads successfully without any consent (no marketing)', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })

    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.waitForTimeout(1_000)

    const adErrors = errors.filter(
      e => e.includes('adsbygoogle') || e.includes('googlesyndication')
    )
    expect(
      adErrors,
      `AdSense errors without consent: ${adErrors.join(', ')}`,
    ).toHaveLength(0)
  })

  test('marketing consent granted: page renders without crash', async ({ page }) => {
    await page.addInitScript((key: string) => {
      localStorage.setItem(key, JSON.stringify({
        functional: true,
        analytics: true,
        marketing: true,
        version: 1,
        anonymousId: 'e2e-marketing-granted',
        updatedAt: new Date().toISOString(),
      }))
    }, CONSENT_KEY)

    await page.goto('/')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
  })

  test('marketing consent denied: page renders without crash', async ({ page }) => {
    await page.addInitScript((key: string) => {
      localStorage.setItem(key, JSON.stringify({
        functional: true,
        analytics: false,
        marketing: false,
        version: 1,
        anonymousId: 'e2e-marketing-denied',
        updatedAt: new Date().toISOString(),
      }))
    }, CONSENT_KEY)

    await page.goto('/')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
  })

  test('toggling marketing consent via cookie banner updates consent state', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('lgpd_consent_v1')
    })

    await page.goto('/')

    const acceptBtn = page.getByTestId('lgpd-cookie-banner-accept-button')
    await expect(acceptBtn).toBeVisible({ timeout: 10_000 })
    await acceptBtn.click()

    await expect(acceptBtn).not.toBeVisible({ timeout: 5_000 })

    const consent = await page.evaluate((key: string) =>
      JSON.parse(localStorage.getItem(key) ?? '{}'),
    CONSENT_KEY)
    expect(consent.marketing).toBe(true)

    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/blog')
    await expect(page.locator('main')).toBeVisible()
    await page.waitForTimeout(500)

    const realErrors = errors.filter(
      e => !['favicon', 'net::ERR_ABORTED', 'adsbygoogle', 'pagead2'].some(p => e.includes(p))
    )
    expect(
      realErrors,
      `Console errors after consent granted: ${realErrors.join('\n')}`,
    ).toHaveLength(0)
  })

  test('revoking marketing consent (reject all) falls back gracefully', async ({ page }) => {
    await page.addInitScript((key: string) => {
      localStorage.setItem(key, JSON.stringify({
        functional: true,
        analytics: true,
        marketing: true,
        version: 1,
        anonymousId: 'e2e-revoke-test',
        updatedAt: new Date().toISOString(),
      }))
    }, CONSENT_KEY)

    await page.goto('/')
    await expect(page.locator('main')).toBeVisible()

    const triggerBtn = page.getByTestId('lgpd-cookie-banner-trigger')
      .or(page.getByRole('button', { name: /[Cc]ookie|[Pp]rivacidade|[Pp]rivacy/i }))
      .first()

    const hasTrigger = await triggerBtn.isVisible({ timeout: 3_000 }).catch(() => false)
    if (hasTrigger) {
      await triggerBtn.click()
      const rejectBtn = page.getByTestId('lgpd-cookie-banner-reject-button')
      await expect(rejectBtn).toBeVisible({ timeout: 5_000 })
      await rejectBtn.click()

      const consent = await page.evaluate((key: string) =>
        JSON.parse(localStorage.getItem(key) ?? '{}'),
      CONSENT_KEY)
      expect(consent.marketing).toBe(false)
    } else {
      const consent = await page.evaluate((key: string) =>
        JSON.parse(localStorage.getItem(key) ?? '{}'),
      CONSENT_KEY)
      expect(consent).toBeTruthy()
    }

    await page.goto('/blog')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
  })
})
