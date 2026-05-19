import { type Page, expect } from '@playwright/test'

export class LinksPage {
  constructor(private readonly page: Page) {}

  async goToDashboard(): Promise<void> {
    await this.page.goto('/cms/links')
  }

  async goToCreate(): Promise<void> {
    await this.page.goto('/cms/links/new')
    await expect(this.page.getByTestId('link-form')).toBeVisible()
  }

  async goToDetail(linkId: string): Promise<void> {
    await this.page.goto(`/cms/links/${linkId}`)
  }

  async goToEdit(linkId: string): Promise<void> {
    await this.page.goto(`/cms/links/${linkId}/edit`)
    await expect(this.page.getByTestId('link-form')).toBeVisible()
  }

  async fillDestination(url: string): Promise<void> {
    await this.page.locator('#destination_url').fill(url)
  }

  async fillTitle(title: string): Promise<void> {
    await this.page.locator('#title').fill(title)
  }

  async fillSlug(slug: string): Promise<void> {
    await this.page.locator('#slug').fill(slug)
  }

  async expandUtmSection(): Promise<void> {
    const utmField = this.page.locator('#utm_source')
    if (!(await utmField.isVisible())) {
      await this.page.getByRole('button', { name: /UTM Parameters/i }).click()
    }
  }

  async fillUtmSource(value: string): Promise<void> {
    await this.expandUtmSection()
    await this.page.locator('#utm_source').fill(value)
  }

  async fillUtmMedium(value: string): Promise<void> {
    await this.expandUtmSection()
    await this.page.locator('#utm_medium').fill(value)
  }

  async fillUtmCampaign(value: string): Promise<void> {
    await this.expandUtmSection()
    await this.page.locator('#utm_campaign').fill(value)
  }

  async fillUtmId(value: string): Promise<void> {
    await this.expandUtmSection()
    await this.page.locator('#utm_id').fill(value)
  }

  async fillActivatesAt(isoDatetime: string): Promise<void> {
    await this.page.locator('#activates_at').fill(isoDatetime)
  }

  async togglePassClickIds(): Promise<void> {
    await this.page.locator('[aria-checked]').filter({ hasText: '' }).first().click()
  }

  async selectSourceType(type: string): Promise<void> {
    await this.page.getByRole('button', { name: new RegExp(type, 'i') }).first().click()
  }

  async submit(): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/cms/links') && resp.status() < 400,
    )
    await this.page.getByRole('button', { name: /^(Save|Create|Salvar|Criar)$/i }).click()
    await responsePromise
  }

  async expectDetailVisible(): Promise<void> {
    await expect(this.page.getByText('Destination')).toBeVisible()
    await expect(this.page.getByText('Total Clicks')).toBeVisible()
  }

  async expectDetailHasText(text: string): Promise<void> {
    await expect(this.page.getByText(text)).toBeVisible()
  }

  async clickEdit(): Promise<void> {
    await this.page.getByRole('button', { name: /Edit/i }).click()
    await expect(this.page.getByTestId('link-form')).toBeVisible()
  }

  async clickDelete(): Promise<void> {
    this.page.on('dialog', dialog => dialog.accept())
    await this.page.getByRole('button', { name: /Delete/i }).click()
  }

  async clickToggleActive(): Promise<void> {
    await this.page.getByRole('button', { name: /Pause|Activate/i }).click()
  }
}
