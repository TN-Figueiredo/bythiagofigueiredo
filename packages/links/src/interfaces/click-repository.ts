import type { LinkClick, ClickFilters, PaginatedResult, RecordClickInput, DeviceInfo, GeoInfo, ReferrerCategory } from '../types.js'

/** Data needed to persist a click event */
export interface ClickRecordData {
  linkId: string
  visitorId: string
  ip: string | null
  userAgent: string | null
  referrer: string | null
  referrerCategory: ReferrerCategory
  country: string | null
  region: string | null
  city: string | null
  deviceType: DeviceInfo['deviceType']
  browser: string
  os: string
  isBot: boolean
  botName: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
}

/**
 * Repository contract for click events.
 */
export interface IClickRepository {
  record(data: ClickRecordData): Promise<LinkClick>
  isDuplicate(linkId: string, visitorId: string, windowSeconds: number): Promise<boolean>
  findByLink(filters: ClickFilters): Promise<PaginatedResult<LinkClick>>
  getRecentClicks(linkId: string, limit: number): Promise<LinkClick[]>
}
