export function getSocialConfig() {
  return {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
    meta: {
      appId: process.env.META_APP_ID ?? '',
      appSecret: process.env.META_APP_SECRET ?? '',
    },
    masterKey: process.env.SOCIAL_MASTER_KEY ?? '',
    callbackBaseUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  }
}

export function validateSocialConfig(): { valid: boolean; missing: string[] } {
  const required = [
    'SOCIAL_MASTER_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'META_APP_ID',
    'META_APP_SECRET',
  ]
  const missing = required.filter((key) => !process.env[key])
  return { valid: missing.length === 0, missing }
}
