import type { ILinkRepository } from '../interfaces/link-repository.js'
import type { TrackedLink, RedirectResult, RedirectGuardFailure } from '../types.js'
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
    const utm = {
      utmSource: link.utmSource ?? undefined,
      utmMedium: link.utmMedium ?? undefined,
      utmCampaign: link.utmCampaign ?? undefined,
      utmTerm: link.utmTerm ?? undefined,
      utmContent: link.utmContent ?? undefined,
    }

    // Only append if there are UTM params to add
    const hasUtm = Object.values(utm).some((v) => v != null)
    if (!hasUtm) return link.destinationUrl

    return buildUtmUrl(link.destinationUrl, utm)
  }
}
