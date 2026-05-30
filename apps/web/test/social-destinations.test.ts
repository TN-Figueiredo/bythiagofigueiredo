import { describe, it, expect } from 'vitest'
import {
  DESTINATIONS,
  DEST_IDS,
  getDestination,
  getDestinationsForProvider,
  destIdToProvider,
  type DestId,
} from '@/lib/social/destinations'

describe('social destinations', () => {
  it('exports exactly 4 destinations', () => {
    expect(DEST_IDS).toHaveLength(4)
    expect(Object.keys(DESTINATIONS)).toHaveLength(4)
  })

  it.each(DEST_IDS)('%s has required fields', (id) => {
    const d = getDestination(id)
    expect(d.id).toBe(id)
    expect(d.provider).toBeTruthy()
    expect(d.tint).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(d.captionLimit).toBeGreaterThanOrEqual(0)
    expect(d.width).toBeGreaterThan(0)
    expect(d.height).toBeGreaterThan(0)
  })

  it('ig_story has captionLimit 0', () => {
    expect(DESTINATIONS.ig_story.captionLimit).toBe(0)
  })

  it('ig_feed is marked rare', () => {
    expect(DESTINATIONS.ig_feed.badge).toBe('rare')
  })

  it('getDestinationsForProvider returns correct items', () => {
    const igDests = getDestinationsForProvider('instagram')
    expect(igDests).toHaveLength(2)
    expect(igDests.map(d => d.id)).toContain('ig_story')
    expect(igDests.map(d => d.id)).toContain('ig_feed')
  })

  it('getDestinationsForProvider returns exactly 1 item for youtube', () => {
    const ytDests = getDestinationsForProvider('youtube')
    expect(ytDests).toHaveLength(1)
    expect(ytDests[0].id).toBe('yt_community')
  })

  it('getDestinationsForProvider returns 0 items for bluesky', () => {
    const bsDests = getDestinationsForProvider('bluesky')
    expect(bsDests).toHaveLength(0)
  })

  it('destIdToProvider maps correctly', () => {
    expect(destIdToProvider('yt_community')).toBe('youtube')
    expect(destIdToProvider('fb_page')).toBe('facebook')
  })

  it('destIdToProvider maps all 4 IDs correctly', () => {
    expect(destIdToProvider('ig_story')).toBe('instagram')
    expect(destIdToProvider('ig_feed')).toBe('instagram')
    expect(destIdToProvider('yt_community')).toBe('youtube')
    expect(destIdToProvider('fb_page')).toBe('facebook')
  })
})
