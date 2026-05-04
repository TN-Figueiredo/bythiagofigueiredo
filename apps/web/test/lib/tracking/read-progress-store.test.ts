import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ReadProgressStore } from '../../../lib/tracking/read-progress-store'

const mockStorage = new Map<string, string>()
const localStorageMock = {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
}

vi.stubGlobal('localStorage', localStorageMock)

describe('ReadProgressStore', () => {
  beforeEach(() => mockStorage.clear())

  it('returns null for unread post', () => {
    const store = new ReadProgressStore()
    expect(store.getProgress('post-1')).toBeNull()
  })

  it('sets and retrieves progress', () => {
    const store = new ReadProgressStore()
    store.setProgress('post-1', 50)
    const result = store.getProgress('post-1')
    expect(result).not.toBeNull()
    expect(result!.depth).toBe(50)
  })

  it('only increases depth (never decreases)', () => {
    const store = new ReadProgressStore()
    store.setProgress('post-1', 75)
    store.setProgress('post-1', 30)
    expect(store.getProgress('post-1')!.depth).toBe(75)
  })

  it('updates depth when higher', () => {
    const store = new ReadProgressStore()
    store.setProgress('post-1', 50)
    store.setProgress('post-1', 80)
    expect(store.getProgress('post-1')!.depth).toBe(80)
  })

  it('getAllRead returns all entries', () => {
    const store = new ReadProgressStore()
    store.setProgress('a', 100)
    store.setProgress('b', 50)
    const all = store.getAllRead()
    expect(all.size).toBe(2)
  })

  it('isRead returns true for depth >= 95', () => {
    const store = new ReadProgressStore()
    store.setProgress('post-1', 95)
    expect(store.isRead('post-1')).toBe(true)
  })

  it('isRead returns false for depth < 95', () => {
    const store = new ReadProgressStore()
    store.setProgress('post-1', 94)
    expect(store.isRead('post-1')).toBe(false)
  })

  it('isRead supports custom threshold parameter', () => {
    const store = new ReadProgressStore()
    store.setProgress('post-1', 80)
    expect(store.isRead('post-1', 80)).toBe(true)
    expect(store.isRead('post-1', 90)).toBe(false)
  })

  it('cleanup removes entries older than maxAgeDays', () => {
    const store = new ReadProgressStore()
    store.setProgress('recent', 100)

    const raw = JSON.parse(mockStorage.get('btf_read_progress') ?? '{}')
    raw['old-post'] = { d: 100, t: Math.floor(Date.now() / 1000) - 400 * 86400 }
    mockStorage.set('btf_read_progress', JSON.stringify(raw))

    store.cleanup(365)
    expect(store.getProgress('old-post')).toBeNull()
    expect(store.getProgress('recent')).not.toBeNull()
  })
})
