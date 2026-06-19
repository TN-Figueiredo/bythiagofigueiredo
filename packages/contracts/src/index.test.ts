import { describe, it, expect } from 'vitest'
import {
  mergeStrings,
} from './index.js'
import type {
  ISiteAuthGuard,
  ILogger,
  ToastFn,
  Strings,
} from './index.js'

// ── ISiteAuthGuard ──────────────────────────────────────────────────────────

describe('ISiteAuthGuard (type-level)', () => {
  it('accepts a conforming implementation', () => {
    const guard: ISiteAuthGuard = {
      requireSiteAdmin: async (siteId: string) => {
        if (!siteId) throw new Error('unauthorized')
      },
      canEditSite: async (_siteId: string) => true,
      canPublishSite: async (_siteId: string) => false,
    }
    expect(guard).toBeDefined()
  })

  it('requireSiteAdmin resolves on success', async () => {
    const guard: ISiteAuthGuard = {
      requireSiteAdmin: async () => { /* ok */ },
      canEditSite: async () => true,
      canPublishSite: async () => true,
    }
    await expect(guard.requireSiteAdmin('site-1')).resolves.toBeUndefined()
  })

  it('requireSiteAdmin can throw on forbidden', async () => {
    const guard: ISiteAuthGuard = {
      requireSiteAdmin: async () => { throw new Error('Forbidden') },
      canEditSite: async () => false,
      canPublishSite: async () => false,
    }
    await expect(guard.requireSiteAdmin('site-1')).rejects.toThrow('Forbidden')
  })

  it('canEditSite returns boolean', async () => {
    const guard: ISiteAuthGuard = {
      requireSiteAdmin: async () => { /* ok */ },
      canEditSite: async () => true,
      canPublishSite: async () => false,
    }
    expect(await guard.canEditSite('site-1')).toBe(true)
    expect(await guard.canPublishSite('site-1')).toBe(false)
  })
})

// ── ILogger ─────────────────────────────────────────────────────────────────

describe('ILogger (type-level)', () => {
  it('accepts a conforming implementation', () => {
    const calls: Array<{ level: string; msg: string; data?: Record<string, unknown> }> = []
    const logger: ILogger = {
      info: (msg, data) => { calls.push({ level: 'info', msg, data }) },
      warn: (msg, data) => { calls.push({ level: 'warn', msg, data }) },
      error: (msg, data) => { calls.push({ level: 'error', msg, data }) },
    }
    logger.info('hello')
    logger.warn('watch out', { key: 'val' })
    logger.error('boom', { code: 500 })

    expect(calls).toHaveLength(3)
    expect(calls[0]).toEqual({ level: 'info', msg: 'hello', data: undefined })
    expect(calls[1]).toEqual({ level: 'warn', msg: 'watch out', data: { key: 'val' } })
    expect(calls[2]).toEqual({ level: 'error', msg: 'boom', data: { code: 500 } })
  })

  it('data is optional in info/warn/error', () => {
    const logger: ILogger = {
      info: (msg, _data?) => { expect(msg).toBe('no-data') },
      warn: () => { /* ok */ },
      error: () => { /* ok */ },
    }
    logger.info('no-data')
  })
})

// ── ToastFn ─────────────────────────────────────────────────────────────────

describe('ToastFn (type-level)', () => {
  it('accepts a conforming implementation', () => {
    const shown: Array<{ type: string; msg: string }> = []
    const toast: ToastFn = {
      success: (msg) => { shown.push({ type: 'success', msg }) },
      error: (msg) => { shown.push({ type: 'error', msg }) },
    }
    toast.success('done!')
    toast.error('oops')

    expect(shown).toHaveLength(2)
    expect(shown[0]).toEqual({ type: 'success', msg: 'done!' })
    expect(shown[1]).toEqual({ type: 'error', msg: 'oops' })
  })
})

// ── Strings + mergeStrings ───────────────────────────────────────────────────

describe('Strings type', () => {
  it('accepts flat string records', () => {
    const s: Strings = { greeting: 'hello', farewell: 'bye' }
    expect(s['greeting']).toBe('hello')
  })

  it('accepts nested records', () => {
    const s: Strings = {
      actions: { save: 'Save', cancel: 'Cancel' },
      title: 'My App',
    }
    expect((s['actions'] as Strings)['save']).toBe('Save')
  })
})

describe('mergeStrings', () => {
  it('returns defaults when overrides is empty', () => {
    const defaults = { a: 'alpha', b: 'beta' }
    const result = mergeStrings(defaults, {})
    expect(result).toEqual({ a: 'alpha', b: 'beta' })
  })

  it('overrides take precedence over defaults', () => {
    const defaults = { a: 'alpha', b: 'beta' }
    const result = mergeStrings(defaults, { a: 'A' })
    expect(result).toEqual({ a: 'A', b: 'beta' })
  })

  it('keys in defaults not in overrides are preserved', () => {
    const defaults = { x: 'ex', y: 'why', z: 'zee' }
    const result = mergeStrings(defaults, { z: 'Z' })
    expect(result['x']).toBe('ex')
    expect(result['y']).toBe('why')
    expect(result['z']).toBe('Z')
  })

  it('merges nested objects recursively', () => {
    const defaults: Strings = {
      actions: { save: 'Save', cancel: 'Cancel', delete: 'Delete' },
      title: 'My App',
    }
    const overrides: Strings = {
      actions: { save: 'Salvar' },
    }
    const result = mergeStrings(defaults, overrides)
    const actions = result['actions'] as Strings
    expect(actions['save']).toBe('Salvar')
    expect(actions['cancel']).toBe('Cancel')
    expect(actions['delete']).toBe('Delete')
    expect(result['title']).toBe('My App')
  })

  it('override can add new keys not in defaults', () => {
    const defaults = { a: 'alpha' }
    const result = mergeStrings(defaults, { b: 'beta' })
    expect(result['a']).toBe('alpha')
    expect(result['b']).toBe('beta')
  })

  it('does not mutate the defaults object', () => {
    const defaults = { a: 'alpha', b: 'beta' }
    const original = { ...defaults }
    mergeStrings(defaults, { a: 'A' })
    expect(defaults).toEqual(original)
  })

  it('does not mutate the overrides object', () => {
    const defaults = { a: 'alpha' }
    const overrides = { a: 'A', b: 'B' }
    const originalOverrides = { ...overrides }
    mergeStrings(defaults, overrides)
    expect(overrides).toEqual(originalOverrides)
  })

  it('handles deeply nested merge', () => {
    const defaults: Strings = {
      ui: {
        modal: { title: 'Modal', close: 'Close' },
        sidebar: { open: 'Open', close: 'Close' },
      },
    }
    const overrides: Strings = {
      ui: {
        modal: { title: 'Janela' },
      },
    }
    const result = mergeStrings(defaults, overrides)
    const ui = result['ui'] as Strings
    const modal = ui['modal'] as Strings
    const sidebar = ui['sidebar'] as Strings
    expect(modal['title']).toBe('Janela')
    expect(modal['close']).toBe('Close')
    expect(sidebar['open']).toBe('Open')
  })

  it('returns a new object (not reference equality)', () => {
    const defaults = { a: 'alpha' }
    const overrides = {}
    const result = mergeStrings(defaults, overrides)
    expect(result).not.toBe(defaults)
    expect(result).not.toBe(overrides)
  })
})
