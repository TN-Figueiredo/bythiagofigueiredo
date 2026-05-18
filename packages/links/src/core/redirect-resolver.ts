import type { ILinkRepository } from '../interfaces/link-repository.js'
import type { TrackedLink, RedirectResult, RedirectGuardFailure, UtmParams } from '../types.js'
import { buildUtmUrl } from './utm-parser.js'

export interface ResolveOptions {
  /** Pre-hashed password for password-protected links */
  passwordHash?: string
}

/**
 * Resolves a short code to a destination URL, applying guard chain:
 * deleted → paused → expired → click_limit → password → active
 */
export class RedirectResolver {
  constructor(private readonly linkRepo: ILinkRepository) {}

  async resolve(
    code: string,
    options?: ResolveOptions,
  ): Promise<RedirectResult | RedirectGuardFailure> {
    const link = await this.linkRepo.findByCode(code)

    if (!link) {
      return { reason: 'not_found' }
    }

    // Guard chain
    const failure = this.checkGuards(link, options)
    if (failure) return failure

    // Build final URL with UTM append
    const url = this.buildRedirectUrl(link)

    return {
      url,
      statusCode: 307,
      link,
    }
  }

  async resolveBySlug(
    siteId: string,
    slug: string,
    options?: ResolveOptions,
  ): Promise<RedirectResult | RedirectGuardFailure> {
    const link = await this.linkRepo.findBySlug(siteId, slug)

    if (!link) {
      return { reason: 'not_found' }
    }

    const failure = this.checkGuards(link, options)
    if (failure) return failure

    const url = this.buildRedirectUrl(link)

    return {
      url,
      statusCode: 307,
      link,
    }
  }

  private checkGuards(
    link: TrackedLink,
    options?: ResolveOptions,
  ): RedirectGuardFailure | null {
    // 1. Deleted
    if (link.status === 'deleted') {
      return { reason: 'deleted', link }
    }

    // 2. Paused
    if (link.status === 'paused') {
      return { reason: 'paused', link }
    }

    // 3. Expired
    if (link.expiresAt && link.expiresAt < new Date()) {
      return { reason: 'expired', link }
    }

    // 3.5 Not yet active
    if (link.activatesAt && link.activatesAt > new Date()) {
      return { reason: 'not_yet_active', link }
    }

    // 4. Click limit
    if (link.clickLimit != null && link.totalClicks >= link.clickLimit) {
      return { reason: 'click_limit', link }
    }

    // 5. Password
    if (link.passwordHash && options?.passwordHash !== link.passwordHash) {
      return { reason: 'password_required', link }
    }

    return null
  }

  private buildRedirectUrl(link: TrackedLink): string {
    const utm: UtmParams = {}
    if (link.utmSource) utm.utmSource = link.utmSource
    if (link.utmMedium) utm.utmMedium = link.utmMedium
    if (link.utmCampaign) utm.utmCampaign = link.utmCampaign
    if (link.utmTerm) utm.utmTerm = link.utmTerm
    if (link.utmContent) utm.utmContent = link.utmContent
    if (link.utmId) utm.utmId = link.utmId

    let url = Object.keys(utm).length > 0
      ? buildUtmUrl(link.destinationUrl, utm)
      : link.destinationUrl

    if (link.customParams && Object.keys(link.customParams).length > 0) {
      const parsed = new URL(url)
      for (const [key, value] of Object.entries(link.customParams)) {
        if (value && !parsed.searchParams.has(key)) {
          parsed.searchParams.set(key, value)
        }
      }
      url = parsed.toString()
    }

    return url
  }
}
