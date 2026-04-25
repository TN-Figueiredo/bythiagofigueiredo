import { test, expect } from '../../fixtures'
import AxeBuilder from '@axe-core/playwright'

test.describe('CMS / Contatos', () => {
  test.use({ storageState: 'e2e/.auth/editor.json' })
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ supabaseAdmin, siteId, testId }) => {
    await supabaseAdmin
      .from('contact_submissions')
      .delete()
      .eq('email', `contact-${testId}@test.example`)

    await supabaseAdmin.from('contact_submissions').insert({
      site_id: siteId,
      name: 'Test Contact',
      email: `contact-${testId}@test.example`,
      message: 'Mensagem de teste E2E',
    })
  })

  test.afterAll(async ({ supabaseAdmin, testId }) => {
    await supabaseAdmin
      .from('contact_submissions')
      .delete()
      .like('email', `%-${testId}@test.example`)
  })

  test('lista de submissões carrega', async ({ page, acceptedCookies }) => {
    await page.goto('/cms/contacts')
    await expect(page.getByRole('table').or(page.getByRole('list'))).toBeVisible()
  })

  test('ver detalhe de submissão', async ({ page, acceptedCookies, testId }) => {
    await page.goto('/cms/contacts')
    await page.getByText(`contact-${testId}@test.example`).first().click()
    await expect(page.getByText('Mensagem de teste E2E')).toBeVisible()
  })

  test('anonimizar submissão (LGPD)', async ({ page, acceptedCookies, testId }) => {
    await page.goto('/cms/contacts')
    await page.getByText(`contact-${testId}@test.example`).first().click()
    await page.getByRole('button', { name: /[Aa]nonimizar|[Aa]nonymize/ }).click()
    await page.getByRole('button', { name: /[Cc]onfirmar|[Cc]onfirm/ }).click()

    // Email should no longer contain @
    await expect(page.getByTestId('contact-email')).not.toContainText('@')
    await expect(page.getByTestId('anonymized-at')).toBeVisible()
  })

  test('formulário de resposta aceita texto', async ({ page, acceptedCookies, supabaseAdmin, siteId, testId }) => {
    await supabaseAdmin.from('contact_submissions').insert({
      site_id: siteId,
      name: 'Test Reply Contact',
      email: `reply-${testId}@test.example`,
      message: 'Reply test message',
    })

    await page.goto('/cms/contacts')
    await page.getByText(`reply-${testId}@test.example`).first().click()

    const replyBtn = page.getByRole('button', { name: /[Rr]esponder|[Rr]eply/ })
    await expect(replyBtn).toBeVisible({ timeout: 10_000 })
    await replyBtn.click()
    await page.getByRole('textbox', { name: /[Rr]esposta|[Rr]eply|[Mm]essage/i }).fill('Resposta de teste')
    await page.getByRole('button', { name: /[Ee]nviar|[Ss]end/ }).click()
    await expect(page.getByText(/[Ee]nviado|[Ss]ent/)).toBeVisible()
  })

  test.describe('a11y', () => {
    test('sem violations críticas em /cms/contacts', async ({ page, acceptedCookies }) => {
      await page.goto('/cms/contacts')
      await expect(page.getByRole('table').or(page.getByRole('list'))).toBeVisible()
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
