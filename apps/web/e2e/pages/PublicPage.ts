import { type Page, expect } from '@playwright/test'

export class PublicPage {
  constructor(private readonly page: Page) {}

  async subscribeNewsletter(email: string): Promise<void> {
    await this.page.getByTestId('public-newsletter-subscribe-input').fill(email)
    await this.page.getByTestId('public-newsletter-subscribe-button').click()
  }

  async submitContactForm(data: { name: string; email: string; message: string }): Promise<void> {
    await this.page.getByTestId('public-contact-form-name-input').fill(data.name)
    await this.page.getByTestId('public-contact-form-email-input').fill(data.email)
    await this.page.getByTestId('public-contact-form-message-input').fill(data.message)
    const responsePromise = this.page.waitForResponse(resp =>
      resp.url().includes('/contact') && resp.status() < 400
    )
    await this.page.getByTestId('public-contact-form-submit-button').click()
    await responsePromise
  }

  async expectCookieBannerVisible(): Promise<void> {
    await expect(this.page.getByTestId('lgpd-cookie-banner-accept-button')).toBeVisible()
    await expect(this.page.getByTestId('lgpd-cookie-banner-reject-button')).toBeVisible()
  }

  async acceptCookies(): Promise<void> {
    await this.page.getByTestId('lgpd-cookie-banner-accept-button').click()
  }

  async rejectCookies(): Promise<void> {
    await this.page.getByTestId('lgpd-cookie-banner-reject-button').click()
  }
}
