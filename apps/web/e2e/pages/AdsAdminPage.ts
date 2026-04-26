import { type Page, expect } from '@playwright/test'

export class AdsAdminPage {
  constructor(private readonly page: Page) {}

  async goto(tab = 'dashboard'): Promise<void> {
    const url = tab === 'dashboard' ? '/admin/ads' : `/admin/ads?tab=${tab}`
    await this.page.goto(url)
    await this.page.waitForLoadState('networkidle')
  }

  async switchTab(tab: string): Promise<void> {
    await this.page.getByRole('link', { name: new RegExp(tab, 'i') }).click()
    await this.page.waitForLoadState('networkidle')
  }

  async openCreateCampaign(): Promise<void> {
    await this.page.getByRole('button', { name: /[Nn]ova|[Cc]riar|[Cc]reate|[Nn]ew/i }).first().click()
    await this.page.waitForTimeout(300)
  }

  async fillWizardStep1(data: { name: string; advertiser?: string }): Promise<void> {
    const nameInput = this.page.getByLabel(/[Nn]ome|[Nn]ame/).or(
      this.page.getByPlaceholder(/[Nn]ome|[Nn]ame/)
    ).first()
    await expect(nameInput).toBeVisible({ timeout: 10_000 })
    await nameInput.fill(data.name)
    if (data.advertiser) {
      const advertiserInput = this.page.getByLabel(/[Aa]nunciante|[Aa]dvertiser/).first()
      if (await advertiserInput.isVisible()) {
        await advertiserInput.fill(data.advertiser)
      }
    }
  }

  async clickNext(): Promise<void> {
    await this.page.getByRole('button', { name: /[Pp]r[oó]ximo|[Nn]ext/i }).click()
    await this.page.waitForTimeout(200)
  }

  async clickSave(): Promise<void> {
    const saveBtn = this.page.getByRole('button', { name: /[Ss]alvar|[Ss]ave|[Cc]riar|[Cc]reate/i })
      .last()
    await saveBtn.click()
  }

  async toggleSlotEnabled(slotLabel: string): Promise<void> {
    const row = this.page.getByText(slotLabel)
    await row.locator('..').getByRole('checkbox').first().click()
  }
}
