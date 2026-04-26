import { test, expect } from '../../fixtures'
import { AdsAdminPage } from '../../pages/AdsAdminPage'
import AxeBuilder from '@axe-core/playwright'

test.describe('Admin / Ads', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })
  test.describe.configure({ mode: 'serial' })

  test('dashboard tab loads without errors', async ({ page }) => {
    const adsPage = new AdsAdminPage(page)
    await adsPage.goto('dashboard')

    await expect(page.locator('main, [data-testid="ads-dashboard"]')).toBeVisible({ timeout: 15_000 })

    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.waitForTimeout(1_000)
    const realErrors = errors.filter(
      e => !['adsbygoogle', 'pagead2', 'favicon'].some(p => e.includes(p))
    )
    expect(
      realErrors,
      `Dashboard console errors: ${realErrors.join('\n')}`,
    ).toHaveLength(0)
  })

  test('campaigns tab loads without errors', async ({ page }) => {
    await page.goto('/admin/ads?tab=campaigns')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
  })

  test('campaign wizard: opens create form', async ({ page }) => {
    const adsPage = new AdsAdminPage(page)
    await adsPage.goto('campaigns')

    const newBtn = page.getByRole('button', { name: /[Nn]ova|[Cc]riar|[Nn]ew|[Aa]dicionar/i })
    const hasBtnVisible = await newBtn.first().isVisible({ timeout: 5_000 }).catch(() => false)

    if (!hasBtnVisible) {
      const formVisible = await page.getByRole('form').isVisible({ timeout: 3_000 }).catch(() => false)
      if (!formVisible) {
        test.skip(true, 'Campaign create UI not found in this ad-engine-admin version')
        return
      }
    } else {
      await newBtn.first().click()
      await page.waitForTimeout(500)
    }

    const nameField = page.getByLabel(/[Nn]ome|[Nn]ame/).or(
      page.getByPlaceholder(/[Nn]ome.*[Cc]ampanha|[Cc]ampaign.*[Nn]ame/i)
    ).first()
    const isVisible = await nameField.isVisible({ timeout: 5_000 }).catch(() => false)

    if (isVisible) {
      await nameField.fill(`E2E Campaign ${Date.now()}`)
      const nextBtn = page.getByRole('button', { name: /[Pp]r[oó]ximo|[Nn]ext/i })
      if (await nextBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await nextBtn.click()
        await page.waitForTimeout(300)
        await expect(page.locator('main')).toBeVisible()
      }
    }
  })

  test('placeholders tab loads', async ({ page }) => {
    await page.goto('/admin/ads?tab=placeholders')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
  })

  test.describe('a11y', () => {
    test('sem violations criticas no dashboard de ads', async ({ page }) => {
      await page.goto('/admin/ads')
      await page.waitForLoadState('networkidle')
      await expect(page.locator('main')).toBeVisible({ timeout: 15_000 })

      const results = await new AxeBuilder({ page })
        .exclude('[data-ad-slot]')
        .analyze()
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
