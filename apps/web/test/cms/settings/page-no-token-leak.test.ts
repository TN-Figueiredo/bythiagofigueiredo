// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(process.cwd(), 'src/app/cms/(authed)/settings/page.tsx'), 'utf8')

describe('settings/page.tsx — the access token never reaches the client', () => {
  it('never projects access_token nor * from instagram_accounts', () => {
    const projections = [...src.matchAll(/instagram_accounts'\)\s*\n?\s*\.select\((['"`])([\s\S]*?)\1/g)]
      .map((m) => m[2] ?? '')
    expect(projections.length).toBeGreaterThan(0)
    for (const p of projections) {
      expect(p).not.toContain('access_token')
      expect(p.trim()).not.toBe('*')
    }
  })

  it('derives `connected` from a dedicated query instead of shipping the token', () => {
    expect(src).toContain(".not('access_token', 'is', null)")
    expect(src).toContain('connectedIds')
  })

  it('projects the seven health columns the card needs', () => {
    for (const col of [
      'token_error', 'token_error_at', 'token_error_mode', 'token_refreshed_at',
      'token_alert_sent_at', 'ig_user_id', 'ig_user_id_source',
    ]) {
      expect(src).toContain(col)
    }
  })

  it('passes the OAuth props down to the section', () => {
    expect(src).toContain('instagramOAuthConfigured')
    expect(src).toContain('isPreview')
    expect(src).toContain('instagramHandleMismatch')
    expect(src).toContain('siteTimezone')
  })
})
