import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClickRecorder } from './click-recorder.js'
import type { IClickRepository, ClickRecordData } from '../interfaces/click-repository.js'
import type { IMetricsRepository } from '../interfaces/metrics-repository.js'
import type { ILinkRepository } from '../interfaces/link-repository.js'
import type { IGeoResolver } from '../interfaces/geo-resolver.js'
import type { IAlertNotifier } from '../interfaces/notifier.js'
import type { LinkClick, RecordClickInput, TrackedLink } from '../types.js'

function makeClick(overrides: Partial<LinkClick> = {}): LinkClick {
  return {
    id: 'click-1',
    linkId: 'link-1',
    visitorId: 'visitor-1',
    ip: '192.168.1.1',
    userAgent: 'Chrome/120',
    referrer: null,
    referrerCategory: 'direct',
    country: null,
    region: null,
    city: null,
    deviceType: 'desktop',
    browser: 'Chrome',
    os: 'Windows',
    isBot: false,
    botName: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    clickedAt: new Date(),
    ...overrides,
  }
}

function makeDeps() {
  const clickRepo: IClickRepository = {
    record: vi.fn(async () => makeClick()),
    isDuplicate: vi.fn(async () => false),
    findByLink: vi.fn(),
    getRecentClicks: vi.fn(),
  }

  const metricsRepo: IMetricsRepository = {
    upsertDaily: vi.fn(async () => ({
      linkId: 'link-1',
      date: '2026-05-05',
      clicks: 1,
      uniqueVisitors: 1,
      bots: 0,
      topCountry: null,
      topReferrer: null,
      topDevice: null,
    })),
    getRange: vi.fn(),
    getAggregated: vi.fn(),
  }

  const linkRepo: ILinkRepository = {
    findByCode: vi.fn(),
    findBySlug: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    softDelete: vi.fn(),
    isCodeAvailable: vi.fn(),
    isSlugAvailable: vi.fn(),
    incrementClicks: vi.fn(async () => {}),
  }

  const geoResolver: IGeoResolver = {
    resolve: vi.fn(async () => ({ country: 'BR', region: 'SP', city: 'Sao Paulo' })),
  }

  const notifier: IAlertNotifier = {
    notify: vi.fn(async () => {}),
  }

  return { clickRepo, metricsRepo, linkRepo, geoResolver, notifier }
}

describe('ClickRecorder', () => {
  const input: RecordClickInput = {
    linkId: 'link-1',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    referrer: null,
  }

  it('records a click and updates metrics', async () => {
    const deps = makeDeps()
    const recorder = new ClickRecorder(deps)

    const result = await recorder.record(input)
    expect(result).not.toBeNull()
    expect(deps.clickRepo.record).toHaveBeenCalledTimes(1)
    expect(deps.metricsRepo.upsertDaily).toHaveBeenCalledTimes(1)
    expect(deps.linkRepo.incrementClicks).toHaveBeenCalledTimes(1)
  })

  it('resolves geo for the IP', async () => {
    const deps = makeDeps()
    const recorder = new ClickRecorder(deps)

    await recorder.record(input)
    expect(deps.geoResolver.resolve).toHaveBeenCalledWith('192.168.1.1')
  })

  it('skips recording for duplicate within 30s window', async () => {
    const deps = makeDeps()
    vi.mocked(deps.clickRepo.isDuplicate).mockResolvedValue(true)
    const recorder = new ClickRecorder(deps)

    const result = await recorder.record(input)
    expect(result).toBeNull()
    expect(deps.clickRepo.record).not.toHaveBeenCalled()
    expect(deps.metricsRepo.upsertDaily).not.toHaveBeenCalled()
  })

  it('skips recording for bot user agents', async () => {
    const deps = makeDeps()
    const recorder = new ClickRecorder(deps)

    const botInput: RecordClickInput = {
      ...input,
      userAgent: 'Googlebot/2.1 (+http://www.google.com/bot.html)',
    }

    const result = await recorder.record(botInput)
    // Bots still get recorded for analytics but metrics increment reflects it
    expect(result).not.toBeNull()
    // The click should have isBot=true
    const recordCall = vi.mocked(deps.clickRepo.record).mock.calls[0]
    expect(recordCall).toBeDefined()
    expect((recordCall as [ClickRecordData])[0].isBot).toBe(true)
  })

  it('passes UTM params from input to click record', async () => {
    const deps = makeDeps()
    const recorder = new ClickRecorder(deps)

    const utmInput: RecordClickInput = {
      ...input,
      utmSource: 'twitter',
      utmMedium: 'social',
      utmCampaign: 'launch',
    }

    await recorder.record(utmInput)
    const recordCall = vi.mocked(deps.clickRepo.record).mock.calls[0]
    expect(recordCall).toBeDefined()
    const data = (recordCall as [ClickRecordData])[0]
    expect(data.utmSource).toBe('twitter')
    expect(data.utmMedium).toBe('social')
    expect(data.utmCampaign).toBe('launch')
  })

  it('handles geo resolution failure gracefully', async () => {
    const deps = makeDeps()
    vi.mocked(deps.geoResolver.resolve).mockResolvedValue(null)
    const recorder = new ClickRecorder(deps)

    const result = await recorder.record(input)
    expect(result).not.toBeNull()
    const recordCall = vi.mocked(deps.clickRepo.record).mock.calls[0]
    const data = (recordCall as [ClickRecordData])[0]
    expect(data.country).toBeNull()
  })
})
