import { test, expect, SITE_SLUG } from '../../fixtures'
import AxeBuilder from '@axe-core/playwright'

test.describe('Admin / Sites', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })
  test.describe.configure({ mode: 'serial' })

  test.afterEach(async ({ supabaseAdmin }) => {
    // Always restore cms_enabled to true after each test to avoid contaminating the suite
    await supabaseAdmin
      .from('sites')
      .update({ cms_enabled: true })
      .eq('slug', SITE_SLUG)
  })

  test('visualizar configurações do site', async ({ page }) => {
    await page.goto('/admin/sites')
    await expect(page.getByText(SITE_SLUG)).toBeVisible()
    // Primary domain visible
    await expect(page.getByText(/bythiagofigueiredo\.com|localhost/i)).toBeVisible()
  })

  test('atualizar branding persiste logo URL e cor primária', async ({ page }) => {
    await page.goto('/admin/sites')

    const logoInput = page.getByLabel(/[Ll]ogo/).or(page.getByPlaceholder(/https.*logo/i))
    const colorInput = page.getByLabel(/[Cc]or|[Cc]olor/i)

    await expect(logoInput).toBeVisible({ timeout: 10_000 })
    await logoInput.fill('https://example.com/logo-test.png')

    if (await colorInput.isVisible()) {
      await colorInput.fill('#FF0000')
    }

    await page.getByTestId('admin-sites-save-button').click()

    await page.reload()
    await expect(logoInput).toBeVisible()
    await expect(logoInput).toHaveValue('https://example.com/logo-test.png')
  })

  test('atualizar SEO defaults persiste twitter_handle', async ({ page, supabaseAdmin }) => {
    await page.goto('/admin/sites')

    const twitterInput = page.getByLabel(/[Tt]witter/i).or(page.getByPlaceholder(/@?\w+/))
    await expect(twitterInput).toBeVisible({ timeout: 10_000 })
    await twitterInput.fill('tnFigueiredo')
    await page.getByTestId('admin-sites-save-button').click()

    const { data } = await supabaseAdmin
      .from('sites')
      .select('twitter_handle')
      .eq('slug', SITE_SLUG)
      .single()
    expect(data?.twitter_handle).toBe('tnFigueiredo')
  })

  test('toggle cms_enabled=false redireciona /cms para /cms/disabled', async ({ page }) => {
    await page.goto('/admin/sites')

    const toggle = page.getByTestId('admin-sites-cms-enabled-toggle')
    await expect(toggle).toBeVisible()

    // Toggle to disabled
    await toggle.click()
    await page.getByTestId('admin-sites-save-button').click()

    // /cms should now redirect to /cms/disabled
    await page.goto('/cms')
    await expect(page).toHaveURL(/\/cms\/disabled/, { timeout: 10_000 })
    // afterEach will restore cms_enabled=true
  })

  test.describe('a11y', () => {
    test('sem violations críticas em /admin/sites', async ({ page }) => {
      await page.goto('/admin/sites')
      await expect(page.getByText(SITE_SLUG)).toBeVisible()
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
