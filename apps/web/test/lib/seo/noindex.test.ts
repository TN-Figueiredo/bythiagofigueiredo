import { describe, it, expect } from 'vitest'
import { PROTECTED_DISALLOW_PATHS, isPathIndexable } from '@/lib/seo/noindex'

describe('noindex', () => {
  it('PROTECTED_DISALLOW_PATHS covers admin/cms/account/api', () => {
    expect(PROTECTED_DISALLOW_PATHS).toEqual(expect.arrayContaining([
      '/admin', '/cms', '/account', '/api',
    ]))
  })

  it.each([
    ['/admin/dashboard', false],
    ['/cms/blog/new', false],
    ['/account/settings', false],
    ['/api/cron/foo', false],
    ['/newsletter/confirm/abc', false],
    ['/unsubscribe/abc', false],
    ['/lgpd/confirm/abc', false],
    ['/site-error', false],
    ['/site-not-configured', false],
    ['/cms/disabled', false],
    ['/blog/pt-BR/some-post', true],
    ['/campaigns/pt-BR/some-campaign', true],
    ['/privacy', true],
    ['/terms', true],
    ['/contact', true],
    ['/', true],
  ])('isPathIndexable(%s) === %s', (path, expected) => {
    expect(isPathIndexable(path as string)).toBe(expected)
  })
})
