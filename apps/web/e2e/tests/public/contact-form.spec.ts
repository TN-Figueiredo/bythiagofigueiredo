import { test, expect } from '../../fixtures'
import { PublicPage } from '../../pages/PublicPage'
import AxeBuilder from '@axe-core/playwright'

test.describe('Public / Formulário de Contato', () => {
  test.use({ storageState: 'e2e/.auth/public.json' })
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async ({ supabaseAdmin }) => {
    await supabaseAdmin
      .from('contact_submissions')
      .delete()
      .like('email', '%@e2e-contact.test')
  })

  test('submissão válida exibe mensagem de sucesso', async ({ page, acceptedCookies }) => {
    await page.goto('/contact')
    const pub = new PublicPage(page)
    await pub.submitContactForm({
      name: 'E2E Test User',
      email: `contact-valid-${Date.now()}@e2e-contact.test`,
      message: 'Mensagem de teste E2E válida',
    })
    // Success should appear in a specific feedback area — scope within main or an alert role
    await expect(
      page.getByRole('status').or(page.getByRole('alert')).or(
        page.locator('form').getByText(/[Ss]ucesso|[Ss]ent|[Ee]nviado|[Oo]brigado/i)
      )
    ).toBeVisible({ timeout: 10_000 })
  })

  test('erros de validação aparecem inline para campos obrigatórios', async ({ page, acceptedCookies }) => {
    await page.goto('/contact')
    // Submit without filling any field
    await page.getByTestId('public-contact-form-submit-button').click()

    // At least one error message should appear
    await expect(
      page.getByText(/[Oo]brigatório|[Rr]equired|[Ii]nválido|[Ii]nvalid/i).first()
    ).toBeVisible({ timeout: 5_000 })
  })

  test('Turnstile test key não bloqueia formulário', async ({ page, acceptedCookies }) => {
    // With NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA (set via webServer env in playwright.config.ts),
    // Turnstile always passes — this test verifies the form submits without Turnstile blocking
    await page.goto('/contact')
    const pub = new PublicPage(page)
    await pub.submitContactForm({
      name: 'E2E Turnstile Test',
      email: `contact-turnstile-${Date.now()}@e2e-contact.test`,
      message: 'Turnstile bypass test message',
    })
    // Success should appear in a specific feedback area — scope within main or an alert role
    await expect(
      page.getByRole('status').or(page.getByRole('alert')).or(
        page.locator('form').getByText(/[Ss]ucesso|[Ss]ent|[Ee]nviado|[Oo]brigado/i)
      )
    ).toBeVisible({ timeout: 15_000 })
  })

  test.describe('a11y', () => {
    test('sem violations críticas em /contact', async ({ page, acceptedCookies }) => {
      await page.goto('/contact')
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
})
