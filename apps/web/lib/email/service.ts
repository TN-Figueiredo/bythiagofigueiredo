import { BrevoEmailAdapter, type IEmailService } from '@tn-figueiredo/email'

let cached: IEmailService | null = null

export function getEmailService(): IEmailService {
  if (cached) return cached
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured')
  cached = new BrevoEmailAdapter(apiKey)
  return cached
}
