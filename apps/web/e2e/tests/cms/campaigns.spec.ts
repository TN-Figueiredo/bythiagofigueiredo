import { test, expect } from '../../fixtures'
import { CampaignEditorPage } from '../../pages/CampaignEditorPage'
import { seedCampaign } from '../../fixtures/seed-helpers'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'

const PDF_PATH = path.resolve(__dirname, '../../fixtures/assets/test.pdf')

test.describe('CMS / Campanhas', () => {
  test.use({ storageState: 'e2e/.auth/editor.json' })
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async ({ supabaseAdmin, testId }) => {
    const { data: translations } = await supabaseAdmin
      .from('campaign_translations')
      .select('campaign_id')
      .like('slug', `test-${testId}-%`)
    if (translations?.length) {
      const campaignIds = translations.map((t: { campaign_id: string }) => t.campaign_id)
      await supabaseAdmin.from('campaigns').delete().in('id', campaignIds)
    }
  })

  test('lista de campanhas carrega', async ({ page, acceptedCookies }) => {
    await page.goto('/cms/campaigns')
    await expect(page.getByRole('table').or(page.getByRole('list'))).toBeVisible()
  })

  test('criar campanha salva com status draft', async ({ page, acceptedCookies, testId }) => {
    await page.goto('/cms/campaigns/new')
    await page.getByLabel(/^Slug$/).fill(`test-${testId}-campaign-draft`)
    await page.getByLabel(/Interesse/i).fill('other')
    await page.getByLabel(/Meta title/i).fill('Test Campaign Draft')
    await page.getByLabel(/Hook principal/i).fill('# Test hook')
    await page.getByRole('button', { name: /[Cc]riar/ }).click()
    await expect(page).toHaveURL(/\/cms\/campaigns\/[^/]+\/edit/, { timeout: 10_000 })
    await expect(page.locator('[data-status="draft"]')).toBeVisible()
  })

  test('upload de PDF associa URL à campanha', async ({ page, acceptedCookies, supabaseAdmin, siteId, editorUserId, testId }) => {
    const campaignId = await seedCampaign(supabaseAdmin, siteId, editorUserId, `test-${testId}-pdf-upload`)

    await page.goto(`/cms/campaigns/${campaignId}/edit`)
    const editor = new CampaignEditorPage(page)
    await editor.waitForEditor()
    await editor.uploadPdf(PDF_PATH)

    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('pdf_url')
      .eq('id', campaignId)
      .single()
    expect(campaign?.pdf_url).toBeTruthy()
  })

  test('publicar campanha torna landing page acessível', async ({ page, acceptedCookies, supabaseAdmin, siteId, editorUserId, testId }) => {
    const campaignId = await seedCampaign(supabaseAdmin, siteId, editorUserId, `test-${testId}-publish-campaign`)

    await page.goto(`/cms/campaigns/${campaignId}/edit`)
    const editor = new CampaignEditorPage(page)
    await editor.waitForEditor()
    await editor.publish()

    const publicPage = await page.context().newPage()
    await publicPage.goto(`/campaigns/pt-BR/test-${testId}-publish-campaign`)
    await expect(publicPage).not.toHaveURL(/404/)
    await publicPage.close()

    const { data: published } = await supabaseAdmin
      .from('campaigns')
      .select('status, published_at')
      .eq('id', campaignId)
      .single()
    expect(published?.status).toBe('published')
    expect(published?.published_at).not.toBeNull()
  })

  test('despublicar campanha', async ({ page, acceptedCookies, supabaseAdmin, siteId, editorUserId, testId }) => {
    const campaignId = await seedCampaign(supabaseAdmin, siteId, editorUserId, `test-${testId}-unpublish-campaign`, {
      status: 'published', published_at: new Date().toISOString(),
    })

    await page.goto(`/cms/campaigns/${campaignId}/edit`)
    const editor = new CampaignEditorPage(page)
    await editor.waitForEditor()
    await editor.unpublish()

    const { data: unpublished } = await supabaseAdmin
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .single()
    expect(unpublished?.status).toBe('draft')
  })

  test('deletar campanha remove da lista', async ({ page, acceptedCookies, supabaseAdmin, siteId, editorUserId, testId }) => {
    const campaignId = await seedCampaign(supabaseAdmin, siteId, editorUserId, `test-${testId}-delete-campaign`)

    await page.goto(`/cms/campaigns/${campaignId}/edit`)
    const editor = new CampaignEditorPage(page)
    await editor.waitForEditor()
    await editor.delete()
    await expect(page).toHaveURL(/\/cms\/campaigns/, { timeout: 10_000 })

    const { data: deleted } = await supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .maybeSingle()
    expect(deleted).toBeNull()
  })

  test('editar campanha persiste alterações', async ({ page, acceptedCookies, supabaseAdmin, siteId, editorUserId, testId }) => {
    const campaignId = await seedCampaign(supabaseAdmin, siteId, editorUserId, `test-${testId}-edit-campaign`)

    await page.goto(`/cms/campaigns/${campaignId}/edit`)
    const editor = new CampaignEditorPage(page)
    await editor.waitForEditor()
    await editor.fillTitle('Test Campaign Edited')
    const saveResponse = page.waitForResponse(resp =>
      resp.url().includes('/cms/campaigns') && resp.status() < 400
    )
    await page.getByRole('button', { name: /[Ss]alvar|[Ss]ave/ }).click()
    await saveResponse

    await page.reload()
    await editor.waitForEditor()
    await editor.expectTitleValue('Test Campaign Edited')
  })

  test.describe('reporter — restrições de publicação', () => {
    test.use({ storageState: 'e2e/.auth/reporter.json' })

    test('reporter não consegue publicar campanha', async ({ page, acceptedCookies, supabaseAdmin, siteId, editorUserId, testId }) => {
      const campaignId = await seedCampaign(supabaseAdmin, siteId, editorUserId, `test-${testId}-reporter-campaign`)

      await page.goto(`/cms/campaigns/${campaignId}/edit`)
      const editor = new CampaignEditorPage(page)
      await editor.waitForEditor()
      await editor.expectPublishBlocked()
    })
  })

  test.describe('a11y', () => {
    test('sem violations críticas em /cms/campaigns/new', async ({ page, acceptedCookies }) => {
      await page.goto('/cms/campaigns/new')
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
