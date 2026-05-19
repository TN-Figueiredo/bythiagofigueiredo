import { test, expect } from '../../fixtures'
import { LinksPage } from '../../pages/LinksPage'
import { seedTrackedLink } from '../../fixtures/seed-helpers'

test.describe('CMS / Links', () => {
  test.use({ storageState: 'e2e/.auth/editor.json' })
  test.describe.configure({ mode: 'serial' })

  const createdLinkIds: string[] = []

  test.afterAll(async ({ supabaseAdmin }) => {
    for (const id of createdLinkIds) {
      await supabaseAdmin.from('link_clicks').delete().eq('link_id', id)
      await supabaseAdmin.from('link_annotations').delete().eq('link_id', id)
      await supabaseAdmin.from('link_daily_metrics').delete().eq('link_id', id)
      await supabaseAdmin.from('tracked_links').delete().eq('id', id)
    }
  })

  test('dashboard loads with KPIs', async ({ page, acceptedCookies }) => {
    const links = new LinksPage(page)
    await links.goToDashboard()
    await expect(page.getByText(/Total Links|Active Links|Total Clicks/i)).toBeVisible()
  })

  test('create link with UTM params and verify detail', async ({ page, acceptedCookies }) => {
    const links = new LinksPage(page)
    await links.goToCreate()

    await links.fillDestination('https://example.com/e2e-create-test')
    await links.fillTitle('E2E Test Link')
    await links.fillUtmSource('e2e-test')
    await links.fillUtmCampaign('playwright')
    await links.fillUtmId('e2e-camp-001')
    await links.submit()

    await page.waitForURL(/\/cms\/links\/[a-f0-9-]+$/)
    await links.expectDetailVisible()
    await links.expectDetailHasText('E2E Test Link')
    await links.expectDetailHasText('example.com/e2e-create-test')

    const linkId = page.url().split('/cms/links/')[1]!.split('/')[0]!
    createdLinkIds.push(linkId)
  })

  test('edit link — update title and verify persistence', async ({ page, acceptedCookies, supabaseAdmin, siteId }) => {
    const { id, code } = await seedTrackedLink(supabaseAdmin, siteId, {
      title: 'Before Edit',
      utm_source: 'original',
    })
    createdLinkIds.push(id)

    const links = new LinksPage(page)
    await links.goToEdit(id)

    await links.fillTitle('After Edit')
    await links.fillUtmSource('updated-source')
    await links.submit()

    await page.waitForURL(/\/cms\/links\/[a-f0-9-]+$/)
    await links.expectDetailHasText('After Edit')

    const { data } = await supabaseAdmin
      .from('tracked_links')
      .select('title, utm_source')
      .eq('id', id)
      .single()
    expect(data?.title).toBe('After Edit')
    expect(data?.utm_source).toBe('updated-source')
  })

  test('detail page shows A++ fields', async ({ page, acceptedCookies, supabaseAdmin, siteId }) => {
    const futureDate = new Date(Date.now() + 7 * 86_400_000).toISOString()
    const { id } = await seedTrackedLink(supabaseAdmin, siteId, {
      title: 'A++ Detail Test',
      pass_click_ids: true,
      utm_id: 'camp-detail-001',
      activates_at: futureDate,
      redirect_type: 307,
    })
    createdLinkIds.push(id)

    const links = new LinksPage(page)
    await links.goToDetail(id)
    await links.expectDetailVisible()

    await links.expectDetailHasText('click IDs on')
    await links.expectDetailHasText('camp-detail-001')
    await links.expectDetailHasText('307')
    await links.expectDetailHasText('Activates')
  })

  test('toggle link active/inactive', async ({ page, acceptedCookies, supabaseAdmin, siteId }) => {
    const { id } = await seedTrackedLink(supabaseAdmin, siteId, {
      title: 'Toggle Test',
    })
    createdLinkIds.push(id)

    const links = new LinksPage(page)
    await links.goToDetail(id)
    await links.expectDetailHasText('Active')

    await links.clickToggleActive()
    await page.waitForTimeout(500)
    await expect(page.getByText('Inactive')).toBeVisible()

    const { data } = await supabaseAdmin
      .from('tracked_links')
      .select('active')
      .eq('id', id)
      .single()
    expect(data?.active).toBe(false)
  })

  test('delete link removes from dashboard', async ({ page, acceptedCookies, supabaseAdmin, siteId }) => {
    const { id } = await seedTrackedLink(supabaseAdmin, siteId, {
      title: 'Delete Me E2E',
    })

    const links = new LinksPage(page)
    await links.goToDetail(id)
    await links.clickDelete()

    await page.waitForURL(/\/cms\/links$/)

    const { data } = await supabaseAdmin
      .from('tracked_links')
      .select('deleted_at')
      .eq('id', id)
      .single()
    expect(data?.deleted_at).not.toBeNull()
  })

  test('redirect type 307/308 options visible in form', async ({ page, acceptedCookies }) => {
    const links = new LinksPage(page)
    await links.goToCreate()

    await expect(page.getByText('307')).toBeVisible()
    await expect(page.getByText('308')).toBeVisible()
    await expect(page.getByText('Temporary (recommended)')).toBeVisible()
    await expect(page.getByText('Permanent (strict)')).toBeVisible()
  })

  test('activates_at field exists in create form', async ({ page, acceptedCookies }) => {
    const links = new LinksPage(page)
    await links.goToCreate()

    await expect(page.locator('#activates_at')).toBeVisible()
    await expect(page.getByText('Ativação programada')).toBeVisible()
  })

  test('pass_click_ids toggle exists in create form', async ({ page, acceptedCookies }) => {
    const links = new LinksPage(page)
    await links.goToCreate()

    await expect(page.getByText('Encaminhar click IDs')).toBeVisible()
  })

  test('utm_id field exists in form', async ({ page, acceptedCookies }) => {
    const links = new LinksPage(page)
    await links.goToCreate()

    await links.expandUtmSection()
    await expect(page.locator('#utm_id')).toBeVisible()
  })
})
