import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('getSocialConfig', () => {
  const envBackup: Record<string, string | undefined> = {}
  const envKeys = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'META_APP_ID',
    'META_APP_SECRET',
    'SOCIAL_MASTER_KEY',
    'NEXT_PUBLIC_APP_URL',
  ] as const

  beforeEach(() => {
    // Save original env values
    for (const key of envKeys) {
      envBackup[key] = process.env[key]
    }
  })

  afterEach(() => {
    // Restore original env values
    for (const key of envKeys) {
      if (envBackup[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = envBackup[key]
      }
    }
  })

  it('returns expected shape with all env vars set', async () => {
    process.env.GOOGLE_CLIENT_ID = 'g-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'g-client-secret'
    process.env.META_APP_ID = 'meta-app-id'
    process.env.META_APP_SECRET = 'meta-app-secret'
    process.env.SOCIAL_MASTER_KEY = 'master-key'
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'

    const { getSocialConfig } = await import('@/lib/social/config')
    const config = getSocialConfig()

    expect(config).toEqual({
      google: {
        clientId: 'g-client-id',
        clientSecret: 'g-client-secret',
      },
      meta: {
        appId: 'meta-app-id',
        appSecret: 'meta-app-secret',
      },
      masterKey: 'master-key',
      callbackBaseUrl: 'https://example.com',
    })
  })

  it('returns empty strings when env vars are missing', async () => {
    for (const key of envKeys) {
      delete process.env[key]
    }

    const { getSocialConfig } = await import('@/lib/social/config')
    const config = getSocialConfig()

    expect(config.google.clientId).toBe('')
    expect(config.google.clientSecret).toBe('')
    expect(config.meta.appId).toBe('')
    expect(config.meta.appSecret).toBe('')
    expect(config.masterKey).toBe('')
    expect(config.callbackBaseUrl).toBe('http://localhost:3000')
  })
})
