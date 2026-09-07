// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8')

describe('middleware — Meta public callbacks skip site resolution', () => {
  it('lists both Instagram callback routes in skipSiteResolution', () => {
    const block = src.slice(src.indexOf('const skipSiteResolution'), src.indexOf('if (skipSiteResolution)'))
    expect(block).toContain("pathname.startsWith('/api/instagram/deauthorize')")
    expect(block).toContain("pathname.startsWith('/api/instagram/data-deletion')")
  })

  it('keeps the pre-existing skips intact', () => {
    const block = src.slice(src.indexOf('const skipSiteResolution'), src.indexOf('if (skipSiteResolution)'))
    expect(block).toContain("pathname.startsWith('/api/cron/')")
    expect(block).toContain("pathname.startsWith('/api/webhooks/')")
    expect(block).toContain("pathname.startsWith('/auth/callback')")
  })
})
