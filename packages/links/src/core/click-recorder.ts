import type { IClickRepository, ClickRecordData } from '../interfaces/click-repository.js'
import type { IMetricsRepository } from '../interfaces/metrics-repository.js'
import type { ILinkRepository } from '../interfaces/link-repository.js'
import type { IGeoResolver } from '../interfaces/geo-resolver.js'
import type { IAlertNotifier } from '../interfaces/notifier.js'
import type { LinkClick, RecordClickInput } from '../types.js'
import { computeVisitorId } from './visitor-id.js'
import { isBot, getBotName } from './bot-filter.js'
import { classifyDevice } from './device-classifier.js'
import { classifyReferrer } from './referrer-classifier.js'

const DEDUP_WINDOW_SECONDS = 30

export interface ClickRecorderDeps {
  clickRepo: IClickRepository
  metricsRepo: IMetricsRepository
  linkRepo: ILinkRepository
  geoResolver: IGeoResolver
  notifier: IAlertNotifier
}

/**
 * Records a click event with deduplication, bot detection,
 * device/referrer classification, and geo resolution.
 */
export class ClickRecorder {
  private readonly deps: ClickRecorderDeps

  constructor(deps: ClickRecorderDeps) {
    this.deps = deps
  }

  /**
   * Record a click. Returns null if deduplicated (same visitor within 30s window).
   */
  async record(input: RecordClickInput): Promise<LinkClick | null> {
    const visitorId = computeVisitorId(input.ip, input.userAgent)

    // Dedup check
    const isDuplicate = await this.deps.clickRepo.isDuplicate(
      input.linkId,
      visitorId,
      DEDUP_WINDOW_SECONDS,
    )
    if (isDuplicate) return null

    // Classify
    const bot = isBot(input.userAgent)
    const botName = getBotName(input.userAgent)
    const device = classifyDevice(input.userAgent)
    const referrerCategory = classifyReferrer(input.referrer)

    // Geo resolve
    const geo = await this.deps.geoResolver.resolve(input.ip)

    const data: ClickRecordData = {
      linkId: input.linkId,
      visitorId,
      ip: input.ip,
      userAgent: input.userAgent,
      referrer: input.referrer,
      referrerCategory,
      country: geo?.country ?? null,
      region: geo?.region ?? null,
      city: geo?.city ?? null,
      deviceType: device.deviceType,
      browser: device.browser,
      os: device.os,
      isBot: bot,
      botName,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      utmTerm: input.utmTerm ?? null,
      utmContent: input.utmContent ?? null,
    }

    // Persist click
    const click = await this.deps.clickRepo.record(data)

    // Update daily metrics
    const today = new Date().toISOString().slice(0, 10)
    await this.deps.metricsRepo.upsertDaily({
      linkId: input.linkId,
      date: today,
      clicks: 1,
      uniqueVisitors: 1,
      bots: bot ? 1 : 0,
      country: geo?.country ?? null,
      referrerCategory,
      deviceType: device.deviceType,
    })

    // Increment link click counters
    await this.deps.linkRepo.incrementClicks(input.linkId, { unique: true })

    return click
  }
}
